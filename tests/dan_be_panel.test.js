const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Exercise the actual production helpers and click handler, without booting
// unrelated tabs, animations, or Illustrator. No implementation is copied.
const main = fs.readFileSync(path.join(__dirname, '../DanCardCEP/js/main.js'), 'utf8');
function between(start, end) {
  const a = main.indexOf(start);
  const b = main.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'Production panel block anchors must remain valid.');
  return main.slice(a, b);
}
const production = between('  function jsStr(s)', '  function loadResizeJsx()') +
  between('  var btnDanBe = document.getElementById("btnDanBe");', '  var btnCopyToiUuNote =');
const clone = value => JSON.parse(JSON.stringify(value));

function panel(options = {}) {
  const expressions = [];
  const timers = [];
  const statuses = [];
  const nestCalls = [];
  const nodes = {
    btnDanBe: { disabled: false, addEventListener(type, fn) {
      assert.strictEqual(type, 'click');
      this.click = fn;
    } },
    outDanBe: {},
    beGap: { value: options.gap === undefined ? '1.25' : options.gap },
    beMargin: { value: options.margin === undefined ? '5.5' : options.margin },
    bePonClear: { value: options.pon === undefined ? '8.75' : options.pon },
  };
  const context = vm.createContext({
    document: { getElementById: id => nodes[id] || null },
    cs: {
      getSystemPath: () => "C:\\Users\\ADMIN\\Extensions\\Lộc's tool",
      evalScript(expression, callback) { expressions.push({ expression, callback }); },
    },
    SystemPath: { EXTENSION: 'extension' },
    show(element, message) {
      assert.strictEqual(element, nodes.outDanBe);
      statuses.push(String(message));
    },
    showCountResult(element, message) {
      assert.strictEqual(element, nodes.outDanBe);
      statuses.push(String(message));
    },
    window: {
      setTimeout(fn, delay) {
        assert.strictEqual(delay, 20, 'Search must yield once for status repaint.');
        timers.push(fn);
      },
    },
    // Healthy persistent Illustrator engine: evaluating the generated script
    // must not reload files or call any unrelated native operation.
    dcDanToiUu() {},
    dcCopyToiUuNoteToOddArtboards() {},
    dcDanToiUuVersion: 15,
    dcDanBeNestingVersion: 4,
    dcDanBePrepare(...args) { context.prepareArguments = args; },
    dcDanBeRender(...args) { context.renderArguments = args; },
    $: { evalFile() { throw new Error('Unexpected Illustrator file reload.'); } },
  });
  if (!options.missingNester) {
    context.window.DanBeNester = { nest(payload) {
      assert.strictEqual(expressions.length, 1,
        'Contour search runs in Chromium, before any native render call.');
      nestCalls.push(clone(payload));
      if (options.throwNester) throw new Error('bounded test search failure');
      return options.result === undefined ? {
        ok: true,
        count: 2,
        slots: [{ mi: 0, vi: 1, x: 3.25, y: 5, angle: 90 }, { mi: 0, vi: 3, x: 12, y: 17, angle: 270 }],
        detail: "Né PON: C:\\Khuôn\\Bài 'đã tràn'\n2 con",
        mode: 'lồng khuôn "90° / 270°"',
      } : options.result;
    } };
  }
  vm.runInContext(production, context, { filename: 'production-main-dan-be.js' });
  return {
    context, nodes, expressions, timers, statuses, nestCalls,
    click() { nodes.btnDanBe.click(); },
    prepare(response) {
      assert.strictEqual(expressions.length, 1);
      vm.runInContext(expressions[0].expression, context);
      expressions[0].callback(response);
    },
    tick() {
      assert.strictEqual(timers.length, 1);
      timers.shift()();
    },
    render(response) {
      assert.strictEqual(expressions.length, 2);
      vm.runInContext(expressions[1].expression, context);
      expressions[1].callback(response);
    },
  };
}

const payload = {
  jobId: "danbe_C:\\Khuôn\\Lộc's \"bài\"",
  gapMm: 1.25, marginMm: 5.5, ponClearMm: 8.75,
  sheet: { widthMm: 330, heightMm: 354, dots: [{ x: 10, y: 10, r: 2.5 }] },
  types: [{ groups: [[[[0, 0], [10, 0], [10, 10], [0, 10]]]] }],
};
const prepared = 'OKJSON:' + JSON.stringify(payload);

