"use strict";
// Đo khổ theo khung Transform: một hàm chung cho mọi lệnh, đúng khung Illustrator hiện
// trong bảng Transform (clip group → khung mask; group bọc một con → con; còn lại → khung hình).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");
const main = fs.readFileSync(require.resolve("../DanCardCEP/js/main.js"), "utf8");
const html = fs.readFileSync(require.resolve("../DanCardCEP/index.html"), "utf8");
const MM = 2.834645669;

function load(previewBounds) {
  const c = vm.createContext({
    app: { preferences: { getBooleanPreference: (k) => k === "includeStrokeInBounds" && previewBounds } },
  });
  vm.runInContext(lib, c);
  return c;
}
const plain = (v) => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));
const grow = (b, d) => [b[0] - d, b[1] + d, b[2] + d, b[3] - d];
const rect = (l, t, wMm, hMm) => [l, t, l + wMm * MM, t - hMm * MM];
function shape(typename, bounds, extra) {
  return Object.assign({ typename, geometricBounds: bounds.slice(), visibleBounds: grow(bounds, 1) }, extra || {});
}
function group(children, clipped) {
  const all = children.map((k) => k.geometricBounds);
  const bounds = [
    Math.min(...all.map((b) => b[0])), Math.max(...all.map((b) => b[1])),
    Math.max(...all.map((b) => b[2])), Math.min(...all.map((b) => b[3])),
  ];
  return shape("GroupItem", bounds, { clipped: !!clipped, pageItems: children });
}

const c = load(false);
assert.equal(typeof c.dcKhungThanhPham, "function");
assert.equal(c.DC_DUNG_SAI_KHO_MM, 0.5);
// Giai đoạn kiểm chứng: mặc định TẮT (đo như bản trước); tick "Transform" ở header bật qua tiền tố.
assert.equal(c.dcDoTheoKhungTransform, false, "Mặc định tắt cho tới khi anh Lộc kiểm chứng xong");
{
  const pre = vm.createContext({ dcDoTheoKhungTransform: true, app: { preferences: { getBooleanPreference: () => false } } });
  vm.runInContext(lib, pre);
  assert.equal(pre.dcDoTheoKhungTransform, true, "lib không ghi đè cờ panel đã đặt trước khi nạp");
}
c.dcDoTheoKhungTransform = true;

// (a) Clip group: mask 92×56, nội dung 90×54 lệch vào trong → khung = mask (như Transform).
const mask = shape("PathItem", rect(0, 0, 92, 56), { clipping: true });
const content = shape("RasterItem", rect(1 * MM, -1 * MM, 90, 54));
assert.deepEqual(plain(c.dcKhungThanhPham(group([mask, content], true))), rect(0, 0, 92, 56));
// Nội dung tràn ra ngoài mask vẫn chỉ tính mask.
const spill = shape("RasterItem", rect(-5 * MM, 5 * MM, 120, 80));
assert.deepEqual(plain(c.dcKhungThanhPham(group([mask, spill], true))), rect(0, 0, 92, 56));

// (b) Mask là compound path: Illustrator chỉ lộ cờ clipping trên path con (compound.pathItems[k].clipping),
//     không có trên chính CompoundPathItem (như clippingBounds/clippingRoot trong lib).
const compoundMask = shape("CompoundPathItem", rect(10, -10, 50, 30), {
  pathItems: [shape("PathItem", rect(10, -10, 50, 30), { clipping: true }), shape("PathItem", rect(20, -15, 10, 10), { clipping: true })],
});
assert.equal(compoundMask.clipping, undefined);
assert.deepEqual(plain(c.dcKhungThanhPham(group([compoundMask, content], true))), rect(10, -10, 50, 30));

// (c) Group thường bọc đúng một clip group → khung mask bên trong.
assert.deepEqual(plain(c.dcKhungThanhPham(group([group([mask, spill], true)], false))), rect(0, 0, 92, 56));
// Group thường có nhiều con → hợp các khung con (bằng khung group khi Illustrator tính đúng).
const two = group([shape("PathItem", rect(0, 0, 10, 10)), shape("PathItem", rect(100, -100, 10, 10))], false);
assert.deepEqual(plain(c.dcKhungThanhPham(two)), two.geometricBounds);
// Group{clip group, chữ} mà Illustrator báo khung group gồm cả phần ảnh bị mask che (lỗi đã ghi ở :8671):
// khung đúng = hợp(mask, chữ), không phải khung group.
const text = shape("TextFrame", rect(5 * MM, -5 * MM, 40, 8));
const cardGroup = group([group([mask, spill], true), text], false);
cardGroup.geometricBounds = spill.geometricBounds.slice(); // Illustrator "nhìn thấy" cả ảnh tràn
assert.deepEqual(plain(c.dcKhungThanhPham(cardGroup)), rect(0, 0, 92, 56));
// Con ẩn không tính; group có quá nhiều con (>200) thì lấy khung group cho nhanh.
const hiddenKid = shape("PathItem", rect(500, -500, 10, 10), { hidden: true });
assert.deepEqual(plain(c.dcKhungThanhPham(group([shape("PathItem", rect(0, 0, 10, 10)), hiddenKid], false))), rect(0, 0, 10, 10));
const many = group(Array.from({ length: 201 }, (_, i) => shape("PathItem", rect(i, 0, 1, 1))), false);
many.geometricBounds = [0, 0, 999, -1];
assert.deepEqual(plain(c.dcKhungThanhPham(many)), [0, 0, 999, -1]);

