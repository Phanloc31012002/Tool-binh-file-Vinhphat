// ============================================================
// DÀN BẾ – CẦU NỐI ILLUSTRATOR <-> nesting_core.js
//
// ExtendScript chỉ đọc path / PON và render. Phần tối ưu hình học chạy ở
// Chromium của CEP để Illustrator không bị treo khi thử nhiều bố cục.
// ============================================================
var dcDanBeNestingVersion = 4;
if (typeof dcDanBeJobs === "undefined") var dcDanBeJobs = {};
if (typeof dcDanBeJobCounter === "undefined") var dcDanBeJobCounter = 1;

// Illustrator ExtendScript does not provide JSON in a fresh engine. Keep this
// bridge independent of unrelated tools that may install a JSON shim later.
var dcDanBeJSON = (function () {
  function quote(value) {
    return '"' + String(value).replace(/["\\\x00-\x1f\u2028\u2029]/g, function (ch) {
      if (ch === '"') return '\\"';
      if (ch === '\\') return '\\\\';
      return '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
    }) + '"';
  }
  function stringify(value) {
    if (value === null) return 'null';
    var kind = typeof value, parts = [], i, key, encoded;
    if (kind === 'string') return quote(value);
    if (kind === 'boolean') return String(value);
    if (kind === 'number') return isFinite(value) ? String(value) : 'null';
    if (kind !== 'object') return undefined;
    if (value instanceof Array) {
      for (i = 0; i < value.length; i++) {
        encoded = stringify(value[i]); parts.push(encoded === undefined ? 'null' : encoded);
      }
      return '[' + parts.join(',') + ']';
    }
    for (key in value) if (Object.prototype.hasOwnProperty.call(value, key)) {
      encoded = stringify(value[key]);
      if (encoded !== undefined) parts.push(quote(key) + ':' + encoded);
    }
    return '{' + parts.join(',') + '}';
  }
  function parse(text) {
    text = String(text); var pos = 0;
    function fail() { throw new SyntaxError('Invalid Dàn bế JSON at ' + pos); }
    function space() { while (/\s/.test(text.charAt(pos)) && pos < text.length) pos++; }
    function string() {
      var out = '', ch, hex; pos++;
      while (pos < text.length) {
        ch = text.charAt(pos++);
        if (ch === '"') return out;
        if (ch === '\\') {
          ch = text.charAt(pos++);
          if (ch === 'u') {
            hex = text.substr(pos, 4); if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
            out += String.fromCharCode(parseInt(hex, 16)); pos += 4;
          } else if (ch === '"' || ch === '\\' || ch === '/') out += ch;
          else if (ch === 'b') out += '\b'; else if (ch === 'f') out += '\f';
          else if (ch === 'n') out += '\n'; else if (ch === 'r') out += '\r';
          else if (ch === 't') out += '\t'; else fail();
        } else { if (ch.charCodeAt(0) < 32) fail(); out += ch; }
      }
      fail();
    }
    function value(depth) {
      if (depth > 64) fail(); space();
      var ch = text.charAt(pos), out, key, token;
      if (ch === '"') return string();
      if (ch === '[' || ch === '{') {
        var array = ch === '['; out = array ? [] : {}; pos++; space();
        if (text.charAt(pos) === (array ? ']' : '}')) { pos++; return out; }
        while (pos < text.length) {
          if (array) out.push(value(depth + 1));
          else {
            space(); if (text.charAt(pos) !== '"') fail(); key = string();
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') fail();
            space(); if (text.charAt(pos++) !== ':') fail(); out[key] = value(depth + 1);
          }
          space(); ch = text.charAt(pos++);
          if (ch === (array ? ']' : '}')) return out;
          if (ch !== ',') fail();
        }
        fail();
      }
      token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.substr(pos));
      if (!token) fail(); pos += token[0].length;
      return token[0] === 'true' ? true : token[0] === 'false' ? false : token[0] === 'null' ? null : Number(token[0]);
    }
    var result = value(0); space(); if (pos !== text.length) fail(); return result;
  }
  return { stringify: stringify, parse: parse };
})();

