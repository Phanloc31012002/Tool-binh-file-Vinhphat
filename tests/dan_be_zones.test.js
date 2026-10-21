"use strict";
// Dàn trộn nhiều mẫu theo khu: bộ test tích hợp qua nest()/nestAsync(). Mọi phép đo dùng bộ đo
// độc lập (dan_be_zone_checker.js) trên đường bế thật, không tin toạ độ hay báo cáo của lõi.
const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const L = require("./dan_be_shape_library");
const circle = require("./dan_be_circle_fixture");
const fx = require("./dan_be_zone_fixtures");
const checker = require("./dan_be_zone_checker");

const began = Date.now();
const failures = [];
function run(name, fn) {
  const t0 = Date.now();
  try { fn(); console.log("đạt: " + name + " (" + (Date.now() - t0) + " ms)"); } catch (error) {
    failures.push(name + ": " + error.message); console.error("HỎNG " + name + ": " + error.message);
  }
}
const RESCUE = /^Chia khu không xếp đủ mọi mẫu, tạm dùng cách dàn xen kẽ cũ\./;

// Khối khẳng định chung cho một ca chia khu thành công.
function checkZoned(label, input, zoneGapMm, options) {
  options = options || {};
  const before = JSON.stringify(input);
  const t0 = Date.now(), r = nester.nest(input), ms = Date.now() - t0;
  assert.equal(r.ok, true, label + ": " + r.error);
  assert.equal(JSON.stringify(input), before, label + ": không được sửa đầu vào");
  assert.match(r.mode, /dàn chia khu theo mẫu/, label + ": mode");
  assert.ok(!RESCUE.test(r.detail), label + ": không được rơi vào cứu hộ");
  assert.equal(r.slots.length, r.count);
  const observed = input.types.map(() => 0);
  r.slots.forEach((s) => { assert.equal(s.angle, s.vi * 90); observed[s.mi]++; });
  assert.deepEqual(r.counts, observed, label + ": counts khớp slot");
  r.counts.forEach((n, k) => assert.ok(n >= 1, label + ": bài " + (k + 1) + " phải có mặt"));
  input.types.forEach((_, k) => assert.equal(checker.clusterCount(input, r, k), 1, label + ": bài " + (k + 1) + " phải là một cụm liền"));
  checker.checkLayout(input, r, Math.max(zoneGapMm, input.gapMm));
  checker.assertSeparable(input, r);
  assert.ok(Array.isArray(r.zones) && r.zones.length >= 2, label + ": có thông tin khu");
  if (!options.skipLegacy) {
    const legacy = nester.nestLegacy(fx.standardInput(input.types.map((t) => t), { sheet: input.sheet, gapMm: input.gapMm }));
    assert.ok(legacy.ok, label + ": bộ cũ chạy được");
    assert.ok(r.count > legacy.count, label + ": nhiều con hơn cách cũ (" + r.count + " so với " + legacy.count + ")");
    options.legacyCount = legacy.count;
  }
  const again = nester.nest(input);
  assert.deepEqual(again.slots, r.slots, label + ": chạy lại y hệt");
  assert.ok(ms <= 30000, label + ": quá 30 giây (" + ms + " ms)");
  console.log("  " + label + ": " + r.count + " con [" + r.counts + "]" + (options.legacyCount ? ", bộ cũ " + options.legacyCount : "") + ", " + ms + " ms — " + r.detail);
  return r;
}

const totals = { 0: 0, 5: 0 }, legacyTotal = { 0: 0, 5: 0 };
for (const set of fx.mixedSets()) for (const zoneGapMm of [0, 5]) {
  run(set.name + ", khu cách " + zoneGapMm, () => {
    const input = fx.standardInput(set.types, { zoneGapMm });
    const options = {};
    const r = checkZoned(set.name, input, zoneGapMm, options);
    totals[zoneGapMm] += r.count; legacyTotal[zoneGapMm] += options.legacyCount;
  });
}
run("tổng hơn cách cũ", () => {
  assert.ok(legacyTotal[0] > 0 && legacyTotal[5] > 0, "phải có số đo của bộ cũ");
  assert.ok(totals[0] >= 1.3 * legacyTotal[0], "tắt tick: " + totals[0] + " so với cũ " + legacyTotal[0] + " (cần +30%)");
  assert.ok(totals[5] >= 1.25 * legacyTotal[5], "bật tick 5 mm: " + totals[5] + " so với cũ " + legacyTotal[5] + " (cần +25%)");
  console.log("  tổng 4 bộ: tắt tick " + totals[0] + "/" + legacyTotal[0] + ", bật tick " + totals[5] + "/" + legacyTotal[5]);
});

const smallSix = () => [
  { groups: circle.curveFor(20), curveErrorMm: 0.00025 }, L.heart(25, 23), L.star(5, 13, 5.5),
  L.teardrop(20, 29), L.regular(6, 12), L.rect(20, 12),
];
run("6 khuôn nhỏ", () => { checkZoned("6 khuôn nhỏ", fx.standardInput(smallSix(), { zoneGapMm: 5 }), 5); });

run("mẫu rất to + mẫu rất nhỏ", () => {
  checkZoned("card 92 × 56 + tròn 10", fx.standardInput([L.rect(92, 56), { groups: circle.curveFor(10), curveErrorMm: 0.00025 }], { zoneGapMm: 0 }), 0);
});

