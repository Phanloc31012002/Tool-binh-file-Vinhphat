"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const illustrator = require("./illustrator_geometry_mock");
const lib = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const main = fs.readFileSync(
  require.resolve("../DanCardCEP/js/main.js"),
  "utf8",
);
const block = lib.slice(
  lib.indexOf("var dcAutoCutMarksVersion"),
  lib.indexOf("var dcDanToiUuVersion = 2;"),
);
function fixture() {
  const f = illustrator({ rect: [0, 400, 600, 0] });
  let adds = 0,
    failAt = Infinity;
  function configure(layer) {
    const originalAdd = layer.pathItems.add,
      paths = [];
    paths.add = function () {
      if (++adds === failAt) throw Error("injected path creation failure");
      assert.equal(
        layer.locked,
        false,
        "Output layer must be unlocked while drawing",
      );
      assert.equal(
        layer.visible,
        true,
        "Output layer must be visible while drawing",
      );
      assert.equal(
        f.doc.activeLayer,
        layer,
        "Make the actual destination active",
      );
      const p = originalAdd();
      p.typename = "PathItem";
      p.note = "";
      p.closed = false;
      const set = p.setEntirePath;
      p.setEntirePath = function (points) {
        set.call(p, points);
        p.pathPoints = points.map((a) => ({
          anchor: a.slice(),
          leftDirection: a.slice(),
          rightDirection: a.slice(),
        }));
      };
      p.remove = function () {
        layer.pageItems.splice(layer.pageItems.indexOf(p), 1);
        paths.splice(paths.indexOf(p), 1);
      };
      paths.push(p);
      return p;
    };
    layer.pathItems = paths;
    return layer;
  }
  f.doc.layers.forEach(configure);
  const addLayer = f.doc.layers.add;
  f.doc.layers.add = function () {
    return configure(addLayer());
  };
  f.context.CMYKColor = function () {
    this.typename = "CMYKColor";
  };
  f.context.app.redraw = function () {};
  const c = vm.createContext(f.context);
  vm.runInContext(block, c);
  return {
    ...f,
    c,
    run() {
      return c.dcThemDauCatTuDong("1.4", "4", "0");
    },
    marks() {
      return f.doc.layers.find((l) => l.name === "Dau cat tu dong");
    },
    failAfter(n) {
      failAt = adds + n;
    },
  };
}
const snapshot = (paths) =>
  paths.map((p) => ({
    item: p,
    points: p.pathPoints.map((q) => q.anchor.slice()),
    note: p.note,
  }));
