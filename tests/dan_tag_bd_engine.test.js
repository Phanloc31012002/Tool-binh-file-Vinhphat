"use strict";
// Lõi Dàn tag BD: bộ xếp guillotine (packInto), kiểm độc lập (verify), chấm bố cục (scoreLayout),
// rồi tìm khối ít ô nhất (pack). Ô card 56 × 92 mm đã tràn, khe 0, xoay 0/90, nhát cắt thẳng xuyên suốt.
const assert = require("node:assert/strict");
const E = require("../DanCardCEP/js/dan_tag_bd");

function piece(id, w, h) {
  return { id, w, h };
}
function rectOf(p) {
  return [p.x, p.y, p.x + p.w, p.y + p.h];
}

// ---------- Phần 1: packInto / verify / scoreLayout ----------
{
  assert.equal(E.CELL_W, 56);
  assert.equal(E.CELL_H, 92);
  assert.equal(E.MAX_COLS, 18);
  assert.equal(E.MAX_ROWS, 7);

  // (a) một con 112 × 72 trong khối 2 × 1 (112 × 92): đặt góc trên trái, một nhát ngang tách phần trống.
  const a = E.packInto([piece("a", 112, 72)], 112, 92);
  assert.equal(a.ok, true);
  assert.equal(a.places.length, 1);
  assert.deepEqual(rectOf(a.places[0]), [0, 0, 112, 72]);
  assert.equal(a.places[0].rot, 0);
  assert.equal(a.cuts.length, 1);
  assert.deepEqual(a.cuts[0], { axis: "H", at: 72, from: 0, to: 112 });
  assert.equal(E.verify(a.places, a.cuts, 112, 92, [piece("a", 112, 72)]), null);

  // (b) 112 × 72 + 92 × 40 không lọt 112 × 92 (còn dải 112 × 20); đổi 92 × 40 thành 100 × 20 thì lọt.
  assert.equal(E.packInto([piece("a", 112, 72), piece("b", 92, 40)], 112, 92).ok, false);
  const b = E.packInto([piece("a", 112, 72), piece("b", 100, 20)], 112, 92);
  assert.equal(b.ok, true);
  assert.equal(b.places.length, 2);
  assert.equal(E.verify(b.places, b.cuts, 112, 92, [piece("a", 112, 72), piece("b", 100, 20)]), null);
  // Nhát dọc tách 100 × 20 khỏi phần trống chỉ chạy trong dải dưới (72..92), không xuyên con 112 × 72.
  const v = b.cuts.filter((c) => c.axis === "V");
  assert.equal(v.length, 1);
  assert.equal(v[0].at, 100);
  assert.deepEqual([v[0].from, v[0].to], [72, 92]);

  // (c) 4 con 56 × 92 vào 112 × 184.
  const c = E.packInto([1, 2, 3, 4].map((i) => piece("c" + i, 56, 92)), 112, 184);
  assert.equal(c.ok, true);
  assert.equal(c.places.length, 4);
  assert.equal(E.verify(c.places, c.cuts, 112, 184, [1, 2, 3, 4].map((i) => piece("c" + i, 56, 92))), null);

  // (d) verify bắt lỗi: chồng nhau; cạnh con không nằm trên nhát cắt; nhát cắt xuyên con; thiếu con.
  const one = [piece("a", 112, 72)];
  assert.match(
    E.verify([{ id: "a", x: 0, y: 0, w: 112, h: 72, rot: 0 }, { id: "a", x: 0, y: 50, w: 112, h: 72, rot: 0 }], [], 112, 184, one.concat(one)),
    /chồng/i,
  );
  assert.match(E.verify([{ id: "a", x: 0, y: 0, w: 112, h: 72, rot: 0 }], [], 112, 92, one), /nhát cắt/i);
  assert.match(
    E.verify([{ id: "a", x: 0, y: 0, w: 112, h: 72, rot: 0 }], [{ axis: "H", at: 36, from: 0, to: 112 }, { axis: "H", at: 72, from: 0, to: 112 }], 112, 92, one),
    /xuyên/i,
  );
  assert.match(E.verify([], [], 112, 92, one), /thiếu|số con/i);
  assert.match(E.verify([{ id: "a", x: 0, y: 30, w: 112, h: 72, rot: 0 }], [], 112, 92, one), /ngoài|lọt/i);

  // (e) 2 × (112 × 75) + 56 × 91 vào 112 × 241: hợp lệ, hai con 112 × 75 kề nhau.
  const ePieces = [piece("p", 112, 75), piece("p", 112, 75), piece("q", 56, 91)];
  const e = E.packInto(ePieces, 112, 241);
  assert.equal(e.ok, true);
  assert.equal(E.verify(e.places, e.cuts, 112, 241, ePieces), null);
  const score = E.scoreLayout(e.places, e.cuts);
  assert.equal(score.adjacent, 1);
  assert.equal(score.cuts, e.cuts.length);

  // (f) 30 con 56 × 92 vào 280 × 552 (5 × 6 ô) — gộp con giống nhau nên không nổ nhánh.
  const f = E.packInto(Array.from({ length: 30 }, () => piece("k", 56, 92)), 280, 552);
  assert.equal(f.ok, true);
  assert.equal(f.places.length, 30);
  assert.ok(f.nodes < 40000, "nodes " + f.nodes);

  // (g) con xoay: 92 × 40 vào ô 56 × 92 phải xoay thành 40 × 92.
  const g = E.packInto([piece("r", 92, 40)], 56, 92);
  assert.equal(g.ok, true);
  assert.equal(g.places[0].rot, 90);
  assert.deepEqual([g.places[0].w, g.places[0].h], [40, 92]);
  console.log("Phần 1 (packInto/verify/scoreLayout): ok");
}

