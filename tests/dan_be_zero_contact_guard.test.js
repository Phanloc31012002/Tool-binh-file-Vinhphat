const assert = require("node:assert/strict");
const core = require("../DanCardCEP/js/dan_be_nester.js");
const t = core._test;
const step = 0.25;

function cyclic(path, n, reverse) {
  const result = path.slice(n).concat(path.slice(0, n));
  return reverse ? result.reverse() : result;
}
function checked(a, b, x = 0, y = 0, gap = 0, dots = [], tx = 0, ty = 0) {
  const variants = [
    t.buildVariant(a, 0, 0, 0, gap, step),
    t.buildVariant(b, 1, 0, 0, gap, step),
  ];
  return t.verifyGeometry(
    [
      { mi: 0, v: 0, x: tx / step, y: ty / step },
      { mi: 1, v: 1, x: (x + tx) / step, y: (y + ty) / step },
    ],
    variants,
    100 / step,
    100 / step,
    dots,
    gap,
    step,
  );
}

const square = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
];
const elbow = [
  [0, 0],
  [4, 0],
  [4, 1],
  [1, 1],
  [1, 4],
  [0, 4],
];
const pocket = [
  [0, 0],
  [3, 0],
  [3, 3],
  [0, 3],
];
for (let reverse = 0; reverse < 2; reverse++) {
  for (let i = 0; i < elbow.length; i++) {
    for (let j = 0; j < pocket.length; j++) {
      assert.equal(
        checked(
          [[cyclic(elbow, i, reverse)]],
          [[cyclic(pocket, j, !reverse)]],
          1,
          1,
        ),
        true,
        `Shared concave edges must be legal: starts ${i}/${j}, winding ${reverse}`,
      );
    }
  }
  for (let i = 0; i < square.length; i++) {
    for (let j = 0; j < square.length; j++) {
      assert.equal(
        checked(
          [[cyclic(square, i, reverse)]],
          [[cyclic(square, j, !reverse)]],
        ),
        false,
        `Coincident filled squares must overlap: starts ${i}/${j}`,
      );
    }
  }
}

const triangle = [
  [0, 0],
  [6, 0],
  [0, 6],
];
const touchingTriangle = [
  [0, 0],
  [4, 0],
  [4, 4],
];
assert.equal(
  checked([[triangle]], [[touchingTriangle]], 3, 3),
  true,
  "An isolated corner on a diagonal edge is contact, not filled overlap",
);
assert.equal(
  checked([[triangle]], [[touchingTriangle]], 2.99, 2.99),
  false,
  "Small genuine overlap around the former contact must be rejected",
);
assert.equal(
  checked([[square]], [[square]], 4, 0),
  true,
  "Zero gap allows an exact shared straight edge",
);
assert.equal(
  checked([[square]], [[square]], 4, 4),
  true,
  "Zero gap allows exact corner-to-corner contact",
);
assert.equal(
  checked([[square]], [[square]], 4, 0, 1),
  false,
  "Entered positive gap is still mandatory",
);
assert.equal(
  checked([[square]], [[square]], 5, 0, 1),
  true,
  "Exact positive-gap straight-edge separation remains valid",
);

for (const [tx, ty] of [[0.133, 0.277], [71.49, 65.89], [12.123456789, 8.987654321]]) {
  assert.equal(checked([[elbow]], [[pocket]], 1, 1, 0, [], tx, ty), true,
    "Rigid fractional translation must not turn shared concave contact into overlap");
  assert.equal(checked([[square]], [[square]], 3.99, 0, 0, [], tx, ty), false,
    "Fractional translation must not hide a real 0.01 mm filled overlap");
}

const outer = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
const hole = [
  [3, 3],
  [7, 3],
  [7, 7],
  [3, 7],
];
assert.equal(
  checked([[outer, hole]], [[square]], 3, 3),
  true,
  "A cutter fitting an even/odd compound hole may share its boundaries",
);
assert.equal(
  checked([[outer, hole]], [[square]], 3.01, 3),
  false,
  "Moving a cutter from a hole into the filled ring is overlap",
);
assert.equal(
  checked([[outer, hole]], [[outer, hole]]),
  false,
  "Coincident compound rings have filled-area overlap",
);
assert.equal(
  checked([[outer, outer]], [[outer]]),
  true,
  "Cancelled duplicate contours within one even/odd compound are empty",
);
assert.equal(
  checked([[outer], [outer]], [[outer]]),
  false,
  "Separate coincident union groups remain filled, not even/odd cancelled",
);

// Tâm PON nằm trong bất kỳ thành phần nào của phép hợp vẫn bị cấm. Chỗ này dùng chốt chặn
// hình tròn/cạnh tính theo milimét như cũ, không dùng phép dò chồng lấn chỉ xét đường biên.
assert.equal(
  checked([[square]], [[square]], 5, 0, 0, [
    { x: 2 / step, y: 2 / step, radius: 1 / step },
  ]),
  false,
  "PON clearance must not regress while allowing cutter/cutter contact",
);
console.log(
  "PASS boundary-safe zero-contact cutter guard, compounds, unions and positive gaps",
);
