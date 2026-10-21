/*
 * Dàn bế – lõi xếp khuôn theo SILHOUETTE THẬT.
 *
 * File này chạy trong CEP (Chromium), không chạy trong ExtendScript. Illustrator
 * chỉ có nhiệm vụ đọc path và render kết quả. Bằng cách đó phép tìm dàn không
 * làm Illustrator rơi vào trạng thái Not Responding.
 *
 * Mỗi scanline được lưu nhiều đoạn [x0, x1], không phải một envelope [lo, hi].
 * Vì vậy một khuôn có eo/lõm vẫn giữ khoảng rỗng để khuôn xoay khác có thể lồng
 * vào. Tất cả tọa độ công khai của API dưới đây đều là milimet.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DanBeNester = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var VERSION = 11;

  function now() { return new Date().getTime(); }
  function abs(v) { return v < 0 ? -v : v; }
  function sq(v) { return v * v; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function key2(x, y) { return x + "/" + y; }

  function spatialIndex(cell) { return { cell: cell, bins: {} }; }
  function spatialAdd(index, item, bounds) {
    var x0 = Math.floor(bounds.x0 / index.cell), x1 = Math.floor(bounds.x1 / index.cell);
    var y0 = Math.floor(bounds.y0 / index.cell), y1 = Math.floor(bounds.y1 / index.cell), x, y, key;
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      key = key2(x, y);
      if (!index.bins[key]) index.bins[key] = [];
      index.bins[key].push(item);
    }
  }
  function spatialNear(index, bounds) {
    var x0 = Math.floor(bounds.x0 / index.cell), x1 = Math.floor(bounds.x1 / index.cell);
    var y0 = Math.floor(bounds.y0 / index.cell), y1 = Math.floor(bounds.y1 / index.cell), x, y, bin, i;
    var out = [], used = {};
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      bin = index.bins[key2(x, y)] || [];
      for (i = 0; i < bin.length; i++) if (!used[bin[i]]) {
        used[bin[i]] = true; out.push(bin[i]);
      }
    }
    return out;
  }

  function copyPoint(p) { return [p[0], p[1]]; }
  function copyGroups(groups) {
    var out = [], gi, ci, pi, g, cg, c, cp;
    for (gi = 0; gi < groups.length; gi++) {
      g = groups[gi]; cg = [];
      for (ci = 0; ci < g.length; ci++) {
        c = g[ci]; cp = [];
        for (pi = 0; pi < c.length; pi++) cp.push(copyPoint(c[pi]));
        if (cp.length >= 3) cg.push(cp);
      }
      if (cg.length) out.push(cg);
    }
    return out;
  }

  function boundsOfGroups(groups) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    var gi, ci, pi, p;
    for (gi = 0; gi < groups.length; gi++) {
      for (ci = 0; ci < groups[gi].length; ci++) {
        for (pi = 0; pi < groups[gi][ci].length; pi++) {
          p = groups[gi][ci][pi];
          if (p[0] < x0) x0 = p[0];
          if (p[0] > x1) x1 = p[0];
          if (p[1] < y0) y0 = p[1];
          if (p[1] > y1) y1 = p[1];
        }
      }
    }
    if (!(x1 > x0) || !(y1 > y0)) return null;
    return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0 };
  }

  function normalizeGroups(groups) {
    var b = boundsOfGroups(groups), out = copyGroups(groups), gi, ci, pi;
    if (!b) return null;
    for (gi = 0; gi < out.length; gi++) {
      for (ci = 0; ci < out[gi].length; ci++) {
        for (pi = 0; pi < out[gi][ci].length; pi++) {
          out[gi][ci][pi][0] -= b.x0;
          out[gi][ci][pi][1] -= b.y0;
        }
      }
    }
    return out;
  }

  // Nhiều mẫu bài khác nhau thường dùng chung một khuôn bế. Chỉ tìm cho
  // silhouette đó một lần rồi chia xoay vòng các slot tìm được; trước đây việc coi
  // các khuôn bế giống hệt nhau là những loại riêng rẽ đã làm tắt các mô-típ xếp dày.
  // Toạ độ đã được chuẩn hoá sẵn. Điểm bắt đầu của path, chiều quay và
  // thứ tự group/compound không làm đổi hình học vật lý của khuôn bế.
  function sameContour(a, b) {
    if (a.length !== b.length) return false;
    var tolerance = 0.000001, start, direction, i, j, equal;
    for (start = 0; start < b.length; start++) {
      if (abs(a[0][0] - b[start][0]) > tolerance || abs(a[0][1] - b[start][1]) > tolerance) continue;
      for (direction = -1; direction <= 1; direction += 2) {
        equal = true;
        for (i = 1; i < a.length; i++) {
          j = (start + direction * i + b.length) % b.length;
          if (abs(a[i][0] - b[j][0]) > tolerance || abs(a[i][1] - b[j][1]) > tolerance) { equal = false; break; }
        }
        if (equal) return true;
      }
    }
    return false;
  }

  function sameGroup(a, b) {
    if (a.length !== b.length) return false;
    var used = {}, i, j, found;
    for (i = 0; i < a.length; i++) {
      found = false;
      for (j = 0; j < b.length; j++) if (!used[j] && sameContour(a[i], b[j])) {
        used[j] = true; found = true; break;
      }
      if (!found) return false;
    }
    return true;
  }

  function sameGroups(a, b) {
    if (a.length !== b.length) return false;
    var used = {}, i, j, found;
    for (i = 0; i < a.length; i++) {
      found = false;
      for (j = 0; j < b.length; j++) if (!used[j] && sameGroup(a[i], b[j])) {
        used[j] = true; found = true; break;
      }
      if (!found) return false;
    }
    return true;
  }

  function rotateGroups(groups, deg) {
    var a = deg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
    var out = [], gi, ci, pi, g, ng, c, nc, p, x, y;
    for (gi = 0; gi < groups.length; gi++) {
      g = groups[gi]; ng = [];
      for (ci = 0; ci < g.length; ci++) {
        c = g[ci]; nc = [];
        for (pi = 0; pi < c.length; pi++) {
          p = c[pi]; x = p[0]; y = p[1];
          if (deg === 0) nc.push([x, y]);
          else if (deg === 90) nc.push([-y, x]);
          else if (deg === 180) nc.push([-x, -y]);
          else if (deg === 270) nc.push([y, -x]);
          else nc.push([x * co - y * si, x * si + y * co]);
        }
        ng.push(nc);
      }
      out.push(ng);
    }
    return normalizeGroups(out);
  }

  function sortNumber(a, b) { return a - b; }
  function mergeSpans(spans) {
    if (!spans || !spans.length) return [];
    spans.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var out = [[spans[0][0], spans[0][1]]], i, cur, s;
    for (i = 1; i < spans.length; i++) {
      cur = out[out.length - 1]; s = spans[i];
      if (s[0] <= cur[1]) {
        if (s[1] > cur[1]) cur[1] = s[1];
      } else out.push([s[0], s[1]]);
    }
    return out;
  }

  // Luật even/odd trong một CompoundPath; các group riêng thì được hợp lại sau.
  function intervalsForGroup(group, y) {
    var xs = [], ci, c, i, p, q, x;
    for (ci = 0; ci < group.length; ci++) {
      c = group[ci];
      for (i = 0; i < c.length; i++) {
        p = c[i]; q = c[(i + 1) % c.length];
        // Quy tắc nửa mở giúp không đếm một đỉnh hai lần.
        if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) {
          x = p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1]);
          xs.push(x);
        }
      }
    }
    xs.sort(sortNumber);
    var out = [], j;
    for (j = 0; j + 1 < xs.length; j += 2) {
      if (xs[j + 1] > xs[j] + 1e-7) out.push([xs[j], xs[j + 1]]);
    }
    return out;
  }

  function intervalsForGroups(groups, y) {
    var spans = [], gi, row, i;
    for (gi = 0; gi < groups.length; gi++) {
      row = intervalsForGroup(groups[gi], y);
      for (i = 0; i < row.length; i++) spans.push(row[i]);
    }
    return mergeSpans(spans);
  }

  function toCellSpans(spans, step) {
    var out = [], i, a, b;
    for (i = 0; i < spans.length; i++) {
      // Dùng cùng dung sai biên ô như trong buildVariant. Phép đổi từ point của
      // Illustrator có thể biến một cạnh tròn số thành 122.0000000125 mm: ceil thô
      // khi đó thêm một ô ma nằm ngoài bbox đã khai báo của khuôn bế. Việc này chỉ
      // bỏ sai số vụn nhỏ hơn một ô; phần nhô ra thật vẫn được làm tròn ra ngoài
      // và chốt chặn hình học liên tục độc lập vẫn là bắt buộc.
      a = Math.floor(spans[i][0] / step + 1e-7);
      b = Math.ceil(spans[i][1] / step - 1e-7);
      if (b > a) out.push([a, b]);
    }
    return mergeSpans(out);
  }

  function buildVariant(groups, mi, vi, angle, gap, step) {
    var rotated = rotateGroups(groups, angle), b = boundsOfGroups(rotated);
    if (!b) return null;
    // Phép đổi point sang mm của Illustrator có thể để một khuôn bế đúng 50 mm
    // thành 50.000000002 mm. Đừng phồng nó thêm cả một ô raster chỉ vì
    // sai số vụn đó (chốt chặn vật lý liên tục vẫn xét nó).
    var wCells = Math.ceil(b.w / step - 1e-7), hCells = Math.ceil(b.h / step - 1e-7);
    var rawRows = [], r, y;
    for (r = 0; r < hCells; r++) {
      y = (r + 0.5) * step;
      rawRows.push(toCellSpans(intervalsForGroups(rotated, y), step));
    }

    // Một scanline lấy mẫu đại diện cho cả một lát theo chiều dọc, không phải một
    // đường mảnh vô hạn. Khi nở phải tính thêm nửa chiều cao ô; nếu không, hai
    // đường bao cong có thể qua được phép thử theo hàng dù khe vật lý nhỏ hơn số đã nhập.
    var radius = gap / 2 + step / 2;
    var padCells = Math.ceil(radius / step);
    var clearRows = [], cr, rr, delta, ext, raw, j, expanded;
    for (cr = -padCells; cr < hCells + padCells; cr++) {
      expanded = [];
      for (rr = Math.max(0, cr - padCells); rr < Math.min(hCells, cr + padCells + 1); rr++) {
        delta = abs(cr - rr) * step;
        if (delta > radius + 1e-7) continue;
        ext = Math.ceil(Math.sqrt(Math.max(0, radius * radius - delta * delta)) / step);
        raw = rawRows[rr];
        for (j = 0; j < raw.length; j++) expanded.push([raw[j][0] - ext, raw[j][1] + ext]);
      }
      clearRows.push(mergeSpans(expanded));
    }

    return {
      mi: mi, vi: vi, angle: angle, groups: rotated,
      w: b.w, h: b.h, wCells: wCells, hCells: hCells,
      rawRows: rawRows, clearRows: clearRows, padCells: padCells,
      step: step, features: null, contacts: {}, id: mi * 4 + vi
    };
  }

  function spanSignature(spans) {
    if (!spans || !spans.length) return "";
    var s = spans[0][0] + ":" + spans[0][1];
    if (spans.length > 1) s += "/" + spans[spans.length - 1][0] + ":" + spans[spans.length - 1][1] + "/" + spans.length;
    return s;
  }

  function featureRows(v) {
    if (v.features) return v.features;
    var keep = {}, strong = {}, n = v.hCells, r, k, prev, cur, change, list = [];
    if (!n) return [];
    keep[0] = true; keep[n - 1] = true;
    for (k = 0; k <= 14; k++) keep[Math.round((n - 1) * k / 14)] = true;
    for (r = 1; r < n; r++) {
      prev = spanSignature(v.rawRows[r - 1]); cur = spanSignature(v.rawRows[r]);
      change = prev !== cur;
      // Đường cong có thể đổi ở mỗi hàng; chỉ giữ các mốc nổi bật theo chu kỳ.
      if (change && (r % Math.max(1, Math.round(n / 18)) === 0)) keep[r] = true;
      if (v.rawRows[r].length !== v.rawRows[r - 1].length) { keep[r] = true; strong[r] = true; }
      // Giữ lại các chỗ chuyển đột ngột ở cổ/đầu/vai ngay cả khi đường cong
      // chung có hàng trăm scanline thay đổi từ từ.
      var a0 = v.rawRows[r - 1][0], a1 = v.rawRows[r][0];
      var z0 = v.rawRows[r - 1][v.rawRows[r - 1].length - 1];
      var z1 = v.rawRows[r][v.rawRows[r].length - 1];
      if (a0 && a1 && z0 && z1 &&
          (abs(a0[0] - a1[0]) > 5 || abs(a0[1] - a1[1]) > 5 ||
           abs(z0[0] - z1[0]) > 5 || abs(z0[1] - z1[1]) > 5)) {
        keep[r] = true; strong[r] = true;
      }
    }
    for (r = 0; r < n; r++) if (keep[r]) list.push(r);
    if (list.length > 24) {
      var compact = [list[0]], used = {}, ix, pick;
      used[list[0]] = true; used[list[list.length - 1]] = true;
      for (r = 0; r < list.length; r++) if (strong[list[r]] && !used[list[r]]) { compact.push(list[r]); used[list[r]] = true; }
      for (ix = 1; ix < 22; ix++) {
        pick = list[Math.round((list.length - 1) * ix / 22)];
        if (!used[pick]) { compact.push(pick); used[pick] = true; }
      }
      if (!used[list[list.length - 1]]) compact.push(list[list.length - 1]);
      compact.sort(sortNumber); list = compact;
    }
    v.features = list;
    return list;
  }

  function rowIntersects(a, b) {
    var i = 0, j = 0;
    while (i < a.length && j < b.length) {
      if (a[i][0] < b[j][1] && a[i][1] > b[j][0]) return true;
      if (a[i][1] <= b[j][1]) i++; else j++;
    }
    return false;
  }

  function shiftedSpans(spans, dx) {
    var out = [], i;
    for (i = 0; i < spans.length; i++) out.push([spans[i][0] + dx, spans[i][1] + dx]);
    return out;
  }

  function mergeInto(row, spans) {
    if (!spans || !spans.length) return row || [];
    var all = [], i;
    if (row) for (i = 0; i < row.length; i++) all.push([row[i][0], row[i][1]]);
    for (i = 0; i < spans.length; i++) all.push([spans[i][0], spans[i][1]]);
    return mergeSpans(all);
  }

  function makeOccupancy(height, pad) {
    var rows = [], i;
    for (i = 0; i < height + 2 * pad + 3; i++) rows.push([]);
    return { rows: rows, pad: pad, height: height };
  }

  function occCanPlace(occ, v, x, y) {
    var ri, gy, old, shifted;
    for (ri = 0; ri < v.clearRows.length; ri++) {
      if (!v.clearRows[ri].length) continue;
      gy = y + ri - v.padCells;
      if (gy < -occ.pad || gy >= occ.height + occ.pad) continue;
      old = occ.rows[gy + occ.pad];
      shifted = shiftedSpans(v.clearRows[ri], x);
      if (rowIntersects(old, shifted)) return false;
    }
    return true;
  }

  function occAdd(occ, v, x, y) {
    var ri, gy, shifted;
    for (ri = 0; ri < v.clearRows.length; ri++) {
      if (!v.clearRows[ri].length) continue;
      gy = y + ri - v.padCells;
      if (gy < -occ.pad || gy >= occ.height + occ.pad) continue;
      shifted = shiftedSpans(v.clearRows[ri], x);
      occ.rows[gy + occ.pad] = mergeInto(occ.rows[gy + occ.pad], shifted);
    }
  }

  function rawHitsPon(v, x, y, dots) {
    var di, dot, r, gy, dy, reach, spans, si, a, b;
    for (di = 0; di < dots.length; di++) {
      dot = dots[di];
      for (r = 0; r < v.hCells; r++) {
        spans = v.rawRows[r]; if (!spans.length) continue;
        gy = y + r + 0.5;
        dy = gy - dot.y;
        if (abs(dy) > dot.radius) continue;
        reach = Math.sqrt(Math.max(0, dot.radius * dot.radius - dy * dy));
        for (si = 0; si < spans.length; si++) {
          a = x + spans[si][0]; b = x + spans[si][1];
          if (dot.x > a - reach && dot.x < b + reach) return true;
        }
      }
    }
    return false;
  }

  function planBounds(plan, variants) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, i, s, v;
    for (i = 0; i < plan.length; i++) {
      s = plan[i]; v = variants[s.v];
      if (s.x < x0) x0 = s.x;
      if (s.y < y0) y0 = s.y;
      if (s.x + v.wCells > x1) x1 = s.x + v.wCells;
      if (s.y + v.hCells > y1) y1 = s.y + v.hCells;
    }
    if (!plan.length) return { x0: 0, y0: 0, x1: 0, y1: 0, area: 0 };
    return { x0: x0, y0: y0, x1: x1, y1: y1, area: (x1 - x0) * (y1 - y0) };
  }

  function planScore(plan, variants) {
    var b = planBounds(plan, variants);
    // Số con được xét riêng. Một khối gọn có nhiều cơ hội nhận thêm một con
    // xoay hơn là một khối thấp và rộng có cùng số decal.
    return b.area * 10000 + (b.y1 - b.y0) * 8 + (b.x1 - b.x0);
  }

  function comparePlans(a, b, variants) {
    if (!b) return 1;
    if (a.length !== b.length) return a.length > b.length ? 1 : -1;
    var sa = planScore(a, variants), sb = planScore(b, variants);
    if (sa !== sb) return sa < sb ? 1 : -1;
    return 0;
  }

  function clonePlan(plan) {
    var out = [], i, s;
    for (i = 0; i < plan.length; i++) {
      s = plan[i]; out.push({ mi: s.mi, v: s.v, x: s.x, y: s.y });
    }
    return out;
  }

  function countTypes(plan, typeCount) {
    var out = [], i;
    for (i = 0; i < typeCount; i++) out.push(0);
    for (i = 0; i < plan.length; i++) out[plan[i].mi]++;
    return out;
  }

  // Nguồn trộn nhiều loại cam kết luân phiên đều nhau. Xếp tham lam giữ được
  // bất biến này, nhưng seed dựng sẵn và các lượt gỡ con khi sửa cũng phải tuân theo.
  function balancedPlan(plan, typeCount) {
    if (typeCount <= 1) return true;
    var counts = countTypes(plan, typeCount), lo = counts[0], hi = counts[0], i;
    for (i = 1; i < counts.length; i++) {
      if (counts[i] < lo) lo = counts[i];
      if (counts[i] > hi) hi = counts[i];
    }
    return hi - lo <= 1;
  }

  function allowedType(mi, counts, typeCount) {
    if (typeCount <= 1) return true;
    var min = counts[0], i;
    for (i = 1; i < typeCount; i++) if (counts[i] < min) min = counts[i];
    return counts[mi] <= min;
  }

  function candidateAdd(list, seen, x, y, v, rw, rh) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x + v.wCells > rw || y + v.hCells > rh) return;
    var k = key2(x, y);
    if (seen[k]) return;
    seen[k] = true; list.push({ x: x, y: y });
  }

  // Biên no-fit dạng raster: ở MỌI độ lệch scanline tương đối, tìm
  // các khoảng ngang bị cấm giữa hai silhouette thật. Hai đầu mút của
  // chúng là các vị trí tiếp xúc, kể cả các hốc bên trong khuôn bế lõm.
  // Cache theo từng cặp hướng xoay; các con cùng một khuôn dùng lại danh mục này.
  function contactOffsets(a, b) {
    if (b.contacts[a.id]) return b.contacts[a.id];
    var out = [], dy, ib, ia, ra, rb, i, j, blocks, merged, f;
    var first = -a.padCells - b.hCells - b.padCells;
    var last = a.hCells + a.padCells + b.padCells;
    for (dy = first; dy <= last; dy++) {
      blocks = [];
      for (ib = Math.max(0, b.padCells - a.padCells - dy);
           ib < b.clearRows.length; ib++) {
        ia = ib + dy + a.padCells - b.padCells;
        if (ia >= a.clearRows.length) break;
        ra = a.clearRows[ia]; rb = b.clearRows[ib];
        for (i = 0; i < ra.length; i++) for (j = 0; j < rb.length; j++)
          blocks.push([ra[i][0] - rb[j][1], ra[i][1] - rb[j][0]]);
      }
      merged = mergeSpans(blocks);
      for (i = 0; i < merged.length; i++) {
        f = merged[i];
        out.push({dx: Math.floor(f[0]), dy: dy});
        out.push({dx: Math.ceil(f[1]), dy: dy});
      }
    }
    b.contacts[a.id] = out;
    return out;
  }

  function candidatesFor(plan, v, variants, rw, rh) {
    var list = [], seen = {}, i, s, a, fa, fb, ia, ib, rowA, rowB, ca, cb;
    candidateAdd(list, seen, 0, 0, v, rw, rh);
    candidateAdd(list, seen, rw - v.wCells, 0, v, rw, rh);
    candidateAdd(list, seen, 0, rh - v.hCells, v, rw, rh);
    candidateAdd(list, seen, rw - v.wCells, rh - v.hCells, v, rw, rh);
    candidateAdd(list, seen, Math.round((rw - v.wCells) / 2), 0, v, rw, rh);
    candidateAdd(list, seen, Math.round((rw - v.wCells) / 2), rh - v.hCells, v, rw, rh);
    candidateAdd(list, seen, 0, Math.round((rh - v.hCells) / 2), v, rw, rh);
    candidateAdd(list, seen, rw - v.wCells, Math.round((rh - v.hCells) / 2), v, rw, rh);

    fb = featureRows(v);
    for (i = 0; i < plan.length; i++) {
      s = plan[i]; a = variants[s.v]; fa = featureRows(a);
      var contacts = contactOffsets(a, v), co;
      for (co = 0; co < contacts.length; co++)
        candidateAdd(list, seen, s.x + contacts[co].dx, s.y + contacts[co].dy, v, rw, rh);
      // Tiếp xúc theo bbox và canh tâm là không thể thiếu với các hình chữ nhật
      // đơn giản, còn tiếp xúc theo hàng đặc trưng bên dưới lo các hình lõm.
      candidateAdd(list, seen, s.x - v.wCells, s.y, v, rw, rh);
      candidateAdd(list, seen, s.x + a.wCells, s.y, v, rw, rh);
      candidateAdd(list, seen, s.x, s.y - v.hCells, v, rw, rh);
      candidateAdd(list, seen, s.x, s.y + a.hCells, v, rw, rh);
      candidateAdd(list, seen, s.x + Math.round((a.wCells - v.wCells) / 2), s.y, v, rw, rh);
      candidateAdd(list, seen, s.x, s.y + Math.round((a.hCells - v.hCells) / 2), v, rw, rh);
      candidateAdd(list, seen, s.x + a.wCells - v.wCells, s.y + a.hCells - v.hCells, v, rw, rh);

      // Tiếp xúc đường bao thật: canh một hàng đặc trưng của silhouette mới với
      // một hàng của silhouette đã đặt, rồi cho chạm phải-sang-trái / trái-sang-phải.
      // Phép thử va chạm dùng biên dạng đã nở, nên các phương án có khe nhỏ
      // hơn khe yêu cầu sẽ tự động bị loại.
      for (ia = 0; ia < fa.length; ia++) {
        rowA = a.clearRows[fa[ia] + a.padCells] || [];
        if (!rowA.length) continue;
        for (ib = 0; ib < fb.length; ib++) {
          rowB = v.clearRows[fb[ib] + v.padCells] || [];
          if (!rowB.length) continue;
          var yy = s.y + fa[ia] - fb[ib];
          for (ca = 0; ca < rowA.length; ca++) {
            for (cb = 0; cb < rowB.length; cb++) {
              candidateAdd(list, seen, s.x + rowA[ca][1] - rowB[cb][0], yy, v, rw, rh);
              candidateAdd(list, seen, s.x + rowA[ca][0] - rowB[cb][1], yy, v, rw, rh);
            }
          }
        }
      }
    }
    return list;
  }

  function sampleCandidates(candidates, cap) {
    var cs = candidates.slice(0), out = [], used = {}, i, edge, stride, c, k;
    cs.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    if (cs.length <= cap) return cs;
    edge = Math.min(Math.floor(cap * 0.36), Math.floor(cs.length / 2));
    function add(c) {
      k = key2(c.x, c.y);
      if (!used[k]) { used[k] = true; out.push(c); }
    }
    for (i = 0; i < edge; i++) add(cs[i]);
    for (i = Math.max(edge, cs.length - edge); i < cs.length; i++) add(cs[i]);
    stride = Math.max(1, Math.floor((cs.length - 2 * edge) / Math.max(1, cap - out.length)));
    for (i = edge; i < cs.length - edge && out.length < cap; i += stride) add(cs[i]);
    return out;
  }

  function insideAndClear(v, x, y, rw, rh, occ, dots) {
    if (x < 0 || y < 0 || x + v.wCells > rw || y + v.hCells > rh) return false;
    if (rawHitsPon(v, x, y, dots)) return false;
    return occCanPlace(occ, v, x, y);
  }

  function buildOccupancyFor(plan, variants, rh) {
    var pad = 0, i, v, occ;
    for (i = 0; i < variants.length; i++) if (variants[i].padCells > pad) pad = variants[i].padCells;
    occ = makeOccupancy(rh, pad + 2);
    for (i = 0; i < plan.length; i++) {
      v = variants[plan[i].v]; occAdd(occ, v, plan[i].x, plan[i].y);
    }
    return occ;
  }

  function growPlan(seed, variants, typeCount, rw, rh, dots, deadline) {
    var plan = clonePlan(seed), occ = buildOccupancyFor(plan, variants, rh);
    var guard = 0, maxCandidatesPerVariant = 760;
    while (guard++ < 220 && now() < deadline) {
      var counts = countTypes(plan, typeCount), best = null, vi, v, cs, ci, p, checked;
      for (vi = 0; vi < variants.length && now() < deadline; vi++) {
        v = variants[vi];
        if (!allowedType(v.mi, counts, typeCount)) continue;
        cs = candidatesFor(plan, v, variants, rw, rh);
        // Thử các phương án thấp/trái trước, nhưng giữ đủ tiếp xúc để vẫn
        // chọn được thế lồng nằm ngang hoặc ngược hướng.
        cs.sort(function (u, w) { return u.y - w.y || u.x - w.x; });
        // Trước đây một hướng xoay rộng/dài ăn hết toàn bộ hạn mức dùng chung,
        // nên 90°/270° thật sự chưa bao giờ được xét. Mỗi góc xoay được cấp
        // cùng một hạn mức có giới hạn.
        checked = 0;
        var edgeCount = Math.min(280, Math.floor(cs.length / 2));
        var middleStride = Math.max(1, Math.floor(Math.max(1, cs.length - 2 * edgeCount) / 180));
        for (ci = 0; ci < cs.length && checked < maxCandidatesPerVariant; ci++) {
          // Giữ cả hai đầu của danh sách đã sắp theo y. Dải trống hữu ích cho
          // khuôn nằm ngang thường ở trên cùng, nơi cách cũ "chỉ lấy N cái đầu"
          // không bao giờ với tới.
          if (ci >= edgeCount && ci < cs.length - edgeCount &&
              ((ci - edgeCount) % middleStride) !== 0) continue;
          checked++;
          p = cs[ci];
          if (!insideAndClear(v, p.x, p.y, rw, rh, occ, dots)) continue;
          var trial = { mi: v.mi, v: vi, x: p.x, y: p.y };
          var metricPlan = plan.concat([trial]);
          var score = planScore(metricPlan, variants);
          // Ưu tiên nhẹ cho góc dưới-trái giúp các vùng trống liền nhau, nhưng
          // số con vẫn là mục tiêu chính duy nhất trên toàn cục.
          score += p.y * 4 + p.x * 0.05;
          if (!best || score < best.score) {
            best = { mi: v.mi, v: vi, x: p.x, y: p.y, score: score };
          }
        }
      }
      if (!best) break;
      occAdd(occ, variants[best.v], best.x, best.y);
      plan.push({ mi: best.mi, v: best.v, x: best.x, y: best.y });
    }
    return plan;
  }

  // Một cặp được xét như một nước đi duy nhất. Xếp tham lam từng con một có thể
  // chiếm mất slot đầu của một cặp hữu ích rồi khiến con còn lại không đặt được.
  // Nhờ vậy mới giữ được chỗ cho một cặp nằm ngang tự do phía trên một khối gọn.
  function augmentWithPair(plan, variants, typeCount, rw, rh, dots, deadline) {
    if (!plan || !plan.length) return plan;
    var counts = countTypes(plan, typeCount), va, vb, a, b, ca, cb, pairCap = 24;
    var baseOcc = buildOccupancyFor(plan, variants, rh);
    var bounds = planBounds(plan, variants), variantOrder = [], vi;
    var freeY = Math.max(bounds.y0, rh - bounds.y1), freeX = Math.max(bounds.x0, rw - bounds.x1);
    for (vi = 0; vi < variants.length; vi++) variantOrder.push(vi);
    variantOrder.sort(function (left, right) {
      function fitsEdge(ix) {
        var vv = variants[ix];
        return (vv.hCells <= freeY && vv.wCells <= rw) || (vv.wCells <= freeX && vv.hCells <= rh) ? 0 : 1;
      }
      return fitsEdge(left) - fitsEdge(right) || left - right;
    });
    function validCandidates(seed, vv, occ) {
      var all = candidatesFor(seed, vv, variants, rw, rh), good = [], ci, p;
      for (ci = 0; ci < all.length; ci++) {
        p = all[ci];
        if (insideAndClear(vv, p.x, p.y, rw, rh, occ, dots)) good.push(p);
      }
      return sampleCandidates(good, pairCap);
    }
    for (va = 0; va < variants.length && now() < deadline; va++) {
      var av = variantOrder[va]; a = variants[av];
      if (!allowedType(a.mi, counts, typeCount)) continue;
      // Lọc theo toàn bộ bố cục TRƯỚC KHI lấy mẫu. Lấy mẫu trên danh mục thô
      // từng làm mất gần như mọi hốc đầu-kề-cổ hợp lệ.
      ca = validCandidates(plan, a, baseOcc);
      for (var ai = 0; ai < ca.length && now() < deadline; ai++) {
        var occA = buildOccupancyFor(plan, variants, rh), pa = ca[ai];
        var once = clonePlan(plan);
        once.push({ mi: a.mi, v: av, x: pa.x, y: pa.y });
        occAdd(occA, a, pa.x, pa.y);
        var countsOnce = countTypes(once, typeCount);
        for (vb = 0; vb < variants.length && now() < deadline; vb++) {
          var bv = variantOrder[vb]; b = variants[bv];
          if (!allowedType(b.mi, countsOnce, typeCount)) continue;
          cb = validCandidates(once, b, occA);
          for (var bi = 0; bi < cb.length && now() < deadline; bi++) {
            var pb = cb[bi];
            if (!insideAndClear(b, pb.x, pb.y, rw, rh, occA, dots)) continue;
            var joined = clonePlan(once);
            joined.push({ mi: b.mi, v: bv, x: pb.x, y: pb.y });
            // Số con là mục tiêu. Giữ lần tăng hai con đầu tiên đã kiểm chứng
            // và dành quỹ thời gian còn lại cho các seed bố cục khác.
            return joined;
          }
        }
      }
    }
    return plan;
  }

  function seedPlans(variants, typeCount, rw, rh, dots, deadline) {
    var seeds = [], seen = {}, vi, v, anchors, ai, x, y, p, occ;
    function pushSeed(plan) {
      if (!plan.length) return;
      if (!balancedPlan(plan, typeCount)) return;
      var sig = "", i;
      for (i = 0; i < plan.length; i++) sig += plan[i].v + "@" + plan[i].x + "," + plan[i].y + ";";
      if (seen[sig]) return;
      seen[sig] = true; seeds.push(plan);
    }

    // Một dải gọn là mô-típ lồng tổng quát, không phải luật riêng cho hình nào.
    // Khuôn dài thường cần một hàng hoàn chỉnh trước rồi các con ngược/nằm ngang
    // mới lồng được vào chỗ lõm của nó (cái muỗng vàng là một ví dụ).
    function pushStrip(vi, y) {
      if (typeCount !== 1) return;
      var vv = variants[vi], pitch = vv.wCells + Math.max(1, 2 * vv.padCells);
      var maxN = Math.min(40, Math.floor((rw + Math.max(1, 2 * vv.padCells)) / pitch));
      var n, left, plan, si, xx, stripOcc;
      for (n = maxN; n >= 2; n--) {
        left = Math.floor((rw - (vv.wCells + (n - 1) * pitch)) / 2);
        plan = []; stripOcc = buildOccupancyFor([], variants, rh);
        for (si = 0; si < n; si++) {
          xx = left + si * pitch;
          if (!insideAndClear(vv, xx, y, rw, rh, stripOcc, dots)) { plan = []; break; }
          occAdd(stripOcc, vv, xx, y);
          plan.push({ mi: vv.mi, v: vi, x: xx, y: y });
        }
        if (plan.length === n) { pushSeed(plan); break; }
      }
    }

    function makeStrip(vi, startX, startY, n, against) {
      var vv = variants[vi], pitch = vv.wCells + Math.max(1, 2 * vv.padCells);
      var plan = [], stripOcc = against ? buildOccupancyFor(against, variants, rh) : buildOccupancyFor([], variants, rh);
      var si, xx;
      for (si = 0; si < n; si++) {
        xx = startX + si * pitch;
        if (!insideAndClear(vv, xx, startY, rw, rh, stripOcc, dots)) return null;
        occAdd(stripOcc, vv, xx, startY);
        plan.push({ mi: vv.mi, v: vi, x: xx, y: startY });
      }
      return plan;
    }

    // Hai dải đối hướng là một "mô-típ lồng" tổng quát: nó chỉ
    // được tạo từ các phương án tiếp xúc đường bao thật, rồi kiểm chứng từng hàng một.
    // Khác với lưới chữ nhật, cách này chừa một hốc liền mạch cho một cặp
    // xoay ở trên/dưới hai dải.
    function pushTwinStrips() {
      if (typeCount !== 1) return;
      var twins = [], a, b, vv, oo, n, baseYs, baseXs, bx, by, base, cs, ci, c, second, joined;
      function oppositeOf(ix) {
        var want = (variants[ix].angle + 180) % 360, q;
        for (q = 0; q < variants.length; q++)
          if (variants[q].mi === variants[ix].mi && variants[q].angle === want) return q;
        return -1;
      }
      function retain(plan) {
        var rec = { plan: plan, score: planScore(plan, variants) }, q;
        twins.push(rec);
        twins.sort(function (u, w) { return u.score - w.score; });
        if (twins.length > 12) twins.pop();
      }
      for (a = 0; a < variants.length && now() < deadline; a++) {
        b = oppositeOf(a);
        if (b < 0 || a > b) continue;
        vv = variants[a]; oo = variants[b];
        if (vv.hCells < vv.wCells * 1.25) continue;
        n = Math.min(40, Math.floor((rw + Math.max(1, 2 * vv.padCells)) /
          (vv.wCells + Math.max(1, 2 * vv.padCells))));
        if (n < 3) continue;
        baseYs = [rh - vv.hCells, 0];
        var stripWidth = vv.wCells + (n - 1) * (vv.wCells + Math.max(1, 2 * vv.padCells));
        var spareX = rw - stripWidth;
        // Dải đối hướng lệch nửa bước lưới cần chỗ ở một bên của dải gốc.
        // Các pha một phần tư chừa được chỗ đó mà vẫn dời các hình tròn ở góc
        // ra xa PON; chỉ canh giữa riêng hàng gốc có thể làm dải đi kèm tràn ra ngoài.
        baseXs = [Math.floor(spareX / 4), Math.floor(3 * spareX / 4), Math.floor(spareX / 2), 0, spareX];
        for (bx = 0; bx < baseXs.length && now() < deadline; bx++)
        for (by = 0; by < baseYs.length && now() < deadline; by++) {
          base = makeStrip(a, baseXs[bx], baseYs[by], n, null);
          if (!base) continue;
          cs = candidatesFor(base, oo, variants, rw, rh);
          // Xếp hạng cả khối dải đối hướng theo độ gọn thay vì
          // vứt phần lớn các độ lệch tiếp xúc trước khi kiểm tra chúng.
          var baseBounds = planBounds(base, variants);
          cs.sort(function (u, w) {
            function area(p) {
              return (Math.max(baseBounds.x1, p.x + oo.wCells + (n - 1) * (oo.wCells + 2 * oo.padCells)) - Math.min(baseBounds.x0, p.x)) *
                (Math.max(baseBounds.y1, p.y + oo.hCells) - Math.min(baseBounds.y0, p.y));
            }
            return area(u) - area(w);
          });
          var baseOcc = buildOccupancyFor(base, variants, rh);
          for (ci = 0; ci < cs.length && now() < deadline; ci++) {
            c = cs[ci];
            second = [];
            var secondPitch = oo.wCells + Math.max(1, 2 * oo.padCells);
            for (var sk = 0; sk < n; sk++) {
              var sx = c.x + sk * secondPitch;
              // Các con cùng hướng xoay có bbox mở rộng rời nhau ở bước lưới
              // này. Dùng lại bảng chiếm chỗ của dải gốc thay vì dựng lại cho
              // từng tiếp xúc lõm có thể có.
              if (!insideAndClear(oo, sx, c.y, rw, rh, baseOcc, dots)) { second = null; break; }
              second.push({mi:oo.mi,v:b,x:sx,y:c.y});
            }
            if (!second) continue;
            joined = clonePlan(base);
            for (var sj = 0; sj < second.length; sj++) joined.push(second[sj]);
            retain(joined);
            // Thế lồng khả thi đầu tiên trong danh mục đã sắp là khối nhỏ nhất
            // tại điểm neo này. Các điểm neo/góc xoay khác cũng cần được chia thời gian.
            break;
          }
        }
      }
      for (a = 0; a < twins.length; a++) pushSeed(twins[a].plan);
    }

    pushTwinStrips();

    for (vi = 0; vi < variants.length; vi++) {
      v = variants[vi];
      pushStrip(vi, 0);
      pushStrip(vi, rh - v.hCells);
    }

    for (vi = 0; vi < variants.length; vi++) {
      v = variants[vi];
      // PON góc có thể chặn cả bốn điểm neo ở góc trong khi chính khuôn đó vẫn vừa
      // ở giữa. Giữ lại seed tất định, ít tốn kém đó cho mọi hướng.
      anchors = [[0, 0], [rw - v.wCells, 0], [0, rh - v.hCells], [rw - v.wCells, rh - v.hCells],
                 [Math.floor((rw - v.wCells) / 2), Math.floor((rh - v.hCells) / 2)]];
      for (ai = 0; ai < anchors.length; ai++) {
        x = anchors[ai][0]; y = anchors[ai][1];
        occ = buildOccupancyFor([], variants, rh);
        if (insideAndClear(v, x, y, rw, rh, occ, dots)) pushSeed([{ mi: v.mi, v: vi, x: x, y: y }]);
      }
    }

    // Thế lồng cặp tổng quát: không luật nào nhắc tới muỗng. Mỗi cặp hướng xoay đều
    // có cơ hội tạo cụm tiếp xúc hợp lệ nhỏ nhất trước bước mở rộng tham lam.
    var a, b, base, candidates, ci, candidate, pairOcc, candidateSeed, totalPairs = 0;
    var emptyPairOcc = buildOccupancyFor([], variants, rh);
    for (a = 0; a < variants.length && now() < deadline && totalPairs < 32; a++) {
      for (b = 0; b < variants.length && now() < deadline && totalPairs < 32; b++) {
        if (typeCount > 1 && variants[a].mi === variants[b].mi) continue;
        base = { mi: variants[a].mi, v: a, x: 0, y: 0 };
        // Khuôn đầu tiên của một cặp tiếp xúc là một vị trí đặt thật, không phải
        // điểm neo toạ độ tự do. Nó phải thoả các ràng buộc tờ/PON trước khi thử
        // con ghép cặp; nếu không, một khuôn ở góc không an toàn sẽ làm hỏng seed
        // thắng cuộc và khiến chốt chặn đường bao cuối từ chối một lượt dàn lẽ ra vẫn khả thi.
        if (!insideAndClear(variants[a], base.x, base.y, rw, rh, emptyPairOcc, dots)) continue;
        pairOcc = buildOccupancyFor([base], variants, rh);
        candidates = candidatesFor([base], variants[b], variants, rw, rh);
        candidates.sort(function (u, w) { return u.y - w.y || u.x - w.x; });
        for (ci = 0; ci < candidates.length && ci < 120; ci++) {
          candidate = candidates[ci];
          if (!insideAndClear(variants[b], candidate.x, candidate.y, rw, rh, pairOcc, dots)) continue;
          candidateSeed = [base, { mi: variants[b].mi, v: b, x: candidate.x, y: candidate.y }];
          pushSeed(candidateSeed); totalPairs++; break;
        }
      }
    }
    return seeds;
  }

  function pairProfilesClear(a, b, dx, dy) {
    var ib, ia, ra, rb, i, j;
    for (ib = Math.max(0, b.padCells - a.padCells - dy); ib < b.clearRows.length; ib++) {
      ia = ib + dy + a.padCells - b.padCells;
      if (ia >= a.clearRows.length) break;
      ra = a.clearRows[ia]; rb = b.clearRows[ib];
      for (i = 0; i < ra.length; i++) for (j = 0; j < rb.length; j++)
        if (ra[i][0] < rb[j][1] + dx && ra[i][1] > rb[j][0] + dx) return false;
    }
    return true;
  }

  // Tiếp xúc từ phía ngoài cho con kề bên phải, ở một độ lệch dọc cố định.
  // Khoảng cách do các đoạn scanline đã nở thật quyết định, không phải bề rộng bbox.
  // Biên ngoài thì an toàn với mọi đường bao (kể cả lỗ của compound).
  function rightProfileContact(a, b, dy) {
    var right = 0, ib, ia, ra, rb;
    for (ib = Math.max(0, b.padCells - a.padCells - dy); ib < b.clearRows.length; ib++) {
      ia = ib + dy + a.padCells - b.padCells;
      if (ia >= a.clearRows.length) break;
      ra = a.clearRows[ia]; rb = b.clearRows[ib];
      if (ra.length && rb.length)
        right = Math.max(right, ra[ra.length - 1][1] - rb[0][0]);
    }
    return Math.max(1, Math.ceil(right));
  }

  // Lặp A -> B -> A trong một hàng. Hai hướng đối nhau có thể dùng chung cạnh
  // xiên/chỗ lõm trong khung bao chữ nhật của chúng; mỗi cặp là một đơn vị tuần hoàn.
  // Bố cục nền cố định cho cả bốn hướng chạy trước các bước tinh chỉnh bị giới hạn thời gian,
  // nên máy đang bận cũng không thể bỏ sót cặp 90/270 hữu ích.
  function alternatingRowPlans(variants, typeCount, rw, rh, dots, deadline) {
    if (typeCount !== 1) return [];
    var out = [], ai, bi;
    function retain(plan) {
      if (!plan.length) return;
      out.push(plan);
      out.sort(function(u,w) { return -comparePlans(u,w,variants); });
      if (out.length > 8) out.pop();
    }
    function motif(first, second, dy, extraPhases) {
      var a = variants[first], b = variants[second];
      var ay = Math.max(0,-dy), by = Math.max(0,dy);
      var ab = rightProfileContact(a,b,dy), ba = rightProfileContact(b,a,-dy);
      var cycle = Math.max(ab+ba,rightProfileContact(a,a,0),rightProfileContact(b,b,0));
      var height = Math.max(ay+a.hCells,by+b.hCells);
      var rowPitch = height+Math.max(1,2*Math.max(a.padCells,b.padCells));
      if (height > rh || Math.min(a.wCells,b.wCells) > rw) return;
      var rows = Math.floor((rh-height)/rowPitch)+1;
      var spareY = rh-height-(rows-1)*rowPitch;
      function modulo(x) { return ((x % cycle)+cycle) % cycle; }
      var phasesX = [0,modulo(rw-a.wCells),modulo(rw-b.wCells-ab)];
      if (extraPhases) phasesX.push(Math.round(cycle/4),Math.round(cycle/2),Math.round(3*cycle/4));
      var phasesY = [0,Math.floor(spareY/2),spareY], xi, yi;
      for (xi=0;xi<phasesX.length;xi++) for (yi=0;yi<phasesY.length;yi++) {
        if (extraPhases && now() >= deadline) return;
        var plan=[],row,col,parts,part,x,y,v,visits=0;
        for (row=0;row<rows && visits<20000;row++) {
          for (col=-1;col<=Math.ceil(rw/cycle) && visits<20000;col++) {
            parts=[{v:first,x:phasesX[xi]+col*cycle,y:phasesY[yi]+row*rowPitch+ay},
                   {v:second,x:phasesX[xi]+col*cycle+ab,y:phasesY[yi]+row*rowPitch+by}];
            for(part=0;part<parts.length;part++) {
              visits++; v=variants[parts[part].v]; x=parts[part].x; y=parts[part].y;
              // Tiếp xúc AB/BA và chu kỳ cùng hướng đã tách sẵn
              // mọi cặp trong mô-típ tuần hoàn này; rowPitch tách các hàng.
              // Tránh dựng lại hàng nghìn đoạn chiếm chỗ cho mỗi pha với
              // khuôn bế rất nhỏ. Chốt chặn raster VÀ vật lý cuối cùng vẫn chạy.
              if(x<0 || y<0 || x+v.wCells>rw || y+v.hCells>rh || rawHitsPon(v,x,y,dots)) continue;
              plan.push({mi:v.mi,v:parts[part].v,x:x,y:y});
            }
          }
        }
        retain(plan);
      }
    }
    // Phần việc được bảo đảm chạy là hữu hạn: bốn cặp hướng xoay, mỗi cặp chín pha.
    // Không dựng toàn bộ danh mục no-fit, cũng không quét tuyến tính các bước hàng.
    for(ai=0;ai<variants.length;ai++) {
      bi=-1;
      for(var oi=0;oi<variants.length;oi++)
        if(variants[oi].mi===variants[ai].mi && variants[oi].angle===(variants[ai].angle+180)%360) { bi=oi; break; }
      if(bi>=0) motif(ai,bi,0,false);
    }
    for(ai=0;ai<variants.length && now()<deadline;ai++) {
      for(bi=0;bi<variants.length && now()<deadline;bi++) {
        if(ai===bi) continue;
        // Độ lệch một phần tư chiều cao tìm ra các hốc bất đối xứng mà không gắn cứng
        // công thức cho tam giác, muỗng hay silhouette của sản phẩm có tên nào.
        var quarter=Math.round(Math.min(variants[ai].hCells,variants[bi].hCells)/4);
        motif(ai,bi,0,true);
        if(quarter) { motif(ai,bi,quarter,true); motif(ai,bi,-quarter,true); }
      }
    }
    return out;
  }

  // Ghép các hàng khác hướng/khác pha, thay vì bắt cả tờ lặp một băng duy nhất.
  // Biên ngoài theo cột quyết định bước đi xuống; lỗ/lõm không làm phép thử
  // khoảng cách trở thành đơn điệu giả. Các phương án cơ sở hữu hạn chạy trước
  // beam có hạn giờ, nên một dải cuối xoay ngang không phụ thuộc tốc độ máy.
  function compositionalBandPlans(variants, typeCount, rw, rh, dots, gap, step, deadline) {
    if (typeCount !== 1 || !variants.length) return [];
    var minSide = Infinity, areaWork = 0, i, j;
    for (i=0;i<variants.length;i++) {
      minSide=Math.min(minSide,variants[i].wCells,variants[i].hCells);
      areaWork+=variants[i].wCells*variants[i].hCells;
    }
    // Đây là tìm kiếm tổ hợp cho số con vừa phải, không phải vòng nhân bản
    // hàng nghìn khuôn nhỏ. Các seed lưới cũ vẫn xử lý trường hợp đó.
    if (minSide<=0 || rw*rh/(minSide*minSide)>400 ||
        Math.ceil(rw/minSide)>40 || Math.ceil(rh/minSide)>16 || areaWork>2400000) return [];
    var local=[], columns=[], base=[], extra=[], pending=[], out=[];
    var contacts={}, rowContacts={}, nextId=0, maxDepth=Math.min(12,Math.ceil(rh/minSide));
    function columnEnvelope(v) {
      var c={top:[],bottom:[],offset:v.padCells}, r, s, x, spans, ix;
      for (r=0;r<v.clearRows.length;r++) {
        spans=v.clearRows[r];
        for (s=0;s<spans.length;s++) for(x=spans[s][0];x<spans[s][1];x++) {
          ix=x+c.offset;
          if (c.top[ix]===undefined) c.top[ix]=r-v.padCells;
          c.bottom[ix]=r-v.padCells+1;
        }
      }
      return c;
    }
    for(i=0;i<variants.length;i++) {
      // Một ô dự phòng chỉ phục vụ tìm seed; hình nguồn và khe yêu cầu không đổi.
      // Chốt kiểm tra vật lý phía dưới dùng chính variants và gap ban đầu.
      var original=variants[i], padGap=gap+Math.max(step,2*(original.curveErrorMm||0));
      var v=buildVariant(original.groups,original.mi,original.vi,0,padGap,step);
      if (!v) return [];
      v.angle=original.angle; local.push(v); columns.push(columnEnvelope(v));
    }
    function downContact(a,b,dx) {
      var key=a+":"+b+":"+dx, cached=contacts[key];
      if(cached!==undefined) return cached;
      var ca=columns[a], cb=columns[b], y=0, x, bx, top, bottom;
      for(x=0;x<ca.bottom.length;x++) {
        bottom=ca.bottom[x]; if(bottom===undefined) continue;
        bx=x-ca.offset-dx+cb.offset; top=cb.top[bx];
        if(top!==undefined) y=Math.max(y,bottom-top);
      }
      y=Math.max(1,Math.ceil(y)); contacts[key]=y; return y;
    }
    function rowContact(a,b) {
      var key=a.id+":"+b.id, cached=rowContacts[key];
      if(cached!==undefined) return cached;
      var y=1, ai, bi, pa, pb;
      for(ai=0;ai<a.parts.length;ai++) for(bi=0;bi<b.parts.length;bi++) {
        pa=a.parts[ai]; pb=b.parts[bi];
        y=Math.max(y,downContact(pa.v,pb.v,pb.x-pa.x));
      }
      rowContacts[key]=y; return y;
    }
    function template(first,second,shorten,phase,target) {
      var a=local[first], b=local[second], ab=rightProfileContact(a,b,0);
      var cycle=first===second ? ab : Math.max(ab+rightProfileContact(b,a,0),
        rightProfileContact(a,a,0),rightProfileContact(b,b,0));
      var parts=[], x=0, col, vv, width=0, height=0;
      for(col=0;col<40;col++) {
        x=col*cycle; if(x+a.wCells>rw) break;
        parts.push({v:first,x:x});
        if(first!==second && x+ab+b.wCells<=rw) parts.push({v:second,x:x+ab});
      }
      if(shorten && parts.length>1) parts.pop();
      if(!parts.length) return;
      for(col=0;col<parts.length;col++) {
        vv=local[parts[col].v]; width=Math.max(width,parts[col].x+vv.wCells);
        height=Math.max(height,vv.hCells);
      }
      var offset=phase===0 ? 0 : phase===2 ? rw-width : Math.floor((rw-width)/2);
      for(col=0;col<parts.length;col++) parts[col].x+=offset;
      target.push({id:nextId++,family:first+":"+second,parts:parts,height:height});
    }
    for(i=0;i<local.length;i++) {
      template(i,i,false,1,base);
      for(j=0;j<local.length;j++) if(local[j].angle===(local[i].angle+180)%360) {
        template(i,j,false,1,base); break;
      }
    }
    function append(rows,t) {
      var y=0, k;
      for(k=0;k<rows.length;k++) y=Math.max(y,rows[k].y+rowContact(rows[k].t,t));
      if(y+t.height>rh) return null;
      var added=rows.slice(0); added.push({t:t,y:y});
      added.height=Math.max(rows.height||0,y+t.height);
      added.total=(rows.total||0)+t.parts.length;
      return added;
    }
    function heightOf(rows) {
      if(rows.height!==undefined) return rows.height;
      var h=0, k;
      for(k=0;k<rows.length;k++) h=Math.max(h,rows[k].y+rows[k].t.height);
      return h;
    }
    function hitsPon(v,x,y) {
      var k, d, dx, dy;
      // Khung bao rời đĩa né PON thì đường bao bên trong chắc chắn cũng rời.
      // Chỉ các khung gần chấm mới cần quét đầy đủ scanline như trước.
      for(k=0;k<dots.length;k++) {
        d=dots[k]; dx=Math.max(x-d.x,d.x-x-v.wCells,0);
        dy=Math.max(y-d.y,d.y-y-v.hCells,0);
        if(dx*dx+dy*dy<d.radius*d.radius) return rawHitsPon(v,x,y,dots);
      }
      return false;
    }
    function materialize(rows,offset) {
      var plan=[], r, p, part, vv, x, y;
      for(r=0;r<rows.length;r++) for(p=0;p<rows[r].t.parts.length;p++) {
        part=rows[r].t.parts[p]; vv=variants[part.v]; x=part.x; y=rows[r].y+offset;
        if(x<0 || y<0 || x+vv.wCells>rw || y+vv.hCells>rh || hitsPon(vv,x,y)) continue;
        plan.push({mi:vv.mi,v:part.v,x:x,y:y});
      }
      return plan;
    }
    function retain(plan) {
      if(!plan.length) return;
      var k, p, equal, other, score, at;
      if(pending.length===12 && plan.length<pending[pending.length-1].plan.length) return;
      // Giữ nhiều phương án hình học khác nhau cho chốt vật lý, không chỉ một
      // seed thắng phép đếm raster nhưng có thể không đạt khe thật.
      for(k=0;k<pending.length;k++) if(pending[k].plan.length===plan.length) {
        other=pending[k].plan;
        equal=true;
        for(p=0;p<plan.length;p++) if(other[p].mi!==plan[p].mi ||
            other[p].v!==plan[p].v || other[p].x!==plan[p].x ||
            other[p].y!==plan[p].y) { equal=false; break; }
        if(equal) return;
      }
      // Cùng thứ tự comparePlans, nhưng mỗi score chỉ tính một lần, thay vì
      // quét lại toàn bộ các con trong mỗi lần sort của mọi stack trung gian.
      score=planScore(plan,variants); at=0;
      while(at<pending.length && (pending[at].plan.length>plan.length ||
          (pending[at].plan.length===plan.length && pending[at].score<=score))) at++;
      pending.splice(at,0,{plan:plan,score:score});
      if(pending.length>12) pending.pop();
    }
    function retainRows(rows) {
      if(!rows || !rows.length) return;
      // Chưa bỏ PON thì total đã là cận trên. Stack thấp hơn ngưỡng giữ lại
      // không thể thắng ở bất kỳ pha dọc nào: bỏ quét nhưng vẫn cho ghép tiếp.
      if(pending.length===12 && rows.total<pending[pending.length-1].plan.length) return;
      var spare=rh-heightOf(rows), phases=[0,Math.floor(spare/2),spare], k;
      for(k=0;k<phases.length;k++) retain(materialize(rows,phases[k]));
    }
    // Cơ sở tất định: một họ hàng đầy trước, rồi một họ khác lấp dải còn lại.
    // Thử mọi điểm chuyển và mọi hướng, không có số con/kích thước đặt sẵn.
    for(i=0;i<base.length;i++) {
      var prefix=[], depth, tail, candidate, tailDepth;
      for(depth=0;depth<maxDepth;depth++) {
        prefix=append(prefix,base[i]); if(!prefix) break;
        retainRows(prefix);
        for(j=0;j<base.length;j++) {
          tail=prefix;
          for(tailDepth=depth+1;tailDepth<maxDepth;tailDepth++) {
            candidate=append(tail,base[j]); if(!candidate) break;
            tail=candidate; retainRows(tail);
          }
        }
      }
    }
    // Beam bổ sung cho các hàng ngắn/so le và đổi hướng nhiều lần. Mỗi họ giữ
    // cả phương án nhiều con lẫn frontier thấp; không cắt tỉa chỉ theo số con.
    if(now()<deadline) {
      for(i=0;i<local.length;i++) for(var phase=0;phase<3;phase++) {
        template(i,i,false,phase,extra); template(i,i,true,phase,extra);
        for(j=0;j<local.length;j++) if(local[j].angle===(local[i].angle+180)%360) {
          template(i,j,false,phase,extra); template(i,j,true,phase,extra); break;
        }
      }
      var beam=[{rows:[],count:0,height:0,last:-1}], next, d, si, ti, state, rows, count, best;
      for(d=0;d<maxDepth && now()<deadline;d++) {
        next=[];
        for(si=0;si<beam.length && now()<deadline;si++) for(ti=0;ti<extra.length && now()<deadline;ti++) {
          state=beam[si]; rows=append(state.rows,extra[ti]); if(!rows) continue;
          count=materialize(rows,0).length;
          next.push({rows:rows,count:count,height:heightOf(rows),last:ti});
          retainRows(rows);
        }
        if(!next.length) break;
        next.sort(function(a,b) { return b.count-a.count || a.height-b.height; });
        beam=[]; best={};
        // Hai nhánh mỗi họ: nhiều con hữu ích nhất và chiều cao nhỏ nhất.
        for(si=0;si<next.length;si++) {
          state=next[si]; var family=extra[state.last].family;
          if(!best[family]) { best[family]={full:state,low:state}; }
          else if(state.height<best[family].low.height ||
              (state.height===best[family].low.height && state.count>best[family].low.count)) best[family].low=state;
        }
        for(si=0;si<extra.length;si++) {
          var entry=best[extra[si].family]; if(!entry || entry.used) continue;
          entry.used=true; beam.push(entry.full);
          if(entry.low!==entry.full) beam.push(entry.low);
        }
        if(beam.length>16) beam.length=16;
      }
    }
    // Không đưa seed cho nest() chỉ dựa vào hồ sơ rời rạc.
    // Kết quả đầu tiên đã kiểm chứng vẫn được giữ khi hết thời gian bổ sung.
    for(i=0;i<pending.length && (!out.length || now()<deadline);i++) {
      var verified=pending[i].plan;
      if(!verifyPlan(verified,variants,rw,rh,dots) ||
          !verifyGeometry(verified,variants,rw,rh,dots,gap,step)) continue;
      out.push(verified); if(out.length>=2) break;
    }
    return out;
  }

  // Hai hàng đối hướng tạo thành một băng lặp lại được. Độ lệch A->B và
  // bước quay về băng kế tiếp không cần bằng nhau: đường bao thật có thể lồng
  // sâu vào nhau theo một chiều nhưng cần bước quay về dài hơn theo chiều kia.
  function bandPlans(variants, typeCount, rw, rh, dots, gap, step, deadline) {
    if (typeCount !== 1) return [];
    var pending = [], out = [], ai, bi, si;
    function retain(plan) {
      if (!plan.length) return;
      pending.push(plan);
      pending.sort(function(u,w) { return -comparePlans(u,w,variants); });
      if (pending.length > 8) pending.pop();
    }
    function motif(first, second, shift, timed) {
      var a = variants[first], b = variants[second];
      var pad = 2 * Math.max(a.padCells,b.padCells);
      var pitch = Math.max(a.wCells,b.wCells) + pad;
      var limit = Math.max(a.hCells,b.hCells) + pad, dy, period;
      // Chỉ hai cột kề nhau mới có thể va chạm; các cột xa hơn có
      // khung bao mở rộng rời nhau ở bước lưới ngang này.
      for (dy = 0; dy <= limit; dy++) {
        if (timed && now() >= deadline) return;
        if (pairProfilesClear(a,b,shift,dy) &&
            pairProfilesClear(a,b,shift-pitch,dy)) break;
      }
      if (dy > limit) return;
      var height = Math.max(a.hCells,dy+b.hCells);
      if (height > rh || Math.min(a.wCells,b.wCells) > rw) return;
      // Các băng cách nhau hai bước phải có khung bao mở rộng rời nhau. Với các băng
      // kề nhau, thử mọi quan hệ đường bao A/A, B/B, A/B và B/A thay vì
      // áp một bước quay về bằng chiều cao bbox gây phí chỗ hay một khoảng cách hàng đồng đều.
      for (period = Math.ceil((height+pad)/2); period <= height+pad; period++) {
        if (timed && now() >= deadline) return;
        if (pairProfilesClear(a,a,0,period) && pairProfilesClear(b,b,0,period) &&
            pairProfilesClear(a,b,shift,period+dy) &&
            pairProfilesClear(a,b,shift-pitch,period+dy) &&
            pairProfilesClear(b,a,-shift,period-dy) &&
            pairProfilesClear(b,a,pitch-shift,period-dy)) break;
      }
      if (period > height+pad) return;
      var unitWidth = Math.max(a.wCells,shift+b.wCells);
      var columns = Math.max(1,Math.floor((rw-unitWidth)/pitch)+1);
      var rows = Math.floor((rh-height)/period)+1;
      var spareX = rw-unitWidth-(columns-1)*pitch;
      var spareY = rh-height-(rows-1)*period;
      var phasesX = [0,Math.floor(spareX/2),spareX];
      var phasesY = [0,Math.floor(spareY/2),spareY], xi, yi;
      for (xi=0;xi<phasesX.length;xi++) for (yi=0;yi<phasesY.length;yi++) {
        if (timed && now() >= deadline) return;
        var plan=[], row, col, part, parts, vv, x, y, visits=0;
        for (row=0;row<rows && visits<20000;row++) {
          for (col=-1;col<=Math.ceil(rw/pitch) && visits<20000;col++) {
            parts=[{v:first,x:phasesX[xi]+col*pitch,y:phasesY[yi]+row*period},
                   {v:second,x:phasesX[xi]+col*pitch+shift,y:phasesY[yi]+row*period+dy}];
            for (part=0;part<parts.length;part++) {
              visits++; vv=variants[parts[part].v]; x=parts[part].x; y=parts[part].y;
              if (x<0 || y<0 || x+vv.wCells>rw || y+vv.hCells>rh || rawHitsPon(vv,x,y,dots)) continue;
              plan.push({mi:vv.mi,v:parts[part].v,x:x,y:y});
            }
          }
        }
        retain(plan);
      }
    }
    // Bảo đảm có cặp đối hướng lệch nửa cột hữu ích cho mọi hướng trước
    // các bước tinh chỉnh pha có giới hạn. Không dùng tên hình, kích thước hay số con mong muốn.
    for (ai=0;ai<variants.length;ai++) {
      bi=-1;
      for (var oi=0;oi<variants.length;oi++)
        if (variants[oi].mi===variants[ai].mi &&
            variants[oi].angle===(variants[ai].angle+180)%360) { bi=oi; break; }
      if (bi<0 || sameGroups(variants[ai].groups,variants[bi].groups)) continue;
      var pitch=Math.max(variants[ai].wCells,variants[bi].wCells) +
        2*Math.max(variants[ai].padCells,variants[bi].padCells);
      motif(ai,bi,Math.round(pitch/2),false);
    }
    for (ai=0;ai<variants.length && now()<deadline;ai++) {
      bi=-1;
      for (var j=0;j<variants.length;j++)
        if (variants[j].mi===variants[ai].mi &&
            variants[j].angle===(variants[ai].angle+180)%360) { bi=j; break; }
      if (bi<0 || sameGroups(variants[ai].groups,variants[bi].groups)) continue;
      var extraPitch=Math.max(variants[ai].wCells,variants[bi].wCells) +
        2*Math.max(variants[ai].padCells,variants[bi].padCells);
      var shifts=[0,Math.round(extraPitch/4),Math.round(3*extraPitch/4)];
      for (si=0;si<shifts.length && now()<deadline;si++) motif(ai,bi,shifts[si],true);
    }
    // Kiểm chứng độc lập các phương án tốt nhất trước khi đưa ra bất kỳ seed nào.
    // Một bố cục nền đã kiểm chứng vẫn được giữ dù hết quỹ thời gian; phần kiểm chứng thêm
    // bị giới hạn trong phần thời gian còn lại, giữ tối đa hai băng.
    for (si=0;si<pending.length && (!out.length || now()<deadline);si++) {
      if (!verifyPlan(pending[si],variants,rw,rh,dots) ||
          !verifyGeometry(pending[si],variants,rw,rh,dots,gap,step)) continue;
      out.push(pending[si]);
      if (out.length>=2) break;
    }
    return out;
  }

  // Mô-típ lặp được đo trên chính các biên dạng thật. Độ so le
  // và bước hàng suy ra từ khoảng hở giữa các đường bao, không phải từ chiều cao
  // bbox. Nhờ đó có nhanh một bố cục khởi đầu dày cho hình lá, hình thoi và
  // các khuôn lặp khác trước khi bước tìm đặt tự do lấp các hốc còn lại
  // bằng bất kỳ góc xoay nào được phép.
  function latticePlans(variants, typeCount, rw, rh, dots, deadline) {
    if (typeCount !== 1) return [];
    var out = [], ai, bi, pitchX, shifts, si;
    function motif(first, second, shift) {
      var a = variants[first], b = variants[second];
      var pitch = Math.max(a.wCells, b.wCells) + Math.max(1, 2 * Math.max(a.padCells, b.padCells));
      var maxY = Math.max(a.hCells, b.hCells) + 2 * Math.max(a.padCells, b.padCells), py;
      for (py = 1; py <= maxY; py++) {
        if (pairProfilesClear(a, b, shift, py) && pairProfilesClear(a, b, shift - pitch, py) &&
            pairProfilesClear(b, a, -shift, py) && pairProfilesClear(b, a, pitch - shift, py) &&
            pairProfilesClear(a, a, 0, 2 * py) && pairProfilesClear(b, b, 0, 2 * py)) break;
      }
      if (py > maxY) return;
      var columns = Math.floor((rw - a.wCells) / pitch) + 1;
      var spareX = rw - (a.wCells + Math.max(0, columns - 1) * pitch);
      var rows = Math.floor((rh - Math.max(a.hCells, b.hCells)) / py) + 1;
      var spareY = rh - (Math.max(a.hCells, b.hCells) + Math.max(0, rows - 1) * py);
      var phasesX = [0, Math.floor(spareX / 2), spareX], phasesY = [0, Math.floor(spareY / 2), spareY], xi, yi;
      // Ở trên đã kiểm các hàng kề nhau tại cả hai cột lân cận có thể có.
      // Nếu các hàng cách nhau hai bước có bbox mở rộng rời nhau thì mọi hàng/cột
      // xa hơn cũng tách nhau ngay từ cách dựng. Các mô-típ lõm/có lỗ
      // có bước hai hàng ngắn hơn thì vẫn cần kiểm tra chiếm chỗ.
      var provenLattice = shift >= 0 && shift <= pitch &&
        2 * py >= Math.max(a.hCells, b.hCells) + 2 * Math.max(a.padCells, b.padCells);
      for (xi = 0; xi < phasesX.length; xi++) for (yi = 0; yi < phasesY.length; yi++) {
        var plan = [], occ = provenLattice ? null : buildOccupancyFor([], variants, rh), row, col, vx, yy, xx, vv;
        for (row = 0; row < rows; row++) {
          vx = row % 2 ? second : first; vv = variants[vx];
          yy = phasesY[yi] + row * py;
          // Mở rộng về cả hai phía để dịch pha không làm mất slot ở mép.
          for (col = -1; col <= columns; col++) {
            xx = phasesX[xi] + (row % 2 ? shift : 0) + col * pitch;
            if (provenLattice) {
              if (xx < 0 || yy < 0 || xx + vv.wCells > rw || yy + vv.hCells > rh || rawHitsPon(vv, xx, yy, dots)) continue;
            } else {
              if (!insideAndClear(vv, xx, yy, rw, rh, occ, dots)) continue;
              occAdd(occ, vv, xx, yy);
            }
            plan.push({mi:vv.mi,v:vx,x:xx,y:yy});
          }
        }
        if (plan.length) out.push(plan);
      }
    }
    // Hoàn tất một bố cục nền so le cho MỌI góc xoay được phép trước
    // các phần bổ sung chia theo thời gian. Trước đây góc xoay 0 tiêu hết phần thời gian cho nhiều
    // mô-típ, nên máy đang bận không bao giờ tới được các hàng hình lá 90 độ dày hơn.
    // Đây là bố cục nền cố định gồm bốn mô-típ, không phải phép tìm không giới hạn.
    for (ai = 0; ai < variants.length; ai++) {
      pitchX = variants[ai].wCells + Math.max(1, 2 * variants[ai].padCells);
      motif(ai, ai, Math.round(pitchX / 2));
    }
    // Cũng bảo đảm có các hướng đối nhau mà không phải chờ hết các phần bổ sung
    // phía trước. Đây là bản theo chiều dọc tương ứng với alternatingRowPlans.
    for (ai = 0; ai < variants.length; ai++) {
      for (bi = 0; bi < variants.length; bi++)
        if (variants[bi].angle === (variants[ai].angle + 180) % 360)
          motif(ai, bi, 0);
    }
    for (ai = 0; ai < variants.length && now() < deadline; ai++) {
      for (bi = 0; bi < variants.length && now() < deadline; bi++) {
        if (Math.abs(variants[ai].wCells - variants[bi].wCells) > 2 || Math.abs(variants[ai].hCells - variants[bi].hCells) > 2) continue;
        pitchX = Math.max(variants[ai].wCells, variants[bi].wCells) + Math.max(1, 2 * Math.max(variants[ai].padCells, variants[bi].padCells));
        shifts = [Math.round(pitchX / 2), 0, Math.round(pitchX / 4), Math.round(3 * pitchX / 4)];
        for (si = 0; si < shifts.length && now() < deadline; si++) {
          if (ai === bi && si === 0) continue;
          motif(ai, bi, shifts[si]);
        }
      }
    }
    out.sort(function (u, w) { return -comparePlans(u, w, variants); });
    return out.slice(0, 8);
  }

  // Các khuôn bế khác nhau không dùng lại được lưới một khuôn. Một bố cục nền kiểu xếp kệ
  // có giới hạn đem lại cho bước tìm silhouette tự do một khối khởi đầu cân bằng, thay vì
  // phải chờ các tiếp xúc tốn kém trước khi đặt được một hàng đầu hữu ích.
  // Đây chỉ là seed; tiếp xúc lõm vẫn là phép tìm tinh chỉnh thực sự.
  function mixedRowPlans(variants, typeCount, rw, rh, dots, deadline) {
    if (typeCount <= 1) return [];
    var lookup = [], spacing = 1, vi, mi, phase, alternate, start, out = [];
    for (vi = 0; vi < variants.length; vi++) {
      if (!lookup[variants[vi].mi]) lookup[variants[vi].mi] = [];
      lookup[variants[vi].mi][variants[vi].vi] = vi;
      spacing = Math.max(spacing, 2 * variants[vi].padCells);
    }
    for (phase = 0; phase < 4 && now() < deadline; phase++)
    for (alternate = 0; alternate < 2 && now() < deadline; alternate++)
    for (start = 0; start < Math.min(typeCount, 2) && now() < deadline; start++) {
      var plan = [], occ = buildOccupancyFor([], variants, rh);
      var x = 0, y = 0, rowHeight = 0, row = 0, guard = 0;
      while (plan.length < 220 && guard++ < 2000 && now() < deadline) {
        mi = (start + plan.length) % typeCount;
        var want = (phase + (alternate && row % 2 ? 2 : 0)) % 4;
        var chosen = -1, tryRotation, ix, v;
        for (tryRotation = 0; tryRotation < 4; tryRotation++) {
          ix = lookup[mi][(want + tryRotation) % 4]; v = variants[ix];
          if (v && v.wCells <= rw && y + v.hCells <= rh) { chosen = ix; break; }
        }
        if (chosen < 0) break;
        v = variants[chosen];
        if (x + v.wCells > rw) {
          x = 0; y += rowHeight + spacing; rowHeight = 0; row++;
          continue;
        }
        rowHeight = Math.max(rowHeight, v.hCells);
        if (!insideAndClear(v, x, y, rw, rh, occ, dots)) {
          // Nhích qua PON góc một bước có giới hạn, không nhảy cả một khuôn bế.
          x += spacing;
          continue;
        }
        plan.push({mi:mi,v:chosen,x:x,y:y}); occAdd(occ, v, x, y);
        x += v.wCells + spacing;
      }
      if (plan.length && balancedPlan(plan, typeCount)) out.push(plan);
    }
    return out;
  }

  function centrePlan(plan, variants, rw, rh, dots) {
    if (!plan.length) return plan;
    var b = planBounds(plan, variants);
    var wantX = Math.round((rw - (b.x1 - b.x0)) / 2 - b.x0);
    var wantY = Math.round((rh - (b.y1 - b.y0)) / 2 - b.y0);
    var tries = [[wantX, wantY]], r, dx, dy;
    for (r = 1; r <= 14; r++) {
      dx = r; dy = 0;
      tries.push([wantX - dx, wantY], [wantX + dx, wantY], [wantX, wantY - dx], [wantX, wantY + dx]);
    }
    var ti, tx, ty, ok, i, s, v;
    for (ti = 0; ti < tries.length; ti++) {
      tx = tries[ti][0]; ty = tries[ti][1]; ok = true;
      for (i = 0; i < plan.length && ok; i++) {
        s = plan[i]; v = variants[s.v];
        if (s.x + tx < 0 || s.y + ty < 0 || s.x + tx + v.wCells > rw || s.y + ty + v.hCells > rh || rawHitsPon(v, s.x + tx, s.y + ty, dots)) ok = false;
      }
      if (ok) {
        var out = clonePlan(plan);
        for (i = 0; i < out.length; i++) { out[i].x += tx; out[i].y += ty; }
        return out;
      }
    }
    return plan;
  }

  function edgeMargin(plan, variants, rw, rh) {
    if (!plan.length) return 0;
    var b = planBounds(plan, variants);
    return Math.min(b.x0, b.y0, rw - b.x1, rh - b.y1);
  }

  function physicalPlanBounds(plan, variants, step) {
    var b = {x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity}, i, s, v;
    for (i = 0; i < plan.length; i++) {
      s = plan[i]; v = variants[s.v];
      b.x0 = Math.min(b.x0, s.x); b.y0 = Math.min(b.y0, s.y);
      b.x1 = Math.max(b.x1, s.x + v.w / step);
      b.y1 = Math.max(b.y1, s.y + v.h / step);
    }
    return b;
  }

  // Phép tịnh tiến cuối cùng, chỉ áp vào đầu ra. Tìm kiếm/chiếm chỗ phải giữ ô nguyên,
  // nhưng canh giữa dùng đường bao vật lý và khổ giấy đầy đủ (chưa làm tròn).
  // Dời cả khối thì giữ nguyên mọi khoảng cách giữa các khuôn bế. Chỉ
  // khoảng hở với tờ/PON có thể đổi; chốt chặn vật lý đầy đủ vẫn chạy sau đó.
  function centrePhysicalPlan(plan, variants, rw, rh, dots, gap, step) {
    if (!plan.length) return plan;
    var b = physicalPlanBounds(plan, variants, step);
    var wantX = (rw - b.x0 - b.x1) / 2, wantY = (rh - b.y0 - b.y1) / 2;
    function safeMove(tx, ty) {
      var i, s, v, x, y, di, dot, p, r, dx, dy, gi, ci, pi, contour;
      if (b.x0 + tx < -1e-8 || b.y0 + ty < -1e-8 ||
          b.x1 + tx > rw + 1e-8 || b.y1 + ty > rh + 1e-8) return false;
      for (i = 0; i < plan.length; i++) {
        s = plan[i]; v = variants[s.v]; x = (s.x + tx) * step; y = (s.y + ty) * step;
        for (di = 0; di < dots.length; di++) {
          dot = dots[di]; p = [dot.x * step - x, dot.y * step - y];
          r = Math.max(0, dot.radius * step + (v.curveErrorMm || 0) - 0.001);
          dx = Math.max(-p[0], p[0] - v.w, 0);
          dy = Math.max(-p[1], p[1] - v.h, 0);
          if (dx * dx + dy * dy >= r * r) continue;
          if (insideGroups(p, v.groups)) return false;
          for (gi = 0; gi < v.groups.length; gi++) for (ci = 0; ci < v.groups[gi].length; ci++) {
            contour = v.groups[gi][ci];
            for (pi = 0; pi < contour.length; pi++)
              if (pointSegmentDistanceSq(p, contour[pi], contour[(pi + 1) % contour.length]) < r * r) return false;
          }
        }
      }
      return true;
    }
    function moved(tx, ty) {
      var out = clonePlan(plan), i;
      for (i = 0; i < out.length; i++) { out[i].x += tx; out[i].y += ty; }
      return out;
    }
    if (safeMove(wantX, wantY)) return moved(wantX, wantY);
    // Người dùng có thể đặt PON không đối xứng. Đừng bỏ bớt/co giãn khuôn bế chỉ để
    // ép canh giữa: thay vào đó giữ phép tịnh tiến nguyên khối an toàn gần nhất tìm được.
    var tries = [[0,0],[wantX,0],[0,wantY]], r, ti, tx, ty, score;
    for (r = 1; r <= 14; r++)
      tries.push([wantX-r,wantY],[wantX+r,wantY],[wantX,wantY-r],[wantX,wantY+r],
        [wantX-r,wantY-r],[wantX+r,wantY-r],[wantX-r,wantY+r],[wantX+r,wantY+r]);
    var bestX = 0, bestY = 0, found = safeMove(0,0);
    var bestScore = found ? sq(wantX) + sq(wantY) : Infinity;
    for (ti = 0; ti < tries.length; ti++) {
      tx = tries[ti][0]; ty = tries[ti][1]; score = sq(tx-wantX) + sq(ty-wantY);
      if (score >= bestScore - 1e-10 || !safeMove(tx,ty)) continue;
      bestX = tx; bestY = ty; bestScore = score; found = true;
    }
    if (!found) return plan; // Chốt chặn vật lý cuối sẽ loại phương án dự phòng không an toàn.
    // Tiến dần tới vị trí lý tưởng đang bị chặn từ phương án đã kiểm chứng, không bao giờ
    // nhận một vị trí trung gian không an toàn. Không xếp lại theo từng cặp.
    var low = 0, high = 1, mid, baseX = bestX, baseY = bestY;
    for (ti = 0; ti < 20; ti++) {
      mid = (low + high) / 2;
      tx = baseX + (wantX - baseX) * mid; ty = baseY + (wantY - baseY) * mid;
      if (safeMove(tx,ty)) { low = mid; bestX = tx; bestY = ty; } else high = mid;
    }
    return moved(bestX,bestY);
  }

  // Khe lưới đúng số nhập có thể thiếu cận sai số rất nhỏ của đường cong.
  // Mở riêng vị trí đặt, giữ nguyên khuôn, rồi kẹp tịnh tiến vào miền lề hợp lệ.
  // Không đưa một khối vượt lề vào canh tâm và hy vọng nó tự phục hồi.
  function openPhysicalGapPlan(plan, variants, rw, rh, dots, gap, step) {
    if (plan.length < 2) return plan;
    var xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity, i, axis;
    for (i = 0; i < plan.length; i++) {
      xLo = Math.min(xLo,plan[i].x); xHi = Math.max(xHi,plan[i].x);
      yLo = Math.min(yLo,plan[i].y); yHi = Math.max(yHi,plan[i].y);
    }
    var cx = (xLo+xHi)/2, cy = (yLo+yHi)/2;
    var maxShiftMm = Math.max(step,0.001);
    for (var shiftMm = 0.001; shiftMm <= maxShiftMm + 1e-9;
      shiftMm = shiftMm < maxShiftMm ? Math.min(maxShiftMm,shiftMm*2) : maxShiftMm+1) {
      for (axis = 0; axis < 3; axis++) {
        var trial = clonePlan(plan);
        var fx = axis !== 2 && xHi > xLo ? 1+2*shiftMm/((xHi-xLo)*step) : 1;
        var fy = axis !== 1 && yHi > yLo ? 1+2*shiftMm/((yHi-yLo)*step) : 1;
        for (i = 0; i < trial.length; i++) {
          trial[i].x = cx+(plan[i].x-cx)*fx;
          trial[i].y = cy+(plan[i].y-cy)*fy;
        }
        var b = physicalPlanBounds(trial,variants,step);
        if (b.x1-b.x0 > rw+1e-8 || b.y1-b.y0 > rh+1e-8) continue;
        var tx = Math.max(-b.x0,Math.min(0,rw-b.x1));
        var ty = Math.max(-b.y0,Math.min(0,rh-b.y1));
        for (i = 0; i < trial.length; i++) { trial[i].x += tx; trial[i].y += ty; }
        if (verifyGeometry(trial,variants,rw,rh,dots,gap,step)) return trial;
        trial = centrePhysicalPlan(trial,variants,rw,rh,dots,gap,step);
        if (verifyGeometry(trial,variants,rw,rh,dots,gap,step)) return trial;
      }
    }
    return plan; // Không nới chốt chặn; nếu không phục hồi được, tìm lại phương án thận trọng.
  }

  // Phép tìm vẫn chạy trên các lát ô nguyên thận trọng. Với mọi khe đã nhập,
  // khử khoảng cách số học của chúng ở đầu ra bằng cách co VỊ TRÍ lại,
  // không bao giờ co hình học của khuôn bế/bài. Mỗi lần thử được nhận đều được
  // kiểm tra liên tục một cách độc lập; cho phép chạm biên, không cho chồng lấn vùng tô.
  // Co chung theo một trục sẽ khép các tiếp xúc lặp lại cùng một lúc thay vì
  // phải dời đi dời lại hàng nghìn object riêng lẻ trong Illustrator.
  function closePhysicalGapPlan(plan, variants, rw, rh, dots, gap, step, deadline) {
    if (plan.length < 2) return plan;
    var best = clonePlan(plan), pass, axis, i, low, high, mid, trial, curveError = 0;
    for (i = 0; i < variants.length; i++) curveError = Math.max(curveError,variants[i].curveErrorMm || 0);
    // Không để sai số kiểm tra 0,001 mm bị trừ vào khe dương đã nhập.
    // Đường cong đã có dự phòng sai số riêng trong verifyGeometry.
    var guardGap = gap > 0 && !curveError ? gap + 0.001 : gap;
    function contracted(base, coordinate, factor) {
      var lo = Infinity, hi = -Infinity, out = clonePlan(base), k;
      for (k = 0; k < base.length; k++) {
        lo = Math.min(lo,base[k][coordinate]); hi = Math.max(hi,base[k][coordinate]);
      }
      var centre = (lo+hi)/2;
      for (k = 0; k < out.length; k++)
        out[k][coordinate] = centre+(base[k][coordinate]-centre)*factor;
      return out;
    }
    function closed(base, coordinate, required) {
      function at(factor) {
        var out = contracted(base,coordinate === "both" ? "x" : coordinate,factor);
        return coordinate === "both" ? contracted(out,"y",factor) : out;
      }
      var xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity, k;
      for (k = 0; k < base.length; k++) {
        xLo = Math.min(xLo,base[k].x); xHi = Math.max(xHi,base[k].x);
        yLo = Math.min(yLo,base[k].y); yHi = Math.max(yHi,base[k].y);
      }
      var spanMm = (coordinate === "both" ? Math.max(xHi-xLo,yHi-yLo) :
        coordinate === "x" ? xHi-xLo : yHi-yLo) * step;
      if (spanMm <= 0.00005) return base;
      // Trục đã chạm khe thật thì không cần thử lại hàng chục phép kiểm tra.
      trial = at(Math.max(0,1-0.00005/spanMm));
      if (!verifyGeometry(trial,variants,rw,rh,[],guardGap,step)) return base;
      var kept = verifyGeometry(trial,variants,rw,rh,dots,guardGap,step) ? trial : base;
      trial = at(0);
      if (verifyGeometry(trial,variants,rw,rh,dots,guardGap,step)) return trial;
      low = 0; high = 1;
      for (i = 0; i < 24 && (high-low)*spanMm > 0.00005 && (required || now() < deadline); i++) {
        mid = (low+high)/2; trial = at(mid);
        if (verifyGeometry(trial,variants,rw,rh,dots,guardGap,step)) {
          high = mid; kept = trial;
        } else low = mid;
      }
      return kept;
    }
    if (!verifyGeometry(best,variants,rw,rh,dots,guardGap,step)) {
      if (gap > 0) best = openPhysicalGapPlan(best,variants,rw,rh,dots,guardGap,step);
      if (!verifyGeometry(best,variants,rw,rh,dots,guardGap,step)) return plan;
    }
    // Khép đồng đều trước để khe cùng cột/hàng cũng đúng. Nếu khép riêng X
    // ngay từ đầu, khe chéo có thể chặn Y trong khi khe cột còn dư 0,25 mm.
    // Tờ thông thường phải khép xong ba bước chính, không bỏ dở do lát thời gian
    // tìm kiếm ngắn. Với hàng nghìn con, giữ ngân sách để kiểm tra vẫn hữu hạn.
    var required = gap > 0 && plan.length <= 400;
    if (gap > 0 && (required || now() < deadline)) best = closed(best,"both",required);
    for (pass = 0; pass < 2; pass++) for (axis = 0; axis < 2; axis++) {
      if (!(required && pass === 0) && now() >= deadline) return best;
      best = closed(best,axis ? "y" : "x",required && pass === 0);
    }
    return best;
  }

  // Tinh chỉnh giữ nguyên số con cho một cặp song song nằm sát mép tờ. Thử
  // từng hướng gốc và phép xoay 180 độ thật của nó, không bao giờ lật đối xứng.
  // Việc này có thể lồng cặp đó sâu hơn vào khối còn lại và tạo
  // chỗ để canh giữa cả bố cục, cách xa hơn cả hai mép đối diện.
  function polishEdges(plan, variants, rw, rh, dots, gap, step, deadline) {
    if (plan.length < 2 || plan.length > 80) return plan;
    var picked = -1, mate = -1, shortDistance = Infinity, useY = true, towardLow = true;
    var i, s, v, dist, axisY, low, high;
    for (i = 0; i < plan.length; i++) {
      s = plan[i]; v = variants[s.v];
      if (Math.max(v.wCells, v.hCells) < 1.3 * Math.min(v.wCells, v.hCells)) continue;
      axisY = v.wCells >= v.hCells;
      low = axisY ? s.y : s.x;
      high = axisY ? rh - s.y - v.hCells : rw - s.x - v.wCells;
      dist = Math.min(low, high);
      if (dist < shortDistance) {
        picked = i; shortDistance = dist; useY = axisY; towardLow = low <= high;
      }
    }
    if (picked < 0) return plan;
    var first = plan[picked], fv = variants[first.v], nearest = Infinity;
    for (i = 0; i < plan.length; i++) {
      if (i === picked || plan[i].mi !== first.mi) continue;
      s = plan[i]; v = variants[s.v];
      if (abs(v.wCells - fv.wCells) > 1 || abs(v.hCells - fv.hCells) > 1) continue;
      dist = sq(s.x + v.wCells / 2 - first.x - fv.wCells / 2) +
        sq(s.y + v.hCells / 2 - first.y - fv.hCells / 2);
      if (dist < nearest) { mate = i; nearest = dist; }
    }
    if (mate < 0) return plan;
    var second = plan[mate], base = [], aVariants = [], bVariants = [];
    for (i = 0; i < plan.length; i++) if (i !== picked && i !== mate) base.push(plan[i]);
    function headings(slot, out) {
      var current = variants[slot.v], opposite = (current.angle + 180) % 360, j;
      for (j = 0; j < variants.length; j++) if (variants[j].mi === slot.mi && variants[j].angle === opposite) out.push(j);
      out.push(slot.v);
    }
    headings(first, aVariants); headings(second, bVariants);
    function candidates(seed, vi, occ, cap) {
      var vv = variants[vi], all = candidatesFor(seed, vv, variants, rw, rh), good = [], j;
      for (j = 0; j < all.length; j++) if (insideAndClear(vv, all[j].x, all[j].y, rw, rh, occ, dots)) good.push(all[j]);
      good.sort(function (a, b) {
        var primary = useY ? a.y - b.y : a.x - b.x;
        if (towardLow) primary = -primary;
        return primary || (useY ? a.x - b.x : a.y - b.y);
      });
      var sampled = [], separation = Math.max(4, Math.round(Math.min(vv.wCells, vv.hCells) / 8)), k, distinct;
      for (j = 0; j < good.length && sampled.length < cap; j++) {
        distinct = true;
        for (k = 0; k < sampled.length; k++) if (abs(good[j].x - sampled[k].x) < separation && abs(good[j].y - sampled[k].y) < separation) { distinct = false; break; }
        if (distinct) sampled.push(good[j]);
      }
      return sampled;
    }
    var best = plan, bestEdge = edgeMargin(plan, variants, rw, rh), baseOcc = buildOccupancyFor(base, variants, rh);
    var av, bv, ai, bi, aa, bb, ca, cb, once, occ, trial, trialEdge;
    for (av = 0; av < aVariants.length && (av === 0 || now() < deadline); av++) {
      aa = aVariants[av]; ca = candidates(base, aa, baseOcc, 4);
      for (ai = 0; ai < ca.length && ((av === 0 && ai < 2) || now() < deadline); ai++) {
        once = clonePlan(base); once.push({mi:first.mi,v:aa,x:ca[ai].x,y:ca[ai].y});
        occ = buildOccupancyFor(once, variants, rh);
        for (bv = 0; bv < bVariants.length; bv++) {
          bb = bVariants[bv]; cb = candidates(once, bb, occ, 4);
          for (bi = 0; bi < cb.length; bi++) {
            trial = clonePlan(once); trial.push({mi:second.mi,v:bb,x:cb[bi].x,y:cb[bi].y});
            trial = centrePlan(trial, variants, rw, rh, dots); trialEdge = edgeMargin(trial, variants, rw, rh);
            if (trialEdge <= bestEdge) continue;
            if (!verifyGeometry(trial, variants, rw, rh, dots, gap, step)) continue;
            best = trial; bestEdge = trialEdge;
          }
        }
      }
    }
    return best;
  }

  function repairPlans(best, variants, typeCount, rw, rh, dots, deadline) {
    var current = best, passes = 0, i, seed, trial;
    while (current && passes++ < 12 && now() < deadline) {
      var improved = false;
      // Gỡ một con gần đường viền ngoài, rồi để mọi hướng xoay
      // lấp lại vùng đó. Cố ý có giới hạn: không để cây beam search bùng nổ.
      var start = Math.max(0, current.length - 12);
      for (i = start; i < current.length && now() < deadline; i++) {
        seed = clonePlan(current); seed.splice(i, 1);
        trial = growPlan(seed, variants, typeCount, rw, rh, dots, deadline);
        if (balancedPlan(trial, typeCount) && comparePlans(trial, current, variants) > 0) { current = trial; improved = true; break; }
      }
      if (!improved) break;
    }
    return current;
  }

  function circleLike(groups) {
    if (!groups || groups.length !== 1 || groups[0].length !== 1) return null;
    var c = groups[0][0], b = boundsOfGroups(groups), cx, cy, r, lo = Infinity, hi = 0, i, d;
    if (!b || abs(b.w - b.h) > 0.12) return null;
    cx = b.x0 + b.w / 2; cy = b.y0 + b.h / 2;
    for (i = 0; i < c.length; i++) {
      d = Math.sqrt(sq(c[i][0] - cx) + sq(c[i][1] - cy));
      if (d < lo) lo = d; if (d > hi) hi = d;
      // Nếu chỉ xét các đỉnh cách đều tâm thì sẽ nhận nhầm hình vuông và
      // hình thoi là hình tròn. Các cạnh của chúng cũng phải bám theo đường bao tròn.
      var next = c[(i + 1) % c.length];
      d = Math.sqrt(sq((c[i][0] + next[0]) / 2 - cx) + sq((c[i][1] + next[1]) / 2 - cy));
      if (d < lo) lo = d; if (d > hi) hi = d;
    }
    r = (lo + hi) / 2;
    if (!r || hi - lo > Math.max(0.12, r * 0.025)) return null;
    // Ellipse bốn đoạn cubic của Illustrator hơi phình ra ngoài đường tròn lý tưởng
    // ở giữa các điểm neo bốn hướng chính. Dùng bán kính bao của chính
    // đường bao đã flatten, không dùng width / 2, để có khoảng cách lưới giải tích an toàn.
    return { diameter: b.w, radius: hi, cx: cx, cy: cy };
  }

  function circlePlan(v, rw, rh, dots, gap, deadline) {
    // Lưới lục giác động. Nó thử pha theo khe, lề và PON hiện tại;
    // không phải bảng toạ độ tĩnh mượn từ DECAL_SETS.
    var dia = Math.max(v.wCells, v.hCells), profile = circleLike(v.groups);
    var radius = (profile ? profile.radius / v.step : dia / 2) + (v.curveErrorMm || 0) / v.step;
    var centreX = profile ? profile.cx / v.step : dia / 2;
    var centreY = profile ? profile.cy / v.step : v.hCells / 2;
    // Làm tròn khoảng cách ra ngoài, không bao giờ vào trong. Nếu không, khe lẻ như
    // 1.1 mm do người dùng nhập từng sinh ra lưới không an toàn, bị bước kiểm tra cuối từ chối.
    var pitchX = Math.max(gap === 0 ? dia : dia + 1, Math.ceil(2 * radius + gap / v.step - 1e-7));
    var cols = Math.floor((rw - dia) / pitchX) + 1;
    var spareX = rw - (dia + (cols - 1) * pitchX);
    var maxShift = Math.max(0, Math.min(Math.floor(pitchX / 2), spareX));
    var best = null, shiftStep = Math.max(1, Math.floor(Math.max(1, maxShift) / 12));
    var shift, pitchY, rows, spareY, xPhases, yPhases, xi, yi, px, py, row, col, x, y, plan;
    // Lượt quét thô vẫn phải gồm pha nửa bước lưới cuối cùng: bỏ
    // điểm cuối đó có thể làm mất cả một cột so le trên tờ chật.
    for (shift = 0; shift <= maxShift && now() < deadline;
         shift = shift < maxShift ? Math.min(maxShift, shift + shiftStep) : maxShift + 1) {
      pitchY = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, pitchX * pitchX - shift * shift))));
      rows = Math.floor((rh - dia) / pitchY) + 1;
      spareY = rh - (dia + (rows - 1) * pitchY);
      // Cả hàng chẵn lẫn hàng lẻ đều phải nằm trong hình chữ nhật in được. Ta xét
      // ba pha tất định thay vì mọi ô lưới: mọi pha hữu ích của
      // hình tròn đều bị giới hạn bởi dải còn dư sau một hàng đầy.
      xPhases = [0, Math.floor((spareX - shift) / 2), spareX - shift];
      yPhases = [0, Math.floor(spareY / 2), spareY];
      for (xi = 0; xi < xPhases.length && now() < deadline; xi++) {
        px = xPhases[xi];
        if (px < 0) continue;
        for (yi = 0; yi < yPhases.length && now() < deadline; yi++) {
          py = yPhases[yi]; plan = [];
          for (row = 0; row < rows; row++) {
            y = py + row * pitchY;
            var rowShift = (row % 2) ? shift : 0;
            for (col = 0; col < cols; col++) {
              x = px + rowShift + col * pitchX;
              if (x < 0 || x + dia > rw || y < 0 || y + dia > rh) continue;
              // Khoảng cách đã được lưới bảo đảm bằng giải tích. Ở đây thử với PON
              // theo kiểu hai hình tròn thay vì dùng các ô raster thận trọng,
              // nếu không một khe 1 mm hợp lệ có thể bị làm tròn lên rồi mất.
              var safe = true, di, ddx, ddy, minD;
              for (di = 0; di < dots.length; di++) {
                ddx = x + centreX - dots[di].x;
                ddy = y + centreY - dots[di].y;
                minD = radius + dots[di].radius;
                if (ddx * ddx + ddy * ddy < minD * minD - 1e-6) { safe = false; break; }
              }
              if (safe) plan.push({ mi: 0, v: 0, x: x, y: y });
            }
          }
          if (comparePlans(plan, best, [v]) > 0) best = plan;
        }
      }
    }
    return best || [];
  }

  function verifyPlan(plan, variants, rw, rh, dots) {
    var occ = buildOccupancyFor([], variants, rh), i, s, v;
    for (i = 0; i < plan.length; i++) {
      s = plan[i]; v = variants[s.v];
      if (!insideAndClear(v, s.x, s.y, rw, rh, occ, dots)) return false;
      occAdd(occ, v, s.x, s.y);
    }
    return true;
  }

  function verifyCirclePlan(plan, v, rw, rh, dots, gapCells) {
    var i, j, a, b, dx, dy, minD, di;
    var profile = circleLike(v.groups), radius = profile ? profile.radius / v.step : v.wCells / 2;
    var centreX = profile ? profile.cx / v.step : v.wCells / 2;
    var centreY = profile ? profile.cy / v.step : v.hCells / 2;
    var spacing = 2 * radius + gapCells, index = spatialIndex(Math.max(1, spacing));
    for (i = 0; i < plan.length; i++) {
      a = plan[i];
      if (a.x < 0 || a.y < 0 || a.x + v.wCells > rw || a.y + v.hCells > rh) return false;
      for (di = 0; di < dots.length; di++) {
        dx = a.x + centreX - dots[di].x;
        dy = a.y + centreY - dots[di].y;
        minD = radius + dots[di].radius;
        if (dx * dx + dy * dy < minD * minD - 1e-6) return false;
      }
      // Chỉ những tâm nằm trong khoảng cách yêu cầu mới có thể va chạm. Giữ phép
      // kiểm tra khoảng cách chính xác, nhưng tránh khối lượng O(n^2) trên hàng nghìn khuôn nhỏ.
      var near = spatialNear(index, {x0:a.x-spacing,x1:a.x+spacing,y0:a.y-spacing,y1:a.y+spacing});
      for (j = 0; j < near.length; j++) {
        b = plan[near[j]]; dx = a.x - b.x; dy = a.y - b.y;
        // Khớp với sai số vụn do quy đổi (nhỏ hơn một ô) mà phép làm tròn lưới ra ngoài
        // đã bỏ qua. Chốt chặn đường bao độc lập theo milimet vẫn là quyết định cuối.
        minD = Math.max(0, spacing - 1e-7);
        if (dx * dx + dy * dy < minD * minD - 1e-6) return false;
      }
      spatialAdd(index, i, {x0:a.x,x1:a.x,y0:a.y,y1:a.y});
    }
    return true;
  }

  function pointSegmentDistanceSq(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
    var t = den ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den, 0, 1) : 0;
    return sq(p[0] - a[0] - t * dx) + sq(p[1] - a[1] - t * dy);
  }

  function segmentsCross(a, b, c, d) {
    function cross(p, q, r) { return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); }
    var x = cross(a, b, c), y = cross(a, b, d), u = cross(c, d, a), w = cross(c, d, b);
    return ((x > 1e-9 && y < -1e-9) || (x < -1e-9 && y > 1e-9)) &&
      ((u > 1e-9 && w < -1e-9) || (u < -1e-9 && w > 1e-9));
  }

  function insideGroups(p, groups) {
    var gi, ci, i, a, b, inside;
    for (gi = 0; gi < groups.length; gi++) {
      inside = false;
      for (ci = 0; ci < groups[gi].length; ci++) {
        var contour = groups[gi][ci];
        for (i = 0; i < contour.length; i++) {
          a = contour[i]; b = contour[(i + 1) % contour.length];
          if ((a[1] > p[1]) !== (b[1] > p[1]) &&
              p[0] < a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) inside = !inside;
        }
      }
      if (inside) return true;
    }
    return false;
  }

  // Chạm biên không phải là chồng lấn vùng tô. Phân loại từng compound theo
  // luật tô even/odd rồi hợp các compound lại: việc nằm trên biên của một group
  // không được che mất việc điểm đó nằm hẳn bên trong một group khác.
  function strictInsideGroups(p, groups) {
    var gi, ci, pi, contour, a, b, inside, boundary;
    for (gi = 0; gi < groups.length; gi++) {
      inside = false; boundary = false;
      for (ci = 0; ci < groups[gi].length; ci++) {
        contour = groups[gi][ci];
        for (pi = 0; pi < contour.length; pi++) {
          a = contour[pi]; b = contour[(pi + 1) % contour.length];
          if (pointSegmentDistanceSq(p, a, b) <= 1e-18) boundary = true;
          if ((a[1] > p[1]) !== (b[1] > p[1]) &&
              p[0] < a[0] + (p[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) inside = !inside;
        }
      }
      if (inside && !boundary) return true;
    }
    return false;
  }

  // Giao cắt thật sự được kiểm riêng. Các điểm chứng này bao quát biên lọt trong nhau
  // và biên trùng nhau mà không coi cạnh/góc dùng chung là chồng lấn.
  // Phải xác nhận điểm thuộc CẢ HAI hợp vùng tô, kể cả lỗ của compound; một
  // đường bao rỗng/bị triệt tiêu không bao giờ là bằng chứng đủ cho chồng lấn.
  function filledShapesOverlap(a, b) {
    var overlapScale = Math.min(Math.min(a.bounds.x1,b.bounds.x1)-Math.max(a.bounds.x0,b.bounds.x0),
      Math.min(a.bounds.y1,b.bounds.y1)-Math.max(a.bounds.y0,b.bounds.y0));
    function strictIn(p, shape) {
      var bb = shape.bounds;
      if (p[0] <= bb.x0 || p[0] >= bb.x1 || p[1] <= bb.y0 || p[1] >= bb.y1) return false;
      return strictInsideGroups(p, shape.groups);
    }
    function sharedInterior(p) { return strictIn(p, a) && strictIn(p, b); }
    function probe(shape, other) {
      var i, edge, dx, dy, length, epsilon, p, q, side, k;
      var bb = shape.bounds, scale = Math.min(bb.w, bb.h);
      var directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      for (i = 0; i < shape.edges.length; i++) {
        edge = shape.edges[i]; dx = edge.b[0] - edge.a[0]; dy = edge.b[1] - edge.a[1];
        length = Math.sqrt(dx * dx + dy * dy);
        if (length <= 1e-12) continue;
        epsilon = Math.min(1e-6, length * 1e-4, scale * 1e-4, overlapScale/4);
        // Một đỉnh hay trung điểm nằm hẳn bên trong cũng phải có vùng tô
        // kề bên. Kiểm tra điều đó thay vì tin vào các đường bao bị triệt tiêu/bị che.
        var points = [edge.a, [(edge.a[0]+edge.b[0])/2,(edge.a[1]+edge.b[1])/2]];
        for (var pi = 0; pi < points.length; pi++) {
          p = points[pi];
          if (!strictIn(p, other)) continue;
          if (strictIn(p, shape)) return true;
          for (k = 0; k < directions.length; k++) {
            q = [p[0] + directions[k][0] * epsilon, p[1] + directions[k][1] * epsilon];
            if (sharedInterior(q)) return true;
          }
        }
        // Các đường bao giống hệt nhau không có đỉnh biên nào nằm hẳn bên trong.
        // Cạnh chung có hai hình ở hai phía thì không có điểm nào nằm trong cả hai vùng tô.
        p = points[1];
        for (side = -1; side <= 1; side += 2) {
          q = [p[0] - side * dy / length * epsilon, p[1] + side * dx / length * epsilon];
          if (sharedInterior(q)) return true;
        }
      }
      return false;
    }
    return probe(a, b) || probe(b, a);
  }

  // Kiểm tra liên tục, độc lập trên các path khuôn bế đã flatten. Các hàng raster
  // chọn vị trí đặt, nhưng không thể là trọng tài duy nhất cho một khe vật lý 1 mm.
  // Tham số zoneGap (tuỳ chọn, mm): hai con có trường `zone` khác nhau phải cách nhau ≥ zoneGap
  // (khoảng cách giữa hai khu của bộ chia khu); cùng khu hoặc không ghi zone thì chỉ cần khe.
  function verifyGeometry(plan, variants, rw, rh, dots, gap, step, zoneGap) {
    var mapped = [], i, j, s, v, groups, edges, gi, ci, pi, p, q;
    var tolerance = 0.001, curveError = 0;
    for (i = 0; i < variants.length; i++)
      curveError = Math.max(curveError,variants[i].curveErrorMm || 0);
    var zoneGapMm = Number(zoneGap) > gap ? Number(zoneGap) : gap;
    // Đường cubic đã flatten lệch khỏi khuôn bế thật không quá sai số đã khai báo.
    // Chừa cả hai sai số trước khi khép một tiếp xúc; bù thêm
    // dung sai khoảng cách số học để nó không ăn vào giới hạn hình học đó.
    if (curveError) { gap += 2 * curveError + tolerance; zoneGapMm += 2 * curveError + tolerance; }
    var physicalGap = Math.max(0, gap - tolerance), gapSq = sq(physicalGap);
    var zonePhysical = Math.max(0, zoneGapMm - tolerance), zoneSq = sq(zonePhysical), maxGap = Math.max(gap, zoneGapMm);
    var pg, pgSq, pgPhysical;
    // Đĩa bao chỉ dùng để NHẬN nhanh cặp chắc chắn không va nhau. Cặp sát
    // đường bế thật vẫn phải qua phép đo cạnh đầy đủ, không thay khuôn bằng tròn.
    var outerRadii = [];
    for (i = 0; i < variants.length; i++) {
      v = variants[i]; var radiusSqMax = 0;
      for (gi = 0; gi < v.groups.length; gi++) for (ci = 0; ci < v.groups[gi].length; ci++)
        for (pi = 0; pi < v.groups[gi][ci].length; pi++) {
          p = v.groups[gi][ci][pi];
          radiusSqMax = Math.max(radiusSqMax,sq(p[0]-v.w/2)+sq(p[1]-v.h/2));
        }
      outerRadii.push(Math.sqrt(radiusSqMax));
    }
    var index = spatialIndex(Math.max(8, maxGap * 2));
    for (i = 0; i < plan.length; i++) {
      s = plan[i]; v = variants[s.v]; groups = copyGroups(v.groups); edges = [];
      for (gi = 0; gi < groups.length; gi++) for (ci = 0; ci < groups[gi].length; ci++) {
        var contour = groups[gi][ci];
        for (pi = 0; pi < contour.length; pi++) {
          contour[pi][0] += s.x * step; contour[pi][1] += s.y * step;
        }
        for (pi = 0; pi < contour.length; pi++) {
          p = contour[pi]; q = contour[(pi + 1) % contour.length];
          if (p[0] < -tolerance || p[1] < -tolerance || p[0] > rw * step + tolerance || p[1] > rh * step + tolerance) return false;
          edges.push({a:p,b:q,x0:Math.min(p[0],q[0]),x1:Math.max(p[0],q[0]),y0:Math.min(p[1],q[1]),y1:Math.max(p[1],q[1])});
        }
      }
      var shape = {groups:groups, edges:edges, bounds:boundsOfGroups(groups),
        outerRadius:outerRadii[s.v], cx:s.x*step+v.w/2, cy:s.y*step+v.h/2, zone:s.zone};
      for (var di = 0; di < dots.length; di++) {
        var centre = [dots[di].x * step, dots[di].y * step], radiusSq = sq(Math.max(0, dots[di].radius * step + curveError - tolerance));
        if (insideGroups(centre, groups)) return false;
        for (var ei = 0; ei < edges.length; ei++)
          if (pointSegmentDistanceSq(centre, edges[ei].a, edges[ei].b) < radiusSq) return false;
      }
      var bb = shape.bounds;
      var near = spatialNear(index, {x0:bb.x0-maxGap,x1:bb.x1+maxGap,y0:bb.y0-maxGap,y1:bb.y1+maxGap});
      for (j = 0; j < near.length; j++) {
        var other = mapped[near[j]], ob = other.bounds;
        // Khác khu (có ghi zone ở cả hai con) thì đòi khoảng cách khu; còn lại đòi khe.
        if (shape.zone !== undefined && other.zone !== undefined && shape.zone !== other.zone) {
          pg = zoneGapMm; pgSq = zoneSq; pgPhysical = zonePhysical;
        } else { pg = gap; pgSq = gapSq; pgPhysical = physicalGap; }
        if (bb.x0 >= ob.x1 + pg || ob.x0 >= bb.x1 + pg || bb.y0 >= ob.y1 + pg || ob.y0 >= bb.y1 + pg) continue;
        if (sq(shape.cx-other.cx)+sq(shape.cy-other.cy) >=
          sq(shape.outerRadius+other.outerRadius+pgPhysical)+1e-10) continue;
        // Cubic chia mịn có thể có hàng nghìn cạnh. Lập chỉ mục mỗi đường bao
        // lân cận một lần thay vì so từng cạnh với mọi cạnh khác.
        if (!other.edgeIndex && other.edges.length > 160) {
          other.edgeIndex = spatialIndex(Math.max(1,maxGap*2));
          for (var oi = 0; oi < other.edges.length; oi++)
            spatialAdd(other.edgeIndex,oi,other.edges[oi]);
        }
        for (var ea = 0; ea < edges.length; ea++) {
          var e = edges[ea];
          var edgeNear = other.edgeIndex ? spatialNear(other.edgeIndex,
            {x0:e.x0-pg,x1:e.x1+pg,y0:e.y0-pg,y1:e.y1+pg}) : null;
          for (var eb = 0; eb < (edgeNear ? edgeNear.length : other.edges.length); eb++) {
          var f = other.edges[edgeNear ? edgeNear[eb] : eb];
          if (e.x0 >= f.x1 + pg || f.x0 >= e.x1 + pg || e.y0 >= f.y1 + pg || f.y0 >= e.y1 + pg) continue;
          if (segmentsCross(e.a, e.b, f.a, f.b) ||
              pointSegmentDistanceSq(e.a, f.a, f.b) < pgSq || pointSegmentDistanceSq(e.b, f.a, f.b) < pgSq ||
              pointSegmentDistanceSq(f.a, e.a, e.b) < pgSq || pointSegmentDistanceSq(f.b, e.a, e.b) < pgSq) return false;
          }
        }
        if (pg > tolerance) {
          // Khe vật lý dương đã loại sẵn mọi biên dùng chung/trùng nhau
          // ở lượt đo khoảng cách đoạn thẳng. Giữ phép kiểm tra bao chứa
          // ít tốn kém của nó cho hàng nghìn khuôn bế rất nhỏ.
          for (gi = 0; gi < groups.length; gi++) for (ci = 0; ci < groups[gi].length; ci++)
            if (insideGroups(groups[gi][ci][0], other.groups)) return false;
          for (gi = 0; gi < other.groups.length; gi++) for (ci = 0; ci < other.groups[gi].length; ci++)
            if (insideGroups(other.groups[gi][ci][0], groups)) return false;
        } else if (filledShapesOverlap(shape, other)) return false;
      }
      mapped.push(shape);
      spatialAdd(index, i, shape.bounds);
    }
    return true;
  }

  // Bộ tìm silhouette cũ (lưới raster + tìm tham lam). Vẫn dùng cho tờ có nhiều KHUÔN khác nhau
  // (luân phiên cân bằng số con) và chạy thi đua với lõi xếp hàng để không bao giờ ít con hơn trước.
  function nestLegacy(input, planningPadMm, searchOnly) {
    var began = now();
    try {
      if (!input || !input.sheet || !input.types || !input.types.length) throw new Error("Thiếu dữ liệu khuôn bế.");
      var step = Number(input.resolutionMm) || 0.25;
      if (!(step > 0 && step <= 1)) step = 0.25;
      planningPadMm = Number(planningPadMm) || 0;
      if (!(planningPadMm >= 0 && planningPadMm <= 2*step)) planningPadMm = 0;
      var gap = Number(input.gapMm), margin = Number(input.marginMm), ponClear = Number(input.ponClearMm);
      if (!(gap >= 0) || !(margin >= 0) || !(ponClear >= 0)) throw new Error("Thông số khe/lề/PON không hợp lệ.");
      var rw = Math.floor((Number(input.sheet.widthMm) - 2 * margin) / step + 1e-7);
      var rh = Math.floor((Number(input.sheet.heightMm) - 2 * margin) / step + 1e-7);
      if (rw <= 0 || rh <= 0) throw new Error("Khổ tờ nhỏ hơn phần lề đã nhập.");

      var variants = [], groupsByType = [], ti, rots = [0, 90, 180, 270], ri, g, v;
      for (ti = 0; ti < input.types.length; ti++) {
        g = normalizeGroups(input.types[ti].groups || []);
        if (!g) throw new Error("Không đọc được đường bế kín của loại " + (ti + 1) + ".");
        groupsByType.push(g);
        var fitsSheet = false;
        var curveError = Number(input.types[ti].curveErrorMm);
        if (!isFinite(curveError) || !(curveError >= 0)) curveError = 0;
        curveError = Math.min(0.025,curveError);
        for (ri = 0; ri < rots.length; ri++) {
          v = buildVariant(g, ti, ri, rots[ri], gap+planningPadMm, step);
          if (v) {
            v.curveErrorMm = curveError;
            variants.push(v);
            if (v.wCells <= rw && v.hCells <= rh) fitsSheet = true;
          }
        }
        if (!fitsSheet) throw new Error("Khuôn loại " + (ti + 1) + " không vừa khổ tờ sau khi trừ lề, ở cả 4 hướng xoay.");
      }
      if (!variants.length) throw new Error("Không tạo được biến thể xoay của khuôn.");

      var equivalentTypes = input.types.length > 1;
      for (ti = 1; ti < groupsByType.length && equivalentTypes; ti++)
        if (!sameGroups(groupsByType[0], groupsByType[ti])) equivalentTypes = false;
      var planningVariants = equivalentTypes ? variants.slice(0, 4) : variants;
      var planningTypeCount = equivalentTypes ? 1 : input.types.length;

      var dots = [], di, d;
      for (di = 0; di < (input.sheet.dots || []).length; di++) {
        d = input.sheet.dots[di];
        dots.push({
          x: (Number(d.x) - margin) / step,
          y: (Number(d.y) - margin) / step,
          radius: (Number(d.r) + ponClear) / step
        });
      }

      var budget = Number(input.budgetMs) || 1450;
      budget = clamp(budget, 250, 4000);
      var deadline = began + budget;
      var best = null, mode = "silhouette nhiều khoảng + tiếp xúc thật";
      // Khi không có khoảng hở, lát cuối lấy mẫu thấy trống vẫn có thể che một chồng lấn
      // thật cỡ phần lẻ ô. Chỉ đưa lên những bố cục tìm kiếm an toàn theo kiểm tra liên tục;
      // cache tham chiếu tới các plan tìm kiếm bất biến để kiểm tra phương án dự phòng vẫn rẻ.
      var checkedZeroPlans = [], checkedZeroValues = [];
      function safeSearchPlan(plan) {
        if (gap !== 0) return true;
        for (var checkIndex=0;checkIndex<checkedZeroPlans.length;checkIndex++)
          if (checkedZeroPlans[checkIndex]===plan) return checkedZeroValues[checkIndex];
        var safe = verifyGeometry(plan,planningVariants,rw,rh,dots,0,step);
        checkedZeroPlans.push(plan); checkedZeroValues.push(safe);
        return safe;
      }
      function safeGrowth(trial, seed) {
        if (gap !== 0 || safeSearchPlan(trial)) return trial;
        // Bước thêm cặp và mở rộng tham lam nối thêm vào seed đã kiểm chứng này.
        // Giữ riêng từng con thêm vào mà an toàn, thay vì bỏ cả seed hoặc
        // chấp nhận một va chạm do lấy mẫu. Mọi kiểu xáo thứ tự khác thì giữ phương án dự phòng.
        var recovered = clonePlan(seed), addIndex, before, after;
        for (addIndex=0;addIndex<seed.length;addIndex++) {
          before=seed[addIndex]; after=trial[addIndex];
          if (!after || before.mi!==after.mi || before.v!==after.v ||
              before.x!==after.x || before.y!==after.y) return seed;
        }
        for (addIndex=seed.length;addIndex<trial.length && now()<deadline;addIndex++) {
          if (!allowedType(trial[addIndex].mi,countTypes(recovered,planningTypeCount),planningTypeCount)) continue;
          var appended = recovered.concat([trial[addIndex]]);
          if (safeSearchPlan(appended)) recovered = appended;
        }
        return recovered;
      }

      // Hình tròn được thử lưới lục giác suy từ hình học trước; bộ lập bố cục tổng quát vẫn
      // chạy nếu còn thời gian và có thể thắng nó quanh các vị trí PON bất thường.
      var isRound = planningTypeCount === 1 && circleLike(groupsByType[0]);
      if (isRound) {
        var circle = circlePlan(variants[0], rw, rh, dots, gap, deadline);
        if (circle.length) best = circle;
        // Một tờ chữ nhật có thể chứa nhiều hình tròn hơn khi so le theo cột so với
        // so le theo hàng, nhất là quanh các vùng né PON góc thực tế.
        // Tìm cả hai chiều trong cùng một quỹ thời gian; đổi chỗ toạ độ
        // không làm đổi khuôn bế tròn, cũng không nới lỏng luật khoảng hở nào.
        var turnedDots = [], turnedCircle, ci;
        for (di = 0; di < dots.length; di++)
          turnedDots.push({x:dots[di].y,y:dots[di].x,radius:dots[di].radius});
        turnedCircle = circlePlan(variants[0], rh, rw, turnedDots, gap, deadline);
        for (ci = 0; ci < turnedCircle.length; ci++) {
          var turnX = turnedCircle[ci].x;
          turnedCircle[ci].x = turnedCircle[ci].y; turnedCircle[ci].y = turnX;
        }
        if (turnedCircle.length && comparePlans(turnedCircle, best, variants) > 0) best = turnedCircle;
        mode = "lục giác động 2 hướng + silhouette kiểm tra thật";
      }

      var seeds = [], si, candidate;
      if (!isRound) {
        // Ghép các cụm khác hướng và tận dụng dải dư trước các phần tìm thêm có hạn giờ.
        // Cơ sở hữu hạn đã kiểm chứng không được mất vì các seed lặp cũ dùng hết thời gian.
        var composedBands = compositionalBandPlans(planningVariants, planningTypeCount, rw, rh, dots,
          gap, step, Math.min(deadline, now() + budget * 0.2));
        var mixedRows = mixedRowPlans(planningVariants, planningTypeCount, rw, rh, dots, Math.min(deadline, now() + budget * 0.08));
        var alternating = alternatingRowPlans(planningVariants, planningTypeCount, rw, rh, dots, Math.min(deadline, now() + budget * 0.12));
        var bands = bandPlans(planningVariants, planningTypeCount, rw, rh, dots, gap, step, Math.min(deadline, now() + budget * 0.15));
        var lattice = latticePlans(planningVariants, planningTypeCount, rw, rh, dots, Math.min(deadline, now() + budget * 0.2));
        seeds = seedPlans(planningVariants, planningTypeCount, rw, rh, dots, Math.min(deadline, now() + budget * 0.35)).concat(lattice, alternating, bands, mixedRows, composedBands);
        seeds.sort(function (u, w) { return -comparePlans(u, w, variants); });
      }
      // Giữ mọi seed đã kiểm chứng làm phương án dự phòng ngay cả khi bước tiền xử lý chạm
      // giới hạn thời gian. Việc chia phần thời gian không bao giờ được biến một bố cục hợp lệ thành số 0.
      for (si = 0; si < seeds.length; si++)
        if (balancedPlan(seeds[si], planningTypeCount) && comparePlans(seeds[si], best, variants) > 0 &&
            safeSearchPlan(seeds[si])) best = seeds[si];
      for (si = 0; si < seeds.length && now() < deadline; si++) {
        candidate = seeds[si];
        if (!safeSearchPlan(candidate)) continue;
        var verifiedSeed = candidate;
        // Kiểm tra cặp phụ thuộc lẫn nhau TRƯỚC KHI mở rộng tham lam. Nếu không, con nằm ngang
        // đầu tiên xếp tham lam có thể phá mất chỗ mà con ghép cặp của nó cần.
        var sliceDeadline = Math.min(deadline, now() + Math.max(650, budget * 0.25));
        if (candidate.length >= 6 && now() < sliceDeadline)
          candidate = augmentWithPair(candidate, planningVariants, planningTypeCount, rw, rh, dots, sliceDeadline);
        candidate = growPlan(candidate, planningVariants, planningTypeCount, rw, rh, dots, sliceDeadline);
        candidate = safeGrowth(candidate,verifiedSeed);
        if (balancedPlan(candidate, planningTypeCount) && comparePlans(candidate, best, variants) > 0) best = candidate;
      }
      if (!best) best = [];
      if (!isRound && now() < deadline && best.length) {
        candidate = repairPlans(best, planningVariants, planningTypeCount, rw, rh, dots, deadline);
        if (balancedPlan(candidate,planningTypeCount) && safeSearchPlan(candidate)) best = candidate;
      }
      candidate = centrePlan(best, variants, rw, rh, dots);
      if (safeSearchPlan(candidate)) best = candidate;
      if (!isRound) {
        candidate = polishEdges(best, planningVariants, rw, rh, dots, gap, step, now() + Math.min(550, budget * 0.2));
        if (safeSearchPlan(candidate)) best = candidate;
      }
      if (equivalentTypes) {
        for (var slotIndex = 0; slotIndex < best.length; slotIndex++) {
          var originalVariant = variants[best[slotIndex].v];
          best[slotIndex].mi = slotIndex % input.types.length;
          best[slotIndex].v = best[slotIndex].mi * 4 + originalVariant.vi;
        }
        mode += " + luân phiên các bài cùng khuôn";
      }
      var valid = isRound && best.length ?
        verifyCirclePlan(best, variants[0], rw, rh, dots, gap / step) :
        verifyPlan(best, variants, rw, rh, dots);
      valid = valid && balancedPlan(best, input.types.length);
      if (!valid) throw new Error("Bộ kiểm tra an toàn từ chối phương án dàn.");

      // Phần khép khe/canh tâm tốn thời gian nhất: khi chạy thi đua chỉ trả số con trước,
      // phần này chỉ chạy nếu phương án cũ thắng.
      var finishLegacy = function () {

        var physicalRw = (Number(input.sheet.widthMm) - 2 * margin) / step;
        var physicalRh = (Number(input.sheet.heightMm) - 2 * margin) / step;
        best = closePhysicalGapPlan(best,variants,physicalRw,physicalRh,dots,gap,step,
          now()+(best.length <= 400 ? 5000 : Math.min(2000,Math.max(750,budget*0.5))));
        best = centrePhysicalPlan(best, variants, physicalRw, physicalRh, dots, gap, step);
        if (!verifyGeometry(best, variants, physicalRw, physicalRh, dots, gap, step)) {
          // Chỉ tìm lại khoảng trống lưới, không tăng khe đầu ra hay bỏ kiểm tra thật.
          // Giới hạn tối đa hai lượt dự phòng; đầu vào và nguồn vẫn giữ nguyên.
          if (gap > 0 && planningPadMm < 2*step-1e-8) return nestLegacy(input,Math.min(2*step,planningPadMm+step));
          throw new Error("Bộ kiểm tra an toàn từ chối phương án canh tâm.");
        }
        var physicalBounds = physicalPlanBounds(best, variants, step);
        var centreOffsetX = best.length ? (physicalBounds.x0 + physicalBounds.x1 - physicalRw) * step / 2 : 0;
        var centreOffsetY = best.length ? (physicalBounds.y0 + physicalBounds.y1 - physicalRh) * step / 2 : 0;
        var centredExactly = abs(centreOffsetX) <= 0.001 && abs(centreOffsetY) <= 0.001;

        var slots = [], i, s, vv;
        for (i = 0; i < best.length; i++) {
          s = best[i]; vv = variants[s.v];
          slots.push({ mi: s.mi, vi: vv.vi, x: margin + s.x * step, y: margin + s.y * step, angle: vv.angle });
        }
        var counts = countTypes(best, input.types.length), countText = [], total;
        for (i = 0; i < counts.length; i++) countText.push("loại " + (i + 1) + ": " + counts[i]);
        total = now() - began;
        return {
          ok: true, slots: slots, mode: mode, count: slots.length, counts: counts,
          centering: {exact:centredExactly,offsetXmm:centreOffsetX,offsetYmm:centreOffsetY},
          detail: "Dàn silhouette thật: " + slots.length + " con (" + countText.join(", ") + "). " +
            "Lưới kiểm tra " + step.toFixed(2) + " mm, khe " + gap.toFixed(2) + " mm; " +
            "đã thử xoay/lồng biên dạng trong " + total + " ms." +
            (centredExactly ? "" : " Canh tâm bị giới hạn bởi vùng né PON.")
        };
      };
      if (searchOnly) return { ok: true, count: best.length, finish: function () {
        try { return finishLegacy(); }
        catch (finishError) { return { ok: false, error: finishError && finishError.message ? finishError.message : String(finishError) }; }
      } };
      return finishLegacy();
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }

  // =====================================================================
  // LÕI XẾP HÀNG LỒNG (v10)
  // Mọi khuôn bế được xử lý chung theo hình học, không nhận diện tên hình:
  //  1. Đo đường bao thật của khuôn ở 4 hướng xoay, dựng "bảng tiếp xúc" bảo thủ
  //     cho mọi cặp hướng (con B nằm trên / bên phải con A gần nhất bao nhiêu mm).
  //  2. Lập các MẪU HÀNG: một hướng lặp đều, hoặc hai con (cùng/khác hướng) lệch
  //     dọc dy lồng vào nhau (đối đầu 180°, so le răng cưa...). Chọn dy theo mật độ
  //     thật khi chồng nhiều hàng.
  //  3. Dựng KHỐI: nhiều hàng chồng sát nhau, mỗi hàng dịch trái/phải (pha) để lồng
  //     sâu vào hàng dưới: so le đều, zigzag, hàng thuận/ngược 180° xen kẽ. Ghép khối
  //     của mẫu khác ở dải dư phía trên (đứng + nằm...). Dịch từng hàng để thêm con.
  //  4. Khép đúng khe bằng tiếp xúc chính xác trên đường bế thật, lấp chỗ trống,
  //     dịch cả bố cục để né PON và canh giữa tờ.
  //  5. Chốt kiểm tra hình học liên tục độc lập (verifyGeometry) trước khi trả kết quả.
  // Toạ độ trong lõi này là mm trong vùng dàn (đã trừ lề), trục y hướng lên.
  // =====================================================================
  var RowNest = (function () {
    var NEG = -Infinity, POS = Infinity, EXACT_TOL = 0.0004;

    function pointInContour(px, py, c) {
      var inside = false, i, j, a, b;
      for (i = 0, j = c.length - 1; i < c.length; j = i++) {
        a = c[i]; b = c[j];
        if ((a[1] > py) !== (b[1] > py) && px < a[0] + (py - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) inside = !inside;
      }
      return inside;
    }

    // Trong mỗi CompoundPath (even/odd) chỉ lấy contour không nằm trong contour nào khác:
    // lỗ được coi như tô kín khi tìm bố cục (bảo thủ); chốt kiểm tra cuối vẫn dùng hình gốc có lỗ.
    function outerContours(groups) {
      var out = [], gi, ci, di, g, c, depth, px, py;
      for (gi = 0; gi < groups.length; gi++) {
        g = groups[gi];
        for (ci = 0; ci < g.length; ci++) {
          c = g[ci];
          if (!c || c.length < 3) continue;
          px = (c[0][0] + c[1][0]) / 2; py = (c[0][1] + c[1][1]) / 2;
          depth = 0;
          for (di = 0; di < g.length; di++)
            if (di !== ci && g[di].length >= 3 && pointInContour(px, py, g[di])) depth++;
          if (depth === 0) out.push(c);
        }
      }
      return out;
    }

    function turnPoint(p, deg) {
      if (deg === 90) return [-p[1], p[0]];
      if (deg === 180) return [-p[0], -p[1]];
      if (deg === 270) return [p[1], -p[0]];
      return [p[0], p[1]];
    }

    // Một hướng xoay: chuẩn hoá về góc (0,0) của khung bao, khớp buildVariant/rotateGroups.
    function orientShape(groups, deg) {
      var x0 = POS, y0 = POS, x1 = NEG, y1 = NEG, gi, ci, pi, p, g, c, rotated = [];
      for (gi = 0; gi < groups.length; gi++) for (ci = 0; ci < groups[gi].length; ci++)
        for (pi = 0; pi < groups[gi][ci].length; pi++) {
          p = turnPoint(groups[gi][ci][pi], deg);
          if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
          if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
        }
      for (gi = 0; gi < groups.length; gi++) {
        g = [];
        for (ci = 0; ci < groups[gi].length; ci++) {
          c = [];
          for (pi = 0; pi < groups[gi][ci].length; pi++) {
            p = turnPoint(groups[gi][ci][pi], deg);
            c.push([p[0] - x0, p[1] - y0]);
          }
          if (c.length >= 3) g.push(c);
        }
        if (g.length) rotated.push(g);
      }
      return { deg: deg, groups: rotated, outer: outerContours(rotated), w: x1 - x0, h: y1 - y0 };
    }

    // Gói cạnh/đỉnh (đỉnh sắp theo y) để tính tiếp xúc chính xác. swap: đổi trục cho trượt dọc.
    function packEdges(contours, swap) {
      var n = 0, ci, pi, c, k = 0, p, q, i;
      for (ci = 0; ci < contours.length; ci++) n += contours[ci].length;
      var ax = new Float64Array(n), ay = new Float64Array(n), bx = new Float64Array(n), by = new Float64Array(n);
      var ylo = new Float64Array(n), yhi = new Float64Array(n), order = [];
      for (ci = 0; ci < contours.length; ci++) {
        c = contours[ci];
        for (pi = 0; pi < c.length; pi++) {
          p = c[pi]; q = c[(pi + 1) % c.length];
          if (swap) { ax[k] = p[1]; ay[k] = p[0]; bx[k] = q[1]; by[k] = q[0]; }
          else { ax[k] = p[0]; ay[k] = p[1]; bx[k] = q[0]; by[k] = q[1]; }
          ylo[k] = Math.min(ay[k], by[k]); yhi[k] = Math.max(ay[k], by[k]);
          order.push(k); k++;
        }
      }
      order.sort(function (u, v) { return ay[u] - ay[v]; });
      var sx = new Float64Array(n), sy = new Float64Array(n);
      for (i = 0; i < n; i++) { sx[i] = ax[order[i]]; sy[i] = ay[order[i]]; }
      return { n: n, ax: ax, ay: ay, bx: bx, by: by, ylo: ylo, yhi: yhi, sx: sx, sy: sy };
    }

    function lowerBound(arr, n, value) {
      var lo = 0, hi = n, mid;
      while (lo < hi) { mid = (lo + hi) >> 1; if (arr[mid] < value) lo = mid + 1; else hi = mid; }
      return lo;
    }

    // Điểm xa nhất về phía dir (1 = phải, -1 = trái) trên đường ngang y = c mà còn cách
    // đoạn (a,b) không quá g. NaN nếu đường ngang không chạm "viên nang" bán kính g quanh đoạn.
    function lineCapsuleExtreme(ax, ay, bx, by, c, g, dir) {
      var best = NaN, d, x, ex, ey, L2, L, base, half, lo, hi, x0, x1, sLo, sHi, lam;
      d = c - ay;
      if (d <= g && d >= -g) best = ax + dir * Math.sqrt(Math.max(0, g * g - d * d));
      d = c - by;
      if (d <= g && d >= -g) {
        x = bx + dir * Math.sqrt(Math.max(0, g * g - d * d));
        if (best !== best || (dir > 0 ? x > best : x < best)) best = x;
      }
      ex = bx - ax; ey = by - ay; L2 = ex * ex + ey * ey;
      if (L2 > 0) {
        if (ey === 0) {
          if (c - ay <= g && c - ay >= -g) {
            x = dir > 0 ? Math.max(ax, bx) : Math.min(ax, bx);
            if (best !== best || (dir > 0 ? x > best : x < best)) best = x;
          }
        } else {
          L = Math.sqrt(L2);
          base = ax + ex * (c - ay) / ey;
          half = g * L / Math.abs(ey);
          lo = base - half; hi = base + half;
          if (ex === 0) {
            lam = (c - ay) * ey / L2;
            if (lam < 0 || lam > 1) return best;
            sLo = lo; sHi = hi;
          } else {
            x0 = ax - (c - ay) * ey / ex; x1 = x0 + L2 / ex;
            sLo = Math.min(x0, x1); sHi = Math.max(x0, x1);
          }
          lo = Math.max(lo, sLo); hi = Math.min(hi, sHi);
          if (lo <= hi) {
            x = dir > 0 ? hi : lo;
            if (best !== best || (dir > 0 ? x > best : x < best)) best = x;
          }
        }
      }
      return best;
    }

    // Tiếp xúc CHÍNH XÁC trên đường bế đã làm phẳng: B đặt tại (s, t) so với gốc A, trượt từ
    // bên phải vào. Trả về s nhỏ nhất mà mọi s' >= s đều cách A ít nhất g (-Infinity: không chạm).
    function exactRight(A, B, t, g) {
      var best = NEG, e, lo, hi, k, x, cand;
      for (e = 0; e < A.n; e++) {
        lo = lowerBound(B.sy, B.n, A.ylo[e] - g - t);
        hi = A.yhi[e] + g - t;
        for (k = lo; k < B.n && B.sy[k] <= hi; k++) {
          x = lineCapsuleExtreme(A.ax[e], A.ay[e], A.bx[e], A.by[e], B.sy[k] + t, g, 1);
          if (x === x) { cand = x - B.sx[k]; if (cand > best) best = cand; }
        }
      }
      for (e = 0; e < B.n; e++) {
        lo = lowerBound(A.sy, A.n, B.ylo[e] - g + t);
        hi = B.yhi[e] + g + t;
        for (k = lo; k < A.n && A.sy[k] <= hi; k++) {
          x = lineCapsuleExtreme(B.ax[e], B.ay[e], B.bx[e], B.by[e], A.sy[k] - t, g, -1);
          if (x === x) { cand = A.sx[k] - x; if (cand > best) best = cand; }
        }
      }
      return best;
    }

    // Bao theo dải (cột: đỉnh/đáy; hàng khi swap: phải/trái). Giá trị cực trị trong cả dải: bảo thủ.
    function stripEnvelope(contours, extent, res, swap) {
      var n = Math.max(1, Math.ceil(extent / res - 1e-9));
      var hiArr = new Float64Array(n), loArr = new Float64Array(n), i, ci, pi, c, p, q;
      var px, py, qx, qy, x0, x1, i0, i1, xa, xb, ya, yb, slope, tmp;
      for (i = 0; i < n; i++) { hiArr[i] = NEG; loArr[i] = POS; }
      for (ci = 0; ci < contours.length; ci++) {
        c = contours[ci];
        for (pi = 0; pi < c.length; pi++) {
          p = c[pi]; q = c[(pi + 1) % c.length];
          if (swap) { px = p[1]; py = p[0]; qx = q[1]; qy = q[0]; } else { px = p[0]; py = p[1]; qx = q[0]; qy = q[1]; }
          x0 = Math.min(px, qx); x1 = Math.max(px, qx);
          i0 = Math.floor(x0 / res); i1 = Math.floor(x1 / res);
          if (i0 < 0) i0 = 0; if (i0 > n - 1) i0 = n - 1;
          if (i1 < 0) i1 = 0; if (i1 > n - 1) i1 = n - 1;
          if (i0 === i1 || !(x1 - x0 > 0)) {
            ya = Math.min(py, qy); yb = Math.max(py, qy);
            for (i = i0; i <= i1; i++) {
              if (yb > hiArr[i]) hiArr[i] = yb;
              if (ya < loArr[i]) loArr[i] = ya;
            }
            continue;
          }
          slope = (qy - py) / (qx - px);
          for (i = i0; i <= i1; i++) {
            xa = i === 0 ? x0 : Math.max(x0, i * res);
            xb = i === n - 1 ? x1 : Math.min(x1, (i + 1) * res);
            ya = py + (xa - px) * slope; yb = py + (xb - px) * slope;
            if (ya > yb) { tmp = ya; ya = yb; yb = tmp; }
            if (yb > hiArr[i]) hiArr[i] = yb;
            if (ya < loArr[i]) loArr[i] = ya;
          }
        }
      }
      return { n: n, hi: hiArr, lo: loArr };
    }

    // Nở bao trên theo khe g (cận trên bảo thủ của hình ⊕ đĩa bán kính g).
    function dilateHigh(env, res, g) {
      var pad = Math.ceil(g / res) + 1, n = env.n, out = new Float64Array(n + 2 * pad), i, j, d, dx, v, best;
      for (i = -pad; i < n + pad; i++) {
        best = NEG;
        for (j = Math.max(0, i - pad); j <= Math.min(n - 1, i + pad); j++) {
          v = env.hi[j];
          if (v === NEG) continue;
          d = i > j ? i - j : j - i;
          dx = d <= 1 ? 0 : (d - 1) * res;
          if (dx >= g && !(g === 0 && d <= 1)) continue;
          v += Math.sqrt(Math.max(0, g * g - dx * dx));
          if (v > best) best = v;
        }
        out[i + pad] = best;
      }
      return { pad: pad, vals: out };
    }

    // Bảng tiếp xúc: T[k] = độ lệch tối thiểu (theo trục trượt) của B so với A khi B lệch k dải.
    function contactTable(dilA, nA, envB) {
      var pad = dilA.pad, vals = dilA.vals, nB = envB.n, lo = envB.lo;
      var kLo = -pad - (nB - 1), kHi = nA + pad - 1, T = new Float64Array(kHi - kLo + 1), k, m, mLo, mHi, best, v;
      for (k = kLo; k <= kHi; k++) {
        best = NEG;
        mLo = Math.max(0, -pad - k); mHi = Math.min(nB - 1, nA + pad - 1 - k);
        for (m = mLo; m <= mHi; m++) {
          v = vals[m + k + pad] - lo[m];
          if (v > best) best = v;
        }
        T[k - kLo] = best;
      }
      return { kLo: kLo, kHi: kHi, T: T };
    }
    // Lệch không nguyên ô: lấy max hai ô kề (vẫn bảo thủ).
    function tableAt(tab, s, res) {
      var k = Math.floor(s / res + 1e-9), a = NEG, b = NEG;
      if (k >= tab.kLo && k <= tab.kHi) a = tab.T[k - tab.kLo];
      if (k + 1 >= tab.kLo && k + 1 <= tab.kHi) b = tab.T[k + 1 - tab.kLo];
      return a > b ? a : b;
    }

    // Rút gọn contour kín (Douglas–Peucker), sai lệch Hausdorff hai chiều <= tol.
    function simplifyClosed(c, tol) {
      var n = c.length;
      if (n <= 8 || !(tol > 0)) return c.slice(0);
      var far = 0, d, i, best = -1, keep = [], stack, s, a, b, k, m, dm, dd, out = [];
      for (i = 0; i < n; i++) keep.push(0);
      for (i = 1; i < n; i++) {
        d = (c[i][0] - c[0][0]) * (c[i][0] - c[0][0]) + (c[i][1] - c[0][1]) * (c[i][1] - c[0][1]);
        if (d > best) { best = d; far = i; }
      }
      keep[0] = 1; keep[far] = 1;
      function seg(p, u, v) {
        var ex = v[0] - u[0], ey = v[1] - u[1], den = ex * ex + ey * ey;
        var t = den ? ((p[0] - u[0]) * ex + (p[1] - u[1]) * ey) / den : 0;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        var qx = u[0] + t * ex - p[0], qy = u[1] + t * ey - p[1];
        return Math.sqrt(qx * qx + qy * qy);
      }
      stack = [[0, far], [far, n]];
      while (stack.length) {
        s = stack.pop(); a = s[0]; b = s[1]; m = -1; dm = tol;
        for (k = a + 1; k < b; k++) {
          dd = seg(c[k % n], c[a % n], c[b % n]);
          if (dd > dm) { dm = dd; m = k; }
        }
        if (m >= 0) { keep[m % n] = 1; stack.push([a, m]); stack.push([m, b]); }
      }
      for (i = 0; i < n; i++) if (keep[i]) out.push(c[i]);
      return out;
    }

    // Tâm chấm PON (px,py) cách hình đặt tại (ox,oy) ít nhất R và không nằm trong hình.
    function pointClear(px, py, shape, ox, oy, R) {
      var x = px - ox, y = py - oy, ci, c, i, a, b, ex, ey, den, t, qx, qy, R2 = R * R;
      var dx = Math.max(-x, x - shape.w, 0), dy = Math.max(-y, y - shape.h, 0);
      if (dx * dx + dy * dy >= R2) return true;
      for (ci = 0; ci < shape.outer.length; ci++) if (pointInContour(x, y, shape.outer[ci])) return false;
      for (ci = 0; ci < shape.outer.length; ci++) {
        c = shape.outer[ci];
        for (i = 0; i < c.length; i++) {
          a = c[i]; b = c[(i + 1) % c.length];
          ex = b[0] - a[0]; ey = b[1] - a[1]; den = ex * ex + ey * ey;
          t = den ? ((x - a[0]) * ex + (y - a[1]) * ey) / den : 0;
          if (t < 0) t = 0; else if (t > 1) t = 1;
          qx = a[0] + t * ex - x; qy = a[1] + t * ey - y;
          if (qx * qx + qy * qy < R2) return false;
        }
      }
      return true;
    }

    function sameContourTol(a, b, tol) {
      if (a.length !== b.length) return false;
      var start, dir, i, j, ok;
      for (start = 0; start < b.length; start++) {
        if (Math.abs(a[0][0] - b[start][0]) > tol || Math.abs(a[0][1] - b[start][1]) > tol) continue;
        for (dir = -1; dir <= 1; dir += 2) {
          ok = true;
          for (i = 1; i < a.length; i++) {
            j = (start + dir * i + b.length * 2) % b.length;
            if (Math.abs(a[i][0] - b[j][0]) > tol || Math.abs(a[i][1] - b[j][1]) > tol) { ok = false; break; }
          }
          if (ok) return true;
        }
      }
      return false;
    }
    function sameOuter(A, B) {
      if (Math.abs(A.w - B.w) > 1e-6 || Math.abs(A.h - B.h) > 1e-6 || A.outer.length !== B.outer.length) return false;
      var used = {}, i, j, f;
      for (i = 0; i < A.outer.length; i++) {
        f = false;
        for (j = 0; j < B.outer.length; j++)
          if (!used[j] && sameContourTol(A.outer[i], B.outer[j], 1e-6)) { used[j] = true; f = true; break; }
        if (!f) return false;
      }
      return true;
    }

    // Hình học dùng chung cho cả tờ đứng và tờ xoay 90°.
    function prepareShapes(groups, g, res) {
      var shapes = [], o, uniq = [], k, s, a, b, V = [], H = [], dup;
      for (o = 0; o < 4; o++) shapes.push(orientShape(groups, o * 90));
      for (o = 0; o < 4; o++) {
        dup = -1;
        for (k = 0; k < uniq.length; k++) if (sameOuter(shapes[o], shapes[uniq[k]])) { dup = uniq[k]; break; }
        shapes[o].same = dup < 0 ? o : dup;
        if (dup < 0) uniq.push(o);
      }
      for (o = 0; o < 4; o++) {
        s = shapes[o];
        // Tiếp xúc chính xác dùng contour rút gọn (lệch tối đa EXACT_TOL); khe khép cộng 2 lần độ lệch đó
        // nên khoảng cách trên đường bế gốc vẫn >= khe yêu cầu, chỉ dư tối đa 0,001 mm.
        var reduced = [];
        for (k = 0; k < s.outer.length; k++) reduced.push(simplifyClosed(s.outer[k], EXACT_TOL));
        s.E = packEdges(reduced, false);
        s.Et = packEdges(reduced, true);
        s.col = stripEnvelope(s.outer, s.w, res, false);
        s.row = stripEnvelope(s.outer, s.h, res, true);
        s.colDil = dilateHigh(s.col, res, g);
        s.rowDil = dilateHigh(s.row, res, g);
        // Hình rút gọn cho phép thử PON nhanh; bán kính né cộng thêm sai lệch rút gọn (bảo thủ).
        s.ponTol = 0.004;
        s.pon = { w: s.w, h: s.h, outer: [] };
        for (k = 0; k < s.outer.length; k++) s.pon.outer.push(simplifyClosed(s.outer[k], s.ponTol));
      }
      for (a = 0; a < 4; a++) {
        V.push([]); H.push([]);
        for (b = 0; b < 4; b++) {
          V[a].push(contactTable(shapes[a].colDil, shapes[a].col.n, shapes[b].col));
          H[a].push(contactTable(shapes[a].rowDil, shapes[a].row.n, shapes[b].row));
        }
      }
      return { shapes: shapes, uniq: uniq, V: V, H: H, g: g, res: res };
    }

    function Ctx(prep, W, Hh, dots, deadline) {
      this.p = prep; this.s = prep.shapes; this.W = W; this.H = Hh; this.dots = dots;
      this.res = prep.res; this.g = prep.g; this.gExact = prep.g + 2 * EXACT_TOL; this.deadline = deadline; this.cache = {};
      this.rowCache = {}; this.rowCacheSize = 0;
    }
    Ctx.prototype.vAt = function (a, b, dx) { return tableAt(this.p.V[a][b], dx, this.res); };
    Ctx.prototype.hAt = function (a, b, dy) { return tableAt(this.p.H[a][b], dy, this.res); };
    Ctx.prototype.exactH = function (a, b, t) {
      var key = "h" + a + b + ":" + Math.round(t * 1e7), c = this.cache[key];
      if (c === undefined) { c = exactRight(this.s[a].E, this.s[b].E, t, this.gExact); this.cache[key] = c; }
      return c;
    };
    Ctx.prototype.exactV = function (a, b, s) {
      var key = "v" + a + b + ":" + Math.round(s * 1e7), c = this.cache[key];
      if (c === undefined) { c = exactRight(this.s[a].Et, this.s[b].Et, s, this.gExact); this.cache[key] = c; }
      return c;
    };
    Ctx.prototype.ponSafe = function (o, x, y) {
      var i, d, sh = this.s[o];
      for (i = 0; i < this.dots.length; i++) {
        d = this.dots[i];
        if (!pointClear(d.x, d.y, sh.pon, x, y, d.R + sh.ponTol)) return false;
      }
      return true;
    };
    Ctx.prototype.late = function () { return now() > this.deadline; };

    // ---------- Mẫu hàng ----------
    // Vị trí các con của một hàng (mẫu T, pha cho trước) — dùng lại rất nhiều lần nên giữ trong bộ nhớ đệm
    // của tờ đang xét (kết quả chỉ được đọc, không sửa).
    var rowUid = 0;
    function rowPositions(ctx, T, phase) {
      if (!T.uid) T.uid = ++rowUid;
      var key = T.uid + "|" + phase, hit = ctx.rowCache[key];
      if (hit) return hit;
      if (ctx.rowCacheSize > 40000) { ctx.rowCache = {}; ctx.rowCacheSize = 0; }
      hit = rowPositionsRaw(ctx, T, phase);
      ctx.rowCache[key] = hit; ctx.rowCacheSize++;
      return hit;
    }
    function rowPositionsRaw(ctx, T, phase) {
      var out = [], i, e, k0, k1, k, x, w;
      for (i = 0; i < T.el.length; i++) {
        e = T.el[i]; w = ctx.s[e.o].w;
        k0 = Math.ceil((-phase - e.x) / T.P - 1e-7);
        k1 = Math.floor((ctx.W - w - phase - e.x + 1e-6) / T.P + 1e-9);
        for (k = k0; k <= k1; k++) {
          x = phase + e.x + k * T.P;
          if (x < -1e-6 || x + w > ctx.W + 1e-6) continue;
          out.push({ o: e.o, x: x, ey: e.y, h: ctx.s[e.o].h, w: w });
        }
      }
      out.sort(function (a, b) { return a.x - b.x; });
      return out;
    }

    // Baseline nhỏ nhất của hàng mới (vị trí qs) để không chạm mọi hàng đã đặt bên dưới.
    function rowOffset(ctx, rows, qs, exact) {
      var Y = NEG, r, row, maxTop = NEG, i, j, p, q, v, lo, g = ctx.g, topUpTo = [];
      for (r = 0; r < rows.length; r++) { maxTop = Math.max(maxTop, rows[r].top); topUpTo.push(maxTop); }
      for (r = rows.length - 1; r >= 0; r--) {
        if (Y !== NEG && topUpTo[r] + g + 1e-9 <= Y) break;
        row = rows[r]; lo = 0;
        for (j = 0; j < qs.length; j++) {
          q = qs[j];
          while (lo < row.pieces.length && row.pieces[lo].x + row.pieces[lo].w + g + 1e-9 < q.x) lo++;
          for (i = lo; i < row.pieces.length; i++) {
            p = row.pieces[i];
            if (p.x > q.x + q.w + g + 1e-9) break;
            v = exact ? ctx.exactV(p.o, q.o, q.x - p.x) : ctx.vAt(p.o, q.o, q.x - p.x);
            if (v === NEG) continue;
            v = p.y + v - q.ey;
            if (v > Y) Y = v;
          }
        }
      }
      return Y;
    }

    // Chênh baseline nhỏ nhất giữa hàng dưới mẫu T và hàng trên mẫu U lệch s (cùng chu kỳ).
    function periodicOffset(ctx, T, U, s) {
      var best = NEG, i, j, m, ei, ej, dx, v, reach, base, PP = Math.max(T.P, U.P), mLo, mHi;
      for (i = 0; i < T.el.length; i++) for (j = 0; j < U.el.length; j++) {
        ei = T.el[i]; ej = U.el[j];
        reach = ctx.s[ei.o].w + ctx.s[ej.o].w + 2 * ctx.g + 2 * ctx.res;
        base = ej.x + s - ei.x;
        mLo = Math.ceil((-reach - base) / PP); mHi = Math.floor((reach - base) / PP);
        for (m = mLo; m <= mHi; m++) {
          dx = base + m * PP;
          v = ctx.vAt(ei.o, ej.o, dx);
          if (v === NEG) continue;
          v += ei.y - ej.y;
          if (v > best) best = v;
        }
      }
      return best;
    }

    // Mật độ khi chồng lặp chính mẫu này (so le tối ưu), độ dư ngang, các độ so le nên thử.
    function analyseTemplate(ctx, T) {
      var N = 96, k, s, v, v2, list = [], shifts = [], q, dup, dd;
      for (k = 0; k < N; k++) {
        s = T.P * k / N;
        v = periodicOffset(ctx, T, T, s);
        v2 = periodicOffset(ctx, T, T, 2 * s);
        if (v2 !== NEG) v = Math.max(v, v2 / 2);
        list.push({ s: s, v: v });
      }
      list.sort(function (a, b) { return a.v - b.v; });
      for (k = 0; k < list.length && shifts.length < 3; k++) {
        dup = false;
        for (q = 0; q < shifts.length; q++) {
          dd = Math.abs(shifts[q].s - list[k].s); dd = Math.min(dd, T.P - dd);
          if (dd < T.P / 12) dup = true;
        }
        if (!dup) shifts.push(list[k]);
      }
      var qs0 = rowPositions(ctx, T, 0), ext = 0, keep = null, perRow = 0;
      for (k = 0; k < qs0.length; k++) ext = Math.max(ext, qs0[k].x + qs0[k].w);
      T.slack = qs0.length ? Math.max(0, ctx.W - ext) : 0;
      // Lệch tốt nhất mà vẫn giữ đủ số con của hàng (nằm trong độ dư ngang).
      for (k = 0; k < list.length; k++) {
        dd = Math.min(list[k].s, T.P - list[k].s);
        if (dd <= T.slack + 1e-9) { keep = list[k]; break; }
      }
      if (keep) {
        dup = false;
        for (q = 0; q < shifts.length; q++) if (Math.abs(shifts[q].s - keep.s) < 1e-9) dup = true;
        if (!dup) shifts.push(keep);
      }
      T.shifts = shifts;
      T.stack = Math.max(list[0].v, 1e-6);
      T.perRow = qs0.length;
      T.density = T.perRow / T.stack;
    }

    function pairTemplate(ctx, a, b, dy) {
      var s = ctx.s, d, back, Paa, Pbb, P, xb, y0, ea, eb, height;
      if (a === b && Math.abs(dy) < 1e-9) return null;
      d = ctx.hAt(a, b, dy); back = ctx.hAt(b, a, -dy);
      Paa = ctx.hAt(a, a, 0); Pbb = ctx.hAt(b, b, 0);
      if (d === NEG) d = 0;
      if (back === NEG) back = 0;
      P = Math.max(d + back, Paa, Pbb);
      if (!(P > 0)) return null;
      // Chu kỳ bị giới hạn bởi con cùng hướng: đặt con thứ hai giữa khoảng còn trống cho đều.
      xb = d + (P - d - back) / 2;
      y0 = Math.min(0, dy);
      ea = { o: a, x: 0, y: -y0 }; eb = { o: b, x: xb, y: dy - y0 };
      height = Math.max(ea.y + s[a].h, eb.y + s[b].h);
      if (height > ctx.H + 1e-9) return null;
      return { kind: 2, el: [ea, eb], P: P, dy: dy, height: height, key: "p" + a + b + ":" + dy.toFixed(2) };
    }

    // Mẫu xoay 180° (cùng chu kỳ): dùng cho khối hàng thuận/ngược xen kẽ.
    function rotateTemplate(ctx, T) {
      if (T.rot !== undefined) return T.rot;
      var el = [], i, e, minX = POS, minY = POS, same, sx;
      for (i = 0; i < T.el.length; i++) {
        e = T.el[i];
        el.push({ o: ctx.s[(e.o + 2) % 4].same, x: -(e.x + ctx.s[e.o].w), y: -(e.y + ctx.s[e.o].h) });
      }
      for (i = 0; i < el.length; i++) { minX = Math.min(minX, el[i].x); minY = Math.min(minY, el[i].y); }
      for (i = 0; i < el.length; i++) { el[i].x -= minX; el[i].y -= minY; }
      el.sort(function (a, b) { return a.x - b.x; });
      sx = el[0].x;
      for (i = 0; i < el.length; i++) el[i].x -= sx;
      same = el.length === T.el.length;
      for (i = 0; same && i < el.length; i++)
        if (el[i].o !== T.el[i].o || Math.abs(el[i].x - T.el[i].x) > 1e-9 || Math.abs(el[i].y - T.el[i].y) > 1e-9) same = false;
      if (same) { T.rot = null; return null; }
      var U = { kind: T.kind, el: el, P: T.P, height: T.height, key: T.key + "r", rot: T };
      analyseTemplate(ctx, U);
      T.rot = U;
      return U;
    }

    function makeTemplates(ctx, pairSamples) {
      var s = ctx.s, uniq = ctx.p.uniq, out = [], i, j, a, b, k, t, q, P;
      for (i = 0; i < uniq.length; i++) {
        a = uniq[i];
        P = ctx.hAt(a, a, 0);
        if (!(P > 0) || s[a].w > ctx.W + 1e-9 || s[a].h > ctx.H + 1e-9) continue;
        var T1 = { kind: 1, el: [{ o: a, x: 0, y: 0 }], P: P, height: s[a].h, key: "s" + a };
        analyseTemplate(ctx, T1);
        if (T1.perRow > 0) out.push(T1);
      }
      if (!pairSamples) return out;
      for (i = 0; i < uniq.length; i++) for (j = i; j < uniq.length; j++) {
        a = uniq[i]; b = uniq[j];
        if (s[a].h > ctx.H || s[b].h > ctx.H || s[a].w > ctx.W || s[b].w > ctx.W) continue;
        var lo = -s[b].h, hi = s[a].h, N = pairSamples, step = (hi - lo) / N;
        var dys = [0, s[a].h - s[b].h, (s[a].h - s[b].h) / 2], cands = [], refined = [], kept = [], T2, T3, c0, dup;
        for (k = 0; k <= N; k++) dys.push(lo + step * k);
        for (k = 0; k < dys.length; k++) {
          T2 = pairTemplate(ctx, a, b, dys[k]);
          if (!T2) continue;
          analyseTemplate(ctx, T2);
          if (T2.perRow > 0) cands.push(T2);
        }
        cands.sort(function (u, v) { return v.density - u.density; });
        for (k = 0; k < Math.min(3, cands.length); k++) {
          c0 = cands[k];
          for (t = -4; t <= 4; t++) {
            if (!t) continue;
            T3 = pairTemplate(ctx, a, b, c0.dy + t * step / 4);
            if (!T3) continue;
            analyseTemplate(ctx, T3);
            if (T3.perRow > 0) refined.push(T3);
          }
        }
        cands = cands.concat(refined);
        cands.sort(function (u, v) { return v.density - u.density; });
        for (k = 0; k < cands.length && kept.length < 3; k++) {
          dup = false;
          for (q = 0; q < kept.length; q++) if (Math.abs(kept[q].dy - cands[k].dy) < Math.max(0.5, step / 2)) dup = true;
          if (!dup) kept.push(cands[k]);
        }
        for (k = 0; k < kept.length; k++) out.push(kept[k]);
      }
      out.sort(function (u, v) { return v.density - u.density; });
      return out;
    }

    // Mọi mẫu đơn + mẫu cặp: mỗi cặp hướng tối đa 2 mẫu dày hơn mẫu đơn; riêng cặp đối đầu 180°
    // luôn giữ một mẫu dù chỉ ngang mật độ (hai đầu hàng cùng quay phần bo/vát ra ngoài, dễ né PON).
    function pickTemplates(T, cap) {
      var singles = [], pairs = [], extra = [], i, t, a, b, key, ref, bestSingle = {}, used = {}, opp = {}, out;
      for (i = 0; i < T.length; i++) if (T[i].kind === 1) { singles.push(T[i]); bestSingle[T[i].el[0].o] = T[i].density; }
      for (i = 0; i < T.length; i++) {
        t = T[i];
        if (t.kind !== 2) continue;
        a = t.el[0].o; b = t.el[1].o; key = Math.min(a, b) + "-" + Math.max(a, b);
        ref = Math.max(bestSingle[a] || 0, bestSingle[b] || 0);
        if (t.density > ref * 1.002) {
          if ((used[key] || 0) >= 2) continue;
          used[key] = (used[key] || 0) + 1;
          pairs.push(t);
        } else if (a !== b && (a + 2) % 4 === b % 4 && !opp[key] && t.density >= ref * 0.97) {
          opp[key] = 1;
          extra.push(t);
        }
      }
      out = singles.concat(pairs.slice(0, Math.max(2, cap - singles.length)), extra.slice(0, 2));
      out.sort(function (u, v) { return v.density - u.density; });
      return out;
    }

    // ---------- Khối hàng ----------
    function makeRow(ctx, rows, T, phase, exact) {
      var qs = rowPositions(ctx, T, phase), Y, pieces = [], top = NEG, i, q, y;
      if (!qs.length) return null;
      Y = rows.length ? rowOffset(ctx, rows, qs, exact) : 0;
      if (Y === NEG || Y < 0) Y = 0;
      for (i = 0; i < qs.length; i++) {
        q = qs[i]; y = Y + q.ey;
        if (y + q.h > ctx.H + 1e-6) continue;
        pieces.push({ o: q.o, x: q.x, y: y, w: q.w, h: q.h });
        if (y + q.h > top) top = y + q.h;
      }
      if (!pieces.length) return null;
      return { T: T, phase: phase, Y: Y, pieces: pieces, top: top, n: pieces.length };
    }

    // Hàng chẵn mẫu T, hàng lẻ mẫu U (nếu có). Pha hàng sau = pha hàng trước + s (U: s rồi s2),
    // hoặc zigzag (lệch s rồi trả về). Không xét PON ở đây.
    function buildBlock(ctx, T, phi0, s, zigzag, below, maxRows, U, s2) {
      var rows = below ? below.slice(0) : [], r, phase = phi0, Tr, row;
      for (r = 0; r < (maxRows || 1000); r++) {
        Tr = U && r % 2 ? U : T;
        if (r > 0) {
          if (U) phase += r % 2 ? s : (s2 === undefined ? s : s2);
          else phase = zigzag ? phi0 + (r % 2) * s : phi0 + r * s;
        }
        phase = ((phase % Tr.P) + Tr.P) % Tr.P;
        row = makeRow(ctx, rows, Tr, phase, false);
        if (!row) break;
        rows.push(row);
      }
      return rows;
    }

    function layoutStats(rows) {
      var n = 0, top = 0, i;
      for (i = 0; i < rows.length; i++) { n += rows[i].pieces.length; top = Math.max(top, rows[i].top); }
      return { n: n, top: top };
    }

    function flatten(rows) {
      var out = [], i, j;
      for (i = 0; i < rows.length; i++) for (j = 0; j < rows[i].pieces.length; j++) {
        rows[i].pieces[j].row = i;
        out.push(rows[i].pieces[j]);
      }
      return out;
    }

    function shiftOptions(ctx, T, U) {
      var N = 96, k, s, v, best = null, keep = null, slack = Math.min(T.slack || 0, U.slack || 0), out = [];
      for (k = 0; k < N; k++) {
        s = T.P * k / N;
        v = periodicOffset(ctx, T, U, s);
        if (!best || v < best.v) best = { s: s, v: v };
        if (Math.min(s, T.P - s) <= slack + 1e-9 && (!keep || v < keep.v)) keep = { s: s, v: v };
      }
      out.push(best ? best.s : 0);
      if (keep && Math.abs(keep.s - out[0]) > 1e-9) out.push(keep.s);
      if (out.indexOf(0) < 0) out.push(0);
      return out;
    }

    // Pha để hàng của mẫu T nằm giữa khoảng [a, b] (mặc định cả bề rộng tờ).
    function centredPhase(ctx, T, a, b) {
      var qs = rowPositions(ctx, T, 0), x0 = POS, x1 = NEG, i;
      if (a === undefined) { a = 0; b = ctx.W; }
      for (i = 0; i < qs.length; i++) { x0 = Math.min(x0, qs[i].x); x1 = Math.max(x1, qs[i].x + qs[i].w); }
      if (!qs.length) return 0;
      return (((a + b) / 2 - (x0 + x1) / 2) % T.P + T.P) % T.P;
    }

    function searchBlocks(ctx, templates, nPhi) {
      var cands = [], ti, T, si, z, pi, list, rows, st, U, ups, downs, ua, da, phi;
      function push(rowsIn, desc, gen) {
        var st0 = layoutStats(rowsIn);
        if (st0.n) cands.push({ rows: rowsIn, n: st0.n, top: st0.top, desc: desc, gen: gen });
      }
      for (ti = 0; ti < templates.length && !ctx.late(); ti++) {
        T = templates[ti];
        list = [0];
        for (si = 0; si < T.shifts.length; si++) list.push(T.shifts[si].s);
        for (si = 0; si < list.length; si++) for (z = 0; z < 2; z++) {
          if (z === 1 && (list[si] === 0 || Math.abs(list[si] * 2 - T.P) < 1e-6)) continue;
          for (pi = 0; pi <= nPhi; pi++) {
            phi = pi < nPhi ? T.P * pi / nPhi : centredPhase(ctx, T);
            push(buildBlock(ctx, T, phi, list[si], z === 1, null, 0), T.key + (z ? " zigzag" : " so le"),
              { T: T, s: list[si], z: z === 1, U: null });
          }
        }
        U = rotateTemplate(ctx, T);
        if (!U) continue;
        ups = shiftOptions(ctx, T, U); downs = shiftOptions(ctx, U, T);
        for (ua = 0; ua < ups.length; ua++) for (da = 0; da < downs.length; da++)
          for (pi = 0; pi < nPhi; pi++) {
            push(buildBlock(ctx, T, T.P * pi / nPhi, ups[ua], false, null, 0, U, downs[da]), T.key + " thuận/ngược",
              { T: T, s: ups[ua], z: false, U: U, s2: downs[da] });
            push(buildBlock(ctx, U, U.P * pi / nPhi, downs[da], false, null, 0, T, ups[ua]), U.key + " thuận/ngược",
              { T: U, s: downs[da], z: false, U: T, s2: ups[ua] });
          }
      }
      return cands;
    }

    // Pha cho dải đặt lên trên: dò riêng hàng đầu của dải (12 pha + tinh chỉnh), giữ pha cho hàng đầu thấp nhất
    // (lồng sát hàng dưới nhất) và pha nhiều con nhất, tinh chỉnh quanh đó; thêm pha canh giữa tờ và
    // canh theo hàng dưới cho bố cục cân đối. Dải lồng khớp hay không quyết định cả dải vừa thêm hàng.
    function bandPhases(ctx, below, T2, lx0, lx1) {
      var list = [], k, ph, row, out = [], P = T2.P, i, j, dup, cand, best;
      function probe(phv) {
        phv = ((phv % P) + P) % P;
        row = makeRow(ctx, below, T2, phv, false);
        if (row) list.push({ ph: phv, top: row.top, n: row.n });
      }
      for (k = 0; k < 12; k++) probe(P * k / 12);
      list.sort(function (a, b) { return a.top - b.top || b.n - a.n; });
      best = list.slice(0, 2);
      for (i = 0; i < best.length; i++) for (k = -2; k <= 2; k++) if (k) probe(best[i].ph + k * P / 48);
      list.sort(function (a, b) { return a.top - b.top || b.n - a.n; });
      cand = list.slice(0, 2).map(function (e) { return e.ph; });
      list.sort(function (a, b) { return b.n - a.n || a.top - b.top; });
      if (list.length) cand.push(list[0].ph);
      cand.push(centredPhase(ctx, T2), centredPhase(ctx, T2, lx0, lx1));
      for (i = 0; i < cand.length; i++) {
        dup = false;
        for (j = 0; j < out.length; j++) if (Math.abs(out[j] - cand[i]) < 1e-6) dup = true;
        if (!dup) out.push(cand[i]);
      }
      return out;
    }

    // Dựng lại từ hàng r với pha mới; các hàng trên giữ mẫu/pha, hạ sát xuống; hàng tràn thì bỏ.
    function rebuildFrom(ctx, rows, r, phase) {
      var out = rows.slice(0, r), i, row;
      for (i = r; i < rows.length; i++) {
        row = makeRow(ctx, out, rows[i].T, i === r ? phase : rows[i].phase, false);
        if (row) out.push(row);
      }
      return out;
    }

    // Thêm hàng lên phần còn trống phía trên (mẫu bất kỳ) tới khi không vừa nữa.
    function appendRows(ctx, rows, templates, nPhi) {
      var out = rows.slice(0), guard = 0, best, ti, pi, T, add;
      while (guard++ < 60) {
        best = null;
        for (ti = 0; ti < templates.length; ti++) {
          T = templates[ti];
          for (pi = 0; pi < nPhi; pi++) {
            add = makeRow(ctx, out, T, T.P * pi / nPhi, false);
            if (add && (!best || add.n > best.n || (add.n === best.n && add.top < best.top))) best = add;
          }
        }
        if (!best) break;
        out.push(best);
      }
      return out;
    }

    // "Di chuyển cả cụm qua trái/phải": dịch từng hàng (giữ mẫu) để các hàng trên hạ thấp hơn
    // hoặc thêm được con, rồi dùng phần đỉnh vừa dư để thêm hàng.
    function optimiseRowPhases(ctx, rows, templates) {
      var best = rows, bs = layoutStats(rows), pass, r, k, T, cand, ph, trial, ts, improved, grown, gs;
      for (pass = 0; pass < 2; pass++) {
        improved = false;
        for (r = 0; r < best.length && !ctx.late(); r++) {
          T = best[r].T; cand = [];
          for (k = 0; k < 24; k++) cand.push(T.P * k / 24);
          for (k = 0; r > 0 && k < (T.shifts || []).length; k++) {
            cand.push(best[r - 1].phase + T.shifts[k].s);
            cand.push(best[r - 1].phase - T.shifts[k].s);
          }
          for (k = 0; k < cand.length; k++) {
            ph = ((cand[k] % T.P) + T.P) % T.P;
            if (Math.abs(ph - best[r].phase) < 1e-6) continue;
            trial = rebuildFrom(ctx, best, r, ph);
            ts = layoutStats(trial);
            if (ts.n > bs.n || (ts.n === bs.n && ts.top < bs.top - 0.05)) { best = trial; bs = ts; improved = true; }
          }
        }
        if (!improved) break;
      }
      grown = appendRows(ctx, best, templates, 8); gs = layoutStats(grown);
      return gs.n > bs.n ? grown : best;
    }

    // ---------- Né PON + canh giữa ----------
    // Tìm phép dịch cả bố cục (trong phần dư) né PON nhiều con nhất, rồi gần tâm tờ nhất.
    function optimiseShift(ctx, pieces) {
      var x0 = POS, y0 = POS, x1 = NEG, y1 = NEG, i, j, p, d, ex, ey, risky = [], dxLo, dxHi, dyLo, dyHi, cx, cy;
      for (i = 0; i < pieces.length; i++) {
        p = pieces[i];
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.h);
      }
      dxLo = -x0; dxHi = ctx.W - x1; dyLo = -y0; dyHi = ctx.H - y1;
      if (dxHi < dxLo) dxHi = dxLo;
      if (dyHi < dyLo) dyHi = dyLo;
      cx = (dxLo + dxHi) / 2; cy = (dyLo + dyHi) / 2;
      for (i = 0; i < pieces.length; i++) {
        p = pieces[i];
        for (j = 0; j < ctx.dots.length; j++) {
          d = ctx.dots[j];
          ex = Math.max(p.x + dxLo - d.x, d.x - (p.x + p.w + dxHi), 0);
          ey = Math.max(p.y + dyLo - d.y, d.y - (p.y + p.h + dyHi), 0);
          if (ex * ex + ey * ey < d.R * d.R + 1) { risky.push(p); break; }
        }
      }
      function blocked(dx, dy) {
        var b = 0, k;
        for (k = 0; k < risky.length; k++) if (!ctx.ponSafe(risky[k].o, risky[k].x + dx, risky[k].y + dy)) b++;
        return b;
      }
      var bc = blocked(cx, cy);
      if (!bc || !risky.length) return { dx: cx, dy: cy, blocked: bc };
      var best = null, a, c, dx, dy, bb, dist, top = [];
      function tryAt(tx, ty) {
        if (tx < dxLo - 1e-9 || tx > dxHi + 1e-9 || ty < dyLo - 1e-9 || ty > dyHi + 1e-9) return;
        bb = blocked(tx, ty);
        dist = (tx - cx) * (tx - cx) + (ty - cy) * (ty - cy);
        var cand = { dx: tx, dy: ty, b: bb, dist: dist };
        if (!best || bb < best.b || (bb === best.b && dist < best.dist)) best = cand;
        top.push(cand);
      }
      // Lưới thô theo độ dư (bước <= ~1 mm), thêm hai đường qua tâm, rồi lưới mịn quanh các điểm tốt.
      var nx = Math.max(1, Math.min(40, Math.ceil(dxHi - dxLo))), ny = Math.max(1, Math.min(40, Math.ceil(dyHi - dyLo)));
      for (a = 0; a <= nx; a++) for (c = 0; c <= ny; c++) tryAt(dxLo + (dxHi - dxLo) * a / nx, dyLo + (dyHi - dyLo) * c / ny);
      for (a = 0; a <= 4 * nx; a++) tryAt(dxLo + (dxHi - dxLo) * a / (4 * nx), cy);
      for (c = 0; c <= 4 * ny; c++) tryAt(cx, dyLo + (dyHi - dyLo) * c / (4 * ny));
      top.sort(function (u, v) { return u.b - v.b || u.dist - v.dist; });
      var seeds = top.slice(0, 6), si, hx = (dxHi - dxLo) / nx, hy = (dyHi - dyLo) / ny;
      for (si = 0; si < seeds.length; si++)
        for (a = -3; a <= 3; a++) for (c = -3; c <= 3; c++) tryAt(seeds[si].dx + a * hx / 3, seeds[si].dy + c * hy / 3);
      if (bc <= best.b) return { dx: cx, dy: cy, blocked: bc };
      // Tiến dần về tâm từ phương án tốt nhất mà không thêm con bị chặn.
      var lo = 0, hi = 1, mid, it, bx = best.dx, by = best.dy, tx, ty;
      for (it = 0; it < 24; it++) {
        mid = (lo + hi) / 2; tx = bx + (cx - bx) * mid; ty = by + (cy - by) * mid;
        if (blocked(tx, ty) <= best.b) { lo = mid; best.dx = tx; best.dy = ty; } else hi = mid;
      }
      return { dx: best.dx, dy: best.dy, blocked: best.b };
    }

    // Số con chạm PON khi canh giữa nguyên bố cục (dùng để xếp hạng nhanh).
    function centreBlocked(ctx, pieces) {
      var x0 = POS, y0 = POS, x1 = NEG, y1 = NEG, i, p, dx, dy, b = 0, j, d, ex, ey, near;
      for (i = 0; i < pieces.length; i++) {
        p = pieces[i];
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.h);
      }
      dx = (ctx.W - x1 - x0) / 2; dy = (ctx.H - y1 - y0) / 2;
      for (i = 0; i < pieces.length; i++) {
        p = pieces[i]; near = false;
        for (j = 0; j < ctx.dots.length; j++) {
          d = ctx.dots[j];
          ex = Math.max(p.x + dx - d.x, d.x - (p.x + p.w + dx), 0);
          ey = Math.max(p.y + dy - d.y, d.y - (p.y + p.h + dy), 0);
          if (ex * ex + ey * ey < d.R * d.R) { near = true; break; }
        }
        if (near && !ctx.ponSafe(p.o, p.x + dx, p.y + dy)) b++;
      }
      return b;
    }

    // Sau khi bỏ các con không né được PON: canh giữa đúng khung các con còn lại nếu PON cho phép.
    // Bị PON chặn thì giữ đúng tâm ít nhất một trục, trục còn lại lệch ít nhất có thể.
    function centreKept(ctx, kept, dx, dy) {
      var x0 = POS, y0 = POS, x1 = NEG, y1 = NEG, i, p, tx, ty;
      for (i = 0; i < kept.length; i++) {
        p = kept[i];
        x0 = Math.min(x0, p.x + dx); y0 = Math.min(y0, p.y + dy);
        x1 = Math.max(x1, p.x + p.w + dx); y1 = Math.max(y1, p.y + p.h + dy);
      }
      tx = (ctx.W - x1 - x0) / 2; ty = (ctx.H - y1 - y0) / 2;
      var sxLo = -x0, sxHi = ctx.W - x1, syLo = -y0, syHi = ctx.H - y1;
      function safe(sx, sy) {
        for (var k = 0; k < kept.length; k++) {
          var q = kept[k], qx = q.x + dx + sx, qy = q.y + dy + sy;
          if (qx < -1e-6 || qy < -1e-6 || qx + q.w > ctx.W + 1e-6 || qy + q.h > ctx.H + 1e-6) return false;
          if (!ctx.ponSafe(q.o, qx, qy)) return false;
        }
        return true;
      }
      if (safe(tx, ty)) return { dx: dx + tx, dy: dy + ty };
      // Giữ một trục đúng tâm, dò trục kia: điểm an toàn gần tâm nhất rồi chia đôi tới biên chặn.
      function along(fixedX, fixedValue, lo, hi, target) {
        var N = 160, k, v, bestV = null, bestD = POS, d;
        for (k = 0; k <= N; k++) {
          v = lo + (hi - lo) * k / N;
          if (!(fixedX ? safe(fixedValue, v) : safe(v, fixedValue))) continue;
          d = Math.abs(v - target);
          if (d < bestD) { bestD = d; bestV = v; }
        }
        if (bestV === null) return null;
        var a = bestV, b = target, it, m;
        for (it = 0; it < 30; it++) {
          m = (a + b) / 2;
          if (fixedX ? safe(fixedValue, m) : safe(m, fixedValue)) a = m; else b = m;
        }
        return { v: a, d: Math.abs(a - target) };
      }
      var A = along(true, tx, syLo, syHi, ty), Bq = along(false, ty, sxLo, sxHi, tx);
      if (A && (!Bq || A.d <= Bq.d)) return { dx: dx + tx, dy: dy + A.v };
      if (Bq) return { dx: dx + Bq.v, dy: dy + ty };
      var lo = 0, hi = 1, mid, it2;
      for (it2 = 0; it2 < 24; it2++) {
        mid = (lo + hi) / 2;
        if (safe(tx * mid, ty * mid)) lo = mid; else hi = mid;
      }
      return { dx: dx + tx * lo, dy: dy + ty * lo };
    }

    // ---------- Khép đúng khe bằng tiếp xúc chính xác ----------
    function exactTemplate(ctx, T) {
      if (T.exact) return T.exact;
      var el = T.el, P, out, a, b, dy, d, back;
      if (el.length === 1) {
        P = ctx.exactH(el[0].o, el[0].o, 0);
        out = { el: [{ o: el[0].o, x: 0, y: el[0].y }], P: P };
      } else {
        a = el[0].o; b = el[1].o; dy = el[1].y - el[0].y;
        d = ctx.exactH(a, b, dy); back = ctx.exactH(b, a, -dy);
        if (d === NEG) d = 0;
        if (back === NEG) back = 0;
        P = Math.max(d + back, ctx.exactH(a, a, 0), ctx.exactH(b, b, 0));
        out = { el: [{ o: a, x: 0, y: el[0].y }, { o: b, x: d + (P - d - back) / 2, y: el[1].y }], P: P };
      }
      if (!(out.P > 0) || out.P > T.P + 1e-9) out = { el: T.el, P: T.P };
      T.exact = out;
      return out;
    }

    // Dựng lại bố cục bằng tiếp xúc chính xác: bước hàng thu về đúng khe (neo theo tâm tờ),
    // mỗi hàng hạ sát hàng dưới theo đường bế thật.
    function refineExact(ctx, rows) {
      var out = [], r, row, T, X, f, c, anchor0, kLo, kHi, k, i, e, sh, x, qs, Y, pieces, top, q, y;
      for (r = 0; r < rows.length; r++) {
        row = rows[r]; T = row.T; X = exactTemplate(ctx, T); f = X.P / T.P;
        c = ctx.W / 2; anchor0 = c + (row.phase - c) * f;
        kLo = -Math.ceil((anchor0 + 1e-9) / X.P) - 2; kHi = Math.ceil((ctx.W - anchor0) / X.P) + 2;
        qs = [];
        for (k = kLo; k <= kHi; k++) for (i = 0; i < X.el.length; i++) {
          e = X.el[i]; sh = ctx.s[e.o]; x = anchor0 + k * X.P + e.x;
          if (x < -1e-6 || x + sh.w > ctx.W + 1e-6) continue;
          qs.push({ o: e.o, x: x, ey: e.y, w: sh.w, h: sh.h });
        }
        qs.sort(function (u, v) { return u.x - v.x; });
        if (!qs.length) continue;
        Y = out.length ? rowOffset(ctx, out, qs, true) : row.Y;
        if (Y === NEG || Y < 0) Y = 0;
        pieces = []; top = NEG;
        for (i = 0; i < qs.length; i++) {
          q = qs[i]; y = Y + q.ey;
          if (y + q.h > ctx.H + 1e-6) continue;
          pieces.push({ o: q.o, x: q.x, y: y, w: q.w, h: q.h });
          if (y + q.h > top) top = y + q.h;
        }
        if (pieces.length) out.push({ T: T, phase: anchor0, Y: Y, pieces: pieces, top: top, n: pieces.length });
      }
      return out;
    }

    // ---------- Lấp chỗ trống ----------
    // Hai con tách được theo một trong bốn hướng (trên/dưới/trái/phải) theo bảng tiếp xúc bảo thủ.
    function separated(ctx, p, q) {
      var g = ctx.g;
      if (q.x >= p.x + p.w + g || p.x >= q.x + q.w + g || q.y >= p.y + p.h + g || p.y >= q.y + q.h + g) return true;
      if (q.x >= p.x + ctx.hAt(p.o, q.o, q.y - p.y) - 1e-9) return true;
      if (p.x >= q.x + ctx.hAt(q.o, p.o, p.y - q.y) - 1e-9) return true;
      if (q.y >= p.y + ctx.vAt(p.o, q.o, q.x - p.x) - 1e-9) return true;
      if (p.y >= q.y + ctx.vAt(q.o, p.o, p.x - q.x) - 1e-9) return true;
      return false;
    }

    // Trượt thêm con vào từ bốn phía (đầu/cuối hàng, dải trên/dưới, góc PON); mọi vị trí phải tách
    // được với mọi con lân cận và né PON. Ưu tiên vị trí thấp-trái để các con lấp sau còn chỗ.
    function freeFill(ctx, pieces, maxAdd) {
      var added = [], all = pieces.slice(0), uniq = ctx.p.uniq, g = ctx.g, cell = 1, bins = {}, i;
      for (i = 0; i < ctx.s.length; i++) cell = Math.max(cell, ctx.s[i].w + g, ctx.s[i].h + g);
      function binAdd(p) {
        var x0 = Math.floor(p.x / cell), x1 = Math.floor((p.x + p.w) / cell), y0 = Math.floor(p.y / cell), y1 = Math.floor((p.y + p.h) / cell), bx, by, key;
        for (bx = x0; bx <= x1; bx++) for (by = y0; by <= y1; by++) {
          key = bx + "," + by;
          if (!bins[key]) bins[key] = [];
          bins[key].push(p);
        }
      }
      for (i = 0; i < all.length; i++) binAdd(all[i]);
      function valid(cn) {
        if (cn.x < -1e-6 || cn.y < -1e-6 || cn.x + cn.w > ctx.W + 1e-6 || cn.y + cn.h > ctx.H + 1e-6) return false;
        var x0 = Math.floor((cn.x - g) / cell), x1 = Math.floor((cn.x + cn.w + g) / cell), y0 = Math.floor((cn.y - g) / cell), y1 = Math.floor((cn.y + cn.h + g) / cell), bx, by, list, k;
        for (bx = x0; bx <= x1; bx++) for (by = y0; by <= y1; by++) {
          list = bins[bx + "," + by];
          if (!list) continue;
          for (k = 0; k < list.length; k++) if (!separated(ctx, list[k], cn)) return false;
        }
        return ctx.ponSafe(cn.o, cn.x, cn.y);
      }
      var ui, o, sh, w, h, step, x, y, xl, yt, p, c, t, cands, best, band, bi2, list2;
      // Chỉ mục theo dải ngang (cho trượt ngang) và dải dọc (cho trượt dọc).
      function bands(axisY) {
        var out = {}, k, q, a0, a1, b;
        for (k = 0; k < all.length; k++) {
          q = all[k];
          a0 = Math.floor(((axisY ? q.y : q.x) - g) / cell); a1 = Math.floor(((axisY ? q.y + q.h : q.x + q.w) + g) / cell);
          for (b = a0; b <= a1; b++) { if (!out[b]) out[b] = []; out[b].push(q); }
        }
        return out;
      }
      var stamp = 0;
      function near(idx, lo, hi) {
        var out = [], b, k, q, l;
        stamp++;
        for (b = Math.floor(lo / cell); b <= Math.floor(hi / cell); b++) {
          l = idx[b];
          if (!l) continue;
          for (k = 0; k < l.length; k++) { q = l[k]; if (q._seen !== stamp) { q._seen = stamp; out.push(q); } }
        }
        return out;
      }
      while (added.length < maxAdd && !ctx.late()) {
        cands = [];
        var rowsIdx = bands(true), colsIdx = bands(false);
        for (ui = 0; ui < uniq.length; ui++) {
          o = uniq[ui]; sh = ctx.s[o]; w = sh.w; h = sh.h;
          if (w > ctx.W || h > ctx.H) continue;
          step = Math.max(0.25, Math.min(w, h) / 32);
          for (y = 0; y <= ctx.H - h + 1e-9; y += step) {
            x = 0; xl = ctx.W - w;
            list2 = near(rowsIdx, y - g, y + h + g);
            for (i = 0; i < list2.length; i++) {
              p = list2[i];
              if (p.y >= y + h + g || y >= p.y + p.h + g) continue;
              c = ctx.hAt(p.o, o, y - p.y); if (c !== NEG && p.x + c > x) x = p.x + c;
              c = ctx.hAt(o, p.o, p.y - y); if (c !== NEG && p.x - c < xl) xl = p.x - c;
            }
            if (x + w <= ctx.W + 1e-9) cands.push({ o: o, x: x, y: y, w: w, h: h, score: y * 1000 + x });
            if (xl >= -1e-9) cands.push({ o: o, x: xl, y: y, w: w, h: h, score: y * 1000 + xl });
          }
          for (x = 0; x <= ctx.W - w + 1e-9; x += step) {
            y = 0; yt = ctx.H - h;
            list2 = near(colsIdx, x - g, x + w + g);
            for (i = 0; i < list2.length; i++) {
              p = list2[i];
              if (p.x >= x + w + g || x >= p.x + p.w + g) continue;
              c = ctx.vAt(p.o, o, x - p.x); if (c !== NEG && p.y + c > y) y = p.y + c;
              c = ctx.vAt(o, p.o, p.x - x); if (c !== NEG && p.y - c < yt) yt = p.y - c;
            }
            if (y + h <= ctx.H + 1e-9) cands.push({ o: o, x: x, y: y, w: w, h: h, score: y * 1000 + x });
            if (yt >= -1e-9) cands.push({ o: o, x: x, y: yt, w: w, h: h, score: yt * 1000 + x });
          }
        }
        cands.sort(function (u, v) { return u.score - v.score || u.o - v.o; });
        best = null;
        for (t = 0; t < cands.length; t++) if (valid(cands[t])) { best = cands[t]; break; }
        if (!best) break;
        delete best.score;
        best.fill = true;
        added.push(best); all.push(best); binAdd(best);
      }
      return added;
    }

    // Điểm gọn đẹp (nhỏ = đẹp): ít đổi mẫu hàng, so le đều, ít con lấp lẻ, lề cân hai bên.
    function neatScore(ctx, L) {
      var rows = L.rows || [], changes = 0, r, steps = {}, nSteps = 0, key, prev, d;
      for (r = 1; r < rows.length; r++) {
        if (rows[r].T !== rows[r - 1].T && (r < 2 || rows[r].T !== rows[r - 2].T)) changes++;
        prev = rows[r].T === rows[r - 1].T ? rows[r - 1] : (r >= 2 && rows[r].T === rows[r - 2].T ? rows[r - 2] : null);
        if (prev) {
          d = ((rows[r].phase - prev.phase) % rows[r].T.P + rows[r].T.P) % rows[r].T.P;
          key = rows[r].T.key + ":" + Math.round(d * 4);
          if (!steps[key]) { steps[key] = 1; nSteps++; }
        }
      }
      var pcs = L.pieces || [], x0 = POS, x1 = NEG, y0 = POS, y1 = NEG, i, fill = 0, sh = L.shift || { dx: 0, dy: 0 };
      for (i = 0; i < pcs.length; i++) {
        x0 = Math.min(x0, pcs[i].x); x1 = Math.max(x1, pcs[i].x + pcs[i].w);
        y0 = Math.min(y0, pcs[i].y); y1 = Math.max(y1, pcs[i].y + pcs[i].h);
        if (pcs[i].fill) fill++;
      }
      var asym = Math.abs((x0 + sh.dx) - (ctx.W - x1 - sh.dx)) + Math.abs((y0 + sh.dy) - (ctx.H - y1 - sh.dy));
      return 10 * changes + 3 * Math.max(0, nSteps - 2) + 2 * fill + asym;
    }

    function evaluate(ctx, rows) {
      var pieces = flatten(rows), sh = optimiseShift(ctx, pieces);
      return { rows: rows, pieces: pieces, shift: sh, count: pieces.length - sh.blocked };
    }

    // Dựng lại từ hàng r: mọi hàng từ r trở lên dịch ngang thêm delta (giữ mẫu), xếp chồng lại sát nhau.
    function shiftFrom(ctx, rows, r, delta) {
      var out = rows.slice(0, r), i, row;
      for (i = r; i < rows.length; i++) {
        row = makeRow(ctx, out, rows[i].T, rows[i].phase + delta, false);
        if (row) out.push(row);
      }
      return out;
    }

    // "Dịch cả cụm" có tính PON: cắt bố cục ở ranh giới dải (chỗ đổi mẫu hàng) hoặc ở hàng đầu/cuối,
    // dịch ngang cả phần phía trên so với phần dưới rồi chấm bằng số con thật sau khi né PON.
    // Nhận khi thêm con, hoặc cùng số con mà gọn hơn.
    function bandShift(ctx, ev) {
      var rows = ev.rows, best = ev, bestNeat = neatScore(ctx, ev), cuts = [], r, ci, k, K = 8, Pmax, delta, trial, st, e, nn,
        tried = {}, top3, ti, base, sub;
      if (rows.length < 2) return ev;
      for (r = 1; r < rows.length; r++)
        if (rows[r].T !== rows[r - 1].T && (r < 2 || rows[r].T !== rows[r - 2].T)) cuts.push(r);
      if (cuts.indexOf(1) < 0) cuts.push(1);
      if (cuts.indexOf(rows.length - 1) < 0) cuts.push(rows.length - 1);
      function attempt(rc, d) {
        var key = rc + ":" + Math.round(d * 1000);
        if (tried[key] || ctx.late()) return null;
        tried[key] = 1;
        trial = shiftFrom(ctx, rows, rc, d); st = layoutStats(trial);
        if (st.n < best.count) return null;
        e = evaluate(ctx, trial);
        if (e.count < best.count) return e;
        nn = neatScore(ctx, e);
        if (e.count > best.count || nn < bestNeat - 0.5) { best = e; bestNeat = nn; best.desc = (ev.desc || "") + " + dịch cụm né PON"; }
        return e;
      }
      for (ci = 0; ci < cuts.length && !ctx.late(); ci++) {
        r = cuts[ci]; Pmax = 0;
        for (k = r; k < rows.length; k++) Pmax = Math.max(Pmax, rows[k].T.P);
        top3 = [];
        for (k = -K; k < K; k++) {
          delta = Pmax * k / (2 * K);
          if (!k) continue;
          e = attempt(r, delta);
          if (e) top3.push({ d: delta, c: e.count });
        }
        top3.sort(function (u, v) { return v.c - u.c || Math.abs(u.d) - Math.abs(v.d); });
        for (ti = 0; ti < Math.min(3, top3.length); ti++) {
          base = top3[ti].d;
          for (sub = -3; sub <= 3; sub++) if (sub) attempt(r, base + sub * Pmax / (8 * K));
        }
      }
      return best;
    }

    // Một chiều tờ: khối → ghép dải → dịch hàng → chấm điểm có PON → khép chính xác → lấp trống.
    function solveSheet(ctx, opts) {
      var T = makeTemplates(ctx, opts.pairSamples), tpl, cands, base, seen = {}, bi, k, ti, pi, rr, key0, below, T2, built, st;
      if (!T.length) return null;
      tpl = pickTemplates(T, opts.templates);
      cands = searchBlocks(ctx, tpl, opts.phases);
      cands.sort(function (a, b) { return b.n - a.n || a.top - b.top; });
      if (opts.compose) {
        // Gốc ghép: vài khối dẫn đầu + khối tốt nhất của từng kiểu (mẫu hàng 1/hàng 2).
        // Ưu tiên mỗi mẫu hàng (đơn hay cặp) có một khối gốc thuần một mẫu, rồi tới các kiểu khối khác.
        base = cands.slice(0, 4);
        for (bi = 0; bi < cands.length; bi++) {
          rr = cands[bi].rows;
          if (rr.length > 1 && rr[1].T !== rr[0].T) continue;
          key0 = rr[0].T.key + "/" + (rr.length > 1 ? rr[1].T.key : "");
          if (seen[key0]) continue;
          seen[key0] = 1;
          if (base.indexOf(cands[bi]) < 0) base.push(cands[bi]);
        }
        for (bi = 0; bi < cands.length && base.length < 14; bi++) {
          rr = cands[bi].rows; key0 = rr[0].T.key + "/" + (rr.length > 1 ? rr[1].T.key : "");
          if (seen[key0]) continue;
          seen[key0] = 1;
          if (base.indexOf(cands[bi]) < 0) base.push(cands[bi]);
        }
        // Dải đặt lên trên: mỗi mẫu (thẳng/so le) + vài kiểu khối luân phiên thuận/ngược, zigzag tốt nhất.
        // Nhờ vậy cả hai thứ tự "dải A dưới, dải B trên" và "B dưới, A trên" đều được thử.
        var bands = [], bandSeen = {}, perPair = {}, gk, pk, gen;
        for (ti = 0; ti < tpl.length; ti++) {
          bands.push({ T: tpl[ti], s: 0, z: false, U: null });
          if (tpl[ti].shifts.length) bands.push({ T: tpl[ti], s: tpl[ti].shifts[0].s, z: false, U: null });
        }
        for (bi = 0; bi < cands.length && bands.length < 2 * tpl.length + 6; bi++) {
          gen = cands[bi].gen;
          if (!gen || !(gen.U || gen.z)) continue;
          gk = gen.T.key + "/" + (gen.U ? gen.U.key : "z") + "/" + Math.round(gen.s * 4) + "/" + Math.round((gen.s2 || 0) * 4);
          pk = gen.T.key + "/" + (gen.U ? gen.U.key : "z");
          if (bandSeen[gk] || (perPair[pk] || 0) >= 2) continue;
          bandSeen[gk] = 1; perPair[pk] = (perPair[pk] || 0) + 1;
          bands.push(gen);
        }
        // Phương án kém hơn số con dẫn đầu quá 6 con sẽ bị bỏ ở bước lọc trùng: không cần giữ (đỡ tốn bộ nhớ).
        var runMax = cands.length ? cands[0].n : 0;
        for (bi = 0; bi < base.length && !ctx.late(); bi++) {
          rr = base[bi].rows;
          // Khối một mẫu: thử cắt ở các hàng gần đáy và gần đỉnh (dải khác hướng nằm dưới/trên tuỳ PON);
          // khối khác: chỉ thay vài hàng trên cùng.
          var single = rr.length < 2 || rr[1].T === rr[0].T;
          for (k = single ? 1 : Math.max(1, rr.length - 2); k <= rr.length && !ctx.late(); k++) {
            // Dải thay thế nằm sát đáy (1–3 hàng) hoặc sát đỉnh (3 hàng cuối); cắt ở giữa khối hiếm khi lợi.
            if (single && k > 3 && k < rr.length - 3) continue;
            below = rr.slice(0, k);
            var lastRow = below[below.length - 1], lx0 = POS, lx1 = NEG, li, phCache = {};
            for (li = 0; li < lastRow.pieces.length; li++) {
              lx0 = Math.min(lx0, lastRow.pieces[li].x); lx1 = Math.max(lx1, lastRow.pieces[li].x + lastRow.pieces[li].w);
            }
            for (ti = 0; ti < bands.length; ti++) {
              gen = bands[ti]; T2 = gen.T;
              if (!gen.U && !gen.z && T2 === lastRow.T) continue;
              if (gen === base[bi].gen) continue;
              var phs = phCache[T2.key] || (phCache[T2.key] = bandPhases(ctx, below, T2, lx0, lx1));
              for (pi = 0; pi < phs.length; pi++) {
                built = buildBlock(ctx, T2, phs[pi], gen.s, gen.z, below, 0, gen.U, gen.s2);
                if (built.length === below.length) continue;
                st = layoutStats(built);
                if (st.n > runMax) runMax = st.n;
                if (st.n < runMax - 6) continue;
                cands.push({ rows: built, n: st.n, top: st.top, desc: "ghép dải" });
              }
            }
          }
        }
        cands.sort(function (a, b) { return b.n - a.n || a.top - b.top; });
      }
      // Bỏ các phương án trùng cấu trúc (cùng mẫu từng hàng, cùng số con từng hàng, cùng độ lệch
      // giữa các hàng): chúng chỉ khác nhau một phép tịnh tiến mà bước né PON/canh giữa đã thử.
      var topN = cands.length ? cands[0].n : 0, evals = [], i, ev, sigs = {}, sg, r, rowsI, dph, uniqC = [];
      for (i = 0; i < cands.length && uniqC.length < 400; i++) {
        if (cands[i].n < topN - 6) break;
        rowsI = cands[i].rows; sg = cands[i].n + ":";
        for (r = 0; r < rowsI.length; r++) {
          dph = r ? rowsI[r].phase - rowsI[r - 1].phase : 0;
          dph = ((dph % rowsI[r].T.P) + rowsI[r].T.P) % rowsI[r].T.P;
          sg += rowsI[r].T.key + "#" + rowsI[r].n + "@" + Math.round(dph * 4) + "|";
        }
        if (sigs[sg]) continue;
        sigs[sg] = 1;
        // Ước lượng nhanh: số con còn lại khi canh giữa (chưa né PON) để xếp hạng trước khi tìm kỹ.
        cands[i].quick = cands[i].n - centreBlocked(ctx, flatten(rowsI));
        uniqC.push(cands[i]);
      }
      uniqC.sort(function (a, b) { return b.quick - a.quick || b.n - a.n || a.top - b.top; });
      // Dịch từng hàng (giữ mẫu) cho vài phương án dẫn đầu theo ước lượng đã tính PON.
      if (opts.tune) {
        var tuned = [], sig = {}, ci, opt, os, tc;
        for (ci = 0; ci < uniqC.length && tuned.length < opts.tune && !ctx.late(); ci++) {
          key0 = uniqC[ci].n + "/" + uniqC[ci].rows.map(function (r0) { return r0.T.key; }).join(",");
          if (sig[key0]) continue;
          sig[key0] = 1;
          opt = optimiseRowPhases(ctx, uniqC[ci].rows, tpl); os = layoutStats(opt);
          if (os.n > uniqC[ci].n || (os.n === uniqC[ci].n && os.top < uniqC[ci].top)) {
            tc = { rows: opt, n: os.n, top: os.top, desc: uniqC[ci].desc + " + dịch hàng" };
            tc.quick = tc.n - centreBlocked(ctx, flatten(opt));
            tuned.push(tc);
          }
        }
        uniqC = uniqC.concat(tuned);
        uniqC.sort(function (a, b) { return b.quick - a.quick || b.n - a.n || a.top - b.top; });
      }
      for (i = 0; i < uniqC.length && evals.length < opts.evaluate; i++) {
        ev = evaluate(ctx, uniqC[i].rows); ev.desc = uniqC[i].desc;
        evals.push(ev);
      }
      evals.sort(function (a, b) { return b.count - a.count || neatScore(ctx, a) - neatScore(ctx, b); });
      // Dịch cả cụm (dải trên/dưới, hàng đầu/cuối) để né PON cho vài phương án dẫn đầu.
      for (i = 0; i < evals.length && i < opts.refine && !ctx.late(); i++) {
        ev = bandShift(ctx, evals[i]);
        if (ev !== evals[i]) evals[i] = ev;
      }
      evals.sort(function (a, b) { return b.count - a.count || neatScore(ctx, a) - neatScore(ctx, b); });
      var finals = [], ex, chosen, fill, all, sh2;
      for (i = 0; i < evals.length && i < opts.refine; i++) {
        ex = evaluate(ctx, refineExact(ctx, evals[i].rows)); ex.exact = true;
        chosen = ex.count >= evals[i].count ? ex : evals[i];
        finals.push({ pieces: chosen.pieces, shift: chosen.shift, count: chosen.count, rows: chosen.rows, fill: 0,
          exact: chosen === ex, desc: evals[i].desc });
      }
      finals.sort(function (a, b) { return b.count - a.count || neatScore(ctx, a) - neatScore(ctx, b); });
      // Lấp chỗ trống cho hai phương án dẫn đầu (lấp có thể đổi thứ hạng).
      for (i = 0; opts.fill && i < finals.length && i < 2; i++) {
        fill = freeFill(ctx, finals[i].pieces, opts.fill);
        if (!fill.length) continue;
        all = finals[i].pieces.concat(fill); sh2 = optimiseShift(ctx, all);
        if (all.length - sh2.blocked > finals[i].count)
          finals[i] = { pieces: all, shift: sh2, count: all.length - sh2.blocked, rows: finals[i].rows, fill: fill.length,
            exact: finals[i].exact, desc: finals[i].desc };
      }
      finals.sort(function (a, b) { return b.count - a.count || neatScore(ctx, a) - neatScore(ctx, b); });
      return finals[0] || null;
    }

    // input: như nest(); groups = khuôn dùng chung. Trả về slots trong toạ độ tờ (mm, y lên).
    function plan(input, groups, curveError, budgetMs, deadlineAt, effort) {
      var began = now(), gap = Number(input.gapMm), margin = Number(input.marginMm), ponClear = Number(input.ponClearMm);
      var W = Number(input.sheet.widthMm) - 2 * margin, H = Number(input.sheet.heightMm) - 2 * margin;
      var ce = Math.min(0.025, Math.max(0, Number(curveError) || 0)), span = 0, gi, ci, pi, p;
      for (gi = 0; gi < groups.length; gi++) for (ci = 0; ci < groups[gi].length; ci++)
        for (pi = 0; pi < groups[gi][ci].length; pi++) {
          p = groups[gi][ci][pi];
          span = Math.max(span, Math.abs(p[0]), Math.abs(p[1]));
        }
      // Lưới tính bảng tiếp xúc theo cỡ khuôn; khe tìm/khép = khe nhập + dự phòng sai số cong hai khuôn.
      var res = Math.min(0.2, Math.max(0.02, span / 600));
      var g = gap + 2 * ce + (ce > 0 ? 0.000001 : 0);
      var prep = prepareShapes(groups, g, res), s0 = prep.shapes[0];
      if (!(s0.w > 0 && s0.h > 0)) return null;
      // Ước lượng số con để chọn mức tìm kiếm (khuôn tí hon hàng nghìn con: tìm gọn hơn).
      var est = (W * H) / Math.max(1e-6, (s0.w + gap) * (s0.h + gap));
      // Mức "quick" (bộ chia khu dàn thử nhiều khu): tìm gọn như khuôn tí hon, bất kể cỡ khuôn.
      var opts = est > 2500 || effort === "quick" ? { pairSamples: 0, templates: 3, phases: 4, compose: false, tune: 0, evaluate: 6, refine: 1, fill: 0, fillMs: 0 } :
        est > 500 ? { pairSamples: 16, templates: 5, phases: 12, compose: false, tune: 1, evaluate: 12, refine: 2, fill: 20, fillMs: 250 } :
          { pairSamples: 40, templates: 8, phases: 24, compose: true, tune: 4, evaluate: 30, refine: 3, fill: 40, fillMs: 400 };
      // Khối lượng tìm đã giới hạn cố định theo cỡ bài (kết quả lặp lại được); hạn giờ chỉ là chốt an toàn.
      var budget = Math.max(6000, Math.min(20000, (Number(budgetMs) || 1500) * 3));
      if (deadlineAt && deadlineAt - began < budget) budget = Math.max(1, deadlineAt - began);
      var best = null, which, transposed, dots, ctx, sol, d, x, y, Rr;
      for (which = 0; which < 2; which++) {
        transposed = which === 1; dots = [];
        for (d = 0; d < (input.sheet.dots || []).length; d++) {
          x = Number(input.sheet.dots[d].x) - margin; y = Number(input.sheet.dots[d].y) - margin;
          Rr = Number(input.sheet.dots[d].r) + ponClear + ce + 0.000002;
          dots.push(transposed ? { x: H - y, y: x, R: Rr } : { x: x, y: y, R: Rr });
        }
        ctx = new Ctx(prep, transposed ? H : W, transposed ? W : H, dots, began + budget * (which ? 1 : 0.55));
        sol = solveSheet(ctx, opts);
        if (!sol) continue;
        sol.transposed = transposed; sol.ctx = ctx;
        if (!best || sol.count > best.count || (sol.count === best.count && neatScore(ctx, sol) < neatScore(best.ctx, best))) best = sol;
      }
      if (!best) return null;
      ctx = best.ctx;
      var kept = [], i, q;
      for (i = 0; i < best.pieces.length; i++) {
        q = best.pieces[i];
        if (ctx.ponSafe(q.o, q.x + best.shift.dx, q.y + best.shift.dy)) kept.push(q);
      }
      var cen = centreKept(ctx, kept, best.shift.dx, best.shift.dy);
      // Thứ tự đọc: theo hàng (hàng trên cùng trước), trong hàng từ trái sang; con lấp lẻ sau cùng.
      kept.sort(function (a, b) {
        var ra = a.fill ? -1 : a.row, rb = b.fill ? -1 : b.row;
        if (ra !== rb) return rb - ra;
        return a.x - b.x || a.y - b.y;
      });
      var slots = [], o, ox, oy;
      for (i = 0; i < kept.length; i++) {
        q = kept[i]; x = q.x + cen.dx; y = q.y + cen.dy; o = q.o; ox = x; oy = y;
        if (best.transposed) { o = (q.o + 3) % 4; ox = y; oy = H - x - q.w; }
        slots.push({ vi: o, x: margin + ox, y: margin + oy });
      }
      return { slots: slots, count: slots.length, transposed: best.transposed, fill: best.fill, exact: best.exact,
        desc: best.desc, ms: now() - began, rows: best.rows.length, neat: neatScore(ctx, best) };
    }

    return { plan: plan, prepareShapes: prepareShapes, exactRight: exactRight, stripEnvelope: stripEnvelope,
      contactTable: contactTable, dilateHigh: dilateHigh, tableAt: tableAt, simplifyClosed: simplifyClosed, orientShape: orientShape };
  })();

  // Các bài có khuôn bế giống hệt nhau (chỉ khác toạ độ nguồn, điểm bắt đầu, chiều path) dàn chung.
  function sharedCutter(input) {
    var first = normalizeGroups(input.types[0].groups || []), ti, g;
    if (!first) return null;
    for (ti = 1; ti < input.types.length; ti++) {
      g = normalizeGroups(input.types[ti].groups || []);
      if (!g || !sameGroups(first, g)) return null;
    }
    return first;
  }

  function cutterVariants(groups, curve) {
    var out = [], vi, rg, b;
    for (vi = 0; vi < 4; vi++) {
      rg = rotateGroups(groups, vi * 90); b = boundsOfGroups(rg);
      out.push({ mi: 0, vi: vi, angle: vi * 90, groups: rg, w: b.w, h: b.h, curveErrorMm: curve });
    }
    return out;
  }

  // Hướng chuẩn của khuôn: cùng một khuôn đặt nguồn xoay 0/90/180/270 phải ra cùng bố cục.
  // Chọn hướng có khung ngang (rộng >= cao), rồi trọng tâm diện tích thấp nhất, rồi lệch trái nhất.
  function canonicalTurn(groups) {
    var best = -1, bestKey = null, k, rg, b, gi, ci, i, c, a, cx, cy, area, cross, key, j;
    for (k = 0; k < 4; k++) {
      rg = rotateGroups(groups, k * 90); b = boundsOfGroups(rg);
      cx = 0; cy = 0; area = 0;
      for (gi = 0; gi < rg.length; gi++) for (ci = 0; ci < rg[gi].length; ci++) {
        c = rg[gi][ci];
        for (i = 0; i < c.length; i++) {
          a = c[i]; j = c[(i + 1) % c.length];
          cross = a[0] * j[1] - j[0] * a[1];
          area += cross; cx += (a[0] + j[0]) * cross; cy += (a[1] + j[1]) * cross;
        }
      }
      if (abs(area) > 1e-12) { cx /= 3 * area; cy /= 3 * area; } else { cx = b.w / 2; cy = b.h / 2; }
      key = [b.w >= b.h - 1e-6 ? 0 : 1, Math.round(cy / Math.max(b.h, 1e-9) * 1e6), Math.round(cx / Math.max(b.w, 1e-9) * 1e6)];
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] ||
          (key[1] === bestKey[1] && key[2] < bestKey[2])))) { bestKey = key; best = k; }
    }
    return best < 0 ? 0 : best;
  }

  // Chốt chặn độc lập cho kết quả lõi xếp hàng: đường bế đã làm phẳng + khe + dự phòng cong, lề, PON.
  function verifyRowSlots(input, variants, slots) {
    var margin = Number(input.marginMm), plan = [], dots = [], i, d;
    for (i = 0; i < slots.length; i++) plan.push({ mi: 0, v: slots[i].vi, x: slots[i].x - margin, y: slots[i].y - margin });
    for (i = 0; i < (input.sheet.dots || []).length; i++) {
      d = input.sheet.dots[i];
      dots.push({ x: Number(d.x) - margin, y: Number(d.y) - margin, radius: Number(d.r) + Number(input.ponClearMm) });
    }
    return verifyGeometry(plan, variants, Number(input.sheet.widthMm) - 2 * margin,
      Number(input.sheet.heightMm) - 2 * margin, dots, Number(input.gapMm), 1);
  }

  // Bộ chia khu (dan_be_zones.js) được nạp trước file này trong panel; trong Node thì require.
  function zonesModule() {
    if (typeof window !== "undefined" && window.DanBeZones) return window.DanBeZones;
    if (typeof require === "function") { try { return require("./dan_be_zones.js"); } catch (requireError) { return null; } }
    return null;
  }

  // Nhiều bài dùng chung một khuôn: gán bài cho các vị trí (toạ độ/hướng theo khuôn đại diện) sao cho
  // mỗi bài là một cụm liền, chênh tối đa 1 con. Trả {slots, counts}; slot có mi/vi/angle theo bài thật.
  function assignDesigns(input, cutter, repSlots, variants) {
    var zones = zonesModule(), n = input.types.length, members = cutter.members, centres = [], i, s, v, labels, sizes;
    var slots = [], counts = [], m;
    for (i = 0; i < n; i++) counts.push(0);
    for (i = 0; i < repSlots.length; i++) {
      s = repSlots[i]; v = variants[s.vi];
      centres.push({ x: s.x + v.w / 2, y: s.y + v.h / 2 });
    }
    sizes = zones.clusterSizes(repSlots.length, members.length);
    labels = zones.assignClusters(centres, sizes);
    for (i = 0; i < repSlots.length; i++) {
      s = repSlots[i]; m = members[labels[i]];
      v = (s.vi + m.rel) % 4;
      slots.push({ mi: m.type, vi: v, x: s.x, y: s.y, angle: v * 90 });
      counts[m.type]++;
    }
    return { slots: slots, counts: counts };
  }

  // Kết quả bộ tìm cũ cho các bài cùng khuôn: đưa hướng về khuôn đại diện rồi gán lại thành cụm.
  function regroupLegacy(input, cutter, finished, variants) {
    var rel = [], i, m, rep = [], s, out, key;
    for (i = 0; i < cutter.members.length; i++) { m = cutter.members[i]; rel[m.type] = m.rel; }
    for (i = 0; i < finished.slots.length; i++) {
      s = finished.slots[i];
      rep.push({ vi: (s.vi - (rel[s.mi] || 0) + 4) % 4, x: s.x, y: s.y });
    }
    out = assignDesigns(input, cutter, rep, variants);
    var result = {};
    for (key in finished) if (Object.prototype.hasOwnProperty.call(finished, key)) result[key] = finished[key];
    result.slots = out.slots; result.counts = out.counts;
    result.mode = String(finished.mode || "") + " + gom cụm các bài cùng khuôn";
    return result;
  }

  function formatRows(input, rows, variants, began, cutter) {
    var n = input.types.length, slots = [], counts = [], i, s, v, countText = [], assigned;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (i = 0; i < n; i++) counts.push(0);
    if (cutter) {
      assigned = assignDesigns(input, cutter, rows.slots, variants);
      slots = assigned.slots; counts = assigned.counts;
    }
    for (i = 0; i < rows.slots.length; i++) {
      s = rows.slots[i]; v = variants[s.vi];
      if (!cutter) { slots.push({ mi: i % n, vi: s.vi, x: s.x, y: s.y, angle: s.vi * 90 }); counts[i % n]++; }
      x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x + v.w); y1 = Math.max(y1, s.y + v.h);
    }
    var offX = slots.length ? (x0 + x1 - Number(input.sheet.widthMm)) / 2 : 0;
    var offY = slots.length ? (y0 + y1 - Number(input.sheet.heightMm)) / 2 : 0;
    var exact = abs(offX) <= 0.001 && abs(offY) <= 0.001;
    for (i = 0; i < counts.length; i++) countText.push("loại " + (i + 1) + ": " + counts[i]);
    return {
      ok: true, slots: slots, count: slots.length, counts: counts,
      mode: "xếp hàng lồng theo biên dạng thật" + (n > 1 ? (cutter ? " + gom cụm các bài cùng khuôn" : " + luân phiên các bài cùng khuôn") : ""),
      centering: { exact: exact, offsetXmm: offX, offsetYmm: offY },
      detail: "Dàn xếp hàng lồng: " + slots.length + " con (" + countText.join(", ") + "). " +
        "Khép đúng khe " + Number(input.gapMm).toFixed(2) + " mm theo đường bế thật; đã thử hàng thẳng, so le, " +
        "đối đầu 180°, ghép dải đứng/nằm, dịch từng hàng và dịch cả cụm né PON trong " + (now() - began) + " ms." +
        (rows.transposed ? " Hàng chạy theo chiều dọc tờ." : "") +
        (rows.fill ? " Lấp thêm " + rows.fill + " con vào chỗ trống." : "") +
        (exact ? "" : " Canh tâm bị giới hạn bởi vùng né PON.")
    };
  }

  // Dàn MỘT khuôn trong một khung chữ nhật (mm, gốc ở góc trên-trái khung, không lề) cho bộ chia khu.
  // dots: chấm PON toạ độ trong khung, {x, y, r}. Trả {count, slots:[{vi, x, y}]} với vi theo hướng của `groups`;
  // chỉ trả phương án đã qua chốt chặn độc lập; không có thì {count: 0, slots: []}.
  // effort "full": hai lượt hướng chuẩn như nest(); "quick": một lượt, mức tìm gọn.
  // skipVerify: bỏ chốt chặn từng khu (bộ chia khu chốt chặn cả tờ một lần ở cuối, rẻ hơn nhiều với khuôn nhiều đỉnh).
  function planCutterRect(groups, curveErrorMm, rect, dots, gapMm, ponClearMm, effort, skipVerify) {
    var none = { count: 0, slots: [] }, w = Number(rect && rect.w), h = Number(rect && rect.h);
    if (!(w > 0) || !(h > 0)) return none;
    var norm = normalizeGroups(groups);
    if (!norm) return none;
    var curve = Math.min(0.025, Math.max(0, Number(curveErrorMm) || 0)), fake = {
      sheet: { widthMm: w, heightMm: h, dots: dots || [] }, marginMm: 0, gapMm: gapMm, ponClearMm: ponClearMm, budgetMs: 3000
    };
    var variants = cutterVariants(norm, curve), quick = effort === "quick", began = now();
    var turn = canonicalTurn(norm), runs = quick ? [turn] : [turn, (turn + 2) % 4], plans = [], ri, si, one;
    for (ri = 0; ri < runs.length; ri++) {
      try {
        one = RowNest.plan(fake, runs[ri] ? rotateGroups(norm, runs[ri] * 90) : norm, curve, 3000,
          began + 20000 * (ri + 1) / runs.length, quick ? "quick" : "full");
      } catch (planError) { one = null; }
      if (!one || !one.count) continue;
      for (si = 0; si < one.slots.length; si++) one.slots[si].vi = (one.slots[si].vi + runs[ri]) % 4;
      one.turn = runs[ri];
      plans.push(one);
    }
    plans.sort(function (a, b) { return b.count - a.count || a.neat - b.neat || a.turn - b.turn; });
    for (ri = 0; ri < plans.length; ri++) {
      if (!skipVerify && !verifyRowSlots(fake, variants, plans[ri].slots)) continue;
      var slots = [];
      for (si = 0; si < plans[ri].slots.length; si++)
        slots.push({ vi: plans[ri].slots[si].vi, x: plans[ri].slots[si].x, y: plans[ri].slots[si].y });
      return { count: slots.length, slots: slots };
    }
    return none;
  }

  var coreApi = {
    planCutterRect: planCutterRect, verifyGeometry: verifyGeometry, cutterVariants: cutterVariants,
    canonicalTurn: canonicalTurn, rotateGroups: rotateGroups, normalizeGroups: normalizeGroups,
    sameGroups: sameGroups, boundsOfGroups: boundsOfGroups, nestLegacy: nestLegacy
  };

  // Bản chạy từng bước cho panel: bộ chia khu nhường Chromium vẽ lại giữa các bước và báo tiến độ
  // onProgress({done, total}); các trường hợp khác chạy nest() liền một mạch rồi onDone(kết quả).
  function nestAsync(input, onProgress, onDone) {
    var zones = zonesModule(), cutters = inputUsable(input) ? cutterGroupsOf(input) : null, job = null;
    if (!zones || !cutters || cutters.length < 2 || !allCuttersFit(input, cutters)) {
      setTimeout(function () { onDone(nest(input)); }, 0);
      return;
    }
    try { job = zones.createJob(input, coreApi); } catch (createError) { job = null; }
    if (!job) { setTimeout(function () { onDone(rescueLegacy(input)); }, 0); return; }
    function tick() {
      var r;
      try { r = job.step(); } catch (stepError) { onDone(rescueLegacy(input)); return; }
      if (typeof onProgress === "function") onProgress(r.progress);
      if (r.done) { onDone(r.result && r.result.ok ? r.result : rescueLegacy(input)); return; }
      setTimeout(tick, 0);
    }
    setTimeout(tick, 0);
  }

  var RESCUE_NOTE = "Chia khu không xếp đủ mọi mẫu, tạm dùng cách dàn xen kẽ cũ.";

  function inputUsable(input) {
    if (!input || !input.sheet || !input.types || !input.types.length) return false;
    var gap = Number(input.gapMm), margin = Number(input.marginMm), ponClear = Number(input.ponClearMm);
    return gap >= 0 && margin >= 0 && ponClear >= 0 &&
      Number(input.sheet.widthMm) - 2 * margin > 0 && Number(input.sheet.heightMm) - 2 * margin > 0;
  }

  // Khuôn nào không vừa vùng dùng được ở cả 4 hướng thì để bộ cũ báo lỗi "Khuôn loại N không vừa khổ tờ".
  function allCuttersFit(input, cutters) {
    var W = Number(input.sheet.widthMm) - 2 * Number(input.marginMm), H = Number(input.sheet.heightMm) - 2 * Number(input.marginMm);
    var c, b, fits;
    for (c = 0; c < cutters.length; c++) {
      b = boundsOfGroups(cutters[c].groups);
      fits = (b.w <= W + 1e-9 && b.h <= H + 1e-9) || (b.h <= W + 1e-9 && b.w <= H + 1e-9);
      if (!fits) return false;
    }
    return true;
  }

  // Cứu hộ: bộ chia khu không ra được phương án đủ mọi mẫu → dùng bộ cũ và báo rõ.
  function rescueLegacy(input) {
    var r = nestLegacy(input);
    if (r.ok) r.detail = RESCUE_NOTE + " " + (r.detail || "");
    else r.error = RESCUE_NOTE + " " + (r.error || "");
    return r;
  }

  // Nhận nhóm khuôn cho một đầu vào đã kiểm tra; null nếu không có bộ chia khu hoặc đường bế hỏng.
  function cutterGroupsOf(input) {
    var zones = zonesModule();
    try { return zones ? zones.groupCutters(input.types, coreApi) : null; } catch (cutterError) { return null; }
  }

  // Bộ điều phối: lõi xếp hàng lồng chạy trước; bộ tìm cũ chạy thi đua phần tìm (rẻ).
  // Lấy phương án nhiều con hơn; bằng nhau thì giữ bố cục xếp hàng (gọn, đều, khép đúng khe).
  // Từ hai nhóm khuôn trở lên: bộ chia khu (mỗi nhóm khuôn một khu, gom cụm, lấp đầy).
  function nest(input) {
    var began = now(), groups = null, rows = null, variants = null, curve = 0, ti, ce, budget;
    if (!inputUsable(input)) return nestLegacy(input);
    var gap = Number(input.gapMm), margin = Number(input.marginMm), ponClear = Number(input.ponClearMm);
    // Nhận nhóm khuôn: các bài cùng khuôn (kể cả file đặt xoay 90/180/270) dàn chung một lần rồi gom cụm bài.
    var zones = zonesModule(), cutters = cutterGroupsOf(input), cutter = null, zoned = null;
    if (cutters && cutters.length >= 2) {
      if (!allCuttersFit(input, cutters)) return nestLegacy(input);
      try { zoned = zones.runJob(zones.createJob(input, coreApi)); } catch (zoneError) { zoned = null; }
      return zoned && zoned.ok ? zoned : rescueLegacy(input);
    }
    if (cutters && cutters.length === 1) { groups = cutters[0].groups; cutter = cutters[0]; }
    else if (!cutters) { try { groups = sharedCutter(input); } catch (sharedError) { groups = null; } }
    if (!groups) return nestLegacy(input);
    for (ti = 0; ti < input.types.length; ti++) {
      ce = Number(input.types[ti].curveErrorMm);
      if (isFinite(ce) && ce > curve) curve = ce;
    }
    curve = Math.min(0.025, curve);
    budget = clamp(Number(input.budgetMs) || 1450, 250, 4000);
    try {
      variants = cutterVariants(groups, curve);
      // Hướng chuẩn lấy theo hình học nên kết quả không phụ thuộc file nguồn đặt khuôn xoay hướng nào.
      // Ngân sách thường (panel dùng 3 giây): thêm lượt thứ hai với khuôn xoay 180° — cùng không gian bố cục
      // nhưng thứ tự xét mẫu khác, bù chỗ lượt đầu bỏ sót khi nhiều mẫu bằng điểm nhau. Ngân sách ngắn: một lượt.
      var turn = canonicalTurn(groups), runs = budget >= 1500 ? [turn, (turn + 2) % 4] : [turn], plans = [], ri, si, one,
        safety = Math.max(6000, Math.min(20000, budget * 3));
      for (ri = 0; ri < runs.length; ri++) {
        one = RowNest.plan(input, runs[ri] ? rotateGroups(groups, runs[ri] * 90) : groups, curve, budget,
          began + safety * (ri + 1) / runs.length);
        if (!one || !one.count) continue;
        for (si = 0; si < one.slots.length; si++) one.slots[si].vi = (one.slots[si].vi + runs[ri]) % 4;
        one.turn = runs[ri];
        plans.push(one);
      }
      plans.sort(function (a, b) { return b.count - a.count || a.neat - b.neat || a.turn - b.turn; });
      for (ri = 0; ri < plans.length && !rows; ri++)
        if (verifyRowSlots(input, variants, plans[ri].slots)) rows = plans[ri];
    } catch (rowError) { rows = null; }
    var legacyInput = {}, key;
    for (key in input) if (Object.prototype.hasOwnProperty.call(input, key)) legacyInput[key] = input[key];
    legacyInput.budgetMs = Math.max(250, budget - (now() - began));
    var legacy = nestLegacy(legacyInput, 0, true);
    if (!legacy.ok) return rows ? formatRows(input, rows, variants, began, cutter) : legacy;
    if (!rows || legacy.count > rows.count) {
      var finished = legacy.finish();
      if (finished.ok || !rows) return finished.ok && cutter && input.types.length > 1 ? regroupLegacy(input, cutter, finished, variants) : finished;
    }
    return formatRows(input, rows, variants, began, cutter);
  }

  return {
    version: VERSION,
    nest: nest,
    nestAsync: nestAsync,
    nestLegacy: nestLegacy,
    // Phần lõi mở cho bộ chia khu (dan_be_zones.js).
    _core: coreApi,
    // Chỉ mở ra cho dữ liệu mẫu test hồi quy chạy bằng Node; panel thì dùng nest().
    _test: {
      buildVariant: buildVariant, circleLike: circleLike, verifyPlan: verifyPlan,
      buildOccupancyFor: buildOccupancyFor, insideAndClear: insideAndClear,
      candidatesFor: candidatesFor, growPlan: growPlan, centrePlan: centrePlan, occAdd: occAdd,
      planBounds: planBounds, augmentWithPair: augmentWithPair, seedPlans: seedPlans,
      contactOffsets: contactOffsets, verifyGeometry: verifyGeometry, latticePlans:latticePlans,
      alternatingRowPlans:alternatingRowPlans,rightProfileContact:rightProfileContact,
      bandPlans:bandPlans,compositionalBandPlans:compositionalBandPlans,
      centrePhysicalPlan:centrePhysicalPlan,physicalPlanBounds:physicalPlanBounds,
      openPhysicalGapPlan:openPhysicalGapPlan,
      balancedPlan: balancedPlan, mixedRowPlans: mixedRowPlans, polishEdges: polishEdges, edgeMargin:edgeMargin,
      rowNest: RowNest, sharedCutter: sharedCutter, verifyRowSlots: verifyRowSlots, cutterVariants: cutterVariants,
      canonicalTurn: canonicalTurn
    }
  };
});
