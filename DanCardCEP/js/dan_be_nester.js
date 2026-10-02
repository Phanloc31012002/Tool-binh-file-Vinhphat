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

  var VERSION = 2;

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

  // Different artwork designs often share the same cutter. Search that
  // silhouette once, then distribute the resulting slots cyclically; treating
  // identical cutters as unrelated types used to disable the dense motifs.
  // Coordinates are already normalized. Path starting point, winding and
  // group/compound ordering do not change a cutter's physical geometry.
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

  // Even/odd in a CompoundPath; separate groups are unioned afterwards.
  function intervalsForGroup(group, y) {
    var xs = [], ci, c, i, p, q, x;
    for (ci = 0; ci < group.length; ci++) {
      c = group[ci];
      for (i = 0; i < c.length; i++) {
        p = c[i]; q = c[(i + 1) % c.length];
        // Half-open rule prevents counting a vertex twice.
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
      a = Math.floor(spans[i][0] / step);
      b = Math.ceil(spans[i][1] / step);
      if (b > a) out.push([a, b]);
    }
    return mergeSpans(out);
  }

  function buildVariant(groups, mi, vi, angle, gap, step) {
    var rotated = rotateGroups(groups, angle), b = boundsOfGroups(rotated);
    if (!b) return null;
    // Illustrator's point-to-mm conversion can leave an exact 50 mm cutter
    // at 50.000000002 mm. Do not inflate it by an entire raster cell because
    // of that numerical dust (the continuous physical guard still judges it).
    var wCells = Math.ceil(b.w / step - 1e-7), hCells = Math.ceil(b.h / step - 1e-7);
    var rawRows = [], r, y;
    for (r = 0; r < hCells; r++) {
      y = (r + 0.5) * step;
      rawRows.push(toCellSpans(intervalsForGroups(rotated, y), step));
    }

    // A sampled scanline represents a vertical slab, not an infinitely thin
    // line. Include its half-cell height when dilating; otherwise two curved
    // contours can pass the row test with less than the entered physical gap.
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
      // Curves may change each row; only retain periodic strong landmarks.
      if (change && (r % Math.max(1, Math.round(n / 18)) === 0)) keep[r] = true;
      if (v.rawRows[r].length !== v.rawRows[r - 1].length) { keep[r] = true; strong[r] = true; }
      // Preserve sudden neck/head/shoulder transitions even when the general
      // curve has hundreds of gradually changing scanlines.
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
    // Count is handled separately. A compact block has more chance to accept a
    // rotated piece than a shallow, wide block with the same number of decals.
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

  // A mixed source promises equal alternation. Greedy placement preserves this
  // invariant, but prebuilt seeds and repair removals must obey it as well.
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

  // Raster no-fit boundary: at EVERY relative scanline displacement, find
  // the forbidden horizontal intervals between two real silhouettes. Their
  // endpoints are tangent positions, including pockets inside concave dies.
  // Cache per orientation pair; copies of the same die reuse the catalogue.
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
      // Bbox contacts and center alignments are indispensable for simple
      // rectangles, while the feature contacts below handle concave shapes.
      candidateAdd(list, seen, s.x - v.wCells, s.y, v, rw, rh);
      candidateAdd(list, seen, s.x + a.wCells, s.y, v, rw, rh);
      candidateAdd(list, seen, s.x, s.y - v.hCells, v, rw, rh);
      candidateAdd(list, seen, s.x, s.y + a.hCells, v, rw, rh);
      candidateAdd(list, seen, s.x + Math.round((a.wCells - v.wCells) / 2), s.y, v, rw, rh);
      candidateAdd(list, seen, s.x, s.y + Math.round((a.hCells - v.hCells) / 2), v, rw, rh);
      candidateAdd(list, seen, s.x + a.wCells - v.wCells, s.y + a.hCells - v.hCells, v, rw, rh);

      // True contour contacts: align a feature row of the new silhouette with
      // one of the placed silhouette, then touch right-to-left / left-to-right.
      // The collision test uses the dilated profile, so candidates with less
      // than the requested gap are rejected automatically.
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
        // Try low/left candidates first, but retain enough contacts for a
        // horizontal or reverse-orientation lock to be chosen.
        cs.sort(function (u, w) { return u.y - w.y || u.x - w.x; });
        // One wide/long orientation used to consume the complete shared cap,
        // so 90°/270° was literally never evaluated. Each rotation gets the
        // same bounded allowance.
        checked = 0;
        var edgeCount = Math.min(280, Math.floor(cs.length / 2));
        var middleStride = Math.max(1, Math.floor(Math.max(1, cs.length - 2 * edgeCount) / 180));
        for (ci = 0; ci < cs.length && checked < maxCandidatesPerVariant; ci++) {
          // Keep both ends of the y-sorted list. The useful free strip for a
          // sideways die is often at the top, which the old "first N only"
          // policy never reached.
          if (ci >= edgeCount && ci < cs.length - edgeCount &&
              ((ci - edgeCount) % middleStride) !== 0) continue;
          checked++;
          p = cs[ci];
          if (!insideAndClear(v, p.x, p.y, rw, rh, occ, dots)) continue;
          var trial = { mi: v.mi, v: vi, x: p.x, y: p.y };
          var metricPlan = plan.concat([trial]);
          var score = planScore(metricPlan, variants);
          // A small bottom-left preference keeps open regions contiguous, but
          // count remains the only global primary objective.
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

  // A pair is evaluated as a single move. Greedy one-at-a-time placement can
  // consume the first slot of a useful pair and then make its partner fail.
  // This is how a free horizontal pair is kept available above a compact block.
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
      // Filter against the complete layout BEFORE sampling. Sampling the raw
      // catalogue dropped virtually every valid head-to-neck pocket.
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
            // Count is the objective. Keep the first verified two-piece gain
            // and give the remaining budget to other layout seeds.
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

    // A compact strip is a generic nesting motif, not a shape-specific rule.
    // Long dies frequently need a complete row before the inverse/sideways
    // pieces can lock into its recesses (the yellow spoon is one example).
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

    // Two opposing strips are a generic "interlock motif": it is created
    // only from real contour contact candidates, then validated row by row.
    // Unlike a rectangle grid, this leaves a continuous pocket for a rotated
    // pair above/below the two strips.
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
        // A half-pitch opposing strip needs room on one side of its base.
        // Quarter phases leave that room while still shifting corner circles
        // away from PON; centring the base row alone can make its partner spill.
        baseXs = [Math.floor(spareX / 4), Math.floor(3 * spareX / 4), Math.floor(spareX / 2), 0, spareX];
        for (bx = 0; bx < baseXs.length && now() < deadline; bx++)
        for (by = 0; by < baseYs.length && now() < deadline; by++) {
          base = makeStrip(a, baseXs[bx], baseYs[by], n, null);
          if (!base) continue;
          cs = candidatesFor(base, oo, variants, rw, rh);
          // Rank the whole opposite-strip block by compactness rather than
          // throwing away most contact offsets before checking them.
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
              // Same-orientation copies have disjoint expanded bboxes at this
              // pitch. Reuse the base occupancy instead of rebuilding it for
              // every possible concave contact.
              if (!insideAndClear(oo, sx, c.y, rw, rh, baseOcc, dots)) { second = null; break; }
              second.push({mi:oo.mi,v:b,x:sx,y:c.y});
            }
            if (!second) continue;
            joined = clonePlan(base);
            for (var sj = 0; sj < second.length; sj++) joined.push(second[sj]);
            retain(joined);
            // The sorted catalogue's first feasible lock is the smallest
            // block at this anchor. Different anchors/rotations get time too.
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
      // Corner PON can block all four corner anchors while the same die fits
      // in the middle. Retain that cheap deterministic seed for every heading.
      anchors = [[0, 0], [rw - v.wCells, 0], [0, rh - v.hCells], [rw - v.wCells, rh - v.hCells],
                 [Math.floor((rw - v.wCells) / 2), Math.floor((rh - v.hCells) / 2)]];
      for (ai = 0; ai < anchors.length; ai++) {
        x = anchors[ai][0]; y = anchors[ai][1];
        occ = buildOccupancyFor([], variants, rh);
        if (insideAndClear(v, x, y, rw, rh, occ, dots)) pushSeed([{ mi: v.mi, v: vi, x: x, y: y }]);
      }
    }

    // Generic pair locks: no rule mentions spoon. Every orientation pair gets
    // a chance to form the smallest valid contact cluster before greedy growth.
    var a, b, base, candidates, ci, candidate, pairOcc, candidateSeed, totalPairs = 0;
    var emptyPairOcc = buildOccupancyFor([], variants, rh);
    for (a = 0; a < variants.length && now() < deadline && totalPairs < 32; a++) {
      for (b = 0; b < variants.length && now() < deadline && totalPairs < 32; b++) {
        if (typeCount > 1 && variants[a].mi === variants[b].mi) continue;
        base = { mi: variants[a].mi, v: a, x: 0, y: 0 };
        // The first die of a contact pair is a real placement, not a free
        // coordinate anchor. It must avoid sheet/PON constraints before its
        // mate is tested; otherwise an unsafe corner die poisons the winning
        // seed and makes the final contour guard reject an otherwise viable job.
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

  // A repeated motif is measured against the actual profiles. The stagger
  // and row pitch are derived from contour clearance, rather than from bbox
  // height. This gives a fast dense starting layout for leaves, diamonds and
  // other repeating dies before the free-placement search fills remaining
  // pockets with any allowed rotation.
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
      for (xi = 0; xi < phasesX.length; xi++) for (yi = 0; yi < phasesY.length; yi++) {
        var plan = [], occ = buildOccupancyFor([], variants, rh), row, col, vx, yy, xx, vv;
        for (row = 0; row < rows; row++) {
          vx = row % 2 ? second : first; vv = variants[vx];
          yy = phasesY[yi] + row * py;
          // Extend both directions so a phase shift cannot lose an edge slot.
          for (col = -1; col <= columns; col++) {
            xx = phasesX[xi] + (row % 2 ? shift : 0) + col * pitch;
            if (!insideAndClear(vv, xx, yy, rw, rh, occ, dots)) continue;
            occAdd(occ, vv, xx, yy);
            plan.push({mi:vv.mi,v:vx,x:xx,y:yy});
          }
        }
        if (plan.length) out.push(plan);
      }
    }
    // Complete one staggered baseline for EVERY permitted rotation before
    // time-sliced extras. Previously rotation 0 spent the entire slice on many
    // motifs, so a busy machine never reached the denser 90-degree leaf rows.
    // This is a fixed four-motif baseline, not an unbounded search.
    for (ai = 0; ai < variants.length; ai++) {
      pitchX = variants[ai].wCells + Math.max(1, 2 * variants[ai].padCells);
      motif(ai, ai, Math.round(pitchX / 2));
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

  // Distinct cutters cannot reuse the single-cutter lattice. A bounded shelf
  // baseline gives the free silhouette search a balanced starting block instead
  // of waiting for expensive contacts before it has placed a useful first row.
  // This is only a seed; concave contacts remain the actual refinement search.
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
          // Move a bounded step past a corner PON, not one complete cutter.
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

  // Count-preserving polish for a parallel pair close to a sheet edge. Try
  // each original heading and its real 180-degree rotation, never reflection.
  // This can interlock the pair more deeply into the remaining block and make
  // room to centre the complete layout farther from both opposing edges.
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
      // Remove one piece near the outer outline, then let all orientations
      // refill that region. It is deliberately bounded: no explosive beam tree.
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
      // Equal-radius vertices alone would incorrectly recognise squares and
      // diamonds as circles. Their edges must also follow a circular contour.
      var next = c[(i + 1) % c.length];
      d = Math.sqrt(sq((c[i][0] + next[0]) / 2 - cx) + sq((c[i][1] + next[1]) / 2 - cy));
      if (d < lo) lo = d; if (d > hi) hi = d;
    }
    r = (lo + hi) / 2;
    if (!r || hi - lo > Math.max(0.12, r * 0.025)) return null;
    // Illustrator's four-cubic ellipse is slightly outside an ideal circle
    // between cardinal anchors. Use the enclosing radius of the actual
    // flattened contour, not width / 2, for safe analytic lattice spacing.
    return { diameter: b.w, radius: hi, cx: cx, cy: cy };
  }

  function circlePlan(v, rw, rh, dots, gap, deadline) {
    // Dynamic hex lattice. It tests phase against today's gap, margin and PON;
    // it is not a borrowed static DECAL_SETS coordinate table.
    var dia = Math.max(v.wCells, v.hCells), profile = circleLike(v.groups);
    var radius = profile ? profile.radius / v.step : dia / 2;
    var centreX = profile ? profile.cx / v.step : dia / 2;
    var centreY = profile ? profile.cy / v.step : v.hCells / 2;
    // Round separation outward, never inward. Fractional user gaps such as
    // 1.1 mm otherwise generated an unsafe lattice which final checks refused.
    var pitchX = Math.max(dia + 1, Math.ceil(2 * radius + gap / v.step - 1e-7));
    var cols = Math.floor((rw - dia) / pitchX) + 1;
    var spareX = rw - (dia + (cols - 1) * pitchX);
    var maxShift = Math.max(0, Math.min(Math.floor(pitchX / 2), spareX));
    var best = null, shiftStep = Math.max(1, Math.floor(Math.max(1, maxShift) / 12));
    var shift, pitchY, rows, spareY, xPhases, yPhases, xi, yi, px, py, row, col, x, y, plan;
    // A coarse sweep must still include its final half-pitch phase: omitting
    // that endpoint can lose one entire staggered column on a tight sheet.
    for (shift = 0; shift <= maxShift && now() < deadline;
         shift = shift < maxShift ? Math.min(maxShift, shift + shiftStep) : maxShift + 1) {
      pitchY = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, pitchX * pitchX - shift * shift))));
      rows = Math.floor((rh - dia) / pitchY) + 1;
      spareY = rh - (dia + (rows - 1) * pitchY);
      // Both parities must remain inside the printable rectangle. We examine
      // three deterministic phases rather than every grid cell: all useful
      // circle phases are bounded by the remaining strip after a full row.
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
              // Distances are guaranteed analytically by the lattice. Test PON
              // as two circles here instead of the conservative raster cells,
              // otherwise a valid 1 mm gap can be rounded up and lost.
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
      // Only centres inside the required separation can collide. Keep the
      // exact distance check, but avoid O(n^2) work on thousands of small dies.
      var near = spatialNear(index, {x0:a.x-spacing,x1:a.x+spacing,y0:a.y-spacing,y1:a.y+spacing});
      for (j = 0; j < near.length; j++) {
        b = plan[near[j]]; dx = a.x - b.x; dy = a.y - b.y;
        // Match the sub-cell conversion dust ignored by outward lattice
        // rounding. The independent millimetre contour guard remains final.
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

  // Independent continuous check of the flattened cutter paths. Raster rows
  // choose placements, but cannot be the only judge of a physical 1 mm gap.
  function verifyGeometry(plan, variants, rw, rh, dots, gap, step) {
    var mapped = [], i, j, s, v, groups, edges, gi, ci, pi, p, q;
    var tolerance = 0.001, gapSq = sq(Math.max(0, gap - tolerance));
    var index = spatialIndex(Math.max(8, gap * 2));
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
      var shape = {groups:groups, edges:edges, bounds:boundsOfGroups(groups)};
      for (var di = 0; di < dots.length; di++) {
        var centre = [dots[di].x * step, dots[di].y * step], radiusSq = sq(Math.max(0, dots[di].radius * step - tolerance));
        if (insideGroups(centre, groups)) return false;
        for (var ei = 0; ei < edges.length; ei++)
          if (pointSegmentDistanceSq(centre, edges[ei].a, edges[ei].b) < radiusSq) return false;
      }
      var bb = shape.bounds;
      var near = spatialNear(index, {x0:bb.x0-gap,x1:bb.x1+gap,y0:bb.y0-gap,y1:bb.y1+gap});
      for (j = 0; j < near.length; j++) {
        var other = mapped[near[j]], ob = other.bounds;
        if (bb.x0 >= ob.x1 + gap || ob.x0 >= bb.x1 + gap || bb.y0 >= ob.y1 + gap || ob.y0 >= bb.y1 + gap) continue;
        for (var ea = 0; ea < edges.length; ea++) for (var eb = 0; eb < other.edges.length; eb++) {
          var e = edges[ea], f = other.edges[eb];
          if (e.x0 >= f.x1 + gap || f.x0 >= e.x1 + gap || e.y0 >= f.y1 + gap || f.y0 >= e.y1 + gap) continue;
          if (segmentsCross(e.a, e.b, f.a, f.b) ||
              pointSegmentDistanceSq(e.a, f.a, f.b) < gapSq || pointSegmentDistanceSq(e.b, f.a, f.b) < gapSq ||
              pointSegmentDistanceSq(f.a, e.a, e.b) < gapSq || pointSegmentDistanceSq(f.b, e.a, e.b) < gapSq) return false;
        }
        for (gi = 0; gi < groups.length; gi++) for (ci = 0; ci < groups[gi].length; ci++)
          if (insideGroups(groups[gi][ci][0], other.groups)) return false;
        for (gi = 0; gi < other.groups.length; gi++) for (ci = 0; ci < other.groups[gi].length; ci++)
          if (insideGroups(other.groups[gi][ci][0], groups)) return false;
      }
      mapped.push(shape);
      spatialAdd(index, i, shape.bounds);
    }
    return true;
  }

  function nest(input) {
    var began = now();
    try {
      if (!input || !input.sheet || !input.types || !input.types.length) throw new Error("Thiếu dữ liệu khuôn bế.");
      var step = Number(input.resolutionMm) || 0.25;
      if (!(step > 0 && step <= 1)) step = 0.25;
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
        for (ri = 0; ri < rots.length; ri++) {
          v = buildVariant(g, ti, ri, rots[ri], gap, step);
          if (v) {
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

      // Circle gets a geometry-derived hex attempt first; generic planner still
      // runs if it has time and may beat it around unusual PON locations.
      var isRound = planningTypeCount === 1 && circleLike(groupsByType[0]);
      if (isRound) {
        var circle = circlePlan(variants[0], rw, rh, dots, gap, deadline);
        if (circle.length) best = circle;
        // A rectangular sheet can fit more circles in staggered columns than
        // in staggered rows, especially around actual corner-PON keepouts.
        // Search both directions under the same budget; swapping coordinates
        // does not alter a circular cutter or relax any clearance rule.
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
        var mixedRows = mixedRowPlans(planningVariants, planningTypeCount, rw, rh, dots, Math.min(deadline, now() + budget * 0.08));
        var lattice = latticePlans(planningVariants, planningTypeCount, rw, rh, dots, Math.min(deadline, now() + budget * 0.2));
        seeds = seedPlans(planningVariants, planningTypeCount, rw, rh, dots, Math.min(deadline, now() + budget * 0.35)).concat(lattice, mixedRows);
        seeds.sort(function (u, w) { return -comparePlans(u, w, variants); });
      }
      // Keep all verified seeds as a fallback even when preprocessing reaches
      // the time limit. A time slice must never turn a valid layout into zero.
      for (si = 0; si < seeds.length; si++)
        if (balancedPlan(seeds[si], planningTypeCount) && comparePlans(seeds[si], best, variants) > 0) best = seeds[si];
      for (si = 0; si < seeds.length && now() < deadline; si++) {
        candidate = seeds[si];
        // Check a mutually dependent pair BEFORE greedy growth. A greedy first
        // horizontal piece can otherwise destroy the space needed by its mate.
        var sliceDeadline = Math.min(deadline, now() + Math.max(650, budget * 0.25));
        if (candidate.length >= 6 && now() < sliceDeadline)
          candidate = augmentWithPair(candidate, planningVariants, planningTypeCount, rw, rh, dots, sliceDeadline);
        candidate = growPlan(candidate, planningVariants, planningTypeCount, rw, rh, dots, sliceDeadline);
        if (balancedPlan(candidate, planningTypeCount) && comparePlans(candidate, best, variants) > 0) best = candidate;
      }
      if (!best) best = [];
      if (!isRound && now() < deadline && best.length) best = repairPlans(best, planningVariants, planningTypeCount, rw, rh, dots, deadline);
      best = centrePlan(best, variants, rw, rh, dots);
      if (!isRound) best = polishEdges(best, planningVariants, rw, rh, dots, gap, step, now() + Math.min(550, budget * 0.2));
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
      valid = valid && balancedPlan(best, input.types.length) && verifyGeometry(best, variants, rw, rh, dots, gap, step);
      if (!valid) throw new Error("Bộ kiểm tra an toàn từ chối phương án dàn.");

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
        detail: "Dàn silhouette thật: " + slots.length + " con (" + countText.join(", ") + "). " +
          "Lưới kiểm tra " + step.toFixed(2) + " mm, khe " + gap.toFixed(2) + " mm; " +
          "đã thử xoay/lồng biên dạng trong " + total + " ms."
      };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }

  return {
    version: VERSION,
    nest: nest,
    // Exposed only for the Node regression fixtures; the panel uses nest().
    _test: {
      buildVariant: buildVariant, circleLike: circleLike, verifyPlan: verifyPlan,
      buildOccupancyFor: buildOccupancyFor, insideAndClear: insideAndClear,
      candidatesFor: candidatesFor, growPlan: growPlan, centrePlan: centrePlan, occAdd: occAdd,
      planBounds: planBounds, augmentWithPair: augmentWithPair, seedPlans: seedPlans,
      contactOffsets: contactOffsets, verifyGeometry: verifyGeometry, latticePlans:latticePlans,
      balancedPlan: balancedPlan, mixedRowPlans: mixedRowPlans, polishEdges: polishEdges, edgeMargin:edgeMargin
    }
  };
});
