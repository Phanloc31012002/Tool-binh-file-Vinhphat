"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync(require.resolve("../DanCardCEP/index.html"), "utf8");
const main = fs.readFileSync(require.resolve("../DanCardCEP/js/main.js"), "utf8");
function pane(id) {
  const start = html.indexOf(`id="${id}"`);
  assert.ok(start >= 0);
  return html.slice(start, html.indexOf("</main>", start));
}
const template = pane("pane-danmau"), kts = pane("pane-toiuu");
for (const id of ["autoSheetNotePrefixes", "btnCopyToiUuNoteOneSide", "btnCopyToiUuNote", "outCopyDanMauNote"]) {
  assert.ok(template.includes(`id="${id}"`), `Moved control ${id} belongs to Dàn theo mẫu`);
  assert.ok(!kts.includes(`id="${id}"`), `No duplicate ${id} remains in Dàn KTS`);
  assert.equal(html.split(`id="${id}"`).length - 1, 1, `Unique ID ${id}`);
}
assert.match(template, /class="acc-head" data-acc="copyDanMauNote"[^]*?<span>Copy ghi chú<\/span>[^]*?class="acc-body" id="acc-copyDanMauNote"/);
const accordion = template.slice(template.indexOf('id="acc-copyDanMauNote"'), template.indexOf('data-acc="saveDanMau"'));
assert.ok(!/class="acc-body open"/.test(template), "Notes start collapsed");
for (const id of ["autoSheetNotePrefixes", "btnCopyToiUuNoteOneSide", "btnCopyToiUuNote", "outCopyDanMauNote"]) assert.ok(accordion.includes(`id="${id}"`));

const block = main.slice(main.indexOf('var btnCopyToiUuNote ='), main.indexOf('// ---- Dàn Offset: Tự trở (1 artboard) ----'));
assert.ok(!block.includes("outDanToiUu"), "Note handler must not require or write KTS status");
const ids = {};
for (const id of ["autoSheetNotePrefixes", "btnCopyToiUuNoteOneSide", "btnCopyToiUuNote", "outCopyDanMauNote"]) {
  ids[id] = { id, value: "F1,F2", disabled: false, addEventListener(event, listener) { assert.equal(event, "click"); this.click = listener; } };
}
const calls = [], messages = [], results = [];
const c = vm.createContext({
  document: { getElementById: (id) => ids[id] },
  cs: { evalScript(expression, callback) { calls.push({ expression, callback }); } },
  loadDanToiUuJsx: () => "LOADER;",
  jsStr: JSON.stringify,
  show(output, text) { messages.push({ output, text }); },
  handleRes(output, text) { results.push({ output, text }); }
});
vm.runInContext(block, c);
for (const [id, fn] of [["btnCopyToiUuNoteOneSide", "dcCopyToiUuNoteToAllArtboards"], ["btnCopyToiUuNote", "dcCopyToiUuNoteToOddArtboards"]]) {
  ids[id].click();
  assert.equal(calls.at(-1).expression, `LOADER;${fn}("F1,F2")`);
  assert.equal(ids.btnCopyToiUuNote.disabled, true);
  assert.equal(ids.btnCopyToiUuNoteOneSide.disabled, true);
  assert.equal(messages.at(-1).output, ids.outCopyDanMauNote);
  calls.at(-1).callback("OK: copied");
  assert.equal(ids.btnCopyToiUuNote.disabled, false);
  assert.equal(ids.btnCopyToiUuNoteOneSide.disabled, false);
  assert.equal(results.at(-1).output, ids.outCopyDanMauNote);
}
ids.autoSheetNotePrefixes.value = "";
ids.btnCopyToiUuNoteOneSide.click();
assert.equal(calls.at(-1).expression, 'LOADER;dcCopyToiUuNoteToAllArtboards("")');
calls.at(-1).callback("ERR: choose a note");
assert.equal(results.at(-1).output, ids.outCopyDanMauNote);
assert.equal(ids.btnCopyToiUuNoteOneSide.disabled, false);

// Exercise the actual shared accordion handler, not a new custom toggle.
let opened = false;
const arrow = {};
const head = {
  nextElementSibling: { classList: { toggle(name) { assert.equal(name, "open"); return opened = !opened; } } },
  querySelector: () => arrow,
  addEventListener(_, listener) { this.click = listener; }
};
const start = main.indexOf('document.querySelectorAll(".acc-head")');
vm.runInNewContext(main.slice(start, main.indexOf('// ---- danh sách loại card ----', start)), { document: { querySelectorAll: () => [head] } });
head.click(); assert.equal(opened, true); assert.equal(arrow.innerHTML, "&#9660;");
head.click(); assert.equal(opened, false); assert.equal(arrow.innerHTML, "&#9654;");
console.log("Dàn theo mẫu notes: moved once, collapsed accordion, 1/2-sided dispatch, prefixes, isolated status and failure unlock passed.");
