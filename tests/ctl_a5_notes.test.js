"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const start = source.indexOf("    function a5NotePlacement(");
const end = source.indexOf("    function addNote8(", start);
assert.ok(
  start >= 0 && end > start,
  "actual production A5 note helpers are located",
);
const noteSource = source.slice(start, end);
const MM = 2.834645669;
const mmRect = (rect) => rect.map((v) => v * MM);
const union = (a, b) =>
  !a
    ? b.slice()
    : [
        Math.min(a[0], b[0]),
        Math.max(a[1], b[1]),
        Math.max(a[2], b[2]),
        Math.min(a[3], b[3]),
      ];
const intersects = (a, b) =>
  a[0] < b[2] - 0.001 &&
  a[2] > b[0] + 0.001 &&
  a[3] < b[1] - 0.001 &&
  a[1] > b[3] + 0.001;

function makeFixture(type, rectMm, artMm) {
  const icons = [],
    texts = [];
  const paper = mmRect(rectMm),
    artwork = mmRect(artMm);
  const sourcePages = [1, 2, 3, 4].map(() => ({
    visibleBounds: artwork.slice(),
  }));
  const face = { type, row: [1, 2, 3, 4], sheetNo: 2 };
  const nominalPonGeometry = [
    {
      points: [
        [paper[0], paper[1]],
        [paper[0] + 5 * MM, paper[1]],
      ],
      strokeWidth: 1.995,
    },
    {
      points: [
        [paper[0], paper[1]],
        [paper[0], paper[1] - 5 * MM],
      ],
      strokeWidth: 1.995,
    },
    {
      points: [
        [artwork[0], artwork[1]],
        [artwork[0], artwork[1] + 2 * MM],
      ],
      strokeWidth: 1,
    },
  ];
  const attributes = { size: 13 };
  function textFrame() {
    let text = "",
      angle = 0,
      x = 0,
      y = 0;
    const tf = {
      textRange: { characterAttributes: { ...attributes } },
      removed: false,
      get angle() {
        return angle;
      },
      get contents() {
        return text;
      },
      set contents(value) {
        text = String(value);
      },
      get position() {
        return [x, y];
      },
      set position(value) {
        x = value[0];
        y = value[1];
      },
      get visibleBounds() {
        const lines = text.replace(/\r/g, "\n").split("\n");
        const width =
          Math.max(0, ...lines.map((line) => line.length)) * 1.8 * MM;
        const height = (3.8 + (lines.length - 1) * 4.8) * MM;
        return angle % 180 === 0
          ? [x, y + 3 * MM, x + width, y + 3 * MM - height]
          : [x, y + width, x + height, y];
      },
      translate(dx, dy) {
        x += dx;
        y += dy;
      },
      rotate(value) {
        angle += value;
      },
      remove() {
        this.removed = true;
      },
    };
    texts.push(tf);
    return tf;
  }
  function icon() {
    let x = 0,
      y = 0;
    const item = {
      removed: false,
      angle: 0,
      // Cố ý để visible bounds lớn hơn bounds hình học: giữ lại nét viền.
      get visibleBounds() {
        return [x, y, x + 8 * MM, y - 8 * MM];
      },
      get geometricBounds() {
        return [x + 0.5 * MM, y - 0.5 * MM, x + 7.5 * MM, y - 7.5 * MM];
      },
      translate(dx, dy) {
        x += dx;
        y += dy;
      },
      remove() {
        this.removed = true;
      },
    };
    icons.push(item);
    return item;
  }
  const template = {
    removed: false,
    remove() {
      this.removed = true;
    },
  };
  const context = {
    MM,
    processed: sourcePages,
    nominalPonGeometry,
    noteIconTemplate: template,
    artworkLayer: { textFrames: { add: textFrame } },
    duplicateNoteIcon: icon,
    setNoteStyle(tf) {
      tf.textRange.characterAttributes.size = 13;
    },
  };
  vm.createContext(context);
  vm.runInContext(noteSource, context);
  function verify() {
    const block = union(texts[0].visibleBounds, icons[0].visibleBounds);
    assert.ok(
      block[0] >= paper[0] + MM - 0.001 && block[2] <= paper[2] - MM + 0.001,
    );
    assert.ok(
      block[1] <= paper[1] - MM + 0.001 && block[3] >= paper[3] + MM - 0.001,
    );
    assert.equal(
      intersects(block, artwork),
      false,
      "whole note must avoid rendered artwork",
    );
    for (const mark of nominalPonGeometry) {
      const xs = mark.points.map((p) => p[0]),
        ys = mark.points.map((p) => p[1]),
        s = mark.strokeWidth / 2;
      const obstacle = [
        Math.min(...xs) - s,
        Math.max(...ys) + s,
        Math.max(...xs) + s,
        Math.min(...ys) - s,
      ];
      assert.equal(
        intersects(block, obstacle),
        false,
        "whole note must avoid visible PON stroke",
      );
    }
    const ib = icons[0].visibleBounds;
    assert.ok(Math.abs(ib[2] - ib[0] - 8 * MM) < 0.001);
    assert.ok(Math.abs(ib[1] - ib[3] - 8 * MM) < 0.001);
    assert.equal(icons[0].angle, 0, "icon remains upright and unscaled");
    assert.equal(texts[0].textRange.characterAttributes.size, 13);
    assert.deepEqual(
      sourcePages.map((p) => p.visibleBounds),
      Array(4).fill(artwork),
    );
    return block;
  }
  return { context, face, paper, artwork, texts, icons, template, verify };
}

for (const [type, paper, artwork] of [
  ["SMALL4", [0, 313, 428, 0], [11.5, 280, 416.5, 0]],
  ["SMALL8", [0, 418, 648, 0], [40, 397.5, 608, 0]],
  ["SMALL16", [0, 638, 858, 0], [26, 575, 832, 0]],
  ["SMALLAB", [0, 625, 858, 0], [26, 575, 832, 0]],
]) {
  const fixture = makeFixture(type, paper, artwork);
  fixture.context.addNoteA5("RUỘT 2", fixture.paper, false, fixture.face);
  fixture.verify();
  assert.equal(fixture.texts[0].angle, type === "SMALL8" ? 90 : 0);
  if (type === "SMALL8") verifyLowerLeft(fixture);
}

function verifyLowerLeft(fixture) {
  const block = fixture.verify();
  assert.equal(fixture.texts[0].angle, 90, "SMALL8 text is always vertical");
  assert.ok(
    block[2] <= fixture.artwork[0] - 2 * MM + 0.001,
    "SMALL8 stays in the left blank",
  );
  assert.ok(
    Math.abs(block[0] - fixture.paper[0] - 9 * MM) < 0.001,
    "left anchor is 9mm",
  );
  assert.ok(
    Math.abs(block[3] - fixture.paper[3] - 15 * MM) < 0.001,
    "bottom anchor is 15mm",
  );
  assert.ok(
    fixture.icons[0].visibleBounds[1] < fixture.texts[0].visibleBounds[3],
    "upright icon sits below vertical text",
  );
}

// SMALL8 A5 tối đa, cao kín tờ, không có dải đầu tờ nhưng có một dải bên rộng.
const maximum = makeFixture(
  "SMALL8",
  [1200, 518, 1848, 100],
  [1220, 518, 1828, 100],
);
maximum.context.addNoteA5("RUỘT 3", maximum.paper, true, maximum.face);
maximum.verify();
assert.equal(
  maximum.texts[0].angle,
  90,
  "full-height SMALL8 uses vertical text in the side blank",
);
verifyLowerLeft(maximum);

for (const text of ["RUOT 2\rGhi chu ngan", "RUOT 2 " + "A".repeat(400)]) {
  const fixture = makeFixture("SMALL8", [0, 418, 648, 0], [40, 397.5, 608, 0]);
  fixture.context.addNoteA5(text, fixture.paper, false, fixture.face);
  const block = fixture.verify();
  assert.equal(fixture.texts[0].angle, 90);
  assert.ok(block[2] <= fixture.artwork[0] - 2 * MM + 0.001);
  assert.ok(
    Math.abs(block[3] - 15 * MM) < 0.001,
    "long/multiline text retains lower anchor when it fits",
  );
}

const blockedLeft = makeFixture("SMALL8", [0, 418, 648, 0], [5, 397.5, 608, 0]);
assert.throws(
  () =>
    blockedLeft.context.addNoteA5(
      "RUOT 2",
      blockedLeft.paper,
      false,
      blockedLeft.face,
    ),
  /quá dài/,
  "SMALL8 cannot fall back to header or right margin when left strip is too narrow",
);

const ponLeft = makeFixture("SMALL8", [0, 418, 648, 0], [40, 397.5, 608, 0]);
ponLeft.context.nominalPonGeometry.push({
  points: [mmRect([8, 35]), mmRect([30, 35])],
  strokeWidth: 1,
});
ponLeft.context.addNoteA5("RUOT 2", ponLeft.paper, false, ponLeft.face);
assert.ok(ponLeft.verify()[2] <= ponLeft.artwork[0] - 2 * MM + 0.001);

const long = makeFixture("SMALL4", [0, 313, 428, 0], [11.5, 280, 416.5, 0]);
long.context.addNoteA5(
  "RUỘT 1 " + "A".repeat(500),
  long.paper,
  false,
  long.face,
);
long.verify();
assert.ok(
  long.texts[0].contents.includes("\r"),
  "unbroken overlong text wraps by measured glyph width",
);
assert.equal(
  long.texts[0].contents.replace(/\s/g, ""),
  "RUỘT1" + "A".repeat(500),
  "wrapping preserves all non-whitespace content",
);

const multiline = makeFixture(
  "SMALL4",
  [0, 313, 428, 0],
  [11.5, 280, 416.5, 0],
);
multiline.context.addNoteA5(
  "RUỘT 1\rGhi chú ngắn",
  multiline.paper,
  true,
  multiline.face,
);
multiline.verify();

const impossible = makeFixture(
  "SMALL4",
  [0, 313, 428, 0],
  [11.5, 280, 416.5, 0],
);
assert.throws(
  () =>
    impossible.context.addNoteA5(
      "A".repeat(6000),
      impossible.paper,
      false,
      impossible.face,
    ),
  /quá dài/,
);
assert.equal(impossible.texts[0].removed, true);
assert.equal(
  impossible.icons[0].removed,
  true,
  "unplaceable note cannot be left overflowing",
);
assert.equal(
  impossible.template.removed,
  true,
  "failed note cannot leave its hidden template behind",
);
assert.equal(impossible.context.noteIconTemplate, null);

// Vị trí đặt phải né dấu nằm bên trong một dải trống lẽ ra vẫn dùng được.
const ctx = long.context;
const obstacle = mmRect([1, 312, 32, 301]);
const placement = ctx.a5NotePlacement(
  mmRect([0, 313, 428, 0]),
  mmRect([11.5, 280, 416.5, 0]),
  30 * MM,
  8 * MM,
  [obstacle],
  mmRect([1, 312, 0, 0]),
  false,
);
assert.ok(placement);
assert.equal(intersects(placement.bounds, obstacle), false);
console.log(
  "CTL A5 notes: measured icon/text fit, 4 forms, SMALL8 always vertical lower-left, long/multiline content, PON clearance and safe failure passed",
);
