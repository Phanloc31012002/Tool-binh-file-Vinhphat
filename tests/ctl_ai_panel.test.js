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
  html.indexOf('id="pane-rename"'),
);
assert.match(offsetPane, /Lưu AI \+ JPG \+ ZIP theo khổ vừa dàn/);
assert.ok(!offsetPane.includes("Lưu PDF"));
assert.ok(html.includes("Lưu PDF"), "other tabs retain PDF");
assert.ok(html.indexOf("./js/ctl_package.js") < html.indexOf("./js/main.js"));
assert.match(offsetPane, /Nội dung sau RUỘT N \/ BÌA/);
const loader = main.slice(
  main.indexOf("function loadOffsetPdfJsx()"),
  main.indexOf("function ", main.indexOf("function loadOffsetPdfJsx()") + 10),
);
assert.ok(loader.includes("typeof dcLuuCtlOffsetAIPackage"));
assert.ok(loader.includes("dcCtlOffsetPdfVersion < 5"));
const nodes = {};
for (const id of [
  "btnOffset",
  "outOffset",
  "offsetPdfBox",
  "offsetPdfButtons",
  "outOffsetPdf",
  "offsetFileSuffix",
]) {
  nodes[id] = {
    id,
    children: [],
    hidden: true,
    value: "CATALOGUE thử ' & $ = @ (1)",
    classList: {
      add() {
        nodes[id].hidden = true;
      },
      remove() {
        nodes[id].hidden = false;
      },
    },
    addEventListener(_, listener) {
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
  messages = [],
  packs = [];
let available = true;
const context = vm.createContext({
  document: {
    getElementById: (id) => nodes[id],
    createElement: () => ({
      addEventListener(_, listener) {
        this.click = listener;
      },
    }),
  },
  window: {
    DanCardCtlPackage: {
      supported: () => available,
      pack(plan, status, done) {
        packs.push({ plan, status, done });
      },
    },
  },
  cs: {
    evalScript(expr, callback) {
      calls.push({ expr, callback });
    },
  },
  jsStr: JSON.stringify,
  loadOffsetPdfJsx: () => "RELOAD;",
  show(output, message, kind) {
    messages.push({ output, message, kind });
  },
  handleRes(output, message) {
    messages.push({ output, message });
  },
});
const from = main.indexOf(
  'var btnOffset = document.getElementById("btnOffset")',
);
vm.runInContext(
  main.slice(from, main.indexOf('btnOffset.addEventListener("click"', from)),
  context,
);
const plan = {
  total: 3,
  groups: [
    { key: "BIA", jobs: [{ name: "BIA", ab: [1], w: 300, h: 200 }] },
    { key: "AB", jobs: [{ name: "RUOT 1", ab: [2, 3], w: 300, h: 200 }] },
  ],
};
context.showOffsetResult("OK: Dàn xong||CTLPDF:" + JSON.stringify(plan));
assert.equal(nodes.offsetPdfBox.hidden, false);
assert.equal(nodes.offsetPdfButtons.children.length, 2);
assert.ok(
  nodes.offsetPdfButtons.children.every((b) =>
    b.textContent.startsWith("Lưu AI + JPG + ZIP "),
  ),
);
const allLocked = (value) => {
  assert.ok(nodes.offsetPdfButtons.children.every((b) => b.disabled === value));
  assert.equal(nodes.offsetFileSuffix.disabled, value);
};
nodes.offsetPdfButtons.children[1].click();
assert.equal(
  calls.at(-1).expr,
  'RELOAD;dcLuuCtlOffsetAIPackage(3, "RUOT 1=2,3@300x200", ' +
    JSON.stringify(nodes.offsetFileSuffix.value) +
    ")",
);
allLocked(true);
assert.match(messages.at(-1).message, /AI \+ JPG \+ ZIP Tờ AB/);
const packagePlan = {
  folder: "C:/output",
  jobs: [{ baseName: "RUOT 1 CATALOGUE" }],
};
calls
  .at(-1)
  .callback("OK: Đã lưu 1 AI + JPG||CTLPACK:" + JSON.stringify(packagePlan));
assert.deepEqual(JSON.parse(JSON.stringify(packs.at(-1).plan)), packagePlan);
allLocked(true);
packs.at(-1).status("Đang nén 1 bộ…");
assert.match(messages.at(-1).message, /Đang nén/);
packs.at(-1).done(null, { files: [{}], errors: [] });
allLocked(false);
assert.match(messages.at(-1).message, /Đã nén 1 ZIP/);
assert.equal(messages.at(-1).output, nodes.outOffsetPdf);
for (const response of [
  "ERR: File đã tồn tại: BIA.ai",
  "OK: AI||CTLPACK:invalid",
]) {
  nodes.offsetPdfButtons.children[0].click();
  calls.at(-1).callback(response);
  allLocked(false);
}
for (const result of [
  Error("worker failed"),
  { files: [], errors: [{ name: "RUOT 1", error: "ZIP exists" }] },
]) {
  nodes.offsetPdfButtons.children[1].click();
  calls.at(-1).callback("OK: AI + JPG||CTLPACK:" + JSON.stringify(packagePlan));
  packs
    .at(-1)
    .done(
      result instanceof Error ? result : null,
      result instanceof Error ? null : result,
    );
  allLocked(false);
  assert.equal(messages.at(-1).kind, "warn");
}
available = false;
const count = calls.length;
nodes.offsetPdfButtons.children[0].click();
assert.equal(
  calls.length,
  count,
  "missing packager must block BEFORE creating AI/JPG",
);
assert.match(messages.at(-1).message, /chưa xuất file/);
context.showOffsetResult("OK: (bỏ qua)");
assert.equal(nodes.offsetPdfBox.hidden, false);
context.showOffsetResult("ERR: dàn thất bại");
assert.equal(nodes.offsetPdfBox.hidden, true);
assert.equal(nodes.offsetPdfButtons.children.length, 0);
console.log(
  "CTL package panel: suffix, format isolation, size buttons, A/B dispatch, version reload, ZIP progress, errors and unlock passed.",
);
