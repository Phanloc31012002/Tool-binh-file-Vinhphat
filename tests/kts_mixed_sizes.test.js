const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const illustrator = require("./illustrator_geometry_mock");
const library = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const panel = fs.readFileSync(require.resolve("../DanCardCEP/index.html"), "utf8");
const mixedCheckbox = panel.indexOf('id="autoSheetMultiPerArtboard"');
assert(mixedCheckbox >= 0);
const mixedGuidance = panel.slice(mixedCheckbox, panel.indexOf('id="btnDanToiUu"', mixedCheckbox));
assert.match(mixedGuidance,
  /<strong>\s*Tự nhân bản tối đa con lớn trước, rồi nhân bản con nhỏ lấp phần còn lại\.\s*<\/strong>/,
  "Mixed-size KTS must show the exact bold automatic-largest-first guidance below its checkbox");
const MM = 2.834645669;
const EPS = 0.001;
const pure = vm.createContext({});
vm.runInContext(library, pure);
function noOverlap(rectangles) {
  for (let i = 0; i < rectangles.length; i++)
    for (let j = 0; j < i; j++) {
      const a = rectangles[i],
        b = rectangles[j];
      assert(
        a[2] <= b[0] + EPS ||
          b[2] <= a[0] + EPS ||
          a[3] >= b[1] - EPS ||
          b[3] >= a[1] - EPS,
        `Overlap: ${a} and ${b}`,
      );
    }
}
function auditKnife(plan, w, h) {
  const pieces = [{ x: 0, y: 0, w, h }];
  let length = 0;
  for (const cut of plan.cuts) {
    const same = (r) => ["x", "y", "w", "h"].every(k => Math.abs(r[k] - cut[k]) < EPS);
    const index = pieces.findIndex(same);
    assert(index >= 0, "Knife cut must act on a piece already separated by previous cuts");
    const region = pieces.splice(index, 1)[0];
    const vertical = cut.axis === "V", start = vertical ? region.x : region.y;
    const size = vertical ? region.w : region.h;
    assert(cut.at > start + EPS && cut.at < start + size - EPS);
    for (const s of plan.slots) {
      if (s.x >= region.x + region.w - EPS || s.x + s.w <= region.x + EPS ||
          s.y >= region.y + region.h - EPS || s.y + s.h <= region.y + EPS) continue;
      const lo = vertical ? s.x : s.y, hi = lo + (vertical ? s.w : s.h);
      assert(hi <= cut.at + EPS || lo >= cut.at - EPS, "Industrial knife crosses artwork");
    }
    pieces.push(vertical ? { ...region, w: cut.at - region.x } : { ...region, h: cut.at - region.y });
    pieces.push(vertical ? { ...region, x: cut.at, w: region.x + region.w - cut.at } :
      { ...region, y: cut.at, h: region.y + region.h - cut.at });
    length += vertical ? region.h : region.w;
  }
  assert.strictEqual(plan.cutCount, plan.cuts.length);
  assert(plan.workCount >= 0 && plan.workCount <= plan.cutCount);
  assert(Math.abs(length - plan.cutLength) < EPS);
  for (const s of plan.slots) assert(pieces.some(r =>
    ["x", "y", "w", "h"].every(k => Math.abs(r[k] - s[k]) < EPS)),
    "Every finished copy must be extractable as its own piece");
}
function auditPlan(specs, w, h, allowUnplaced = false) {
  const before = JSON.stringify(specs);
  const plan = pure.dcKtsMixedSizePlan(specs, w, h);
  assert.strictEqual(JSON.stringify(specs), before);
  assert.strictEqual(plan.counts.length, specs.length);
  assert(plan.counts.every(count => Number.isInteger(count) && count >= 0));
  if (!allowUnplaced) assert(plan.counts.every(count => count >= 1),
    "Every source must be represented when all prepared designs fit");
  assert.strictEqual(plan.minimum, Math.min(...plan.counts));
  assert.strictEqual(plan.count, plan.slots.length);
  assert(plan.count <= 128, "Mixed search must not overrun its explicit knife-verification cap");
  if (plan.capacityLimited) assert.strictEqual(plan.count, 128);
  const counts = specs.map(() => 0);
  for (const s of plan.slots) {
    assert(
      s.x >= -EPS &&
        s.y >= -EPS &&
        s.x + s.w <= w + EPS &&
        s.y + s.h <= h + EPS,
    );
    const spec = specs[s.modelIndex];
    counts[s.modelIndex]++;
    assert(s.angle === 0 || s.angle === 90);
    assert(Math.abs(s.w - (s.angle ? spec.h : spec.w)) < EPS);
    assert(Math.abs(s.h - (s.angle ? spec.w : spec.h)) < EPS);
  }
  assert.deepStrictEqual(Array.from(plan.counts), counts);
  noOverlap(Array.from(plan.slots, (s) => [s.x, -s.y, s.x + s.w, -s.y - s.h]));
  auditKnife(plan, w, h);
  // Độc lập với các hình chữ nhật trống của bộ giải: sau khi lấp lỗ, không nguồn nào
  // còn đặt thêm được tại một mép phải/dưới sẵn có, dù theo hướng nào.
  const xs = [0, ...Array.from(plan.slots, s => s.x + s.w)];
  const ys = [0, ...Array.from(plan.slots, s => s.y + s.h)];
  for (const [modelIndex, spec] of specs.entries()) for (const rotated of [false, true]) {
    // Phương án 129 con vượt quá giới hạn của bộ kiểm tra đường dao: null khi đó không
    // chứng minh được là đã kín chỗ. Kế hoạch phải nói rõ lần dừng do giới hạn tìm kiếm này.
    if (plan.capacityLimited) continue;
    const sw = rotated ? spec.h : spec.w, sh = rotated ? spec.w : spec.h;
    for (const x of xs) for (const y of ys) {
      if (x + sw > w + EPS || y + sh > h + EPS) continue;
      const overlaps = plan.slots.some(s => x < s.x + s.w - EPS && x + sw > s.x + EPS &&
        y < s.y + s.h - EPS && y + sh > s.y + EPS);
      if (!overlaps) assert.strictEqual(pure.dcKtsKnifePlan(plan.slots.concat([
        { x, y, w: sw, h: sh, angle: rotated ? 90 : 0, modelIndex }
      ]), w, h), null, `An additional ${sw} x ${sh} still fits with a knife route at ${x}, ${y}`);
    }
  }
  assert.strictEqual(
    JSON.stringify(pure.dcKtsMixedSizePlan(specs, w, h)),
    JSON.stringify(plan),
  );
  return plan;
}
// Một hình vuông lớn và một hình chữ nhật nhỏ hơn đặt vừa cạnh nhau; nếu ép
// mọi mẫu vào bounding box lớn nhất thì sẽ mất các vị trí nhỏ hơn.
const holePlan = auditPlan(
  [
    { w: 60, h: 60 },
    { w: 40, h: 60 },
  ],
  100,
  120,
);
assert.deepStrictEqual(Array.from(holePlan.counts), [2, 2]);
// Hồi quy do người dùng báo: mẫu lại được phép lặp lại. Trước hết dàn tối đa
// cỡ lớn lên tám con, sau đó lấp vùng còn lại bằng các con nhỏ.
const sixLargeOneSmall = Array.from({ length: 6 }, () => ({ w: 152, h: 72 }))
  .concat([{ w: 92, h: 56 }]);
