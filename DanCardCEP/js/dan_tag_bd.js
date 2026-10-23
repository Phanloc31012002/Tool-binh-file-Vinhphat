/*
 * Dàn tag BD – lõi ghép tag thành khối ô card (xưởng Bình Dương).
 *
 * Chạy trong CEP (Chromium) và Node, không chạy trong ExtendScript. Lõi không vẽ gì:
 * nhận danh sách tag (khổ đã tràn, số lượng), tách bài 500 / bài 1000, rồi tìm cách ghép
 * các con vào những khối bội số ô card 56 × 92 mm sao cho tổng số ô ít nhất; mọi nhát cắt
 * là nhát thẳng chạy suốt (guillotine) để dao công nghiệp hạ được; khe 0 mm; xoay 0/90.
 *
 * Luật chốt với anh Lộc 22/10/2026 (docs/THIET_KE_DAN_TAG_BD.md). Toạ độ công khai: mm,
 * gốc góc trên trái của khối, y hướng xuống.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.DanTagBd = api;
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var VERSION = 3;
  // Bóp để vừa khối khi cụm chỉ dư chút ít so với n ô:
  //  - mức 1: mỗi con bớt tối đa 1 mm theo chiều đang thiếu (cột thiếu 6 mm có 6 con → mỗi con 1 mm);
  //    chỗ trống trong khối hút trước, con chỉ bớt phần còn lại;
  //  - mức 2: bóp 1 mm/con rồi mà vẫn thiếu 1–2 mm nữa thì cả cụm co thêm cho đủ (chia theo cỡ con).
  var BOP_MOI_CON_MM = 1;
  var BOP_THEM_CUM_MM = 2;
  var CELL_W = 56; // mm, ô card đã tràn theo cạnh ngắn
  var CELL_H = 92; // mm, ô card đã tràn theo cạnh dài
  var MAX_COLS = 18; // tờ 100,8 cm = 18 × 56
  var MAX_ROWS = 7; // tờ 64,4 cm = 7 × 92
  var EPS = 0.01;
  var DEFAULT_BUDGET = 40000;

  function r2(n) {
    return Math.round(n * 100) / 100;
  }

  // ------------------------------------------------------------------
  //  Bộ xếp guillotine: đặt từng con vào góc trên trái của hình trống đầu
  //  tiên (trên trước, trái trước), chia phần còn lại theo hai cách, nhánh
  //  cuối là bỏ trống hình đó. Con giống nhau (cùng id) gộp thành loại.
  // ------------------------------------------------------------------
  function groupTypes(pieces) {
    var map = {},
      types = [],
      i,
      p,
      t;
    for (i = 0; i < pieces.length; i++) {
      p = pieces[i];
      t = map[p.id];
      if (!t) {
        t = { id: p.id, w: p.w, h: p.h, count: 0, area: p.w * p.h };
        map[p.id] = t;
        types.push(t);
      } else if (Math.abs(t.w - p.w) > EPS || Math.abs(t.h - p.h) > EPS) {
        throw new Error("Con cùng id " + p.id + " nhưng khác khổ.");
      }
      t.count++;
    }
    types.sort(function (a, b) {
      if (b.area !== a.area) return b.area - a.area;
      var am = Math.max(a.w, a.h),
        bm = Math.max(b.w, b.h);
      if (bm !== am) return bm - am;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    for (i = 0; i < types.length; i++) {
      t = types[i];
      t.index = i;
      t.orients = [{ w: t.w, h: t.h, rot: 0 }];
      if (Math.abs(t.w - t.h) > EPS) t.orients.push({ w: t.h, h: t.w, rot: 90 });
    }
    return types;
  }

  function packInto(pieces, W, H, options) {
    options = options || {};
    var budget = options.budget || DEFAULT_BUDGET;
    var collect = options.collect || 1;
    var types = groupTypes(pieces);
    var remaining = [],
      i,
      j,
      totalArea = 0;
    for (i = 0; i < types.length; i++) {
      remaining.push(types[i].count);
      totalArea += types[i].area * types[i].count;
    }
    var result = { ok: false, places: [], cuts: [], nodes: 0, exhausted: false, layouts: [] };
    if (!(W > EPS) || !(H > EPS)) return result;
    if (totalArea > W * H + EPS) return result;
    // Con không lọt khối ở bất kỳ hướng nào -> thua ngay.
    for (i = 0; i < types.length; i++) {
      var fitsAny = false;
      for (j = 0; j < types[i].orients.length; j++)
        if (types[i].orients[j].w <= W + EPS && types[i].orients[j].h <= H + EPS) fitsAny = true;
      if (!fitsAny) return result;
    }

    var failed = {};
    var nodes = 0;
    var places = [],
      cuts = [];
    var found = [];
    var lastType = -1;

    function rectKey(r) {
      return r2(r.x) + "," + r2(r.y) + "," + r2(r.w) + "," + r2(r.h);
    }
    function stateKey(free) {
      var keys = [],
        k;
      for (k = 0; k < free.length; k++) keys.push(rectKey(free[k]));
      keys.sort();
      return keys.join(";") + "|" + remaining.join(",");
    }
    function pickFree(free) {
      var best = -1,
        k;
      for (k = 0; k < free.length; k++) {
        if (
          best < 0 ||
          free[k].y < free[best].y - EPS ||
          (Math.abs(free[k].y - free[best].y) <= EPS && free[k].x < free[best].x - EPS)
        )
          best = k;
      }
      return best;
    }
    function freeArea(free) {
      var s = 0,
        k;
      for (k = 0; k < free.length; k++) s += free[k].w * free[k].h;
      return s;
    }
    function remainingArea() {
      var s = 0,
        k;
      for (k = 0; k < types.length; k++) s += remaining[k] * types[k].area;
      return s;
    }
    function everyTypeFits(free) {
      var k, o, f, t, fits;
      for (k = 0; k < types.length; k++) {
        if (!remaining[k]) continue;
        t = types[k];
        fits = false;
        for (f = 0; f < free.length && !fits; f++)
          for (o = 0; o < t.orients.length && !fits; o++)
            if (t.orients[o].w <= free[f].w + EPS && t.orients[o].h <= free[f].h + EPS) fits = true;
        if (!fits) return false;
      }
      return true;
    }
    function remainingCount() {
      var s = 0,
        k;
      for (k = 0; k < types.length; k++) s += remaining[k];
      return s;
    }
    function snapshot() {
      var out = { places: [], cuts: [] },
        k;
      for (k = 0; k < places.length; k++) {
        out.places.push({
          id: places[k].id,
          x: r2(places[k].x),
          y: r2(places[k].y),
          w: r2(places[k].w),
          h: r2(places[k].h),
          rot: places[k].rot,
        });
      }
      for (k = 0; k < cuts.length; k++)
        out.cuts.push({ axis: cuts[k].axis, at: r2(cuts[k].at), from: r2(cuts[k].from), to: r2(cuts[k].to) });
      out.places.sort(function (a, b) {
        return a.y !== b.y ? a.y - b.y : a.x - b.x;
      });
      return out;
    }
    function typeOrder() {
      var order = [],
        k;
      if (lastType >= 0 && remaining[lastType]) order.push(lastType);
      for (k = 0; k < types.length; k++) if (k !== lastType && remaining[k]) order.push(k);
      return order;
    }

    // Trả true khi đã đủ số bố cục cần thu (dừng toàn bộ).
    function search(free) {
      if (nodes++ > budget) {
        result.exhausted = true;
        return true;
      }
      if (remainingCount() === 0) {
        found.push(snapshot());
        return found.length >= collect;
      }
      if (!free.length) return false;
      if (remainingArea() > freeArea(free) + EPS) return false;
      if (!everyTypeFits(free)) return false;
      var key = stateKey(free);
      if (failed[key]) return false;

      var fi = pickFree(free);
      var r = free[fi];
      var rest = free.slice(0, fi).concat(free.slice(fi + 1));
      var order = typeOrder(),
        oi,
        k,
        t,
        o,
        split,
        prevLast,
        ow,
        oh;
      for (oi = 0; oi < order.length; oi++) {
        k = order[oi];
        t = types[k];
        for (o = 0; o < t.orients.length; o++) {
          ow = t.orients[o].w;
          oh = t.orients[o].h;
          if (ow > r.w + EPS || oh > r.h + EPS) continue;
          for (split = 0; split < 2; split++) {
            var next = rest.slice(0),
              addedCuts = 0;
            var rightW = r.w - ow,
              bottomH = r.h - oh;
            if (split === 0) {
              // Nhát ngang trước: dải dưới chạy suốt bề ngang hình trống.
              if (bottomH > EPS) {
                cuts.push({ axis: "H", at: r.y + oh, from: r.x, to: r.x + r.w });
                addedCuts++;
                next.push({ x: r.x, y: r.y + oh, w: r.w, h: bottomH });
              }
              if (rightW > EPS) {
                cuts.push({ axis: "V", at: r.x + ow, from: r.y, to: r.y + oh });
                addedCuts++;
                next.push({ x: r.x + ow, y: r.y, w: rightW, h: oh });
              }
            } else {
              // Nhát dọc trước: cột phải chạy suốt chiều cao hình trống.
              if (rightW <= EPS && bottomH <= EPS) continue; // trùng cách 0
              if (rightW <= EPS || bottomH <= EPS) continue; // chỉ một nhát: cách 0 đã thử
              cuts.push({ axis: "V", at: r.x + ow, from: r.y, to: r.y + r.h });
              addedCuts++;
              next.push({ x: r.x + ow, y: r.y, w: rightW, h: r.h });
              cuts.push({ axis: "H", at: r.y + oh, from: r.x, to: r.x + ow });
              addedCuts++;
              next.push({ x: r.x, y: r.y + oh, w: ow, h: bottomH });
            }
            places.push({ id: t.id, x: r.x, y: r.y, w: ow, h: oh, rot: t.orients[o].rot });
            remaining[k]--;
            prevLast = lastType;
            lastType = k;
            var stop = search(next);
            lastType = prevLast;
            remaining[k]++;
            places.pop();
            while (addedCuts-- > 0) cuts.pop();
            if (stop) return true;
          }
        }
      }
      // Bỏ trống hình này.
      if (search(rest)) return true;
      failed[key] = true;
      return false;
    }

    search([{ x: 0, y: 0, w: W, h: H }]);
    result.nodes = nodes;
    if (found.length) {
      result.ok = true;
      result.places = found[0].places;
      result.cuts = found[0].cuts;
      result.layouts = found;
    }
    return result;
  }

  // ------------------------------------------------------------------
  //  Kiểm độc lập một khối: đủ con, nằm trong khối, không chồng, mọi cạnh
  //  trong nằm trên nhát cắt, nhát cắt không xuyên con, và cả bộ nhát cắt
  //  tách được bằng dao thẳng chạy suốt (guillotine).
  // ------------------------------------------------------------------
  function verify(places, cuts, W, H, pieces) {
    var i, j, p, q, c;
    var want = {},
      have = {};
    for (i = 0; i < pieces.length; i++) want[pieces[i].id] = (want[pieces[i].id] || 0) + 1;
    for (i = 0; i < places.length; i++) have[places[i].id] = (have[places[i].id] || 0) + 1;
    for (i in want) if (want.hasOwnProperty(i) && have[i] !== want[i]) return "Thiếu hoặc thừa con " + i + " (cần " + want[i] + ", có " + (have[i] || 0) + ").";
    for (i in have) if (have.hasOwnProperty(i) && !want[i]) return "Thừa con " + i + " không có trong danh sách.";
    for (i = 0; i < places.length; i++) {
      p = places[i];
      if (p.x < -EPS || p.y < -EPS || p.x + p.w > W + EPS || p.y + p.h > H + EPS)
        return "Con " + p.id + " nằm ngoài khối (" + r2(p.x) + "," + r2(p.y) + " " + r2(p.w) + "×" + r2(p.h) + ").";
      if (p.rot !== 0 && p.rot !== 90) return "Con " + p.id + " có góc xoay " + p.rot + " (chỉ 0 hoặc 90).";
      for (j = i + 1; j < places.length; j++) {
        q = places[j];
        if (p.x < q.x + q.w - EPS && q.x < p.x + p.w - EPS && p.y < q.y + q.h - EPS && q.y < p.y + p.h - EPS)
          return "Con " + p.id + " và " + q.id + " chồng lên nhau.";
      }
    }
    for (i = 0; i < cuts.length; i++) {
      c = cuts[i];
      if (c.axis !== "V" && c.axis !== "H") return "Nhát cắt " + (i + 1) + " không rõ trục.";
      if (!(c.to > c.from + EPS)) return "Nhát cắt " + (i + 1) + " không có chiều dài.";
      var lim = c.axis === "V" ? W : H,
        span = c.axis === "V" ? H : W;
      if (c.at < -EPS || c.at > lim + EPS || c.from < -EPS || c.to > span + EPS) return "Nhát cắt " + (i + 1) + " nằm ngoài khối.";
      for (j = 0; j < places.length; j++) {
        p = places[j];
        var inside, overlap;
        if (c.axis === "V") {
          inside = c.at > p.x + EPS && c.at < p.x + p.w - EPS;
          overlap = Math.min(c.to, p.y + p.h) - Math.max(c.from, p.y) > EPS;
        } else {
          inside = c.at > p.y + EPS && c.at < p.y + p.h - EPS;
          overlap = Math.min(c.to, p.x + p.w) - Math.max(c.from, p.x) > EPS;
        }
        if (inside && overlap) return "Nhát cắt " + (i + 1) + " xuyên qua con " + p.id + ".";
      }
    }
    // Mỗi cạnh trong của con phải được phủ bởi các nhát cắt cùng đường.
    function covered(axis, at, a, b) {
      var segs = [],
        k,
        pos;
      for (k = 0; k < cuts.length; k++)
        if (cuts[k].axis === axis && Math.abs(cuts[k].at - at) <= EPS) segs.push([cuts[k].from, cuts[k].to]);
      segs.sort(function (s, t) {
        return s[0] - t[0];
      });
      pos = a;
      for (k = 0; k < segs.length && pos < b - EPS; k++) {
        if (segs[k][0] > pos + EPS) break;
        if (segs[k][1] > pos) pos = segs[k][1];
      }
      return pos >= b - EPS;
    }
    for (i = 0; i < places.length; i++) {
      p = places[i];
      if (p.x > EPS && !covered("V", p.x, p.y, p.y + p.h)) return "Cạnh trái của con " + p.id + " không nằm trên nhát cắt.";
      if (p.x + p.w < W - EPS && !covered("V", p.x + p.w, p.y, p.y + p.h)) return "Cạnh phải của con " + p.id + " không nằm trên nhát cắt.";
      if (p.y > EPS && !covered("H", p.y, p.x, p.x + p.w)) return "Cạnh trên của con " + p.id + " không nằm trên nhát cắt.";
      if (p.y + p.h < H - EPS && !covered("H", p.y + p.h, p.x, p.x + p.w)) return "Cạnh dưới của con " + p.id + " không nằm trên nhát cắt.";
    }
    // Guillotine: tìm đệ quy một nhát chạy suốt hình chữ nhật đang xét rồi chia đôi.
    function piecesIn(rect) {
      var list = [],
        k;
      for (k = 0; k < places.length; k++) {
        p = places[k];
        if (p.x + p.w > rect.x0 + EPS && p.x < rect.x1 - EPS && p.y + p.h > rect.y0 + EPS && p.y < rect.y1 - EPS) list.push(p);
      }
      return list;
    }
    function spanningCut(rect) {
      var k, s, segs, pos, atList = {}, keys = [], key, m;
      // Gom các nhát cùng trục cùng vị trí nằm trong hình.
      for (k = 0; k < cuts.length; k++) {
        c = cuts[k];
        if (c.axis === "V") {
          if (c.at <= rect.x0 + EPS || c.at >= rect.x1 - EPS) continue;
          if (Math.min(c.to, rect.y1) - Math.max(c.from, rect.y0) <= EPS) continue;
        } else {
          if (c.at <= rect.y0 + EPS || c.at >= rect.y1 - EPS) continue;
          if (Math.min(c.to, rect.x1) - Math.max(c.from, rect.x0) <= EPS) continue;
        }
        key = c.axis + ":" + r2(c.at);
        if (!atList[key]) {
          atList[key] = { axis: c.axis, at: c.at, segs: [] };
          keys.push(key);
        }
        atList[key].segs.push([c.from, c.to]);
      }
      keys.sort();
      for (m = 0; m < keys.length; m++) {
        s = atList[keys[m]];
        var a = s.axis === "V" ? rect.y0 : rect.x0,
          b = s.axis === "V" ? rect.y1 : rect.x1;
        segs = s.segs.slice(0).sort(function (u, v) {
          return u[0] - v[0];
        });
        pos = a;
        for (k = 0; k < segs.length && pos < b - EPS; k++) {
          if (segs[k][0] > pos + EPS) break;
          if (segs[k][1] > pos) pos = segs[k][1];
        }
        if (pos >= b - EPS) return s;
      }
      return null;
    }
    function guillotine(rect, depth) {
      if (depth > 400) return "Cây nhát cắt quá sâu.";
      var inside = piecesIn(rect);
      if (inside.length <= 1) {
        if (inside.length === 1) {
          p = inside[0];
          // Con duy nhất trong hình: cạnh trong của nó đã phải nằm trên nhát cắt (kiểm ở trên).
        }
        if (!spanningCut(rect)) return null;
      }
      var s = spanningCut(rect);
      if (!s) return "Không có nhát thẳng chạy suốt để tách " + inside.length + " con trong vùng " + r2(rect.x0) + "," + r2(rect.y0) + "–" + r2(rect.x1) + "," + r2(rect.y1) + ".";
      var e1, e2;
      if (s.axis === "V") {
        e1 = guillotine({ x0: rect.x0, y0: rect.y0, x1: s.at, y1: rect.y1 }, depth + 1);
        e2 = guillotine({ x0: s.at, y0: rect.y0, x1: rect.x1, y1: rect.y1 }, depth + 1);
      } else {
        e1 = guillotine({ x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: s.at }, depth + 1);
        e2 = guillotine({ x0: rect.x0, y0: s.at, x1: rect.x1, y1: rect.y1 }, depth + 1);
      }
      return e1 || e2;
    }
    var g = guillotine({ x0: 0, y0: 0, x1: W, y1: H }, 0);
    if (g) return g;
    return null;
  }

  // Chấm bố cục: số nhát cắt (ít hơn tốt hơn) và số cặp con cùng tag chung cạnh (nhiều hơn tốt hơn).
  function scoreLayout(places, cuts) {
    var adjacent = 0,
      i,
      j,
      p,
      q;
    for (i = 0; i < places.length; i++) {
      p = places[i];
      for (j = i + 1; j < places.length; j++) {
        q = places[j];
        if (p.id !== q.id) continue;
        var shareV =
          (Math.abs(p.x + p.w - q.x) <= EPS || Math.abs(q.x + q.w - p.x) <= EPS) &&
          Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) > EPS;
        var shareH =
          (Math.abs(p.y + p.h - q.y) <= EPS || Math.abs(q.y + q.h - p.y) <= EPS) &&
          Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) > EPS;
        if (shareV || shareH) adjacent++;
      }
    }
    return { cuts: cuts.length, adjacent: adjacent };
  }

  // ------------------------------------------------------------------
  //  Khổ khối hợp lệ: a ô 56 × b ô 92, số ô tăng dần, bằng ô thì khối
  //  "vuông" hơn (|56a − 92b| nhỏ hơn) trước.
  // ------------------------------------------------------------------
  function blockShapes() {
    var list = [],
      a,
      b;
    for (a = 1; a <= MAX_COLS; a++)
      for (b = 1; b <= MAX_ROWS; b++)
        list.push({ cols: a, rows: b, w: CELL_W * a, h: CELL_H * b, cells: a * b });
    list.sort(function (p, q) {
      if (p.cells !== q.cells) return p.cells - q.cells;
      var dp = Math.abs(p.w - p.h),
        dq = Math.abs(q.w - q.h);
      if (dp !== dq) return dp - dq;
      return p.cols - q.cols;
    });
    return list;
  }

  function fitsShape(p, shape) {
    return (p.w <= shape.w + EPS && p.h <= shape.h + EPS) || (p.h <= shape.w + EPS && p.w <= shape.h + EPS);
  }
  function allFit(pieces, shape) {
    for (var i = 0; i < pieces.length; i++) if (!fitsShape(pieces[i], shape)) return false;
    return true;
  }
  function areaOf(pieces) {
    var s = 0;
    for (var i = 0; i < pieces.length; i++) s += pieces[i].w * pieces[i].h;
    return s;
  }
  function lowerBoundOf(pieces) {
    return Math.max(1, Math.ceil(areaOf(pieces) / (CELL_W * CELL_H) - 1e-9));
  }
  function pieceKey(pieces) {
    var ids = [];
    for (var i = 0; i < pieces.length; i++) ids.push(pieces[i].id);
    ids.sort();
    return ids.join(",");
  }

  // ------------------------------------------------------------------
  //  BÓP ĐỂ VỪA KHỐI. Xếp con nguyên khổ vào khối rộng/cao hơn khối thật vài mm, dựng lại cây
  //  guillotine từ nhát cắt, rồi "co" cây về đúng khối: chỗ trống hút trước; còn lại chia cho
  //  các con trên cùng dãy, mỗi con ≤ 1 mm (mức 1); còn thiếu ≤ 2 mm nữa thì chia tiếp cho cả cụm
  //  theo cỡ con (mức 2). Con nằm cạnh nhau (nhát dọc) phải co cùng một lượng theo chiều cao, và
  //  ngược lại — đúng như bóp tay trong Illustrator.
  // ------------------------------------------------------------------
  function treeFromLayout(places, cuts, W, H) {
    function build(x, y, w, h) {
      var inside = [],
        i,
        p,
        c,
        a,
        b;
      for (i = 0; i < places.length; i++) {
        p = places[i];
        if (p.x >= x - EPS && p.y >= y - EPS && p.x + p.w <= x + w + EPS && p.y + p.h <= y + h + EPS) inside.push(p);
      }
      if (!inside.length) return { kind: "empty", w: w, h: h };
      for (i = 0; i < cuts.length; i++) {
        c = cuts[i];
        if (c.axis === "V" && c.from <= y + EPS && c.to >= y + h - EPS && c.at > x + EPS && c.at < x + w - EPS) {
          a = build(x, y, c.at - x, h);
          b = build(c.at, y, x + w - c.at, h);
          return a && b ? { kind: "V", a: a, b: b, w: w, h: h } : null;
        }
        if (c.axis === "H" && c.from <= x + EPS && c.to >= x + w - EPS && c.at > y + EPS && c.at < y + h - EPS) {
          a = build(x, y, w, c.at - y);
          b = build(x, c.at, w, y + h - c.at);
          return a && b ? { kind: "H", a: a, b: b, w: w, h: h } : null;
        }
      }
      if (inside.length === 1) {
        p = inside[0];
        if (Math.abs(p.w - w) <= EPS && Math.abs(p.h - h) <= EPS) return { kind: "piece", p: p, w: p.w, h: p.h };
        // Con ở góc trên trái, phần còn lại trống (nhát bị bỏ vì hai bên đều trống).
        if (Math.abs(p.x - x) <= EPS && Math.abs(p.y - y) <= EPS) {
          if (p.w < w - EPS) {
            a = build(x, y, p.w, h);
            return a ? { kind: "V", a: a, b: { kind: "empty", w: w - p.w, h: h }, w: w, h: h } : null;
          }
          a = build(x, y, w, p.h);
          return a ? { kind: "H", a: a, b: { kind: "empty", w: w, h: h - p.h }, w: w, h: h } : null;
        }
      }
      return null;
    }
    return build(0, 0, W, H);
  }
  // Sức co của một nút theo trục: { trong: chỗ trống hút được, con: tổng 1 mm của các con }.
  // Dọc (y): nhát ngang cộng hai phần, nhát dọc lấy phần yếu hơn (hai bên phải co bằng nhau).
  function sucCo(n, truc) {
    var congKind = truc === "y" ? "H" : "V";
    if (n.kind === "empty") return { trong: truc === "y" ? n.h : n.w, con: 0 };
    if (n.kind === "piece") return { trong: 0, con: BOP_MOI_CON_MM };
    var a = sucCo(n.a, truc),
      b = sucCo(n.b, truc);
    if (n.kind === congKind) return { trong: a.trong + b.trong, con: a.con + b.con };
    var ta = a.trong + a.con,
      tb = b.trong + b.con,
      yeu = ta <= tb ? a : b;
    return { trong: yeu.trong, con: yeu.con };
  }
  // Tổng cỡ các con của nút theo trục (để chia mức 2 theo cỡ): H cộng, V lấy max.
  function coCon(n, truc) {
    if (n.kind === "empty") return 0;
    if (n.kind === "piece") return truc === "y" ? n.h : n.w;
    var congKind = truc === "y" ? "H" : "V",
      a = coCon(n.a, truc),
      b = coCon(n.b, truc);
    return n.kind === congKind ? a + b : Math.max(a, b);
  }
  // Co nút đi d theo trục. Thứ tự: chỗ trống → mỗi con ≤ 1 mm (chia đều theo sức) → phần dư chia
  // cho cả cụm theo cỡ con.
  function coNut(n, truc, d) {
    if (d <= 1e-9) return;
    var congKind = truc === "y" ? "H" : "V";
    if (n.kind === "empty") {
      if (truc === "y") n.h -= d;
      else n.w -= d;
      return;
    }
    if (n.kind === "piece") {
      if (truc === "y") n.h = n.p.h = r2(n.p.h - d);
      else n.w = n.p.w = r2(n.p.w - d);
      return;
    }
    if (n.kind !== congKind) {
      coNut(n.a, truc, d);
      coNut(n.b, truc, d);
    } else {
      var sa = sucCo(n.a, truc),
        sb = sucCo(n.b, truc),
        da = Math.min(sa.trong, d),
        db = Math.min(sb.trong, d - da),
        con = d - da - db;
      if (con > 1e-9) {
        var ca = sa.con,
          cb = sb.con,
          phanCon = Math.min(con, ca + cb);
        if (ca + cb > 0) {
          da += (phanCon * ca) / (ca + cb);
          db += (phanCon * cb) / (ca + cb);
        }
        var them = con - phanCon; // mức 2: chia theo cỡ con cho cả cụm
        if (them > 1e-9) {
          var ka = coCon(n.a, truc),
            kb = coCon(n.b, truc);
          if (ka + kb > 0) {
            da += (them * ka) / (ka + kb);
            db += (them * kb) / (ka + kb);
          } else da += them;
        }
      }
      coNut(n.a, truc, da);
      coNut(n.b, truc, db);
    }
    if (truc === "y") n.h -= d;
    else n.w -= d;
  }
  function coCay(n) {
    if (n.kind === "empty" || n.kind === "piece") return;
    coCay(n.a);
    coCay(n.b);
    if (n.kind === "V") {
      n.w = n.a.w + n.b.w;
      n.h = Math.max(n.a.h, n.b.h);
    } else {
      n.w = Math.max(n.a.w, n.b.w);
      n.h = n.a.h + n.b.h;
    }
  }
  function coCon2(n) {
    return n.kind === "piece" || (n.kind !== "empty" && (coCon2(n.a) || coCon2(n.b)));
  }
  function layoutTuCay(n, x, y, out) {
    if (n.kind === "empty") return;
    if (n.kind === "piece") {
      out.places.push({ id: n.p.id, x: r2(x), y: r2(y), w: r2(n.p.w), h: r2(n.p.h), rot: n.p.rot, bopX: n.p.bopX, bopY: n.p.bopY });
      return;
    }
    if (n.kind === "V") {
      if (coCon2(n.a) || coCon2(n.b)) out.cuts.push({ axis: "V", at: r2(x + n.a.w), from: r2(y), to: r2(y + n.h) });
      layoutTuCay(n.a, x, y, out);
      layoutTuCay(n.b, x + n.a.w, y, out);
    } else {
      if (coCon2(n.a) || coCon2(n.b)) out.cuts.push({ axis: "H", at: r2(y + n.a.h), from: r2(x), to: r2(x + n.w) });
      layoutTuCay(n.a, x, y, out);
      layoutTuCay(n.b, x, y + n.a.h, out);
    }
  }
  // Thử co một bố cục (xếp trong khối W+dx × H+dy) về đúng W × H. Trả { places, cuts, bop } hoặc null.
  function coBoCuc(layout, W, H, dx, dy) {
    var tree = treeFromLayout(layout.places, layout.cuts, W + dx, H + dy);
    if (!tree) return null;
    var i;
    // Gắn khổ gốc để tính hệ số co từng con.
    for (i = 0; i < layout.places.length; i++) {
      layout.places[i].bopX = 1;
      layout.places[i].bopY = 1;
      layout.places[i].w0 = layout.places[i].w;
      layout.places[i].h0 = layout.places[i].h;
    }
    if (dy > 1e-9) {
      var sy = sucCo(tree, "y");
      if (dy > sy.trong + sy.con + BOP_THEM_CUM_MM + 1e-9) return null;
      coNut(tree, "y", dy);
    }
    if (dx > 1e-9) {
      var sx = sucCo(tree, "x");
      if (dx > sx.trong + sx.con + BOP_THEM_CUM_MM + 1e-9) return null;
      coNut(tree, "x", dx);
    }
    coCay(tree);
    // Khổ con làm tròn 0,01 mm nên tổng có thể dư vài phần trăm mm. Bớt phần dư đó theo đơn vị
    // 0,01 (số nguyên) để tổng khớp đúng khổ: chỗ trống hút trước, rồi mỗi con bớt 0,01 cho tới đủ;
    // hai bên một nhát dọc bớt bằng nhau theo chiều cao (và ngược lại).
    function sucHundredths(n, truc) {
      var congKind = truc === "y" ? "H" : "V";
      if (n.kind === "empty") return Math.floor((truc === "y" ? n.h : n.w) * 100 + 1e-6);
      if (n.kind === "piece") return 1;
      var a = sucHundredths(n.a, truc),
        b = sucHundredths(n.b, truc);
      return n.kind === congKind ? a + b : Math.min(a, b);
    }
    function botHundredths(n, truc, R) {
      if (R <= 0) return;
      var congKind = truc === "y" ? "H" : "V",
        d = R / 100;
      if (n.kind === "empty") {
        if (truc === "y") n.h = r2(n.h - d);
        else n.w = r2(n.w - d);
        return;
      }
      if (n.kind === "piece") {
        if (truc === "y") n.h = n.p.h = r2(n.p.h - d);
        else n.w = n.p.w = r2(n.p.w - d);
        return;
      }
      if (n.kind !== congKind) {
        botHundredths(n.a, truc, R);
        botHundredths(n.b, truc, R);
        return;
      }
      var ra = Math.min(sucHundredths(n.a, truc), R);
      botHundredths(n.a, truc, ra);
      botHundredths(n.b, truc, R - ra);
    }
    for (i = 0; i < 3 && (tree.w > W + 1e-9 || tree.h > H + 1e-9); i++) {
      if (tree.h > H + 1e-9) {
        var Ry = Math.ceil((tree.h - H) * 100 - 1e-6);
        if (Ry > sucHundredths(tree, "y")) return null;
        botHundredths(tree, "y", Ry);
      }
      if (tree.w > W + 1e-9) {
        var Rx = Math.ceil((tree.w - W) * 100 - 1e-6);
        if (Rx > sucHundredths(tree, "x")) return null;
        botHundredths(tree, "x", Rx);
      }
      coCay(tree);
    }
    if (tree.w > W + EPS || tree.h > H + EPS) return null;
    var out = { places: [], cuts: [] },
      soCon = 0,
      maxMm = 0,
      muc2 = 0;
    for (i = 0; i < layout.places.length; i++) {
      var p = layout.places[i];
      if (p.w <= EPS || p.h <= EPS) return null;
      p.bopX = p.w / p.w0;
      p.bopY = p.h / p.h0;
      var mm = Math.max(p.w0 - p.w, p.h0 - p.h);
      if (mm > 1e-6) soCon++;
      if (mm > BOP_MOI_CON_MM + 1e-6) muc2++;
      maxMm = Math.max(maxMm, mm);
    }
    layoutTuCay(tree, 0, 0, out);
    out.bop = { soCon: soCon, maxMm: Math.round(maxMm * 100) / 100, muc2: muc2 };
    return out;
  }
  // Sắp bố cục theo thứ tự danh sách (như Dàn tối ưu/KTS): tag thêm trước nằm trước — con đầu danh
  // sách ở góc trên trái, các con sau nối tiếp trái → phải, trên → dưới theo cây cắt. Hai bên của bất
  // kỳ nhát cắt nào đổi chỗ cho nhau vẫn là nhát thẳng xuyên suốt, nên chỉ đổi chỗ: khổ con, số ô, mức
  // bóp giữ nguyên. hang(place) = chỉ số tag trong danh sách. Không dựng lại được cây thì giữ nguyên.
  function sapTheoDanhSach(places, cuts, W, H, hang) {
    var tree = treeFromLayout(places, cuts, W, H);
    if (!tree) return null;
    function nhoNhat(n) {
      if (n.kind === "empty") return Infinity; // chỗ trống dồn về cuối
      if (n.kind === "piece") return hang(n.p);
      var a = nhoNhat(n.a),
        b = nhoNhat(n.b);
      if (b < a) {
        var t = n.a;
        n.a = n.b;
        n.b = t;
      }
      return a < b ? a : b;
    }
    nhoNhat(tree);
    var out = { places: [], cuts: [] };
    layoutTuCay(tree, 0, 0, out);
    return out.places.length === places.length ? out : null;
  }
  // Tìm cách bóp để bộ con vừa khối W × H: nới khối thêm dy (cao) / dx (rộng) từ ít tới nhiều,
  // xếp nguyên khổ rồi co về. packFn(w, h) trả kết quả packInto (có layouts).
  function bopKhoi(pieces, W, H, packFn) {
    var toiDa = pieces.length * BOP_MOI_CON_MM + BOP_THEM_CUM_MM,
      k,
      li,
      r,
      co;
    var thu = [];
    for (k = 1; k <= toiDa; k++) thu.push([0, k], [k, 0]);
    for (k = 1; k <= toiDa; k++) thu.push([k, k]);
    for (k = 0; k < thu.length; k++) {
      r = packFn(W + thu[k][0], H + thu[k][1]);
      if (!r.ok) continue;
      for (li = 0; li < r.layouts.length; li++) {
        var lay = { places: r.layouts[li].places.map(function (q) { return { id: q.id, x: q.x, y: q.y, w: q.w, h: q.h, rot: q.rot }; }), cuts: r.layouts[li].cuts };
        co = coBoCuc(lay, W, H, thu[k][0], thu[k][1]);
        if (co) return co;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  //  Đầu vào: tags [{ id, name, w, h, qty }]. Tách bài 500 / bài 1000 và nhân con.
  // ------------------------------------------------------------------
  function buildJobs(input) {
    var tags = input && input.tags ? input.tags : [],
      jobsByBai = { 500: null, 1000: null },
      order = [500, 1000],
      i,
      t,
      qty,
      copies,
      bai,
      shapes = blockShapes(),
      biggest = shapes[shapes.length - 1];
    if (!tags.length) throw new Error("Chưa có tag nào trong danh sách.");
    for (i = 0; i < tags.length; i++) {
      t = tags[i];
      if (!t || !(t.w > EPS) || !(t.h > EPS)) throw new Error("Tag " + (i + 1) + " không có khổ hợp lệ.");
      qty = Number(t.qty);
      if (qty === 500) {
        bai = 500;
        copies = 1;
      } else if (qty >= 1000 && qty % 1000 === 0) {
        bai = 1000;
        copies = qty / 1000;
      } else {
        throw new Error("Số lượng phải là 500 hoặc bội của 1000 (1000, 2000, 3000…). Tag " + (t.name || t.id || i + 1) + " đang nhập " + t.qty + ".");
      }
      // Lọt tờ: khối lớn nhất 18 × 7 ô theo chiều nào đó.
      var fitsAny = false;
      for (var si = shapes.length - 1; si >= 0 && !fitsAny; si--) if (fitsShape(t, shapes[si])) fitsAny = true;
      if (!fitsAny)
        throw new Error(
          "Tag " + (t.name || t.id) + " khổ " + r2(t.w) + " × " + r2(t.h) + " mm không lọt tờ " + biggest.w + " × " + biggest.h + " mm (kể cả xoay).",
        );
      if (!jobsByBai[bai]) jobsByBai[bai] = { bai: bai, hop: bai === 500 ? 5 : 10, pieces: [], tags: [] };
      jobsByBai[bai].tags.push({ id: t.id, name: t.name || t.id, w: t.w, h: t.h, qty: qty, copies: copies });
      for (var k = 0; k < copies; k++) jobsByBai[bai].pieces.push({ id: t.id, w: t.w, h: t.h });
    }
    var jobs = [];
    for (i = 0; i < order.length; i++) if (jobsByBai[order[i]]) jobs.push(jobsByBai[order[i]]);
    return jobs;
  }

  // Một phương án của bài: danh sách khối { shape, pieces, places, cuts }.
  function planCells(plan) {
    var s = 0;
    for (var i = 0; i < plan.blocks.length; i++) s += plan.blocks[i].shape.cells;
    return s;
  }
  // Thứ tự ưu tiên khi so hai phương án: ít ô → ít khối → ít nhát cắt → ít con phải xoay
  // (cùng chiều cho dễ kiểm) → nhiều cặp con cùng tag kề nhau.
  function planScore(plan) {
    var cuts = 0,
      adjacent = 0,
      rotated = 0,
      i,
      k,
      sc;
    for (i = 0; i < plan.blocks.length; i++) {
      sc = scoreLayout(plan.blocks[i].places, plan.blocks[i].cuts);
      cuts += sc.cuts;
      adjacent += sc.adjacent;
      for (k = 0; k < plan.blocks[i].places.length; k++) if (plan.blocks[i].places[k].rot) rotated++;
    }
    return [planCells(plan), plan.blocks.length, cuts, rotated, -adjacent];
  }
  function betterPlan(a, b) {
    if (!b) return true;
    var sa = planScore(a),
      sb = planScore(b);
    for (var i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i] < sb[i];
    return false;
  }

  // Phân hoạch con thành 2 (hoặc 3) phần để thử nhiều khối.
  function partitions(pieces, maxParts) {
    var types = groupTypes(pieces),
      byType = {},
      i,
      parts = [],
      seen = {};
    for (i = 0; i < pieces.length; i++) {
      if (!byType[pieces[i].id]) byType[pieces[i].id] = [];
      byType[pieces[i].id].push(pieces[i]);
    }
    function add(groups) {
      var nonEmpty = [],
        keys = [],
        g;
      for (g = 0; g < groups.length; g++) if (groups[g].length) nonEmpty.push(groups[g]);
      if (nonEmpty.length < 2) return;
      for (g = 0; g < nonEmpty.length; g++) keys.push(pieceKey(nonEmpty[g]));
      keys.sort();
      var key = keys.join("|");
      if (seen[key]) return;
      seen[key] = true;
      parts.push(nonEmpty);
    }
    // Theo loại tag (mọi con cùng tag về cùng khối): 2 phần, và 3 phần khi ít loại.
    var n = types.length;
    if (n >= 2 && n <= 10) {
      var mask, g, groups;
      for (mask = 1; mask < 1 << n; mask++) {
        if (!(mask & 1)) continue; // loại đầu luôn ở phần 1 -> không trùng cặp
        groups = [[], []];
        for (g = 0; g < n; g++) groups[mask & (1 << g) ? 0 : 1] = groups[mask & (1 << g) ? 0 : 1].concat(byType[types[g].id]);
        add(groups);
      }
      if (maxParts >= 3 && n >= 3 && n <= 6) {
        var assign = [],
          total = Math.pow(3, n),
          code,
          v;
        for (code = 0; code < total; code++) {
          v = code;
          groups = [[], [], []];
          for (g = 0; g < n; g++) {
            groups[v % 3] = groups[v % 3].concat(byType[types[g].id]);
            v = Math.floor(v / 3);
          }
          if (groups[0].length && groups[1].length && groups[2].length) add(groups);
        }
      }
    }
    // Tham lam có tách con cùng tag: lấy k con đầu theo ba thứ tự.
    var orders = [
      function (a, b) {
        return b.w * b.h - a.w * a.h;
      },
      function (a, b) {
        return Math.max(b.w, b.h) - Math.max(a.w, a.h);
      },
      function (a, b) {
        return Math.min(b.w, b.h) - Math.min(a.w, a.h);
      },
    ];
    for (i = 0; i < orders.length; i++) {
      var sorted = pieces.slice(0).sort(function (a, b) {
        var d = orders[i](a, b);
        return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
      for (var k = 1; k < sorted.length; k++) add([sorted.slice(0, k), sorted.slice(k)]);
    }
    return parts;
  }

  // Tham lam mở khối: con lớn trước; mỗi con vào khối sẵn có nếu tổng ô tăng ít nhất, không thì mở khối mới.
  function greedyPlan(pieces, shapes, packMemo, dienTichFn) {
    dienTichFn = dienTichFn || areaOf;
    var sorted = pieces.slice(0).sort(function (a, b) {
      var d = b.w * b.h - a.w * a.h;
      return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    var blocks = [],
      i,
      bi;
    function smallest(list, minCells) {
      for (var si = 0; si < shapes.length; si++) {
        if (shapes[si].cells < minCells) continue;
        if (!allFit(list, shapes[si])) continue;
        if (dienTichFn(list) > shapes[si].w * shapes[si].h + EPS) continue;
        var r = packMemo(list, shapes[si]);
        if (r.ok) return { shape: shapes[si], places: r.places, cuts: r.cuts, pieces: list, bop: r.bop };
      }
      return null;
    }
    for (i = 0; i < sorted.length; i++) {
      var best = null,
        bestIdx = -1,
        bestInc = Infinity;
      for (bi = 0; bi < blocks.length; bi++) {
        var trial = smallest(blocks[bi].goc.concat([sorted[i]]), blocks[bi].shape.cells);
        if (trial && trial.shape.cells - blocks[bi].shape.cells < bestInc) {
          best = trial;
          bestIdx = bi;
          bestInc = trial.shape.cells - blocks[bi].shape.cells;
        }
      }
      var fresh = smallest([sorted[i]], 1);
      if (!fresh) return null;
      if (best && bestInc <= fresh.shape.cells) {
        blocks[bestIdx] = { shape: best.shape, goc: blocks[bestIdx].goc.concat([sorted[i]]), pieces: best.pieces, places: best.places, cuts: best.cuts, bop: best.bop };
      } else {
        blocks.push({ shape: fresh.shape, goc: [sorted[i]], pieces: fresh.pieces, places: fresh.places, cuts: fresh.cuts, bop: fresh.bop });
      }
    }
    return { blocks: blocks };
  }

  // ------------------------------------------------------------------
  //  Bộ tìm từng bước (để panel hiện tiến độ). pack() chạy tới khi xong.
  // ------------------------------------------------------------------
  function createSearch(input) {
    var budgetMs = input && input.budgetMs ? input.budgetMs : 4000;
    var shapes = blockShapes();
    var jobs,
      error = null,
      startedAt = null,
      finished = false,
      timedOut = false,
      exhausted = false,
      jobIndex = 0,
      memo = {},
      output = null;
    try {
      jobs = buildJobs(input);
    } catch (e) {
      error = e && e.message ? e.message : String(e);
      finished = true;
      output = { ok: false, error: error };
    }
    function packRaw(pieces, w, h, collect, budget) {
      var key = pieceKey(pieces) + "@" + r2(w) + "x" + r2(h) + "#" + (collect || 1) + "/" + (budget || 0);
      if (!memo[key]) {
        memo[key] = packInto(pieces, w, h, { collect: collect || 1, budget: budget || DEFAULT_BUDGET });
        if (memo[key].exhausted && !budget) exhausted = true;
      }
      return memo[key];
    }
    // Xếp nguyên khổ; ở pha bóp (job.bopMode) mà chưa vừa thì thử bóp (bopKhoi). Kết quả bóp mang
    // bop = { soCon, maxMm, muc2 } và places có bopX/bopY.
    var bopMode = false;
    function packMemo(pieces, shape, collect, budget) {
      var r = packRaw(pieces, shape.w, shape.h, collect, budget);
      if (r.ok || !bopMode) return r;
      var key = "bop:" + pieceKey(pieces) + "@" + shape.cols + "x" + shape.rows + "/" + (budget || 0);
      if (!memo[key]) {
        var co = bopKhoi(pieces, shape.w, shape.h, function (w, h) {
          return packRaw(pieces, w, h, 4, budget);
        });
        memo[key] = co ? { ok: true, places: co.places, cuts: co.cuts, layouts: [{ places: co.places, cuts: co.cuts }], bop: co.bop } : { ok: false, places: [], cuts: [], layouts: [] };
      }
      return memo[key];
    }
    // Pha tham lam chỉ cần khối cơ bản nhanh: ngân sách nút nhỏ để không treo panel khi nhiều tag khác nhau.
    function packQuick(pieces, shape) {
      return packMemo(pieces, shape, 1, 3000);
    }
    function initJob(job) {
      job.lowerBound = lowerBoundOf(job.pieces);
      job.best = null;
      job.bestKhongBop = null; // phương án tốt nhất khi chưa bóp (để so sau pha bóp)
      job.lowerBoundGoc = job.lowerBound;
      job.daThuBop = false;
      job.phase = "greedy";
      job.shapeIdx = 0;
      job.T = 0;
      job.cands = null;
      job.candIdx = 0;
      job.done = 0;
      job.total = 1;
    }
    if (jobs) for (var ji = 0; ji < jobs.length; ji++) initJob(jobs[ji]);

    function consider(job, plan) {
      // Chốt chặn độc lập từng khối rồi mới nhận.
      for (var b = 0; b < plan.blocks.length; b++) {
        var blk = plan.blocks[b];
        if (verify(blk.places, blk.cuts, blk.shape.w, blk.shape.h, blk.pieces)) return false;
      }
      if (betterPlan(plan, job.best)) job.best = plan;
      return true;
    }
    function bestCells(job) {
      return job.best ? planCells(job.best) : Infinity;
    }
    function singleCandidates(job) {
      var list = [],
        si;
      for (si = 0; si < shapes.length; si++) {
        if (shapes[si].cells < job.lowerBound) continue;
        if (!allFit(job.pieces, shapes[si])) continue;
        if (dienTich(job.pieces) > shapes[si].w * shapes[si].h + EPS) continue;
        list.push(shapes[si]);
      }
      return list;
    }
    // Ứng viên nhiều khối cho tổng ô T: [{ parts, shapesPerPart }].
    function multiCandidates(job, T) {
      var list = [],
        parts = job.partitions,
        pi,
        groups,
        lbs,
        gi;
      function rec(idx, remainingCells, chosen) {
        if (idx === groups.length) {
          if (remainingCells === 0) list.push({ groups: groups, shapes: chosen.slice(0) });
          return;
        }
        var minRest = 0,
          k;
        for (k = idx + 1; k < groups.length; k++) minRest += lbs[k];
        for (var si = 0; si < shapes.length; si++) {
          var sh = shapes[si];
          if (sh.cells < lbs[idx] || sh.cells > remainingCells - minRest) continue;
          if (!allFit(groups[idx], sh)) continue;
          chosen.push(sh);
          rec(idx + 1, remainingCells - sh.cells, chosen);
          chosen.pop();
        }
      }
      for (pi = 0; pi < parts.length; pi++) {
        groups = parts[pi];
        lbs = [];
        var sumLb = 0;
        for (gi = 0; gi < groups.length; gi++) {
          lbs.push(canDuoi(groups[gi]));
          sumLb += lbs[gi];
        }
        if (sumLb > T) continue;
        rec(0, T, []);
      }
      return list;
    }
    var greedyDone = false;
    function greedyAll() {
      // Mọi bài có khối cơ bản trước khi tìm sâu, nên hết giờ ở bài nào cũng không mất bài khác.
      for (var k = 0; k < jobs.length; k++) {
        if (jobs[k].phase !== "greedy") continue;
        var g = greedyPlan(jobs[k].pieces, shapes, packQuick);
        if (g) consider(jobs[k], g);
      }
      greedyDone = true;
    }
    // Diện tích/cận dưới khi được bóp: mỗi con có thể bớt 1 mm mỗi chiều (+ chút ít mức 2).
    function areaBop(pieces) {
      var area = 0;
      for (var i = 0; i < pieces.length; i++) area += Math.max(0, pieces[i].w - 2) * Math.max(0, pieces[i].h - 2);
      return area;
    }
    function lowerBoundBop(pieces) {
      return Math.max(1, Math.ceil(areaBop(pieces) / (CELL_W * CELL_H) - 1e-9));
    }
    function dienTich(pieces) {
      return bopMode ? areaBop(pieces) : areaOf(pieces);
    }
    function canDuoi(pieces) {
      return bopMode ? lowerBoundBop(pieces) : lowerBoundOf(pieces);
    }
    // Pha bóp: xong tìm kiếm thường mà vẫn dư ô so với cận dưới khi bóp → tìm lại với quyền bóp.
    function batDauBop(job) {
      if (job.daThuBop || !job.best) return false;
      job.daThuBop = true;
      var lb = lowerBoundBop(job.pieces);
      if (lb >= planCells(job.best)) return false; // bóp cũng không thể ít ô hơn
      job.bestKhongBop = job.best;
      job.best = null;
      job.lowerBound = lb;
      job.cands = null;
      job.candIdx = 0;
      job.done = 0;
      job.total = 1;
      bopMode = true;
      return true;
    }
    // Chốt sau pha bóp: chỉ nhận phương án bóp khi thật sự ít ô hơn; không thì trả về như chưa bóp.
    function chotBop(job) {
      if (!job.bestKhongBop) return;
      var cellsBop = job.best ? planCells(job.best) : Infinity,
        cellsGoc = planCells(job.bestKhongBop);
      if (cellsBop < cellsGoc) {
        job.cellsTruocBop = cellsGoc;
        return;
      }
      job.best = job.bestKhongBop;
      job.lowerBound = job.lowerBoundGoc;
      job.bestKhongBop = null;
    }
    function stepJob(job) {
      if (!greedyDone) {
        greedyAll();
        return;
      }
      if (job.phase === "greedyBop") {
        var gb = greedyPlan(job.pieces, shapes, packQuick, dienTich);
        if (gb) consider(job, gb);
        job.phase = "single";
        job.cands = singleCandidates(job);
        job.candIdx = 0;
        job.total = job.cands.length || 1;
        job.done = 0;
        return;
      }
      if (job.phase === "greedy") {
        job.phase = "single";
        job.cands = singleCandidates(job);
        job.candIdx = 0;
        job.total = job.cands.length || 1;
        job.done = 0;
        return;
      }
      if (job.phase === "single") {
        if (job.candIdx >= job.cands.length || job.cands[job.candIdx].cells > bestCells(job)) {
          job.phase = "multi";
          job.T = job.lowerBound;
          job.partitions = job.pieces.length >= 2 ? partitions(job.pieces, 3) : [];
          job.cands = null;
          return;
        }
        var shape = job.cands[job.candIdx++];
        job.done = job.candIdx;
        var r = packMemo(job.pieces, shape, 24);
        if (r.ok) {
          for (var li = 0; li < r.layouts.length; li++)
            consider(job, { blocks: [{ shape: shape, pieces: job.pieces, places: r.layouts[li].places, cuts: r.layouts[li].cuts, bop: r.bop }] });
        }
        return;
      }
      if (job.phase === "multi") {
        if (job.T >= bestCells(job) || !job.partitions.length) {
          job.phase = batDauBop(job) ? "greedyBop" : "done";
          return;
        }
        if (!job.cands) {
          job.cands = multiCandidates(job, job.T);
          job.candIdx = 0;
          job.total = job.cands.length || 1;
          job.done = 0;
        }
        if (job.candIdx >= job.cands.length) {
          job.T++;
          job.cands = null;
          return;
        }
        var cand = job.cands[job.candIdx++];
        job.done = job.candIdx;
        var blocks = [],
          okAll = true;
        for (var gi = 0; gi < cand.groups.length && okAll; gi++) {
          var rr = packMemo(cand.groups[gi], cand.shapes[gi], 1);
          if (!rr.ok) okAll = false;
          else blocks.push({ shape: cand.shapes[gi], pieces: cand.groups[gi], places: rr.places, cuts: rr.cuts, bop: rr.bop });
        }
        if (okAll) consider(job, { blocks: blocks });
        return;
      }
    }
    function finish() {
      finished = true;
      if (error) {
        output = { ok: false, error: error };
        return;
      }
      var outJobs = [],
        lines = [],
        ji,
        job;
      for (ji = 0; ji < jobs.length; ji++) {
        job = jobs[ji];
        chotBop(job);
        if (!job.best) {
          output = { ok: false, error: "Bài " + job.bai + ": không tìm được cách ghép khối nào trong giới hạn tìm." };
          return;
        }
        var cells = planCells(job.best),
          blocks = [],
          names = [],
          bi,
          thuTu = {};
        for (bi = 0; bi < job.tags.length; bi++) thuTu[job.tags[bi].id] = bi;
        function hang(p) {
          return thuTu[p.id] === undefined ? Infinity : thuTu[p.id];
        }
        for (bi = 0; bi < job.best.blocks.length; bi++) {
          var blk = job.best.blocks[bi],
            counts = {},
            places = [],
            pi;
          // Con đầu danh sách ở góc trên trái, các con sau nối tiếp theo danh sách (như Dàn tối ưu/KTS).
          var sap = sapTheoDanhSach(blk.places, blk.cuts, blk.shape.w, blk.shape.h, hang),
            srcPlaces = sap ? sap.places : blk.places,
            srcCuts = sap ? sap.cuts : blk.cuts;
          for (pi = 0; pi < srcPlaces.length; pi++) {
            var p = srcPlaces[pi];
            counts[p.id] = (counts[p.id] || 0) + 1;
            places.push({ id: p.id, copy: counts[p.id], x: p.x, y: p.y, w: p.w, h: p.h, rot: p.rot, bopX: p.bopX || 1, bopY: p.bopY || 1 });
          }
          blocks.push({
            cols: blk.shape.cols,
            rows: blk.shape.rows,
            w: blk.shape.w,
            h: blk.shape.h,
            cells: blk.shape.cells,
            places: places,
            cuts: srcCuts.slice(0),
            bop: blk.bop || null, // { soCon, maxMm, muc2 } khi khối này có con bị bóp
          });
        }
        // Khối to trước cho dễ nhìn; số thứ tự khối (artboard TagBD k) và câu mô tả theo đúng thứ tự này.
        blocks.sort(function (a, b) {
          return b.cells - a.cells || b.w - a.w;
        });
        for (bi = 0; bi < blocks.length; bi++)
          names.push(blocks[bi].cols + " × " + blocks[bi].rows + " ô (" + blocks[bi].w + " × " + blocks[bi].h + " mm)");
        var proven = cells === job.lowerBound;
        var line =
          "Bài " +
          job.bai +
          ": " +
          blocks.length +
          " khối " +
          names.join(" + ") +
          ", " +
          (proven ? cells + "/" + cells + " ô — không thể ít hơn." : cells + " ô, tối thiểu lý thuyết " + job.lowerBound + ".");
        var daBop = 0,
          bopMax = 0,
          bopMuc2 = 0;
        for (bi = 0; bi < blocks.length; bi++)
          if (blocks[bi].bop) {
            daBop += blocks[bi].bop.soCon;
            bopMax = Math.max(bopMax, blocks[bi].bop.maxMm);
            bopMuc2 += blocks[bi].bop.muc2;
          }
        if (daBop > 0)
          line +=
            " Đã bóp " +
            daBop +
            " con để vừa khối (nhiều nhất " +
            String(bopMax).replace(".", ",") +
            " mm" +
            (bopMuc2 ? ", " + bopMuc2 + " con ăn thêm chút xíu vì chỉ thiếu 1–2 mm" : ", mỗi con ≤ 1 mm") +
            ") — còn " +
            cells +
            " ô thay vì " +
            job.cellsTruocBop +
            ".";
        lines.push(line);
        outJobs.push({
          bai: job.bai,
          hop: job.hop,
          tags: job.tags,
          blocks: blocks,
          cells: cells,
          lowerBound: job.lowerBound,
          proven: proven,
          pieces: job.pieces.length,
          daBop: daBop, // số con bị bóp trong bài (0 = không bóp)
        });
      }
      var allProven = true;
      for (ji = 0; ji < outJobs.length; ji++) if (!outJobs[ji].proven) allProven = false;
      if (timedOut) lines.push("Hết thời gian tìm (" + Math.round(budgetMs / 1000) + " s), dùng phương án tốt nhất đang có.");
      else if (exhausted && !allProven) lines.push("Có khổ chưa xét hết (hết ngân sách tìm), kết quả có thể chưa tối ưu.");
      output = { ok: true, jobs: outJobs, detail: lines.join(" "), elapsedMs: Date.now() - startedAt };
    }
    function step(maxMs) {
      if (finished) return progress();
      if (startedAt === null) startedAt = Date.now();
      var t0 = Date.now();
      while (true) {
        if (jobIndex >= jobs.length) {
          finish();
          break;
        }
        var job = jobs[jobIndex];
        if (job.phase === "done") {
          jobIndex++;
          continue;
        }
        stepJob(job);
        if (Date.now() - startedAt > budgetMs) {
          // Hết giờ: bài nào đã có phương án thì chốt; bài chưa có gì (chưa tới lượt) vẫn phải
          // chạy pha tham lam để có khối — không bao giờ bỏ bài sau vì bài trước tốn hết giờ.
          timedOut = true;
          for (var k = 0; k < jobs.length; k++) if (jobs[k].best || jobs[k].bestKhongBop) jobs[k].phase = "done";
          continue;
        }
        if (Date.now() - t0 >= (maxMs || 0)) break;
      }
      return progress();
    }
    function progress() {
      var done = 0,
        total = 0,
        k;
      for (k = 0; k < (jobs ? jobs.length : 0); k++) {
        done += jobs[k].phase === "done" ? jobs[k].total : Math.min(jobs[k].done, jobs[k].total);
        total += jobs[k].total;
      }
      return { done: done, total: total || 1, finished: finished };
    }
    return {
      step: step,
      result: function () {
        return output;
      },
    };
  }

  function pack(input) {
    var s = createSearch(input),
      p;
    do {
      p = s.step(1e9);
    } while (!p.finished);
    return s.result();
  }

  function packAsync(input, onProgress, done) {
    var s = createSearch(input);
    function tick() {
      var p;
      try {
        p = s.step(40);
      } catch (e) {
        done({ ok: false, error: e && e.message ? e.message : String(e) });
        return;
      }
      if (onProgress) onProgress({ done: p.done, total: p.total });
      if (p.finished) done(s.result());
      else setTimeout(tick, 0);
    }
    setTimeout(tick, 0);
  }

  return {
    VERSION: VERSION,
    CELL_W: CELL_W,
    CELL_H: CELL_H,
    MAX_COLS: MAX_COLS,
    MAX_ROWS: MAX_ROWS,
    EPS: EPS,
    BOP_MOI_CON_MM: BOP_MOI_CON_MM,
    BOP_THEM_CUM_MM: BOP_THEM_CUM_MM,
    treeFromLayout: treeFromLayout,
    sapTheoDanhSach: sapTheoDanhSach,
    coBoCuc: coBoCuc,
    bopKhoi: bopKhoi,
    packInto: packInto,
    verify: verify,
    scoreLayout: scoreLayout,
    blockShapes: blockShapes,
    createSearch: createSearch,
    pack: pack,
    packAsync: packAsync,
  };
});
