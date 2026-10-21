"use strict";
// Dữ liệu mẫu cho bộ test chia khu: tờ 330 × 354, PON 4 góc cách mép 10 mm, khe 2, lề 4, né 7,5.
// `extra.midEdgeDots` thêm 4 chấm giữa cạnh; khoá khác của `extra` ghi đè trường cùng tên.
const L = require("./dan_be_shape_library");
const F = require("./dan_be_fixtures");
const circle = require("./dan_be_circle_fixture");
const arch = require("./dan_be_arch_fixture");

function standardInput(types, extra) {
  extra = extra || {};
  const dots = [
    { x: 10, y: 10, r: 2.5 }, { x: 320, y: 10, r: 2.5 }, { x: 10, y: 344, r: 2.5 }, { x: 320, y: 344, r: 2.5 },
  ];
  if (extra.midEdgeDots)
    dots.push({ x: 165, y: 10, r: 2.5 }, { x: 165, y: 344, r: 2.5 }, { x: 10, y: 177, r: 2.5 }, { x: 320, y: 177, r: 2.5 });
  const input = {
    sheet: { widthMm: 330, heightMm: 354, dots },
    types: types.map((t) => ({ groups: t.groups, curveErrorMm: t.curveErrorMm || 0 })),
    gapMm: 2, marginMm: 4, ponClearMm: 7.5, resolutionMm: 0.25, budgetMs: 3000,
  };
  for (const key of Object.keys(extra)) if (key !== "midEdgeDots") input[key] = extra[key];
  return input;
}

// Đường viền mèo và thỏ như trong dan_be_irregular.test.js (tự dựng, không phải mẫu khách).
const cat = [[[[0, 18], [5, 0], [16, 9], [29, 9], [41, 0], [46, 18], [40, 28], [36, 32], [39, 43], [32, 55], [26, 55], [25, 42], [20, 42], [19, 55], [12, 55], [7, 43], [10, 32], [6, 28]]]];
const rabbit = [[[[10, 30], [4, 14], [2, 0], [7, 0], [14, 23], [19, 0], [24, 0], [22, 15], [21, 28], [31, 34], [36, 47], [32, 60], [24, 65], [10, 65], [1, 59], [0, 45], [5, 35]]]];

function mixedSets() {
  return [
    { name: "Tròn 25 + tim + sao", types: [{ groups: circle.curveFor(25), curveErrorMm: 0.00025 }, L.heart(), L.star(5, 26, 11)] },
    { name: "Card 92 × 56 + tròn 30", types: [L.rect(92, 56), { groups: circle.curveFor(30), curveErrorMm: 0.00025 }] },
    { name: "Lá + mèo + thỏ", types: [{ groups: F.leaf(), curveErrorMm: 0.001 }, { groups: cat, curveErrorMm: 0 }, { groups: rabbit, curveErrorMm: 0 }] },
    { name: "Vòm + trăng + giọt + xương", types: [{ groups: arch.curveFor(40, 70, 0.00025), curveErrorMm: 0.00025 }, L.crescent(), L.teardrop(), L.bone()] },
  ];
}

module.exports = { standardInput, mixedSets, cat, rabbit };
