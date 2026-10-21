"use strict";
// Bộ đo độc lập cho luật "mỗi bài một cụm liền, không lẫn" (dùng chung cho các test dàn bế).
// Chỉ dựa vào đường bế thật của bài và slot trả về; không dùng code của panel.
const assert = require("node:assert/strict");

function turn(p, a) {
  if (a === 90) return [-p[1], p[0]];
  if (a === 180) return [-p[0], -p[1]];
  if (a === 270) return [p[1], -p[0]];
  return [p[0], p[1]];
}
function boxOf(groups, slot) {
  const pts = groups.flat(2).map((p) => turn(p, slot.angle));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  return { x0: slot.x, y0: slot.y, x1: slot.x + w, y1: slot.y + h, cx: slot.x + w / 2, cy: slot.y + h / 2, side: Math.max(w, h) };
}
function boxGap(a, b) {
  return Math.hypot(Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1)), Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1)));
}
function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
function hull(points) {
  const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
function strictlyInside(h, q) {
  if (h.length < 3) return false;
  for (let i = 0; i < h.length; i++) if (cross(h[i], h[(i + 1) % h.length], q) <= 1e-6) return false;
  return true;
}
// Số cụm liền của bài k. Hai con kề nhau khi khung bao cách nhau ≤ khe + nửa cạnh dài nhất của con lớn hơn.
function clusterCount(input, result, k) {
  const mine = result.slots.filter((s) => s.mi === k).map((s) => boxOf(input.types[s.mi].groups, s));
  if (!mine.length) return 0;
  const seen = mine.map(() => false);
  let clusters = 0;
  for (let start = 0; start < mine.length; start++) {
    if (seen[start]) continue;
    clusters++; seen[start] = true;
    const stack = [start];
    while (stack.length) {
      const i = stack.pop();
      for (let j = 0; j < mine.length; j++) {
        if (seen[j]) continue;
        if (boxGap(mine[i], mine[j]) <= input.gapMm + 0.5 * Math.max(mine[i].side, mine[j].side) + 1e-6) { seen[j] = true; stack.push(j); }
      }
    }
  }
  return clusters;
}
// Bài k là MỘT cụm liền và không có con bài khác lọt hẳn vào bao lồi của cụm (gọn, không lẫn).
function assertClusterTidy(input, result, k) {
  assert.equal(clusterCount(input, result, k), 1, "bài " + (k + 1) + " phải là một cụm liền");
  const boxes = result.slots.map((s) => ({ mi: s.mi, b: boxOf(input.types[s.mi].groups, s) }));
  const h = hull(boxes.filter((c) => c.mi === k).map((c) => ({ x: c.b.cx, y: c.b.cy })));
  boxes.forEach((c) => {
    if (c.mi !== k) assert.ok(!strictlyInside(h, { x: c.b.cx, y: c.b.cy }), "bài " + (c.mi + 1) + " lọt vào cụm bài " + (k + 1));
  });
}

module.exports = { boxOf, boxGap, hull, strictlyInside, clusterCount, assertClusterTidy };
