"use strict";
// Dàn Card dọn kết quả mẻ trước: chỉ xoá object do tool tạo (gắn note), object lạ trong vùng
// artboard được giữ và đếm để báo; object đang chọn và tổ tiên của nó không bao giờ bị xoá.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");

function slice(startMarker, endMarker) {
  const s = lib.indexOf(startMarker), e = lib.indexOf(endMarker, s);
  assert.ok(s >= 0 && e > s, "không thấy " + startMarker);
  return lib.slice(s, e);
}
const helpers =
  slice("  function removeSecondArtboard(d, protectList) {", "  //  PHÁT HIỆN SỐ CỘT") +
  "\n" +
  slice("  function clearOldArtboardContent(d, protectList) {", "  //  IMPORT ARTBOARD + PON TỪ FILE PON");

function world() {
  const removedIds = [];
  const layers = [];
  const doc = { layers, artboards: [] };
  doc.artboards.remove = (i) => doc.artboards.splice(i, 1);
  function layer(name, opts) {
    const l = Object.assign({ name, pageItems: [], locked: false, visible: true }, opts || {});
    layers.push(l);
    return l;
  }
  function item(id, l, bounds, opts) {
    const o = Object.assign(
      { id, typename: "PathItem", pageItems: [], parent: l, locked: false, hidden: false, note: "",
        geometricBounds: bounds.slice(), remove() { removedIds.push(id); } },
      opts || {},
    );
    if (l && l.pageItems) l.pageItems.push(o);
    return o;
  }
  return { doc, layer, item, removedIds };
}
const c = vm.createContext({});
vm.runInContext(lib, c);
vm.runInContext(helpers, c);
assert.equal(c.DC_NOTE_DAN_CARD, "DANCARD_DAN_CARD_OUTPUT");

