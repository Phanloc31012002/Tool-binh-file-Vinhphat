"use strict";
// Bộ chia khu (dan_be_zones.js): các khối nhỏ — nhận nhóm khuôn, chia cụm bài, ước lượng,
// dàn thật, khép khu, lấp chỗ trống. Mỗi khối được đo riêng, không qua Illustrator.
const assert = require("node:assert/strict");
const nester = require("../DanCardCEP/js/dan_be_nester");
const core = nester._core;
const Z = require("../DanCardCEP/js/dan_be_zones");
const L = require("./dan_be_shape_library");
const f = require("./dan_be_fixtures");

const began = Date.now();
const failures = [];
function run(name, fn) {
  try { fn(); console.log("đạt: " + name); } catch (error) {
    failures.push(name + ": " + error.message); console.error("HỎNG " + name + ": " + error.message);
  }
}

const heart = L.heart().groups, star = L.star(5, 26, 11).groups;
// Cùng khuôn tim nhưng file đặt xoay 90°, path bắt đầu ở điểm khác và đổi chiều.
const turned = core.rotateGroups(heart, 90).map((g) => g.map((c) => c.slice(3).concat(c.slice(0, 3)).reverse()));

run("nhận nhóm khuôn", () => {
  const groups = Z.groupCutters([{ groups: heart }, { groups: star }, { groups: turned }], core);
  assert.deepEqual(groups.map((g) => g.members.map((m) => m.type)), [[0, 2], [1]], "tim + tim xoay là một nhóm, sao là nhóm khác");
  assert.equal(groups[0].members[0].rel, 0);
  const m = groups[0].members[1];
  assert.ok(Number.isInteger(m.rel) && m.rel >= 0 && m.rel < 4);
  assert.ok(core.sameGroups(core.normalizeGroups(core.rotateGroups(turned, m.rel * 90)), groups[0].groups), "rel đưa bài về đúng hướng khuôn đại diện");
  assert.ok(groups[0].area > 0 && groups[1].area > 0, "có diện tích khuôn");
  assert.throws(() => Z.groupCutters([{ groups: heart }, { groups: [] }], core), /loại 2/, "đường bế hỏng báo đúng loại");
});

run("chia cụm bài", () => {
  assert.deepEqual(Z.clusterSizes(23, 5), [5, 5, 5, 4, 4]);
  assert.deepEqual(Z.clusterSizes(2, 3), [1, 1, 0]);
  const grid = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) grid.push({ x: x * 10, y: y * 10 });
  const labels = Z.assignClusters(grid, [4, 4, 4]);
  assert.equal(labels.length, 12);
  [0, 1, 2].forEach((k) => {
    const mine = grid.filter((_, i) => labels[i] === k);
    assert.equal(mine.length, 4, "đúng cỡ cụm " + k);
    const box = { x0: Math.min(...mine.map((p) => p.x)), x1: Math.max(...mine.map((p) => p.x)),
      y0: Math.min(...mine.map((p) => p.y)), y1: Math.max(...mine.map((p) => p.y)) };
    grid.forEach((p, i) => {
      if (labels[i] !== k) assert.ok(!(p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1), "cụm không lẫn");
    });
  });
  assert.deepEqual(Z.assignClusters(grid, [4, 4, 4]), labels, "tất định");
  // Cỡ cụm 0 vẫn hợp lệ: 2 điểm, 3 bài → nhãn 2 không có điểm nào.
  const two = Z.assignClusters([{ x: 0, y: 0 }, { x: 10, y: 0 }], [1, 1, 0]);
  assert.deepEqual(two.slice().sort(), [0, 1]);
});

const { assertClusterTidy } = require("./dan_be_cluster_check");

run("cùng khuôn: gom cụm bài", () => {
  const curve = L.heart().curveErrorMm;
  const inputFor = (list) => f.input(list[0], { types: list.map((g) => ({ groups: g, curveErrorMm: curve })) });
  const one = nester.nest(inputFor([heart]));
  const three = nester.nest(inputFor([heart, heart, turned]));
  assert.equal(three.ok, true, three.error);
  const key = (s) => s.x.toFixed(6) + "," + s.y.toFixed(6);
  assert.deepEqual(three.slots.map(key).sort(), one.slots.map(key).sort(), "vị trí y như dàn một mẫu");
  assert.equal(three.count, one.count);
  assert.ok(Math.max(...three.counts) - Math.min(...three.counts) <= 1, "chênh tối đa 1 con");
  assert.match(three.mode, /gom cụm các bài cùng khuôn/);
  const observed = [0, 0, 0];
  three.slots.forEach((s) => { assert.equal(s.angle, s.vi * 90); observed[s.mi]++; });
  assert.deepEqual(three.counts, observed);
  [0, 1, 2].forEach((k) => assertClusterTidy(inputFor([heart, heart, turned]), three, k));
  // Bài 3 đặt xoay 90° trong file: góc xoay trả về phải bù lại để con bế đúng hướng khuôn.
  const inputThree = inputFor([heart, heart, turned]);
  three.slots.forEach((s) => {
    const placed = core.normalizeGroups(core.rotateGroups(inputThree.types[s.mi].groups, s.angle));
    const ref = one.slots.find((o) => key(o) === key(s));
    const refPlaced = core.normalizeGroups(core.rotateGroups(heart, ref.angle));
    assert.ok(core.sameGroups(placed, refPlaced), "con của bài " + s.mi + " đặt đúng hướng khuôn tại vị trí đó");
  });
});

