"use strict";
// Nút Clip ở header: clip từng object đang chọn đúng bằng khung Transform của nó, không hỏi
// kích thước (anh Lộc 22/10: "clip đã clip được transform rồi thì bỏ chỗ nhập kích thước đi").
// Auto Save đo khổ PDF theo khung Transform luôn, không phụ thuộc tick. Nút "Clip 9.2 × 5.6"
// ở tab Auto Save và bộ clip theo kích thước nhập (hai bộ logic clip, soát mã Q6) đã bỏ hẳn.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");
const main = fs.readFileSync(require.resolve("../DanCardCEP/js/main.js"), "utf8");
const html = fs.readFileSync(require.resolve("../DanCardCEP/index.html"), "utf8");
const MM = 2.834645669;
const rect = (l, t, wMm, hMm) => [l, t, l + wMm * MM, t - hMm * MM];
const plain = (v) => JSON.parse(JSON.stringify(v));

// ---- Panel ----
assert.ok(!/id="clipW"|id="clipH"|id="clipUnit"|id="clipOk"|id="clipCancel"/.test(html), "bỏ bảng nhập kích thước clip");
assert.ok(!/id="btnClipCard"|id="outClipCard"|Clip 9\.2/.test(html), "bỏ nút Clip 9.2 × 5.6 ở Auto Save");
assert.match(html, /id="btnClip"[^>]*title="[^"]*Transform/, "nút Clip nói rõ clip theo khung Transform");
assert.match(html, /id="clipMsg"/, "còn chỗ báo kết quả clip");
assert.match(main, /dcClipTheoTransform\(\)/);
assert.ok(main.indexOf("dcClipCard926") < 0 && main.indexOf("dcClipToSize(") < 0, "panel không gọi hàm cũ");
assert.match(main, /dcClipToSizeVersion < 9/, "nạp nóng bản clip mới");
assert.ok(!/dcClipCard926Version/.test(main));
// Nút Resize vẫn còn nguyên bảng nhập.
assert.match(html, /id="resizeW"/);

// ---- Lib: bỏ mã chết ----
for (const fn of ["function dcClipCard926(", "function _dcClipCard926Core", "function _dcClipToSizeCore(",
  "function _dcClipToCardStyleCore(", "function dcClipToSize(", "dcClipCard926Version"]) {
  assert.ok(lib.indexOf(fn) < 0, fn + " đã bỏ");
}
assert.ok(lib.indexOf("đã có clip, giữ nguyên") >= 0);

// ---- Lib: hành vi dcClipTheoTransform trên Illustrator giả ----
function fakeLayer(log) {
  return {
    pathItems: {
      rectangle(top, left, w, h) {
        const mask = { typename: "PathItem", top, left, w, h, filled: true, stroked: true, clipping: false,
          move(target, placement) { log.push(["mask.move", target.id, placement]); } };
        log.push(["rectangle", top, left, w, h]);
        return mask;
      },
    },
    groupItems: {
      add() {
        const group = { id: "G" + log.length, typename: "GroupItem", clipped: false, selected: false };
        log.push(["group.add", group.id]);
        return group;
      },
    },
  };
}
function item(typename, bounds, layer, extra) {
  const it = Object.assign({ typename, geometricBounds: bounds.slice(), visibleBounds: bounds.slice(), layer, selected: false,
    move(target, placement) { it.movedTo = [target.id, placement]; } }, extra || {});
  return it;
}
function run(selection, flagOn) {
  const log = [];
  const layer = fakeLayer(log);
  const sel = selection(layer);
  const ctx = vm.createContext({
    dcDoTheoKhungTransform: !!flagOn,
    ElementPlacement: { PLACEATBEGINNING: "begin", PLACEATEND: "end" },
    app: {
      documents: { length: 1 },
      activeDocument: { selection: sel },
      selection: null,
      executeMenuCommand() {},
      redraw() {},
      preferences: { getBooleanPreference: () => false },
    },
  });
  vm.runInContext(lib, ctx);
  return { out: ctx.dcClipTheoTransform(), log, sel, ctx };
}

