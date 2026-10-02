const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const illustrator = require('./illustrator_geometry_mock');
const bridge = fs.readFileSync(require.resolve('../DanCardCEP/jsx/dan_be_bridge.jsx'), 'utf8');
const MM = 2.834645669;
const near = (a, b) => assert(Math.abs(a - b) < .00001, `${a} != ${b}`);
const centre = b => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
function pathItem(mock, x, y, id) {
  const item = mock.source([x, y + 30, x + 20, y], id);
  const points = [[x, y], [x + 20, y], [x + 20, y + 10], [x + 5, y + 10], [x + 5, y + 30], [x, y + 30]];
  item.setEntirePath(points); item.typename = 'PathItem'; item.closed = true;
  item.pathPoints = points.map(p => ({ anchor: p.slice(), leftDirection: p.slice(), rightDirection: p.slice() }));
  return item;
}
function sources(mock) {
  return Array.from({ length: 2 }, (_, i) => ({
    khuon: { item: pathItem(mock, 10, 200 - i * 60, 'cut' + i) },
    bai: { item: mock.source([60, 231 - i * 60, 82, 199 - i * 60], 'front' + i) },
    sau: { item: mock.source([110, 231.02 - i * 60, 132, 199.02 - i * 60], 'back' + i) },
  }));
}
function fixture(options = {}) {
  const mock = illustrator(options), c = vm.createContext(mock.context); vm.runInContext(bridge, c);
  const models = sources(mock), paperW = 330 * MM, paperH = 354 * MM;
  const dots = [[8, 10], [316, 12], [10, 343], [322, 344]].map(([x, y]) => ({ cx: x * MM, cy: y * MM, r: .375 * MM }));
  c.dcDanBeJobs.duplex = { doc: mock.doc, models, twoSided: true, MM, paperW, paperH, pon: { rect: [0, paperH, paperW, 0], dots } };
  return { ...mock, c, models, dots, paperW, paperH,
    render(layout) { return c.dcDanBeRender('duplex', JSON.stringify(layout), '{}'); } };
}
const layout = { sheets: [0, 1].map(modelIndex => ({ modelIndex,
  slots: [0, 1, 2, 3].map(vi => ({ mi: modelIndex, vi, x: 20 + vi * 50, y: 30 + vi * 20 })) })) };
