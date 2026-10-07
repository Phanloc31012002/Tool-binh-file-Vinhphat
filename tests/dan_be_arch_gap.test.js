"use strict";

const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const { curveFor, nodesFor } = require("./dan_be_arch_fixture");
const EPS = 1e-8;

function turn(p, angle) {
  if (angle === 90) return [-p[1], p[0]];
  if (angle === 180) return [-p[0], -p[1]];
  if (angle === 270) return [p[1], -p[0]];
  return p.slice();
}
function pointSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1,
    ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function boxDistance(a, b) {
  return Math.hypot(Math.max(a.x0 - b.x1, b.x0 - a.x1, 0),
    Math.max(a.y0 - b.y1, b.y0 - a.y1, 0));
}
function shapeAt(groups, slot) {
  const points = groups[0][0].map((p) => turn(p, slot.angle));
  const minX = Math.min(...points.map((p) => p[0])), minY = Math.min(...points.map((p) => p[1]));
  const vertices = points.map((p) => [p[0] - minX + slot.x, p[1] - minY + slot.y]);
  const edges = [], bins = new Map();
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const edge = { a, b, x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]),
      x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) };
    edges.push(edge);
    for (let y = Math.floor(edge.y0 / 4); y <= Math.floor(edge.y1 / 4); y++)
      for (let x = Math.floor(edge.x0 / 4); x <= Math.floor(edge.x1 / 4); x++) {
        const key = `${x},${y}`;
        if (!bins.has(key)) bins.set(key, []);
        bins.get(key).push(edge);
      }
  }
  return { vertices, edges, bins, x0: Math.min(...vertices.map((p) => p[0])),
    y0: Math.min(...vertices.map((p) => p[1])), x1: Math.max(...vertices.map((p) => p[0])),
    y1: Math.max(...vertices.map((p) => p[1])) };
}
function inside(p, shape) {
  if (p[0] < shape.x0 - EPS || p[0] > shape.x1 + EPS ||
      p[1] < shape.y0 - EPS || p[1] > shape.y1 + EPS) return false;
  let parity = false;
  for (const edge of shape.edges) {
    if (pointSegment(p, edge.a, edge.b) <= EPS) return false;
    if ((edge.a[1] > p[1]) !== (edge.b[1] > p[1]) &&
        p[0] < edge.a[0] + (edge.b[0] - edge.a[0]) * (p[1] - edge.a[1]) / (edge.b[1] - edge.a[1]))
      parity = !parity;
  }
  return parity;
}
function nearEdges(shape, box, radius) {
  const answer = new Set();
  for (let y = Math.floor((box.y0 - radius) / 4); y <= Math.floor((box.y1 + radius) / 4); y++)
    for (let x = Math.floor((box.x0 - radius) / 4); x <= Math.floor((box.x1 + radius) / 4); x++)
      for (const edge of shape.bins.get(`${x},${y}`) || [])
        if (boxDistance(edge, box) <= radius) answer.add(edge);
  return answer;
}
function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function segmentDistance(a, b) {
  const ac = cross(a.a, a.b, b.a), ad = cross(a.a, a.b, b.b);
  const ca = cross(b.a, b.b, a.a), cb = cross(b.a, b.b, a.b);
  if (((ac > EPS && ad < -EPS) || (ac < -EPS && ad > EPS)) &&
      ((ca > EPS && cb < -EPS) || (ca < -EPS && cb > EPS))) return 0;
  return Math.min(pointSegment(a.a, b.a, b.b), pointSegment(a.b, b.a, b.b),
    pointSegment(b.a, a.a, a.b), pointSegment(b.b, a.a, a.b));
}
function pairDistance(a, b) {
  let nearest = Infinity;
  for (let i = 0; i < a.vertices.length; i += Math.max(1, Math.floor(a.vertices.length / 8)))
    for (const edge of b.edges) nearest = Math.min(nearest, pointSegment(a.vertices[i], edge.a, edge.b));
  for (const edge of a.edges)
    for (const other of nearEdges(b, edge, nearest)) nearest = Math.min(nearest, segmentDistance(edge, other));
  return nearest;
}
function inputFor(width, height, gap, angle = 0, typeCount = 1) {
  const groups = curveFor(width, height, 0.00025, angle);
  return {
    sheet: { widthMm: 330, heightMm: 354, dots: [
      { x: 10, y: 10, r: 2.5 }, { x: 320, y: 10, r: 2.5 },
      { x: 10, y: 344, r: 2.5 }, { x: 320, y: 344, r: 2.5 },
    ] },
    types: Array.from({ length: typeCount }, () => ({ groups, curveErrorMm: 0.00025 })),
    gapMm: gap, marginMm: 4, ponClearMm: 7.5, resolutionMm: 0.25, budgetMs: 250,
  };
}
function clearPON(input, shape, tolerance = 0.001) {
  return input.sheet.dots.every((dot) => {
    const p = [dot.x, dot.y];
    return !inside(p, shape) && Math.min(...shape.edges.map((e) => pointSegment(p, e.a, e.b))) >=
      dot.r + input.ponClearMm - tolerance;
  });
}
function independentAudit(input, slots, denseGroups) {
  const shapes = slots.map((s) => shapeAt(denseGroups[s.mi], s));
  let nearest = Infinity;
  const total = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const shape of shapes) {
    for (const key of ["x0", "y0"]) total[key] = Math.min(total[key], shape[key]);
    for (const key of ["x1", "y1"]) total[key] = Math.max(total[key], shape[key]);
    assert.ok(shape.x0 >= input.marginMm - 0.001 && shape.y0 >= input.marginMm - 0.001 &&
      shape.x1 <= input.sheet.widthMm - input.marginMm + 0.001 &&
      shape.y1 <= input.sheet.heightMm - input.marginMm + 0.001, "true curved die stays inside every sheet margin");
    assert.ok(clearPON(input, shape), "true curve retains PON-edge clearance");
  }
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i], b = shapes[j];
      if (boxDistance(a, b) >= nearest) continue;
      assert.equal(inside(a.vertices[0], b) || inside(b.vertices[0], a), false,
        "a contained filled die cannot bypass the positive gap guard");
      const distance = pairDistance(a, b);
      assert.ok(distance >= input.gapMm - 0.001,
        `independent dense curve gap ${distance} mm is below requested ${input.gapMm} mm`);
      nearest = Math.min(nearest, distance);
    }
  return { nearest, offsetX: (total.x0 + total.x1 - input.sheet.widthMm) / 2,
    offsetY: (total.y0 + total.y1 - input.sheet.heightMm) / 2 };
}
const baselineCache = new Map();
function simpleSafeBaseline(input, dense) {
  // Independently constructive baseline: exact-bbox-separated rows in all four
  // directions, three phases per axis, retaining only physically PON-safe dies.
  // Search/refinement must never lose a layout this simple, regardless of time.
  const key = `${input.gapMm}/${Math.max(...dense[0][0].map((p) => p[0]))}/${Math.max(...dense[0][0].map((p) => p[1]))}`;
  if (baselineCache.has(key)) return baselineCache.get(key);
  let best = 0;
  for (const angle of [0, 90, 180, 270]) {
    const sample = shapeAt(dense, { x: 0, y: 0, angle });
    const w = sample.x1, h = sample.y1, gap = input.gapMm + 0.001;
    const rw = input.sheet.widthMm - 2 * input.marginMm, rh = input.sheet.heightMm - 2 * input.marginMm;
    const cols = Math.floor((rw + gap) / (w + gap)), rows = Math.floor((rh + gap) / (h + gap));
    const spareX = rw - (cols * w + Math.max(0, cols - 1) * gap);
    const spareY = rh - (rows * h + Math.max(0, rows - 1) * gap);
    for (const px of [0, spareX / 2, spareX])
      for (const py of [0, spareY / 2, spareY]) {
        let count = 0;
        for (let y = 0; y < rows; y++)
          for (let x = 0; x < cols; x++) {
            const shape = shapeAt(dense, { angle,
              x: input.marginMm + px + x * (w + gap),
              y: input.marginMm + py + y * (h + gap) });
            if (clearPON(input, shape, -0.001)) count++;
          }
        best = Math.max(best, count);
      }
  }
  baselineCache.set(key, best);
  return best;
}
function check(width, height, gap, angle = 0, typeCount = 1) {
  const input = inputFor(width, height, gap, angle, typeCount);
  const dense = curveFor(width, height, 0.0001, angle);
  const sourceBefore = JSON.stringify(input), originalNodes = nodesFor(width, height);
  const nodesBefore = JSON.stringify(originalNodes);
  const minimum = simpleSafeBaseline(input, dense);
  assert.ok(minimum >= 24, "meaningful independently constructive safe baseline");
  const result = nester.nest(input);
  const label = `${width}x${height} arch, gap ${gap}, source rotation ${angle}, ${typeCount} artwork(s)`;
  assert.equal(result.ok, true, `${label}: ${result.error}`);
  assert.ok(result.count >= minimum, `${label}: count ${result.count} loses independent ${minimum}-die safe rows`);
  assert.equal(result.count, result.slots.length);
  assert.equal(JSON.stringify(input), sourceBefore, "do not resize/deform/consume the source to avoid rejection");
  assert.equal(JSON.stringify(originalNodes), nodesBefore, "all original cubic handles remain intact");
  const counts = input.types.map(() => 0);
  for (const slot of result.slots) {
    assert.ok(Number.isInteger(slot.mi) && slot.mi >= 0 && slot.mi < counts.length);
    assert.ok(Number.isInteger(slot.vi) && slot.vi >= 0 && slot.vi < 4);
    assert.equal(slot.angle, slot.vi * 90, "only rigid original-size rotations are permitted");
    counts[slot.mi]++;
  }
  assert.deepEqual(result.counts, counts);
  if (typeCount === 2) assert.ok(Math.abs(counts[0] - counts[1]) <= 1, "equivalent artwork stays balanced");
  const audit = independentAudit(input, result.slots, input.types.map(() => dense));
  assert.ok(Math.abs(audit.offsetX - result.centering.offsetXmm) < 0.001);
  assert.ok(Math.abs(audit.offsetY - result.centering.offsetYmm) < 0.001);
  if (result.centering.exact) assert.ok(Math.abs(audit.offsetX) < 0.001 && Math.abs(audit.offsetY) < 0.001);
  else assert.match(result.detail, /Canh tâm bị giới hạn bởi vùng né PON/);
  console.log(`${label}: ${result.count} dies (safe row baseline ${minimum}), true nearest gap ${audit.nearest} mm`);
}