const userPlan = auditPlan(sixLargeOneSmall, 324, 348);
assert.deepStrictEqual(Array.from(userPlan.counts), [2, 2, 1, 1, 1, 1, 3]);
assert.strictEqual(userPlan.count, 11);

// Năm mẫu 18.4 x 5.6 cm khác nhau phải được chia xoay vòng
// cho tám vị trí lớn, trước khi lặp lại mẫu lấp chỗ 9.2 x 5.6 cm.
const fiveLargeOneSmall = Array.from({ length: 5 }, () => ({ w: 184, h: 56 }))
  .concat([{ w: 92, h: 56 }]);
const latestUserPlan = auditPlan(fiveLargeOneSmall, 324, 348);
assert.deepStrictEqual(Array.from(latestUserPlan.counts), [2, 2, 2, 1, 1, 3]);
assert.strictEqual(latestUserPlan.count, 11);
const sixLongOneSmall = Array.from({ length: 6 }, () => ({ w: 184, h: 56 }))
  .concat([{ w: 92, h: 56 }]);
const sixLongPlan = auditPlan(sixLongOneSmall, 324, 348);
assert.deepStrictEqual(Array.from(sixLongPlan.counts), [2, 2, 1, 1, 1, 1, 3]);
assert.strictEqual(sixLongPlan.count, 11);

