"use strict";

// Four native Illustrator-style cubic quarters, not an ideal analytic circle
// or a preselected polygon. Coordinates are local millimetres, with no user
// document/file metadata. The standard kappa makes the cubic radius vary very
// slightly between anchors; that matters when checking real physical gaps.
const KAPPA = 0.5522847498307936;

function nodesFor(diameter) {
  if (!Number.isFinite(diameter) || diameter <= 0)
    throw new RangeError("Circle diameter must be finite and positive");
  const r = diameter / 2, k = KAPPA * r;
  return [
    { a: [diameter, r], l: [diameter, r - k], r: [diameter, r + k] },
    { a: [r, diameter], l: [r + k, diameter], r: [r - k, diameter] },
    { a: [0, r], l: [0, r + k], r: [0, r - k] },
    { a: [r, 0], l: [r - k, 0], r: [r + k, 0] },
  ];
}

function curveFor(diameter, flatness = 0.00025) {
  if (!Number.isFinite(flatness) || flatness <= 0)
    throw new RangeError("Circle flattening precision must be finite and positive");
  const nodes = nodesFor(diameter), points = [nodes[0].a.slice()];
  const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function finiteChordDistance(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
    const t = den ? Math.max(0, Math.min(1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function flatten(a, b, c, d, depth) {
    const error = Math.max(finiteChordDistance(b, a, d), finiteChordDistance(c, a, d));
    if (error <= flatness) { points.push(d.slice()); return; }
    if (depth >= 24) throw new Error("Circle curve precision exceeds subdivision bound");
    const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, d),
      abc = midpoint(ab, bc), bcd = midpoint(bc, cd), m = midpoint(abc, bcd);
    flatten(a, ab, abc, m, depth + 1);
    flatten(m, bcd, cd, d, depth + 1);
  }
  for (let i = 0; i < nodes.length; i++) {
    const next = nodes[(i + 1) % nodes.length];
    flatten(nodes[i].a, nodes[i].r, next.l, next.a, 0);
  }
  points.pop();
  const x0 = Math.min(...points.map((p) => p[0])), y0 = Math.min(...points.map((p) => p[1]));
  return [[points.map((p) => [p[0] - x0, p[1] - y0])]];
}

module.exports = { nodesFor, curveFor, KAPPA };