function unchanged(before) {
  for (const s of before) {
    assert.deepEqual(
      s.item.pathPoints.map((q) => q.anchor),
      s.points,
    );
    assert.equal(s.item.note, s.note);
  }
}
{
  const f = fixture(),
    first = f.source([100, 300, 180, 220], "first");
  f.doc.selection = [first];
  assert.match(f.run(), /^OK:.*8/);
  const layer = f.marks(),
    old = snapshot(layer.pathItems);
  assert.equal(layer.pathItems.length, 8);
  assert.equal(f.doc.activeLayer, f.sourceLayer);
  assert.equal(f.c.app.coordinateSystem, "user-coordinates");
  // Tái hiện lỗi đã được báo: một hình chữ nhật tô màu thật bị dán vào layer PON.
  f.doc.activeLayer = layer;
  const artwork = layer.pathItems.add();
  artwork.setEntirePath([
    [300, 300],
    [380, 300],
    [380, 220],
    [300, 220],
  ]);
  artwork.closed = true;
  artwork.filled = true;
  const sourcePoints = artwork.pathPoints.map((p) => p.anchor.slice());
  f.doc.selection = [artwork];
  assert.match(f.run(), /^OK:.*8/);
  assert.equal(layer.pathItems.length, 17);
  assert.equal(f.marks(), layer, "Same layer reused, never replaced");
  unchanged(old);
  assert.deepEqual(
    artwork.pathPoints.map((p) => p.anchor),
    sourcePoints,
  );
  f.doc.selection = [
    artwork,
    ...layer.pathItems.filter((p) => p.note === "DANCARD_AUTO_CUT_MARK"),
  ];
  assert.match(f.run(), /^OK:.*trùng/);
  assert.equal(
    layer.pathItems.length,
    17,
    "Repeat does not stack identical marks",
  );
  // Giả lập kiểu PON cũ chưa gắn thẻ. Nó không được bị coi là bài đang chọn.
  for (const p of layer.pathItems)
    if (p.note === "DANCARD_AUTO_CUT_MARK") p.note = "";
  f.doc.selection = [artwork, ...layer.pathItems];
  assert.match(f.run(), /^OK:.*trùng/);
  assert.equal(layer.pathItems.length, 17);
}
{
  const f = fixture(),
    a = f.source([100, 300, 180, 220], "a");
  f.doc.selection = [a];
  assert.match(f.run(), /^OK:/);
  const layer = f.marks(),
    old = snapshot(layer.pathItems),
    b = f.source([300, 300, 380, 220], "b");
  layer.locked = true;
  layer.visible = false;
  f.doc.activeLayer = f.sourceLayer;
  f.doc.selection = [b];
  assert.match(f.run(), /^OK:.*8/);
  assert.equal(layer.pathItems.length, 16);
  unchanged(old);
  assert.equal(layer.locked, true);
  assert.equal(layer.visible, true);
  assert.equal(f.doc.activeLayer, f.sourceLayer);
  const all = snapshot(layer.pathItems);
  layer.visible = false;
  f.doc.selection = [f.source([100, 150, 180, 70], "c")];
  f.failAfter(2);
  assert.match(f.run(), /^ERR:.*injected/);
  assert.equal(layer.pathItems.length, 16);
  unchanged(all);
  assert.equal(layer.locked, true);
  assert.equal(layer.visible, false);
  assert.equal(f.doc.activeLayer, f.sourceLayer);
  assert.equal(f.c.app.coordinateSystem, "user-coordinates");
}
{
  const f = fixture();
  f.doc.selection = [f.source([100, 300, 180, 220], "a")];
  f.failAfter(2);
  assert.match(f.run(), /^ERR:/);
  assert.equal(
    f.doc.layers.length,
    1,
    "Only failed new marks/layer rolled back",
  );
  assert.equal(f.doc.activeLayer, f.sourceLayer);
  assert.equal(f.c.app.coordinateSystem, "user-coordinates");
  assert.match(f.c.dcThemDauCatTuDong("-1", "4", "0"), /^ERR:/);
  assert.equal(f.doc.layers.length, 1);
  f.doc.selection = [];
  assert.match(f.run(), /^ERR:/);
  assert.equal(f.doc.layers.length, 1);
}
// Bấm nút thật trên panel sẽ nạp lại engine persistent cũ, với đường dẫn Windows đã escape.
const a = main.indexOf("  function jsStr(s)"),
  b = main.indexOf("  function loadDanTheoMauJsx()");
const start = main.indexOf("  var btnCutMarks ="),
  end = main.indexOf("  // ---- Dàn Card ----", start);
const expressions = [],
  btn = {
    addEventListener(_, fn) {
      this.click = fn;
    },
  };
const nodes = {
  btnCutMarks: btn,
  outCutMarks: {},
  cutMarkLength: { value: "1.4" },
  cutMarkGap: { value: "0" },
  cutMarkEdge: { value: "4" },
};
const panel = vm.createContext({
  document: { getElementById: (id) => nodes[id] },
  attachSelectFirst() {},
  show() {},
  handleRes() {},
  SystemPath: { EXTENSION: "extension" },
  cs: {
    getSystemPath() {
      return "C:\\Tools\\Loc's tool";
    },
    evalScript(e, cb) {
      expressions.push(e);
      cb("OK:");
    },
  },
});
vm.runInContext(main.slice(a, b) + main.slice(start, end), panel);
btn.click();
assert.equal(btn.disabled, false);
let reloads = 0;
panel.dcThemDauCatTuDong = () => {
  panel.called = true;
};
panel.$ = {
  evalFile() {
    reloads++;
    panel.dcAutoCutMarksVersion = 1;
  },
};
vm.runInContext(expressions[0], panel);
assert.equal(reloads, 1);
assert.equal(panel.called, true);
vm.runInContext(expressions[0], panel);
assert.equal(reloads, 1, "Healthy engine reused");
console.log(
  "Auto cut marks: append in same PON layer, real artwork on PON layer, old/new mark filtering, repeat deduplication, locked/hidden output, state restore, failure rollback and stale-engine reload passed.",
);
