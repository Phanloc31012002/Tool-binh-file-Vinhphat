"use strict";

const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const { curveFor, nodesFor } = require("./dan_be_arch_fixture");
const EPS = 1e-7;

function turn(p, angle) {
  if (angle === 90) return [-p[1], p[0]];
  if (angle === 180) return [-p[0], -p[1]];
  if (angle === 270) return [p[1], -p[0]];
  return p.slice();
}
function transform(groups, scale = 1, angle = 0) {
  return groups.map((g) => g.map((c) => c.map((p) => turn(p.map((v) => v * scale), angle))));
}
function pointSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function boxDistance(a, b) {
  return Math.hypot(Math.max(a.x0 - b.x1, b.x0 - a.x1, 0), Math.max(a.y0 - b.y1, b.y0 - a.y1, 0));
}
function outline(groups, slot) {
  const rotated = transform(groups, 1, slot.angle), raw = rotated.flat(2);
  const minX = Math.min(...raw.map((p) => p[0])), minY = Math.min(...raw.map((p) => p[1]));
  const placed = rotated.map((g) => g.map((c) => c.map((p) => [slot.x + p[0] - minX, slot.y + p[1] - minY])));
  const vertices = placed.flat(2), edges = [], bins = new Map(), rows = placed.map(() => new Map());
  placed.forEach((group, gi) => {
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
  return { groups: placed, vertices, edges, bins, rows,
    x0: Math.min(...vertices.map((p) => p[0])), y0: Math.min(...vertices.map((p) => p[1])),
    x1: Math.max(...vertices.map((p) => p[0])), y1: Math.max(...vertices.map((p) => p[1])) };
}
function inside(p, shape) {
  if (p[0] < shape.x0 - EPS || p[0] > shape.x1 + EPS || p[1] < shape.y0 - EPS || p[1] > shape.y1 + EPS) return false;
  for (const groupRows of shape.rows) {
    let parity = false, boundary = false;
    for (const edge of groupRows.get(Math.floor(p[1] / 4)) || []) {
      if (p[0] >= edge.x0 - EPS && p[0] <= edge.x1 + EPS && pointSegment(p, edge.a, edge.b) <= EPS) {
        boundary = true;
        break;
      }
      if ((edge.a[1] > p[1]) !== (edge.b[1] > p[1]) &&
          p[0] < edge.a[0] + (edge.b[0] - edge.a[0]) * (p[1] - edge.a[1]) / (edge.b[1] - edge.a[1])) parity = !parity;
    }
    if (parity && !boundary) return true;
  }
  return false;
}
function nearEdges(shape, box, radius) {
  const answer = new Set();
  for (let y = Math.floor((box.y0 - radius) / 4); y <= Math.floor((box.y1 + radius) / 4); y++)
    for (let x = Math.floor((box.x0 - radius) / 4); x <= Math.floor((box.x1 + radius) / 4); x++)
      for (const edge of shape.bins.get(`${x},${y}`) || []) if (boxDistance(box, edge) <= radius) answer.add(edge);
  return answer;
}
function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function properCross(a, b) {
  const ac = cross(a.a, a.b, b.a), ad = cross(a.a, a.b, b.b), ca = cross(b.a, b.b, a.a), cb = cross(b.a, b.b, a.b);
  return ((ac > EPS && ad < -EPS) || (ac < -EPS && ad > EPS)) &&
    ((ca > EPS && cb < -EPS) || (ca < -EPS && cb > EPS));
}
function segmentDistance(a, b) {
  if (properCross(a, b)) return 0;
  return Math.min(pointSegment(a.a, b.a, b.b), pointSegment(a.b, b.a, b.b),
    pointSegment(b.a, a.a, a.b), pointSegment(b.b, a.a, a.b));
}
function interiorSideOverlap(a, b) {
  for (const edge of a.edges) {
    const dx = edge.b[0] - edge.a[0], dy = edge.b[1] - edge.a[1], length = Math.hypot(dx, dy);
    if (length <= EPS) continue;
    const mx = (edge.a[0] + edge.b[0]) / 2, my = (edge.a[1] + edge.b[1]) / 2;
    if (inside([mx, my], b)) return true;
    const delta = Math.min(1e-5, length / 1000);
    for (const sign of [-1, 1]) {
      const p = [mx + sign * delta * dy / length, my - sign * delta * dx / length];
      if (inside(p, a) && inside(p, b)) return true;
    }
  }
  return false;
}
function filledOverlap(a, b) {
  if (a.x1 <= b.x0 + EPS || b.x1 <= a.x0 + EPS || a.y1 <= b.y0 + EPS || b.y1 <= a.y0 + EPS) return false;
  for (const edge of a.edges)
    for (const other of nearEdges(b, edge, EPS)) if (properCross(edge, other)) return true;
  if (a.vertices.some((p) => inside(p, b)) || b.vertices.some((p) => inside(p, a))) return true;
  return interiorSideOverlap(a, b) || interiorSideOverlap(b, a);
}
function pairDistance(a, b) {
  let distance = Infinity;
  for (let i = 0; i < a.vertices.length; i += Math.max(1, Math.floor(a.vertices.length / 8)))
    for (const edge of b.edges) distance = Math.min(distance, pointSegment(a.vertices[i], edge.a, edge.b));
  for (const edge of a.edges)
    for (const other of nearEdges(b, edge, distance)) distance = Math.min(distance, segmentDistance(edge, other));
  return distance;
}
function clearPON(input, shape) {
  return input.sheet.dots.every((d) => !inside([d.x, d.y], shape) &&
    Math.min(...shape.edges.map((e) => pointSegment([d.x, d.y], e.a, e.b))) >= d.r + input.ponClearMm - 0.001);
}
function independentGuard(input, slots, denseTypes = input.types) {
  const shapes = slots.map((s) => outline(denseTypes[s.mi].groups, s));
  let nearest = Infinity;
  for (const shape of shapes) {
    assert.ok(shape.x0 >= input.marginMm - 0.001 && shape.y0 >= input.marginMm - 0.001 &&
      shape.x1 <= input.sheet.widthMm - input.marginMm + 0.001 &&
      shape.y1 <= input.sheet.heightMm - input.marginMm + 0.001, "true outline stays within sheet margins");
    assert.ok(clearPON(input, shape), "actual curve clears the physical PON edges");
  }
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i], b = shapes[j];
      // No bbox >= gap shortcut at gap zero: it would conceal ALL filled overlaps.
      assert.equal(filledOverlap(a, b), false, "no filled overlap, including coincident outlines at zero gap");
      if (boxDistance(a, b) >= nearest) continue;
      const distance = pairDistance(a, b);
      assert.ok(distance >= Math.max(0, input.gapMm - 0.001),
        `independent physical gap ${distance} mm is below requested ${input.gapMm} mm`);
      nearest = Math.min(nearest, distance);
    }
  return { shapes, nearest };
}
function standardSheet(scale = 1) {
  return { widthMm: 330 * scale, heightMm: 354 * scale, dots: [
    { x: 10 * scale, y: 10 * scale, r: 2.5 * scale }, { x: 320 * scale, y: 10 * scale, r: 2.5 * scale },
    { x: 10 * scale, y: 344 * scale, r: 2.5 * scale }, { x: 320 * scale, y: 344 * scale, r: 2.5 * scale },
  ] };
}
function archInput(angle = 0, scale = 1, gap = 5, typeCount = 1) {
  const groups = transform(curveFor(40, 70, 0.00025), scale, angle);
  return { sheet: standardSheet(scale), types: Array.from({ length: typeCount }, () => ({ groups, curveErrorMm: 0.00025 * scale })),
    gapMm: gap * scale, marginMm: 4 * scale, ponClearMm: 7.5 * scale, resolutionMm: 0.25 * scale, budgetMs: 250 };
}
function archDenseTypes(angle = 0, scale = 1, typeCount = 1) {
  const groups = transform(curveFor(40, 70, 0.0001), scale, angle);
  return Array.from({ length: typeCount }, () => ({ groups }));
}
function conservativeThirtyWitness() {
  // This is an independently constructed feasible layout, NOT the screenshot's
  // hand arrangement (its true nearest gap was only about 4.453 mm).
  // Exact-bbox gutters are 5.001 mm, enough even for the curved-input reserve.
  const dense = archDenseTypes()[0].groups;
  const box = outline(dense, { x: 0, y: 0, angle: 0 });
  const w = box.x1, h = box.y1, gutter = 5.001;
  const standingWidth = 7 * w + 6 * gutter, totalHeight = 4 * h + 4 * gutter + w;
  const left = (330 - standingWidth) / 2, bottom = (354 - totalHeight) / 2;
  const slots = [];
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 7; col++) {
      if (row === 0 && (col === 0 || col === 6)) continue;
      slots.push({ mi: 0, vi: 0, angle: 0, x: left + col * (w + gutter), y: bottom + row * (h + gutter) });
    }
  const horizontalLeft = (330 - (4 * h + 3 * gutter)) / 2;
  for (let col = 0; col < 4; col++) {
    const angle = col === 3 ? 270 : 90; // Both external caps face their PON corners.
    slots.push({ mi: 0, vi: angle / 90, angle, x: horizontalLeft + col * (h + gutter),
      y: bottom + 4 * (h + gutter) });
  }
  return slots;
}
function rowBaseline(input, groups) {
  let best = 0;
  const gutter = input.gapMm + 0.001;
  for (const angle of [0, 90, 180, 270]) {
    const box = outline(groups, { x: 0, y: 0, angle });
    const w = box.x1, h = box.y1, rw = input.sheet.widthMm - 2 * input.marginMm, rh = input.sheet.heightMm - 2 * input.marginMm;
    const nx = Math.floor((rw + gutter) / (w + gutter)), ny = Math.floor((rh + gutter) / (h + gutter));
    const spareX = rw - (nx * w + Math.max(0, nx - 1) * gutter), spareY = rh - (ny * h + Math.max(0, ny - 1) * gutter);
    for (const px of [0, spareX / 2, spareX])
      for (const py of [0, spareY / 2, spareY]) {
        let count = 0;
        for (let y = 0; y < ny; y++)
          for (let x = 0; x < nx; x++)
            if (clearPON(input, outline(groups, { angle, x: input.marginMm + px + x * (w + gutter),
              y: input.marginMm + py + y * (h + gutter) }))) count++;
        best = Math.max(best, count);
      }
  }
  return best;
}
function expiredCompositionalBaseline(input, minimum) {
  const before = JSON.stringify(input), step = input.resolutionMm, margin = input.marginMm;
  const variants = [];
  input.types.forEach((type, mi) => {
    [0, 90, 180, 270].forEach((angle, vi) => {
      const variant = nester._test.buildVariant(type.groups, mi, vi, angle, input.gapMm, step);
      variant.curveErrorMm = type.curveErrorMm || 0;
      variants.push(variant);
    });
  });
  const rw = Math.floor((input.sheet.widthMm - 2 * margin) / step + EPS);
  const rh = Math.floor((input.sheet.heightMm - 2 * margin) / step + EPS);
  const dots = input.sheet.dots.map((d) => ({
    x: (d.x - margin) / step, y: (d.y - margin) / step, radius: (d.r + input.ponClearMm) / step,
  }));
  const began = Date.now();
  const plans = nester._test.compositionalBandPlans(
    variants, input.types.length, rw, rh, dots, input.gapMm, step, Date.now() - 1,
  );
  assert.equal(JSON.stringify(input), before, "expired constructive search cannot mutate its input");
  assert.ok(plans.length > 0, "an expired optional deadline cannot remove deterministic constructive seeds");
  for (const plan of plans) {
    assert.ok(plan.every((s) => Number.isInteger(s.x) && Number.isInteger(s.y)), "handoff seeds stay on the planning grid");
    assert.equal(nester._test.verifyPlan(plan, variants, rw, rh, dots), true, "every compositional seed meets raster constraints");
    assert.equal(nester._test.verifyGeometry(plan, variants, rw, rh, dots, input.gapMm, step), true,
      "every compositional seed meets continuous geometry and curve reserves");
  }
  const best = plans.reduce((a, b) => a.length >= b.length ? a : b);
  assert.ok(best.length >= minimum, `expired deadline retains the independently proven ${minimum}-die witness`);
  const slots = best.map((s) => ({ mi: s.mi, vi: variants[s.v].vi, angle: variants[s.v].angle,
    x: margin + s.x * step, y: margin + s.y * step }));
  const audit = independentGuard(input, slots, archDenseTypes());
  assert.ok(Date.now() - began < 8000, "expired constructive baseline remains bounded");
  console.log(`Expired compositional baseline: ${best.length} dies, nearest ${audit.nearest} mm; every handoff seed verified`);
}
function checked(input, denseTypes, minimum, label) {
  const before = JSON.stringify(input), result = nester.nest(input);
  assert.equal(JSON.stringify(input), before, "source contours, dimensions and error metadata cannot be changed");
  assert.equal(result.ok, true, `${label}: ${result.error}`);
  assert.ok(result.count >= minimum, `${label}: ${result.count} dies loses independently proven ${minimum}-die layout`);
  assert.equal(result.count, result.slots.length);
  const counts = input.types.map(() => 0);
  for (const slot of result.slots) {
    assert.ok(Number.isInteger(slot.mi) && slot.mi >= 0 && slot.mi < counts.length);
    assert.ok(Number.isInteger(slot.vi) && slot.vi >= 0 && slot.vi < 4);
    assert.equal(slot.angle, slot.vi * 90, "only rigid source-sized quarter turns");
    counts[slot.mi]++;
  }
  assert.deepEqual(result.counts, counts);
  if (counts.length > 1) assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, "equivalent art models remain balanced");
  const audit = independentGuard(input, result.slots, denseTypes);
  const x0 = Math.min(...audit.shapes.map((s) => s.x0)), y0 = Math.min(...audit.shapes.map((s) => s.y0));
  const x1 = Math.max(...audit.shapes.map((s) => s.x1)), y1 = Math.max(...audit.shapes.map((s) => s.y1));
  const ox = (x0 + x1 - input.sheet.widthMm) / 2, oy = (y0 + y1 - input.sheet.heightMm) / 2;
  assert.ok(Math.abs(ox - result.centering.offsetXmm) < 0.001 && Math.abs(oy - result.centering.offsetYmm) < 0.001);
  if (result.centering.exact) assert.ok(Math.abs(ox) < 0.001 && Math.abs(oy) < 0.001);
  else assert.match(result.detail, /Canh tâm bị giới hạn bởi vùng né PON/);
  console.log(`${label}: ${result.count} dies, independently measured nearest gap ${audit.nearest} mm`);
  return result;
}

