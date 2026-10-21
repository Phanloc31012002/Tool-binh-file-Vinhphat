"use strict";

// Thư viện biên dạng khuôn bế tổng quát cho kiểm thử Dàn bế. Toạ độ milimét cục bộ,
// trục y hướng lên như Illustrator. Đường cong được làm phẳng thích nghi giống cầu
// nối (sai số dây cung 0,00025 mm), không gắn tên sản phẩm hay dữ liệu người dùng.
const KAPPA = 0.5522847498307936;

function chord(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function flattenCubic(a, b, c, d, flat, out, depth) {
  if (depth >= 18 || Math.max(chord(b, a, d), chord(c, a, d)) <= flat) { out.push([d[0], d[1]]); return; }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const ab = mid(a, b), bc = mid(b, c), cd = mid(c, d), abc = mid(ab, bc), bcd = mid(bc, cd), m = mid(abc, bcd);
  flattenCubic(a, ab, abc, m, flat, out, depth + 1);
  flattenCubic(m, bcd, cd, d, flat, out, depth + 1);
}
// nodes: [{a:[x,y], l:[x,y], r:[x,y]}] như PathPoint của Illustrator (anchor, leftDirection, rightDirection).
function fromNodes(nodes, flat = 0.00025) {
  const out = [nodes[0].a.slice()];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i], m = nodes[(i + 1) % nodes.length];
    flattenCubic(n.a, n.r || n.a, m.l || m.a, m.a, flat, out, 0);
  }
  const last = out[out.length - 1];
  if (Math.hypot(last[0] - out[0][0], last[1] - out[0][1]) < 1e-9) out.pop();
  return out;
}
function corner(x, y) { return { a: [x, y], l: [x, y], r: [x, y] }; }
function normalize(contours) {
  const pts = contours.flat();
  const x0 = Math.min(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1]));
  return contours.map((c) => c.map((p) => [p[0] - x0, p[1] - y0]));
}
function single(contour, curved) { return { groups: [normalize([contour])], curveErrorMm: curved ? 0.00025 : 0 }; }

