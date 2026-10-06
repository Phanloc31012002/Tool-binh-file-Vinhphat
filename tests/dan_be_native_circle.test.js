"use strict";
const assert = require("node:assert/strict");
const engine = require("../DanCardCEP/js/dan_be_nester");

// Giữ đúng hình học bốn đoạn cubic của pathItems.ellipse() trong Illustrator, không dùng
// đường tròn sin/cos lý tưởng. Bridge thật làm phẳng ellipse 50 mm gốc của Illustrator
// thành 128 đỉnh; bán kính lớn nhất của nó là 25.00679985 mm chứ không phải 25 mm.
function illustratorCircle(diameter) {
  const r = diameter / 2,
    k = 0.5522847498307936,
    points = [];
  const anchors = [
    [0, r],
    [r, 2 * r],
    [2 * r, r],
    [r, 0],
  ];
  const controls = [
    [
      [0, r + k * r],
      [r - k * r, 2 * r],
    ],
    [
      [r + k * r, 2 * r],
      [2 * r, r + k * r],
    ],
    [
      [2 * r, r - k * r],
      [r + k * r, 0],
    ],
    [
      [r - k * r, 0],
      [0, r - k * r],
    ],
  ];
  for (let q = 0; q < 4; q++) {
    const a = anchors[q],
      b = controls[q][0],
      c = controls[q][1],
      d = anchors[(q + 1) % 4];
    for (let i = 0; i < 32; i++) {
      const t = i / 32,
        u = 1 - t;
      points.push([
        u * u * u * a[0] +
          3 * u * u * t * b[0] +
          3 * u * t * t * c[0] +
          t * t * t * d[0],
        u * u * u * a[1] +
          3 * u * u * t * b[1] +
          3 * u * t * t * c[1] +
          t * t * t * d[1],
      ]);
    }
  }
  return [[points]];
}
const groups = illustratorCircle(50);
const profile = engine._test.circleLike(groups);
assert.ok(profile);
assert.ok(
  Math.abs(profile.radius - 25.00679985159256) < 1e-8,
  "retained fixture must reproduce native cubic-circle bulge",
);
const sheet = {
  widthMm: 330.000000033917,
  heightMm: 354.000000036371,
  dots: [
    { x: 10.0000019136746, y: 343.999997783619, r: 2.50000015390447 },
    { x: 320.000000138853, y: 343.999997783619, r: 2.49999914459916 },
    { x: 10.0000019136746, y: 10.0000002341426, r: 2.49999914459916 },
    { x: 320.000000138853, y: 10.0000002341426, r: 2.49999813529384 },
  ],
};
const input = {
  sheet,
  types: [{ groups }],
  gapMm: 1,
  marginMm: 4,
  ponClearMm: 7.5,
  resolutionMm: 0.25,
  budgetMs: 3000,
};
function verify(result, source) {
  assert.equal(result.ok, true, result.error);
  const step = source.resolutionMm,
    margin = source.marginMm;
  const variants = [];
  source.types.forEach((type, mi) =>
    [0, 90, 180, 270].forEach((a, vi) =>
      variants.push(
        engine._test.buildVariant(type.groups, mi, vi, a, source.gapMm, step),
      ),
    ),
  );
  const plan = result.slots.map((s) => ({
    mi: s.mi,
    v: s.mi * 4 + s.vi,
    x: (s.x - margin) / step,
    y: (s.y - margin) / step,
  }));
  const dots = source.sheet.dots.map((d) => ({
    x: (d.x - margin) / step,
    y: (d.y - margin) / step,
    radius: (d.r + source.ponClearMm) / step,
  }));
  assert.equal(
    engine._test.verifyGeometry(
      plan,
      variants,
      (source.sheet.widthMm - 2 * margin) / step,
      (source.sheet.heightMm - 2 * margin) / step,
      dots,
      source.gapMm,
      step,
    ),
    true,
    "native cubic contour must keep physical gap/PON/margin",
  );
}
const result = engine.nest(input);
verify(result, input);
assert.equal(
  result.count,
  42,
  "native 50 mm Illustrator ellipse must retain all 42 safe slots",
);
const shared = Object.assign({}, input, { types: [{ groups }, { groups }] });
const sharedResult = engine.nest(shared);
verify(sharedResult, shared);
assert.equal(sharedResult.count, 42);
assert.deepEqual(sharedResult.counts, [21, 21]);

// Việc nhận dạng hình gần tròn có thể định hướng cho lưới, nhưng tuyệt đối không được coi hình
// gần tròn là tròn lý tưởng hay trả về phương án khởi đầu danh định không hợp lệ về vật lý.
const oval = groups.map((g) =>
  g.map((c) => c.map((p) => [p[0], p[1] * 1.001])),
);
const ovalInput = Object.assign({}, input, { types: [{ groups: oval }] });
verify(engine.nest(ovalInput), ovalInput);
console.log(
  "Native Illustrator cubic circle: 42 dies, true contour clearance and shared artwork balance checked",
);
