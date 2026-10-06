"use strict";
const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const { cap } = require("./dan_be_cap_fixture");
const { circle } = require("./dan_be_fixtures");

function rectangle(w, h) {
  return [
    [
      [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ],
    ],
  ];
}
const elbow = [
  [
    [
      [0, 0],
      [18, 0],
      [18, 6],
      [6, 6],
      [6, 18],
      [0, 18],
    ],
  ],
];
function standardSheet() {
  return {
    widthMm: 330,
    heightMm: 354,
    dots: [
      { x: 10, y: 10, r: 2.5 },
      { x: 320, y: 10, r: 2.5 },
      { x: 10, y: 344, r: 2.5 },
      { x: 320, y: 344, r: 2.5 },
    ],
  };
}
function inputFor(groups, sheet = standardSheet(), gapMm = 1) {
  return {
    sheet,
    types: groups.map((g) => ({ groups: g })),
    gapMm,
    marginMm: 4,
    ponClearMm: 7.5,
    resolutionMm: 0.25,
    budgetMs: 250,
  };
}
function turn(p, angle) {
  if (angle === 90) return [-p[1], p[0]];
  if (angle === 180) return [-p[0], -p[1]];
  if (angle === 270) return [p[1], -p[0]];
  return p.slice();
}
function outline(groups, slot) {
  const rotated = groups.map((g) =>
    g.map((c) => c.map((p) => turn(p, slot.angle))),
  );
  const raw = rotated.flat(2);
  const x0 = Math.min(...raw.map((p) => p[0])),
    y0 = Math.min(...raw.map((p) => p[1]));
  const placed = rotated.map((g) =>
    g.map((c) => c.map((p) => [p[0] - x0 + slot.x, p[1] - y0 + slot.y])),
  );
  const vertices = placed.flat(2),
    edges = [];
  for (const g of placed)
    for (const c of g)
      for (let i = 0; i < c.length; i++)
        edges.push([c[i], c[(i + 1) % c.length]]);
  return {
    groups: placed,
    vertices,
    edges,
    x0: slot.x,
    y0: slot.y,
    x1: Math.max(...vertices.map((p) => p[0])),
    y1: Math.max(...vertices.map((p) => p[1])),
  };
}
function pointIn(p, groups) {
  return groups.some((group) => {
    let inside = false;
    for (const c of group)
      for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
        const a = c[i],
          b = c[j];
        if (
          a[1] > p[1] !== b[1] > p[1] &&
          p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
        )
          inside = !inside;
      }
    return inside;
  });
}
function pointSegment(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = dx * dx + dy * dy;
  const t = len
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len))
    : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function segmentDistance(a, b, c, d) {
  const ac = cross(a, b, c),
    ad = cross(a, b, d),
    ca = cross(c, d, a),
    cb = cross(c, d, b);
  if (
    ((ac <= 0 && ad >= 0) || (ac >= 0 && ad <= 0)) &&
    ((ca <= 0 && cb >= 0) || (ca >= 0 && cb <= 0)) &&
    Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
      Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
    Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
      Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))
  )
    return 0;
  return Math.min(
    pointSegment(a, c, d),
    pointSegment(b, c, d),
    pointSegment(c, a, b),
    pointSegment(d, a, b),
  );
}
// Các phép kiểm tra vật lý liên tục, cố ý độc lập với các chốt chặn raster/hình học
// của code thật. Gồm: nằm lọt trong hình đặc, khoảng cách giữa các đoạn thẳng,
// khoảng hở vật lý tới mép PON và khổ giấy chính xác (không làm tròn xuống).
function physicalGuard(input, slots) {
  const shapes = slots.map((s) => outline(input.types[s.mi].groups, s)),
    tolerance = 0.001;
  for (const a of shapes) {
    assert.ok(
      a.x0 >= input.marginMm - tolerance &&
        a.y0 >= input.marginMm - tolerance &&
        a.x1 <= input.sheet.widthMm - input.marginMm + tolerance &&
        a.y1 <= input.sheet.heightMm - input.marginMm + tolerance,
      "physical sheet margin",
    );
    for (const dot of input.sheet.dots) {
      const p = [dot.x, dot.y];
      assert.equal(pointIn(p, a.groups), false, "PON not enclosed by a cutter");
      const distance = Math.min(
        ...a.edges.map((e) => pointSegment(p, e[0], e[1])),
      );
      assert.ok(
        distance + tolerance >= dot.r + input.ponClearMm,
        "distance from physical PON edge",
      );
    }
  }
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i],
        b = shapes[j];
      if (
        Math.hypot(
          Math.max(a.x0 - b.x1, b.x0 - a.x1, 0),
          Math.max(a.y0 - b.y1, b.y0 - a.y1, 0),
        ) >= input.gapMm
      )
        continue;
      for (const p of a.vertices)
        assert.equal(
          pointIn(p, b.groups),
          false,
          "filled outlines must not overlap",
        );
      for (const p of b.vertices)
        assert.equal(pointIn(p, a.groups), false, "no filled containment");
      let distance = Infinity;
      for (const ea of a.edges)
        for (const eb of b.edges)
          distance = Math.min(
            distance,
            segmentDistance(ea[0], ea[1], eb[0], eb[1]),
          );
      assert.ok(
        distance + tolerance >= input.gapMm,
        "physical cutter-to-cutter clearance",
      );
    }
  return shapes;
}
function blockBounds(shapes) {
  return {
    x0: Math.min(...shapes.map((a) => a.x0)),
    y0: Math.min(...shapes.map((a) => a.y0)),
    x1: Math.max(...shapes.map((a) => a.x1)),
    y1: Math.max(...shapes.map((a) => a.y1)),
  };
}
function centreError(input, slots) {
  const b = blockBounds(slots.map((s) => outline(input.types[s.mi].groups, s)));
  return [
    (b.x0 + b.x1 - input.sheet.widthMm) / 2,
    (b.y0 + b.y1 - input.sheet.heightMm) / 2,
  ];
}
function exactPublicCentre(input, count, label, allowPonFallback = false) {
  const result = nester.nest(input);
  assert.equal(result.ok, true, `${label}: ${result.error}`);
  assert.equal(
    result.count,
    count,
    `${label}: centering cannot discard or add copies`,
  );
  assert.equal(result.slots.length, count);
  physicalGuard(input, result.slots);
  const error = centreError(input, result.slots);
  assert.ok(
    result.centering && typeof result.centering.exact === "boolean",
    "public result reports verified centering status",
  );
  assert.ok(
    Math.abs(result.centering.offsetXmm - error[0]) < 1e-8 &&
      Math.abs(result.centering.offsetYmm - error[1]) < 1e-8,
    "reported physical centre offsets agree with independently reconstructed contours",
  );
  if (Math.abs(error[0]) >= 0.001 || Math.abs(error[1]) >= 0.001) {
    assert.equal(
      allowPonFallback,
      true,
      `${label}: unexpected residual ${error} mm`,
    );
    const exactTrial = result.slots.map((s) => ({
      ...s,
      x: s.x - error[0],
      y: s.y - error[1],
    }));
    assert.throws(
      () => physicalGuard(input, exactTrial),
      /physical PON edge|PON not enclosed by a cutter/,
      "nonzero residual is allowed only when independent geometry proves the exact centre collides with PON",
    );
    assert.ok(
      Math.min(Math.abs(error[0]), Math.abs(error[1])) < 0.001,
      "PON-constrained centering still centres an unobstructed axis exactly",
    );
    assert.equal(
      result.centering.exact,
      false,
      "blocked exact centre is not falsely reported as exact",
    );
    assert.match(
      result.detail,
      /Canh tâm bị giới hạn bởi vùng né PON\./,
      "public detail explains the physical PON-constrained fallback",
    );
  } else {
    assert.equal(
      result.centering.exact,
      true,
      "feasible exact centre is reported accurately",
    );
    assert.doesNotMatch(result.detail, /Canh tâm bị giới hạn bởi vùng né PON/);
  }
  console.log(
    `${label}: ${count} copies, physical centre residual [${error}] mm`,
  );
  return result;
}
function variantsFor(input) {
  const variants = [];
  input.types.forEach((t, mi) =>
    [0, 90, 180, 270].forEach((angle, vi) =>
      variants.push(
        nester._test.buildVariant(
          t.groups,
          mi,
          vi,
          angle,
          input.gapMm,
          input.resolutionMm,
        ),
      ),
    ),
  );
  return variants;
}
function slotPlan(input, variants, plan) {
  return plan.map((s) => ({
    mi: s.mi,
    vi: variants[s.v].vi,
    angle: variants[s.v].angle,
    x: input.marginMm + s.x * input.resolutionMm,
    y: input.marginMm + s.y * input.resolutionMm,
  }));
}
function centredHelper(input, variants, plan) {
  const margin = input.marginMm,
    step = input.resolutionMm;
  const dots = input.sheet.dots.map((d) => ({
    x: (d.x - margin) / step,
    y: (d.y - margin) / step,
    radius: (d.r + input.ponClearMm) / step,
  }));
  const before = plan.map((s) => ({ ...s }));
  const result = nester._test.centrePhysicalPlan(
    plan,
    variants,
    (input.sheet.widthMm - 2 * margin) / step,
    (input.sheet.heightMm - 2 * margin) / step,
    dots,
    input.gapMm,
    step,
  );
  assert.equal(result.length, before.length, "helper preserves copy count");
  const dx = result[0].x - before[0].x,
    dy = result[0].y - before[0].y;
  result.forEach((s, i) => {
    assert.equal(s.mi, before[i].mi, "artwork identity is unchanged");
    assert.equal(s.v, before[i].v, "orientation is unchanged");
    assert.ok(
      Math.abs(s.x - before[i].x - dx) < 1e-8 &&
        Math.abs(s.y - before[i].y - dy) < 1e-8,
      "every cutter receives one common translation, with no resize or rearrangement",
    );
  });
  physicalGuard(input, slotPlan(input, variants, result));
  return result;
}