// ---------- Phần 2: pack / createSearch / packAsync ----------
{
  function tag(id, w, h, qty) {
    return { id: id, name: id, w: w, h: h, qty: qty };
  }
  function elapsed(fn) {
    var t = Date.now();
    var r = fn();
    r.__ms = Date.now() - t;
    return r;
  }
  // blockShapes: mọi (a,b) hợp lệ, số ô tăng dần, bằng ô thì khối vuông hơn trước.
  const shapes = E.blockShapes();
  assert.equal(shapes.length, 18 * 7);
  assert.deepEqual([shapes[0].cols, shapes[0].rows], [1, 1]);
  for (let i = 1; i < shapes.length; i++) assert.ok(shapes[i].cols * shapes[i].rows >= shapes[i - 1].cols * shapes[i - 1].rows);
  assert.ok(shapes.every((s) => s.cols <= 18 && s.rows <= 7 && s.w === 56 * s.cols && s.h === 92 * s.rows));

  // (a) một tag 112 × 72, 1000 con → khối 2 × 1, 2/2 ô.
  const a = elapsed(() => E.pack({ tags: [tag("A", 112, 72, 1000)] }));
  assert.equal(a.ok, true, a.error);
  assert.equal(a.jobs.length, 1);
  assert.equal(a.jobs[0].bai, 1000);
  assert.equal(a.jobs[0].hop, 10);
  assert.equal(a.jobs[0].blocks.length, 1);
  assert.deepEqual([a.jobs[0].blocks[0].cols, a.jobs[0].blocks[0].rows], [2, 1]);
  assert.deepEqual([a.jobs[0].blocks[0].w, a.jobs[0].blocks[0].h], [112, 92]);
  assert.equal(a.jobs[0].cells, 2);
  assert.equal(a.jobs[0].lowerBound, 2);
  assert.equal(a.jobs[0].proven, true);
  assert.equal(a.jobs[0].blocks[0].places[0].copy, 1);
  assert.match(a.detail, /Bài 1000/);
  assert.match(a.detail, /2\/2 ô — không thể ít hơn/);

  // (b) 112 × 72 + 92 × 40: khối 2 × 1 không lọt, 3 × 1 lọt; diện tích 11 744 → cận dưới 3.
  const b = E.pack({ tags: [tag("A", 112, 72, 1000), tag("B", 92, 40, 1000)] });
  assert.equal(b.ok, true, b.error);
  assert.equal(b.jobs[0].cells, 3);
  assert.equal(b.jobs[0].lowerBound, 3);
  assert.equal(b.jobs[0].proven, true);

  // (c) ví dụ anh hai: 92 × 70 + 90 × 40 ghép vừa 2 ô.
  const c = E.pack({ tags: [tag("A", 92, 70, 1000), tag("B", 90, 40, 1000)] });
  assert.equal(c.ok, true, c.error);
  assert.equal(c.jobs[0].cells, 2);
  assert.equal(c.jobs[0].proven, true);

  // (d) file 31: 56 × 91 × 2 tag, 112 × 71 (2000), 112 × 75 (3000) → 10/10 ô.
  const d = elapsed(() =>
    E.pack({ tags: [tag("chic", 56, 91, 1000), tag("coffee", 56, 91, 1000), tag("hoantien", 112, 71, 2000), tag("htmotor", 112, 75, 3000)] }),
  );
  assert.equal(d.ok, true, d.error);
  assert.equal(d.jobs[0].cells, 10);
  assert.equal(d.jobs[0].proven, true);
  assert.equal(d.jobs[0].blocks.reduce((s, blk) => s + blk.places.length, 0), 7);
  assert.ok(d.__ms < 4000, "file 31: " + d.__ms + " ms");

  // (e) file 32: 112 × 72 (4000) + 112 × 80 → 8 ô, bốn con 112 × 72 kề nhau.
  const e = E.pack({ tags: [tag("hd", 112, 72, 4000), tag("ht", 112, 80, 1000)] });
  assert.equal(e.ok, true, e.error);
  assert.equal(e.jobs[0].cells, 8);
  assert.equal(e.jobs[0].blocks.length, 1);
  assert.ok(E.scoreLayout(e.jobs[0].blocks[0].places, e.jobs[0].blocks[0].cuts).adjacent >= 3);
  assert.deepEqual(e.jobs[0].blocks[0].places.filter((p) => p.id === "hd").map((p) => p.copy), [1, 2, 3, 4]);

  // (f) số lượng sai → lỗi rõ. (g) tag không lọt tờ → lỗi rõ.
  const f = E.pack({ tags: [tag("A", 112, 72, 1500)] });
  assert.equal(f.ok, false);
  assert.match(f.error, /500 hoặc bội của 1000/);
  const g = E.pack({ tags: [tag("A", 1100, 100, 1000)] });
  assert.equal(g.ok, false);
  assert.match(g.error, /không lọt/i);
  assert.equal(E.pack({ tags: [] }).ok, false);

  // (h) bài 500 và bài 1000 tách riêng, bài 500 trước.
  const h = E.pack({ tags: [tag("A", 112, 72, 1000), tag("B", 56, 92, 500)] });
  assert.equal(h.ok, true, h.error);
  assert.deepEqual(h.jobs.map((j) => [j.bai, j.hop]), [[500, 5], [1000, 10]]);
  assert.equal(h.jobs[0].blocks[0].places[0].id, "B");

  // (i) tag lớn hơn một ô cả hai chiều: 120 × 100 → xoay vào khối 2 × 2 (4 ô), cận dưới 3.
  const i = E.pack({ tags: [tag("A", 120, 100, 1000)] });
  assert.equal(i.ok, true, i.error);
  assert.equal(i.jobs[0].cells, 4);
  assert.equal(i.jobs[0].lowerBound, 3);
  assert.equal(i.jobs[0].proven, false);
  assert.match(i.detail, /tối thiểu lý thuyết 3/);

  // (j) 10 000 con 112 × 72 → 10 con, 16 ô, dưới 4 s.
  const j = elapsed(() => E.pack({ tags: [tag("A", 112, 72, 10000)] }));
  assert.equal(j.ok, true, j.error);
  assert.equal(j.jobs[0].blocks.reduce((s, blk) => s + blk.places.length, 0), 10);
  assert.equal(j.jobs[0].cells, 16);
  assert.ok(j.__ms < 4000, "10 000 con: " + j.__ms + " ms");

  // (m) một khối phải 8 ô nhưng hai khối chỉ 7 ô: 112 × 184 + 112 × 92 + 56 × 92.
  const m = E.pack({ tags: [tag("A", 112, 184, 1000), tag("B", 112, 92, 1000), tag("C", 56, 92, 1000)] });
  assert.equal(m.ok, true, m.error);
  assert.equal(m.jobs[0].cells, 7);
  assert.equal(m.jobs[0].blocks.length, 2);
  assert.equal(m.jobs[0].proven, true);

  // (k) cùng đầu vào → cùng kết quả; (l) chạy từng bước nhỏ cũng ra đúng kết quả.
  const input = { tags: [tag("chic", 56, 91, 1000), tag("coffee", 56, 91, 1000), tag("hoantien", 112, 71, 2000), tag("htmotor", 112, 75, 3000)] };
  const r1 = E.pack(input),
    r2 = E.pack(input);
  const strip = (r) => JSON.stringify(r.jobs);
  assert.equal(strip(r1), strip(r2));
  const s = E.createSearch(input);
  let progress,
    steps = 0;
  do {
    progress = s.step(5);
    steps++;
    assert.ok(progress.total >= progress.done);
  } while (!progress.finished && steps < 100000);
  assert.equal(progress.finished, true);
  assert.equal(strip(s.result()), strip(r1));

  // packAsync: gọi lại qua setTimeout, báo tiến độ rồi trả kết quả.
  let ticks = 0;
  E.packAsync(
    input,
    () => ticks++,
    (res) => {
      assert.equal(res.ok, true);
      assert.equal(strip(res), strip(r1));
      assert.ok(ticks >= 1);
      console.log("Phần 2 (pack/createSearch/packAsync): ok — file31 " + d.__ms + " ms, 10 000 con " + j.__ms + " ms");
    },
  );
}

