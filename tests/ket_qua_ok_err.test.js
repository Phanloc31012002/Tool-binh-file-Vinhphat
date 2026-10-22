"use strict";
// Chuỗi trả về panel phải đúng trạng thái: lỗi đầu vào → "ERR:", huỷ hộp thoại → "OK: Đã hủy…",
// không còn "OK: (dừng)" tô xanh một lượt dàn đã dừng vì lỗi.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");
const html = fs.readFileSync(require.resolve("../DanCardCEP/index.html"), "utf8");
const MM = 2.834645669;

assert.equal(lib.indexOf('"OK: (dừng)"'), -1, "CTL/Keo gáy không còn báo OK khi dừng vì lỗi");
// CTL/Keo gáy: các lỗi đầu vào cũ giờ trả ERR (vẫn giữ nguyên câu).
for (const msg of ["Chưa chọn trang ruột.", "Số trang phải là BỘI SỐ CỦA 4."]) {
  assert.ok(lib.indexOf('"ERR: ' + msg) >= 0 || lib.indexOf('"ERR: " + "' + msg) >= 0, msg);
}

// Dàn Card: ô số nhận dấu phẩy.
{
  const s = lib.indexOf("  function num(t, d) {"), e = lib.indexOf("  var W = num(", s);
  const ctx = vm.createContext({});
  vm.runInContext(lib.slice(s, e), ctx);
  assert.equal(ctx.num("9,2", 0), 9.2);
  assert.equal(ctx.num("9.2", 0), 9.2);
  assert.equal(ctx.num("", 7), 7);
}

// Dàn Card: bấm Hủy ở hộp nhập khổ → OK: Đã hủy (tài liệu chưa bị đụng), không phải "đã dàn xong".
{
  function Window() {
    const control = () => ({ add() { return control(); }, show() { return 2; }, close() {} });
    return control();
  }
  const item = { typename: "PathItem", geometricBounds: [0, 56 * MM, 92 * MM, 0], visibleBounds: [0, 56 * MM, 92 * MM, 0] };
  const doc = { selection: [item], artboards: [{ artboardRect: [0, 1000, 1000, 0] }], layers: [] };
  const ctx = vm.createContext({
    app: { documents: [doc], activeDocument: doc, preferences: { getBooleanPreference: () => false } },
    Window, ScriptUI: {}, $: { fileName: "x/jsx/dan_card_lib.jsx" }, File: function () { this.exists = false; },
  });
  vm.runInContext(lib, ctx);
  assert.equal(ctx.dcDan("9.2x5.6", false), "OK: Đã hủy, chưa thay đổi gì.");
}

// Dàn Card: không còn cảnh báo rồi return rỗng (wrapper sẽ báo "đã dàn xong").
const danCard = lib.slice(lib.indexOf("function _dcDanCore("), lib.indexOf("function dcDanToiUu("));
assert.ok(!/warn\([^;]*\);\s*return;\s*\n/.test(danCard), "warn(...); return; → return ERR");
assert.ok(danCard.indexOf("Khe giữa khối theo layout") >= 0, "báo khi ô nhập khe bị bỏ qua");
// Layout khai báo blockGap: ô khe điền sẵn đúng số và khoá lại, không để người dùng gõ số vô nghĩa.
assert.ok(/inG\.text = "" \+ LAYOUT\.blockGap/.test(danCard) && /inG\.enabled = false/.test(danCard), "ô khe điền sẵn blockGap và khoá");

// Clip header: báo đúng số object thật sự được clip và số đã có clip giữ nguyên.
assert.ok(lib.indexOf("đã có clip, giữ nguyên") >= 0);

// Panel KTS: hint nói đúng điều kiện xoá nguồn.
assert.ok(html.indexOf("Khi ghép nhiều khổ: mẫu đã dàn được xóa khỏi nguồn, mẫu chưa dàn được giữ lại.") >= 0);
console.log("ket_qua_ok_err: ok");
