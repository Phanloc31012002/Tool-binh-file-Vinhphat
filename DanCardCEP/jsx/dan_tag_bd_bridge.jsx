// ============================================================
// DÀN TAG BD – CẦU NỐI ILLUSTRATOR <-> js/dan_tag_bd.js
//
// ExtendScript (ES3) chỉ làm ba việc: đọc tag đang chọn (hàng trái = trước,
// phải = sau), đóng artboard trước/sau theo phương án lõi đã tính, và xuất PDF
// 2 trang. Phần ghép khối chạy ở Chromium của CEP (dan_tag_bd.js).
// Luật chốt với anh Lộc 22/10/2026: docs/THIET_KE_DAN_TAG_BD.md
// ============================================================
var dcDanTagBdVersion = 4;
if (typeof dcDanTagBdNguon === "undefined") var dcDanTagBdNguon = {};
if (typeof dcDanTagBdNguonDem === "undefined") var dcDanTagBdNguonDem = 1;

// JSON tối thiểu (engine ExtendScript không có JSON sẵn). Dùng lại bộ của Dàn bế nếu đã nạp.
var dcDanTagBdJSON = (function () {
  if (typeof dcDanBeJSON !== "undefined" && dcDanBeJSON && dcDanBeJSON.parse) return dcDanBeJSON;
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
      throw new Error("Dữ liệu Dàn tag BD không đọc được tại vị trí " + pos);
    }
    function space() {
      while (pos < text.length && /\s/.test(text.charAt(pos))) pos++;
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
            if (key === "__proto__" || key === "constructor" || key === "prototype") fail();
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
      token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.substr(pos));
      if (!token) fail();
      pos += token[0].length;
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

function dcDanTagBdMoTaLoi(e) {
  try {
    if (typeof dcMoTaLoi === "function") return dcMoTaLoi(e);
  } catch (ignore) {}
  return e && e.message ? e.message : String(e);
}

// Khung tag = khung Transform (lib), dự phòng khung mask clip rồi visibleBounds/geometricBounds.
function dcDanTagBdKhung(item) {
  var khung = null;
  try {
    if (typeof dcKhungThanhPham === "function") khung = dcKhungThanhPham(item);
  } catch (khungError) {}
  if (khung) return khung;
  try {
    if (item.typename === "GroupItem" && item.clipped === true) {
      var p = item.pageItems;
      for (var i = 0; i < p.length; i++) {
        try {
          if (p[i].clipping === true) return p[i].geometricBounds.slice(0);
        } catch (clipError) {}
      }
    }
  } catch (groupError) {}
  try {
    return item.visibleBounds.slice(0);
  } catch (visibleError) {}
  try {
    return item.geometricBounds.slice(0);
  } catch (geometricError) {}
  return null;
}

// Gom selection thành hàng: 2 object = trước (trái) + sau (phải); 1 object ở cột trái = tag 1 mặt.
// Luật y như Auto Save (dung sai 45 % chiều cao con thấp nhất).
// Vì sao một object trong vùng chọn không phải tag: guide, đang ẩn, không có khung (group rỗng, path
// không điểm, khung 0 × 0). Trả "" khi object đo được bình thường.
function dcDanTagBdLyDoBo(item, g) {
  try {
    if (item.guides === true) return "guide";
  } catch (guideError) {}
  try {
    if (item.hidden === true) return "ẩn";
  } catch (hiddenError) {}
  if (!g || g.length !== 4 || !isFinite(g[0]) || !isFinite(g[1]) || !isFinite(g[2]) || !isFinite(g[3])) return "không đo được khung";
  if (g[2] - g[0] <= 0.01 || g[1] - g[3] <= 0.01) return "khung rỗng (0 mm)";
  return "";
}
function dcDanTagBdTenObject(item, index) {
  var ten = "Object " + (index + 1),
    kieu = "";
  try {
    kieu = String(item.typename || "");
  } catch (typeError) {}
  try {
    if (item.name) ten += ' "' + String(item.name) + '"';
  } catch (nameError) {}
  return ten + (kieu ? " (" + kieu + ")" : "");
}
// Kết quả: { rows: [...], boQua: ["Object 3 (PathItem): guide", ...] }.
function dcDanTagBdGomHang(sel) {
  var items = [],
    boQua = [],
    minH = Number.MAX_VALUE,
    i;
  for (i = 0; i < sel.length; i++) {
    var g = dcDanTagBdKhung(sel[i]);
    var lyDo = dcDanTagBdLyDoBo(sel[i], g);
    if (lyDo) {
      // Không chặn cả lượt vì một guide/object rỗng lọt vào vùng chọn; báo rõ rồi bỏ qua.
      boQua.push(dcDanTagBdTenObject(sel[i], i) + ": " + lyDo);
      continue;
    }
    var h = g[1] - g[3];
    if (h > 0 && h < minH) minH = h;
    items.push({ o: sel[i], khung: g, left: g[0], cy: (g[1] + g[3]) / 2, cx: (g[0] + g[2]) / 2 });
  }
  if (!items.length)
    throw new Error(
      "Trong vùng chọn không có tag nào đo được (" + boQua.join("; ") + "). Hãy chọn các tag đã tràn theo hàng: trái = trước, phải = sau.",
    );
  if (!isFinite(minH) || minH <= 0) minH = 10;
  items.sort(function (a, b) {
    return b.cy - a.cy;
  });
  var ROW_TOLERANCE = Math.max(minH * 0.45, 4),
    rows = [];
  for (i = 0; i < items.length; i++) {
    var lastRow = rows.length ? rows[rows.length - 1] : null;
    if (!lastRow || Math.abs(items[i].cy - lastRow.cy) > ROW_TOLERANCE) rows.push({ cy: items[i].cy, items: [items[i]] });
    else {
      var n = lastRow.items.length;
      lastRow.items.push(items[i]);
      lastRow.cy = (lastRow.cy * n + items[i].cy) / (n + 1);
    }
  }
  var leftTotal = 0,
    rightTotal = 0,
    twoSideRows = 0;
  for (i = 0; i < rows.length; i++) {
    rows[i].items.sort(function (a, b) {
      return a.cx - b.cx;
    });
    if (rows[i].items.length > 2)
      throw new Error("Hàng " + (i + 1) + " có " + rows[i].items.length + " object. Mỗi hàng chỉ 1 object (tag 1 mặt) hoặc 2 object (trước + sau).");
    if (rows[i].items.length === 2) {
      leftTotal += rows[i].items[0].left;
      rightTotal += rows[i].items[1].left;
      twoSideRows++;
    }
  }
  var leftX = twoSideRows ? leftTotal / twoSideRows : 0,
    rightX = twoSideRows ? rightTotal / twoSideRows : 0,
    out = [],
    MMv = 2.834645669,
    tol = (typeof DC_DUNG_SAI_KHO_MM === "number" ? DC_DUNG_SAI_KHO_MM : 0.5) * MMv;
  function khoText(k) {
    return Math.round(((k[2] - k[0]) / MMv) * 10) / 10 + " × " + Math.round(((k[1] - k[3]) / MMv) * 10) / 10;
  }
  for (i = 0; i < rows.length; i++) {
    var row = rows[i].items;
    if (row.length === 2) {
      // Mặt sau phải cùng khổ mặt trước (lệch ≤ 0,5 mm), nếu không là object lạ hoặc chưa clip cùng khổ.
      var fw = row[0].khung[2] - row[0].khung[0],
        fh = row[0].khung[1] - row[0].khung[3],
        bw = row[1].khung[2] - row[1].khung[0],
        bh = row[1].khung[1] - row[1].khung[3];
      if (Math.abs(fw - bw) > tol || Math.abs(fh - bh) > tol)
        throw new Error(
          "Hàng " + (i + 1) + ": mặt sau " + khoText(row[1].khung) + " mm khác mặt trước " + khoText(row[0].khung) + " mm (lệch quá 0,5 mm). Hãy clip hai mặt cùng khổ, hoặc bỏ object lạ ở cột phải.",
        );
      out.push({ front: row[0], back: row[1] });
      continue;
    }
    if (twoSideRows > 0 && Math.abs(row[0].left - rightX) < Math.abs(row[0].left - leftX))
      throw new Error("Hàng " + (i + 1) + " chỉ có object ở gần cột phải. Hãy chọn thêm mặt trước ở cột trái, hoặc đặt tag 1 mặt ở cột trái.");
    out.push({ front: row[0], back: null });
  }
  return { rows: out, boQua: boQua };
}

// Đọc tag đang chọn -> OKJSON:{tags:[{id,w,h,twoSided,name}]} và đăng ký object vào dcDanTagBdNguon.
function dcDanTagBdDocTag() {
  var oldCoordinateSystem = null,
    restoreCoordinateSystem = false;
  try {
    if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
    try {
      oldCoordinateSystem = app.coordinateSystem;
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      restoreCoordinateSystem = true;
    } catch (coordinateError) {}
    var doc = app.activeDocument,
      MM = 2.834645669;
    var sel = doc.selection;
    if (!sel || !sel.length) return "ERR: Chưa chọn tag nào. Hãy chọn các tag theo hàng (trái = trước, phải = sau).";
    var gom = dcDanTagBdGomHang(sel),
      rows = gom.rows,
      tags = [],
      i;
    for (i = 0; i < rows.length; i++) {
      var f = rows[i].front,
        w = Math.round(((f.khung[2] - f.khung[0]) / MM) * 100) / 100,
        h = Math.round(((f.khung[1] - f.khung[3]) / MM) * 100) / 100,
        name = "";
      try {
        name = String(f.o.name || "");
      } catch (nameError) {}
      if (name.replace(/^\s+|\s+$/g, "") === "") name = "Tag " + (i + 1);
      var id = "tag_" + dcDanTagBdNguonDem++;
      dcDanTagBdNguon[id] = { front: f.o, back: rows[i].back ? rows[i].back.o : null, w: w, h: h };
      tags.push({ id: id, w: w, h: h, twoSided: !!rows[i].back, name: name });
    }
    return "OKJSON:" + dcDanTagBdJSON.stringify({ tags: tags, boQua: gom.boQua });
  } catch (e) {
    return "ERR: " + dcDanTagBdMoTaLoi(e);
  } finally {
    if (restoreCoordinateSystem) {
      try {
        app.coordinateSystem = oldCoordinateSystem;
      } catch (restoreError) {}
    }
  }
}

// ============================================================
//  Đóng artboard trước/sau cho từng khối theo phương án lõi đã tính.
// ============================================================
var DC_TAGBD_MM = 2.834645669;
var DC_TAGBD_GAP_MM = 10; // khoảng cách giữa các artboard/cặp
var DC_TAGBD_MARK_MM = 3; // dấu cắt dài 3 mm trên đường cắt
var DC_TAGBD_MARK_PT = 0.5;

function dcDanTagBdSoKho(mm) {
  // 112 -> "110", 460 -> "458", 91.5 -> "89.5" (khổ thành phẩm = khổ tràn − 2 mm, cách ghi như Auto Save).
  var v = Math.round((mm - 2) * 10) / 10;
  return String(v);
}
function dcDanTagBdTenArtboard(k, bai, w, h, mat) {
  return "TagBD " + k + " - bai " + bai + " - " + dcDanTagBdSoKho(w) + " x " + dcDanTagBdSoKho(h) + " - " + mat;
}
// Đọc tên artboard TagBD -> {k, bai, mat} hoặc null.
function dcDanTagBdDocTen(name) {
  var m = /^TagBD (\d+) - bai (\d+) - ([\d.]+) x ([\d.]+) - (truoc|sau)$/.exec(String(name || ""));
  if (!m) return null;
  return { k: parseInt(m[1], 10), bai: parseInt(m[2], 10), w: m[3], h: m[4], mat: m[5] };
}
// Đếm cặp artboard TagBD trong tài liệu đang mở: "OK:n".
function dcDanTagBdDemArtboard() {
  try {
    if (app.documents.length === 0) return "OK:0";
    var doc = app.activeDocument,
      n = 0;
    for (var i = 0; i < doc.artboards.length; i++) {
      var t = dcDanTagBdDocTen(doc.artboards[i].name);
      if (t && t.mat === "truoc") n++;
    }
    return "OK:" + n;
  } catch (e) {
    return "ERR: " + dcDanTagBdMoTaLoi(e);
  }
}

// Vùng đang bận trên canvas: mọi artboard + mọi object cấp cao nhất đang hiện (bỏ object phủ gần hết canvas).
function dcDanTagBdVungBan(doc, canvasHalf) {
  var rects = [],
    i,
    li;
  for (i = 0; i < doc.artboards.length; i++) {
    try {
      var ab = doc.artboards[i].artboardRect.slice(0);
      // Artboard phủ gần hết canvas là nền làm việc, không phải tờ cần né (như Dàn tối ưu).
      if (ab[2] - ab[0] >= canvasHalf * 1.84 && ab[1] - ab[3] >= canvasHalf * 1.84) continue;
      rects.push(ab);
    } catch (boardError) {}
  }
  var layerCount = 0;
  try {
    layerCount = doc.layers.length;
  } catch (layersError) {}
  for (li = 0; li < layerCount; li++) {
    var items = null,
      count = 0;
    try {
      if (doc.layers[li].visible === false) continue;
      items = doc.layers[li].pageItems;
      count = items.length;
    } catch (layerError) {
      continue;
    }
    for (i = 0; i < count; i++) {
      var b = null;
      try {
        if (items[i].hidden === true) continue;
        b = items[i].geometricBounds;
      } catch (itemError) {
        continue;
      }
      if (!b || !(b[2] > b[0]) || !(b[1] > b[3])) continue;
      if (b[2] - b[0] >= canvasHalf * 1.84 && b[1] - b[3] >= canvasHalf * 1.84) continue;
      rects.push([b[0], b[1], b[2], b[3]]);
    }
  }
  return rects;
}

// Cấp chỗ cho các khối y như Dàn tối ưu/KTS: bắt đầu từ góc trên trái canvas, đặt từng cặp trước/sau
// (cạnh nhau, cách GAP) sang phải; vượt mép phải canvas thì tự xuống hàng và đi tiếp từ mép trái; chỗ
// đã có artboard/bài cũ thì nhảy qua bên phải nó. Hết canvas theo chiều dọc mới báo lỗi.
// sizes: [{w, h}] mm. Trả mảng rect mặt trước [l, t, r, b] (pt); mặt sau = dịch phải w + GAP.
function dcDanTagBdViTri(doc, sizes, MM) {
  var EPS = 0.01,
    gap = DC_TAGBD_GAP_MM * MM,
    canvasHalf = 7200,
    scale = 1;
  try {
    scale = doc.scaleFactor;
  } catch (scaleError) {}
  if (isFinite(scale) && scale > 0 && scale < 1) canvasHalf /= scale;
  var busy = dcDanTagBdVungBan(doc, canvasHalf),
    i;
  var left = -canvasHalf + gap,
    top = canvasHalf - gap,
    right = canvasHalf - gap,
    bottom = -canvasHalf + gap;
  function overlap(a, b) {
    return a[0] < b[2] - EPS && a[2] > b[0] + EPS && a[3] < b[1] - EPS && a[1] > b[3] + EPS;
  }
  var positions = [],
    cx = left,
    cy = top;
  for (i = 0; i < sizes.length; i++) {
    var w = sizes[i].w * MM,
      h = sizes[i].h * MM,
      pairW = w * 2 + gap,
      attempts = 0,
      placed = false;
    if (pairW > right - left + EPS) throw new Error("Khối " + (i + 1) + " rộng quá canvas (cặp trước/sau " + Math.round(pairW / MM) + " mm). Hãy mở Large Canvas.");
    while (attempts++ < 5000) {
      if (cx + pairW > right + EPS) {
        // Hết bề ngang canvas: xuống hàng, đi tiếp từ mép trái.
        cx = left;
        cy -= h + gap;
        continue;
      }
      if (cy - h < bottom - EPS) throw new Error("Không còn chỗ trong canvas để đóng đủ artboard. Hãy xoá bớt artboard/bài cũ hoặc mở tài liệu mới.");
      var rect = [cx, cy, cx + pairW, cy - h],
        blocker = null,
        bi;
      for (bi = 0; bi < busy.length; bi++)
        if (overlap(rect, busy[bi])) {
          blocker = busy[bi];
          break;
        }
      if (blocker) {
        cx = blocker[2] + gap;
        continue;
      }
      busy.push(rect);
      positions.push([cx, cy, cx + w, cy - h]);
      cx += pairW + gap;
      placed = true;
      break;
    }
    if (!placed) throw new Error("Không tìm được vị trí trong canvas để đặt artboard mới.");
  }
  return positions;
}

function dcDanTagBdVe(planText) {
  var oldCoordinateSystem = null,
    restoreCoordinateSystem = false,
    createdLayers = [],
    createdArtboards = [],
    doc = null;
  try {
    if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
    try {
      oldCoordinateSystem = app.coordinateSystem;
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      restoreCoordinateSystem = true;
    } catch (coordinateError) {}
    doc = app.activeDocument;
    var MM = DC_TAGBD_MM,
      EPS = 0.01;
    function fail(message) {
      throw new Error(message);
    }
    function isArray(v) {
      return Object.prototype.toString.call(v) === "[object Array]";
    }
    function num(v) {
      return typeof v === "number" && isFinite(v);
    }
    var plan = dcDanTagBdJSON.parse(String(planText));
    if (!plan || !isArray(plan.jobs) || !plan.jobs.length) fail("Phương án dàn trống. Hãy bấm Dàn tag lại.");
    // ---- Kiểm toàn bộ phương án trước khi đụng tài liệu ----
    var blocks = [],
      ji,
      bi,
      pi,
      job,
      blk,
      p;
    for (ji = 0; ji < plan.jobs.length; ji++) {
      job = plan.jobs[ji];
      if (!job || (job.bai !== 500 && job.bai !== 1000) || !isArray(job.blocks) || !job.blocks.length) fail("Phương án bài " + (ji + 1) + " không hợp lệ.");
      for (bi = 0; bi < job.blocks.length; bi++) {
        blk = job.blocks[bi];
        if (
          !blk ||
          !num(blk.cols) ||
          !num(blk.rows) ||
          blk.cols < 1 ||
          blk.rows < 1 ||
          blk.cols > 18 ||
          blk.rows > 7 ||
          Math.floor(blk.cols) !== blk.cols ||
          Math.floor(blk.rows) !== blk.rows ||
          !num(blk.w) ||
          !num(blk.h) ||
          Math.abs(blk.w - 56 * blk.cols) > EPS ||
          Math.abs(blk.h - 92 * blk.rows) > EPS ||
          !isArray(blk.places) ||
          !blk.places.length ||
          !isArray(blk.cuts)
        )
          fail("Khối " + (bi + 1) + " của bài " + job.bai + " không hợp lệ.");
        for (pi = 0; pi < blk.places.length; pi++) {
          p = blk.places[pi];
          if (!p || !num(p.x) || !num(p.y) || !num(p.w) || !num(p.h) || (p.rot !== 0 && p.rot !== 90)) fail("Vị trí con " + (pi + 1) + " trong khối " + (bi + 1) + " không hợp lệ.");
          // Hệ số bóp từng con theo từng chiều (lõi tính: mỗi con ≤ 1 mm, thiếu thêm chút thì cả cụm ăn tiếp).
          if (p.bopX === undefined || p.bopX === null) p.bopX = 1;
          if (p.bopY === undefined || p.bopY === null) p.bopY = 1;
          if (!num(p.bopX) || !num(p.bopY) || p.bopX > 1 + EPS || p.bopY > 1 + EPS || p.bopX < 0.9 || p.bopY < 0.9)
            fail("Hệ số bóp của con " + (pi + 1) + " trong khối " + (bi + 1) + " không hợp lệ (" + p.bopX + " × " + p.bopY + ").");
          if (p.x < -EPS || p.y < -EPS || p.x + p.w > blk.w + EPS || p.y + p.h > blk.h + EPS) fail("Con " + (pi + 1) + " trong khối " + (bi + 1) + " nằm ngoài khối.");
          var src = dcDanTagBdNguon[p.id];
          if (!src || !src.front) fail("Tag " + p.id + " không còn trong danh sách nguồn. Hãy xoá danh sách, chọn lại tag rồi Thêm.");
          var kf = dcDanTagBdKhung(src.front);
          if (!kf) fail("Tag nguồn " + p.id + " (mặt trước) không còn đo được — có thể đã bị xoá. Hãy chọn lại tag rồi Thêm.");
          // Khổ nguồn phải còn đúng như lúc Thêm (người dùng có thể đã phóng/thu tag sau đó).
          var tol = (typeof DC_DUNG_SAI_KHO_MM === "number" ? DC_DUNG_SAI_KHO_MM : 0.5) * MM;
          var cw = kf[2] - kf[0],
            ch = kf[1] - kf[3];
          if (Math.abs(cw - src.w * MM) > tol || Math.abs(ch - src.h * MM) > tol)
            fail(
              "Tag " + p.id + " đã đổi khổ sau khi Thêm: lúc Thêm " + src.w + " × " + src.h + " mm, giờ " + Math.round((cw / MM) * 10) / 10 + " × " + Math.round((ch / MM) * 10) / 10 + " mm. Hãy xoá danh sách, chọn lại tag rồi Thêm.",
            );
          if (src.back && !dcDanTagBdKhung(src.back)) fail("Tag nguồn " + p.id + " (mặt sau) không còn đo được — có thể đã bị xoá. Hãy chọn lại tag rồi Thêm.");
        }
        for (pi = 0; pi < blk.cuts.length; pi++) {
          var c = blk.cuts[pi];
          if (!c || (c.axis !== "V" && c.axis !== "H") || !num(c.at) || !num(c.from) || !num(c.to) || c.to <= c.from) fail("Nhát cắt " + (pi + 1) + " trong khối " + (bi + 1) + " không hợp lệ.");
        }
        blocks.push({ job: job, blk: blk });
      }
    }
    // ---- Số thứ tự khối nối tiếp các artboard TagBD đã có ----
    var k0 = 0,
      ai;
    for (ai = 0; ai < doc.artboards.length; ai++) {
      var ten = dcDanTagBdDocTen(doc.artboards[ai].name);
      if (ten && ten.k > k0) k0 = ten.k;
    }
    var sizes = [];
    for (bi = 0; bi < blocks.length; bi++) sizes.push({ w: blocks[bi].blk.w, h: blocks[bi].blk.h });
    var positions = dcDanTagBdViTri(doc, sizes, MM);

    try {
      doc.activate();
    } catch (activateError) {}
    function uniqueLayerName(base) {
      var candidate = base,
        suffix = 2,
        found,
        li;
      do {
        found = false;
        for (li = 0; li < doc.layers.length; li++)
          if (doc.layers[li].name === candidate) {
            found = true;
            candidate = base + " " + suffix++;
            break;
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
      try {
        layer.note = "DANCARD_TAGBD_OUTPUT";
      } catch (noteError) {}
      return layer;
    }
    var black = new CMYKColor();
    black.cyan = 0;
    black.magenta = 0;
    black.yellow = 0;
    black.black = 100;
    function drawMark(layer, x1, y1, x2, y2) {
      var line = layer.pathItems.add();
      line.setEntirePath([
        [x1, y1],
        [x2, y2],
      ]);
      line.closed = false;
      line.filled = false;
      line.stroked = true;
      line.strokeColor = black;
      line.strokeWidth = DC_TAGBD_MARK_PT;
      try {
        line.note = "DANCARD_TAGBD_MARK";
      } catch (markNoteError) {}
    }
    // Hai dấu 3 mm ở hai đầu mỗi nhát cắt, nằm trên đường cắt, hướng vào trong nhát.
    function drawCutMarks(layer, rect, W, cuts, mirrored) {
      var L = rect[0],
        T = rect[1],
        mark = DC_TAGBD_MARK_MM,
        i,
        c,
        at,
        from,
        to;
      for (i = 0; i < cuts.length; i++) {
        c = cuts[i];
        at = c.at;
        from = c.from;
        to = c.to;
        if (mirrored) {
          if (c.axis === "V") at = W - c.at;
          else {
            from = W - c.to;
            to = W - c.from;
          }
        }
        var len = Math.min(mark, to - from);
        if (len <= EPS) continue;
        if (c.axis === "V") {
          drawMark(layer, L + at * MM, T - from * MM, L + at * MM, T - (from + len) * MM);
          drawMark(layer, L + at * MM, T - (to - len) * MM, L + at * MM, T - to * MM);
        } else {
          drawMark(layer, L + from * MM, T - at * MM, L + (from + len) * MM, T - at * MM);
          drawMark(layer, L + (to - len) * MM, T - at * MM, L + to * MM, T - at * MM);
        }
      }
    }
    // Đặt bản sao: mặt trước canh góc trên trái ô; mặt sau canh TÂM ô lật (khổ lệch nhỏ trong dung sai vẫn cân).
    function placeCopy(sourceItem, layer, angle, leftPt, topPt, wPt, hPt, centre, bopX, bopY) {
      doc.activeLayer = layer;
      var copy = sourceItem.duplicate(layer, ElementPlacement.PLACEATEND);
      try {
        copy.note = "DANCARD_TAGBD_COPY";
      } catch (copyNoteError) {}
      if (angle) copy.rotate(angle);
      // Bóp: co bản sao quanh tâm theo từng chiều (sau khi xoay, theo trục tài liệu), nét giữ nguyên;
      // nguồn không đụng. Tham số thứ 6 của transform() là HỆ SỐ nhân nét (1 = giữ nguyên), khác
      // resize() nhận phần trăm — đưa 100 là mọi nét phình ×100, viền đen của chữ phủ kín cả ô.
      if ((bopX && bopX < 1 - 1e-9) || (bopY && bopY < 1 - 1e-9))
        copy.transform(app.getScaleMatrix((bopX || 1) * 100, (bopY || 1) * 100), true, true, true, true, 1, Transformation.CENTER);
      var kb = dcDanTagBdKhung(copy);
      if (!kb) fail("Không đo được bản sao tag sau khi xoay.");
      if (centre) copy.translate(leftPt + wPt / 2 - (kb[0] + kb[2]) / 2, topPt - hPt / 2 - (kb[1] + kb[3]) / 2);
      else copy.translate(leftPt - kb[0], topPt - kb[1]);
      return copy;
    }

    var firstNewIndex = doc.artboards.length,
      made = [],
      totalPieces = 0;
    for (bi = 0; bi < blocks.length; bi++) {
      blk = blocks[bi].blk;
      job = blocks[bi].job;
      var k = k0 + bi + 1,
        rect = positions[bi],
        W = blk.w;
      var backRect = [rect[2] + DC_TAGBD_GAP_MM * MM, rect[1], rect[2] + DC_TAGBD_GAP_MM * MM + W * MM, rect[3]];
      var frontBoard = doc.artboards.add(rect);
      createdArtboards.push(frontBoard);
      try {
        frontBoard.name = dcDanTagBdTenArtboard(k, job.bai, blk.w, blk.h, "truoc");
      } catch (nameError) {}
      var frontLayer = addLayer("Tag BD " + k + " - trước");
      for (pi = 0; pi < blk.places.length; pi++) {
        p = blk.places[pi];
        placeCopy(dcDanTagBdNguon[p.id].front, frontLayer, p.rot, rect[0] + p.x * MM, rect[1] - p.y * MM, p.w * MM, p.h * MM, false, p.bopX, p.bopY);
        totalPieces++;
      }
      drawCutMarks(frontLayer, rect, W, blk.cuts, false);
      var backBoard = doc.artboards.add(backRect);
      createdArtboards.push(backBoard);
      try {
        backBoard.name = dcDanTagBdTenArtboard(k, job.bai, blk.w, blk.h, "sau");
      } catch (backNameError) {}
      var backLayer = addLayer("Tag BD " + k + " - sau");
      for (pi = 0; pi < blk.places.length; pi++) {
        p = blk.places[pi];
        var back = dcDanTagBdNguon[p.id].back;
        if (!back) continue; // tag 1 mặt: mặt sau để trống
        var xBack = W - p.x - p.w;
        placeCopy(back, backLayer, -p.rot, backRect[0] + xBack * MM, backRect[1] - p.y * MM, p.w * MM, p.h * MM, true, p.bopX, p.bopY);
      }
      drawCutMarks(backLayer, backRect, W, blk.cuts, true);
      made.push(k + " (bài " + job.bai + ", " + blk.cols + " × " + blk.rows + " ô, " + blk.places.length + " con)");
    }
    try {
      doc.artboards.setActiveArtboardIndex(firstNewIndex);
    } catch (boardSelectError) {}
    try {
      doc.selection = null;
    } catch (selectionError) {}
    try {
      app.redraw();
    } catch (redrawError) {}
    var msg =
      "OK: Đã đóng " +
      blocks.length +
      " khối (" +
      blocks.length * 2 +
      " artboard trước/sau), " +
      totalPieces +
      " con: khối " +
      made.join("; ") +
      "." +
      (plan.detail ? " " + plan.detail : "") +
      " Kiểm tra lại rồi bấm Xuất PDF.";
    return msg;
  } catch (e) {
    // Hoàn tác đúng những layer/artboard vừa tạo; không bao giờ đụng nguồn.
    if (doc) {
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
    return "ERR: " + dcDanTagBdMoTaLoi(e);
  } finally {
    if (restoreCoordinateSystem) {
      try {
        app.coordinateSystem = oldCoordinateSystem;
      } catch (restoreError) {}
    }
  }
}

// ============================================================
//  Xuất PDF 2 trang cho từng cặp artboard TagBD, đặt tên như Auto Save:
//  <Mã> - <STT> - <hộp> hop <W-2> x <H-2>[ - ghi chú] - <cm/km> - <ngày>.pdf  (đúng 5 file mẫu của xưởng)
// ============================================================
function dcDanTagBdTimCap(doc) {
  var fronts = {},
    backs = {},
    pairs = [],
    i,
    t;
  for (i = 0; i < doc.artboards.length; i++) {
    t = dcDanTagBdDocTen(doc.artboards[i].name);
    if (!t) continue;
    var entry = { index: i, rect: doc.artboards[i].artboardRect.slice(0), bai: t.bai, k: t.k };
    if (t.mat === "truoc") fronts[t.k] = entry;
    else backs[t.k] = entry;
  }
  var ks = [],
    k;
  for (k in fronts) if (Object.prototype.hasOwnProperty.call(fronts, k)) ks.push(parseInt(k, 10));
  ks.sort(function (a, b) {
    return a - b;
  });
  for (i = 0; i < ks.length; i++) {
    k = ks[i];
    if (!backs[k]) throw new Error("Khối TagBD " + k + " thiếu artboard mặt sau. Hãy dàn lại khối này.");
    pairs.push({ k: k, bai: fronts[k].bai, front: fronts[k].rect, back: backs[k].rect });
  }
  return pairs;
}

function dcDanTagBdXuatPdf(optionsText) {
  var originalCoordinates = null,
    restoreCoordinates = false,
    doc = null;
  try {
    if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
    try {
      originalCoordinates = app.coordinateSystem;
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      restoreCoordinates = true;
    } catch (coordinateError) {}
    doc = app.activeDocument;
    var MM = DC_TAGBD_MM,
      EPS = 0.01;
    var o = dcDanTagBdJSON.parse(String(optionsText || "{}")) || {};
    function text(v, dflt) {
      v = v === undefined || v === null ? "" : String(v).replace(/^\s+|\s+$/g, "");
      return v === "" ? dflt : v;
    }
    var prefix = text(o.prefix, "1088");
    var startText = text(o.start, "1");
    if (!/^\d+$/.test(startText)) return "ERR: STT bắt đầu phải là số nguyên từ 0 trở lên.";
    var startN = parseInt(startText, 10);
    var padText = text(o.pad, "0");
    if (!/^\d+$/.test(padText)) return "ERR: Số đệm phải là số nguyên từ 0 đến 8.";
    var padN = parseInt(padText, 10);
    if (padN > 8) return "ERR: Số đệm tối đa là 8.";
    var canMang = text(o.canMang, "cm");
    var ngay = text(o.ngay, "");
    var note = text(o.note, "");
    var notePart = note !== "" ? " - " + note : "";

    var pairs = dcDanTagBdTimCap(doc);
    if (!pairs.length) return "ERR: Chưa có khối TagBD nào trong tài liệu. Hãy bấm Dàn tag trước.";

    // ---------- Thư mục ----------
    function resolveFolder(p) {
      if (!p) return null;
      p = String(p);
      var cands = [p, p.replace(/\\/g, "/")];
      try {
        cands.push(decodeURI(p));
      } catch (decodeError) {}
      for (var i = 0; i < cands.length; i++) {
        var f = new Folder(cands[i]);
        if (f.exists) return f;
      }
      return null;
    }
    var folderText = text(o.folder, ""),
      folder = null;
    if (folderText !== "") folder = resolveFolder(folderText);
    if (!folder) {
      if (typeof dcChonThuMucLuuPDF === "function") folder = dcChonThuMucLuuPDF(folderText !== "" ? "Không mở được thư mục đã nhập. Chọn lại" : "Chọn nơi lưu PDF tag");
      if (!folder) return folderText !== "" ? "ERR: Thư mục lưu không mở được: " + folderText + '\nHãy bấm "Chọn…" để chọn đúng thư mục.' : "ERR: Chưa chọn thư mục lưu — đã huỷ.";
    }

    // ---------- Tên file: kiểm trùng + đã tồn tại trước khi lưu ----------
    function pad0(n, width) {
      var s = String(n);
      while (s.length < width) s = "0" + s;
      return s;
    }
    function sanitize(s) {
      return String(s)
        .replace(/[\\\/:*?"<>|]/g, "-")
        .replace(/\s+$/g, "");
    }
    var jobs = [],
      seen = {},
      i;
    for (i = 0; i < pairs.length; i++) {
      var pr = pairs[i],
        stt = startN + i,
        wMm = (pr.front[2] - pr.front[0]) / MM,
        hMm = (pr.front[1] - pr.front[3]) / MM;
      var name = sanitize(
        prefix +
          " - " +
          (padN > 0 ? pad0(stt, padN) : String(stt)) +
          " - " +
          (pr.bai === 500 ? 5 : 10) +
          " hop " +
          dcDanTagBdSoKho(wMm) +
          " x " +
          dcDanTagBdSoKho(hMm) +
          notePart +
          " - " +
          canMang +
          " - " +
          ngay +
          ".pdf",
      );
      var path = folder.fsName + "/" + name,
        key = path.toLowerCase();
      if (name.length > 220 || path.length > 245) return "ERR: Tên hoặc đường dẫn PDF quá dài ở khối " + pr.k + ". Hãy rút gọn ghi chú hoặc chọn thư mục ngắn hơn.";
      if (seen[key]) return "ERR: Có hai file trùng tên: " + name + ". Hãy đổi STT, ghi chú hoặc dàn lại.";
      if (new File(path).exists) return "ERR: File đã tồn tại: " + name + ". Xuất PDF dừng để không ghi đè file cũ.";
      seen[key] = true;
      jobs.push({ pair: pr, name: name, path: path, stt: stt });
    }

    // ---------- Object của từng mặt: mọi object cấp cao nhất đang hiện giao với artboard ----------
    function intersects(b, r) {
      return b[2] > r[0] + EPS && b[0] < r[2] - EPS && b[1] > r[3] + EPS && b[3] < r[1] - EPS;
    }
    function collectLayer(layer, rect, out) {
      try {
        if (layer.visible === false) return;
        if (layer.printable === false) return;
      } catch (layerStateError) {}
      var items = null,
        count = 0,
        i;
      try {
        items = layer.pageItems;
        count = items.length;
      } catch (itemsError) {
        items = null;
      }
      for (i = 0; i < count; i++) {
        var it = items[i],
          b = null;
        try {
          if (it.parent !== layer || it.hidden === true) continue;
          if (it.typename === "GroupItem" && it.pageItems.length === 0) continue;
          b = it.geometricBounds;
        } catch (itemError) {
          continue;
        }
        if (b && intersects(b, rect)) out.push({ item: it, bounds: [b[0], b[1], b[2], b[3]] });
      }
      var subCount = 0;
      try {
        subCount = layer.layers.length;
      } catch (subError) {}
      for (i = 0; i < subCount; i++) collectLayer(layer.layers[i], rect, out);
    }
    function itemsFor(rect) {
      var out = [],
        li;
      for (li = 0; li < doc.layers.length; li++) collectLayer(doc.layers[li], rect, out);
      return out;
    }
    function makePdfOptions() {
      var opt = new PDFSaveOptions();
      try {
        opt.compatibility = PDFCompatibility.ACROBAT5;
      } catch (e1) {}
      try {
        opt.generateThumbnails = false;
      } catch (e2) {}
      try {
        opt.preserveEditability = false;
      } catch (e3) {}
      try {
        opt.optimization = true;
      } catch (e4) {}
      try {
        opt.viewAfterSaving = false;
      } catch (e5) {}
      try {
        opt.saveMultipleArtboards = true;
      } catch (e6) {}
      return opt;
    }
    // Chép một mặt sang tài liệu tạm theo cách Auto Save: KHÔNG ép toạ độ tuyệt đối của tài liệu nguồn.
    // Bản sao đầu rơi đâu thì cả mặt dời theo đó (giữ vị trí tương đối giữa các object), artboard
    // của mặt = khung nguồn + đúng độ dời ấy. `want` (nếu có) là độ dời bắt buộc (mặt sau đặt cạnh mặt trước).
    function copyFace(entries, tmp, lay, faceRect, want) {
      var delta = want || null;
      for (var i = 0; i < entries.length; i++) {
        app.activeDocument = doc;
        var dup = entries[i].item.duplicate(lay, ElementPlacement.PLACEATEND);
        app.activeDocument = tmp;
        var after = dup.geometricBounds;
        if (!delta) delta = [after[0] - entries[i].bounds[0], after[1] - entries[i].bounds[1]];
        var dx = entries[i].bounds[0] + delta[0] - after[0],
          dy = entries[i].bounds[1] + delta[1] - after[1];
        if (Math.abs(dx) > EPS || Math.abs(dy) > EPS) dup.translate(dx, dy);
      }
      if (!delta) delta = [0, 0];
      return [faceRect[0] + delta[0], faceRect[1] + delta[1], faceRect[2] + delta[0], faceRect[3] + delta[1]];
    }
    function exportPair(job) {
      var tmp = null,
        completed = false,
        frontItems = itemsFor(job.pair.front),
        backItems = itemsFor(job.pair.back);
      if (!frontItems.length) throw new Error("Artboard mặt trước của khối " + job.pair.k + " trống.");
      try {
        tmp = app.documents.add(DocumentColorSpace.CMYK);
        var lay = tmp.layers[0];
        var frontTmp = copyFace(frontItems, tmp, lay, job.pair.front, null);
        // Trang 2 nằm bên phải trang 1, cách 20 mm, cùng mép trên (như Auto Save).
        var wantBack = [frontTmp[2] + 20 * MM - job.pair.back[0], frontTmp[1] - job.pair.back[1]];
        var backTmp = copyFace(backItems, tmp, lay, job.pair.back, wantBack);
        app.activeDocument = tmp;
        tmp.artboards[0].artboardRect = frontTmp;
        tmp.artboards.add(backTmp);
        tmp.saveAs(new File(job.path), makePdfOptions());
        completed = true;
      } finally {
        try {
          if (tmp) tmp.close(SaveOptions.DONOTSAVECHANGES);
        } catch (closeError) {}
        if (!completed) {
          try {
            var incomplete = new File(job.path);
            if (incomplete.exists) incomplete.remove();
          } catch (removeError) {}
        }
      }
    }

    var done = 0,
      errs = [];
    for (i = 0; i < jobs.length; i++) {
      try {
        exportPair(jobs[i]);
        done++;
      } catch (exportError) {
        errs.push("Khối " + jobs[i].pair.k + " (" + jobs[i].name + "): " + dcDanTagBdMoTaLoi(exportError));
      }
    }
    try {
      app.activeDocument = doc;
    } catch (backError) {}
    if (!errs.length) return "OK: Đã lưu " + done + "/" + jobs.length + " file PDF (mỗi khối 2 trang trước/sau).\nThư mục: " + folder.fsName;
    return (done > 0 ? "OK: " : "ERR: ") + "Lưu được " + done + "/" + jobs.length + " file.\nLỗi:\n- " + errs.join("\n- ") + "\nThư mục: " + folder.fsName;
  } catch (e) {
    try {
      if (doc) app.activeDocument = doc;
    } catch (restoreDocError) {}
    return "ERR: " + dcDanTagBdMoTaLoi(e);
  } finally {
    if (restoreCoordinates) {
      try {
        app.coordinateSystem = originalCoordinates;
      } catch (restoreError) {}
    }
  }
}
