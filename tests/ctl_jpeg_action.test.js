"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const lib = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const source = lib.slice(
  lib.indexOf("function dcCtlJpegActionText("),
  lib.indexOf("// Gọi ở cuối lượt dàn."),
);
const files = new Map(),
  calls = [];
let fail = false;
function File(name) {
  this.fsName = name;
  this.exists = false;
  this.length = 0;
  this.open = () => {
    this.exists = true;
    files.set(name, this);
    return true;
  };
  this.write = (text) => {
    this.text = text;
  };
  this.close = () => {};
  this.remove = () => {
    this.exists = false;
    files.delete(name);
  };
}
const jpg = new File("C:/Output/RUOT 1 thử ' & $.jpg");
const context = vm.createContext({
  unescape,
  encodeURIComponent,
  File,
  Folder: { temp: { fsName: "C:/Temp" } },
  app: {
    loadAction(f) {
      calls.push(["load", f]);
    },
    doScript(a, set, dialogs) {
      calls.push(["run", a, set, dialogs]);
      if (fail) throw Error("export failure");
      jpg.exists = true;
      jpg.length = 100;
    },
    unloadAction(set) {
      calls.push(["unload", set]);
    },
  },
});
vm.runInContext(source, context);
const action = context.dcCtlJpegActionText(jpg.fsName, "CTL test");
const raw = Buffer.from(action.match(/\/value < 100 ([0-9a-f]+) >/)[1], "hex");
assert.equal(raw.length, 100);
assert.deepEqual(
  Array.from({ length: 8 }, (_, i) => raw.readUInt32LE(i * 4)),
  [10, 0, 3, 3, 300 * 65536, 2, 0, 1],
);
assert.equal(raw[98], 1, "embed ICC profile");
assert.match(action, /\/key 1936548194 .*\/type \(boolean\) \/value 0/);
const pathHex = action.match(
  /\/key 1851878757 .*\/value \[ \d+ ([a-f0-9]+) \]/,
)[1];
assert.equal(Buffer.from(pathHex, "hex").toString("utf8"), jpg.fsName);
const doc = {
  activate() {
    calls.push(["activate"]);
  },
};
context.dcCtlExportJpeg(doc, jpg);
assert.equal(calls[2][3], false, "native action is non-modal");
assert.equal(calls[1][1].exists, false, "own action file cleaned");
assert.equal(calls[1][1].text.includes("/showDialog 0"), true);
assert.equal(calls[3][0], "unload");
assert.equal(calls[3][1], calls[2][2], "unload only this action set");
fail = true;
assert.throws(() => context.dcCtlExportJpeg(doc, jpg), /export failure/);
assert.equal(files.size, 0, "cleanup action on errors");
if (process.argv[2]) {
  const meta = require("./jpeg_metadata");
  const result = vm.runInNewContext(fs.readFileSync(process.argv[2], "utf8"));
  assert(result.passed, result.error);
  for (const output of result.outputs) {
    const jpg = meta(output.jpg);
    assert.equal(jpg.sof.components, 4, "CMYK");
    assert(jpg.sof.baseline, "Baseline Standard");
    assert(jpg.swop && jpg.iccBytes > 0, "embedded SWOP ICC");
    assert.deepEqual(jpg.resolution, { x: 300, y: 300, units: 1 });
    assert(
      jpg.quantization[0].every((n) => n === 1),
      "Maximum quality",
    );
    assert(
      Math.abs(jpg.sof.width - output.width300) <= 1 &&
        Math.abs(jpg.sof.height - output.height300) <= 1,
      "300ppi and unclipped whole document dimensions",
    );
  }
}
console.log(
  "CTL JPEG: quality 10, Standard, CMYK, 300ppi, Type Optimized, ICC, Artboards off, Unicode action path and cleanup passed.",
);