function dcDanBePrepare(gapText, marginText, ponClearText) {
  var oldCoordinateSystem = null, restoreCoordinateSystem = false;
  try {
    if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
    // Bounds, path anchors and artboardRect must all be read in the same
    // document coordinate system.  A user ruler origin must not move a nest.
    try {
      oldCoordinateSystem = app.coordinateSystem;
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      restoreCoordinateSystem = true;
    } catch (coordinateError) {}
    var doc = app.activeDocument;
    var MM = 2.834645669, EPS = 0.01;

    function fail(message) { throw new Error(message); }
    function numberValue(value, label, min, max, dflt) {
      var t = String(value === undefined || value === null ? "" : value).replace(",", ".");
      if (t === "") return dflt;
      var n = parseFloat(t);
      if (!isFinite(n)) fail(label + " phải là số.");
      if (n < min - EPS || n > max + EPS) fail(label + " nằm ngoài phạm vi cho phép.");
      return n;
    }
    var gap = numberValue(gapText, "Khe giữa 2 khuôn", 0, 50, 2) * MM;
    var margin = numberValue(marginText, "Khuôn cách mép tờ", 0, 100, 4) * MM;
    var ponClear = numberValue(ponClearText, "Né PON", 0, 100, 7.5) * MM;

    function geometricBoundsOf(item) {
      try { return item.geometricBounds.slice(0); } catch (e) {}
      try { return item.visibleBounds.slice(0); } catch (e2) {}
      return null;
    }
    function visibleBoundsOf(item) {
      try { return item.visibleBounds.slice(0); } catch (e) {}
      try { return item.geometricBounds.slice(0); } catch (e2) {}
      return null;
    }
    var FLATNESS = 0.025 * MM; // 0.025 mm, ten times finer than core cells.
    function pointLineDistance(p, a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1], d2 = dx * dx + dy * dy;
      if (d2 < 0.000001) {
        dx = p[0] - a[0]; dy = p[1] - a[1];
        return Math.sqrt(dx * dx + dy * dy);
      }
      return Math.abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / Math.sqrt(d2);
    }
    function midpoint(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
    function flattenBezier(p0, c1, c2, p3, out, depth) {
      var flat = Math.max(pointLineDistance(c1, p0, p3), pointLineDistance(c2, p0, p3));
      if (flat <= FLATNESS || depth >= 18) {
        out.push([p3[0], p3[1]]);
        return;
      }
      var p01 = midpoint(p0, c1), p12 = midpoint(c1, c2), p23 = midpoint(c2, p3);
      var p012 = midpoint(p01, p12), p123 = midpoint(p12, p23), p0123 = midpoint(p012, p123);
      flattenBezier(p0, p01, p012, p0123, out, depth + 1);
      flattenBezier(p0123, p123, p23, p3, out, depth + 1);
    }
    function bezierPoints(p0, c1, c2, p3, out) {
      flattenBezier(p0, c1, c2, p3, out, 0);
    }
    function pathContour(item) {
      var pts;
      try { pts = item.pathPoints; } catch (e) { return null; }
      if (!pts || pts.length < 3) return null;
      var isClosed = false;
      try { isClosed = item.closed === true; } catch (closedError) {}
      if (!isClosed) fail("Khuôn bế phải là path khép kín; không dùng khung bao thay thế.");
      var out = [], i, a, b;
      for (i = 0; i < pts.length; i++) {
        a = pts[i]; b = pts[(i + 1) % pts.length];
        if (i === 0) out.push([a.anchor[0], a.anchor[1]]);
        bezierPoints(a.anchor, a.rightDirection, b.leftDirection, b.anchor, out);
      }
      if (out.length > 1) {
        var last = out[out.length - 1];
        if (Math.abs(last[0] - out[0][0]) < 0.00001 && Math.abs(last[1] - out[0][1]) < 0.00001) out.pop();
      }
      return out.length >= 3 ? out : null;
    }
    // Outer array = union groups. Inner array = a CompoundPath (even/odd
    // contours, including holes). They deliberately remain separate.
    function collectContourGroups(item, out) {
      var kind = "";
      try { if (item.hidden === true) return; } catch (hiddenError) {}
      try { kind = item.typename; } catch (e) {}
      if (kind === "PathItem") {
        try { if (item.clipping === true) return; } catch (clipError) {}
        var one = pathContour(item);
        if (one) out.push([one]);
        return;
      }
      if (kind === "CompoundPathItem") {
        var compound = [], ci, contour;
        for (ci = 0; ci < item.pathItems.length; ci++) {
          contour = pathContour(item.pathItems[ci]);
          if (contour) compound.push(contour);
        }
        if (compound.length) out.push(compound);
        return;
      }
      if (kind === "GroupItem") {
        for (var gi = 0; gi < item.pageItems.length; gi++) {
          var child = item.pageItems[gi];
          try { if (child.parent !== item) continue; } catch (parentError) {}
          collectContourGroups(child, out);
        }
      }
    }
    function normalizeMillimetres(groups) {
      var x0 = 1e99, y0 = 1e99, gi, ci, pi, p;
      for (gi = 0; gi < groups.length; gi++) for (ci = 0; ci < groups[gi].length; ci++)
        for (pi = 0; pi < groups[gi][ci].length; pi++) {
          p = groups[gi][ci][pi]; if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1];
        }
      if (x0 === 1e99) return null;
      var out = [], group, contour, q;
      for (gi = 0; gi < groups.length; gi++) {
        group = [];
        for (ci = 0; ci < groups[gi].length; ci++) {
          contour = [];
          for (pi = 0; pi < groups[gi][ci].length; pi++) {
            q = groups[gi][ci][pi]; contour.push([(q[0] - x0) / MM, (q[1] - y0) / MM]);
          }
          if (contour.length >= 3) group.push(contour);
        }
        if (group.length) out.push(group);
      }
      return out.length ? out : null;
    }

    function normalise(s) {
      s = String(s).toLowerCase();
      var from = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
      var to =   "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd";
      var out = "", i, p;
      for (i = 0; i < s.length; i++) {
        p = from.indexOf(s.charAt(i));
        out += p >= 0 ? to.charAt(p) : s.charAt(i);
      }
      return out;
    }
    function isGeneratedLayer(layer) {
      var n = normalise(layer.name);
      if (n.indexOf("dan be -") === 0) return true;
      try { return layer.note === "DANCARD_DANBE_OUTPUT"; } catch (noteError) {}
      return false;
    }
    function findLayer(role) {
      for (var i = 0; i < doc.layers.length; i++) {
        if (isGeneratedLayer(doc.layers[i])) continue;
        var n = normalise(doc.layers[i].name);
        if (role === "cut" && (n.indexOf("khuon") >= 0 || n.indexOf("die") >= 0 || n.indexOf("cut") >= 0)) return doc.layers[i];
        if (role === "art" && (n.indexOf("bai") >= 0 || n.indexOf("object") >= 0 || n.indexOf("artwork") >= 0 || n.indexOf("hinh") >= 0)) return doc.layers[i];
      }
      return null;
    }
    function layerItems(layer, useGeometricBounds) {
      var out = [], i, it, b;
      try { if (layer.visible === false) return out; } catch (layerVisibleError) {}
      for (i = 0; i < layer.pageItems.length; i++) {
        it = layer.pageItems[i];
        try { if (it.parent !== layer || it.hidden === true) continue; } catch (itemStateError) {}
        b = useGeometricBounds ? geometricBoundsOf(it) : visibleBoundsOf(it);
        if (!b || b[2] - b[0] <= EPS || b[1] - b[3] <= EPS) continue;
        out.push({ item: it, bounds: b, cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, h: b[1] - b[3] });
      }
      return out;
    }
    function sourceModels() {
      var models = [], sel = null, si, sb;
      try { sel = doc.selection; } catch (e) {}
      if (sel && sel.length >= 2) {
        var recs = [];
        for (si = 0; si < sel.length; si++) {
          sb = geometricBoundsOf(sel[si]);
          if (!sb || sb[2] - sb[0] <= EPS || sb[1] - sb[3] <= EPS) continue;
          recs.push({ item: sel[si], bounds: sb, cx: (sb[0] + sb[2]) / 2, cy: (sb[1] + sb[3]) / 2, h: sb[1] - sb[3] });
        }
        if (recs.length < 2 || recs.length % 2) fail("Hãy chọn số object chẵn: từng cặp Khuôn bên trái, Bài bên phải.");
        recs.sort(function (a, b) { return b.cy - a.cy; });
        var rows = [], row = [recs[0]], anchor = recs[0].cy, r, oi;
        function flush() { row.sort(function (a, b) { return a.cx - b.cx; }); for (var q = 0; q < row.length; q++) rows.push(row[q]); }
        for (r = 1; r < recs.length; r++) {
          if (anchor - recs[r].cy <= recs[0].h * 0.5) row.push(recs[r]);
          else { flush(); row = [recs[r]]; anchor = recs[r].cy; }
        }
        flush();
        for (oi = 0; oi < rows.length; oi += 2) models.push({ khuon: rows[oi], bai: rows[oi + 1] });
        return models;
      }
      var cutLayer = findLayer("cut"), artLayer = findLayer("art");
      if (!cutLayer || !artLayer || cutLayer === artLayer)
        fail("Chọn từng cặp Khuôn/Bài, hoặc tạo hai layer Khuôn bế và Bài.");
      var cuts = layerItems(cutLayer, true), arts = layerItems(artLayer, false), used = {}, ki, bi, best, d, dx, dy;
      if (!cuts.length || !arts.length) fail("Layer Khuôn bế hoặc Bài đang trống.");
      for (ki = 0; ki < cuts.length; ki++) {
        best = -1; d = 1e99;
        for (bi = 0; bi < arts.length; bi++) {
          if (used[bi]) continue;
          dx = arts[bi].cx - cuts[ki].cx; dy = arts[bi].cy - cuts[ki].cy;
          if (dx * dx + dy * dy < d) { d = dx * dx + dy * dy; best = bi; }
        }
        if (best < 0) fail("Số Bài ít hơn số Khuôn bế.");
        used[best] = true; models.push({ khuon: cuts[ki], bai: arts[best] });
      }
      return models;
    }
    function isDirectChild(item, parent) {
      try { return item.parent === parent; } catch (e) { return true; }
    }
    function circleCandidate(item, rect) {
      var kind = "", b, w, h, r, cx, cy, pts, i, next, dx, dy, distance, tolerance, mx, my, mt;
      try { kind = item.typename; } catch (kindError) {}
      if (kind !== "PathItem") return null;
      try { if (item.closed !== true || item.clipping === true) return null; } catch (stateError) { return null; }
      try { pts = item.pathPoints; } catch (pointsError) { return null; }
      if (!pts || pts.length < 4 || pts.length > 12) return null;
      b = geometricBoundsOf(item); if (!b) return null;
      w = b[2] - b[0]; h = b[1] - b[3];
      if (w <= EPS || h <= EPS || w > 40 * MM || Math.abs(w - h) > Math.max(w, h) * 0.05) return null;
      cx = (b[0] + b[2]) / 2; cy = (b[1] + b[3]) / 2; r = (w + h) / 4;
      if (cx < rect[0] || cx > rect[2] || cy < rect[3] || cy > rect[1]) return null;
      // A tiny square used to pass the old 0.15 mm absolute tolerance.  A
      // real Illustrator ellipse is a four-point Bezier circle, so test both
      // anchors and Bezier midpoints with a tight relative tolerance.
      tolerance = Math.max(0.005 * MM, r * 0.02);
      for (i = 0; i < pts.length; i++) {
        dx = pts[i].anchor[0] - cx; dy = pts[i].anchor[1] - cy;
        distance = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(distance - r) > tolerance) return null;
        next = pts[(i + 1) % pts.length]; mt = 0.5;
        mx = (1 - mt) * (1 - mt) * (1 - mt) * pts[i].anchor[0] +
          3 * (1 - mt) * (1 - mt) * mt * pts[i].rightDirection[0] +
          3 * (1 - mt) * mt * mt * next.leftDirection[0] + mt * mt * mt * next.anchor[0];
        my = (1 - mt) * (1 - mt) * (1 - mt) * pts[i].anchor[1] +
          3 * (1 - mt) * (1 - mt) * mt * pts[i].rightDirection[1] +
          3 * (1 - mt) * mt * mt * next.leftDirection[1] + mt * mt * mt * next.anchor[1];
        dx = mx - cx; dy = my - cy; distance = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(distance - r) > tolerance) return null;
      }
      return { cx: cx, cy: cy, r: r };
    }
    function addPonCandidate(candidates, candidate) {
      var i, dx, dy;
      for (i = 0; i < candidates.length; i++) {
        dx = candidates[i].cx - candidate.cx; dy = candidates[i].cy - candidate.cy;
        if (dx * dx + dy * dy < 0.01 && Math.abs(candidates[i].r - candidate.r) < 0.01) return;
      }
      candidates.push(candidate);
    }
    function collectPonPaths(item, rect, candidates) {
      var kind = "", i, child, candidate;
      try { if (item.hidden === true) return; } catch (hiddenError) {}
      try { kind = item.typename; } catch (kindError) {}
      if (kind === "PathItem") {
        candidate = circleCandidate(item, rect);
        if (candidate) addPonCandidate(candidates, candidate);
        return;
      }
      if (kind === "CompoundPathItem") {
        for (i = 0; i < item.pathItems.length; i++) collectPonPaths(item.pathItems[i], rect, candidates);
        return;
      }
      if (kind === "GroupItem") {
        for (i = 0; i < item.pageItems.length; i++) {
          child = item.pageItems[i];
          if (!isDirectChild(child, item)) continue;
          collectPonPaths(child, rect, candidates);
        }
      }
    }
    function collectPonLayer(layer, rect, candidates) {
      var i, item;
      try { if (layer.visible === false) return; } catch (layerStateError) {}
      for (i = 0; i < layer.pageItems.length; i++) {
        item = layer.pageItems[i];
        if (!isDirectChild(item, layer)) continue;
        try { if (item.hidden === true) continue; } catch (itemStateError) {}
        collectPonPaths(item, rect, candidates);
      }
      try {
        for (i = 0; i < layer.layers.length; i++) collectPonLayer(layer.layers[i], rect, candidates);
      } catch (subLayerError) {}
    }
    function sameFile(left, right) {
      try {
        return String(left.fsName).toLowerCase() === String(right.fsName).toLowerCase();
      } catch (e) { return false; }
    }
    function alreadyOpenDocument(file) {
      var i, candidate;
      for (i = 0; i < app.documents.length; i++) {
        candidate = app.documents[i];
        try {
          if (sameFile(candidate.fullName, file)) return candidate;
        } catch (fullNameError) {}
      }
      return null;
    }
    function readPon() {
      var file = File.openDialog("Chọn file PON AI – lấy khổ tờ và 4 PON", "*.ai");
      if (!file) return null;
      // Opening an AI file that is already open can return that same document.
      // Never close it here: it belongs to the user, not to this operation.
      var sourceDoc = doc, ponDoc = alreadyOpenDocument(file), openedHere = false, info = null;
      try {
        if (!ponDoc) {
          var documentCountBefore = app.documents.length;
          ponDoc = app.open(file);
          // Count is a second guard for aliases/UNC paths that do not compare
          // byte-for-byte in fsName: an existing document must never be closed.
          openedHere = app.documents.length > documentCountBefore;
        }
        if (!ponDoc.artboards.length) fail("File PON không có artboard.");
        var rect = ponDoc.artboards[0].artboardRect.slice(0), candidates = [], i;
        for (i = 0; i < ponDoc.layers.length; i++) collectPonLayer(ponDoc.layers[i], rect, candidates);
        if (candidates.length < 4) fail("File PON phải có đủ 4 chấm PON tròn.");
        var corners = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[0], rect[3]], [rect[2], rect[3]]];
        var dots = [], used = {}, ci, best, bestD, j, dx, dy;
        var nearLimit = Math.min(rect[2] - rect[0], rect[1] - rect[3]) * 0.25;
        for (ci = 0; ci < corners.length; ci++) {
          best = -1; bestD = 1e99;
          for (j = 0; j < candidates.length; j++) {
            if (used[j]) continue;
            dx = candidates[j].cx - corners[ci][0]; dy = candidates[j].cy - corners[ci][1];
            if (dx * dx + dy * dy < bestD) { bestD = dx * dx + dy * dy; best = j; }
          }
          // When the file contains exactly four dots, use all four at their
          // real positions. They need not be at hard-coded corner offsets.
          // With extra circular paths, keep the corner guard to avoid treating
          // a round decal in the template as a registration dot.
          if (best < 0 || (candidates.length > 4 && bestD > nearLimit * nearLimit))
            fail("Không tìm thấy chấm PON tròn gần một trong bốn góc tờ.");
          used[best] = true; dots.push(candidates[best]);
        }
        info = { rect: rect, dots: dots, name: file.name };
      } finally {
        if (openedHere && ponDoc && ponDoc !== sourceDoc) {
          try { ponDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {}
        }
        try { if (sourceDoc) sourceDoc.activate(); } catch (restoreSourceError) {}
      }
      return info;
    }

    var models = sourceModels(), pon = readPon();
    if (!pon) return "OK: (đã hủy, chưa chọn file PON)";
    var types = [], mi, groups;
    for (mi = 0; mi < models.length; mi++) {
      groups = [];
      collectContourGroups(models[mi].khuon.item, groups);
      groups = normalizeMillimetres(groups);
      if (!groups) fail("Không đọc được path khép kín của khuôn " + (mi + 1) + ".");
      types.push({ groups: groups });
    }
    var jobId = "danbe_" + (dcDanBeJobCounter++);
    var paperW = pon.rect[2] - pon.rect[0], paperH = pon.rect[1] - pon.rect[3], dotsMm = [], di;
    for (di = 0; di < pon.dots.length; di++) dotsMm.push({
      x: (pon.dots[di].cx - pon.rect[0]) / MM,
      y: (pon.dots[di].cy - pon.rect[3]) / MM,
      r: pon.dots[di].r / MM
    });
    dcDanBeJobs[jobId] = { doc: doc, models: models, pon: pon, paperW: paperW, paperH: paperH, margin: margin, gap: gap, ponClear: ponClear, MM: MM };
    return "OKJSON:" + dcDanBeJSON.stringify({
      jobId: jobId,
      sheet: { widthMm: paperW / MM, heightMm: paperH / MM, dots: dotsMm },
      types: types,
      gapMm: gap / MM,
      marginMm: margin / MM,
      ponClearMm: ponClear / MM,
      resolutionMm: 0.25,
      budgetMs: 3000
    });
  } catch (e) {
    try { return "ERR: " + dcMoTaLoi(e); } catch (e2) { return "ERR: " + e; }
  } finally {
    if (restoreCoordinateSystem) {
      try { app.coordinateSystem = oldCoordinateSystem; } catch (restoreError) {}
    }
  }
}

