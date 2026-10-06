"use strict";
const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const { cap } = require("./dan_be_cap_fixture");

// Biên dạng tổng quát, không phải bộ nhận dạng riêng từng sản phẩm. Chúng mô phỏng các khuôn bế
// có cạnh xiên, lồng được hai hướng đối đầu vào nhau ngay trong một hàng ngang.
const triangle = [
  [
    [
      [0, 27],
      [26.5, 0],
      [53, 27],
    ],
  ],
];
const trapezoid = [
  [
    [
      [0, 27],
      [18, 0],
      [35, 0],
      [53, 27],
    ],
  ],
];
const sheet = {
  widthMm: 330,
  heightMm: 354,
  dots: [
    { x: 10, y: 10, r: 2.5 },
    { x: 320, y: 10, r: 2.5 },
    { x: 10, y: 344, r: 2.5 },
    { x: 320, y: 344, r: 2.5 },
  ],
};
function inputFor(groups, gapMm, budgetMs = 550) {
  return {
    sheet,
    types: groups.map((g) => ({ groups: g })),
    marginMm: 4,
    ponClearMm: 7.5,
    gapMm,
    resolutionMm: 0.25,
    budgetMs,
  };
}
function turn(p, angle) {
  switch (angle) {
    case 90:
      return [-p[1], p[0]];
    case 180:
      return [-p[0], -p[1]];
    case 270:
      return [p[1], -p[0]];
    default:
      return p.slice();
  }
}
function rotateInput(groups, angle) {
  return groups.map((g) => g.map((c) => c.map((p) => turn(p, angle))));
}
function placedOutline(groups, slot) {
  const rotated = rotateInput(groups, slot.angle),
    points = rotated.flat(2);
  const x0 = Math.min(...points.map((p) => p[0]));
  const y0 = Math.min(...points.map((p) => p[1]));
  const placed = rotated.map((g) =>
    g.map((c) => c.map((p) => [p[0] - x0 + slot.x, p[1] - y0 + slot.y])),
  );
  const vertices = placed.flat(2),
    edges = [];
  placed.forEach((g) =>
    g.forEach((c) =>
      c.forEach((p, i) => edges.push([p, c[(i + 1) % c.length]])),
    ),
  );
  return {
    groups: placed,
    vertices,
    edges,
    x0: slot.x,
    y0: slot.y,
    x1: Math.max(...vertices.map((p) => p[0])),
    y1: Math.max(...vertices.map((p) => p[1])),
  };
}
function pointIn(p, groups) {
  return groups.some((group) => {
    let inside = false;
    for (const contour of group)
      for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
        const a = contour[i],
          b = contour[j];
        if (
          a[1] > p[1] !== b[1] > p[1] &&
          p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
        )
          inside = !inside;
      }
    return inside;
  });
}
function pointSegment(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = dx * dx + dy * dy;
  const t = length
    ? Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length),
      )
    : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function segmentDistance(a, b, c, d) {
  const ac = cross(a, b, c),
    ad = cross(a, b, d);
  const ca = cross(c, d, a),
    cb = cross(c, d, b);
  if (
    ((ac <= 0 && ad >= 0) || (ac >= 0 && ad <= 0)) &&
    ((ca <= 0 && cb >= 0) || (ca >= 0 && cb <= 0)) &&
    Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
      Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
    Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
      Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))
  )
    return 0;
  return Math.min(
    pointSegment(a, c, d),
    pointSegment(b, c, d),
    pointSegment(c, a, b),
    pointSegment(d, a, b),
  );
}

