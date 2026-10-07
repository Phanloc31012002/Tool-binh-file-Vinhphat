"use strict";

const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");

// Actual straight-path dimensions include harmless Illustrator unit-conversion
// noise. They must not be snapped into a larger or smaller physical rectangle.
const WIDTH = 92.0000000094555;
const HEIGHT = 56.0000000057576;
const EPS = 1e-8;
const base = [[[[0, 0], [WIDTH, 0], [WIDTH, HEIGHT], [0, HEIGHT]]]];
const sheet = { widthMm: 330, heightMm: 354, dots: [
  { x: 10, y: 10, r: 2.5 }, { x: 320, y: 10, r: 2.5 },
  { x: 10, y: 344, r: 2.5 }, { x: 320, y: 344, r: 2.5 },
] };

function turn(p, angle) {
  if (angle === 90) return [-p[1], p[0]];
  if (angle === 180) return [-p[0], -p[1]];
  if (angle === 270) return [p[1], -p[0]];
  return p.slice();
}
function rotated(groups, angle) {
  return groups.map((g) => g.map((c) => c.map((p) => turn(p, angle))));
}
function inputFor(angle = 0, typeCount = 1) {
  return { sheet, types: Array.from({ length: typeCount }, () => ({
    groups: rotated(base, angle), curveErrorMm: 0,
  })), gapMm: 0, marginMm: 4, ponClearMm: 7.5, resolutionMm: 0.25, budgetMs: 250 };
}
function boxFor(type, slot) {
  const points = rotated(type.groups, slot.angle).flat(2);
  const width = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
  const height = Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1]));
  assert.ok((Math.abs(width - WIDTH) < EPS && Math.abs(height - HEIGHT) < EPS) ||
    (Math.abs(width - HEIGHT) < EPS && Math.abs(height - WIDTH) < EPS),
  "every independently reconstructed cutter retains both original dimensions, with rigid rotation only");
  return { x0: slot.x, y0: slot.y, x1: slot.x + width, y1: slot.y + height, width, height };
}
function pairDistance(a, b) {
  return Math.hypot(Math.max(a.x0 - b.x1, b.x0 - a.x1, 0),
    Math.max(a.y0 - b.y1, b.y0 - a.y1, 0));
}
function dotDistance(dot, box) {
  return Math.hypot(Math.max(box.x0 - dot.x, dot.x - box.x1, 0),
    Math.max(box.y0 - dot.y, dot.y - box.y1, 0));
}
function independentGuard(input, slots) {
  const boxes = slots.map((s) => boxFor(input.types[s.mi], s));
  let nearest = Infinity, ponClearance = Infinity, margin = Infinity;
  for (const box of boxes) {
    const physicalMargin = Math.min(box.x0, box.y0,
      input.sheet.widthMm - box.x1, input.sheet.heightMm - box.y1);
    assert.ok(physicalMargin >= input.marginMm - EPS, "all physical rectangles respect paper margins");
    margin = Math.min(margin, physicalMargin);
    for (const dot of input.sheet.dots) {
      const physicalClearance = dotDistance(dot, box) - dot.r;
      assert.ok(physicalClearance >= input.ponClearMm - EPS, "rectangle-to-PON edge distance respects clearance");
      ponClearance = Math.min(ponClearance, physicalClearance);
    }
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      assert.ok(overlapX <= EPS || overlapY <= EPS,
        "every pair has disjoint filled interiors; boundary contact is permitted at zero gap");
      const distance = pairDistance(a, b);
      assert.ok(distance >= input.gapMm - EPS, "independent all-pairs physical gap");
      nearest = Math.min(nearest, distance);
    }
  return { boxes, nearest, ponClearance, margin };
}
function checked(input, label) {
  const before = JSON.stringify(input), result = nester.nest(input);
  assert.equal(JSON.stringify(input), before, "source points, sizes, metadata, PONs and panel settings remain immutable");
  assert.equal(result.ok, true, `${label}: ${result.error}`);
  // Eighteen is an independently proven feasible lower bound, not a claim that
  // mixed-orientation searching can never find a stronger arrangement.
  assert.ok(result.count >= 18, `${label}: must retain the proven 3 x 6 layout, not the cached 16-piece result`);
  assert.equal(result.slots.length, result.count);
  const counts = input.types.map(() => 0);
  for (const slot of result.slots) {
    assert.ok(Number.isInteger(slot.mi) && slot.mi >= 0 && slot.mi < counts.length);
    assert.ok(Number.isInteger(slot.vi) && slot.vi >= 0 && slot.vi < 4);
    assert.equal(slot.angle, slot.vi * 90, "orientation metadata describes a rigid quarter-turn");
    counts[slot.mi]++;
  }
  assert.deepEqual(result.counts, counts, "public copy totals agree with every emitted slot");
  if (counts.length > 1) assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, "equivalent artwork remains balanced");
  const audit = independentGuard(input, result.slots);
  assert.ok(audit.nearest <= 0.005, "zero requested gap must not reintroduce a fixed 0.25/0.5 mm grid gutter");
  const x0 = Math.min(...audit.boxes.map((b) => b.x0)), y0 = Math.min(...audit.boxes.map((b) => b.y0));
  const x1 = Math.max(...audit.boxes.map((b) => b.x1)), y1 = Math.max(...audit.boxes.map((b) => b.y1));
  const error = [(x0 + x1 - input.sheet.widthMm) / 2, (y0 + y1 - input.sheet.heightMm) / 2];
  assert.ok(result.centering && typeof result.centering.exact === "boolean");
  assert.ok(Math.abs(error[0] - result.centering.offsetXmm) < EPS &&
    Math.abs(error[1] - result.centering.offsetYmm) < EPS, "centering metadata matches true physical bounds");
  if (result.centering.exact) assert.ok(Math.max(...error.map(Math.abs)) < 0.001, "exact centering is physically exact");
  else {
    const centredTrial = result.slots.map((s) => ({ ...s, x: s.x - error[0], y: s.y - error[1] }));
    assert.throws(() => independentGuard(input, centredTrial), /PON/,
      "centering may be constrained only by a physically proved PON obstruction");
  }
  console.log(`${label}: ${result.count} cutters, nearest ${audit.nearest} mm, PON edge clearance ${audit.ponClearance} mm`);
  return result;
}