function dcDanBeRender(jobId, slotsText, reportText) {
  var oldCoordinateSystem = null, restoreCoordinateSystem = false;
  var createdLayers = [], createdArtboard = null, job = null, doc = null;
  try {
    try {
      oldCoordinateSystem = app.coordinateSystem;
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      restoreCoordinateSystem = true;
    } catch (coordinateError) {}
    job = dcDanBeJobs[jobId];
    if (!job) return "ERR: Phiên dàn bế đã hết. Hãy bấm Dàn bế lại.";
    var slots = dcDanBeJSON.parse(String(slotsText));
    if (!slots || slots.length === undefined || !slots.length) return "ERR: Bộ tối ưu không tìm được vị trí hợp lệ.";
    var report = null;
    try { report = dcDanBeJSON.parse(String(reportText || "{}")); } catch (ignore) {}
    doc = job.doc;
    var MM = job.MM, paperW = job.paperW, paperH = job.paperH, i, s;
    try { doc.activate(); } catch (activateError) {}
    for (i = 0; i < slots.length; i++) {
      s = slots[i];
      var slotVariant = Number(s.vi);
      if (s.mi === undefined || s.mi < 0 || s.mi >= job.models.length ||
          !isFinite(slotVariant) || Math.floor(slotVariant) !== slotVariant || slotVariant < 0 || slotVariant > 3 ||
          !isFinite(Number(s.x)) || !isFinite(Number(s.y))) return "ERR: Dữ liệu vị trí dàn không hợp lệ.";
    }
    function geometricBoundsOf(item) {
      try { return item.geometricBounds.slice(0); } catch (e) {}
      try { return item.visibleBounds.slice(0); } catch (e2) {}
      return null;
    }
    function visibleBoundsOf(item) {
      try { return item.visibleBounds.slice(0); } catch (e) {}
      try { return item.geometricBounds.slice(0); } catch (e2) {}
      return null;
    }
    function uniqueLayerName(base) {
      var candidate = base, suffix = 2, found, li;
      do {
        found = false;
        for (li = 0; li < doc.layers.length; li++) {
          if (doc.layers[li].name === candidate) { found = true; candidate = base + " " + suffix++; break; }
        }
      } while (found);
      return candidate;
    }
    function addLayer(name) {
      var layer = doc.layers.add();
      createdLayers.push(layer);
      layer.name = uniqueLayerName(name);
      try { layer.locked = false; layer.visible = true; } catch (layerStateError) {}
      // Name is the durable marker; note is a second marker where the AI
      // version exposes Layer.note.
      try { layer.note = "DANCARD_DANBE_OUTPUT"; } catch (noteError) {}
      return layer;
    }
    var allRight = -1e99, allTop = 1e99, ai, ar;
    for (ai = 0; ai < doc.artboards.length; ai++) {
      ar = doc.artboards[ai].artboardRect;
      if (ar[2] > allRight) allRight = ar[2];
      if (ar[1] < allTop) allTop = ar[1];
    }
    if (allRight < -1e90) { allRight = 0; allTop = 0; }
    var sheetLeft = allRight + 20 * MM, sheetTop = allTop, newIndex;
    createdArtboard = doc.artboards.add([sheetLeft, sheetTop, sheetLeft + paperW, sheetTop - paperH]);
    newIndex = doc.artboards.length - 1;
    try { createdArtboard.name = "Dan be"; } catch (nameError) {}
    var outPon = addLayer("Dàn bế - PON"), outKhuon = addLayer("Dàn bế - Khuôn"), outBai = addLayer("Dàn bế - Bài");
    function drawDot(layer, cx, cy, r) {
      var black = new CMYKColor(); black.cyan = 0; black.magenta = 0; black.yellow = 0; black.black = 100;
      var dot = layer.pathItems.ellipse(cy + r, cx - r, r * 2, r * 2);
      dot.filled = true; dot.fillColor = black; dot.stroked = false;
    }
    for (i = 0; i < job.pon.dots.length; i++) {
      var dotIn = job.pon.dots[i];
      drawDot(outPon, sheetLeft + dotIn.cx - job.pon.rect[0],
        sheetTop - paperH + (dotIn.cy - job.pon.rect[3]), dotIn.r);
    }
    function centreArtwork(item, cx, cy) {
      var b = visibleBoundsOf(item);
      if (b) item.translate(cx - (b[0] + b[2]) / 2, cy - (b[1] + b[3]) / 2);
    }
    function fail(message) { throw new Error(message); }
    var angles = [0, 90, 180, 270], model, angle, left, bottom, kCopy, kb, bCopy;
    for (i = 0; i < slots.length; i++) {
      s = slots[i]; model = job.models[Number(s.mi)]; angle = angles[Number(s.vi)];
      doc.activeLayer = outKhuon;
      kCopy = model.khuon.item.duplicate(outKhuon, ElementPlacement.PLACEATEND);
      if (angle) kCopy.rotate(angle);
      // The core packs the actual cut path.  Use geometric bounds here too,
      // never a stroke/effect-expanded visible box.
      kb = geometricBoundsOf(kCopy); if (!kb) fail("Không đo được khuôn sau khi xoay.");
      left = sheetLeft + Number(s.x) * MM;
      bottom = sheetTop - paperH + Number(s.y) * MM;
      kCopy.translate(left - kb[0], bottom - kb[3]);
      kb = geometricBoundsOf(kCopy);
      doc.activeLayer = outBai;
      bCopy = model.bai.item.duplicate(outBai, ElementPlacement.PLACEATEND);
      if (angle) bCopy.rotate(angle);
      centreArtwork(bCopy, (kb[0] + kb[2]) / 2, (kb[1] + kb[3]) / 2);
    }
    try { outKhuon.zOrder(ZOrderMethod.SENDTOBACK); } catch (khuonOrderError) {}
    try { outPon.zOrder(ZOrderMethod.BRINGTOFRONT); } catch (ponOrderError) {}
    try { doc.artboards.setActiveArtboardIndex(newIndex); } catch (artboardSelectError) {}
    try { doc.selection = null; } catch (selectionClearError) {}
    var detail = report && report.detail ? report.detail : ("Dàn silhouette thật: " + slots.length + " con.");
    detail += " Khuôn và Bài nằm ở layer riêng; PON giữ ở layer trên cùng.";
    try { delete dcDanBeJobs[jobId]; } catch (clearError) {}
    return "OK:[[COUNT:" + slots.length + "]] " + detail;
  } catch (e) {
    // Never erase source artwork: only these layers and this artboard were
    // created by this invocation, so only they are rolled back.
    if (doc) {
      try {
        if (job && job.models && job.models.length) doc.activeLayer = job.models[0].khuon.item.layer;
      } catch (sourceLayerError) {}
      for (var li = createdLayers.length - 1; li >= 0; li--) {
        try { createdLayers[li].remove(); } catch (removeLayerError) {}
      }
      try { if (createdArtboard) createdArtboard.remove(); } catch (removeArtboardError) {}
    }
    try { delete dcDanBeJobs[jobId]; } catch (clearFailedJobError) {}
    try { return "ERR: " + dcMoTaLoi(e); } catch (e2) { return "ERR: " + e; }
  } finally {
    if (restoreCoordinateSystem) {
      try { app.coordinateSystem = oldCoordinateSystem; } catch (restoreError) {}
    }
  }
}