const oneLargeOneSmall = [{ w: 152, h: 72 }, { w: 92, h: 56 }];
const repeatPlan = auditPlan(oneLargeOneSmall, 324, 348);
assert.deepStrictEqual(Array.from(repeatPlan.counts), [8, 3],
  "A single large template must repeat to the same maximum as six large templates");
assert.strictEqual(repeatPlan.count, 11);

// Ưu tiên cỡ lớn nhất trước mạnh hơn việc tối đa hoá tổng số con hay buộc mọi
// cỡ đã chọn đều phải xuất hiện. Ba con 60 x 100 đạt cận trên về diện tích;
// dải 20 mm còn dư không nhận được con cỡ vừa nhưng chứa được năm con nhỏ.
const threeSizeSpecs = [{ w: 60, h: 100 }, { w: 40, h: 60 }, { w: 20, h: 20 }];
const threeSizePlan = auditPlan(threeSizeSpecs, 200, 100, true);
assert.deepStrictEqual(Array.from(threeSizePlan.counts), [3, 0, 5]);
// Thứ tự ưu tiên áp dụng tiếp cho các cỡ trung gian, không chỉ riêng cỡ lớn nhất.
// Một con lớn nhất để lại vùng 100 x 60: hai con cỡ vừa xoay cùng ba ô vuông nhỏ
// được xếp trên một con cỡ vừa kèm thêm nhiều ô vuông nhỏ, dù phương án sau có tổng số cao hơn.
const threeTierSpecs = [{ w: 100, h: 80 }, { w: 60, h: 40 }, { w: 20, h: 20 }];
const threeTierPlan = auditPlan(threeTierSpecs, 100, 140);
assert.deepStrictEqual(Array.from(threeTierPlan.counts), [1, 2, 3]);
const overflowSpecs = Array.from({ length: 9 }, () => ({ w: 184, h: 56 }))
  .concat([{ w: 92, h: 56 }]);
const overflowPlan = auditPlan(overflowSpecs, 324, 348, true);
assert.strictEqual(overflowPlan.counts.slice(0, 9).reduce((sum, count) => sum + count, 0), 8,
  "Overflow must fit the maximum large count before adding small copies");
assert.strictEqual(overflowPlan.counts.slice(0, 9).filter(count => count === 0).length, 1);
assert.strictEqual(overflowPlan.counts[9], 3);
assert.strictEqual(overflowPlan.count, 11);
const overflow152Specs = Array.from({ length: 9 }, () => ({ w: 152, h: 72 }))
  .concat([{ w: 92, h: 56 }]);
