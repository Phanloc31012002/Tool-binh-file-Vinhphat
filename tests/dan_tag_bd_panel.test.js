"use strict";
// Tab Dàn tag BD trên panel: control có đủ, nút nối đúng lõi (packAsync) và cầu nối
// (dcDanTagBdDocTag / dcDanTagBdVe / dcDanTagBdXuatPdf / dcDanTagBdDemArtboard).
// Chạy đúng mã thật của main.js (cắt lát theo mốc), không sao chép phần cài đặt nào.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const main = fs.readFileSync(path.join(__dirname, "../DanCardCEP/js/main.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../DanCardCEP/index.html"), "utf8");

// ---------- Tĩnh: index.html + main.js ----------
{
  assert.match(html, /data-tab="tagbd"/);
  assert.match(html, /id="pane-tagbd"/);
  for (const id of [
    "tbQty",
    "btnTagBdThem",
    "tagBdList",
    "tagBdTotal",
    "btnTagBdXoa",
    "btnTagBdDan",
    "outTagBd",
    "tagBdExport",
    "tbPrefix",
    "tbStart",
    "tbPad",
    "tbCanMang",
    "tbNgay",
    "tbNote",
    "tbFolder",
    "btnTagBdPickFolder",
    "tbPreview",
    "btnTagBdXuat",
    "outTagBdXuat",
  ])
    assert.ok(html.indexOf('id="' + id + '"') >= 0, "index.html thiếu id " + id);
  const scriptTag = html.indexOf('<script src="./js/dan_tag_bd.js"></script>');
  assert.ok(scriptTag >= 0, "index.html phải nạp js/dan_tag_bd.js");
  assert.ok(scriptTag < html.indexOf('<script src="./js/main.js"></script>'), "dan_tag_bd.js nạp trước main.js");
  const pane = html.slice(html.indexOf('id="pane-tagbd"'), html.indexOf("</main>", html.indexOf('id="pane-tagbd"')));
  assert.match(pane, /trái[^.]{0,40}trước/i);
  assert.match(pane, /phải[^.]{0,40}sau/i);
  assert.match(main, /tagbd: document\.getElementById\("pane-tagbd"\)/);
  for (const token of ["function loadDanTagBdJsx", "dcDanTagBdDocTag()", "dcDanTagBdVe(", "dcDanTagBdXuatPdf(", "dcDanTagBdDemArtboard()", "packAsync("])
    assert.ok(main.indexOf(token) >= 0, "main.js thiếu " + token);
  assert.match(main, /dcDanTagBdVersion < 4/);
}

// ---------- Động: chạy lát mã thật ----------
function between(start, end) {
  const a = main.indexOf(start);
  const b = main.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "Mốc cắt lát main.js phải còn: " + start);
  return main.slice(a, b);
}
const production = between("  function jsStr(s)", "  function loadResizeJsx()") + between("  // ---- Dàn tag BD", "  // ---- Auto Save PDF ----");

