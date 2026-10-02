const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const illustrator = require('./illustrator_geometry_mock');
const bridge = fs.readFileSync(require.resolve('../DanCardCEP/jsx/dan_be_bridge.jsx'), 'utf8');
const MM = 2.834645669, GAP = 10 * MM;
const near = (a, b) => assert(Math.abs(a - b) < .00001, `${a} != ${b}`);
const plain = value => JSON.parse(JSON.stringify(value));
const c = vm.createContext({});
vm.runInContext(bridge, c);
assert.strictEqual(typeof c.dcDanBeOutputPositions, 'function', 'Canvas planning is a pure helper, not an Illustrator mutation.');
function positions({ w = 330 * MM, h = 354 * MM, two = false, count = 1,
  scale = 1, boards = [], source = null } = {}) {
  return plain(c.dcDanBeOutputPositions(w, h, two, count, scale, boards, source, MM));
}
function bounds(scale = 1) {
  const half = scale > 0 && scale < 1 ? 7200 / scale : 7200;
  return [-half + GAP, half - GAP, half - GAP, -half + GAP];
}
function inside(rect, safe) {
  assert(rect[0] >= safe[0] - .01 && rect[1] <= safe[1] + .01 &&
    rect[2] <= safe[2] + .01 && rect[3] >= safe[3] - .01, `Outside canvas: ${rect}`);
}
function overlaps(a, b) {
  return a[0] < b[2] - .01 && a[2] > b[0] + .01 && a[3] < b[1] - .01 && a[1] > b[3] + .01;
}
{
  const safe = bounds(), [first, second] = positions({ count: 2 });
  near(first[0], safe[0]); near(first[1], safe[1]);
  near(first[2] - first[0], 330 * MM); near(first[1] - first[3], 354 * MM);
  near(second[0], first[2] + GAP); near(second[1], first[1]);
  inside(first, safe); inside(second, safe);
}
{
  const [prior] = positions(), before = plain(prior), boards = [prior];
  const [next] = positions({ boards });
  near(next[0], prior[2] + GAP); near(next[1], prior[1]);
  assert.deepStrictEqual(boards, [before], 'Existing output/artboard rectangles remain untouched.');
  assert(!overlaps(next, prior));
}
{
  const [first] = positions(), source = [first[0] + 1, first[1] - 1, first[0] + 200, first[1] - 200];
  const before = source.slice(), [protectedPosition] = positions({ source });
  near(protectedPosition[0], source[2] + GAP);
  assert(!overlaps(protectedPosition, source), 'Selected source artwork outside any artboard is protected.');
  assert.deepStrictEqual(source, before);
  const [covered] = positions({ boards: [first], source });
  near(covered[0], first[2] + GAP);
}
{
  const canvas = [-7200, 7200, 7200, -7200], before = plain(canvas);
  const [first] = positions({ boards: [canvas] }), safe = bounds();
  near(first[0], safe[0]); near(first[1], safe[1]);
  assert.deepStrictEqual(canvas, before, 'A whole-canvas work artboard is ignored, not moved/deleted.');
  // The 92% exception requires both dimensions; a wide printed strip blocks.
  const strip = [safe[0], safe[1], safe[2], safe[1] - 354 * MM];
  const [wrapped] = positions({ boards: [strip] });
  near(wrapped[0], safe[0]); near(wrapped[1], safe[1] - 354 * MM - GAP);
}
for (const scale of [1, .1]) {
  const safe = bounds(scale), w = (safe[2] - safe[0] - 3 * GAP) / 4;
  const h = 354 * MM, two = true, planned = positions({ w, h, two, count: 5, scale });
  for (let i = 0; i < planned.length; i++) {
    const front = planned[i], back = [front[2] + GAP, front[1], front[2] + GAP + w, front[3]];
    inside(front, safe); inside(back, safe);
    near(front[0], safe[0] + (i % 2) * (2 * w + 2 * GAP));
    near(front[1], safe[1] - Math.floor(i / 2) * (h + GAP));
    near(back[1], front[1]); near(back[3], front[3]);
    for (let j = 0; j < i; j++) {
      const prior = planned[j], bundle = [prior[0], prior[1], prior[2] + GAP + w, prior[3]];
      assert(!overlaps(front, bundle) && !overlaps(back, bundle), 'Keep each front/back bundle together while wrapping.');
    }
  }
  const [first] = positions({ scale }); near(first[0], safe[0]); near(first[1], safe[1]);
}
{
  const safe = bounds(), width = safe[2] - safe[0], height = safe[1] - safe[3];
  assert.throws(() => positions({ w: width + 1 }), /canvas|khổ|tờ|kích thước/i);
  assert.throws(() => positions({ w: width / 2, two: true }), /canvas|khổ|tờ|kích thước/i);
  assert.throws(() => positions({ h: height + 1 }), /canvas|khổ|tờ|kích thước/i);
  assert.throws(() => positions({ w: width, h: height, count: 2 }), /canvas/i, 'Plan the entire batch before creating any output.');
}
// Actual renderer must consume the helper without transforming source objects.
function renderFixture(options = {}) {
  const mock = illustrator(options), context = vm.createContext(mock.context);
  vm.runInContext(bridge, context);
  const models = [0, 1].map(i => ({
    khuon: { item: mock.source([10, 50, 30, 20], 'cut' + i) },
    bai: { item: mock.source([40, 51, 62, 19], 'front' + i) },
    sau: { item: mock.source([70, 51, 92, 19], 'back' + i) },
  }));
  const paperW = options.paperW || 330 * MM, paperH = options.paperH || 354 * MM;
  const dots = [[10, 10], [320, 10], [10, 344], [320, 344]].map(([x, y]) =>
    ({ cx: x * MM, cy: y * MM, r: 2.5 * MM }));
  context.dcDanBeJobs.canvas = { doc: mock.doc, models, twoSided: options.two === true,
    MM, paperW, paperH, pon: { rect: [0, paperH, paperW, 0], dots } };
  return { ...mock, context, models, paperW, paperH,
    render() { return context.dcDanBeRender('canvas', JSON.stringify({ sheets: [0, 1].map(modelIndex =>
      ({ modelIndex, slots: [{ mi: modelIndex, vi: 0, x: 10, y: 10 }] })) }), '{}'); } };
}
for (const scaleFactor of [1, .1]) {
  const f = renderFixture({ two: true, scaleFactor }), before = f.originals.map(it => it._points.map(p => p.slice()));
  assert.match(f.render(), /^OK:/);
  const rects = f.doc.artboards.slice(1).map(a => a.artboardRect), safe = bounds(scaleFactor);
  near(rects[0][0], safe[0]); near(rects[0][1], safe[1]);
  for (let i = 0; i < rects.length; i += 2) {
    near(rects[i + 1][0], rects[i][2] + GAP); near(rects[i + 1][1], rects[i][1]);
    inside(rects[i], safe); inside(rects[i + 1], safe);
  }
  assert.deepStrictEqual(f.originals.map(it => it._points), before);
  assert.strictEqual(f.context.app.coordinateSystem, 'user-coordinates');
}
{
  // The first sheet could fit but the second cannot; no partial output survives.
  const safe = bounds(), f = renderFixture({ paperW: 6000, paperH: safe[1] - safe[3] });
  // A narrow blocker leaves room for exactly one huge first-row sheet.
  f.doc.artboards[0].artboardRect = [-1000, safe[1], safe[2], safe[3]];
  const before = f.originals.map(it => it._points.map(p => p.slice()));
  assert.match(f.render(), /^ERR:.*canvas/i);
  assert.strictEqual(f.doc.artboards.length, 1);
  assert.strictEqual(f.doc.layers.length, 1);
  assert.strictEqual(f.doc.activeLayer, f.sourceLayer);
  assert.deepStrictEqual(f.originals.map(it => it._points), before);
  assert.strictEqual(f.context.app.coordinateSystem, 'user-coordinates');
}
console.log('Dàn bế canvas: KTS upper-left start, 10 mm spacing, occupied/source protection, atomic duplex wrapping, Large Canvas and all-or-nothing output verified.');
