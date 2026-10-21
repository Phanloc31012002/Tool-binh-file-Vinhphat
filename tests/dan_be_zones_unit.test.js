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

assert.ok(Date.now() - began < 120000, "bộ test khối chia khu chạy trong thời gian hữu hạn");
assert.deepEqual(failures, [], failures.join("\n"));
console.log("Khối chia khu: mọi ca đạt trong " + (Date.now() - began) + " ms.");
