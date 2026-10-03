"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const illustrator = require("./illustrator_geometry_mock");
const bridge = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_be_bridge.jsx"),
  "utf8",
);
const MM = 2.834645669;
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);
const centre = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
const sortedDots = (dots) =>
  dots.map((d) => [d.x, d.y, d.r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
function fixture(twoSided = false) {
  const f = illustrator(),
    c = vm.createContext(f.context);
  vm.runInContext(bridge, c);
  const cut = f.source([10, 50, 30, 20], "custom-cut");
  const points = [
    [10, 20],
    [30, 20],
    [30, 30],
    [16, 30],
    [16, 50],
    [10, 50],
  ];
  cut.setEntirePath(points);
  cut.typename = "PathItem";
  cut.closed = true;
  cut.pathPoints = points.map((p) => ({
    anchor: p.slice(),
    leftDirection: p.slice(),
    rightDirection: p.slice(),
  }));
  const front = f.source([60, 51, 82, 19], "custom-front");
  const back = f.source([110, 51.01, 132, 19.01], "custom-back");
  f.doc.selection = twoSided ? [back, front, cut] : [front, cut];
  let openCalls = 0,
    dialogCalls = 0;
  c.File = {
    openDialog() {
      dialogCalls++;
      throw new Error("No PON file chooser is permitted");
    },
  };
  c.app.open = () => {
    openCalls++;
    throw new Error("No PON document open is permitted");
  };
  return {
    ...f,
    c,
    cut,
    front,
    back,
    twoSided,
    prepare(args = []) {
      return c.dcDanBePrepare("2", "4", "7.5", twoSided, ...args);
    },
    io() {
      return { openCalls, dialogCalls };
    },
  };
}
function prepared(f, args) {
  const result = f.prepare(args);
  assert.match(result, /^OKJSON:/, result);
  const payload = JSON.parse(result.slice(7)),
    job = f.c.dcDanBeJobs[payload.jobId];
  assert.ok(job);
  assert.deepEqual(f.io(), { openCalls: 0, dialogCalls: 0 });
  assert.equal(f.doc.artboards.length, 1);
  assert.equal(f.doc.layers.length, 1);
  assert.equal(f.duplicates.length, 0, "Prepare is read-only");
  assert.equal(f.c.app.coordinateSystem, "user-coordinates");
  return { payload, job };
}

// Missing custom parameters mean the documented defaults, not a file prompt.
{
  const f = fixture(),
    { payload, job } = prepared(f);
  assert.equal(f.c.dcDanBeNestingVersion, 8);
  near(payload.sheet.widthMm, 330);
  near(payload.sheet.heightMm, 354);
  const expected = [
    [10, 10, 2.5],
    [10, 344, 2.5],
    [320, 10, 2.5],
    [320, 344, 2.5],
  ];
  sortedDots(payload.sheet.dots).forEach((d, i) =>
    d.forEach((n, j) => near(n, expected[i][j])),
  );
  job.pon.rect.forEach((n, i) => near(n, [0, 354 * MM, 330 * MM, 0][i]));
}
// Paper is entered in cm; four offsets are mm from paper edge to DOT CENTRE.
const customArgs = ["42,3", "29,7", "13,25", "17,5", "21,75", "25,25"];
{
  const f = fixture(),
    { payload, job } = prepared(f, customArgs);
  near(payload.sheet.widthMm, 423);
  near(payload.sheet.heightMm, 297);
  const expected = [
    [21.75, 17.5, 2.5],
    [21.75, 283.75, 2.5],
    [397.75, 17.5, 2.5],
    [397.75, 283.75, 2.5],
  ];
  sortedDots(payload.sheet.dots).forEach((d, i) =>
    d.forEach((n, j) => near(n, expected[i][j])),
  );
  job.pon.rect.forEach((n, i) => near(n, [0, 297 * MM, 423 * MM, 0][i]));
}
// The complete 5 mm dots fit even when exactly tangent to the paper edge.
{
  const f = fixture(),
    { payload } = prepared(f, ["3", "4", "2.5", "2.5", "2.5", "2.5"]);
  for (const d of payload.sheet.dots) {
    near(d.r, 2.5);
    assert.ok(d.x >= d.r && d.y >= d.r);
    assert.ok(d.x + d.r <= 30 && d.y + d.r <= 40);
  }
}
// Opposite dots may be tangent, but they cannot overlap.
prepared(fixture(), ["3", "4", "10", "10", "12.5", "12.5"]);

const invalid = [
  ["0", "35.4", "10", "10", "10", "10"],
  ["-1", "35.4", "10", "10", "10", "10"],
  ["5001", "35.4", "10", "10", "10", "10"],
  ["33", "5001", "10", "10", "10", "10"],
  ["510", "35.4", "10", "10", "10", "10"], // Normal canvas is too narrow.
  ["33cm", "35.4", "10", "10", "10", "10"],
  ["Infinity", "35.4", "10", "10", "10", "10"],
  ["NaN", "35.4", "10", "10", "10", "10"],
  ["33", "29,7,1", "10", "10", "10", "10"],
  ["33", "35.4", "10junk", "10", "10", "10"],
  ["33", "35.4", "-1", "10", "10", "10"],
  ["33", "35.4", "2.499", "10", "10", "10"],
  ["33", "35.4", "10", "2.499", "10", "10"],
  ["33", "35.4", "10", "10", "2.499", "10"],
  ["33", "35.4", "10", "10", "10", "2.499"],
  ["33", "35.4", "355", "10", "10", "10"],
  ["3", "4", "10", "10", "13", "13"],
  ["3", "4", "10", "10", "12.5005", "12.5005"],
  ["3", "4", "18", "18", "10", "10"],
  ["3", "4", "10", "10", "20", "20"],
];
for (const args of invalid) {
  const f = fixture(),
    before = f.originals.map((i) => i._points.map((p) => p.slice())),
    counter = f.c.dcDanBeJobCounter;
  assert.match(f.prepare(args), /^ERR:/, "must reject " + JSON.stringify(args));
  assert.deepEqual(
    Object.keys(f.c.dcDanBeJobs),
    [],
    "invalid settings must not create a job",
  );
  assert.equal(
    f.c.dcDanBeJobCounter,
    counter,
    "invalid settings must not consume a job id",
  );
  assert.equal(f.doc.layers.length, 1);
  assert.equal(f.doc.artboards.length, 1);
  assert.equal(f.duplicates.length, 0);
  assert.deepEqual(
    f.originals.map((i) => i._points),
    before,
  );
  assert.deepEqual(f.io(), { openCalls: 0, dialogCalls: 0 });
  assert.equal(f.c.app.coordinateSystem, "user-coordinates");
}

for (let field = 0; field < 3; field++) {
  const f = fixture(),
    controls = ["2", "4", "7.5"];
  controls[field] += "mm";
  const result = f.c.dcDanBePrepare(
    ...controls,
    false,
    "33",
    "35.4",
    "10",
    "10",
    "10",
    "10",
  );
  assert.match(
    result,
    /^ERR:/,
    "gap/margin/PON clearance must reject numeric suffixes",
  );
  assert.deepEqual(Object.keys(f.c.dcDanBeJobs), []);
  assert.equal(f.duplicates.length, 0);
  assert.equal(f.doc.layers.length, 1);
  assert.equal(f.doc.artboards.length, 1);
  assert.deepEqual(f.io(), { openCalls: 0, dialogCalls: 0 });
}

// Duplex width includes both faces and their 10 mm gap. Reject before nesting;
// the same large sheet is valid in a scaled Large Canvas document.
{
  const f = fixture(true);
  assert.match(
    f.prepare(["260", "35.4", "10", "10", "10", "10"]),
    /^ERR:.*canvas/i,
  );
  assert.deepEqual(Object.keys(f.c.dcDanBeJobs), []);
  assert.equal(f.duplicates.length, 0);
  f.doc.scaleFactor = 0.1;
  prepared(f, ["260", "35.4", "10", "10", "10", "10"]);
}

// Render an actual custom Prepare job; every face gets four 5 mm dots and the
// asymmetric positions mirror horizontally, while image/text are not reflected.
{
  const f = fixture(true),
    { payload } = prepared(f, customArgs);
  const slots = [0, 1, 2, 3].map((vi) => ({
    mi: 0,
    vi,
    x: 40 + vi * 70,
    y: 40 + vi * 25,
  }));
  const result = f.c.dcDanBeRender(payload.jobId, JSON.stringify(slots), "{}");
  assert.match(result, /^OK:/, result);
  assert.match(result, /\[\[COUNT:4\]\]/);
  assert.equal(f.doc.artboards.length, 2);
  assert.equal(f.doc.layers.length, 7);
  const fr = f.doc.artboards[0].artboardRect,
    br = f.doc.artboards[1].artboardRect;
  const get = (role, side) =>
    f.doc.layers.find((l) => l.name === `Dàn bế - ${role} - mặt ${side}`)
      .pageItems;
  const fdots = get("PON", "trước"),
    bdots = get("PON", "sau");
  assert.equal(fdots.length, 4);
  assert.equal(bdots.length, 4);
  for (let i = 0; i < 4; i++) {
    const a = centre(fdots[i].geometricBounds),
      b = centre(bdots[i].geometricBounds);
    near(a[0] - fr[0] + b[0] - br[0], 423 * MM);
    near(a[1] - fr[3], b[1] - br[3]);
    for (const dot of [fdots[i], bdots[i]]) {
      const bounds = dot.geometricBounds;
      near(bounds[2] - bounds[0], 5 * MM);
      near(bounds[1] - bounds[3], 5 * MM);
    }
  }
  const fronts = get("Bài", "trước"),
    backs = get("Bài", "sau");
  assert.equal(fronts.length, 4);
  assert.equal(backs.length, 4);
  for (let i = 0; i < 4; i++) {
    assert.equal(fronts[i].identity, "custom-front");
    assert.equal(backs[i].identity, "custom-back");
    assert.equal(fronts[i].reflected, false);
    assert.equal(backs[i].reflected, false);
  }
  assert.deepEqual(f.io(), { openCalls: 0, dialogCalls: 0 });
}
console.log(
  "Custom sheet/automatic PON: defaults, comma decimals, asymmetric centre offsets, full 5 mm dots, overlap/junk rejection without writes, and duplex mirroring passed.",
);