for (const separate of [false, true]) {
  const f = fixture(), before = f.originals.map(it => it._points.map(p => p.slice()));
  const slotsInput = separate ? layout : layout.sheets.flatMap(s => s.slots);
  const result = f.render(slotsInput); assert.match(result, /^OK:/, result);
  if (!separate) assert.match(result, /\[\[COUNT:8\]\]/, 'Count physical tags, not the sum of both faces.');
  const sheetCount = separate ? 2 : 1;
  assert.strictEqual(f.doc.artboards.length, 1 + sheetCount * 2);
  assert.strictEqual(f.doc.layers.length, 1 + sheetCount * 6);
  for (let si = 0; si < sheetCount; si++) {
    const suffix = separate ? ' - mẫu ' + (si + 1) : '';
    const get = (role, side) => f.doc.layers.find(l => l.name === 'Dàn bế - ' + role + suffix + ' - mặt ' + side).pageItems;
    const frontCuts = get('Khuôn', 'trước'), backCuts = get('Khuôn', 'sau');
    const fronts = get('Bài', 'trước'), backs = get('Bài', 'sau');
    const fdots = get('PON', 'trước'), bdots = get('PON', 'sau');
    const fr = f.doc.artboards[1 + si * 2].artboardRect, br = f.doc.artboards[2 + si * 2].artboardRect;
    const slots = separate ? layout.sheets[si].slots : slotsInput;
    assert.strictEqual(frontCuts.length, slots.length); assert.strictEqual(backCuts.length, slots.length);
    assert.strictEqual(fronts.length, slots.length); assert.strictEqual(backs.length, slots.length);
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i], fc = centre(frontCuts[i].geometricBounds), bc = centre(backCuts[i].geometricBounds);
      assert.strictEqual(fronts[i].identity, 'front' + s.mi); assert.strictEqual(backs[i].identity, 'back' + s.mi);
      assert.strictEqual(fronts[i].angle, s.vi * 90); assert.strictEqual(backs[i].angle, s.vi ? -s.vi * 90 : 0);
      assert.strictEqual(fronts[i].reflected, false); assert.strictEqual(backs[i].reflected, false, 'Do not mirror text/image content.');
      assert.strictEqual(backCuts[i].reflected, true);
      near(fc[0] - fr[0] + bc[0] - br[0], f.paperW); near(fc[1] - fr[3], bc[1] - br[3]);
      const fa = centre(fronts[i].visibleBounds), ba = centre(backs[i].visibleBounds);
      near(fa[0], fc[0]); near(fa[1], fc[1]); near(ba[0], bc[0]); near(ba[1], bc[1]);
      // Verify every actual polygon vertex, not just identical bounding boxes.
      frontCuts[i]._points.forEach((p, j) => {
        near(backCuts[i]._points[j][0] - br[0], f.paperW - (p[0] - fr[0]));
        near(backCuts[i]._points[j][1] - br[3], p[1] - fr[3]);
      });
    }
    assert.strictEqual(fdots.length, 4); assert.strictEqual(bdots.length, 4);
    for (let i = 0; i < 4; i++) {
      const p = centre(fdots[i].geometricBounds), q = centre(bdots[i].geometricBounds);
      near(p[0] - fr[0] + q[0] - br[0], f.paperW); near(p[1] - fr[3], q[1] - br[3]);
    }
  }
  assert.deepStrictEqual(f.originals.map(it => it._points), before, 'No source is rotated, reflected, deleted or moved.');
  assert.strictEqual(f.c.app.coordinateSystem, 'user-coordinates');
}
// Selection triples remain correct despite order, z-order and tiny Y shifts.
{
  const f = fixture(), items = f.models.flatMap(m => [m.sau.item, m.khuon.item, m.bai.item]).reverse();
  const before = items.slice(), pairs = f.c.dcDanBeTripleModels(items, .01);
  assert.deepStrictEqual(Array.from(pairs, m => [m.khuon.item.identity, m.bai.item.identity, m.sau.item.identity]),
    [['cut0', 'front0', 'back0'], ['cut1', 'front1', 'back1']]);
  assert.deepStrictEqual(items, before);
  assert.throws(() => f.c.dcDanBeTripleModels(items.slice(1), .01), /bộ 3/);
  items[0].translate(0, -100);
  assert.throws(() => f.c.dcDanBeTripleModels(items, .01), /Hàng nguồn/);
}
// Exercise actual Prepare with automatic PON and unchanged source roles.
function prepareFixture(layerMode) {
  const f = fixture(); let ponPrompts = 0, externalOpens = 0;
  f.c.File = { openDialog() { ponPrompts++; throw new Error('Automatic PON must not open a chooser'); } };
  f.c.app.open = () => { externalOpens++; throw new Error('Automatic PON must not open a document'); };
  if (layerMode) {
    f.doc.selection = null;
    for (const [role, name] of [['khuon', 'Khuôn bế'], ['bai', 'Mặt trước'], ['sau', 'Mặt sau']]) {
      const layer = f.doc.layers.add(); layer.name = name;
      for (const model of f.models) { model[role].item.parent = layer; model[role].item.layer = layer; layer.pageItems.push(model[role].item); }
    }
    f.sourceLayer.pageItems = [];
  } else f.doc.selection = f.models.flatMap(m => [m.sau.item, m.bai.item, m.khuon.item]).reverse();
  const result = f.c.dcDanBePrepare('2', '4', '7.5', true);
  assert.match(result, /^OKJSON:/, result);
  const payload = JSON.parse(result.slice(7)), job = f.c.dcDanBeJobs[payload.jobId];
  assert.strictEqual(payload.twoSided, true); assert.strictEqual(job.twoSided, true);
  assert.strictEqual(payload.types.length, 2); assert.strictEqual(ponPrompts, 0);
  assert.strictEqual(externalOpens, 0); assert.strictEqual(payload.sheet.dots.length, 4);
  near(payload.sheet.widthMm, 330); near(payload.sheet.heightMm, 354);
  payload.sheet.dots.forEach(d => near(d.r, 2.5));
  for (const model of job.models) {
    const id = model.khuon.item.identity.slice(-1);
    assert.strictEqual(model.bai.item.identity, 'front' + id); assert.strictEqual(model.sau.item.identity, 'back' + id);
  }
  assert.strictEqual(f.c.app.coordinateSystem, 'user-coordinates');
  return { f, payload };
}
prepareFixture(false); prepareFixture(true);
{
  const f = fixture(); f.doc.selection = [f.models[0].khuon.item, f.models[0].bai.item];
  f.c.File = { openDialog() { throw new Error('Must fail before asking for PON'); } };
  assert.match(f.c.dcDanBePrepare('2', '4', '7.5', true), /^ERR:.*bộ 3/);
}
for (const options of [{ failDuplicateAt: 12 }, { failReflection: true }]) {
  const f = fixture(options), before = f.originals.map(it => it._points.map(p => p.slice()));
  assert.match(f.render(layout), /^ERR:/);
  assert.strictEqual(f.doc.artboards.length, 1, 'Roll back every front/back board on any face failure.');
  assert.strictEqual(f.doc.layers.length, 1);
  assert.deepStrictEqual(f.originals.map(it => it._points), before);
}
{
  const f = fixture(); delete f.models[1].sau;
  assert.match(f.render(layout), /^ERR:.*Thiếu mặt sau/);
  assert.strictEqual(f.doc.artboards.length, 1); assert.strictEqual(f.doc.layers.length, 1);
}
console.log('Dàn bế duplex: triple/3-layer preparation, locked identities, 4 rotations, mirrored asymmetric die vertices/PON, unmirrored artwork, separate/mixed pairs and rollback passed.');
