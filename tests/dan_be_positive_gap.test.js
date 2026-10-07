"use strict";

const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const { curve, nodes } = require("./dan_be_variable_fixture");
const { curveFor: cubicCircle, nodesFor } = require("./dan_be_circle_fixture");

const EPS = 1e-8;

function rectangle(width, height) {
  return [[[[0, 0], [width, 0], [width, height], [0, height]]]];
}
function pointSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1,
    ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function turn(p, angle) {
  if (angle === 90) return [-p[1], p[0]];
  if (angle === 180) return [-p[0], -p[1]];
  if (angle === 270) return [p[1], -p[0]];
  return p.slice();
}
function boxDistance(a, b) {
  return Math.hypot(Math.max(a.x0 - b.x1, b.x0 - a.x1, 0),
    Math.max(a.y0 - b.y1, b.y0 - a.y1, 0));
}
function placedShape(groups, slot) {
  const rotated = groups.map((g) => g.map((c) => c.map((p) => turn(p, slot.angle))));
  const raw = rotated.flat(2);
  const x0 = Math.min(...raw.map((p) => p[0])), y0 = Math.min(...raw.map((p) => p[1]));
  const translated = rotated.map((g) => g.map((c) => c.map((p) =>
    [slot.x + p[0] - x0, slot.y + p[1] - y0])));
  const vertices = translated.flat(2), edges = [], bins = new Map(), rows = [];
  translated.forEach((group, gi) => {
    rows[gi] = new Map();
    for (const contour of group)
      for (let i = 0; i < contour.length; i++) {
        const a = contour[i], b = contour[(i + 1) % contour.length];
        const edge = { a, b, x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]),
          x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) };
        edges.push(edge);
        for (let y = Math.floor(edge.y0 / 4); y <= Math.floor(edge.y1 / 4); y++) {
          if (!rows[gi].has(y)) rows[gi].set(y, []);
          rows[gi].get(y).push(edge);
          for (let x = Math.floor(edge.x0 / 4); x <= Math.floor(edge.x1 / 4); x++) {
            const key = `${x},${y}`;
            if (!bins.has(key)) bins.set(key, []);
            bins.get(key).push(edge);
          }
        }
      }
  });
  return { groups: translated, vertices, edges, bins, rows,
    x0: Math.min(...vertices.map((p) => p[0])), y0: Math.min(...vertices.map((p) => p[1])),
    x1: Math.max(...vertices.map((p) => p[0])), y1: Math.max(...vertices.map((p) => p[1])) };
}
function inside(p, shape) {
  if (p[0] < shape.x0 - EPS || p[0] > shape.x1 + EPS ||
      p[1] < shape.y0 - EPS || p[1] > shape.y1 + EPS) return false;
  for (const groupRows of shape.rows) {
    let parity = false, boundary = false;
    for (const e of groupRows.get(Math.floor(p[1] / 4)) || []) {
      if (p[0] >= e.x0 - EPS && p[0] <= e.x1 + EPS && pointSegment(p, e.a, e.b) <= EPS) {
        boundary = true;
        break;
      }
      if ((e.a[1] > p[1]) !== (e.b[1] > p[1]) &&
          p[0] < e.a[0] + (e.b[0] - e.a[0]) * (p[1] - e.a[1]) / (e.b[1] - e.a[1]))
        parity = !parity;
    }
    if (parity && !boundary) return true;
  }
  return false;
}
function nearbyEdges(shape, box, radius) {
  const answer = new Set();
  for (let y = Math.floor((box.y0 - radius) / 4); y <= Math.floor((box.y1 + radius) / 4); y++)
    for (let x = Math.floor((box.x0 - radius) / 4); x <= Math.floor((box.x1 + radius) / 4); x++)
      for (const edge of shape.bins.get(`${x},${y}`) || [])
        if (boxDistance(box, edge) <= radius) answer.add(edge);
  return answer;
}
function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function segmentDistance(a, b) {
  const ab0 = cross(a.a, a.b, b.a), ab1 = cross(a.a, a.b, b.b);
  const ba0 = cross(b.a, b.b, a.a), ba1 = cross(b.a, b.b, a.b);
  if (((ab0 > EPS && ab1 < -EPS) || (ab0 < -EPS && ab1 > EPS)) &&
      ((ba0 > EPS && ba1 < -EPS) || (ba0 < -EPS && ba1 > EPS))) return 0;
  return Math.min(pointSegment(a.a, b.a, b.b), pointSegment(a.b, b.a, b.b),
    pointSegment(b.a, a.a, a.b), pointSegment(b.b, a.a, a.b));
}
function pairDistance(a, b) {
  // A small exact endpoint sample establishes an upper bound, then a separate
  // edge index considers every segment pair capable of improving that bound.
  let nearest = Infinity;
  for (let i = 0; i < a.vertices.length; i += Math.max(1, Math.floor(a.vertices.length / 8)))
    for (const edge of b.edges)
      nearest = Math.min(nearest, pointSegment(a.vertices[i], edge.a, edge.b));
  for (const edge of a.edges)
    for (const other of nearbyEdges(b, edge, nearest))
      nearest = Math.min(nearest, segmentDistance(edge, other));
  return nearest;
}
function standardSheet() {
  return { widthMm: 330, heightMm: 354, dots: [
    { x: 10, y: 10, r: 2.5 }, { x: 320, y: 10, r: 2.5 },
    { x: 10, y: 344, r: 2.5 }, { x: 320, y: 344, r: 2.5 },
  ] };
}
function inputFor(groups, gapMm, sheet = standardSheet(), copies = 1, curveErrorMm = 0) {
  return { sheet, types: Array.from({ length: copies }, () => ({ groups, curveErrorMm })),
    gapMm, marginMm: 4, ponClearMm: 7.5, resolutionMm: 0.25, budgetMs: 250 };
}
function independentAudit(input, slots, denseGroups, checkDiagonal) {
  const shapes = slots.map((s) => placedShape(denseGroups[s.mi], s));
  let nearest = Infinity, diagonalNearest = Infinity, axialNearest = Infinity;
  let diagonalPairs = 0, axialPairs = 0;
  const tolerance = 0.001;
  const whole = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const shape of shapes) {
    for (const key of ["x0", "y0"]) whole[key] = Math.min(whole[key], shape[key]);
    for (const key of ["x1", "y1"]) whole[key] = Math.max(whole[key], shape[key]);
    assert.ok(shape.x0 >= input.marginMm - tolerance && shape.y0 >= input.marginMm - tolerance &&
      shape.x1 <= input.sheet.widthMm - input.marginMm + tolerance &&
      shape.y1 <= input.sheet.heightMm - input.marginMm + tolerance, "true outline stays within the sheet margins");
    for (const dot of input.sheet.dots) {
      assert.equal(inside([dot.x, dot.y], shape), false, "PON centre cannot be inside a cutter");
      const distance = Math.min(...shape.edges.map((e) => pointSegment([dot.x, dot.y], e.a, e.b)));
      assert.ok(distance >= dot.r + input.ponClearMm - tolerance, "true cubic-to-PON clearance");
    }
  }
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i], b = shapes[j];
      const dx = Math.abs((a.x0 + a.x1 - b.x0 - b.x1) / 2);
      const dy = Math.abs((a.y0 + a.y1 - b.y0 - b.y1) / 2);
      const diagonal = checkDiagonal && dx > 0.1 && dy > 0.1;
      const axial = checkDiagonal && !diagonal;
      if (diagonal) diagonalPairs++;
      if (axial) axialPairs++;
      const bbox = boxDistance(a, b);
      if (bbox >= nearest && (!diagonal || bbox >= diagonalNearest) &&
          (!axial || bbox >= axialNearest)) continue;
      for (const group of a.groups)
        for (const contour of group)
          assert.equal(inside(contour[0], b), false, "filled containment cannot pass a positive-gap check");
      for (const group of b.groups)
        for (const contour of group)
          assert.equal(inside(contour[0], a), false, "filled containment cannot pass a positive-gap check");
      const distance = pairDistance(a, b);
      assert.ok(distance >= input.gapMm - tolerance,
        `true boundary gap ${distance} mm is below ${input.gapMm} mm`);
      nearest = Math.min(nearest, distance);
      if (diagonal) diagonalNearest = Math.min(diagonalNearest, distance);
      if (axial) axialNearest = Math.min(axialNearest, distance);
    }
  assert.ok(nearest >= input.gapMm - 0.001 && nearest <= input.gapMm + 0.005,
    `requested ${input.gapMm} mm, true closest gap ${nearest} mm: no fixed raster padding`);
  if (checkDiagonal) {
    assert.ok(diagonalPairs > 0, "the circle case must exercise staggered diagonal neighbors");
    assert.ok(diagonalNearest >= input.gapMm - 0.001 && diagonalNearest <= input.gapMm + 0.005,
      `requested ${input.gapMm} mm, true closest diagonal gap ${diagonalNearest} mm`);
    assert.ok(axialPairs > 0, "the circle case must also exercise same-row/column neighbors");
    assert.ok(axialNearest >= input.gapMm - 0.001 && axialNearest <= input.gapMm + 0.005,
      `requested ${input.gapMm} mm, true closest axial gap ${axialNearest} mm`);
  }
  return { nearest, diagonalNearest, axialNearest, offsetX: (whole.x0 + whole.x1 - input.sheet.widthMm) / 2,
    offsetY: (whole.y0 + whole.y1 - input.sheet.heightMm) / 2 };
}
function check(input, denseGroups, minimum, label, options = {}) {
  const before = JSON.stringify(input), result = nester.nest(input);
  assert.equal(result.ok, true, `${label}: ${result.error}`);
  assert.ok(result.count >= minimum, `${label}: keep at least ${minimum} cutters, got ${result.count}`);
  if (options.exactCount) assert.equal(result.count, options.exactCount, "preserve all previously valid circle slots");
  assert.equal(result.count, result.slots.length);
  assert.equal(JSON.stringify(input), before, "never resize/deform the source to close a requested gap");
  const counts = input.types.map(() => 0);
  for (const slot of result.slots) {
    assert.ok(Number.isInteger(slot.mi) && slot.mi >= 0 && slot.mi < counts.length);
    assert.ok(Number.isInteger(slot.vi) && slot.vi >= 0 && slot.vi < 4);
    assert.equal(slot.angle, slot.vi * 90, "rigid original-size quarter turns only");
    counts[slot.mi]++;
  }
  assert.deepEqual(result.counts, counts);
  if (counts.length === 2) assert.ok(Math.abs(counts[0] - counts[1]) <= 1, "equivalent artwork stays balanced");
  const audit = independentAudit(input, result.slots, denseGroups, options.diagonal);
  assert.ok(Math.abs(audit.offsetX - result.centering.offsetXmm) < 0.001);
  assert.ok(Math.abs(audit.offsetY - result.centering.offsetYmm) < 0.001);
  if (options.exactCentre) assert.equal(result.centering.exact, true, "unobstructed result stays exactly centred");
  if (result.centering.exact) {
    assert.ok(Math.abs(audit.offsetX) < 0.001 && Math.abs(audit.offsetY) < 0.001,
      "true-outline margins are symmetric, not merely integer-cell margins");
  } else assert.match(result.detail, /Canh tâm bị giới hạn bởi vùng né PON/);
  console.log(`${label}: ${result.count} cutters, nearest ${audit.nearest} mm` +
    (options.diagonal ? `, diagonal ${audit.diagonalNearest} mm, axial ${audit.axialNearest} mm` : ""));
}

