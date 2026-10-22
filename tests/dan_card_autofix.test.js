"use strict";
// Dàn Card tự sửa khổ (autoFixByBackground) phải làm trên bản sao: không sửa được thì
// object nguồn còn nguyên vector, không để lại rác; sửa được mới thay nguồn.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");
const MM = 2.834645669;

function slice(startMarker, endMarker) {
  const s = lib.indexOf(startMarker), e = lib.indexOf(endMarker, s);
  assert.ok(s >= 0 && e > s, "không thấy " + startMarker);
  return lib.slice(s, e);
}
const helpers = [
  slice("  // theoNoiDung = true: đo nội dung thật", "  // Tìm object con (thường là ảnh/hình BACKGROUND)"),
  slice("  function findFrameBounds(", "  // Tạo RasterizeOptions chuẩn"),
  slice("  function makeRasterOptions() {", "  // Tự sửa object sai KT"),
  slice("  function autoFixByBackground(", "  // Phá hiệu ứng/appearance"),
  slice("  function isVisibleLeaf(", "  // Đo vùng bao THẬT của object"),
  slice("  function visibleUnion(item, acc, theoNoiDung) {", "  // sắp hàng theo Y"),
].join("\n");

function world({ wholeRasterFails }) {
  const created = [];
  const rect = (l, t, wMm, hMm) => [l, t, l + wMm * MM, t - hMm * MM];
  function node(typename, bounds, extra) {
    const o = Object.assign(
      {
        typename, removed: false, pageItems: [], filled: true, stroked: false, clipping: false, clipped: false,
        get geometricBounds() { return this._b.slice(); },
        get visibleBounds() { return this._b.slice(); },
        remove() { this.removed = true; this.pageItems.forEach((k) => k.remove()); },
        translate(dx, dy) { this._b = [this._b[0] + dx, this._b[1] + dy, this._b[2] + dx, this._b[3] + dy]; },
        move(target) { target.pageItems.push(this); this.parent = target; },
        duplicate() {
          const copy = node(this.typename, this._b, { pageItems: this.pageItems.map((k) => k.duplicate()) });
          created.push(copy);
          return copy;
        },
      },
      extra || {},
    );
    o._b = bounds.slice();
    o.layer = layer;
    return o;
  }
  const layer = {
    pathItems: { rectangle(top, left, w, h) { const p = node("PathItem", [left, top, left + w, top - h]); created.push(p); return p; } },
    groupItems: { add() { const g = node("GroupItem", [0, 0, 0, 0]); created.push(g); return g; } },
  };
  const doc = {
    artboards: { getActiveArtboardIndex: () => 0, 0: { artboardRect: [0, 1000, 1000, 0] } },
    rasterize(target, frame) {
      if (!frame && wholeRasterFails) throw new Error("raster hỏng");
      const r = node("RasterItem", frame || target.geometricBounds);
      target.removed = true;
      created.push(r);
      return r;
    },
  };
  // Card có nền 93 × 56,8 mm (lệch trong 2 mm → chiến lược A bắt được) nhưng ngoài dung sai 0,5 mm.
  const background = node("PathItem", rect(0, 0, 93, 56.8));
  const logo = node("PathItem", rect(10 * MM, -10 * MM, 20, 10));
  const card = node("GroupItem", rect(0, 0, 93, 56.8), { pageItems: [background, logo] });
  const c = vm.createContext({
    doc, MM, dcDoTheoKhungTransform: true, W: 92 * MM, H: 56 * MM,
    RasterizeOptions: function () {}, AntiAliasingMethod: { ARTOPTIMIZED: 1 }, ElementPlacement: { PLACEATBEGINNING: 0, PLACEATEND: 1 },
    app: { preferences: { getBooleanPreference: () => false } },
  });
  vm.runInContext(lib, c);
  vm.runInContext(helpers, c);
  return { c, card, created };
}

// Ca 1: A đo lại vẫn sai, B hỏng → không sửa được: nguồn còn nguyên, không còn rác.
{
  const { c, card, created } = world({ wholeRasterFails: true });
  const fix = c.autoFixByBackground(card, 92, 56);
  assert.equal(fix.ok, false);
  assert.equal(fix.item, card);
  assert.equal(card.removed, false, "nguồn không được huỷ khi tự sửa thất bại");
  assert.ok(created.length > 0 && created.every((o) => o.removed), "bản sao/raster thử nghiệm phải được xoá hết");
}
// Ca 2: B thành công → thay nguồn bằng clip group 92 × 56 đúng khổ.
{
  const { c, card } = world({ wholeRasterFails: false });
  const fix = c.autoFixByBackground(card, 92, 56);
  assert.equal(fix.ok, true);
  assert.equal(card.removed, true, "sửa được thì nguồn mới bị thay");
  const size = c.visSizeMM(fix.item);
  assert.ok(Math.abs(size.w - 92) < 0.01 && Math.abs(size.h - 56) < 0.01, JSON.stringify(size));
}
// Ca 3 (soát mã độc lập): object SAI khổ thật sự (30 × 30 mm, không nền) với cờ Transform BẬT:
// chiến lược B clip về 92 × 56 nên "khung" luôn đúng — phải đo lại theo NỘI DUNG, không nhận.
{
  const { c, created } = world({ wholeRasterFails: false });
  const rect = (l, t, wMm, hMm) => [l, t, l + wMm * MM, t - hMm * MM];
  const small = c.visSizeMM ? null : null;
  const tiny = Object.assign(Object.create(Object.getPrototypeOf(created[0] || {})), {});
  // dựng object nhỏ bằng chính xưởng của world(): lấy mẫu từ card rồi đổi khung
  const w2 = world({ wholeRasterFails: false });
  const card30 = w2.card;
  card30._b = rect(0, 0, 30, 30);
  card30.pageItems.forEach((k) => { k._b = rect(0, 0, 30, 30); });
  const fix = w2.c.autoFixByBackground(card30, 92, 56);
  assert.equal(fix.ok, false, "object 30×30 không được nhận là đúng khổ 92×56");
  assert.equal(card30.removed, false, "nguồn còn nguyên");
  assert.ok(w2.created.every((o) => o.removed), "không để lại rác");
}
// Ca 4: lỗi ném ra SAU khi raster (groupItems.add hỏng) → raster/khung thử nghiệm vẫn bị dọn.
{
  const w3 = world({ wholeRasterFails: false });
  w3.card.layer.groupItems.add = () => { throw new Error("group hỏng"); };
  const fix = w3.c.autoFixByBackground(w3.card, 92, 56);
  assert.equal(fix.ok, false);
  assert.equal(w3.card.removed, false);
  assert.ok(w3.created.every((o) => o.removed), "raster/khung tạo trước lỗi phải được xoá");
}
// Danh sách bảo vệ khi dọn artboard cũ phải lấy object hiện tại của từng hàng (sau sửa), không lấy selection gốc.
assert.ok(/protectSel\.push\(rows\[[a-z]+\]\[[a-z]+\]\.o\)/.test(lib), "protectSel từ rows[*][*].o");
console.log("dan_card_autofix: ok");
