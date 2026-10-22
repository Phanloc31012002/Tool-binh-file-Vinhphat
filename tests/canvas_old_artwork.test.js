"use strict";
// Tờ mới phải né cả bài cũ còn nằm trên canvas (khung đã xoá ở lượt trước), không chỉ né artboard.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const illustrator = require("./illustrator_geometry_mock");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");
const bridge = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_be_bridge.jsx"), "utf8");
const EPS = 0.01;
const overlap = (a, b) => a[0] < b[2] - EPS && b[0] < a[2] - EPS && a[3] < b[1] - EPS && b[3] < a[1] - EPS;
const union = (rects) => [
  Math.min(...rects.map((r) => r[0])), Math.max(...rects.map((r) => r[1])),
  Math.max(...rects.map((r) => r[2])), Math.min(...rects.map((r) => r[3])),
];

// Hàm chung: khung bao object cấp trên cùng, bỏ object trong skipItems, bỏ layer ẩn, bỏ object phủ gần hết canvas.
{
  const c = vm.createContext({});
  vm.runInContext(lib, c);
  assert.equal(typeof c.dcVungBaiCu, "function");
  const item = (b, extra) => Object.assign({ geometricBounds: b.slice() }, extra || {});
  const source = item([0, 100, 80, 0]);
  const old = item([500, 400, 900, 100]);
  const huge = item([-7100, 7100, 7100, -7100]);
  const doc = {
    layers: [
      { visible: true, locked: false, pageItems: [source, old] },
      { visible: true, locked: true, pageItems: [item([1000, 50, 1100, 0])] },
      { visible: false, locked: false, pageItems: [item([2000, 50, 2100, 0])] },
      { visible: true, locked: false, pageItems: [huge] },
    ],
  };
  const rects = JSON.parse(JSON.stringify(c.dcVungBaiCu(doc, [-7200, 7200, 7200, -7200], [source])));
  assert.deepEqual(rects, [[500, 400, 900, 100], [1000, 50, 1100, 0]]);
}
{
  const b = vm.createContext({});
  vm.runInContext(bridge, b);
  assert.equal(typeof b.dcDanBeOldArtworkRects, "function");
  const doc = { layers: [{ visible: true, locked: false, pageItems: [{ geometricBounds: [1, 2, 3, 0] }] }] };
  assert.deepEqual(JSON.parse(JSON.stringify(b.dcDanBeOldArtworkRects(doc, [-7200, 7200, 7200, -7200], []))), [[1, 2, 3, 0]]);
  // render nối khung bài cũ vào danh sách vùng bận trước khi cấp chỗ.
  const render = bridge.slice(bridge.indexOf("function dcDanBeRender("));
  assert.ok(/dcDanBeOldArtworkRects\(/.test(render), "render dùng dcDanBeOldArtworkRects");
}

// KTS ba lượt trên cùng tài liệu: lượt 3 không được đè lên bài lượt 1 (khung lượt 1 đã bị xoá ở lượt 2).
{
  const f = illustrator(), c = vm.createContext(f.context);
  vm.runInContext(lib, c);
  const source = f.source([0, 100, 80, 0], "source");
  f.doc.selection = [source];
  const sheetsOf = () => f.doc.artboards.map((a) => a.artboardRect.slice());
  assert.match(c.dcDanToiUu("33", "35.4", false, false), /^OK:/);
  const run1 = sheetsOf();
  const run1Artwork = union(f.duplicates.map((d) => d.geometricBounds));
  assert.ok(run1.some((r) => overlap(r, run1Artwork)), "bài lượt 1 nằm trong tờ lượt 1");
  f.doc.selection = [source];
  assert.match(c.dcDanToiUu("33", "35.4", false, false), /^OK:/);
  const run2 = sheetsOf();
  for (const r of run2) assert.ok(!overlap(r, run1Artwork), "lượt 2 né bài lượt 1");
  f.doc.selection = [source];
  assert.match(c.dcDanToiUu("33", "35.4", false, false), /^OK:/);
  const run3 = sheetsOf();
  for (const r of run3) {
    assert.ok(!overlap(r, run1Artwork), "lượt 3 đè lên bài lượt 1: " + JSON.stringify([r, run1Artwork]));
    for (const r2 of run2) assert.ok(!overlap(r, r2), "lượt 3 đè lên bài lượt 2");
  }
  assert.ok(f.duplicates.every((d) => f.doc.layers.some((l) => l.pageItems.includes(d))), "bài cũ không bị xoá");
}
console.log("canvas_old_artwork: ok");
