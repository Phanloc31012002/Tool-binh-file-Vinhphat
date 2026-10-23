"use strict";
// Số phiên bản nạp nóng: panel chỉ nạp lại dan_card_lib.jsx / dan_be_bridge.jsx khi engine đang giữ bản cũ hơn
// mốc trong main.js. Mốc phải khớp hằng trong jsx, và mỗi lần đổi jsx phải nâng mốc (v2.19.0 đổi mọi lệnh đo khổ).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");
const bridge =
  fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_be_bridge.jsx"), "utf8") +
  "\n" +
  fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_tag_bd_bridge.jsx"), "utf8");
const main = fs.readFileSync(require.resolve("../DanCardCEP/js/main.js"), "utf8");

function defined(name) {
  const re = new RegExp("^var " + name + " = (\\d+);", "gm");
  let m, last = null;
  while ((m = re.exec(lib + "\n" + bridge))) last = Number(m[1]);
  return last;
}
const thresholds = {};
for (const m of main.matchAll(/(dc\w+Version) < (\d+)/g)) thresholds[m[1]] = Number(m[2]);
assert.ok(Object.keys(thresholds).length >= 8, "main.js có các bộ nạp theo phiên bản");
for (const [name, want] of Object.entries(thresholds))
  assert.equal(defined(name), want, name + ": main.js đòi " + want + ", jsx định nghĩa " + defined(name));

// Mốc tối thiểu của v2.19.0 (mọi lệnh đo khổ, ghép cặp, dọn, cấp chỗ đều đổi).
for (const [name, min] of Object.entries({
  dcDanToiUuVersion: 23, dcDanTuTroVersion: 12, dcDanBeNestingVersion: 13, dcSignature8AutoPonVersion: 41,
  dcKeoGayAutoPonVersion: 14, dcCatalogueAutoVersion: 14, dcClipToSizeVersion: 9, dcAutoCutMarksVersion: 2,
  dcDanTheoMauVersion: 3, dcCtlOffsetPdfVersion: 6, dcDanTagBdVersion: 5,
}))
  assert.ok(defined(name) >= min, name + " phải ≥ " + min + " (đang " + defined(name) + ")");
console.log("jsx_versions: ok");
