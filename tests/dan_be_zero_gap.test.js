"use strict";
const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const { circle } = require("./dan_be_fixtures");
const { curve, nodes } = require("./dan_be_variable_fixture");

const EPS = 1e-7;
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
function properCross(a, b, c, d) {
  const ac = cross(a, b, c),
    ad = cross(a, b, d),
    ca = cross(c, d, a),
    cb = cross(c, d, b);
  return (
    ((ac > EPS && ad < -EPS) || (ac < -EPS && ad > EPS)) &&
    ((ca > EPS && cb < -EPS) || (ca < -EPS && cb > EPS))
  );
}
function segmentDistance(a, b, c, d) {
  if (properCross(a, b, c, d)) return 0;
  return Math.min(
    pointSegment(a, c, d),
    pointSegment(b, c, d),
    pointSegment(c, a, b),
    pointSegment(d, a, b),
  );
}
function insideStrict(p, groups) {
  return groups.some((g) => {
    for (const c of g)
      for (let i = 0; i < c.length; i++)
        if (pointSegment(p, c[i], c[(i + 1) % c.length]) <= EPS) return false;
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
function outline(groups, slot) {
  const turned = groups.map((g) =>
    g.map((c) => c.map((p) => turn(p, slot.angle))),
  );
  const raw = turned.flat(2),
    x0 = Math.min(...raw.map((p) => p[0])),
    y0 = Math.min(...raw.map((p) => p[1]));
  const placed = turned.map((g) =>
    g.map((c) => c.map((p) => [p[0] - x0 + slot.x, p[1] - y0 + slot.y])),
  );
  const vertices = placed.flat(2),
    edges = [];
  for (const g of placed)
    for (const c of g)
      for (let i = 0; i < c.length; i++)
        edges.push([c[i], c[(i + 1) % c.length]]);
  const shape = {
    groups: placed,
    vertices,
    edges,
    x0: slot.x,
    y0: slot.y,
    x1: Math.max(...vertices.map((p) => p[0])),
    y1: Math.max(...vertices.map((p) => p[1])),
  };
  // Chỉ mục của test này độc lập với chốt chặn của code thật. Nó chỉ loại bớt
  // các cặp đoạn thẳng theo đúng bounding box của chúng; không hề lấy mẫu vùng tô.
  shape.edgeBins = new Map();
  shape.groupRows = placed.map(() => new Map());
  let edgeIndex = 0;
  for (let gi = 0; gi < placed.length; gi++)
    for (const contour of placed[gi])
      for (let i = 0; i < contour.length; i++) {
        const edge = edges[edgeIndex++];
        edge.bounds = {
          x0: Math.min(edge[0][0], edge[1][0]),
          y0: Math.min(edge[0][1], edge[1][1]),
          x1: Math.max(edge[0][0], edge[1][0]),
          y1: Math.max(edge[0][1], edge[1][1]),
        };
        const b = edge.bounds;
        for (let y = Math.floor(b.y0 / 4); y <= Math.floor(b.y1 / 4); y++) {
          const row = shape.groupRows[gi];
          if (!row.has(y)) row.set(y, []);
          row.get(y).push(edge);
          for (let x = Math.floor(b.x0 / 4); x <= Math.floor(b.x1 / 4); x++) {
            const key = `${x},${y}`;
            if (!shape.edgeBins.has(key)) shape.edgeBins.set(key, []);
            shape.edgeBins.get(key).push(edge);
          }
        }
      }
  return shape;
}
function queryEdges(shape, bounds, pad = 0) {
  const answer = new Set();
  for (let y = Math.floor((bounds.y0 - pad) / 4); y <= Math.floor((bounds.y1 + pad) / 4); y++)
    for (let x = Math.floor((bounds.x0 - pad) / 4); x <= Math.floor((bounds.x1 + pad) / 4); x++)
      for (const edge of shape.edgeBins.get(`${x},${y}`) || [])
        if (bboxGap(bounds, edge.bounds) <= pad) answer.add(edge);
  return answer;
}
function insideShape(p, shape) {
  if (p[0] < shape.x0 - EPS || p[0] > shape.x1 + EPS ||
      p[1] < shape.y0 - EPS || p[1] > shape.y1 + EPS) return false;
  for (const rows of shape.groupRows) {
    // Tia chẵn/lẻ chỉ cắt những cạnh có khoảng y bao trùm hàng này.
    const candidates = rows.get(Math.floor(p[1] / 4)) || [];
    let onBoundary = false, inside = false;
    for (const edge of candidates) {
      const a = edge[0], b = edge[1], box = edge.bounds;
      if (p[0] >= box.x0 - EPS && p[0] <= box.x1 + EPS &&
          pointSegment(p, a, b) <= EPS) {
        onBoundary = true;
        break;
      }
      if ((a[1] > p[1]) !== (b[1] > p[1]) &&
          p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])
        inside = !inside;
    }
    if (inside && !onBoundary) return true;
  }
  return false;
}
function interiorSideOverlap(a, b) {
  // Chỉ xét đỉnh nằm hẳn bên trong/giao cắt thực sự thì sẽ sót các đa giác giống hệt nhau mà mọi
  // cạnh đều trùng khít. Dò cả hai phía và yêu cầu điểm phải thuộc CẢ HAI vùng tô;
  // nhờ đó cạnh bế chung nằm đối bên và miếng chèn nằm khít trong lỗ thật vẫn an toàn.
  for (const e of a.edges) {
    const dx = e[1][0] - e[0][0],
      dy = e[1][1] - e[0][1],
      length = Math.hypot(dx, dy);
    if (length <= EPS) continue;
    const mx = (e[0][0] + e[1][0]) / 2,
      my = (e[0][1] + e[1][1]) / 2;
    if (insideShape([mx, my], b)) return true;
    const delta = Math.min(1e-5, length / 1000);
    for (const sign of [-1, 1]) {
      const p = [
        mx + (sign * delta * dy) / length,
        my - (sign * delta * dx) / length,
      ];
      if (insideShape(p, a) && insideShape(p, b)) return true;
    }
  }
  return false;
}
function filledOverlap(a, b) {
  if (
    a.x1 <= b.x0 + EPS ||
    b.x1 <= a.x0 + EPS ||
    a.y1 <= b.y0 + EPS ||
    b.y1 <= a.y0 + EPS
  )
    return false;
  for (const ea of a.edges)
    for (const eb of queryEdges(b, ea.bounds, EPS))
      if (properCross(ea[0], ea[1], eb[0], eb[1])) return true;
  if (
    a.vertices.some((p) => insideShape(p, b)) ||
    b.vertices.some((p) => insideShape(p, a))
  )
    return true;
  return interiorSideOverlap(a, b) || interiorSideOverlap(b, a);
}
function bboxGap(a, b) {
  return Math.hypot(
    Math.max(a.x0 - b.x1, b.x0 - a.x1, 0),
    Math.max(a.y0 - b.y1, b.y0 - a.y1, 0),
  );
}
function guard(input, slots) {
  const shapes = slots.map((s) => outline(input.types[s.mi].groups, s));
  const tolerance = 0.001;
  for (const a of shapes) {
    assert.ok(
      a.x0 >= input.marginMm - tolerance &&
        a.y0 >= input.marginMm - tolerance &&
        a.x1 <= input.sheet.widthMm - input.marginMm + tolerance &&
        a.y1 <= input.sheet.heightMm - input.marginMm + tolerance,
      "physical sheet margin",
    );
    for (const dot of input.sheet.dots) {
      const p = [dot.x, dot.y],
        distance = Math.min(...a.edges.map((e) => pointSegment(p, e[0], e[1])));
      assert.equal(
        insideShape(p, a),
        false,
        "PON not inside a physical cutter",
      );
      assert.ok(
        distance + tolerance >= dot.r + input.ponClearMm,
        "physical PON-edge clearance",
      );
    }
  }
  let nearest = Infinity;
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i],
        b = shapes[j];
      // Khi khe bằng 0, bbox-distance >= 0 KHÔNG phải là điều kiện loại sớm an toàn:
      // như vậy sẽ bỏ qua mọi bbox chồng lấn và che mất các va chạm vùng tô.
      assert.equal(
        filledOverlap(a, b),
        false,
        "zero gap permits boundary contact, never filled overlap",
      );
      if (bboxGap(a, b) >= nearest) continue;
      if (!Number.isFinite(nearest))
        nearest = Math.min(...b.edges.map((e) => pointSegment(a.vertices[0], e[0], e[1])));
      for (const ea of a.edges)
        for (const eb of queryEdges(b, ea.bounds, nearest))
          nearest = Math.min(
            nearest,
            segmentDistance(ea[0], ea[1], eb[0], eb[1]),
          );
    }
  return nearest;
}
function standardSheet() {
  return {
    widthMm: 330,
    heightMm: 354,
    dots: [
      { x: 10, y: 10, r: 2.5 },
      { x: 320, y: 10, r: 2.5 },
      { x: 10, y: 344, r: 2.5 },
      { x: 320, y: 344, r: 2.5 },
    ],
  };
}
function inputFor(groups, sheet, budgetMs = 750) {
  return {
    sheet,
    types: groups.map((g) => ({ groups: g })),
    gapMm: 0,
    marginMm: 4,
    ponClearMm: 7.5,
    resolutionMm: 0.25,
    budgetMs,
  };
}
function checkPublic(input, minimum, label) {
  const before = JSON.stringify(input),
    result = nester.nest(input);
  assert.equal(result.ok, true, `${label}: ${result.error}`);
  assert.ok(
    result.count >= minimum,
    `${label}: keep the valid silhouette layout count`,
  );
  assert.equal(result.count, result.slots.length);
  assert.equal(
    JSON.stringify(input),
    before,
    "source contours/dimensions cannot be changed to force contact",
  );
  const counts = input.types.map(() => 0);
  for (const s of result.slots) {
    assert.ok(Number.isInteger(s.mi) && s.mi >= 0 && s.mi < counts.length);
    assert.ok(Number.isInteger(s.vi) && s.vi >= 0 && s.vi < 4);
    assert.equal(
      s.angle,
      s.vi * 90,
      "only rigid quarter-turn rotations are used",
    );
    counts[s.mi]++;
  }
  assert.deepEqual(
    result.counts,
    counts,
    "model copy counts match actual slots",
  );
  const nearest = guard(input, result.slots);
  if (input.gapMm === 0)
    assert.ok(
      nearest <= 0.01,
      `${label}: zero-gap contact must not retain a fixed 0.25/0.5 mm raster pad (${nearest} mm)`,
    );
  else
    assert.ok(nearest >= input.gapMm - 0.001,
      `${label}: independently measured ${nearest} mm is below the physical requested gap`);
  console.log(
    `${label}: ${result.count} cutters, nearest physical gap ${nearest} mm, independent no-overlap guard passed`,
  );
  return result;
}
function coreContact(types, slots, expect, label, gap = 0) {
  const input = {
    sheet: { widthMm: 100, heightMm: 100, dots: [] },
    types: types.map((groups) => ({ groups })),
    marginMm: 0,
    ponClearMm: 0,
    gapMm: gap,
  };
  if (expect) guard(input, slots);
  else assert.throws(() => guard(input, slots), /filled overlap/);
  const variants = types.map((groups, mi) =>
    nester._test.buildVariant(groups, mi, 0, 0, gap, 0.25),
  );
  const plan = slots.map((s) => ({
    mi: s.mi,
    v: s.mi,
    x: s.x / 0.25,
    y: s.y / 0.25,
  }));
  assert.equal(
    nester._test.verifyGeometry(plan, variants, 400, 400, [], gap, 0.25),
    expect,
    label,
  );
}

