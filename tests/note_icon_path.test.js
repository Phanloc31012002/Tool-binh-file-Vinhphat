"use strict";
// Icon ghi chú CTL/Keo gáy: tìm trong DanCardCEP/assets theo thư mục extension; thiếu thì bỏ qua
// icon chứ không làm hỏng lượt dàn (đường dẫn cũ viết cứng theo máy anh Lộc chỉ còn là dự phòng).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");

function fakeFile(existing) {
  function File(path) {
    this.path = String(path).replace(/\\/g, "/");
    this.fsName = this.path;
    this.exists = existing.indexOf(this.path) >= 0;
  }
  Object.defineProperty(File.prototype, "parent", {
    get() {
      return new File(this.path.replace(/\/[^/]*$/, ""));
    },
  });
  return File;
}
function load(existing, globals) {
  const context = Object.assign({ File: fakeFile(existing) }, globals || {});
  const c = vm.createContext(context);
  vm.runInContext(lib, c);
  return c;
}

const ASSETS = "C:/ext/assets/icon.ai",
  LEGACY = "C:/Users/ADMIN/Downloads/icon.ai";
// Panel đã truyền thư mục extension → lấy assets/icon.ai.
let c = load([ASSETS, LEGACY], { dcExtensionRoot: "C:/ext", $: { fileName: "D:/khac/jsx/dan_card_lib.jsx" } });
assert.equal(typeof c.dcNoteIconFile, "function");
assert.equal(c.dcNoteIconFile().path, ASSETS);
// Không có biến từ panel → suy từ vị trí file jsx đang chạy.
c = load([ASSETS], { $: { fileName: "C:/ext/jsx/dan_card_lib.jsx" } });
assert.equal(c.dcNoteIconFile().path, ASSETS);
// Chỉ còn file cũ ở Downloads → vẫn dùng được.
c = load([LEGACY], { $: { fileName: "C:/ext/jsx/dan_card_lib.jsx" } });
assert.equal(c.dcNoteIconFile().path, LEGACY);
// Không đâu có → null, không ném lỗi; không có $ cũng không sao.
c = load([], {});
assert.equal(c.dcNoteIconFile(), null);

// Hai bản loadNoteIconTemplate (Đóng ghim, Keo gáy): thiếu icon → trả null, không throw.
const marker = "    function loadNoteIconTemplate() {";
const copies = lib.split(marker).length - 1;
assert.equal(copies, 2, "CTL và Keo gáy mỗi nơi một bản");
let from = 0;
for (let i = 0; i < copies; i++) {
  const start = lib.indexOf(marker, from);
  const end = lib.indexOf("    var noteIconTemplate = null;", start);
  assert.ok(end > start);
  from = end;
  const ctx = vm.createContext({
    dcNoteIconFile: () => null,
    app: { get open() { throw new Error("không được mở file khi thiếu icon"); } },
  });
  vm.runInContext(lib.slice(start, end), ctx);
  assert.equal(ctx.loadNoteIconTemplate(), null);
}
// Đường dẫn cứng chỉ còn đúng một chỗ: trong dcNoteIconFile.
assert.equal(lib.split(LEGACY).length - 1, 1);
// Thiếu icon thì kết quả vẫn báo, không im lặng.
assert.ok(lib.indexOf("thiếu DanCardCEP/assets/icon.ai") >= 0);
console.log("note_icon_path: ok");
