"use strict";
// Cầu nối Dàn tag BD (ExtendScript chạy nguyên trạng trên bộ giả lập hình học):
// đọc tag theo hàng trước/sau, đóng artboard trước/sau kèm dấu cắt, xuất PDF 2 trang.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const illustrator = require("./illustrator_geometry_mock");
const bridge = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_tag_bd_bridge.jsx"), "utf8");
const MM = 2.834645669;

function load(options) {
  const mock = illustrator(options);
  const c = vm.createContext(mock.context);
  vm.runInContext(bridge, c);
  return { mock, c };
}
// Khung [l, t, r, b] theo mm quanh (x, y) với khổ w × h mm.
function box(mock, x, y, w, h, id) {
  return mock.source([x * MM, (y + h) * MM, (x + w) * MM, y * MM], id);
}
function parseOk(text) {
  assert.ok(String(text).indexOf("OKJSON:") === 0, text);
  return JSON.parse(String(text).substring(7));
}

// ---------- dcDanTagBdDocTag ----------
{
  const { mock, c } = load();
  assert.equal(c.dcDanTagBdVersion, 7);
  // Hàng 1: trước 112 × 72 (trái) + sau (phải). Hàng 2: tag 1 mặt 56 × 91. Hàng 3: trước + sau 92 × 40, mặt sau lệch 0,3 mm.
  const f1 = box(mock, 0, 300, 112, 72, "f1");
  const b1 = box(mock, 150, 300, 112, 72, "b1");
  const f2 = box(mock, 0, 180, 56, 91, "f2");
  const f3 = box(mock, 0, 100, 92, 40, "f3");
  const b3 = box(mock, 150, 100.3, 92, 40, "b3");
  f2.name = "Thẻ nhỏ";
  mock.doc.selection = [b3, f2, b1, f1, f3];
  const out = parseOk(c.dcDanTagBdDocTag());
  assert.equal(out.tags.length, 3);
  assert.deepEqual(
    out.tags.map((t) => [t.w, t.h, t.twoSided]),
    [
      [112, 72, true],
      [56, 91, false],
      [92, 40, true],
    ],
  );
  assert.equal(out.tags[1].name, "Thẻ nhỏ");
  assert.equal(out.tags[0].name, "Tag 1");
  assert.ok(/^tag_\d+$/.test(out.tags[0].id));
  assert.equal(c.dcDanTagBdNguon[out.tags[0].id].front, f1);
  assert.equal(c.dcDanTagBdNguon[out.tags[0].id].back, b1);
  assert.equal(c.dcDanTagBdNguon[out.tags[1].id].back, null);
  // Gọi lần 2 cho tag khác -> id mới, không đè.
  mock.doc.selection = [box(mock, 0, 0, 70, 30, "f4")];
  const out2 = parseOk(c.dcDanTagBdDocTag());
  assert.notEqual(out2.tags[0].id, out.tags[0].id);
  assert.equal(c.dcDanTagBdNguon[out.tags[0].id].front, f1);

  // Hàng 3 object -> lỗi, không đăng ký thêm.
  const before = Object.keys(c.dcDanTagBdNguon).length;
  mock.doc.selection = [box(mock, 0, 500, 50, 50, "x"), box(mock, 60, 500, 50, 50, "y"), box(mock, 120, 500, 50, 50, "z")];
  assert.match(c.dcDanTagBdDocTag(), /^ERR: .*3 object/);
  assert.equal(Object.keys(c.dcDanTagBdNguon).length, before);
  // Object lẻ ở gần cột phải khi có hàng 2 cột -> lỗi.
  mock.doc.selection = [box(mock, 0, 700, 50, 50, "p"), box(mock, 150, 700, 50, 50, "q"), box(mock, 150, 600, 50, 50, "r")];
  assert.match(c.dcDanTagBdDocTag(), /^ERR: .*cột phải/);
  // Không chọn gì -> lỗi.
  mock.doc.selection = [];
  assert.match(c.dcDanTagBdDocTag(), /^ERR: Chưa chọn/);
  // Hệ toạ độ được khôi phục.
  assert.equal(c.app.coordinateSystem, "user-coordinates");
}
// Khổ theo khung Transform khi có dcKhungThanhPham (đo clip group: khung mask 92 × 56 dù visibleBounds to hơn).
{
  const { mock, c } = load();
  const item = box(mock, 0, 0, 120, 80, "clip");
  c.dcKhungThanhPham = function (it) {
    return it === item ? [0, 56 * MM, 92 * MM, 0] : null;
  };
  mock.doc.selection = [item];
  const out = parseOk(c.dcDanTagBdDocTag());
  assert.deepEqual([out.tags[0].w, out.tags[0].h], [92, 56]);
  console.log("dcDanTagBdDocTag: ok");
}

