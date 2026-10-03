"use strict";
const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const f = require("./dan_be_fixtures");

function check(name, groups, minimum, overrides) {
  const input = f.input(groups, overrides),
    result = nester.nest(input);
  assert.equal(result.ok, true, name + ": " + result.error);
  assert.ok(result.count >= minimum, name + ": only " + result.count);
  assert.equal(result.count, result.slots.length);
  const step = input.resolutionMm,
    margin = input.marginMm;
  const variants = [];
  input.types.forEach((type, mi) =>
    [0, 90, 180, 270].forEach((angle, vi) =>
      variants.push(
        nester._test.buildVariant(
          type.groups,
          mi,
          vi,
          angle,
          input.gapMm,
          step,
        ),
      ),
    ),
  );
  const plan = result.slots.map((s) => ({
    mi: s.mi,
    v: s.mi * 4 + s.vi,
    x: (s.x - margin) / step,
    y: (s.y - margin) / step,
  }));
  const dots = input.sheet.dots.map((d) => ({
    x: (d.x - margin) / step,
    y: (d.y - margin) / step,
    radius: (d.r + input.ponClearMm) / step,
  }));
  assert.equal(
    nester._test.verifyGeometry(
      plan,
      variants,
      (input.sheet.widthMm - 2 * margin) / step,
      (input.sheet.heightMm - 2 * margin) / step,
      dots,
      input.gapMm,
      step,
    ),
    true,
    name + ": physical gap / PON check",
  );
  console.log(name + ": " + result.count + " dies, physical clearance checked");
  return result;
}

check("5 cm circle, 33 x 35.4 cm, 1 mm gap", f.circle(25), 42);
check("Real spoon outline, 1 mm gap", f.spoon(), 10);
const actualPonSheet = {
  widthMm: 330,
  heightMm: 354,
  dots: [
    { x: 10, y: 10, r: 2.5 },
    { x: 320, y: 10, r: 2.5 },
    { x: 10, y: 344, r: 2.5 },
    { x: 320, y: 344, r: 2.5 },
  ],
};
check("Spoon with actual 5 mm PON dots at 10 mm inset", f.spoon(), 10, {
  sheet: actualPonSheet,
});
check("Circle5 cm with actual PON uses staggered columns", f.circle(25), 42, {
  sheet: actualPonSheet,
});
check(
  "Circle ignores point-conversion numerical dust",
  f.circle(25.000000001),
  42,
  { sheet: actualPonSheet },
);
check("Real leaf outline, 1 mm gap", f.leaf(), 50);
check("Leaf keeps all rotations in a short search slice", f.leaf(), 50, {
  budgetMs: 250,
});
check("Fractional circle gap rounds outward", f.circle(25), 40, { gapMm: 1.1 });

function sameCutterDesigns(groups, count) {
  return Array.from({ length: count }, (_, mi) => ({
    groups: groups.map((group) =>
      group.map((contour) => {
        let points = contour.map((p) => [p[0] + mi * 17, p[1] - mi * 9]);
        if (mi % 2) points.reverse();
        const start = (mi * 7) % points.length;
        return points.slice(start).concat(points.slice(0, start));
      }),
    ),
  }));
}
function balancedDesigns(name, groups, minimum, types) {
  const result = check(name, groups, minimum, {
    types: sameCutterDesigns(groups, types),
  });
  assert.ok(
    Math.max(...result.counts) - Math.min(...result.counts) <= 1,
    name + ": equal alternation",
  );
  result.slots.forEach((slot, i) =>
    assert.equal(slot.mi, i % types, name + ": cyclic artwork slot"),
  );
}
balancedDesigns("3 circle designs sharing one cutter", f.circle(25), 42, 3);
balancedDesigns("2 spoon designs sharing one cutter", f.spoon(), 10, 2);
balancedDesigns("4 leaf designs sharing one cutter", f.leaf(), 50, 4);

const square = [
  [
    [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
    ],
  ],
];
assert.equal(
  nester._test.circleLike(square),
  null,
  "square must not bypass silhouette collision",
);
check("Square uses physical edges", square, 4, {
  sheet: { widthMm: 55, heightMm: 55, dots: [] },
  budgetMs: 1200,
});
const impossible = [
  [
    [
      [0, 0],
      [400, 0],
      [400, 400],
      [0, 400],
    ],
  ],
];
const unfit = nester.nest(
  f.input(square, { types: [{ groups: square }, { groups: impossible }] }),
);
assert.equal(
  unfit.ok,
  false,
  "an unfit type must not silently receive zero copies",
);
assert.match(unfit.error, /loại 2/, "unfit error identifies the cutter");

// Thousands of tiny cutters used to spend 16+ seconds in quadratic final
// checks, despite a 250 ms search slice. Spatial broad-phase retains every
// exact near-pair check while keeping this large deterministic fixture bounded.
const tinyStarted = Date.now();
const tiny = nester.nest(f.input(f.circle(1), { budgetMs: 250 }));
assert.equal(tiny.ok, true, tiny.error);
assert.ok(
  tiny.count >= 10000,
  "tiny cutter fixture must exercise thousands of copies",
);
assert.ok(
  Date.now() - tinyStarted < 8000,
  "tiny cutter safety validation must stay bounded",
);
console.log(
  "Tiny circles: " + tiny.count + " dies, bounded physical verification",
);

// Two L-shaped cutters occupy each other's empty quadrants although their
// bounding rectangles overlap by 18 x 18 mm. A bbox-only packer rejects this.
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
const vs = [0, 90, 180, 270].map((a, i) =>
  nester._test.buildVariant(elbow, 0, i, a, 2, 0.25),
);
const nested = [
  { mi: 0, v: 0, x: 0, y: 0 },
  { mi: 0, v: 2, x: 48, y: 48 },
];
assert.equal(nester._test.verifyPlan(nested, vs, 168, 168, []), true);
assert.equal(
  nester._test.verifyGeometry(nested, vs, 168, 168, [], 2, 0.25),
  true,
);
console.log("Concave L shapes: overlapping bboxes, valid nested outlines");
const squareVariant = nester._test.buildVariant(square, 0, 0, 0, 1, 0.25);
assert.equal(
  nester._test.verifyGeometry(
    [
      { mi: 0, v: 0, x: 0, y: 0 },
      { mi: 0, v: 0, x: 83, y: 0 },
    ],
    [squareVariant],
    220,
    220,
    [],
    1,
    0.25,
  ),
  false,
  "spatial broad-phase cannot miss a 0.75 mm unsafe gap",
);
