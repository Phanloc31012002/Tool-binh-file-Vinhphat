// Chạy chính các hàm phụ form/lưới/đặt bài CTL của code thật, không phải một
// công thức hình học viết lại. Bản giả lập chỉ cài các phép affine trên bounding box.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const library = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const MM = 2.834645669;

function functionText(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert(start >= 0, `Missing production function ${name}`);
  const open = source.indexOf("{", start);
  let depth = 1,
    state = "code",
    quote;
  for (let i = open + 1; i < source.length; i++) {
    const c = source[i],
      n = source[i + 1];
    if (state === "string") {
      if (c === "\\") i++;
      else if (c === quote) state = "code";
    } else if (state === "line") {
      if (c === "\n" || c === "\r") state = "code";
    } else if (state === "block") {
      if (c === "*" && n === "/") {
        i++;
        state = "code";
      }
    } else if (c === '"' || c === "'") {
      state = "string";
      quote = c;
    } else if (c === "/" && n === "/") {
      i++;
      state = "line";
    } else if (c === "/" && n === "*") {
      i++;
      state = "block";
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unbalanced production function ${name}`);
}
const signature = functionText(library, "dcRunSignature8");
const helpers = [
  "formSpec",
  "nominalGridFor",
  "centerItem",
  "placeRow8",
  "placeFace8",
  "buildPairGroup",
  "centerGroupAt",
  "placeFace4",
  "squeezeAboutCentre",
  "groupPages",
  "ungroupInto",
  "ctlBlack",
  "addAutoCutPon",
  "addAutoPon",
]
  .map((name) => functionText(signature, name))
  .join("\n");
const constants = [
  "TOP_GAP",
  "MID_GAP",
  "MID_GAP_TT4",
  "MID_GAP_A5_MAIN",
  "MID_GAP_A5_COVER",
  "SHEET_65x86",
  "SHEET_AB",
  "SHEET_65x43",
  "SHEET_43x32",
  "A5_MAIN_ROW_GAP",
  "SMALL8_TRIM_OVERLAP",
  "BOP_PER_SHEET",
  "CUT_MARK",
  "CUT_STROKE",
  "PON_PAPER",
]
  .map((name) => {
    const match = signature.match(new RegExp(`\\bvar ${name}\\s*=[^;]+;`));
    assert(match, `Missing production constant ${name}`);
    return match[0];
  })
  .join("\n");

class Box {
  constructor(bounds, parent, group = false) {
    this.bounds = bounds && bounds.slice();
    this.parent = parent;
    this.angle = 0;
    this.pageItems = group ? [] : null;
    this.groupItems = {
      add: () => {
        const child = new Box(null, this, true);
        this.pageItems.push(child);
        return child;
      },
    };
  }
  get geometricBounds() {
    if (!this.pageItems) return this.bounds.slice();
    assert(this.pageItems.length, "Cannot measure empty mock group");
    const bounds = this.pageItems.map((p) => p.geometricBounds);
    return [
      Math.min(...bounds.map((b) => b[0])),
      Math.max(...bounds.map((b) => b[1])),
      Math.max(...bounds.map((b) => b[2])),
      Math.min(...bounds.map((b) => b[3])),
    ];
  }
  get visibleBounds() {
    return this.geometricBounds;
  }
  _affine(cx, cy, sx, sy, dx = 0, dy = 0) {
    if (this.pageItems)
      for (const item of this.pageItems) item._affine(cx, cy, sx, sy, dx, dy);
    else
      this.bounds = [
        cx + (this.bounds[0] - cx) * sx + dx,
        cy + (this.bounds[1] - cy) * sy + dy,
        cx + (this.bounds[2] - cx) * sx + dx,
        cy + (this.bounds[3] - cy) * sy + dy,
      ];
  }
  translate(dx, dy) {
    this._affine(0, 0, 1, 1, dx, dy);
  }
  resize(sx, sy) {
    const b = this.geometricBounds;
    this._affine((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, sx / 100, sy / 100);
  }
  rotate(angle) {
    assert.strictEqual(
      Math.abs(angle) % 90,
      0,
      "CTL helpers only require right-angle affine rotations",
    );
    const b = this.geometricBounds;
    this._rotate((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, angle);
  }
  _rotate(cx, cy, angle) {
    this.angle += angle;
    if (this.pageItems) {
      for (const item of this.pageItems) item._rotate(cx, cy, angle);
    } else {
      const b = this.bounds, a = angle * Math.PI / 180;
      const corners = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]
        .map(([x, y]) => [
          cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
          cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)
        ]);
      this.bounds = [
        Math.min(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1])),
        Math.max(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1]))
      ];
    }
  }
  move(parent) {
    if (this.parent)
      this.parent.pageItems.splice(this.parent.pageItems.indexOf(this), 1);
    this.parent = parent;
    parent.pageItems.push(this);
  }
  remove() {
    if (this.parent)
      this.parent.pageItems.splice(this.parent.pageItems.indexOf(this), 1);
  }
}
function context(widthMm, heightMm, pageCount = 8) {
  const layer = new Box(null, null, true);
  const processed = Array.from({ length: pageCount }, (_, i) => {
    const item = new Box(
      [i * 10, 100, i * 10 + widthMm * MM, 100 - heightMm * MM],
      layer,
    );
    layer.pageItems.push(item);
    return item;
  });
  const c = vm.createContext({
    MM,
    pageWpt: widthMm * MM,
    pageHpt: heightMm * MM,
    artworkLayer: layer,
    processed,
    ponClampCount: 0,
    ElementPlacement: { PLACEATEND: 1 },
    CMYKColor: function () {},
  });
  vm.runInContext(constants + "\n" + helpers, c);
  return { c, processed };
}
function near(actual, expected, message) {
  assert(
    Math.abs(actual - expected) <= 1e-6,
    `${message}: expected ${expected}, got ${actual}`,
  );
}
function boundsUnion(items) {
  const b = items.map((p) => p.geometricBounds);
  return [
    Math.min(...b.map((v) => v[0])),
    Math.max(...b.map((v) => v[1])),
    Math.max(...b.map((v) => v[2])),
    Math.min(...b.map((v) => v[3])),
  ];
}
function cropPaths(c, face, rect) {
  const paths = [];
  c.addAutoCutPon(
    {
      pathItems: {
        add() {
          const path = {
            setEntirePath(points) {
              paths.push(points.map((p) => [...p]));
            },
          };
          return path;
        },
      },
    },
    face,
    rect,
  );
  return paths;
}
function centreX(items) {
  const b = boundsUnion(items);
  return (b[0] + b[2]) / 2;
}
function paperPaths(c, rect, kind) {
  const paths = [];
  const layer = { pathItems: { add() {
    const path = { setEntirePath(points) {
      this.points = points.map(p => [...p]);
    } };
    paths.push(path);
    return path;
  } } };
  c.addAutoPon(layer, rect, kind);
  return paths.map(path => ({ points: path.points, stroke: path.strokeWidth }));
}

// TT4 bìa/tự trở A4 vốn đã canh giữa hai cặp trang xoay. Lưới danh định
// của nó phải dùng đúng tâm dọc đó thay vì chừa một lề nhíp trên 9 mm
// không tồn tại rồi từ chối khổ nhập thật 209 x 300 mm.
for (const widthMm of [200, 209]) for (const heightMm of [270, 300])
for (const sheetNo of [0, 2]) {
  const { c, processed } = context(widthMm, heightMm, 4);
  const rect = [-37 * MM, 501 * MM, (648 - 37) * MM, (501 - 418) * MM];
  const face = { type: "TT4", row: [1, 2, 3, 4], sheetNo };
  const grid = c.nominalGridFor(face, rect);
  const ponBefore = cropPaths(c, face, rect);
  const paperBefore = paperPaths(c, rect, "small");
  near(grid.paperW / MM, 648, "TT4 keeps its fixed paper width");
  near(grid.paperH / MM, 418, "TT4 keeps its fixed paper height");
  near(grid.contentH / MM, 2 * widthMm, "TT4 rotated pairs retain the full entered width");
  near(grid.contentW / MM, 2 * heightMm + c.MID_GAP_TT4 / MM,
    "TT4 rotated pair width and original gutter remain unchanged");
  near(grid.gridTop, grid.cy + widthMm * MM, "TT4 crop grid begins at the centred artwork top");
  near(grid.gridBottom, grid.cy - widthMm * MM, "TT4 crop grid ends at the centred artwork bottom");
  assert.strictEqual(ponBefore.length, 10, "TT4 retains its existing ten vertical crop ticks");
  for (const points of ponBefore) {
    assert(Math.abs(points[0][1] - grid.gridTop) < 0.001 ||
      Math.abs(points[0][1] - grid.gridBottom) < 0.001,
      "Every nominal crop tick starts at a real unsqueezed top/bottom cut edge");
    near(points[0][0], points[1][0], "TT4 retains its vertical-only crop marks");
    assert(points.every(p => p[0] >= rect[0] - 0.001 && p[0] <= rect[2] + 0.001 &&
      p[1] >= rect[3] - 0.001 && p[1] <= rect[1] + 0.001), "TT4 crop ticks stay inside paper");
  }
  assert.strictEqual(paperBefore.length, 8);
  const paperStyle = c.PON_PAPER.small;
  for (const path of paperBefore) {
    near(path.stroke, paperStyle.stroke, "Paper PON keeps its original stroke width");
    const [[x1, y1], [x2, y2]] = path.points;
    near(Math.hypot(x2 - x1, y2 - y1), x1 === x2 ? paperStyle.leg : paperStyle.arm,
      "Paper PON legs are neither moved nor resized");
  }
  for (const corner of [[rect[0], rect[1]], [rect[2], rect[1]],
    [rect[0], rect[3]], [rect[2], rect[3]]])
    assert.strictEqual(paperBefore.filter(path => path.points.some(p =>
      Math.hypot(p[0] - corner[0], p[1] - corner[1]) < 0.001)).length, 2,
      "Both unshifted paper-PON centrelines meet the exact artboard corner");
  c.placeFace4(face, rect);
  const actual = boundsUnion(processed);
  const inset = sheetNo * c.BOP_PER_SHEET / 2;
  near(actual[0], grid.gridLeft, "TT4 artwork left matches nominal cut axis");
  near(actual[2], grid.gridRight, "TT4 artwork right matches nominal cut axis");
  near(actual[1], grid.gridTop - inset, "Only existing centre-based sheet creep changes top edge");
  near(actual[3], grid.gridBottom + inset, "Only existing centre-based sheet creep changes bottom edge");
  for (const [i, item] of processed.entries()) {
    const b = item.geometricBounds;
    near((b[2] - b[0]) / MM, heightMm,
      "TT4 preserves entered height as the rotated page's horizontal edge");
    near((b[1] - b[3]) / MM, widthMm - sheetNo * c.BOP_PER_SHEET / MM / 2,
      "Cover input stays exact; inner pages retain only the established creep allowance");
    assert.strictEqual(item.angle, i < 2 ? 90 : -90);
    assert(b[0] >= rect[0] - 0.01 && b[2] <= rect[2] + 0.01 &&
      b[1] <= rect[1] + 0.01 && b[3] >= rect[3] - 0.01, "Every TT4 page remains inside paper");
  }
  near(centreX(processed.slice(0, 2)), grid.gridLeft + grid.cellW / 2,
    "Left rotated pair remains on its nominal horizontal centre");
  near(centreX(processed.slice(2)), grid.gapRight + grid.cellW / 2,
    "Right rotated pair remains on its nominal horizontal centre");
  assert.strictEqual(JSON.stringify(c.nominalGridFor(face, rect)), JSON.stringify(grid),
    "TT4 nominal crop grid must not read squeezed bounds");
  assert.deepStrictEqual(cropPaths(c, face, rect), ponBefore,
    "All crop PON remain on nominal edges after pair creep");
  assert.deepStrictEqual(paperPaths(c, rect, "small"), paperBefore,
    "TT4 placement does not shift paper PON or change the paper rectangle");
  assert.strictEqual(c.ponClampCount, 0, "No TT4 mark may be clamped to conceal a placement leak");
}
{
  const { c, processed } = context(210, 300, 4);
  const before = processed.map(p => p.geometricBounds);
  assert.throws(() => c.nominalGridFor({ type: "TT4", row: [1, 2, 3, 4], sheetNo: 0 }),
    /Khổ trang nhập quá lớn/,
    "A true 210 mm width still needs 420 mm on 418 mm paper and must not be silently squeezed");
  assert.deepStrictEqual(processed.map(p => p.geometricBounds), before,
    "Oversized TT4 preflight must fail before any page transform/grouping");
  assert(processed.every(p => p.angle === 0));
}

for (const [widthMm, heightMm] of [
  [140, 200],
  [150, 211.5],
  [149, 211.5],
  [150, 210],
  [130, 190],
  [100, 130],
]) {
  const { c, processed } = context(widthMm, heightMm);
  const rect = [-37 * MM, 501 * MM, (648 - 37) * MM, (501 - 418) * MM];
  const face = {
    type: "SMALL8",
    top: [1, 2, 3, 4],
    bottom: [5, 6, 7, 8],
    sheetNo: 2,
  };
  const gridBefore = c.nominalGridFor(face, rect);
  const ponBefore = cropPaths(c, face, rect);
  const expectedH = Math.min(2 * heightMm, 418);
  const cutY = rect[3] + (expectedH * MM) / 2;
  const seamTicks = ponBefore.filter(
    (points) => Math.abs(points[0][1] - cutY) < 0.001,
  );
  assert.strictEqual(
    seamTicks.length,
    4,
    "Four horizontal ticks identify the cut between the two rows",
  );
  for (const points of seamTicks) {
    near(points[0][1], points[1][1], "Middle-row cut marks are horizontal");
    near(
      Math.abs(points[1][0] - points[0][0]) / MM,
      2,
      "Middle-row cut tick is 2mm",
    );
  }
  const outerLeft = rect[0] + ((648 - 4 * widthMm - 8) * MM) / 2;
  const cutAxes = [
    outerLeft,
    outerLeft + 2 * widthMm * MM,
    outerLeft + (2 * widthMm + 8) * MM,
    outerLeft + (4 * widthMm + 8) * MM,
  ];
  for (const axis of cutAxes)
    assert(
      seamTicks.some((points) => Math.abs(points[0][0] - axis) < 0.001),
      "The horizontal cut has registration at both outer edges and both gutter edges",
    );
  const foldAxes = [
    outerLeft + widthMm * MM,
    outerLeft + (3 * widthMm + 8) * MM,
  ];
  for (const axis of foldAxes)
    assert(
      !ponBefore.some((points) => Math.abs(points[0][0] - axis) < 0.001),
      "No crop mark is placed on the internal vertical fold of a two-page pair",
    );
  near(
    gridBefore.contentH / MM,
    expectedH,
    "Only the fit-required allowance is used",
  );
  near(gridBefore.paperW / MM, 648, "Fixed SMALL8 sheet width");
  near(gridBefore.paperH / MM, 418, "Fixed SMALL8 sheet height");
  c.placeFace8(face, rect);
  const actual = boundsUnion(processed);
  near(actual[3], rect[3], "Full lower artwork edge sits on paper bottom");
  near(
    actual[1],
    rect[3] + expectedH * MM,
    "Full upper artwork edge matches nominal top",
  );
  for (const [i, item] of processed.entries()) {
    const b = item.geometricBounds;
    near((b[1] - b[3]) / MM, heightMm, "No vertical squeeze/crop");
    near(
      (b[2] - b[0]) / MM,
      widthMm - 1,
      "Two-page centred crease squeeze, sheetNo=2",
    );
    assert(
      b[0] >= rect[0] - 0.01 &&
        b[2] <= rect[2] + 0.01 &&
        b[1] <= rect[1] + 0.01 &&
        b[3] >= rect[3] - 0.01,
      "Every actual page remains on paper",
    );
    assert.strictEqual(
      item.angle,
      i < 4 ? 180 : 0,
      "Page orientation is unchanged",
    );
  }
  const left = [processed[0], processed[1], processed[4], processed[5]];
  const right = [processed[2], processed[3], processed[6], processed[7]];
  near(
    centreX(left),
    gridBefore.gridLeft + widthMm * MM,
    "Left two-page pair centre is fixed",
  );
  near(
    centreX(right),
    gridBefore.gapRight + widthMm * MM,
    "Right two-page pair centre is fixed",
  );
  const topBounds = processed[0].geometricBounds,
    bottomBounds = processed[4].geometricBounds;
  near(
    (bottomBounds[1] - topBounds[3]) / MM,
    Math.max(0, 2 * heightMm - 418),
    "Only necessary bleed is moved to the internal row seam",
  );
  assert.strictEqual(
    JSON.stringify(c.nominalGridFor(face, rect)),
    JSON.stringify(gridBefore),
    "Nominal paper/PON grid does not read squeezed artwork",
  );
  assert.deepStrictEqual(
    cropPaths(c, face, rect),
    ponBefore,
    "Actual generated crop PON coordinates remain unchanged after squeeze",
  );
  assert.strictEqual(
    c.ponClampCount,
    0,
    "No crop PON is clamped to hide a placement leak",
  );
}

// Khổ A5 nhập nằm ngang được chuẩn hoá trước khi các hàm phụ này nhận pageW/pageH.
// Kiểm tra rằng nhánh code thật vẫn chỉ chuẩn hoá riêng họ A5,
// rồi chạy cùng kích thước khổ đứng đó cho trường hợp nhập 20 x 14.
assert.match(
  signature,
  /var SMALL_SOURCE_IS_LANDSCAPE = IS_SMALL_A5 && PAGE_W > PAGE_H/,
);
assert.match(
  signature,
  /if \(SMALL_SOURCE_IS_LANDSCAPE\) \{\s*PAGE_W = _shortPageSide;\s*PAGE_H = _longPageSide;/,
);
{
  const { c, processed } = context(140, 200);
  const rect = [0, 418 * MM, 648 * MM, 0];
  c.placeFace8(
    { type: "SMALL8", top: [1, 2, 3, 4], bottom: [5, 6, 7, 8], sheetNo: 0 },
    rect,
  );
  near(boundsUnion(processed)[3], 0, "Normalised 20 x 14 input lower edge");
  near(
    boundsUnion(processed)[1] / MM,
    400,
    "Normalised 20 x 14 input upper edge",
  );
}

// Form A4 lớn hơn vẫn dùng các hàng cao đủ, tính từ lề nhíp trên cố định của nó.
for (const type of ["TT8", "AB"]) {
  const { c, processed } = context(200, 290);
  const paperH = type === "AB" ? 625 : 638;
  const rect = [0, paperH * MM, 858 * MM, 0];
  const face = { type, top: [1, 2, 3, 4], bottom: [5, 6, 7, 8], sheetNo: 2 };
  const grid = c.nominalGridFor(face, rect);
  c.placeFace8(face, rect);
  const b = boundsUnion(processed);
  near(grid.contentH / MM, 580, "A4 nominal row height remains full size");
  near((rect[1] - b[1]) / MM, 23, "A4 keeps its 23mm top gripper");
  near(b[3] / MM, paperH - 23 - 580, "A4 artwork keeps its size on the chosen paper");
  near(
    (processed[4].geometricBounds[1] - processed[0].geometricBounds[3]) / MM,
    0,
    "A4 rows stay touching, not overlapping",
  );
}
// Chỉ AB đổi chiều cao. Test cả hai họ ở khung lớn nhất được hỗ trợ;
// PON/lưới phải dùng rect mới, tuyệt đối không dùng bounds bài đã bị thu nhỏ.
for (const [type,w,h,paperH] of [["AB",212,300,625],["SMALLAB",150,211.5,625],
  ["TT8",212,300,638],["SMALL16",150,211.5,638]]) {
  const {c}=context(w,h);
  const rect=[91*MM,1000*MM,(91+858)*MM,(1000-paperH)*MM];
  const face={type}, grid=c.nominalGridFor(face,rect);
  near(grid.paperW,858*MM,"Large form width");
  near(grid.paperH,paperH*MM,"Only AB uses 625 mm height");
  assert(grid.gridLeft>=rect[0] && grid.gridRight<=rect[2]);
  assert(grid.gridBottom>=rect[3]-.001 && grid.gridTop<=rect[1]);
  near(grid.pageW,w*MM,"AB does not resize input width");
  near(grid.pageH,h*MM,"AB does not resize input height");
  const marks=[];
  const layer={pathItems:{add(){const mark={setEntirePath(points){this.points=points.map(p=>[...p]);}};marks.push(mark);return mark;}}};
  c.addAutoPon(layer,rect,"large");
  assert.equal(marks.length,8);
  for(const corner of [[rect[0],rect[1]],[rect[2],rect[1]],[rect[0],rect[3]],[rect[2],rect[3]]])
    assert.equal(marks.filter(m=>m.points.some(p=>Math.hypot(p[0]-corner[0],p[1]-corner[1])<.001)).length,2,"Both paper PON legs meet each new corner");
  for(const points of cropPaths(c,face,rect))
    assert(points.every(p=>p[0]>=rect[0]-.001 && p[0]<=rect[2]+.001 && p[1]<=rect[1]+.001 && p[1]>=rect[3]-.001));
}
for (const sheetNo of [0, 2]) {
  const { c, processed } = context(212, 300);
  const rect = [91 * MM, 1000 * MM, (91 + 858) * MM, (1000 - 625) * MM];
  const face = { type: "AB", top: [1, 2, 3, 4], bottom: [5, 6, 7, 8], sheetNo };
  const grid = c.nominalGridFor(face, rect);
  const beforePon = cropPaths(c, face, rect);
  c.placeFace8(face, rect);
  const actual = boundsUnion(processed);
  near(actual[1], rect[1] - 23 * MM, "Maximum A4 AB retains its established top gripper");
  near(actual[3], actual[1] - 600 * MM, "Maximum A4 AB retains both full 300 mm rows");
  for (const page of processed) {
    const b = page.geometricBounds;
    near((b[2] - b[0]) / MM, 212 - sheetNo * c.BOP_PER_SHEET / MM / 2,
      "Maximum A4 AB remains exact before only the established inner-pair creep");
    near((b[1] - b[3]) / MM, 300, "TT4 repair never resizes A4 AB page height");
    assert(b[0] >= rect[0] - 0.01 && b[2] <= rect[2] + 0.01 &&
      b[1] <= rect[1] + 0.01 && b[3] >= rect[3] - 0.01);
  }
  assert.strictEqual(JSON.stringify(c.nominalGridFor(face, rect)), JSON.stringify(grid));
  assert.deepStrictEqual(cropPaths(c, face, rect), beforePon);
}
console.log(
  "CTL geometry: exact centred A4 TT4 20.9x30 cover, unchanged inner creep/PON, true oversized preflight, A5 full-page fit/allowance and unchanged AB/A4 rows verified.",
);
