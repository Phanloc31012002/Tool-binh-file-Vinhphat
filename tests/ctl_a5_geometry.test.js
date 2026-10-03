// Execute the production CTL form/grid/placement helpers, not a rewritten
// geometry formula. The mock implements only affine bounding-box operations.
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
  "squeezeAboutCentre",
  "groupPages",
  "ungroupInto",
  "ctlBlack",
  "addAutoCutPon",
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
  "SHEET_65x43",
  "SHEET_43x32",
  "A5_MAIN_ROW_GAP",
  "SMALL8_TRIM_OVERLAP",
  "BOP_PER_SHEET",
  "CUT_MARK",
  "CUT_STROKE",
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
      Math.abs(angle) % 180,
      0,
      "SMALL8 only rotates pages 180 degrees",
    );
    this.angle += angle;
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

// Landscape A5 input is normalised before these helpers receive pageW/pageH.
// Assert the actual production branch still normalises only the A5 family,
// then execute the same portrait dimensions for the 20 x 14 entry.
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

// Larger A4 form still uses full-height rows from its fixed top gripper.
for (const type of ["TT8", "AB"]) {
  const { c, processed } = context(200, 290);
  const rect = [0, 638 * MM, 858 * MM, 0];
  const face = { type, top: [1, 2, 3, 4], bottom: [5, 6, 7, 8], sheetNo: 2 };
  const grid = c.nominalGridFor(face, rect);
  c.placeFace8(face, rect);
  const b = boundsUnion(processed);
  near(grid.contentH / MM, 580, "A4 nominal row height remains full size");
  near((rect[1] - b[1]) / MM, 23, "A4 keeps its 23mm top gripper");
  near(b[3] / MM, 35, "A4 lower artwork position is unchanged");
  near(
    (processed[4].geometricBounds[1] - processed[0].geometricBounds[3]) / MM,
    0,
    "A4 rows stay touching, not overlapping",
  );
}
console.log(
  "CTL A5: 14x20/max15x21.15 full-page fit, conditional allowance, internal overlap, centred pair creep, immutable PON and unchanged A4 rows verified.",
);
