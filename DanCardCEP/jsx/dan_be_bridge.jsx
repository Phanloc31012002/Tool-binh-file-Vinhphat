// ============================================================
// DÀN BẾ – CẦU NỐI ILLUSTRATOR <-> nesting_core.js
//
// ExtendScript đọc path, tự tạo PON và render. Phần tối ưu hình học chạy ở
// Chromium của CEP để Illustrator không bị treo khi thử nhiều bố cục.
// ============================================================
var dcDanBeNestingVersion = 10;
if (typeof dcDanBeJobs === "undefined") var dcDanBeJobs = {};
if (typeof dcDanBeJobCounter === "undefined") var dcDanBeJobCounter = 1;

// ExtendScript của Illustrator không có sẵn JSON trong engine mới khởi tạo. Giữ cầu nối
// này độc lập với các công cụ không liên quan có thể cài JSON shim về sau.
var dcDanBeJSON = (function () {
  function quote(value) {
    return (
      '"' +
      String(value).replace(/["\\\x00-\x1f\u2028\u2029]/g, function (ch) {
        if (ch === '"') return '\\"';
        if (ch === "\\") return "\\\\";
        return "\\u" + ("0000" + ch.charCodeAt(0).toString(16)).slice(-4);
      }) +
      '"'
    );
  }
  function stringify(value) {
    if (value === null) return "null";
    var kind = typeof value,
      parts = [],
      i,
      key,
      encoded;
    if (kind === "string") return quote(value);
    if (kind === "boolean") return String(value);
    if (kind === "number") return isFinite(value) ? String(value) : "null";
    if (kind !== "object") return undefined;
    if (value instanceof Array) {
      for (i = 0; i < value.length; i++) {
        encoded = stringify(value[i]);
        parts.push(encoded === undefined ? "null" : encoded);
      }
      return "[" + parts.join(",") + "]";
    }
    for (key in value)
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        encoded = stringify(value[key]);
        if (encoded !== undefined) parts.push(quote(key) + ":" + encoded);
      }
    return "{" + parts.join(",") + "}";
  }
  function parse(text) {
    text = String(text);
    var pos = 0;
    function fail() {
      throw new SyntaxError("Invalid Dàn bế JSON at " + pos);
    }
    function space() {
      while (/\s/.test(text.charAt(pos)) && pos < text.length) pos++;
    }
    function string() {
      var out = "",
        ch,
        hex;
      pos++;
      while (pos < text.length) {
        ch = text.charAt(pos++);
        if (ch === '"') return out;
        if (ch === "\\") {
          ch = text.charAt(pos++);
          if (ch === "u") {
            hex = text.substr(pos, 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
            out += String.fromCharCode(parseInt(hex, 16));
            pos += 4;
          } else if (ch === '"' || ch === "\\" || ch === "/") out += ch;
          else if (ch === "b") out += "\b";
          else if (ch === "f") out += "\f";
          else if (ch === "n") out += "\n";
          else if (ch === "r") out += "\r";
          else if (ch === "t") out += "\t";
          else fail();
        } else {
          if (ch.charCodeAt(0) < 32) fail();
          out += ch;
        }
      }
      fail();
    }
    function value(depth) {
      if (depth > 64) fail();
      space();
      var ch = text.charAt(pos),
        out,
        key,
        token;
      if (ch === '"') return string();
      if (ch === "[" || ch === "{") {
        var array = ch === "[";
        out = array ? [] : {};
        pos++;
        space();
        if (text.charAt(pos) === (array ? "]" : "}")) {
          pos++;
          return out;
        }
        while (pos < text.length) {
          if (array) out.push(value(depth + 1));
          else {
            space();
            if (text.charAt(pos) !== '"') fail();
            key = string();
            if (
              key === "__proto__" ||
              key === "constructor" ||
              key === "prototype"
            )
              fail();
            space();
            if (text.charAt(pos++) !== ":") fail();
            out[key] = value(depth + 1);
          }
          space();
          ch = text.charAt(pos++);
          if (ch === (array ? "]" : "}")) return out;
          if (ch !== ",") fail();
        }
        fail();
      }
      token =
        /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
          text.substr(pos),
        );
      if (!token) fail();
      pos += token[0].length;
      // ExtendScript của Illustrator có thể tính sai biểu thức điều kiện nối tiếp nhau
      // có nhánh boolean thành Number("true"/"false") => NaN. Giữ việc phân tích
      // literal tường minh, kể cả cho metadata và các tuỳ chọn boolean sau này.
      if (token[0] === "true") return true;
      if (token[0] === "false") return false;
      if (token[0] === "null") return null;
      return Number(token[0]);
    }
    var result = value(0);
    space();
    if (pos !== text.length) fail();
    return result;
  }
  return { stringify: stringify, parse: parse };
})();