run("ước lượng và cây chia khu", () => {
  // Ước lượng giả: ô 10×10 và ô 20×20 xếp lưới khít 10 × 10 con, khoảng cách khu 0.
  const unit = (k) => ({ boxes: [...Array(10)].flatMap((_, r) => [...Array(10)].map((_, c) =>
    ({ x0: c * k, y0: r * k, x1: (c + 1) * k, y1: (r + 1) * k }))) });
  const ests = [Z.makeEstimator(unit(10)), Z.makeEstimator(unit(20))];
  const cutters = [{ members: [{}], area: 100 }, { members: [{}], area: 400 }];
  assert.equal(ests[0](35, 20), 6, "khung 35 × 20 chứa 3 × 2 ô 10");
  assert.equal(ests[0](9, 50), 0);
  assert.equal(Z.enumerateTrees(cutters).length, 4, "2 khuôn: 2 thứ tự × {H, V}");
  assert.equal(Z.enumerateTrees([0, 1, 2].map((i) => ({ members: [{}], area: i + 1 }))).length, 24, "3 khuôn: 12 một tầng + 12 hai tầng");
  assert.equal(Z.enumerateTrees([0, 1, 2, 3].map((i) => ({ members: [{}], area: i + 1 }))).length, 76, "4 khuôn: 48 một tầng + 28 hai tầng");
  const many = Z.enumerateTrees([0, 1, 2, 3, 4, 5].map((i) => ({ members: [{}], area: i + 1 })));
  assert.ok(many.length > 0 && many.length <= 200, "nhiều khuôn: số cây bị chặn, được " + many.length);
  many.forEach((t) => assert.ok(t.dir === "H" || t.dir === "V"));
  const tree = { dir: "H", kids: [{ leaf: 0 }, { leaf: 1 }] };
  const sz = Z.sizeTree(tree, 100, 110, ests, cutters, 0);
  // N* = 20: khuôn 0 cần 2 hàng (cao 20), khuôn 1 cần 4 hàng × 5 con (cao 80); dư 10 → hai khuôn
  // bằng 20 con/bài, khuôn 0 đứng trước và thêm được 1 hàng → [30, 20].
  assert.deepEqual(sz.counts, [30, 20]);
  assert.equal(sz.minPer, 20);
  assert.equal(sz.total, 50);
  assert.deepEqual(sz.extents.get(tree), [30, 80], "độ cao cấp cho hai khu");
  assert.equal(sz.boundaries, 1);
  // Khoảng cách khu 5: hai khu cần 20 + 80 + 5 = 105 ≤ 110, dư 5 không thêm được hàng nào.
  const spaced = Z.sizeTree(tree, 100, 110, ests, cutters, 5);
  assert.deepEqual(spaced.counts, [20, 20]);
  // Dải dọc: khung 100 rộng chia cho hai khu theo x; khuôn 0 một cột 10 (10 con/cột cao 100 → 10 con), khuôn 1 cột 20 (5 con).
  const v = Z.sizeTree({ dir: "V", kids: [{ leaf: 0 }, { leaf: 1 }] }, 100, 100, ests, cutters, 0);
  assert.equal(v.minPer, 20, "2 cột khuôn 0 (20 con) + 4 cột khuôn 1 (20 con) = 100 rộng");
  assert.deepEqual(v.counts, [20, 20]);
  // Hai tầng: khu khuôn 0 bên trái, bên phải chia ngang cho khuôn 1 và khuôn 1' (cùng ước lượng).
  const two = Z.sizeTree({ dir: "V", kids: [{ leaf: 0 }, { dir: "H", kids: [{ leaf: 1 }, { leaf: 2 }] }] }, 100, 100,
    [ests[0], ests[1], ests[1]], [cutters[0], cutters[1], cutters[1]], 0);
  assert.ok(two.minPer >= 5 && two.total >= 25, "cây hai tầng có kết quả: " + JSON.stringify(two.counts));
  assert.equal(two.boundaries, 2);
  // Khuôn 2 bài: mỗi bài N con nghĩa là khu cần 2N con.
  const twoDesigns = Z.sizeTree(tree, 100, 110, ests, [{ members: [{}, {}], area: 100 }, cutters[1]], 0);
  assert.ok(twoDesigns.minPer >= 10 && twoDesigns.counts[0] >= 2 * twoDesigns.minPer);
  // Không vừa: khung 15 × 15 không chứa nổi một ô 20 → N* = 0, cây vẫn được chấm.
  const none = Z.sizeTree(tree, 15, 15, ests, cutters, 0);
  assert.equal(none.minPer, 0);
});

assert.ok(Date.now() - began < 120000, "bộ test khối chia khu chạy trong thời gian hữu hạn");
assert.deepEqual(failures, [], failures.join("\n"));
console.log("Khối chia khu: mọi ca đạt trong " + (Date.now() - began) + " ms.");
