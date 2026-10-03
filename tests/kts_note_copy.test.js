const assert = require("assert"),
  fs = require("fs"),
  vm = require("vm");
const lib = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const code = lib.slice(
  lib.indexOf("function dcCopyToiUuNoteToOddArtboards("),
  lib.indexOf("// Pure geometry: lock left/right roles"),
);
function fixture(count = 5, sourceIndex = 0, failCopy = 0) {
  const app = { coordinateSystem: "ARTBOARD", redraw() {} };
  const boards = Array.from({ length: count }, (_, n) => ({
    artboardRect: [-4000 + n * 500, 5000, -3600 + n * 500, 4780],
  }));
  boards.setActiveArtboardIndex = () => {};
  const created = [];
  let copies = 0;
  function text(value, left, top) {
    return {
      typename: "TextFrame",
      contents: value,
      fontSize: 11,
      left,
      top,
      get visibleBounds() {
        return [
          this.left,
          this.top,
          this.left + this.contents.length * 5,
          this.top - 12,
        ];
      },
    };
  }
  function group(value, left, top) {
    const frame = text(value, left + 20, top),
      icon = { typename: "PathItem", left, top };
    const g = {
      typename: "GroupItem",
      pageItems: [icon, frame],
      frame,
      get visibleBounds() {
        return [
          icon.left,
          icon.top,
          frame.visibleBounds[2],
          frame.visibleBounds[3],
        ];
      },
      duplicate() {
        const copy = group(frame.contents, icon.left, icon.top);
        copy.id = ++copies;
        created.push(copy);
        return copy;
      },
      translate(x, y) {
        if (this.id === failCopy) throw Error("injected translate failure");
        for (const child of this.pageItems) {
          child.left += x;
          child.top += y;
        }
      },
      remove() {
        const i = created.indexOf(this);
        if (i >= 0) created.splice(i, 1);
      },
    };
    return g;
  }
  const source = group("NOTE", boards[sourceIndex].artboardRect[0] + 20, 4975);
  const doc = {
    selection: [source],
    get artboards() {
      assert.strictEqual(app.coordinateSystem, "DOCUMENT");
      return boards;
    },
  };
  app.documents = { length: 1 };
  app.activeDocument = doc;
  const ctx = {
    app,
    CoordinateSystem: { DOCUMENTCOORDINATESYSTEM: "DOCUMENT" },
    dcMoTaLoi: String,
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return {
    source,
    created,
    app,
    ctx,
    boards,
    run(prefixes, dual = false) {
      return dual
        ? ctx.dcCopyToiUuNoteToOddArtboards(prefixes)
        : ctx.dcCopyToiUuNoteToAllArtboards(prefixes);
    },
    check(indexes, prefixes) {
      assert.strictEqual(app.coordinateSystem, "ARTBOARD");
      assert.strictEqual(created.length, indexes.length);
      created.forEach((g, i) => {
        const b = g.visibleBounds,
          r = boards[indexes[i]].artboardRect;
        assert.strictEqual(b[0] - r[0], 20);
        assert.strictEqual(b[1] - r[1], -25);
        assert.strictEqual(g.frame.fontSize, 11);
        assert.strictEqual(
          g.frame.contents,
          prefixes ? prefixes[i + 1] + " - NOTE" : "NOTE",
        );
      });
    },
  };
}
const all = fixture();
assert.match(all.run("F1,F2,F3,F4,F5"), /^OK:/);
all.check([1, 2, 3, 4], ["F1", "F2", "F3", "F4", "F5"]);
assert.strictEqual(all.source.frame.contents, "F1 - NOTE");
const odd = fixture(6);
assert.match(odd.run("F1,F2,F3", true), /^OK:/);
odd.check([2, 4], ["F1", "F2", "F3"]);
const blank = fixture();
assert.match(blank.run(""), /^OK:/);
blank.check([1, 2, 3, 4]);
assert.strictEqual(blank.source.frame.contents, "NOTE");
const wrong = fixture();
assert.match(wrong.run("F1,F2"), /^ERR: Can 5/);
wrong.check([]);
assert.strictEqual(wrong.source.frame.contents, "NOTE");
const single = fixture(1);
assert.match(single.run("F1"), /^OK:/);
single.check([]);
assert.strictEqual(single.source.frame.contents, "F1 - NOTE");
const even = fixture(4, 1);
assert.match(even.run("F1,F2,F3"), /^OK:/);
even.check([2, 3], ["F1", "F2", "F3"]);
const invalidBack = fixture(4, 1);
assert.match(invalidBack.run("F1,F2", true), /^ERR: Ghi chu phai/);
invalidBack.check([]);
const failure = fixture(5, 0, 2);
assert.match(failure.run("F1,F2,F3,F4,F5"), /^ERR:.*injected/);
failure.check([]);
assert.strictEqual(failure.source.frame.contents, "NOTE");
const html = fs.readFileSync(
  require.resolve("../DanCardCEP/index.html"),
  "utf8",
);
const main = fs.readFileSync(
  require.resolve("../DanCardCEP/js/main.js"),
  "utf8",
);
assert.match(html, /id="btnCopyToiUuNoteOneSide"[^]*?Điền ghi chú bài 1 mặt/);
assert.match(html, /id="btnCopyToiUuNote"[^]*?Điền ghi chú bài 2 mặt/);
assert.match(main, /wireToiUuNoteButton\(btnCopyToiUuNote, true\)/);
assert.match(main, /wireToiUuNoteButton\(btnCopyToiUuNoteOneSide, false\)/);
assert.match(main, /dcDanToiUuVersion < 19/);
console.log(
  "KTS notes: all/odd boards, F1/F2 mapping, plain copy, font/offsets, even source, one board, validation, rollback and two-button wiring passed.",
);