run("4 bài cùng khuôn tròn + tim", () => {
  const base = circle.curveFor(30);
  const moved = base.map((g) => g.map((c) => c.map((p) => [p[0] + 50, p[1] - 20])));
  const reversed = base.map((g) => g.map((c) => c.slice().reverse()));
  const restarted = base.map((g) => g.map((c) => c.slice(7).concat(c.slice(0, 7))));
  const types = [{ groups: base, curveErrorMm: 0.00025 }, { groups: moved, curveErrorMm: 0.00025 },
    { groups: reversed, curveErrorMm: 0.00025 }, { groups: restarted, curveErrorMm: 0.00025 }, L.heart()];
  const input = fx.standardInput(types, { zoneGapMm: 5 });
  const r = checkZoned("4 bài tròn 30 + tim", input, 5);
  const circles = r.counts.slice(0, 4);
  assert.ok(Math.max(...circles) - Math.min(...circles) <= 1, "4 bài cùng khuôn tròn chênh ≤ 1: " + circles);
  assert.deepEqual(checker.cutterGroupsOf(input), [[0, 1, 2, 3], [4]]);
});

run("khe 0, khu cách bằng khe", () => {
  checkZoned("tim + sao, khe 0", fx.standardInput([L.heart(), L.star(5, 26, 11)], { zoneGapMm: 0, gapMm: 0 }), 0);
});

run("8 khuôn nhỏ trong 30 giây", () => {
  const types = smallSix().concat([L.triangle(26, 14), L.bone(35, 15)]);
  const input = fx.standardInput(types, { zoneGapMm: 5 });
  const t0 = Date.now(), r = nester.nest(input), ms = Date.now() - t0;
  assert.ok(ms <= 30000, "8 khuôn quá 30 giây: " + ms);
  if (r.ok && !RESCUE.test(r.detail)) {
    r.counts.forEach((n, k) => assert.ok(n >= 1, "bài " + (k + 1) + " có mặt"));
    checker.checkLayout(input, r, 5);
    console.log("  8 khuôn: " + r.count + " con [" + r.counts + "], " + ms + " ms");
  } else {
    assert.match(r.ok ? r.detail : r.error, RESCUE, "không chia khu được thì phải báo cứu hộ");
    console.log("  8 khuôn: cứu hộ, " + ms + " ms");
  }
});

run("cứu hộ khi không đủ chỗ", () => {
  const input = fx.standardInput([L.rect(92, 56), { groups: circle.curveFor(60), curveErrorMm: 0.00025 }],
    { sheet: { widthMm: 120, heightMm: 90, dots: [] } });
  const r = nester.nest(input), legacy = nester.nestLegacy(input);
  assert.match(r.ok ? r.detail : r.error, RESCUE, "phải báo cứu hộ");
  assert.equal(r.ok, legacy.ok);
  if (r.ok) assert.deepEqual(r.slots, legacy.slots, "cứu hộ trả đúng bố cục bộ cũ");
  else assert.ok(r.error.indexOf(legacy.error) > 0, "giữ lỗi của bộ cũ: " + r.error);
});

run("khuôn không vừa tờ báo lỗi như cũ", () => {
  const input = fx.standardInput([L.rect(400, 400), L.heart()]);
  const r = nester.nest(input);
  assert.equal(r.ok, false);
  assert.match(r.error, /loại 1/);
});

run("nestAsync báo tiến độ và trùng nest()", () => {
  const set = fx.mixedSets()[0];
  const input = fx.standardInput(set.types, { zoneGapMm: 5 });
  const sync = nester.nest(input);
  const progress = [];
  let done = null;
  const realSetTimeout = global.setTimeout;
  const queue = [];
  global.setTimeout = (fn) => { queue.push(fn); return queue.length; };
  try {
    nester.nestAsync(input, (p) => progress.push(p), (r) => { done = r; });
    while (queue.length) queue.shift()();
  } finally { global.setTimeout = realSetTimeout; }
  assert.ok(progress.length >= 1, "có báo tiến độ");
  progress.forEach((p) => assert.ok(Number.isInteger(p.done) && Number.isInteger(p.total) && p.done <= p.total));
  assert.ok(done && done.ok, "có kết quả");
  assert.deepEqual(done.slots, sync.slots);
  assert.deepEqual(done.counts, sync.counts);
  console.log("  tiến độ: " + progress.length + " lần, cuối " + JSON.stringify(progress[progress.length - 1]));
});

run("nestAsync với một khuôn", () => {
  const input = fx.standardInput([L.heart()]);
  const sync = nester.nest(input);
  let done = null;
  const realSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => { fn(); return 1; };
  try { nester.nestAsync(input, () => {}, (r) => { done = r; }); } finally { global.setTimeout = realSetTimeout; }
  assert.ok(done && done.ok);
  assert.deepEqual(done.slots, sync.slots);
});

run("không PON thì canh giữa đúng", () => {
  const set = fx.mixedSets()[0];
  const input = fx.standardInput(set.types, { zoneGapMm: 5, sheet: { widthMm: 330, heightMm: 354, dots: [] } });
  const r = checkZoned("bộ 1 không PON", input, 5, { skipLegacy: true });
  assert.equal(r.centering.exact, true);
  const err = checker.centreError(input, r);
  assert.ok(Math.abs(err[0]) < 0.001 && Math.abs(err[1]) < 0.001, "lệch tâm " + err);
  assert.ok(Math.abs(r.centering.offsetXmm - err[0]) < 1e-8 && Math.abs(r.centering.offsetYmm - err[1]) < 1e-8);
});

assert.ok(Date.now() - began < 600000, "bộ test chia khu chạy trong thời gian hữu hạn");
assert.deepEqual(failures, [], failures.join("\n"));
console.log("Dàn chia khu: mọi ca đạt trong " + (Date.now() - began) + " ms.");