const overflow152Plan = auditPlan(overflow152Specs, 324, 348, true);
assert.strictEqual(overflow152Plan.counts.slice(0, 9).reduce((sum, count) => sum + count, 0), 8);
assert.strictEqual(overflow152Plan.counts.slice(0, 9).filter(count => count === 0).length, 1);
assert.strictEqual(overflow152Plan.counts[9], 3);
assert.strictEqual(overflow152Plan.count, 11);
const oversizedSpecs = [{ w: 400, h: 400 }, { w: 92, h: 56 }];
const oversizedPlan = auditPlan(oversizedSpecs, 324, 348, true);
assert.strictEqual(oversizedPlan.counts[0], 0);
assert(oversizedPlan.counts[1] >= 1);
assert(oversizedPlan.slots.every(s => s.modelIndex === 1),
  "An individually oversized source must be retained, never resized to force it onto the paper");
const capacitySpecs = [{ w: 200, h: 200 }, { w: 5, h: 5 }];
const capacityPlan = auditPlan(capacitySpecs, 324, 348);
assert.deepStrictEqual(Array.from(capacityPlan.counts), [1, 127]);
assert.strictEqual(capacityPlan.count, 128);
assert.strictEqual(capacityPlan.capacityLimited, true,
  "Search must explicitly disclose remaining holes at its 128-copy cap");

// Nguồn khổ dọc vẫn là cùng một con nhỏ ngoài thực tế, không phải một ràng buộc
// xếp mới: cho phép xoay 0/90 mà không đổi kích thước hay đổi danh tính của nó.
const userCases = [
  [sixLargeOneSmall, userPlan, 3],
  [fiveLargeOneSmall, latestUserPlan, 3],
  [sixLongOneSmall, sixLongPlan, 3],
  [oneLargeOneSmall, repeatPlan, 3]
];
const portraitCases = userCases.map(([specs, , requiredSmall]) => {
  const portraitSpecs = specs.map((s, i) => i === specs.length - 1 ?
    { w: 56, h: 92 } : { ...s });
  const plan = auditPlan(portraitSpecs, 324, 348);
  assert(plan.counts[specs.length - 1] >= requiredSmall,
    `Portrait small source lost valid copies: ${plan.counts}`);
  return [portraitSpecs, plan, requiredSmall];
});

// Test hồi quy về công cắt độc lập với bộ giải tối đa số lượng. Khi
// cho sẵn tám con lớn và ba con nhỏ, gom lại nguyên từng dải sao cho mọi
// hàng lớn đứng trước hàng nhỏ, giữ nguyên ưu tiên tám con lớn trước.
const groupedSlots = Array.from({ length: 8 }, (_, i) => ({
  x: (i % 2) * 152, y: Math.floor(i / 2) * 72,
  w: 152, h: 72, angle: 0, modelIndex: i % 6
})).concat(Array.from({ length: 3 }, (_, i) => ({
  x: i * 92, y: 288, w: 92, h: 56, angle: 0, modelIndex: 6
})));
const groupedKnife = pure.dcKtsKnifePlan(groupedSlots, 324, 348);
assert(groupedKnife);
assert.strictEqual(groupedKnife.cutCount, 13,
  "Aligned strips must avoid the old 16-cut extraction order");
auditKnife({ ...groupedKnife, slots: groupedSlots }, 324, 348);
const bigRows = groupedSlots.filter(s => s.modelIndex < 6);
const smallRow = groupedSlots.filter(s => s.modelIndex === 6);
assert.strictEqual(bigRows.length, 8);
assert.strictEqual(smallRow.length, 3);
assert(Math.max(...bigRows.map(s => s.y + s.h)) <= Math.min(...smallRow.map(s => s.y)) + EPS,
  "All eight large copies must form one upper block, not straddle the small row");
const oldInterleaved = groupedSlots.map(s => ({...s,
  y: s.modelIndex === 6 ? 216 : s.y === 216 ? 272 : s.y
}));
const interleavedKnife = pure.dcKtsKnifePlan(oldInterleaved, 324, 348);
assert(interleavedKnife);
auditKnife({ ...interleavedKnife, slots: oldInterleaved }, 324, 348);
assert(groupedKnife.workCount < interleavedKnife.workCount,
  "Grouping the large rows must reduce actual stacked-knife sequences, not merely line length");
