"use strict";
// Bộ đo độc lập cho bố cục chia khu: dựng lại đường bế thật từ slot, tự nhận nhóm khuôn,
// đo khe/khoảng cách khu/lề/PON/chồng lấn bằng hình học thuần. Không dùng code của panel.
const assert = require("node:assert/strict");
const { clusterCount, boxOf } = require("./dan_be_cluster_check");

function turn(p, a) {
  if (a === 90) return [-p[1], p[0]];
  if (a === 180) return [-p[0], -p[1]];
  if (a === 270) return [p[1], -p[0]];
  return [p[0], p[1]];
}
function rotated(groups, angle) { return groups.map((g) => g.map((c) => c.map((p) => turn(p, angle)))); }
function normalized(groups) {
  const pts = groups.flat(2);
  const x0 = Math.min(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1]));
  return groups.map((g) => g.map((c) => c.map((p) => [p[0] - x0, p[1] - y0])));
}
// Đường bế của một slot đặt đúng chỗ trên tờ: xoay, rồi góc trên-trái khung bao ở (x, y).
function outline(groups, slot) {
  const norm = normalized(rotated(groups, slot.angle));
  const contours = norm.flat().map((c) => c.map((p) => [p[0] + slot.x, p[1] + slot.y]));
  const edges = [];
  for (const c of contours) for (let i = 0; i < c.length; i++) edges.push([c[i], c[(i + 1) % c.length]]);
  const pts = contours.flat();
  return { groups: norm.map((g) => g.map((c) => c.map((p) => [p[0] + slot.x, p[1] + slot.y]))), contours, edges,
    x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])),
    x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) };
}
function sameContour(a, b, eps) {
  if (a.length !== b.length) return false;
  for (let start = 0; start < b.length; start++) {
    if (Math.abs(a[0][0] - b[start][0]) > eps || Math.abs(a[0][1] - b[start][1]) > eps) continue;
    for (const dir of [1, -1]) {
      let ok = true;
      for (let i = 1; i < a.length && ok; i++) {
        const j = (start + dir * i + b.length) % b.length;
        if (Math.abs(a[i][0] - b[j][0]) > eps || Math.abs(a[i][1] - b[j][1]) > eps) ok = false;
      }
      if (ok) return true;
    }
  }
  return false;
}
function sameShape(a, b) {
  const ca = a.flat(), cb = b.flat();
  if (ca.length !== cb.length) return false;
  const used = new Set();
  return ca.every((c) => { const j = cb.findIndex((d, i) => !used.has(i) && sameContour(c, d, 1e-6)); if (j < 0) return false; used.add(j); return true; });
}
// Mảng các mảng chỉ số bài cùng nhóm khuôn (so đường bế đã chuẩn hoá ở cả 4 hướng).
function cutterGroupsOf(input) {
  const groups = [];
  input.types.forEach((t, ti) => {
    const norm = normalized(t.groups);
    for (const g of groups) {
      const ref = normalized(input.types[g[0]].groups);
      if ([0, 90, 180, 270].some((a) => sameShape(normalized(rotated(norm, a)), ref))) { g.push(ti); return; }
    }
    groups.push([ti]);
  });
  return groups;
}
function segDist(a, b, c, d) {
  const ps = (p, u, v) => {
    const dx = v[0] - u[0], dy = v[1] - u[1], den = dx * dx + dy * dy;
    const t = den ? Math.max(0, Math.min(1, ((p[0] - u[0]) * dx + (p[1] - u[1]) * dy) / den)) : 0;
    return Math.hypot(p[0] - u[0] - t * dx, p[1] - u[1] - t * dy);
  };
  return Math.min(ps(a, c, d), ps(b, c, d), ps(c, a, b), ps(d, a, b));
}
function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
function properCross(a, b, c, d) {
  const x = cross(a, b, c), y = cross(a, b, d), u = cross(c, d, a), w = cross(c, d, b);
  return ((x > 1e-9 && y < -1e-9) || (x < -1e-9 && y > 1e-9)) && ((u > 1e-9 && w < -1e-9) || (u < -1e-9 && w > 1e-9));
}
function insideEvenOdd(p, contours) {
  let inside = false;
  for (const c of contours) for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const a = c[i], b = c[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function boundaryDist(p, edges) { return Math.min(...edges.map((e) => segDist(p, p, e[0], e[1]))); }
function outlineDist(a, b) {
  let best = Infinity;
  for (const e of a.edges) for (const f of b.edges) {
    if (Math.min(e[0][0], e[1][0]) > Math.max(f[0][0], f[1][0]) + best || Math.min(f[0][0], f[1][0]) > Math.max(e[0][0], e[1][0]) + best) continue;
    if (Math.min(e[0][1], e[1][1]) > Math.max(f[0][1], f[1][1]) + best || Math.min(f[0][1], f[1][1]) > Math.max(e[0][1], e[1][1]) + best) continue;
    best = Math.min(best, segDist(e[0], e[1], f[0], f[1]));
    if (best <= 0) return 0;
  }
  return best;
}
function overlaps(a, b) {
  for (const e of a.edges) for (const f of b.edges) if (properCross(e[0], e[1], f[0], f[1])) return true;
  // Đỉnh nằm hẳn bên trong vùng tô (even/odd) của hình kia: chồng hoặc lọt lỗ... trừ khi chỉ chạm biên.
  const strictIn = (p, o) => insideEvenOdd(p, o.contours) && boundaryDist(p, o.edges) > 1e-6;
  return a.contours.flat().some((p) => strictIn(p, b)) || b.contours.flat().some((p) => strictIn(p, a));
}
function placedAll(input, result) {
  return result.slots.map((s) => Object.assign(outline(input.types[s.mi].groups, s), { mi: s.mi }));
}
// Ném lỗi khi: ra ngoài lề, chạm vùng né PON, cùng nhóm khuôn < khe, khác nhóm < khoảng cách khu, chồng/lọt lỗ.
function checkLayout(input, result, zoneGapMm) {
  const W = input.sheet.widthMm, H = input.sheet.heightMm, m = input.marginMm, gap = input.gapMm;
  const zoneGap = Math.max(zoneGapMm || 0, gap);
  const groupOf = [];
  cutterGroupsOf(input).forEach((g, gi) => g.forEach((ti) => { groupOf[ti] = gi; }));
  const shapes = placedAll(input, result);
  shapes.forEach((s, i) => {
    assert.ok(s.x0 >= m - 0.001 && s.y0 >= m - 0.001 && s.x1 <= W - m + 0.001 && s.y1 <= H - m + 0.001, "con " + i + " ra ngoài lề tờ");
    for (const d of input.sheet.dots) {
      const centre = [d.x, d.y], need = d.r + input.ponClearMm;
      assert.ok(!insideEvenOdd(centre, s.contours), "con " + i + " trùm lên chấm PON");
      // Dung sai 0,001 mm như các bộ đo độc lập hiện có (sai số số học khi quy đổi).
      assert.ok(boundaryDist(centre, s.edges) >= need - 0.001, "con " + i + " chạm vùng né PON (" + boundaryDist(centre, s.edges).toFixed(4) + " < " + need + ")");
    }
  });
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    const a = shapes[i], b = shapes[j];
    const need = groupOf[a.mi] === groupOf[b.mi] ? gap : zoneGap;
    if (a.x0 > b.x1 + need || b.x0 > a.x1 + need || a.y0 > b.y1 + need || b.y0 > a.y1 + need) continue;
    const dist = outlineDist(a, b);
    assert.ok(dist >= need - 0.001, "con " + i + " và " + j + " cách " + dist.toFixed(4) + " mm, cần " + need + " mm");
    // Chồng vùng tô hoặc lọt vào lỗ compound: kiểm tra ở mọi mức khe (biên xa nhau vẫn có thể nằm trong lỗ).
    assert.ok(!overlaps(a, b), "con " + i + " và " + j + " chồng lên nhau hoặc lọt vào lỗ");
  }
}
// Mọi cặp nhóm khuôn phải tách được bằng một đường thẳng ngang hoặc dọc qua tâm khung bao các con.
function assertSeparable(input, result) {
  const groups = cutterGroupsOf(input);
  const centres = result.slots.map((s) => { const b = boxOf(input.types[s.mi].groups, s); return { mi: s.mi, x: b.cx, y: b.cy }; });
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
    const A = centres.filter((c) => groups[i].includes(c.mi)), B = centres.filter((c) => groups[j].includes(c.mi));
    if (!A.length || !B.length) continue;
    const lim = (list, k, f) => f(...list.map((c) => c[k]));
    const ok = lim(A, "x", Math.max) < lim(B, "x", Math.min) + 1e-6 || lim(B, "x", Math.max) < lim(A, "x", Math.min) + 1e-6 ||
      lim(A, "y", Math.max) < lim(B, "y", Math.min) + 1e-6 || lim(B, "y", Math.max) < lim(A, "y", Math.min) + 1e-6;
    assert.ok(ok, "nhóm khuôn " + (i + 1) + " và " + (j + 1) + " xen vào nhau, không tách được bằng đường ngang/dọc");
  }
}
// [lệch x, lệch y] của khung bao vật lý so với tâm tờ.
function centreError(input, result) {
  const shapes = placedAll(input, result);
  const x0 = Math.min(...shapes.map((s) => s.x0)), x1 = Math.max(...shapes.map((s) => s.x1));
  const y0 = Math.min(...shapes.map((s) => s.y0)), y1 = Math.max(...shapes.map((s) => s.y1));
  return [(x0 + x1 - input.sheet.widthMm) / 2, (y0 + y1 - input.sheet.heightMm) / 2];
}
// Khoảng cách nhỏ nhất giữa hai tập slot, đo trên đường bế thật.
function minDistance(input, slotsA, slotsB) {
  const A = slotsA.map((s) => outline(input.types[s.mi].groups, s)), B = slotsB.map((s) => outline(input.types[s.mi].groups, s));
  let best = Infinity;
  for (const a of A) for (const b of B) best = Math.min(best, outlineDist(a, b));
  return best;
}

module.exports = { outline, cutterGroupsOf, checkLayout, clusterCount, assertSeparable, centreError, minDistance, outlineDist };
