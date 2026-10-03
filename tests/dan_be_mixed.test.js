"use strict";
const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const f = require("./dan_be_fixtures");

assert.equal(
  nester._test.balancedPlan([{ mi: 0 }, { mi: 0 }, { mi: 0 }, { mi: 1 }], 2),
  false,
  "a large homogeneous seed must not bypass equal alternation",
);
assert.equal(
  nester._test.balancedPlan([{ mi: 0 }, { mi: 1 }, { mi: 0 }], 2),
  true,
  "the final incomplete cycle may contain one extra copy",
);

function checkMixed(name, groups, sheet, minimum) {
  const input = f.input(groups[0], {
    types: groups.map((g) => ({ groups: g })),
    sheet,
    gapMm: 2,
    budgetMs: 1000,
  });
  const result = nester.nest(input);
  assert.equal(result.ok, true, name + ": " + result.error);
  assert.ok(
    result.count >= minimum,
    name + ": a balanced fallback must remain useful",
  );
  assert.ok(
    Math.max(...result.counts) - Math.min(...result.counts) <= 1,
    name + ": counts must not be skewed by homogeneous seeds",
  );
  const step = input.resolutionMm,
    margin = input.marginMm,
    variants = [];
  input.types.forEach((t, mi) =>
    [0, 90, 180, 270].forEach((a, vi) =>
      variants.push(
        nester._test.buildVariant(t.groups, mi, vi, a, input.gapMm, step),
      ),
    ),
  );
  const plan = result.slots.map((s) => ({
    mi: s.mi,
    v: s.mi * 4 + s.vi,
    x: (s.x - margin) / step,
    y: (s.y - margin) / step,
  }));
  const dots = sheet.dots.map((d) => ({
    x: (d.x - margin) / step,
    y: (d.y - margin) / step,
    radius: (d.r + input.ponClearMm) / step,
  }));
  assert.equal(
    nester._test.verifyGeometry(
      plan,
      variants,
      (sheet.widthMm - 2 * margin) / step,
      (sheet.heightMm - 2 * margin) / step,
      dots,
      input.gapMm,
      step,
    ),
    true,
    name + ": physical contour clearance",
  );
  console.log(
    name +
      ": " +
      result.count +
      " dies, counts [" +
      result.counts +
      "], physical clearance checked",
  );
}

checkMixed(
  "Different circle diameters",
  [f.circle(10), f.circle(25)],
  { widthMm: 110, heightMm: 110, dots: [] },
  2,
);
const elbow = [
  [
    [
      [0, 0],
      [30, 0],
      [30, 10],
      [10, 10],
      [10, 30],
      [0, 30],
    ],
  ],
];
const rectangle = [
  [
    [
      [0, 0],
      [18, 0],
      [18, 12],
      [0, 12],
    ],
  ],
];
checkMixed(
  "Distinct concave and rectangular cutters",
  [elbow, rectangle],
  {
    widthMm: 110,
    heightMm: 110,
    dots: [
      { x: 5, y: 5, r: 1 },
      { x: 105, y: 5, r: 1 },
      { x: 5, y: 105, r: 1 },
      { x: 105, y: 105, r: 1 },
    ],
  },
  10,
);
