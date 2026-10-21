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

  return {
    version: VERSION,
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