const began = Date.now();
// Các đường viền lõm/ghép bù nhau có thể dùng chung một cạnh bế. Lỗ thật
// phải vẫn là lỗ, còn trường hợp nằm trọn bên trong hay path tô trùng lặp thì phải báo lỗi.
const elbow = [
  [
    [
      [10, 15],
      [10, 30],
      [0, 30],
      [0, 0],
      [30, 0],
      [30, 10],
      [10, 10],
    ],
  ],
];
coreContact(
  [elbow, rectangle(20, 20)],
  [
    { mi: 0, angle: 0, x: 0, y: 0 },
    { mi: 1, angle: 0, x: 10, y: 10 },
  ],
  true,
  "a pocket insert may touch both inner L edges",
);
const hole = [
  [
    rectangle(40, 40)[0][0],
    [
      [10, 10],
      [10, 30],
      [30, 30],
      [30, 10],
    ],
  ],
];
coreContact(
  [hole, rectangle(20, 20)],
  [
    { mi: 0, angle: 0, x: 0, y: 0 },
    { mi: 1, angle: 0, x: 10, y: 10 },
  ],
  true,
  "an insert may share all four boundaries of a real compound hole",
);
coreContact(
  [rectangle(40, 40), rectangle(20, 20)],
  [
    { mi: 0, angle: 0, x: 0, y: 0 },
    { mi: 1, angle: 0, x: 10, y: 10 },
  ],
  false,
  "filled containment is unsafe even at zero gap",
);
coreContact(
  [rectangle(10, 10), rectangle(10, 10)],
  [
    { mi: 0, angle: 0, x: 0, y: 0 },
    { mi: 1, angle: 0, x: 0, y: 0 },
  ],
  false,
  "identical coincident contours must not bypass strict-boundary containment checks",
);
coreContact(
  [rectangle(10.13, 12.37), rectangle(10.13, 12.37)],
  [{ mi: 0, angle: 0, x: 0, y: 0 }, { mi: 1, angle: 0, x: 0, y: 12.25 }],
  false,
  "a sampled empty last row cannot conceal the real 0.12 mm overlap",
);
coreContact(
  [rectangle(10.13, 12.37), rectangle(10.13, 12.37)],
  [{ mi: 0, angle: 0, x: 0, y: 0 }, { mi: 1, angle: 0, x: 0, y: 12.37 - 0.00001 }],
  false,
  "zero clearance does not permit a real positive filled overlap",
);
coreContact(
  [rectangle(10.13, 12.37), rectangle(10.13, 12.37)],
  [{ mi: 0, angle: 0, x: 0, y: 0 }, { mi: 1, angle: 0, x: 0, y: 12.37 - 0.00000096 }],
  false,
  "a real 0.00000096 mm overlap is not numeric dust or legal contact",
);
const touching = [
  { mi: 0, angle: 0, x: 0, y: 0 },
  { mi: 1, angle: 0, x: 10, y: 0 },
];
coreContact(
  [rectangle(10, 10), rectangle(10, 10)],
  touching,
  true,
  "zero-gap common straight edge is valid",
);
const positiveVariants = [0, 1].map((mi) =>
  nester._test.buildVariant(rectangle(10, 10), mi, 0, 0, 0.01, 0.25),
);
assert.equal(
  nester._test.verifyGeometry(
    [
      { mi: 0, v: 0, x: 0, y: 0 },
      { mi: 1, v: 1, x: 40, y: 0 },
    ],
    positiveVariants,
    400,
    400,
    [],
    0.01,
    0.25,
  ),
  false,
  "allowing zero-gap contact must not weaken a real positive clearance",
);

