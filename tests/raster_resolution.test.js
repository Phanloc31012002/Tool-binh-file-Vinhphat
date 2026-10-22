"use strict";
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  vm = require("node:vm");
const lib = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const main = fs.readFileSync(
  require.resolve("../DanCardCEP/js/main.js"),
  "utf8",
);
for (const source of [lib, main]) {
  const assignments = [...source.matchAll(/\w+\.resolution\s*=\s*([^;]+);/g)];
  assert(assignments.length > 0);
  assignments.forEach((m) =>
    assert.equal(m[1].trim(), "500", "every processing raster must be 500ppi"),
  );
}
// Từ 22/10 (anh Lộc): không còn raster trước khi dàn ở CTL Offset/Keo gáy/Catalogue — trang đặt
// nguyên vector theo khung Transform. Hàm raster-trước-khi-dàn đã bỏ hẳn; raster chỉ còn ở nút
// Raster header (dcRasterizeSelection) và bước tự sửa khổ của Dàn Card, đều 500 ppi (kiểm ở trên).
assert.equal(lib.indexOf("dcFlattenForImposition"), -1, "không còn raster trước khi dàn");
assert(!/\b(?:300|400|450)\s*ppi/.test(main + lib));
const html = fs.readFileSync(
  require.resolve("../DanCardCEP/index.html"),
  "utf8",
);
assert.match(html, /Raster CMYK · 500 ppi/);
assert.match(lib, /300\s*\*\s*65536/, "CTL JPG intentionally remains 300ppi");
assert.doesNotMatch(lib, /dcCtlJpegPpi|ppiText/, "cancelled CTL JPG PPI option must stay removed");
console.log(
  "Raster: all panel/JSX options and imposition call sites at 500ppi, legacy caller protection, existing bitmap preservation and JPG 300ppi isolation passed.",
);
