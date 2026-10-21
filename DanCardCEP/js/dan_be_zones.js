/*
 * Dàn bế – bộ CHIA KHU cho tờ trộn nhiều mẫu.
 *
 * Chạy trong CEP (Chromium) và Node, không chạy trong ExtendScript. Bộ này không tự vẽ gì:
 * nó chỉ nghĩ ra cách chia tờ thành các khu (mỗi nhóm khuôn một khu), dàn từng khu bằng lõi
 * xếp hàng lồng có sẵn (DanBeNester._core), khép các khu sát nhau theo đường bế thật, lấp
 * chỗ trống rồi gán bài thành cụm liền. Mọi toạ độ công khai là milimet.
 *
 * Luật chốt với anh Lộc (docs/THIET_KE_DAN_BE_CHIA_KHU.md): con cùng mẫu luôn nằm gần nhau,
 * số con các mẫu gần bằng nhau, lấp đầy tờ; khoảng cách giữa hai khu = khe thường, hoặc
 * khoảng cách khu khi bật tick "Chia khu cách nhau".
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DanBeZones = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var VERSION = 1;

  function polygonArea(groups) {
    var total = 0, gi, ci, i, c, a, b, s;
    for (gi = 0; gi < groups.length; gi++) {
      s = 0;
      for (ci = 0; ci < groups[gi].length; ci++) {
        c = groups[gi][ci];
        for (i = 0; i < c.length; i++) {
          a = c[i]; b = c[(i + 1) % c.length];
          s += a[0] * b[1] - b[0] * a[1];
        }
      }
      total += Math.abs(s) / 2;
    }
    return total;
  }

  // Gom các bài có cùng khuôn bế (trùng nhau sau khi bỏ vị trí, điểm đầu/chiều path, thứ tự
  // group và xoay 0/90/180/270). Mỗi nhóm giữ khuôn chuẩn hoá của bài đầu tiên; mỗi bài ghi
  // `rel` = số lần xoay 90° để đưa bài về hướng của khuôn đại diện.
  function groupCutters(types, core) {
    var cutters = [], ti, norm, found, ci, rel, cand, ce;
    for (ti = 0; ti < types.length; ti++) {
      norm = null;
      try { norm = core.normalizeGroups(types[ti].groups || []); } catch (normError) { norm = null; }
      if (!norm || !norm.length) throw new Error("Không đọc được đường bế kín của loại " + (ti + 1) + ".");
      ce = Number(types[ti].curveErrorMm);
      if (!isFinite(ce) || ce < 0) ce = 0;
      found = false;
      for (ci = 0; ci < cutters.length && !found; ci++) {
        for (rel = 0; rel < 4; rel++) {
          cand = rel ? core.normalizeGroups(core.rotateGroups(norm, rel * 90)) : norm;
          if (cand && core.sameGroups(cand, cutters[ci].groups)) {
            cutters[ci].members.push({ type: ti, rel: rel });
            if (ce > cutters[ci].curveErrorMm) cutters[ci].curveErrorMm = ce;
            found = true;
            break;
          }
        }
      }
      if (!found) cutters.push({ groups: norm, members: [{ type: ti, rel: 0 }], curveErrorMm: ce, area: polygonArea(norm) });
    }
    return cutters;
  }

  // Chia n con cho m bài: bài đứng trước nhận phần dư, chênh tối đa 1.
  function clusterSizes(n, m) {
    var out = [], i, base = Math.floor(n / m), extra = n % m;
    for (i = 0; i < m; i++) out.push(base + (i < extra ? 1 : 0));
    return out;
  }

  // Gán nhãn (bài) cho từng điểm (tâm con) sao cho mỗi bài là một cụm gọn: chia đôi đệ quy
  // theo cạnh dài hơn của khung bao, tất định (hoà thì theo trục kia rồi chỉ số gốc).
  function assignClusters(points, sizes) {
    var labels = new Array(points.length), i;
    for (i = 0; i < points.length; i++) labels[i] = 0;
    function sorted(idx, axis) {
      return idx.slice().sort(function (a, b) {
        var pa = points[a], pb = points[b], d = axis === "x" ? pa.x - pb.x : pa.y - pb.y;
        if (Math.abs(d) > 1e-9) return d;
        d = axis === "x" ? pa.y - pb.y : pa.x - pb.x;
        if (Math.abs(d) > 1e-9) return d;
        return a - b;
      });
    }
    // Nhát cắt "sạch" khi hai bên không có điểm nào cùng toạ độ trên trục cắt; như vậy khung
    // bao hai cụm không lấn nhau. Ưu tiên trục cắt sạch, rồi tới trục dài hơn (cụm vuông vắn).
    function cutGap(order, nL, axis) {
      if (nL <= 0 || nL >= order.length) return Infinity;
      var a = points[order[nL - 1]], b = points[order[nL]];
      return axis === "x" ? b.x - a.x : b.y - a.y;
    }
    function rec(idx, names) {
      var k, nL, x0, x1, y0, y1, p, left, right, j, ox, oy, gx, gy, order;
      if (!idx.length) return;
      if (names.length === 1) { for (j = 0; j < idx.length; j++) labels[idx[j]] = names[0]; return; }
      left = names.slice(0, Math.ceil(names.length / 2)); right = names.slice(left.length);
      nL = 0;
      for (k = 0; k < left.length; k++) nL += sizes[left[k]];
      x0 = Infinity; x1 = -Infinity; y0 = Infinity; y1 = -Infinity;
      for (j = 0; j < idx.length; j++) {
        p = points[idx[j]];
        if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
      }
      ox = sorted(idx, "x"); oy = sorted(idx, "y");
      gx = cutGap(ox, nL, "x"); gy = cutGap(oy, nL, "y");
      if ((gx > 1e-9) !== (gy > 1e-9)) order = gx > 1e-9 ? ox : oy;
      else if (gx > 1e-9) order = x1 - x0 >= y1 - y0 ? ox : oy;
      // Không trục nào cắt sạch: chia theo thứ tự đọc (hết hàng này tới hàng khác), mép lởm chởm
      // chỉ nằm ở cuối hàng như người dàn tay vẫn làm.
      else order = oy;
      rec(order.slice(0, nL), left);
      rec(order.slice(nL), right);
    }
    var all = [];
    for (i = 0; i < points.length; i++) all.push(i);
    var names = [];
    for (i = 0; i < sizes.length; i++) names.push(i);
    rec(all, names);
    return labels;
  }

  // ---------- Hồ sơ khuôn và ước lượng ----------

  // Dàn thử nhanh một khuôn trên cả vùng dùng được (không PON) rồi ghi khung bao từng con, dời về
  // góc trên-trái của bố cục. Từ đó ước lượng một khung cỡ bất kỳ chứa được bao nhiêu con.
  function profileCutter(cutter, W, H, gap, ponClear, core) {
    var plan = core.planCutterRect(cutter.groups, cutter.curveErrorMm, { w: W, h: H }, [], gap, ponClear, "quick");
    var variants = core.cutterVariants(cutter.groups, cutter.curveErrorMm), boxes = [], i, s, v, x0 = Infinity, y0 = Infinity;
    for (i = 0; i < plan.slots.length; i++) {
      s = plan.slots[i]; v = variants[s.vi];
      boxes.push({ x0: s.x, y0: s.y, x1: s.x + v.w, y1: s.y + v.h });
      if (s.x < x0) x0 = s.x; if (s.y < y0) y0 = s.y;
    }
    for (i = 0; i < boxes.length; i++) { boxes[i].x0 -= x0; boxes[i].x1 -= x0; boxes[i].y0 -= y0; boxes[i].y1 -= y0; }
    return { boxes: boxes };
  }

  function uniqueSorted(values) {
    values.sort(function (a, b) { return a - b; });
    var out = [], i;
    for (i = 0; i < values.length; i++) if (!out.length || values[i] - out[out.length - 1] > 1e-9) out.push(values[i]);
    return out;
  }

  // f(w, h) = số con của bố cục mẫu nằm gọn trong khung w × h (góc trên-trái). Kèm danh sách mép
  // phải/dưới đã sắp (f.xs, f.ys) để tìm kích thước nhỏ nhất đạt một số con cho trước.
  function makeEstimator(profile) {
    var boxes = profile.boxes.slice(), xs = [], ys = [], i;
    for (i = 0; i < boxes.length; i++) { xs.push(boxes[i].x1); ys.push(boxes[i].y1); }
    function f(w, h) {
      var n = 0, j;
      for (j = 0; j < boxes.length; j++) if (boxes[j].x1 <= w + 1e-9 && boxes[j].y1 <= h + 1e-9) n++;
      return n;
    }
    f.xs = uniqueSorted(xs); f.ys = uniqueSorted(ys); f.total = boxes.length;
    return f;
  }

  // ---------- Cây chia khu ----------

  function treeKey(node) {
    if (node.leaf !== undefined) return "" + node.leaf;
    var parts = [], i;
    for (i = 0; i < node.kids.length; i++) parts.push(treeKey(node.kids[i]));
    return node.dir + "[" + parts.join(",") + "]";
  }
  function leavesOf(list) { var out = [], i; for (i = 0; i < list.length; i++) out.push({ leaf: list[i] }); return out; }
  function permutations(list) {
    var out = [];
    function rec(prefix, rest) {
      var i;
      if (!rest.length) { out.push(prefix); return; }
      for (i = 0; i < rest.length; i++) rec(prefix.concat([rest[i]]), rest.slice(0, i).concat(rest.slice(i + 1)));
    }
    rec([], list);
    return out;
  }
  function byArea(cutters, descending) {
    var idx = [], i;
    for (i = 0; i < cutters.length; i++) idx.push(i);
    idx.sort(function (a, b) { return (descending ? cutters[b].area - cutters[a].area : cutters[a].area - cutters[b].area) || a - b; });
    return idx;
  }
  function part(list, dir) { return list.length === 1 ? { leaf: list[0] } : { dir: dir, kids: leavesOf(list) }; }

  // Mọi cách chia khu đáng thử, thứ tự cố định, không trùng, tối đa 200 cây.
  // Lá: {leaf: c}; nút: {dir: "H" (xếp từ trên xuống) | "V" (từ trái sang), kids: [...]}.
  function enumerateTrees(cutters) {
    var G = cutters.length, trees = [], seen = {}, dirs = ["H", "V"], orders = [], i, d, r, order, desc, splits = [], a, b, mask, c;
    function add(tree) {
      var key = treeKey(tree);
      if (seen[key] || trees.length >= 200) return;
      seen[key] = true; trees.push(tree);
    }
    if (G <= 4) {
      order = []; for (i = 0; i < G; i++) order.push(i);
      orders = permutations(order);
    } else {
      desc = byArea(cutters, true); order = byArea(cutters, false);
      for (r = 0; r < G; r++) { orders.push(order.slice(r).concat(order.slice(0, r))); orders.push(desc.slice(r).concat(desc.slice(0, r))); }
    }
    for (d = 0; d < 2; d++) for (i = 0; i < orders.length; i++) add({ dir: dirs[d], kids: leavesOf(orders[i]) });
    if (G >= 3) {
      desc = byArea(cutters, true);
      if (G <= 4) {
        for (mask = 1; mask < (1 << G) - 1; mask++) {
          a = []; b = [];
          for (c = 0; c < G; c++) (mask & (1 << c) ? a : b).push(desc[c]);
          splits.push([a, b]);
        }
      } else {
        a = []; b = [];
        for (c = 0; c < G; c++) (c % 2 ? b : a).push(desc[c]);
        splits.push([a, b]); splits.push([b, a]);
      }
      for (d = 0; d < 2; d++) for (i = 0; i < splits.length; i++)
        add({ dir: dirs[d], kids: [part(splits[i][0], dirs[1 - d]), part(splits[i][1], dirs[1 - d])] });
    }
    return trees;
  }

  // ---------- Ước lượng kích thước khu cho một cây ----------

  // Độ dài nhỏ nhất theo `axis` để mọi bài trong `node` có ≥ N con, khi bề kia bằng `cross`
  // và độ dài không được vượt `limit`. Infinity nếu không thể.
  function need(node, N, cross, axis, limit, ests, cutters, s) {
    var m, target, est, edges, i, w, h, sum, k, kids, lo, hi, mid, other;
    if (N <= 0) return 0;
    if (node.leaf !== undefined) {
      m = cutters[node.leaf].members.length; target = m * N; est = ests[node.leaf];
      edges = axis === "x" ? est.xs : est.ys;
      for (i = 0; i < edges.length; i++) {
        if (edges[i] > limit + 1e-9) return Infinity;
        w = axis === "x" ? edges[i] : cross; h = axis === "x" ? cross : edges[i];
        if (est(w, h) >= target) return edges[i];
      }
      return Infinity;
    }
    kids = node.kids;
    if ((node.dir === "H") === (axis === "y")) {
      sum = (kids.length - 1) * s;
      for (k = 0; k < kids.length; k++) {
        sum += need(kids[k], N, cross, axis, limit - sum, ests, cutters, s);
        if (!isFinite(sum) || sum > limit + 1e-9) return Infinity;
      }
      return sum;
    }
    other = axis === "x" ? "y" : "x";
    function feasible(L) {
      var total = (kids.length - 1) * s, j;
      for (j = 0; j < kids.length; j++) {
        total += need(kids[j], N, L, other, cross - total, ests, cutters, s);
        if (!isFinite(total) || total > cross + 1e-9) return false;
      }
      return true;
    }
    if (!feasible(limit)) return Infinity;
    lo = 0; hi = limit;
    while (hi - lo > 0.25) { mid = (lo + hi) / 2; if (feasible(mid)) hi = mid; else lo = mid; }
    return hi;
  }

  // Cấp kích thước cho từng khu của cây trong khung w × h với N con/bài, phân phần dư, cộng số con.
  function allocate(node, w, h, N, ests, cutters, s, extents, counts) {
    var horizontal, span, cross, axis, kids, lens = [], used, leftover, k, order, i, base, trial, total = 0, n, box;
    if (node.leaf !== undefined) { n = ests[node.leaf](w, h); counts[node.leaf] += n; return n; }
    horizontal = node.dir === "H"; span = horizontal ? h : w; cross = horizontal ? w : h; axis = horizontal ? "y" : "x";
    kids = node.kids; used = (kids.length - 1) * s;
    for (k = 0; k < kids.length; k++) {
      lens.push(need(kids[k], N, cross, axis, Math.max(0, span - used), ests, cutters, s));
      if (!isFinite(lens[k])) lens[k] = 0;
      used += lens[k];
    }
    leftover = span - used;
    // Dàn thử (không ghi vào extents/counts thật) để biết một khu rộng hơn có thêm được con không.
    function dry(kid, len) {
      var c = [], j;
      for (j = 0; j < cutters.length; j++) c.push(0);
      return allocate(kid, horizontal ? cross : len, horizontal ? len : cross, N, ests, cutters, s, new Map(), c);
    }
    function perDesign(kid, len) {
      var c = [], j, e = new Map(), best = Infinity;
      for (j = 0; j < cutters.length; j++) c.push(0);
      allocate(kid, horizontal ? cross : len, horizontal ? len : cross, N, ests, cutters, s, e, c);
      for (j = 0; j < cutters.length; j++) if (c[j] || cutterIn(kid, j)) best = Math.min(best, Math.floor(c[j] / cutters[j].members.length));
      return best;
    }
    if (leftover > 1e-9) {
      order = [];
      for (k = 0; k < kids.length; k++) order.push({ k: k, per: perDesign(kids[k], lens[k]) });
      order.sort(function (a, b) { return a.per - b.per || a.k - b.k; });
      for (i = 0; i < order.length; i++) {
        k = order[i].k; base = dry(kids[k], lens[k]); trial = dry(kids[k], lens[k] + leftover);
        if (trial > base) { lens[k] += leftover; break; }
      }
    }
    extents.set(node, lens);
    for (k = 0; k < kids.length; k++) {
      box = horizontal ? { w: cross, h: lens[k] } : { w: lens[k], h: cross };
      total += allocate(kids[k], box.w, box.h, N, ests, cutters, s, extents, counts);
    }
    return total;
  }
  function cutterIn(node, c) {
    var i;
    if (node.leaf !== undefined) return node.leaf === c;
    for (i = 0; i < node.kids.length; i++) if (cutterIn(node.kids[i], c)) return true;
    return false;
  }
  function countBoundaries(node) {
    var n, i;
    if (node.leaf !== undefined) return 0;
    n = node.kids.length - 1;
    for (i = 0; i < node.kids.length; i++) n += countBoundaries(node.kids[i]);
    return n;
  }

  // Ước lượng cây: N* lớn nhất mà mọi bài có N* con, rồi phần dư cho khu thêm được con.
  // Trả {total, minPer, counts (theo khuôn), extents (Map nút → độ dài từng con), boundaries}.
  function sizeTree(tree, W, H, ests, cutters, s) {
    var horizontal = tree.dir === "H", span = horizontal ? H : W, cross = horizontal ? W : H, axis = horizontal ? "y" : "x";
    var hi = 1, i, lo = 0, mid, counts = [], extents = new Map(), total, minPer = Infinity, m;
    for (i = 0; i < cutters.length; i++) {
      m = cutters[i].members.length;
      hi = Math.max(hi, Math.floor(ests[i](W, H) / m) + 1);
    }
    function fits(N) { return need(tree, N, cross, axis, span, ests, cutters, s) <= span + 1e-9; }
    if (!fits(1)) hi = 0;
    else { while (hi - lo > 1) { mid = Math.floor((lo + hi) / 2); if (fits(mid)) lo = mid; else hi = mid; } if (fits(hi)) lo = hi; hi = lo; }
    for (i = 0; i < cutters.length; i++) counts.push(0);
    total = allocate(tree, W, H, hi, ests, cutters, s, extents, counts);
    for (i = 0; i < cutters.length; i++) minPer = Math.min(minPer, Math.floor(counts[i] / cutters[i].members.length));
    return { total: total, minPer: minPer, counts: counts, extents: extents, boundaries: countBoundaries(tree), N: hi };
  }

  // ---------- Ngữ cảnh dàn thật ----------

  function round3(v) { return Math.round(v * 1000) / 1000; }

  // Ngữ cảnh một lần dàn: vùng dùng được (đã trừ lề), khe, khoảng cách khu, chấm PON, biến thể
  // 4 hướng của từng khuôn, bộ nhớ đệm dàn lá và chốt chặn hai mức khe.
  function makeContext(input, cutters, core) {
    var margin = Number(input.marginMm), gap = Number(input.gapMm), ponClear = Number(input.ponClearMm);
    var zg = Number(input.zoneGapMm), s = zg > 0 ? Math.max(zg, gap) : gap;
    var W = Number(input.sheet.widthMm) - 2 * margin, H = Number(input.sheet.heightMm) - 2 * margin;
    var dots = [], variants = [], cache = {}, i, d, c, vs, k;
    for (i = 0; i < (input.sheet.dots || []).length; i++) {
      d = input.sheet.dots[i];
      dots.push({ x: Number(d.x) - margin, y: Number(d.y) - margin, r: Number(d.r), radius: Number(d.r) + ponClear });
    }
    for (c = 0; c < cutters.length; c++) {
      vs = core.cutterVariants(cutters[c].groups, cutters[c].curveErrorMm);
      for (k = 0; k < 4; k++) variants.push(vs[k]);
    }
    function boxOf(p) {
      var v = variants[p.c * 4 + p.vi];
      return { x0: p.x, y0: p.y, x1: p.x + v.w, y1: p.y + v.h };
    }
    // Dàn khuôn c trong khung rect {x, y, w, h}; chấm PON đổi sang toạ độ khung. Nhớ đệm theo khuôn,
    // cỡ khung (0,001 mm), vị trí chấm so với khung và mức tìm. Trả mảnh đã dời về đúng vị trí khung.
    function planLeaf(c, rect, effort) {
      var local = [], j, key, plan, pieces = [], w = round3(rect.w), h = round3(rect.h), rx = rect.x, ry = rect.y;
      for (j = 0; j < dots.length; j++) {
        d = dots[j];
        if (d.x + d.radius <= rx || d.x - d.radius >= rx + rect.w || d.y + d.radius <= ry || d.y - d.radius >= ry + rect.h) continue;
        local.push({ x: round3(d.x - rx), y: round3(d.y - ry), r: d.r });
      }
      key = c + "|" + w + "x" + h + "|" + effort + "|" + local.map(function (q) { return q.x + "," + q.y + "," + q.r; }).join(";");
      if (!cache[key]) {
        plan = w > 0 && h > 0 ? core.planCutterRect(cutters[c].groups, cutters[c].curveErrorMm, { w: w, h: h }, local, gap, ponClear, effort)
          : { count: 0, slots: [] };
        cache[key] = plan.slots;
      }
      for (j = 0; j < cache[key].length; j++) pieces.push({ c: c, vi: cache[key][j].vi, x: cache[key][j].x + rx, y: cache[key][j].y + ry });
      return pieces;
    }
    function verify(pieces) {
      var plan = [], j, dv = [];
      for (j = 0; j < pieces.length; j++) plan.push({ v: pieces[j].c * 4 + pieces[j].vi, x: pieces[j].x, y: pieces[j].y, zone: pieces[j].c });
      for (j = 0; j < dots.length; j++) dv.push({ x: dots[j].x, y: dots[j].y, radius: dots[j].radius });
      return core.verifyGeometry(plan, variants, W, H, dv, gap, 1, s);
    }
    // Chốt chặn cục bộ: chỉ các mảnh `fixed` nằm gần `moving` (tiết kiệm khi dời một khu).
    function verifyNear(fixed, moving) {
      var reach = Math.max(gap, s) + 1, subset = moving.slice(), j, k2, b, mb, near;
      var mx0 = Infinity, my0 = Infinity, mx1 = -Infinity, my1 = -Infinity;
      for (j = 0; j < moving.length; j++) {
        mb = boxOf(moving[j]);
        if (mb.x0 < mx0) mx0 = mb.x0; if (mb.y0 < my0) my0 = mb.y0; if (mb.x1 > mx1) mx1 = mb.x1; if (mb.y1 > my1) my1 = mb.y1;
      }
      for (j = 0; j < fixed.length; j++) {
        b = boxOf(fixed[j]);
        near = b.x1 >= mx0 - reach && b.x0 <= mx1 + reach && b.y1 >= my0 - reach && b.y0 <= my1 + reach;
        if (near) subset.push(fixed[j]);
      }
      for (k2 = 0; k2 < subset.length; k2++) { /* giữ thứ tự: mảnh đang dời trước */ }
      return verify(subset);
    }
    return { W: W, H: H, margin: margin, gap: gap, s: s, ponClear: ponClear, dots: dots, variants: variants, cutters: cutters,
      planLeaf: planLeaf, verify: verify, verifyNear: verifyNear, boxOf: boxOf };
  }

  function shiftPieces(pieces, dx, dy) {
    var out = [], i;
    for (i = 0; i < pieces.length; i++) out.push({ c: pieces[i].c, vi: pieces[i].vi, x: pieces[i].x + dx, y: pieces[i].y + dy });
    return out;
  }
  function extentOf(pieces, ctx, axis) {
    var lo = Infinity, hi = -Infinity, i, b;
    for (i = 0; i < pieces.length; i++) {
      b = ctx.boxOf(pieces[i]);
      if (axis === "y") { if (b.y0 < lo) lo = b.y0; if (b.y1 > hi) hi = b.y1; }
      else { if (b.x0 < lo) lo = b.x0; if (b.x1 > hi) hi = b.x1; }
    }
    return { lo: lo, hi: hi };
  }

  // Đường bế thật của một mảnh, đặt đúng chỗ (dùng cho khép khu).
  function placedContours(piece, ctx) {
    var v = ctx.variants[piece.c * 4 + piece.vi], out = [], gi, ci, pi, c, q;
    for (gi = 0; gi < v.groups.length; gi++) for (ci = 0; ci < v.groups[gi].length; ci++) {
      c = v.groups[gi][ci]; q = [];
      for (pi = 0; pi < c.length; pi++) q.push([c[pi][0] + piece.x, c[pi][1] + piece.y]);
      out.push(q);
    }
    return out;
  }

  // Khoảng dời δ ≥ 0 để kéo `next` về phía `prev` theo trục `axis` sao cho đường bế hai bên còn cách
  // đúng khoảng cách khu (ctx.s). Đo bằng biên dạng theo cột 0,05 mm, nở biên của `prev` thêm s,
  // rồi kiểm tra lại bằng chốt chặn; hỏng thì lùi 0,05 mm, tối đa 10 lần. `limit` chặn trên của δ.
  function approachShift(prev, next, axis, ctx, limit) {
    var COL = 0.05, STEP = 0.05, s = ctx.s, K = Math.ceil(s / COL) + 1, low = {}, high = {}, i, j, k, pts, a, b, n, t, u, v, col, key;
    var along = function (p) { return axis === "y" ? p[1] : p[0]; }, across = function (p) { return axis === "y" ? p[0] : p[1]; };
    function scan(pieces, table, keepMax) {
      var pi, cs, ci, c, e;
      for (pi = 0; pi < pieces.length; pi++) {
        cs = placedContours(pieces[pi], ctx);
        for (ci = 0; ci < cs.length; ci++) {
          c = cs[ci];
          for (e = 0; e < c.length; e++) {
            a = c[e]; b = c[(e + 1) % c.length];
            n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / STEP));
            for (t = 0; t <= n; t++) {
              u = a[0] + (b[0] - a[0]) * t / n; v = a[1] + (b[1] - a[1]) * t / n;
              col = Math.floor(across([u, v]) / COL); key = col;
              if (table[key] === undefined) table[key] = along([u, v]);
              else if (keepMax ? along([u, v]) > table[key] : along([u, v]) < table[key]) table[key] = along([u, v]);
            }
          }
        }
      }
    }
    scan(prev, low, true); scan(next, high, false);
    var best = Infinity, lowD, dx, cand;
    for (key in high) if (Object.prototype.hasOwnProperty.call(high, key)) {
      col = Number(key); lowD = -Infinity;
      for (k = -K; k <= K; k++) {
        if (low[col + k] === undefined) continue;
        dx = Math.max(0, Math.abs(k) - 1) * COL;
        cand = low[col + k] + Math.sqrt(Math.max(0, s * s - dx * dx));
        if (cand > lowD) lowD = cand;
      }
      if (lowD > -Infinity && high[key] - lowD < best) best = high[key] - lowD;
    }
    var delta = best === Infinity ? Infinity : best - 0.002;
    if (limit !== undefined && delta > limit) delta = limit;
    if (!(delta > 0)) return 0;
    if (delta === Infinity) return 0;
    for (i = 0; i <= 10; i++) {
      pts = axis === "y" ? shiftPieces(next, 0, -delta) : shiftPieces(next, -delta, 0);
      if (ctx.verifyNear(prev, pts)) return delta;
      delta -= STEP;
      if (delta <= 0) return 0;
    }
    return 0;
  }

  // Kéo mảnh của con đầu tiên sát mép đầu khung (chừa thì nhỏ dần nếu chốt chặn hỏng).
  function pullToStart(fixed, pieces, axis, start, ctx) {
    var ext = extentOf(pieces, ctx, axis), delta = ext.lo - start, i, pts;
    if (!(delta > 1e-9)) return pieces;
    for (i = 0; i < 6; i++) {
      pts = axis === "y" ? shiftPieces(pieces, 0, -delta) : shiftPieces(pieces, -delta, 0);
      if (ctx.verifyNear(fixed, pts)) return pts;
      delta /= 2;
    }
    return pieces;
  }

  // Dàn thật một cây chia khu với kích thước khu đã ước lượng; khép các khu sát nhau.
  // Trả {pieces, counts} hoặc null khi có khuôn không được con nào.
  function realizeTree(tree, sizing, ctx, effort) {
    var out = [], counts = [], i;
    function realizeNode(node, rect) {
      var lens, horizontal, cursor, end, k, len, kidRect, kidPieces, ext, delta, placed = [];
      if (node.leaf !== undefined) {
        kidPieces = ctx.planLeaf(node.leaf, rect, effort);
        return kidPieces;
      }
      lens = sizing.extents.get(node) || []; horizontal = node.dir === "H";
      cursor = horizontal ? rect.y : rect.x; end = horizontal ? rect.y + rect.h : rect.x + rect.w;
      for (k = 0; k < node.kids.length; k++) {
        len = k < node.kids.length - 1 ? (lens[k] || 0) : end - cursor;
        if (len > end - cursor) len = end - cursor;
        if (len <= 0) { if (k < node.kids.length - 1) continue; else break; }
        kidRect = horizontal ? { x: rect.x, y: cursor, w: rect.w, h: len } : { x: cursor, y: rect.y, w: len, h: rect.h };
        kidPieces = realizeNode(node.kids[k], kidRect);
        if (!kidPieces.length) continue;
        if (!placed.length) kidPieces = pullToStart(out, kidPieces, horizontal ? "y" : "x", horizontal ? rect.y : rect.x, ctx);
        else {
          ext = extentOf(kidPieces, ctx, horizontal ? "y" : "x");
          delta = approachShift(placed, kidPieces, horizontal ? "y" : "x", ctx, ext.lo - (horizontal ? rect.y : rect.x));
          if (delta > 0) kidPieces = horizontal ? shiftPieces(kidPieces, 0, -delta) : shiftPieces(kidPieces, -delta, 0);
        }
        for (i = 0; i < kidPieces.length; i++) { placed.push(kidPieces[i]); out.push(kidPieces[i]); }
        ext = extentOf(kidPieces, ctx, horizontal ? "y" : "x");
        cursor = ext.hi + ctx.s;
      }
      return placed;
    }
    realizeNode(tree, { x: 0, y: 0, w: ctx.W, h: ctx.H });
    for (i = 0; i < ctx.cutters.length; i++) counts.push(0);
    for (i = 0; i < out.length; i++) counts[out[i].c]++;
    for (i = 0; i < counts.length; i++) if (!counts[i]) return null;
    return { pieces: out, counts: counts };
  }

  return {
    version: VERSION,
    makeContext: makeContext,
    realizeTree: realizeTree,
    approachShift: approachShift,
    groupCutters: groupCutters,
    clusterSizes: clusterSizes,
    assignClusters: assignClusters,
    profileCutter: profileCutter,
    makeEstimator: makeEstimator,
    enumerateTrees: enumerateTrees,
    sizeTree: sizeTree,
    _need: need
  };
});
