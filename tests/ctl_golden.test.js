"use strict";
// Mốc hình học CTL Đóng ghim giữa trước khi tổng quát hoá (lớp khổ A6, khổ ngang, không raster):
// chia form (faces) + lưới danh định + vị trí/góc đặt bài + PON cắt/PON giấy của mọi form A4/A5
// hiện có. Lần đầu ghi tests/fixtures/ctl_golden.json; các lần sau phải khớp từng số (1e-4 pt).
// Chạy `node tests/ctl_golden.test.js --ghi` để ghi lại mốc CÓ CHỦ ĐÍCH (khi đổi hình học thật).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const library = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");
const MM = 2.834645669;
const FIXTURE = path.join(__dirname, "fixtures", "ctl_golden.json");
const GHI = process.argv.indexOf("--ghi") >= 0;

function functionText(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `thiếu hàm ${name}`);
  const open = source.indexOf("{", start);
  let depth = 1, state = "code", quote;
  for (let i = open + 1; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (state === "string") {
      if (c === "\\") i++;
      else if (c === quote) state = "code";
    } else if (state === "line") {
      if (c === "\n" || c === "\r") state = "code";
    } else if (state === "block") {
      if (c === "*" && n === "/") { i++; state = "code"; }
    } else if (c === '"' || c === "'") { state = "string"; quote = c; }
    else if (c === "/" && n === "/") { i++; state = "line"; }
    else if (c === "/" && n === "*") { i++; state = "block"; }
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`hàm ${name} không cân ngoặc`);
}
const shared = library.slice(library.indexOf("//  ĐO KHỔ DÙNG CHUNG"), library.indexOf("// dcDan: wrapper bắt mọi lỗi"));
const signature = functionText(library, "dcRunSignature8");
const helperNames = ["formSpec", "nominalGridFor", "centerItem", "placeRow8", "placeFace8", "buildPairGroup",
  "centerGroupAt", "placeFace4", "placeSmallPanel", "placeSmallFace16", "placeFace", "squeezeAboutCentre",
  "groupPages", "ungroupInto", "ctlBlack", "addAutoCutPon", "addAutoPon"];
const helpers = helperNames.map((n) => functionText(signature, n)).join("\n");
const constants = ["TOP_GAP", "MID_GAP", "MID_GAP_TT4", "MID_GAP_A5_MAIN", "MID_GAP_A5_COVER", "SHEET_65x86", "SHEET_AB",
  "SHEET_65x43", "SHEET_43x32", "A5_MAIN_ROW_GAP", "SMALL8_TRIM_OVERLAP", "BOP_PER_SHEET", "CUT_MARK", "CUT_STROKE", "PON_PAPER"]
  .map((name) => {
    const m = signature.match(new RegExp(`\\bvar ${name}\\s*=[^;]+;`));
    assert.ok(m, `thiếu hằng ${name}`);
    return m[0];
  }).join("\n");

// Bộ chia form: đoạn mã nằm giữa "var faces = [];" và "var numFaces" của dcRunSignature8, chạy
// cùng các hàm trang (cum4Pages…buildToAB). Khi tách thành hàm riêng, đổi driver này, giữ fixture.
const planFns = ["cum4Pages", "cum8Pages", "cum4con", "faceFrom", "buildToAB"].map((n) => functionText(signature, n)).join("\n");
const planStart = signature.indexOf("    var faces = [];");
const planEnd = signature.indexOf("    var numFaces = faces.length;", planStart);
assert.ok(planStart > 0 && planEnd > planStart);
const planCode = signature.slice(planStart, planEnd);
function planFaces(N, coBia, smallA5) {
  const c = vm.createContext({ N, CO_BIA: coBia, IS_SMALL_A5: smallA5 });
  vm.runInContext(planFns + "\n" + planCode + "\nvar __out = faces;", c);
  return JSON.parse(JSON.stringify(c.__out));
}

