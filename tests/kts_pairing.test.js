const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const illustrator = require("./illustrator_geometry_mock");
const library = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const MM = 2.834645669;
const pure = vm.createContext({});
vm.runInContext(library, pure);
const record = (id, x, y, w = 92 * MM, h = 52 * MM) => ({
  item: { id },
  cx: x,
  cy: y,
  bounds: [x - w / 2, y + h / 2, x + w / 2, y - h / 2],
});
const pairIds = (records) =>
  Array.from(pure.dcKtsPairSourceRecords(records, 0.01), (p) => [
    p.front.item.id,
    p.back.item.id,
  ]);
const source = [];
for (let row = 0; row < 7; row++) {
  source.push(record("F" + row, 330.48, -1117.558425212 - row * 147.401574788));
  // Lớn hơn EPS nhưng mắt thường không thấy: từng làm đảo ngược kết quả sắp xếp cũ.
  source.push(
    record(
      "B" + row,
      654.171517546461,
      source.at(-1).cy + (row % 2 ? -0.02 : 0.02),
    ),
  );
}
const expected = Array.from({ length: 7 }, (_, i) => ["F" + i, "B" + i]);
const saved = JSON.stringify(source);
for (const records of [
  source,
  source.slice().reverse(),
  source.filter((_, i) => i % 2).concat(source.filter((_, i) => !(i % 2))),
]) {
  assert.deepStrictEqual(
    pairIds(records),
    expected,
    "Source order or tiny Y shifts must not invert faces.",
  );
}
assert.strictEqual(
  JSON.stringify(source),
  saved,
  "Pairing must not modify source records.",
);
const old = source
  .slice()
  .sort((a, b) => (Math.abs(a.cy - b.cy) > 0.01 ? b.cy - a.cy : a.cx - b.cx));
assert.strictEqual(
  old[0].item.id,
  "B0",
  "Fixture reproduces the former right-face-as-front bug.",
);
assert.deepStrictEqual(
  pairIds([
    record("B2", 1000, 100),
    record("F1", 100, 100),
    record("B1", 400, 100.02),
    record("F2", 700, 100),
  ]),
  [
    ["F1", "B1"],
    ["F2", "B2"],
  ],
  "Four-column sources retain adjacent left/right pairs.",
);
assert.throws(
  () => pairIds([record("F", 100, 100), record("B", 400, 0)]),
  /canh lại hàng/,
);
assert.throws(
  () => pairIds([record("F", 100, 100), record("B", 200, 100)]),
  /chồng ngang/,
);
assert.throws(() =>
  pairIds([
    record("F1", 100, 100),
    record("F2", 100, 0),
    record("B2", 400, 0),
    record("B3", 400, -100),
  ]),
);

// Chạy thử trọn vẹn quy trình KTS của code thật, gồm cả bước tối ưu,
// các hướng xoay lẫn lộn, thứ tự slot, lật đối xứng hai mặt và canh giữa.
for (const mixed of [false, true]) {
  const mock = illustrator();
  const c = vm.createContext(mock.context);
  vm.runInContext(library, c);
  mock.doc.selection = source
    .slice()
    .reverse()
    .map((r) => mock.source(r.bounds, r.item.id));
  const originalBounds = mock.originals.map((i) => i.geometricBounds);
  const result = c.dcDanToiUu("33", "35.4", true, mixed);
  assert.match(result, /^OK:/, result);
  const fronts = mock.duplicates.filter((i) =>
    i.layer.name.startsWith("Dan toi uu - Mat truoc"),
  );
  const backs = mock.duplicates.filter((i) =>
    i.layer.name.startsWith("Dan toi uu - Mat sau"),
  );
  assert.strictEqual(fronts.length, backs.length);
  assert(fronts.length > 0);
  assert(
    fronts.every((i) => /^F\d$/.test(i.identity)),
    "Never mix a back into the front layer.",
  );
  assert(
    backs.every((i) => /^B\d$/.test(i.identity)),
    "Never mix a front into the back layer.",
  );
  const contains = (ab, b) =>
    b[0] >= ab[0] - 0.01 &&
    b[2] <= ab[2] + 0.01 &&
    b[1] <= ab[1] + 0.01 &&
    b[3] >= ab[3] - 0.01;
  for (let i = 0; i < fronts.length; i++) {
    const f = fronts[i],
      b = backs[i];
    assert.strictEqual(
      f.identity.slice(1),
      b.identity.slice(1),
      "Both faces must consume the same frozen model-to-slot map.",
    );
    assert.strictEqual(b.angle, f.angle === 90 ? -90 : 0);
    const fi = mock.doc.artboards.findIndex((ab) =>
      contains(ab.artboardRect, f.geometricBounds),
    );
    assert(fi >= 0 && fi % 2 === 0);
    const fr = mock.doc.artboards[fi].artboardRect,
      br = mock.doc.artboards[fi + 1].artboardRect;
    assert(contains(br, b.geometricBounds));
    const fb = f.geometricBounds,
      bb = b.geometricBounds;
    const fx = (fb[0] + fb[2]) / 2 - fr[0],
      bx = (bb[0] + bb[2]) / 2 - br[0];
    assert(
      Math.abs(fx + bx - (fr[2] - fr[0])) < 0.001,
      "Duplex X centres are mirrored.",
    );
    assert(
      Math.abs(fr[1] - (fb[1] + fb[3]) / 2 - (br[1] - (bb[1] + bb[3]) / 2)) <
        0.001,
      "Duplex Y centres match.",
    );
  }
  assert.deepStrictEqual(
    mock.originals.map((i) => i.geometricBounds),
    originalBounds,
    "Sources are untouched.",
  );
  assert.strictEqual(mock.doc.artboards.length, mixed ? 2 : 14);
  assert.strictEqual(mock.doc.activeArtboardIndex, 0);
  assert(
    new Set(fronts.map((i) => i.angle)).size > 1,
    "Regression includes normal and rotated slots.",
  );
}
{
  const mock = illustrator();
  const c = vm.createContext(mock.context);
  vm.runInContext(library, c);
  mock.doc.selection = [
    mock.source([0, 100, 50, 0], "F"),
    mock.source([25, 100, 75, 0], "B"),
  ];
  assert.match(c.dcDanToiUu("33", "35.4", true, false), /^ERR:/);
  assert.strictEqual(
    mock.doc.artboards.length,
    1,
    "Ambiguous pairs fail before creating output.",
  );
  assert.strictEqual(mock.doc.layers.length, 1);
}
console.log(
  "KTS: tiny-Y inversion reproduced; left/right pairing, mixed orientations, duplex identities/mirroring, per-model sheets and unchanged sources verified.",
);