// Xác định bộ ba đang chọn theo hình học, tuyệt đối không theo thứ tự chọn/z-order. Vai trò
// được khoá cố định cho mọi con và cả hai mặt của tờ kết quả.
function dcDanBeTripleModels(selection, epsilon) {
  var EPS = epsilon || 0.01,
    pending = [],
    models = [],
    i,
    bounds;
  if (!selection || !selection.length || selection.length % 3)
    throw new Error(
      "Dàn bế 2 mặt cần chọn đủ bộ 3: Khuôn bên trái → mặt trước → mặt sau, cùng hàng.",
    );
  for (i = 0; i < selection.length; i++) {
    bounds = null;
    try {
      bounds = selection[i].geometricBounds.slice(0);
    } catch (geometricError) {}
    if (!bounds)
      try {
        bounds = selection[i].visibleBounds.slice(0);
      } catch (visibleError) {}
    if (!bounds || bounds[2] - bounds[0] <= EPS || bounds[1] - bounds[3] <= EPS)
      throw new Error(
        "Không đo được object " + (i + 1) + " trong bộ Khuôn/trước/sau.",
      );
    pending.push({
      item: selection[i],
      bounds: bounds,
      cx: (bounds[0] + bounds[2]) / 2,
      cy: (bounds[1] + bounds[3]) / 2,
    });
  }
  pending.sort(function (a, b) {
    return a.cy === b.cy ? a.cx - b.cx : b.cy - a.cy;
  });
  while (pending.length) {
    var anchor = pending.shift(),
      row = [anchor],
      high = anchor.cy,
      low = anchor.cy;
    var minHeight = anchor.bounds[1] - anchor.bounds[3];
    for (i = 0; i < pending.length; i++) {
      var candidate = pending[i],
        height = Math.min(minHeight, candidate.bounds[1] - candidate.bounds[3]);
      var nextHigh = Math.max(high, candidate.cy),
        nextLow = Math.min(low, candidate.cy);
      if (nextHigh - nextLow <= height * 0.25 + EPS) {
        row.push(candidate);
        pending.splice(i--, 1);
        high = nextHigh;
        low = nextLow;
        minHeight = height;
      }
    }
    if (row.length % 3)
      throw new Error(
        "Hàng nguồn chưa đủ Khuôn → mặt trước → mặt sau. Hãy canh hàng và chọn đủ 3 object cho mỗi mẫu.",
      );
    row.sort(function (a, b) {
      return a.cx - b.cx;
    });
    for (i = 0; i < row.length; i += 3) {
      if (
        row[i + 1].cx - row[i].cx <= EPS ||
        row[i + 2].cx - row[i + 1].cx <= EPS
      )
        throw new Error(
          "Không phân biệt được thứ tự trái/phải. Đặt Khuôn → mặt trước → mặt sau cạnh nhau.",
        );
      models.push({ khuon: row[i], bai: row[i + 1], sau: row[i + 2] });
    }
  }
  return models;
}

// Cấp chỗ trên canvas từ góc trên trái, trái sang phải, giống Dàn KTS. Giữ chỗ cho mọi
// tờ (hoặc cặp hai mặt) trước khi ghi bất cứ thứ gì vào tài liệu nguồn.
function dcDanBeOutputPositions(
  paperW,
  paperH,
  twoSided,
  count,
  scaleFactor,
  existingRects,
  sourceBounds,
  MM,
) {
  var EPS = 0.01,
    halfSize = 7200,
    pageGap = 10 * MM,
    occupied = [],
    positions = [],
    i;
  if (isFinite(scaleFactor) && scaleFactor > 0 && scaleFactor < 1)
    halfSize /= scaleFactor;
  var left = -halfSize + pageGap,
    top = halfSize - pageGap;
  var right = halfSize - pageGap,
    bottom = -halfSize + pageGap;
  var bundleW = twoSided ? paperW * 2 + pageGap : paperW;
  if (
    !isFinite(paperW) ||
    !isFinite(paperH) ||
    paperW <= 0 ||
    paperH <= 0 ||
    !isFinite(count) ||
    count < 1 ||
    Math.floor(count) !== count ||
    bundleW > right - left + EPS ||
    paperH > top - bottom + EPS
  )
    throw new Error(
      "Khổ tờ/cặp hai mặt vượt giới hạn canvas. Hãy giảm khổ hoặc mở Large Canvas.",
    );
  function overlaps(a, b) {
    return (
      a[0] < b[2] - EPS &&
      a[2] > b[0] + EPS &&
      a[3] < b[1] - EPS &&
      a[1] > b[3] + EPS
    );
  }
  function contains(a, b) {
    return (
      a[0] <= b[0] + EPS &&
      a[1] >= b[1] - EPS &&
      a[2] >= b[2] - EPS &&
      a[3] <= b[3] + EPS
    );
  }
  for (i = 0; i < existingRects.length; i++) {
    var existing = existingRects[i];
    // Khung làm việc phủ cả canvas không phải là tờ in cần né (giống KTS).
    if (
      existing[2] - existing[0] >= halfSize * 1.84 &&
      existing[1] - existing[3] >= halfSize * 1.84
    )
      continue;
    occupied.push(existing.slice(0));
  }
  if (sourceBounds) {
    var covered = false;
    for (i = 0; i < occupied.length; i++)
      if (contains(occupied[i], sourceBounds)) {
        covered = true;
        break;
      }
    if (!covered) occupied.push(sourceBounds.slice(0));
  }
  var cursorLeft = left,
    cursorTop = top;
  for (var sheetIndex = 0; sheetIndex < count; sheetIndex++) {
    var candidateLeft = cursorLeft,
      candidateTop = cursorTop,
      reserved = false;
    for (var attempt = 0; attempt < 5000; attempt++) {
      if (candidateLeft + bundleW > right + EPS) {
        candidateLeft = left;
        candidateTop -= paperH + pageGap;
        continue;
      }
      if (candidateTop - paperH < bottom - EPS)
        throw new Error(
          "Không còn chỗ trong canvas để tạo đủ tờ. Hãy bớt artboard cũ hoặc mở Large Canvas.",
        );
      var bundle = [
          candidateLeft,
          candidateTop,
          candidateLeft + bundleW,
          candidateTop - paperH,
        ],
        blocker = null;
      for (i = 0; i < occupied.length; i++)
        if (overlaps(bundle, occupied[i])) {
          blocker = occupied[i];
          break;
        }
      if (blocker) {
        candidateLeft = blocker[2] + pageGap;
        continue;
      }
      occupied.push(bundle);
      positions.push([
        candidateLeft,
        candidateTop,
        candidateLeft + paperW,
        candidateTop - paperH,
      ]);
      cursorLeft = candidateLeft + bundleW + pageGap;
      cursorTop = candidateTop;
      reserved = true;
      break;
    }
    if (!reserved)
      throw new Error(
        "Không tìm được vị trí trong canvas để đặt artboard mới.",
      );
  }
  return positions;
}