// ---------- Phần 3: sửa theo soát mã ----------
{
  function tag(id, w, h, qty) {
    return { id: id, name: id, w: w, h: h, qty: qty };
  }
  // Hết giờ ở bài 500 (nhiều tag khác nhau) thì bài 1000 vẫn phải có khối — không được ERR cả lượt.
  const many = [];
  for (let i = 0; i < 24; i++) many.push(tag("t" + i, 40 + ((i * 13) % 70), 30 + ((i * 7) % 60), 500));
  many.push(tag("hd", 112, 72, 1000));
  const r = E.pack({ tags: many, budgetMs: 1 });
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.jobs.map((j) => j.bai), [500, 1000]);
  assert.equal(r.jobs[1].cells, 2);
  assert.match(r.detail, /Hết thời gian tìm/);
  // Ngân sách rất nhỏ với 3 bài nhỏ: vẫn ra đủ, và cùng thứ tự khối với tên trong detail.
  const r2 = E.pack({ tags: [tag("A", 112, 184, 1000), tag("B", 112, 92, 1000), tag("C", 56, 92, 1000)], budgetMs: 100000 });
  assert.equal(r2.ok, true);
  // detail liệt kê khối theo đúng thứ tự blocks[] (khối to trước) để khớp số thứ tự artboard.
  const names = r2.jobs[0].blocks.map((b) => b.cols + " × " + b.rows + " ô");
  const idx = names.map((n) => r2.detail.indexOf(n));
  assert.ok(idx[0] >= 0 && idx[1] > idx[0], "detail: " + r2.detail);
  console.log("Phần 3 (hết giờ vẫn đủ bài, detail đúng thứ tự): ok");
}