const began = Date.now();
exactPublicCentre(inputFor([cap()]), 94, "Actual curved cap, 1 mm gap");
exactPublicCentre(
  inputFor([cap()], standardSheet(), 2),
  86,
  "Actual curved cap, 2 mm gap",
  true,
);
exactPublicCentre(inputFor([circle(25)]), 42, "50 mm circles", true);
const unobstructedCircle = inputFor([circle(25)]);
unobstructedCircle.sheet.dots = [];
exactPublicCentre(unobstructedCircle, 42, "50 mm circles, no PON obstruction");
exactPublicCentre(
  inputFor([rectangle(17.4, 12.6)], {
    widthMm: 100.13,
    heightMm: 86.37,
    dots: [],
  }),
  24,
  "Fractional die and paper dimensions",
);
const mixed = exactPublicCentre(
  inputFor([elbow, rectangle(11.13, 7.39)], {
    widthMm: 94.17,
    heightMm: 91.31,
    dots: [],
  }),
  24,
  "Distinct irregular/rectangle types, no PON obstruction",
);
assert.deepEqual(
  mixed.counts,
  [12, 12],
  "mixed counts remain balanced after centering",
);

// Dữ liệu mẫu trực tiếp giữ nguyên danh tính/góc xoay và chứng minh việc canh giữa theo số lẻ
// dùng kích thước vật lý thật thay vì khung bao theo ô raster nguyên.
const directInput = inputFor([rectangle(17.4, 12.6), elbow], {
  widthMm: 100.13,
  heightMm: 86.37,
  dots: [],
});
const directVariants = variantsFor(directInput);
const direct = [
  { mi: 0, v: 0, x: 12, y: 16 },
  { mi: 1, v: 5, x: 124, y: 20 },
  { mi: 0, v: 2, x: 20, y: 140 },
];
physicalGuard(directInput, slotPlan(directInput, directVariants, direct));
const directCentred = centredHelper(directInput, directVariants, direct);
const directError = centreError(
  directInput,
  slotPlan(directInput, directVariants, directCentred),
);
assert.ok(
  Math.abs(directError[0]) < 0.001 && Math.abs(directError[1]) < 0.001,
  "fractional translation centres the actual block on both axes",
);