function dcDanBePrepare(
  gapText,
  marginText,
  ponClearText,
  twoSidedArg,
  paperWText,
  paperHText,
  ponTopText,
  ponBottomText,
  ponLeftText,
  ponRightText,
) {
  var oldCoordinateSystem = null,
    restoreCoordinateSystem = false;
  try {
    if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
    // Bounds, điểm neo của path và artboardRect đều phải được đọc trong cùng
    // một hệ toạ độ tài liệu.  Gốc thước do người dùng đặt không được làm xê dịch bản dàn bế.
    try {
      oldCoordinateSystem = app.coordinateSystem;
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      restoreCoordinateSystem = true;
    } catch (coordinateError) {}
    var doc = app.activeDocument;
    var MM = 2.834645669,
      EPS = 0.01;
    var twoSided = twoSidedArg === true;

    function fail(message) {
      throw new Error(message);
    }
    function numberValue(value, label, min, max, dflt) {
      var t = String(value === undefined || value === null ? "" : value)
        .replace(/^\s+|\s+$/g, "")
        .replace(",", ".");
      if (t === "") return dflt;
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t))
        fail(label + " phải là số.");
      var n = Number(t);
      if (!isFinite(n)) fail(label + " phải là số.");
      if (n < min || n > max) fail(label + " nằm ngoài phạm vi cho phép.");
      return n;
    }
    var gap = numberValue(gapText, "Khe giữa 2 khuôn", 0, 50, 2) * MM;
    var margin = numberValue(marginText, "Khuôn cách mép tờ", 0, 100, 4) * MM;
    var ponClear = numberValue(ponClearText, "Né PON", 0, 100, 7.5) * MM;
    // Độ lệch người dùng nhập được đo từ mép artboard tới tâm của từng chấm.
    // Chấm PON cố định 0.5 cm có bán kính 2.5 mm.
    var paperW =
      numberValue(paperWText, "Rộng tờ (cm)", 0.5, 5000, 33) * 10 * MM;
    var paperH =
      numberValue(paperHText, "Cao tờ (cm)", 0.5, 5000, 35.4) * 10 * MM;
    var ponRadius = 2.5 * MM;
    var ponTop =
      numberValue(ponTopText, "PON cách trên (mm)", 2.5, 50000, 10) * MM;
    var ponBottom =
      numberValue(ponBottomText, "PON cách dưới (mm)", 2.5, 50000, 10) * MM;
    var ponLeft =
      numberValue(ponLeftText, "PON cách trái (mm)", 2.5, 50000, 10) * MM;
    var ponRight =
      numberValue(ponRightText, "PON cách phải (mm)", 2.5, 50000, 10) * MM;
    if (
      paperW - ponLeft - ponRight < ponRadius * 2 - 0.0000001 ||
      paperH - ponTop - ponBottom < ponRadius * 2 - 0.0000001
    )
      fail(
        "Khổ tờ và khoảng PON không hợp lệ: bốn chấm phải nằm trong tờ, không chồng nhau.",
      );
    if (margin * 2 >= Math.min(paperW, paperH) - EPS)
      fail("Lề khuôn quá lớn, không còn vùng dàn trong tờ.");
    var pon = {
      rect: [0, paperH, paperW, 0],
      name: "PON tự tạo",
      dots: [
        { cx: ponLeft, cy: paperH - ponTop, r: ponRadius },
        { cx: paperW - ponRight, cy: paperH - ponTop, r: ponRadius },
        { cx: ponLeft, cy: ponBottom, r: ponRadius },
        { cx: paperW - ponRight, cy: ponBottom, r: ponRadius },
      ],
    };
    var canvasScale = 1;
    try {
      canvasScale = doc.scaleFactor;
    } catch (canvasScaleError) {}
    // Từ chối tờ quá khổ trước khi tốn thời gian tìm bố cục.
    dcDanBeOutputPositions(
      paperW,
      paperH,
      twoSided,
      1,
      canvasScale,
      [],
      null,
      MM,
    );

    function geometricBoundsOf(item) {
      try {
        return item.geometricBounds.slice(0);
      } catch (e) {}
      try {
        return item.visibleBounds.slice(0);
      } catch (e2) {}
      return null;
    }
    function visibleBoundsOf(item) {
      try {
        return item.visibleBounds.slice(0);
      } catch (e) {}
      try {
        return item.geometricBounds.slice(0);
      } catch (e2) {}
      return null;
    }
    // Tiếp xúc khi khe bằng 0 cần cận sai số đường cong bậc ba mịn hơn lưới lập phương án.
    // Mang cận đó sang chốt chặn liên tục; không bao giờ thu nhỏ path gốc.
    var FLATNESS = (gap === 0 ? 0.00025 : 0.025) * MM;
    var modelHasCurve = false;
    function pointLineDistance(p, a, b) {
      var dx = b[0] - a[0],
        dy = b[1] - a[1],
        d2 = dx * dx + dy * dy;
      if (d2 < 0.000001) {
        dx = p[0] - a[0];
        dy = p[1] - a[1];
        return Math.sqrt(dx * dx + dy * dy);
      }
      // Khoảng cách tới dây cung hữu hạn cũng chặn được các handle thẳng hàng
      // vượt quá đầu mút; còn khoảng cách tới đường thẳng vô hạn của nó sẽ bằng 0.
      var t = Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d2));
      dx = p[0]-a[0]-t*dx; dy = p[1]-a[1]-t*dy;
      return Math.sqrt(dx*dx+dy*dy);
    }
    function midpoint(a, b) {
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    function flattenBezier(p0, c1, c2, p3, out, depth) {
      var flat = Math.max(
        pointLineDistance(c1, p0, p3),
        pointLineDistance(c2, p0, p3),
      );
      if (flat <= FLATNESS || depth >= 18) {
        out.push([p3[0], p3[1]]);
        return;
      }
      var p01 = midpoint(p0, c1),
        p12 = midpoint(c1, c2),
        p23 = midpoint(c2, p3);
      var p012 = midpoint(p01, p12),
        p123 = midpoint(p12, p23),
        p0123 = midpoint(p012, p123);
      flattenBezier(p0, p01, p012, p0123, out, depth + 1);
      flattenBezier(p0123, p123, p23, p3, out, depth + 1);
    }
    function bezierPoints(p0, c1, c2, p3, out) {
      flattenBezier(p0, c1, c2, p3, out, 0);
    }
    function pathContour(item) {
      var pts;
      try {
        pts = item.pathPoints;
      } catch (e) {
        return null;
      }
      if (!pts || pts.length < 3) return null;
      var isClosed = false;
      try {
        isClosed = item.closed === true;
      } catch (closedError) {}
      if (!isClosed)
        fail("Khuôn bế phải là path khép kín; không dùng khung bao thay thế.");
      var out = [],
        i,
        a,
        b;
      for (i = 0; i < pts.length; i++) {
        a = pts[i];
        b = pts[(i + 1) % pts.length];
        if (a.rightDirection[0] !== a.anchor[0] ||
            a.rightDirection[1] !== a.anchor[1] ||
            b.leftDirection[0] !== b.anchor[0] ||
            b.leftDirection[1] !== b.anchor[1]) modelHasCurve = true;
        if (i === 0) out.push([a.anchor[0], a.anchor[1]]);
        bezierPoints(
          a.anchor,
          a.rightDirection,
          b.leftDirection,
          b.anchor,
          out,
        );
      }
      if (out.length > 1) {
        var last = out[out.length - 1];
        if (
          Math.abs(last[0] - out[0][0]) < 0.00001 &&
          Math.abs(last[1] - out[0][1]) < 0.00001
        )
          out.pop();
      }
      return out.length >= 3 ? out : null;
    }
    // Mảng ngoài = các nhóm union. Mảng trong = một CompoundPath (đường bao
    // even/odd, gồm cả lỗ). Hai cấp này được cố ý giữ tách riêng.
    function collectContourGroups(item, out) {
      var kind = "";
      try {
        if (item.hidden === true) return;
      } catch (hiddenError) {}
      try {
        kind = item.typename;
      } catch (e) {}
      if (kind === "PathItem") {
        try {
          if (item.clipping === true) return;
        } catch (clipError) {}
        var one = pathContour(item);
        if (one) out.push([one]);
        return;
      }
      if (kind === "CompoundPathItem") {
        var compound = [],
          ci,
          contour;
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
          try {
            if (child.parent !== item) continue;
          } catch (parentError) {}
          collectContourGroups(child, out);
        }
      }
    }
    function normalizeMillimetres(groups) {
      var x0 = 1e99,
        y0 = 1e99,
        gi,
        ci,
        pi,
        p;
      for (gi = 0; gi < groups.length; gi++)
        for (ci = 0; ci < groups[gi].length; ci++)
          for (pi = 0; pi < groups[gi][ci].length; pi++) {
            p = groups[gi][ci][pi];
            if (p[0] < x0) x0 = p[0];
            if (p[1] < y0) y0 = p[1];
          }
      if (x0 === 1e99) return null;
      var out = [],
        group,
        contour,
        q;
      for (gi = 0; gi < groups.length; gi++) {
        group = [];
        for (ci = 0; ci < groups[gi].length; ci++) {
          contour = [];
          for (pi = 0; pi < groups[gi][ci].length; pi++) {
            q = groups[gi][ci][pi];
            contour.push([(q[0] - x0) / MM, (q[1] - y0) / MM]);
          }
          if (contour.length >= 3) group.push(contour);
        }
        if (group.length) out.push(group);
      }
      return out.length ? out : null;
    }

    function normalise(s) {
      s = String(s).toLowerCase();
      var from =
        "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
      var to =
        "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd";
      var out = "",
        i,
        p;
      for (i = 0; i < s.length; i++) {
        p = from.indexOf(s.charAt(i));
        out += p >= 0 ? to.charAt(p) : s.charAt(i);
      }
      return out;
    }
    function isGeneratedLayer(layer) {
      var n = normalise(layer.name);
      if (n.indexOf("dan be -") === 0) return true;
      try {
        return layer.note === "DANCARD_DANBE_OUTPUT";
      } catch (noteError) {}
      return false;
    }
    function findLayer(role) {
      for (var i = 0; i < doc.layers.length; i++) {
        if (isGeneratedLayer(doc.layers[i])) continue;
        var n = normalise(doc.layers[i].name);
        if (
          role === "cut" &&
          (n.indexOf("khuon") >= 0 ||
            n.indexOf("die") >= 0 ||
            n.indexOf("cut") >= 0)
        )
          return doc.layers[i];
        if (
          role === "art" &&
          (n.indexOf("bai") >= 0 ||
            n.indexOf("object") >= 0 ||
            n.indexOf("artwork") >= 0 ||
            n.indexOf("hinh") >= 0)
        )
          return doc.layers[i];
        if (
          role === "front" &&
          (n.indexOf("mat truoc") >= 0 || n.indexOf("front") >= 0)
        )
          return doc.layers[i];
        if (
          role === "back" &&
          (n.indexOf("mat sau") >= 0 || n.indexOf("back") >= 0)
        )
          return doc.layers[i];
      }
      return null;
    }
    function layerItems(layer, useGeometricBounds) {
      var out = [],
        i,
        it,
        b;
      try {
        if (layer.visible === false) return out;
      } catch (layerVisibleError) {}
      for (i = 0; i < layer.pageItems.length; i++) {
        it = layer.pageItems[i];
        try {
          if (it.parent !== layer || it.hidden === true) continue;
        } catch (itemStateError) {}
        b = useGeometricBounds ? geometricBoundsOf(it) : visibleBoundsOf(it);
        if (!b || b[2] - b[0] <= EPS || b[1] - b[3] <= EPS) continue;
        out.push({
          item: it,
          bounds: b,
          cx: (b[0] + b[2]) / 2,
          cy: (b[1] + b[3]) / 2,
          h: b[1] - b[3],
        });
      }
      return out;
    }
    function sourceModels() {
      var models = [],
        sel = null,
        si,
        sb;
      try {
        sel = doc.selection;
      } catch (e) {}
      if (twoSided) {
        if (sel && sel.length) return dcDanBeTripleModels(sel, EPS);
        var tripleCutLayer = findLayer("cut"),
          frontLayer = findLayer("front"),
          backLayer = findLayer("back");
        if (
          !tripleCutLayer ||
          !frontLayer ||
          !backLayer ||
          tripleCutLayer === frontLayer ||
          tripleCutLayer === backLayer ||
          frontLayer === backLayer
        )
          fail(
            "Dàn bế 2 mặt: chọn từng bộ Khuôn → mặt trước → mặt sau, hoặc dùng 3 layer Khuôn bế, Mặt trước, Mặt sau.",
          );
        var tripleCuts = layerItems(tripleCutLayer, true),
          fronts = layerItems(frontLayer, false),
          backs = layerItems(backLayer, false);
        if (
          !tripleCuts.length ||
          fronts.length !== tripleCuts.length ||
          backs.length !== tripleCuts.length
        )
          fail(
            "Ba layer Khuôn bế, Mặt trước, Mặt sau cần cùng số mẫu, không được thiếu mặt.",
          );
        var usedFronts = {},
          usedBacks = {};
        function nearestUnused(cut, items, used) {
          var bestIndex = -1,
            bestDistance = 1e99;
          for (var ni = 0; ni < items.length; ni++) {
            if (used[ni]) continue;
            var nx = items[ni].cx - cut.cx,
              ny = items[ni].cy - cut.cy;
            var distance = nx * nx + ny * ny;
            if (distance < bestDistance) {
              bestDistance = distance;
              bestIndex = ni;
            }
          }
          used[bestIndex] = true;
          return items[bestIndex];
        }
        // Ghép mỗi mặt đúng một lần với khuôn của nó, rồi giữ cố định các tham chiếu này.
        for (var ti = 0; ti < tripleCuts.length; ti++)
          models.push({
            khuon: tripleCuts[ti],
            bai: nearestUnused(tripleCuts[ti], fronts, usedFronts),
            sau: nearestUnused(tripleCuts[ti], backs, usedBacks),
          });
        return models;
      }
      if (sel && sel.length >= 2) {
        var recs = [];
        for (si = 0; si < sel.length; si++) {
          sb = geometricBoundsOf(sel[si]);
          if (!sb || sb[2] - sb[0] <= EPS || sb[1] - sb[3] <= EPS) continue;
          recs.push({
            item: sel[si],
            bounds: sb,
            cx: (sb[0] + sb[2]) / 2,
            cy: (sb[1] + sb[3]) / 2,
            h: sb[1] - sb[3],
          });
        }
        if (recs.length < 2 || recs.length % 2)
          fail(
            "Hãy chọn số object chẵn: từng cặp Khuôn bên trái, Bài bên phải.",
          );
        recs.sort(function (a, b) {
          return b.cy - a.cy;
        });
        var rows = [],
          row = [recs[0]],
          anchor = recs[0].cy,
          r,
          oi;
        function flush() {
          row.sort(function (a, b) {
            return a.cx - b.cx;
          });
          for (var q = 0; q < row.length; q++) rows.push(row[q]);
        }
        for (r = 1; r < recs.length; r++) {
          if (anchor - recs[r].cy <= recs[0].h * 0.5) row.push(recs[r]);
          else {
            flush();
            row = [recs[r]];
            anchor = recs[r].cy;
          }
        }
        flush();
        for (oi = 0; oi < rows.length; oi += 2)
          models.push({ khuon: rows[oi], bai: rows[oi + 1] });
        return models;
      }
      var cutLayer = findLayer("cut"),
        artLayer = findLayer("art");
      if (!cutLayer || !artLayer || cutLayer === artLayer)
        fail("Chọn từng cặp Khuôn/Bài, hoặc tạo hai layer Khuôn bế và Bài.");
      var cuts = layerItems(cutLayer, true),
        arts = layerItems(artLayer, false),
        used = {},
        ki,
        bi,
        best,
        d,
        dx,
        dy;
      if (!cuts.length || !arts.length)
        fail("Layer Khuôn bế hoặc Bài đang trống.");
      for (ki = 0; ki < cuts.length; ki++) {
        best = -1;
        d = 1e99;
        for (bi = 0; bi < arts.length; bi++) {
          if (used[bi]) continue;
          dx = arts[bi].cx - cuts[ki].cx;
          dy = arts[bi].cy - cuts[ki].cy;
          if (dx * dx + dy * dy < d) {
            d = dx * dx + dy * dy;
            best = bi;
          }
        }
        if (best < 0) fail("Số Bài ít hơn số Khuôn bế.");
        used[best] = true;
        models.push({ khuon: cuts[ki], bai: arts[best] });
      }
      return models;
    }
    var models = sourceModels();
    var types = [],
      mi,
      groups;
    for (mi = 0; mi < models.length; mi++) {
      groups = [];
      modelHasCurve = false;
      collectContourGroups(models[mi].khuon.item, groups);
      groups = normalizeMillimetres(groups);
      if (!groups)
        fail("Không đọc được path khép kín của khuôn " + (mi + 1) + ".");
      types.push({ groups: groups, curveErrorMm: gap === 0 && modelHasCurve ? FLATNESS / MM : 0 });
    }
    var jobId = "danbe_" + dcDanBeJobCounter++;
    var dotsMm = [],
      di;
    for (di = 0; di < pon.dots.length; di++)
      dotsMm.push({
        x: (pon.dots[di].cx - pon.rect[0]) / MM,
        y: (pon.dots[di].cy - pon.rect[3]) / MM,
        r: pon.dots[di].r / MM,
      });
    dcDanBeJobs[jobId] = {
      doc: doc,
      models: models,
      pon: pon,
      paperW: paperW,
      paperH: paperH,
      margin: margin,
      gap: gap,
      ponClear: ponClear,
      MM: MM,
      twoSided: twoSided,
    };
    return (
      "OKJSON:" +
      dcDanBeJSON.stringify({
        jobId: jobId,
        twoSided: twoSided,
        sheet: { widthMm: paperW / MM, heightMm: paperH / MM, dots: dotsMm },
        types: types,
        gapMm: gap / MM,
        marginMm: margin / MM,
        ponClearMm: ponClear / MM,
        resolutionMm: 0.25,
        budgetMs: 3000,
      })
    );
  } catch (e) {
    try {
      return "ERR: " + dcMoTaLoi(e);
    } catch (e2) {
      return "ERR: " + e;
    }
  } finally {
    if (restoreCoordinateSystem) {
      try {
        app.coordinateSystem = oldCoordinateSystem;
      } catch (restoreError) {}
    }
  }
}

