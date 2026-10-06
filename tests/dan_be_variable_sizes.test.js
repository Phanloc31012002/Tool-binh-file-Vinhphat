"use strict";
const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const { nodes, curve } = require("./dan_be_variable_fixture");

function rectangle(w, h) {
  return [
    [
      [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ],
    ],
  ];
}
function turn(p, angle) {
  if (angle === 90) return [-p[1], p[0]];
  if (angle === 180) return [-p[0], -p[1]];
  if (angle === 270) return [p[1], -p[0]];
  return p.slice();
}
function rotated(groups, angle) {
  return groups.map((g) => g.map((c) => c.map((p) => turn(p, angle))));
}
function bounds(points) {
  return {
    x0: Math.min(...points.map((p) => p[0])),
    y0: Math.min(...points.map((p) => p[1])),
    x1: Math.max(...points.map((p) => p[0])),
    y1: Math.max(...points.map((p) => p[1])),
  };
}
function placed(groups, slot) {
  const turned = rotated(groups, slot.angle),
    raw = bounds(turned.flat(2));
  const contours = turned.map((g) =>
    g.map((c) =>
      c.map((p) => [p[0] - raw.x0 + slot.x, p[1] - raw.y0 + slot.y]),
    ),
  );
  const vertices = contours.flat(2),
    edges = [];
  for (const g of contours)
    for (const c of g)
      for (let i = 0; i < c.length; i++)
        edges.push([c[i], c[(i + 1) % c.length]]);
  return { groups: contours, vertices, edges, ...bounds(vertices) };
}
function pointIn(p, groups) {
  return groups.some((g) => {
    let inside = false;
    for (const c of g)
      for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
        const a = c[i],
          b = c[j];
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
    ad = cross(a, b, d),
    ca = cross(c, d, a),
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
// Tự dựng lại độc lập các đường viền liên tục, thay vì tin vào kết quả
// raster/kiểm tra vật lý của code thật. Ở đây không bỏ qua chốt chặn an toàn nào.
function physicalGuard(input, result) {
  const outlines = result.slots.map((s) => placed(input.types[s.mi].groups, s)),
    tolerance = 0.001;
  for (let i = 0; i < outlines.length; i++) {
    const a = outlines[i],
      slot = result.slots[i];
    const source = bounds(
      rotated(input.types[slot.mi].groups, slot.angle).flat(2),
    );
    assert.ok(
      Math.abs(a.x1 - a.x0 - source.x1 + source.x0) < 1e-7 &&
        Math.abs(a.y1 - a.y0 - source.y1 + source.y0) < 1e-7,
      "placed outline is a rigid translation/rotation, with no hidden resize",
    );
    assert.ok(
      a.x0 >= input.marginMm - tolerance &&
        a.y0 >= input.marginMm - tolerance &&
        a.x1 <= input.sheet.widthMm - input.marginMm + tolerance &&
        a.y1 <= input.sheet.heightMm - input.marginMm + tolerance,
      "physical sheet margin",
    );
    for (const dot of input.sheet.dots) {
      const p = [dot.x, dot.y];
      assert.equal(pointIn(p, a.groups), false, "PON not enclosed in a cutter");
      const distance = Math.min(
        ...a.edges.map((e) => pointSegment(p, e[0], e[1])),
      );
      assert.ok(
        distance + tolerance >= dot.r + input.ponClearMm,
        "physical PON-edge clearance",
      );
    }
  }
  for (let i = 0; i < outlines.length; i++)
    for (let j = i + 1; j < outlines.length; j++) {
      const a = outlines[i],
        b = outlines[j];
      if (
        Math.hypot(
          Math.max(a.x0 - b.x1, b.x0 - a.x1, 0),
          Math.max(a.y0 - b.y1, b.y0 - a.y1, 0),
        ) >= input.gapMm
      )
        continue;
      for (const p of a.vertices)
        assert.equal(pointIn(p, b.groups), false, "no filled overlap");
      for (const p of b.vertices)
        assert.equal(pointIn(p, a.groups), false, "no filled containment");
      let distance = Infinity;
      for (const ea of a.edges)
        for (const eb of b.edges)
          distance = Math.min(
            distance,
            segmentDistance(ea[0], ea[1], eb[0], eb[1]),
          );
      assert.ok(
        distance + tolerance >= input.gapMm,
        "continuous cutter-to-cutter gap",
      );
    }
  const block = {
    x0: Math.min(...outlines.map((a) => a.x0)),
    y0: Math.min(...outlines.map((a) => a.y0)),
    x1: Math.max(...outlines.map((a) => a.x1)),
    y1: Math.max(...outlines.map((a) => a.y1)),
  };
  const offsets = [
    (block.x0 + block.x1 - input.sheet.widthMm) / 2,
    (block.y0 + block.y1 - input.sheet.heightMm) / 2,
  ];
  assert.ok(
    Math.abs(result.centering.offsetXmm - offsets[0]) < 1e-7 &&
      Math.abs(result.centering.offsetYmm - offsets[1]) < 1e-7,
    "centering metadata matches real physical bounds",
  );
  assert.equal(
    result.centering.exact,
    offsets.every((v) => Math.abs(v) <= 0.001),
  );
}
function inputFor(groups) {
  return {
    sheet: {
      widthMm: 330,
      heightMm: 354,
      dots: [
        { x: 10, y: 344, r: 2.5 },
        { x: 320, y: 344, r: 2.5 },
        { x: 10, y: 10, r: 2.5 },
        { x: 320, y: 10, r: 2.5 },
      ],
    },
    types: groups.map((g) => ({ groups: g })),
    gapMm: 1,
    marginMm: 4,
    ponClearMm: 7.5,
    resolutionMm: 0.25,
    budgetMs: 250,
  };
}
function check(groups, minimum, label) {
  const input = inputFor(groups),
    before = JSON.stringify(input);
  const result = nester.nest(input);
  assert.equal(result.ok, true, `${label}: ${result.error}`);
  assert.ok(
    result.count >= minimum,
    `${label}: useful silhouette fallback must retain at least ${minimum} copies`,
  );
  assert.equal(result.slots.length, result.count);
  assert.equal(
    JSON.stringify(input),
    before,
    "source dimensions/contours cannot be mutated to make the layout fit",
  );
  const observed = groups.map(() => 0);
  result.slots.forEach((s) => {
    assert.ok(Number.isInteger(s.mi) && s.mi >= 0 && s.mi < groups.length);
    assert.ok(Number.isInteger(s.vi) && s.vi >= 0 && s.vi < 4);
    assert.equal(
      s.angle,
      s.vi * 90,
      "slot rotation agrees with its unchanged physical cutter",
    );
    observed[s.mi]++;
  });
  assert.deepEqual(
    result.counts,
    observed,
    "model counts match their actual slots",
  );
  physicalGuard(input, result);
  console.log(
    `${label}: ${result.count} copies [${result.counts}], independent physical guard passed`,
  );
  return result;
}

const began = Date.now();
assert.equal(nodes.length, 7);
const live = curve(),
  liveBounds = bounds(live.flat(2));
assert.equal(
  live[0][0].length,
  99,
  "portable flatten matches the live bridge's 99-vertex outline",
);
assert.ok(
  Math.abs(liveBounds.x1 - 46.0863872075781) < 1e-9 &&
    Math.abs(liveBounds.y1 - 122.000000012539) < 1e-9,
  "retain actual live dimensions, including numerical dust",
);
for (const [scale, minimum] of [
  [0.6, 54],
  [1, 18],
  [1.25, 12],
]) {
  const groups = curve(scale);
  for (const angle of scale === 1 ? [0, 90, 180, 270] : [0, 90])
    check(
      [rotated(groups, angle)],
      minimum,
      `Closed seven-node curve scale ${scale}, input rotation ${angle}`,
    );
}
const mixed = check(
  [curve(0.6), curve(1)],
  4,
  "Distinct scaled cutters sharing one sheet",
);
assert.ok(
  Math.max(...mixed.counts) - Math.min(...mixed.counts) <= 1,
  "distinct cutter types remain balanced",
);

// Vài nanomét nhiễu toạ độ của Illustrator không được làm một dòng quét
// rộng hơn bbox của nó nguyên một ô. Nhiễu dương hay âm đều theo cùng một
// quy tắc ô; còn mức tăng thật 0.00001 mm vẫn nở ra ngoài như bình thường.
const exact = nester._test.buildVariant(rectangle(50, 122), 0, 0, 0, 1, 0.25);
for (const noise of [-0.0000000125, 0.0000000125]) {
  const dusty = nester._test.buildVariant(
    rectangle(50 + noise, 122 + noise),
    0,
    0,
    0,
    1,
    0.25,
  );
  assert.equal(dusty.wCells, exact.wCells);
  assert.equal(dusty.hCells, exact.hCells);
  assert.deepEqual(
    dusty.rawRows,
    exact.rawRows,
    "numeric dust cannot add a raw-profile cell",
  );
  assert.deepEqual(
    dusty.clearRows,
    exact.clearRows,
    "numeric dust cannot add a clearance-profile cell",
  );
}
const larger = nester._test.buildVariant(
  rectangle(50.00001, 122.00001),
  0,
  0,
  0,
  1,
  0.25,
);
assert.equal(
  larger.wCells,
  exact.wCells + 1,
  "meaningful positive width increment rounds outward",
);
assert.equal(
  larger.hCells,
  exact.hCells + 1,
  "meaningful positive height increment rounds outward",
);
assert.ok(
  larger.rawRows.some((row) => row.some((span) => span[1] > exact.wCells)),
  "real geometry increment is not snapped away from the physical scanline",
);
for (const [vi, angle] of [0, 90, 180, 270].entries()) {
  const variant = nester._test.buildVariant(live, 0, vi, angle, 1, 0.25);
  for (const row of variant.rawRows)
    for (const span of row)
      assert.ok(
        span[0] >= 0 && span[1] <= variant.wCells,
        "all live rotated scanlines remain consistent with their tolerated cell bbox",
      );
}
const elapsed = Date.now() - began;
assert.ok(elapsed < 20000, "variable-size regression suite remains bounded");
console.log(
  `Boundary-noise policy passed; variable-size suite completed in ${elapsed} ms`,
);