function panel() {
  const expressions = [],
    statuses = [],
    timers = [],
    packCalls = [];
  const handlers = {};
  function node(id, extra) {
    const n = Object.assign(
      {
        id,
        value: "",
        checked: false,
        disabled: false,
        innerHTML: "",
        textContent: "",
        className: "",
        classList: {
          add(c) {
            n.className = (n.className + " " + c).trim();
          },
          remove(c) {
            n.className = n.className
              .split(/\s+/)
              .filter((x) => x && x !== c)
              .join(" ");
          },
          contains(c) {
            return n.className.split(/\s+/).indexOf(c) >= 0;
          },
        },
        addEventListener(type, fn) {
          handlers[id + ":" + type] = fn;
        },
        querySelector() {
          return null;
        },
      },
      extra || {},
    );
    return n;
  }
  const nodes = {};
  for (const id of ["tbQty", "btnTagBdThem", "tagBdList", "tagBdTotal", "btnTagBdXoa", "btnTagBdDan", "outTagBd", "tagBdExport", "tbPrefix", "tbStart", "tbPad", "tbCanMang", "tbNgay", "tbNote", "tbFolder", "btnTagBdPickFolder", "tbPreview", "btnTagBdXuat", "outTagBdXuat"])
    nodes[id] = node(id);
  nodes.tagBdExport.className = "hidden";
  nodes.tbQty.value = "1000";
  nodes.tbPrefix.value = "1088";
  nodes.tbStart.value = "1";
  nodes.tbPad.value = "2";
  nodes.tbCanMang.value = "cm";
  nodes.tbNgay.value = "22";
  const tabButton = node("tab-tagbd");
  const context = vm.createContext({
    document: {
      getElementById: (id) => nodes[id] || null,
      querySelector: (sel) => (sel.indexOf('data-tab="tagbd"') >= 0 ? tabButton : null),
    },
    cs: {
      getSystemPath: () => "C:\\Users\\ADMIN\\Extensions\\DanCardCEP",
      evalScript(expression, callback) {
        expressions.push({ expression, callback });
      },
    },
    SystemPath: { EXTENSION: "extension" },
    show(el, message, state) {
      statuses.push({ el: el.id, message: String(message), state });
    },
    handleRes(el, res) {
      statuses.push({ el: el.id, message: String(res) });
    },
    attachSelectFirst() {},
    window: {
      setTimeout(fn) {
        timers.push(fn);
      },
      localStorage: { getItem: () => null, setItem() {} },
      DanTagBd: {
        packAsync(input, onProgress, done) {
          packCalls.push(JSON.parse(JSON.stringify(input)));
          onProgress({ done: 1, total: 3 });
          done(context.packResult);
        },
      },
    },
    Date,
    JSON,
    parseInt,
    String,
    Number,
    Math,
    isFinite,
    isNaN,
  });
  vm.runInContext(production, context);
  return { context, nodes, handlers, expressions, statuses, timers, packCalls, tabButton };
}