// ---------- dcDanTagBdVe / dcDanTagBdDemArtboard ----------
function plan() {
  return {
    detail: "Bài 1000: 2 khối…",
    jobs: [
      {
        bai: 1000,
        hop: 10,
        blocks: [
          {
            cols: 2,
            rows: 1,
            w: 112,
            h: 92,
            cells: 2,
            places: [
              { id: "tag_1", copy: 1, x: 0, y: 0, w: 112, h: 72, rot: 0 },
              { id: "tag_2", copy: 1, x: 0, y: 72, w: 56, h: 20, rot: 0 },
            ],
            cuts: [
              { axis: "H", at: 72, from: 0, to: 112 },
              { axis: "V", at: 56, from: 72, to: 92 },
            ],
          },
          {
            cols: 1,
            rows: 1,
            w: 56,
            h: 92,
            cells: 1,
            places: [{ id: "tag_3", copy: 1, x: 0, y: 0, w: 40, h: 92, rot: 90 }],
            cuts: [{ axis: "V", at: 40, from: 0, to: 92 }],
          },
        ],
      },
    ],
  };
}
function registerSources(mock, c) {
  const f1 = box(mock, 0, 300, 112, 72, "f1"),
    b1 = box(mock, 150, 300, 112, 72, "b1");
  const f2 = box(mock, 0, 200, 56, 20, "f2");
  const f3 = box(mock, 0, 100, 92, 40, "f3"),
    b3 = box(mock, 150, 100, 92, 40, "b3");
  c.dcDanTagBdNguon.tag_1 = { front: f1, back: b1, w: 112, h: 72 };
  c.dcDanTagBdNguon.tag_2 = { front: f2, back: null, w: 56, h: 20 };
  c.dcDanTagBdNguon.tag_3 = { front: f3, back: b3, w: 92, h: 40 };
  return { f1, b1, f2, f3, b3 };
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, (msg || "") + " " + a + " != " + b);
{
  const { mock, c } = load({ rect: [0, 100, 400, 0] });
  const src = registerSources(mock, c);
  assert.equal(c.dcDanTagBdDemArtboard(), "OK:0");
  const res = c.dcDanTagBdVe(JSON.stringify(plan()));
  assert.match(res, /^OK: /, res);
  assert.match(res, /2 khối/);
  assert.match(res, /Bài 1000: 2 khối/);
  // Artboard: cũ giữ nguyên, thêm 2 cặp, tên đúng, khổ đúng, bắt đầu từ góc trên trái canvas (như Dàn tối ưu/KTS).
  assert.equal(mock.doc.artboards.length, 5);
  assert.deepEqual(mock.doc.artboards[0].artboardRect, [0, 100, 400, 0]);
  const names = mock.doc.artboards.slice(1).map((b) => b.name);
  assert.deepEqual(names, [
    "TagBD 1 - bai 1000 - 10 hop - 110 x 90 - truoc",
    "TagBD 1 - bai 1000 - 10 hop - 110 x 90 - sau",
    "TagBD 2 - bai 1000 - 10 hop - 54 x 90 - truoc",
    "TagBD 2 - bai 1000 - 10 hop - 54 x 90 - sau",
  ]);
  const front1 = mock.doc.artboards[1].artboardRect,
    back1 = mock.doc.artboards[2].artboardRect;
  near(front1[2] - front1[0], 112 * MM, "rộng khối 1");
  near(front1[1] - front1[3], 92 * MM, "cao khối 1");
  near(back1[0], front1[2] + 10 * MM, "mặt sau cách 10 mm");
  // Góc trên trái canvas (±7200 pt), cách mép 10 mm; nguồn và artboard cũ ở quanh gốc không cản.
  near(front1[0], -7200 + 10 * MM, "sát mép trái canvas");
  near(front1[1], 7200 - 10 * MM, "sát mép trên canvas");
  const front2 = mock.doc.artboards[3].artboardRect;
  near(front2[0], back1[2] + 10 * MM, "cặp 2 nối tiếp bên phải cặp 1");
  near(front2[1], front1[1], "cùng hàng");
  assert.equal(c.dcDanTagBdDemArtboard(), "OK:2");
  // Layer: mỗi mặt một layer có note.
  const layers = mock.doc.layers.filter((l) => /^Tag BD /.test(l.name));
  assert.deepEqual(
    layers.map((l) => l.name),
    ["Tag BD 1 - trước", "Tag BD 1 - sau", "Tag BD 2 - trước", "Tag BD 2 - sau"],
  );
  assert.ok(layers.every((l) => l.note === "DANCARD_TAGBD_OUTPUT"));
  // Mặt trước khối 1: 2 bản sao + 2 nhát × 2 dấu = 4 nét.
  const f = layers[0].pageItems,
    marks = f.filter((it) => it.note === "DANCARD_TAGBD_MARK"),
    copies = f.filter((it) => it.note !== "DANCARD_TAGBD_MARK");
  assert.equal(copies.length, 2);
  assert.equal(marks.length, 4);
  const a1 = copies.find((it) => it.identity === "f1");
  near(a1.geometricBounds[0], front1[0], "A trái");
  near(a1.geometricBounds[1], front1[1], "A trên");
  const b2 = copies.find((it) => it.identity === "f2");
  near(b2.geometricBounds[0], front1[0], "B trái");
  near(b2.geometricBounds[1], front1[1] - 72 * MM, "B trên");
  // Dấu cắt dài 3 mm nằm trên đường cắt: nhát H tại y=72 có nét từ x 0..3 và 109..112.
  const hm = marks.map((m) => m.geometricBounds).filter((b) => Math.abs(b[1] - b[3]) < 0.01);
  assert.equal(hm.length, 2);
  near(hm[0][1], front1[1] - 72 * MM, "y nét");
  near(Math.min(hm[0][0], hm[1][0]), front1[0], "nét trái bắt đầu ở mép");
  near(Math.max(hm[0][2], hm[1][2]), front1[0] + 112 * MM, "nét phải tới mép");
  near(hm[0][2] - hm[0][0], 3 * MM, "dài 3 mm");
  // Mặt sau khối 1: chỉ A có mặt sau (B 1 mặt), lật ngang; dấu cắt lật theo.
  const s = layers[1].pageItems,
    sCopies = s.filter((it) => it.note !== "DANCARD_TAGBD_MARK");
  assert.equal(sCopies.length, 1);
  assert.equal(sCopies[0].identity, "b1");
  near(sCopies[0].geometricBounds[0], back1[0], "A sau trái (x' = 112 − 0 − 112 = 0)");
  assert.equal(s.filter((it) => it.note === "DANCARD_TAGBD_MARK").length, 4);
  const vBack = s.filter((it) => it.note === "DANCARD_TAGBD_MARK").map((m) => m.geometricBounds).filter((b) => Math.abs(b[0] - b[2]) < 0.01);
  near(vBack[0][0], back1[0] + (112 - 56) * MM, "nhát dọc lật: 112 − 56");
  // Dấu cắt đỏ C0 M100 Y100 K0.
  const mark0 = s.find((it) => it.note === "DANCARD_TAGBD_MARK");
  assert.deepEqual([mark0.strokeColor.cyan, mark0.strokeColor.magenta, mark0.strokeColor.yellow, mark0.strokeColor.black], [0, 100, 100, 0], "dấu cắt đỏ");
  // Khối 2: con xoay 90: mặt trước xoay +90, mặt sau xoay −90 và x' = 56 − 0 − 40 = 16.
  const f3c = layers[2].pageItems.find((it) => it.identity === "f3");
  assert.equal(f3c.angle, 90);
  near(f3c.geometricBounds[2] - f3c.geometricBounds[0], 40 * MM, "rộng sau xoay");
  const b3c = layers[3].pageItems.find((it) => it.identity === "b3");
  assert.equal(b3c.angle, -90);
  near(b3c.geometricBounds[0], mock.doc.artboards[4].artboardRect[0] + 16 * MM, "x' mặt sau");
  // Nguồn không bị đụng.
  near(src.f1.geometricBounds[0], 0, "nguồn giữ nguyên");
  assert.equal(mock.doc.layers[0].pageItems.length, 5);
  // Dàn lần 2: số thứ tự nối tiếp (3, 4), né các cặp đã có → nối tiếp bên phải, vẫn hàng trên cùng.
  const res2 = c.dcDanTagBdVe(JSON.stringify(plan()));
  assert.match(res2, /^OK: /, res2);
  assert.equal(mock.doc.artboards[5].name, "TagBD 3 - bai 1000 - 10 hop - 110 x 90 - truoc");
  near(mock.doc.artboards[5].artboardRect[0], mock.doc.artboards[4].artboardRect[2] + 10 * MM, "lượt 2 nối tiếp bên phải lượt 1");
  near(mock.doc.artboards[5].artboardRect[1], front1[1], "lượt 2 vẫn hàng trên cùng");
  // Hết bề ngang canvas thì tự xuống hàng: chèn một artboard bận chiếm gần hết phần còn lại của hàng.
  {
    const r6 = mock.doc.artboards[8].artboardRect; // cặp 4 mặt sau (cuối hàng)
    mock.doc.artboards.push({ name: "ban", artboardRect: [r6[2] + 10 * MM, 7200 - 10 * MM, 7200 - 10 * MM - 50 * MM, 7200 - 10 * MM - 92 * MM] });
    const res3 = c.dcDanTagBdVe(JSON.stringify(plan()));
    assert.match(res3, /^OK: /, res3);
    const f5 = mock.doc.artboards.find((b) => b.name === "TagBD 5 - bai 1000 - 10 hop - 110 x 90 - truoc").artboardRect;
    near(f5[0], -7200 + 10 * MM, "xuống hàng: về mép trái");
    assert.ok(f5[1] <= front1[3] - 10 * MM + 0.01, "xuống hàng: nằm dưới hàng 1, top=" + f5[1] + " ≤ " + (front1[3] - 10 * MM));
    mock.doc.artboards.splice(mock.doc.artboards.findIndex((b) => b.name === "ban"), 1);
  }
  assert.equal(c.dcDanTagBdDemArtboard(), "OK:6"); // 3 lượt × 2 cặp
  assert.equal(c.app.coordinateSystem, "user-coordinates");
  // Phương án hỏng -> ERR, không tạo gì.
  const bad = plan();
  bad.jobs[0].blocks[0].places[0].id = "tag_khong_co";
  assert.match(c.dcDanTagBdVe(JSON.stringify(bad)), /^ERR: /);
  assert.equal(mock.doc.artboards.length, 13); // 1 cũ + 3 lượt × 4
  console.log("dcDanTagBdVe: ok");
}
// Lỗi giữa chừng (duplicate thứ 2 hỏng) -> gỡ sạch artboard/layer vừa tạo, nguồn còn nguyên.
{
  const { mock, c } = load({ rect: [0, 100, 400, 0], failDuplicateAt: 2 });
  registerSources(mock, c);
  const res = c.dcDanTagBdVe(JSON.stringify(plan()));
  assert.match(res, /^ERR: /, res);
  assert.equal(mock.doc.artboards.length, 1);
  assert.equal(mock.doc.layers.length, 1);
  assert.equal(mock.doc.layers[0].pageItems.length, 5);
  assert.equal(c.dcDanTagBdDemArtboard(), "OK:0");
  console.log("dcDanTagBdVe (hoàn tác): ok");
}