// Các phép kiểm tra hình học liên tục, độc lập; không gọi tới chốt chặn va chạm của code thật.
// Kiểm tra đỉnh theo cả hai chiều cũng loại luôn trường hợp nằm lọt hẳn bên trong.
function physicalGuard(input, result) {
  const outlines = result.slots.map((s) =>
    placedOutline(input.types[s.mi].groups, s),
  );
  const tolerance = 0.001;
  for (const a of outlines) {
    assert.ok(
      a.x0 >= input.marginMm - tolerance &&
        a.y0 >= input.marginMm - tolerance &&
        a.x1 <= input.sheet.widthMm - input.marginMm + tolerance &&
        a.y1 <= input.sheet.heightMm - input.marginMm + tolerance,
      "every physical cutter stays within sheet margins",
    );
    for (const d of input.sheet.dots) {
      const p = [d.x, d.y];
      assert.equal(pointIn(p, a.groups), false, "PON not inside a cutter");
      const distance = Math.min(
        ...a.edges.map((e) => pointSegment(p, e[0], e[1])),
      );
      assert.ok(
        distance + tolerance >= d.r + input.ponClearMm,
        "clearance measured from the physical PON edge",
      );
    }
  }
  for (let i = 0; i < outlines.length; i++)
    for (let j = i + 1; j < outlines.length; j++) {
      const a = outlines[i],
        b = outlines[j];
      const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0);
      const dy = Math.max(a.y0 - b.y1, b.y0 - a.y1, 0);
      if (Math.hypot(dx, dy) >= input.gapMm) continue;
      for (const p of a.vertices)
        assert.equal(pointIn(p, b.groups), false, "no filled cutter overlaps");
      for (const p of b.vertices)
        assert.equal(pointIn(p, a.groups), false, "no cutter contains another");
      let distance = Infinity;
      for (const ea of a.edges)
        for (const eb of b.edges)
          distance = Math.min(
            distance,
            segmentDistance(ea[0], ea[1], eb[0], eb[1]),
          );
      assert.ok(
        distance + tolerance >= input.gapMm,
        "continuous cutter-to-cutter distance meets the requested gap",
      );
    }
  return outlines;
}
function assertInterlockedRows(result, outlines, requireSameRow = true) {
  let bboxOverlap = false,
    opposedSameRow = false;
  for (let i = 0; i < outlines.length; i++)
    for (let j = i + 1; j < outlines.length; j++) {
      const a = outlines[i],
        b = outlines[j];
      if (
        Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.001 &&
        Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.001
      )
        bboxOverlap = true;
      if (
        Math.abs(result.slots[i].y - result.slots[j].y) < 0.001 &&
        (result.slots[i].angle - result.slots[j].angle + 360) % 360 === 180
      )
        opposedSameRow = true;
    }
  assert.ok(
    bboxOverlap,
    "uses real silhouette interlocking, not bounding-box shelves",
  );
  if (requireSameRow)
    assert.ok(opposedSameRow, "opposite headings can share the same row");
}
function checked(input, minimum, label, interlocked = true) {
  const result = nester.nest(input);
  assert.equal(result.ok, true, `${label}: ${result.error}`);
  assert.equal(
    result.slots.length,
    result.count,
    "reported total matches slots",
  );
  assert.equal(
    result.counts.reduce((a, b) => a + b, 0),
    result.count,
  );
  assert.ok(result.count >= minimum, `${label}: ${result.count} < ${minimum}`);
  const outlines = physicalGuard(input, result);
  // Phương án thắng cuối cùng có thể lại dùng các hàng kề nhau đối hướng nếu như vậy dày hơn.
  if (interlocked) assertInterlockedRows(result, outlines, false);
  console.log(
    `${label}: ${result.count} cutters, independent physical guard passed`,
  );
  return result;
}
function expiredBaseline(input, minimum, label) {
  const step = input.resolutionMm,
    margin = input.marginMm,
    variants = [];
  for (const [mi, type] of input.types.entries())
    for (const [vi, angle] of [0, 90, 180, 270].entries())
      variants.push(
        nester._test.buildVariant(
          type.groups,
          mi,
          vi,
          angle,
          input.gapMm,
          step,
        ),
      );
  const dots = input.sheet.dots.map((d) => ({
    x: (d.x - margin) / step,
    y: (d.y - margin) / step,
    radius: (d.r + input.ponClearMm) / step,
  }));
  const plans = nester._test.alternatingRowPlans(
    variants,
    input.types.length,
    (input.sheet.widthMm - 2 * margin) / step,
    (input.sheet.heightMm - 2 * margin) / step,
    dots,
    Date.now() - 1,
  );
  assert.ok(
    plans.length > 0,
    "expired refinement deadline still yields finite baseline seeds",
  );
  const plan = plans.reduce((a, b) => (a.length >= b.length ? a : b));
  const result = {
    count: plan.length,
    slots: plan.map((s) => ({
      mi: s.mi,
      vi: variants[s.v].vi,
      angle: variants[s.v].angle,
      x: margin + s.x * step,
      y: margin + s.y * step,
    })),
  };
  assert.ok(result.count >= minimum, `${label}: ${result.count} < ${minimum}`);
  assertInterlockedRows(result, physicalGuard(input, result));
  console.log(`${label}: ${result.count} alternating-row baseline cutters`);
  return result.count;
}