if (!process.argv.includes("--guard-only")) {
  checkPublic(
    inputFor([rectangle(10.13, 12.37)], {
      widthMm: 64.1,
      heightMm: 70.2,
      dots: [],
    }),
    20,
    "Fractional rectangular cutter, zero gap",
  );
  checkPublic(
    inputFor([circle(25)], standardSheet()),
    42,
    "50 mm circular cutter, zero gap",
  );
  const nodesBefore = JSON.stringify(nodes);
  const fineZero = inputFor([curve(1, 0.00025)], standardSheet(), 250);
  fineZero.types[0].curveErrorMm = 0.00025;
  assert.ok(fineZero.types[0].groups[0][0].length > 1000);
  const fineResult = checkPublic(
    fineZero,
    24,
    "Measured 46.086 x 122 mm fine closed curve, zero gap",
  );
  // Kiểm tra với một đường viền dày điểm hơn hẳn, được sinh độc lập.
  // Dùng lại đa giác thô của bước tìm kiếm ở đây từng che mất các giao cắt thật trên đường cong.
  const denseInput = inputFor([curve(1, 0.00001)], standardSheet(), 250);
  assert.ok(denseInput.types[0].groups[0][0].length > 4000);
  const denseNearest = guard(denseInput, fineResult.slots);
  assert.ok(denseNearest >= 0 && denseNearest <= 0.01,
    `dense Bezier check: true nearest gap ${denseNearest} mm must retain visible contact`);
  assert.equal(JSON.stringify(nodes), nodesBefore, "Bezier anchors/handles stay unchanged");
  assert.equal(fineZero.types[0].curveErrorMm, 0.00025,
    "public nesting must preserve the supplied per-type curve error metadata");
  console.log(`Dense 4099-vertex Bezier check: 24 cutters, nearest ${denseNearest} mm, independent no-overlap guard passed`);
  const positiveCurve = inputFor([curve()], standardSheet(), 250);
  positiveCurve.gapMm = 1;
  checkPublic(positiveCurve, 24, "Measured closed curve, real positive 1 mm gap");
}
assert.ok(
  Date.now() - began < 20000,
  "zero-gap regression suite remains bounded",
);
