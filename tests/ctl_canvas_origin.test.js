"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const illustrator = require("./illustrator_geometry_mock");
const lib = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const MM = 2.834645669;
const expectedCanvas = [-11726.25, 7596.5, 2673.75, -6803.5];
function fixture(
  kind,
  {
    left = -10894.843930306,
    top = 7320.524756344,
    failArtboard = 0,
    n = 12,
  } = {},
) {
  const f = illustrator({ rect: [-4843, 766, -4660, 185] });
  f.doc.typename = "Document";
  f.doc.fullName = "SHIFTED.ai";
  f.doc.pageOrigin = [-4831.75, 0];
  f.doc.artboards.remove = (i) => f.doc.artboards[i].remove();
  for (let i = 0; i < n; i++)
    f.source([left + i * 70, top, left + i * 70 + 60, top - 90], i + 1);
  f.doc.selection = f.originals.slice();
  f.sourceLayer.parent = f.doc;
  f.sourceLayer.typename = "Layer";
  // A selected old PON must be filtered, not deleted on rejected preflight.
  const oldPon = f.doc.layers.add();
  oldPon.name = "Pon cat CTL Offset tu dong";
  oldPon.typename = "Layer";
  oldPon.parent = f.doc;
  oldPon.locked = true;
  const oldMark = oldPon.pathItems.add();
  if (kind === "signature") f.doc.selection.push(oldMark);
  let flattened = 0,
    addCount = 0;
  const originalAdd = f.doc.artboards.add;
  f.doc.artboards.add = (rect) => {
    if (++addCount === failArtboard) throw Error("injected artboard failure");
    return originalAdd(rect);
  };
  // Execute the actual complete preflight; stop before rendering in this test.
  f.context.alert = () => {};
  f.context.File = function (path) {
    this.name = path;
    this.exists = true;
    this.open = () => true;
    this.read = (limit) => {
      assert.equal(limit, 1024 * 1024, "bounded read, no artboard probes");
      return "%AI3_TemplateBox: -4526.25 396.5 -4526.25 396.5\n%%PageOrigin: -4831.75 0\n";
    };
    this.close = () => {};
  };
  const c = vm.createContext(f.context);
  vm.runInContext(lib, c);
  c.dcFlattenForImposition = () => {
    flattened++;
    throw Error("REACHED_RENDER");
  };
  const snapshot = () =>
    JSON.stringify({
      pages: f.originals.map((i) => [i.typename, i.geometricBounds]),
      layers: f.doc.layers.map((l) => [l.name, l.locked]),
      boards: f.doc.artboards.map((a) => a.artboardRect),
      selection: f.doc.selection.map((i) => i.identity),
    });
  const before = snapshot();
  return {
    ...f,
    c,
    before,
    snapshot,
    flattened: () => flattened,
    run() {
      return kind === "signature"
        ? c.dcRunSignature8("14.5", "20.7", true)
        : c.dcRunKeoGay("14.5", "20.7");
    },
  };
}
for (const kind of ["signature", "keo"]) {
  const f = fixture(kind);
  assert.deepEqual(
    Array.from(f.c.dcDanTheoMauReadCanvasBounds(f.doc)),
    expectedCanvas,
  );
  assert.match(
    f.run(),
    /REACHED_RENDER/,
    "valid shifted-origin source reaches rendering, not false canvas error",
  );
  assert.equal(f.flattened(), 1);
  assert.equal(
    f.doc.artboards.length,
    3,
    "two planned sheets plus original not removed before success",
  );
  const first = f.doc.artboards[1].artboardRect;
  assert.ok(Math.abs(first[0] + 10894.843930306) < 0.001);
  assert.ok(Math.abs(first[1] - 7320.524756344) < 0.001);
  for (const a of f.doc.artboards.slice(1)) {
    const r = a.artboardRect;
    assert.ok(
      r[0] >= expectedCanvas[0] &&
        r[1] <= expectedCanvas[1] &&
        r[2] <= expectedCanvas[2] &&
        r[3] >= expectedCanvas[3],
    );
  }
  assert.equal(f.context.app.coordinateSystem, "user-coordinates");
  for (const position of [
    { left: -11720 },
    { top: 7590 },
    { left: 2500 },
    { top: -6790 },
  ]) {
    const rejected = fixture(kind, position);
    assert.match(rejected.run(), /^ERR:/);
    assert.equal(rejected.flattened(), 0, "reject before raster/resize");
    assert.equal(
      rejected.snapshot(),
      rejected.before,
      "keep source, selection, old frames and PON layers",
    );
    assert.equal(rejected.context.app.coordinateSystem, "user-coordinates");
  }
  const rollback = fixture(kind, { failArtboard: 2 });
  assert.match(rollback.run(), /^ERR:.*artboard/);
  assert.equal(rollback.flattened(), 0);
  assert.equal(
    rollback.snapshot(),
    rollback.before,
    "remove only new frames when artboard creation fails",
  );
}
const main = fs.readFileSync(
  require.resolve("../DanCardCEP/js/main.js"),
  "utf8",
);
assert.match(main, /dcSignature8AutoPonVersion < 38/);
assert.match(main, /dcKeoGayAutoPonVersion < 9/);
console.log(
  "CTL: shifted saved canvas, exact source anchor, genuine-edge preflight without source/PON mutation, creation rollback and coordinate restoration passed.",
);