const began = Date.now(), nodesBefore = JSON.stringify(nodes), failures = [];
const nativeNodes = nodesFor(50), nativeNodesBefore = JSON.stringify(nativeNodes);
function run(label, test) {
  try { test(); }
  catch (error) { failures.push(`${label}: ${error.message}`); }
}
for (const gap of [0.7, 1.1, 1.5, 1.9]) {
  const label = `50 mm Illustrator cubic ellipse / gap ${gap}`;
  run(label, () => {
    const groups = cubicCircle(50, 0.00025), dense = cubicCircle(50, 0.0001);
    assert.ok(dense[0][0].length > groups[0][0].length, "independent finer outline, not the raster search shape");
    check(inputFor(groups, gap, standardSheet(), 1, 0.00025), [dense], gap === 1.9 ? 40 : 42, label,
      { diagonal: true, exactCount: gap === 1.9 ? undefined : 42, exactCentre: gap === 0.7 });
  });
}
for (const diameter of [49.13, 50.07]) {
  const label = `Fractional ${diameter} mm cubic ellipse / gap 1.5`;
  run(label, () => check(inputFor(cubicCircle(diameter, 0.00025), 1.5, standardSheet(), 1, 0.00025),
    [cubicCircle(diameter, 0.0001)], 40, label, { diagonal: true }));
}
run("Equivalent circular artworks", () => {
  const groups = cubicCircle(50, 0.00025), dense = cubicCircle(50, 0.0001);
  check(inputFor(groups, 1.5, standardSheet(), 2, 0.00025), [dense, dense], 42,
    "Equivalent circular artworks / gap 1.5", { diagonal: true, exactCount: 42 });
});
run("Generic fractional rectangle", () => {
  const groups = rectangle(10.13, 12.37);
  check(inputFor(groups, 1.5, { widthMm: 64.1, heightMm: 70.2, dots: [] }),
    [groups], 20, "Generic fractional rectangle / gap 1.5", { exactCentre: true });
});
run("Generic seven-node curved cutter", () => {
  check(inputFor(curve(1, 0.00025), 1.5, standardSheet(), 1, 0.00025), [curve(1, 0.0001)], 24,
    "Generic seven-node curved cutter / gap 1.5");
});
assert.equal(JSON.stringify(nodes), nodesBefore, "portable original cubic anchors/handles cannot change");
assert.equal(JSON.stringify(nativeNodes), nativeNodesBefore, "portable native ellipse anchors/handles cannot change");
assert.ok(Date.now() - began < 45000, "positive-gap regression suite has bounded runtime");
assert.deepEqual(failures, [], failures.join("\n"));