// ---------- dcDanTagBdXuatPdf ----------
function planWith500() {
  const p = plan();
  p.jobs.push({
    bai: 500,
    hop: 5,
    blocks: [
      {
        cols: 3,
        rows: 1,
        w: 168,
        h: 92,
        cells: 3,
        places: [{ id: "tag_1", copy: 1, x: 0, y: 0, w: 112, h: 72, rot: 0 }],
        cuts: [
          { axis: "H", at: 72, from: 0, to: 112 },
          { axis: "V", at: 112, from: 0, to: 92 },
        ],
      },
    ],
  });
  return p;
}
// Bộ giả lập phần lưu file: tài liệu tạm, File/Folder, PDFSaveOptions.
function withPdfMocks(mock, c, existingFiles) {
  const saves = [],
    removed = [],
    tempDocs = [];
  const existing = new Set(existingFiles || []);
  c.app.documents.add = function () {
    const tmp = { layers: [], artboards: [], closed: false };
    tmp.layers.push({ name: "Layer 1", pageItems: [] });
    tmp.artboards.push({ artboardRect: [0, 100, 100, 0] });
    tmp.artboards.add = (rect) => {
      const b = { artboardRect: rect.slice() };
      tmp.artboards.push(b);
      return b;
    };
    tmp.saveAs = (file, opt) => {
      assert.equal(c.app.activeDocument, tmp, "saveAs khi tài liệu tạm đang active");
      saves.push({
        path: file.fsName,
        pages: tmp.artboards.map((b) => b.artboardRect.slice()),
        items: tmp.layers[0].pageItems.map((it) => ({ identity: it.identity, note: it.note, bounds: it.geometricBounds })),
        multiple: opt.saveMultipleArtboards,
      });
      existing.add(file.fsName);
    };
    tmp.close = () => {
      tmp.closed = true;
    };
    tempDocs.push(tmp);
    c.app.documents.push(tmp);
    return tmp;
  };
  c.File = function (path) {
    this.fsName = path;
    Object.defineProperty(this, "exists", { get: () => existing.has(path) });
    this.remove = () => {
      removed.push(path);
      existing.delete(path);
    };
  };
  c.Folder = function (path) {
    this.fsName = path;
    this.exists = path === "D:/PDF";
  };
  c.PDFSaveOptions = function () {};
  c.PDFCompatibility = { ACROBAT5: 5 };
  c.DocumentColorSpace = { CMYK: "cmyk" };
  c.SaveOptions = { DONOTSAVECHANGES: 2 };
  return { saves, removed, tempDocs, existing };
}
const OPTS = { prefix: "1088", start: "1", pad: "2", canMang: "cm", ngay: "22", folder: "D:/PDF", note: "" };
{
  const { mock, c } = load({ rect: [0, 100, 400, 0] });
  registerSources(mock, c);
  assert.match(c.dcDanTagBdVe(JSON.stringify(planWith500())), /^OK: /);
  const io = withPdfMocks(mock, c);
  // Bản sao sang tài liệu khác bị Illustrator dời đi: tool phải đo lại và kéo về đúng chỗ.
  for (const layer of mock.doc.layers)
    for (const it of layer.pageItems) {
      const orig = it.duplicate;
      it.duplicate = function (target, placement) {
        const copy = orig.call(this, target, placement);
        if (target !== layer) copy.translate(37, -11);
        return copy;
      };
    }
  // Đếm số lần đổi tài liệu active: mỗi mặt chỉ đổi 2 lần (nhân bản cả mặt rồi mới sang tài liệu tạm),
  // không đổi cho từng object (11 object mặt 1 mà đổi 22 lần là rất chậm trên file nặng).
  let doiTaiLieu = 0,
    activeDoc = c.app.activeDocument;
  Object.defineProperty(c.app, "activeDocument", {
    configurable: true,
    get: () => activeDoc,
    set: (d) => {
      doiTaiLieu++;
      activeDoc = d;
    },
  });
  const res = c.dcDanTagBdXuatPdf(JSON.stringify(OPTS));
  assert.match(res, /^OK: Đã lưu 3\/3 file PDF/, res);
  assert.ok(doiTaiLieu <= 3 * 5 + 1, "đổi tài liệu " + doiTaiLieu + " lần cho 3 khối");
  // Ghi rõ artboard nào → file nào, kèm số hộp đọc từ tên artboard.
  assert.match(res, /TagBD 1 \(bài 1000, 10 hộp\) → 1088 - 01 - 10 hop 110 x 90 - cm - 22\.pdf/);
  assert.match(res, /TagBD 3 \(bài 500, 5 hộp\) → 1088 - 03 - 5 hop 166 x 90 - cm - 22\.pdf/);
  assert.deepEqual(
    io.saves.map((s) => s.path),
    ["D:/PDF/1088 - 01 - 10 hop 110 x 90 - cm - 22.pdf", "D:/PDF/1088 - 02 - 10 hop 54 x 90 - cm - 22.pdf", "D:/PDF/1088 - 03 - 5 hop 166 x 90 - cm - 22.pdf"],
  );
  // Mỗi file 2 trang. Như Auto Save: artboard trang 1 đặt theo chỗ bản sao rơi xuống trong tài liệu tạm
  // (nguồn dời 37/−11 thì trang cũng dời theo), trang 2 nằm bên phải trang 1 cách 20 mm; object giữ đúng
  // vị trí tương đối với artboard của nó. Không dùng toạ độ tuyệt đối của tài liệu nguồn.
  const s1 = io.saves[0];
  assert.equal(s1.pages.length, 2);
  const srcFront = mock.doc.artboards[1].artboardRect,
    srcBack = mock.doc.artboards[2].artboardRect;
  const shifted = (r, dx, dy) => [r[0] + dx, r[1] + dy, r[2] + dx, r[3] + dy];
  assert.deepEqual(JSON.parse(JSON.stringify(s1.pages[0].map((v) => Math.round(v * 100) / 100))), shifted(srcFront, 37, -11).map((v) => Math.round(v * 100) / 100));
  near(s1.pages[1][0], s1.pages[0][2] + 20 * MM, "trang 2 cách trang 1 20 mm");
  near(s1.pages[1][1], s1.pages[0][1], "trang 2 cùng mép trên");
  near(s1.pages[1][2] - s1.pages[1][0], srcBack[2] - srcBack[0], "trang 2 đúng khổ");
  assert.equal(s1.multiple, true);
  // Object mặt sau giữ đúng vị trí tương đối với trang 2.
  const srcB1 = mock.doc.layers.find((l) => l.name === "Tag BD 1 - sau").pageItems.find((it) => it.identity === "b1");
  const outB1 = s1.items.find((it) => it.identity === "b1");
  near(outB1.bounds[0] - s1.pages[1][0], srcB1.geometricBounds[0] - srcBack[0], "mặt sau: lệch trái so với trang");
  near(outB1.bounds[1] - s1.pages[1][1], srcB1.geometricBounds[1] - srcBack[1], "mặt sau: lệch trên so với trang");
  const frontCopies = s1.items.filter((it) => it.identity === "f1" || it.identity === "f2");
  assert.equal(frontCopies.length, 2);
  assert.equal(s1.items.filter((it) => it.identity === "b1").length, 1);
  // Bộ giả lập không chép note khi nhân bản; dấu cắt nhận qua identity "path" của mock.
  assert.equal(s1.items.filter((it) => it.identity === "path").length, 8);
  assert.equal(s1.items.length, 11);
  // Object mặt trước giữ đúng vị trí tương đối với trang 1 (mọi bản sao bù cùng một độ dời).
  const srcF1 = mock.doc.layers.find((l) => l.name === "Tag BD 1 - trước").pageItems.find((it) => it.identity === "f1");
  const outF1 = frontCopies.find((it) => it.identity === "f1");
  near(outF1.bounds[0] - s1.pages[0][0], srcF1.geometricBounds[0] - srcFront[0], "mặt trước: lệch trái so với trang");
  near(outF1.bounds[1] - s1.pages[0][1], srcF1.geometricBounds[1] - srcFront[1], "mặt trước: lệch trên so với trang");
  const srcF2 = mock.doc.layers.find((l) => l.name === "Tag BD 1 - trước").pageItems.find((it) => it.identity === "f2");
  const outF2 = frontCopies.find((it) => it.identity === "f2");
  near(outF2.bounds[1] - outF1.bounds[1], srcF2.geometricBounds[1] - srcF1.geometricBounds[1], "hai con giữ khoảng cách");
  assert.ok(io.tempDocs.every((d) => d.closed), "đóng tài liệu tạm");
  assert.equal(c.app.activeDocument, mock.doc);
  assert.equal(io.removed.length, 0);
  // Ghi chú thêm vào tên; STT bắt đầu 7 đệm 3.
  const res2 = c.dcDanTagBdXuatPdf(JSON.stringify(Object.assign({}, OPTS, { start: "7", pad: "3", note: "Lan 2", canMang: "km" })));
  assert.match(res2, /^OK: Đã lưu 3\/3/, res2);
  assert.equal(io.saves[3].path, "D:/PDF/1088 - 007 - 10 hop 110 x 90 - Lan 2 - km - 22.pdf");
  // File đã tồn tại -> ERR trước khi lưu bất kỳ file nào.
  const n = io.saves.length;
  const res3 = c.dcDanTagBdXuatPdf(JSON.stringify(OPTS));
  assert.match(res3, /^ERR: File đã tồn tại/, res3);
  assert.equal(io.saves.length, n);
  // Số lượng sai, thư mục sai, không có khối -> ERR.
  assert.match(c.dcDanTagBdXuatPdf(JSON.stringify(Object.assign({}, OPTS, { start: "x" }))), /^ERR: STT/);
  c.dcChonThuMucLuuPDF = () => null;
  assert.match(c.dcDanTagBdXuatPdf(JSON.stringify(Object.assign({}, OPTS, { folder: "Z:/khong-co" }))), /^ERR: .*thư mục/i);
  console.log("dcDanTagBdXuatPdf: ok");
}
{
  const { mock, c } = load({ rect: [0, 100, 400, 0] });
  assert.match(c.dcDanTagBdXuatPdf(JSON.stringify(OPTS)), /^ERR: Chưa có khối/);
  // Lỗi khi nhân bản ở file đầu: file đó bị bỏ (xoá nếu dở dang), hai file sau vẫn lưu, báo rõ.
  registerSources(mock, c);
  assert.match(c.dcDanTagBdVe(JSON.stringify(planWith500())), /^OK: /);
  const io = withPdfMocks(mock, c);
  let count = 0;
  for (const layer of mock.doc.layers)
    for (const it of layer.pageItems) {
      const orig = it.duplicate;
      it.duplicate = function (target, placement) {
        if (++count === 3) throw new Error("Illustrator từ chối nhân bản");
        return orig.call(this, target, placement);
      };
    }
  const res = c.dcDanTagBdXuatPdf(JSON.stringify(OPTS));
  assert.match(res, /Lưu được 2\/3 file/, res);
  assert.match(res, /Illustrator từ chối nhân bản/);
  assert.deepEqual(
    io.saves.map((s) => s.path),
    ["D:/PDF/1088 - 02 - 10 hop 54 x 90 - cm - 22.pdf", "D:/PDF/1088 - 03 - 5 hop 166 x 90 - cm - 22.pdf"],
  );
  assert.ok(io.tempDocs.every((d) => d.closed));
  console.log("dcDanTagBdXuatPdf (lỗi giữa chừng): ok");
}
// Số hộp theo lõi (danh sách không có tag 1000, lõi chọn "không nhân": 2000 = 1 con → 20 hộp): ghi vào tên
// artboard rồi Xuất PDF lấy lại; artboard tên kiểu cũ (chưa ghi hộp) vẫn đọc được, hộp theo bài.
{
  const { mock, c } = load({ rect: [0, 100, 400, 0] });
  registerSources(mock, c);
  const p = plan();
  p.jobs[0].hop = 20;
  const res = c.dcDanTagBdVe(JSON.stringify(p));
  assert.match(res, /^OK: /, res);
  assert.match(res, /20 hộp/);
  assert.equal(mock.doc.artboards[1].name, "TagBD 1 - bai 1000 - 20 hop - 110 x 90 - truoc");
  assert.equal(JSON.stringify(c.dcDanTagBdDocTen("TagBD 7 - bai 1000 - 110 x 90 - sau")), JSON.stringify({ k: 7, bai: 1000, hop: 10, w: "110", h: "90", mat: "sau" }));
  assert.equal(c.dcDanTagBdDocTen("TagBD 8 - bai 500 - 166 x 90 - truoc").hop, 5);
  assert.equal(c.dcDanTagBdDocTen("TagBD 9 - bai 1000 - 30 hop - 166 x 90 - truoc").hop, 30);
  const io = withPdfMocks(mock, c);
  assert.match(c.dcDanTagBdXuatPdf(JSON.stringify(OPTS)), /^OK: Đã lưu 2\/2 file PDF/);
  assert.deepEqual(
    io.saves.map((s) => s.path),
    ["D:/PDF/1088 - 01 - 20 hop 110 x 90 - cm - 22.pdf", "D:/PDF/1088 - 02 - 20 hop 54 x 90 - cm - 22.pdf"],
  );
  // Số hộp lạ → ERR, không tạo gì.
  const bad = plan();
  bad.jobs[0].hop = 2.5;
  const n = mock.doc.artboards.length;
  assert.match(c.dcDanTagBdVe(JSON.stringify(bad)), /^ERR: .*hộp/);
  assert.equal(mock.doc.artboards.length, n);
  console.log("dcDanTagBdVe/XuatPdf (số hộp theo lõi): ok");
}
// Khối toàn tag 1 mặt: chỉ đóng artboard trước (không có artboard "sau" trống), Xuất PDF ra file 1 trang,
// tên thêm " - 1 mat" sau ghi chú như Auto Save. Khối trộn (có tag 2 mặt) vẫn 2 trang. 4 artboard của 2 khối
// 2 mặt → 2 file; 1 khối 2 mặt + 1 khối 1 mặt → 2 file (một 2 trang, một 1 trang).
{
  const { mock, c } = load({ rect: [0, 100, 400, 0] });
  registerSources(mock, c);
  // Khối 1: tag_1 (2 mặt) + tag_2 (1 mặt) → 2 mặt. Khối 2 đổi thành tag_2 (1 mặt) duy nhất → 1 mặt.
  const p = plan();
  p.jobs[0].blocks[1].places = [{ id: "tag_2", copy: 1, x: 0, y: 0, w: 56, h: 20, rot: 0 }];
  p.jobs[0].blocks[1].cuts = [{ axis: "H", at: 20, from: 0, to: 56 }];
  const res = c.dcDanTagBdVe(JSON.stringify(p));
  assert.match(res, /^OK: /, res);
  assert.match(res, /3 artboard/, res);
  assert.match(res, /1 mặt/, res);
  const names = mock.doc.artboards.slice(1).map((b) => b.name);
  assert.deepEqual(names, [
    "TagBD 1 - bai 1000 - 10 hop - 110 x 90 - truoc",
    "TagBD 1 - bai 1000 - 10 hop - 110 x 90 - sau",
    "TagBD 2 - bai 1000 - 10 hop - 54 x 90 - 1 mat",
  ]);
  // Layer mặt sau chỉ có ở khối 1.
  assert.deepEqual(mock.doc.layers.filter((l) => /^Tag BD /.test(l.name)).map((l) => l.name), ["Tag BD 1 - trước", "Tag BD 1 - sau", "Tag BD 2 - trước"]);
  // Khối 1 mặt vẫn chiếm chỗ đúng một artboard, cặp sau nối tiếp bên phải nó (không chừa chỗ mặt sau).
  const f2 = mock.doc.artboards[3].artboardRect;
  const res2 = c.dcDanTagBdVe(JSON.stringify(p));
  assert.match(res2, /^OK: /, res2);
  near(mock.doc.artboards[4].artboardRect[0], f2[2] + 10 * MM, "khối 3 nối tiếp ngay sau artboard 1 mặt");
  assert.equal(c.dcDanTagBdDemArtboard(), "OK:4");
  const io = withPdfMocks(mock, c);
  const out = c.dcDanTagBdXuatPdf(JSON.stringify(Object.assign({}, OPTS, { note: "Lan 2" })));
  assert.match(out, /^OK: Đã lưu 4\/4 file PDF/, out);
  assert.deepEqual(
    io.saves.map((s) => s.path),
    [
      "D:/PDF/1088 - 01 - 10 hop 110 x 90 - Lan 2 - cm - 22.pdf",
      "D:/PDF/1088 - 02 - 10 hop 54 x 90 - Lan 2 - 1 mat - cm - 22.pdf",
      "D:/PDF/1088 - 03 - 10 hop 110 x 90 - Lan 2 - cm - 22.pdf",
      "D:/PDF/1088 - 04 - 10 hop 54 x 90 - Lan 2 - 1 mat - cm - 22.pdf",
    ],
  );
  assert.equal(io.saves[0].pages.length, 2);
  assert.equal(io.saves[1].pages.length, 1, "khối 1 mặt → 1 trang");
  assert.match(out, /1 trang/);
  console.log("dcDanTagBdVe/XuatPdf (khối 1 mặt): ok");
}