function dcDanBeRender(jobId, slotsText, reportText) {
  var oldCoordinateSystem = null,
    restoreCoordinateSystem = false;
  var createdLayers = [],
    createdArtboards = [],
    job = null,
    doc = null;
  try {
    try {
      oldCoordinateSystem = app.coordinateSystem;
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      restoreCoordinateSystem = true;
    } catch (coordinateError) {}
    job = dcDanBeJobs[jobId];
    if (!job) return "ERR: Phiên dàn bế đã hết. Hãy bấm Dàn bế lại.";
    var layout = dcDanBeJSON.parse(String(slotsText));
    var separate = layout && layout.sheets !== undefined;
    var sheets = separate ? layout.sheets : [{ slots: layout }];
    function isArray(value) {
      return Object.prototype.toString.call(value) === "[object Array]";
    }
    function fail(message) {
      throw new Error(message);
    }
    if (!isArray(sheets) || !sheets.length)
      fail("Bộ tối ưu không tìm được vị trí hợp lệ.");
    var report = null;
    try {
      report = dcDanBeJSON.parse(String(reportText || "{}"));
    } catch (ignore) {}
    doc = job.doc;
    var MM = job.MM,
      paperW = job.paperW,
      paperH = job.paperH,
      i,
      s,
      sheetIndex;
    var twoSided = job.twoSided === true;
    var totalCount = 0,
      counts = [],
      seenModels = {};
    // Kiểm tra hợp lệ toàn bộ lô trước khi tạo bất kỳ artboard hay layer kết quả nào.
    if (separate && sheets.length !== job.models.length)
      fail("Thiếu tờ riêng cho mẫu nguồn. Hãy dàn lại.");
    for (sheetIndex = 0; sheetIndex < sheets.length; sheetIndex++) {
      var plan = sheets[sheetIndex];
      if (!plan || !isArray(plan.slots) || !plan.slots.length)
        fail("Mẫu " + (sheetIndex + 1) + " không có vị trí dàn hợp lệ.");
      var modelIndex = plan.modelIndex;
      if (separate) {
        if (
          typeof modelIndex !== "number" ||
          !isFinite(modelIndex) ||
          Math.floor(modelIndex) !== modelIndex ||
          modelIndex < 0 ||
          modelIndex >= job.models.length ||
          seenModels[modelIndex]
        )
          fail("Danh sách mẫu/tờ riêng không hợp lệ.");
        seenModels[modelIndex] = true;
      }
      for (i = 0; i < plan.slots.length; i++) {
        s = plan.slots[i];
        if (
          !s ||
          typeof s.mi !== "number" ||
          !isFinite(s.mi) ||
          Math.floor(s.mi) !== s.mi ||
          s.mi < 0 ||
          s.mi >= job.models.length ||
          (separate && s.mi !== modelIndex) ||
          typeof s.vi !== "number" ||
          !isFinite(s.vi) ||
          Math.floor(s.vi) !== s.vi ||
          s.vi < 0 ||
          s.vi > 3 ||
          typeof s.x !== "number" ||
          typeof s.y !== "number" ||
          !isFinite(s.x) ||
          !isFinite(s.y) ||
          s.x < 0 ||
          s.y < 0 ||
          s.x * MM >= paperW ||
          s.y * MM >= paperH
        )
          fail(
            "Dữ liệu vị trí dàn không hợp lệ ở tờ " + (sheetIndex + 1) + ".",
          );
      }
      totalCount += plan.slots.length;
      counts.push(
        "Mẫu " + (Number(modelIndex) + 1) + ": " + plan.slots.length + " con",
      );
    }
    if (twoSided) {
      for (i = 0; i < job.models.length; i++) {
        if (!job.models[i].sau || !job.models[i].sau.item)
          fail(
            "Thiếu mặt sau của mẫu " +
              (i + 1) +
              ". Hãy chọn đủ Khuôn → trước → sau.",
          );
      }
    }
    try {
      doc.activate();
    } catch (activateError) {}
    function geometricBoundsOf(item) {
      try {
        return item.geometricBounds.slice(0);
      } catch (e) {}
      try {
        return item.visibleBounds.slice(0);
      } catch (e2) {}
      return null;
    }
    function visibleBoundsOf(item) {
      try {
        return item.visibleBounds.slice(0);
      } catch (e) {}
      try {
        return item.geometricBounds.slice(0);
      } catch (e2) {}
      return null;
    }
    function uniqueLayerName(base) {
      var candidate = base,
        suffix = 2,
        found,
        li;
      do {
        found = false;
        for (li = 0; li < doc.layers.length; li++) {
          if (doc.layers[li].name === candidate) {
            found = true;
            candidate = base + " " + suffix++;
            break;
          }
        }
      } while (found);
      return candidate;
    }
    function addLayer(name) {
      var layer = doc.layers.add();
      createdLayers.push(layer);
      layer.name = uniqueLayerName(name);
      try {
        layer.locked = false;
        layer.visible = true;
      } catch (layerStateError) {}
      // Tên là dấu nhận biết bền vững; note là dấu thứ hai ở những phiên bản AI
      // có cung cấp Layer.note.
      try {
        layer.note = "DANCARD_DANBE_OUTPUT";
      } catch (noteError) {}
      return layer;
    }
    var pageGap = 10 * MM,
      existingRects = [],
      sourceBounds = null,
      ai;
    for (ai = 0; ai < doc.artboards.length; ai++) {
      try {
        existingRects.push(doc.artboards[ai].artboardRect.slice(0));
      } catch (boardBoundsError) {}
    }
    function includeSource(item) {
      var b = visibleBoundsOf(item);
      if (!b) return;
      if (!sourceBounds) sourceBounds = b.slice(0);
      else
        sourceBounds = [
          Math.min(sourceBounds[0], b[0]),
          Math.max(sourceBounds[1], b[1]),
          Math.max(sourceBounds[2], b[2]),
          Math.min(sourceBounds[3], b[3]),
        ];
    }
    for (i = 0; i < job.models.length; i++) {
      includeSource(job.models[i].khuon.item);
      includeSource(job.models[i].bai.item);
      if (twoSided) includeSource(job.models[i].sau.item);
    }
    var scaleFactor = 1;
    try {
      scaleFactor = doc.scaleFactor;
    } catch (scaleError) {}
    var positions = dcDanBeOutputPositions(
      paperW,
      paperH,
      twoSided,
      sheets.length,
      scaleFactor,
      existingRects,
      sourceBounds,
      MM,
    );
    var sheetLeft, sheetTop;
    function drawDot(layer, cx, cy, r) {
      var black = new CMYKColor();
      black.cyan = 0;
      black.magenta = 0;
      black.yellow = 0;
      black.black = 100;
      var dot = layer.pathItems.ellipse(cy + r, cx - r, r * 2, r * 2);
      dot.filled = true;
      dot.fillColor = black;
      dot.stroked = false;
    }
    function centreArtwork(item, cx, cy) {
      var b = visibleBoundsOf(item);
      if (!b) fail("Không đo được Bài để canh tâm theo khuôn.");
      item.translate(cx - (b[0] + b[2]) / 2, cy - (b[1] + b[3]) / 2);
    }
    function addFace(rect, suffix, isBack) {
      var board = doc.artboards.add(rect);
      createdArtboards.push(board);
      try {
        board.name = "Dan be" + suffix;
      } catch (nameError) {}
      var ponLayer = addLayer("Dàn bế - PON" + suffix);
      var cutLayer = addLayer("Dàn bế - Khuôn" + suffix);
      var artLayer = addLayer("Dàn bế - Bài" + suffix);
      for (var di = 0; di < job.pon.dots.length; di++) {
        var dotIn = job.pon.dots[di],
          dotX = dotIn.cx - job.pon.rect[0];
        // PON mặt sau cũng lật tờ theo chiều ngang giống như khuôn.
        if (isBack) dotX = paperW - dotX;
        drawDot(
          ponLayer,
          rect[0] + dotX,
          rect[3] + dotIn.cy - job.pon.rect[3],
          dotIn.r,
        );
      }
      return { pon: ponLayer, cut: cutLayer, art: artLayer };
    }
    function finishFace(face) {
      try {
        face.cut.zOrder(ZOrderMethod.SENDTOBACK);
      } catch (khuonOrderError) {}
      try {
        face.pon.zOrder(ZOrderMethod.BRINGTOFRONT);
      } catch (ponOrderError) {}
    }
    var angles = [0, 90, 180, 270],
      model,
      angle,
      left,
      bottom,
      kCopy,
      kb,
      bCopy;
    var firstNewIndex = doc.artboards.length;
    for (sheetIndex = 0; sheetIndex < sheets.length; sheetIndex++) {
      var rect = positions[sheetIndex];
      sheetLeft = rect[0];
      sheetTop = rect[1];
      var suffix = separate
        ? " - mẫu " + (sheets[sheetIndex].modelIndex + 1)
        : "";
      var frontFace = addFace(
        rect,
        suffix + (twoSided ? " - mặt trước" : ""),
        false,
      );
      var outKhuon = frontFace.cut,
        outBai = frontFace.art,
        lockedFront = [];
      var slots = sheets[sheetIndex].slots;
      for (i = 0; i < slots.length; i++) {
        s = slots[i];
        model = job.models[s.mi];
        angle = angles[s.vi];
        doc.activeLayer = outKhuon;
        kCopy = model.khuon.item.duplicate(
          outKhuon,
          ElementPlacement.PLACEATEND,
        );
        if (angle) kCopy.rotate(angle);
        // Lõi xếp theo đúng path khuôn thật: không dùng bounds đã nở thêm theo stroke.
        kb = geometricBoundsOf(kCopy);
        if (!kb) fail("Không đo được khuôn sau khi xoay.");
        left = sheetLeft + s.x * MM;
        bottom = sheetTop - paperH + s.y * MM;
        kCopy.translate(left - kb[0], bottom - kb[3]);
        kb = geometricBoundsOf(kCopy);
        if (!kb) fail("Không đo được khuôn sau khi đặt vào tờ.");
        doc.activeLayer = outBai;
        bCopy = model.bai.item.duplicate(outBai, ElementPlacement.PLACEATEND);
        if (angle) bCopy.rotate(angle);
        centreArtwork(bCopy, (kb[0] + kb[2]) / 2, (kb[1] + kb[3]) / 2);
        if (twoSided)
          lockedFront.push({
            model: model,
            angle: angle,
            cut: kCopy,
            bounds: kb.slice(0),
          });
      }
      finishFace(frontFace);
      if (twoSided) {
        var backRect = [
          rect[2] + pageGap,
          rect[1],
          rect[2] + pageGap + paperW,
          rect[3],
        ];
        var backFace = addFace(backRect, suffix + " - mặt sau", true);
        var reflection = app.getScaleMatrix(-100, 100);
        for (i = 0; i < lockedFront.length; i++) {
          var captured = lockedFront[i],
            fb = captured.bounds;
          var backX = backRect[0] + paperW - ((fb[0] + fb[2]) / 2 - rect[0]);
          var backY = backRect[3] + (fb[1] + fb[3]) / 2 - rect[3];
          doc.activeLayer = backFace.cut;
          // Lật đối xứng KHUÔN mặt trước đã xoay sẵn, không phải bài. Cách này cũng
          // xử lý được hình bất đối xứng/lõm, khác với việc chỉ xoay -angle.
          kCopy = captured.cut.duplicate(
            backFace.cut,
            ElementPlacement.PLACEATEND,
          );
          kCopy.transform(
            reflection,
            true,
            true,
            true,
            true,
            100,
            Transformation.CENTER,
          );
          kb = geometricBoundsOf(kCopy);
          if (!kb) fail("Không đo được khuôn mặt sau.");
          kCopy.translate(
            backX - (kb[0] + kb[2]) / 2,
            backY - (kb[1] + kb[3]) / 2,
          );
          doc.activeLayer = backFace.art;
          bCopy = captured.model.sau.item.duplicate(
            backFace.art,
            ElementPlacement.PLACEATEND,
          );
          // Xoay ngược lại cho khớp quy ước hai mặt lật ngang của KTS;
          // chữ/hình giữ nguyên chiều thuận và không bao giờ bị lật đối xứng.
          if (captured.angle) bCopy.rotate(-captured.angle);
          centreArtwork(bCopy, backX, backY);
        }
        finishFace(backFace);
      }
    }
    // Tới đây cả lô một mặt/hai mặt mới được vẽ xong thành công.
    // Xoá các khung cũ, không bao giờ xoá object/layer nguồn. Khi lỗi thì không dọn dẹp gì.
    var removedOldBoards = 0;
    for (var oldBoard = firstNewIndex - 1; oldBoard >= 0; oldBoard--) {
      try {
        doc.artboards[oldBoard].remove();
        removedOldBoards++;
      } catch (oldBoardRemoveError) {}
    }
    var remainingOldBoards = firstNewIndex - removedOldBoards;
    try {
      doc.artboards.setActiveArtboardIndex(remainingOldBoards);
    } catch (artboardSelectError) {}
    try {
      doc.selection = null;
    } catch (selectionClearError) {}
    var detail = separate
      ? "Đã tạo " +
        sheets.length +
        (twoSided ? " cặp artboard trước/sau" : " artboard riêng") +
        "; tổng " +
        totalCount +
        " con. " +
        counts.join("; ") +
        "."
      : report && report.detail
        ? report.detail
        : "Dàn silhouette thật: " + totalCount + " con.";
    detail += " Khuôn và Bài nằm ở layer riêng; PON giữ ở layer trên cùng.";
    if (remainingOldBoards > 0)
      detail +=
        " Chưa xóa được " +
        remainingOldBoards +
        " artboard cũ; kết quả mới vẫn được giữ.";
    if (twoSided) {
      if (!separate)
        detail += " Đã tạo " + sheets.length + " cặp artboard trước/sau.";
      detail +=
        " Hai mặt dùng chung bố cục khuôn, đối xứng lật ngang; không lật gương chữ/hình.";
    }
    try {
      delete dcDanBeJobs[jobId];
    } catch (clearError) {}
    return separate
      ? "OK: " + detail
      : "OK:[[COUNT:" + totalCount + "]] " + detail;
  } catch (e) {
    // Không bao giờ xoá bài nguồn: chỉ những layer và artboard này là do
    // lần gọi này tạo ra, nên khi hoàn lại cũng chỉ gỡ đúng những thứ đó.
    if (doc) {
      try {
        if (job && job.models && job.models.length)
          doc.activeLayer = job.models[0].khuon.item.layer;
      } catch (sourceLayerError) {}
      for (var li = createdLayers.length - 1; li >= 0; li--) {
        try {
          createdLayers[li].remove();
        } catch (removeLayerError) {}
      }
      for (var abi = createdArtboards.length - 1; abi >= 0; abi--) {
        try {
          createdArtboards[abi].remove();
        } catch (removeArtboardError) {}
      }
    }
    try {
      delete dcDanBeJobs[jobId];
    } catch (clearFailedJobError) {}
    try {
      return "ERR: " + dcMoTaLoi(e);
    } catch (e2) {
      return "ERR: " + e;
    }
  } finally {
    if (restoreCoordinateSystem) {
      try {
        app.coordinateSystem = oldCoordinateSystem;
      } catch (restoreError) {}
    }
  }
}