class Box {
  constructor(bounds, parent, group = false) {
    this.bounds = bounds && bounds.slice();
    this.parent = parent;
    this.angle = 0;
    this.pageItems = group ? [] : null;
    this.groupItems = { add: () => { const g = new Box(null, this, true); this.pageItems.push(g); return g; } };
  }
  get geometricBounds() {
    if (!this.pageItems) return this.bounds.slice();
    assert.ok(this.pageItems.length, "group giả rỗng");
    const b = this.pageItems.map((p) => p.geometricBounds);
    return [Math.min(...b.map((v) => v[0])), Math.max(...b.map((v) => v[1])), Math.max(...b.map((v) => v[2])), Math.min(...b.map((v) => v[3]))];
  }
  get visibleBounds() { return this.geometricBounds; }
  _affine(cx, cy, sx, sy, dx = 0, dy = 0) {
    if (this.pageItems) for (const it of this.pageItems) it._affine(cx, cy, sx, sy, dx, dy);
    else this.bounds = [cx + (this.bounds[0] - cx) * sx + dx, cy + (this.bounds[1] - cy) * sy + dy,
      cx + (this.bounds[2] - cx) * sx + dx, cy + (this.bounds[3] - cy) * sy + dy];
  }
  translate(dx, dy) { this._affine(0, 0, 1, 1, dx, dy); }
  resize(sx, sy) { const b = this.geometricBounds; this._affine((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, sx / 100, sy / 100); }
  rotate(angle) { const b = this.geometricBounds; this._rotate((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, angle); }
  _rotate(cx, cy, angle) {
    this.angle += angle;
    if (this.pageItems) { for (const it of this.pageItems) it._rotate(cx, cy, angle); return; }
    const b = this.bounds, a = (angle * Math.PI) / 180;
    const pts = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(([x, y]) =>
      [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
    this.bounds = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))];
  }
  move(parent) {
    if (this.parent) this.parent.pageItems.splice(this.parent.pageItems.indexOf(this), 1);
    this.parent = parent;
    parent.pageItems.push(this);
  }
  remove() { if (this.parent) this.parent.pageItems.splice(this.parent.pageItems.indexOf(this), 1); }
}
function context(wMm, hMm, pageCount) {
  const layer = new Box(null, null, true);
  const processed = Array.from({ length: pageCount }, (_, i) => {
    const it = new Box([i * 10, 100, i * 10 + wMm * MM, 100 - hMm * MM], layer);
    layer.pageItems.push(it);
    return it;
  });
  const c = vm.createContext({
    MM, pageWpt: wMm * MM, pageHpt: hMm * MM, artworkLayer: layer, processed, ponClampCount: 0,
    ElementPlacement: { PLACEATEND: 1, PLACEATBEGINNING: 0 }, CMYKColor: function () {},
    app: { preferences: { getBooleanPreference: () => false } },
  });
  vm.runInContext(shared + "\n" + constants + "\n" + helpers, c);
  return { c, processed };
}
const r4 = (v) => (typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v);
function snapGrid(grid) {
  const out = {};
  for (const k of Object.keys(grid)) {
    const v = grid[k];
    if (k === "spec") out.spec = { cols: v.cols, rows: v.rows, rotated: v.rotated, gutter: r4(v.gutter), rowGap: r4(v.rowGap),
      sheet: [r4(v.sheet.W), r4(v.sheet.H)], anchor: v.anchor, pon: v.pon, midAxis: v.midAxis, rowSeam: v.rowSeam, cornerLegs: v.cornerLegs, pageAxes: v.pageAxes };
    else if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([a, b]) => [a, r4(b)])) : r4(x)));
    else out[k] = r4(v);
  }
  return out;
}
function paths(c, face, rect, kind) {
  const cut = [], paper = [];
  c.addAutoCutPon({ pathItems: { add() { return { setEntirePath(p) { cut.push(p.map((q) => q.map(r4))); } }; } } }, face, rect);
  c.addAutoPon({ pathItems: { add() { const p = { setEntirePath(pts) { this.points = pts.map((q) => q.map(r4)); } }; paper.push(p); return p; } } }, rect, kind);
  return { cut, paper: paper.map((p) => ({ points: p.points, stroke: r4(p.strokeWidth) })) };
}
function faceFor(type, pages) {
  if (type === "TT4" || type === "SMALL4") return { type, row: [4, 1, 2, 3], sheetNo: 0 };
  if (type === "SMALL16" || type === "SMALLAB")
    return { type, leftFace: { top: [13, 4, 3, 14], bottom: [16, 1, 2, 15] }, rightFace: { top: [11, 6, 5, 12], bottom: [10, 7, 8, 9] }, sheetNo: 0 };
  return { type, top: [5, 4, 3, 6], bottom: [8, 1, 2, 7], cols: 4, sheetNo: 0 };
}
const cases = [
  ["TT4", 209, 300, 648, 418, "small"], ["TT4", 200, 270, 648, 418, "small"],
  ["TT8", 209, 300, 858, 638, "large"], ["AB", 209, 300, 858, 625, "large"], ["AB", 200, 280, 858, 625, "large"],
  ["SMALL4", 148, 210, 428, 313, "small"], ["SMALL4", 140, 200, 428, 313, "small"],
  ["SMALL8", 148, 210, 648, 418, "small"], ["SMALL8", 140, 200, 648, 418, "small"], ["SMALL8", 150, 211.5, 648, 418, "small"],
  ["SMALL16", 148, 210, 858, 638, "large"], ["SMALLAB", 148, 210, 858, 625, "large"], ["SMALLAB", 130, 190, 858, 625, "large"],
];
const snapshot = { plans: {}, forms: {} };
for (const [N, coBia, small] of [[16, true, false], [16, false, false], [28, true, false], [36, true, false], [76, true, false],
  [8, true, true], [36, true, true], [60, true, true], [100, true, true], [64, false, true]]) {
  snapshot.plans[`${small ? "A5" : "A4"}_N${N}_${coBia ? "bia" : "khongbia"}`] = planFaces(N, coBia, small);
}
for (const [type, w, h, pw, ph, kind] of cases) {
  for (const sheetNo of [0, 2]) {
    const pageCount = type === "SMALL16" || type === "SMALLAB" ? 16 : type === "TT4" || type === "SMALL4" ? 4 : 8;
    const { c, processed } = context(w, h, pageCount);
    const rect = [-37 * MM, 501 * MM, (pw - 37) * MM, (501 - ph) * MM];
    const face = Object.assign(faceFor(type), { sheetNo });
    const grid = snapGrid(c.nominalGridFor(face, rect));
    const pon = paths(c, face, rect, kind);
    c.placeFace(face, rect);
    const placed = processed.map((p) => ({ b: p.geometricBounds.map(r4), angle: p.angle }));
    assert.deepEqual(snapGrid(c.nominalGridFor(face, rect)), grid, "lưới danh định không đọc bài đã bóp");
    snapshot.forms[`${type}_${w}x${h}_tờ${sheetNo}`] = { grid, pon, placed, clamp: c.ponClampCount };
  }
}
const snap = JSON.parse(JSON.stringify(snapshot)); // bỏ undefined như khi ghi file
if (GHI || !fs.existsSync(FIXTURE)) {
  fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
  fs.writeFileSync(FIXTURE, JSON.stringify(snapshot, null, 1));
  console.log("ctl_golden: đã ghi mốc " + Object.keys(snapshot.forms).length + " form, " + Object.keys(snapshot.plans).length + " bộ chia");
} else {
  const expected = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  for (const k of Object.keys(expected.plans)) assert.deepEqual(snap.plans[k], expected.plans[k], "bộ chia " + k);
  for (const k of Object.keys(expected.forms)) assert.deepEqual(snap.forms[k], expected.forms[k], "form " + k);
  assert.deepEqual(Object.keys(snap.forms).sort(), Object.keys(expected.forms).sort());
  console.log("ctl_golden: ok (" + Object.keys(expected.forms).length + " form, " + Object.keys(expected.plans).length + " bộ chia khớp mốc)");
}
