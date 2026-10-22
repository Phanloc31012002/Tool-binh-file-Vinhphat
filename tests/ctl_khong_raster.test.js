"use strict";
// CTL Offset (Đóng ghim giữa, Keo gáy) và Catalogue KHÔNG raster trước khi dàn: trang đặt lên tờ
// nguyên vector, đo và phóng theo KHUNG TRANSFORM (dcKhungThanhPham), không phụ thuộc tick.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");
const main = fs.readFileSync(require.resolve("../DanCardCEP/js/main.js"), "utf8");
const html = fs.readFileSync(require.resolve("../DanCardCEP/index.html"), "utf8");
const MM = 2.834645669;
const rect = (l, t, wMm, hMm) => [l, t, l + wMm * MM, t - hMm * MM];

function functionText(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `thiếu hàm ${name}`);
  const open = source.indexOf("{", start);
  let depth = 1, state = "code", quote;
  for (let i = open + 1; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (state === "string") { if (c === "\\") i++; else if (c === quote) state = "code"; }
    else if (state === "line") { if (c === "\n" || c === "\r") state = "code"; }
    else if (state === "block") { if (c === "*" && n === "/") { i++; state = "code"; } }
    else if (c === '"' || c === "'") { state = "string"; quote = c; }
    else if (c === "/" && n === "/") { i++; state = "line"; }
    else if (c === "/" && n === "*") { i++; state = "block"; }
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`hàm ${name} không cân ngoặc`);
}

// ---------- Không còn raster trước khi dàn ----------
const danLenh = ["dcRunCatalogueA4", "dcRunCatalogueA5", "dcRunCatalogueCustom", "dcRunCatalogueCustomA5",
  "dcRunCatalogueAuto", "dcRunSignature8", "dcRunKeoGay"];
for (const name of danLenh) {
  const body = functionText(lib, name);
  assert.ok(body.indexOf("dcFlattenForImposition(") < 0, name + " không được raster trước khi dàn");
  assert.ok(body.indexOf("doc.rasterize(") < 0 && body.indexOf("RasterizeOptions") < 0, name + " không raster");
  assert.ok(body.indexOf("dcChuanBiTrangDan(") >= 0, name + " chuẩn bị trang bằng hàm chung");
}
assert.ok(lib.indexOf("function dcFlattenForImposition(") < 0, "hàm raster-trước-khi-dàn đã bỏ hẳn (không còn ai gọi)");
// Đo khổ trong hai lệnh CTL: không còn bộ đo riêng (clipMaskBounds/visibleUnion) đọc visibleBounds.
for (const name of ["dcRunSignature8", "dcRunKeoGay"]) {
  const body = functionText(lib, name);
  assert.ok(body.indexOf("function clipMaskBounds(") < 0 && body.indexOf("function visibleUnion(") < 0, name + " đo bằng khung Transform, không có bộ đo riêng");
  assert.ok(body.indexOf("dcDoTheoKhungTransform") < 0, name + " không phụ thuộc tick");
}

