const assert = require("assert"),
  fs = require("fs"),
  vm = require("vm");
const lib = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const from = lib.indexOf("function dcDanTheoMauOutputPositions(");
const to = lib.indexOf("function dcApMau(", from);
const context = vm.createContext({});
vm.runInContext(lib.slice(from, to), context);
const MM = 2.834645669,
  GAP = 10 * MM;
const plain = (value) => JSON.parse(JSON.stringify(value));
const near = (a, b) => assert(Math.abs(a - b) < 0.00001, `${a} != ${b}`);
function plan({
  w = 600,
  h = 400,
  bw = null,
  bh = null,
  n = 1,
  scale = 1,
  boards = [],
  source = null,
  canvas = null,
} = {}) {
  return plain(
    context.dcDanTheoMauOutputPositions(
      w,
      h,
      bw,
      bh,
      n,
      scale,
      boards,
      source,
      canvas,
    ),
  );
}
function safe(scale = 1) {
  const half = scale > 0 && scale < 1 ? 7200 / scale : 7200;
  return [-half + GAP, half - GAP, half - GAP, -half + GAP];
}
function inside(rect, area) {
  assert(
    rect[0] >= area[0] - 0.01 &&
      rect[1] <= area[1] + 0.01 &&
      rect[2] <= area[2] + 0.01 &&
      rect[3] >= area[3] - 0.01,
    `Outside canvas: ${rect}`,
  );
}
function overlaps(a, b) {
  return (
    a[0] < b[2] - 0.01 &&
    a[2] > b[0] + 0.01 &&
    a[3] < b[1] - 0.01 &&
    a[1] > b[3] + 0.01
  );
}
{
  const area = safe(),
    positions = plan({ n: 26 });
  near(positions[0].frontRect[0], area[0]);
  near(positions[0].frontRect[1], area[1]);
  for (let i = 0; i < positions.length; i++) {
    const rect = positions[i].frontRect;
    near(rect[0], area[0] + (i % 22) * (600 + GAP));
    near(rect[1], area[1] - Math.floor(i / 22) * (400 + GAP));
    inside(rect, area);
    assert.strictEqual(positions[i].backRect, null);
  }
}
for (const scale of [1, 0.1]) {
  const area = safe(scale),
    w = (area[2] - area[0] - 3 * GAP) / 4;
  const positions = plan({ w, h: 400, bw: w, bh: 550, n: 7, scale });
  for (let i = 0; i < positions.length; i++) {
    const { frontRect: f, backRect: b } = positions[i];
    near(f[0], area[0] + (i % 2) * (2 * w + 2 * GAP));
    near(f[1], area[1] - Math.floor(i / 2) * (550 + GAP));
    near(b[0], f[2] + GAP);
    near(b[1], f[1]);
    near(b[1] - b[3], 550);
    inside(f, area);
    inside(b, area);
  }
}
{
  const positions = plan({ bw: 450, bh: 500, n: 14 }),
    area = safe();
  near(positions[0].backRect[0], positions[0].frontRect[2] + GAP);
  near(positions[0].backRect[2] - positions[0].backRect[0], 450);
  near(positions[12].frontRect[0], area[0]);
  near(positions[12].frontRect[1], area[1] - 500 - GAP);
}
{
  const first = plan()[0].frontRect,
    boards = [first.slice()],
    source = first.slice();
  const before = plain({ boards, source }),
    next = plan({ boards, source })[0].frontRect;
  near(next[0], first[2] + GAP);
  assert(!overlaps(first, next));
  assert.deepStrictEqual(
    { boards, source },
    before,
    "Planning must not mutate existing artboards/source.",
  );
  const outsideSource = [
    first[0] + 20,
    first[1] - 20,
    first[0] + 200,
    first[1] - 200,
  ];
  const protectedRect = plan({ source: outsideSource })[0].frontRect;
  near(protectedRect[0], outsideSource[2] + GAP);
  assert(!overlaps(protectedRect, outsideSource));
}
{
  const area = safe(),
    [first] = plan({ boards: [[-7200, 7200, 7200, -7200]] });
  near(first.frontRect[0], area[0]);
  near(first.frontRect[1], area[1]);
  const strip = [area[0], area[1], area[2], area[1] - 400];
  const [wrapped] = plan({ boards: [strip] });
  near(wrapped.frontRect[0], area[0]);
  near(wrapped.frontRect[1], area[1] - 400 - GAP);
}
{
  const area = safe(),
    w = area[2] - area[0],
    h = area[1] - area[3];
  for (const options of [
    { w: w + 1 },
    { h: h + 1 },
    { w: w / 2, bw: w / 2, bh: 400 },
    { w: NaN },
    { bw: 100, bh: 0 },
    { n: 0 },
    { n: 1.5 },
    { w, h, n: 2 },
  ])
    assert.throws(() => plan(options), /canvas/i);
  const boards = [
    [area[0], area[1], 0, area[3]],
    [0, area[1], area[2], area[3]],
  ];
  assert.throws(
    () => plan({ boards }),
    /canvas/i,
    "A full canvas fails before creating any sheet.",
  );
}
const core = lib.slice(
  lib.indexOf("function dcApMauCore("),
  lib.indexOf("//  dcAutoSavePDF", from),
);
assert(
  core.indexOf("addAB(jobs[ji]") <
    core.indexOf("clearPreviousOutput(outLayer, keep)"),
  "Do not clear previous output before all artboards have been created.",
);
assert.match(
  core,
  /doc\.artboards\.remove\(ai\)/,
  "Roll back artboards on creation failure.",
);
assert.doesNotMatch(core, /ARTBOARDS_PER_COLUMN|var startCx = ponF/);
// Saved-AI canvas reading is bounded/read-only and tracks changed ruler origins.
const readFrom = lib.indexOf("function dcDanTheoMauReadCanvasBounds(");
for (const scale of [1, 0.1]) {
  let header =
      "%AI3_TemplateBox: 510.5 149.5 510.5 149.5\n%%PageOrigin:204 -246\n",
    closed = 0;
  function File() {
    this.exists = true;
    this.name = "source.ai";
    this.open = () => true;
    this.read = (count) => {
      assert.strictEqual(count, 1024 * 1024);
      return header;
    };
    this.close = () => {
      closed++;
    };
  }
  const doc = {
    fullName: "source.ai",
    scaleFactor: scale,
    pageOrigin: [4204, -5946],
    rulerOrigin: [0, 0],
  };
  const before = plain(doc),
    native = vm.createContext({ File });
  vm.runInContext(lib.slice(readFrom, from), native);
  const canvas = plain(native.dcDanTheoMauReadCanvasBounds(doc));
  assert.deepStrictEqual(canvas, [
    4510.5 - 7200 / scale,
    -5550.5 + 7200 / scale,
    4510.5 + 7200 / scale,
    -5550.5 - 7200 / scale,
  ]);
  assert.deepStrictEqual(doc, before);
  assert.strictEqual(closed, 1);
  const [position] = plan({ canvas });
  near(position.frontRect[0], canvas[0] + GAP);
  near(position.frontRect[1], canvas[1] - GAP);
  header = "%AI3_TemplateBox: 0 0 400 300\n%%PageOrigin: 204 -246\n";
  assert.strictEqual(
    native.dcDanTheoMauReadCanvasBounds(doc),
    null,
    "Do not mistake actual template bounds for a canvas centre.",
  );
  header = "missing metadata";
  assert.strictEqual(native.dcDanTheoMauReadCanvasBounds(doc), null);
  assert.strictEqual(
    native.dcDanTheoMauReadCanvasBounds({}),
    null,
    "Unsaved/unsupported files use the guarded KTS fallback.",
  );
}
assert.doesNotMatch(
  lib.slice(readFrom, from),
  /artboards\.(add|remove)|rulerOrigin\s*=/,
  "Canvas detection must never mutate/probe artboards or the user ruler.",
);
console.log(
  "Dàn theo mẫu canvas: KTS corner, horizontal wrapping, 10 mm spacing, source/board protection, unequal duplex sizes, Large Canvas and exhausted-canvas preflight passed.",
);