// Một PON vật lý ở giữa chặn phương án thử canh giữa hoàn toàn, nhưng hai phương án thử
// canh giữa theo một trục thì đều an toàn. Hàm phụ không được ép va chạm hay bỏ
// mất khuôn bế chỉ để báo được một tâm hoàn hảo.
const blockedInput = {
  sheet: { widthMm: 100, heightMm: 80, dots: [{ x: 50, y: 40, r: 5 }] },
  types: [{ groups: rectangle(10, 10) }],
  marginMm: 0,
  gapMm: 1,
  ponClearMm: 2,
  resolutionMm: 0.25,
};
const blockedVariants = variantsFor(blockedInput);
const blocked = [{ mi: 0, v: 0, x: 40, y: 40 }];
physicalGuard(blockedInput, slotPlan(blockedInput, blockedVariants, blocked));
assert.throws(
  () => physicalGuard(blockedInput, [{ mi: 0, vi: 0, angle: 0, x: 45, y: 35 }]),
  "an independent guard must reject the fully centred PON collision",
);
const beforeError = centreError(
  blockedInput,
  slotPlan(blockedInput, blockedVariants, blocked),
);
const constrained = centredHelper(blockedInput, blockedVariants, blocked);
const afterError = centreError(
  blockedInput,
  slotPlan(blockedInput, blockedVariants, constrained),
);
assert.ok(
  Math.hypot(...afterError) < Math.hypot(...beforeError),
  "verified constrained fallback improves centering without losing copies",
);
assert.ok(
  Math.min(Math.abs(afterError[0]), Math.abs(afterError[1])) < 0.001,
  "an unobstructed axis remains exactly centred when the other axis is blocked",
);
assert.ok(
  Math.max(Math.abs(afterError[0]), Math.abs(afterError[1])) > 0.001,
  "a PON-obstructed trial cannot pretend to be fully centred",
);
console.log(
  `PON-obstructed centering: retained cutter, safe constrained residual [${afterError}] mm`,
);