// ---------- Sửa theo soát mã: mặt sau phải cùng khổ mặt trước; khổ nguồn đổi sau khi Thêm thì báo ----------
{
  const { mock, c } = load();
  // Hàng có mặt sau 112 × 74 (lệch 2 mm) -> lỗi nêu rõ hàng và hai khổ; không đăng ký gì.
  const f1 = box(mock, 0, 300, 112, 72, "f1"),
    b1 = box(mock, 150, 300, 112, 74, "b1");
  mock.doc.selection = [f1, b1];
  const before = Object.keys(c.dcDanTagBdNguon).length;
  const res = c.dcDanTagBdDocTag();
  assert.match(res, /^ERR: Hàng 1/, res);
  assert.match(res, /112 × 74/);
  assert.match(res, /112 × 72/);
  assert.equal(Object.keys(c.dcDanTagBdNguon).length, before);
  // Ghi chú nhỏ bên phải tag 1 mặt -> không được coi là mặt sau.
  mock.doc.selection = [box(mock, 0, 100, 112, 72, "f2"), box(mock, 150, 132, 40, 8, "note")];
  assert.match(c.dcDanTagBdDocTag(), /^ERR: Hàng 1/);
  // Lệch 0,3 mm vẫn nhận (dung sai 0,5 mm).
  mock.doc.selection = [box(mock, 0, 0, 92, 40, "f3"), box(mock, 150, 0, 92.3, 40.2, "b3")];
  assert.match(c.dcDanTagBdDocTag(), /^OKJSON:/);
  console.log("dcDanTagBdDocTag (mặt sau cùng khổ): ok");
}
{
  // Tag bị đổi khổ sau khi Thêm (registry ghi 112 × 72, object giờ 100 × 72) -> dcDanTagBdVe báo lỗi, không vẽ.
  const { mock, c } = load({ rect: [0, 100, 400, 0] });
  registerSources(mock, c);
  c.dcDanTagBdNguon.tag_1.front.setEntirePath([[0, 372 * MM], [100 * MM, 372 * MM], [100 * MM, 300 * MM], [0, 300 * MM]]);
  const res = c.dcDanTagBdVe(JSON.stringify(plan()));
  assert.match(res, /^ERR: .*tag_1/, res);
  assert.match(res, /100 × 72/);
  assert.equal(mock.doc.artboards.length, 1);
  // Mặt sau được canh TÂM vào ô lật (khi lệch nhỏ trong dung sai): mặt sau 112 × 72,4 -> tâm trùng tâm ô.
  const { mock: m2, c: c2 } = load({ rect: [0, 100, 400, 0] });
  registerSources(m2, c2);
  c2.dcDanTagBdNguon.tag_1.back.setEntirePath([[150 * MM, 372.4 * MM], [262 * MM, 372.4 * MM], [262 * MM, 300 * MM], [150 * MM, 300 * MM]]);
  assert.match(c2.dcDanTagBdVe(JSON.stringify(plan())), /^OK: /);
  const backLayer = m2.doc.layers.find((l) => l.name === "Tag BD 1 - sau");
  const b1c = backLayer.pageItems.find((it) => it.identity === "b1");
  const backRect = m2.doc.artboards[2].artboardRect;
  near((b1c.geometricBounds[1] + b1c.geometricBounds[3]) / 2, backRect[1] - 36 * MM, "tâm mặt sau trùng tâm ô 0..72");
  console.log("dcDanTagBdVe (khổ đổi sau khi Thêm, canh tâm mặt sau): ok");
}