const began = Date.now(), sourceNodes = nodesFor(40, 70), nodesBefore = JSON.stringify(sourceNodes);
const witness = conservativeThirtyWitness(), witnessInput = archInput();
assert.equal(witness.length, 30);
const proof = independentGuard(witnessInput, witness, archDenseTypes());
assert.ok(proof.nearest >= 5.0009, "30-die witness independently respects a true 5 mm requested gap");
assert.equal(new Set(witness.map((s) => s.angle % 180)).size, 2, "witness uses both orientation families in separate bands");
const invalidWitness = witness.map((s) => ({ ...s }));
invalidWitness[invalidWitness.length - 1].x -= 0.01;
assert.throws(() => independentGuard(witnessInput, invalidWitness, archDenseTypes()), /physical gap/,
  "the independent witness guard must detect a real gap shortfall");
console.log(`Independent constructive witness: 30 true 40x70 dies, nearest ${proof.nearest} mm, PON/margins safe.`);

if (!process.argv.includes("--witness-only")) {
  const failures = [], run = (label, fn) => { try { fn(); } catch (e) { failures.push(`${label}: ${e.message}`); } };
  run("expired constructive deadline", () => expiredCompositionalBaseline(archInput(), witness.length));
  let first;
  for (const angle of [0, 90, 180, 270])
    run(`arch rotation ${angle}`, () => {
      const result = checked(archInput(angle), archDenseTypes(angle), witness.length, `Actual rounded arch / gap5 / rotation${angle}`);
      if (!first) first = result;
      else assert.equal(result.count, first.count, "quarter-turn input encoding cannot change the short-budget count");
    });
  run("repeat minimum budget", () => {
    const repeated = checked(archInput(), archDenseTypes(), witness.length, "Actual arch / repeated250ms budget");
    assert.equal(repeated.count, first.count);
    assert.deepEqual(repeated.counts, first.counts);
  });
  for (const scale of [0.8, 1.25])
    run(`uniform scale ${scale}`, () => checked(archInput(0, scale), archDenseTypes(0, scale), witness.length,
      `Dimensionally scaled arch/sheet/PON / scale${scale}`));
  run("equivalent artwork", () => checked(archInput(0, 1, 5, 2), archDenseTypes(0, 1, 2), witness.length, "Equivalent artwork / mixed bands"));
  run("curved zero gap", () => checked(archInput(0, 1, 0), archDenseTypes(), witness.length, "Actual rounded arch / zero gap"));

  const polygons = [
    { label: "Asymmetric pentagon", groups: [[[[0, 0], [33.4, 0], [29.1, 42.3], [14.7, 61.2], [4.3, 42.3]]]], dots: true },
    { label: "Concave offset L", groups: [[[[0, 0], [50.6, 0], [50.6, 17.3], [18.2, 17.3], [18.2, 48.7], [0, 48.7]]]], dots: false },
    { label: "Compound frame", groups: [[[[0, 0], [52.2, 0], [52.2, 42.7], [0, 42.7]],
      [[10, 10], [10, 32.7], [42.2, 32.7], [42.2, 10]]]], dots: false },
  ];
  for (const polygon of polygons)
    for (const gap of [0, 1.5])
      run(`${polygon.label} gap${gap}`, () => {
        const input = { sheet: { widthMm: 150, heightMm: 160, dots: polygon.dots ? [
          { x: 10, y: 10, r: 2.5 }, { x: 140, y: 10, r: 2.5 },
          { x: 10, y: 150, r: 2.5 }, { x: 140, y: 150, r: 2.5 },
        ] : [] }, types: [{ groups: polygon.groups, curveErrorMm: 0 }], gapMm: gap,
          marginMm: 4, ponClearMm: 7.5, resolutionMm: 0.25, budgetMs: 250 };
        const minimum = rowBaseline(input, polygon.groups);
        assert.ok(minimum >= 6, "meaningful generic safe-row baseline");
        checked(input, input.types, minimum, `${polygon.label} / gap${gap} / minimum250ms budget`);
      });
  assert.deepEqual(failures, [], failures.join("\n"));
}
assert.equal(JSON.stringify(sourceNodes), nodesBefore, "original cubic anchors and handles remain unchanged");
assert.ok(Date.now() - began < 60000, "multiband regression remains bounded");
