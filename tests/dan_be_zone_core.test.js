"use strict";
// Lõi dàn bế mở cho bộ chia khu: chốt chặn hai mức khe (khe trong khu / khoảng cách giữa khu)
// và dàn một khuôn trong một khung chữ nhật tuỳ ý.
const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const core = nester._core;
assert.ok(core, "lõi phải mở _core cho bộ chia khu");
assert.ok(nester.version >= 11, "phiên bản lõi tăng khi mở API mới");

const sq = (x, y) => [[[[x, y], [x + 10, y], [x + 10, y + 10], [x, y + 10]]]];
const variants = core.cutterVariants(core.normalizeGroups(sq(0, 0)), 0);
// Hai ô 10 × 10 cách nhau 3 mm, khe 2.
const plan = (zb) => [{ v: 0, x: 0, y: 0, zone: 0 }, { v: 0, x: 13, y: 0, zone: zb }];
assert.equal(core.verifyGeometry(plan(0), variants, 40, 20, [], 2, 1, 5), true, "cùng khu: chỉ cần khe");
assert.equal(core.verifyGeometry(plan(1), variants, 40, 20, [], 2, 1, 5), false, "khác khu: phải ≥ 5 mm");
assert.equal(core.verifyGeometry(plan(1), variants, 40, 20, [], 2, 1), true, "không có zoneGap: như cũ");
const far = [{ v: 0, x: 0, y: 0, zone: 0 }, { v: 0, x: 16, y: 0, zone: 1 }];
assert.equal(core.verifyGeometry(far, variants, 40, 20, [], 2, 1, 5), true, "khác khu cách 6 mm: đạt");
// Chéo nhau: ô thứ hai lệch chéo (dx 13, dy 13 → cách nhau theo đường chéo ~4,24 mm).
const diag = [{ v: 0, x: 0, y: 0, zone: 0 }, { v: 0, x: 13, y: 13, zone: 1 }];
assert.equal(core.verifyGeometry(diag, variants, 40, 40, [], 2, 1, 5), false, "khác khu chéo nhau 4,24 mm: hỏng");
assert.equal(core.verifyGeometry(diag, variants, 40, 40, [], 2, 1), true, "cùng khe 2 mm: chéo 4,24 mm vẫn đạt");

// Tròn 30 trong khung 100 × 64, khe 2: đủ 6 con, nằm trong khung, qua chốt chặn.
const circle = require("./dan_be_circle_fixture").curveFor(30);
const r = core.planCutterRect(circle, 0.00025, { w: 100, h: 64 }, [], 2, 7.5, "full");
assert.ok(r.count >= 6, "tròn 30 trong 100 × 64 phải được ≥ 6 con, được " + r.count);
assert.equal(r.slots.length, r.count);
r.slots.forEach((s) => {
  assert.ok(Number.isInteger(s.vi) && s.vi >= 0 && s.vi < 4);
  assert.ok(s.x >= -1e-9 && s.y >= -1e-9 && s.x + 30 <= 100 + 1e-6 && s.y + 30 <= 64 + 1e-6, "con nằm trong khung");
});
const quick = core.planCutterRect(circle, 0.00025, { w: 100, h: 64 }, [{ x: 0, y: 0, r: 2.5 }], 2, 7.5, "quick");
assert.ok(quick.count >= 4 && quick.count <= r.count, "chấm PON ở góc khung làm mất tối đa vài con: " + quick.count);
// Chấm PON ở góc: không con nào chạm vùng né (bán kính 2,5 + 7,5 = 10 mm quanh gốc khung).
quick.slots.forEach((s) => {
  const cx = s.x + 15, cy = s.y + 15;
  assert.ok(Math.hypot(cx, cy) >= 15 + 10 - 1e-6, "con né chấm PON ở gốc khung");
});
// Khung quá nhỏ: không con nào, không ném lỗi.
const none = core.planCutterRect(circle, 0.00025, { w: 20, h: 20 }, [], 2, 7.5, "quick");
assert.deepEqual(none, { count: 0, slots: [] });
// Cùng đầu vào → cùng kết quả.
assert.deepEqual(core.planCutterRect(circle, 0.00025, { w: 100, h: 64 }, [], 2, 7.5, "full").slots, r.slots);
console.log("Lõi mở cho chia khu: " + r.count + " con tròn 30 trong 100 × 64 (quick có PON: " + quick.count + ").");
