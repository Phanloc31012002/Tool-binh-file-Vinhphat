"use strict";

// Bảy điểm cong bậc ba, đo ở chế độ chỉ đọc từ khuôn bế 53 x 26.51 mm của người dùng.
// Toạ độ là mm cục bộ; không kèm bài, tên tài liệu hay metadata hệ thống file.
const nodes = [
  {
    a: [52.677234043278226, 26.51160434369366],
    l: [53.10761259692489, 25.971844008351724],
    r: [52.677234043278226, 26.51160434369366],
  },
  {
    a: [0.3250032029364609, 26.405775316718717],
    l: [0.3250032029364609, 26.405775316718717],
    r: [-0.105375350710203, 25.862483758503156],
  },
  {
    a: [0.3179407571892073, 24.557223206068656],
    l: [-0.10890657358382982, 25.10049323243752],
    r: [0.3179407571892073, 24.557223206068656],
  },
  {
    a: [15.198126373410581, 5.623624367859679],
    l: [15.198126373410581, 5.623624367859679],
    r: [17.946257511116812, 2.124074840861531],
  },
  {
    a: [26.58931306756068, 0.00034572823006419296],
    l: [22.13372801122185, -0.03139221393896128],
    r: [30.921412982556806, 0.03210520224593271],
  },
  {
    a: [37.603024955628435, 5.411966313909974],
    l: [34.92898490272789, 2.0006112313653697],
    r: [37.603024955628435, 5.411966313909974],
  },
  {
    a: [52.68427495717845, 24.6630522330436],
    l: [52.68427495717845, 24.6630522330436],
    r: [53.10761259692489, 25.20632225941245],
  },
];
function cap() {
  const points = [nodes[0].a.slice()];
  function mid(a, b) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }
  function distance(p, a, b) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy);
    return len
      ? Math.abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / len
      : Math.hypot(p[0] - a[0], p[1] - a[1]);
  }
  function flatten(a, b, c, d, depth) {
    if (
      depth >= 14 ||
      Math.max(distance(b, a, d), distance(c, a, d)) <= 0.005
    ) {
      points.push(d.slice());
      return;
    }
    const ab = mid(a, b),
      bc = mid(b, c),
      cd = mid(c, d),
      abc = mid(ab, bc),
      bcd = mid(bc, cd),
      centre = mid(abc, bcd);
    flatten(a, ab, abc, centre, depth + 1);
    flatten(centre, bcd, cd, d, depth + 1);
  }
  for (let i = 0; i < nodes.length; i++) {
    const next = nodes[(i + 1) % nodes.length];
    flatten(nodes[i].a, nodes[i].r, next.l, next.a, 0);
  }
  const x0 = Math.min(...points.map((p) => p[0])),
    y0 = Math.min(...points.map((p) => p[1]));
  return [[points.map((p) => [p[0] - x0, p[1] - y0])]];
}
module.exports = { cap, nodes };