// ---------- Phần 4: bóp để vừa khối ----------
// Mức 1: mỗi con bớt tối đa 1 mm theo chiều đang thiếu (cột thiếu 6 mm có 6 con → mỗi con 1 mm), chỗ
// trống hút trước. Mức 2: bóp 1 mm/con rồi mà vẫn thiếu 1–2 mm nữa thì cả cụm ăn thêm cho đủ. Hai bên
// một nhát dọc co cùng lượng theo chiều cao (như bóp tay trong Illustrator). Chỉ nhận khi ít ô hơn thật.
{
  function tag(id, w, h, qty) {
    return { id: id, name: id, w: w, h: h, qty: qty };
  }
  assert.equal(E.BOP_MOI_CON_MM, 1);
  assert.equal(E.BOP_THEM_CUM_MM, 2);
  const goc = { hong: [56, 92], ht: [112, 93], den: [112, 77], hg: [112, 71], tp: [56, 92], cn: [56, 92] };
  function kiem(r, cells, maxMm, msg) {
    assert.equal(r.ok, true, r.error);
    const job = r.jobs[0];
    assert.equal(job.cells, cells, msg + ": " + r.detail);
    for (const b of job.blocks) {
      const pieces = b.places.map((p) => ({ id: p.id, w: p.rot ? p.h : p.w, h: p.rot ? p.w : p.h }));
      assert.equal(E.verify(b.places, b.cuts, b.w, b.h, pieces), null, msg + " verify");
      for (const p of b.places) {
        const g = goc[p.id];
        const w0 = p.rot ? g[1] : g[0], h0 = p.rot ? g[0] : g[1];
        assert.ok(w0 - p.w <= maxMm + 1e-6 && h0 - p.h <= maxMm + 1e-6, msg + ": con bớt quá " + maxMm + " mm: " + JSON.stringify(p));
        assert.ok(Math.abs(p.bopX - p.w / w0) < 1e-6 && Math.abs(p.bopY - p.h / h0) < 1e-6, msg + ": bopX/bopY khớp khổ");
      }
    }
    return job;
  }
  // (a) Cột 3 × 93 + 2 hàng 92 = 463, dư 3 mm so với 2 × 5 ô (460): 5 dãy, mỗi con bớt 0,6 mm → 10 ô.
  const raFull = E.pack({ tags: [tag("hong", 56, 92, 4000), tag("ht", 112, 93, 3000)], budgetMs: 100000 });
  const ra = kiem(raFull, 10, 1, "dư 3 mm");
  assert.equal(ra.blocks.length, 1);
  assert.match(raFull.detail, /Đã bóp 7 con .*mỗi con ≤ 1 mm.*10 ô thay vì 11/);
  // (b) 3 × 94 → dư 6 mm, 5 dãy chỉ hút được 5 mm → mức 2 cả cụm ăn thêm 1 mm → vẫn 10 ô, có con bớt > 1 mm.
  const rb = E.pack({ tags: [tag("hong", 56, 92, 4000), tag("ht", 112, 94, 3000)], budgetMs: 100000 });
  goc.ht = [112, 94];
  kiem(rb, 10, 1 + 2, "mức 2");
  assert.match(rb.detail, /ăn thêm chút xíu vì chỉ thiếu 1–2 mm/);
  // (c) 3 × 95 → dư 9 mm > 5 + 2: không bóp nổi, lấy thêm ô như cũ, không con nào bị đụng.
  const rc = E.pack({ tags: [tag("hong", 56, 92, 4000), tag("ht", 112, 95, 3000)], budgetMs: 100000 });
  assert.equal(rc.ok, true);
  assert.ok(rc.jobs[0].cells >= 11, "dư 9 mm → " + rc.jobs[0].cells + " ô");
  assert.equal(rc.jobs[0].daBop, 0);
  assert.doesNotMatch(rc.detail, /bóp/);
  for (const b of rc.jobs[0].blocks) for (const p of b.places) assert.ok(p.bopX === 1 && p.bopY === 1);
  // (d) Ca thật (bài anh hai, 22/10): 3 con đen 112 × 77 + 2 con hồng 112 × 71 + 2 card 56 × 92 = cột 467,
  //     dư 7 mm; 6 dãy → mỗi con ≤ 1 mm là vừa đúng một khối 2 × 5 (10 ô) như bình tay.
  goc.ht = [112, 93];
  const rd = kiem(E.pack({ tags: [tag("den", 112, 77, 3000), tag("hg", 112, 71, 2000), tag("tp", 56, 92, 1000), tag("cn", 56, 92, 1000)], budgetMs: 100000 }), 10, 1, "ca thật");
  assert.equal(rd.blocks.length, 1, "một khối 2 × 5 như bình tay");
  assert.equal(rd.blocks[0].cols * rd.blocks[0].rows, 10);
  // Hai card cạnh nhau (nhát dọc) co cùng chiều cao; bề rộng không đụng (chỉ thiếu chiều cao).
  const cards = rd.blocks[0].places.filter((p) => p.id === "tp" || p.id === "cn");
  assert.equal(cards.length, 2);
  assert.ok(Math.abs(cards[0].h - cards[1].h) < 1e-9 && cards[0].w === 56 && cards[1].w === 56);
  // (e) Thiếu bề ngang: 2 con 57 × 92 + 1 con 56 × 92 = 170 > 168 (3 ô): 3 con mỗi con bớt 0,67 mm ngang.
  goc.a = [57, 92];
  goc.b = [56, 92];
  const re = kiem(E.pack({ tags: [tag("a", 57, 92, 2000), tag("b", 56, 92, 1000)], budgetMs: 100000 }), 3, 1, "thiếu ngang");
  for (const p of re.blocks[0].places) assert.ok(p.bopY === 1 && p.bopX < 1, "chỉ bóp bề ngang: " + JSON.stringify(p));
  // (f) Không cần bóp thì không bóp.
  const rf = E.pack({ tags: [tag("a", 112, 72, 1000), tag("b", 100, 20, 1000)], budgetMs: 100000 });
  assert.equal(rf.jobs[0].daBop, 0);
  assert.doesNotMatch(rf.detail, /bóp/);
  console.log("Phần 4 (bóp theo dãy ≤ 1 mm/con, mức 2 cả cụm ăn thêm 1–2 mm): ok");
}