const began = Date.now(), sourceBefore = JSON.stringify(base);
const witness = [];
const left = (sheet.widthMm - 3 * WIDTH) / 2, bottom = (sheet.heightMm - 6 * HEIGHT) / 2;
for (let row = 0; row < 6; row++)
  for (let col = 0; col < 3; col++)
    witness.push({ mi: 0, vi: 0, angle: 0, x: left + col * WIDTH, y: bottom + row * HEIGHT });
assert.equal(witness.length, 18);
const proof = independentGuard(inputFor(), witness);
assert.ok(proof.nearest <= EPS, "the independently constructed 3 x 6 witness permits boundary contact without overlap");
const unsafe = witness.map((s) => ({ ...s }));
unsafe[1].x -= 0.01;
assert.throws(() => independentGuard(inputFor(), unsafe), /disjoint filled interiors/,
  "the independent zero-gap guard rejects genuine overlap, not only inadequate positive gaps");

for (const angle of [0, 90, 180, 270]) checked(inputFor(angle), `Actual fractional rectangle / input rotation${angle}`);
checked(inputFor(0, 2), "Same rectangle / two equivalent artwork models");
assert.equal(JSON.stringify(base), sourceBefore, "original rectangle points remain unchanged");
assert.ok(Date.now() - began < 8000, "focused rectangle regression remains bounded at the 250 ms planning budget");
console.log(`Rectangle regression completed in ${Date.now() - began} ms; 18-piece feasible lower bound independently proved.`);
