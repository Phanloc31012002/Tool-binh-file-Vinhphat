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

// ---------- Phần 4: bóp cả cụm để vừa khổ (anh Lộc 22/10 21:14) ----------
// Cụm chỉ dư "chút xíu" so với n ô thì co nguyên cụm (tỉ lệ đều, không méo), mỗi con bớt tối đa
// 1 mm, để lọt n ô thay vì lấy thêm ô. Ca thật của anh hai: 4 con 56 × 92 + 3 con 112 × 93 →
// 463 mm cao, dư 3 mm so với khối 2 × 5 (460): không bóp phải 11 ô, bóp 0,9 % thì vừa 10 ô.
{
  function tag(id, w, h, qty) {
    return { id: id, name: id, w: w, h: h, qty: qty };
  }
  const tags = [tag("hong", 56, 92, 4000), tag("ht", 112, 93, 3000)];
  const r = E.pack({ tags: tags, budgetMs: 100000 });
  assert.equal(r.ok, true, r.error);
  const job = r.jobs[0];
  assert.equal(job.cells, 10, "bóp xong phải còn 10 ô (không bóp là 11)");
  assert.equal(job.blocks.length, 1);
  assert.ok(job.bop > 0.98 && job.bop < 1, "hệ số bóp " + job.bop);
  // Mỗi con bớt tối đa 1 mm: hệ số = 1 − 1/cạnh dài nhất (112) → mọi cạnh khác bớt ít hơn 1 mm.
  assert.ok(Math.abs(job.bop - (1 - 1 / 112)) < 1e-9, "bóp đúng mức 1 mm trên con lớn nhất: " + job.bop);
  for (const p of job.blocks[0].places) {
    const t = tags.find((x) => x.id === p.id);
    const w0 = p.rot ? t.h : t.w,
      h0 = p.rot ? t.w : t.h;
    assert.ok(Math.abs(p.w - w0 * job.bop) < 0.006 && Math.abs(p.h - h0 * job.bop) < 0.006, "khổ con đã bóp theo cùng tỉ lệ (làm tròn 0,01 mm)");
    assert.ok(w0 - p.w <= 1 + 1e-9 && h0 - p.h <= 1 + 1e-9, "không con nào bớt quá 1 mm");
  }
  const pieces = job.blocks[0].places.map((p) => ({ id: p.id, w: p.rot ? p.h : p.w, h: p.rot ? p.w : p.h }));
  assert.equal(E.verify(job.blocks[0].places, job.blocks[0].cuts, job.blocks[0].w, job.blocks[0].h, pieces), null);
  assert.match(r.detail, /bóp cả cụm/);
  assert.match(r.detail, /10 ô thay vì 11/);
  // Không cần bóp thì không bóp: bop = 1, không nhắc tới bóp.
  const r0 = E.pack({ tags: [tag("a", 112, 72, 1000), tag("b", 100, 20, 1000)], budgetMs: 100000 });
  assert.equal(r0.ok, true);
  assert.equal(r0.jobs[0].bop, 1);
  assert.doesNotMatch(r0.detail, /bóp/);
  // Mức 2 (anh Lộc 22:00–22:21, "làm theo hình 2"): bóp 1 mm/con rồi mà vẫn thiếu chút xíu thì cả cụm
  // co đều tới 1,5 % (file anh tự bóp: card 92 → 90,62 = 0,985). 3 con 112 × 94: sau mức 1 cột cao
  // 461,8 (thiếu 1,8 mm) → mức 2 0,985 → 459,0 vừa 2 × 5 ô. Khối ghi hệ số riêng (blocks[].bop).
  const r94 = E.pack({ tags: [tag("hong", 56, 92, 4000), tag("ht", 112, 94, 3000)], budgetMs: 100000 });
  assert.equal(r94.ok, true, r94.error);
  assert.equal(r94.jobs[0].cells, 10, "mức 2 phải vừa 10 ô");
  assert.equal(E.BOP_MUC2, 0.985);
  assert.ok(Math.abs(r94.jobs[0].blocks[0].bop - 0.985) < 1e-9, "hệ số mức 2: " + r94.jobs[0].blocks[0].bop);
  assert.match(r94.detail, /cụm bớt thêm tới 1,5 % vì chỉ thiếu chút xíu/);
  for (const p of r94.jobs[0].blocks[0].places) {
    const goc = p.id === "ht" ? [112, 94] : [56, 92];
    const w0 = p.rot ? goc[1] : goc[0], h0 = p.rot ? goc[0] : goc[1];
    assert.ok(Math.abs(p.w - w0 * 0.985) < 0.006 && Math.abs(p.h - h0 * 0.985) < 0.006, "co đều 1,5 %: " + JSON.stringify(p));
  }
  // Ca thật của anh Lộc (hình 2, 22:21): 3 con đen 112 × 77, 2 con hồng 112 × 71, 2 card 56 × 92 →
  // cột cao 467, dư 7 mm → mức 2 còn 460,0 → vừa 10 ô, card nhỏ ra 90,62 như anh tự bóp.
  const rThat = E.pack({ tags: [tag("den", 112, 77, 3000), tag("hong", 112, 71, 2000), tag("tp", 56, 92, 1000), tag("cn", 56, 92, 1000)], budgetMs: 100000 });
  assert.equal(rThat.ok, true, rThat.error);
  assert.equal(rThat.jobs[0].cells, 10, "ca thật phải 10 ô: " + rThat.detail);
  const cn = rThat.jobs[0].blocks[0].places.find((p) => p.id === "cn");
  assert.ok(Math.abs((cn.rot ? cn.w : cn.h) - 90.62) < 0.01, "card nhỏ 92 → 90,62: " + JSON.stringify(cn));
  // Dư quá cả mức 2 (3 con 112 × 95: 469 × 0,985 = 462) thì không bóp, lấy thêm ô như cũ.
  const r2 = E.pack({ tags: [tag("hong", 56, 92, 4000), tag("ht", 112, 95, 3000)], budgetMs: 100000 });
  assert.equal(r2.ok, true);
  assert.equal(r2.jobs[0].bop, 1);
  assert.ok(r2.jobs[0].blocks.every((b) => b.bop === 1));
  assert.ok(r2.jobs[0].cells >= 11, "dư 9 mm không bóp nổi → " + r2.jobs[0].cells + " ô");
  console.log("Phần 4 (bóp cả cụm ≤ 1 mm/con, mức 2 co đều tới 1,5 %): ok");
}