// (a) Group thường: con 1 là nền 92 × 56, con 2 có nét tràn ra (visibleBounds to hơn) → mask đúng
//     khung Transform 92 × 56 (geometric), KHÔNG theo visibleBounds; tick Transform đang TẮT vẫn vậy.
{
  const r = run((layer) => {
    const nen = item("PathItem", rect(10, -10, 92, 56), layer);
    const net = item("PathItem", rect(10, -10, 92, 56), layer, { visibleBounds: rect(5, -5, 100, 64) });
    const g = item("GroupItem", rect(10, -10, 92, 56), layer, { clipped: false, pageItems: [nen, net], visibleBounds: rect(5, -5, 100, 64) });
    return [g];
  }, false);
  const rectCall = r.log.find((e) => e[0] === "rectangle");
  assert.ok(rectCall, "phải tạo mask");
  assert.deepEqual(plain(rectCall.slice(1)), [-10, 10, 92 * MM, 56 * MM], "mask = khung Transform (top, left, w, h)");
  const group = r.log.find((e) => e[0] === "group.add");
  assert.deepEqual(plain(r.sel[0].movedTo), [group[1], "end"], "object vào group clip mới");
  assert.ok(r.log.some((e) => e[0] === "mask.move" && e[2] === "begin"), "mask lên đầu group");
  assert.match(r.out, /^OK: Đã clip 1\/1 object theo khung Transform: 92,00 × 56,00 mm\.$/);
}
// (b) Object đã có clip → giữ nguyên, không tạo mask; báo số lượng. Mask bọc trong group con cũng là "đã clip".
{
  const r = run((layer) => {
    const mask = item("PathItem", rect(0, 0, 152, 72), layer, { clipping: true });
    const clipped = item("GroupItem", rect(-100, 50, 400, 90), layer, { clipped: true, pageItems: [item("GroupItem", rect(0, 0, 152, 72), layer, { pageItems: [mask] })] });
    const plainGroup = item("GroupItem", rect(0, -300, 92, 56), layer, { clipped: false, pageItems: [item("RasterItem", rect(0, -300, 92, 56), layer)] });
    return [clipped, plainGroup];
  }, true);
  assert.equal(r.log.filter((e) => e[0] === "rectangle").length, 1, "chỉ object chưa clip mới được clip");
  assert.match(r.out, /^OK: Đã clip 1\/2 object theo khung Transform: 92,00 × 56,00 mm; 1 object đã có clip, giữ nguyên\.$/);
}
// (c) Nhiều khổ khác nhau → liệt kê từng khổ kèm số object.
{
  const r = run((layer) => [
    item("RasterItem", rect(0, 0, 92, 56), layer),
    item("RasterItem", rect(0, -500, 92, 56), layer),
    item("RasterItem", rect(0, -1000, 152, 72), layer),
  ], false);
  assert.match(r.out, /^OK: Đã clip 3\/3 object theo khung Transform: 92,00 × 56,00 mm \(2 object\), 152,00 × 72,00 mm \(1 object\)\.$/);
}
// (d) Chưa chọn gì → ERR rõ; không ném lỗi.
{
  const r = run(() => [], false);
  assert.match(r.out, /^ERR: Hãy chọn ít nhất 1 object để clip\./);
}
// (e) Object không đo được khung → báo lỗi từng object, các object khác vẫn clip.
{
  const r = run((layer) => [
    item("PathItem", [0, 0, 0, 0], layer),
    item("RasterItem", rect(0, -500, 92, 56), layer),
  ], false);
  assert.match(r.out, /^OK: Đã clip 1\/2 object theo khung Transform: 92,00 × 56,00 mm\.\nObject 1: /);
}

// ---- Auto Save: khung từng mặt luôn theo Transform, không phụ thuộc tick ----
{
  const start = lib.indexOf("function _dcAutoSavePDFCore(");
  const s = lib.indexOf("  function bndOf(item) {", start);
  const e = lib.indexOf("  function exportCard(", s);
  assert.ok(s > start && e > s);
  const transform = rect(0, 0, 92, 56);
  const ctx = vm.createContext({
    dcDoTheoKhungTransform: false,
    dcKhungThanhPham: () => transform.slice(),
    dcDoKhung: (it, legacy) => legacy(it), // nếu còn đi qua cờ thì sẽ ra khung cũ → test đỏ
  });
  vm.runInContext(lib.slice(s, e), ctx);
  assert.deepEqual(plain(ctx.frameOf({ typename: "GroupItem", visibleBounds: rect(-5, 5, 120, 80) })), transform);
  // Transform không đo được → dự phòng khung clip/visibleBounds như cũ.
  ctx.dcKhungThanhPham = () => null;
  assert.deepEqual(plain(ctx.frameOf({ typename: "RasterItem", visibleBounds: rect(-5, 5, 120, 80) })), rect(-5, 5, 120, 80));
}
console.log("clip_transform: ok");
