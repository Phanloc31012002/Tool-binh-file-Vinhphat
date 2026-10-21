"use strict";

// Lõi xếp hàng lồng (v2.17): mốc số con theo khuôn thật của xưởng và các biên dạng tổng quát,
// kiểm tra độc lập khe/PON/lề trên đường bế đã làm phẳng, khép đúng khe, canh giữa, luân phiên
// bài cùng khuôn, chạy lại cho cùng kết quả và vẫn giữ phương án cũ khi bộ tìm cũ nhiều con hơn.
const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const L = require("./dan_be_shape_library");
const circ = require("./dan_be_circle_fixture");
const { cap } = require("./dan_be_cap_fixture");
const EPS = 1e-9;

function turn(p, angle) {
  if (angle === 90) return [-p[1], p[0]];
  if (angle === 180) return [-p[0], -p[1]];
  if (angle === 270) return [p[1], -p[0]];
  return p.slice();
}
function pointSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function cross(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function segmentDistance(a, b, c, d) {
  const x = cross(a, b, c), y = cross(a, b, d), u = cross(c, d, a), w = cross(c, d, b);
  if (((x > EPS && y < -EPS) || (x < -EPS && y > EPS)) && ((u > EPS && w < -EPS) || (u < -EPS && w > EPS))) return 0;
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
}
function inside(p, contours) {
  let parity = false;
  for (const c of contours)
    for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
      const a = c[i], b = c[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) parity = !parity;
    }
  return parity;
}
// Đặt khuôn theo slot (x,y = góc dưới trái khung bao sau khi xoay), dựng chỉ mục cạnh theo ô 4 mm.
function placed(groups, slot) {
  const rotated = groups.map((g) => g.map((c) => c.map((p) => turn(p, slot.angle))));
  const all = rotated.flat(2);
  const x0 = Math.min(...all.map((p) => p[0])), y0 = Math.min(...all.map((p) => p[1]));
  const contours = rotated.flat().map((c) => c.map((p) => [p[0] - x0 + slot.x, p[1] - y0 + slot.y]));
  const edges = [], bins = new Map();
  for (const c of contours)
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length];
      const e = { a, b, x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) };
      edges.push(e);
      for (let y = Math.floor(e.y0 / 4); y <= Math.floor(e.y1 / 4); y++)
        for (let x = Math.floor(e.x0 / 4); x <= Math.floor(e.x1 / 4); x++) {
          const k = x + "," + y;
          if (!bins.has(k)) bins.set(k, []);
          bins.get(k).push(e);
        }
    }
  const pts = contours.flat();
  return { contours, edges, bins, x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])),
    x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) };
}
function boxGap(a, b) { return Math.hypot(Math.max(a.x0 - b.x1, b.x0 - a.x1, 0), Math.max(a.y0 - b.y1, b.y0 - a.y1, 0)); }
function pairDistance(a, b, limit) {
  let best = Infinity;
  for (const e of a.edges) {
    for (let y = Math.floor((e.y0 - limit) / 4); y <= Math.floor((e.y1 + limit) / 4); y++)
      for (let x = Math.floor((e.x0 - limit) / 4); x <= Math.floor((e.x1 + limit) / 4); x++)
        for (const f of b.bins.get(x + "," + y) || []) {
          if (boxGap(e, f) >= Math.min(best, limit)) continue;
          best = Math.min(best, segmentDistance(e.a, e.b, f.a, f.b));
        }
  }
  return best;
}
// Kiểm tra độc lập: lề, PON (từ mép chấm), không chồng/không lọt vào nhau, khe thật >= khe nhập.
function guard(input, result) {
  const shapes = result.slots.map((s) => placed(input.types[s.mi].groups, s));
  const tol = 0.001;
  let nearest = Infinity;
  for (const s of shapes) {
    assert.ok(s.x0 >= input.marginMm - tol && s.y0 >= input.marginMm - tol &&
      s.x1 <= input.sheet.widthMm - input.marginMm + tol && s.y1 <= input.sheet.heightMm - input.marginMm + tol, "đường bế nằm trong lề tờ");
    for (const d of input.sheet.dots) {
      assert.equal(inside([d.x, d.y], s.contours), false, "tâm PON không nằm trong khuôn");
      if (boxGap(s, { x0: d.x, x1: d.x, y0: d.y, y1: d.y }) >= d.r + input.ponClearMm) continue;
      const dist = Math.min(...s.edges.map((e) => pointSegment([d.x, d.y], e.a, e.b)));
      assert.ok(dist >= d.r + input.ponClearMm - tol, `khuôn cách mép PON ${dist - d.r} < ${input.ponClearMm} mm`);
    }
  }
  const grid = new Map();
  shapes.forEach((s, i) => {
    const k = Math.floor((s.x0 + s.x1) / 80) + "," + Math.floor((s.y0 + s.y1) / 80);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  for (let i = 0; i < shapes.length; i++) {
    const a = shapes[i], cx = Math.floor((a.x0 + a.x1) / 80), cy = Math.floor((a.y0 + a.y1) / 80);
    const reach = Math.ceil((Math.max(a.x1 - a.x0, a.y1 - a.y0) + input.gapMm + 1) / 40) + 1;
    for (let gx = cx - reach; gx <= cx + reach; gx++)
      for (let gy = cy - reach; gy <= cy + reach; gy++)
        for (const j of grid.get(gx + "," + gy) || []) {
          if (j <= i) continue;
          const b = shapes[j];
          if (boxGap(a, b) >= input.gapMm + 0.01) continue;
          assert.equal(inside(a.contours[0][0], b.contours) || inside(b.contours[0][0], a.contours), false, "khuôn không lọt vào nhau");
          const dist = pairDistance(a, b, input.gapMm + 0.01);
          assert.ok(dist >= input.gapMm - tol, `khe thật ${dist} < ${input.gapMm} mm`);
          nearest = Math.min(nearest, dist);
        }
  }
  return { shapes, nearest };
}
function sheet(w = 330, h = 354) {
  return { widthMm: w, heightMm: h, dots: [
    { x: 10, y: 10, r: 2.5 }, { x: w - 10, y: 10, r: 2.5 }, { x: 10, y: h - 10, r: 2.5 }, { x: w - 10, y: h - 10, r: 2.5 }] };
}
function inputFor(type, gap, extra = {}) {
  return Object.assign({ sheet: sheet(), types: [type], gapMm: gap, marginMm: 4, ponClearMm: 7.5,
    resolutionMm: 0.25, budgetMs: 3000 }, extra);
}
function check(label, input, minimum, opts = {}) {
  const before = JSON.stringify(input), began = Date.now();
  const result = nester.nest(input);
  const ms = Date.now() - began;
  assert.equal(result.ok, true, `${label}: ${result.error}`);
  assert.equal(JSON.stringify(input), before, "không sửa dữ liệu nguồn");
  assert.ok(result.count >= minimum, `${label}: ${result.count} con < mốc ${minimum}`);
  assert.equal(result.count, result.slots.length);
  const counts = input.types.map(() => 0);
  for (const s of result.slots) {
    assert.ok(Number.isInteger(s.vi) && s.vi >= 0 && s.vi < 4 && s.angle === s.vi * 90, "chỉ xoay 0/90/180/270, giữ kích thước");
    counts[s.mi]++;
  }
  assert.deepEqual(result.counts, counts);
  const audit = guard(input, result);
  if (opts.mode) assert.match(result.mode, opts.mode);
  if (opts.tightGap) assert.ok(audit.nearest <= input.gapMm + 0.005, `${label}: khe gần nhất ${audit.nearest} phải khép sát ${input.gapMm} mm`);
  if (opts.maxMs) assert.ok(ms < opts.maxMs, `${label}: ${ms} ms vượt ${opts.maxMs} ms`);
  console.log(`${label}: ${result.count} con (mốc ${minimum}), khe gần nhất ${audit.nearest.toFixed(4)} mm, ${ms} ms — ${result.mode}`);
  return result;
}
const circle = (d) => ({ groups: circ.curveFor(d, 0.00025), curveErrorMm: 0.00025 });

const began = Date.now(), failures = [];
function run(label, fn) { try { fn(); } catch (e) { failures.push(`${label}: ${e.message}`); console.error("FAIL " + label + ": " + e.message); } }

// Khuôn tròn thật của xưởng trên tờ 33 × 35,4 cm, khe 1 mm, PON 5 mm cách mép 10 mm.
for (const [d, shop] of [[30, 114], [40, 63], [50, 42], [60, 27], [75, 18], [80, 14]])
  run(`tròn ${d / 10} cm`, () => check(`Tròn ${d / 10} cm, khe 1 mm (khuôn xưởng ${shop} con)`, inputFor(circle(d), 1), shop,
    { tightGap: true, mode: /xếp hàng lồng/ }));
run("tròn 2,5 cm tờ 33 × 35", () => check("Tròn 2,5 cm trên tờ 33 × 35 cm (khuôn xưởng 162 con)",
  inputFor(circle(25), 1, { sheet: sheet(330, 350) }), 162, { tightGap: true }));

// Biên dạng tổng quát: lồng đối đầu, so le, răng cưa; mốc đặt dưới kết quả hiện tại một chút.
const generic = [
  ["Tam giác 53 × 27", L.triangle(), 1, 125],
  ["Hình thang", L.trapezoid(), 1, 96],
  ["Tim 51 × 46", L.heart(), 1, 52],
  ["Giọt nước 40 × 58", L.teardrop(), 1, 52],
  ["Sao 5 cánh", L.star(5, 26, 11), 2, 66],
  ["Mũi tên", L.arrow(), 2, 60],
  ["Lục giác", L.regular(6, 25), 1, 54],
  ["Bát giác", L.regular(8, 25, Math.PI / 8), 1, 44],
  ["Bán nguyệt", L.semicircle(), 2, 56],
  ["Trăng khuyết", L.crescent(), 1, 86],
  ["Mũ cong 53 × 26,5", { groups: cap(), curveErrorMm: 0.005 }, 1, 98],
  ["Chữ nhật bo 70 × 40", L.roundRect(70, 40, 8), 1, 33],
  ["Vòng có lỗ (compound)", L.ring(), 2, 50],
];
for (const [label, type, gap, min] of generic)
  run(label, () => check(`${label}, khe ${gap} mm`, inputFor(type, gap), min, { maxMs: 20000 }));

// Khép đúng khe theo đường bế thật (không giữ phần đệm lưới), cả hàng lẫn chéo.
run("khép khe tim", () => check("Tim, khe 1,5 mm khép sát", inputFor(L.heart(), 1.5), 50, { tightGap: true }));
run("khe 0", () => {
  const r = check("Chữ nhật 92 × 56, khe 0", inputFor(L.rect(92, 56), 0), 18);
  assert.ok(r.slots.length >= 18);
});

// Không PON: phải canh giữa tuyệt đối theo khung thật.
run("canh giữa", () => {
  const input = inputFor(L.heart(), 1, { sheet: { widthMm: 300, heightMm: 280, dots: [] } });
  const r = check("Tim, tờ không PON", input, 36);
  assert.equal(r.centering.exact, true, "không bị PON chặn thì canh giữa đúng");
  assert.ok(Math.abs(r.centering.offsetXmm) < 0.001 && Math.abs(r.centering.offsetYmm) < 0.001);
});

// Tờ hẹp dài: kiểm tra đổi hướng hàng (chạy dọc tờ) vẫn đúng toạ độ/hướng xoay.
run("tờ dọc", () => check("Bầu dục 60 × 40 trên tờ 120 × 400", inputFor(L.ellipse(60, 40), 2,
  { sheet: sheet(120, 400) }), 14));

const { assertClusterTidy } = require("./dan_be_cluster_check");

// Nhiều bài cùng khuôn: dàn một lần, gom mỗi bài thành một cụm liền, chênh tối đa 1.
run("bài cùng khuôn", () => {
  const base = L.heart();
  const moved = { groups: base.groups.map((g) => g.map((c) => c.map((p) => [p[0] + 40, p[1] - 12]).reverse())), curveErrorMm: base.curveErrorMm };
  const input = inputFor(base, 1, { types: [base, moved, base] });
  const r = check("3 bài dùng chung khuôn tim", input, 52, { mode: /gom cụm các bài cùng khuôn/ });
  // Mỗi bài một cụm liền (kề nhau: khung bao cách ≤ khe + nửa cạnh dài), không lẫn vào bao lồi cụm khác.
  [0, 1, 2].forEach((k) => assertClusterTidy(input, r, k));
  assert.ok(Math.max(...r.counts) - Math.min(...r.counts) <= 1);
});

// Cùng đầu vào → cùng kết quả (không phụ thuộc may rủi thời gian ở các khuôn thường).
run("ổn định", () => {
  const a = nester.nest(inputFor(L.teardrop(), 1)), b = nester.nest(inputFor(L.teardrop(), 1));
  assert.equal(a.count, b.count, "chạy lại cùng số con");
  assert.deepEqual(a.slots, b.slots, "chạy lại cùng vị trí");
});

// Bộ tìm cũ vẫn thi đua: chữ L 45 × 45 khe 1 mm bộ cũ được 71 con, không được ít hơn.
run("thi đua bộ cũ", () => check("Chữ L 45 × 45 (bộ cũ thắng)", inputFor(L.elbow(), 1), 71));

// Khuôn khác nhau trên cùng tờ: bộ chia khu (mỗi khuôn một khu, gom cụm, lấp đầy); bài nào cũng có mặt.
run("khác khuôn", () => {
  const input = inputFor(circle(30), 2, { types: [circle(30), L.rect(40, 25)], budgetMs: 1000 });
  const r = check("Tròn 3 cm + chữ nhật 40 × 25 chung tờ", input, 20, { mode: /dàn chia khu theo mẫu/ });
  r.counts.forEach((n, k) => assert.ok(n >= 1, "bài " + (k + 1) + " phải có mặt"));
});

assert.ok(Date.now() - began < 240000, "bộ kiểm thử xếp hàng lồng chạy trong thời gian hữu hạn");
assert.deepEqual(failures, [], failures.join("\n"));
console.log(`Lõi xếp hàng lồng: mọi ca đạt trong ${Date.now() - began} ms.`);