// (a) Vùng artboard chung [0..500]: object có note TRONG vùng bị xoá; object có note NGOÀI vùng
//     (kết quả cũ người dùng kéo ra cất, hay bản Alt-kéo) giữ nguyên như bản 2.18; object lạ trong vùng
//     giữ + đếm; object lạ ngoài vùng giữ, không đếm.
{
  const w = world();
  w.doc.artboards.push({ artboardRect: [0, 500, 500, 0] });
  const L = w.layer("Layer 1");
  w.item("out-inside", L, [10, 490, 100, 400], { typename: "GroupItem", note: c.DC_NOTE_DAN_CARD });
  w.item("out-outside", L, [900, 900, 950, 850], { note: c.DC_NOTE_DAN_CARD });
  w.item("foreign-inside", L, [200, 300, 260, 260]);
  w.item("foreign-outside", L, [900, 100, 950, 50]);
  const r = c.clearOldArtboardContent(w.doc, []);
  assert.deepEqual(w.removedIds.sort(), ["out-inside"]);
  assert.deepEqual({ removed: r.removed, kept: r.kept }, { removed: 1, kept: 1 });
}
// (b) Đang chọn con bên trong group có note (hiếm, nhưng là dữ liệu người dùng): group cha được giữ.
{
  const w = world();
  w.doc.artboards.push({ artboardRect: [0, 500, 500, 0] });
  const L = w.layer("Layer 1");
  const G = w.item("old-output", L, [10, 490, 100, 400], { typename: "GroupItem", note: c.DC_NOTE_DAN_CARD });
  const child = w.item("child", G, [20, 480, 60, 440]);
  w.item("other-output", L, [200, 300, 260, 260], { note: c.DC_NOTE_DAN_CARD });
  const r = c.clearOldArtboardContent(w.doc, [child]);
  assert.deepEqual(w.removedIds, ["other-output"]);
  assert.equal(r.kept, 0, "object được bảo vệ không tính là object lạ");
}
// (c) Layer khoá/ẩn và object khoá/ẩn: không đụng, không đếm.
{
  const w = world();
  w.doc.artboards.push({ artboardRect: [0, 500, 500, 0] });
  const locked = w.layer("Khoá", { locked: true });
  w.item("locked-layer-output", locked, [10, 490, 100, 400], { note: c.DC_NOTE_DAN_CARD });
  const L = w.layer("Layer 1");
  w.item("hidden-output", L, [10, 490, 100, 400], { note: c.DC_NOTE_DAN_CARD, hidden: true });
  w.item("locked-foreign", L, [200, 300, 260, 260], { locked: true });
  const r = c.clearOldArtboardContent(w.doc, []);
  assert.deepEqual(w.removedIds, []);
  assert.deepEqual({ removed: r.removed, kept: r.kept }, { removed: 0, kept: 0 });
}
// (d) removeSecondArtboard: xoá artboard 2 và chỉ object có note trong vùng đó; object đang chọn
//     (nguồn đặt trong AB2) không bị đếm là object lạ.
{
  const w = world();
  w.doc.artboards.push({ artboardRect: [0, 500, 500, 0] }, { artboardRect: [600, 500, 1100, 0] });
  const L = w.layer("Layer 1");
  w.item("pon-ab2", L, [610, 490, 620, 480], { note: c.DC_NOTE_DAN_CARD });
  w.item("foreign-ab2", L, [700, 300, 760, 260]);
  const source = w.item("source-ab2", L, [800, 300, 860, 260]);
  w.item("pon-ab1", L, [10, 490, 20, 480], { note: c.DC_NOTE_DAN_CARD });
  const r = c.removeSecondArtboard(w.doc, [source]);
  assert.deepEqual(w.removedIds, ["pon-ab2"]);
  assert.deepEqual({ removed: r.removed, kept: r.kept }, { removed: 1, kept: 1 });
  assert.equal(w.doc.artboards.length, 1);
}
// Số object lạ chỉ đếm một lần: AB2 nằm trong vùng chung đã đếm ở clearOldArtboardContent.
assert.ok(lib.indexOf("donCu.kept += donAb2.kept") < 0, "không cộng dồn kept của AB2");
assert.ok(/removeSecondArtboard\(doc, protectSel\)/.test(lib), "removeSecondArtboard nhận danh sách bảo vệ");
// Nhánh voucher + card cũng gắn note cho group kết quả và ghi chú offset.
const voucher = lib.slice(lib.indexOf("function runVoucherWithCard()"), lib.indexOf("// Ghi chú con đôi ra panel"));
assert.ok((voucher.match(/\.note = DC_NOTE_DAN_CARD/g) || []).length >= 2, "voucher: group kết quả + ghi chú offset gắn note (PON gắn trong importPonCore dùng chung)");
// (e) Tài liệu lớn: bảo vệ tra bằng bảng uuid dựng một lần (N + M lần đọc, không N × M).
{
  const w = world();
  w.doc.artboards.push({ artboardRect: [0, 5000, 5000, 0] });
  const L = w.layer("Layer 1");
  let reads = 0;
  const withUuid = (o, id) => Object.defineProperty(o, "uuid", { get() { reads++; return id; } });
  const protect = [];
  for (let i = 0; i < 400; i++) {
    const o = withUuid(w.item("o" + i, L, [i * 10, 100, i * 10 + 5, 90], i % 2 ? { note: c.DC_NOTE_DAN_CARD } : {}), "u" + i);
    if (i < 50) protect.push(o);
  }
  const r = c.clearOldArtboardContent(w.doc, protect);
  assert.equal(r.removed, 175); // 200 object có note trừ 25 object được bảo vệ (lẻ < 50)
  assert.ok(reads <= 400 + 50 + 10, "đọc uuid " + reads + " lần");
}
// Mọi thứ Dàn Card tạo ra đều gắn note: group kết quả, PON duplicate, ghi chú offset.
assert.match(lib, /grp\.note = DC_NOTE_DAN_CARD/, "groupAndCenter gắn note");
assert.match(lib, /dupped\[i\]\.note = DC_NOTE_DAN_CARD/, "PON duplicate gắn note");
assert.match(lib, /tf\.note = DC_NOTE_DAN_CARD/, "ghi chú offset gắn note");
// Kết quả báo số object lạ được giữ lại.
assert.ok(lib.indexOf("object không do tool tạo trong vùng artboard") >= 0);
console.log("dan_card_cleanup: ok");