// (d) Hình thường → geometricBounds; clip group không tìm thấy mask → geometricBounds của group.
const simple = shape("PathItem", rect(3, -3, 40, 20));
assert.deepEqual(plain(c.dcKhungThanhPham(simple)), rect(3, -3, 40, 20));
const noMask = group([content, spill], true);
assert.deepEqual(plain(c.dcKhungThanhPham(noMask)), noMask.geometricBounds);
// Object hỏng → null, không ném lỗi.
assert.equal(c.dcKhungThanhPham({ get typename() { throw new Error("Error 45"); } }), null);
assert.equal(c.dcKhungThanhPham(null), null);

// (e) "Use Preview Bounds" bật → dùng visibleBounds ở mọi nhánh.
const p = load(true);
assert.deepEqual(plain(p.dcKhungThanhPham(group([mask, content], true))), grow(rect(0, 0, 92, 56), 1));
assert.deepEqual(plain(p.dcKhungThanhPham(simple)), grow(rect(3, -3, 40, 20), 1));

// Nút "Đo khung": in Transform và cách cũ của từng object đang chọn, đánh dấu chỗ khác nhau.
{
  const clipped = group([mask, spill], true);
  clipped.visibleBounds = spill.geometricBounds.slice(); // Illustrator báo visibleBounds gồm cả ảnh tràn
  const doc = { selection: [clipped, simple] };
  const ctx = vm.createContext({ app: { documents: [doc], activeDocument: doc, preferences: { getBooleanPreference: () => false } } });
  vm.runInContext(lib, ctx);
  const out = ctx.dcDoKhungChon();
  assert.match(out, /^OK: Đo khung 2 object/);
  assert.match(out, /1\. GroupItem \(clip\)\n   Transform: 92,00 × 56,00 mm\n   Cách cũ \(visibleBounds\): 120,00 × 80,00 mm   ← KHÁC/);
  assert.match(out, /2\. PathItem\n   Transform: 40,00 × 20,00 mm\n   Cách cũ \(visibleBounds\): 40,71 × 20,71 mm   ← KHÁC/);
  assert.match(out, /Use Preview Bounds: tắt/);
  assert.equal(ctx.dcDoKhungChon.call(null), out, "không đụng tài liệu, gọi lại cho cùng kết quả");
  doc.selection = [];
  assert.match(ctx.dcDoKhungChon(), /^ERR: Hãy chọn object/);
}

// (f) dcDoKhung: cờ tắt → cách đo cũ; cờ bật → khung Transform, rơi về cách cũ khi không đo được.
const legacy = (item) => ["legacy", item];
c.dcDoTheoKhungTransform = false;
assert.deepEqual(plain(c.dcDoKhung(simple, legacy)), ["legacy", simple]);
c.dcDoTheoKhungTransform = true;
assert.deepEqual(plain(c.dcDoKhung(simple, legacy)), rect(3, -3, 40, 20));
assert.deepEqual(plain(c.dcDoKhung(null, legacy)), ["legacy", null]);

// Panel: một tiền tố ExtendScript duy nhất mang cờ + thư mục extension; mọi lệnh đi qua evalJsx.
const evalSites = main.split("cs.evalScript(").length - 1;
assert.equal(evalSites, 1, "Chỉ evalJsx được gọi cs.evalScript trực tiếp");
assert.match(main, /function evalJsx\(/);
assert.match(main, /function jsxPrelude\(/);
assert.match(main, /dcDoTheoKhungTransform = /);
assert.match(main, /dcExtensionRoot = /);
// Tick "Transform" + nút "Đo khung" nằm ở header cạnh Raster; tick mặc định tắt (không checked).
assert.match(html, /id="hdrTransform"/);
assert.ok(!/id="hdrTransform"[^>]*checked/.test(html), "mặc định tắt");
assert.match(html, /id="btnDoKhung"/);
assert.ok(html.indexOf('id="btnDoKhung"') > html.indexOf('id="btnRaster"') && html.indexOf('id="btnDoKhung"') < html.indexOf("tabbar"), "nằm trong header");
assert.match(main, /dcDoKhungChon\(\)/);
// Mọi lệnh đo khổ đều đi qua hàm đo chung (bất cứ mục tiêu nào cũng là Transform khi tick bật).
for (const fn of ["function _dcDanCore(", "function dcDanToiUu(", "function dcDanTuTro(", "function dcDanTuTroNhieuKho(",
  "function dcThemDauCatTuDong(", "function dcRunCatalogueAuto(", "function dcRunSignature8(", "function dcRunKeoGay(",
  "function dcHocMau(", "function dcApMauCore(", "function _dcAutoSavePDFCore(", "function _dcClipToCardStyleCore(",
  "function _dcClipCard926CoreV2(", "function dcResizeSelectionToSize("]) {
  const start = lib.indexOf(fn);
  assert.ok(start >= 0, fn);
  const next = lib.slice(start + fn.length).search(/\n(function |var dc\w+Version)/);
  const body = lib.slice(start, next < 0 ? lib.length : start + fn.length + next);
  assert.ok(/dcDoKhung\(|dcKhungThanhPham\(/.test(body), fn + " phải đo qua hàm Transform chung");
}
console.log("do_khung_transform: ok");