// ---------- Bóp theo từng con (place.bopX/bopY): bản sao co quanh tâm theo từng chiều rồi mới đặt ----------
{
  const { mock, c } = load({ rect: [0, 100, 400, 0] });
  registerSources(mock, c);
  const p = plan();
  // Khối 1: tag_1 bớt 1 mm chiều cao (72 → 71), tag_2 giữ nguyên; khối 2: con xoay bớt 0,5 mm bề rộng sau xoay.
  const p1 = p.jobs[0].blocks[0].places[0];
  p1.h = 71;
  p1.bopY = 71 / 72;
  const p3 = p.jobs[0].blocks[1].places[0];
  p3.w = 39.5;
  p3.bopX = 39.5 / 40;
  const res = c.dcDanTagBdVe(JSON.stringify(p));
  assert.match(res, /^OK: /, res);
  const layers = mock.doc.layers.filter((l) => /^Tag BD /.test(l.name));
  const front1 = mock.doc.artboards[1].artboardRect;
  const a1 = layers[0].pageItems.find((it) => it.identity === "f1");
  near(a1.geometricBounds[2] - a1.geometricBounds[0], 112 * MM, "bề rộng giữ nguyên");
  near(a1.geometricBounds[1] - a1.geometricBounds[3], 71 * MM, "chiều cao đã bóp 1 mm");
  near(a1.geometricBounds[0], front1[0], "vẫn canh góc trên trái ô");
  near(a1.geometricBounds[1], front1[1], "vẫn canh góc trên trái ô");
  const b2 = layers[0].pageItems.find((it) => it.identity === "f2");
  near(b2.geometricBounds[1] - b2.geometricBounds[3], 20 * MM, "con không bóp giữ nguyên");
  // Mặt sau của tag_1 cũng bóp đúng như mặt trước.
  const b1 = layers[1].pageItems.find((it) => it.identity === "b1");
  near(b1.geometricBounds[1] - b1.geometricBounds[3], 71 * MM, "mặt sau bóp theo");
  // Con xoay 90: bopX áp sau khi xoay (bề rộng sau xoay 40 → 39,5), chiều cao 92 giữ.
  const f3c = layers[2].pageItems.find((it) => it.identity === "f3");
  near(f3c.geometricBounds[2] - f3c.geometricBounds[0], 39.5 * MM, "con xoay bóp bề rộng");
  near(f3c.geometricBounds[1] - f3c.geometricBounds[3], 92 * MM, "con xoay giữ chiều cao");
  // Nét của bản sao đã bóp phải giữ nguyên (0,5 pt): transform() nhận HỆ SỐ nét, đưa 100 là nét
  // phình ×100 — viền đen của chữ phủ kín cả ô (lỗi thật 22/10 trên card Thành Phát / Chic Nails).
  for (const it of [a1, b1, f3c]) near(it.strokeWidth, 0.5, "nét bản sao bóp giữ nguyên 0,5 pt (" + it.identity + ")");
  // Nguồn không bị bóp.
  near(c.dcDanTagBdNguon.tag_1.front.geometricBounds[1] - c.dcDanTagBdNguon.tag_1.front.geometricBounds[3], 72 * MM, "nguồn nguyên");
  // Hệ số sai (ngoài 0,9…1) → ERR, không tạo gì.
  const bad = plan();
  bad.jobs[0].blocks[0].places[0].bopY = 0.5;
  const nBefore = mock.doc.artboards.length;
  assert.match(c.dcDanTagBdVe(JSON.stringify(bad)), /^ERR: .*bóp/);
  assert.equal(mock.doc.artboards.length, nBefore);
  console.log("dcDanTagBdVe (bóp từng con): ok");
}

