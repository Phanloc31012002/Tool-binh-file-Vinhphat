"use strict";
// Ghép cặp trước/sau theo hàng dùng chung: Tự trở và Dàn Card dùng dcKtsPairSourceRecords của KTS,
// Dàn bế 1 mặt dùng dcDanBeRowGroups (cùng luật hàng với bộ ba 2 mặt). Hàng lẻ con phải báo lỗi,
// không bao giờ ghép chéo hàng trong im lặng.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const lib = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"), "utf8");
const bridge = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_be_bridge.jsx"), "utf8");
const MM = 2.834645669;

const b = vm.createContext({});
vm.runInContext(bridge, b);
assert.equal(typeof b.dcDanBeRowGroups, "function");
const box = (id, cx, cy, w = 92 * MM, h = 56 * MM) => ({
  id,
  geometricBounds: [cx - w / 2, cy + h / 2, cx + w / 2, cy - h / 2],
});
// 3 hàng × (Khuôn trái, Bài phải); hàng giữa lệch 0,02 pt; thứ tự chọn đảo lộn.
const rows = [0, 1, 2].map((r) => [box("K" + r, 0, -r * 200), box("B" + r, 400, -r * 200 + (r % 2 ? -0.02 : 0.02))]);
const shuffled = [rows[2][1], rows[0][0], rows[1][1], rows[2][0], rows[0][1], rows[1][0]];
const groups = b.dcDanBeRowGroups(shuffled, 2, 0.01);
assert.deepEqual(
  JSON.parse(JSON.stringify(groups.map((g) => g.map((rec) => rec.item.id)))),
  [["K0", "B0"], ["K1", "B1"], ["K2", "B2"]],
);
// Bộ ba 2 mặt vẫn chạy qua hàm cũ.
const triples = b.dcDanBeTripleModels([box("K", 0, 0), box("T", 300, 0), box("S", 600, 0)], 0.01);
assert.deepEqual(JSON.parse(JSON.stringify([triples[0].khuon.item.id, triples[0].bai.item.id, triples[0].sau.item.id])), ["K", "T", "S"]);
// Hàng lẻ (3 object trên một hàng, 1 object hàng dưới) → lỗi rõ, không ghép chéo hàng.
assert.throws(
  () => b.dcDanBeRowGroups([box("a", 0, 0), box("b", 300, 0), box("c", 600, 0), box("d", 0, -300)], 2, 0.01),
  /Hàng nguồn chưa đủ cặp Khuôn → Bài/,
);
// Hai object trùng vị trí ngang → không phân biệt trái/phải.
assert.throws(() => b.dcDanBeRowGroups([box("a", 0, 0), box("b", 0, 0)], 2, 0.01), /trái\/phải/);

// Tên layer: "Background" không được nhận là vai "back"; "Mặt sau" / "back" nguyên từ thì nhận.
{
  const s = bridge.indexOf("    function normalise(s) {");
  const e = bridge.indexOf("    function layerItems(", s);
  const ctx = vm.createContext({ doc: { layers: [] } });
  vm.runInContext(bridge.slice(s, e), ctx);
  const layers = (...names) => names.map((name) => ({ name }));
  ctx.doc.layers = layers("Background", "Artwork");
  assert.equal(ctx.findLayer("back"), null, "Background không phải mặt sau");
  ctx.doc.layers = layers("Background", "Mặt sau");
  assert.equal(ctx.findLayer("back").name, "Mặt sau");
  ctx.doc.layers = layers("Frontal art", "back");
  assert.equal(ctx.findLayer("back").name, "back");
  assert.equal(ctx.findLayer("front"), null, "Frontal không phải mặt trước");
  ctx.doc.layers = layers("Khuôn bế", "front");
  assert.equal(ctx.findLayer("front").name, "front");
  assert.equal(ctx.findLayer("cut").name, "Khuôn bế");
}

// Lib: Tự trở và Dàn Card không còn tự gom hàng riêng; dùng dcKtsPairSourceRecords.
assert.ok(lib.indexOf("rowTolerance") < 0, "Tự trở bỏ bộ gom hàng riêng");
assert.ok(lib.split("dcKtsPairSourceRecords(").length - 1 >= 4, "định nghĩa + KTS + Tự trở + Dàn Card");
const danCard = lib.slice(lib.indexOf("function _dcDanCore("), lib.indexOf("function dcDanToiUu("));
assert.ok(danCard.indexOf("dcKtsPairSourceRecords(") >= 0, "Dàn Card ghép cặp bằng hàm chung");
assert.ok(danCard.indexOf("Số object lẻ") >= 0 && !/warn\("Số object lẻ[^;]*;\s*return;/.test(danCard), "lẻ → trả ERR");
console.log("pairing_shared: ok");