const began = Date.now();
// Các mốc cũ kiểu một hướng/lưới đều trên cùng tờ này lần lượt là
// 74 (tam giác, 2 mm), 83 (tam giác, 1 mm) và 73 (hình thang, 1 mm).
checked(inputFor([triangle], 2), 95, "Triangle, 2 mm gap");
checked(inputFor([triangle], 1), 112, "Triangle, 1 mm gap");
expiredBaseline(
  inputFor([triangle], 1.5),
  95,
  "Triangle, fractional 1.5 mm gap",
);
checked(inputFor([trapezoid], 1), 90, "Trapezoid, 1 mm gap");
checked(inputFor([trapezoid], 2), 84, "Trapezoid, 2 mm gap");
expiredBaseline(
  inputFor([trapezoid], 1.5),
  84,
  "Trapezoid, fractional 1.5 mm gap",
);
const triangleSeed = expiredBaseline(
  inputFor([triangle], 2),
  95,
  "Triangle, expired deadline",
);
const trapSeed = expiredBaseline(
  inputFor([trapezoid], 1),
  90,
  "Trapezoid, expired deadline",
);

// Phương án khởi đầu tất định phải luôn có sẵn ngay cả ở mức ngân sách tìm kiếm
// tối thiểu được hỗ trợ; đổi hướng của nguồn cũng không được làm mất nó.
for (const angle of [0, 90, 180, 270]) {
  const seedCount = expiredBaseline(
    inputFor([rotateInput(triangle, angle)], 2),
    95,
    `Triangle input rotation ${angle}, expired deadline`,
  );
  assert.equal(
    seedCount,
    triangleSeed,
    "baseline count is invariant under source rotation",
  );
}
const shortTriangle = checked(
  inputFor([rotateInput(triangle, 270)], 2, 250),
  95,
  "Triangle rotated 270, 250 ms budget",
);
assert.ok(
  shortTriangle.count >= triangleSeed,
  "minimum budget retains the complete dense-row seed regardless of input heading",
);
const shortTrap = checked(
  inputFor([trapezoid], 1, 250),
  90,
  "Trapezoid, 250 ms budget",
);
assert.ok(
  shortTrap.count >= trapSeed,
  "minimum budget retains the dense seed instead of a weaker partial search",
);

// Cùng một khuôn bế vật lý, khác toạ độ nguồn / điểm bắt đầu và chiều quay của contour.
// Bộ lập phương án phải tìm một lần rồi gán lại slot cho các bài theo kiểu xoay vòng.
const shiftedTriangle = triangle.map((g) =>
  g.map((c) => c.map((p) => [p[0] + 123.4, p[1] - 67.8])),
);
const restartedTriangle = triangle.map((g) =>
  g.map((c) => c.slice(1).concat(c.slice(0, 1)).reverse()),
);
const mixed = checked(
  inputFor([triangle, shiftedTriangle, restartedTriangle], 2),
  95,
  "Three artwork types share one triangle cutter",
);
assert.ok(
  Math.max(...mixed.counts) - Math.min(...mixed.counts) <= 1,
  "equivalent cutter types remain balanced",
);
mixed.slots.forEach((s, i) => {
  assert.equal(s.mi, i % 3, "same cutter slots are assigned cyclically");
  assert.equal(
    s.vi,
    s.angle / 90,
    "remapped rotation still matches its source die",
  );
});
assert.ok(
  mixed.count >= triangleSeed,
  "artwork duplication must not disable the dense silhouette search",
);
checked(
  inputFor([cap()], 1, 250),
  94,
  "Actual seven-node curved cap, 250 ms budget",
);
checked(
  inputFor([cap()], 2, 250),
  86,
  "Actual curved cap, 2 mm gap and 250 ms budget",
);