function ellipseNodes(w, h, cx = w / 2, cy = h / 2) {
  const rx = w / 2, ry = h / 2, kx = KAPPA * rx, ky = KAPPA * ry;
  return [
    { a: [cx + rx, cy], l: [cx + rx, cy - ky], r: [cx + rx, cy + ky] },
    { a: [cx, cy + ry], l: [cx + kx, cy + ry], r: [cx - kx, cy + ry] },
    { a: [cx - rx, cy], l: [cx - rx, cy + ky], r: [cx - rx, cy - ky] },
    { a: [cx, cy - ry], l: [cx - kx, cy - ry], r: [cx + kx, cy - ry] },
  ];
}
const circle = (d) => single(fromNodes(ellipseNodes(d, d)), true);
const ellipse = (w, h) => single(fromNodes(ellipseNodes(w, h)), true);
function roundRectNodes(w, h, r) {
  const k = KAPPA * r;
  return [
    { a: [w - r, 0], l: [w - r, 0], r: [w - r + k, 0] },
    { a: [w, r], l: [w, r - k], r: [w, r] },
    { a: [w, h - r], l: [w, h - r], r: [w, h - r + k] },
    { a: [w - r, h], l: [w - r + k, h], r: [w - r, h] },
    { a: [r, h], l: [r, h], r: [r - k, h] },
    { a: [0, h - r], l: [0, h - r + k], r: [0, h - r] },
    { a: [0, r], l: [0, r], r: [0, r - k] },
    { a: [r, 0], l: [r - k, 0], r: [r, 0] },
  ];
}
const roundRect = (w, h, r) => single(fromNodes(roundRectNodes(w, h, r)), true);
const rect = (w, h) => single([[0, 0], [w, 0], [w, h], [0, h]], false);
function polygon(points) { return single(points.map((p) => p.slice()), false); }
function regular(n, R, start = Math.PI / 2) {
  return polygon(Array.from({ length: n }, (_, i) => {
    const a = start + (i * 2 * Math.PI) / n;
    return [R * Math.cos(a), R * Math.sin(a)];
  }));
}
function star(n, R, r) {
  return polygon(Array.from({ length: 2 * n }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r : R;
    return [rr * Math.cos(a), rr * Math.sin(a)];
  }));
}
function heart(w = 50, h = 46) {
  // Tim cân đối: mũi nhọn ở dưới, hai thùy tròn ở trên, eo lõm ở giữa đỉnh.
  const s = (x, y) => [x * w / 100, y * h / 92];
  const nodes = [
    { a: s(50, 0), l: s(50, 0), r: s(50, 0) },
    { a: s(100, 62), l: s(92, 30), r: s(104, 78) },
    { a: s(75, 92), l: s(96, 92), r: s(60, 92) },
    { a: s(50, 76), l: s(54, 86), r: s(46, 86) },
    { a: s(25, 92), l: s(40, 92), r: s(4, 92) },
    { a: s(0, 62), l: s(-4, 78), r: s(8, 30) },
  ];
  // Nút 0 là mũi nhọn: tay nắm trùng điểm neo theo hướng hai cạnh xiên.
  nodes[0].r = s(62, 10); nodes[0].l = s(38, 10);
  return single(fromNodes(nodes), true);
}
function teardrop(w = 40, h = 58) {
  const r = w / 2, k = KAPPA * r;
  const nodes = [
    { a: [r, h], l: [r, h], r: [r, h] },
    { a: [w, r], l: [w, r + 1.15 * k + 6], r: [w, r - k] },
    { a: [r, 0], l: [r + k, 0], r: [r - k, 0] },
    { a: [0, r], l: [0, r - k], r: [0, r + 1.15 * k + 6] },
  ];
  nodes[0].l = [r - 4, h - 8]; nodes[0].r = [r + 4, h - 8];
  return single(fromNodes(nodes), true);
}
function shield(w = 50, h = 60) {
  const nodes = [
    corner(0, h), corner(w, h),
    { a: [w, h * 0.45], l: [w, h * 0.45], r: [w, h * 0.18] },
    { a: [w / 2, 0], l: [w * 0.8, h * 0.06], r: [w * 0.2, h * 0.06] },
    { a: [0, h * 0.45], l: [0, h * 0.18], r: [0, h * 0.45] },
  ];
  return single(fromNodes(nodes), true);
}
function semicircle(d = 60) {
  const r = d / 2, k = KAPPA * r;
  return single(fromNodes([
    { a: [0, 0], l: [0, 0], r: [0, 0] },
    { a: [d, 0], l: [d, 0], r: [d, k] },
    { a: [r, r], l: [r + k, r], r: [r - k, r] },
    { a: [0, 0], l: [0, k], r: [0, 0] },
  ].slice(0, 3).concat([{ a: [0, 0], l: [0, k], r: [0, 0] }]).filter((n, i) => i !== 3)
    .concat([]) ), true);
}
function semicircleClean(d = 60) {
  const r = d / 2, k = KAPPA * r;
  const nodes = [
    { a: [0, 0], l: [0, k], r: [0, 0] },
    { a: [d, 0], l: [d, 0], r: [d, k] },
    { a: [r, r], l: [r + k, r], r: [r - k, r] },
  ];
  return single(fromNodes(nodes), true);
}
function scallop(R = 25, bumps = 10, depth = 2.2) {
  const pts = [];
  const n = 2400;
  for (let i = 0; i < n; i++) {
    const t = (i * 2 * Math.PI) / n;
    const rr = R - depth + depth * Math.abs(Math.cos((bumps * t) / 2));
    pts.push([rr * Math.cos(t), rr * Math.sin(t)]);
  }
  return single(pts, true);
}
function bottle(w = 40, h = 90) {
  const neck = w * 0.36, shoulder = h * 0.62, neckTop = h * 0.8;
  const nodes = [
    corner(0, 0), corner(w, 0),
    { a: [w, shoulder], l: [w, shoulder], r: [w, shoulder + 8] },
    { a: [(w + neck) / 2, neckTop], l: [(w + neck) / 2, neckTop - 8], r: [(w + neck) / 2, neckTop] },
    corner((w + neck) / 2, h), corner((w - neck) / 2, h),
    { a: [(w - neck) / 2, neckTop], l: [(w - neck) / 2, neckTop], r: [(w - neck) / 2, neckTop - 8] },
    { a: [0, shoulder], l: [0, shoulder + 8], r: [0, shoulder] },
  ];
  return single(fromNodes(nodes), true);
}
const plus = (s = 50, t = 18) => {
  const a = (s - t) / 2, b = a + t;
  return polygon([[a, 0], [b, 0], [b, a], [s, a], [s, b], [b, b], [b, s], [a, s], [a, b], [0, b], [0, a], [a, a]]);
};
const tee = (w = 50, h = 50, t = 16) => polygon([[0, h - t], [w, h - t], [w, h], [0, h]].length && [[(w - t) / 2, 0], [(w + t) / 2, 0], [(w + t) / 2, h - t], [w, h - t], [w, h], [0, h], [0, h - t], [(w - t) / 2, h - t]]);
const elbow = (s = 45, t = 15) => polygon([[0, 0], [s, 0], [s, t], [t, t], [t, s], [0, s]]);
function crescent(R = 30, offset = 14) {
  // Trăng khuyết: phần của đường tròn tâm (0,0) nằm ngoài đường tròn cùng bán kính tâm (offset,0).
  const n = 1600, ix = Math.sqrt(R * R - (offset / 2) * (offset / 2));
  const a0 = Math.atan2(ix, offset / 2), a1 = 2 * Math.PI - a0;
  const b0 = Math.atan2(-ix, -offset / 2) + 2 * Math.PI, b1 = Math.atan2(ix, -offset / 2);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push([R * Math.cos(t), R * Math.sin(t)]);
  }
  // Cung trong đi ngược từ giao điểm dưới về giao điểm trên qua phía trái của đường tròn thứ hai.
  for (let i = 1; i < n; i++) {
    const t = b0 + ((b1 - b0) * i) / n;
    pts.push([offset + R * Math.cos(t), R * Math.sin(t)]);
  }
  return single(pts, true);
}
function bubble(w = 60, h = 42, r = 8) {
  const k = KAPPA * r, tail = 10, base = 12;
  const nodes = [
    { a: [r + base + 8, tail], l: [r + base + 8, tail], r: [w - r, tail] },
    { a: [w - r, tail], l: [w - r, tail], r: [w - r + k, tail] },
    { a: [w, tail + r], l: [w, tail + r - k], r: [w, tail + r] },
    { a: [w, h - r], l: [w, h - r], r: [w, h - r + k] },
    { a: [w - r, h], l: [w - r + k, h], r: [w - r, h] },
    { a: [r, h], l: [r, h], r: [r - k, h] },
    { a: [0, h - r], l: [0, h - r + k], r: [0, h - r] },
    { a: [0, tail + r], l: [0, tail + r], r: [0, tail + r - k] },
    { a: [r, tail], l: [r - k, tail], r: [r, tail] },
    corner(r + 4, tail), corner(r + 2, 0), corner(r + base, tail),
  ];
  return single(fromNodes(nodes), true);
}
function ring(outer = 44, inner = 20) {
  const o = fromNodes(ellipseNodes(outer, outer));
  const i = fromNodes(ellipseNodes(inner, inner, outer / 2, outer / 2)).reverse();
  return { groups: [normalize([o, i])], curveErrorMm: 0.00025 };
}
function hangTag(w = 50, h = 80, cut = 12, hole = 6) {
  const outer = [[0, 0], [w, 0], [w, h - cut], [w - cut, h], [cut, h], [0, h - cut]];
  const holeC = fromNodes(ellipseNodes(hole, hole, w / 2, h - cut - 2)).reverse();
  return { groups: [normalize([outer, holeC])], curveErrorMm: 0.00025 };
}
function bone(w = 70, h = 30) {
  const r = h / 4.2, k = KAPPA * r, nodes = [];
  const pts = [];
  const n = 1800;
  // Biên dạng xương: hai đầu là cặp tròn, thân thắt eo.
  for (let i = 0; i < n; i++) {
    const t = (i * 2 * Math.PI) / n;
    const x = (w / 2) * Math.cos(t);
    const y = (h / 2) * Math.sin(t) * (0.55 + 0.45 * Math.pow(Math.abs(Math.cos(t)), 0.6)) * (1 + 0.25 * Math.cos(2 * t) * Math.cos(2 * t));
    pts.push([x, y]);
  }
  return single(pts, true);
}
function blob(seed = 7, R = 28) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const terms = Array.from({ length: 5 }, (_, k) => ({ k: k + 2, a: (rnd() - 0.5) * R * 0.18 / (k + 1) * 2, p: rnd() * 6.283 }));
  const pts = [], n = 2400;
  for (let i = 0; i < n; i++) {
    const t = (i * 2 * Math.PI) / n;
    let rr = R;
    for (const term of terms) rr += term.a * Math.cos(term.k * t + term.p);
    pts.push([rr * Math.cos(t) * 1.15, rr * Math.sin(t)]);
  }
  return single(pts, true);
}
const arrow = (w = 70, h = 36) => polygon([[0, h * 0.3], [w * 0.62, h * 0.3], [w * 0.62, 0], [w, h / 2], [w * 0.62, h], [w * 0.62, h * 0.7], [0, h * 0.7]]);
const diamond = (w = 44, h = 66) => polygon([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
const triangle = (w = 53, h = 27) => polygon([[0, h], [w / 2, 0], [w, h]]);
const trapezoid = () => polygon([[0, 27], [18, 0], [35, 0], [53, 27]]);
function kidney(w = 60, h = 36) {
  const pts = [], n = 2000;
  for (let i = 0; i < n; i++) {
    const t = (i * 2 * Math.PI) / n;
    const x = (w / 2) * Math.cos(t), y0 = (h / 2) * Math.sin(t);
    const y = y0 + (h * 0.32) * Math.pow(Math.cos(t), 2) - (y0 > 0 ? (h * 0.18) * Math.pow(Math.cos(t / 1), 0) * Math.exp(-Math.pow(Math.cos(t) / 0.35, 2)) : 0);
    pts.push([x, y]);
  }
  return single(pts, true);
}

module.exports = {
  KAPPA, fromNodes, ellipseNodes, roundRectNodes, normalize,
  circle, ellipse, roundRect, rect, polygon, regular, star, heart, teardrop, shield,
  semicircle: semicircleClean, scallop, bottle, plus, tee, elbow, crescent, bubble, ring, hangTag,
  bone, blob, arrow, diamond, triangle, trapezoid, kidney,
};
