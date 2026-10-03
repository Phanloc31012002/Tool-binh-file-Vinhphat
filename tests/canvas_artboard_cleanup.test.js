"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const illustrator = require("./illustrator_geometry_mock");
const lib = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const bridge = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_be_bridge.jsx"),
  "utf8",
);
const main = fs.readFileSync(
  require.resolve("../DanCardCEP/js/main.js"),
  "utf8",
);
const helper = lib.slice(
  lib.indexOf("function dcRemoveOldCanvasArtboards("),
  lib.indexOf("function dcCopyToiUuNoteToOddArtboards("),
);

// Reverse-order frame deletion: new frames/artwork are never removed. A failed
// native removal leaves a warning, not a rollback of already-rendered output.
for (const [oldCount, freshCount, failIndex] of [
  [3, 2, -1],
  [3, 0, -1],
  [0, 1, -1],
  [3, 2, 1],
]) {
  const calls = [],
    artwork = { identity: "source", removed: false },
    doc = { artboards: [] };
  const c = vm.createContext({ app: { activeDocument: null } });
  vm.runInContext(helper, c);
  for (let id = 0; id < oldCount + freshCount; id++) {
    const board = {
      id,
      remove() {
        assert.ok(id < oldCount, "Never remove a result artboard");
        calls.push(id);
        if (id === failIndex) throw new Error("locked frame");
        doc.artboards.splice(doc.artboards.indexOf(board), 1);
      },
    };
    doc.artboards.push(board);
  }
  const result = c.dcRemoveOldCanvasArtboards(doc, oldCount);
  const removed = freshCount ? oldCount - (failIndex >= 0 ? 1 : 0) : 0;
  assert.equal(result.removed, removed);
  assert.equal(result.firstNewIndex, oldCount - removed);
  assert.equal(doc.artboards.length, oldCount + freshCount - removed);
  assert.deepEqual(
    calls,
    freshCount
      ? Array.from({ length: oldCount }, (_, i) => oldCount - i - 1)
      : [],
  );
  assert.equal(Boolean(result.warning), freshCount > 0 && failIndex >= 0);
  assert.equal(artwork.removed, false);
  assert.equal(c.app.activeDocument, doc);
}

// Complete KTS rendering cleans up only on success. Failed duplication keeps
// the original artboard references, irrespective of temporary output state.
for (const fail of [false, true]) {
  const f = illustrator(),
    c = vm.createContext(f.context);
  vm.runInContext(lib, c);
  f.doc.artboards.add([1000, 500, 1500, 0]);
  const old = Array.from(f.doc.artboards),
    source = f.source([0, 100, 80, 0], "source");
  const bounds = source.geometricBounds.slice();
  f.doc.selection = [source];
  if (fail)
    source.duplicate = function () {
      throw new Error("injected duplication failure");
    };
  const status = c.dcDanToiUu("33", "35.4", false, false);
  assert.match(status, fail ? /^ERR:/ : /^OK:/, status);
  assert.deepEqual(source.geometricBounds, bounds);
  if (fail)
    for (const board of old)
      assert.ok(
        f.doc.artboards.includes(board),
        "Old frame retained on failure",
      );
  else {
    assert.equal(f.doc.artboards.length, 1);
    assert.equal(f.doc.activeArtboardIndex, 0);
    for (const board of old) assert.ok(!f.doc.artboards.includes(board));
  }
}
assert.equal(
  (
    lib.match(/dcRemoveOldCanvasArtboards\(doc, oldCanvasArtboardCount\)/g) ||
    []
  ).length,
  3,
  "KTS and both Offset flows",
);
// Execute both Offset routes too: single-size previously called a PON helper
// that only existed inside KTS/mixed-size functions and failed after rendering.
for (const mode of ["self", "ab", "mixed"]) {
  const f = illustrator(),
    c = vm.createContext(f.context);
  vm.runInContext(lib, c);
  f.doc.artboards.add([1000, 500, 1500, 0]);
  const old = Array.from(f.doc.artboards);
  f.doc.selection = [
    f.source([0, 200, 80, 100], "front"),
    f.source([200, 200, 280, 100], "back"),
  ];
  if (mode === "mixed")
    f.doc.selection.push(
      f.source([0, 50, 60, -20], "front2"),
      f.source([200, 50, 260, -20], "back2"),
    );
  const status = c.dcDanTuTro("33", "35.4", "4", "0", false, mode);
  assert.match(status, /^OK:/, status);
  assert.equal(f.doc.artboards.length, mode === "ab" ? 2 : 1);
  assert.equal(f.doc.activeArtboardIndex, 0);
  for (const board of old) assert.ok(!f.doc.artboards.includes(board));
  const pon = f.doc.layers.find((l) =>
    l.name.startsWith("PON giấy Dàn Offset"),
  );
  assert.ok(pon, "Paper PON layer exists");
  assert.equal(pon.pageItems.length, mode === "ab" ? 16 : 8);
}
assert.match(
  lib,
  /if \(errors\.length === 0\)\s*\{\s*var cleanup = dcRemoveOldCanvasArtboards\(doc, oldAb\)/,
);
assert.ok(
  bridge.indexOf("for (var oldBoard = firstNewIndex - 1") >
    bridge.indexOf("finishFace(backFace);"),
  "Bế cleanup follows final face rendering",
);
assert.match(main, /dcDanToiUuVersion[^\n]*19/);
assert.match(main, /dcDanTuTroVersion[^\n]*11/);
assert.match(main, /dcDanBeNestingVersion[^\n]*8/);
console.log(
  "Canvas cleanup: result-only frames on success, old frames retained on failure, reverse deletion and partial-removal warning passed.",
);
