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

  return {
    version: VERSION,
    groupCutters: groupCutters,
    clusterSizes: clusterSizes,
    assignClusters: assignClusters
  };
});