// ---------- Đọc tag: object không có khung (guide, ẩn, rỗng) được bỏ qua và báo, không chặn cả lượt ----------
{
  const { mock, c } = load();
  const f1 = box(mock, 0, 300, 112, 72, "f1");
  const b1 = box(mock, 150, 300, 112, 72, "b1");
  const guide = box(mock, 140, 0, 0.01, 400, "guide");
  guide.guides = true;
  const hidden = box(mock, 0, 200, 56, 91, "hid");
  hidden.hidden = true;
  const rong = box(mock, 0, 100, 0, 0, "rong"); // khung 0 × 0 (group rỗng/path không điểm)
  mock.doc.selection = [guide, f1, hidden, b1, rong];
  const out = parseOk(c.dcDanTagBdDocTag());
  assert.equal(out.tags.length, 1);
  assert.deepEqual([out.tags[0].w, out.tags[0].h, out.tags[0].twoSided], [112, 72, true]);
  assert.ok(Array.isArray(out.boQua) && out.boQua.length === 3, "báo 3 object bỏ qua: " + JSON.stringify(out.boQua));
  assert.match(out.boQua.join(" | "), /guide/);
  assert.match(out.boQua.join(" | "), /ẩn/);
  // Toàn bộ selection không có khung → ERR nêu rõ loại object.
  mock.doc.selection = [guide, rong];
  assert.match(c.dcDanTagBdDocTag(), /^ERR: .*không có tag nào đo được/);
  console.log("dcDanTagBdDocTag (bỏ qua object không khung): ok");
}