// Số lượng hợp lệ: 500 hoặc bội 1000.
{
  const p = panel();
  assert.equal(p.context.tagBdSoLuongHopLe("500"), 500);
  assert.equal(p.context.tagBdSoLuongHopLe(" 2 000 "), 2000);
  assert.equal(p.context.tagBdSoLuongHopLe("2.000"), 2000);
  assert.equal(p.context.tagBdSoLuongHopLe("1500"), null);
  assert.equal(p.context.tagBdSoLuongHopLe("0"), null);
  assert.equal(p.context.tagBdSoLuongHopLe("abc"), null);
}
// Thêm: số lượng sai -> báo đỏ, không gọi Illustrator; đúng -> gọi dcDanTagBdDocTag, ghi danh sách.
{
  const p = panel();
  p.nodes.tbQty.value = "1500";
  p.handlers["btnTagBdThem:click"]();
  assert.equal(p.expressions.length, 0);
  assert.match(p.statuses[p.statuses.length - 1].message, /500 hoặc bội của 1000/);
  p.nodes.tbQty.value = "2000";
  p.handlers["btnTagBdThem:click"]();
  assert.equal(p.expressions.length, 1);
  assert.match(p.expressions[0].expression, /dcDanTagBdVersion < 4/);
  assert.match(p.expressions[0].expression, /dcDanTagBdDocTag\(\)/);
  p.expressions[0].callback('OKJSON:{"tags":[{"id":"tag_1","w":112,"h":72,"twoSided":true,"name":"Tag 1"},{"id":"tag_2","w":56,"h":91,"twoSided":false,"name":"Nhỏ"}]}');
  assert.match(p.nodes.tagBdList.innerHTML, /112 × 72/);
  assert.match(p.nodes.tagBdList.innerHTML, /Nhỏ/);
  assert.match(p.nodes.tagBdTotal.textContent, /Bài 1000: 2 tag = 4 con/);
  // Thêm bài 500.
  p.nodes.tbQty.value = "500";
  p.handlers["btnTagBdThem:click"]();
  p.expressions[1].callback('OKJSON:{"tags":[{"id":"tag_3","w":92,"h":40,"twoSided":true,"name":"Tag 1"}]}');
  assert.match(p.nodes.tagBdTotal.textContent, /Bài 500: 1 tag = 1 con/);
  assert.match(p.nodes.tagBdTotal.textContent, /Bài 1000: 2 tag = 4 con/);
  // Lỗi từ Illustrator -> báo đỏ, danh sách giữ nguyên.
  p.handlers["btnTagBdThem:click"]();
  p.expressions[2].callback("ERR: Chưa chọn tag nào.");
  assert.match(p.statuses[p.statuses.length - 1].message, /Chưa chọn tag nào/);
  assert.equal(p.context.tagBdDanhSach.length, 3);
  // Bỏ một dòng bằng nút ✕ (ủy quyền click trên danh sách).
  p.handlers["tagBdList:click"]({ target: { getAttribute: (a) => (a === "data-remove" ? "0" : null) } });
  assert.equal(p.context.tagBdDanhSach.length, 2);
  assert.equal(p.context.tagBdDanhSach[0].id, "tag_2");
  // Xoá danh sách.
  p.handlers["btnTagBdXoa:click"]();
  assert.equal(p.context.tagBdDanhSach.length, 0);
  assert.match(p.nodes.tagBdList.innerHTML, /Chưa có tag/);
}
// Dàn: danh sách trống -> lỗi; có tag -> packAsync với đúng danh sách, tiến độ, rồi dcDanTagBdVe; xong xoá danh sách và hiện khối xuất.
{
  const p = panel();
  p.handlers["btnTagBdDan:click"]();
  assert.equal(p.expressions.length, 0);
  assert.match(p.statuses[p.statuses.length - 1].message, /Chưa có tag/);
  p.context.tagBdDanhSach.push({ id: "tag_1", name: "Tag 1", w: 112, h: 72, twoSided: true, qty: 2000 });
  p.context.packResult = {
    ok: true,
    detail: "Bài 1000: 1 khối 2 × 2 ô (112 × 184 mm), 4/4 ô — không thể ít hơn.",
    jobs: [{ bai: 1000, hop: 10, blocks: [{ cols: 2, rows: 2, w: 112, h: 184, cells: 4, places: [], cuts: [] }], cells: 4, lowerBound: 4, proven: true }],
  };
  p.handlers["btnTagBdDan:click"]();
  assert.equal(p.nodes.btnTagBdDan.disabled, true);
  assert.deepEqual(p.packCalls[0].tags, [{ id: "tag_1", name: "Tag 1", w: 112, h: 72, qty: 2000 }]);
  assert.ok(p.statuses.some((s) => /Đang suy nghĩ… 1\/3/.test(s.message)));
  assert.equal(p.expressions.length, 1);
  assert.match(p.expressions[0].expression, /dcDanTagBdVe\('/);
  assert.ok(p.expressions[0].expression.indexOf("2 × 2 ô") >= 0 || p.expressions[0].expression.indexOf("\\u00d7") >= 0);
  p.expressions[0].callback("OK: Đã đóng 1 khối (2 artboard trước/sau), 2 con.");
  assert.equal(p.nodes.btnTagBdDan.disabled, false);
  assert.equal(p.context.tagBdDanhSach.length, 0);
  assert.match(p.statuses[p.statuses.length - 1].message, /Đã đóng 1 khối/);
  // Sau khi đóng artboard: hỏi số cặp TagBD để hiện khối xuất + xem trước tên.
  assert.equal(p.expressions.length, 2);
  assert.match(p.expressions[1].expression, /dcDanTagBdDemArtboard\(\)/);
  p.expressions[1].callback("OK:1");
  assert.equal(p.nodes.tagBdExport.classList.contains("hidden"), false);
  assert.match(p.nodes.tbPreview.textContent, /^1088 - 01 - 10 hop 110 x 182 - cm - 22\.pdf/);
  // Lõi báo lỗi -> báo đỏ, không gọi Illustrator, danh sách giữ nguyên.
  p.context.tagBdDanhSach.push({ id: "tag_9", name: "Tag 9", w: 1100, h: 100, twoSided: false, qty: 1000 });
  p.context.packResult = { ok: false, error: "Tag Tag 9 khổ 1100 × 100 mm không lọt tờ." };
  p.handlers["btnTagBdDan:click"]();
  assert.equal(p.expressions.length, 2);
  assert.match(p.statuses[p.statuses.length - 1].message, /không lọt tờ/);
  assert.equal(p.context.tagBdDanhSach.length, 1);
  assert.equal(p.nodes.btnTagBdDan.disabled, false);
}
// Mở tab -> hỏi số cặp; 0 cặp thì ẩn khối xuất. Xuất PDF -> dcDanTagBdXuatPdf với đúng tuỳ chọn.
{
  const p = panel();
  p.handlers["tab-tagbd:click"]();
  assert.match(p.expressions[0].expression, /dcDanTagBdDemArtboard\(\)/);
  p.expressions[0].callback("OK:0");
  assert.equal(p.nodes.tagBdExport.classList.contains("hidden"), true);
  p.expressions[0].callback("OK:3");
  assert.equal(p.nodes.tagBdExport.classList.contains("hidden"), false);
  p.nodes.tbStart.value = "7";
  p.nodes.tbPad.value = "3";
  p.nodes.tbNote.value = "Lan 2";
  p.nodes.tbFolder.value = "D:\\PDF\\1088";
  p.nodes.tbCanMang.value = "km";
  p.handlers["btnTagBdXuat:click"]();
  assert.equal(p.nodes.btnTagBdXuat.disabled, true);
  const expr = p.expressions[1].expression;
  assert.match(expr, /dcDanTagBdXuatPdf\('/);
  const json = JSON.parse(expr.slice(expr.indexOf("dcDanTagBdXuatPdf('") + 19, expr.lastIndexOf("')")).replace(/\\\\/g, "\\").replace(/\\'/g, "'"));
  assert.deepEqual(json, { prefix: "1088", start: "7", pad: "3", canMang: "km", ngay: "22", folder: "D:\\PDF\\1088", note: "Lan 2" });
  p.expressions[1].callback("OK: Đã lưu 3/3 file PDF.");
  assert.equal(p.nodes.btnTagBdXuat.disabled, false);
  assert.equal(p.statuses[p.statuses.length - 1].el, "outTagBdXuat");
  // Chọn thư mục.
  p.handlers["btnTagBdPickFolder:click"]();
  assert.match(p.expressions[2].expression, /dcPickFolder\(\)/);
  p.expressions[2].callback("OK:E:\\Tag");
  assert.equal(p.nodes.tbFolder.value, "E:\\Tag");
  console.log("Panel Dàn tag BD: ok");
}
// Trong lúc Dàn: khoá Thêm/Xoá/✕ để danh sách không đổi giữa chừng; mở lại khi xong hoặc lỗi.
{
  const p = panel();
  p.context.tagBdDanhSach.push({ id: "tag_1", name: "Tag 1", w: 112, h: 72, twoSided: true, qty: 1000 });
  let release;
  p.context.window.DanTagBd.packAsync = function (input, onProgress, done) {
    release = done;
  };
  p.handlers["btnTagBdDan:click"]();
  assert.equal(p.nodes.btnTagBdThem.disabled, true);
  assert.equal(p.nodes.btnTagBdXoa.disabled, true);
  // Bấm Thêm/Xoá/✕ lúc này không làm gì.
  p.nodes.tbQty.value = "1000";
  p.handlers["btnTagBdThem:click"]();
  p.handlers["btnTagBdXoa:click"]();
  p.handlers["tagBdList:click"]({ target: { getAttribute: (a) => (a === "data-remove" ? "0" : null) } });
  assert.equal(p.expressions.length, 0);
  assert.equal(p.context.tagBdDanhSach.length, 1);
  release({ ok: false, error: "thử lỗi" });
  assert.equal(p.nodes.btnTagBdThem.disabled, false);
  assert.equal(p.nodes.btnTagBdXoa.disabled, false);
  assert.equal(p.nodes.btnTagBdDan.disabled, false);
  console.log("Panel Dàn tag BD (khoá nút khi đang dàn): ok");
}