{
  const p = panel();
  p.click();
  assert.strictEqual(p.nodes.btnDanBe.disabled, true);
  p.prepare(prepared);
  assert.deepStrictEqual(clone(p.context.prepareArguments), ['1.25', '5.5', '8.75']);
  assert.strictEqual(p.nestCalls.length, 0, 'Search must wait for the repaint yield.');
  assert.strictEqual(p.nodes.btnDanBe.disabled, true);
  p.tick();
  assert.deepStrictEqual(p.nestCalls, [payload], 'Prepared geometry is parsed and passed intact.');
  assert.strictEqual(p.nodes.btnDanBe.disabled, true);
  p.render('OK:[[COUNT:2]] Dàn bế xong.');
  const [jobId, slotsText, reportText] = p.context.renderArguments;
  assert.strictEqual(jobId, payload.jobId, 'Native expression preserves quotes, slashes, and Unicode.');
  assert.deepStrictEqual(JSON.parse(slotsText), [
    { mi: 0, vi: 1, x: 3.25, y: 5, angle: 90 },
    { mi: 0, vi: 3, x: 12, y: 17, angle: 270 },
  ]);
  assert.deepStrictEqual(JSON.parse(reportText), {
    detail: "Né PON: C:\\Khuôn\\Bài 'đã tràn'\n2 con",
    mode: 'lồng khuôn "90° / 270°"',
  });
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
  assert.strictEqual(p.statuses.at(-1), 'OK:[[COUNT:2]] Dàn bế xong.');
}

{
  const p = panel({ gap: '', margin: '', pon: '' });
  p.click();
  p.prepare('ERR: Đã hủy chọn PON.');
  assert.deepStrictEqual(clone(p.context.prepareArguments), ['2', '4', '7.5']);
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
  assert.strictEqual(p.statuses.at(-1), 'ERR: Đã hủy chọn PON.');
  assert.strictEqual(p.timers.length, 0);
}

for (const response of ['OKJSON:{invalid', '', 'ERR: Không đọc được khuôn.']) {
  const p = panel();
  p.click();
  p.prepare(response);
  assert.strictEqual(p.nodes.btnDanBe.disabled, false, 'Prepare failure restores the button.');
  assert.strictEqual(p.nestCalls.length, 0);
  assert.strictEqual(p.timers.length, 0);
  assert.strictEqual(p.expressions.length, 1);
}

{
  const p = panel({ missingNester: true });
  p.click();
  p.prepare(prepared);
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
  assert.strictEqual(p.timers.length, 0);
  assert.match(p.statuses.at(-1), /^ERR:/);
}

for (const options of [{ throwNester: true }, { result: { ok: false, error: 'Không còn vùng hợp lệ.' } }, { result: null }]) {
  const p = panel(options);
  p.click();
  p.prepare(prepared);
  p.tick();
  assert.strictEqual(p.nodes.btnDanBe.disabled, false, 'Search failure restores the button.');
  assert.strictEqual(p.expressions.length, 1, 'Failed search must not render.');
  assert.match(p.statuses.at(-1), /^ERR:/);
}

{
  const p = panel();
  p.click();
  p.prepare(prepared);
  p.tick();
  p.render('ERR: Không thể tạo layer đầu ra.');
  assert.strictEqual(p.nodes.btnDanBe.disabled, false);
  assert.strictEqual(p.statuses.at(-1), 'ERR: Không thể tạo layer đầu ra.');
}

// Each JSX is loaded independently. No legacy dcDanBe/version is required.
for (const scenario of [
  { remove: [], expected: [] },
  { remove: ['dcDanToiUu'], expected: ['dan_card_lib.jsx'] },
  { remove: ['dcDanBePrepare'], expected: ['dan_be_bridge.jsx'] },
  { remove: ['dcDanBeRender'], expected: ['dan_be_bridge.jsx'] },
  { remove: ['dcDanBeNestingVersion'], expected: ['dan_be_bridge.jsx'] },
  { remove: ['dcDanToiUu', 'dcDanBePrepare'], expected: ['dan_card_lib.jsx', 'dan_be_bridge.jsx'] },
  { remove: [], bridgeVersion: 3, expected: ['dan_be_bridge.jsx'] },
  { remove: [], libraryVersion: 14, expected: ['dan_card_lib.jsx'] },
]) {
  const p = panel();
  const loaded = [];
  p.context.$.evalFile = filename => loaded.push(filename.split('/').at(-1));
  for (const name of scenario.remove) delete p.context[name];
  if (scenario.bridgeVersion !== undefined) p.context.dcDanBeNestingVersion = scenario.bridgeVersion;
  if (scenario.libraryVersion !== undefined) p.context.dcDanToiUuVersion = scenario.libraryVersion;
  vm.runInContext(vm.runInContext('loadDanToiUuJsx()', p.context), p.context);
  assert.deepStrictEqual(loaded, scenario.expected, 'Load only the JSX whose functions/version are missing.');
}

console.log('Production Dàn bế panel: independent JSX loading without legacy code, editable inputs, Chromium search, safe native expressions, and all failure recovery paths passed.');