// Only the final permitted expansion endpoint can recover this exact-width
// fixture. Stopping the 0.001, 0.002, ... sequence at 0.128 mm silently misses
// the legal 0.25 mm endpoint. Expand positions, never the two 10 mm square dies.
{
  const step = 0.25, guardGap = 2.001;
  const groups = [[[[0, 0], [10, 0], [10, 10], [0, 10]]]];
  const variants = [nester._test.buildVariant(groups, 0, 0, 0, guardGap, step)];
  const plan = [{ mi: 0, v: 0, x: 0, y: 0 }, { mi: 0, v: 0, x: 11.7 / step, y: 0 }];
  const sourceBefore = JSON.stringify({ groups, variants, plan });
  const verify = (candidate, widthMm) => nester._test.verifyGeometry(
    candidate, variants, widthMm / step, 10 / step, [], guardGap, step);
  assert.equal(verify(plan, 22.2), false, "original 1.7 mm gap is below the strict guard");
  const shortOfEndpoint = plan.map((s, i) => ({ ...s, x: i ? (11.7 + 2 * 0.128) / step : 0 }));
  assert.equal(verify(shortOfEndpoint, 22.2), false,
    "0.128 mm per-side expansion still leaves only 1.956 mm clearance");
  const recovered = nester._test.openPhysicalGapPlan(
    plan, variants, 22.2 / step, 10 / step, [], guardGap, step);
  assert.equal(recovered.length, 2, "endpoint repair preserves both placed dies");
  assert.equal(verify(recovered, 22.2), true, "the legal maximum endpoint must be checked");
  const placed = recovered.map((s) => shapeAt(groups, { angle: 0, x: s.x * step, y: s.y * step }));
  for (let i = 0; i < placed.length; i++) {
    assert.equal(recovered[i].mi, plan[i].mi);
    assert.equal(recovered[i].v, plan[i].v);
    assert.ok(Math.abs(placed[i].x1 - placed[i].x0 - 10) < 1e-8);
    assert.ok(Math.abs(placed[i].y1 - placed[i].y0 - 10) < 1e-8);
    assert.ok(placed[i].x0 >= -1e-8 && placed[i].x1 <= 22.2 + 1e-8);
    assert.ok(placed[i].y0 >= -1e-8 && placed[i].y1 <= 10 + 1e-8);
  }
  assert.ok(pairDistance(placed[0], placed[1]) >= 2, "independent physical gap after endpoint recovery");
  const unrecovered = nester._test.openPhysicalGapPlan(
    plan, variants, 21.7 / step, 10 / step, [], guardGap, step);
  assert.strictEqual(unrecovered, plan,
    "an impossible sheet returns the original unsafe plan for the final caller guard to reject");
  assert.equal(verify(unrecovered, 21.7), false, "failed repair must never claim a safe result");
  assert.equal(JSON.stringify({ groups, variants, plan }), sourceBefore,
    "endpoint repair cannot mutate input slots, node fields, shapes or dimensions");
  console.log("Physical-gap expansion endpoint: safe maximum recovered; impossible width remains explicitly unsafe; sources unchanged.");
}

const began = Date.now(), failures = [];
const reproductionOnly = process.argv.includes("--reproduction-only");
const endpointOnly = process.argv.includes("--endpoint-only");
for (const [width, height] of endpointOnly ? [] : [[42, 72], [40, 70]]) {
  const cases = reproductionOnly ? [[5, 0]] : [[5, 0], [5, 90], [5, 180], [5, 270], [1.5, 0]];
  for (const [gap, angle] of cases)
    try { check(width, height, gap, angle); }
    catch (error) { failures.push(error.message); }
}
if (!reproductionOnly && !endpointOnly)
  try { check(42, 72, 5, 0, 2); }
  catch (error) { failures.push(error.message); }
assert.ok(Date.now() - began < 60000, "arch regression remains bounded");
assert.deepEqual(failures, [], failures.join("\n"));