// ---------- Phần 5: con đầu danh sách ở góc trên trái, các con sau nối tiếp theo danh sách ----------
// Như Dàn tối ưu/KTS: tag thêm trước nằm trước. Bố cục guillotine cho phép đổi chỗ hai bên của bất kỳ
// nhát cắt nào mà vẫn hợp lệ, nên chỉ sắp lại chỗ — số ô, khổ con, mức bóp giữ nguyên.
{
  function tag(id, w, h, qty) {
    return { id: id, name: id, w: w, h: h, qty: qty };
  }
  function dauTien(job, id) {
    const b = job.blocks[0];
    const p = b.places.find((q) => q.id === id && q.x === 0 && q.y === 0);
    assert.ok(p, "con " + id + " phải ở góc trên trái (0, 0): " + JSON.stringify(b.places));
    const pieces = b.places.map((q) => ({ id: q.id, w: q.rot ? q.h : q.w, h: q.rot ? q.w : q.h }));
    assert.equal(E.verify(b.places, b.cuts, b.w, b.h, pieces), null, "vẫn hợp lệ sau khi sắp");
  }
  // (a) Ca thật 22/10 (7 con, có bóp): card "tp" thêm trước → góc trên trái; đảo danh sách thì "den" lên đầu.
  const ra = E.pack({ tags: [tag("tp", 56, 92, 1000), tag("cn", 56, 92, 1000), tag("den", 112, 77, 3000), tag("hg", 112, 71, 2000)], budgetMs: 100000 });
  assert.equal(ra.ok, true, ra.error);
  assert.equal(ra.jobs[0].cells, 10, ra.detail);
  assert.equal(ra.jobs[0].daBop, 7, "bóp như cũ");
  dauTien(ra.jobs[0], "tp");
  const rb = E.pack({ tags: [tag("den", 112, 77, 3000), tag("hg", 112, 71, 2000), tag("tp", 56, 92, 1000), tag("cn", 56, 92, 1000)], budgetMs: 100000 });
  assert.equal(rb.jobs[0].cells, 10);
  dauTien(rb.jobs[0], "den");
  // Thứ tự theo cây cắt: đọc các con theo nhát cắt từ gốc (trái → phải, trên → dưới) thì chỉ số tag không giảm
  // ở mỗi nhánh so với nhánh sau nó — tức con "cn" (thứ 2) không nằm sau "den"/"hg" trong cùng một dãy.
  const b = ra.jobs[0].blocks[0];
  const tree = E.treeFromLayout(b.places, b.cuts, b.w, b.h);
  assert.ok(tree, "dựng lại được cây cắt");
  const rank = { tp: 0, cn: 1, den: 2, hg: 3 };
  function minRank(n) {
    if (n.kind === "empty") return Infinity;
    if (n.kind === "piece") return rank[n.p.id];
    const a = minRank(n.a), c = minRank(n.b);
    assert.ok(a <= c, "nhánh trước phải chứa con có thứ tự nhỏ hơn nhánh sau: " + a + " > " + c);
    return Math.min(a, c);
  }
  minRank(tree);
  // (b) Không bóp: 2 tag khác khổ, tag đầu ở (0, 0) dù nhỏ hơn.
  const rc = E.pack({ tags: [tag("nho", 100, 20, 1000), tag("to", 112, 72, 1000)], budgetMs: 100000 });
  assert.equal(rc.jobs[0].daBop, 0);
  dauTien(rc.jobs[0], "nho");
  // (c) Khít: 1000 + 2000 dàn chung là "nhân thêm con" — không để chỗ trống kẹt giữa hai cụm.
  //     A 112 × 60 (1000) + B 112 × 72 (2000) trong khối 2 × 3: A@0, B@60, B@132, trống 72 mm dồn xuống cuối.
  const rd = E.pack({ tags: [tag("A", 112, 60, 1000), tag("B", 112, 72, 2000)], budgetMs: 100000 });
  assert.equal(rd.ok, true, rd.error);
  const bd = rd.jobs[0].blocks[0];
  const ys = bd.places.map((p) => [p.id, p.x, p.y]).sort((u, v) => u[2] - v[2]);
  assert.deepEqual(ys, [["A", 0, 0], ["B", 0, 60], ["B", 0, 132]], "khít từ trên xuống: " + JSON.stringify(bd.places));
  dauTien(rd.jobs[0], "A");
  // Nhát cắt: chỉ giữa các con và một nhát tách phần trống cuối, không có nhát thừa trong vùng trống.
  assert.deepEqual(
    bd.cuts.map((c) => c.axis + c.at).sort(),
    ["H132", "H204", "H60"],
    JSON.stringify(bd.cuts),
  );
  // (d) Ca anh Lộc 23/10 (test.pdf): 2 con 112 × 72 + 3 con 77 × 107 + 2 card 92 × 92 trong khối 6 × 2.
  //     Nhát dọc tách hai card phải sát mép con rộng nhất bên trái (231), không lấy "phần còn lại" (244)
  //     rồi hở 13 mm; dấu cắt nhờ vậy nằm ngay mép con.
  const re = E.pack({ tags: [tag("hd", 112, 72, 2000), tag("ba", 77, 107, 3000), tag("oao", 92, 92, 2000)], budgetMs: 100000 });
  assert.equal(re.ok, true, re.error);
  assert.equal(re.jobs[0].blocks.length, 1, re.detail);
  const be = re.jobs[0].blocks[0];
  assert.equal(be.cells, 12, re.detail);
  const oao = be.places.filter((p) => p.id === "oao");
  assert.equal(oao.length, 2);
  const phai = Math.max(...be.places.filter((p) => p.id !== "oao").map((p) => p.x + p.w));
  for (const p of oao) assert.equal(p.x, phai, "card OAO phải sát mép phải cụm bên trái (" + phai + "): " + JSON.stringify(p));
  assert.ok(be.cuts.some((c) => c.axis === "V" && c.at === phai && c.from === 0 && c.to === 184), "nhát dọc ở " + phai + ": " + JSON.stringify(be.cuts));
  // Tổng quát: mọi khối trong các ca trên không có con nào "treo" — con nào cũng chạm cạnh trên của khối
  // hoặc chạm đáy một con khác; chạm cạnh trái của khối hoặc cạnh phải một con khác.
  for (const r of [ra, rb, rc, rd, re])
    for (const b of r.jobs[0].blocks)
      for (const p of b.places) {
        const tren = p.y < 1e-9 || b.places.some((q) => q !== p && Math.abs(q.y + q.h - p.y) < 1e-6 && q.x < p.x + p.w - 1e-6 && q.x + q.w > p.x + 1e-6);
        const trai = p.x < 1e-9 || b.places.some((q) => q !== p && Math.abs(q.x + q.w - p.x) < 1e-6 && q.y < p.y + p.h - 1e-6 && q.y + q.h > p.y + 1e-6);
        assert.ok(tren && trai, "con treo giữa chỗ trống: " + JSON.stringify(p) + " trong " + JSON.stringify(b.places));
      }
  console.log("Phần 5 (con đầu danh sách ở góc trên trái, nối tiếp theo danh sách): ok");
}