const regroupedVariants = Array.from(pure.dcKtsKnifeBandVariants(oldInterleaved));
assert(regroupedVariants.length > 0);
const identitySizes = slots => Array.from(slots, s =>
  [s.modelIndex, s.w, s.h, s.angle].join(",")).sort();
const variantKnives = regroupedVariants.map(slots => {
  assert.deepStrictEqual(identitySizes(slots), identitySizes(groupedSlots),
    "Band regrouping must preserve every design identity, orientation, and dimension");
  noOverlap(Array.from(slots, s => [s.x, -s.y, s.x + s.w, -s.y - s.h]));
  const knife = pure.dcKtsKnifePlan(slots, 324, 348);
  assert(knife);
  auditKnife({ ...knife, slots }, 324, 348);
  return knife;
});
assert(variantKnives.some(knife => knife.workCount <= groupedKnife.workCount),
  "Whole-band regrouping must recover the low-effort upper-large/lower-small arrangement");
const grid = [{ x: 0, y: 0, w: 50, h: 50 }, { x: 50, y: 0, w: 50, h: 50 },
  { x: 0, y: 50, w: 50, h: 50 }, { x: 50, y: 50, w: 50, h: 50 }];
const gridCuts = pure.dcKtsKnifePlan(grid, 100, 100);
assert.strictEqual(gridCuts.cutCount, 3);
assert.strictEqual(gridCuts.workCount, 2, "Two identical strips can be stacked for the second cut");
auditKnife({ ...gridCuts, slots: grid }, 100, 100);
// Kiểu xếp chong chóng lấp kín giấy hoàn hảo nhưng không có nhát cắt thẳng đầu tiên nào.
assert.strictEqual(pure.dcKtsKnifePlan([
  { x: 0, y: 0, w: 4, h: 2 }, { x: 4, y: 0, w: 2, h: 4 },
  { x: 2, y: 4, w: 4, h: 2 }, { x: 0, y: 2, w: 2, h: 4 },
  { x: 2, y: 2, w: 2, h: 2 }
], 6, 6), null, "No interlocking pinwheel may be accepted for industrial cutting");
for (const specs of [
  [
    { w: 90, h: 50 },
    { w: 60, h: 40 },
  ],
  [
    { w: 120, h: 75 },
    { w: 85, h: 45 },
    { w: 60, h: 60 },
  ],
  [
    { w: 80, h: 30 },
    { w: 47, h: 50 },
    { w: 85, h: 90 },
    { w: 39, h: 60 },
    { w: 70, h: 55 },
  ],
  [
    { w: 80, h: 200 },
    { w: 90, h: 200 },
  ],
])
  auditPlan(specs, 324, 348, true);
assert.throws(() => pure.dcKtsMixedSizePlan([{ w: 1, h: 1 }], Infinity, 100));
assert.throws(
  () => pure.dcKtsMixedSizePlan([{ w: 400, h: 400 }], 324, 348),
  /không vừa/,
);
const sameSizeOverflow = auditPlan([
  { w: 60, h: 60 }, { w: 60, h: 60 }
], 100, 100, true);
assert.strictEqual(sameSizeOverflow.count, 1);
assert.deepStrictEqual(Array.from(sameSizeOverflow.counts).sort(), [0, 1]);
assert.throws(
  () => pure.dcKtsMixedSizePlan([{ w: 0.1, h: 0.1 }], 324, 348),
  /Quá nhiều/,
);

