"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const main = fs.readFileSync(
  require.resolve("../DanCardCEP/js/main.js"),
  "utf8",
);
const html = fs.readFileSync(
  require.resolve("../DanCardCEP/index.html"),
  "utf8",
);
const offsetPane = html.slice(
  html.indexOf('id="pane-offset"'),
  html.indexOf("<!-- TAB: ĐỔI TÊN -->"),
);
assert.match(offsetPane, /Lưu AI theo khổ vừa dàn/);
assert.ok(!offsetPane.includes("Lưu PDF"));
assert.ok(html.includes("Lưu PDF"), "PDF remains in other tabs");
const loader = main.slice(
  main.indexOf("function loadOffsetPdfJsx()"),
  main.indexOf("function ", main.indexOf("function loadOffsetPdfJsx()") + 10),
);
assert.ok(loader.includes("typeof dcLuuCtlOffsetAI"));
assert.ok(
  loader.includes("dcCtlOffsetPdfVersion < 4"),
  "reload an already cached per-object exporter",
);
const nodes = {};
for (const id of [
  "btnOffset",
  "outOffset",
  "offsetPdfBox",
  "offsetPdfButtons",
  "outOffsetPdf",
]) {
  nodes[id] = {
    id,
    children: [],
    hidden: true,
    classList: {
      add() {
        nodes[id].hidden = true;
      },
      remove() {
        nodes[id].hidden = false;
      },
    },
    addEventListener(type, listener) {
      this.click = listener;
    },
    appendChild(child) {
      this.children.push(child);
    },
    querySelectorAll() {
      return this.children;
    },
  };
  Object.defineProperty(nodes[id], "innerHTML", {
    set() {
      this.children = [];
    },
  });
}
const calls = [],
  messages = [];
const c = vm.createContext({
  document: {
    getElementById: (id) => nodes[id],
    createElement() {
      return {
        addEventListener(_, listener) {
          this.click = listener;
        },
      };
    },
  },
  cs: {
    evalScript(expr, callback) {
      calls.push({ expr, callback });
    },
  },
  jsStr: JSON.stringify,
  loadOffsetPdfJsx: () => "RELOAD;",
  show(output, message) {
    messages.push({ output, message });
  },
  handleRes(output, message) {
    messages.push({ output, message });
  },
});
const from = main.indexOf(
  'var btnOffset = document.getElementById("btnOffset")',
);
const to = main.indexOf('btnOffset.addEventListener("click"', from);
vm.runInContext(main.slice(from, to), c);
const plan = {
  total: 3,
  groups: [
    { key: "BIA", jobs: [{ name: "BIA", ab: [1], w: 300, h: 200 }] },
    { key: "AB", jobs: [{ name: "RUOT 1", ab: [2, 3], w: 300, h: 200 }] },
  ],
};
c.showOffsetResult("OK: Dàn xong||CTLPDF:" + JSON.stringify(plan));
assert.equal(nodes.offsetPdfBox.hidden, false);
assert.equal(nodes.offsetPdfButtons.children.length, 2);
assert.ok(
  nodes.offsetPdfButtons.children.every((b) =>
    b.textContent.startsWith("Lưu AI "),
  ),
);
nodes.offsetPdfButtons.children[1].click();
assert.equal(
  calls.at(-1).expr,
  'RELOAD;dcLuuCtlOffsetAI(3, "RUOT 1=2,3@300x200")',
);
assert.ok(nodes.offsetPdfButtons.children.every((b) => b.disabled));
assert.match(messages.at(-1).message, /lưu AI Tờ AB/);
calls.at(-1).callback("OK: Đã lưu 1 AI");
assert.ok(nodes.offsetPdfButtons.children.every((b) => !b.disabled));
assert.equal(messages.at(-1).output, nodes.outOffsetPdf);
nodes.offsetPdfButtons.children[0].click();
calls.at(-1).callback("ERR: File đã tồn tại: BIA.ai");
assert.ok(nodes.offsetPdfButtons.children.every((b) => !b.disabled));
c.showOffsetResult("OK: (bỏ qua)");
assert.equal(nodes.offsetPdfBox.hidden, false);
c.showOffsetResult("ERR: dàn thất bại");
assert.equal(nodes.offsetPdfBox.hidden, true);
assert.equal(nodes.offsetPdfButtons.children.length, 0);
console.log(
  "CTL AI panel: dynamic size buttons, A/B dispatch, stale-engine reload, progress, unlock and other-tab PDF isolation passed.",
);
