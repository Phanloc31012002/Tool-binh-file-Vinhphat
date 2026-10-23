"use strict";
// Dàn KTS một mẫu: cùng số con thì không dàn kịch ra mép, rồi mới ít nhát dao. Chạy đúng bộ chọn
// phương án thật của dcDanToiUu (cắt lát), không sao chép luật nào.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");
const main = fs.readFileSync(require.resolve("../DanCardCEP/js/main.js"), "utf8");

const start = lib.indexOf("function dcDanToiUu(");
function slice(from, to) {
  const a = lib.indexOf(from, start);
  const b = lib.indexOf(to, a + from.length);
  assert.ok(a > start && b > a, "Mốc cắt lát phải còn trong dcDanToiUu: " + from);
  return lib.slice(a, b);
}
const solver = slice("    function floorFit(space, size) {", "    var mixedPlan = mixedSizes");
const collector = slice("    function collectSlots(plan, left, top, regionW, regionH, output) {", "    function slotEdgeDistance(a, b) {");
const MM = 2.834645669;

// Dàn một mẫu w × h mm lên tờ paperW × paperH mm (lề an toàn 3 mm như tool). Trả plan, khung bao, nhát dao.
function layout(wMm, hMm, paperWmm, paperHmm) {
  const ctx = vm.createContext({ Math });
  vm.runInContext(
    "var MM = " + MM + ", EPS = 0.01, MARGIN = 3 * MM;" +
      "var sourceW = " + wMm + " * MM, sourceH = " + hMm + " * MM;" +
      "var usableW = " + paperWmm + " * MM - 2 * MARGIN, usableH = " + paperHmm + " * MM - 2 * MARGIN;" +
      solver +
      collector +
      "var best = solveRegion(usableW, usableH, 2); var slots = [];" +
      "collectSlots(best, MARGIN, " + paperHmm + " * MM - MARGIN, usableW, usableH, slots);" +
      "var ext = planExtent(best);" +
      "var out = { count: best.count, kind: best.kind, plan: best, slots: slots, wMm: ext.w / MM, hMm: ext.h / MM, cuts: ext.cuts, gapWmm: (usableW - ext.w) / MM, gapHmm: (usableH - ext.h) / MM };",
    ctx,
  );
  return ctx.out;
}
// Mảng tạo trong vm khác realm với assert.deepEqual strict -> chép sang mảng thường.
function bands(plan) {
  return JSON.parse(JSON.stringify(plan.bands.map((b) => [b.angle, b.repeat, b.cells])));
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.05, (msg || "") + " " + a + " != " + b);

// Card 9 × 5,6 trên 33 × 35,4: vẫn 20 con nhưng xếp như xếp tay — cột 6 trái, 1 hàng 2 con, khối xoay 4 × 3;
// cụm cao 336 mm (không phải 348 kịch mép), dư ≥ 10 mm chiều dọc.
{
  const r = layout(90, 56, 330, 354);
  assert.equal(r.count, 20);
  assert.equal(r.plan.kind, "splitV");
  near(r.plan.cut / MM, 90, "cắt dọc sau cột trái");
  assert.deepEqual(bands(r.plan.first), [[0, 6, 1]]);
  assert.deepEqual(bands(r.plan.second), [
    [0, 1, 2],
    [90, 3, 4],
  ]);
  near(r.hMm, 336, "cao cụm");
  near(r.wMm, 314, "rộng cụm");
  assert.ok(r.gapHmm >= 10, "dư dọc " + r.gapHmm);
  assert.equal(r.cuts, 15);
  assert.equal(r.slots.length, 20);
}
// 10 × 7: cùng 14 con, bỏ cách chia 2 khối (12 nhát) lấy 2 dải thẳng (9 nhát).
{
  const r = layout(100, 70, 330, 354);
  assert.equal(r.count, 14);
  assert.equal(r.plan.kind, "strips");
  assert.equal(r.cuts, 9);
}
// 6 × 4: 45 con, 2 dải thay vì 2 khối (17 thay vì 23 nhát).
{
  const r = layout(60, 40, 330, 354);
  assert.equal(r.count, 45);
  assert.equal(r.plan.kind, "strips");
  assert.ok(r.cuts <= 17, "nhát dao " + r.cuts);
}
// Số con không bao giờ giảm so với bản trước (mốc đã đo bằng luật cũ).
for (const [w, h, pw, ph, want] of [
  [92, 56, 330, 354, 20],
  [87, 55, 330, 354, 22],
  [92, 52, 330, 354, 21],
  [80, 50, 330, 354, 26],
  [55, 85, 330, 354, 22],
  [90, 56, 650, 860, 107],
  [92, 56, 430, 325, 25],
  [85, 55, 325, 430, 26],
  [102, 152, 330, 354, 6],
])
  assert.equal(layout(w, h, pw, ph).count, want, w + "×" + h + " @" + pw + "×" + ph);
// Không xoay cả tờ chỉ vì dư thêm vài mm: 10,2 × 15,2 giữ 2 × 3 đứng (dư 18 so với 20 mm khi xoay).
{
  const r = layout(102, 152, 330, 354);
  assert.deepEqual(bands(r.plan), [[0, 2, 3]]);
}
// Kịch mép là bất khả kháng khi số con đòi hỏi (8,7 × 5,5 → 22 con cao đúng 348): vẫn giữ 22 con.
{
  const r = layout(87, 55, 330, 354);
  assert.equal(r.count, 22);
  near(r.gapHmm, 0, "dư dọc");
}
// Câu kết quả ghi cách mép và số nhát dao; mốc nạp nóng đã nâng cho engine đang mở nhận code mới.
assert.match(lib, /Cụm gom giữa tờ, cách mép ngang/);
assert.match(lib, /nhát dao\./);
const ver = /var dcDanToiUuVersion = (\d+);/g;
let m,
  last = 0;
while ((m = ver.exec(lib))) last = Number(m[1]);
assert.ok(last >= 25, "dcDanToiUuVersion ≥ 25 (đang " + last + ")");
assert.ok(main.indexOf("dcDanToiUuVersion < " + last) >= 0, "main.js đòi đúng mốc " + last);
console.log("Dàn KTS gom giữa, ít dao: ok");