function setup(specs, twoSided, backDust = 0, options = {}) {
  const mock = illustrator(options),
    c = vm.createContext(mock.context);
  vm.runInContext(library, c);
  let top = 1000;
  const backLeft = Math.max(500, Math.max(...specs.map(s => s[0])) * MM + 50);
  for (let m = 0; m < specs.length; m++) {
    const [w, h] = specs[m].map((v) => v * MM);
    mock.source([0, top, w, top - h], "F" + m);
    if (twoSided)
      mock.source(
        [
          backLeft,
          top + (m % 2 ? 0.02 : -0.02),
          backLeft + w + backDust,
          top - h + (m % 2 ? 0.02 : -0.02) - backDust,
        ],
        "B" + m,
      );
    top -= Math.max(h, 200) + 100;
  }
  // Phần theo dõi việc xoá chỉ dành cho nguồn nằm trong dữ liệu mẫu này, không nằm trong
  // bản giả lập hình học dùng chung. Giữ tham chiếu tới bản gốc để kiểm tra các item bị bỏ ra.
  for (const original of mock.originals) {
    original.removeCalls = 0;
    original.removed = false;
    original.remove = function () {
      this.removeCalls++;
      assert(!this.removed, "A repeated template must be removed only once");
      this.removed = true;
      this.removedAfterDuplicates = mock.duplicates.length;
      const index = this.parent.pageItems.indexOf(this);
      assert(index >= 0);
      this.parent.pageItems.splice(index, 1);
    };
  }
  mock.doc.selection = mock.originals.slice().reverse();
  return { mock, c };
}
function auditSourceCleanup(mock, counts, before) {
  for (const [i, original] of mock.originals.entries()) {
    const used = counts[+original.identity.slice(1)] > 0;
    assert.strictEqual(original.removeCalls, used ? 1 : 0,
      `Only successfully placed source/pair may be deleted: ${original.identity}`);
    assert.strictEqual(original.removed, used);
    assert.strictEqual(mock.sourceLayer.pageItems.includes(original), !used);
    if (used) assert.strictEqual(original.removedAfterDuplicates, mock.duplicates.length,
      "Source cleanup must wait until both fronts and backs render successfully");
    else {
      assert.deepStrictEqual(original.geometricBounds, before[i],
        "An unplaced source must stay at its original position and size");
      assert.strictEqual(original.angle, 0);
      assert(!original.reflected);
    }
  }
}
for (const [modelSpecs, expectedPlan] of userCases.concat(portraitCases,
  [[overflowSpecs, overflowPlan], [overflow152Specs, overflow152Plan],
    [oversizedSpecs, oversizedPlan], [capacitySpecs, capacityPlan]]))
