const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const illustrator = require("./illustrator_geometry_mock");
const bridge = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_be_bridge.jsx"),
  "utf8",
);
const MM = 2.834645669;
const close = (a, b) => assert(Math.abs(a - b) < 0.00001, `${a} != ${b}`);
const centre = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
function fixture(options = {}) {
  const mock = illustrator(options),
    c = vm.createContext(mock.context);
  vm.runInContext(bridge, c);
  const origin = options.rect ? options.rect[0] : 0;
  const models = Array.from({ length: 2 }, (_, i) => ({
    khuon: { item: mock.source([origin + 10, 50, origin + 30, 20], "cut" + i) },
    bai: { item: mock.source([origin + 40, 51, origin + 62, 19], "art" + i) },
  }));
  const rect = [-100, 400, -100 + 330 * MM, 400 - 354 * MM];
  const dots = [
    [8, 10],
    [322, 10],
    [8, 344],
    [322, 344],
  ].map(([x, y]) => ({
    cx: rect[0] + x * MM,
    cy: rect[3] + y * MM,
    r: 0.375 * MM,
  }));
  c.dcDanBeJobs.test = {
    doc: mock.doc,
    models,
    pon: { rect, dots },
    paperW: 330 * MM,
    paperH: 354 * MM,
    MM,
  };
  return {
    ...mock,
    c,
    models,
    dots,
    ponRect: rect,
    render(layout) {
      return c.dcDanBeRender(
        "test",
        JSON.stringify(layout),
        JSON.stringify({ detail: "Mixed test sheet" }),
      );
    },
  };
}
const perModel = {
  sheets: [
    {
      modelIndex: 0,
      slots: [
        { mi: 0, vi: 0, x: 10, y: 10 },
        { mi: 0, vi: 1, x: 30, y: 50 },
      ],
    },
    {
      modelIndex: 1,
      slots: [
        { mi: 1, vi: 2, x: 10, y: 10 },
        { mi: 1, vi: 3, x: 30, y: 50 },
      ],
    },
  ],
};
function audit(f, expectedSheets) {
  assert.strictEqual(f.doc.artboards.length, expectedSheets);
  assert.strictEqual(f.doc.layers.length, expectedSheets * 3 + 1);
  const outputs = f.doc.layers.filter((l) => l.note === "DANCARD_DANBE_OUTPUT");
  for (let si = 0; si < expectedSheets; si++) {
    const board = f.doc.artboards[si],
      rect = board.artboardRect;
    close(rect[2] - rect[0], 330 * MM);
    close(rect[1] - rect[3], 354 * MM);
    const suffix = expectedSheets > 1 ? " - mẫu " + (si + 1) : "";
    const cuts = outputs.find(
      (l) => l.name === "Dàn bế - Khuôn" + suffix,
    ).pageItems;
    const arts = outputs.find(
      (l) => l.name === "Dàn bế - Bài" + suffix,
    ).pageItems;
    const dots = outputs.find(
      (l) => l.name === "Dàn bế - PON" + suffix,
    ).pageItems;
    assert.strictEqual(cuts.length, 2);
    assert.strictEqual(arts.length, 2);
    assert.strictEqual(dots.length, 4);
    for (let i = 0; i < 2; i++) {
      assert.strictEqual(cuts[i].identity.slice(3), arts[i].identity.slice(3));
      if (expectedSheets > 1)
        assert.strictEqual(
          cuts[i].identity,
          "cut" + si,
          "A separate sheet contains only its own model.",
        );
      assert.strictEqual(cuts[i].angle, arts[i].angle);
      const k = centre(cuts[i].geometricBounds),
        a = centre(arts[i].visibleBounds);
      close(k[0], a[0]);
      close(k[1], a[1]);
      if (expectedSheets > 1) {
        close(
          cuts[i].geometricBounds[0],
          rect[0] + perModel.sheets[si].slots[i].x * MM,
        );
        close(
          cuts[i].geometricBounds[3],
          rect[3] + perModel.sheets[si].slots[i].y * MM,
        );
      }
    }
    for (let i = 0; i < 4; i++) {
      const pos = centre(dots[i].geometricBounds);
      close(pos[0], rect[0] + f.dots[i].cx - f.ponRect[0]);
      close(pos[1], rect[3] + f.dots[i].cy - f.ponRect[3]);
      close(dots[i].geometricBounds[2] - dots[i].geometricBounds[0], 0.75 * MM);
    }
  }
  assert.strictEqual(f.doc.activeArtboardIndex, 0);
  assert.strictEqual(f.c.app.coordinateSystem, "user-coordinates");
  assert.strictEqual(f.c.dcDanBeJobs.test, undefined);
}
{
  const f = fixture(),
    before = f.originals.map((i) => i.geometricBounds);
  const result = f.render(perModel);
  assert.match(result, /^OK: Đã tạo 2 artboard riêng; tổng 4 con\./);
  assert(
    !result.includes("[[COUNT:"),
    "Do not label the total as a per-sheet count.",
  );
  audit(f, 2);
  assert.deepStrictEqual(
    f.originals.map((i) => i.geometricBounds),
    before,
  );
}
{
  const f = fixture();
  assert.match(
    f.render([perModel.sheets[0].slots[0], perModel.sheets[1].slots[0]]),
    /^OK:\[\[COUNT:2\]\]/,
  );
  audit(f, 1);
}
{
  const canvasLeft = -7200 + 10 * MM,
    canvasTop = 7200 - 10 * MM;
  // The KTS-style allocator now starts at the canvas upper-left, not beside
  // source artwork. A full-width printed strip blocks the first canvas row.
  const f = fixture({
    rect: [canvasLeft, canvasTop, 7200 - 10 * MM, canvasTop - 354 * MM],
  });
  assert.match(f.render(perModel), /^OK:/);
  audit(f, 2);
  const rects = f.doc.artboards.map((a) => a.artboardRect);
  assert(
    rects.every(
      (r) =>
        r[0] >= canvasLeft && r[2] <= 7200 - 10 * MM && r[3] >= -7200 + 10 * MM,
    ),
  );
  close(rects[0][0], canvasLeft);
  close(rects[0][1], canvasTop - 354 * MM - 10 * MM);
  close(rects[1][1], rects[0][1]);
  close(rects[1][0], rects[0][2] + 10 * MM);
}
for (const invalid of [
  [],
  null,
  {},
  { sheets: [] },
  { sheets: [perModel.sheets[0]] },
  { sheets: [perModel.sheets[0], perModel.sheets[0]] },
  {
    sheets: [
      perModel.sheets[0],
      { modelIndex: 1, slots: perModel.sheets[0].slots },
    ],
  },
  [{ mi: 0.5, vi: 0, x: 1, y: 1 }],
  [{ mi: 0, vi: 4, x: 1, y: 1 }],
  [{ mi: 0, vi: 0, x: -1, y: 1 }],
  [{ mi: 0, vi: 0, x: 330, y: 1 }],
  [{ mi: 0, vi: 0, x: null, y: 1 }],
  [null],
]) {
  const f = fixture();
  assert.match(f.render(invalid), /^ERR:/);
  assert.strictEqual(
    f.doc.artboards.length,
    1,
    "Invalid batch does not create any sheet.",
  );
  assert.strictEqual(f.doc.layers.length, 1);
  assert.strictEqual(f.c.app.coordinateSystem, "user-coordinates");
  assert.strictEqual(f.c.dcDanBeJobs.test, undefined);
}
{
  const f = fixture({ failDuplicateAt: 6 });
  const originals = f.originals.map((i) => i.geometricBounds);
  assert.match(f.render(perModel), /^ERR:.*Injected duplicate failure/);
  assert.strictEqual(
    f.doc.artboards.length,
    1,
    "A later sheet failure rolls back all new sheets.",
  );
  assert.strictEqual(
    f.doc.layers.length,
    1,
    "Only newly created layers are removed.",
  );
  assert.strictEqual(f.doc.activeLayer, f.sourceLayer);
  assert.deepStrictEqual(
    f.originals.map((i) => i.geometricBounds),
    originals,
  );
  assert.strictEqual(f.c.app.coordinateSystem, "user-coordinates");
}
console.log(
  "Dàn bế sheets: separate/mixed mode, 4 rotations, die/art centres, 4 PON per board, wrapping, validation and full rollback verified.",
);