// Một khuôn bế tí hon sinh ra hàng nghìn slot. Việc bảo đảm mốc cho cả bốn
// hướng phải vẫn nhẹ ngay cả khi đã quá hạn của phần tìm kiếm tuỳ chọn.
const tiny = [[[[0, 0], [2, 0], [2, 2], [0, 2]]]];
const tinyInput = inputFor([tiny], 1, 250);
tinyInput.sheet = { widthMm: 330, heightMm: 354, dots: [] };
const tinyVariants = [0, 90, 180, 270].map((angle, vi) =>
  nester._test.buildVariant(tiny, 0, vi, angle, tinyInput.gapMm, 0.25),
);
const tinyBegan = Date.now();
const tinyPlans = nester._test.alternatingRowPlans(
  tinyVariants, 1, (330 - 8) / 0.25, (354 - 8) / 0.25, [], Date.now() - 1,
);
const tinyElapsed = Date.now() - tinyBegan;
assert.ok(tinyElapsed < 1200, "dense tiny-cutter baseline does not rebuild an occupancy grid for every phase");
const tinyPlan = tinyPlans.reduce((a, b) => a.length >= b.length ? a : b);
assert.ok(tinyPlan.length >= 9000, "tiny-cutter baseline retains thousands of valid slots");
// Kiểm tra độc lập các slot kề nhau lấy từ hàng đầu/cuối/giữa, thay vì
// đưa một test bậc hai trên 9,000 phần tử vào bộ test hồi quy nhanh.
const selectedTiny = new Set();
for (let i = 0; i < 12; i++) {
  selectedTiny.add(i);
  selectedTiny.add(tinyPlan.length - 1 - i);
  selectedTiny.add(Math.floor(tinyPlan.length / 2) + i);
}
for (const rowIndex of [0, 1, 2]) {
  const y = [...new Set(tinyPlan.map((s) => s.y))][rowIndex];
  const rowStart = tinyPlan.findIndex((s) => s.y === y);
  for (let i = 0; i < 10; i++) selectedTiny.add(rowStart + i);
}
physicalGuard(tinyInput, {
  slots: [...selectedTiny].map((i) => {
    const s = tinyPlan[i], v = tinyVariants[s.v];
    return { mi: 0, vi: v.vi, angle: v.angle, x: 4 + s.x * 0.25, y: 4 + s.y * 0.25 };
  }),
});
console.log(`Tiny 2 mm cutter: ${tinyPlan.length} baseline slots in ${tinyElapsed} ms; sampled independent guard passed`);

// Phủ toàn bộ đường tìm kiếm public, không chỉ hàm phụ dựng hàng.
// Một lưới khuôn tí hon hợp lệ từng mất nhiều giây vì lặp lại kiểm tra chiếm chỗ.
const fullTinyBegan = Date.now();
const fullTiny = nester.nest(tinyInput);
const fullTinyElapsed = Date.now() - fullTinyBegan;
assert.equal(fullTiny.ok, true, fullTiny.error);
assert.ok(fullTiny.count >= 10000, "full tiny-cutter search retains the denser verified lattice");
assert.equal(fullTiny.count, fullTiny.slots.length, "full tiny-cutter slot total matches the public count");
assert.ok(fullTinyElapsed < 2500, "full tiny-cutter search remains bounded at the 250 ms search budget");
for (const s of fullTiny.slots) {
  assert.equal(s.mi, 0);
  assert.equal(s.angle, s.vi * 90);
  assert.ok(s.x >= 4 - 0.001 && s.y >= 4 - 0.001 &&
    s.x + 2 <= 326 + 0.001 && s.y + 2 <= 350 + 0.001,
  "every tiny-cutter bounding rectangle stays within the physical margin");
}
const tinyRows = [...new Set(fullTiny.slots.map((s) => s.y))].sort((a, b) => a - b);
const fullTinySample = new Set();
for (const rowIndex of [0, 1, 2, Math.floor(tinyRows.length / 2), tinyRows.length - 1]) {
  const row = fullTiny.slots.filter((s) => Math.abs(s.y - tinyRows[rowIndex]) < 0.001)
    .sort((a, b) => a.x - b.x);
  for (const offset of [0, Math.max(0, Math.floor(row.length / 2) - 5), Math.max(0, row.length - 10)])
    for (let i = offset; i < Math.min(row.length, offset + 10); i++) fullTinySample.add(row[i]);
}
physicalGuard(tinyInput, { slots: [...fullTinySample] });
console.log(`Full tiny 2 mm cutter search: ${fullTiny.count} slots in ${fullTinyElapsed} ms; ${fullTinySample.size} adjacent-grid samples passed independent guard`);
const elapsed = Date.now() - began;
assert.ok(elapsed < 20000, "alternating-row regressions remain bounded");
console.log(`Alternating-row regression suite completed in ${elapsed} ms`);