for (const twoSided of [false, true]) {
  const specs = modelSpecs.map(s => [s.w, s.h]);
  const { mock, c } = setup(specs, twoSided);
  const source = mock.originals.map(i => i.geometricBounds);
  const result = c.dcDanToiUu("33", "35.4", twoSided, true);
  assert.match(result, /^OK:/);
  if (expectedPlan.capacityLimited) assert.match(result,
    /Đã đạt giới hạn 128 con\/tờ của tìm kiếm ghép; chưa lấp hết phần dư\./,
    "Renderer must warn rather than call its 128-copy search cap a fully filled result");
  const fronts = mock.duplicates.filter(i => i.layer.name ===
    (twoSided ? "Dan toi uu - Mat truoc" : "Dan toi uu"));
  const counts = specs.map(() => 0);
  fronts.forEach(i => counts[+i.identity.slice(1)]++);
  assert.deepStrictEqual(counts, Array.from(expectedPlan.counts));
  assert.strictEqual(fronts.length, expectedPlan.count);
  assert.strictEqual(mock.doc.artboards.length, twoSided ? 2 : 1);
  noOverlap(fronts.map(i => i.visibleBounds));
  const fr = mock.doc.artboards[0].artboardRect;
  fronts.forEach(f => {
    const fb = f.visibleBounds, spec = specs[+f.identity.slice(1)];
    assert(f.angle === 0 || f.angle === 90);
    assert(!f.reflected);
    assert(Math.abs(fb[2] - fb[0] - (f.angle ? spec[1] : spec[0]) * MM) < EPS);
    assert(Math.abs(fb[1] - fb[3] - (f.angle ? spec[0] : spec[1]) * MM) < EPS);
    assert(fb[0] >= fr[0] + 3 * MM - EPS && fb[2] <= fr[2] - 3 * MM + EPS &&
      fb[1] <= fr[1] - 3 * MM + EPS && fb[3] >= fr[3] + 3 * MM - EPS);
  });
  auditSourceCleanup(mock, counts, source);
  if (twoSided) {
    const backs = mock.duplicates.filter(i => i.layer.name === "Dan toi uu - Mat sau");
    assert.strictEqual(backs.length, fronts.length);
    noOverlap(backs.map(i => i.visibleBounds));
    const br = mock.doc.artboards[1].artboardRect;
    fronts.forEach((f, i) => {
      const fb = f.visibleBounds, bb = backs[i].visibleBounds;
      assert.strictEqual(backs[i].identity, "B" + f.identity.slice(1));
      assert.strictEqual(backs[i].angle, f.angle ? -90 : 0);
      assert(!backs[i].reflected);
      assert(Math.abs(bb[2] - bb[0] - (fb[2] - fb[0])) < EPS);
      assert(Math.abs(bb[1] - bb[3] - (fb[1] - fb[3])) < EPS);
      assert(Math.abs((fb[0]+fb[2])/2-fr[0]+(bb[0]+bb[2])/2-br[0]-(fr[2]-fr[0])) < EPS);
      assert(Math.abs(fr[1]-(fb[1]+fb[3])/2-(br[1]-(bb[1]+bb[3])/2)) < EPS);
    });
  }
}
for (const twoSided of [false, true])
  for (const dust of [0, 0.1]) {
    const specs = [
      [90, 50],
      [60, 40],
      [75, 65],
    ];
    const { mock, c } = setup(specs, twoSided, dust);
    const source = mock.originals.map((i) => i.geometricBounds);
    const result = c.dcDanToiUu("33", "35.4", twoSided, true);
    assert.match(result, /^OK:/, result);
    assert.match(result, /Ghép nhiều kích thước; số con từng mẫu:/);
    assert.strictEqual(mock.doc.artboards.length, twoSided ? 2 : 1);
    const fronts = mock.duplicates.filter((i) =>
      twoSided
        ? i.layer.name.startsWith("Dan toi uu - Mat truoc")
        : i.layer.name === "Dan toi uu",
    );
    const backs = mock.duplicates.filter((i) =>
      i.layer.name.startsWith("Dan toi uu - Mat sau"),
    );
    const counts = specs.map(() => 0);
    assert(fronts.length > 0);
    noOverlap(fronts.map((i) => i.visibleBounds));
    noOverlap(backs.map((i) => i.visibleBounds));
    const fr = mock.doc.artboards[0].artboardRect;
    for (let i = 0; i < fronts.length; i++) {
      const f = fronts[i],
        fb = f.visibleBounds,
        m = +f.identity.slice(1);
      counts[m]++;
      assert(
        fb[0] >= fr[0] + 3 * MM - EPS &&
          fb[2] <= fr[2] - 3 * MM + EPS &&
          fb[1] <= fr[1] - 3 * MM + EPS &&
          fb[3] >= fr[3] + 3 * MM - EPS,
      );
      assert(
        Math.abs(fb[2] - fb[0] - (f.angle ? specs[m][1] : specs[m][0]) * MM) <
          EPS,
      );
      assert(
        Math.abs(fb[1] - fb[3] - (f.angle ? specs[m][0] : specs[m][1]) * MM) <
          EPS,
      );
      assert(!f.reflected);
      if (twoSided) {
        const b = backs[i],
          bb = b.visibleBounds,
          br = mock.doc.artboards[1].artboardRect;
        assert.strictEqual(b.identity, "B" + m);
        assert.strictEqual(b.angle, f.angle ? -90 : 0);
        assert(!b.reflected);
        const fx = (fb[0] + fb[2]) / 2 - fr[0],
          bx = (bb[0] + bb[2]) / 2 - br[0];
        assert(
          Math.abs(fx + bx - (fr[2] - fr[0])) < EPS,
          "Duplex X centres must mirror even with slight size dust.",
        );
        assert(
          Math.abs(
            fr[1] - (fb[1] + fb[3]) / 2 - (br[1] - (bb[1] + bb[3]) / 2),
          ) < EPS,
          "Duplex Y centres must match.",
        );
      }
    }
    assert(counts[2] > 0, "The largest template must be placed before smaller templates");
    const expected = auditPlan(specs.map(([w, h]) => ({
      w: w * MM + (twoSided ? dust : 0), h: h * MM + (twoSided ? dust : 0)
    })), 324 * MM, 348 * MM, true);
    assert.deepStrictEqual(counts, Array.from(expected.counts));
    auditSourceCleanup(mock, counts, source);
  }