// ---------- dcChuanBiTrangDan: phóng vector về khổ nhập theo khung Transform ----------
function load(extra) {
  const c = vm.createContext(Object.assign({
    app: { preferences: { getBooleanPreference: () => false }, getScaleMatrix: (sx, sy) => ({ sx, sy }) },
    Transformation: { CENTER: "center" },
  }, extra || {}));
  vm.runInContext(lib, c);
  return c;
}
function item(bounds, extra) {
  const it = Object.assign({ typename: "GroupItem", clipped: false, geometricBounds: bounds.slice(), transforms: [] }, extra || {});
  it.pageItems = it.pageItems || [Object.assign({ typename: "PathItem", geometricBounds: bounds.slice() })];
  it.transform = function (m, a, b, c2, d, lineWidths, about) {
    this.transforms.push({ m, lineWidths, about });
    const g = this.geometricBounds, cx = (g[0] + g[2]) / 2, cy = (g[1] + g[3]) / 2;
    const scale = (v, cc, s) => cc + (v - cc) * (s / 100);
    this.geometricBounds = [scale(g[0], cx, m.sx), scale(g[1], cy, m.sy), scale(g[2], cx, m.sx), scale(g[3], cy, m.sy)];
    for (const k of this.pageItems) k.geometricBounds = this.geometricBounds.slice();
  };
  return it;
}
const c = load();
assert.equal(typeof c.dcChuanBiTrangDan, "function");
// (a) Trang 100 × 140 mm nhập 148 × 210 → ma trận 148 % / 150 % theo trục tài liệu, giữ tâm, nét co giãn theo.
// Tham số nét của transform() là HỆ SỐ NHÂN (1 = giữ nguyên), không phải phần trăm như resize():
// đưa 149 là nét phình ×149. Co giãn theo trang → hệ số = trung bình (sx + sy) / 200 = 1,49.
{
  const it = item(rect(0, 0, 100, 140));
  const canhBao = [];
  const out = c.dcChuanBiTrangDan({}, it, 148, 210, canhBao);
  assert.equal(out, it, "trả về chính object vector, không tạo RasterItem");
  assert.equal(it.transforms.length, 1);
  const t0 = it.transforms[0];
  assert.ok(Math.abs(t0.m.sx - 148) < 1e-9 && Math.abs(t0.m.sy - 150) < 1e-9 && Math.abs(t0.lineWidths - 1.49) < 1e-9 && t0.about === "center", JSON.stringify(t0));
  const g = it.geometricBounds;
  assert.ok(Math.abs((g[2] - g[0]) / MM - 148) < 1e-6 && Math.abs((g[1] - g[3]) / MM - 210) < 1e-6);
  assert.equal(canhBao.length, 1, "phóng không đều > 0,5 % thì báo");
  assert.match(canhBao[0], /148,0 % × 150,0 %/);
}
// (b) Đúng khổ (lệch ≤ 0,05 mm) → không đụng.
{
  const it = item(rect(5, -5, 148.03, 209.98));
  c.dcChuanBiTrangDan({}, it, 148, 210, []);
  assert.equal(it.transforms.length, 0);
}
// (c) Phóng đều 2× → không cảnh báo; nét ×2 (hệ số 2, không phải 200).
{
  const it = item(rect(0, 0, 74, 105));
  const canhBao = [];
  c.dcChuanBiTrangDan({}, it, 148, 210, canhBao);
  assert.deepEqual(canhBao, []);
  assert.equal(it.transforms[0].lineWidths, 2);
}
// (d) Group clip có nội dung tràn: khung = mask (Transform), không phải geometricBounds gộp.
{
  const mask = { typename: "PathItem", clipping: true, geometricBounds: rect(0, 0, 148, 210) };
  const noiDung = { typename: "RasterItem", geometricBounds: rect(-20 * MM, 20 * MM, 300, 300) };
  const it = item(rect(-20 * MM, 20 * MM, 300, 300), { clipped: true, pageItems: [mask, noiDung] });
  c.dcChuanBiTrangDan({}, it, 148, 210, []);
  assert.equal(it.transforms.length, 0, "khung Transform đã đúng 148 × 210 → không phóng dù geometricBounds báo 300");
}
// (e) Không đo được → throw rõ.
{
  const hong = { typename: "GroupItem", clipped: false, pageItems: [], get geometricBounds() { throw new Error("hỏng"); }, transform() {} };
  assert.throws(() => c.dcChuanBiTrangDan({}, hong, 148, 210, []), /không đo được khung Transform/);
}
// (f) Tick ở header tắt vẫn phóng theo Transform (hàm không đọc cờ).
{
  const c2 = load({ dcDoTheoKhungTransform: false });
  const mask = { typename: "PathItem", clipping: true, geometricBounds: rect(0, 0, 100, 140) };
  const it = item(rect(-50, 50, 300, 300), { clipped: true, pageItems: [mask, { typename: "RasterItem", geometricBounds: rect(-50, 50, 300, 300) }] });
  c2.dcChuanBiTrangDan({}, it, 148, 210, []);
  assert.ok(Math.abs(it.transforms[0].m.sx - 148) < 1e-9 && Math.abs(it.transforms[0].m.sy - 150) < 1e-9);
}

// ---------- Tick "Transform" mặc định BẬT (anh Lộc: toàn bộ dùng Transform để dàn) ----------
assert.match(html, /id="hdrTransform"[^>]*checked/, "tick mặc định bật");
assert.match(main, /HDR_TRANSFORM_KEY[\s\S]{0,400}!==\s*"0"|hdrTransformBox\.checked\s*=\s*[^;]*!== "0"/, "localStorage chưa có → bật");
console.log("ctl_khong_raster: ok");
