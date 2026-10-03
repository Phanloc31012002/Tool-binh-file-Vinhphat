"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const illustrator = require("./illustrator_geometry_mock");
const lib = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const keo = lib.slice(
  lib.indexOf("var dcKeoGayAutoPonVersion"),
  lib.indexOf("//  DÀN THEO MẪU", lib.indexOf("var dcKeoGayAutoPonVersion")),
);
const cleanup = lib.slice(
  lib.indexOf("function dcRemoveOldCanvasArtboards("),
  lib.indexOf("function dcCopyToiUuNoteToOddArtboards("),
);
const pdf = lib.slice(
  lib.indexOf("function dcCtlOffsetPdfPlan("),
  lib.indexOf("function dcLuuCtlOffsetPDF("),
);
const canvas = lib.slice(
  lib.indexOf("function dcDanTheoMauReadCanvasBounds("),
  lib.indexOf("function dcDanTheoMauOutputPositions("),
);
const MM = 2.834645669;
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} != ${b}`);
const plain = (v) => JSON.parse(JSON.stringify(v));
function numbers(face) {
  return face.blocks
    ? face.blocks.flatMap((b) => [...b.top, ...b.bottom])
    : face.row || [...face.top, ...face.bottom];
}
function fixture(n, w = 14, h = 20, left = 100, sourceHeight = 60 * h / w) {
  const f = illustrator({ rect: [0, 700, 500, 0] });
  const labels = [],
    flatCalls = [];
  f.doc.artboards.remove = (i) => f.doc.artboards[i].remove();
  function resize(sx, sy) {
    assert.equal(sx,sy,"Keo gay must never squeeze X/Y independently");
    const b = this.geometricBounds,
      cx = (b[0] + b[2]) / 2,
      cy = (b[1] + b[3]) / 2;
    this._points = this._points.map(([x, y]) => [
      cx + ((x - cx) * sx) / 100,
      cy + ((y - cy) * sy) / 100,
    ]);
    this._updateBounds();
  }
  for (let i = 0; i < n; i++) {
    const x = left + (i % 8) * 100,
      y = 600 - Math.floor(i / 8) * 250;
    const item = f.source([x, y, x + 60, y - sourceHeight], i + 1);
    item.resize = resize;
    item.move = function (parent) {
      this.parent.pageItems.splice(this.parent.pageItems.indexOf(this), 1);
      this.parent = parent;
      parent.pageItems.push(this);
    };
  }
  f.sourceLayer.groupItems = {
    add() {
      const g = {
        pageItems: [],
        parent: f.sourceLayer,
        get geometricBounds() {
          const bs = this.pageItems.map((p) => p.geometricBounds);
          return [
            Math.min(...bs.map((b) => b[0])),
            Math.max(...bs.map((b) => b[1])),
            Math.max(...bs.map((b) => b[2])),
            Math.min(...bs.map((b) => b[3])),
          ];
        },
        translate(x, y) {
          this.pageItems.forEach((p) => p.translate(x, y));
        },
        rotate(a) {
          const b = this.geometricBounds,
            cx = (b[0] + b[2]) / 2,
            cy = (b[1] + b[3]) / 2,
            angle = (a * Math.PI) / 180;
          this.pageItems.forEach((p) => {
            const b = p.geometricBounds,
              x = (b[0] + b[2]) / 2 - cx,
              y = (b[1] + b[3]) / 2 - cy;
            p.rotate(a);
            const bb = p.geometricBounds;
            p.translate(
              cx +
                x * Math.cos(angle) -
                y * Math.sin(angle) -
                (bb[0] + bb[2]) / 2,
              cy +
                x * Math.sin(angle) +
                y * Math.cos(angle) -
                (bb[1] + bb[3]) / 2,
            );
          });
        },
      };
      f.sourceLayer.pageItems.push(g);
      return g;
    },
  };
  f.doc.selection = f.originals.slice().reverse(); // host selection order is not page order
  f.context.dcFlattenForImposition = (_, item, frame, ppi) => {
    assert.equal(ppi,500);
    flatCalls.push(item.identity);
    return item;
  };
  f.context.app.redraw = () => {};
  f.context.alert = () => {};
  f.context.Window = function () {
    const buttons = [];
    const control = () => ({
      add(type, _, text) {
        labels.push(text);
        const child = control();
        if (type === "button") buttons.push({ text, child });
        return child;
      },
    });
    const dialog = control();
    dialog.close = () => {};
    dialog.show = () =>
      buttons.find((b) => b.text === "Bỏ qua").child.onClick();
    return dialog;
  };
  const c = vm.createContext(f.context);
  vm.runInContext(cleanup + pdf + canvas + keo, c);
  return {
    ...f,
    c,
    labels,
    flatCalls,
    run: () => c.dcRunKeoGay(String(w), String(h)),
  };
}

// Execute production planner for every supported remainder, both families.
const c = fixture(32).c;
for (const small of [false, true])
  for (let n = 4; n <= 256; n += 4) {
    const faces = plain(c.dcKeoGayPlan(n, small));
    const all = faces.flatMap(numbers).sort((a, b) => a - b);
    assert.deepEqual(
      all,
      Array.from({ length: n }, (_, i) => i + 1),
      "Every page occurs exactly once",
    );
    assert.equal(
      faces.filter((f) => f.type === "AB").length,
      Math.floor(n / (small ? 32 : 16)) * 2,
    );
    let selfTurnSeen = false;
    for (const face of faces) {
      if (face.type !== "AB") selfTurnSeen = true;
      else
        assert.equal(
          selfTurnSeen,
          false,
          "AB must precede every self-turn form",
        );
    }
  }
assert.deepEqual(
  plain(c.dcKeoGayPlan(48, true)).map((f) => f.type),
  ["AB", "AB", "TT16"],
);
assert.deepEqual(
  plain(c.dcKeoGayPlan(60, true)).map((f) => f.type),
  ["AB", "AB", "TT16", "TT8", "TT4"],
);
assert.deepEqual(
  plain(c.dcKeoGayPlan(32, false)).map((f) => f.top),
  [
    [5, 12, 9, 8],
    [7, 10, 11, 6],
    [21, 28, 25, 24],
    [23, 26, 27, 22],
  ],
);
assert.deepEqual(
  plain(c.dcKeoGayPlan(32, true))[0].blocks[1].top,
  [21, 28, 25, 24],
);
assert.deepEqual(
  plain(c.dcKeoGayPlan(32, true))[1].blocks[0].top,
  [23, 26, 27, 22],
);

// Independent duplex registration check: physically opposite pages must be
// 1/2, 3/4, ... and remain upright together after a horizontal sheet turn.
const rect = [0, 2000, 2436.1, 2000 - 1775.62];
const faces = plain(c.dcKeoGayPlan(64, true));
for (let i = 0; i < faces.length; i += 2) {
  const a = plain(
    c.dcKeoGayPackedGrid(faces[i], 148 * MM, 210 * MM, rect, 23.7 * MM),
  );
  const b = plain(
    c.dcKeoGayPackedGrid(faces[i + 1], 148 * MM, 210 * MM, rect, 23.7 * MM),
  );
  for (const cell of a.cells) {
    const opposite = b.cells.find(
      (x) =>
        Math.abs(x.cx - (rect[0] + rect[2] - cell.cx)) < 0.01 &&
        Math.abs(x.cy - cell.cy) < 0.01,
    );
    assert.ok(opposite);
    assert.equal(opposite.page, cell.page % 2 ? cell.page + 1 : cell.page - 1);
    assert.equal((((cell.angle + opposite.angle) % 360) + 360) % 360, 0);
  }
}

// Entire production renderer, including all remainder paths, crop marks,
// source sorting, frame cleanup, coordinate restoration and PDF plan.
for (const [w, h] of [
  [14, 20],
  [14.5, 20.7],
  [14.8, 21],
  [15, 21.15],
  [20, 14],
]) {
  for (const n of [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 60, 64, 96]) {
    const f = fixture(n, w, h),
      result = f.run();
    assert.match(result, /^OK:/);
    assert.equal(f.c.app.coordinateSystem, "user-coordinates");
    assert.deepEqual(
      f.flatCalls,
      Array.from({ length: n }, (_, i) => i + 1),
    );
    const plan = plain(f.c.dcKeoGayPlan(n, true));
    if (plan.some((p) => p.type === "TT4"))
      assert.ok(f.labels.includes("Ghi chú TỰ TRỞ 43 × 32,5 (4 trang):"));
    assert.equal(f.doc.artboards.length, plan.length);
    const pdfPlan = JSON.parse(result.split("||CTLPDF:")[1]);
    assert.equal(pdfPlan.total, plan.length);
    if (n % 32 >= 16) {
      assert.ok(f.labels.includes("Ghi chú TỰ TRỞ 65 × 86 (16 trang):"));
      assert.equal(
        pdfPlan.groups.find((g) => g.key === "TT16").jobs[0].ab.length,
        1,
      );
    }
    if (n >= 32)
      assert.ok(f.labels.includes("Ghi chú TỜ AB (32 trang, chỉ mặt A):"));
    for (let bi = 0; bi < plan.length; bi++) {
      const r = f.doc.artboards[bi].artboardRect;
      const face = plan[bi];
      const tt8Small =
        face.smallSelfTurn &&
        Math.min(w, h) * 40 * MM + 4 * MM + 1 <= 648 * MM &&
        Math.max(w, h) * 20 * MM + 1 <= 418 * MM;
      const sheet =
        face.type === "TT4" ? [428, 313] : tt8Small ? [648, 418] : [858, 638];
      near(r[2] - r[0], sheet[0] * MM);
      near(r[1] - r[3], sheet[1] * MM);
      for (const page of numbers(plan[bi])) {
        const p = f.originals[page - 1],
          b = p.geometricBounds;
        assert.ok(
          b[0] >= r[0] - 0.01 &&
            b[1] <= r[1] + 0.01 &&
            b[2] <= r[2] + 0.01 &&
            b[3] >= r[3] - 0.01,
          `Page ${page} escapes ${plan[bi].type}`,
        );
        const smallerScale = sheet[0] < 650 ? Math.min(1, 20.9 / Math.max(w, h)) : 1;
        near(
          b[2] - b[0],
          (plan[bi].blocks || plan[bi].type === "TT4"
            ? Math.max(w, h)
            : Math.min(w, h)) *
            smallerScale * 10 *
            MM,
        );
      }
    }
    const marks = f.doc.layers.find(
      (l) => l.name === "Pon cat CTL Keo Gay tu dong",
    ).pageItems;
    const paper = f.doc.layers.find(
      (l) => l.name === "Pon CTL Keo Gay tu dong",
    ).pageItems;
    assert.equal(
      paper.length,
      plan.length * 8,
      "Four two-leg paper corner marks per sheet",
    );
    for (let bi = 0; bi < plan.length; bi++) {
      const r = f.doc.artboards[bi].artboardRect,
        p = paper.slice(bi * 8, bi * 8 + 8);
      for (const [x, y] of [
        [r[0], r[1]],
        [r[2], r[1]],
        [r[0], r[3]],
        [r[2], r[3]],
      ]) {
        assert.equal(
          p.filter((m) =>
            m._points.some(
              (pt) => Math.abs(pt[0] - x) < 0.01 && Math.abs(pt[1] - y) < 0.01,
            ),
          ).length,
          2,
          "Paper PON centres must land exactly on artboard corners, same as Bấm ghim",
        );
      }
      const smallPaper =
        plan[bi].type === "TT4" ||
        (plan[bi].smallSelfTurn && r[2] - r[0] < 650 * MM);
      near(p[0].strokeWidth, smallPaper ? 1.995 : 3.971);
      near(
        p[0]._points[1][0] - p[0]._points[0][0],
        smallPaper ? 14.173 : 18.766,
      );
      near(
        Math.abs(p[1]._points[1][1] - p[1]._points[0][1]),
        smallPaper ? 14.106 : 21.091,
      );
      if (plan[bi].blocks) {
        const grid = f.c.dcKeoGayPackedGrid(
          plan[bi],
          Math.min(w, h) * 10 * MM,
          Math.max(w, h) * 10 * MM,
          r,
          23.7 * MM,
        );
        for (const fraction of [0.25, 0.75])
          for (const y of [grid.top, grid.top - grid.height]) {
            const x = grid.left + grid.width * fraction;
            assert.equal(
              marks.filter(
                (m) =>
                  m._points.every((p) => Math.abs(p[0] - x) < 0.01) &&
                  m._points.some((p) => Math.abs(p[1] - y) < 0.01),
              ).length,
              1,
              "Missing cut axis splitting the two-page panels",
            );
          }
        assert.equal(
          marks.filter((m) =>
            m._points.every(
              (p) =>
                p[0] >= r[0] - 0.01 &&
                p[0] <= r[2] + 0.01 &&
                p[1] <= r[1] + 0.01 &&
                p[1] >= r[3] - 0.01,
            ),
          ).length,
          16,
        );
      }
    }
    for (const mark of marks) {
      const pts = mark._points,
        x = (pts[0][0] + pts[1][0]) / 2,
        y = (pts[0][1] + pts[1][1]) / 2;
      assert.ok(
        !f.originals.some((p) => {
          const b = p.geometricBounds;
          return (
            x > b[0] + 0.01 &&
            x < b[2] - 0.01 &&
            y < b[1] - 0.01 &&
            y > b[3] + 0.01
          );
        }),
        "Crop stroke intrudes into page artwork",
      );
    }
  }
}
for (const n of [16, 32, 48, 64]) {
  const f = fixture(n, 21, 29.7);
  assert.match(f.run(), /^OK:/);
  assert.equal(
    f.doc.artboards.length,
    n / 8,
    "A4 keeps one 16-page A/B pair per signature",
  );
  assert.ok(f.labels.includes("Ghi chú TỜ AB (16 trang, chỉ mặt A):"));
  for (const ab of f.doc.artboards) {
    near(ab.artboardRect[2] - ab.artboardRect[0], 858 * MM);
    near(ab.artboardRect[1] - ab.artboardRect[3], 638 * MM);
  }
}
const a4tt4 = fixture(4, 20, 28);
assert.match(a4tt4.run(), /^OK:/);
near(
  a4tt4.doc.artboards[0].artboardRect[2] -
    a4tt4.doc.artboards[0].artboardRect[0],
  648 * MM,
);
near(
  a4tt4.doc.artboards[0].artboardRect[1] -
    a4tt4.doc.artboards[0].artboardRect[3],
  418 * MM,
);
assert.ok(fixture(4).run().includes("||CTLPDF:"));
const tooTall4 = fixture(4, 21, 29.7);
assert.match(tooTall4.run(), /^OK:/);
assert.equal(tooTall4.flatCalls.length, 4);
assert.equal(tooTall4.doc.artboards.length, 1);
for (const page of tooTall4.originals) {
  const b = page.geometricBounds;
  near(b[1] - b[3], 209 * MM);
  near(b[2] - b[0], 297 * 209 / 210 * MM);
}
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
injected.doc.artboards.add = (r) => {
  if (++additions === 2) throw Error("injected artboard failure");
  return add(r);
};
assert.match(injected.run(), /^ERR:/);
assert.equal(injected.doc.artboards.length, 1);
assert.equal(injected.flatCalls.length, 0);
const coordinatePdf = fixture(32);
const originalPdf = coordinatePdf.c.dcCtlOffsetPdfPlan;
coordinatePdf.c.dcCtlOffsetPdfPlan = function () {
  assert.equal(
    coordinatePdf.c.app.coordinateSystem,
    "document-coordinates",
    "Build PDF metadata before restoring artboard-coordinate mode",
  );
  return originalPdf.apply(null, arguments);
};
assert.match(coordinatePdf.run(), /\|\|CTLPDF:/);
const main = fs.readFileSync(
  require.resolve("../DanCardCEP/js/main.js"),
  "utf8",
);
assert.match(main, /dcKeoGayAutoPonVersion < 11/);
assert.match(main, /TT16: "Tự trở 16 trang"/);
const squeeze = fixture(4,14,20,100,90);
const beforeSqueeze = JSON.stringify(squeeze.originals.map(p=>p.geometricBounds));
assert.match(squeeze.run(),/^ERR:.*Trang ruột 1:.*không bóp bài/);
assert.equal(squeeze.flatCalls.length,0,"mismatch must be rejected before rasterizing any page");
assert.equal(squeeze.doc.artboards.length,1);
assert.equal(squeeze.doc.layers.length,1);
assert.equal(JSON.stringify(squeeze.originals.map(p=>p.geometricBounds)),beforeSqueeze);
const laterMismatch=fixture(4);
laterMismatch.originals[3]._points.forEach(p=>{p[1]*=1.1;});
laterMismatch.originals[3]._updateBounds();
const laterBefore=JSON.stringify(laterMismatch.originals.map(p=>p.geometricBounds));
assert.match(laterMismatch.run(),/^ERR:.*không bóp bài/);
assert.equal(laterMismatch.flatCalls.length,0,"scan every source before consuming the first");
assert.equal(laterMismatch.doc.artboards.length,1);
assert.equal(JSON.stringify(laterMismatch.originals.map(p=>p.geometricBounds)),laterBefore);
assert.throws(()=>c.dcKeoGayPageScale(0,90,140,200));
assert.throws(()=>c.dcKeoGayPageScale(60,90,140,200),/không bóp/);
near(c.dcKeoGayPageScale(70,100,140,200),200);
near(c.dcKeoGayPageScale(210,297,212,300,true),212/210*100);
near(c.dcKeoGayPageScale(200,297,212,300,true),300/297*100);
assert.throws(()=>c.dcKeoGayPageScale(200,297,212,300),/không bóp/);
// A4 max applies only to the large form; small forms use a proportional
// 20.9 cm limit. Mixed source aspects retain their own ratio and slot centre.
for (const n of [4,8,12,16,20,32,84]) {
  const f = fixture(n,21.2,30);
  const before=[];
  f.originals.forEach((p,i)=>{
    const b=p.geometricBounds, heights=[60*297/210,60*297/200,90,75];
    p._points=[[b[0],b[1]],[b[2],b[1]],[b[2],b[1]-heights[i%4]],[b[0],b[1]-heights[i%4]]];
    p._updateBounds();
    before.push({w:60,h:heights[i%4]});
  });
  const result=f.run();
  assert.match(result,/^OK:/);
  const faces=plain(f.c.dcKeoGayPlan(n,false));
  assert.equal(f.doc.artboards.length,faces.length);
  const metadata=JSON.parse(result.split("||CTLPDF:")[1]);
  assert.equal(metadata.total,faces.length);
  faces.forEach((face,fi)=>{
    const r=f.doc.artboards[fi].artboardRect;
    const small=face.type==="TT4", W=small?209:212, H=small?300*209/212:300;
    near(r[2]-r[0],(small?648:858)*MM);
    near(r[1]-r[3],(small?418:638)*MM);
    numbers(face).forEach((pn,slot)=>{
      const b=f.originals[pn-1].geometricBounds, src=before[pn-1];
      const scale=Math.min(W*MM/src.w,H*MM/src.h);
      const expectedW=(small?src.h:src.w)*scale;
      const expectedH=(small?src.w:src.h)*scale;
      near(b[2]-b[0],expectedW); near(b[1]-b[3],expectedH);
      assert.ok(b[0]>=r[0]-.01 && b[1]<=r[1]+.01 && b[2]<=r[2]+.01 && b[3]>=r[3]-.01);
      const cx=(r[0]+r[2])/2, cy=(r[1]+r[3])/2;
      const expectedX=small?cx+(slot<2?-1:1)*(H*MM+6*MM)/2:cx+(slot%4-1.5)*W*MM;
      const expectedY=small?cy+(slot%2===0?1:-1)*W*MM/2:r[1]-23.7*MM-(slot<4?.5:1.5)*H*MM;
      near((b[0]+b[2])/2,expectedX); near((b[1]+b[3])/2,expectedY);
    });
  });
  const marks=f.doc.layers.find(l=>l.name==="Pon cat CTL Keo Gay tu dong").pageItems;
  for (const mark of marks) {
    const [p,q]=mark._points;
    assert.ok(Math.hypot(p[0]-q[0],p[1]-q[1])>.1,"Crop stroke must not collapse on the 20.9 cm sheet edge");
    assert.ok(f.doc.artboards.some(ab=>mark._points.every(pt=>pt[0]>=ab.artboardRect[0]+.49 && pt[0]<=ab.artboardRect[2]-.49 && pt[1]<=ab.artboardRect[1]-.49 && pt[1]>=ab.artboardRect[3]+.49)),"Crop endpoints outside paper");
    const x=(p[0]+q[0])/2,y=(p[1]+q[1])/2;
    assert.ok(!f.originals.some(item=>{const b=item.geometricBounds;return x>b[0]+.01&&x<b[2]-.01&&y<b[1]-.01&&y>b[3]+.01;}),"Crop intrudes into fitted artwork");
  }
}
for (const [w,h] of [[21.21,30],[21.2,30.01],[30,21.2]]) {
  const f=fixture(16,w,h), before=JSON.stringify(f.originals.map(p=>p.geometricBounds));
  assert.match(f.run(),/^ERR:.*Khung A4 tối đa 21,2 × 30/);
  assert.equal(f.flatCalls.length,0); assert.equal(f.doc.artboards.length,1);
  assert.equal(JSON.stringify(f.originals.map(p=>p.geometricBounds)),before);
}
console.log(
  "Keo gay: same physical paper/corner PON as staple, A5 TT4 small sheet, 4 new panel cuts, SIG16/duplex/remainders, AI plan and A4 regression passed.",
);