// Các nguồn hợp lệ riêng lẻ không nhất thiết đặt vừa cùng nhau. Giữ nguyên nguồn
// nhỏ hơn còn thừa sau khi đã dàn thành công mẫu lớn nhất.
for (const twoSided of [false, true]) {
  const { mock, c } = setup([[240, 240], [250, 250]], twoSided);
  const before = mock.originals.map(i => i.geometricBounds);
  assert.match(c.dcDanToiUu("33", "35.4", twoSided, true), /^OK:/);
  const fronts = mock.duplicates.filter(i => i.identity.startsWith("F"));
  assert.strictEqual(fronts.length, 1);
  assert.strictEqual(fronts[0].identity, "F1");
  auditSourceCleanup(mock, [0, 1], before);
}
// Lỗi khi render tuyệt đối không được làm mất nguồn, kể cả khi lỗi xảy ra
// sau khi mặt trước đã xong nhưng trước khi nhân bản hết các mặt sau.
for (const twoSided of [false, true]) {
  const { mock, c } = setup(sixLargeOneSmall.map(s => [s.w, s.h]), twoSided, 0,
    { failDuplicateAt: twoSided ? userPlan.count + 3 : 3 });
  const before = mock.originals.map(i => i.geometricBounds);
  assert.match(c.dcDanToiUu("33", "35.4", twoSided, true), /^ERR:/);
  auditSourceCleanup(mock, sixLargeOneSmall.map(() => 0), before);
}
for (const scenario of [
  "no-tick",
  "all-too-large",
  "pair-mismatch",
]) {
  const specs =
    scenario === "all-too-large"
      ? [
          [400, 400],
          [410, 410],
        ]
      : [
            [90, 50],
            [60, 40],
          ];
  const { mock, c } = setup(
    specs,
    scenario === "pair-mismatch",
    scenario === "pair-mismatch" ? 10 : 0,
  );
  const before = JSON.stringify(mock.originals.map((i) => i.geometricBounds));
  assert.match(
    c.dcDanToiUu(
      "33",
      "35.4",
      scenario === "pair-mismatch",
      scenario !== "no-tick",
    ),
    /^ERR:/,
  );
  assert.strictEqual(
    mock.duplicates.length,
    0,
    "Invalid mix fails before host writes.",
  );
  assert.strictEqual(mock.doc.layers.length, 1);
  assert.strictEqual(mock.doc.artboards.length, 1);
  assert.strictEqual(
    JSON.stringify(mock.originals.map((i) => i.geometricBounds)),
    before,
  );
  assert(mock.originals.every(i => i.removeCalls === 0 && !i.removed));
}
console.log(
  "KTS mixed sizes: automatic maximum largest-first replication, round-robin templates, intermediate-size priority, maximum smaller-copy hole filling, overflow/oversize retention, explicit 128-copy warning, post-success source/pair cleanup, portrait sources, saturated knife-safe cuts, band cutting effort, deterministic fit, duplex centres and preflight rejection passed.",
);
