"use strict";

// Portable six-node rounded arch, in local millimetres. The two real outlines
// retain their tiny Illustrator coordinate dust and original cubic handles.
// No source document, artwork, person or filesystem identifiers are included.
const arches = {
  "42x72": [
    { a: [42.000000004473236, 0], l: [42.000000004473236, 0], r: [42.000000004473236, 0] },
    { a: [0, 0], l: [0, 0], r: [0, 0] },
    { a: [5.715132071884461e-10, 53.625550295586585], l: [5.715132071884461e-10, 53.625550295586585], r: [6.773133363507704e-10, 63.77347865798609] },
    { a: [18.374449712578855, 72.00000000739924], l: [8.226521350182226, 72.00000000739993], r: [18.374449712578855, 72.00000000739924] },
    { a: [23.625550291979007, 72.00000000739924], l: [23.625550291979007, 72.00000000739924], r: [33.77347865495429, 72.00000000739888] },
    { a: [42.00000000480836, 53.625550294452765], l: [42.00000000487189, 63.77347865742658], r: [42.00000000480836, 53.625550294452765] },
  ],
  "40x70": [
    { a: [40.00000000425803, 0], l: [40.00000000425803, 0], r: [40.00000000425803, 0] },
    { a: [0, 0], l: [0, 0], r: [0, 0] },
    { a: [5.36219760007686e-10, 51.62555029537815], l: [5.36219760007686e-10, 51.62555029537815], r: [6.420198891700102e-10, 61.77347865777941] },
    { a: [18.37444971254709, 70.00000000719537], l: [8.226521350146932, 70.00000000719608], r: [18.37444971254709, 70.00000000719537] },
    { a: [21.625550291746155, 70.00000000719503], l: [21.625550291746155, 70.00000000719503], r: [31.773478654721433, 70.00000000719396] },
    { a: [40.00000000457904, 51.62555029424961], l: [40.00000000463904, 61.77347865722307], r: [40.00000000457904, 51.62555029424961] },
  ],
};
function nodesFor(width = 42, height = 72) {
  const original = arches[`${width}x${height}`];
  if (!original) throw new RangeError("Unsupported portable arch dimensions");
  return original.map((n) => ({ a: n.a.slice(), l: n.l.slice(), r: n.r.slice() }));
}
function turn(p, angle) {
  if (angle === 90) return [-p[1], p[0]];
  if (angle === 180) return [-p[0], -p[1]];
  if (angle === 270) return [p[1], -p[0]];
  return p.slice();
}
function curveFor(width = 42, height = 72, flatnessMm = 0.00025, angle = 0) {
  if (!(flatnessMm > 0) || !Number.isFinite(flatnessMm))
    throw new RangeError("Invalid arch flattening precision");
  if (![0, 90, 180, 270].includes(angle)) throw new RangeError("Invalid arch rotation");
  const nodes = nodesFor(width, height), points = [nodes[0].a.slice()];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function chordDistance(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
    const t = den ? Math.max(0, Math.min(1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function flatten(a, b, c, d, depth) {
    if (Math.max(chordDistance(b, a, d), chordDistance(c, a, d)) <= flatnessMm) {
      points.push(d.slice());
      return;
    }
    if (depth >= 24) throw new Error("Arch flattening subdivision bound");
    const ab = mid(a, b), bc = mid(b, c), cd = mid(c, d);
    const abc = mid(ab, bc), bcd = mid(bc, cd), m = mid(abc, bcd);
    flatten(a, ab, abc, m, depth + 1);
    flatten(m, bcd, cd, d, depth + 1);
  }
  for (let i = 0; i < nodes.length; i++) {
    const next = nodes[(i + 1) % nodes.length];
    flatten(nodes[i].a, nodes[i].r, next.l, next.a, 0);
  }
  points.pop();
  const rotated = points.map((p) => turn(p, angle));
  const x0 = Math.min(...rotated.map((p) => p[0])), y0 = Math.min(...rotated.map((p) => p[1]));
  return [[rotated.map((p) => [p[0] - x0, p[1] - y0])]];
}
module.exports = { nodesFor, curveFor };
