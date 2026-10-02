const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('DanCardCEP/index.html');
const main = read('DanCardCEP/js/main.js');
const library = read('DanCardCEP/jsx/dan_card_lib.jsx');
const bridge = read('DanCardCEP/jsx/dan_be_bridge.jsx');

for (const removed of ['btnDecal', 'outDecal', 'decalSize', 'decalPon', 'acc-decal']) {
  assert(!html.includes(removed), 'Removed legacy decal controls: ' + removed);
  assert(!main.includes(removed), 'No handler referencing removed control: ' + removed);
}
for (const removed of ['dcDanBeVersion', 'function dcDanBe(', 'DECAL_SETS', 'function dcDanDecal(', 'function _decal']) {
  assert(!library.includes(removed), 'Removed unused legacy JSX: ' + removed);
}
assert(!main.includes('dcDanBeVersion'), 'Loader must not require the removed legacy version.');
assert(html.includes('id="btnDanBe"') && html.includes('./js/dan_be_nester.js'));
assert(bridge.includes('function dcDanBePrepare(') && bridge.includes('function dcDanBeRender('));
for (const kept of ['dcDan', 'dcDanToiUu', 'dcDanTuTro', 'dcRasterizeSelection', 'dcRename', 'dcResizeSelectionToSize']) {
  assert(library.includes('function ' + kept + '('), 'Unrelated function retained: ' + kept);
}
const version = /ExtensionBundleVersion="([\d.]+)"/.exec(read('DanCardCEP/CSXS/manifest.xml'))[1];
assert(html.includes('<span class="ver">v' + version + '</span>'));
assert(read('DanCardCEP/LICH_SU_CAP_NHAT.md').includes('## v' + version));
assert(html.includes('id="beMultiPerArtboard"'));
assert(!/id="beMultiPerArtboard"[^>]*checked/.test(html), 'Separate-model sheets are the default.');
assert(html.includes('id="beTwoSided"'));
assert(!/id="beTwoSided"[^>]*checked/.test(html), 'Single-sided mode remains the default.');
for (const [filename, source] of [['main.js', main], ['dan_card_lib.jsx', library], ['dan_be_bridge.jsx', bridge]]) {
  new vm.Script(source, { filename });
}
console.log('Cleanup: legacy Dàn bế/Decal removed, live bridge and unrelated functions retained, scripts parse, version/history aligned.');
