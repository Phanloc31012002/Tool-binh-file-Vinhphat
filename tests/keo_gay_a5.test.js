"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const illustrator = require("./illustrator_geometry_mock");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");
const keo = lib.slice(lib.indexOf("var dcKeoGayAutoPonVersion"), lib.indexOf("//  DÀN THEO MẪU", lib.indexOf("var dcKeoGayAutoPonVersion")));
const cleanup = lib.slice(lib.indexOf("function dcRemoveOldCanvasArtboards("), lib.indexOf("function dcCopyToiUuNoteToOddArtboards("));
const pdf = lib.slice(lib.indexOf("function dcCtlOffsetPdfPlan("), lib.indexOf("function dcLuuCtlOffsetPDF("));
const MM = 2.834645669;
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} != ${b}`);
const plain = (v) => JSON.parse(JSON.stringify(v));
function numbers(face) {
  return face.blocks ? face.blocks.flatMap((b) => [...b.top, ...b.bottom]) : face.row || [...face.top, ...face.bottom];
}
function fixture(n, w = 14, h = 20, left = 100) {
  const f = illustrator({ rect: [0, 700, 500, 0] });
  const labels = [], flatCalls = [];
  f.doc.artboards.remove = (i) => f.doc.artboards[i].remove();
  function resize(sx, sy) {
    const b = this.geometricBounds, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    this._points = this._points.map(([x, y]) => [cx + (x - cx) * sx / 100, cy + (y - cy) * sy / 100]);
    this._updateBounds();
  }
  for (let i = 0; i < n; i++) {
    const x = left + i % 8 * 100, y = 600 - Math.floor(i / 8) * 250;
    const item = f.source([x, y, x + 60, y - 90], i + 1);
    item.resize = resize;
    item.move = function (parent) {
      this.parent.pageItems.splice(this.parent.pageItems.indexOf(this), 1);
      this.parent = parent;
      parent.pageItems.push(this);
    };
  }
  f.sourceLayer.groupItems = { add() {
    const g = { pageItems: [], parent: f.sourceLayer,
      get geometricBounds() {
        const bs = this.pageItems.map((p) => p.geometricBounds);
        return [Math.min(...bs.map((b) => b[0])), Math.max(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.min(...bs.map((b) => b[3]))];
      },
      translate(x, y) { this.pageItems.forEach((p) => p.translate(x, y)); },
      rotate(a) {
        const b = this.geometricBounds, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, angle = a * Math.PI / 180;
        this.pageItems.forEach((p) => {
          const b = p.geometricBounds, x = (b[0] + b[2]) / 2 - cx, y = (b[1] + b[3]) / 2 - cy;
          p.rotate(a);
          const bb = p.geometricBounds;
          p.translate(cx + x * Math.cos(angle) - y * Math.sin(angle) - (bb[0] + bb[2]) / 2, cy + x * Math.sin(angle) + y * Math.cos(angle) - (bb[1] + bb[3]) / 2);
        });
      }
    };
    f.sourceLayer.pageItems.push(g);
    return g;
  } };
  f.doc.selection = f.originals.slice().reverse(); // host selection order is not page order
  f.context.dcFlattenForImposition = (_, item) => { flatCalls.push(item.identity); return item; };
  f.context.app.redraw = () => {};
  f.context.alert = () => {};
  f.context.Window = function () {
    const buttons = [];
    const control = () => ({ add(type, _, text) {
      labels.push(text);
      const child = control();
      if (type === "button") buttons.push({ text, child });
      return child;
    } });
    const dialog = control();
    dialog.close = () => {};
    dialog.show = () => buttons.find((b) => b.text === "Bỏ qua").child.onClick();
    return dialog;
  };
  const c = vm.createContext(f.context);
  vm.runInContext(cleanup + pdf + keo, c);
  return { ...f, c, labels, flatCalls, run: () => c.dcRunKeoGay(String(w), String(h)) };
}

// Execute production planner for every supported remainder, both families.
const c = fixture(32).c;
for (const small of [false, true]) for (let n = 4; n <= 256; n += 4) {
  const faces = plain(c.dcKeoGayPlan(n, small));
  const all = faces.flatMap(numbers).sort((a, b) => a - b);
  assert.deepEqual(all, Array.from({ length: n }, (_, i) => i + 1), "Every page occurs exactly once");
  assert.equal(faces.filter((f) => f.type === "AB").length, Math.floor(n / (small ? 32 : 16)) * 2);
  let selfTurnSeen = false;
  for (const face of faces) {
    if (face.type !== "AB") selfTurnSeen = true;
    else assert.equal(selfTurnSeen, false, "AB must precede every self-turn form");
  }
}
assert.deepEqual(plain(c.dcKeoGayPlan(48, true)).map((f) => f.type), ["AB", "AB", "TT16"]);
assert.deepEqual(plain(c.dcKeoGayPlan(60, true)).map((f) => f.type), ["AB", "AB", "TT16", "TT8", "TT4"]);
assert.deepEqual(plain(c.dcKeoGayPlan(32, false)).map((f) => f.top), [[5, 12, 9, 8], [7, 10, 11, 6], [21, 28, 25, 24], [23, 26, 27, 22]]);
assert.deepEqual(plain(c.dcKeoGayPlan(32, true))[0].blocks[1].top, [21, 28, 25, 24]);
assert.deepEqual(plain(c.dcKeoGayPlan(32, true))[1].blocks[0].top, [23, 26, 27, 22]);

// Independent duplex registration check: physically opposite pages must be
// 1/2, 3/4, ... and remain upright together after a horizontal sheet turn.
const rect = [0, 2000, 2436.1, 2000 - 1775.62];
const faces = plain(c.dcKeoGayPlan(64, true));
for (let i = 0; i < faces.length; i += 2) {
  const a = plain(c.dcKeoGayPackedGrid(faces[i], 148 * MM, 210 * MM, rect, 23.7 * MM));
  const b = plain(c.dcKeoGayPackedGrid(faces[i + 1], 148 * MM, 210 * MM, rect, 23.7 * MM));
  for (const cell of a.cells) {
    const opposite = b.cells.find((x) => Math.abs(x.cx - (rect[0] + rect[2] - cell.cx)) < 0.01 && Math.abs(x.cy - cell.cy) < 0.01);
    assert.ok(opposite);
    assert.equal(opposite.page, cell.page % 2 ? cell.page + 1 : cell.page - 1);
    assert.equal(((cell.angle + opposite.angle) % 360 + 360) % 360, 0);
  }
}

// Entire production renderer, including all remainder paths, crop marks,
// source sorting, frame cleanup, coordinate restoration and PDF plan.
for (const [w, h] of [[14, 20], [14.8, 21], [15, 21.15], [20, 14]]) {
  for (const n of [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 60, 64, 96]) {
    const f = fixture(n, w, h), result = f.run();
    assert.match(result, /^OK:/);
    assert.equal(f.c.app.coordinateSystem, "user-coordinates");
    assert.deepEqual(f.flatCalls, Array.from({ length: n }, (_, i) => i + 1));
    const plan = plain(f.c.dcKeoGayPlan(n, true));
    if (plan.some(p => p.type === "TT4")) assert.ok(f.labels.includes("Ghi chú TỰ TRỞ 43 × 32,5 (4 trang):"));
    assert.equal(f.doc.artboards.length, plan.length);
    const pdfPlan = JSON.parse(result.split("||CTLPDF:")[1]);
    assert.equal(pdfPlan.total, plan.length);
    if (n % 32 >= 16) {
      assert.ok(f.labels.includes("Ghi chú TỰ TRỞ 65 × 86 (16 trang):"));
      assert.equal(pdfPlan.groups.find((g) => g.key === "TT16").jobs[0].ab.length, 1);
    }
    if (n >= 32) assert.ok(f.labels.includes("Ghi chú TỜ AB (32 trang, chỉ mặt A):"));
    for (let bi = 0; bi < plan.length; bi++) {
      const r = f.doc.artboards[bi].artboardRect;
      const face = plan[bi];
      const tt8Small = face.smallSelfTurn && Math.min(w, h) * 40 * MM + 4 * MM + 1 <= 648 * MM && Math.max(w, h) * 20 * MM + 4 * MM + 1 <= 418 * MM;
      const sheet = face.type === "TT4" ? [428, 313] : tt8Small ? [648, 418] : [858, 638];
      near(r[2] - r[0], sheet[0] * MM);
      near(r[1] - r[3], sheet[1] * MM);
      for (const page of numbers(plan[bi])) {
        const p = f.originals[page - 1], b = p.geometricBounds;
        assert.ok(b[0] >= r[0] - 0.01 && b[1] <= r[1] + 0.01 && b[2] <= r[2] + 0.01 && b[3] >= r[3] - 0.01, `Page ${page} escapes ${plan[bi].type}`);
        near(b[2] - b[0], (plan[bi].blocks || plan[bi].type === "TT4" ? Math.max(w, h) : Math.min(w, h)) * 10 * MM);
      }
    }
    const marks = f.doc.layers.find((l) => l.name === "Pon cat CTL Keo Gay tu dong").pageItems;
    const paper = f.doc.layers.find((l) => l.name === "Pon CTL Keo Gay tu dong").pageItems;
    assert.equal(paper.length, plan.length * 8, "Four two-leg paper corner marks per sheet");
    for (let bi = 0; bi < plan.length; bi++) {
      const r = f.doc.artboards[bi].artboardRect, p = paper.slice(bi * 8, bi * 8 + 8);
      for (const [x, y] of [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]]]) {
        assert.equal(p.filter(m => m._points.some(pt => Math.abs(pt[0] - x) < 0.01 && Math.abs(pt[1] - y) < 0.01)).length, 2, "Paper PON centres must land exactly on artboard corners, same as Bấm ghim");
      }
      const smallPaper = plan[bi].type === "TT4" || plan[bi].smallSelfTurn && (r[2] - r[0]) < 650 * MM;
      near(p[0].strokeWidth, smallPaper ? 1.995 : 3.971);
      near(p[0]._points[1][0] - p[0]._points[0][0], smallPaper ? 14.173 : 18.766);
      near(Math.abs(p[1]._points[1][1] - p[1]._points[0][1]), smallPaper ? 14.106 : 21.091);
      if (plan[bi].blocks) {
        const grid = f.c.dcKeoGayPackedGrid(plan[bi], Math.min(w, h) * 10 * MM, Math.max(w, h) * 10 * MM, r, 23.7 * MM);
        for (const fraction of [0.25, 0.75]) for (const y of [grid.top, grid.top - grid.height]) {
          const x = grid.left + grid.width * fraction;
          assert.equal(marks.filter(m => m._points.every(p => Math.abs(p[0] - x) < 0.01) && m._points.some(p => Math.abs(p[1] - y) < 0.01)).length, 1, "Missing cut axis splitting the two-page panels");
        }
        assert.equal(marks.filter(m => m._points.every(p => p[0] >= r[0] - 0.01 && p[0] <= r[2] + 0.01 && p[1] <= r[1] + 0.01 && p[1] >= r[3] - 0.01)).length, 16);
      }
    }
    for (const mark of marks) {
      const pts = mark._points, x = (pts[0][0] + pts[1][0]) / 2, y = (pts[0][1] + pts[1][1]) / 2;
      assert.ok(!f.originals.some((p) => {
        const b = p.geometricBounds;
        return x > b[0] + 0.01 && x < b[2] - 0.01 && y < b[1] - 0.01 && y > b[3] + 0.01;
      }), "Crop stroke intrudes into page artwork");
    }
  }
}
for (const n of [16, 32, 48, 64]) {
  const f = fixture(n, 21, 29.7);
  assert.match(f.run(), /^OK:/);
  assert.equal(f.doc.artboards.length, n / 8, "A4 keeps one 16-page A/B pair per signature");
  assert.ok(f.labels.includes("Ghi chú TỜ AB (16 trang, chỉ mặt A):"));
  for (const ab of f.doc.artboards) {
    near(ab.artboardRect[2] - ab.artboardRect[0], 858 * MM);
    near(ab.artboardRect[1] - ab.artboardRect[3], 638 * MM);
  }
}
const a4tt4 = fixture(4, 20, 28);
assert.match(a4tt4.run(), /^OK:/);
near(a4tt4.doc.artboards[0].artboardRect[2] - a4tt4.doc.artboards[0].artboardRect[0], 648 * MM);
near(a4tt4.doc.artboards[0].artboardRect[1] - a4tt4.doc.artboards[0].artboardRect[3], 418 * MM);
assert.ok(fixture(4).run().includes("||CTLPDF:"));
const tooTall4 = fixture(4, 21, 29.7);
assert.match(tooTall4.run(), /^ERR:.*không vừa tờ tự trở 4 trang/);
assert.equal(tooTall4.flatCalls.length, 0, "Reject oversized TT4 before touching source pages");
assert.equal(tooTall4.doc.artboards.length, 1);
// Preflight canvas exhaustion must not rasterize sources or delete frames.
const failed = fixture(32, 14, 20, 7100);
assert.match(failed.run(), /^ERR:/);
assert.equal(failed.doc.artboards.length, 1);
assert.equal(failed.flatCalls.length, 0);
assert.equal(failed.doc.layers.length, 1);
assert.equal(failed.c.app.coordinateSystem, "user-coordinates");
const injected = fixture(32);
const add = injected.doc.artboards.add;
let additions = 0;
injected.doc.artboards.add = (r) => { if (++additions === 2) throw Error("injected artboard failure"); return add(r); };
assert.match(injected.run(), /^ERR:/);
assert.equal(injected.doc.artboards.length, 1);
assert.equal(injected.flatCalls.length, 0);
const coordinatePdf = fixture(32);
const originalPdf = coordinatePdf.c.dcCtlOffsetPdfPlan;
coordinatePdf.c.dcCtlOffsetPdfPlan = function () {
  assert.equal(coordinatePdf.c.app.coordinateSystem, "document-coordinates", "Build PDF metadata before restoring artboard-coordinate mode");
  return originalPdf.apply(null, arguments);
};
assert.match(coordinatePdf.run(), /\|\|CTLPDF:/);
const main = fs.readFileSync(require.resolve("../DanCardCEP/js/main.js"), "utf8");
assert.match(main, /dcKeoGayAutoPonVersion < 8/);
assert.match(main, /TT16: "Tự trở 16 trang"/);
console.log("Keo gay: same physical paper/corner PON as staple, A5 TT4 small sheet, 4 new panel cuts, SIG16/duplex/remainders, AI plan and A4 regression passed.");
