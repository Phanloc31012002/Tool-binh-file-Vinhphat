"use strict";

// Đường cong kín bảy nút, không phụ thuộc máy, đo từ payload thật ở chế độ chỉ đọc.
// Toạ độ là milimét cục bộ, không kèm metadata về tài liệu/người dùng/hệ thống file.
// Chiều cao 122.0000000125 mm cố ý giữ lại sai số lẻ li ti của Illustrator.
const nodes = [
  {
    a: [46.08638720757836, 98.9568064087484],
    l: [46.08638720757836, 111.68348125861304],
    r: [46.08638720757836, 89.95469352801146],
  },
  {
    a: [33.396989066601755, 78.36601988176393],
    l: [40.92316872410234, 82.15767386071136],
    r: [33.396989066601755, 78.36601988176393],
  },
  {
    a: [33.396989066601755, 0],
    l: [33.396989066601755, 0],
    r: [33.396989066601755, 0],
  },
  {
    a: [12.689413306436784, 0],
    l: [12.689413306436784, 0],
    r: [12.689413306436784, 0],
  },
  {
    a: [12.689413306436784, 78.36601988176393],
    l: [12.689413306436784, 78.36601988176393],
    r: [5.163233648938289, 82.15767386071136],
  },
  {
    a: [0, 98.9568064087484],
    l: [0, 89.95469352801146],
    r: [0, 111.68348125861304],
  },
  {
    a: [23.04319360378934, 122.0000000125377],
    l: [10.316518753918722, 122.0000000125377],
    r: [35.76988361912367, 122.0000000125377],
  },
];
function curve(scale = 1, flatnessMm = 0.025) {
  const scaled = nodes.map((n) => ({
    a: n.a.map((v) => v * scale),
    l: n.l.map((v) => v * scale),
    r: n.r.map((v) => v * scale),
  }));
  const points = [scaled[0].a.slice()];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function pointLine(p, a, b) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      distance = Math.hypot(dx, dy);
    const t = distance > 1e-12
      ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (distance * distance)))
      : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function flatten(a, b, c, d, depth) {
    if (
      depth >= 18 ||
      Math.max(pointLine(b, a, d), pointLine(c, a, d)) <= flatnessMm
    ) {
      points.push(d.slice());
      return;
    }
    const ab = mid(a, b),
      bc = mid(b, c),
      cd = mid(c, d);
    const abc = mid(ab, bc),
      bcd = mid(bc, cd),
      centre = mid(abc, bcd);
    flatten(a, ab, abc, centre, depth + 1);
    flatten(centre, bcd, cd, d, depth + 1);
  }
  for (let i = 0; i < scaled.length; i++) {
    const next = scaled[(i + 1) % scaled.length];
    flatten(scaled[i].a, scaled[i].r, next.l, next.a, 0);
  }
  if (
    Math.hypot(
      points[points.length - 1][0] - points[0][0],
      points[points.length - 1][1] - points[0][1],
    ) <
    0.00001 / 2.834645669
  )
    points.pop();
  const x0 = Math.min(...points.map((p) => p[0])),
    y0 = Math.min(...points.map((p) => p[1]));
  return [[points.map((p) => [p[0] - x0, p[1] - y0])]];
}
module.exports = { nodes, curve };