// Phương án thử ban đầu canh giữa hoàn hảo nhưng không an toàn. Độ lệch dư bằng 0 của nó
// không được xếp trên một phương án an toàn gần đó chỉ vì nó là điểm khởi đầu.
const unsafeInput = {
  sheet: { widthMm: 100, heightMm: 80, dots: [{ x: 57, y: 47, r: 3 }] },
  types: [{ groups: rectangle(10, 10) }],
  marginMm: 0,
  gapMm: 1,
  ponClearMm: 0,
  resolutionMm: 0.25,
};
const unsafeVariants = variantsFor(unsafeInput);
const unsafeOriginal = [{ mi: 0, v: 0, x: 180, y: 140 }];
assert.deepEqual(
  centreError(
    unsafeInput,
    slotPlan(unsafeInput, unsafeVariants, unsafeOriginal),
  ),
  [0, 0],
);
assert.throws(
  () =>
    physicalGuard(
      unsafeInput,
      slotPlan(unsafeInput, unsafeVariants, unsafeOriginal),
    ),
  /physical PON edge/,
  "unsafe zero-residual original cannot become a verified fallback",
);
const recovered = centredHelper(unsafeInput, unsafeVariants, unsafeOriginal);
const recoveredError = centreError(
  unsafeInput,
  slotPlan(unsafeInput, unsafeVariants, recovered),
);
assert.ok(
  Math.hypot(...recoveredError) > 0.001 && Math.hypot(...recoveredError) < 0.5,
  "nearby safe candidate is retained despite having a larger residual than the unsafe original",
);
console.log(
  `Unsafe centred seed: preserved cutter and recovered a safe offset [${recoveredError}] mm`,
);
assert.ok(
  Date.now() - began < 12000,
  "physical centering regression suite remains bounded",
);
