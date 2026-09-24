// ============================================================
//  Dàn card đa kích thước - Adobe Illustrator ExtendScript
//  Tác giả: LỘC (Code dạo) / Lần Tồn
//
//  Hỗ trợ nhiều loại card, chọn khi chạy:
//    - 9.2 x 5.6 : 20 chỗ (12 dọc + 6 phải + 2 dưới)
//                  số mẫu: 1,2,4,5,10,20
//    - 8.7 x 5.5 : 22 chỗ (18 ngang + 4 dọc)
//                  số mẫu: 1,2,11,22
//    - 15.2 x 7.2 (voucher) : 8 chỗ. Khi chọn sẽ hỏi thêm
//                  "có ghép card 9.2x5.6?":
//                    KHÔNG -> 8 voucher ngang (2 cột x 4 hàng)
//                    CÓ    -> 8 voucher ngang + 3 card 9.2x5.6 dải dưới
//                  (selection lẫn lộn, tool tự đo phân loại)
//    (Thêm loại mới: khai báo trong LAYOUTS bên dưới)
//
//  Chọn (n mẫu x 2) object: mỗi hàng [trước][sau].
//  Tự clip + Expand Appearance. Mặt trước->AB1, mặt sau->AB2 (đối xứng).
//  Loại in: In nhanh / Cardoffset (thêm dòng ghi chú).
// ============================================================

// ============================================================
//  HÀM CHÍNH cho CEP: dcDan(layoutKey, voucherWithCard)
//  - layoutKey: key loại card (vd "9.2x5.6", "voucher15.2x7.2"...)
//  - voucherWithCard: true nếu voucher ghép card 9.2x5.6
//  Trả về chuỗi kết quả để panel hiện. Bắt đầu bằng "OK:" nếu thành công,
//  "ERR:" nếu lỗi/hủy.
// ============================================================

// ============================================================
//  Dịch lỗi ExtendScript sang tiếng Việt dễ hiểu.
//  Dùng: catch (e) { return "ERR: " + dcMoTaLoi(e); }
// ============================================================
function dcMoTaLoi(e) {
  var num = -1,
    msg = "";
  try {
    num = e.number;
  } catch (x) {}
  try {
    msg = e.toString();
  } catch (x) {}
  var line = "";
  try {
    if (e.line) line = " (dòng " + e.line + ")";
  } catch (x) {}

  var giaiThich = {
    45: "Đối tượng không hợp lệ — có object đã bị xóa hoặc thay đổi trong lúc xử lý. Thử chọn lại object và chạy lại.",
    21: "Giá trị nằm ngoài phạm vi cho phép.",
    1200: "Lỗi thao tác trên đối tượng đồ họa (có thể do object bị khóa/ẩn hoặc đã xóa).",
    1302: "Không có đối tượng nào được chọn phù hợp.",
    9001: "Không tìm thấy file (kiểm tra đường dẫn pon).",
    8: "Không đủ bộ nhớ.",
    24: "Biến chưa được định nghĩa (lỗi lập trình).",
  };

  var moTa = giaiThich[num];
  if (moTa) return "Lỗi " + num + ": " + moTa + line;
  // không có trong bảng -> hiện thông báo gốc gọn
  return (num >= 0 ? "Lỗi " + num + ": " : "Lỗi: ") + msg + line;
}

// dcDan: wrapper bắt mọi lỗi -> trả thông báo rõ ràng cho panel.
function dcDan(SEL_LAYOUT_KEY, VOUCHER_WITH_CARD_ARG) {
  try {
    var r = _dcDanCore(SEL_LAYOUT_KEY, VOUCHER_WITH_CARD_ARG);
    // nhánh cũ có thể return undefined -> coi như xong
    if (r === undefined || r === null) return "OK: đã dàn xong.";
    return r;
  } catch (e) {
    return "ERR: " + dcMoTaLoi(e);
  }
}

// Lõi dàn card: xử lý toàn bộ (đo KT, clip, import pon, dàn, căn giữa).
function _dcDanCore(SEL_LAYOUT_KEY, VOUCHER_WITH_CARD_ARG) {
  if (app.documents.length === 0) {
    return "ERR: Chưa mở tài liệu nào.";
  }
  var doc = app.activeDocument;
  var MM = 2.834645669;
  var _DC_RESULT = "OK: đã dàn xong."; // kết quả trả về panel
  // Gom cảnh báo expand để báo 1 lần cuối (dùng chung cho mọi nhánh).
  var expandWarnings = [];

  // ============================================================
  //  HỘP CẢNH BÁO có ICON TAM GIÁC (⚠) vẽ bằng ScriptUI.
  //  Dùng thay alert() cho mọi thông báo LỖI / CẢNH BÁO.
  //  title: tiêu đề cửa sổ (mặc định "Cảnh báo").
  // ============================================================
  function warn(msg, title) {
    try {
      var w = new Window("dialog", title || "Cảnh báo");
      w.orientation = "column";
      w.alignChildren = "fill";
      w.margins = 18;
      w.spacing = 12;

      var row = w.add("group");
      row.orientation = "row";
      row.alignChildren = "top";
      row.spacing = 14;

      // --- Icon tam giác cảnh báo (vẽ bằng graphics onDraw của panel) ---
      var ico = row.add("panel");
      ico.preferredSize = [56, 56];
      ico.margins = 0;
      ico.borderStyle = "none";
      ico.onDraw = function () {
        var g = this.graphics;
        var yellow = g.newBrush(g.BrushType.SOLID_COLOR, [1, 0.75, 0, 1]);
        var black = g.newBrush(g.BrushType.SOLID_COLOR, [0.12, 0.12, 0.12, 1]);
        // Vẽ hình đa giác (dùng cho icon cảnh báo tam giác).
        function poly(pts, brush) {
          g.newPath();
          g.moveTo(pts[0][0], pts[0][1]);
          for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
          g.closePath();
          g.fillPath(brush);
        }
        var cx = 28;
        // tam giác vàng
        poly(
          [
            [cx, 6],
            [50, 50],
            [6, 50],
          ],
          yellow,
        );
        // thân dấu chấm than (hình chữ nhật hẹp, hơi thon xuống)
        poly(
          [
            [cx - 2.5, 20],
            [cx + 2.5, 20],
            [cx + 1.8, 35],
            [cx - 1.8, 35],
          ],
          black,
        );
        // chấm dưới (bát giác xấp xỉ hình tròn)
        var dcx = cx,
          dcy = 42,
          rr = 3;
        var dot = [];
        for (var a = 0; a < 8; a++) {
          var ang = (Math.PI * 2 * a) / 8;
          dot.push([dcx + rr * Math.cos(ang), dcy + rr * Math.sin(ang)]);
        }
        poly(dot, black);
      };

      // --- Nội dung text ---
      // Nếu msg có phần "*** ... ***" (cảnh báo) -> tách ra, làm NỔI BẬT.
      var mainMsg = msg,
        redMsg = null;
      var starIdx = msg.indexOf("*** ");
      if (starIdx >= 0) {
        mainMsg = msg.substring(0, starIdx).replace(/\s+$/, "");
        redMsg = msg.substring(starIdx);
      }
      var col = row.add("group");
      col.orientation = "column";
      col.alignChildren = "left";
      col.spacing = 8;
      if (mainMsg) {
        var t1 = col.add("statictext", undefined, mainMsg, { multiline: true });
        t1.preferredSize.width = 360;
      }
      if (redMsg) {
        // Bọc khung ký tự để NỔI BẬT (không phụ thuộc màu - luôn thấy).
        var boxed =
          "\u25B6\u25B6\u25B6 CHÚ Ý \u25C0\u25C0\u25C0\n" +
          redMsg.replace(/\*\*\*/g, "").replace(/^\s+|\s+$/g, "");
        var t2 = col.add("statictext", undefined, boxed, { multiline: true });
        t2.preferredSize.width = 360;
        // Thử tô ĐỎ + ĐẬM (nếu bản Illustrator hỗ trợ; không thì vẫn thấy khung).
        try {
          var g2 = t2.graphics;
          g2.foregroundColor = g2.newPen(
            g2.PenType.SOLID_COLOR,
            [0.92, 0.12, 0.12],
            1,
          );
        } catch (e) {}
        try {
          var f = t2.graphics.font;
          t2.graphics.font = ScriptUI.newFont(
            f.name,
            "BOLD",
            (f.size || 12) + 2,
          );
        } catch (e) {}
      }

      var gb = w.add("group");
      gb.alignment = "right";
      var okB = gb.add("button", undefined, "Đã hiểu", { name: "ok" });
      okB.active = true;
      w.show();
    } catch (e) {
      // Nếu ScriptUI vẽ lỗi (bản AI cũ) -> fallback alert thường có ký tự cảnh báo.
      alert("(!) " + msg);
    }
  }

  // ============================================================
  //  HỘP THÀNH CÔNG có ICON DẤU TICK (✓) vẽ bằng ScriptUI.
  //  Dùng thay alert() cho các thông báo THÀNH CÔNG.
  // ============================================================
  function okBox(msg, title) {
    try {
      var w = new Window("dialog", title || "Hoàn tất");
      w.orientation = "column";
      w.alignChildren = "fill";
      w.margins = 18;
      w.spacing = 12;

      var row = w.add("group");
      row.orientation = "row";
      row.alignChildren = "top";
      row.spacing = 14;

      var ico = row.add("panel");
      ico.preferredSize = [56, 56];
      ico.margins = 0;
      ico.borderStyle = "none";
      ico.onDraw = function () {
        var g = this.graphics;
        var green = g.newBrush(g.BrushType.SOLID_COLOR, [0.18, 0.72, 0.35, 1]);
        var white = g.newPen(g.PenType.SOLID_COLOR, [1, 1, 1, 1], 5);
        // vòng tròn xanh (đa giác 20 cạnh)
        var cx = 28,
          cy = 28,
          r = 22;
        g.newPath();
        g.moveTo(cx + r, cy);
        for (var a = 1; a <= 20; a++) {
          var ang = (Math.PI * 2 * a) / 20;
          g.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
        }
        g.closePath();
        g.fillPath(green);
        // dấu tick trắng (2 đoạn thẳng)
        g.newPath();
        g.moveTo(17, 29);
        g.lineTo(25, 37);
        g.lineTo(40, 19);
        g.strokePath(white);
      };

      var txt = row.add("statictext", undefined, msg, {
        multiline: true,
      });
      txt.preferredSize.width = 360;

      var gb = w.add("group");
      gb.alignment = "right";
      var okB = gb.add("button", undefined, "OK", { name: "ok" });
      okB.active = true;
      w.show();
    } catch (e) {
      alert(msg);
    }
  }

  // ============================================================
  //  THANH TIẾN TRÌNH (progress bar)
  //  Dùng palette window để cửa sổ không chặn thao tác script.
  //  prog.start(tổng bước, tiêu đề) -> prog.step(nhãn) -> prog.done()
  //  Nhãn từng bước giúp thấy khúc nào đứng lâu.
  // ============================================================
  var prog = (function () {
    var win = null,
      bar = null,
      txt = null,
      cur = 0,
      total = 1,
      t0 = 0;
    // Bắt đầu thanh tiến trình: đặt tổng số bước + tiêu đề.
    function start(totalSteps, title) {
      try {
        total = totalSteps > 0 ? totalSteps : 1;
        cur = 0;
        t0 = new Date().getTime();
        win = new Window("palette", title || "Đang xử lý...");
        win.orientation = "column";
        win.alignChildren = "fill";
        win.margins = 16;
        win.spacing = 8;
        win.preferredSize.width = 360;
        txt = win.add("statictext", undefined, "Bắt đầu...");
        txt.preferredSize.width = 328;
        bar = win.add("progressbar", undefined, 0, total);
        bar.preferredSize = [328, 14];
        win.show();
        win.update();
      } catch (e) {
        win = null;
      }
    }
    // Tiến 1 bước, cập nhật nhãn tiến trình.
    function step(label) {
      cur++;
      try {
        if (!win) return;
        var el = ((new Date().getTime() - t0) / 1000).toFixed(1);
        txt.text =
          "(" + cur + "/" + total + ") " + (label || "") + "  [" + el + "s]";
        bar.value = cur;
        win.update();
      } catch (e) {}
    }
    // Đóng thanh tiến trình.
    function done() {
      try {
        if (win) win.close();
      } catch (e) {}
      win = null;
    }
    return { start: start, step: step, done: done };
  })();
  //  Mỗi layout gồm:
  //    name    : tên hiển thị
  //    w, h    : kích thước card (mm) - card nằm ngang (w >= h)
  //    total   : tổng số chỗ
  //    divisors: mảng số mẫu hợp lệ
  //    front(oL,oT,ctx) : hàm trả mảng slot mặt trước
  //    back(oL,oT,ctx)  : hàm trả mảng slot mặt sau (đối xứng)
  //  ctx chứa: W,H (đã nhân MM), G (khe), ROT.
  //  Đường dẫn file pon lấy từ dan_card_config.txt (key = đường dẫn),
  //  KHÔNG khai báo trong code nữa.
  // ============================================================
  var LAYOUTS = [
    {
      name: "9.2 x 5.6  (20 chỗ)",
      key: "9.2x5.6",
      w: 92,
      h: 56,
      total: 20,
      divisors: [1, 2, 4, 5, 10, 20],
      front: function (oL, oT, c) {
        var W = c.W,
          H = c.H,
          G = c.G,
          ROT = c.ROT;
        var vW = H,
          vH = W,
          leftW = 4 * vW,
          leftH = 3 * vH,
          slots = [],
          row,
          col;
        // cột phải 6 ngang
        var rL = oL + leftW + G;
        for (row = 0; row < 6; row++)
          slots.push({ cx: rL + W / 2, cy: oT - row * H - H / 2, rot: 0 });
        // khối 12 dọc, mỗi hàng PHẢI->TRÁI, xoay ROT+180
        var fRot = ROT + 180;
        for (row = 0; row < 3; row++)
          for (col = 3; col >= 0; col--)
            slots.push({
              cx: oL + col * vW + vW / 2,
              cy: oT - row * vH - vH / 2,
              rot: fRot,
            });
        // dải 2 dưới
        var botT = oT - (leftH + G);
        for (col = 0; col < 2; col++)
          slots.push({ cx: oL + col * W + W / 2, cy: botT - H / 2, rot: 0 });
        return slots;
      },
      back: function (oL, oT, c) {
        var W = c.W,
          H = c.H,
          G = c.G,
          ROT = c.ROT;
        var vW = H,
          vH = W,
          leftW = 4 * vW,
          leftH = 3 * vH,
          slots = [],
          row,
          col;
        // cột 6 ngang TRÁI
        for (row = 0; row < 6; row++)
          slots.push({ cx: oL + W / 2, cy: oT - row * H - H / 2, rot: 0 });
        // khối 12 dọc phải, xoay ROT, lấp TRÁI->PHẢI
        var bRot = ROT + 360;
        var b12 = oL + W + G;
        for (row = 0; row < 3; row++)
          for (col = 0; col < 4; col++)
            slots.push({
              cx: b12 + col * vW + vW / 2,
              cy: oT - row * vH - vH / 2,
              rot: bRot,
            });
        // dải 2 dưới-PHẢI
        var botT = oT - (leftH + G);
        var rightEdge = b12 + leftW;
        for (col = 0; col < 2; col++) {
          var Lx = rightEdge - (col + 1) * W + W / 2;
          slots.push({ cx: Lx, cy: botT - H / 2, rot: 0 });
        }
        return slots;
      },
    },
    {
      name: "9 x 5.5  (20 chỗ)",
      key: "9x5.5",
      w: 90,
      h: 55,
      total: 20,
      divisors: [1, 2, 4, 5, 10, 20],
      front: function (oL, oT, c) {
        var W = c.W,
          H = c.H,
          G = c.G,
          ROT = c.ROT;
        var vW = H,
          vH = W,
          leftW = 4 * vW,
          leftH = 3 * vH,
          slots = [],
          row,
          col;
        // cột phải 6 ngang
        var rL = oL + leftW + G;
        for (row = 0; row < 6; row++)
          slots.push({ cx: rL + W / 2, cy: oT - row * H - H / 2, rot: 0 });
        // khối 12 dọc, mỗi hàng PHẢI->TRÁI, xoay ROT+180
        var fRot = ROT + 180;
        for (row = 0; row < 3; row++)
          for (col = 3; col >= 0; col--)
            slots.push({
              cx: oL + col * vW + vW / 2,
              cy: oT - row * vH - vH / 2,
              rot: fRot,
            });
        // dải 2 dưới
        var botT = oT - (leftH + G);
        for (col = 0; col < 2; col++)
          slots.push({ cx: oL + col * W + W / 2, cy: botT - H / 2, rot: 0 });
        return slots;
      },
      back: function (oL, oT, c) {
        var W = c.W,
          H = c.H,
          G = c.G,
          ROT = c.ROT;
        var vW = H,
          vH = W,
          leftW = 4 * vW,
          leftH = 3 * vH,
          slots = [],
          row,
          col;
        // cột 6 ngang TRÁI
        for (row = 0; row < 6; row++)
          slots.push({ cx: oL + W / 2, cy: oT - row * H - H / 2, rot: 0 });
        // khối 12 dọc phải, xoay ROT, lấp TRÁI->PHẢI
        var bRot = ROT + 360;
        var b12 = oL + W + G;
        for (row = 0; row < 3; row++)
          for (col = 0; col < 4; col++)
            slots.push({
              cx: b12 + col * vW + vW / 2,
              cy: oT - row * vH - vH / 2,
              rot: bRot,
            });
        // dải 2 dưới-PHẢI
        var botT = oT - (leftH + G);
        var rightEdge = b12 + leftW;
        for (col = 0; col < 2; col++) {
          var Lx = rightEdge - (col + 1) * W + W / 2;
          slots.push({ cx: Lx, cy: botT - H / 2, rot: 0 });
        }
        return slots;
      },
    },
    {
      name: "9.2 x 5.2  (21 chỗ)",
      key: "9.2x5.2",
      w: 92,
      h: 52,
      total: 21,
      divisors: [1, 3, 7, 21],
      blockGap: 5, // khe 2 cụm = 5mm
      front: function (oL, oT, c) {
        var W = c.W,
          H = c.H,
          G = c.G,
          ROT = c.ROT;
        var vW = H,
          vH = W,
          slots = [],
          row,
          col;
        // khối 18 DỌC: 6 cột x 3 hàng, theo CỘT (trái->phải), mỗi cột trên->dưới
        for (col = 0; col < 6; col++)
          for (row = 0; row < 3; row++)
            slots.push({
              cx: oL + col * vW + vW / 2,
              cy: oT - row * vH - vH / 2,
              rot: ROT,
            });
        // dải 3 NGANG dưới, cách khối 5mm (G), căn MÉP PHẢI khối 18
        var blockW = 6 * vW; // bề rộng khối 18
        var botT = oT - (3 * vH + G);
        var rightEdge = oL + blockW; // mép phải khối 18
        for (col = 0; col < 3; col++) {
          // đặt 3 thẻ căn về phải: thẻ phải nhất sát mép phải
          var cx = rightEdge - (3 - col) * W + W / 2;
          slots.push({ cx: cx, cy: botT - H / 2, rot: 0 });
        }
        return slots;
      },
      back: function (oL, oT, c) {
        var W = c.W,
          H = c.H,
          G = c.G,
          ROT = c.ROT;
        var vW = H,
          vH = W,
          slots = [],
          row,
          col;
        // khối 18 dọc: đảo cột trái<->phải, xoay đối đầu (ROT+180)
        var bRot = ROT + 180;
        for (col = 0; col < 6; col++)
          for (row = 0; row < 3; row++) {
            var mcol = 5 - col;
            slots.push({
              cx: oL + mcol * vW + vW / 2,
              cy: oT - row * vH - vH / 2,
              rot: bRot,
            });
          }
        // dải 3 ngang dưới, đảo trái<->phải
        var botT = oT - (3 * vH + G);
        for (col = 0; col < 3; col++) {
          var mc = 2 - col;
          slots.push({ cx: oL + mc * W + W / 2, cy: botT - H / 2, rot: 0 });
        }
        return slots;
      },
    },
    {
      name: "8.7 x 5.5  (22 chỗ)",
      key: "8.7x5.5",
      w: 87,
      h: 55,
      total: 22,
      divisors: [1, 2, 11, 22],
      blockGap: 0, // khe giữa các khối = 0
      sendToBack: true, // đưa cụm xuống dưới cùng sau khi dàn
      front: function (oL, oT, c) {
        var W = c.W,
          H = c.H,
          G = c.G,
          ROT = c.ROT;
        var slots = [],
          row,
          col;
        // khối 18 ngang: 3 cột x 6 hàng, thứ tự theo CỘT trên->dưới
        for (col = 0; col < 3; col++)
          for (row = 0; row < 6; row++)
            slots.push({
              cx: oL + col * W + W / 2,
              cy: oT - row * H - H / 2,
              rot: 0,
            });
        // cột phải 4 dọc
        var rL = oL + 3 * W + G;
        for (row = 0; row < 4; row++)
          slots.push({ cx: rL + H / 2, cy: oT - row * W - W / 2, rot: ROT });
        return slots;
      },
      back: function (oL, oT, c) {
        var W = c.W,
          H = c.H,
          G = c.G,
          ROT = c.ROT;
        var slots = [],
          row,
          col;
        var bRot = ROT + 180;
        // khối 18 ngang ở PHẢI (sau cột dọc rộng H + khe G)
        // Lấp theo cột nhưng ĐẢO cột (mcol = 2-col) để khớp lưng mặt trước:
        // mặt trước cột trái->phải, mặt sau cột phải->trái.
        var blockL = oL + H + G;
        for (col = 0; col < 3; col++) {
          var mcol = 2 - col;
          for (row = 0; row < 6; row++)
            slots.push({
              cx: blockL + mcol * W + W / 2,
              cy: oT - row * H - H / 2,
              rot: 0,
            });
        }
        // cột 4 dọc ở TRÁI, xoay đối đầu
        for (row = 0; row < 4; row++)
          slots.push({ cx: oL + H / 2, cy: oT - row * W - W / 2, rot: bRot });
        return slots;
      },
    },
    {
      name: "10.2 x 15.2  (6 chỗ)",
      key: "10.2x15.2",
      w: 152,
      h: 102,
      total: 6,
      divisors: [1, 2, 3, 6],
      front: function (oL, oT, c) {
        var W = c.W,
          H = c.H,
          slots = [],
          row,
          col;
        // lưới 2 cột x 3 hàng, thẻ NGANG, thứ tự theo HÀNG trái->phải, trên->dưới
        for (row = 0; row < 3; row++)
          for (col = 0; col < 2; col++)
            slots.push({
              cx: oL + col * W + W / 2,
              cy: oT - row * H - H / 2,
              rot: 0,
            });
        return slots; // 6
      },
      back: function (oL, oT, c) {
        var W = c.W,
          H = c.H,
          slots = [],
          row,
          col;
        // đối xứng ngang: mỗi hàng đảo trái<->phải (mcol = 1-col)
        for (row = 0; row < 3; row++)
          for (col = 0; col < 2; col++) {
            var mcol = 1 - col;
            slots.push({
              cx: oL + mcol * W + W / 2,
              cy: oT - row * H - H / 2,
              rot: 0,
            });
          }
        return slots;
      },
    },
    // ----------------------------------------------------------
    //  VOUCHER 15.2 x 7.2 (152 x 72 mm)
    //  Cờ isVoucher: khi chọn loại này sẽ hiện thêm bảng phụ
    //  hỏi "có ghép card 9.2x5.6 không?".
    //   - KHÔNG card: 8 voucher NGANG (152 rộng x 72 cao), lưới 2 cột x 4 hàng.
    //                 Mặt trước: cột PHẢI 1-2-3-4 (trên->dưới), cột TRÁI 5-6-7-8.
    //                 Mặt sau : đối xứng ngang (đổi cột trái<->phải).
    //   - CÓ card   : 8 voucher NGANG + dải 3 card 9.2x5.6 (nhánh riêng bên dưới).
    // ----------------------------------------------------------
    {
      name: "15.2 x 7.2  (voucher, 8 chỗ)",
      key: "15.2x7.2",
      w: 152,
      h: 72,
      total: 8,
      divisors: [1, 2, 4, 8],
      isVoucher: true, // bật bảng phụ ghép card
      front: function (oL, oT, c) {
        // Voucher NGANG: mỗi ô rộng W(152), cao H(72). Lưới 2 cột x 4 hàng.
        // Thứ tự lấp: cột PHẢI trước (1-2-3-4 trên->dưới), rồi cột TRÁI (5-6-7-8).
        var W = c.W,
          H = c.H;
        var slots = [],
          row;
        // cột phải (col index 1)
        for (row = 0; row < 4; row++)
          slots.push({
            cx: oL + 1 * W + W / 2,
            cy: oT - row * H - H / 2,
            rot: 0,
          });
        // cột trái (col index 0)
        for (row = 0; row < 4; row++)
          slots.push({
            cx: oL + 0 * W + W / 2,
            cy: oT - row * H - H / 2,
            rot: 0,
          });
        return slots; // 8
      },
      back: function (oL, oT, c) {
        // Mặt sau đối xứng ngang: 1-2-3-4 ở cột TRÁI, 5-6-7-8 ở cột PHẢI.
        var W = c.W,
          H = c.H;
        var slots = [],
          row;
        // cột trái (col 0) cho 1-4
        for (row = 0; row < 4; row++)
          slots.push({
            cx: oL + 0 * W + W / 2,
            cy: oT - row * H - H / 2,
            rot: 0,
          });
        // cột phải (col 1) cho 5-8
        for (row = 0; row < 4; row++)
          slots.push({
            cx: oL + 1 * W + W / 2,
            cy: oT - row * H - H / 2,
            rot: 0,
          });
        return slots;
      },
    },
  ];

  // ============================================================
  //  CHỌN LOẠI CARD theo tham số (thay cho dialog ScriptUI)
  //  layoutKey khớp với LAYOUTS[i].key. Không tìm thấy -> lỗi.
  // ============================================================
  var LAYOUT = null;
  for (var li = 0; li < LAYOUTS.length; li++) {
    if (LAYOUTS[li].key === SEL_LAYOUT_KEY) {
      LAYOUT = LAYOUTS[li];
      break;
    }
  }
  if (!LAYOUT) {
    return "ERR: Không tìm thấy loại card '" + SEL_LAYOUT_KEY + "'.";
  }

  // Voucher ghép card: nhận từ tham số (thay dialog)
  var VOUCHER_WITH_CARD = LAYOUT.isVoucher && VOUCHER_WITH_CARD_ARG === true;

  // Voucher CÓ ghép card đi theo nhánh riêng rồi kết thúc.
  if (VOUCHER_WITH_CARD) {
    try {
      runVoucherWithCard();
    } catch (e) {
      var num = -1;
      try {
        num = e.number;
      } catch (x) {}
      if (num === 45 || num === 1200) {
        return "ERR: Voucher sai kích thước (cần 15.2x7.2cm).";
      }
      return "ERR: " + dcMoTaLoi(e);
    }
    return _DC_RESULT;
  }

  // ============================================================
  //  KIỂM TRA SELECTION
  // ============================================================
  var sel = doc.selection;
  if (!sel || sel.length < 1) {
    return "ERR: Chưa chọn object nào để dàn.";
  }

  // Phát hiện số cột -> quyết định in 1 mặt (1 cột) hay 2 mặt (2 cột).
  var nCols = detectColumns(sel, LAYOUT.w * MM);
  var TWO_SIDES = nCols >= 2; // >=2 cột coi là in 2 mặt

  var nModels;
  if (TWO_SIDES) {
    // 2 mặt: mỗi mẫu 2 object (trước + sau) -> số mẫu = object / 2.
    if (sel.length % 2 !== 0) {
      return (
        "ERR: In 2 mặt cần số object chẵn (mỗi mẫu 2: trước+sau). Đang chọn " +
        sel.length +
        " object lẻ."
      );
    }
    nModels = sel.length / 2;
  } else {
    // 1 mặt: mỗi object là 1 mẫu -> số mẫu = số object đang chọn.
    nModels = sel.length;
  }

  // ---- PHÁT HIỆN CON ĐÔI SỚM (layout 9.2x5.6): quy đổi slot ----
  //  Con đôi (cạnh dài ~184mm) chiếm 2 slot; con thường 1 slot.
  //  Đếm theo MẪU (2 mặt -> mỗi cặp là 1 mẫu; đo mặt trước).
  var _hasDoubleEarly = false;
  var _nDblEarly = 0;
  if (LAYOUT.key === "9.2x5.6") {
    var _stepMdl = TWO_SIDES ? 2 : 1;
    for (var _di = 0; _di < sel.length; _di += _stepMdl) {
      var _sd = visSizeMM(sel[_di]);
      var _hi = Math.max(_sd.w, _sd.h);
      if (Math.abs(_hi - 184) <= 6) {
        _hasDoubleEarly = true;
        _nDblEarly++;
      }
    }
  }

  var okDiv = false;
  for (var d = 0; d < LAYOUT.divisors.length; d++)
    if (LAYOUT.divisors[d] === nModels) okDiv = true;
  // Có con đôi -> KHÔNG kiểm tra divisor (mixed tự xử lý slot).
  //  Chỉ cần tổng slot quy đổi = con thường*1 + con đôi*2 <= 20 và khớp.
  if (_hasDoubleEarly) {
    var _nNorm = nModels - _nDblEarly;
    var _choBo = _nNorm * 1 + _nDblEarly * 2; // chỗ quy đổi 1 bộ mẫu
    // Tổng chỗ 1 bộ phải là ước của 20 (để nhân đều k lần).
    var _kFill = LAYOUT.total / _choBo;
    var _kInt = _choBo > 0 && LAYOUT.total % _choBo === 0;
    if (!_kInt) {
      return (
        "ERR: Số mẫu không đều. Chỗ quy đổi (nhỏ + đôi×2) = " +
        _choBo +
        " phải là ước của " +
        LAYOUT.total +
        " (1,2,4,5,10,20). " +
        "Chọn lại số con (đôi=2 chỗ, nhỏ=1 chỗ)."
      );
    }
    // Số slot đôi thực dùng = nĐôi × k, không quá 5.
    var _slotDbl = _nDblEarly * _kFill;
    if (_slotDbl > 5) {
      return (
        "ERR: Card đôi chiếm tối đa 5 chỗ đôi. Đang cần " +
        _slotDbl +
        " chỗ đôi (nĐôi " +
        _nDblEarly +
        " × nhân " +
        _kFill +
        ")."
      );
    }
    okDiv = true;
  }
  if (!okDiv) {
    return (
      "ERR: Số mẫu " +
      nModels +
      " không hợp lệ cho khổ này. " +
      "Cần chọn số object sao cho số mẫu là: " +
      LAYOUT.divisors.join(", ") +
      "."
    );
  }
  var perModel = _hasDoubleEarly ? 1 : LAYOUT.total / nModels;

  // ============================================================
  //  BƯỚC 2: BẢNG CẤU HÌNH
  // ============================================================
  var dlg = new Window(
    "dialog",
    "Dàn " + LAYOUT.name + " - " + nModels + " mẫu",
  );
  dlg.orientation = "column";
  dlg.alignChildren = "fill";
  dlg.margins = 16;
  dlg.spacing = 10;
  dlg.add(
    "statictext",
    undefined,
    "Số mẫu: " + nModels + "  |  Mỗi mẫu: " + perModel + " chỗ",
  );
  var g1 = dlg.add("group");
  g1.add("statictext", undefined, "Rộng thẻ (mm):");
  var inW = g1.add("edittext", undefined, "" + LAYOUT.w);
  inW.characters = 6;
  var g2 = dlg.add("group");
  g2.add("statictext", undefined, "Cao thẻ (mm):");
  var inH = g2.add("edittext", undefined, "" + LAYOUT.h);
  inH.characters = 6;
  var g3 = dlg.add("group");
  g3.add("statictext", undefined, "Khe giữa khối (mm):");
  var inG = g3.add("edittext", undefined, "2");
  inG.characters = 6;
  var pRot = dlg.add("panel", undefined, "Chiều xoay thẻ dọc");
  pRot.orientation = "row";
  pRot.margins = 10;
  var r90 = pRot.add("radiobutton", undefined, "90°");
  var rm90 = pRot.add("radiobutton", undefined, "-90°");
  r90.value = true;
  var pType = dlg.add("panel", undefined, "Loại in");
  pType.orientation = "row";
  pType.margins = 10;
  var tFast = pType.add("radiobutton", undefined, "In nhanh");
  var tOffset = pType.add("radiobutton", undefined, "Cardoffset");
  tFast.value = true;
  var gGhi = dlg.add("group");
  gGhi.add("statictext", undefined, "Ghi chú (cardoffset):");
  var inNote = gGhi.add(
    "edittext",
    undefined,
    "cardoffset - cán mờ - bỏ hộp nhựa",
  );
  inNote.characters = 30;
  var gBtn = dlg.add("group");
  gBtn.alignment = "right";
  gBtn.add("button", undefined, "Hủy", { name: "cancel" });
  gBtn.add("button", undefined, "Dàn", { name: "ok" });
  if (dlg.show() !== 1) return;

  // Ép chuỗi thành số; lỗi thì trả giá trị mặc định d.
  function num(t, d) {
    var v = parseFloat(t);
    return isNaN(v) ? d : v;
  }
  var W = num(inW.text, LAYOUT.w) * MM,
    H = num(inH.text, LAYOUT.h) * MM;
  // Nếu layout khai báo blockGap thì ép dùng số đó, bỏ qua ô nhập khe.
  var G =
    typeof LAYOUT.blockGap === "number"
      ? LAYOUT.blockGap * MM
      : num(inG.text, 2) * MM;
  var ROT = r90.value ? 90 : -90;
  var IS_OFFSET = tOffset.value;
  var NOTE_TEXT = inNote.text;
  var CTX = { W: W, H: H, G: G, ROT: ROT };

  // ============================================================
  //  HỆ THỐNG CONFIG (đường dẫn file pon)
  //  - Lần đầu: hỏi người dùng chọn file config, nhớ vị trí.
  //  - Config dạng text: mỗi dòng "key = đường dẫn"
  //      9.2x5.6 = D:/.../pon1.ai
  //  - Nếu thiếu config/dòng/file pon -> hỏi chọn file pon tay.
  // ============================================================

  // File nhớ vị trí config (lưu ở thư mục preferences người dùng)
  function memoFile() {
    return new File(Folder.userData + "/dan_card_config_path.txt");
  }
  // Đọc đường dẫn pon đã lưu (bộ nhớ tạm 1 dòng).
  function readMemo() {
    var f = memoFile();
    if (f.exists) {
      f.encoding = "UTF-8";
      f.open("r");
      var p = f.read();
      f.close();
      return (p || "").replace(/^\s+|\s+$/g, "");
    }
    return "";
  }
  // Lưu đường dẫn pon vào bộ nhớ tạm.
  function writeMemo(path) {
    var f = memoFile();
    try {
      f.encoding = "UTF-8";
      f.open("w");
      f.write(path);
      f.close();
    } catch (e) {}
  }

  // Lấy file config: dùng vị trí đã nhớ, nếu chưa có/không tồn tại -> hỏi chọn.
  // Nếu chưa có file config nào -> hỏi có muốn TẠO MỚI không.
  function getConfigFile() {
    var saved = readMemo();
    if (saved) {
      var sf = new File(saved);
      if (sf.exists) return sf;
    }
    // hỏi chọn file config có sẵn
    var chosen = File.openDialog(
      "Chọn file config (dan_card_config.txt) - Cancel để tạo mới",
      "*.txt",
    );
    if (chosen && chosen.exists) {
      writeMemo(chosen.fsName);
      return chosen;
    }
    // chưa chọn -> hỏi tạo file config mới để tự lưu đường dẫn về sau
    var wantCreate = confirm(
      "Chưa có file config.\nTạo file config mới để tool tự nhớ đường dẫn pon?",
    );
    if (wantCreate) {
      var nf = File.saveDialog(
        "Lưu file config mới (dan_card_config.txt)",
        "*.txt",
      );
      if (nf) {
        try {
          nf.encoding = "UTF-8";
          nf.open("w");
          nf.write("# Config đường dẫn file pon - Tool Dàn Card (tự sinh)\n");
          nf.close();
          writeMemo(nf.fsName);
          return nf;
        } catch (e) {}
      }
    }
    return null;
  }

  // Đọc config -> object { key: path }
  function parseConfig(cf) {
    var map = {};
    if (!cf || !cf.exists) return map;
    cf.encoding = "UTF-8";
    cf.open("r");
    var txt = cf.read();
    cf.close();
    var lines = txt.split(/\r\n|\r|\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/^\s+|\s+$/g, "");
      if (!line || line.charAt(0) === "#") continue; // bỏ dòng trống/chú thích
      var eq = line.indexOf("=");
      if (eq < 0) continue;
      var k = line.substring(0, eq).replace(/^\s+|\s+$/g, "");
      var v = line.substring(eq + 1).replace(/^\s+|\s+$/g, "");
      if (k) map[k] = v;
    }
    return map;
  }

  // Ghi/cập nhật một dòng "key = path" vào file config.
  // Nếu key đã có -> thay đường dẫn. Nếu chưa -> thêm dòng mới cuối file.
  // Trả về true nếu ghi thành công.
  function saveConfigEntry(cf, key, path) {
    if (!cf) return false;
    try {
      // đọc nội dung hiện có (nếu file tồn tại)
      var lines = [];
      if (cf.exists) {
        cf.encoding = "UTF-8";
        cf.open("r");
        var txt = cf.read();
        cf.close();
        lines = txt.split(/\r\n|\r|\n/);
      }
      // tìm dòng chứa key (bỏ qua dòng trống/chú thích) để thay
      var replaced = false;
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].replace(/^\s+|\s+$/g, "");
        if (!ln || ln.charAt(0) === "#") continue;
        var eq = ln.indexOf("=");
        if (eq < 0) continue;
        var k = ln.substring(0, eq).replace(/^\s+|\s+$/g, "");
        if (k === key) {
          lines[i] = key + " = " + path;
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        // bỏ bớt dòng trống thừa ở cuối rồi thêm dòng mới
        while (
          lines.length > 0 &&
          lines[lines.length - 1].replace(/^\s+|\s+$/g, "") === ""
        )
          lines.pop();
        lines.push(key + " = " + path);
      }
      cf.encoding = "UTF-8";
      cf.open("w");
      cf.write(lines.join("\n") + "\n");
      cf.close();
      return true;
    } catch (e) {
      return false;
    }
  }
  // Ưu tiên: config (dan_card_config.txt) -> hỏi chọn tay (+ tự lưu vào config).
  function resolvePonPath(layout) {
    // 1) thử config
    var cf = getConfigFile();
    if (cf) {
      var map = parseConfig(cf);
      var p = map[layout.key];
      if (p) {
        var pf = new File(p);
        if (pf.exists) return pf.fsName;
      }
    }
    // 2) hỏi chọn file pon tay
    var chosen = File.openDialog(
      "Chọn file pon cho " + layout.name + " (.ai)",
      "*.ai",
    );
    if (chosen && chosen.exists) {
      // Tự ghi đường dẫn vừa chọn vào config để lần sau khỏi chọn lại.
      if (cf && layout.key) {
        var saved = saveConfigEntry(cf, layout.key, chosen.fsName);
        if (saved)
          okBox(
            "Đã lưu đường dẫn pon vào config:\n" +
              layout.key +
              " = " +
              chosen.fsName +
              "\n\nLần sau sẽ tự dùng, khỏi chọn tay.",
            "Đã lưu config",
          );
      }
      return chosen.fsName;
    }
    return null;
  }

  // Mọi luồng Dàn Card dùng chung artboard của pon 9.2x5.6.
  // Pon này có thể để trắng: khi đó importPon chỉ lấy artboard, không
  // nhân bản bất kỳ object pon nào và cách dàn vẫn giữ nguyên.
  var COMMON_ARTBOARD_LAYOUT = {
    name: "artboard chung 9.2x5.6",
    key: "9.2x5.6",
  };

  // ============================================================
  //  XÓA ARTBOARD 2 + NỘI DUNG (dùng khi in 1 mặt)
  //  Xóa mọi object có tâm nằm trong vùng AB index 1 (pon thừa của
  //  trang 2), rồi xóa artboard đó. Chỉ giữ lại AB1 để dàn 1 mặt.
  // ============================================================
  function removeSecondArtboard(d) {
    if (!d || d.artboards.length < 2) return;
    var rc = d.artboards[1].artboardRect; // [l, t, r, b]
    var L = rc[0],
      T = rc[1],
      R = rc[2],
      B = rc[3];
    // xóa object có tâm trong vùng AB2
    var toRemove = [];
    for (var li = 0; li < d.layers.length; li++) {
      var lay = d.layers[li];
      var locked = false,
        hid = false;
      try {
        locked = lay.locked;
        hid = !lay.visible;
      } catch (e) {}
      if (locked || hid) continue;
      var pit = lay.pageItems;
      for (var p = 0; p < pit.length; p++) {
        var it = pit[p];
        var isL = false,
          isH = false;
        try {
          isL = it.locked;
          isH = it.hidden;
        } catch (e) {}
        if (isL || isH) continue;
        var gb;
        try {
          gb = it.geometricBounds;
        } catch (e) {
          continue;
        }
        var cx = (gb[0] + gb[2]) / 2,
          cy = (gb[1] + gb[3]) / 2;
        if (cx >= L && cx <= R && cy <= T && cy >= B) toRemove.push(it);
      }
    }
    for (var r = 0; r < toRemove.length; r++) {
      try {
        toRemove[r].remove();
      } catch (e) {}
    }
    // xóa artboard index 1
    try {
      d.artboards.remove(1);
    } catch (e) {}
  }

  // ============================================================
  //  PHÁT HIỆN SỐ CỘT (1 hay 2) TỪ PHÂN BỐ X CỦA SELECTION
  //  Gom tâm X của các object thành nhóm. 1 nhóm -> 1 cột (in 1 mặt),
  //  2 nhóm -> 2 cột (in 2 mặt). Ngưỡng gom: nửa bề rộng 1 card.
  //  Trả về số nhóm cột (1, 2, hoặc nhiều hơn nếu bố trí lạ).
  // ============================================================
  function detectColumns(selection, cardWmm) {
    var xs = [];
    for (var i = 0; i < selection.length; i++) {
      var c = cbC(selection[i]);
      xs.push(c[0]);
    }
    xs.sort(function (a, b) {
      return a - b;
    });
    // ngưỡng: 2 object cùng cột nếu X cách nhau < 0.5 * bề rộng card.
    var thr = 0.5 * cardWmm;
    var groups = 1;
    for (var j = 1; j < xs.length; j++) {
      if (xs[j] - xs[j - 1] > thr) groups++;
    }
    return groups;
  }

  // ============================================================
  //  ĐẢM BẢO ĐỦ 2 ARTBOARD
  //  Nếu file chỉ có 1 artboard -> tạo thêm artboard thứ 2 bằng cách
  //  nhân bản AB1 và đặt ngay bên phải (cách 10mm). Nếu 0 artboard thì
  //  không làm gì (trường hợp cực hiếm).
  // ============================================================
  function ensureTwoArtboards(d) {
    if (!d || d.artboards.length >= 2) return;
    if (d.artboards.length === 0) return;
    var r = d.artboards[0].artboardRect; // [l, t, r, b]
    var w = r[2] - r[0];
    var gap = 10 * MM;
    // artboard 2 đặt bên phải AB1
    var nl = r[2] + gap;
    var nr = nl + w;
    try {
      d.artboards.add([nl, r[1], nr, r[3]]);
    } catch (e) {}
  }

  // ============================================================
  //  XÓA OBJECT TRONG ARTBOARD CŨ
  //  Xóa mọi top-level pageItem có TÂM nằm trong vùng bao của các
  //  artboard hiện có, TRỪ những object trong protectList (các object
  //  mẻ mới dùng để dàn). Mọi thứ ngoài vùng artboard được giữ nguyên.
  // ============================================================
  function clearOldArtboardContent(d, protectList) {
    if (!d || d.artboards.length === 0) return;
    var L = 1e12,
      T = -1e12,
      R = -1e12,
      B = 1e12;
    for (var a = 0; a < d.artboards.length; a++) {
      var rc = d.artboards[a].artboardRect; // [l, t, r, b]
      if (rc[0] < L) L = rc[0];
      if (rc[1] > T) T = rc[1];
      if (rc[2] > R) R = rc[2];
      if (rc[3] < B) B = rc[3];
    }
    // Kiểm object có nằm trong danh sách được bảo vệ (không xóa) không.
    function isProtected(it) {
      if (!protectList || protectList.length === 0) return false;
      for (var s = 0; s < protectList.length; s++)
        if (protectList[s] === it) return true;
      return false;
    }
    var toRemove = [];
    for (var li = 0; li < d.layers.length; li++) {
      var lay = d.layers[li];
      var locked = false,
        hid = false;
      try {
        locked = lay.locked;
        hid = !lay.visible;
      } catch (e) {}
      if (locked || hid) continue; // bỏ layer khóa/ẩn
      var pit = lay.pageItems;
      for (var p = 0; p < pit.length; p++) {
        var it = pit[p];
        if (isProtected(it)) continue; // giữ object mẻ mới
        var isLocked = false,
          isHidden = false;
        try {
          isLocked = it.locked;
          isHidden = it.hidden;
        } catch (e) {}
        if (isLocked || isHidden) continue;
        var gb;
        try {
          gb = it.geometricBounds;
        } catch (e) {
          continue;
        }
        var cx = (gb[0] + gb[2]) / 2,
          cy = (gb[1] + gb[3]) / 2;
        if (cx >= L && cx <= R && cy <= T && cy >= B) toRemove.push(it);
      }
    }
    for (var r = 0; r < toRemove.length; r++) {
      try {
        toRemove[r].remove();
      } catch (e) {}
    }
  }

  // ============================================================
  //  IMPORT ARTBOARD + PON TỪ FILE PON
  //  Mở file pon -> tạo artboard giống hệt trong file gốc + duplicate pon
  //  -> xóa artboard cũ. Nếu không có ponFile hoặc lỗi -> bỏ qua, dùng
  //  artboard sẵn có.
  // ============================================================
  function importPon(ponPath) {
    if (!ponPath) return doc; // không cấu hình -> giữ nguyên artboard hiện tại
    var pf = new File(ponPath);
    if (!pf.exists) {
      warn(
        "Không tìm thấy file pon:\n" +
          ponPath +
          "\n\n" +
          "Sẽ dùng artboard sẵn có của file hiện tại.",
      );
      return doc;
    }

    var destDoc = doc;
    var destName = destDoc.name; // lưu tên để tìm lại sau
    var oldAbCount = destDoc.artboards.length;

    // ===== TĂNG TỐC: tắt cảnh báo + giảm redraw khi mở/đóng pon =====
    // app.open/close là khúc nặng nhất. Tắt hộp cảnh báo và hạn chế
    // Illustrator vẽ lại màn hình trong lúc thao tác để nhanh hơn.
    var _oldUIL = app.userInteractionLevel;
    try {
      app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    } catch (e) {}

    var resultDoc = destDoc;
    try {
      resultDoc = importPonCore(pf, destDoc, destName, oldAbCount);
    } finally {
      // khôi phục mức tương tác
      try {
        app.userInteractionLevel = _oldUIL;
      } catch (e) {}
    }
    return resultDoc;
  }

  // Phần lõi của importPon.
  function importPonCore(pf, destDoc, destName, oldAbCount) {
    // mở file pon
    var ponDoc = app.open(pf);
    app.activeDocument = ponDoc;

    // Lưu tọa độ artboard pon
    var abRects = [];
    for (var a = 0; a < ponDoc.artboards.length; a++) {
      abRects.push(ponDoc.artboards[a].artboardRect.slice(0));
    }

    // Chuyển active về document gốc để duplicate an toàn.
    app.activeDocument = destDoc;
    var destLayer = destDoc.activeLayer;

    // ===== TỐI ƯU (cách 1): thay vì duplicate TỪNG object (chậm ~0.4s/cái),
    // ===== Group pon rồi duplicate 1 lần (nhanh hơn duplicate từng cái) =====
    var dupped = [];
    var ponTopItems = [];
    for (var i = 0; i < ponDoc.pageItems.length; i++)
      ponTopItems.push(ponDoc.pageItems[i]);

    if (ponTopItems.length === 0) {
      // pon rỗng
    } else if (ponTopItems.length === 1) {
      try {
        dupped.push(
          ponTopItems[0].duplicate(destLayer, ElementPlacement.PLACEATEND),
        );
      } catch (e) {}
    } else {
      // group mọi object pon -> duplicate group 1 lần -> ungroup ở card
      app.activeDocument = ponDoc;
      var ponGroup = ponDoc.groupItems.add();
      for (i = ponTopItems.length - 1; i >= 0; i--) {
        try {
          ponTopItems[i].move(ponGroup, ElementPlacement.PLACEATBEGINNING);
        } catch (e) {}
      }
      var destGroup = null;
      try {
        destGroup = ponGroup.duplicate(destLayer, ElementPlacement.PLACEATEND);
      } catch (e) {}
      // ungroup ở card (pon đóng ngay sau, không cần trả lại)
      app.activeDocument = destDoc;
      if (destGroup) {
        for (i = destGroup.pageItems.length - 1; i >= 0; i--) {
          try {
            var child = destGroup.pageItems[i];
            child.move(destLayer, ElementPlacement.PLACEATEND);
            dupped.push(child);
          } catch (e) {}
        }
        try {
          destGroup.remove();
        } catch (e) {}
      }
    }

    // đóng file pon (không lưu) - app.open lại nhanh (~0.5s) nên không giữ mở
    try {
      app.activeDocument = ponDoc;
      ponDoc.close(SaveOptions.DONOTSAVECHANGES);
    } catch (e) {}

    // lấy lại document gốc theo tên (phòng tham chiếu stale)
    var dd = null;
    for (i = 0; i < app.documents.length; i++) {
      if (app.documents[i].name === destName) {
        dd = app.documents[i];
        break;
      }
    }
    if (dd) {
      destDoc = dd;
      app.activeDocument = destDoc;
    }

    // Nếu file pon không có artboard -> giữ nguyên, không xóa gì
    if (abRects.length === 0) return destDoc;

    // Tạo artboard mới theo abRects
    for (a = 0; a < abRects.length; a++) {
      destDoc.artboards.add(abRects[a]);
    }
    // Xóa artboard CŨ (các artboard index 0..oldAbCount-1)
    if (destDoc.artboards.length > abRects.length) {
      for (a = oldAbCount - 1; a >= 0; a--) {
        try {
          destDoc.artboards.remove(a);
        } catch (e) {}
      }
    }

    // ===== BÙ CHÊNH LỆCH RULER ORIGIN =====
    // Pon duplicate giữ tọa độ theo file pon; artboard add theo abRects.
    // Nếu 2 file khác ruler origin -> pon lệch so với artboard. Dịch pon cho khớp.
    if (dupped.length > 0) {
      var wl = 1e12,
        wt = -1e12,
        wr = -1e12,
        wb = 1e12;
      for (a = 0; a < abRects.length; a++) {
        var rr = abRects[a];
        if (rr[0] < wl) wl = rr[0];
        if (rr[1] > wt) wt = rr[1];
        if (rr[2] > wr) wr = rr[2];
        if (rr[3] < wb) wb = rr[3];
      }
      var wantCx = (wl + wr) / 2,
        wantCy = (wt + wb) / 2;
      var pl = 1e12,
        pt = -1e12,
        pr = -1e12,
        pb = 1e12;
      for (i = 0; i < dupped.length; i++) {
        var gb2 = dupped[i].geometricBounds;
        if (gb2[0] < pl) pl = gb2[0];
        if (gb2[1] > pt) pt = gb2[1];
        if (gb2[2] > pr) pr = gb2[2];
        if (gb2[3] < pb) pb = gb2[3];
      }
      var ponCx = (pl + pr) / 2,
        ponCy = (pt + pb) / 2;
      var dx = wantCx - ponCx,
        dy = wantCy - ponCy;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        for (i = 0; i < dupped.length; i++) {
          try {
            dupped[i].translate(dx, dy);
          } catch (e) {}
        }
      }
    }

    return destDoc;
  }

  // (importPon sẽ được gọi sau khi tạo xong models — xem bên dưới)

  // ============================================================
  //  HÀM DÙNG CHUNG
  // ============================================================
  function clipBounds(item) {
    // visibleUnion = nội dung thật (đã giao clip mask, bỏ mask thừa).
    // Dùng cho ghép cặp (theo Y) và căn giữa cụm.
    var acc = { val: null };
    visibleUnion(item, acc);
    if (acc.val) return acc.val;
    try {
      return item.visibleBounds;
    } catch (e) {}
    return item.geometricBounds;
  }
  // Trả về tâm (center) của object theo clip bounds.
  function cbC(item) {
    var g = clipBounds(item);
    return [(g[0] + g[2]) / 2, (g[1] + g[3]) / 2];
  }

  // Đo kích thước bằng visibleUnion (nội dung thật, đã giao clip mask,
  // bỏ mask thừa). Đây là cách đo dùng cho kiểm tra + clip.
  function visSizeMM(item) {
    var acc = { val: null };
    visibleUnion(item, acc);
    var g = acc.val;
    if (!g) {
      try {
        g = item.visibleBounds;
      } catch (e) {
        try {
          g = item.geometricBounds;
        } catch (e2) {
          g = null;
        }
      }
    }
    if (!g) return { w: 0, h: 0, b: [0, 0, 0, 0] }; // không đo được
    return { w: (g[2] - g[0]) / MM, h: (g[1] - g[3]) / MM, b: g };
  }

  // Tìm object con (thường là ảnh/hình BACKGROUND) có kích thước khớp W×H
  // nhất bên trong item. Trả về bounds [l,t,r,b] hoặc null nếu không có
  // cái nào khớp trong dung sai.
  function findFrameBounds(item, wantWmm, wantHmm, tolMm) {
    var wHi = Math.max(wantWmm, wantHmm),
      wLo = Math.min(wantWmm, wantHmm);
    var best = null,
      bestErr = 1e9;
    function scan(it) {
      try {
        var b = it.geometricBounds;
        var w = (b[2] - b[0]) / MM,
          h = (b[1] - b[3]) / MM;
        var hi = Math.max(w, h),
          lo = Math.min(w, h);
        var err = Math.abs(hi - wHi) + Math.abs(lo - wLo);
        if (err < bestErr) {
          bestErr = err;
          best = b;
        }
      } catch (e) {}
      if (it.typename === "GroupItem") {
        try {
          for (var i = 0; i < it.pageItems.length; i++) scan(it.pageItems[i]);
        } catch (e) {}
      }
    }
    scan(item);
    if (best && bestErr <= tolMm) return best;
    return null;
  }

  // Tạo RasterizeOptions chuẩn (400ppi, trong suốt, Art Optimized, giữ spot).
  function makeRasterOptions() {
    var ro = new RasterizeOptions();
    try {
      ro.resolution = 400; // ppi
    } catch (e) {}
    try {
      ro.transparency = true; // nền trong suốt
    } catch (e) {}
    try {
      ro.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
    } catch (e) {}
    try {
      ro.convertSpotColors = false; // Preserve spot colors
    } catch (e) {}
    try {
      ro.padding = 0; // Add 0
    } catch (e) {}
    try {
      ro.clippingMask = false;
    } catch (e) {}
    return ro;
  }

  // Tự sửa object sai KT. 2 chiến lược:
  //  A) Có object con (background) khớp W×H -> rasterize theo bounds đó
  //     (cắt sạch phần tràn) -> ra đúng KT.
  //  B) KHÔNG có background -> rasterize CẢ object thành ảnh, rồi CLIP về
  //     W×H tại TÂM ARTBOARD (mốc do người dùng chọn).
  // Trả về {ok, item}. ok=false nếu cả 2 đều lỗi.
  function autoFixByBackground(item, wantWmm, wantHmm) {
    var Wmm = wantWmm * MM,
      Hmm = wantHmm * MM;

    // --- Chiến lược A: theo background ---
    var frame = findFrameBounds(item, wantWmm, wantHmm, 2.0);
    if (frame) {
      try {
        var ra = doc.rasterize(item, frame, makeRasterOptions());
        return { ok: true, item: ra };
      } catch (e) {}
    }

    // --- Chiến lược B: raster cả object rồi clip tại tâm artboard ---
    try {
      var raAll = doc.rasterize(item, undefined, makeRasterOptions());
      // tâm artboard hiện hành
      var abIdx = doc.artboards.getActiveArtboardIndex();
      var rect = doc.artboards[abIdx].artboardRect; // [l,t,r,b]
      var acx = (rect[0] + rect[2]) / 2,
        acy = (rect[1] + rect[3]) / 2;
      var lay = raAll.layer;
      // khung W×H tại tâm artboard
      var mrect = lay.pathItems.rectangle(
        acy + Hmm / 2,
        acx - Wmm / 2,
        Wmm,
        Hmm,
      );
      // di chuyển ảnh sao cho tâm ảnh trùng tâm artboard trước khi clip
      var rb = raAll.geometricBounds;
      var rcx = (rb[0] + rb[2]) / 2,
        rcy = (rb[1] + rb[3]) / 2;
      raAll.translate(acx - rcx, acy - rcy);
      var grp = lay.groupItems.add();
      mrect.move(grp, ElementPlacement.PLACEATBEGINNING);
      raAll.move(grp, ElementPlacement.PLACEATEND);
      mrect.clipping = true;
      grp.clipped = true;
      return { ok: true, item: grp };
    } catch (e) {
      return { ok: false, item: item };
    }
  }

  // Phá hiệu ứng/appearance của object (Object > Expand Appearance).
  function expandAppearance(item) {
    try {
      app.selection = null;
      item.selected = true;
      app.executeMenuCommand("expandStyle");
      var s = app.selection;
      if (s && s.length === 1) {
        var r = s[0];
        app.selection = null;
        return r;
      }
      // selection sau expand không đúng 1 -> trả item gốc, GHI LẠI để báo.
      expandWarnings.push(
        "expandStyle: selection = " +
          (s ? s.length : "null") +
          " (mong đợi 1) -> giữ object gốc chưa expand.",
      );
      app.selection = null;
    } catch (e) {
      expandWarnings.push("expandStyle lỗi: " + e);
    }
    return item;
  }

  // Tự cắt (clip) object về đúng khung chữ nhật kích thước card.
  function autoClip(item, wantWmm, wantHmm) {
    // Nếu object ĐÃ là clip group -> đã đúng khung, KHÔNG clip lại.
    try {
      if (item.typename === "GroupItem" && item.clipped)
        return expandAppearance(item);
    } catch (e) {}

    // Tâm theo nội dung thật (visibleUnion, đã giao clip mask). Đến bước
    // này object đã qua kiểm tra/flatten nên visibleUnion = đúng vùng W×H.
    var acc = { val: null };
    visibleUnion(item, acc);
    var ocx, ocy;
    if (acc.val) {
      ocx = (acc.val[0] + acc.val[2]) / 2;
      ocy = (acc.val[1] + acc.val[3]) / 2;
    } else {
      var vb;
      try {
        vb = item.visibleBounds;
      } catch (e) {
        vb = item.geometricBounds;
      }
      ocx = (vb[0] + vb[2]) / 2;
      ocy = (vb[1] + vb[3]) / 2;
    }
    var lay = item.layer;

    // Khuôn đúng hướng hiện tại của card, tâm khuôn = tâm nội dung thật.
    var clipW = wantWmm != null ? wantWmm * MM : W;
    var clipH = wantHmm != null ? wantHmm * MM : H;
    var rect = lay.pathItems.rectangle(
      ocy + clipH / 2,
      ocx - clipW / 2,
      clipW,
      clipH,
    );

    var grp = lay.groupItems.add();
    rect.move(grp, ElementPlacement.PLACEATBEGINNING);
    item.move(grp, ElementPlacement.PLACEATEND);
    rect.clipping = true;
    grp.clipped = true;
    return expandAppearance(grp);
  }

  // Card đang clip thì đo theo mask; card thường đo vùng nhìn thấy.
  function cardSizeMM(item) {
    try {
      if (item.typename === "GroupItem" && item.clipped === true) {
        var p = item.pageItems;
        for (var i = 0; i < p.length; i++) {
          try {
            if (p[i].clipping === true) {
              var mb = p[i].geometricBounds;
              return { w: (mb[2] - mb[0]) / MM, h: (mb[1] - mb[3]) / MM };
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
    return visSizeMM(item);
  }

  // Nếu object dọc còn khổ đích ngang (hoặc ngược lại), clip bằng W/H đảo
  // cho đúng hướng hiện tại, expand xong mới xoay về hướng khổ đích.
  function cardClipPlan(item, isBack, targetWmm, targetHmm) {
    var s = cardSizeMM(item);
    var currentLandscape = s && s.w >= s.h;
    var targetLandscape = targetWmm >= targetHmm;
    if (s && s.w > 0 && s.h > 0 && currentLandscape !== targetLandscape) {
      return {
        clipW: targetHmm,
        clipH: targetWmm,
        rotate: isBack ? -90 : 90,
      };
    }
    return { clipW: targetWmm, clipH: targetHmm, rotate: 0 };
  }

  function rotateAfterAutoClip(item, rotateDeg) {
    if (rotateDeg) {
      try {
        item.rotate(rotateDeg);
      } catch (e) {}
    }
    return item;
  }

  //  Tính bounds "VISIBLE THẬT" (bỏ object vô hình)
  function isVisibleLeaf(it) {
    try {
      if (it.hidden === true) return false;
      if (it.guides === true) return false;
    } catch (e) {}
    try {
      if (it.typename === "PathItem")
        return it.filled === true || it.stroked === true;
      if (it.typename === "CompoundPathItem") {
        if (it.pathItems.length > 0) {
          var p0 = it.pathItems[0];
          return p0.filled === true || p0.stroked === true;
        }
        return false;
      }
    } catch (e) {}
    return true; // text, raster, placed... coi là thấy
  }
  // Đo vùng bao THẬT của object (gộp mọi phần nhìn thấy, bỏ vùng trong suốt,
  // xử lý cả group có clip mask). Kết quả gộp vào acc.val.
  function visibleUnion(item, acc) {
    function merge(b) {
      if (!b) return;
      if (!acc.val) {
        acc.val = b.slice(0);
        return;
      }
      var a = acc.val;
      if (b[0] < a[0]) a[0] = b[0];
      if (b[1] > a[1]) a[1] = b[1];
      if (b[2] > a[2]) a[2] = b[2];
      if (b[3] < a[3]) a[3] = b[3];
    }
    // An toàn: object có thể đã bị xóa/không hợp lệ -> bỏ qua, tránh Error 45.
    var _tn;
    try {
      _tn = item.typename;
    } catch (e) {
      return;
    }
    if (_tn === "GroupItem") {
      var clipped = false;
      try {
        clipped = item.clipped;
      } catch (e) {}
      if (clipped) {
        // Tìm clip mask để lấy VÙNG GIỚI HẠN (không dùng thẳng làm kết quả,
        // vì mask có thể lớn thừa hơn nội dung thật).
        var pit = item.pageItems;
        var maskB = null;
        for (var i = 0; i < pit.length; i++) {
          var isc = false;
          try {
            isc = pit[i].clipping === true;
          } catch (e) {}
          if (isc) {
            maskB = pit[i].geometricBounds;
            break;
          }
        }
        // Đo nội dung THẬT (leaf có fill/stroke) bên trong, bỏ qua chính mask.
        var inner = { val: null };
        for (i = 0; i < pit.length; i++) {
          var isMask = false;
          try {
            isMask = pit[i].clipping === true;
          } catch (e) {}
          if (isMask) continue; // bỏ đường mask
          visibleUnion(pit[i], inner);
        }
        var res = inner.val;
        // Giao nội dung thật với vùng mask (nội dung tràn ngoài mask bị cắt).
        if (res && maskB) {
          var gx0 = Math.max(res[0], maskB[0]);
          var gy1 = Math.min(res[1], maskB[1]);
          var gx2 = Math.min(res[2], maskB[2]);
          var gy3 = Math.max(res[3], maskB[3]);
          if (gx2 > gx0 && gy1 > gy3) merge([gx0, gy1, gx2, gy3]);
          else merge(maskB); // giao rỗng -> fallback mask
        } else if (res) {
          merge(res);
        } else if (maskB) {
          merge(maskB);
        }
        return;
      }
      var pit2 = item.pageItems;
      for (var j = 0; j < pit2.length; j++) visibleUnion(pit2[j], acc);
      return;
    }
    if (isVisibleLeaf(item)) {
      try {
        merge(item.visibleBounds);
      } catch (e) {}
    }
  }

  // sắp hàng theo Y. 2 mặt: ghép cặp 2 object (trước+sau). 1 mặt: mỗi
  // object là 1 hàng độc lập.
  var items = [];
  for (var i = 0; i < sel.length; i++) {
    var c = cbC(sel[i]);
    items.push({ o: sel[i], x: c[0], y: c[1] });
  }
  items.sort(function (a, b) {
    return b.y - a.y;
  });
  var rows = [];
  if (TWO_SIDES) {
    for (i = 0; i < items.length; i += 2) {
      if (i + 1 >= items.length) {
        warn("Số object lẻ - in 2 mặt cần mỗi hàng 2 (trước+sau).");
        return;
      }
      var pair = [items[i], items[i + 1]];
      pair.sort(function (a, b) {
        return a.x - b.x;
      });
      rows.push(pair);
    }
  } else {
    // 1 mặt: mỗi object 1 hàng, chỉ có "trước".
    for (i = 0; i < items.length; i++) rows.push([items[i]]);
  }

  // Con đôi dùng riêng khổ 18.4 x 5.6; phần dàn card đôi phía dưới giữ nguyên.
  var DBL_LONG = 184,
    DBL_TOL = 6;
  function isDoubleItem(o) {
    var s = visSizeMM(o);
    var hi = Math.max(s.w, s.h);
    return Math.abs(hi - DBL_LONG) <= DBL_TOL;
  }

  // ----- KIỂM TRA KÍCH THƯỚC (dung sai +-0.5mm) -----
  // Luồng bản dàn card ok: đúng khổ chỉ clip; sai khổ mới auto-fix/raster.
  var TOL = 0.5;
  var curW = W / MM,
    curH = H / MM;
  var badInfo = [];
  for (var ri = 0; ri < rows.length; ri++) {
    for (var ci = 0; ci < rows[ri].length; ci++) {
      var it = rows[ri][ci].o;
      var itemIsDouble = isDoubleItem(it);
      var targetW = itemIsDouble ? 184 : curW;
      var targetH = itemIsDouble ? 56 : curH;
      var wantHi = Math.max(targetW, targetH),
        wantLo = Math.min(targetW, targetH);

      var isClipped = false;
      try {
        isClipped = it.typename === "GroupItem" && it.clipped;
      } catch (e) {}
      if (isClipped) continue;

      var s = visSizeMM(it);
      var hi = Math.max(s.w, s.h),
        lo = Math.min(s.w, s.h);
      if (Math.abs(hi - wantHi) <= TOL && Math.abs(lo - wantLo) <= TOL)
        continue;

      var fix = autoFixByBackground(it, targetW, targetH);
      if (fix.ok) {
        var s2 = visSizeMM(fix.item);
        var hi2 = Math.max(s2.w, s2.h),
          lo2 = Math.min(s2.w, s2.h);
        if (Math.abs(hi2 - wantHi) <= TOL && Math.abs(lo2 - wantLo) <= TOL) {
          rows[ri][ci].o = fix.item;
          continue;
        }
      }
      badInfo.push({ w: s.w, h: s.h });
    }
  }
  if (badInfo.length > 0) {
    var d0 = badInfo[0];
    return (
      "ERR: Sai kích thước. " +
      badInfo.length +
      " object không khớp khổ " +
      curW.toFixed(1) +
      "x" +
      curH.toFixed(1) +
      "cm (vd object đo được " +
      d0.w.toFixed(1) +
      "x" +
      d0.h.toFixed(1) +
      "). Đã thử tự sửa (tìm nền + rasterize) nhưng không được. " +
      "Cách sửa: chỉnh object về đúng khổ, hoặc bỏ nền thừa/object lạ."
    );
  }

  // ----- BẮT ĐẦU THANH TIẾN TRÌNH -----
  // Tổng bước ước lượng: dọn + (mỗi model 1 bước clip) + import + dàn trước
  // + (dàn sau nếu 2 mặt) + hoàn tất.
  var totalSteps = 1 + rows.length + 1 + 1 + (TWO_SIDES ? 1 : 0) + 1;
  prog.start(totalSteps, "Đang dàn " + LAYOUT.name);

  // Xóa nội dung trong 2 artboard cũ (kết quả dàn mẻ trước), giữ lại
  // các object đang chọn (sel) dù chúng ở đâu. Làm TRƯỚC khi clip vì
  // clip/expand sẽ xóa selection hiện hành.
  prog.step("Dọn nội dung artboard cũ...");
  var protectSel = [];
  for (var pi = 0; pi < sel.length; pi++) protectSel.push(sel[pi]);
  clearOldArtboardContent(doc, protectSel);

  var models = [];
  var hasDouble = false;
  for (i = 0; i < rows.length; i++) {
    prog.step("Cắt (clip) mẫu " + (i + 1) + "/" + rows.length + "...");
    var dbl = LAYOUT.key === "9.2x5.6" && isDoubleItem(rows[i][0].o);
    if (dbl) hasDouble = true;
    var targetW = dbl ? 184 : curW,
      targetH = dbl ? 56 : curH;
    var frontPlan = cardClipPlan(rows[i][0].o, false, targetW, targetH);
    var backPlan = TWO_SIDES
      ? cardClipPlan(rows[i][1].o, true, targetW, targetH)
      : null;
    if (TWO_SIDES) {
      models.push({
        front: rotateAfterAutoClip(
          autoClip(rows[i][0].o, frontPlan.clipW, frontPlan.clipH),
          frontPlan.rotate,
        ),
        back: rotateAfterAutoClip(
          autoClip(rows[i][1].o, backPlan.clipW, backPlan.clipH),
          backPlan.rotate,
        ),
        isDouble: dbl,
      });
    } else {
      models.push({
        front: rotateAfterAutoClip(
          autoClip(rows[i][0].o, frontPlan.clipW, frontPlan.clipH),
          frontPlan.rotate,
        ),
        back: null,
        isDouble: dbl,
      });
    }
  }
  if (models.length !== nModels) {
    prog.done();
    warn("Số hàng (" + models.length + ") != số mẫu.");
    return;
  }

  // Nhân bản object src, đặt tâm vào (cx,cy), xoay rotateDeg độ.
  function makeAt(src, cx, cy, rotateDeg) {
    var c = src.duplicate();
    if (rotateDeg) c.rotate(rotateDeg);
    var ctr = cbC(c);
    c.translate(cx - ctr[0], cy - ctr[1]);
    return c;
  }

  // Đổ object vào các ô (slot) của 1 mặt (trước/sau) theo bản đồ vị trí.
  function fillFace(slots, whichFace) {
    var copies = [];
    for (var m = 0; m < nModels; m++) {
      var src = whichFace === "front" ? models[m].front : models[m].back;
      var start = m * perModel;
      for (var k = 0; k < perModel; k++) {
        var s = slots[start + k];
        copies.push(makeAt(src, s.cx, s.cy, s.rot));
      }
    }
    return copies;
  }

  // ---- CON ĐÔI (layout 9.2x5.6): đổ con đôi vào slot đôi, con thường vào slot đơn ----
  //  whichFace: "front"/"back". Trả về mảng copies.
  //  Slot đôi ưu tiên: dải 2 dưới (1) -> khối 12 cột phải->trái, hàng 1+2 (4). Max 5.
  function fillFaceMixed(whichFace) {
    var c = CTX;
    var Wc = c.W,
      Hc = c.H,
      G = c.G,
      ROT = c.ROT;
    var vW = Hc,
      vH = Wc,
      leftW = 4 * vW,
      leftH = 3 * vH;
    var oL = 0,
      oT = 0;
    var isFront = whichFace === "front";
    var botT = oT - (leftH + G);

    // --- slot ĐÔI (theo mặt) ---
    var dbl = [];
    if (isFront) {
      // dải dưới: giữa 2 ô trái
      dbl.push({ cx: oL + Wc, cy: botT - Hc / 2, kind: "duoi", rot: 0 });
      // khối 12: cột phải->trái, hàng 1+2, xoay đứng như card thường (ROT+180)
      for (var col = 3; col >= 0; col--)
        dbl.push({
          cx: oL + col * vW + vW / 2,
          cy: oT - 2 * vH,
          kind: "k12",
          col: col,
          rot: ROT + 180,
        });
    } else {
      // BACK đối xứng: khối 12 nằm bên phải, dải dưới bên phải
      var b12 = oL + Wc + G;
      var rightEdge = b12 + leftW;
      // dải dưới-phải: giữa 2 ô
      dbl.push({ cx: rightEdge - Wc, cy: botT - Hc / 2, kind: "duoi", rot: 0 });
      // khối 12 back: cột trái->phải (đối xứng), hàng 1+2, xoay như card thường (ROT+360)
      for (var col2 = 0; col2 < 4; col2++)
        dbl.push({
          cx: b12 + col2 * vW + vW / 2,
          cy: oT - 2 * vH,
          kind: "k12",
          col: col2,
          rot: ROT + 360,
        });
    }

    // --- slot ĐƠN đầy đủ (đánh tag để loại ô bị con đôi chiếm) ---
    var singles = [];
    if (isFront) {
      var rL = oL + leftW + G;
      for (var r = 0; r < 6; r++)
        singles.push({
          cx: rL + Wc / 2,
          cy: oT - r * Hc - Hc / 2,
          rot: 0,
          tag: "phai" + r,
        });
      for (var row = 0; row < 3; row++)
        for (var cc = 3; cc >= 0; cc--)
          singles.push({
            cx: oL + cc * vW + vW / 2,
            cy: oT - row * vH - vH / 2,
            rot: ROT + 180,
            tag: "k12_" + row + "_" + cc,
          });
      for (var d1 = 0; d1 < 2; d1++)
        singles.push({
          cx: oL + d1 * Wc + Wc / 2,
          cy: botT - Hc / 2,
          rot: 0,
          tag: "duoi" + d1,
        });
    } else {
      for (var r2 = 0; r2 < 6; r2++)
        singles.push({
          cx: oL + Wc / 2,
          cy: oT - r2 * Hc - Hc / 2,
          rot: 0,
          tag: "phai" + r2,
        });
      var b12b = oL + Wc + G;
      for (var row2 = 0; row2 < 3; row2++)
        for (var cc2 = 0; cc2 < 4; cc2++)
          singles.push({
            cx: b12b + cc2 * vW + vW / 2,
            cy: oT - row2 * vH - vH / 2,
            rot: ROT + 360,
            tag: "k12_" + row2 + "_" + cc2,
          });
      var rEdge = b12b + leftW;
      for (var d2 = 0; d2 < 2; d2++) {
        var Lx = rEdge - (d2 + 1) * Wc + Wc / 2;
        singles.push({ cx: Lx, cy: botT - Hc / 2, rot: 0, tag: "duoi" + d2 });
      }
    }

    // tách models: đôi / thường (giữ thứ tự chọn)
    var dblModels = [],
      normModels = [];
    for (var mi = 0; mi < nModels; mi++) {
      if (models[mi].isDouble) dblModels.push(models[mi]);
      else normModels.push(models[mi]);
    }

    // Hệ số nhân k = total / (nNhỏ + nĐôi×2). Mỗi mẫu nhân k bản.
    var choBo = normModels.length * 1 + dblModels.length * 2;
    var kFill = choBo > 0 ? Math.floor(LAYOUT.total / choBo) : 1;
    if (kFill < 1) kFill = 1;

    // Số slot đôi cần = nĐôi × k. Chọn bấy nhiêu slot đôi (dải dưới -> khối 12).
    var needDbl = dblModels.length * kFill;
    if (needDbl > dbl.length) needDbl = dbl.length;

    // loại ô đơn bị slot đôi chiếm
    var blocked = {};
    for (var u = 0; u < needDbl; u++) {
      var ds = dbl[u];
      if (ds.kind === "duoi") {
        blocked["duoi0"] = true;
        blocked["duoi1"] = true;
      } else {
        blocked["k12_1_" + ds.col] = true;
        blocked["k12_2_" + ds.col] = true;
      }
    }
    var freeSingle = [];
    for (var s2 = 0; s2 < singles.length; s2++)
      if (!blocked[singles[s2].tag]) freeSingle.push(singles[s2]);

    // đặt CON ĐÔI: GOM cùng mẫu liền nhau (mẫu i lấp k slot liên tiếp).
    var copies = [];
    for (var du = 0; du < needDbl; du++) {
      var mIdx = Math.floor(du / kFill); // mẫu đổi sau mỗi k slot
      if (mIdx >= dblModels.length) mIdx = dblModels.length - 1;
      var mdl = dblModels[mIdx];
      var src = isFront ? mdl.front : mdl.back;
      var sl = dbl[du];
      copies.push(makeAt(src, sl.cx, sl.cy, sl.rot));
    }
    // đặt CON NHỎ: GOM cùng mẫu liền nhau (mẫu i lấp k ô liên tiếp).
    for (var nu = 0; nu < freeSingle.length; nu++) {
      if (normModels.length === 0) break;
      var mIdx2 = Math.floor(nu / kFill);
      if (mIdx2 >= normModels.length) mIdx2 = normModels.length - 1;
      var mdl2 = normModels[mIdx2];
      var src2 = isFront ? mdl2.front : mdl2.back;
      var fs = freeSingle[nu];
      copies.push(makeAt(src2, fs.cx, fs.cy, fs.rot));
    }
    return copies;
    return copies;
  }

  // Tính vùng bao chung của nhiều bản copy (để căn giữa cả cụm).
  function copiesClipBounds(copies) {
    var l = 1e9,
      t = -1e9,
      r = -1e9,
      b = 1e9;
    for (var i = 0; i < copies.length; i++) {
      var g = clipBounds(copies[i]);
      if (g[0] < l) l = g[0];
      if (g[1] > t) t = g[1];
      if (g[2] > r) r = g[2];
      if (g[3] < b) b = g[3];
    }
    return [l, t, r, b];
  }
  // Gom các bản copy thành group rồi căn giữa vào artboard abIndex.
  function groupAndCenter(copies, abIndex) {
    if (copies.length === 0) return null;
    var cbb = copiesClipBounds(copies);
    var ccx = (cbb[0] + cbb[2]) / 2,
      ccy = (cbb[1] + cbb[3]) / 2;
    var ab = doc.artboards[abIndex],
      rect = ab.artboardRect;
    var abCx = (rect[0] + rect[2]) / 2,
      abCy = (rect[1] + rect[3]) / 2;
    var grp = doc.groupItems.add();
    for (var i = 0; i < copies.length; i++) copies[i].moveToBeginning(grp);
    grp.translate(abCx - ccx, abCy - ccy);
    return grp;
  }

  // ============================================================
  //  CHẠY
  // ============================================================
  // Import artboard chung 9.2x5.6. Pon trắng sẽ không có object để duplicate.
  prog.step("Mở artboard chung 9.2x5.6...");
  var ponPath = resolvePonPath(COMMON_ARTBOARD_LAYOUT);
  if (ponPath) {
    var newDoc = importPon(ponPath);
    if (newDoc && newDoc.typename === "Document") doc = newDoc; // cập nhật tham chiếu
  } else {
    warn("Không có file pon -> dùng artboard sẵn có của file hiện tại.");
  }

  if (TWO_SIDES) {
    ensureTwoArtboards(doc);
  } else {
    removeSecondArtboard(doc);
  }

  var useMixed = hasDouble && LAYOUT.key === "9.2x5.6";

  prog.step("Dàn mặt trước...");
  var fCopies = useMixed
    ? fillFaceMixed("front")
    : fillFace(LAYOUT.front(0, 0, CTX), "front");
  var fGrp = groupAndCenter(fCopies, 0);
  var bGrp = null;
  if (TWO_SIDES) {
    prog.step("Dàn mặt sau...");
    var bCopies = useMixed
      ? fillFaceMixed("back")
      : fillFace(LAYOUT.back(0, 0, CTX), "back");
    bGrp = groupAndCenter(bCopies, 1);
  }

  // Đưa xuống dưới cùng (Send to Back) nếu layout yêu cầu
  if (LAYOUT.sendToBack) {
    try {
      if (fGrp) fGrp.zOrder(ZOrderMethod.SENDTOBACK);
    } catch (e) {}
    try {
      if (bGrp) bGrp.zOrder(ZOrderMethod.SENDTOBACK);
    } catch (e) {}
  }

  if (IS_OFFSET) {
    var ab = doc.artboards[0];
    var rect = ab.artboardRect;
    var abL = rect[0],
      abR = rect[2],
      abB = rect[3];
    var lay = doc.activeLayer;
    var tf = lay.textFrames.add();
    tf.contents = NOTE_TEXT;
    try {
      tf.textRange.characterAttributes.size = 14;
    } catch (e) {}
    var tb = tf.geometricBounds;
    var tw = tb[2] - tb[0],
      th = tb[1] - tb[3];
    tf.position = [(abL + abR) / 2 - tw / 2 - 30 * MM, abB + 5.5 * MM + th];
  }

  app.redraw();
  prog.step("Hoàn tất!");
  prog.done();

  var doneMsg =
    "Đã dàn xong " +
    nModels +
    " mẫu (" +
    LAYOUT.name +
    ")!\n" +
    "Mỗi mẫu " +
    perModel +
    " chỗ.\n" +
    (TWO_SIDES
      ? "In 2 mặt: mặt trước -> AB1, mặt sau -> AB2."
      : "In 1 mặt: chỉ dàn AB1.") +
    (IS_OFFSET ? "\n+ Ghi chú cardoffset." : "");
  // Ưu tiên cảnh báo SAI KÍCH THƯỚC (đo trước raster). Có thì báo đỏ, xem kỹ.
  if (badInfo.length > 0) {
    var d0 = badInfo[0];
    doneMsg +=
      "\n\n*** CẢNH BÁO: CÓ " +
      badInfo.length +
      " CON SAI KÍCH THƯỚC ***\n" +
      "(Object không khớp khổ " +
      curW.toFixed(1) +
      "×" +
      curH.toFixed(1) +
      "cm - ví dụ đo được " +
      d0.w.toFixed(1) +
      "×" +
      d0.h.toFixed(1) +
      "cm.)\n" +
      "HÃY XEM XÉT THẬT KỸ TRƯỚC KHI BẤM OK!";
    warn(doneMsg, "Xong - CÓ SAI KÍCH THƯỚC (xem kỹ!)");
  } else if (expandWarnings.length > 0) {
    doneMsg +=
      "\n\n[!] " +
      expandWarnings.length +
      " object không expand được (có thể còn hiệu ứng/appearance chưa phá):\n- " +
      expandWarnings.join("\n- ");
    warn(doneMsg, "Xong (có cảnh báo)");
  } else {
    okBox(doneMsg, "Dàn xong");
  }

  // ============================================================
  //  NHÁNH RIÊNG: VOUCHER 15.2x7.2 + GHÉP CARD 9.2x5.6
  //  - Selection lẫn cả voucher (152x72) và card (92x56), mỗi loại
  //    theo cặp [trước][sau] xếp thành hàng.
  //  - Tự đo visibleUnion từng object để phân loại theo kích thước.
  //  - Voucher: 8 chỗ NGANG (2 cột x 4 hàng). Card: 3 chỗ dải dưới.
  //  - Clip voucher theo 152x72, card theo 92x56 (2 khuôn khác nhau).
  //  - Import pon key "15.2x7.2" (file ghép), căn cả cụm vào artboard.
  // ============================================================
  function runVoucherWithCard() {
    var VW = 152,
      VH = 72, // voucher (mm)
      CW = 92,
      CH = 56; // card (mm)
    var VWmm = VW * MM,
      VHmm = VH * MM,
      CWmm = CW * MM,
      CHmm = CH * MM;

    // ----- Bảng cấu hình gọn cho voucher+card -----
    var dlg = new Window("dialog", "Dàn voucher 15.2x7.2 + card 9.2x5.6");
    dlg.orientation = "column";
    dlg.alignChildren = "fill";
    dlg.margins = 16;
    dlg.spacing = 10;
    dlg.add(
      "statictext",
      undefined,
      "Chọn: voucher (chia hết 8) + card (chia hết 3), lẫn lộn cũng được.",
    );
    var pType = dlg.add("panel", undefined, "Loại in");
    pType.orientation = "row";
    pType.margins = 10;
    var tFast = pType.add("radiobutton", undefined, "In nhanh");
    var tOffset = pType.add("radiobutton", undefined, "Cardoffset");
    tFast.value = true;
    var gGhi = dlg.add("group");
    gGhi.add("statictext", undefined, "Ghi chú (cardoffset):");
    var inNote = gGhi.add(
      "edittext",
      undefined,
      "cardoffset - cán mờ - bỏ hộp nhựa",
    );
    inNote.characters = 30;
    var gBtn = dlg.add("group");
    gBtn.alignment = "right";
    gBtn.add("button", undefined, "Hủy", { name: "cancel" });
    gBtn.add("button", undefined, "Dàn", { name: "ok" });
    if (dlg.show() !== 1) return;
    var IS_OFFSET = tOffset.value;
    var NOTE_TEXT = inNote.text;

    // ----- Kiểm tra selection -----
    var sel = doc.selection;
    if (!sel || sel.length < 2) {
      _DC_RESULT = "ERR: Chưa chọn object voucher/card.";
      return;
    }

    // ----- Đo kích thước visible thật của từng object để phân loại -----
    // Voucher ~152x72, card ~92x56. So khoảng cách tới 2 mẫu chuẩn.
    function visSize(it) {
      // Nội dung thật (visibleUnion, đã giao clip mask, bỏ mask thừa).
      var acc = { val: null };
      visibleUnion(it, acc);
      var g = acc.val;
      if (!g) {
        try {
          g = it.visibleBounds;
        } catch (e) {
          g = it.geometricBounds;
        }
      }
      return {
        w: (g[2] - g[0]) / MM,
        h: (g[1] - g[3]) / MM,
        cx: (g[0] + g[2]) / 2,
        cy: (g[1] + g[3]) / 2,
      };
    }
    // "kích thước bất kể xoay": lấy max/min để so cạnh dài/ngắn.
    function longShort(s) {
      var lo = Math.min(s.w, s.h),
        hi = Math.max(s.w, s.h);
      return { hi: hi, lo: lo };
    }
    var TOL = 0.5; // mm - dung sai kích thước
    var vouchers = [],
      cards = [],
      offSize = []; // object lệch quá 0.5mm so với loại gần nhất
    for (var i = 0; i < sel.length; i++) {
      var s = visSize(sel[i]);
      var ls = longShort(s);
      // khoảng cách tới voucher(152,72) và card(92,56)
      var dV = Math.abs(ls.hi - 152) + Math.abs(ls.lo - 72);
      var dC = Math.abs(ls.hi - 92) + Math.abs(ls.lo - 56);
      var rec = { o: sel[i], cx: s.cx, cy: s.cy };
      if (dV <= dC) {
        // gán voucher; kiểm tra sai số chặt 0.5mm
        if (Math.abs(ls.hi - 152) > TOL || Math.abs(ls.lo - 72) > TOL)
          offSize.push({
            idx: i + 1,
            w: ls.hi,
            lo: ls.lo,
            want: "voucher 152x72",
          });
        else vouchers.push(rec);
      } else {
        if (Math.abs(ls.hi - 92) > TOL || Math.abs(ls.lo - 56) > TOL)
          offSize.push({ idx: i + 1, w: ls.hi, lo: ls.lo, want: "card 92x56" });
        else cards.push(rec);
      }
    }
    if (offSize.length > 0) {
      var um =
        "Có " +
        offSize.length +
        "/" +
        sel.length +
        " object KHÔNG đúng kích thước (dung sai +-0.5mm).\n\n" +
        "Voucher cần 152x72, card cần 92x56. Kiểm tra lại object đã chọn / KT.";
      _DC_RESULT =
        "ERR: Sai kích thước. " +
        offSize.length +
        "/" +
        sel.length +
        " object không khớp (voucher cần 15.2x7.2cm, card 9.2x5.6cm). " +
        "Cách sửa: chỉnh object về đúng khổ rồi chạy lại.";
      return;
    }

    // ----- Kiểm tra số lượng: voucher chẵn & chia hết 8, card chẵn & chia hết 3 -----
    if (vouchers.length === 0) {
      _DC_RESULT = "ERR: Không thấy voucher (cần ~152x72mm).";
      return;
    }
    if (vouchers.length % 2 !== 0) {
      _DC_RESULT =
        "ERR: Số voucher lẻ (" +
        vouchers.length +
        "). In 2 mặt cần chẵn (mỗi mẫu 2: trước+sau).";
      return;
    }
    var nV = vouchers.length / 2;
    if (8 % nV !== 0) {
      _DC_RESULT =
        "ERR: Có " +
        nV +
        " mẫu voucher, không chia đều 8 chỗ. " +
        "Cần 1, 2, 4 hoặc 8 mẫu.";
      return;
    }
    var haveCard = cards.length > 0;
    var nC = 0,
      perCard = 0;
    if (haveCard) {
      if (cards.length % 2 !== 0) {
        _DC_RESULT =
          "ERR: Số card lẻ (" +
          cards.length +
          "). In 2 mặt cần chẵn (mỗi mẫu 2: trước+sau).";
        return;
      }
      nC = cards.length / 2;
      if (3 % nC !== 0) {
        _DC_RESULT =
          "ERR: Có " +
          nC +
          " mẫu card, không chia đều 3 chỗ. " +
          "Cần 1 hoặc 3 mẫu.";
        return;
      }
      perCard = 3 / nC;
    }
    var perV = 8 / nV;

    // ----- Ghép cặp trong từng nhóm theo Y, rồi trong cặp sắp X (trước=trái) -----
    function pairUp(arr) {
      arr.sort(function (a, b) {
        return b.cy - a.cy;
      });
      var out = [];
      for (var k = 0; k < arr.length; k += 2) {
        var pair = [arr[k], arr[k + 1]];
        pair.sort(function (a, b) {
          return a.cx - b.cx;
        });
        out.push(pair);
      }
      return out;
    }
    var vRows = pairUp(vouchers);
    var cRows = haveCard ? pairUp(cards) : [];

    // ----- Clip theo khuôn W x H chỉ định (phiên bản có tham số) -----
    function autoClipWH(item, Wmm, Hmm) {
      try {
        if (item.typename === "GroupItem" && item.clipped)
          return expandAppearance(item);
      } catch (e) {}
      // Tâm theo nội dung thật (visibleUnion, đã giao clip mask).
      var acc = { val: null };
      visibleUnion(item, acc);
      var ocx, ocy;
      if (acc.val) {
        ocx = (acc.val[0] + acc.val[2]) / 2;
        ocy = (acc.val[1] + acc.val[3]) / 2;
      } else {
        var vb;
        try {
          vb = item.visibleBounds;
        } catch (e) {
          vb = item.geometricBounds;
        }
        ocx = (vb[0] + vb[2]) / 2;
        ocy = (vb[1] + vb[3]) / 2;
      }
      var lay = item.layer;
      var rect = lay.pathItems.rectangle(
        ocy + Hmm / 2,
        ocx - Wmm / 2,
        Wmm,
        Hmm,
      );
      var grp = lay.groupItems.add();
      rect.move(grp, ElementPlacement.PLACEATBEGINNING);
      item.move(grp, ElementPlacement.PLACEATEND);
      rect.clipping = true;
      grp.clipped = true;
      return expandAppearance(grp);
    }

    // Xóa nội dung 2 artboard cũ (mẻ trước), giữ selection mẻ mới.
    // Làm TRƯỚC khi clip (clip/expand sẽ xóa selection).
    var protectSelV = [];
    for (var psv = 0; psv < sel.length; psv++) protectSelV.push(sel[psv]);
    clearOldArtboardContent(doc, protectSelV);

    var vModels = [];
    for (i = 0; i < vRows.length; i++)
      vModels.push({
        front: autoClipWH(vRows[i][0].o, VWmm, VHmm),
        back: autoClipWH(vRows[i][1].o, VWmm, VHmm),
      });
    var cModels = [];
    for (i = 0; i < cRows.length; i++)
      cModels.push({
        front: autoClipWH(cRows[i][0].o, CWmm, CHmm),
        back: autoClipWH(cRows[i][1].o, CWmm, CHmm),
      });

    // ----- Import artboard chung 9.2x5.6 (pon trắng, không duplicate pon) -----
    var ponPath = resolvePonPath(COMMON_ARTBOARD_LAYOUT);
    if (ponPath) {
      var newDoc = importPon(ponPath);
      if (newDoc && newDoc.typename === "Document") doc = newDoc;
    } else {
      warn("Không có file pon -> dùng artboard sẵn có của file hiện tại.");
    }

    // Đảm bảo đủ 2 artboard (tự tạo nếu thiếu).
    ensureTwoArtboards(doc);

    // ----- Bản đồ slot -----
    // Voucher NGANG (rộng 152, cao 72): 2 cột x 4 hàng.
    // Mặt trước: cột trái 1-2-3-4 (trên->dưới), cột phải 5-6-7-8.
    // Mặt sau : đối xứng ngang (đổi cột trái<->phải).
    function voucherFront(oL, oT) {
      var slots = [],
        col,
        row;
      for (col = 0; col < 2; col++)
        for (row = 0; row < 4; row++)
          slots.push({
            cx: oL + col * VWmm + VWmm / 2,
            cy: oT - row * VHmm - VHmm / 2,
            rot: 0,
          });
      return slots; // thứ tự: (c0r0,c0r1,c0r2,c0r3, c1r0..c1r3) = 1..8
    }
    // Bản đồ vị trí mặt SAU của voucher (8 chỗ).
    function voucherBack(oL, oT) {
      var slots = [],
        col,
        row;
      for (col = 0; col < 2; col++) {
        var mcol = 1 - col;
        for (row = 0; row < 4; row++)
          slots.push({
            cx: oL + mcol * VWmm + VWmm / 2,
            cy: oT - row * VHmm - VHmm / 2,
            rot: 0,
          });
      }
      return slots;
    }
    // Card dải dưới: 3 chỗ ngang. Mặt trước 1-2-3 (trái->phải),
    // mặt sau 3-2-1 (đối xứng ngang).
    function cardFront(oL, oT) {
      var slots = [];
      for (var col = 0; col < 3; col++)
        slots.push({
          cx: oL + col * CWmm + CWmm / 2,
          cy: oT - CHmm / 2,
          rot: 0,
        });
      return slots;
    }
    // Bản đồ vị trí mặt SAU của card ghép trong voucher (3 chỗ).
    function cardBack(oL, oT) {
      var slots = [];
      for (var col = 0; col < 3; col++) {
        var mcol = 2 - col;
        slots.push({
          cx: oL + mcol * CWmm + CWmm / 2,
          cy: oT - CHmm / 2,
          rot: 0,
        });
      }
      return slots;
    }

    // ----- makeAt + fill (dùng chung, mỗi nhóm models riêng) -----
    function makeAt(src, cx, cy, rotateDeg) {
      var c = src.duplicate();
      if (rotateDeg) c.rotate(rotateDeg);
      var ctr = cbC(c);
      c.translate(cx - ctr[0], cy - ctr[1]);
      return c;
    }
    // Dàn voucher + card vào CÙNG một cụm (đặt liền nhau như file mẫu:
    // khối voucher phía trên, dải card ngay dưới). Ta dựng theo toạ độ
    // tương đối rồi căn cả cụm vào tâm artboard.
    // Gốc (0,0) = góc trên-trái khối voucher.
    function buildFace(which) {
      var copies = [];
      // voucher
      var vslots = which === "front" ? voucherFront(0, 0) : voucherBack(0, 0);
      for (var m = 0; m < nV; m++) {
        var vsrc = which === "front" ? vModels[m].front : vModels[m].back;
        var vstart = m * perV;
        for (var k = 0; k < perV; k++) {
          var vs = vslots[vstart + k];
          copies.push(makeAt(vsrc, vs.cx, vs.cy, vs.rot));
        }
      }
      // card dải dưới: đặt ngay dưới khối voucher (voucher cao 4*VH).
      //  - Mặt TRƯỚC: căn mép TRÁI khối voucher (oLcard = 0).
      //  - Mặt SAU  : căn mép PHẢI khối voucher (mirror ngang để khớp lưng
      //    khi lật giấy). Dịch phải = (rộng khối voucher) - (rộng dải card).
      if (haveCard) {
        var botT = 0 - 4 * VHmm; // đáy khối voucher
        var voucherBlockW = 2 * VWmm; // khối voucher = 2 cột
        var cardStripW = 3 * CWmm; // dải card = 3 card
        var oLcard = which === "front" ? 0 : voucherBlockW - cardStripW;
        var cslots =
          which === "front" ? cardFront(oLcard, botT) : cardBack(oLcard, botT);
        for (m = 0; m < nC; m++) {
          var csrc = which === "front" ? cModels[m].front : cModels[m].back;
          var cstart = m * perCard;
          for (k = 0; k < perCard; k++) {
            var cs = cslots[cstart + k];
            copies.push(makeAt(csrc, cs.cx, cs.cy, cs.rot));
          }
        }
      }
      return copies;
    }

    // Căn giữa 1 object/group vào tâm artboard.
    function centerToAB(copies, abIndex) {
      if (copies.length === 0) return null;
      var l = 1e9,
        t = -1e9,
        r = -1e9,
        b = 1e9;
      for (var j = 0; j < copies.length; j++) {
        var g = clipBounds(copies[j]);
        if (g[0] < l) l = g[0];
        if (g[1] > t) t = g[1];
        if (g[2] > r) r = g[2];
        if (g[3] < b) b = g[3];
      }
      var ccx = (l + r) / 2,
        ccy = (t + b) / 2;
      var ab = doc.artboards[abIndex],
        rect = ab.artboardRect;
      var abCx = (rect[0] + rect[2]) / 2,
        abCy = (rect[1] + rect[3]) / 2;
      var grp = doc.groupItems.add();
      for (j = 0; j < copies.length; j++) copies[j].moveToBeginning(grp);
      grp.translate(abCx - ccx, abCy - ccy);
      return grp;
    }

    var fGrp = centerToAB(buildFace("front"), 0);
    var bGrp = centerToAB(buildFace("back"), 1);

    // ----- Cardoffset: ghi chú lên mặt trước -----
    if (IS_OFFSET) {
      var ab0 = doc.artboards[0];
      var r0 = ab0.artboardRect;
      var abL = r0[0],
        abR = r0[2],
        abB = r0[3];
      var lay = doc.activeLayer;
      var tf = lay.textFrames.add();
      tf.contents = NOTE_TEXT;
      try {
        tf.textRange.characterAttributes.size = 14;
      } catch (e) {}
      var tb = tf.geometricBounds;
      var tw = tb[2] - tb[0],
        th = tb[1] - tb[3];
      tf.position = [(abL + abR) / 2 - tw / 2 - 30 * MM, abB + 5.5 * MM + th];
    }

    app.redraw();
    var msg =
      "Đã dàn xong voucher 15.2x7.2 (" + nV + " mẫu, " + perV + " chỗ/mẫu)";
    if (haveCard)
      msg += "\n+ card 9.2x5.6 (" + nC + " mẫu, " + perCard + " chỗ/mẫu)";
    msg += "\nMặt trước -> AB1, mặt sau -> AB2.";
    if (IS_OFFSET) msg += "\n+ Ghi chú cardoffset.";
    if (expandWarnings.length > 0) {
      msg +=
        "\n\n[!] " +
        expandWarnings.length +
        " object không expand được:\n- " +
        expandWarnings.join("\n- ");
      warn(msg, "Xong (có cảnh báo)");
    } else {
      okBox(msg, "Dàn xong");
    }
  }

  // Ghi chú con đôi ra panel (chẩn đoán nhận diện 18.4cm).
  if (LAYOUT.key === "9.2x5.6") {
    if (_hasDoubleEarly) {
      _DC_RESULT =
        "OK: Đã dàn. Nhận diện " +
        _nDblEarly +
        " con đôi (18.4×5.6) + " +
        (nModels - _nDblEarly) +
        " con thường.";
    } else {
      _DC_RESULT =
        "OK: Đã dàn " + nModels + " con thường (không có con đôi 18.4).";
    }
  }

  // kết thúc dcDan: trả kết quả OK
  return _DC_RESULT;
}

// ============================================================
//  TAB DẤU CẮT: chạy độc lập với các luồng dàn hiện có.
//  Chọn từng bài, hoặc chọn group dàn mà các bài con là clipping group.
// ============================================================
function dcThemDauCatTuDong(lengthText, edgeText, gapText) {
  try {
    if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";

    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0)
      return "ERR: Chọn các bài cần tạo dấu cắt trước.";

    function parseMm(value, label, allowZero) {
      var n = parseFloat(
        String(value === undefined || value === null ? "" : value).replace(
          ",",
          ".",
        ),
      );
      if (!isFinite(n) || n < 0 || (!allowZero && n === 0))
        throw new Error(
          label + (allowZero ? " phải là số từ 0 mm." : " phải lớn hơn 0 mm."),
        );
      return n;
    }

    var MM = 2.834645669;
    var cutLength = parseMm(lengthText, "Dài nét") * MM;
    var edgeThreshold = parseMm(edgeText, "Ngưỡng mép") * MM;
    var cutGap =
      (gapText === undefined || gapText === null || gapText === ""
        ? 0
        : parseMm(gapText, "Cách bài", true)) * MM;
    var edgeEpsilon = 0.05;

    function itemBounds(item) {
      var isClipped = false;
      try {
        isClipped = item.typename === "GroupItem" && item.clipped === true;
      } catch (e) {}
      if (isClipped) {
        try {
          var children = item.pageItems;
          for (var ci = 0; ci < children.length; ci++) {
            if (children[ci].clipping === true)
              return children[ci].geometricBounds.slice(0);
          }
        } catch (e) {}
      }
      try {
        return item.visibleBounds.slice(0);
      } catch (e) {}
      try {
        return item.geometricBounds.slice(0);
      } catch (e) {}
      return null;
    }

    function isCutMarkItem(item) {
      try {
        return item.layer && item.layer.name === "Dau cat tu dong";
      } catch (e) {
        return false;
      }
    }

    // Một group dàn card thường chứa nhiều clipping group, mỗi group là 1 bài.
    // Chỉ tách kiểu group này để không tách các chi tiết của một artwork đơn lẻ.
    function collectCards(item, output) {
      if (!item || isCutMarkItem(item)) return;
      var isGroup = false,
        isClipped = false;
      try {
        isGroup = item.typename === "GroupItem";
        isClipped = item.clipped === true;
      } catch (e) {}
      if (isGroup && !isClipped) {
        var directCards = [];
        try {
          for (var i = 0; i < item.pageItems.length; i++) {
            var child = item.pageItems[i];
            if (isCutMarkItem(child)) continue;
            if (child.typename === "GroupItem" && child.clipped === true)
              directCards.push(child);
          }
        } catch (e) {}
        if (directCards.length >= 2) {
          for (var d = 0; d < directCards.length; d++)
            output.push(directCards[d]);
          return;
        }
      }
      output.push(item);
    }

    function artboardFor(bounds) {
      var cx = (bounds[0] + bounds[2]) / 2;
      var cy = (bounds[1] + bounds[3]) / 2;
      for (var ai = 0; ai < doc.artboards.length; ai++) {
        var rect = doc.artboards[ai].artboardRect;
        if (
          cx >= rect[0] &&
          cx <= rect[2] &&
          cy <= rect[1] &&
          cy >= rect[3]
        )
          return ai;
      }
      return -1;
    }

    var rawCards = [];
    for (var si = 0; si < sel.length; si++) collectCards(sel[si], rawCards);

    var cards = [];
    var skipped = 0;
    for (var ri = 0; ri < rawCards.length; ri++) {
      var bounds = itemBounds(rawCards[ri]);
      if (!bounds || bounds[2] <= bounds[0] || bounds[1] <= bounds[3]) {
        skipped++;
        continue;
      }
      var abIndex = artboardFor(bounds);
      if (abIndex < 0) {
        skipped++;
        continue;
      }
      cards.push({ bounds: bounds, abIndex: abIndex });
    }
    if (cards.length === 0)
      return "ERR: Không tìm thấy bài hợp lệ nằm trong artboard.";

    var markLayer = null;
    for (var li = 0; li < doc.layers.length; li++) {
      if (doc.layers[li].name === "Dau cat tu dong") {
        markLayer = doc.layers[li];
        break;
      }
    }
    if (!markLayer) {
      markLayer = doc.layers.add();
      markLayer.name = "Dau cat tu dong";
    }
    try {
      markLayer.locked = false;
      markLayer.visible = true;
    } catch (e) {}

    var markGroup = markLayer.groupItems.add();
    markGroup.name = "Dau cat - " + new Date().getTime();
    var cutColor = new CMYKColor();
    cutColor.cyan = 0;
    cutColor.magenta = 0;
    cutColor.yellow = 0;
    cutColor.black = 100;
    var drawn = 0;
    var drawnLines = {};

    function fitsArtboard(p1, p2, rect) {
      return (
        p1[0] >= rect[0] &&
        p1[0] <= rect[2] &&
        p2[0] >= rect[0] &&
        p2[0] <= rect[2] &&
        p1[1] >= rect[3] &&
        p1[1] <= rect[1] &&
        p2[1] >= rect[3] &&
        p2[1] <= rect[1]
      );
    }

    function overlapsCard(p1, p2, owner, allowOwner) {
      var minX = Math.min(p1[0], p2[0]);
      var maxX = Math.max(p1[0], p2[0]);
      var minY = Math.min(p1[1], p2[1]);
      var maxY = Math.max(p1[1], p2[1]);
      for (var oi = 0; oi < cards.length; oi++) {
        if (cards[oi].abIndex !== cards[owner].abIndex) continue;
        if (oi === owner && allowOwner) continue;
        var other = cards[oi].bounds;

        // Với nét hướng ra vùng trống, cạnh bài kế bên là nút cắt chung:
        // bỏ nét chạy dọc cạnh đó. Khi sát mép giấy, nét được đảo vào trong
        // thì cho phép nó trùng cạnh chung; lineKey sẽ giữ lại đúng một nét.
        if (oi !== owner) {
          var isHorizontal = Math.abs(p1[1] - p2[1]) <= edgeEpsilon;
          var isVertical = Math.abs(p1[0] - p2[0]) <= edgeEpsilon;
          var runsOnOtherEdge =
            (isHorizontal &&
              (Math.abs(p1[1] - other[1]) <= edgeEpsilon ||
                Math.abs(p1[1] - other[3]) <= edgeEpsilon) &&
              Math.min(maxX, other[2]) - Math.max(minX, other[0]) > edgeEpsilon) ||
            (isVertical &&
              (Math.abs(p1[0] - other[0]) <= edgeEpsilon ||
                Math.abs(p1[0] - other[2]) <= edgeEpsilon) &&
              Math.min(maxY, other[1]) - Math.max(minY, other[3]) > edgeEpsilon);
          if (runsOnOtherEdge) {
            if (!allowOwner) return true;
            continue;
          }
        }
        if (
          maxX > other[0] &&
          minX < other[2] &&
          maxY > other[3] &&
          minY < other[1]
        )
          return true;
      }
      return false;
    }

    function lineKey(p1, p2, abIndex) {
      var a = p1[0].toFixed(3) + "," + p1[1].toFixed(3);
      var b = p2[0].toFixed(3) + "," + p2[1].toFixed(3);
      if (a > b) {
        var swap = a;
        a = b;
        b = swap;
      }
      return abIndex + "|" + a + "|" + b;
    }

    function drawLine(p1, p2, owner, rect, allowOwner) {
      if (!fitsArtboard(p1, p2, rect)) return;
      // Nét chỉ nằm trong vùng trống. Trường hợp sát mép giấy mới cho
      // phép nét đi vào chính bài đó theo quy tắc lật vào trong.
      if (overlapsCard(p1, p2, owner, allowOwner)) return;
      var key = lineKey(p1, p2, cards[owner].abIndex);
      if (drawnLines[key]) return;
      try {
        var line = markLayer.pathItems.add();
        line.setEntirePath([p1, p2]);
        line.filled = false;
        line.stroked = true;
        line.strokeColor = cutColor;
        line.strokeWidth = 1;
        line.move(markGroup, ElementPlacement.PLACEATEND);
        drawnLines[key] = true;
        drawn++;
      } catch (e) {}
    }

    for (var ci = 0; ci < cards.length; ci++) {
      var card = cards[ci].bounds;
      var rect = doc.artboards[cards[ci].abIndex].artboardRect;
      var leftDir = card[0] - rect[0] < edgeThreshold ? 1 : -1;
      var rightDir = rect[2] - card[2] < edgeThreshold ? -1 : 1;
      var topDir = rect[1] - card[1] < edgeThreshold ? -1 : 1;
      var bottomDir = card[3] - rect[3] < edgeThreshold ? 1 : -1;
      var leftInside = leftDir > 0;
      var rightInside = rightDir < 0;
      var topInside = topDir < 0;
      var bottomInside = bottomDir > 0;

      // Nét ngang tại bốn góc.
      drawLine(
        [card[0] + leftDir * cutGap, card[1]],
        [card[0] + leftDir * (cutGap + cutLength), card[1]],
        ci,
        rect,
        leftInside,
      );
      drawLine(
        [card[2] + rightDir * cutGap, card[1]],
        [card[2] + rightDir * (cutGap + cutLength), card[1]],
        ci,
        rect,
        rightInside,
      );
      drawLine(
        [card[0] + leftDir * cutGap, card[3]],
        [card[0] + leftDir * (cutGap + cutLength), card[3]],
        ci,
        rect,
        leftInside,
      );
      drawLine(
        [card[2] + rightDir * cutGap, card[3]],
        [card[2] + rightDir * (cutGap + cutLength), card[3]],
        ci,
        rect,
        rightInside,
      );

      // Nét dọc tại bốn góc.
      drawLine(
        [card[0], card[1] + topDir * cutGap],
        [card[0], card[1] + topDir * (cutGap + cutLength)],
        ci,
        rect,
        topInside,
      );
      drawLine(
        [card[2], card[1] + topDir * cutGap],
        [card[2], card[1] + topDir * (cutGap + cutLength)],
        ci,
        rect,
        topInside,
      );
      drawLine(
        [card[0], card[3] + bottomDir * cutGap],
        [card[0], card[3] + bottomDir * (cutGap + cutLength)],
        ci,
        rect,
        bottomInside,
      );
      drawLine(
        [card[2], card[3] + bottomDir * cutGap],
        [card[2], card[3] + bottomDir * (cutGap + cutLength)],
        ci,
        rect,
        bottomInside,
      );
    }

    if (drawn === 0) {
      try {
        markGroup.remove();
      } catch (e) {}
      return "OK: Không có khoảng trống phù hợp để đặt dấu cắt.";
    }

    try {
      markLayer.zOrder(ZOrderMethod.BRINGTOFRONT);
    } catch (e) {}
    app.redraw();
    var msg =
      "OK: Đã thêm " + drawn + " nét dấu cắt cho " + cards.length + " bài.";
    if (skipped > 0) msg += " Bỏ qua " + skipped + " object ngoài artboard.";
    return msg;
  } catch (e) {
    return "ERR: " + e.toString();
  }
}

// ============================================================
//  HÀM TEST kết nối (Bước 1) — giữ lại để panel kiểm tra.
// ============================================================
function dcTestConnection() {
  try {
    var n = app.documents.length;
    var docName = n > 0 ? app.activeDocument.name : "(chưa mở tài liệu)";
    return (
      "Kết nối OK!\n" +
      "Illustrator " +
      app.version +
      "\n" +
      "Đang mở: " +
      n +
      " tài liệu\n" +
      "Hiện hành: " +
      docName
    );
  } catch (e) {
    return "Lỗi: " + e.toString();
  }
}

// Dự phòng cho việc gọi trực tiếp từ ExtendScript.
// Nút Raster trên panel chạy cùng logic nhưng không phụ thuộc vào JSX đang cache.
function dcRasterizeSelection() {
  try {
    if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";

    var doc = app.activeDocument;
    var selection = doc.selection;
    if (!selection || selection.length === 0) {
      return "ERR: Hãy chọn ít nhất 1 object để raster.";
    }

    var selectedItems = [];
    for (var i = 0; i < selection.length; i++) selectedItems.push(selection[i]);

    // Dùng Color Mode của document. Một số Illustrator báo lỗi khi gán trực
    // tiếp RasterizationColorModel.CMYK, dù tài liệu đã ở CMYK.
    if (doc.documentColorSpace !== DocumentColorSpace.CMYK) {
      return "ERR: Tài liệu đang ở RGB. Hãy đổi File > Document Color Mode > CMYK Color rồi bấm Raster.";
    }

    var options = new RasterizeOptions();
    options.resolution = 400;
    options.transparency = true;
    options.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
    options.clippingMask = false;
    options.padding = 0;
    options.convertSpotColors = false;

    // visibleBounds của clipping group đôi khi vẫn tính phần ảnh bị mask che.
    // Lấy geometricBounds của clipping path để raster đúng phần đang hiển thị.
    // Nếu chọn ảnh con trong clipping group, raster cả group cha để giữ mask.
    function getRasterTarget(item) {
      var current = item;
      while (current) {
        try {
          if (current.typename === "GroupItem" && current.clipped === true)
            return current;
          current = current.parent;
        } catch (parentError) {
          break;
        }
      }
      return item;
    }

    // Đo vùng HIỂN THỊ thực tế, kể cả group lồng nhau có clipping mask.
    // Không dùng visibleBounds trực tiếp vì Illustrator có thể cộng cả ảnh
    // bị giấu phía sau mask vào bounds của group.
    function getRasterBounds(item) {
      function merge(acc, b) {
        if (!b) return;
        if (!acc.val) {
          acc.val = [b[0], b[1], b[2], b[3]];
          return;
        }
        if (b[0] < acc.val[0]) acc.val[0] = b[0];
        if (b[1] > acc.val[1]) acc.val[1] = b[1];
        if (b[2] > acc.val[2]) acc.val[2] = b[2];
        if (b[3] < acc.val[3]) acc.val[3] = b[3];
      }
      function clipBounds(group) {
        try {
          var p = group.pageItems;
          for (var i = 0; i < p.length; i++) {
            if (p[i].clipping === true) return p[i].geometricBounds;
          }
        } catch (clipError) {}
        return null;
      }
      function collect(node, acc) {
        var type = "";
        try {
          type = node.typename;
        } catch (typeError) {
          return;
        }
        if (type === "GroupItem") {
          var mask = null;
          try {
            if (node.clipped === true) mask = clipBounds(node);
          } catch (groupError) {}
          var children = node.pageItems;
          var inner = { val: null };
          for (var j = 0; j < children.length; j++) {
            var isMask = false;
            try {
              isMask = children[j].clipping === true;
            } catch (childError) {}
            if (!isMask) collect(children[j], inner);
          }
          if (mask && inner.val) {
            var hit = [
              Math.max(mask[0], inner.val[0]),
              Math.min(mask[1], inner.val[1]),
              Math.min(mask[2], inner.val[2]),
              Math.max(mask[3], inner.val[3]),
            ];
            merge(acc, hit[2] > hit[0] && hit[1] > hit[3] ? hit : mask);
          } else if (mask) {
            merge(acc, mask);
          } else if (inner.val) {
            merge(acc, inner.val);
          }
          return;
        }
        try {
          merge(acc, node.visibleBounds);
        } catch (boundsError) {
          try {
            merge(acc, node.geometricBounds);
          } catch (ignoreBoundsError) {}
        }
      }

      var result = { val: null };
      collect(item, result);
      if (result.val) return result.val;
      try {
        return [
          item.geometricBounds[0],
          item.geometricBounds[1],
          item.geometricBounds[2],
          item.geometricBounds[3],
        ];
      } catch (fallbackError) {
        return [
          item.visibleBounds[0],
          item.visibleBounds[1],
          item.visibleBounds[2],
          item.visibleBounds[3],
        ];
      }
    }

    // Không raster lặp lại khi chọn nhiều object con của cùng một clipping group.
    var sources = [];
    for (var s = 0; s < selectedItems.length; s++) {
      var target = getRasterTarget(selectedItems[s]);
      var found = false;
      for (var q = 0; q < sources.length; q++) {
        if (sources[q] === target) {
          found = true;
          break;
        }
      }
      if (!found) sources.push(target);
    }

    var rasters = [];
    var errors = [];
    for (var j = 0; j < sources.length; j++) {
      try {
        var item = sources[j];
        var bounds = getRasterBounds(item);
        var raster = doc.rasterize(item, bounds, options);
        if (!raster) throw new Error("Illustrator không trả về RasterItem.");
        rasters.push(raster);
      } catch (itemError) {
        errors.push("Object " + (j + 1) + ": " + dcMoTaLoi(itemError));
      }
    }

    if (rasters.length > 0) doc.selection = rasters;
    app.redraw();

    if (errors.length > 0) {
      return (
        "ERR: Raster được " +
        rasters.length +
        "/" +
        sources.length +
        " object.\n" +
        errors.join("\n")
      );
    }
    return (
      "OK: Đã raster " +
      rasters.length +
      " object — CMYK, 400 ppi, nền trong suốt."
    );
  } catch (e) {
    return "ERR: " + dcMoTaLoi(e);
  }
}

// ============================================================
//  TAB DECAL: dàn object vào tọa độ tâm ĐÃ LƯU theo khổ decal.
//  - decalSize: "1.5", "2", "2.5", rồi "3" đến "9.5" mỗi 0.5cm -> bộ tọa độ riêng.
//  - Nhiều object -> chia đều theo THỨ TỰ (obj1 nửa đầu, obj2 nửa sau...).
//  - Clip object theo hình tròn đúng KT object.
//  - ponSizeKey: "33x35.4"/"33x35" (chỉ để chọn file pon).
// ============================================================

// Tọa độ tâm decal theo khổ (mm, gốc trên-trái artboard)
var DECAL_SETS = {
  1.5: [
    [29.0, 17.15],
    [45.0, 17.15],
    [61.0, 17.15],
    [77.0, 17.15],
    [93.0, 17.15],
    [109.0, 17.15],
    [125.0, 17.15],
    [141.0, 17.15],
    [157.0, 17.15],
    [173.0, 17.15],
    [189.0, 17.15],
    [205.0, 17.15],
    [221.0, 17.15],
    [237.0, 17.15],
    [253.0, 17.15],
    [269.0, 17.15],
    [285.0, 17.15],
    [301.0, 17.15],
    [21.0, 31.05],
    [37.0, 31.05],
    [53.0, 31.05],
    [69.0, 31.05],
    [85.0, 31.05],
    [101.0, 31.05],
    [117.0, 31.05],
    [133.0, 31.05],
    [149.0, 31.05],
    [165.0, 31.05],
    [181.0, 31.05],
    [197.0, 31.05],
    [213.0, 31.05],
    [229.0, 31.05],
    [245.0, 31.05],
    [261.0, 31.05],
    [277.0, 31.05],
    [293.0, 31.05],
    [309.0, 31.05],
    [13.0, 44.95],
    [29.0, 44.95],
    [45.0, 44.95],
    [61.0, 44.95],
    [77.0, 44.95],
    [93.0, 44.95],
    [109.0, 44.95],
    [125.0, 44.95],
    [141.0, 44.95],
    [157.0, 44.95],
    [173.0, 44.95],
    [189.0, 44.95],
    [205.0, 44.95],
    [221.0, 44.95],
    [237.0, 44.95],
    [253.0, 44.95],
    [269.0, 44.95],
    [285.0, 44.95],
    [301.0, 44.95],
    [317.0, 44.95],
    [21.0, 58.85],
    [37.0, 58.85],
    [53.0, 58.85],
    [69.0, 58.85],
    [85.0, 58.85],
    [101.0, 58.85],
    [117.0, 58.85],
    [133.0, 58.85],
    [149.0, 58.85],
    [165.0, 58.85],
    [181.0, 58.85],
    [197.0, 58.85],
    [213.0, 58.85],
    [229.0, 58.85],
    [245.0, 58.85],
    [261.0, 58.85],
    [277.0, 58.85],
    [293.0, 58.85],
    [309.0, 58.85],
    [13.0, 72.75],
    [29.0, 72.75],
    [45.0, 72.75],
    [61.0, 72.75],
    [77.0, 72.75],
    [93.0, 72.75],
    [109.0, 72.75],
    [125.0, 72.75],
    [141.0, 72.75],
    [157.0, 72.75],
    [173.0, 72.75],
    [189.0, 72.75],
    [205.0, 72.75],
    [221.0, 72.75],
    [237.0, 72.75],
    [253.0, 72.75],
    [269.0, 72.75],
    [285.0, 72.75],
    [301.0, 72.75],
    [317.0, 72.75],
    [21.0, 86.65],
    [37.0, 86.65],
    [53.0, 86.65],
    [69.0, 86.65],
    [85.0, 86.65],
    [101.0, 86.65],
    [117.0, 86.65],
    [133.0, 86.65],
    [149.0, 86.65],
    [165.0, 86.65],
    [181.0, 86.65],
    [197.0, 86.65],
    [213.0, 86.65],
    [229.0, 86.65],
    [245.0, 86.65],
    [261.0, 86.65],
    [277.0, 86.65],
    [293.0, 86.65],
    [309.0, 86.65],
    [13.0, 100.55],
    [29.0, 100.55],
    [45.0, 100.55],
    [61.0, 100.55],
    [77.0, 100.55],
    [93.0, 100.55],
    [109.0, 100.55],
    [125.0, 100.55],
    [141.0, 100.55],
    [157.0, 100.55],
    [173.0, 100.55],
    [189.0, 100.55],
    [205.0, 100.55],
    [221.0, 100.55],
    [237.0, 100.55],
    [253.0, 100.55],
    [269.0, 100.55],
    [285.0, 100.55],
    [301.0, 100.55],
    [317.0, 100.55],
    [21.0, 114.45],
    [37.0, 114.45],
    [53.0, 114.45],
    [69.0, 114.45],
    [85.0, 114.45],
    [101.0, 114.45],
    [117.0, 114.45],
    [133.0, 114.45],
    [149.0, 114.45],
    [165.0, 114.45],
    [181.0, 114.45],
    [197.0, 114.45],
    [213.0, 114.45],
    [229.0, 114.45],
    [245.0, 114.45],
    [261.0, 114.45],
    [277.0, 114.45],
    [293.0, 114.45],
    [309.0, 114.45],
    [13.0, 128.35],
    [29.0, 128.35],
    [45.0, 128.35],
    [61.0, 128.35],
    [77.0, 128.35],
    [93.0, 128.35],
    [109.0, 128.35],
    [125.0, 128.35],
    [141.0, 128.35],
    [157.0, 128.35],
    [173.0, 128.35],
    [189.0, 128.35],
    [205.0, 128.35],
    [221.0, 128.35],
    [237.0, 128.35],
    [253.0, 128.35],
    [269.0, 128.35],
    [285.0, 128.35],
    [301.0, 128.35],
    [317.0, 128.35],
    [21.0, 142.25],
    [37.0, 142.25],
    [53.0, 142.25],
    [69.0, 142.25],
    [85.0, 142.25],
    [101.0, 142.25],
    [117.0, 142.25],
    [133.0, 142.25],
    [149.0, 142.25],
    [165.0, 142.25],
    [181.0, 142.25],
    [197.0, 142.25],
    [213.0, 142.25],
    [229.0, 142.25],
    [245.0, 142.25],
    [261.0, 142.25],
    [277.0, 142.25],
    [293.0, 142.25],
    [309.0, 142.25],
    [13.0, 156.15],
    [29.0, 156.15],
    [45.0, 156.15],
    [61.0, 156.15],
    [77.0, 156.15],
    [93.0, 156.15],
    [109.0, 156.15],
    [125.0, 156.15],
    [141.0, 156.15],
    [157.0, 156.15],
    [173.0, 156.15],
    [189.0, 156.15],
    [205.0, 156.15],
    [221.0, 156.15],
    [237.0, 156.15],
    [253.0, 156.15],
    [269.0, 156.15],
    [285.0, 156.15],
    [301.0, 156.15],
    [317.0, 156.15],
    [21.0, 170.05],
    [37.0, 170.05],
    [53.0, 170.05],
    [69.0, 170.05],
    [85.0, 170.05],
    [101.0, 170.05],
    [117.0, 170.05],
    [133.0, 170.05],
    [149.0, 170.05],
    [165.0, 170.05],
    [181.0, 170.05],
    [197.0, 170.05],
    [213.0, 170.05],
    [229.0, 170.05],
    [245.0, 170.05],
    [261.0, 170.05],
    [277.0, 170.05],
    [293.0, 170.05],
    [309.0, 170.05],
    [13.0, 183.95],
    [29.0, 183.95],
    [45.0, 183.95],
    [61.0, 183.95],
    [77.0, 183.95],
    [93.0, 183.95],
    [109.0, 183.95],
    [125.0, 183.95],
    [141.0, 183.95],
    [157.0, 183.95],
    [173.0, 183.95],
    [189.0, 183.95],
    [205.0, 183.95],
    [221.0, 183.95],
    [237.0, 183.95],
    [253.0, 183.95],
    [269.0, 183.95],
    [285.0, 183.95],
    [301.0, 183.95],
    [317.0, 183.95],
    [21.0, 197.85],
    [37.0, 197.85],
    [53.0, 197.85],
    [69.0, 197.85],
    [85.0, 197.85],
    [101.0, 197.85],
    [117.0, 197.85],
    [133.0, 197.85],
    [149.0, 197.85],
    [165.0, 197.85],
    [181.0, 197.85],
    [197.0, 197.85],
    [213.0, 197.85],
    [229.0, 197.85],
    [245.0, 197.85],
    [261.0, 197.85],
    [277.0, 197.85],
    [293.0, 197.85],
    [309.0, 197.85],
    [13.0, 211.75],
    [29.0, 211.75],
    [45.0, 211.75],
    [61.0, 211.75],
    [77.0, 211.75],
    [93.0, 211.75],
    [109.0, 211.75],
    [125.0, 211.75],
    [141.0, 211.75],
    [157.0, 211.75],
    [173.0, 211.75],
    [189.0, 211.75],
    [205.0, 211.75],
    [221.0, 211.75],
    [237.0, 211.75],
    [253.0, 211.75],
    [269.0, 211.75],
    [285.0, 211.75],
    [301.0, 211.75],
    [317.0, 211.75],
    [21.0, 225.65],
    [37.0, 225.65],
    [53.0, 225.65],
    [69.0, 225.65],
    [85.0, 225.65],
    [101.0, 225.65],
    [117.0, 225.65],
    [133.0, 225.65],
    [149.0, 225.65],
    [165.0, 225.65],
    [181.0, 225.65],
    [197.0, 225.65],
    [213.0, 225.65],
    [229.0, 225.65],
    [245.0, 225.65],
    [261.0, 225.65],
    [277.0, 225.65],
    [293.0, 225.65],
    [309.0, 225.65],
    [13.0, 239.55],
    [29.0, 239.55],
    [45.0, 239.55],
    [61.0, 239.55],
    [77.0, 239.55],
    [93.0, 239.55],
    [109.0, 239.55],
    [125.0, 239.55],
    [141.0, 239.55],
    [157.0, 239.55],
    [173.0, 239.55],
    [189.0, 239.55],
    [205.0, 239.55],
    [221.0, 239.55],
    [237.0, 239.55],
    [253.0, 239.55],
    [269.0, 239.55],
    [285.0, 239.55],
    [301.0, 239.55],
    [317.0, 239.55],
    [21.0, 253.45],
    [37.0, 253.45],
    [53.0, 253.45],
    [69.0, 253.45],
    [85.0, 253.45],
    [101.0, 253.45],
    [117.0, 253.45],
    [133.0, 253.45],
    [149.0, 253.45],
    [165.0, 253.45],
    [181.0, 253.45],
    [197.0, 253.45],
    [213.0, 253.45],
    [229.0, 253.45],
    [245.0, 253.45],
    [261.0, 253.45],
    [277.0, 253.45],
    [293.0, 253.45],
    [309.0, 253.45],
    [13.0, 267.35],
    [29.0, 267.35],
    [45.0, 267.35],
    [61.0, 267.35],
    [77.0, 267.35],
    [93.0, 267.35],
    [109.0, 267.35],
    [125.0, 267.35],
    [141.0, 267.35],
    [157.0, 267.35],
    [173.0, 267.35],
    [189.0, 267.35],
    [205.0, 267.35],
    [221.0, 267.35],
    [237.0, 267.35],
    [253.0, 267.35],
    [269.0, 267.35],
    [285.0, 267.35],
    [301.0, 267.35],
    [317.0, 267.35],
    [21.0, 281.25],
    [37.0, 281.25],
    [53.0, 281.25],
    [69.0, 281.25],
    [85.0, 281.25],
    [101.0, 281.25],
    [117.0, 281.25],
    [133.0, 281.25],
    [149.0, 281.25],
    [165.0, 281.25],
    [181.0, 281.25],
    [197.0, 281.25],
    [213.0, 281.25],
    [229.0, 281.25],
    [245.0, 281.25],
    [261.0, 281.25],
    [277.0, 281.25],
    [293.0, 281.25],
    [309.0, 281.25],
    [13.0, 295.15],
    [29.0, 295.15],
    [45.0, 295.15],
    [61.0, 295.15],
    [77.0, 295.15],
    [93.0, 295.15],
    [109.0, 295.15],
    [125.0, 295.15],
    [141.0, 295.15],
    [157.0, 295.15],
    [173.0, 295.15],
    [189.0, 295.15],
    [205.0, 295.15],
    [221.0, 295.15],
    [237.0, 295.15],
    [253.0, 295.15],
    [269.0, 295.15],
    [285.0, 295.15],
    [301.0, 295.15],
    [317.0, 295.15],
    [21.0, 309.05],
    [37.0, 309.05],
    [53.0, 309.05],
    [69.0, 309.05],
    [85.0, 309.05],
    [101.0, 309.05],
    [117.0, 309.05],
    [133.0, 309.05],
    [149.0, 309.05],
    [165.0, 309.05],
    [181.0, 309.05],
    [197.0, 309.05],
    [213.0, 309.05],
    [229.0, 309.05],
    [245.0, 309.05],
    [261.0, 309.05],
    [277.0, 309.05],
    [293.0, 309.05],
    [309.0, 309.05],
    [13.0, 322.95],
    [29.0, 322.95],
    [45.0, 322.95],
    [61.0, 322.95],
    [77.0, 322.95],
    [93.0, 322.95],
    [109.0, 322.95],
    [125.0, 322.95],
    [141.0, 322.95],
    [157.0, 322.95],
    [173.0, 322.95],
    [189.0, 322.95],
    [205.0, 322.95],
    [221.0, 322.95],
    [237.0, 322.95],
    [253.0, 322.95],
    [269.0, 322.95],
    [285.0, 322.95],
    [301.0, 322.95],
    [317.0, 322.95],
    [37.0, 336.85],
    [53.0, 336.85],
    [69.0, 336.85],
    [85.0, 336.85],
    [101.0, 336.85],
    [117.0, 336.85],
    [133.0, 336.85],
    [149.0, 336.85],
    [165.0, 336.85],
    [181.0, 336.85],
    [197.0, 336.85],
    [213.0, 336.85],
    [229.0, 336.85],
    [245.0, 336.85],
    [261.0, 336.85],
    [277.0, 336.85],
    [293.0, 336.85],
  ],
  2: [
    [33.75, 22.0],
    [54.75, 22.0],
    [75.75, 22.0],
    [96.75, 22.0],
    [117.75, 22.0],
    [138.75, 22.0],
    [159.75, 22.0],
    [180.75, 22.0],
    [201.75, 22.0],
    [222.75, 22.0],
    [243.75, 22.0],
    [264.75, 22.0],
    [285.75, 22.0],
    [306.75, 22.0],
    [23.25, 40.0],
    [44.25, 40.0],
    [65.25, 40.0],
    [86.25, 40.0],
    [107.25, 40.0],
    [128.25, 40.0],
    [149.25, 40.0],
    [170.25, 40.0],
    [191.25, 40.0],
    [212.25, 40.0],
    [233.25, 40.0],
    [254.25, 40.0],
    [275.25, 40.0],
    [296.25, 40.0],
    [317.25, 40.0],
    [12.75, 58.0],
    [33.75, 58.0],
    [54.75, 58.0],
    [75.75, 58.0],
    [96.75, 58.0],
    [117.75, 58.0],
    [138.75, 58.0],
    [159.75, 58.0],
    [180.75, 58.0],
    [201.75, 58.0],
    [222.75, 58.0],
    [243.75, 58.0],
    [264.75, 58.0],
    [285.75, 58.0],
    [306.75, 58.0],
    [23.25, 76.0],
    [44.25, 76.0],
    [65.25, 76.0],
    [86.25, 76.0],
    [107.25, 76.0],
    [128.25, 76.0],
    [149.25, 76.0],
    [170.25, 76.0],
    [191.25, 76.0],
    [212.25, 76.0],
    [233.25, 76.0],
    [254.25, 76.0],
    [275.25, 76.0],
    [296.25, 76.0],
    [317.25, 76.0],
    [12.75, 94.0],
    [33.75, 94.0],
    [54.75, 94.0],
    [75.75, 94.0],
    [96.75, 94.0],
    [117.75, 94.0],
    [138.75, 94.0],
    [159.75, 94.0],
    [180.75, 94.0],
    [201.75, 94.0],
    [222.75, 94.0],
    [243.75, 94.0],
    [264.75, 94.0],
    [285.75, 94.0],
    [306.75, 94.0],
    [23.25, 112.0],
    [44.25, 112.0],
    [65.25, 112.0],
    [86.25, 112.0],
    [107.25, 112.0],
    [128.25, 112.0],
    [149.25, 112.0],
    [170.25, 112.0],
    [191.25, 112.0],
    [212.25, 112.0],
    [233.25, 112.0],
    [254.25, 112.0],
    [275.25, 112.0],
    [296.25, 112.0],
    [317.25, 112.0],
    [12.75, 130.0],
    [33.75, 130.0],
    [54.75, 130.0],
    [75.75, 130.0],
    [96.75, 130.0],
    [117.75, 130.0],
    [138.75, 130.0],
    [159.75, 130.0],
    [180.75, 130.0],
    [201.75, 130.0],
    [222.75, 130.0],
    [243.75, 130.0],
    [264.75, 130.0],
    [285.75, 130.0],
    [306.75, 130.0],
    [23.25, 148.0],
    [44.25, 148.0],
    [65.25, 148.0],
    [86.25, 148.0],
    [107.25, 148.0],
    [128.25, 148.0],
    [149.25, 148.0],
    [170.25, 148.0],
    [191.25, 148.0],
    [212.25, 148.0],
    [233.25, 148.0],
    [254.25, 148.0],
    [275.25, 148.0],
    [296.25, 148.0],
    [317.25, 148.0],
    [12.75, 166.0],
    [33.75, 166.0],
    [54.75, 166.0],
    [75.75, 166.0],
    [96.75, 166.0],
    [117.75, 166.0],
    [138.75, 166.0],
    [159.75, 166.0],
    [180.75, 166.0],
    [201.75, 166.0],
    [222.75, 166.0],
    [243.75, 166.0],
    [264.75, 166.0],
    [285.75, 166.0],
    [306.75, 166.0],
    [23.25, 184.0],
    [44.25, 184.0],
    [65.25, 184.0],
    [86.25, 184.0],
    [107.25, 184.0],
    [128.25, 184.0],
    [149.25, 184.0],
    [170.25, 184.0],
    [191.25, 184.0],
    [212.25, 184.0],
    [233.25, 184.0],
    [254.25, 184.0],
    [275.25, 184.0],
    [296.25, 184.0],
    [317.25, 184.0],
    [12.75, 202.0],
    [33.75, 202.0],
    [54.75, 202.0],
    [75.75, 202.0],
    [96.75, 202.0],
    [117.75, 202.0],
    [138.75, 202.0],
    [159.75, 202.0],
    [180.75, 202.0],
    [201.75, 202.0],
    [222.75, 202.0],
    [243.75, 202.0],
    [264.75, 202.0],
    [285.75, 202.0],
    [306.75, 202.0],
    [23.25, 220.0],
    [44.25, 220.0],
    [65.25, 220.0],
    [86.25, 220.0],
    [107.25, 220.0],
    [128.25, 220.0],
    [149.25, 220.0],
    [170.25, 220.0],
    [191.25, 220.0],
    [212.25, 220.0],
    [233.25, 220.0],
    [254.25, 220.0],
    [275.25, 220.0],
    [296.25, 220.0],
    [317.25, 220.0],
    [12.75, 238.0],
    [33.75, 238.0],
    [54.75, 238.0],
    [75.75, 238.0],
    [96.75, 238.0],
    [117.75, 238.0],
    [138.75, 238.0],
    [159.75, 238.0],
    [180.75, 238.0],
    [201.75, 238.0],
    [222.75, 238.0],
    [243.75, 238.0],
    [264.75, 238.0],
    [285.75, 238.0],
    [306.75, 238.0],
    [23.25, 256.0],
    [44.25, 256.0],
    [65.25, 256.0],
    [86.25, 256.0],
    [107.25, 256.0],
    [128.25, 256.0],
    [149.25, 256.0],
    [170.25, 256.0],
    [191.25, 256.0],
    [212.25, 256.0],
    [233.25, 256.0],
    [254.25, 256.0],
    [275.25, 256.0],
    [296.25, 256.0],
    [317.25, 256.0],
    [12.75, 274.0],
    [33.75, 274.0],
    [54.75, 274.0],
    [75.75, 274.0],
    [96.75, 274.0],
    [117.75, 274.0],
    [138.75, 274.0],
    [159.75, 274.0],
    [180.75, 274.0],
    [201.75, 274.0],
    [222.75, 274.0],
    [243.75, 274.0],
    [264.75, 274.0],
    [285.75, 274.0],
    [306.75, 274.0],
    [23.25, 292.0],
    [44.25, 292.0],
    [65.25, 292.0],
    [86.25, 292.0],
    [107.25, 292.0],
    [128.25, 292.0],
    [149.25, 292.0],
    [170.25, 292.0],
    [191.25, 292.0],
    [212.25, 292.0],
    [233.25, 292.0],
    [254.25, 292.0],
    [275.25, 292.0],
    [296.25, 292.0],
    [317.25, 292.0],
    [12.75, 310.0],
    [33.75, 310.0],
    [54.75, 310.0],
    [75.75, 310.0],
    [96.75, 310.0],
    [117.75, 310.0],
    [138.75, 310.0],
    [159.75, 310.0],
    [180.75, 310.0],
    [201.75, 310.0],
    [222.75, 310.0],
    [243.75, 310.0],
    [264.75, 310.0],
    [285.75, 310.0],
    [306.75, 310.0],
    [23.25, 328.0],
    [44.25, 328.0],
    [65.25, 328.0],
    [86.25, 328.0],
    [107.25, 328.0],
    [128.25, 328.0],
    [149.25, 328.0],
    [170.25, 328.0],
    [191.25, 328.0],
    [212.25, 328.0],
    [233.25, 328.0],
    [254.25, 328.0],
    [275.25, 328.0],
    [296.25, 328.0],
  ],
  2.5: [
    [47.5, 19.0],
    [94.5, 19.0],
    [141.5, 19.0],
    [188.5, 19.0],
    [235.5, 19.0],
    [282.5, 19.0],
    [24.0, 32.0],
    [71.0, 32.0],
    [118.0, 32.0],
    [165.0, 32.0],
    [212.0, 32.0],
    [259.0, 32.0],
    [306.0, 32.0],
    [47.5, 45.0],
    [94.5, 45.0],
    [141.5, 45.0],
    [188.5, 45.0],
    [235.5, 45.0],
    [282.5, 45.0],
    [24.0, 58.0],
    [71.0, 58.0],
    [118.0, 58.0],
    [165.0, 58.0],
    [212.0, 58.0],
    [259.0, 58.0],
    [306.0, 58.0],
    [47.5, 71.0],
    [94.5, 71.0],
    [141.5, 71.0],
    [188.5, 71.0],
    [235.5, 71.0],
    [282.5, 71.0],
    [24.0, 84.0],
    [71.0, 84.0],
    [118.0, 84.0],
    [165.0, 84.0],
    [212.0, 84.0],
    [259.0, 84.0],
    [306.0, 84.0],
    [47.5, 97.0],
    [94.5, 97.0],
    [141.5, 97.0],
    [188.5, 97.0],
    [235.5, 97.0],
    [282.5, 97.0],
    [24.0, 110.0],
    [71.0, 110.0],
    [118.0, 110.0],
    [165.0, 110.0],
    [212.0, 110.0],
    [259.0, 110.0],
    [306.0, 110.0],
    [47.5, 123.0],
    [94.5, 123.0],
    [141.5, 123.0],
    [188.5, 123.0],
    [235.5, 123.0],
    [282.5, 123.0],
    [24.0, 136.0],
    [71.0, 136.0],
    [118.0, 136.0],
    [165.0, 136.0],
    [212.0, 136.0],
    [259.0, 136.0],
    [306.0, 136.0],
    [47.5, 149.0],
    [94.5, 149.0],
    [141.5, 149.0],
    [188.5, 149.0],
    [235.5, 149.0],
    [282.5, 149.0],
    [24.0, 162.0],
    [71.0, 162.0],
    [118.0, 162.0],
    [165.0, 162.0],
    [212.0, 162.0],
    [259.0, 162.0],
    [306.0, 162.0],
    [47.5, 175.0],
    [94.5, 175.0],
    [141.5, 175.0],
    [188.5, 175.0],
    [235.5, 175.0],
    [282.5, 175.0],
    [24.0, 188.0],
    [71.0, 188.0],
    [118.0, 188.0],
    [165.0, 188.0],
    [212.0, 188.0],
    [259.0, 188.0],
    [306.0, 188.0],
    [47.5, 201.0],
    [94.5, 201.0],
    [141.5, 201.0],
    [188.5, 201.0],
    [235.5, 201.0],
    [282.5, 201.0],
    [24.0, 214.0],
    [71.0, 214.0],
    [118.0, 214.0],
    [165.0, 214.0],
    [212.0, 214.0],
    [259.0, 214.0],
    [306.0, 214.0],
    [47.5, 227.0],
    [94.5, 227.0],
    [141.5, 227.0],
    [188.5, 227.0],
    [235.5, 227.0],
    [282.5, 227.0],
    [24.0, 240.0],
    [71.0, 240.0],
    [118.0, 240.0],
    [165.0, 240.0],
    [212.0, 240.0],
    [259.0, 240.0],
    [306.0, 240.0],
    [47.5, 253.0],
    [94.5, 253.0],
    [141.5, 253.0],
    [188.5, 253.0],
    [235.5, 253.0],
    [282.5, 253.0],
    [24.0, 266.0],
    [71.0, 266.0],
    [118.0, 266.0],
    [165.0, 266.0],
    [212.0, 266.0],
    [259.0, 266.0],
    [306.0, 266.0],
    [47.5, 279.0],
    [94.5, 279.0],
    [141.5, 279.0],
    [188.5, 279.0],
    [235.5, 279.0],
    [282.5, 279.0],
    [24.0, 292.0],
    [71.0, 292.0],
    [118.0, 292.0],
    [165.0, 292.0],
    [212.0, 292.0],
    [259.0, 292.0],
    [306.0, 292.0],
    [47.5, 305.0],
    [94.5, 305.0],
    [141.5, 305.0],
    [188.5, 305.0],
    [235.5, 305.0],
    [282.5, 305.0],
    [24.0, 318.0],
    [71.0, 318.0],
    [118.0, 318.0],
    [165.0, 318.0],
    [212.0, 318.0],
    [259.0, 318.0],
    [306.0, 318.0],
    [47.5, 331.0],
    [94.5, 331.0],
    [141.5, 331.0],
    [188.5, 331.0],
    [235.5, 331.0],
    [282.5, 331.0],
  ],
  3.5: [
    [57, 33.25],
    [93, 33.25],
    [129, 33.25],
    [165, 33.25],
    [201, 33.25],
    [237, 33.25],
    [273, 33.25],
    [39, 64.75],
    [75, 64.75],
    [111, 64.75],
    [147, 64.75],
    [183, 64.75],
    [219, 64.75],
    [255, 64.75],
    [291, 64.75],
    [21, 96.25],
    [57, 96.25],
    [93, 96.25],
    [129, 96.25],
    [165, 96.25],
    [201, 96.25],
    [237, 96.25],
    [273, 96.25],
    [309, 96.25],
    [39, 127.75],
    [75, 127.75],
    [111, 127.75],
    [147, 127.75],
    [183, 127.75],
    [219, 127.75],
    [255, 127.75],
    [291, 127.75],
    [21, 159.25],
    [57, 159.25],
    [93, 159.25],
    [129, 159.25],
    [165, 159.25],
    [201, 159.25],
    [237, 159.25],
    [273, 159.25],
    [309, 159.25],
    [39, 190.75],
    [75, 190.75],
    [111, 190.75],
    [147, 190.75],
    [183, 190.75],
    [219, 190.75],
    [255, 190.75],
    [291, 190.75],
    [21, 222.25],
    [57, 222.25],
    [93, 222.25],
    [129, 222.25],
    [165, 222.25],
    [201, 222.25],
    [237, 222.25],
    [273, 222.25],
    [309, 222.25],
    [39, 253.75],
    [75, 253.75],
    [111, 253.75],
    [147, 253.75],
    [183, 253.75],
    [219, 253.75],
    [255, 253.75],
    [291, 253.75],
    [21, 285.25],
    [57, 285.25],
    [93, 285.25],
    [129, 285.25],
    [165, 285.25],
    [201, 285.25],
    [237, 285.25],
    [273, 285.25],
    [309, 285.25],
    [39, 316.75],
    [75, 316.75],
    [111, 316.75],
    [147, 316.75],
    [183, 316.75],
    [219, 316.75],
    [255, 316.75],
    [291, 316.75],
  ],
  4.5: [
    [106.8, 27.5],
    [184.4, 27.5],
    [262, 27.5],
    [68, 50.5],
    [145.6, 50.5],
    [223.2, 50.5],
    [300.8, 50.5],
    [29.2, 73.5],
    [106.8, 73.5],
    [184.4, 73.5],
    [262, 73.5],
    [68, 96.5],
    [145.6, 96.5],
    [223.2, 96.5],
    [300.8, 96.5],
    [29.2, 119.5],
    [106.8, 119.5],
    [184.4, 119.5],
    [262, 119.5],
    [68, 142.5],
    [145.6, 142.5],
    [223.2, 142.5],
    [300.8, 142.5],
    [29.2, 165.5],
    [106.8, 165.5],
    [184.4, 165.5],
    [262, 165.5],
    [68, 188.5],
    [145.6, 188.5],
    [223.2, 188.5],
    [300.8, 188.5],
    [29.2, 211.5],
    [68, 234.5],
    [106.8, 211.5],
    [145.6, 234.5],
    [184.4, 211.5],
    [223.2, 234.5],
    [262, 211.5],
    [300.8, 234.5],
    [29.2, 257.5],
    [106.8, 257.5],
    [184.4, 257.5],
    [262, 257.5],
    [68, 280.5],
    [145.6, 280.5],
    [223.2, 280.5],
    [300.8, 280.5],
    [29.2, 303.5],
    [106.8, 303.5],
    [184.4, 303.5],
    [262, 303.5],
    [68, 326.5],
    [145.6, 326.5],
    [223.2, 326.5],
  ],
  5.5: [
    [42.5, 35.0],
    [140.5, 35.0],
    [238.5, 35.0],
    [91.5, 63.0],
    [189.5, 63.0],
    [287.5, 63.0],
    [42.5, 91.0],
    [140.5, 91.0],
    [238.5, 91.0],
    [91.5, 119.0],
    [189.5, 119.0],
    [287.5, 119.0],
    [42.5, 147.0],
    [140.5, 147.0],
    [238.5, 147.0],
    [91.5, 175.0],
    [189.5, 175.0],
    [287.5, 175.0],
    [42.5, 203.0],
    [140.5, 203.0],
    [238.5, 203.0],
    [91.5, 231.0],
    [189.5, 231.0],
    [287.5, 231.0],
    [42.5, 259.0],
    [140.5, 259.0],
    [238.5, 259.0],
    [91.5, 287.0],
    [189.5, 287.0],
    [287.5, 287.0],
    [42.5, 315.0],
    [140.5, 315.0],
    [238.5, 315.0],
  ],
  6.5: [
    [50.6, 49.5],
    [165, 49.5],
    [279.4, 49.5],
    [107.8, 82.5],
    [222.2, 82.5],
    [50.6, 115.5],
    [165, 115.5],
    [279.4, 115.5],
    [107.8, 148.5],
    [222.2, 148.5],
    [50.6, 181.5],
    [165, 181.5],
    [279.4, 181.5],
    [107.8, 214.5],
    [222.2, 214.5],
    [50.6, 247.5],
    [165, 247.5],
    [279.4, 247.5],
    [107.8, 280.5],
    [222.2, 280.5],
    [50.6, 313.5],
    [165, 313.5],
    [279.4, 313.5],
  ],
  7.5: [
    [51, 45.4],
    [127, 45.4],
    [203, 45.4],
    [279, 45.4],
    [89, 111.2],
    [165, 111.2],
    [241, 111.2],
    [51, 177],
    [127, 177],
    [203, 177],
    [279, 177],
    [89, 242.8],
    [165, 242.8],
    [241, 242.8],
    [51, 308.6],
    [127, 308.6],
    [203, 308.6],
    [279, 308.6],
  ],
  8.5: [
    [52.5, 46.0],
    [202.5, 46.0],
    [127.5, 89.0],
    [277.5, 89.0],
    [52.5, 132.0],
    [202.5, 132.0],
    [127.5, 175.0],
    [277.5, 175.0],
    [52.5, 218.0],
    [202.5, 218.0],
    [127.5, 261.0],
    [277.5, 261.0],
    [52.5, 304.0],
    [202.5, 304.0],
  ],
  9.5: [
    [69, 52.2],
    [165, 52.2],
    [261, 52.2],
    [117, 135.4],
    [213, 135.4],
    [69, 218.6],
    [165, 218.6],
    [261, 218.6],
    [117, 301.8],
    [213, 301.8],
  ],
  3: [
    [25.5, 36.2],
    [56.5, 36.2],
    [87.5, 36.2],
    [118.5, 36.2],
    [149.5, 36.2],
    [180.5, 36.2],
    [211.5, 36.2],
    [242.5, 36.2],
    [273.5, 36.2],
    [304.5, 36.2],
    [41.0, 63.0],
    [72.0, 63.0],
    [103.0, 63.0],
    [134.0, 63.0],
    [165.0, 63.0],
    [196.0, 63.0],
    [227.0, 63.0],
    [258.0, 63.0],
    [289.0, 63.0],
    [25.5, 89.8],
    [56.5, 89.8],
    [87.5, 89.8],
    [118.5, 89.8],
    [149.5, 89.8],
    [180.5, 89.8],
    [211.5, 89.8],
    [242.5, 89.8],
    [273.5, 89.8],
    [304.5, 89.8],
    [41.0, 116.6],
    [72.0, 116.6],
    [103.0, 116.6],
    [134.0, 116.6],
    [165.0, 116.6],
    [196.0, 116.6],
    [227.0, 116.6],
    [258.0, 116.6],
    [289.0, 116.6],
    [25.5, 143.4],
    [56.5, 143.4],
    [87.5, 143.4],
    [118.5, 143.4],
    [149.5, 143.4],
    [180.5, 143.4],
    [211.5, 143.4],
    [242.5, 143.4],
    [273.5, 143.4],
    [304.5, 143.4],
    [41.0, 170.2],
    [72.0, 170.2],
    [103.0, 170.2],
    [134.0, 170.2],
    [165.0, 170.2],
    [196.0, 170.2],
    [227.0, 170.2],
    [258.0, 170.2],
    [289.0, 170.2],
    [25.5, 197.0],
    [56.5, 197.0],
    [87.5, 197.0],
    [118.5, 197.0],
    [149.5, 197.0],
    [180.5, 197.0],
    [211.5, 197.0],
    [242.5, 197.0],
    [273.5, 197.0],
    [304.5, 197.0],
    [41.0, 223.8],
    [72.0, 223.8],
    [103.0, 223.8],
    [134.0, 223.8],
    [165.0, 223.8],
    [196.0, 223.8],
    [227.0, 223.8],
    [258.0, 223.8],
    [289.0, 223.8],
    [25.5, 250.6],
    [56.5, 250.6],
    [87.5, 250.6],
    [118.5, 250.6],
    [149.5, 250.6],
    [180.5, 250.6],
    [211.5, 250.6],
    [242.5, 250.6],
    [273.5, 250.6],
    [304.5, 250.6],
    [41.0, 277.4],
    [72.0, 277.4],
    [103.0, 277.4],
    [134.0, 277.4],
    [165.0, 277.4],
    [196.0, 277.4],
    [227.0, 277.4],
    [258.0, 277.4],
    [289.0, 277.4],
    [25.5, 304.2],
    [56.5, 304.2],
    [87.5, 304.2],
    [118.5, 304.2],
    [149.5, 304.2],
    [180.5, 304.2],
    [211.5, 304.2],
    [242.5, 304.2],
    [273.5, 304.2],
    [304.5, 304.2],
    [41.0, 331.0],
    [72.0, 331.0],
    [103.0, 331.0],
    [134.0, 331.0],
    [165.0, 331.0],
    [196.0, 331.0],
    [227.0, 331.0],
    [258.0, 331.0],
    [289.0, 331.0],
  ],
  4: [
    [35.5, 35.0],
    [76.5, 35.0],
    [117.5, 35.0],
    [158.5, 35.0],
    [199.5, 35.0],
    [240.5, 35.0],
    [281.5, 35.0],
    [56.0, 70.5],
    [97.0, 70.5],
    [138.0, 70.5],
    [179.0, 70.5],
    [220.0, 70.5],
    [261.0, 70.5],
    [302.0, 70.5],
    [35.5, 106.0],
    [76.5, 106.0],
    [117.5, 106.0],
    [158.5, 106.0],
    [199.5, 106.0],
    [240.5, 106.0],
    [281.5, 106.0],
    [56.0, 141.5],
    [97.0, 141.5],
    [138.0, 141.5],
    [179.0, 141.5],
    [220.0, 141.5],
    [261.0, 141.5],
    [302.0, 141.5],
    [35.5, 177.0],
    [76.5, 177.0],
    [117.5, 177.0],
    [158.5, 177.0],
    [199.5, 177.0],
    [240.5, 177.0],
    [281.5, 177.0],
    [56.0, 212.5],
    [97.0, 212.5],
    [138.0, 212.5],
    [179.0, 212.5],
    [220.0, 212.5],
    [261.0, 212.5],
    [302.0, 212.5],
    [35.5, 248.0],
    [76.5, 248.0],
    [117.5, 248.0],
    [158.5, 248.0],
    [199.5, 248.0],
    [240.5, 248.0],
    [281.5, 248.0],
    [56.0, 283.5],
    [97.0, 283.5],
    [138.0, 283.5],
    [179.0, 283.5],
    [220.0, 283.5],
    [261.0, 283.5],
    [302.0, 283.5],
    [35.5, 319.0],
    [76.5, 319.0],
    [117.5, 319.0],
    [158.5, 319.0],
    [199.5, 319.0],
    [240.5, 319.0],
    [281.5, 319.0],
  ],
  5: [
    [32.4, 40.5],
    [120.8, 40.5],
    [209.2, 40.5],
    [297.6, 40.5],
    [76.6, 66.0],
    [165.0, 66.0],
    [253.4, 66.0],
    [32.4, 91.5],
    [120.8, 91.5],
    [209.2, 91.5],
    [297.6, 91.5],
    [76.6, 117.0],
    [165.0, 117.0],
    [253.4, 117.0],
    [32.4, 142.5],
    [120.8, 142.5],
    [209.2, 142.5],
    [297.6, 142.5],
    [76.6, 168.0],
    [165.0, 168.0],
    [253.4, 168.0],
    [32.4, 193.5],
    [120.8, 193.5],
    [209.2, 193.5],
    [297.6, 193.5],
    [76.6, 219.0],
    [165.0, 219.0],
    [253.4, 219.0],
    [32.4, 244.5],
    [120.8, 244.5],
    [209.2, 244.5],
    [297.6, 244.5],
    [76.6, 270.0],
    [165.0, 270.0],
    [253.4, 270.0],
    [32.4, 295.5],
    [120.8, 295.5],
    [209.2, 295.5],
    [297.6, 295.5],
    [76.6, 321.0],
    [165.0, 321.0],
    [253.4, 321.0],
  ],
  6: [
    [43.0, 52.0],
    [104.0, 52.0],
    [165.0, 52.0],
    [226.0, 52.0],
    [287.0, 52.0],
    [73.5, 104.8],
    [134.5, 104.8],
    [195.5, 104.8],
    [256.5, 104.8],
    [43.0, 157.6],
    [104.0, 157.6],
    [165.0, 157.6],
    [226.0, 157.6],
    [287.0, 157.6],
    [73.5, 210.4],
    [134.5, 210.4],
    [195.5, 210.4],
    [256.5, 210.4],
    [43.0, 263.2],
    [104.0, 263.2],
    [165.0, 263.2],
    [226.0, 263.2],
    [287.0, 263.2],
    [73.5, 316.0],
    [134.5, 316.0],
    [195.5, 316.0],
    [256.5, 316.0],
  ],
  7: [
    [42.4, 62.5],
    [165.0, 62.5],
    [287.6, 62.5],
    [103.7, 98.0],
    [226.3, 98.0],
    [42.4, 133.5],
    [165.0, 133.5],
    [287.6, 133.5],
    [103.7, 169.0],
    [226.3, 169.0],
    [42.4, 204.5],
    [165.0, 204.5],
    [287.6, 204.5],
    [103.7, 240.0],
    [226.3, 240.0],
    [42.4, 275.5],
    [165.0, 275.5],
    [287.6, 275.5],
    [103.7, 311.0],
    [226.3, 311.0],
  ],
  8: [
    [60.0, 55.5],
    [200.0, 55.5],
    [130.0, 96.0],
    [270.0, 96.0],
    [60.0, 136.5],
    [200.0, 136.5],
    [130.0, 177.0],
    [270.0, 177.0],
    [60.0, 217.5],
    [200.0, 217.5],
    [130.0, 258.0],
    [270.0, 258.0],
    [60.0, 298.5],
    [200.0, 298.5],
  ],
  9: [
    [51.25, 58.5],
    [142.25, 58.5],
    [233.25, 58.5],
    [96.75, 137.5],
    [187.75, 137.5],
    [278.75, 137.5],
    [51.25, 216.5],
    [142.25, 216.5],
    [233.25, 216.5],
    [96.75, 295.5],
    [187.75, 295.5],
    [278.75, 295.5],
  ],
};

// [DECAL] File lưu đường dẫn pon (theo khổ 33x35.4 / 33x35).
function _decalMemoFile() {
  return new File(Folder.userData + "/dan_decal_pon_paths.txt");
}
// [DECAL] Đọc bảng đường dẫn pon đã lưu.
function _decalReadPaths() {
  var f = _decalMemoFile(),
    map = {};
  if (f.exists) {
    f.encoding = "UTF-8";
    f.open("r");
    var txt = f.read();
    f.close();
    var lines = txt.split(/\r\n|\r|\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line || line.charAt(0) === "#") continue;
      // phân tách bằng TAB (đường dẫn Windows có thể chứa dấu = nhưng không có tab)
      var tab = line.indexOf("\t");
      if (tab < 0) continue;
      var k = line.substring(0, tab);
      var v = line.substring(tab + 1);
      if (k) map[k] = v;
    }
  }
  return map;
}
// [DECAL] Lưu đường dẫn pon cho 1 khổ.
function _decalWritePath(key, path) {
  var map = _decalReadPaths();
  map[key] = path;
  var f = _decalMemoFile();
  try {
    f.encoding = "UTF-8";
    f.open("w");
    f.write("# Duong dan file pon decal (key<TAB>path)\n");
    for (var k in map) f.write(k + "\t" + map[k] + "\n");
    f.close();
  } catch (e) {}
}
// [DECAL] Lấy file pon theo khổ; chưa có thì hỏi chọn, tự lưu.
function _decalGetPon(sizeKey) {
  var map = _decalReadPaths();
  if (map[sizeKey]) {
    var f = new File(map[sizeKey]);
    if (f.exists) return f;
  }
  var chosen = File.openDialog(
    "Chọn file pon khổ " + sizeKey + " (.ai) - chỉ hỏi 1 lần",
    "*.ai",
  );
  if (chosen && chosen.exists) {
    _decalWritePath(sizeKey, chosen.fsName);
    return chosen;
  }
  return null;
}

// [DECAL] Dàn object vào tọa độ các vòng tròn theo từng khổ decal đã cấu hình.
// Clip tròn theo KT object, chia đều nếu chọn nhiều object, import pon.
function dcDanDecal(decalSize, ponSizeKey) {
  if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
  var doc = app.activeDocument;
  var MM = 2.834645669;

  var sel = doc.selection;
  if (!sel || sel.length < 1) return "ERR: Chưa chọn object decal để dàn.";

  var CENTERS = DECAL_SETS[String(decalSize)];
  if (!CENTERS) return "ERR: Không có bộ tọa độ cho khổ " + decalSize + "cm.";

  // helper đo visible thật
  function _visLeaf(it) {
    try {
      if (it.hidden === true) return false;
      if (it.guides === true) return false;
    } catch (e) {}
    try {
      if (it.typename === "PathItem")
        return it.filled === true || it.stroked === true;
      if (it.typename === "CompoundPathItem") {
        if (it.pathItems.length > 0)
          return (
            it.pathItems[0].filled === true || it.pathItems[0].stroked === true
          );
        return false;
      }
    } catch (e) {}
    return true;
  }
  // [DECAL] Đo vùng bao thật của object (bản rút gọn cho decal).
  function _visUnion(item, acc) {
    function merge(b) {
      if (!b) return;
      if (!acc.val) {
        acc.val = b.slice(0);
        return;
      }
      var a = acc.val;
      if (b[0] < a[0]) a[0] = b[0];
      if (b[1] > a[1]) a[1] = b[1];
      if (b[2] > a[2]) a[2] = b[2];
      if (b[3] < a[3]) a[3] = b[3];
    }
    if (item.typename === "GroupItem") {
      var pit = item.pageItems;
      for (var i = 0; i < pit.length; i++) _visUnion(pit[i], acc);
      return;
    }
    if (_visLeaf(item)) {
      try {
        merge(item.visibleBounds);
      } catch (e) {}
    }
  }
  // [DECAL] Phá appearance của object.
  function _expand(item) {
    try {
      app.selection = null;
      item.selected = true;
      app.executeMenuCommand("expandStyle");
      var s = app.selection;
      if (s && s.length === 1) {
        var r = s[0];
        app.selection = null;
        return r;
      }
      app.selection = null;
    } catch (e) {}
    return item;
  }
  // clip 1 object theo hình tròn đúng KT của nó -> trả object đã clip+expand
  function _clipRound(item) {
    var acc = { val: null };
    _visUnion(item, acc);
    var vb = acc.val;
    if (!vb) {
      try {
        vb = item.visibleBounds;
      } catch (e) {
        vb = item.geometricBounds;
      }
    }
    var dia = Math.max(vb[2] - vb[0], vb[1] - vb[3]);
    var ocx = (vb[0] + vb[2]) / 2,
      ocy = (vb[1] + vb[3]) / 2;
    var lay = item.layer;
    var circle = lay.pathItems.ellipse(ocy + dia / 2, ocx - dia / 2, dia, dia);
    var g = lay.groupItems.add();
    circle.move(g, ElementPlacement.PLACEATBEGINNING);
    item.move(g, ElementPlacement.PLACEATEND);
    circle.clipping = true;
    g.clipped = true;
    return _expand(g);
  }

  // ---- Gom các object đã chọn thành danh sách nguồn (mỗi object 1 nhóm) ----
  // Nếu chọn N object -> chia CENTERS thành N phần theo thứ tự.
  var srcRaw = [];
  for (var i = 0; i < sel.length; i++) srcRaw.push(sel[i]);

  // clip từng object nguồn theo hình tròn KT của nó
  var sources = [];
  for (i = 0; i < srcRaw.length; i++) {
    sources.push(_clipRound(srcRaw[i]));
  }
  var nSrc = sources.length;
  var nPos = CENTERS.length;

  // ---- Import pon ----
  var ponFile = _decalGetPon(ponSizeKey);
  if (!ponFile) {
    for (i = 0; i < sources.length; i++) {
      try {
        sources[i].remove();
      } catch (e) {}
    }
    return "ERR: Chưa chọn file pon.";
  }

  var destName = doc.name;
  var oldAbCount = doc.artboards.length;
  var ponDoc = app.open(ponFile);
  app.activeDocument = ponDoc;
  var abRects = [];
  for (var a = 0; a < ponDoc.artboards.length; a++)
    abRects.push(ponDoc.artboards[a].artboardRect.slice(0));

  app.activeDocument = doc;
  var destLayer = doc.activeLayer;
  app.activeDocument = ponDoc;
  var ponItems = [];
  for (i = 0; i < ponDoc.pageItems.length; i++)
    ponItems.push(ponDoc.pageItems[i]);
  var ponGroupDup = null;
  if (ponItems.length > 0) {
    var ponGroup = ponDoc.groupItems.add();
    for (i = ponItems.length - 1; i >= 0; i--) {
      try {
        ponItems[i].move(ponGroup, ElementPlacement.PLACEATBEGINNING);
      } catch (e) {}
    }
    try {
      ponGroupDup = ponGroup.duplicate(destLayer, ElementPlacement.PLACEATEND);
    } catch (e) {}
  }
  app.activeDocument = ponDoc;
  ponDoc.close(SaveOptions.DONOTSAVECHANGES);

  var dd = null;
  for (i = 0; i < app.documents.length; i++)
    if (app.documents[i].name === destName) {
      dd = app.documents[i];
      break;
    }
  if (dd) {
    doc = dd;
    app.activeDocument = doc;
  }

  // ---- Copy artboard từ pon ----
  if (abRects.length > 0) {
    for (a = 0; a < abRects.length; a++) doc.artboards.add(abRects[a]);
    if (doc.artboards.length > abRects.length) {
      for (a = oldAbCount - 1; a >= 0; a--) {
        try {
          doc.artboards.remove(a);
        } catch (e) {}
      }
    }
  }

  // ---- Bù ruler: dịch pon cho khớp artboard ----
  var ponDx = 0,
    ponDy = 0;
  if (ponGroupDup && abRects.length > 0) {
    var wl = 1e12,
      wt = -1e12,
      wr = -1e12,
      wb = 1e12;
    for (a = 0; a < abRects.length; a++) {
      var rr = abRects[a];
      if (rr[0] < wl) wl = rr[0];
      if (rr[1] > wt) wt = rr[1];
      if (rr[2] > wr) wr = rr[2];
      if (rr[3] < wb) wb = rr[3];
    }
    var wantCx = (wl + wr) / 2,
      wantCy = (wt + wb) / 2;
    var pgb = ponGroupDup.geometricBounds;
    var ponCx = (pgb[0] + pgb[2]) / 2,
      ponCy = (pgb[1] + pgb[3]) / 2;
    ponDx = wantCx - ponCx;
    ponDy = wantCy - ponCy;
    if (Math.abs(ponDx) > 0.5 || Math.abs(ponDy) > 0.5) {
      try {
        ponGroupDup.translate(ponDx, ponDy);
      } catch (e) {}
    }
  }

  // ---- Dàn: chia CENTERS cho N object theo THỨ TỰ ----
  // obj0 điền [0 .. k0), obj1 điền [k0 .. k1)... mỗi phần ceil/floor.
  var abNow = doc.artboards[0].artboardRect;
  var abL = abNow[0],
    abT = abNow[1];
  var decalGroup = doc.groupItems.add();
  var placed = 0;

  // tính ranh giới chia: phân bố đều nPos vị trí cho nSrc object
  // vị trí thứ p dùng object index = floor(p * nSrc / nPos)
  for (var p = 0; p < nPos; p++) {
    var srcIdx = Math.floor((p * nSrc) / nPos);
    if (srcIdx >= nSrc) srcIdx = nSrc - 1;
    var srcObj = sources[srcIdx];
    var tX = abL + CENTERS[p][0] * MM;
    var tY = abT - CENTERS[p][1] * MM;
    var dup;
    try {
      dup = srcObj.duplicate(decalGroup, ElementPlacement.PLACEATEND);
    } catch (e) {
      continue;
    }
    var dvb = dup.visibleBounds;
    var cx = (dvb[0] + dvb[2]) / 2,
      cy = (dvb[1] + dvb[3]) / 2;
    try {
      dup.translate(tX - cx, tY - cy);
    } catch (e) {}
    placed++;
  }
  // xóa các object nguồn gốc
  for (i = 0; i < sources.length; i++) {
    try {
      sources[i].remove();
    } catch (e) {}
  }

  app.redraw();
  var info = nSrc > 1 ? " (" + nSrc + " mẫu chia đều)" : "";
  return "OK: Đã dàn " + placed + " decal " + decalSize + "cm" + info + ".";
}

// ============================================================
//  TAB ĐỔI TÊN: đổi tên hàng loạt object đã chọn.
//  Tham số:
//   prefix   : tiền tố (vd "s")
//   mode     : "num" | "low" | "up"
//   startStr : bắt đầu (số "1" hoặc chữ "a"/"A")
//   pad      : đệm số 0 (chỉ kiểu num), 0 = không đệm
//   bottomUp : true = dưới cùng đầu tiên; false = trên cùng đầu tiên
// ============================================================
function dcRename(prefix, mode, startStr, pad, bottomUp, repeat) {
  if (app.documents.length === 0) return "ERR: Chưa mở tài liệu.";
  var doc = app.activeDocument;
  var sel = doc.selection;
  if (!sel || sel.length === 0) return "ERR: Chưa chọn object nào.";

  prefix = prefix || "";
  mode = mode || "num";
  startStr = (startStr || "").replace(/^\s+|\s+$/g, "");
  pad = parseInt(pad, 10);
  if (isNaN(pad)) pad = 0;
  repeat = parseInt(repeat, 10);
  if (isNaN(repeat) || repeat < 1) repeat = 1; // số layer lặp mỗi nhãn (s1,s1,s2,s2)

  // Đệm số 0 phía trước cho đủ độ dài (vd 3 -> 003).
  function _pad(n, len) {
    var s = "" + n;
    while (s.length < len) s = "0" + s;
    return s;
  }
  // Đổi số thành chữ cái (1->a, 2->b... 27->aa). upper=true thì HOA.
  function toAlpha(num, upper) {
    var s = "";
    while (num > 0) {
      var r = (num - 1) % 26;
      s = String.fromCharCode((upper ? 65 : 97) + r) + s;
      num = Math.floor((num - 1) / 26);
    }
    return s;
  }
  // Đổi chữ cái thành số (a->1, b->2...).
  function fromAlpha(str) {
    str = str.toLowerCase();
    var num = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i) - 97;
      if (c < 0 || c > 25) return 1;
      num = num * 26 + (c + 1);
    }
    return num;
  }

  var startVal;
  if (mode === "num") {
    startVal = parseInt(startStr, 10);
    if (isNaN(startVal)) startVal = 1;
  } else {
    if (/^[a-zA-Z]+$/.test(startStr)) startVal = fromAlpha(startStr);
    else {
      startVal = parseInt(startStr, 10);
      if (isNaN(startVal)) startVal = 1;
    }
  }

  function label(i) {
    var v = startVal + i;
    if (mode === "num") return prefix + (pad > 0 ? _pad(v, pad) : v);
    return prefix + toAlpha(v, mode === "up");
  }

  var arr = [];
  for (var i = 0; i < sel.length; i++) arr.push(sel[i]);
  arr.sort(function (a, b) {
    return a.zOrderPosition - b.zOrderPosition;
  });
  if (!bottomUp) arr.reverse();

  for (var k = 0; k < arr.length; k++) {
    var groupIndex = Math.floor(k / repeat); // repeat=2 -> s1,s1,s2,s2
    arr[k].name = label(groupIndex);
  }

  var lastGroup = Math.floor((arr.length - 1) / repeat);
  return (
    "OK: Đã đổi tên " +
    arr.length +
    " object (" +
    label(0) +
    " ... " +
    label(lastGroup) +
    ")."
  );
}

// ============================================================
//  TAB VARIABLE: chạy công cụ VariableImporter (UI gốc ScriptUI).
//  Nhúng nguyên script; hàm dcRunVariable() gọi khi bấm nút.
// ============================================================

function VariableImporter() {
  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement, fromIndex) {
      var k;
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }
      var o = Object(this);
      var len = o.length >>> 0;
      if (len === 0) {
        return -1;
      }
      var n = +fromIndex || 0;
      if (Math.abs(n) === Infinity) {
        n = 0;
      }
      if (n >= len) {
        return -1;
      }
      k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
      while (k < len) {
        if (k in o && o[k] === searchElement) {
          return k;
        }
        k++;
      }
      return -1;
    };
  }

  Array.prototype.compare = function (array) {
    // if the other array is a falsy value, return
    if (!array) return false;

    // compare lengths - can save a lot of time
    if (this.length != array.length) return false;

    this.sort();
    array.sort();
    for (var i = 0; i < this.length; i++) {
      // Check if we have nested arrays
      if (this[i] instanceof Array && array[i] instanceof Array) {
        // recurse into the nested arrays
        if (!this[i].compare(array[i])) {
          return false;
        }
      } else if (this[i] != array[i]) {
        // Warning - two different object instances will never be equal: {x:20} != {x:20}
        return false;
      }
    }
    return true;
  };

  //http://stackoverflow.com/a/25094986/2864371
  function arrayMakeUnique(arr) {
    if (arr.length < 1) {
      return [];
    }
    var a = arr.slice(0);
    var b = a.length,
      c;
    while ((c = --b)) {
      while (c--) {
        a[b] !== a[c] || a.splice(c, 1);
      }
    }
    return a;
  }

  function arrayGetAllDuplicates(arr) {
    if (arr.length < 1) {
      return [];
    }
    var a = arr.slice(0);
    var b = a.length,
      d = [],
      c;
    while ((c = --b)) {
      while (c--) {
        a[b] !== a[c] || d.push(a.splice(c, 1)[0]);
      }
    }
    return d;
  }

  function arrayGetUniqueDuplicates(arr) {
    return arrayMakeUnique(arrayGetAllDuplicates(arr));
  }

  function checkForSingleDuplicate(array, value) {
    var found = [],
      thisCell;
    for (var i = 0; i < array.length; i++) {
      thisCell = array[i];
      if (thisCell == value) {
        found.push(value);
      }
    }
    return found;
  }

  ("object" != typeof JSON && (JSON = {}),
    (function () {
      "use strict";
      function f(t) {
        return 10 > t ? "0" + t : t;
      }
      function quote(t) {
        return (
          (escapable.lastIndex = 0),
          escapable.test(t)
            ? '"' +
              t.replace(escapable, function (t) {
                var e = meta[t];
                return "string" == typeof e
                  ? e
                  : "\\u" + ("0000" + t.charCodeAt(0).toString(16)).slice(-4);
              }) +
              '"'
            : '"' + t + '"'
        );
      }
      function str(t, e) {
        var n,
          r,
          o,
          f,
          u,
          i = gap,
          p = e[t];
        switch (
          (p &&
            "object" == typeof p &&
            "function" == typeof p.toJSON &&
            (p = p.toJSON(t)),
          "function" == typeof rep && (p = rep.call(e, t, p)),
          typeof p)
        ) {
          case "string":
            return quote(p);
          case "number":
            return isFinite(p) ? String(p) : "null";
          case "boolean":
          case "null":
            return String(p);
          case "object":
            if (!p) return "null";
            if (
              ((gap += indent),
              (u = []),
              "[object Array]" === Object.prototype.toString.apply(p))
            ) {
              for (f = p.length, n = 0; f > n; n += 1)
                u[n] = str(n, p) || "null";
              return (
                (o =
                  0 === u.length
                    ? "[]"
                    : gap
                      ? "[\n" + gap + u.join(",\n" + gap) + "\n" + i + "]"
                      : "[" + u.join(",") + "]"),
                (gap = i),
                o
              );
            }
            if (rep && "object" == typeof rep)
              for (f = rep.length, n = 0; f > n; n += 1)
                "string" == typeof rep[n] &&
                  ((r = rep[n]),
                  (o = str(r, p)),
                  o && u.push(quote(r) + (gap ? ": " : ":") + o));
            else
              for (r in p)
                Object.prototype.hasOwnProperty.call(p, r) &&
                  ((o = str(r, p)),
                  o && u.push(quote(r) + (gap ? ": " : ":") + o));
            return (
              (o =
                0 === u.length
                  ? "{}"
                  : gap
                    ? "{\n" + gap + u.join(",\n" + gap) + "\n" + i + "}"
                    : "{" + u.join(",") + "}"),
              (gap = i),
              o
            );
        }
      }
      "function" != typeof Date.prototype.toJSON &&
        ((Date.prototype.toJSON = function () {
          return isFinite(this.valueOf())
            ? this.getUTCFullYear() +
                "-" +
                f(this.getUTCMonth() + 1) +
                "-" +
                f(this.getUTCDate()) +
                "T" +
                f(this.getUTCHours()) +
                ":" +
                f(this.getUTCMinutes()) +
                ":" +
                f(this.getUTCSeconds()) +
                "Z"
            : null;
        }),
        (String.prototype.toJSON =
          Number.prototype.toJSON =
          Boolean.prototype.toJSON =
            function () {
              return this.valueOf();
            }));
      var cx, escapable, gap, indent, meta, rep;
      ("function" != typeof JSON.stringify &&
        ((escapable =
          /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g),
        (meta = {
          "\b": "\\b",
          "  ": "\\t",
          "\n": "\\n",
          "\f": "\\f",
          "\r": "\\r",
          '"': '\\"',
          "\\": "\\\\",
        }),
        (JSON.stringify = function (t, e, n) {
          var r;
          if (((gap = ""), (indent = ""), "number" == typeof n))
            for (r = 0; n > r; r += 1) indent += " ";
          else "string" == typeof n && (indent = n);
          if (
            ((rep = e),
            e &&
              "function" != typeof e &&
              ("object" != typeof e || "number" != typeof e.length))
          )
            throw new Error("JSON.stringify");
          return str("", { "": t });
        })),
        "function" != typeof JSON.parse &&
          ((cx =
            /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g),
          (JSON.parse = function (text, reviver) {
            function walk(t, e) {
              var n,
                r,
                o = t[e];
              if (o && "object" == typeof o)
                for (n in o)
                  Object.prototype.hasOwnProperty.call(o, n) &&
                    ((r = walk(o, n)), void 0 !== r ? (o[n] = r) : delete o[n]);
              return reviver.call(t, e, o);
            }
            var j;
            if (
              ((text = String(text)),
              (cx.lastIndex = 0),
              cx.test(text) &&
                (text = text.replace(cx, function (t) {
                  return (
                    "\\u" + ("0000" + t.charCodeAt(0).toString(16)).slice(-4)
                  );
                })),
              /^[\],:{}\s]*$/.test(
                text
                  .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@")
                  .replace(
                    /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,
                    "]",
                  )
                  .replace(/(?:^|:|,)(?:\s*\[)+/g, ""),
              ))
            )
              return (
                (j = eval("(" + text + ")")),
                "function" == typeof reviver ? walk({ "": j }, "") : j
              );
            throw new SyntaxError("JSON.parse");
          })));
    })());

  var tvdhve = "These violent delights have violent ends...";

  function clone(obj) {
    var copy;
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;
    // Handle Date
    if (obj instanceof Date) {
      copy = new Date();
      copy.setTime(obj.getTime());
      return copy;
    }
    // Handle Array
    if (obj instanceof Array) {
      copy = [];
      for (var i = 0, len = obj.length; i < len; i++) {
        copy[i] = clone(obj[i]);
      }
      return copy;
    }
    // Handle Object
    if (obj instanceof Object) {
      copy = {};
      for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
      }
      return copy;
    }
    throw new Error("Unable to copy obj! Its type isn't supported.");
  }

  String.prototype.trim = function () {
    return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
  };

  if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (callback, thisArg) {
      var T, k;
      if (this == null) {
        throw new TypeError(" this is null or not defined");
      }
      var O = Object(this);
      var len = O.length >>> 0;
      if (typeof callback !== "function") {
        throw new TypeError(callback + " is not a function");
      }
      if (arguments.length > 1) {
        T = thisArg;
      }
      k = 0;
      while (k < len) {
        var kValue;
        if (k in O) {
          kValue = O[k];
          callback.call(T, kValue, k, O);
        }
        k++;
      }
    };
  }

  function unCamelCaseSplit(str) {
    var newStr =
      str[0].toUpperCase() +
      str
        .split(/([A-Z][a-z]+)/g)
        .join(" ")
        .replace(/\s{2}/g, " ")
        .substr(1);
    return newStr;
  }

  Number.prototype.padZero = function (decimals) {
    if (typeof decimals == "undefined") {
      decimals = 2;
    }
    var numStr = this.toString();
    var decimalsFound = numStr.length;
    if (decimalsFound >= decimals) {
      return this;
    }
    while (decimalsFound < decimals) {
      numStr = "0" + numStr;
      decimalsFound += 1;
    }
    return numStr;
  };

  function writeImageFile(binary, dest) {
    if ((!dest) instanceof "File") {
      dest = File(dest);
    }
    try {
      dest.encoding = "BINARY";
      dest.open("w");
      dest.write(binary);
      dest.close();
    } catch (e) {
      scriptAlert("writeImageFile(binary, dest)\r" + e);
    }
  }

  function getScriptImage(imageObj) {
    var scriptDataFolder = SESSION.scriptDataFolder;
    if (!scriptDataFolder) {
      return false;
    }
    var thisFile = File(scriptDataFolder + "/" + imageObj.name + ".png");
    if (!thisFile.exists) {
      writeImageFile(imageObj.data, thisFile);
      if (!thisFile.exists) {
        return false;
      }
    }
    return thisFile;
  }

  var CSV = {
    parse: function (csv, reviver, splitter) {
      splitter = splitter || ",";
      reviver =
        reviver ||
        function (r, c, v) {
          return v;
        };
      var chars = csv.split(""),
        c = 0,
        cc = chars.length,
        start,
        end,
        table = [],
        row;
      while (c < cc) {
        table.push((row = []));
        while (c < cc && "\r" !== chars[c] && "\n" !== chars[c]) {
          start = end = c;
          if ('"' === chars[c]) {
            start = end = ++c;
            while (c < cc) {
              if ('"' === chars[c]) {
                if ('"' !== chars[c + 1]) {
                  break;
                } else {
                  chars[++c] = "";
                } // unescape ""
              }
              end = ++c;
            }
            if ('"' === chars[c]) {
              ++c;
            }
            while (
              c < cc &&
              "\r" !== chars[c] &&
              "\n" !== chars[c] &&
              splitter !== chars[c]
            ) {
              ++c;
            }
          } else {
            while (
              c < cc &&
              "\r" !== chars[c] &&
              "\n" !== chars[c] &&
              splitter !== chars[c]
            ) {
              end = ++c;
            }
          }
          row.push(
            reviver(
              table.length - 1,
              row.length,
              chars.slice(start, end).join(""),
            ),
          );
          if (splitter === chars[c]) {
            ++c;
          }
        }
        if ("\r" === chars[c]) {
          ++c;
        }
        if ("\n" === chars[c]) {
          ++c;
        }
      }
      return table;
    },
    stringify: function (table, replacer, splitter) {
      replacer =
        replacer ||
        function (r, c, v) {
          return v;
        };
      var csv = "",
        c,
        cc,
        r,
        rr = table.length,
        cell;
      for (r = 0; r < rr; ++r) {
        if (r) {
          csv += "\r\n";
        }
        for (c = 0, cc = table[r].length; c < cc; ++c) {
          if (c) {
            csv += splitter;
          }
          cell = replacer(r, c, table[r][c]);
          var rx = new RegExp("[" + splitter + "]\\r" + '\\n"');
          if (rx.test(cell)) {
            cell = '"' + cell.replace(/"/g, '""') + '"';
          }
          csv += cell || 0 === cell ? cell : "";
        }
      }
      return csv;
    },
  };

  // Vietnamese NFC fallback for ExtendScript (no String.normalize).
  // Decompose first so mixed precomposed letters + separate tones also work.
  function viNormalizeVietnamese(text) {
    var decompositions = {
      "\u00c0": "A\u0300",
      "\u00c1": "A\u0301",
      "\u00c2": "A\u0302",
      "\u00c3": "A\u0303",
      "\u00c4": "A\u0308",
      "\u00c5": "A\u030a",
      "\u00c8": "E\u0300",
      "\u00c9": "E\u0301",
      "\u00ca": "E\u0302",
      "\u00cb": "E\u0308",
      "\u00cc": "I\u0300",
      "\u00cd": "I\u0301",
      "\u00ce": "I\u0302",
      "\u00cf": "I\u0308",
      "\u00d2": "O\u0300",
      "\u00d3": "O\u0301",
      "\u00d4": "O\u0302",
      "\u00d5": "O\u0303",
      "\u00d6": "O\u0308",
      "\u00d9": "U\u0300",
      "\u00da": "U\u0301",
      "\u00db": "U\u0302",
      "\u00dc": "U\u0308",
      "\u00dd": "Y\u0301",
      "\u00e0": "a\u0300",
      "\u00e1": "a\u0301",
      "\u00e2": "a\u0302",
      "\u00e3": "a\u0303",
      "\u00e4": "a\u0308",
      "\u00e5": "a\u030a",
      "\u00e8": "e\u0300",
      "\u00e9": "e\u0301",
      "\u00ea": "e\u0302",
      "\u00eb": "e\u0308",
      "\u00ec": "i\u0300",
      "\u00ed": "i\u0301",
      "\u00ee": "i\u0302",
      "\u00ef": "i\u0308",
      "\u00f2": "o\u0300",
      "\u00f3": "o\u0301",
      "\u00f4": "o\u0302",
      "\u00f5": "o\u0303",
      "\u00f6": "o\u0308",
      "\u00f9": "u\u0300",
      "\u00fa": "u\u0301",
      "\u00fb": "u\u0302",
      "\u00fc": "u\u0308",
      "\u00fd": "y\u0301",
      "\u00ff": "y\u0308",
      "\u0100": "A\u0304",
      "\u0101": "a\u0304",
      "\u0102": "A\u0306",
      "\u0103": "a\u0306",
      "\u0104": "A\u0328",
      "\u0105": "a\u0328",
      "\u0112": "E\u0304",
      "\u0113": "e\u0304",
      "\u0114": "E\u0306",
      "\u0115": "e\u0306",
      "\u0116": "E\u0307",
      "\u0117": "e\u0307",
      "\u0118": "E\u0328",
      "\u0119": "e\u0328",
      "\u011a": "E\u030c",
      "\u011b": "e\u030c",
      "\u0128": "I\u0303",
      "\u0129": "i\u0303",
      "\u012a": "I\u0304",
      "\u012b": "i\u0304",
      "\u012c": "I\u0306",
      "\u012d": "i\u0306",
      "\u012e": "I\u0328",
      "\u012f": "i\u0328",
      "\u0130": "I\u0307",
      "\u014c": "O\u0304",
      "\u014d": "o\u0304",
      "\u014e": "O\u0306",
      "\u014f": "o\u0306",
      "\u0150": "O\u030b",
      "\u0151": "o\u030b",
      "\u0168": "U\u0303",
      "\u0169": "u\u0303",
      "\u016a": "U\u0304",
      "\u016b": "u\u0304",
      "\u016c": "U\u0306",
      "\u016d": "u\u0306",
      "\u016e": "U\u030a",
      "\u016f": "u\u030a",
      "\u0170": "U\u030b",
      "\u0171": "u\u030b",
      "\u0172": "U\u0328",
      "\u0173": "u\u0328",
      "\u0176": "Y\u0302",
      "\u0177": "y\u0302",
      "\u0178": "Y\u0308",
      "\u01a0": "O\u031b",
      "\u01a1": "o\u031b",
      "\u01af": "U\u031b",
      "\u01b0": "u\u031b",
      "\u01cd": "A\u030c",
      "\u01ce": "a\u030c",
      "\u01cf": "I\u030c",
      "\u01d0": "i\u030c",
      "\u01d1": "O\u030c",
      "\u01d2": "o\u030c",
      "\u01d3": "U\u030c",
      "\u01d4": "u\u030c",
      "\u01d5": "U\u0308\u0304",
      "\u01d6": "u\u0308\u0304",
      "\u01d7": "U\u0308\u0301",
      "\u01d8": "u\u0308\u0301",
      "\u01d9": "U\u0308\u030c",
      "\u01da": "u\u0308\u030c",
      "\u01db": "U\u0308\u0300",
      "\u01dc": "u\u0308\u0300",
      "\u01de": "A\u0308\u0304",
      "\u01df": "a\u0308\u0304",
      "\u01e0": "A\u0307\u0304",
      "\u01e1": "a\u0307\u0304",
      "\u01ea": "O\u0328",
      "\u01eb": "o\u0328",
      "\u01ec": "O\u0328\u0304",
      "\u01ed": "o\u0328\u0304",
      "\u01fa": "A\u030a\u0301",
      "\u01fb": "a\u030a\u0301",
      "\u0200": "A\u030f",
      "\u0201": "a\u030f",
      "\u0202": "A\u0311",
      "\u0203": "a\u0311",
      "\u0204": "E\u030f",
      "\u0205": "e\u030f",
      "\u0206": "E\u0311",
      "\u0207": "e\u0311",
      "\u0208": "I\u030f",
      "\u0209": "i\u030f",
      "\u020a": "I\u0311",
      "\u020b": "i\u0311",
      "\u020c": "O\u030f",
      "\u020d": "o\u030f",
      "\u020e": "O\u0311",
      "\u020f": "o\u0311",
      "\u0214": "U\u030f",
      "\u0215": "u\u030f",
      "\u0216": "U\u0311",
      "\u0217": "u\u0311",
      "\u0226": "A\u0307",
      "\u0227": "a\u0307",
      "\u0228": "E\u0327",
      "\u0229": "e\u0327",
      "\u022a": "O\u0308\u0304",
      "\u022b": "o\u0308\u0304",
      "\u022c": "O\u0303\u0304",
      "\u022d": "o\u0303\u0304",
      "\u022e": "O\u0307",
      "\u022f": "o\u0307",
      "\u0230": "O\u0307\u0304",
      "\u0231": "o\u0307\u0304",
      "\u0232": "Y\u0304",
      "\u0233": "y\u0304",
      "\u1e00": "A\u0325",
      "\u1e01": "a\u0325",
      "\u1e14": "E\u0304\u0300",
      "\u1e15": "e\u0304\u0300",
      "\u1e16": "E\u0304\u0301",
      "\u1e17": "e\u0304\u0301",
      "\u1e18": "E\u032d",
      "\u1e19": "e\u032d",
      "\u1e1a": "E\u0330",
      "\u1e1b": "e\u0330",
      "\u1e1c": "E\u0327\u0306",
      "\u1e1d": "e\u0327\u0306",
      "\u1e2c": "I\u0330",
      "\u1e2d": "i\u0330",
      "\u1e2e": "I\u0308\u0301",
      "\u1e2f": "i\u0308\u0301",
      "\u1e4c": "O\u0303\u0301",
      "\u1e4d": "o\u0303\u0301",
      "\u1e4e": "O\u0303\u0308",
      "\u1e4f": "o\u0303\u0308",
      "\u1e50": "O\u0304\u0300",
      "\u1e51": "o\u0304\u0300",
      "\u1e52": "O\u0304\u0301",
      "\u1e53": "o\u0304\u0301",
      "\u1e72": "U\u0324",
      "\u1e73": "u\u0324",
      "\u1e74": "U\u0330",
      "\u1e75": "u\u0330",
      "\u1e76": "U\u032d",
      "\u1e77": "u\u032d",
      "\u1e78": "U\u0303\u0301",
      "\u1e79": "u\u0303\u0301",
      "\u1e7a": "U\u0304\u0308",
      "\u1e7b": "u\u0304\u0308",
      "\u1e8e": "Y\u0307",
      "\u1e8f": "y\u0307",
      "\u1e99": "y\u030a",
      "\u1ea0": "A\u0323",
      "\u1ea1": "a\u0323",
      "\u1ea2": "A\u0309",
      "\u1ea3": "a\u0309",
      "\u1ea4": "A\u0302\u0301",
      "\u1ea5": "a\u0302\u0301",
      "\u1ea6": "A\u0302\u0300",
      "\u1ea7": "a\u0302\u0300",
      "\u1ea8": "A\u0302\u0309",
      "\u1ea9": "a\u0302\u0309",
      "\u1eaa": "A\u0302\u0303",
      "\u1eab": "a\u0302\u0303",
      "\u1eac": "A\u0323\u0302",
      "\u1ead": "a\u0323\u0302",
      "\u1eae": "A\u0306\u0301",
      "\u1eaf": "a\u0306\u0301",
      "\u1eb0": "A\u0306\u0300",
      "\u1eb1": "a\u0306\u0300",
      "\u1eb2": "A\u0306\u0309",
      "\u1eb3": "a\u0306\u0309",
      "\u1eb4": "A\u0306\u0303",
      "\u1eb5": "a\u0306\u0303",
      "\u1eb6": "A\u0323\u0306",
      "\u1eb7": "a\u0323\u0306",
      "\u1eb8": "E\u0323",
      "\u1eb9": "e\u0323",
      "\u1eba": "E\u0309",
      "\u1ebb": "e\u0309",
      "\u1ebc": "E\u0303",
      "\u1ebd": "e\u0303",
      "\u1ebe": "E\u0302\u0301",
      "\u1ebf": "e\u0302\u0301",
      "\u1ec0": "E\u0302\u0300",
      "\u1ec1": "e\u0302\u0300",
      "\u1ec2": "E\u0302\u0309",
      "\u1ec3": "e\u0302\u0309",
      "\u1ec4": "E\u0302\u0303",
      "\u1ec5": "e\u0302\u0303",
      "\u1ec6": "E\u0323\u0302",
      "\u1ec7": "e\u0323\u0302",
      "\u1ec8": "I\u0309",
      "\u1ec9": "i\u0309",
      "\u1eca": "I\u0323",
      "\u1ecb": "i\u0323",
      "\u1ecc": "O\u0323",
      "\u1ecd": "o\u0323",
      "\u1ece": "O\u0309",
      "\u1ecf": "o\u0309",
      "\u1ed0": "O\u0302\u0301",
      "\u1ed1": "o\u0302\u0301",
      "\u1ed2": "O\u0302\u0300",
      "\u1ed3": "o\u0302\u0300",
      "\u1ed4": "O\u0302\u0309",
      "\u1ed5": "o\u0302\u0309",
      "\u1ed6": "O\u0302\u0303",
      "\u1ed7": "o\u0302\u0303",
      "\u1ed8": "O\u0323\u0302",
      "\u1ed9": "o\u0323\u0302",
      "\u1eda": "O\u031b\u0301",
      "\u1edb": "o\u031b\u0301",
      "\u1edc": "O\u031b\u0300",
      "\u1edd": "o\u031b\u0300",
      "\u1ede": "O\u031b\u0309",
      "\u1edf": "o\u031b\u0309",
      "\u1ee0": "O\u031b\u0303",
      "\u1ee1": "o\u031b\u0303",
      "\u1ee2": "O\u031b\u0323",
      "\u1ee3": "o\u031b\u0323",
      "\u1ee4": "U\u0323",
      "\u1ee5": "u\u0323",
      "\u1ee6": "U\u0309",
      "\u1ee7": "u\u0309",
      "\u1ee8": "U\u031b\u0301",
      "\u1ee9": "u\u031b\u0301",
      "\u1eea": "U\u031b\u0300",
      "\u1eeb": "u\u031b\u0300",
      "\u1eec": "U\u031b\u0309",
      "\u1eed": "u\u031b\u0309",
      "\u1eee": "U\u031b\u0303",
      "\u1eef": "u\u031b\u0303",
      "\u1ef0": "U\u031b\u0323",
      "\u1ef1": "u\u031b\u0323",
      "\u1ef2": "Y\u0300",
      "\u1ef3": "y\u0300",
      "\u1ef4": "Y\u0323",
      "\u1ef5": "y\u0323",
      "\u1ef6": "Y\u0309",
      "\u1ef7": "y\u0309",
      "\u1ef8": "Y\u0303",
      "\u1ef9": "y\u0303",
    };
    var compositions = {
      "A\u0300": "\u00c0",
      "A\u0301": "\u00c1",
      "A\u0302": "\u00c2",
      "A\u0303": "\u00c3",
      "A\u0308": "\u00c4",
      "A\u030a": "\u00c5",
      "E\u0300": "\u00c8",
      "E\u0301": "\u00c9",
      "E\u0302": "\u00ca",
      "E\u0308": "\u00cb",
      "I\u0300": "\u00cc",
      "I\u0301": "\u00cd",
      "I\u0302": "\u00ce",
      "I\u0308": "\u00cf",
      "O\u0300": "\u00d2",
      "O\u0301": "\u00d3",
      "O\u0302": "\u00d4",
      "O\u0303": "\u00d5",
      "O\u0308": "\u00d6",
      "U\u0300": "\u00d9",
      "U\u0301": "\u00da",
      "U\u0302": "\u00db",
      "U\u0308": "\u00dc",
      "Y\u0301": "\u00dd",
      "a\u0300": "\u00e0",
      "a\u0301": "\u00e1",
      "a\u0302": "\u00e2",
      "a\u0303": "\u00e3",
      "a\u0308": "\u00e4",
      "a\u030a": "\u00e5",
      "e\u0300": "\u00e8",
      "e\u0301": "\u00e9",
      "e\u0302": "\u00ea",
      "e\u0308": "\u00eb",
      "i\u0300": "\u00ec",
      "i\u0301": "\u00ed",
      "i\u0302": "\u00ee",
      "i\u0308": "\u00ef",
      "o\u0300": "\u00f2",
      "o\u0301": "\u00f3",
      "o\u0302": "\u00f4",
      "o\u0303": "\u00f5",
      "o\u0308": "\u00f6",
      "u\u0300": "\u00f9",
      "u\u0301": "\u00fa",
      "u\u0302": "\u00fb",
      "u\u0308": "\u00fc",
      "y\u0301": "\u00fd",
      "y\u0308": "\u00ff",
      "A\u0304": "\u0100",
      "a\u0304": "\u0101",
      "A\u0306": "\u0102",
      "a\u0306": "\u0103",
      "A\u0328": "\u0104",
      "a\u0328": "\u0105",
      "E\u0304": "\u0112",
      "e\u0304": "\u0113",
      "E\u0306": "\u0114",
      "e\u0306": "\u0115",
      "E\u0307": "\u0116",
      "e\u0307": "\u0117",
      "E\u0328": "\u0118",
      "e\u0328": "\u0119",
      "E\u030c": "\u011a",
      "e\u030c": "\u011b",
      "I\u0303": "\u0128",
      "i\u0303": "\u0129",
      "I\u0304": "\u012a",
      "i\u0304": "\u012b",
      "I\u0306": "\u012c",
      "i\u0306": "\u012d",
      "I\u0328": "\u012e",
      "i\u0328": "\u012f",
      "I\u0307": "\u0130",
      "O\u0304": "\u014c",
      "o\u0304": "\u014d",
      "O\u0306": "\u014e",
      "o\u0306": "\u014f",
      "O\u030b": "\u0150",
      "o\u030b": "\u0151",
      "U\u0303": "\u0168",
      "u\u0303": "\u0169",
      "U\u0304": "\u016a",
      "u\u0304": "\u016b",
      "U\u0306": "\u016c",
      "u\u0306": "\u016d",
      "U\u030a": "\u016e",
      "u\u030a": "\u016f",
      "U\u030b": "\u0170",
      "u\u030b": "\u0171",
      "U\u0328": "\u0172",
      "u\u0328": "\u0173",
      "Y\u0302": "\u0176",
      "y\u0302": "\u0177",
      "Y\u0308": "\u0178",
      "O\u031b": "\u01a0",
      "o\u031b": "\u01a1",
      "U\u031b": "\u01af",
      "u\u031b": "\u01b0",
      "A\u030c": "\u01cd",
      "a\u030c": "\u01ce",
      "I\u030c": "\u01cf",
      "i\u030c": "\u01d0",
      "O\u030c": "\u01d1",
      "o\u030c": "\u01d2",
      "U\u030c": "\u01d3",
      "u\u030c": "\u01d4",
      "U\u0308\u0304": "\u01d5",
      "u\u0308\u0304": "\u01d6",
      "U\u0308\u0301": "\u01d7",
      "u\u0308\u0301": "\u01d8",
      "U\u0308\u030c": "\u01d9",
      "u\u0308\u030c": "\u01da",
      "U\u0308\u0300": "\u01db",
      "u\u0308\u0300": "\u01dc",
      "A\u0308\u0304": "\u01de",
      "a\u0308\u0304": "\u01df",
      "A\u0307\u0304": "\u01e0",
      "a\u0307\u0304": "\u01e1",
      "O\u0328": "\u01ea",
      "o\u0328": "\u01eb",
      "O\u0328\u0304": "\u01ec",
      "o\u0328\u0304": "\u01ed",
      "A\u030a\u0301": "\u01fa",
      "a\u030a\u0301": "\u01fb",
      "A\u030f": "\u0200",
      "a\u030f": "\u0201",
      "A\u0311": "\u0202",
      "a\u0311": "\u0203",
      "E\u030f": "\u0204",
      "e\u030f": "\u0205",
      "E\u0311": "\u0206",
      "e\u0311": "\u0207",
      "I\u030f": "\u0208",
      "i\u030f": "\u0209",
      "I\u0311": "\u020a",
      "i\u0311": "\u020b",
      "O\u030f": "\u020c",
      "o\u030f": "\u020d",
      "O\u0311": "\u020e",
      "o\u0311": "\u020f",
      "U\u030f": "\u0214",
      "u\u030f": "\u0215",
      "U\u0311": "\u0216",
      "u\u0311": "\u0217",
      "A\u0307": "\u0226",
      "a\u0307": "\u0227",
      "E\u0327": "\u0228",
      "e\u0327": "\u0229",
      "O\u0308\u0304": "\u022a",
      "o\u0308\u0304": "\u022b",
      "O\u0303\u0304": "\u022c",
      "o\u0303\u0304": "\u022d",
      "O\u0307": "\u022e",
      "o\u0307": "\u022f",
      "O\u0307\u0304": "\u0230",
      "o\u0307\u0304": "\u0231",
      "Y\u0304": "\u0232",
      "y\u0304": "\u0233",
      "A\u0325": "\u1e00",
      "a\u0325": "\u1e01",
      "E\u0304\u0300": "\u1e14",
      "e\u0304\u0300": "\u1e15",
      "E\u0304\u0301": "\u1e16",
      "e\u0304\u0301": "\u1e17",
      "E\u032d": "\u1e18",
      "e\u032d": "\u1e19",
      "E\u0330": "\u1e1a",
      "e\u0330": "\u1e1b",
      "E\u0327\u0306": "\u1e1c",
      "e\u0327\u0306": "\u1e1d",
      "I\u0330": "\u1e2c",
      "i\u0330": "\u1e2d",
      "I\u0308\u0301": "\u1e2e",
      "i\u0308\u0301": "\u1e2f",
      "O\u0303\u0301": "\u1e4c",
      "o\u0303\u0301": "\u1e4d",
      "O\u0303\u0308": "\u1e4e",
      "o\u0303\u0308": "\u1e4f",
      "O\u0304\u0300": "\u1e50",
      "o\u0304\u0300": "\u1e51",
      "O\u0304\u0301": "\u1e52",
      "o\u0304\u0301": "\u1e53",
      "U\u0324": "\u1e72",
      "u\u0324": "\u1e73",
      "U\u0330": "\u1e74",
      "u\u0330": "\u1e75",
      "U\u032d": "\u1e76",
      "u\u032d": "\u1e77",
      "U\u0303\u0301": "\u1e78",
      "u\u0303\u0301": "\u1e79",
      "U\u0304\u0308": "\u1e7a",
      "u\u0304\u0308": "\u1e7b",
      "Y\u0307": "\u1e8e",
      "y\u0307": "\u1e8f",
      "y\u030a": "\u1e99",
      "A\u0323": "\u1ea0",
      "a\u0323": "\u1ea1",
      "A\u0309": "\u1ea2",
      "a\u0309": "\u1ea3",
      "A\u0302\u0301": "\u1ea4",
      "a\u0302\u0301": "\u1ea5",
      "A\u0302\u0300": "\u1ea6",
      "a\u0302\u0300": "\u1ea7",
      "A\u0302\u0309": "\u1ea8",
      "a\u0302\u0309": "\u1ea9",
      "A\u0302\u0303": "\u1eaa",
      "a\u0302\u0303": "\u1eab",
      "A\u0323\u0302": "\u1eac",
      "a\u0323\u0302": "\u1ead",
      "A\u0306\u0301": "\u1eae",
      "a\u0306\u0301": "\u1eaf",
      "A\u0306\u0300": "\u1eb0",
      "a\u0306\u0300": "\u1eb1",
      "A\u0306\u0309": "\u1eb2",
      "a\u0306\u0309": "\u1eb3",
      "A\u0306\u0303": "\u1eb4",
      "a\u0306\u0303": "\u1eb5",
      "A\u0323\u0306": "\u1eb6",
      "a\u0323\u0306": "\u1eb7",
      "E\u0323": "\u1eb8",
      "e\u0323": "\u1eb9",
      "E\u0309": "\u1eba",
      "e\u0309": "\u1ebb",
      "E\u0303": "\u1ebc",
      "e\u0303": "\u1ebd",
      "E\u0302\u0301": "\u1ebe",
      "e\u0302\u0301": "\u1ebf",
      "E\u0302\u0300": "\u1ec0",
      "e\u0302\u0300": "\u1ec1",
      "E\u0302\u0309": "\u1ec2",
      "e\u0302\u0309": "\u1ec3",
      "E\u0302\u0303": "\u1ec4",
      "e\u0302\u0303": "\u1ec5",
      "E\u0323\u0302": "\u1ec6",
      "e\u0323\u0302": "\u1ec7",
      "I\u0309": "\u1ec8",
      "i\u0309": "\u1ec9",
      "I\u0323": "\u1eca",
      "i\u0323": "\u1ecb",
      "O\u0323": "\u1ecc",
      "o\u0323": "\u1ecd",
      "O\u0309": "\u1ece",
      "o\u0309": "\u1ecf",
      "O\u0302\u0301": "\u1ed0",
      "o\u0302\u0301": "\u1ed1",
      "O\u0302\u0300": "\u1ed2",
      "o\u0302\u0300": "\u1ed3",
      "O\u0302\u0309": "\u1ed4",
      "o\u0302\u0309": "\u1ed5",
      "O\u0302\u0303": "\u1ed6",
      "o\u0302\u0303": "\u1ed7",
      "O\u0323\u0302": "\u1ed8",
      "o\u0323\u0302": "\u1ed9",
      "O\u031b\u0301": "\u1eda",
      "o\u031b\u0301": "\u1edb",
      "O\u031b\u0300": "\u1edc",
      "o\u031b\u0300": "\u1edd",
      "O\u031b\u0309": "\u1ede",
      "o\u031b\u0309": "\u1edf",
      "O\u031b\u0303": "\u1ee0",
      "o\u031b\u0303": "\u1ee1",
      "O\u031b\u0323": "\u1ee2",
      "o\u031b\u0323": "\u1ee3",
      "U\u0323": "\u1ee4",
      "u\u0323": "\u1ee5",
      "U\u0309": "\u1ee6",
      "u\u0309": "\u1ee7",
      "U\u031b\u0301": "\u1ee8",
      "u\u031b\u0301": "\u1ee9",
      "U\u031b\u0300": "\u1eea",
      "u\u031b\u0300": "\u1eeb",
      "U\u031b\u0309": "\u1eec",
      "u\u031b\u0309": "\u1eed",
      "U\u031b\u0303": "\u1eee",
      "u\u031b\u0303": "\u1eef",
      "U\u031b\u0323": "\u1ef0",
      "u\u031b\u0323": "\u1ef1",
      "Y\u0300": "\u1ef2",
      "y\u0300": "\u1ef3",
      "Y\u0323": "\u1ef4",
      "y\u0323": "\u1ef5",
      "Y\u0309": "\u1ef6",
      "y\u0309": "\u1ef7",
      "Y\u0303": "\u1ef8",
      "y\u0303": "\u1ef9",
    };
    return text.replace(
      /[AEIOUYaeiouy\u00c0-\u01ff\u1e00-\u1eff][\u0300-\u036f]*/g,
      function (original) {
        var first = original.charAt(0);
        var sequence = (decompositions[first] || first) + original.substring(1);
        var marks = sequence.substring(1).split("");
        function rank(mark) {
          if (mark === "\u031b") return 216; // horn
          if (mark === "\u0323") return 220; // dot below
          return 230;
        }
        // Stable insertion sort: retain the order of marks with equal classes.
        for (var j = 1; j < marks.length; j++) {
          var mark = marks[j],
            k = j - 1;
          while (k >= 0 && rank(marks[k]) > rank(mark)) {
            marks[k + 1] = marks[k];
            k--;
          }
          marks[k + 1] = mark;
        }
        var ordered = sequence.charAt(0) + marks.join("");
        return compositions[ordered] || original;
      },
    );
  }

  function getTextData(dataFile) {
    var df = dataFile;
    var dataFileName = decodeURI(df.name);
    var type = dataFileName.match(/(\.txt$|\.csv$)/i)[0].toLowerCase();
    var splitter = type == ".txt" ? "\t" : ",";
    df.open("r");
    var fileContents = df.read();
    fileContents = viNormalizeVietnamese(fileContents.replace(/^\uFEFF/, ""));
    var firstRow = fileContents.split(/[\r\n]/g)[0];
    if (firstRow != null && splitter != "\t") {
      if (firstRow.indexOf(",") == -1 && firstRow.indexOf(";") > -1) {
        splitter = ";"; // For the .csv format: if the first row has no commas but has a semicolon, assume this is a semicolon-delimited .csv file
      }
    }
    var everyRowRaw = CSV.parse(fileContents, undefined, splitter);
    df.close();

    var everyRow = [];
    for (var i = 0; i < everyRowRaw.length; i++) {
      // get rid of empty rows
      var thisRawRow = everyRowRaw[i];
      if (!checkRowForAllBlanks(thisRawRow)) {
        if (i > 0) {
          if (thisRawRow.length < everyRow[0].length) {
            var diff = everyRow[0].length - thisRawRow.length;
            for (var d = 0; d < diff; d++) {
              thisRawRow.push("");
            }
          }
        }
        everyRow.push(thisRawRow);
      }
    }
    return everyRow;
  }

  function getData(filePath) {
    try {
      return getTextData(File(filePath));
    } catch (e) {
      alert(e);
      return null;
    }
  }

  function checkRowForAllBlanks(row) {
    for (var i = 0; i < row.length; i++) {
      if (row[i] != "") {
        return false;
      }
    }
    return true;
  }

  function getVariableType(str) {
    var firstChar = str[0];
    for (var all in VARTYPES) {
      if (firstChar == VARTYPES[all].key) {
        return all;
      }
    }
    return "Text";
  }

  function transposeGrid(data) {
    var newArr = [];
    var columns = data[0].length,
      rows = data.length,
      newRow = [];
    for (var i = 0; i < columns; i++) {
      newRow = [];
      for (var j = 0; j < rows; j++) {
        newRow.push(data[j][i]);
      }
      newArr.push(newRow);
    }
    return newArr;
  }

  function comparePropNames(compareTo, compareThis) {
    var resMsg = "";
    var propCount = {};
    propCount.compareTo = 0;
    propCount.compareThis = 0;
    var compareToPropArr = [];
    var compareThisPropArr = [];
    for (var all in compareTo) {
      propCount.compareTo++;
      compareToPropArr.push(all);
    }
    for (var all in compareThis) {
      propCount.compareThis++;
      compareThisPropArr.push(all);
    }
    var allFound = true,
      thisProp,
      thisCompareProp;
    for (var i = 0; i < compareToPropArr.length; i++) {
      thisProp = compareToPropArr[i];
      for (var j = 0; j < compareThisPropArr.length; j++) {
        thisCompareProp = compareThisPropArr[j];
        if (
          compareThisPropArr.indexOf(thisProp) == -1 ||
          compareToPropArr.indexOf(thisCompareProp) == -1
        ) {
          allFound = false;
          break;
        }
      }
    }
    if (!allFound) {
      resMsg = "Not All Found";
    } else {
      resMsg = "All Found";
    }

    return {
      resMsg: resMsg,
      propCount: propCount,
    };
  }

  function getByName(obj, name) {
    if (obj instanceof Array) {
      for (var i = 0; i < obj.length; i++) {
        if (obj[i].name == name) {
          return obj[i];
        }
      }
    } else if (typeof obj == "Object") {
      for (var all in obj) {
        if (all == "name" && obj[all] == name) {
          return obj[all];
        }
      }
    }
    return null;
  }

  function getPropertyList(obj) {
    var arr = [];
    for (var all in obj) {
      arr.push(all);
    }
    return arr;
  }

  function getSpecificPropertyListObj(obj, prop) {
    var arr = [];
    for (var all in obj) {
      if (obj[all].hasOwnProperty(prop)) {
        arr.push(obj[all][prop]);
      }
    }
    return arr;
  }

  function getSpecificPropertyObj(obj, prop, value) {
    for (var all in obj) {
      if (obj[all].hasOwnProperty(prop) && obj[all][prop] == value) {
        return obj[all];
      }
    }
    return null;
  }

  function getSpecificPropertyListArr(srcArr, prop) {
    var arr = [];
    for (var i = 0; i < srcArr.length; i++) {
      if (srcArr[i].hasOwnProperty(prop)) {
        arr.push(srcArr[i][prop]);
      }
    }
    return arr;
  }

  function getSpecificValuePropertyListArr(
    srcArr,
    filterProp,
    filterValue,
    searchProp,
  ) {
    var arr = [];
    for (var i = 0; i < srcArr.length; i++) {
      if (
        srcArr[i].hasOwnProperty(filterProp) &&
        srcArr[i].hasOwnProperty(searchProp) &&
        srcArr[i][filterProp] == filterValue
      ) {
        arr.push(srcArr[i][searchProp]);
      }
    }
    return arr;
  }

  function writeFile(fileObj, contents, encoding) {
    if (typeof encoding == "string") {
      fileObj.encoding = encoding;
    }
    fileObj.open("w");
    fileObj.write(contents);
    fileObj.close();
  }

  function writeSettingsFile(settingsObj) {
    var scriptDataFolder = SESSION.scriptDataFolder;
    if (scriptDataFolder.exists) {
      var settingsFile = SESSION.settingsFile;
      try {
        writeFile(settingsFile, JSON.stringify(settingsObj, null, 2));
        if (WARNINGSETTINGS.showSuccessfulSettingsFileSaves) {
          scriptAlert(
            "Settings file successfully saved in '" +
              decodeURI(settingsFile) +
              "'",
          );
        }
      } catch (e) {
        scriptAlert(e);
      }
    } else {
      scriptAlert(
        "The folder '" +
          scriptDataFolder +
          "' does not exist and Settings file could not be written.",
      );
    }
  }

  function getScriptDataObj() {
    // must have updated object first
    var obj = {};
    obj.WARNINGSETTINGS = WARNINGSETTINGS;
    obj.PRESETS = PRESETS;
    obj.DATASETNAMEFIELDS = DATASETNAMEFIELDS_current;
    obj.CUSTOM_INCREMENTS = CUSTOM_INCREMENTS_current;
    obj.VisibilityKeys = VisibilityKeys;
    if (typeof VI_MEMORY_SETTINGS != "undefined") {
      obj.lastChosenDataFilePath = VI_MEMORY_SETTINGS.lastChosenDataFilePath;
    }
    return obj;
  }

  function updateScriptDataFromUI(UIElements, presetName) {
    var presetName = presetName || SESSION.currentLoadedPresetName;
    var presetObj = {};
    for (var all in PRESETS[0]) {
      if (
        UIElements.hasOwnProperty(all) &&
        typeof UIElements[all].getValue == "function"
      ) {
        presetObj[all] = UIElements[all].getValue();
      }
    }
    var warningList = UIElements["list_warnings"];
    for (var all in WARNINGSETTINGS) {
      WARNINGSETTINGS[all] = warningList.find(unCamelCaseSplit(all)).checked;
    }
    // also update from other memory objects, not necessarily the UI anymore
    presetObj["datasetNameObj"] = clone(DATASETNAMEFIELDS_current);
    presetObj["enabledVisibilityKeyNames"] = getSpecificValuePropertyListArr(
      VisibilityKeys,
      "enabled",
      true,
      "name",
    );
    var loadedPreset = PRESETS.getByName(presetName);
    for (var all in presetObj) {
      loadedPreset[all] = presetObj[all];
    }
  }

  function getUIData(UIElements) {
    var presetObj = {};
    for (var all in PRESETS[0]) {
      if (
        UIElements.hasOwnProperty(all) &&
        typeof UIElements[all].getValue == "function"
      ) {
        presetObj[all] = UIElements[all].getValue();
      }
    }
    for (var all in WARNINGSETTINGS) {
      // this adds the notification settings as piggy-back, but isn't used in the return data from this function
      if (
        UIElements.hasOwnProperty(all) &&
        typeof UIElements[all].getValue == "function"
      ) {
        WARNINGSETTINGS[all] = UIElements[all].getValue();
      }
    }
    presetObj.datasetNameObj = DATASETNAMEFIELDS_current;
    presetObj.enabledVisibilityKeyNames = getSpecificValuePropertyListArr(
      VisibilityKeys,
      "enabled",
      true,
      "name",
    );
    return presetObj;
  }

  function updateCurrentPresetNameDisplays(
    UIElements,
    currentLoadedPresetObj,
    tryAddOverridesMarker,
  ) {
    var currentUIStatePresetObj = getUIData(UIElements);
    var hasOverrides = false;
    if (
      typeof tryAddOverridesMarker != "undefined" &&
      tryAddOverridesMarker === true
    ) {
      var testObj = {};
      for (var all in currentUIStatePresetObj) {
        if (all == "enabledVisibilityKeyNames") {
          if (
            currentUIStatePresetObj[all].compare(currentLoadedPresetObj[all])
          ) {
            // checked by array compare function to see if same elements exist in both arrays regardless of order
            // if so, set one object to the other, making later string comparison true
            currentLoadedPresetObj[all] = currentUIStatePresetObj[all];
          }
        }
        testObj[all] = currentLoadedPresetObj[all];
      }
      hasOverrides =
        JSON.stringify(testObj) !== JSON.stringify(currentUIStatePresetObj);
    }
    var thisElem;
    for (var i = 0; i < UIElements["currentlySelectedPresetName"].length; i++) {
      thisElem = UIElements["currentlySelectedPresetName"][i];
      if (hasOverrides) {
        thisElem.setValue(SESSION.currentLoadedPresetName + "*");
        thisElem.helpTip =
          "The preset '" +
          SESSION.currentLoadedPresetName +
          "' has one or more of its dialog settings overriden in the current dialog state.";
      } else {
        thisElem.setValue(SESSION.currentLoadedPresetName);
        thisElem.helpTip = "";
      }
    }
  }

  function setVisibilityKeysEnabled(visKeyNames) {
    var thisVisKeyObj,
      processedItems = [];
    for (var i = 0; i < VisibilityKeys.length; i++) {
      thisVisKeyObj = VisibilityKeys[i];
      if (
        visKeyNames.indexOf(thisVisKeyObj.name) > -1 &&
        processedItems.indexOf(thisVisKeyObj.name) == -1
      ) {
        thisVisKeyObj.enabled = true;
        processedItems.push(thisVisKeyObj.name);
      } else if (processedItems.indexOf(thisVisKeyObj.name) == -1) {
        thisVisKeyObj.enabled = false;
      }
    }
  }

  function populateUI(UIElements, tryAddOverridesMarker) {
    var currentLoadedPresetObj = PRESETS.getByName(
      SESSION.currentLoadedPresetName,
    );
    if (currentLoadedPresetObj.hasOwnProperty("enabledVisibilityKeyNames")) {
      setVisibilityKeysEnabled(
        currentLoadedPresetObj.enabledVisibilityKeyNames,
      );
    }
    for (var all in UIElements) {
      if (all in UIElements && all in SETTINGS) {
        SETTINGS[all] = currentLoadedPresetObj[all];
      }
    }
    for (var all in PRESETS[0]) {
      if (
        UIElements.hasOwnProperty(all) &&
        typeof UIElements[all].getValue == "function"
      ) {
        UIElements[all].setValue(currentLoadedPresetObj[all]);
      }
    }
    updateCurrentPresetNameDisplays(
      UIElements,
      currentLoadedPresetObj,
      tryAddOverridesMarker,
    );
    var warningList = UIElements["list_warnings"];
    for (var all in WARNINGSETTINGS) {
      warningList.find(unCamelCaseSplit(all)).checked = WARNINGSETTINGS[all];
    }
    UIElements["disp_dataFile"].notify("onChange");
    var xmlPathStr = UIElements["xmlPath"].getValue();
    if (xmlPathStr == "" || xmlPathStr == "temp" || xmlPathStr == "undefined") {
      UIElements["xmlPath"].setValue(SETTINGS.getDataXMLDestination());
    }
    UIElements["datasetNamePreview"].setValue(getDatasetNamePreviewString());
  }

  function getCurrentlySelectedPresetName() {
    var thisPreset;
    for (var i = 0; i < PRESETS.length; i++) {
      thisPreset = PRESETS[i];
      if (thisPreset.currentlySelected) {
        return thisPreset.name;
      }
    }
  }

  function setCurrentlySelectedPresetName(name) {
    var thisPreset;
    for (var i = 0; i < PRESETS.length; i++) {
      thisPreset = PRESETS[i];
      if (name == thisPreset.name) {
        thisPreset.currentlySelected = true;
      } else {
        thisPreset.currentlySelected = false;
      }
    }
  }

  function addVarNameDatasetNames() {
    FIELDNAMEOPTIONS_current = clone(FIELDNAMEOPTIONS);
    var varNames = DATA.getVariableNames();
    if (varNames.length == 0) {
      return;
    }
    var thisName, key;
    for (var i = 0; i < varNames.length; i++) {
      thisName = varNames[i];
      key = "variable_" + (i + 1) + "_value";
      FIELDNAMEOPTIONS_current[key] = {
        defaultText: thisName,
        displayText: "Variable " + (i + 1) + ' Value : "' + thisName + '"',
        type: key,
      };
    }

    var processedDatasetNameFieldsResult = clearOutOfBoundVariables(
      DATASETNAMEFIELDS_current,
    );
    DATASETNAMEFIELDS_current = processedDatasetNameFieldsResult.obj;
    if (
      WARNINGSETTINGS.showDatasetNamingWarning &&
      processedDatasetNameFieldsResult.msg != ""
    ) {
      quickView(
        processedDatasetNameFieldsResult.msg,
        "Dataset naming field errors.",
      );
    }
  }

  function clearOutOfBoundVariables(obj) {
    var varNames = DATA.getVariableNames();
    var idx;
    missingVariableNamesLog = [];
    missingCustomIncrementsLog = [];
    for (var all in obj) {
      if (obj[all].type.match(SESSION.regexps.varRx)) {
        idx = obj[all].type.match(/\d+/) * 1 - 1;
        if (idx < varNames.length) {
          obj[all].text = varNames[idx];
        } else {
          missingVariableNamesLog.push(
            all + " : variable # " + idx + ' ("' + obj[all].text + '")',
          );
          obj[all].type = "nothing";
          obj[all].text = "";
        }
      } else if (obj[all].type == "customIncrement") {
        var customIncObj = getByName(CUSTOM_INCREMENTS_current, obj[all].text);
        if (customIncObj == null) {
          missingCustomIncrementsLog.push(all + " : " + obj[all].text);
          obj[all].type = "nothing";
          obj[all].text = "";
        }
      }
    }
    var msg = "";
    if (missingVariableNamesLog.length > 0) {
      msg +=
        "The variables associated with dataset-name fields were not found in current data and were removed from the dataset naming options.\n" +
        "---------------------------------------------\n" +
        missingVariableNamesLog.join("\n");
    }
    if (missingCustomIncrementsLog.length > 0) {
      if (msg != "") {
        msg += "\n\n";
      }
      msg +=
        "These custom increments were specified inside the dataset name fields, but were not located in the saved settings data.\n" +
        "---------------------------------------------\n" +
        missingCustomIncrementsLog.join("\n");
    }
    return { obj: obj, msg: msg };
  }

  function getPrependPathValue(varObj, cellData) {
    var folderDiv = SESSION.os == "Windows" ? "\\" : "/";
    cellData = varObj.url + folderDiv + cellData;
    cellData = cellData.replace(/\\\\/g, "//").replace(/\\/g, "/");
    return cellData;
  }

  function getRecordDatasetName(dsNameFieldObj, row, index) {
    var str = "";
    for (var all in dsNameFieldObj) {
      str += getDsNameField(dsNameFieldObj, all, row, index);
    }
    return str;
  }

  function getRecordCustomInc(
    index,
    startNum,
    padZero,
    increment,
    isIntervalIncrement,
    _isSelfCalled,
  ) {
    /* 0-start-based index */
    startNum *= 1;
    increment *= 1;
    var padZeroStr = "";
    var storedPadZero = padZero;
    var currentNum = startNum + index * increment;
    if (_isSelfCalled) {
      currentNum -= 1;
    }
    var currentNumLength = currentNum.toString().length - 1;
    padZero -= currentNumLength;
    for (var i = 0; i < padZero; i++) {
      padZeroStr += "0";
    }
    if (!isIntervalIncrement) {
      return padZeroStr + currentNum;
    } else {
      // get next value by re-using this function with edited increment argument and a flag to avoid this block during that run
      var nextVal = getRecordCustomInc(
        index + 1,
        startNum,
        storedPadZero,
        increment,
        false,
        true,
      );

      return padZeroStr + currentNum + "-" + nextVal;
    }
  }

  function getDsNameField(dsNameFieldObj, fieldName, row, index) {
    function getCurrentText(dsNameFieldObj, fieldName) {
      return dsNameFieldObj[fieldName].text;
    }

    if (dsNameFieldObj[fieldName].type.match(SESSION.regexps.varRx)) {
      var varIndex =
        dsNameFieldObj[fieldName].type.replace(/[^\d]/g, "") * 1 - 1;
      if (varIndex < row.length) {
        return row[varIndex];
      }
    }

    switch (dsNameFieldObj[fieldName].type) {
      case "customText": {
        return getCurrentText(dsNameFieldObj, fieldName);
        break;
      }
      case "dash": {
        return getCurrentText(dsNameFieldObj, fieldName);
        break;
      }
      case "nothing": {
        return getCurrentText(dsNameFieldObj, fieldName);
        break;
      }
      case "space": {
        return getCurrentText(dsNameFieldObj, fieldName);
        break;
      }
      case "increment": {
        return index + SETTINGS.incrementStartNumber;
        break;
      }
      case "underscore": {
        return getCurrentText(dsNameFieldObj, fieldName);
        break;
      }
      case "customIncrement": {
        var customIncName = getCurrentText(dsNameFieldObj, fieldName);
        var customIncObj = getByName(CUSTOM_INCREMENTS_current, customIncName);
        if (customIncObj == null) {
          return ""; // failed to find the custom increment item
        }
        return getRecordCustomInc(
          index,
          customIncObj.startNum,
          customIncObj.padZero,
          customIncObj.increment,
          customIncObj.isIntervalIncrement,
        );
        break;
      }
      default: {
        return "";
      }
    }
    return "";
  }

  function getFileRefTestResults() {
    if (DATA.currentVars.length == 0) {
      return null;
    }
    var log = {
      foundImages: ["Found Images: "],
      foundGraphs: ["Found Graphs: "],
      missingImages: ["Missing Images: "],
      missingGraphs: ["Missing Graphs: "],
    };

    var item, thisVar, test;

    for (var i = 0; i < DATA.currentGrid.length; i++) {
      for (var j = 0; j < DATA.currentVars.length; j++) {
        item = DATA.currentGrid[i][j];
        thisVar = DATA.currentVars[j];
        if (thisVar.varType == "Image" || thisVar.varType == "Graph") {
          test = File(item);
          if (test.exists) {
            log["found" + thisVar.varType + "s"].push(item);
          } else {
            log["missing" + thisVar.varType + "s"].push(item);
          }
        }
      }
    }
    return log;
  }

  function getSpecificFileRefTestResultsLog(log, prop) {
    // images or graphs
    if (prop != "Images" && prop != "Graphs") {
      alert(
        "Only 'Images' and 'Graphs' are searchable properties in function 'getSpecificFileRefTestResultsLog(log, prop)'",
      );
      return null;
    }

    var specificLog = {
      found: log["found" + prop],
      missing: log["missing" + prop],
    };

    var resMsg = "";
    for (var all in specificLog) {
      specificLog[all][0] +=
        "(" + (specificLog[all].length - 1) + ")\n---------------";
      resMsg += specificLog[all].join("\n") + "\r\r";
    }
    return resMsg;
  }

  function fileRefTestHandler() {
    if (DATA.currentVars.length == 0) {
      alert("Please import a data file first.");
      return;
    }
    DATA.getCurrentGrid();
    var allResults = getFileRefTestResults();
    var thisRefResultNumFound = allResults["found" + this.key].length - 1;
    var thisRefResultNumMissing = allResults["missing" + this.key].length - 1;
    var foundMissingNum =
      thisRefResultNumFound +
      "/" +
      (thisRefResultNumFound + thisRefResultNumMissing);

    // var logStr = getSpecificFileRefTestResultsLog(allResults, this.key);
    var keySingular = this.key.replace(/s$/, "");

    simpleShowModal(
      TestManager[keySingular.toLowerCase() + "Files"].makeUIContents,
      {
        title: this.key.replace(/s$/, "") + " Files Log",
        foundFiles: allResults["found" + this.key].slice(1).join("\n"),
        missingFiles: allResults["missing" + this.key].slice(1).join("\n"),
        foundMissingNum: foundMissingNum,
        size: [800, 220],
      },
    );

    this.disp.setValue(foundMissingNum);
    var tabGroupKey = "testTabs";
    if (this.window.UITestElements.hasOwnProperty(tabGroupKey)) {
      var testTabPanel = this.window.UITestElements["testTabs"],
        thisTab;
      for (var i = 0; i < testTabPanel.children.length; i++) {
        thisTab = testTabPanel.children[i];
        if (thisTab.hasOwnProperty("key") && thisTab.key == keySingular) {
          thisTab.populateFields();
        }
      }
    }
  }

  function displayFoundArtBindings(UITestElements) {
    var doc = app.activeDocument;
    DocumentBinding.getNamedBinds(doc);
    UITestElements["foundArtBindings"].setValue(
      DocumentBinding.getBindObjectTestResults().foundItemString,
    );
    var tabItemKey = "testTabArtBinding";
    if (UITestElements.hasOwnProperty(tabItemKey)) {
      UITestElements[tabItemKey].populateFields();
    }
  }

  eval(
    "@JSXBIN@ES@2.0@MyBbyBnABMAbyBn0ACOBbCn0ACJCnAEjzFjBjMjFjSjUBfRBFehBiEjPjFjTjOhHj" +
      "UhAjMjPjPjLhAjMjJjLjFhAjBjOjZjUjIjJjOjHhAjUjPhAjNjFhOffZDnAFctACzChdhdCEXzHjSjF" +
      "jQjMjBjDjFDfEXzLjUjPiMjPjXjFjSiDjBjTjFEfVzFjJjOjQjVjUFfAnfRCYIibieicjXicjTidhLA" +
      "FeAffEXDfEXEfVzHjEjFjTjJjSjFjEGfBnfRCYIibieicjXicjTidhLAFeAffnnnZFnAFcfACG4B0Ah" +
      "AF40BhAC0AzCjFjFHAG0EzAIByB",
  );

  function stringXmlSafe(str) {
    str = str.toString();
    str = str.replace(/&(?!(amp;|gt;|lt;|quot;|apos;))/g, "&amp;");
    str = str.replace(/</g, "&lt;");
    str = str.replace(/>/g, "&gt;");
    str = str.replace(/'/g, "&apos;");
    str = str.replace(/"/g, "&quot;");
    return str;
  }

  function disguiseXmlEntities(str) {
    str = str.toString();
    str = str.replace(/&(?!(amp;|gt;|lt;|quot;|apos;))/g, "_#_amp_#_");
    str = str.replace(/</g, "_#_lt_#_");
    str = str.replace(/>/g, "_#_gt_#_");
    str = str.replace(/'/g, "_#_apos_#_");
    str = str.replace(/"/g, "_#_quot_#_");
    return str;
  }

  function undisguiseXmlEntities(str) {
    str = str.toString();
    str = str.replace(/_#_amp_#_/g, "&amp;");
    str = str.replace(/_#_lt_#_/g, "&lt;");
    str = str.replace(/_#_gt_#_/g, "&gt;");
    str = str.replace(/_#_apos_#_/g, "&apos;");
    str = str.replace(/_#_quot_#_/g, "&quot;");
    return str;
  }

  function wrapCDATA(str, propNm) {
    str = "<data>" + str + "</data>";
    str = str.replace(/(\<data\>)/g, "<" + propNm + "><![CDATA[");
    str = str.replace(/(\<\/data\>)/g, "]]\>" + "</" + propNm + ">");
    return XML(str);
  }

  function isXMLTagName(tag) {
    var t = !/^[xX][mM][lL].*/.test(tag); // condition 3
    t = t && /^[a-zA-Z_].*/.test(tag); // condition 2
    t = t && /^[a-zA-Z0-9_\-\.]+$/.test(tag); // condition 4
    return t;
  }

  function getXmlFileDest(userInputObj) {
    if (!SETTINGS.keepXML) {
      var dataFile = File(userInputObj.sourceDataPath);
      var xmlDest = File(
        dataFile.parent +
          "/" +
          decodeURI(dataFile.name).replace(/\.\w+$/, ".xml"),
      ).saveDlg("Where would you like to save the Variable Data XML file?");
      return xmlDest;
    } else {
      return File(userInputObj.xmlPath);
    }
  }

  function forceRefreshDoc() {
    var temp = app.documents.add();
    temp.close(SaveOptions.DONOTSAVECHANGES);
  }

  function cycleUpdateAllDatasets(doc, displayElem) {
    for (var i = 0; i < doc.dataSets.length; i++) {
      var d = doc.dataSets[i];
      d.display();
      if (typeof displayElem != "undefined") {
        displayElem.text = i + 1 + " of " + doc.dataSets.length;
        displayElem.window.update();
      }
      redraw();
      $.sleep(10);
      d.update();
    }
    doc.dataSets[0].display();
    displayElem.text = 1 + " of " + doc.dataSets.length;
  }

  function processUserInput(userInputObj) {
    var xmlDest, doc, problem;

    var xmlString = XMLStringBuilder.generateVariableLibraryXMLString();
    if (xmlString == null) {
      return;
    }

    if (userInputObj.purpose == "createXML") {
      xmlDest = getXmlFileDest(userInputObj);
      if (xmlDest == null) {
        alert("Cancelled: no XML file produced.");
        return;
      }

      writeFile(xmlDest, xmlString, "UTF-8");

      if (xmlDest.exists) {
        // alert("File successfully saved in '" + decodeURI(xmlDest) + "'");
        finishedXMLFileDialog(
          xmlDest,
          DATA.currentVars.length,
          DATA.currentGrid.length,
        );
      } else {
        alert(
          "Sorry, the file '" + decodeURI(xmlDest) + "' could not be saved.",
        );
      }
    } else {
      xmlDest = File(userInputObj.xmlPath);
      writeFile(xmlDest, xmlString, "UTF-8");
      if (!xmlDest.exists) {
        alert(
          "Sorry, the file '" + decodeURI(xmlDest) + "' could not be saved.",
        );
        return;
      }
      doc = app.activeDocument;
      if (doc.variables.length > 0) {
        if (!CONFIRMS["showExistingVariablesWarning"](doc.variables.length)) {
          alert("Cancelled: no variables were imported.");
          return;
        }
        if (SETTINGS.selectedAutobinding != "noAutoBinding") {
          for (var i = doc.variables.length - 1; i >= 0; i--) {
            doc.variables[i].remove();
          }
        }
      }

      try {
        problem =
          "Importing Variables into the document from created XML file.";
        doc.importVariables(xmlDest);
        forceRefreshDoc(); // force refresh actually makes binding possible?

        if (
          SETTINGS.selectedAutobinding != "noAutoBinding" &&
          !(
            userInputObj.fileRefsLog.missingImages.length > 1 ||
            userInputObj.fileRefsLog.missingGraphs.length > 1
          )
        ) {
          problem =
            "Auto-Binding variables to art items based on '" +
            unCamelCaseSplit(SETTINGS.selectedAutobinding) +
            "'";
          DocumentBinding.bindDocumentItems(doc);
        }

        if (
          userInputObj.fileRefsLog.missingImages.length < 2 ||
          userInputObj.fileRefsLog.missingGraphs.length < 2
        ) {
          if (
            doc.dataSets.length > 0 &&
            SETTINGS.selectedAutobinding != "noAutoBinding"
          ) {
            problem = "Displaying first dataset of the document.";
            doc.dataSets[0].display(); // display the first dataset.
          }
        }
        finishedXMLImportDialog(
          DATA.currentVars.length,
          DATA.currentGrid.length,
          userInputObj.fileRefsLog.missingImages.length - 1,
          userInputObj.fileRefsLog.missingGraphs.length - 1,
        );
        // victory!
      } catch (e) {
        alert(
          "Sorry, something went wrong with the import of the generated XML file '" +
            xmlDest +
            "':\n" +
            e +
            "\nPossible Problem: " +
            problem,
        );
      }

      if (!SETTINGS.keepXML) {
        xmlDest.remove();
      }
    }
  }

  var SESSION = {
    os: $.os.match("Windows") ? "Windows" : "Mac",
    AIVersion: parseInt(app.version.split(/\./)[0]),
    scriptName: "VariableImporter.jsx",
    scriptVersion: "8.2.4",
    currentLoadedPresetName: "",
    regexps: {
      varRx: /variable_\d+_value/,
      fileStartRx: /^file\:\/\/\//,
    },
    multiColumnListBoxTest: true,
    documentExists: app.documents.length > 0,
    settingsFile: (function () {
      return File(
        Folder.myDocuments + "/VariableImporter/VariableImporter_SETTINGS.json",
      );
    })(),
    scriptDataFolder: (function () {
      var f = Folder(Folder.myDocuments + "/VariableImporter");
      if (!f.exists) {
        f.create();
      }
      return f;
    })(),
    dataFileMask: function () {
      return this.os == "Windows"
        ? "*.txt;*.TXT;*.csv;*.CSV;"
        : function (f) {
            return (
              f instanceof Folder ||
              (f instanceof File && decodeURI(f.name).match(/(\.txt|\.csv)$/i))
            );
          };
    },
    tabbedGroupTest: false,
    imageTest: false,
    doImageTest: function () {
      var flag = true,
        thisIconString,
        test;
      for (var all in ICONS) {
        thisIconString = ICONS[all];
        test = getScriptImage({
          name: all,
          data: thisIconString,
        });
        ICONS[all] = test;
        if (!test) {
          flag = false;
        }
      }
      this.imageTest = flag;
      return flag;
    },
    init: function () {
      // load from settings function
      if (this.settingsFile.exists) {
        this.settingsFile.open("r");
        var settingsObj = JSON.parse(this.settingsFile.read()),
          tempObj;
        this.settingsFile.close();
        // read the visibility keys in first.
        if (
          settingsObj.hasOwnProperty("VisibilityKeys") &&
          settingsObj.VisibilityKeys.length > 0 &&
          comparePropNames(settingsObj.VisibilityKeys[0], VisibilityKeys[0])
            .resMsg == "All Found"
        ) {
          VisibilityKeys = settingsObj.VisibilityKeys;
        }
        if (settingsObj.hasOwnProperty("PRESETS")) {
          for (var i = 0; i < settingsObj.PRESETS.length; i++) {
            tempObj = {};
            for (var all in PRESETS[0]) {
              if (settingsObj.PRESETS[i].hasOwnProperty(all)) {
                tempObj[all] = settingsObj.PRESETS[i][all];
                if (
                  all == "currentlySelected" &&
                  settingsObj.PRESETS[i][all] === true
                ) {
                  if (settingsObj.PRESETS[i].hasOwnProperty("datasetNameObj")) {
                    DATASETNAMEFIELDS_current = clone(
                      settingsObj.PRESETS[i].datasetNameObj,
                    );
                  }
                  if (
                    settingsObj.PRESETS[i].hasOwnProperty(
                      "enabledVisibilityKeyNames",
                    )
                  ) {
                    var currentlyEnabledVisKeyNames =
                      settingsObj.PRESETS[i].enabledVisibilityKeyNames;
                    var currentlyAvailableVisKeyNames =
                      getSpecificPropertyListObj(VisibilityKeys, "name");
                    var areAllEnabledNamesPresent = true;
                    // check if all currently loaded visibility keys contain all of the enabled names from the preset
                    // remove any which were not found
                    for (
                      var j = currentlyEnabledVisKeyNames.length - 1;
                      j > -1;
                      j--
                    ) {
                      if (
                        currentlyAvailableVisKeyNames.indexOf(
                          currentlyEnabledVisKeyNames[j],
                        ) == -1
                      ) {
                        currentlyEnabledVisKeyNames.splice(j, 1);
                        areAllEnabledNamesPresent = false; // a flag for any purpose
                      }
                    }
                    DATASETNAMEFIELDS_current = clone(
                      settingsObj.PRESETS[i].datasetNameObj,
                    );
                  }
                }
              } else {
                tempObj[all] = PRESETS[0][all];
              }
            }
            PRESETS[i] = tempObj;
          }
        }
        if (
          settingsObj.hasOwnProperty("lastChosenDataFilePath") &&
          VI_MEMORY_SETTINGS.lastChosenDataFilePath == ""
        ) {
          VI_MEMORY_SETTINGS.lastChosenDataFilePath =
            settingsObj["lastChosenDataFilePath"];
        }
        // if the settings file contains no custom increments, defaults will be used anyway
        if (
          settingsObj.hasOwnProperty("CUSTOM_INCREMENTS") &&
          settingsObj.CUSTOM_INCREMENTS.length > 0
        ) {
          var customIncrementsAreAllValid = true,
            currentSettingsCustomInc;
          for (var i = 0; i < settingsObj["CUSTOM_INCREMENTS"]; i++) {
            currentSettingsCustomInc = settingsObj["CUSTOM_INCREMENTS"][i];
            for (var all in CUSTOM_INCREMENTS[0]) {
              // CUSTOM_INCREMENTS in the objects must always have the default value(s)
              if (!currentSettingsCustomInc.hasOwnProperty(all)) {
                scriptAlert(
                  "Problem reading custom increment information from the settings file. Defaulting to script-defaults for custom increments.",
                );
                customIncrementsAreAllValid = false;
                break;
              }
            }
          }
          if (customIncrementsAreAllValid) {
            CUSTOM_INCREMENTS_current = settingsObj["CUSTOM_INCREMENTS"];
          }
        }
        if (
          settingsObj.hasOwnProperty("WARNINGSETTINGS") &&
          comparePropNames(settingsObj.WARNINGSETTINGS, WARNINGSETTINGS)
            .resMsg == "All Found"
        ) {
          WARNINGSETTINGS = settingsObj.WARNINGSETTINGS;
          for (var all in WARNINGSETTINGS) {
            if (SETTINGS.hasOwnProperty(all)) {
              SETTINGS[all] = WARNINGSETTINGS[all];
            }
          }
        }
      } else {
        PRESETS.getByName("default").datasetNameObj = DATASETNAMEFIELDS_current;
      }

      this.currentLoadedPresetName = getCurrentlySelectedPresetName();
      this.multiColumnListBoxTest =
        this.os == "Windows" || this.AIVersion != 16 ? true : false;
      this.tabbedGroupTest = this.AIVersion > 13 ? true : false;
      // ScriptUI tabbedpanel was unavailable in Illustrator CS3
    },
  };

  var PresetDialogPurposes = {
    Add: {
      resultAction: function (presetDialogResult, UIElements, listBox) {
        SESSION.currentLoadedPresetName = presetDialogResult.presetName;
        PRESETS.addItem(
          PRESETS.getByName("default"),
          SESSION.currentLoadedPresetName,
        );
        updateScriptDataFromUI(UIElements);
        UIElements.saved = UIElements["disp_dataFile"].getValue() != "";
        populateUI(UIElements);
        refreshPresetListbox(listBox);
      },
      presetDispEditable: true,
      placeholderName: "New Preset",
      actionButtonName: "Add",
      showRemoveButton: false,
    },
    Remove: {
      resultAction: function (presetDialogResult, UIElements, listBox) {
        SESSION.currentLoadedPresetName = "default";
        setCurrentlySelectedPresetName("default");
        PRESETS.removeItemByName(presetDialogResult.presetName);
        populateUI(UIElements, true);
        refreshPresetListbox(listBox);
      },
      presetDispEditable: false,
      placeholderName: "self",
      actionButtonName: "Remove",
      showRemoveButton: true,
    },
    Activate: {
      resultAction: function (presetDialogResult, UIElements) {
        var thisName = presetDialogResult.presetName;
        var thisPreset = PRESETS.getByName(thisName);
        SESSION.currentLoadedPresetName = thisName;
        setCurrentlySelectedPresetName(thisName);
        if (thisPreset.hasOwnProperty("datasetNameObj")) {
          DATASETNAMEFIELDS_current = clone(thisPreset.datasetNameObj);
        }
        // switchStackView(UIElements["stackGroup"], "variablesDisplay");
        UIElements["variablesDisplayR"].notify("onClick");
        populateUI(UIElements, true);
      },
      presetDispEditable: false,
      placeholderName: "self",
      actionButtonName: "Activate",
      showRemoveButton: true,
    },
    Update: {
      resultAction: function (presetDialogResult, UIElements, listBox) {
        var oldName = presetDialogResult.oldName;
        var newName = presetDialogResult.presetName;
        if (PRESETS.getByName(newName) != null && oldName != newName) {
          if (!CONFIRMS["overwriteOtherExistingPreset"](newName)) {
            return;
          }
        } else {
          PRESETS.getByName(oldName).name = newName;
        }
        SESSION.currentLoadedPresetName = newName;
        setCurrentlySelectedPresetName(newName);
        updateScriptDataFromUI(UIElements, newName);
        populateUI(UIElements);
        refreshPresetListbox(listBox);
      },
      presetDispEditable: true,
      placeholderName: "self",
      actionButtonName: "Update",
      showRemoveButton: false,
      oldName: "",
    },
  };

  if (typeof VI_MEMORY_SETTINGS == "undefined") {
    VI_MEMORY_SETTINGS = {
      lastChosenDataFilePath: "",
    };
  }

  var PRESETS = [
    {
      name: "default",
      useHeaders: true,
      currentlySelected: true,
      transpose: false,
      dbslNextline: false,
      keepXML: false,
      xmlPath: "temp",
      selectedAutobinding: "bindByName",
      prependToAllImages: false,
      prependImagePath: "",
      prependToAllGraphs: false,
      prependGraphPath: "",
      datasetNameObj: {},
      enabledVisibilityKeyNames: [
        "True",
        "False",
        "On",
        "Off",
        // "One",
        // "Zero",
      ],
    },
  ];

  PRESETS.getByName = function (value) {
    var item;
    for (var i = 0; i < this.length; i++) {
      item = this[i];
      if (item.hasOwnProperty("name")) {
        if (item.name == value) {
          return item;
        }
      }
    }
    return null;
  };

  PRESETS.getAllNames = function () {
    var namesArr = [];
    var item;
    for (var i = 0; i < this.length; i++) {
      item = this[i];
      if (item.hasOwnProperty("name")) {
        namesArr.push(item.name);
      }
    }
    return namesArr;
  };

  PRESETS.removeItemByName = function (name) {
    var item;
    for (var i = 0; i < this.length; i++) {
      item = this[i];
      if (item.hasOwnProperty("name") && item.name == name) {
        this.splice(i, 1);
        break;
      }
    }
  };

  PRESETS.addItem = function (cloneObj, newName) {
    if (this.getByName(newName) != null) {
      var conf = confirm(
        "This preset '" + newName + "' already exists, overwrite?",
      );
      if (!conf) {
        return;
      }
      this.removeItemByName(newName);
    }
    var obj = {};
    for (var all in cloneObj) {
      obj[all] = cloneObj[all];
    }
    obj.name = newName;
    this.push(obj);
    var thisObj;
    for (var i = 0; i < this.length; i++) {
      thisObj = this[i];
      if (thisObj.name != newName) {
        thisObj.currentlySelected = false;
      } else {
        thisObj.currentlySelected = true;
      }
    }
  };

  var CUSTOM_INCREMENTS = [
    {
      // generic examples & naming-convention idea.
      name: "s0p3i1",
      startNum: 0,
      padZero: 3,
      increment: 1,
      isIntervalIncrement: false,
    },
    {
      name: "s1p2i1",
      startNum: 1,
      padZero: 2,
      increment: 1,
      isIntervalIncrement: false,
    },
    {
      name: "s1p2i10-interval",
      startNum: 1,
      padZero: 3,
      increment: 10,
      isIntervalIncrement: true,
    },
  ];

  var WARNINGSETTINGS = {
    showDatasetNamingWarning: true,
    showExistingVariablesWarning: true,
    confirmRemovalOfPresets: true,
    confirmUpdatingOfPresets: true,
    showSuccessfulSettingsFileSaves: true,
  };

  var CONFIRMS = {
    showDatasetNamingWarning: function () {
      if (WARNINGSETTINGS["showDatasetNamingWarning"] == true) {
        return confirm(
          "This data import has been defaulted to generic dataset names. Continue import?",
        );
      }
      return true;
    },
    showExistingVariablesWarning: function (numVars) {
      if (WARNINGSETTINGS["showExistingVariablesWarning"] == true) {
        return confirm(
          "This document already contains " +
            numVars +
            " variable" +
            (numVars > 1 ? "s" : "") +
            " which may be overwritten. Continue import?",
        );
      }
      return true;
    },
    confirmRemovalOfPresets: function (presetName) {
      if (WARNINGSETTINGS["confirmRemovalOfPresets"] == true) {
        return confirm("Remove Preset '" + presetName + "' ?");
      }
      return true;
    },
    confirmUpdatingOfPresets: function (presetName) {
      if (WARNINGSETTINGS["confirmUpdatingOfPresets"] == true) {
        return confirm("Update Preset '" + presetName + "' ?");
      }
      return true;
    },
    overwriteOtherExistingPreset: function (presetName) {
      if (WARNINGSETTINGS["confirmUpdatingOfPresets"] == true) {
        return confirm("Overwrite Preset '" + presetName + "' ?");
      }
      return true;
    },
  };

  var SETTINGS = {
    useHeaders: true,
    transpose: false,
    dbslNextline: false,
    keepXML: false,
    xmlPath: "",
    selectedAutobinding: "noAutoBinding",
    prependToAllImages: false,
    prependImagePath: "",
    prependToAllGraphs: false,
    prependGraphPath: "",
    getDataXMLDestination: function () {
      return File(
        Folder.desktop +
          "/VariableImporterData_" +
          new Date().getTime() +
          ".xml",
      );
    },
    incrementStartNumber: 1,
  };

  var DATASETNAMEFIELDS = {
    field_1: {
      type: "customText",
      text: "Record",
    },
    field_2: {
      type: "dash",
      text: "-",
    },
    field_3: {
      type: "increment",
      text: "INC",
    },
    field_4: {
      type: "nothing",
      text: "",
    },
    field_5: {
      type: "nothing",
      text: "",
    },
    field_6: {
      type: "nothing",
      text: "",
    },
  };

  var FIELDNAMEOPTIONS = {
    customText: {
      defaultText: "[Edit Text]",
      displayText: "Custom Text",
      type: "customText",
    },
    dash: {
      defaultText: "-",
      displayText: "Dash",
      type: "dash",
    },
    nothing: {
      defaultText: "",
      displayText: "Nothing",
      type: "nothing",
    },
    space: {
      defaultText: " ",
      displayText: "Space",
      type: "space",
    },
    increment: {
      defaultText: "INC",
      displayText: "Increment",
      type: "increment",
    },
    underscore: {
      defaultText: "_",
      displayText: "Underscore",
      type: "underscore",
    },
    customIncrement: {
      defaultText: "<custom increment name set here>",
      displayText: "Custom Increment",
      type: "customIncrement",
    },
  };

  var DATASETNAMEFIELDS_current = clone(DATASETNAMEFIELDS);
  var FIELDNAMEOPTIONS_current = clone(FIELDNAMEOPTIONS);
  var CUSTOM_INCREMENTS_current = clone(CUSTOM_INCREMENTS);

  var VARTYPES = {
    Text: {
      key: "",
      type: "Text",
      itemKind: "TextFrame",
      trait: "textcontent",
      category: "&ns_flows;",
      varKind: "VariableKind.TEXTUAL",
      contentKind: "contentVariable",
    },
    Visibility: {
      key: "#",
      type: "Visibility",
      itemKind: "All",
      trait: "visibility",
      category: "&ns_vars;",
      varKind: "VariableKind.VISIBILITY",
      contentKind: "visibilityVariable",
    },
    Image: {
      key: "@",
      type: "Image",
      itemKind: "PlacedItem",
      trait: "fileref",
      category: "&ns_vars;",
      varKind: "VariableKind.IMAGE",
      contentKind: "contentVariable",
    },
    Graph: {
      key: "%",
      type: "Graph",
      itemKind: "GraphItem",
      trait: "graphdata",
      category: "&ns_graphs;",
      varKind: "VariableKind.GRAPH",
      contentKind: "contentVariable",
    },
  };

  var UI_SIZING = {
    variableDisplay: {
      small: {
        varAmt: "1-8",
        height: 150,
      },
      medium: {
        varAmt: "9-15",
        height: 300,
      },
      large: {
        varAmt: "16-Infinity",
        height: 500,
      },
    },
    bindingTestDisplay: {
      preferredSize: [430, 300],
    },
    foundOfTotalDisp: {
      // those inputs which show found/total numbers of file references
      characters: 12,
    },
    sizeSpecs: {
      platforms: {
        Windows: {},
        Mac: {},
      },
    },
    panelWidth_1: 466,
    init: function () {},
  };

  var DATA = {
    grid: [],
    transposedGrid: [],
    currentSourceFile: "",
    currentVars: [],
    oldVars: [],
    testVariableName: function (oldName, newName) {
      var msg = "",
        allVarNames = getSpecificPropertyListArr(DATA.currentVars, "varName");
      if (!isXMLTagName(newName)) {
        msg =
          "The '" +
          newName +
          "' variable name doesn't not follow the proper XML syntax:\n" +
          INFO.xmlRequirements;
        scriptAlert(msg);
        return false;
      } else {
        if (
          checkForSingleDuplicate(allVarNames, newName).length > 0 &&
          oldName != newName
        ) {
          msg =
            "The '" +
            newName +
            "' variable name already exists among imported variable names.";
          scriptAlert(msg);
          return false;
        }
      }
      return true;
    },
    testNameProp_unique: function (argsObj) {
      // argsObj = {collection : [], prop : "varName", prefixString : "Variable", collectionName : "Variables", showDialog : true}
      var badArr = [],
        namesArr,
        msg;
      namesArr =
        typeof argsObj.prop == "string"
          ? getSpecificPropertyListArr(argsObj.collection, argsObj.prop)
          : argsObj.collection;

      badArr = arrayGetUniqueDuplicates(namesArr);
      if (badArr.length > 0) {
        msg =
          "The following " +
          argsObj.collectionName +
          " name(s) are found more than once\n" +
          "(All " +
          argsObj.collectionName +
          " names are going to be Auto-replaced):" +
          "\n--------------------------------------\n" +
          badArr.join("\n");
        if (argsObj.showDialog) {
          quickView(
            msg,
            argsObj.collectionName + " Names Correction",
            [400, 550],
          );
        }
        this.genericize(argsObj.collection, argsObj.prop, argsObj.prefixString);
        return false;
      }
      return true;
    },
    testVarNames_xml: function () {
      var badArr = [],
        thisVar,
        msg;
      for (var i = 0; i < this.currentVars.length; i++) {
        thisVar = this.currentVars[i];
        if (!isXMLTagName(thisVar.varName)) {
          badArr.push(thisVar.varName);
        }
      }
      if (badArr.length > 0) {
        msg =
          "Proper XML Syntax isn't followed by some variable name(s)\n" +
          INFO.xmlRequirements +
          "\n" +
          "(All names are going to be Auto-replaced):\n--------------------------------------\n" +
          badArr.join("\n");

        quickView(msg, "Variable Name Correction", [400, 550]);
        this.genericize(this.currentVars, "varName", "Variable");
        return false;
      } else {
        return true;
      }
    },
    genericize: function (collection, prop, prefixString) {
      if (typeof prop == "undefined") {
        for (var i = 0; i < collection.length; i++) {
          collection[i] = prefixString + (i + 1);
        }
      } else {
        for (var i = 0; i < collection.length; i++) {
          collection[i][prop] = prefixString + (i + 1);
        }
      }
    },
    getCurrentVars: function (UIElements) {
      if (this.currentSourceFile == "" || this.grid.length == 0) {
        return null;
      }
      this.oldVars = [];

      if (
        typeof UIElements != "undefined" &&
        UIElements["variableDisplay"].items.length > 0
      ) {
        for (var i = 0; i < DATA.currentVars.length; i++) {
          if (i < DATA.currentVars.length) {
            this.oldVars.push(DATA.currentVars[i]);
          }
        }
      }
      var data = SETTINGS.transpose ? this.transposedGrid : this.grid;
      this.currentVars = [];
      var varName = "",
        varType = "",
        datum = "",
        thisUrl;
      for (var i = 0; i < data[0].length; i++) {
        // header row is variable names
        datum = data[0][i];
        varName = SETTINGS.useHeaders
          ? datum.replace(/^[@#%]/, "")
          : "Variable" + (i + 1);
        varType = SETTINGS.useHeaders ? getVariableType(datum) : "Text";
        thisUrl = "";
        if (varType == "Image" || varType == "Graph") {
          if (SETTINGS["prependToAll" + varType + "s"]) {
            thisUrl = SETTINGS["prepend" + varType + "Path"];
          }
        }

        this.currentVars.push({
          varIndex: i,
          varName: varName,
          varType: varType,
          useUrl: true,
          url: thisUrl,
        });
      }
      if (this.testVarNames_xml()) {
        this.testNameProp_unique({
          collection: this.currentVars,
          prop: "varName",
          prefixString: "Variable",
          collectionName: "Variable",
          showDialog: true,
        });
      }
    },
    getVariableNames: function () {
      if (this.currentVars.length > 0) {
        return getSpecificPropertyListArr(this.currentVars, "varName");
      }
      return [];
    },
    currentGrid: [],
    currentDatasetNames: [],
    getCurrentGrid: function () {
      if (this.currentVars.length == 0) {
        return [];
      }
      var data = !SETTINGS.transpose ? this.grid : this.transposedGrid;
      var start = !SETTINGS.useHeaders ? 0 : 1;
      var row,
        cell,
        arr = [],
        rowArr = [],
        thisVar,
        dsnArr = [];
      for (var i = start; i < data.length; i++) {
        row = data[i];
        rowArr = [];
        dsnArr.push(
          getRecordDatasetName(DATASETNAMEFIELDS_current, row, i - start),
        );
        for (var j = 0; j < row.length; j++) {
          cell = row[j];
          thisVar = this.currentVars[j];
          if (
            thisVar.url != "" &&
            (thisVar.varType == "Image" || thisVar.varType == "Graph")
          ) {
            cell = getPrependPathValue(thisVar, cell);
          }
          rowArr.push(cell);
        }
        arr.push(rowArr);
      }
      this.currentGrid = arr;

      this.currentDatasetNames = dsnArr;
    },
    getTestDatasetNames: function (dsNameFieldObj) {
      if (this.currentVars.length == 0) {
        return [];
      }
      var data = !SETTINGS.transpose ? this.grid : this.transposedGrid;
      var start = !SETTINGS.useHeaders ? 0 : 1;
      var row,
        dsnArr = [];
      for (var i = start; i < data.length; i++) {
        row = data[i];
        dsnArr.push(getRecordDatasetName(dsNameFieldObj, row, i - start));
      }

      this.testNameProp_unique({
        collection: dsnArr,
        prop: undefined,
        prefixString: "Record ",
        collectionName: "Dataset",
        showDialog: WARNINGSETTINGS["showDatasetNamingWarning"],
      });

      return dsnArr;
    },
  };

  var AUTOBINDING = {
    noAutoBinding: {
      type: "noAutoBinding",
      text: "No Auto Binding",
      getProp: function (item) {
        return "N/A";
      },
    },
    bindByName: {
      type: "bindByName",
      text: "Bind By Name",
      getProp: function (item) {
        return item["name"];
      },
    },
    bindByNote: {
      type: "bindByNote",
      text: "Bind By Note",
      getProp: function (item) {
        return item["note"];
      },
    },
    bindByTag: {
      type: "bindByTag",
      text: "Bind By Tag",
      preferredTagName: "VariableImporterBinding",
      getProp: function (item) {
        if (item.tags.length > 0) {
          return getSpecificPropertyListArr(item.tags, "name");
        } else {
          return [];
        }
      },
    },
  };

  var VisibilityKeys = [
    {
      displayText: "true",
      name: "True",
      value: true,
      enabled: true,
    },
    {
      displayText: "false",
      name: "False",
      value: false,
      enabled: true,
    },
    {
      displayText: "on",
      name: "On",
      value: true,
      enabled: true,
    },
    {
      displayText: "off",
      name: "Off",
      value: false,
      enabled: true,
    },
    {
      displayText: "1",
      name: "One",
      value: true,
      enabled: false,
    },
    {
      displayText: "0",
      name: "Zero",
      value: false,
      enabled: false,
    },
  ];

  var ICONS = {
    Visibility:
      '\u0089PNG\r\n\x1A\n\x00\x00\x00\rIHDR\x00\x00\x00\x14\x00\x00\x00\x14\b\x02\x00\x00\x00\x02\u00EB\u008AZ\x00\x00\x00\x19tEXtSoftware\x00Adobe ImageReadyq\u00C9e<\x00\x00\x01?IDATx\u00DAb\u00FC\u00FF\u00FF?\x03\u00B9\u0080qT3\x14|\u00F8\u00F0\u00E1\u00C2\u0085\x0Bp\u00AE\u0081\u0081\u0081\u0080\u0080\x00a\u00CD\x0B\x16,\u00988q"P\u00A9\u008E\u00A9\u00C5\u0091\u00FB/\u00B9X\u0099\u008DdD\u008E\u00EC\u00DE\x01\u0094\u00CA\u00CF\u00CFOHH\u00C0\u00AEy\u00C3\u0086\r\u008D\u008D\u008D\u00FE\u00FE\u00FE@\x15L\x02"\u00E7\u009F\u00BE\x05j~\u00F3\u00F5\x07P*\u00D9L]\u0086\u00F1;\u00D0\u00DC\u008D\x1B7\u00D6\u00D7\u00D7\x07\x04\x04@u\x035\u00BF\x7F\u00FF\x1E\u00A8\x01(t\u00FF\u00FE} \u00F7\u00F5\u0097\u00EF\x1B\u00AE<\x002z\u00A6\u00CEP\u00B1\u00F7\u0088\u009A\u00B75a\u00C5A\u00A0 P\x04\u00A8\u00C0\u00C1\u00C1\x01\u00A8\x18\u00A8\x05d+\u0090\x02z\u00A9\u00BF\u00BF\u00FF?\f\u00EC\u00BC\u00F9\u00A4d\u00F3I\u00A0N\u0088?\u0081\u00FA\u0081\u009A\u00D7_~\x00W\x00T\f\u00D4\x02\u00D4\u00C8\u0082\x19\f\u00DF~\u00FD\x01\u00BAv\u00C3\u00AA\r\u00C0`\u0083\x0Br\u00B1aQ\u00C9\x044~\u00FF\u00FE\u00FD\x17/^ttt|\u00F0\u00E0\x01P\u00C8FQ\x1CH\u009A\u00C5\u00E7\x02\u00ED\x04" \x03\u00C85\u0092\x16\x06\u0092@\x05\u0081\u0081\u0081@\u00C5@-@\u008D\u00D8\x03\u00EC\u00C9\x7F\u00CE\u00B9\u00A7n\u00C2m\u00C0\x15`\u00D8\u00A3\nd\u00BF\u00AB\u00C7\u00B9\'o\u00BE\u00FD\u00FE\x0Bt\u00C8\u0095\u00D3\'\u0080^\u00C0\x17UTH$\u00A3Y\u0092\x00\x00\b0\x00\u009C \u00F4D\u0080v\u00BF\u00C6\x00\x00\x00\x00IEND\u00AEB`\u0082',
    Image:
      '\u0089PNG\r\n\x1A\n\x00\x00\x00\rIHDR\x00\x00\x00\x14\x00\x00\x00\x14\b\x02\x00\x00\x00\x02\u00EB\u008AZ\x00\x00\x00\x19tEXtSoftware\x00Adobe ImageReadyq\u00C9e<\x00\x00\x01\x7FIDATx\u00DAb\u009C\u009B\u00CF@6`b\u00A0\x00\u00B0@(\u00A5\t_H\u00D2v\u00AF\u0080\x07\u00C5fY\u0086j=\x06mm\x06\x0B\x1E\u0086\u00D3\u00C8\u00EA\u0098\x19\u00FE\x13v\u00B6 \u00C3\x06\u00B0\u00D2\u00CF\u00E2\fS\u0091\x04\u00BF\x0B}~y\u00E1\u00D2\u00EB\u009F?\u00FF\u00E2\u00D3\u00FC\u0097\u0081\x17\u00C2\u00F8\u00C5 \r\x17\u00E4\u00FB\u00FB\u00ED\u00E7\x1F\x06y\u00DE\u00BF\u009F>\u00FF\u00C2\u00E9g\u00907\x18\x16\u00883L\u00FB\u00C5 \u00F5\u0092!\x1B"\u00F2\u00E3\u00F3w&\u00B6\u00DF@\u00C6\u00F3\u00CF\f\x7F\u00BF}\u00E3\u00E6b\u00E5\u00E2b\u00C1\u00AE\u00F9;\u0083\u00C6\x03\u0086Ip\u00EE\u00EB7\u00DFY>\x7F\u00E4Ud\u00E0eg\u00D8}\x07(\u00F0\u00FB\u00DA\u008DwZ\x1AB\u00C8\u00FAY\u00B0\u0086\x04P\u00E7\u00BD\u00FB\x1F!la.\u0098\u00BF\u00FE\u00FE\u00BB{\u00FF#P?33#>\u00CDJ\\?\u00CD\u00F4\x18~\u00FDe\u00B8\u00F5\x06\u00AA\x19H\u00BE\u00FD\u00C6\u00F0\u00ED\u00DB\u00EFO\u009F~\t\n\u00B2\u00A3h.L\u00E5@\u00D6l\u00A4\u00CE\u00DF]\u00F2\u00E3\u00CAK\u0084f6f\u0090\u00FB\x1F=ci\u009A\u00C5\x0F\u00E4\u00E6r#i\u00BEp\u0086\x19Y\u00F3\u00853<5\u00E9\u00AF\u009F\x7F\u00FE\x07\u00D4\t4\x02\x12f@p\u00ED\x027T\u00A5=\u00DE\u00E4\u00B9|\x13\u00AF\u00AB\n\u0083\u008F\x06\u0083\u00A5\x1CB\u00F0\u00C8\x1E\x01\u00A2\u00D2\u00F6\u00F2\u00CD\u00BCh"\u00CF\x1F\u00B3\u00BF\x7F\u00CBB\u0094\u00E6+7\u00D9\u0081\bY\u00E4\u00C8^~\u009C\u0089\x04\x13\u00D8G\u00C8x9~57\u00FB\u00BA\u00FB\f\u00FB\u00D5\x0B\u00DCh\u00D6\x12\u00D0\f\x04\u00DB\u00F6s\x03\x11-\u00F3\u00F3\\{Fz\u0097$\x00\x01\x06\x00<\u00E3\u0084d\u0089\u00F2\x1C;\x00\x00\x00\x00IEND\u00AEB`\u0082',
    Graph:
      "\u0089PNG\r\n\x1A\n\x00\x00\x00\rIHDR\x00\x00\x00\x14\x00\x00\x00\x14\b\x02\x00\x00\x00\x02\u00EB\u008AZ\x00\x00\x00\x19tEXtSoftware\x00Adobe ImageReadyq\u00C9e<\x00\x00\x01\u00FDIDATx\u00DAbd``\u00F8\u00FF\u00FF?\x03\u00E9\u0080\u0091\u0091\u0091\x05H\u009D={\u0096\u0081,\u00C0H\u0089\u00CDL\f\x14\x00,\u00CE\u00E6z\u00FC\x14\u00C2\u00F8\u00CB\u00CE\u00FESL\u0084\u0080\x01\u00FFQ\u00C1Au]\x0F~\u00C1J\t\u0099\u008B\u00B1I\u00FFq\x03\u00A0F\u00EC\u00CE\u00DE\u00F1\u00F1\u00FD\u00E1/\u009F\b:\x1B\u008B\u00E6\x0B\u00DF\u00BE&\u008A\u0088\u00F303\x13\u00E5\u00E7\x07\u0093\u00B6\n\x1F}\x0E\u00E1?\u0089T]\u00FD\u00FEM\u00AB\u00B4\u00FC\u0082\u00B7\u00AFn\u00BF\x7F\u00FB\x1B)8\u00B8\x7F>Vz\u00B9\u00FC\u00F0\u00ED\u009F\x0F\u00DF\u00FD\u00D9s\x07\u00A6Y\u00FC/\u00C7\u00F7\x13\u00F7 *\u0096~<\x1C*\b\n$\x0F>\u0081#\u00FF\u00FE\x04\x1B\x1B\u00C35\u00FF{\u00FA{\u00CF\u00CA\u0083\u00EE\u0093^\u00C6\u009As/\u009A\u00D4\u00BC|\u00EDV\x14g?\u00FA\u00F3\u00F1\u008B4\u00A7\x01\x177\u0090-\u00C1\u00CAv\u00E7\u00D2e4w\x02\u00ED\x04\u00EA\u00CCq\u00E0E\u00F8\u00F9\u00D5\u00ABW\x10N\u00D7\u00C7\u00C3\u0099\u00FE\u00D1p\u00A5N\x1C\u00DC\u0093'O~\x06\x03w\u009F\u00BC:|\u00FB\u00C7\u00AC\x18a=\x19\u00B6\u00CF\u009F\u00BF@5\u00D7\u00EE[x\u00E5\u00D7\u00CB\u00E5_/\u00EB\u00B0\u0089\u00F33q\u00C05\u00DB\x18\x1B\x1D<x\x10\u00CE\u009D\u00BCt\x0F\u00DCN\u0084\u00CD3#J;?\x1E\u00C9y\u00BB\u00C5\u0086]NXD\x18.\u00C7\u00CE\u00C6\u00AEone\u00B3\u00EC\u00B2\u00CB\u00B1\u00BF\u00F6\x1B\x1F2\u00BE8\x05\u00B4\x13\"\u00C5\u00CB\u00CB\u0083\u0088\u00AA\f>S/N5Y\x16~4O\u00F2;\u0084~<\u00B0\x1A\u00C8x9\u00BF1<\u00BF\nKT=\x7F\u00FE\u00DC\u009A]\u00CEZT\x0E\u00C8\u00BE}\u00EB\x16\\\u00EE\u00F3\u00E7O/?}\x051N\u00EF\u00E45s\u0083\u00B0!\x00\u00A8\x05j\u00B3\u00A4\u00A4$\\TUM\r\u00CE\u00E6\u00E5\u00E5\u0093\u0092\u0094\u00FC\u00FB\u00F5\u00D3\u0093\u00AET.mKde\x106\x0B\u00C1d\x04\u00B4\u00F3\u00DF\u00D7OL\\|\f\f\u00AF\u00B18\u009B\u0080fSw \x023_c)\f\u00E4X\u00F8\u00E1Au\u00E5\u00D7+E\x0Eh\u00AA\u00FE\u00F2\u00F7\u00EFC>\x11V1Y\b\u0097\u00E3\u00E5u\x1D\u00C1\x1F\u00D0\u00D4\u00F2\u00F6\x0F0\u00C1\x00\x04\x18\x00b\u00C8\u00EF\x17\u00C9\u00FD\u009FL\x00\x00\x00\x00IEND\u00AEB`\u0082",
    Text: "\u0089PNG\r\n\x1A\n\x00\x00\x00\rIHDR\x00\x00\x00\x14\x00\x00\x00\x14\b\x02\x00\x00\x00\x02\u00EB\u008AZ\x00\x00\x00\x19tEXtSoftware\x00Adobe ImageReadyq\u00C9e<\x00\x00\x00\u00B1IDATx\u00DAb\u00FC\u00FF\u00FF?\x03\u00B9\u0080\x05\u0088/\\\u00B8\u00F0\u00E1\u00C3\x07\u0092\u00B4\t\b\b\x18\x18\x180\x00mvpp \u00D5N\u00A0\x16\u00A0F&\x06\n\x00\x0B\u00B2a\u00C8\x12\x0F\u00C0\x00\u00C8P\x00\x03d\u00A9\x03\x07\x0E@Ypg\u00FFG\x05\u00F5\u00F5\u00F5\x10\x05@\x06\u009A\x14\u00F5\u009C\u00DD\u00DF\u00DFORh\u00EF\u00DF\u00BF\x1F\x18\u00DAP\u00CD\u00A0@'1\u00A8!\f\u008A\u009C=\u00AA\u0099Z\u009A\x1F>|\u0088\u00C6\u00C0\u0097\u00B6\u0081\x00\u0098T\u0080\u00D9\x13\u00C8\u00D8\u00B8q\u00E3\u0082\x05\x0B \u0082@\x060I\u00F8\u00FB\u00FBCR\x04$y \u00D26\x1C\x00\u0093\x0E\u00C1\u00B4\u0085\u00AC\u009E\x11\u00B9$\u0081\u00DB\u008C\x0B\u00A0\u00D9\u00CCHI1\x04\x10`\x00\u00C5_\u0084\u00C3\u008F\u00CF\u00D1\u009F\x00\x00\x00\x00IEND\u00AEB`\u0082",
  };

  var INFO = {
    xmlRequirements:
      "1) Element names are case-sensitive" +
      "\n" +
      "2) Element names must start with a letter or underscore" +
      "\n" +
      "3) Element names cannot start with the letters xml (or XML, or Xml, etc)" +
      "\n" +
      "4) Element names can contain letters, digits, hyphens, underscores, and periods" +
      "\n" +
      "5) Element names cannot contain spaces",
  };

  SESSION.init();

  var DocumentBinding = {
    // names of variables are expected to be unique, but art identifying properties (.name , .note and .tags.tag) are not.
    artItems: {},
    namedArtCollection: [],
    getNamedBinds: function (doc) {
      if (DATA.currentVars.length == 0) {
        return null;
      }
      this.artItems = {};
      this.namedArtCollection = this.getAllDocumentNamedItems(
        doc,
        AUTOBINDING[SETTINGS.selectedAutobinding],
      );
      var varNames = DATA.getVariableNames(),
        varTypes = getSpecificPropertyListArr(DATA.currentVars, "varType"),
        newVarBindObj;
      for (var i = 0; i < varNames.length; i++) {
        newVarBindObj = {};
        if (SETTINGS.selectedAutobinding == "noAutoBinding") {
          newVarBindObj.bindCollection = [];
        } else {
          newVarBindObj.bindCollection = this.getSortedNamedItems(
            this.namedArtCollection,
            varNames[i],
            varTypes[i],
            AUTOBINDING[SETTINGS.selectedAutobinding],
          );
        }
        newVarBindObj.varType = varTypes[i];
        this.artItems[varNames[i]] = newVarBindObj;
      }
    },
    getAllDocumentNamedItems: function (doc, method) {
      var arr = [],
        testProp,
        thisItem;
      for (var i = 0; i < doc.pageItems.length; i++) {
        thisItem = doc.pageItems[i];
        testProp = method.getProp(thisItem);
        if (testProp instanceof Array && testProp.length > 0) {
          // dealing with tag
          arr.push(thisItem);
        } else if (typeof testProp == "string" && testProp != "") {
          arr.push(thisItem);
        }
      }
      return arr;
    },
    getSortedNamedItems: function (collection, varName, varType, method) {
      var arr = [],
        thisItem,
        testProp,
        testTag;
      for (var i = 0; i < collection.length; i++) {
        thisItem = collection[i];
        if (
          thisItem.typename == VARTYPES[varType].itemKind ||
          VARTYPES[varType].itemKind == "All"
        ) {
          testProp = method.getProp(thisItem);
          if (testProp instanceof Array && testProp.length > 0) {
            // dealing with tag
            if (testProp.indexOf(varName) > -1) {
              arr.push(thisItem); // get item if tag's name matches the variable's name
            } else {
              try {
                testTag = thisItem.tags.getByName(method.preferredTagName);
                if (testTag.value == varName) {
                  arr.push(thisItem); // get item if tag's name is "VariableImporterBinding" and value matches variable's name
                }
              } catch (e) {}
            }
          } else if (typeof testProp == "string" && testProp == varName) {
            arr.push(thisItem);
          }
        }
      }
      return arr;
    },
    getBindObjectTestResults: function () {
      var artItemNames = getPropertyList(this.artItems);
      if (artItemNames.length == 0) {
        return null;
      }
      var res = {
        log: "",
        countTextVars: 0,
        foundTextItems: 0,
        countImageVars: 0,
        foundImageItems: 0,
        countGraphVars: 0,
        foundGraphItems: 0,
        countVisibilityVars: 0,
        foundVisibilityItems: 0,
      };

      var arrLog = [
        "Autobinding method: " +
          unCamelCaseSplit(SETTINGS.selectedAutobinding) +
          "\n-------------------",
      ];
      var thisName,
        thisItem,
        thisVarObj,
        thisBindCollectionCount = 0,
        foundItemString = "",
        thisFoundProp,
        thisVarCountProp;
      for (var i = 0; i < artItemNames.length; i++) {
        thisName = artItemNames[i];
        thisItem = this.artItems[thisName];
        thisVarObj = getSpecificPropertyObj(
          DATA.currentVars,
          "varName",
          thisName,
        );
        thisBindCollectionCount = thisItem.bindCollection.length;
        res["found" + thisVarObj.varType + "Items"] += thisBindCollectionCount;
        res["count" + thisVarObj.varType + "Vars"] += 1;
        arrLog.push(thisName + " : " + thisBindCollectionCount);
      }

      for (var all in VARTYPES) {
        thisFoundProp = "found" + all + "Items";
        thisVarCountProp = "count" + all + "Vars";
        foundItemString +=
          all + ": " + res[thisFoundProp] + "/" + res[thisVarCountProp] + ", ";
      }

      res.log = arrLog.join("\n");
      res.foundItemString = foundItemString.replace(/,\s$/, "");

      return res;
    },
    bindDocumentItems: function (doc) {
      this.getNamedBinds(doc);
      var artItemNames = getPropertyList(this.artItems),
        artCollection,
        artItem,
        thisDocVar,
        thisContentKind,
        thisVarTypeObj;

      var artItems = this.artItems,
        thisArtItemsVarName = "",
        currentSelection;
      artItemNames.sort(function (a, b) {
        if (artItems[a].varType == "Visibility") {
          return true;
        } else {
          return false;
        }
      });

      if (artItemNames.length == 0) {
        return null;
      }
      for (var i = 0; i < artItemNames.length; i++) {
        thisArtItemsVarName = artItemNames[i];
        thisDocVar = doc.variables.getByName(thisArtItemsVarName);
        for (var that in VARTYPES) {
          thisVarTypeObj = VARTYPES[that];
          if (thisVarTypeObj.varKind == thisDocVar.kind) {
            thisContentKind = thisVarTypeObj.contentKind;
            break;
          }
        }
        artCollection = this.artItems[thisArtItemsVarName].bindCollection;
        for (var j = 0; j < artCollection.length; j++) {
          artItem = artCollection[j];
          artItem[thisContentKind] = thisDocVar;
        }
      }
    },
  };

  function FileTestSeeker(prop) {
    return {
      makeUIContents: function (parent, propObj) {
        parent.spacing = 4;
        var size;
        if (typeof propObj.size == "undefined") {
          size = [350, 200];
        } else {
          size = propObj.size;
        }
        var disp_foundMissingNum = parent.add(
          "edittext { properties : {readonly : true}, justify : 'center' }",
        );
        disp_foundMissingNum.characters = UI_SIZING.foundOfTotalDisp.characters;

        var foundNum = "",
          missingNum = "",
          parsedNums;
        if (propObj.hasOwnProperty("foundMissingNum")) {
          disp_foundMissingNum.setValue(propObj.foundMissingNum);
          parsedNums = propObj.foundMissingNum.split("/");
          foundNum = parsedNums[0];
          missingNum = parsedNums[1] - foundNum;
        }
        var lbl_foundImageFiles = parent.add(
          "statictext",
          undefined,
          "Found " + prop + " Files: " + foundNum,
        );
        var foundList = parent.add("edittext", undefined, "", {
          readonly: true,
          multiline: true,
        });
        foundList.size = size;
        if (propObj.hasOwnProperty("foundFiles")) {
          foundList.setValue(propObj.foundFiles);
        }
        var lbl_missingImageFiles = parent.add(
          "statictext",
          undefined,
          "Missing " + prop + " Files: " + missingNum,
        );
        var missingList = parent.add("edittext", undefined, "", {
          readonly: true,
          multiline: true,
        });
        missingList.size = size;
        if (propObj.hasOwnProperty("missingFiles")) {
          missingList.setValue(propObj.missingFiles);
        }
        return {
          foundList: foundList,
          missingList: missingList,
          disp_foundMissingNum: disp_foundMissingNum,
        };
      },
      makeTab: function (parentTabbedPanel) {
        var tab = parentTabbedPanel.add("tab", undefined, prop + " Files");
        tab.key = prop;

        parentTabbedPanel.window.UITestElements["testTab" + prop] = tab;

        tab.contents = this.makeUIContents(tab, { size: [515, 130] });

        tab.populateFields = function () {
          var allResults = getFileRefTestResults();
          var thisRefResultNumFound =
            allResults["found" + prop + "s"].length - 1;
          var thisRefResultNumMissing =
            allResults["missing" + prop + "s"].length - 1;
          var foundFiles = allResults["found" + prop + "s"].slice(1).join("\n");
          var missingFiles = allResults["missing" + prop + "s"]
            .slice(1)
            .join("\n");
          var foundMissingNum =
            thisRefResultNumFound +
            "/" +
            (thisRefResultNumFound + thisRefResultNumMissing);
          tab.contents.foundList.setValue(foundFiles);
          tab.contents.missingList.setValue(missingFiles);
          tab.contents.disp_foundMissingNum.setValue(foundMissingNum);
        };
        tab.resetFields = function () {
          for (var all in this.contents) {
            this.contents[all].setValue("");
          }
        };
        return tab;
      },
    };
  }

  var GraphDataGatherer = {
    emptyGraphString:
      '<data  numDataColumns="2">' +
      "\r" +
      "<values>" +
      "\r" +
      "<row>" +
      "\r" +
      '<value  key="name"></value>' +
      "\r" +
      "<value>1</value>" +
      "\r" +
      "</row>" +
      "\r" +
      "</values>" +
      "\r" +
      "</data>",
    getGraphData: function (graphFilePath) {
      var graphFile;
      try {
        graphFile = File(graphFilePath);
        if (!graphFile.exists) {
          throw new Error(
            "Graph File not found: '" + decodeURI(graphFilePath) + "'",
          );
        }
        return this.getGraphDataFromFile(graphFile);
      } catch (e) {
        // alert(e);
        return this.emptyGraphString;
      }
    },
    isquoted: function (str) {
      return str.charAt(0) === '"' && str.charAt(str.length - 1) === '"';
    },
    unquoted: function (str) {
      if (str.charAt(0) === '"' && str.charAt(str.length - 1) === '"') {
        return str.substring(1, str.length - 1);
      } else {
        return str;
      }
    },
    analyzeCellContent: function (cell) {
      var res = {
        isQuoted: false,
        isNumber: false,
        isWord: false,
      };
      var rxNum = /^-?\d*[\.]?\d+$/;
      var rxWord = /[a-z]/gi;
      res.isQuoted =
        cell.charAt(0) === '"' && cell.charAt(cell.length - 1) === '"';
      res.isNumber =
        (res.isQuoted && rxNum.test(cell.replace(/"/g, ""))) ||
        (!res.isQuoted && rxNum.test(cell));
      res.isWord =
        (!res.isNumber && rxWord.test(cell)) ||
        (!res.isQuoted && !res.isNumber);
      return res;
    },
    getGraphDataFromFile: function (graphFile) {
      var res = "",
        maxcol = 1,
        haspropertyrow = false,
        hasnamecol = false;
      var col, row, numstr, myAnalyzedCell, thisCell;

      var textData = getData(graphFile.fsName);

      var i;
      var rows = [],
        vals = [];
      var name;
      for (i = 0; i < textData.length; i++) {
        vals = textData[i];
        if (vals.length > maxcol) {
          maxcol = vals.length;
        }
        rows.push(vals);
      }

      numstr = 0;
      for (col = 0; col < rows[0].length; col++) {
        if (rows[0][col] === "") continue;
        if (isNaN(rows[0][col])) numstr--;
        else numstr++;
      }
      haspropertyrow = numstr <= (col > 2 ? 0 : -1);

      numstr = 0;
      for (row = 0; row < rows.length; row++) {
        if (rows[row][0] === "") continue;
        if (isNaN(rows[row][0])) numstr--;
        else numstr++;
      }
      hasnamecol = numstr <= 0;

      // create a string
      res +=
        '<data  numDataColumns="' + (hasnamecol ? maxcol : maxcol + 1) + '">';
      row = 0;
      // propertyRow
      if (haspropertyrow) {
        res += '<propertyRow  key="name">';
        col = 0;
        thisCell = rows[row][col];
        if (hasnamecol) {
          // res += '<value' + (this.isquoted(rows[row][col]) || rows[row][col].match(/[a-z]/gi) ? '  type="string">' : '>')
          //        + stringXmlSafe(this.unquoted(rows[row][col++])) + '</value>';
          myAnalyzedCell = this.analyzeCellContent(thisCell);

          res +=
            "<value" +
            (myAnalyzedCell.isQuoted && myAnalyzedCell.isNumber
              ? '  type="string">'
              : ">") +
            stringXmlSafe(this.unquoted(thisCell)) +
            "</value>";

          col++;
        } else {
          res += "<value></value>";
        }
        for (; col < rows[0].length; col++) {
          thisCell = rows[row][col];
          myAnalyzedCell = this.analyzeCellContent(thisCell);
          res +=
            "<value" +
            ((myAnalyzedCell.isQuoted && myAnalyzedCell.isNumber) ||
            myAnalyzedCell.isWord
              ? '  type="string">'
              : ">") +
            stringXmlSafe(this.unquoted(thisCell)) +
            "</value>";
        }
        for (; col < maxcol; col++) {
          res += "<value></value>";
        }
        res += "</propertyRow>";
        row++;
      }
      // values
      res += "<values>";
      for (; row < rows.length; row++) {
        res += "<row>";
        col = 0;
        if (hasnamecol) {
          thisCell = rows[row][col];
          myAnalyzedCell = this.analyzeCellContent(thisCell);
          res +=
            "<value " +
            ' key="name"' +
            ((myAnalyzedCell.isQuoted && myAnalyzedCell.isNumber) ||
            myAnalyzedCell.isWord
              ? ' type="string">'
              : ">") +
            stringXmlSafe(this.unquoted(thisCell)) +
            "</value>";

          col++;
        } else {
          res += '<value key="name"></value>';
        }
        for (; col < rows[row].length; col++) {
          res +=
            "<value" +
            (isNaN(rows[row][col]) || rows[row][col].match(/[a-z]/gi)
              ? '  type="string">'
              : ">") +
            stringXmlSafe(this.unquoted(rows[row][col])) +
            "</value>";
        }
        for (; col < maxcol; col++) {
          res += "<value></value>";
        }
        res += "</row>";
      }
      res += "</values>";
      res += "</data>";

      return res;
    },
  };

  var TestManager = {
    datasetNames: {
      makeUIContents: function (parent, propObj) {
        var list = parent.add("edittext", undefined, "", {
          readonly: true,
          multiline: true,
        });
        list.size = propObj.size;
        if (propObj.hasOwnProperty("data")) {
          list.setValue(propObj.data);
        }
        return list;
      },
      makeTab: function (parentTabbedPanel) {
        var tab = parentTabbedPanel.add("tab", undefined, "Dataset Names");
        var disp_preview = tab.add(
          "edittext { properties : {readonly : true}, justify : 'center' }",
        );
        disp_preview.characters = 36;
        var list = this.makeUIContents(tab, { size: [300, 300] });

        tab.populateFields = function () {
          // make sure dataset names are unique, or else they get genericized
          DATA.testNameProp_unique({
            collection: DATA.currentDatasetNames,
            prop: undefined,
            prefixString: "Record ",
            collectionName: "Dataset",
            showDialog: WARNINGSETTINGS["showDatasetNamingWarning"],
          });
          if (DATA.currentDatasetNames.length > 0) {
            list.setValue(DATA.currentDatasetNames.join("\n"));
            disp_preview.setValue(getDatasetNamePreviewString());
          }
        };
        tab.resetFields = function () {
          list.setValue("");
          disp_preview.setValue("");
        };
        return tab;
      },
    },
    imageFiles: new FileTestSeeker("Image"),
    graphFiles: new FileTestSeeker("Graph"),
    artBindings: {
      // simpleShowModal(DocumentBinding.displayTestList, {title : "Binding Test Display"});
      makeUIContents: function (parent, propObj) {
        var listBox;
        if (!SESSION.multiColumnListBoxTest) {
          // crazy CS6 Bug with multi-column listbox crash.
          listProps = {};
        } else {
          listProps = SESSION.imageTest
            ? {
                // Embedded Image error 520
                numberOfColumns: 4,
                showHeaders: true,
                columnTitles: ["Variable Name", "", "Type", "Found Items"],
                columnWidths: [165, 25, 60, 80],
              }
            : {
                numberOfColumns: 3,
                showHeaders: true,
                columnTitles: ["Variable Name", "Type", "Found Items"],
                columnWidths: [165, 60, 80],
              };
        }

        listBox = parent.add("listbox", undefined, [], listProps);
        listBox.preferredSize = propObj.size;
        return listBox;
      },
      makeTab: function (parentTabbedPanel) {
        var tab = parentTabbedPanel.add("tab", undefined, "Art Bindings");
        var disp_preview = tab.add(
          "edittext { properties : {readonly : true}, justify : 'center' }",
        );
        disp_preview.characters = 52;
        var list = this.makeUIContents(tab, {
          size: UI_SIZING.bindingTestDisplay.preferredSize,
        });
        tab.list = list;

        tab.populateFields = function () {
          // reset the list by clearing it out
          list.removeAll();

          var varType,
            varName,
            foundCount = 0,
            newItem,
            thisItem;

          for (all in DocumentBinding.artItems) {
            thisItem = DocumentBinding.artItems[all];
            varType = thisItem.varType;
            newItem = list.add("item");
            varName = all;
            newItem.text = varName;
            foundCount = thisItem.bindCollection.length;
            if (!SESSION.multiColumnListBoxTest) {
              // crazy CS6 Bug with multi-column listbox crash.
              if (SESSION.imageTest) {
                // Embedded Image error 520
                newItem.image = ICONS[varType];
                newItem.text =
                  newItem.text + " | " + varType + " | " + foundCount;
              }
            } else {
              if (SESSION.imageTest) {
                newItem.subItems[0].image = ICONS[varType];
                newItem.subItems[1].text = varType;
                newItem.subItems[2].text = foundCount;
              } else {
                newItem.subItems[0].text = varType;
                newItem.subItems[1].text = foundCount;
              }
            }
          }
          disp_preview.setValue(
            unCamelCaseSplit(SETTINGS.selectedAutobinding) +
              ": " +
              DocumentBinding.getBindObjectTestResults().foundItemString,
          );
        };

        tab.parent.addEventListener("mouseover", function () {
          if (this.selection == null) {
            return;
          }
          if (this.selection.text == tab.text) {
            if (tab.list.items.length > 0) {
              tab.list.active = true;
              tab.list.active = false;
            }
          }
        });

        tab.resetFields = function () {
          list.removeAll();
          disp_preview.setValue("");
        };
        parentTabbedPanel.window.UITestElements["testTab" + "ArtBinding"] = tab;

        return tab;
      },
    },
    clearAllTestDisplays: function (UITestElements) {
      var thisElem, thisTab;
      for (var all in UITestElements) {
        thisElem = UITestElements[all];
        if (typeof thisElem.setValue == "function") {
          thisElem.setValue("");
        } else if (thisElem.type == "tabbedpanel") {
          for (var j = 0; j < thisElem.children.length; j++) {
            thisTab = thisElem.children[j];
            thisTab.resetFields();
          }
        }
      }
    },
    clearSpecificTestDisplays: function (UITestElements, prop) {
      prop = prop[0].toUpperCase() + prop.substr(1);
      UITestElements["found" + prop + "s"].setValue("");
      var tabItemKey = "testTab" + prop;
      if (UITestElements.hasOwnProperty(tabItemKey)) {
        UITestElements[tabItemKey].resetFields();
      }
    },
  };

  var XMLStringBuilder = {
    ee: false,
    baseString:
      '<?xml version="1.0" encoding="utf-8"?>' +
      "\r" +
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20001102//EN"    "http://www.w3.org/TR/2000/CR-SVG-20001102/DTD/svg-20001102.dtd" [' +
      "\r" +
      '	<!ENTITY ns_graphs "http://ns.adobe.com/Graphs/1.0/">' +
      "\r" +
      '	<!ENTITY ns_vars "http://ns.adobe.com/Variables/1.0/">' +
      "\r" +
      '	<!ENTITY ns_imrep "http://ns.adobe.com/ImageReplacement/1.0/">' +
      "\r" +
      '	<!ENTITY ns_custom "http://ns.adobe.com/GenericCustomNamespace/1.0/">' +
      "\r" +
      '	<!ENTITY ns_flows "http://ns.adobe.com/Flows/1.0/">' +
      "\r" +
      '<!ENTITY ns_extend "http://ns.adobe.com/Extensibility/1.0/">' +
      "\r" +
      "]>" +
      "\r" +
      "<svg>" +
      "\r" +
      '<variableSets  xmlns="&ns_vars;">' +
      "\r" +
      '	<variableSet  locked="none" varSetName="binding1">' +
      "\r" +
      "		<variables>" +
      "\r" +
      "PUT_VARIABLES_HERE" +
      "		</variables>" +
      "\r" +
      '		<v:sampleDataSets xmlns="http://ns.adobe.com/GenericCustomNamespace/1.0/" xmlns:v="http://ns.adobe.com/Variables/1.0/">' +
      "\r" +
      "PUT_DATASETS_HERE" +
      "		</v:sampleDataSets>" +
      "\r" +
      "	</variableSet>" +
      "\r" +
      "</variableSets>" +
      "\r" +
      "</svg>",
    generateVariablesGroupXMLString: function (varsRow) {
      var variablesGroup = XML("<root></root>");
      var thisVar, newVariable, thisVarType;
      var traitAndCategory = {
        category: "",
        trait: "",
      };
      var newVarsRow = varsRow.slice(0).sort(function (a, b) {
        return a.varType == "Visibility";
      });
      for (var i = 0; i < newVarsRow.length; i++) {
        thisVar = newVarsRow[i];
        newVariable = XML("<variable></variable>");
        thisVarType = thisVar.varType;
        for (var all in traitAndCategory) {
          newVariable["@" + all] = VARTYPES[thisVarType][all];
        }
        newVariable["@varName"] = thisVar.varName;
        variablesGroup.appendChild(newVariable);
      }
      return variablesGroup
        .toString()
        .replace(/&amp;/g, "&")
        .replace(/(<root>|<\/root>)/g, "");
    },
    getTextCellContent: function (cell, varName) {
      var thisVarXMLComponent = "",
        returnChars,
        paragraphTextArr = [],
        paraCount = 1,
        paragraphText = (thisText = "");
      if (SETTINGS.dbslNextline) {
        cell = cell.replace(/\\\\/g, "__RETURN_CHAR");
      }
      thisVarXMLComponent = XML("<" + varName + "></" + varName + ">");
      returnChars = cell.match(/\n/g);

      if (returnChars != null) {
        paraCount = returnChars.length + 1;
        paragraphTextArr = cell.split(/\n/g);
      } else {
        paragraphTextArr = [cell];
      }

      for (var q = 0; q < paragraphTextArr.length; q++) {
        thisText = paragraphTextArr[q];
        if (
          (paragraphTextArr.length > 1 && q == 0) ||
          q == paragraphTextArr.length - 1
        ) {
          if (q == 0 && thisText.match(/^&quot;/)) {
            thisText = thisText.replace(/^&quot;/, "");
          }
          if (q == paragraphTextArr.length - 1 && thisText.match(/&quot;$/)) {
            thisText = thisText.replace(/&quot;$/, "");
          }
        }

        if (thisText.replace(/\s+/g, "") == "") {
          paragraphText = XML("<p>" + "&#160;" + "</p>");
          // try to create a blank line
        } else {
          paragraphText = XML("<p>" + thisText + "</p>");
        }
        thisVarXMLComponent.appendChild(paragraphText);
      }
      if (!this.ee) {
        this.ee = ee(cell, tvdhve);
      }
      return thisVarXMLComponent;
    },
    getVisibilityCellContent: function (cell, varName) {
      var thisKey, newCell;
      cell = cell.trim().toLowerCase(); // case-insensitive
      for (var i = 0; i < VisibilityKeys.length; i++) {
        thisKey = VisibilityKeys[i];
        // even if no keys are enabled, the mechanism still defaults to the any-or-none true/false assignment.
        if (!thisKey.enabled || cell !== thisKey.displayText.toLowerCase()) {
          newCell = cell !== "";
        } else {
          newCell = thisKey.value;
          break;
        }
      }
      return XML("<" + varName + ">" + newCell + "</" + varName + ">");
    },
    getImageCellContent: function (cell, varName) {
      cell = cell.replace(/\\\\/g, "//").replace(/\\/g, "/");
      if (cell != "" && !cell.match(/^file\:\/\/\//)) {
        cell = "file:///" + cell;
      }
      return XML("<" + varName + ">" + cell + "</" + varName + ">");
    },
    getGraphCellContent: function (cell, varName) {
      cell = GraphDataGatherer.getGraphData(File(cell));
      return XML("<" + varName + ">" + cell + "</" + varName + ">");
    },
    generateRecordsGroupXMLString: function (grid, datasetNames, variableRow) {
      var thisRecord,
        dataSetNode,
        thisDatasetName,
        cell,
        thisVar,
        thisVarName,
        thisVarType,
        thisVarXML,
        thisText;

      var dataSetsGroup = XML("<root></root>");

      for (var i = 0; i < grid.length; i++) {
        thisRecord = grid[i];
        thisDatasetName = datasetNames[i];

        dataSetNode = XML("<sampleDataSet></sampleDataSet>");
        // dataSetNode.setNamespace("v");
        dataSetNode["@dataSetName"] = thisDatasetName;

        for (var j = 0; j < variableRow.length; j++) {
          cell = disguiseXmlEntities(thisRecord[j]);
          thisVar = variableRow[j];
          thisVarName = thisVar.varName;
          thisVarType = thisVar.varType;

          thisVarXML = this["get" + thisVarType + "CellContent"](
            cell,
            thisVarName,
          );

          dataSetNode.appendChild(thisVarXML);
        }

        dataSetsGroup.appendChild(dataSetNode);
      }

      return dataSetsGroup
        .toString()
        .replace(/sampleDataSet/g, "v:sampleDataSet")
        .replace(/(<root>|<\/root>)/g, "");
    },
    generateVariableLibraryXMLString: function () {
      var variablesGroupString, recordsGroupString;

      var myXMLString = this.baseString;

      var variableRow = DATA.currentVars;
      var grid = DATA.currentGrid;
      var datasetNames = DATA.currentDatasetNames;
      var problem;

      try {
        problem = "Making variables group XML string";

        variablesGroupString =
          this.generateVariablesGroupXMLString(variableRow);

        problem = "Making data set group XML string";

        recordsGroupString = this.generateRecordsGroupXMLString(
          grid,
          datasetNames,
          variableRow,
        );

        myXMLString = myXMLString
          .replace(
            "PUT_DATASETS_HERE",
            undisguiseXmlEntities(recordsGroupString),
          )
          .replace("PUT_VARIABLES_HERE", variablesGroupString);

        if (SETTINGS.dbslNextline) {
          myXMLString = myXMLString.replace(/__RETURN_CHAR/g, "&#13;");
        }

        return myXMLString;
      } catch (e) {
        alert(
          "XML File could not be created:\nStage: " + problem + "\nError: " + e,
        );
        return null;
      }
    },
  };

  DropDownList.prototype.selectWell = function () {
    //CC will let you select null
    this.addEventListener("change", function () {
      if (this.selection == null) {
        this.selection = this.items[0];
      }
    });
  };

  DropDownList.prototype.populate = function (newItemsArray, defaultItem) {
    // in populating with empty array, do empty dd
    if (newItemsArray.length == 0) {
      if (this.items.length == 1) {
        this.remove(0);
      }
    } else {
      if (this.items.length == 0) {
        this.add("item");
      }
    }
    for (var i = this.items.length - 1; i > -1; i--) {
      if (i > 0) {
        this.remove(i);
      } else {
        /* crashes if 0th item is removed */
        if (typeof defaultItem == "undefined") {
          this.items[i].text = "";
        } else {
          this.items[i].text = defaultItem;
        }
      }
    }
    for (var i = 0; i < newItemsArray.length; i++) {
      if (typeof defaultItem == "undefined") {
        if (i == 0) {
          this.items[i].text = newItemsArray[i];
        } else {
          this.add("item", newItemsArray[i]);
        }
      } else {
        this.add("item", newItemsArray[i]);
      }
    }
  };

  DropDownList.prototype.getValue = function () {
    if (this.selection != null) {
      if (this.hasOwnProperty("data") && typeof this.data == "object") {
        return this.data[this.selection.text];
      }
      return this.selection.text;
    } else {
      return null;
    }
  };

  DropDownList.prototype.setValue = ListBox.prototype.setValue = function (
    value,
  ) {
    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].text == value) {
        this.selection = this.items[i];
        return;
      } else if (this.hasOwnProperty("data") && typeof this.data == "object") {
        if (value == this.data[this.items[i].text]) {
          this.selection = this.items[i];
          return;
        }
      }
    }
    alert(
      "The value '" + value + "' is not present in this " + this.type + ".",
    );
  };

  ListBox.prototype.getValue = function () {
    if (this.selection != null) {
      if (this.hasOwnProperty("data") && typeof this.data == "object") {
        return this.data[this.selection.text];
      }
      return this.selection.text;
    } else {
      return null;
    }
  };

  ListBox.prototype.reset = function () {
    this.populate(this.originalData);
  };

  ListBox.prototype.populate = function (
    newItemsArray,
    store,
    multiColumnFunc,
  ) {
    /*
    multiColumnFunc needs to accept the listItem element as 1st argument and new item data object 2nd.
  */
    if (typeof store != "undefined" && store == true) {
      this.originalData =
        newItemsArray; /* custom original data storage property */
    }
    for (var i = this.items.length - 1; i > -1; i--) {
      this.remove(i);
    }
    var newItem;
    for (var i = 0; i < newItemsArray.length; i++) {
      if (typeof multiColumnFunc == "function") {
        newItem = this.add("item");
        multiColumnFunc(newItem, newItemsArray[i]);
      } else {
        newItem = this.add("item", newItemsArray[i]);
      }
    }
  };

  ListBox.prototype.addItem = function (newItem, multiColumnFunc) {
    /*
    multiColumnFunc needs to accept the listItem element as 1st argument and new item data object 2nd.
  */
    var newListItem;
    newListItem = this.add("item", newItem);
    if (typeof multiColumnFunc == "function") {
      multiColumnFunc(newListItem, newItem);
    }
  };

  ListBox.prototype.up = function () {
    if (this.selection == null) {
      return;
    }
    var n = this.selection.index;
    if (n > 0) {
      this.swap(this.items[n - 1], this.items[n]);
      this.selection = n - 1;
    }
  };

  ListBox.prototype.down = function () {
    if (this.selection == null) {
      return;
    }
    var n = this.selection.index;
    if (n < this.items.length - 1) {
      this.swap(this.items[n], this.items[n + 1]);
      this.selection = n + 1;
    }
  };

  ListBox.prototype.swap = function (x, y) {
    var temp = x.text;
    x.text = y.text;
    y.text = temp;
  };

  ListBox.prototype.removeSelectedItem = function () {
    if (this.selection == null) {
      return;
    }
    this.removeItem(this.selection.index);
  };

  ListBox.prototype.removeItem = function (indexOrText) {
    if (typeof indexOrText == "number") {
      this.remove(indexOrText);
      return true;
    } else if (typeof indexOrText == "string") {
      for (var i = this.items.length - 1; i > -1; i--) {
        if (this.items[i].text == indexOrText) {
          this.remove(i);
          return true;
        }
      }
    }
    return false;
  };

  ListBox.prototype.getAllCurrentTextValues = function () {
    var arr = [];
    for (var i = 0; i < this.items.length; i++) {
      arr.push(this.items[i].text);
    }
    return arr;
  };

  ListBox.prototype.getListItemValues = function () {
    var arr = [],
      thisListItem;
    for (var i = 0; i < this.items.length; i++) {
      thisListItem = this.items[i];
      arr.push(thisListItem.getValue());
    }
    return arr;
  };

  ListItem.prototype.remove = function () {
    this.parent.remove(this);
  };

  ListItem.prototype.getValue = function () {
    if (this.subItems.length == 0) {
      return this.text;
    } else {
      var arr = [this.text],
        thisSubItem;
      for (var i = 0; i < this.subItems.length; i++) {
        thisSubItem = this.subItems[i];
        arr.push(thisSubItem.text);
      }
      return arr;
    }
  };

  ListItem.prototype.setValue = function (valueStr, multiColumnFunc) {
    this.text = valueStr;
    if (typeof multiColumnFunc == "function") {
      multiColumnFunc(this, valueStr);
    }
  };

  EditText.prototype.numbersOnly = function () {
    this.addEventListener("changing", function () {
      var rx = /^-?\d*\.*\d*$/;
      if (!rx.test(this.text)) {
        this.text = 0;
        this.setBg([1, 0.8, 0.8]);
      } else {
        this.setBg([1, 1, 1]);
      }
    });
  };

  EditText.prototype.getValue = function () {
    return this.text;
  };

  EditText.prototype.setValue = function (value) {
    this.text = value;
  };

  StaticText.prototype.getValue = function () {
    return this.text;
  };

  StaticText.prototype.setValue = function (value) {
    this.text = value;
  };

  Checkbox.prototype.getValue = function () {
    return this.value;
  };

  Checkbox.prototype.setValue = function (value) {
    value = value == true ? true : false;
    this.value = value;
  };

  RadioButton.prototype.getValue = function () {
    return this.value;
  };

  RadioButton.prototype.setValue = function (value) {
    this.value = value;
  };

  var UIElements = [Window, Group, EditText, Panel, StaticText];
  for (var i = 0; i < UIElements.length; i++) {
    UIElements[i].prototype.setBg = function (rgb) {
      this.graphics.backgroundColor = this.graphics.newBrush(
        this.graphics.BrushType.SOLID_COLOR,
        [rgb[0], rgb[1], rgb[2]],
      );
    };
  }

  function scriptAlert(msg) {
    alert(SESSION.scriptName + " " + SESSION.scriptVersion + ":\n" + msg);
  }

  function quickView(msg, title, size) {
    if (typeof title == "undefined") {
      title = "";
    }
    var size = size || [700, 500];
    var w = new Window("dialog", title);
    var e = w.add("edittext", undefined, msg, {
      multiline: true,
      readonly: true,
    });
    e.size = size;
    var okbtn = w.add("button", undefined, "Ok");
    w.show();
  }

  function simpleShowModal(contentsFunc, propObj) {
    var title = propObj.title;
    if (typeof title == "undefined") {
      title = "";
    }
    var w = new Window("dialog", title);

    contentsFunc(w, propObj);

    var okbtn = w.add("button", undefined, "Ok");
    w.show();
  }

  function makeDropdownlist(parent, items) {
    var dd = parent.add("dropdownlist", undefined, items);
    dd.selectWell();
    dd.selection = dd.items[0];
    return dd;
  }

  function makeEditableReadonlyEdittext(parent, chars, defaultText) {
    defaultText = defaultText || "";
    chars = chars || 20;
    var stackGroup = parent.add("group");
    stackGroup.orientation = "stack";
    var readonlyEdittext = stackGroup.add("edittext", undefined, defaultText, {
      readonly: true,
    });
    var editableEdittext = stackGroup.add("edittext", undefined, defaultText);
    readonlyEdittext.characters = editableEdittext.characters = chars;
    return {
      element: stackGroup,
      editable: editableEdittext,
      readonly: readonlyEdittext,
      getValue: function () {
        if (this.editable.visible) {
          return this.editable.text;
        } else {
          return this.readonly.text;
        }
      },
      setValue: function (value) {
        this.editable.text = this.readonly.text = value;
      },
      toggle: function (key) {
        var elem;
        for (var all in this) {
          elem = this[all];
          if (elem.hasOwnProperty("type") && elem.type == "edittext") {
            if (all == key) {
              elem.visible = true;
            } else {
              elem.visible = false;
            }
          }
        }
      },
    };
  }

  function folderPathInput(parent, title, dialogTitle) {
    var p = parent.add("panel", undefined, title);
    p.margins = [4, 4, 4, 4];
    p.spacing = 4;
    p.orientation = "row";
    var b = p.add("button", undefined, "Choose Folder");
    var disp = p.add(
      'edittext { properties : {readonly : true}, justify : "right" }',
    );
    disp.characters = 50;
    disp.setValue = function (value) {
      this.text = value;
      this.helpTip = value;
    };
    b.onClick = function () {
      var f = Folder.selectDialog(dialogTitle);
      if (f != null) {
        disp.text = decodeURI(f.fsName);
        disp.helpTip = disp.text;
        disp.notify("onChange");
      }
    };
    disp.button = b;
    return disp;
  }

  function filePathInput(parent, title, dialogTitle, fileSpec) {
    var p = parent.add("panel", undefined, title);
    p.margins = [5, 6, 5, 4];
    p.spacing = 4;
    p.orientation = "row";
    var b = p.add("button", undefined, "Choose Data File");
    var disp = p.add(
      'edittext { properties : {readonly : true}, justify : "right" }',
    );
    disp.characters = 50;
    disp.setValue = function (value) {
      this.text = value;
      this.helpTip = value;
    };
    b.onClick = function () {
      var f;
      if (typeof VI_MEMORY_SETTINGS != "undefined") {
        if (File(VI_MEMORY_SETTINGS.lastChosenDataFilePath).exists) {
          /* no extension on dummy file, because that disables .txt files */
          f = File(
            File(VI_MEMORY_SETTINGS.lastChosenDataFilePath).parent +
              "/" +
              "VariableImporterDataFile",
          ).openDlg(dialogTitle, fileSpec, false);
        } else {
          f = File.openDialog(dialogTitle, fileSpec);
        }
      } else {
        f = File.openDialog(dialogTitle, fileSpec);
      }
      if (f != null) {
        disp.setValue(decodeURI(f.fsName));
        disp.notify("onChange");
      }
    };
    return disp;
  }

  function checkboxFolderPathInput(parent, title, dialogTitle) {
    var p = parent.add("panel", undefined, title);
    p.margins = [5, 6, 5, 4];
    p.spacing = 4;
    p.orientation = "row";
    var b = p.add("checkbox", undefined, "Choose Folder");
    var disp = p.add(
      'edittext { properties : {readonly : true}, justify : "right" }',
    );
    disp.characters = 50;
    disp.setValue = function (value) {
      this.text = value;
      this.helpTip = value;
    };
    b.onClick = function () {
      if (!this.value) {
        disp.setValue("");
        disp.notify("onChange");
        return;
      }
      var f = Folder.selectDialog(dialogTitle);
      if (f != null) {
        disp.setValue(decodeURI(f.fsName));
        disp.notify("onChange");
      } else {
        this.value = false;
        disp.setValue("");
        disp.notify("onChange");
      }
    };
    disp.checkbox = b;
    return disp;
  }

  function switchStackView(parent, viewKey) {
    var stackChild;
    for (var i = 0; i < parent.children.length; i++) {
      stackChild = parent.children[i];
      if (stackChild.key == viewKey) {
        stackChild.visible = true;
      } else {
        stackChild.visible = false;
      }
    }
  }

  function refreshListForIcons(list) {
    var newTime = new Date().getTime();
    if (newTime - prevMouseMove > 500) {
      list.active = false;
      list.active = true;
      prevMouseMove = newTime;
    }
  }

  function refreshListForIconsForce(list) {
    if (SESSION.imageTest) {
      list.enabled = false;
      list.enabled = true;
    }
  }

  var prevMouseMove = new Date().getTime();

  function validate(UIElements) {
    var res = {
      valid: true,
      problem: "",
    };
    if (UIElements["disp_dataFile"].getValue() == "") {
      res.problem =
        "Please choose a comma-delimited (.csv) or tab-delimited (.txt) data file first.";
      res.valid = false;
      return res;
    }
    if (DATA.currentVars.length == 0) {
      var thisDataFile = File(UIElements["disp_dataFile"].getValue());
      res.problem =
        "There appear to have been no variable names in the data file '" +
        decodeURI(thisDataFile.name) +
        "'";
      res.valid = false;
      return res;
    }

    DATA.getCurrentGrid();

    // make sure dataset names are unique, or else they get genericized
    var uniqueDatasetNameFlag = DATA.testNameProp_unique({
      collection: DATA.currentDatasetNames,
      prop: undefined,
      prefixString: "Record ",
      collectionName: "Dataset",
      showDialog: WARNINGSETTINGS["showDatasetNamingWarning"],
    });

    if (!uniqueDatasetNameFlag) {
      if (!CONFIRMS["showDatasetNamingWarning"]()) {
        res.problem = "";
        res.valid = false;
        return res;
      }
    }

    var allResults = getFileRefTestResults();
    var fileRefsLog = {
      Graphs: {},
      Images: {},
    };
    var missingFileStr = "";
    for (var all in fileRefsLog) {
      fileRefsLog[all].foundNum = allResults["found" + all].length - 1;
      fileRefsLog[all].missingNum = allResults["missing" + all].length - 1;
      fileRefsLog[all].totalNum =
        fileRefsLog[all].foundNum + fileRefsLog[all].missingNum;
      if (fileRefsLog[all].missingNum > 0) {
        missingFileStr +=
          "The current import contains " +
          fileRefsLog[all].missingNum +
          " missing " +
          all +
          ".\n";
      }
    }

    if (missingFileStr != "") {
      if (!confirm("Lost Items:\r" + missingFileStr + "Proceed?")) {
        res.problem = "";
        res.valid = false;
        return res;
      }
    }

    return res;
  }

  function UIWindow() {
    var title = SESSION.scriptName + " " + SESSION.scriptVersion;
    var w = new Window("dialog", title, undefined);
    w.spacing = 4;

    SESSION.doImageTest();
    var imageTest = SESSION.imageTest;
    w.imageTest = imageTest;

    w.UIElements = {
      savingPreset: false,
    };
    w.UITestElements = {};

    var g_select = w.add("group");
    var s1 = g_select.add("radiobutton", undefined, "Variable Display");
    s1.key = "variablesDisplay";
    var s2 = g_select.add("radiobutton", undefined, "Options");
    s2.key = "optionsGroup";
    var s3 = g_select.add("radiobutton", undefined, "File Paths");
    s3.key = "prependPathsGroup";
    var s4 = g_select.add("radiobutton", undefined, "Presets");
    s4.key = "presetOptionsGroup";
    if (SESSION.tabbedGroupTest) {
      var s5 = g_select.add("radiobutton", undefined, "Test");
      s5.key = "testAreaGroup";
    }

    s4.onClick =
      s3.onClick =
      s2.onClick =
      s1.onClick =
        function () {
          switchStackView(g0, this.key);
          if (this.text == "Options") {
            // checkmarks do not show on 1st showing in CC2015 - action 1
            this.window.UIElements["list_warnings"].active = true;
          } else if (this.text == "Test") {
            grp5.children[0].selection = grp5.children[0].children[1];
            grp5.children[0].selection = grp5.children[0].children[0];
            // activate an initial tab when showing this group
            // CS5 shows all stacked and visible if selection not set like above
          }
        };
    if (SESSION.tabbedGroupTest) {
      s5.onClick = s4.onClick;
    }

    g_select.addEventListener("mousemove", function () {
      // checkmarks do not show on 1st showing in CC2015 - action 2
      this.window.UIElements["list_warnings"].active = false;
    });

    var g0 = w.add("group");
    g0.orientation = "stack";
    w.UIElements["stackGroup"] = g0;
    w.UIElements["variablesDisplayR"] = s1;

    // variables display
    var grp1 = variablesDisplayGroup(g0);

    // general options group
    var grp2 = optionsGroup(g0);

    var grp3 = prependPathsGroup(g0);

    var grp4 = presetOptionsGroup(g0);

    if (SESSION.tabbedGroupTest) {
      var grp5 = testAreaGroup(g0);
    }

    var g_btn = w.add("group");
    g_btn.spacing = 4;

    var okButtonText = SESSION.documentExists
      ? "Import Variables"
      : "Create XML File";
    var btn_ok = g_btn.add("button", undefined, okButtonText);
    w.defaultElement = btn_ok;
    var btn_ccl = g_btn.add("button", undefined, "Cancel");

    btn_ok.onClick = function () {
      var validationTest = validate(this.window.UIElements);

      if (validationTest.valid) {
        this.window.close();
      } else {
        if (validationTest.problem != "") {
          alert(validationTest.problem);
        }
      }
    };

    w.onShow = function () {
      populateUI(this.window.UIElements, true);

      this.layout.layout(true);

      s1.notify("onClick");
      // show only 1 of the stacked groups when first showing window.
    };

    if (w.show() == 2) {
      // alert("Cancelled");
      return null;
    } else {
      // final current grid is obtained in the validation function

      SETTINGS.dbslNextline = w.UIElements["dbslNextline"].getValue();

      var userXMLPath = w.UIElements["xmlPath"].getValue();

      return {
        purpose: SESSION.documentExists ? "import" : "createXML",
        xmlPath:
          userXMLPath == "temp" ? w.UIElements["xmlPath"].text : userXMLPath,
        sourceDataPath: w.UIElements["disp_dataFile"].getValue(),
        fileRefsLog: getFileRefTestResults(),
      };
    }
  }

  function displayData(dataObj) {
    var newItem,
      datum,
      varType,
      varName,
      oldVars = DATA.oldVars;
    if (this.items.length > 0) {
      this.removeAll();
    }

    var data = dataObj;
    for (var i = 0; i < data.length; i++) {
      // header row is variable names
      datum = data[i];
      newItem = this.add("item");
      if (this.window.UIElements.saved) {
        datum.varType = oldVars[i].varType;
        datum.varName = oldVars[i].varName;
      }
      varName = datum.varName;
      newItem.text = varName;
      varType = datum.varType;
      if (varType == "Image" || varType == "Graph") {
        if (this.window.UIElements.saved) {
          datum.url = oldVars[i].url;
        }
      }
      if (!SESSION.multiColumnListBoxTest) {
        // problems with CS6 multi-column listbox
        if (this.window.imageTest) {
          newItem.image = ICONS[varType];
          newItem.text = newItem.text + " | " + varType + " | " + datum.url;
        }
      } else {
        if (this.window.imageTest) {
          newItem.subItems[0].image = ICONS[varType];
          newItem.subItems[1].text = varType;
          newItem.subItems[2].text = datum.url;
        } else {
          newItem.subItems[0].text = varType;
          newItem.subItems[1].text = datum.url;
        }
      }
    }

    if (SESSION.AIVersion >= 17) {
      this.window.update();
    }
    addVarNameDatasetNames();
    this.window.UIElements["datasetNamePreview"].setValue(
      getDatasetNamePreviewString(),
    );
    this.window.UIElements.saved = false;
  }

  function getVariableDisplayHeight(varAmt) {
    var rangePtsArr, rangePts;
    for (var all in UI_SIZING.variableDisplay) {
      rangePtsArr = UI_SIZING.variableDisplay[all].varAmt.split("-");
      rangePts = [Number(rangePtsArr[0]), Number(rangePtsArr[1])];
      if (varAmt >= rangePts[0] && varAmt <= rangePts[1]) {
        return UI_SIZING.variableDisplay[all].height;
      }
    }
    return 100;
  }

  function variablesDisplayGroup(parent) {
    var g1 = parent.add("group");
    g1.orientation = "column";
    g1.key = "variablesDisplay";

    var imageTest = parent.window.imageTest;

    var g1_1 = g1.add("panel");
    g1_1.orientation = "row";
    g1_1.alignChildren = "left";
    g1_1.size = [UI_SIZING.panelWidth_1, 25];
    g1_1.margins = [4, 4, 4, 4];
    var ch_useHeaders = g1_1.add("checkbox", undefined, "Use Headers");
    ch_useHeaders.value = SETTINGS.useHeaders;
    ch_useHeaders.onClick = function () {
      SETTINGS.useHeaders = this.value;
      updateCurrentPresetNameDisplays(
        this.window.UIElements,
        PRESETS.getByName(SESSION.currentLoadedPresetName),
        true,
      );
      if (DATA.grid.length > 0) {
        DATA.getCurrentVars(parent.window.UIElements);
        list_varNames.displayData(DATA.currentVars);
        // changes DATA.currentVars
        refreshListForIconsForce(list_varNames);
        TestManager.clearAllTestDisplays(this.window.UITestElements);
      }
    };

    var ch_transpose = g1_1.add("checkbox", undefined, "Transpose Data");
    ch_transpose.value = SETTINGS.transpose;
    ch_transpose.onClick = function () {
      SETTINGS.transpose = this.value;
      updateCurrentPresetNameDisplays(
        this.window.UIElements,
        PRESETS.getByName(SESSION.currentLoadedPresetName),
        true,
      );
      if (DATA.grid.length > 0) {
        DATA.getCurrentVars(parent.window.UIElements);
        list_varNames.displayData(DATA.currentVars);
        // changes DATA.currentVars
        refreshListForIconsForce(list_varNames);
        TestManager.clearAllTestDisplays(this.window.UITestElements);
      }
    };

    var sep1 = g1_1.add("group");
    sep1.size = [10, 15];

    var lbl_currentPreset = g1_1.add("statictext", undefined, "Current Preset");
    var disp_currentPreset = g1_1.add(
      'edittext{ properties : {readonly : true}, text : "", characters : ' +
        25 +
        ', justify : "center"}',
    );

    var disp_dataFile = filePathInput(
      g1,
      "",
      "Choose a .txt (tab-delimited) or .csv (comma-delimited) text file to import.",
      SESSION.dataFileMask(),
    );
    disp_dataFile.addEventListener("change", function () {
      if (this.text != "") {
        VI_MEMORY_SETTINGS.lastChosenDataFilePath = this.text;
        DATA.currentSourceFile = this.text;
        DATA.grid = getData(DATA.currentSourceFile);
        DATA.transposedGrid = transposeGrid(DATA.grid);
        DATA.getCurrentVars(parent.window.UIElements);
        this.targetList.displayData(DATA.currentVars);
        this.targetList.notify("onDraw");
        TestManager.clearAllTestDisplays(this.window.UITestElements);
      }
    });

    var listProps;
    if (!SESSION.multiColumnListBoxTest) {
      // crazy CS6 Bug with multi-column listbox crash.
      listProps = {};
    } else {
      listProps = imageTest
        ? {
            numberOfColumns: 4,
            showHeaders: true,
            columnTitles: ["Variable Name", "", "Type", "URL"],
            columnWidths: [150, 25, 100, 220],
          }
        : {
            numberOfColumns: 3,
            showHeaders: true,
            columnTitles: ["Variable Name", "Type", "URL"],
            columnWidths: [150, 100, 220],
          };
    }

    var list_varNames = g1.add("listbox", undefined, [], listProps);
    list_varNames.size = [
      UI_SIZING.panelWidth_1,
      UI_SIZING.variableDisplay.medium.height,
    ];
    list_varNames.alignment = "fill";
    disp_dataFile.targetList = list_varNames;
    list_varNames.displayData = displayData;

    if (imageTest && SESSION.AIVersion >= 17) {
      list_varNames.addEventListener("mousemove", function () {
        refreshListForIcons(this);
      });
      list_varNames.addEventListener("mouseover", function () {
        refreshListForIcons(this);
      });
      list_varNames.addEventListener("mouseup", function () {
        refreshListForIcons(this);
      });
    }

    list_varNames.onDoubleClick = function () {
      if (this.selection != null) {
        var dialogResult = variableOptionsDialog(
          DATA.currentVars[this.selection.index],
        );
        if (dialogResult != null && dialogResult.changed) {
          DATA.currentVars[this.selection.index] = dialogResult.varObj;
          this.displayData(DATA.currentVars);
          TestManager.clearAllTestDisplays(this.window.UITestElements);
        }
      }
    };

    parent.window.UIElements["useHeaders"] = ch_useHeaders;
    parent.window.UIElements["transpose"] = ch_transpose;
    parent.window.UIElements["variableDisplay"] = list_varNames;
    parent.window.UIElements["disp_dataFile"] = disp_dataFile;
    parent.window.UIElements["currentlySelectedPresetName"] = [];
    parent.window.UIElements["currentlySelectedPresetName"][0] =
      disp_currentPreset;

    g1.disp_dataFile = disp_dataFile;
    return g1;
  }

  function optionsGroup(parent) {
    var g1 = parent.add("group");
    g1.key = "optionsGroup";
    g1.spacing = 4;
    g1.orientation = "column";

    var g_currentPreset = g1.add("group");
    var lbl_currentPreset = g_currentPreset.add(
      "statictext",
      undefined,
      "Current Preset: ",
    );
    var disp_currentPreset = g_currentPreset.add(
      'edittext{ properties : {readonly : true}, text : "", characters : ' +
        40 +
        ', justify : "center"}',
    );
    parent.window.UIElements["currentlySelectedPresetName"][1] =
      disp_currentPreset;

    var g2 = g1.add("group");
    g2.alignChildren = "fill";
    var g_scriptWarnings = g2.add("panel", undefined, "Notifications");

    var warningItems = getPropertyList(WARNINGSETTINGS),
      thisWarningItem,
      newItem;
    var list_warnings = g_scriptWarnings.add("listbox", undefined, []);
    list_warnings.size = [250, 120];
    list_warnings.data = {};
    for (var i = 0; i < warningItems.length; i++) {
      thisWarningItem = warningItems[i];
      newItem = list_warnings.add("item");
      newItem.text = unCamelCaseSplit(thisWarningItem);
      newItem.checked = WARNINGSETTINGS[thisWarningItem];
      list_warnings.data[newItem.text] = thisWarningItem;
    }

    list_warnings.onDoubleClick = function () {
      if (this.selection != null) {
        this.selection.checked = !this.selection.checked;
        WARNINGSETTINGS[this.data[this.selection.text]] =
          this.selection.checked;
      }
    };

    var g_settings = g2.add("panel", undefined, "Settings");
    g_settings.alignChildren = "left";
    g_settings.spacing = 4;
    var ch_dbslNextline = g_settings.add(
      "checkbox",
      undefined,
      "'\\\\' creates line break",
    );
    ch_dbslNextline.size = [204, 20];
    ch_dbslNextline.onClick = function () {
      updateCurrentPresetNameDisplays(
        this.window.UIElements,
        PRESETS.getByName(SESSION.currentLoadedPresetName),
        true,
      );
    };

    var settingsAreaButtonSize = [200, 26];

    var btn_visKeys = g_settings.add(
      "button",
      undefined,
      "Edit Visibility Keywords",
    );
    btn_visKeys.helpTip =
      "Control which keywords will result in a true/false for the visibility variables.";
    btn_visKeys.size = settingsAreaButtonSize;
    btn_visKeys.onClick = function () {
      var res = visibilityKeysDialog();
      if (res != null) {
        updateCurrentPresetNameDisplays(
          this.window.UIElements,
          PRESETS.getByName(SESSION.currentLoadedPresetName),
          true,
        );
      }
    };

    var btn_customIncs = g_settings.add(
      "button",
      undefined,
      "Custom Increments",
    );
    btn_customIncs.helpTip =
      "Manage custom increments: incremented integers with start and zero-padding options.";
    btn_customIncs.size = settingsAreaButtonSize;
    btn_customIncs.onClick = customIncrementsDialog;

    var g_datasetNames = g1.add("panel", undefined, "Dataset Names");
    g_datasetNames.size = [UI_SIZING.panelWidth_1, 100];
    g_datasetNames.orientation = "row";
    var btn_assign = g_datasetNames.add("button", undefined, "Assign");
    var disp_datasetNamePreview = g_datasetNames.add(
      "edittext",
      undefined,
      "",
      { readonly: true },
    );
    disp_datasetNamePreview.characters = 50;

    btn_assign.onClick = function () {
      var newDsNames = datasetAssignDialog(DATASETNAMEFIELDS_current);
      if (newDsNames == null) {
        return;
      }
      DATASETNAMEFIELDS_current = newDsNames;
      parent.window.UIElements["datasetNamePreview"].setValue(
        getDatasetNamePreviewString(),
      );
      DATA.getCurrentGrid();
      var tabGroupKey = "testTabs";
      if (this.window.hasOwnProperty(tabGroupKey)) {
        this.window.UITestElements[tabGroupKey].children[0].populateFields();
        // also populate the testing tab
      }
      updateCurrentPresetNameDisplays(
        this.window.UIElements,
        PRESETS.getByName(SESSION.currentLoadedPresetName),
        true,
      );
    };

    var g_xmlOptions = g1.add("panel", undefined, "XML Options");
    g_xmlOptions.orientation = "column";
    g_xmlOptions.size = [UI_SIZING.panelWidth_1, 100];
    g_xmlOptions.spacing = 4;
    var ch_keepXML = g_xmlOptions.add("checkbox", undefined, "Keep XML");
    var g_xmlOptions_1 = g_xmlOptions.add("group");
    var btn_xmlFile = g_xmlOptions_1.add("button", undefined, "XML File");
    var disp_xmlFile = g_xmlOptions_1.add("edittext", undefined, "", {
      readonly: true,
    });
    disp_xmlFile.characters = 50;
    disp_xmlFile.setValue = function (value) {
      this.text = value;
      this.helpTip = value;
    };

    var g_autobinding = g1.add("panel", undefined, "Auto Binding");
    g_autobinding.size = [UI_SIZING.panelWidth_1, 100];
    g_autobinding.spacing = 2;
    g_autobinding.margins = [7, 6, 6, 6];
    g_autobinding.orientation = "row";

    var autoBindingPropertyText = getSpecificPropertyListObj(
      AUTOBINDING,
      "text",
    );
    var autoBindingPropertyType = getSpecificPropertyListObj(
      AUTOBINDING,
      "type",
    );
    var dd_selectedAutobinding = makeDropdownlist(
      g_autobinding,
      autoBindingPropertyText,
    );
    dd_selectedAutobinding.data = {};
    for (var i = 0; i < dd_selectedAutobinding.items.length; i++) {
      dd_selectedAutobinding.data[dd_selectedAutobinding.items[i].text] =
        autoBindingPropertyType[i];
    }
    dd_selectedAutobinding.onChange = function () {
      SETTINGS.selectedAutobinding = this.data[this.selection.text];
      if (SESSION.documentExists) {
        TestManager.clearSpecificTestDisplays(
          this.window.UITestElements,
          "artBinding",
        );
      }
      updateCurrentPresetNameDisplays(
        this.window.UIElements,
        PRESETS.getByName(SESSION.currentLoadedPresetName),
        true,
      );
    };
    var g_autobinding_1 = g_autobinding.add("group");
    g_autobinding_1.spacing = 2;
    var btn_foundBindItems = g_autobinding_1.add(
      "button",
      undefined,
      "Find Art",
    );
    var disp_foundBindItems = g_autobinding_1.add("edittext", undefined, "", {
      readonly: true,
    });
    disp_foundBindItems.characters = 37;

    if (!SESSION.documentExists) {
      g_autobinding_1.visible = false;
    } else {
      btn_foundBindItems.onClick = function () {
        if (DATA.grid.length == 0) {
          alert("Please import a data file first.");
          return;
        }
        displayFoundArtBindings(this.window.UITestElements);
      };
    }

    ch_keepXML.onClick = function () {
      SETTINGS.keepXML = this.value;
      if (!this.value) {
        disp_xmlFile.setValue(decodeURI(SETTINGS.getDataXMLDestination()));
      }
      updateCurrentPresetNameDisplays(
        this.window.UIElements,
        PRESETS.getByName(SESSION.currentLoadedPresetName),
        true,
      );
    };

    btn_xmlFile.onClick = function () {
      if (!ch_keepXML.value) {
        disp_xmlFile.setValue(decodeURI(SETTINGS.getDataXMLDestination()));
        return;
      }
      var dfStr = this.window.UIElements["disp_dataFile"].getValue();
      var xmlFile, destChoice;
      if (dfStr != "") {
        var dataFile = File(dfStr);
        if (dataFile.exists) {
          xmlFile = File(
            dataFile.parent +
              "/" +
              decodeURI(dataFile.name).replace(/\.\w{2,4}$/, "") +
              "-vi_data.xml",
          );
          destChoice = xmlFile.saveDlg(
            "Choose a place to save the Variable Import XML File.",
          );
          if (destChoice != null) {
            disp_xmlFile.setValue(decodeURI(destChoice));
          } else {
            disp_xmlFile.setValue(decodeURI(SETTINGS.getDataXMLDestination()));
          }
        }
      } else {
        xmlFile = File(SETTINGS.getDataXMLDestination());
        destChoice = xmlFile.saveDlg(
          "Choose a place to save the Variable Import XML File.",
        );
        if (destChoice != null) {
          disp_xmlFile.setValue(decodeURI(destChoice));
        } else {
          disp_xmlFile.setValue(decodeURI(SETTINGS.getDataXMLDestination()));
        }
      }
      updateCurrentPresetNameDisplays(
        this.window.UIElements,
        PRESETS.getByName(SESSION.currentLoadedPresetName),
        true,
      );
    };

    disp_xmlFile.getValue = function () {
      if (SETTINGS.keepXML) {
        return this.text;
      } else {
        return "temp";
      }
    };

    parent.window.UIElements["dbslNextline"] = ch_dbslNextline;
    parent.window.UIElements["selectedAutobinding"] = dd_selectedAutobinding;
    parent.window.UIElements["keepXML"] = ch_keepXML;
    parent.window.UIElements["xmlPath"] = disp_xmlFile;
    parent.window.UIElements["list_warnings"] = list_warnings;
    parent.window.UIElements["datasetNamePreview"] = disp_datasetNamePreview;

    if (SESSION.documentExists) {
      // no art binding test field when a document is not present.
      parent.window.UITestElements["foundArtBindings"] = disp_foundBindItems;
    }

    return g1;
  }

  function changeVarUrls(prop, newUrl) {
    var thisObj;
    for (var i = 0; i < DATA.currentVars.length; i++) {
      thisObj = DATA.currentVars[i];
      if (thisObj.varType == prop) {
        thisObj.url = newUrl;
      }
    }
  }

  function prependPathsGroup(parent) {
    var g1 = parent.add("group");
    g1.key = "prependPathsGroup";
    g1.spacing = 4;
    g1.orientation = "column";

    var g_pst = g1.add("group");
    var lbl_currentPreset = g_pst.add(
      "statictext",
      undefined,
      "Current Preset",
    );
    var disp_currentPreset = g_pst.add(
      'edittext{ properties : {readonly : true}, text : "", characters : ' +
        40 +
        ', justify : "center"}',
    );
    parent.window.UIElements["currentlySelectedPresetName"][2] =
      disp_currentPreset;

    var sep = g1.add("group");
    sep.size = [30, 30];

    var disp_prependImagePath = checkboxFolderPathInput(
      g1,
      "Prepend Image Path",
      "Choose Path",
      "Choose directory for image files.",
    );
    disp_prependImagePath.key = "Image";
    parent.window.UIElements["prependToAllImages"] =
      disp_prependImagePath.checkbox;
    parent.window.UIElements["prependImagePath"] = disp_prependImagePath;

    var g_foundImages = g1.add("group");
    var lbl_foundImages = g_foundImages.add(
      "statictext",
      undefined,
      "Found Images",
    );
    var disp_foundImages = g_foundImages.add(
      "edittext { properties : {readonly : true}, justify : 'center' }",
    );
    disp_foundImages.characters = UI_SIZING.foundOfTotalDisp.characters;
    disp_foundImages.key = "Image";
    var btn_foundImages = g_foundImages.add("button", undefined, "Show Log");
    btn_foundImages.key = "Images";
    btn_foundImages.disp = disp_foundImages;

    btn_foundImages.onClick = fileRefTestHandler;

    var sep1 = g1.add("group");
    sep1.size = [30, 30];

    var disp_prependGraphPath = checkboxFolderPathInput(
      g1,
      "Prepend Graph Path",
      "Choose Path",
      "Choose directory for graph-data files.",
    );
    disp_prependGraphPath.key = "Graph";
    parent.window.UIElements["prependToAllGraphs"] =
      disp_prependGraphPath.checkbox;
    parent.window.UIElements["prependGraphPath"] = disp_prependGraphPath;

    var g_foundGraphs = g1.add("group");
    var lbl_foundGraphs = g_foundGraphs.add(
      "statictext",
      undefined,
      "Found Graphs",
    );
    var disp_foundGraphs = g_foundGraphs.add(
      "edittext { properties : {readonly : true}, justify : 'center' }",
    );
    disp_foundGraphs.characters = UI_SIZING.foundOfTotalDisp.characters;
    disp_foundGraphs.key = "Graph";
    var btn_foundGraphs = g_foundGraphs.add("button", undefined, "Show Log");
    btn_foundGraphs.key = "Graphs";
    btn_foundGraphs.disp = disp_foundGraphs;

    btn_foundGraphs.onClick = fileRefTestHandler;

    disp_prependImagePath.onChange = function () {
      SETTINGS["prependToAll" + this.key + "s"] = this.checkbox.getValue();
      var thisText = this.getValue();
      SETTINGS["prepend" + this.key + "Path"] = thisText;
      if (thisText != "") {
        DATA.getCurrentVars(parent.window.UIElements);
        parent.window.UIElements["variableDisplay"].displayData(
          DATA.currentVars,
        );
      } else {
        this.helpTip = "";
      }
      TestManager.clearSpecificTestDisplays(
        this.window.UITestElements,
        this.key,
      );
      updateCurrentPresetNameDisplays(
        this.window.UIElements,
        PRESETS.getByName(SESSION.currentLoadedPresetName),
        true,
      );
    };

    disp_prependGraphPath.onChange = function () {
      SETTINGS["prependToAll" + this.key + "s"] = this.checkbox.getValue();
      var thisText = this.getValue();
      SETTINGS["prepend" + this.key + "Path"] = thisText;
      if (thisText != "") {
        DATA.getCurrentVars(parent.window.UIElements);
        parent.window.UIElements["variableDisplay"].displayData(
          DATA.currentVars,
        );
      } else {
        this.helpTip = "";
      }
      TestManager.clearSpecificTestDisplays(
        this.window.UITestElements,
        this.key,
      );
      updateCurrentPresetNameDisplays(
        this.window.UIElements,
        PRESETS.getByName(SESSION.currentLoadedPresetName),
        true,
      );
    };

    parent.window.UITestElements["foundImages"] = disp_foundImages;
    parent.window.UITestElements["foundGraphs"] = disp_foundGraphs;

    return g1;
  }

  function getPropertySummaryString(obj) {
    var msg = [];
    for (var all in obj) {
      if (typeof obj[all] != "object") {
        if (all != "name") {
          if (all == "selectedAutobinding") {
            msg.push(
              unCamelCaseSplit(all) + " : " + unCamelCaseSplit(obj[all]),
            );
          } else {
            msg.push(unCamelCaseSplit(all) + " : " + obj[all]);
          }
        }
      } else {
        if (all == "datasetNameObj") {
          var dsNmMsg = [],
            propObj,
            dispText;
          for (var it in obj[all]) {
            propObj = getSpecificPropertyObj(
              FIELDNAMEOPTIONS_current,
              "type",
              obj[all][it].type,
            );
            if (propObj == null) {
              // missing variable
              propObj = {
                type: obj[all][it].type,
                displayText:
                  "Variable " +
                  obj[all][it].type.replace(/[^\d]/g, "") +
                  ' Value : "' +
                  obj[all][it].text +
                  '"',
              };
            }
            dispText =
              propObj.displayText == "Custom Text" ||
              propObj.displayText == "Custom Increment"
                ? propObj.displayText + ' : "' + obj[all][it].text + '"'
                : propObj.displayText;
            dsNmMsg.push(it + " : " + dispText);
          }
          msg.push("----------------\nDataset Names:\n" + dsNmMsg.join("\n"));
        } else if (all == "enabledVisibilityKeyNames") {
          msg.push(
            "----------------\nEnabled Visibility Keys:\n" +
              obj[all].join("\n"),
          );
        }
      }
    }
    return msg;
  }

  function presetDialog(presetObjOrig, purpose, currentStateObj) {
    var presetObj = clone(presetObjOrig);

    var purpose = clone(purpose);
    var w = new Window("dialog", "Preset Display");
    var g1 = w.add("group");
    g1.key = "presetOptionsGroup";
    g1.spacing = 4;
    g1.orientation = "column";

    var g1_1 = g1.add("group");
    var lbl_currentPreset = g1_1.add("statictext", undefined, "Name");

    var nameText =
      purpose.placeholderName == "self"
        ? presetObj.name
        : purpose.placeholderName;
    var disp_currentPreset = g1_1.add("edittext", undefined, nameText, {
      readonly: !purpose.presetDispEditable || nameText == "default",
    });
    if (purpose.presetDispEditable) {
      disp_currentPreset.onChanging = function () {
        if (this.getValue().indexOf("*") > -1) {
          scriptAlert(
            "Sorry, due to asterisk (*) characters being used to mark preset dialog overrides they cannot be used in a preset name." +
              " Asterkisk automatically removed.",
          );
          this.setValue(this.getValue().replace(/\*/g, ""));
        }
      };
    }
    disp_currentPreset.characters = 36;
    var oldName = disp_currentPreset.text;

    var summary = g1.add("edittext", undefined, "", {
      readonly: true,
      multiline: true,
    });
    summary.size = [650, 200];

    var msg = getPropertySummaryString(presetObj);

    if (purpose.actionButtonName == "Update") {
      summary.size = [650, 250];
      msg.unshift(presetObj.name + ":", "------------------");
      msg.push("\r");

      var msg2 = getPropertySummaryString(currentStateObj);
      msg2.unshift("Current Dialog:", "------------------");
      summary.text = msg.join("\n").trim();

      var lbl_summary2 = g1.add("statictext", undefined, "Current Dialog");
      var summary2 = g1.add("edittext", undefined, "", {
        readonly: true,
        multiline: true,
      });
      summary2.size = [650, 250];
      summary2.text = msg2.join("\n").trim();
    } else {
      var spacer = g1.add("group");
      spacer.size = [10, 10];
      var lbl_summary2 = g1.add("statictext", undefined, "Dataset Names");
      var summary2 = g1.add("edittext", undefined, "", {
        readonly: true,
        multiline: true,
      });
      summary2.size = [650, 100];
      summary2.text = msg
        .join("\n")
        .replace(/[.\r\n\s\S]+----------------\nDataset Names\:/g, "")
        .replace(/----------------\nEnabled Visibility Keys\:[.\r\n\s\S]+$/, "")
        .trim();
      summary.text = msg
        .join("\n")
        .replace(/----------------\nDataset Names\:[.\r\n\s\S]+$/g, "")
        .trim();

      var lbl_summary3 = g1.add(
        "statictext",
        undefined,
        "Enabled Visibility Keys",
      );
      var summary3 = g1.add("edittext", undefined, "", {
        readonly: true,
        multiline: true,
      });
      summary3.size = [650, 100];
      summary3.text = msg
        .join("\n")
        .replace(/[.\r\n\s\S]+----------------\nEnabled Visibility Keys\:/, "")
        .trim();
    }

    var g_btn = w.add("group");

    if (purpose.showRemoveButton && presetObj.name != "default") {
      var btn_rmv = g_btn.add("button", undefined, "Remove");
      btn_rmv.onClick = function () {
        if (!CONFIRMS["confirmRemovalOfPresets"](presetObj.name)) {
          return;
        }
        purpose.resultAction = PresetDialogPurposes.Remove.resultAction;
        purpose.actionButtonName = "Remove";
        w.close();
      };
    }

    var btn_ok = g_btn.add("button", undefined, purpose.actionButtonName);
    w.defaultElement = btn_ok;
    if (purpose.presetDispEditable) {
      btn_ok.onClick = function () {
        var presetNewName = disp_currentPreset.getValue();
        if (presetNewName == "") {
          scriptAlert("A preset name may not be blank.");
          return;
        }
        w.close();
      };
    }

    var btn_ccl = g_btn.add("button", undefined, "Cancel");

    w.onShow = function () {
      if (purpose.presetDispEditable && presetObj.name != "default") {
        disp_currentPreset.active = false;
        disp_currentPreset.active = true;
      }
    };

    if (w.show() == 2) {
      return null;
    } else {
      return {
        presetName: disp_currentPreset.text,
        oldName: oldName,
        resultAction: purpose.resultAction,
        action: purpose.actionButtonName,
      };
    }
  }

  function presetOptionsGroup(parent) {
    var g1 = parent.add("group");
    g1.key = "presetOptionsGroup";
    g1.spacing = 4;
    g1.orientation = "column";

    var g1_0 = g1.add("group"); // row

    var g1_1 = g1_0.add("group");
    g1_1.orientation = "column";
    g1_1.alignChildren = "left";
    var g_pst = g1_1.add("group");
    var lbl_currentPreset = g_pst.add(
      "statictext",
      undefined,
      "Current Preset",
    );
    var disp_currentPreset = g_pst.add(
      'edittext{ properties : {readonly : true}, text : "", characters : ' +
        42 +
        ', justify : "center"}',
    );
    parent.window.UIElements["currentlySelectedPresetName"][3] =
      disp_currentPreset;

    var list_presets = g1_1.add(
      "listbox",
      undefined,
      getSpecificPropertyListArr(PRESETS, "name"),
    );
    list_presets.size = [440, 320];
    list_presets.onDoubleClick = function () {
      if (this.selection != null) {
        var res = presetDialog(
          PRESETS.getByName(this.selection.text),
          PresetDialogPurposes.Activate,
        );
        if (res == null) {
          return;
        }
        if (res.action == "Remove") {
          if (!CONFIRMS["confirmRemovalOfPresets"](this.selection.text)) {
            return;
          }
        } else if (res.action == "Update") {
          if (!CONFIRMS["confirmUpdatingOfPresets"](this.selection.text)) {
            return;
          }
        }
        res.resultAction(res, this.window.UIElements, this);
      }
    };
    parent.window.UIElements["list_presets"] = list_presets;

    var g_btn = g1_0.add("group");
    g_btn.orientation = "column";
    g_btn.alignChildren = "right";
    var btn_add = g_btn.add("button", undefined, "Add");
    var btn_update = g_btn.add("button", undefined, "Update");
    var btn_remove = g_btn.add("button", undefined, "Remove");
    var btn_activate = g_btn.add("button", undefined, "Activate");

    var g_btm = g1.add("group");
    g_btm.margins = [2, 6, 2, 0];
    var btn_save = g_btm.add("button", undefined, "Save Settings & Presets");
    btn_save.size = [210, 30];
    btn_save.onClick = function () {
      updateScriptDataFromUI(this.window.UIElements);
      writeSettingsFile(getScriptDataObj());
      this.window.UIElements["variablesDisplayR"].notify("onClick");
    };

    btn_activate.onClick = function () {
      if (list_presets.selection != null) {
        PresetDialogPurposes.Activate.resultAction(
          {
            presetName: list_presets.selection.text,
          },
          this.window.UIElements,
          list_presets,
        );
      } else {
        alert("Please select a preset in the Presets List");
      }
    };

    btn_remove.onClick = function () {
      if (list_presets.selection != null) {
        if (list_presets.selection.text == "default") {
          scriptAlert("Cannot remove the default preset.");
          return;
        }
        if (!CONFIRMS["confirmRemovalOfPresets"](list_presets.selection.text)) {
          return;
        }
        PresetDialogPurposes.Remove.resultAction(
          {
            presetName: list_presets.selection.text,
          },
          this.window.UIElements,
          list_presets,
        );
      } else {
        alert("Please select a preset in the Presets List");
      }
    };

    btn_update.onClick = function () {
      if (list_presets.selection != null) {
        var presetDialogResult = presetDialog(
          PRESETS.getByName(list_presets.selection.text),
          PresetDialogPurposes.Update,
          getUIData(this.window.UIElements),
        );
        if (presetDialogResult == null) {
          return;
        }
        if (
          !CONFIRMS["confirmUpdatingOfPresets"](list_presets.selection.text)
        ) {
          return;
        }
        presetDialogResult.resultAction(
          presetDialogResult,
          this.window.UIElements,
          list_presets,
        );
      } else {
        alert("Please select a preset in the Presets List");
      }
    };

    btn_add.onClick = function () {
      var presetDialogResult = presetDialog(
        getUIData(this.window.UIElements),
        PresetDialogPurposes.Add,
      );
      if (presetDialogResult == null) {
        return;
      }
      presetDialogResult.resultAction(
        presetDialogResult,
        this.window.UIElements,
        list_presets,
      );
    };

    return g1;
  }

  function refreshPresetListbox(elem) {
    elem.removeAll();
    var newNameList = getSpecificPropertyListArr(PRESETS, "name");
    for (var i = 0; i < newNameList.length; i++) {
      elem.add("item", newNameList[i]);
    }
  }

  function testAreaGroup(parent) {
    var g1 = parent.add("group");
    g1.key = "testAreaGroup";
    g1.spacing = 4;
    g1.orientation = "column";

    var tp = g1.add("tabbedpanel");

    for (var all in TestManager) {
      if (typeof TestManager[all] != "function") {
        if (!SESSION.documentExists && all == "artBindings") {
          // don't even make a binding test tab when there's no document open
          continue;
        }
        tp[TestManager[all].key] = TestManager[all].makeTab(tp);
      }
    }

    var g_btn = g1.add("group");
    var btn_refreshTest = g_btn.add("button", undefined, "Refresh Test");
    btn_refreshTest.size = [250, 30];

    btn_refreshTest.onClick = function () {
      if (DATA.currentVars.length == 0) {
        alert("Please import a data file first.");
        return;
      }
      DATA.getCurrentGrid();
      var thisTab;
      for (var i = 0; i < tp.children.length; i++) {
        thisTab = tp.children[i];
        if (thisTab.text != "Art Bindings") {
          // populate all places where image or graph files are listed (Prepend Paths group)
          thisTab.populateFields();
          for (var all in this.window.UITestElements) {
            thisElem = this.window.UITestElements[all];
            if (
              thisElem.hasOwnProperty("key") &&
              thisElem.key == thisTab.key &&
              typeof thisElem.setValue == "function"
            ) {
              thisElem.setValue(
                thisTab.contents.disp_foundMissingNum.getValue(),
              );
            }
          }
        } else if (
          tp.selection.text == "Art Bindings" &&
          SESSION.documentExists
        ) {
          // populate the "Find Art" display (Options group)
          displayFoundArtBindings(parent.window.UITestElements);
        }
      }
    };

    parent.window.UITestElements["testTabs"] = tp;

    return g1;
  }

  function toggleUrlInputVis(ddlist, toggleElem) {
    if (ddlist.selection != null) {
      if (
        ddlist.selection.text == "Graph" ||
        ddlist.selection.text == "Image"
      ) {
        toggleElem.visible = true;
      } else {
        toggleElem.visible = false;
      }
    }
  }

  function variableOptionsDialog(uiVarObj) {
    var w = new Window("dialog", "Variable " + (uiVarObj.varIndex + 1));
    w.spacing = 4;

    var g0 = w.add("group");

    var g1 = g0.add("panel", undefined, "Variable Name");
    var disp_varName = g1.add("edittext", undefined, uiVarObj.varName);
    disp_varName.size = [229, 30];

    var g2 = g0.add("panel", undefined, "Variable Type");
    var disp_varType = makeDropdownlist(g2, getPropertyList(VARTYPES));
    disp_varType.size = [229, 30];
    disp_varType.setValue(uiVarObj.varType);
    if (SESSION.imageTest) {
      for (var i = 0; i < disp_varType.items.length; i++) {
        disp_varType.items[i].image = ICONS[disp_varType.items[i]];
      }
    }
    disp_varType.onChange = function () {
      toggleUrlInputVis(this, disp_url.parent);
    };

    var disp_url = checkboxFolderPathInput(
      w,
      "Prepend Path",
      "Choose folder directory",
    );
    disp_url.setValue(uiVarObj.url);
    disp_url.checkbox.value = uiVarObj.url.trim() == "" ? false : true;

    var g_btn = w.add("group");
    var btn_ok = g_btn.add("button", undefined, "Ok");
    var btn_ccl = g_btn.add("button", undefined, "Cancel");

    disp_varName.onChanging = function () {
      if (!isXMLTagName(this.text)) {
        this.setBg([1, 0.7, 0.7]);
        this.enabled = false;
        this.enabled = true;
        this.active = false;
        this.active = true;
      } else {
        this.setBg([1, 1, 1]);
      }
    };

    btn_ok.onClick = function () {
      if (!DATA.testVariableName(uiVarObj.varName, disp_varName.getValue())) {
        return;
      }
      this.window.close();
    };

    w.onShow = function () {
      toggleUrlInputVis(disp_varType, disp_url.parent);
    };

    if (w.show() == 2) {
      return null;
    } else {
      var varObj = {
        varName: disp_varName.getValue(),
        varType: disp_varType.getValue(),
        url:
          disp_varType.getValue() == "Graph" ||
          disp_varType.getValue() == "Image"
            ? disp_url.getValue()
            : "",
        varIndex: uiVarObj.varIndex,
      };
      var changed = false;
      for (var all in uiVarObj) {
        for (var that in varObj) {
          if (uiVarObj[all] != varObj[all]) {
            changed = true;
            break;
          }
        }
      }
      return {
        varObj: varObj,
        changed: changed,
      };
    }
  }

  function datasetNameFieldComponent(parent, fieldName, datasetObj) {
    function toggle(key) {
      if (key == FIELDNAMEOPTIONS_current["customText"].displayText) {
        disp.toggle("editable");
        disp.editable.active = false;
        disp.editable.active = true;
      } else {
        disp.toggle("readonly");
      }
    }

    var customIncNames = getSpecificPropertyListArr(
      CUSTOM_INCREMENTS_current,
      "name",
    );

    var g1 = parent.add(
      "panel",
      undefined,
      fieldName[0].toUpperCase() + fieldName.substr(1).replace("_", " "),
    );
    g1.spacing = 4;
    g1.margins = [2, 8, 2, 2];
    var dd_options = makeDropdownlist(
      g1,
      getSpecificPropertyListObj(FIELDNAMEOPTIONS_current, "displayText"),
    );
    var thisType = datasetObj[fieldName].type;
    dd_options.setValue(FIELDNAMEOPTIONS_current[thisType].displayText);

    var g1_2 = g1.add("group");
    g1_2.orientation = "stacked";
    var disp = makeEditableReadonlyEdittext(
      g1_2,
      20,
      datasetObj[fieldName].text,
    );
    var dd_customInc = makeDropdownlist(g1_2, customIncNames);
    dd_customInc.size = dd_options.size = [165, 26];
    if (dd_options.getValue() == "Custom Increment") {
      dd_customInc.setValue(datasetObj[fieldName].text);
      disp.element.visible = false;
    } else {
      dd_customInc.visible = false;
    }

    toggle(dd_options.selection.text);

    dd_options.onChange = function () {
      var sel = this.selection;
      if (sel.text != "Custom Increment") {
        dd_customInc.visible = false;
        disp.element.visible = true;
        disp.setValue(
          getSpecificPropertyObj(
            FIELDNAMEOPTIONS_current,
            "displayText",
            sel.text,
          ).defaultText,
        );
        toggle(sel.text);
      } else {
        disp.setValue(dd_customInc.selection.text);
        disp.element.visible = false;
        dd_customInc.visible = true;
      }
    };
    dd_customInc.onChange = function () {
      disp.setValue(this.selection.text);
    };
    return {
      typeElem: dd_options,
      textElem: disp /* re-use the disp text to hold the custom inc name */,
    };
  }

  function getDatasetNamePreviewString() {
    var str = "";
    for (var all in DATASETNAMEFIELDS_current) {
      str += DATASETNAMEFIELDS_current[all].text;
    }
    return str;
  }

  function datasetAssignDialog(datasetObjOrig) {
    function getUIDsNameFieldObj(tempObj) {
      for (var all in tempObj) {
        var type = getSpecificPropertyObj(
          FIELDNAMEOPTIONS_current,
          "displayText",
          tempObj[all].typeElem.getValue(),
        ).type;
        resObj[all] = {
          type: type,
          text: tempObj[all].textElem.getValue(),
        };
      }
      return resObj;
    }

    var processedDatasetNameFieldsResult = clearOutOfBoundVariables(
      clone(datasetObjOrig),
    );
    var datasetObj = processedDatasetNameFieldsResult.obj;
    if (
      WARNINGSETTINGS.showDatasetNamingWarning &&
      processedDatasetNameFieldsResult.msg != ""
    ) {
      quickView(
        processedDatasetNameFieldsResult.msg,
        "Dataset naming field errors.",
      );
    }

    var w = new Window("dialog", "Assign Dataset Names");
    w.spacing = 4;
    w.margins = [4, 4, 4, 4];
    var resObj = {},
      tempObj = {};
    var g0 = w.add("panel");
    g0.spacing = 4;
    g0.margins = [4, 4, 4, 4];
    var g0_1 = g0.add("group");
    g0_1.spacing = 2;
    var g0_2 = g0.add("group");
    g0_2.spacing = 2;
    var groups = [g0_1, g0_2];
    var c = 0,
      cg = 0;
    for (var all in datasetObj) {
      cg = c < 3 ? 0 : 1;
      tempObj[all] = datasetNameFieldComponent(groups[cg], all, datasetObj);
      c++;
    }

    var g_btn = w.add("group");
    if (DATA.currentVars.length > 0) {
      var btn_test = g_btn.add("button", undefined, "Test Dataset Names");
      btn_test.onClick = function () {
        DATA.getCurrentGrid();
        // quickView(DATA.getTestDatasetNames(getUIDsNameFieldObj(tempObj)).join("\n"), "Dataset Names:", [300, 450]);
        var testData = DATA.getTestDatasetNames(
          getUIDsNameFieldObj(tempObj),
        ).join("\n");
        simpleShowModal(TestManager.datasetNames.makeUIContents, {
          title: "Dataset Name List",
          data: testData,
          size: [300, 450],
        });
      };
      btn_test.helpTip = "Get full list of dataset names.";
    }
    var btn_ok = g_btn.add("button", undefined, "Ok");
    var btn_ccl = g_btn.add("button", undefined, "Cancel");

    btn_ok.onClick = function () {
      var isValid = false,
        type;
      for (var all in tempObj) {
        type = getSpecificPropertyObj(
          FIELDNAMEOPTIONS_current,
          "displayText",
          tempObj[all].typeElem.getValue(),
        ).type;
        if (type != "nothing") {
          isValid = true;
          w.close();
        }
      }
      if (!isValid) {
        scriptAlert("Dataset fields cannot all be set to 'nothing'.");
      }
    };

    w.onShow = function () {};

    if (w.show() == 2) {
      return null;
    } else {
      return getUIDsNameFieldObj(tempObj);
    }
  }

  function finishedXMLFileDialog(xmlDest, varsNum, recordsNum) {
    var w = new Window("dialog", SESSION.scriptName + ": XML File created.");

    var msg =
      "Your XML file has been created.\rIt contains " +
      varsNum +
      " variable" +
      (varsNum > 1 ? "s" : "") +
      " and " +
      recordsNum +
      " record" +
      (recordsNum > 1 ? "s" : "") +
      ".";

    var l = w.add("statictext", undefined, msg, { multiline: true });
    l.size = [260, 100];

    var e = w.add("edittext", undefined, decodeURI(xmlDest), {
      readonly: true,
    });
    e.characters = 40;
    e.helpTip = decodeURI(xmlDest);
    var g_btn = w.add("group");
    var btn_ok = g_btn.add("button", undefined, "Ok");
    var btn_reveal = g_btn.add("button", undefined, "Reveal in File System");

    btn_reveal.onClick = function () {
      Folder(File(e.text).parent).execute();
      w.close();
    };
    w.show();
  }

  function finishedXMLImportDialog(
    varsNum,
    recordsNum,
    missingImgNum,
    missingGrfNum,
  ) {
    var w = new Window(
      "dialog",
      SESSION.scriptName + ": Variable Data Imported.",
    );

    var msg =
      "Your variable data has been imported.\rIt contains " +
      varsNum +
      " variable" +
      (varsNum > 1 ? "s" : "") +
      " and " +
      recordsNum +
      " record" +
      (recordsNum > 1 ? "s" : "") +
      ".";

    var l = w.add("statictext", undefined, msg, { multiline: true });
    l.size = [260, 50];

    if (missingImgNum > 0) {
      l = w.add("statictext", undefined, missingImgNum + " Missing Image(s)", {
        multiline: true,
      });
      l.size = [260, 100];
    } else if (missingGrfNum > 0) {
      l = w.add("statictext", undefined, missingGrfNum + " Missing Graph(s)", {
        multiline: true,
      });
      l.size = [260, 100];
    } else {
      var g_cycle = w.add("group");
      var btn_cycle = g_cycle.add(
        "button",
        undefined,
        "Cycle Update All Datasets",
      );
      btn_cycle.helpTip =
        "Cycling and updating each of the datasets ensures that update-asterisks will appear correctly";
      var disp_cycle = g_cycle.add(
        'edittext { properties : {readonly : true}, justify : "center" }',
      );
      disp_cycle.characters = 10;
      disp_cycle.setValue("0 of " + app.activeDocument.dataSets.length);
      btn_cycle.onClick = function () {
        cycleUpdateAllDatasets(app.activeDocument, disp_cycle);
      };
    }

    var g_btn = w.add("group");
    var btn_ok = g_btn.add("button", undefined, "Ok");

    w.show();
  }

  function updateCustomIncrementDisplay(display, customIncObj) {
    var arr = [],
      prefixStr;
    for (var i = 0; i < 10; i++) {
      prefixStr = "  " + (i + 1) + ": "; // adds a number to tell the index in the display area text
      if ((i + 1).toString().length > 1) {
        prefixStr = i + 1 + ": ";
      }
      arr.push(
        prefixStr +
          getRecordCustomInc(
            i,
            customIncObj.startNum,
            customIncObj.padZero,
            customIncObj.increment,
            customIncObj.isIntervalIncrement,
          ),
      );
    }
    display.setValue(arr.join("\n"));
  }

  function customIncrementsDialog() {
    var dialogData = clone(CUSTOM_INCREMENTS_current);
    var customIncNames = [];
    for (var i = 0; i < dialogData.length; i++) {
      customIncNames.push(dialogData[i].name);
    }

    var w = new Window("dialog", "Custom Increment Options");
    w.spacing = 4;

    var g0 = w.add("group");
    g0.orientation = "row";

    var g1 = g0.add("group");
    var g1_1 = g1.add("group");
    g1_1.orientation = "column";
    var lbl_customIncList = g1_1.add(
      "statictext",
      undefined,
      "Custom Increment List",
    );
    var list_customIncs = g1_1.add("listbox", undefined, customIncNames);
    list_customIncs.size = [195, 280];
    var g1_1_2 = g1_1.add("group");
    g1_1_2.orientation = "row";
    g1_1_2.margins = [4, 4, 4, 10];
    var btn_addCustomInc = g1_1_2.add("button", undefined, "Add \u2795");
    var btn_removeCustomInc = g1_1_2.add("button", undefined, "Remove \u2796");
    btn_addCustomInc.size = btn_removeCustomInc.size = [80, 25];

    var g2a = g0.add("group");
    g2a.orientation = "column";
    var g2 = g2a.add("panel", undefined, "Properties");
    g2.spacing = 4;
    g2.alignChildren = "left";
    var g2_1 = g2.add("group");
    var lbl_startNum = g2_1.add("statictext", undefined, "Start Number");
    lbl_startNum.size = [120, 26];
    var disp_startNum = g2_1.add("edittext", undefined, "");
    disp_startNum.characters = 10;
    disp_startNum.onChange = function () {
      var val = this.getValue();
      var msg =
        "Please enter a zero, or a positive integer number into the 'Start Number' field.";
      if (isNaN(val) || !/^\d+$/.test(val)) {
        scriptAlert(msg);
        this.setValue(0);
        updateCustomIncrementDisplay(disp_preview, {
          padZero: dd_padZero.getValue(),
          startNum: this.getValue(),
          increment: disp_incValue.getValue(),
          isIntervalIncrement: ch_intervalIncrement.getValue(),
        });
        return;
      } else {
        if (val != "0" && val.indexOf("0") > -1) {
          val = val.replace(/^0+/, "");
          if (val == "") {
            val = 0;
          }
        }
        this.setValue(val);
        updateCustomIncrementDisplay(disp_preview, {
          padZero: dd_padZero.getValue(),
          startNum: this.getValue(),
          increment: disp_incValue.getValue(),
          isIntervalIncrement: ch_intervalIncrement.getValue(),
        });
      }
    };

    var g2_1a = g2.add("group");
    var lbl_incValue = g2_1a.add("statictext", undefined, "Increment Value");
    lbl_incValue.size = [120, 26];
    var disp_incValue = g2_1a.add("edittext", undefined, "");
    disp_incValue.characters = 10;
    disp_incValue.onChange = function () {
      var val = this.getValue();
      var msg =
        "Please enter a positive integer number into the 'Increment Value' field.";
      if (isNaN(val) || !/^\d+$/.test(val) || val * 1 <= 0) {
        scriptAlert(msg);
        this.setValue(1);
        updateCustomIncrementDisplay(disp_preview, {
          padZero: dd_padZero.getValue(),
          startNum: this.getValue(),
          increment: disp_incValue.getValue(),
          isIntervalIncrement: ch_intervalIncrement.getValue(),
        });
        return;
      } else {
        this.setValue(val);
        updateCustomIncrementDisplay(disp_preview, {
          padZero: dd_padZero.getValue(),
          startNum: disp_startNum.getValue(),
          increment: this.getValue(),
          isIntervalIncrement: ch_intervalIncrement.getValue(),
        });
      }
    };

    var g2_1b = g2.add("group");
    var ch_intervalIncrement = g2_1b.add(
      "checkbox",
      undefined,
      "Make Interval Increment",
    );
    ch_intervalIncrement.helpTip =
      "Adds a dash with the next value of the incremented position after the specified increment amount has been added. ex: 1-10, 11-20";
    ch_intervalIncrement.onChange = function () {
      var val = this.getValue();
      updateCustomIncrementDisplay(disp_preview, {
        padZero: dd_padZero.getValue(),
        startNum: disp_startNum.getValue(),
        increment: disp_incValue.getValue(),
        isIntervalIncrement: val,
      });
    };

    var g2_2 = g2.add("group");
    var lbl_padZero = g2_2.add("statictext", undefined, "Padding Zeroes");
    lbl_padZero.size = [120, 26];
    var dd_padZero = makeDropdownlist(
      g2_2,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    );
    dd_padZero.characters = 10;
    dd_padZero.onChange = function () {
      updateCustomIncrementDisplay(disp_preview, {
        padZero: this.getValue(),
        startNum: disp_startNum.getValue(),
        increment: disp_incValue.getValue(),
        isIntervalIncrement: ch_intervalIncrement.getValue(),
      });
    };
    var g2_3 = g2a.add("panel", undefined, "Preview Display");
    g2_3.margins = [6, 6, 6, 6];
    var disp_preview = g2_3.add("edittext", undefined, "", {
      multiline: true,
      readonly: true,
    });
    disp_preview.size = [240, 160];

    var g_btn = w.add("group");
    var btn_ccl = g_btn.add("button", undefined, "Cancel");
    var btn_ok = g_btn.add("button", undefined, "Save");

    list_customIncs.onChange = function () {
      if (this.selection != null) {
        dd_padZero.setValue(dialogData[this.selection.index].padZero);
        disp_startNum.setValue(dialogData[this.selection.index].startNum);
        disp_incValue.setValue(dialogData[this.selection.index].increment);
        ch_intervalIncrement.setValue(
          dialogData[this.selection.index].isIntervalIncrement,
        );
        updateCustomIncrementDisplay(disp_preview, {
          padZero: dd_padZero.getValue(),
          startNum: disp_startNum.getValue(),
          increment: disp_incValue.getValue(),
          isIntervalIncrement: ch_intervalIncrement.getValue(),
        });
      }
    };

    g2.addEventListener("mousedown", function () {
      list_customIncs.selection = null;
    });

    ch_intervalIncrement.onClick = function () {
      updateCustomIncrementDisplay(disp_preview, {
        padZero: dd_padZero.getValue(),
        startNum: disp_startNum.getValue(),
        increment: disp_incValue.getValue(),
        isIntervalIncrement: this.getValue(),
      });
    };

    btn_addCustomInc.onClick = function () {
      var startNumValue = disp_startNum.getValue();
      var padZeroValue = dd_padZero.getValue();
      var incrementValue = disp_incValue.getValue();
      var isIntervalIncrement = ch_intervalIncrement.getValue();
      if (startNumValue == "" || padZeroValue == "" || incrementValue == "") {
        scriptAlert(
          "Please ensure the 'Increment Value' and 'Start Number' fields are filled.",
        );
        return;
      }
      var newName =
        "s" +
        startNumValue +
        "p" +
        padZeroValue +
        "i" +
        incrementValue +
        (isIntervalIncrement ? "-interval" : "");
      dialogData.push({
        name: newName,
        padZero: padZeroValue,
        startNum: startNumValue,
        increment: incrementValue,
        isIntervalIncrement: isIntervalIncrement,
      });
      list_customIncs.addItem(newName);
    };

    btn_removeCustomInc.onClick = function () {
      if (list_customIncs.selection == null) {
        return;
      }
      dialogData.splice(list_customIncs.selection.index, 1);
      list_customIncs.removeSelectedItem();
    };

    btn_ok.onClick = function () {
      if (dialogData.length < 1) {
        scriptAlert(
          "At least one custom increment must be present in the list to save.",
        );
        return;
      } else {
        SESSION.settingsFile.open("r");
        var settingsObj = JSON.parse(SESSION.settingsFile.read());
        SESSION.settingsFile.close();
        CUSTOM_INCREMENTS_current = settingsObj.CUSTOM_INCREMENTS = dialogData;
        writeSettingsFile(settingsObj);
      }
      this.window.close();
    };

    if (w.show() == 2) {
      return null;
    } else {
      return {};
    }
  }
  function populateVisKeyList(listElem, visKeys) {
    for (var i = listElem.items.length - 1; i > -1; i--) {
      listElem.remove(i);
    }
    var thisVisKey, newItem;
    for (var i = 0; i < visKeys.length; i++) {
      thisVisKey = visKeys[i];
      newItem = listElem.add("item");
      newItem.text = thisVisKey.name;
      newItem.subItems[0].text = thisVisKey.displayText;
      newItem.checked = thisVisKey.enabled;
    }
  }

  function visibilityKeysDialog() {
    var textInputHelpTip =
      "Visibility Key 'text' is compared to data cell text in lower-case.";

    function getBothSetsOfKeys(visKeyObj) {
      var trueVisKeys = [],
        falseVisKeys = [];
      var thisVisKey;
      for (var i = 0; i < visKeyObj.length; i++) {
        thisVisKey = visKeyObj[i];
        if (thisVisKey.value) {
          trueVisKeys.push(thisVisKey);
        } else {
          falseVisKeys.push(thisVisKey);
        }
      }
      return { trueVisKeys: trueVisKeys, falseVisKeys: falseVisKeys };
    }

    var dialogData = clone(VisibilityKeys);
    var keyData = getBothSetsOfKeys(dialogData);
    var trueVisKeys = keyData.trueVisKeys,
      falseVisKeys = keyData.falseVisKeys;

    var w = new Window("dialog", "Manage Visibility Keys");
    w.spacing = 4;
    var inputCharacterAmt = 10;

    var g0 = w.add("group");
    g0.orientation = "row";

    var g1 = g0.add("group");
    var g1_1 = g1.add("group");
    g1_1.orientation = "column";

    var lbl_trueList = g1_1.add("statictext", undefined, "true / visible");
    var list_trueList = g1_1.add("listbox", undefined, [], {
      numberOfColumns: 2,
      showHeaders: true,
      columnTitles: ["Name", "Text"],
      columnWidths: [120, 120],
    });
    list_trueList.size = [260, 200];
    list_trueList.name = "True List"; // custom property

    var g1_1_2a = g1_1.add("group");
    g1_1_2a.orientation = "row";
    g1_1_2a.spacing = 4;
    var g1_1_2a_1 = g1_1_2a.add("group");
    g1_1_2a_1.orientation = "column";
    g1_1_2a_1.spacing = 4;
    var lbl_trueKeyName = g1_1_2a_1.add("statictext", undefined, "name");
    var disp_trueKeyName = g1_1_2a_1.add("edittext", undefined, "");
    disp_trueKeyName.characters = inputCharacterAmt;
    disp_trueKeyName.list = list_trueList;

    var g1_1_2a_2 = g1_1_2a.add("group");
    g1_1_2a_2.orientation = "column";
    g1_1_2a_2.spacing = 4;
    var lbl_trueKeyText = g1_1_2a_2.add("statictext", undefined, "text");
    var disp_trueKeyText = g1_1_2a_2.add("edittext", undefined, "");
    disp_trueKeyText.helpTip = textInputHelpTip;
    disp_trueKeyText.characters = inputCharacterAmt;
    disp_trueKeyText.list = list_trueList;

    var g1_1_2 = g1_1.add("group");
    g1_1_2.orientation = "row";
    g1_1_2.margins = [4, 4, 4, 10];
    var btn_addTrueVisKey = g1_1_2.add("button", undefined, "Add \u2795");
    var btn_removeTrueVisKey = g1_1_2.add("button", undefined, "Remove \u2796");
    btn_addTrueVisKey.size = btn_removeTrueVisKey.size = [80, 25];
    btn_addTrueVisKey.list = btn_removeTrueVisKey.list = list_trueList;

    var sep = g1.add("panel");
    sep.size = [2, 300];
    var g1_2 = g1.add("group");
    g1_2.orientation = "column";

    var lbl_falseList = g1_2.add("statictext", undefined, "false / invisible");
    var list_falseList = g1_2.add("listbox", undefined, [], {
      numberOfColumns: 2,
      showHeaders: true,
      columnTitles: ["Name", "Text"],
      columnWidths: [120, 120],
    });
    list_falseList.size = [260, 200];
    list_falseList.name = "False List"; // custom property

    var g1_2_2a = g1_2.add("group");
    g1_2_2a.orientation = "row";
    g1_2_2a.spacing = 4;
    var g1_2_2a_1 = g1_2_2a.add("group");
    g1_2_2a_1.orientation = "column";
    g1_2_2a_1.spacing = 4;
    var lbl_falseKeyName = g1_2_2a_1.add("statictext", undefined, "name");
    var disp_falseKeyName = g1_2_2a_1.add("edittext", undefined, "");
    disp_falseKeyName.characters = inputCharacterAmt;
    disp_falseKeyName.list = list_falseList;

    var g1_2_2a_2 = g1_2_2a.add("group");
    g1_2_2a_2.orientation = "column";
    g1_2_2a_2.spacing = 4;
    var lbl_falseKeyText = g1_2_2a_2.add("statictext", undefined, "text");
    var disp_falseKeyText = g1_2_2a_2.add("edittext", undefined, "");
    disp_falseKeyText.helpTip = textInputHelpTip;
    disp_falseKeyText.characters = inputCharacterAmt;
    disp_falseKeyText.list = list_falseList;

    var g1_2_2 = g1_2.add("group");
    g1_2_2.orientation = "row";
    g1_2_2.margins = [4, 4, 4, 10];
    var btn_addFalseVisKey = g1_2_2.add("button", undefined, "Add \u2795");
    var btn_removeFalseVisKey = g1_2_2.add(
      "button",
      undefined,
      "Remove \u2796",
    );
    btn_addFalseVisKey.size = btn_removeFalseVisKey.size = [80, 25];
    btn_addFalseVisKey.list = btn_removeFalseVisKey.list = list_falseList;

    var btns = [
      btn_addTrueVisKey,
      btn_removeTrueVisKey,
      btn_addFalseVisKey,
      btn_removeFalseVisKey,
    ];
    var thisBtn;
    for (var i = 0; i < btns.length; i++) {
      thisBtn = btns[i];
      thisBtn.onClick = function () {
        var self = this;
        return (function (self) {
          var list = self.list;
          var isTrueList = list.name == "True List";
          var isAddBtn = self.text == "Add \u2795";
          if (isAddBtn) {
            var isValidAddition, thisValueInputElem, thisNameInputElem, problem;
            if (isTrueList) {
              thisValueInputElem = disp_trueKeyText;
              thisNameInputElem = disp_trueKeyName;
            } else {
              thisValueInputElem = disp_falseKeyText;
              thisNameInputElem = disp_falseKeyName;
            }
            try {
              problem =
                "VisibilityKeys - please fill out all necessary fields before adding a new key.";
              isValidAddition = thisNameInputElem.getValue().trim() != "";
              if (!isValidAddition) {
                throw problem;
              }
              var allPresentListNames = [];
              for (var i = 0; i < list.items.length; i++) {
                thisName = list.items[i].text;
                allPresentListNames.push(thisName);
              }
              problem =
                "VisibilityKeys - please choose a different name for the new key to add to the list.";
              isValidAddition =
                allPresentListNames.indexOf(thisNameInputElem.getValue()) == -1;
              if (isValidAddition) {
                var newItem = list.add("item");
                newItem.text = thisNameInputElem.getValue(); // name
                newItem.subItems[0].text = thisValueInputElem
                  .getValue()
                  .toLowerCase(); // text
                newItem.checked = true;
              } else {
                throw problem;
              }
            } catch (e) {
              scriptAlert(e);
              return;
            }
          } else {
            if (list.selection == null) {
              return;
            }
            if (list.items.length > 1) {
              list.selection.remove();
            }
          }

          var keyData = getBothSetsOfKeys(VisibilityKeys);
          var trueVisKeys = keyData.trueVisKeys,
            falseVisKeys = keyData.falseVisKeys;
          var targetKeys = isTrueList ? trueVisKeys : falseVisKeys;
          var isCompleteMatch = true;
          var thisName, thisText;
          for (var i = 0; i < list.items.length; i++) {
            thisName = list.items[i].text;
            thisText = list.items[i].subItems[0].text;
            if (getByName(targetKeys, thisName) == null) {
              isCompleteMatch = false;
              break;
            }
          }
          var thisCompareName, wasMatched;
          for (var i = 0; i < targetKeys.length; i++) {
            thisCompareName = targetKeys[i].name;
            wasMatched = false;
            for (var j = 0; j < list.items.length; j++) {
              thisName = list.items[j].text;
              thisText = list.items[j].subItems[0].text;
              if (thisName == thisCompareName) {
                wasMatched = true;
                break;
              } else if (!wasMatched && j == list.items.length - 1) {
                isCompleteMatch = false;
                break;
              }
            }
          }
          if (isCompleteMatch) {
            btn_ok.text = "Apply";
          } else {
            btn_ok.text = "Save & Apply";
          }
        })(self);
      };
    }

    list_trueList.onDoubleClick = list_falseList.onDoubleClick = function () {
      if (this.selection != null) {
        this.selection.checked = !this.selection.checked;
      }
    };
    var firstFocus = true;
    w.addEventListener("mouseover", function () {
      if (firstFocus) {
        list_falseList.active = true;
        list_trueList.active = true;
        firstFocus = false;
      }
    });

    var g_btn = w.add("group");
    var btn_ccl = g_btn.add("button", undefined, "Cancel");
    var btn_ok = g_btn.add("button", undefined, "Apply");
    btn_ccl.size = btn_ok.size = [180, 26];

    btn_ok.onClick = function () {
      var resultData = [],
        thisItem,
        keyObj;
      for (var i = 0; i < list_trueList.items.length; i++) {
        thisItem = list_trueList.items[i];
        keyObj = {
          displayText: thisItem.subItems[0].text,
          name: thisItem.text,
          value: true,
          enabled: thisItem.checked,
        };
        resultData.push(keyObj);
      }
      for (var i = 0; i < list_falseList.items.length; i++) {
        thisItem = list_falseList.items[i];
        keyObj = {
          displayText: thisItem.subItems[0].text,
          name: thisItem.text,
          value: false,
          enabled: thisItem.checked,
        };
        resultData.push(keyObj);
      }
      VisibilityKeys = resultData;
      if (this.text == "Save & Apply") {
        SESSION.settingsFile.open("r");
        var settingsObj = JSON.parse(SESSION.settingsFile.read());
        SESSION.settingsFile.close();
        settingsObj.VisibilityKeys = VisibilityKeys;
        writeSettingsFile(settingsObj);
      }
      this.window.close();
    };

    w.onShow = function () {
      populateVisKeyList(list_trueList, trueVisKeys);
      populateVisKeyList(list_falseList, falseVisKeys);
    };

    if (w.show() == 2) {
      return null;
    } else {
      return {};
    }
  }

  var userData = UIWindow();
  if (userData == null) {
    // abort mission
    return;
  }

  processUserInput(userData);
}

function dcRunVariable() {
  try {
    VariableImporter();
    return "OK: Đã mở Variable Importer.";
  } catch (e) {
    return "ERR: " + e.toString();
  }
}

// ============================================================
//  Catalogue A4/A5: gop truc tiep vao lib (khong con file roi).
//  Moi ham boc IIFE rieng de scope bien/ham noi bo tach biet.
// ============================================================

// [CATALOGUE] Kiểm tra object "đã là HÌNH" (chỉ ảnh, không vector/text)
//  -> để BỎ QUA raster. Tính là hình nếu:
//   - RasterItem / PlacedItem trần, HOẶC
//   - GroupItem mà mọi thành phần (bỏ mask clip) đều là Raster/Placed.
function dcIsImageOnly(item) {
  function isClipRoot(candidate) {
    var type = "";
    try {
      type = candidate.typename;
    } catch (e) {
      return false;
    }
    if (type === "PathItem") {
      try {
        return candidate.clipping === true;
      } catch (e2) {
        return false;
      }
    }
    if (type === "CompoundPathItem") {
      try {
        for (var pi = 0; pi < candidate.pathItems.length; pi++)
          if (candidate.pathItems[pi].clipping === true) return true;
      } catch (e3) {}
    }
    return false;
  }
  function imageContentOnly(candidate) {
    var type = "";
    try {
      type = candidate.typename;
    } catch (e) {
      return false;
    }
    if (type === "RasterItem" || type === "PlacedItem") return true;
    if (type !== "GroupItem") return false;

    var imageCount = 0;
    try {
      for (var i = 0; i < candidate.pageItems.length; i++) {
        var child = candidate.pageItems[i];
        // pageItems may include descendants. Only inspect direct children here;
        // nested groups are handled by the recursive call below.
        try {
          if (child.parent !== candidate) continue;
        } catch (e2) {
          return false;
        }
        if (isClipRoot(child)) continue;
        if (!imageContentOnly(child)) return false;
        imageCount++;
      }
    } catch (e3) {
      return false;
    }
    return imageCount > 0;
  }
  return imageContentOnly(item);
}

// Catalogue, CTL Offset and Keo gáy share this exact rule: keep an existing
// image intact; flatten vector/text content only once. Throw on failure so an
// imposition never silently continues with an unflattened page.
function dcFlattenForImposition(doc, item, frame, resolution) {
  if (dcIsImageOnly(item)) return item;
  if (
    !frame ||
    frame.length !== 4 ||
    !isFinite(frame[0]) ||
    !isFinite(frame[1]) ||
    !isFinite(frame[2]) ||
    !isFinite(frame[3]) ||
    frame[2] <= frame[0] ||
    frame[1] <= frame[3]
  )
    throw new Error("Không xác định được khung để raster.");
  var ro = new RasterizeOptions();
  try {
    ro.resolution = resolution > 0 ? resolution : 400;
  } catch (e) {}
  try {
    ro.transparency = true;
  } catch (e2) {}
  try {
    ro.padding = 0;
  } catch (e3) {}
  try {
    ro.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
  } catch (e4) {}
  try {
    ro.convertSpotColors = false;
  } catch (e5) {}
  var raster = doc.rasterize(item, frame, ro);
  if (!raster) throw new Error("Illustrator không tạo được RasterItem.");
  return raster;
}

function dcRunCatalogueA4() {
  try {
    // ============================================================
    //  TEST: Dàn trang Catalogue (imposition sách đóng gáy giữa)
    //  Chạy riêng để test, CHƯA tích hợp panel.
    //
    //  Cách dùng:
    //   1. Mở file có các trang catalogue (mỗi trang 1 object/group).
    //   2. Chọn N object theo THỨ TỰ z-order = trang 1, 2, 3...
    //      (N phải là bội số của 4).
    //   3. File > Scripts > chạy script này.
    //
    //  Xử lý mỗi trang: raster (nếu chưa phẳng) -> clip A4 (21x29.7cm)
    //   -> phóng to 21.1x29.9cm.
    //  Dàn: mỗi tờ 2 trang A4 nằm ngang. Cặp trang theo công thức
    //   imposition: tờ i mặt trước (N-2i, 1+2i), mặt sau (2+2i, N-1-2i).
    // ============================================================

    (function () {
      var MM = 2.834645669; // pt per mm

      // Kích thước trang
      var A4_W = 210.0,
        A4_H = 297.0; // mm - clip
      var PAGE_W = 211.0,
        PAGE_H = 299.0; // mm - sau khi phóng to
      // Chỉ dùng ở BƯỚC CUỐI, sau khi dàn xong: giảm tổng ngang của mỗi cụm 2 trang.
      var PAIR_REDUCTION = 0.25; // mm cho mỗi cụm tiếp theo (= 0.025cm)
      var GAP = 0; // mm - khe giữa 2 trang trên 1 tờ (0 = sát nhau)

      // ---- Cấu hình pon (nhớ đường dẫn 1 lần, như decal) ----
      function _ponMemoFile() {
        return new File(Folder.userData + "/dan_catalogue_pon.txt");
      }
      function _ponRead() {
        var f = _ponMemoFile();
        if (f.exists) {
          f.encoding = "UTF-8";
          f.open("r");
          var t = f.read();
          f.close();
          t = t.replace(/^\s+|\s+$/g, "");
          if (t && t.charAt(0) !== "#") return t;
        }
        return null;
      }
      function _ponWrite(path) {
        var f = _ponMemoFile();
        try {
          f.encoding = "UTF-8";
          f.open("w");
          f.write(path);
          f.close();
        } catch (e) {}
      }
      function _ponGet() {
        var saved = _ponRead();
        if (saved) {
          var f = new File(saved);
          if (f.exists) return f;
        }
        var chosen = File.openDialog(
          "Chọn file pon catalogue (.ai) - chỉ hỏi 1 lần",
          "*.ai",
        );
        if (chosen && chosen.exists) {
          _ponWrite(chosen.fsName);
          return chosen;
        }
        return null;
      }

      if (app.documents.length === 0) {
        alert("Chưa mở tài liệu.");
        return;
      }
      var doc = app.activeDocument;
      var sel = doc.selection;
      if (!sel || sel.length === 0) {
        alert("Chưa chọn object nào.");
        return;
      }

      var N = sel.length;
      if (N % 4 !== 0) {
        alert("Số trang phải là BỘI SỐ CỦA 4.\nĐang chọn: " + N + " trang.");
        return;
      }

      // ---- Gom object và sắp theo VỊ TRÍ (trái→phải, trên→dưới) ----
      //  Vì các trang catalogue xếp thành hàng, sắp theo vị trí là đúng thứ tự đọc.
      //  Tránh dùng zOrderPosition (lỗi 1200 khi khác layer).
      var pages = [];
      // Khung bao của đúng các object được chọn. Đây là vùng giới hạn dàn,
      // hoàn toàn không liên quan đến vùng làm việc của tài liệu.
      var selectionLeft = null,
        selectionTop = null,
        selectionRight = null,
        selectionBottom = null;
      for (var i = 0; i < sel.length; i++) {
        var it = sel[i];
        var b;
        try {
          b = it.visibleBounds;
        } catch (e) {
          b = it.geometricBounds;
        }
        pages.push({ item: it, left: b[0], top: b[1] });
        if (selectionLeft === null) {
          selectionLeft = b[0];
          selectionTop = b[1];
          selectionRight = b[2];
          selectionBottom = b[3];
        } else {
          selectionLeft = Math.min(selectionLeft, b[0]);
          selectionTop = Math.max(selectionTop, b[1]);
          selectionRight = Math.max(selectionRight, b[2]);
          selectionBottom = Math.min(selectionBottom, b[3]);
        }
      }
      // gom theo hàng: sắp theo top giảm dần (trên xuống), trong hàng sắp left tăng
      pages.sort(function (a, b) {
        var dy = b.top - a.top; // top lớn = ở trên = trước
        if (Math.abs(dy) > 50 * MM) return dy; // khác hàng (>5cm) -> theo hàng
        return a.left - b.left; // cùng hàng -> trái sang phải
      });
      // rút item ra
      var pageItems = [];
      for (i = 0; i < pages.length; i++) pageItems.push(pages[i].item);
      pages = pageItems; // pages[0] = trang 1

      // ============================================================
      //  HELPER
      // ============================================================

      // ===== ĐO KÍCH THƯỚC (copy nguyên từ card, xử lý clip mask kỹ) =====
      // Nếu object đã CLIP (group clipped) -> trả bounds của ĐƯỜNG MASK
      // (= khung clip đúng, vd A4). Không đo nội dung tràn bên trong.
      function clipMaskBounds(item) {
        try {
          if (item.typename === "GroupItem" && item.clipped === true) {
            var pit = item.pageItems;
            for (var i = 0; i < pit.length; i++) {
              var isc = false;
              try {
                isc = pit[i].clipping === true;
              } catch (e) {}
              if (isc) return pit[i].geometricBounds; // khung clip
            }
          }
        } catch (e) {}
        return null;
      }
      function sizeMM(item) {
        // Ưu tiên: nếu đã clip -> đo theo khung mask (kích thước clip thật)
        var mb = clipMaskBounds(item);
        if (mb)
          return { w: (mb[2] - mb[0]) / MM, h: (mb[1] - mb[3]) / MM, b: mb };
        // Chưa clip -> đo vùng thật
        var acc = { val: null };
        visibleUnion(item, acc);
        var g = acc.val;
        if (!g) {
          try {
            g = item.visibleBounds;
          } catch (e) {
            try {
              g = item.geometricBounds;
            } catch (e2) {
              g = null;
            }
          }
        }
        if (!g) return { w: 0, h: 0, b: [0, 0, 0, 0] };
        return { w: (g[2] - g[0]) / MM, h: (g[1] - g[3]) / MM, b: g };
      }

      function isVisibleLeaf(it) {
        try {
          if (it.hidden === true) return false;
          if (it.guides === true) return false;
        } catch (e) {}
        try {
          if (it.typename === "PathItem")
            return it.filled === true || it.stroked === true;
          if (it.typename === "CompoundPathItem") {
            if (it.pathItems.length > 0) {
              var p0 = it.pathItems[0];
              return p0.filled === true || p0.stroked === true;
            }
            return false;
          }
        } catch (e) {}
        return true; // text, raster, placed... coi là thấy
      }

      function visibleUnion(item, acc) {
        function merge(b) {
          if (!b) return;
          if (!acc.val) {
            acc.val = b.slice(0);
            return;
          }
          var a = acc.val;
          if (b[0] < a[0]) a[0] = b[0];
          if (b[1] > a[1]) a[1] = b[1];
          if (b[2] > a[2]) a[2] = b[2];
          if (b[3] < a[3]) a[3] = b[3];
        }
        // An toàn: object có thể đã bị xóa/không hợp lệ -> bỏ qua, tránh Error 45.
        var _tn;
        try {
          _tn = item.typename;
        } catch (e) {
          return;
        }
        if (_tn === "GroupItem") {
          var clipped = false;
          try {
            clipped = item.clipped;
          } catch (e) {}
          if (clipped) {
            // Tìm clip mask để lấy VÙNG GIỚI HẠN (không dùng thẳng làm kết quả,
            // vì mask có thể lớn thừa hơn nội dung thật).
            var pit = item.pageItems;
            var maskB = null;
            for (var i = 0; i < pit.length; i++) {
              var isc = false;
              try {
                isc = pit[i].clipping === true;
              } catch (e) {}
              if (isc) {
                maskB = pit[i].geometricBounds;
                break;
              }
            }
            // Đo nội dung THẬT (leaf có fill/stroke) bên trong, bỏ qua chính mask.
            var inner = { val: null };
            for (i = 0; i < pit.length; i++) {
              var isMask = false;
              try {
                isMask = pit[i].clipping === true;
              } catch (e) {}
              if (isMask) continue; // bỏ đường mask
              visibleUnion(pit[i], inner);
            }
            var res = inner.val;
            // Giao nội dung thật với vùng mask (nội dung tràn ngoài mask bị cắt).
            if (res && maskB) {
              var gx0 = Math.max(res[0], maskB[0]);
              var gy1 = Math.min(res[1], maskB[1]);
              var gx2 = Math.min(res[2], maskB[2]);
              var gy3 = Math.max(res[3], maskB[3]);
              if (gx2 > gx0 && gy1 > gy3) merge([gx0, gy1, gx2, gy3]);
              else merge(maskB); // giao rỗng -> fallback mask
            } else if (res) {
              merge(res);
            } else if (maskB) {
              merge(maskB);
            }
            return;
          }
          var pit2 = item.pageItems;
          for (var j = 0; j < pit2.length; j++) visibleUnion(pit2[j], acc);
          return;
        }
        if (isVisibleLeaf(item)) {
          try {
            merge(item.visibleBounds);
          } catch (e) {}
        }
      }

      // Rasterize object (làm phẳng) ở 300ppi
      function rasterize(item) {
        var ro = new RasterizeOptions();
        try {
          ro.resolution = 400;
        } catch (e) {}
        try {
          ro.transparency = true;
        } catch (e) {}
        try {
          ro.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
        } catch (e) {}
        try {
          ro.convertSpotColors = false;
        } catch (e) {}
        var b;
        try {
          b = item.visibleBounds;
        } catch (e) {
          b = item.geometricBounds;
        }
        return doc.rasterize(item, b, ro);
      }

      // Kiểm object đã "phẳng" chưa (là 1 RasterItem hoặc PlacedItem)
      function isFlat(item) {
        try {
          var t = item.typename;
          return t === "RasterItem" || t === "PlacedItem";
        } catch (e) {
          return false;
        }
      }

      // Clip object về đúng khung rect [l,t,r,b] cho trước (như card autoClip).
      function clipToRect(item, rect) {
        var lay = item.layer;
        // rectangle(top, left, width, height)
        var w = rect[2] - rect[0],
          h = rect[1] - rect[3];
        var r = lay.pathItems.rectangle(rect[1], rect[0], w, h);
        var grp = lay.groupItems.add();
        r.move(grp, ElementPlacement.PLACEATBEGINNING);
        item.move(grp, ElementPlacement.PLACEATEND);
        r.clipping = true;
        grp.clipped = true;
        return grp;
      }

      // Đặt tâm object vào (cxPt, cyPt) theo VISIBLE bounds
      function centerAt(item, cxPt, cyPt) {
        var s = sizeMM(item);
        var curCx = (s.b[0] + s.b[2]) / 2,
          curCy = (s.b[1] + s.b[3]) / 2;
        item.translate(cxPt - curCx, cyPt - curCy);
      }

      // ============================================================
      //  BƯỚC 1: XỬ LÝ TỪNG TRANG (làm như card: raster + clip, KHÔNG resize)
      //  Object đã đúng kích thước (đã clip sẵn). Chỉ cần:
      //   1. Raster (làm phẳng thành hình).
      //   2. Clip lại về đúng khung của nó (như card).
      //  KHÔNG bóp/resize -> không méo.
      // ============================================================
      var processed = [];
      var sizeLog = "";
      for (var p = 0; p < pages.length; p++) {
        var item = pages[p];
        var s0 = sizeMM(item); // KT hiện tại (đã clip -> đọc khung clip)

        // Khung để raster = khung hiện tại của object (đã clip đúng KT)
        var frame = s0.b.slice(0); // [l,t,r,b]

        // Raster làm phẳng theo đúng khung (KHÔNG clip lại - object đã clip sẵn)
        var flat = dcFlattenForImposition(doc, item, frame, 400);

        // TĂNG kích thước lên đúng 21.1 x 29.9 (cách A - ép đúng số)
        var gb = flat.geometricBounds; // [l,t,r,b]
        var curW = (gb[2] - gb[0]) / MM,
          curH = (gb[1] - gb[3]) / MM;
        if (curW > 0 && curH > 0) {
          var sx = (PAGE_W / curW) * 100;
          var sy = (PAGE_H / curH) * 100;
          try {
            flat.resize(sx, sy);
          } catch (e) {}
        }

        if (p < 4)
          sizeLog +=
            "Trang " +
            (p + 1) +
            ": " +
            s0.w.toFixed(1) +
            " x " +
            s0.h.toFixed(1) +
            " -> " +
            PAGE_W +
            " x " +
            PAGE_H +
            " mm\n";
        processed.push(flat);
      }

      // ============================================================
      //  BƯỚC 2: TÍNH CẶP IMPOSITION
      //  Tờ i (0-based): mặt trước (N-2i, 1+2i), mặt sau (2+2i, N-1-2i)
      //  (số trang 1-based). Chuyển sang index 0-based khi lấy processed.
      // ============================================================
      var sheets = []; // mỗi phần tử: {front:[L,R], back:[L,R]} - số trang 1-based
      var numSheets = N / 4;
      for (var s = 0; s < numSheets; s++) {
        var frontL = N - 2 * s; // trái mặt trước
        var frontR = 1 + 2 * s; // phải mặt trước
        var backL = 2 + 2 * s; // trái mặt sau
        var backR = N - 1 - 2 * s; // phải mặt sau
        sheets.push({ front: [frontL, frontR], back: [backL, backR] });
      }

      // ============================================================
      //  BƯỚC 3: IMPORT PON + NHÂN BẢN ARTBOARD + DÀN + CĂN GIỮA
      //  - Pon: 1 artboard 43x32.5 + nội dung. Mỗi cụm 2 trang (1 mặt) vào
      //    giữa 1 artboard. Số cụm = số mặt = numSheets * 2.
      //  - Nhân bản pon + artboard thành (số cụm) cái, xếp 2 cột x nhiều hàng:
      //    [AB1][AB2] hàng 1 (tờ 1 trước|sau), [AB3][AB4] hàng 2 (tờ 2)...
      //  - Căn giữa từng cụm 2 trang vào giữa artboard tương ứng.
      // ============================================================
      var pb = processed[0].geometricBounds; // [l,t,r,b] - KT thật 1 trang
      var pageWpt = pb[2] - pb[0];
      var pageHpt = pb[1] - pb[3];
      var gapPt = GAP * MM;
      var spreadWpt = pageWpt * 2 + gapPt; // 1 cụm 2 trang = 42.2mm

      var numFaces = numSheets * 2; // số cụm 2 trang = số mặt (mỗi tờ 2 mặt)

      // ---- Import pon ----
      var ponFile = _ponGet();
      if (!ponFile) {
        alert("Chưa chọn file pon. Dừng.");
        return;
      }

      var destName = doc.name;
      var oldAbCount = doc.artboards.length;

      // mở pon, lấy artboard + object
      var ponDoc = app.open(ponFile);
      app.activeDocument = ponDoc;
      if (ponDoc.artboards.length === 0) {
        ponDoc.close(SaveOptions.DONOTSAVECHANGES);
        alert("File pon không có artboard.");
        return;
      }
      var ponAbRect = ponDoc.artboards[0].artboardRect.slice(0); // [l,t,r,b]
      var ponAbW = ponAbRect[2] - ponAbRect[0];
      var ponAbH = ponAbRect[1] - ponAbRect[3];

      // gom object pon thành 1 group để nhân bản
      app.activeDocument = doc;
      var destLayer = doc.activeLayer;
      app.activeDocument = ponDoc;
      var ponItems = [];
      for (var pi = 0; pi < ponDoc.pageItems.length; pi++)
        ponItems.push(ponDoc.pageItems[pi]);
      var ponGroupDup = null;
      // Offset của nội dung Pon so với tâm artboard gốc. Không giả định rằng
      // bounds của dấu Pon luôn nằm đúng tâm artboard (thường chúng không đối xứng).
      var ponOffsetX = 0,
        ponOffsetY = 0;
      if (ponItems.length > 0) {
        var ponGroup = ponDoc.groupItems.add();
        for (pi = ponItems.length - 1; pi >= 0; pi--) {
          try {
            ponItems[pi].move(ponGroup, ElementPlacement.PLACEATBEGINNING);
          } catch (e) {}
        }
        // vị trí gốc group pon (để tính offset khi nhân bản)
        // Lưu offset gốc trước khi đưa group sang document đích.
        try {
          var ponGb = ponGroup.geometricBounds;
          var ponGroupCx = (ponGb[0] + ponGb[2]) / 2;
          var ponGroupCy = (ponGb[1] + ponGb[3]) / 2;
          var ponAbCx = (ponAbRect[0] + ponAbRect[2]) / 2;
          var ponAbCy = (ponAbRect[1] + ponAbRect[3]) / 2;
          ponOffsetX = ponGroupCx - ponAbCx;
          ponOffsetY = ponGroupCy - ponAbCy;
        } catch (e) {}
        try {
          ponGroupDup = ponGroup.duplicate(
            destLayer,
            ElementPlacement.PLACEATEND,
          );
        } catch (e) {}
      }
      app.activeDocument = ponDoc;
      ponDoc.close(SaveOptions.DONOTSAVECHANGES);

      // tìm lại doc gốc
      var dd = null;
      for (var di = 0; di < app.documents.length; di++)
        if (app.documents[di].name === destName) {
          dd = app.documents[di];
          break;
        }
      if (dd) {
        doc = dd;
        app.activeDocument = doc;
      }
      // Quay về đúng document đã lưu tham chiếu từ đầu, không tìm bằng tên tab.
      // Tab mới có thể trùng tên hoặc Illustrator có thể tự đổi tên Untitled.
      app.activeDocument = doc;

      // ---- Vị trí các artboard nhân bản: 2 cột x tối đa 16 hàng mỗi KHỐI ----
      //  QUAN TRỌNG: dùng vị trí THẬT của pon sau khi duplicate vào file đích,
      //  KHÔNG dùng ponAbRect (tọa độ file pon) vì khác ruler origin -> lệch.
      //  Đo tâm pon thật -> suy ra vị trí artboard đầu tiên (pon nằm giữa AB).
      var startL, startT;
      if (ponGroupDup) {
        var pgb = ponGroupDup.geometricBounds; // [l,t,r,b] pon thật trong file đích
        var ponRealCx = (pgb[0] + pgb[2]) / 2;
        var ponRealCy = (pgb[1] + pgb[3]) / 2;
        // pon nằm ở tâm artboard + offset gốc -> tâm artboard = tâm pon - offset
        var ab0Cx = ponRealCx - ponOffsetX;
        var ab0Cy = ponRealCy - ponOffsetY;
        // vị trí trái/top của artboard đầu tiên
        startL = ab0Cx - ponAbW / 2;
        startT = ab0Cy + ponAbH / 2;
      } else {
        // không có pon -> dùng tọa độ file pon (dự phòng)
        startL = ponAbRect[0];
        startT = ponAbRect[1];
      }

      var MAX_ROWS = 16;
      var blockWpt = ponAbW * 2; // 1 khối rộng = 2 cột artboard
      var abPositions = []; // [l,t,r,b] cho từng cụm (faceIndex)
      for (var fk = 0; fk < numFaces; fk++) {
        var sheetIdx = Math.floor(fk / 2); // tờ thứ mấy (0-based)
        var faceSide = fk % 2; // 0 = trước (cột trái), 1 = sau (cột phải)
        var blockNo = Math.floor(sheetIdx / MAX_ROWS); // khối thứ mấy
        var rowInBlock = sheetIdx % MAX_ROWS; // hàng trong khối
        var l = startL + blockNo * blockWpt + faceSide * ponAbW;
        var t = startT - rowInBlock * ponAbH;
        abPositions.push([l, t, l + ponAbW, t - ponAbH]);
      }

      // ---- Tạo artboard + nhân bản pon vào từng artboard ----
      //  artboard gốc (index 0 của doc) tạm để, ta thêm mới rồi xóa cũ sau.
      //  Với mỗi cụm: thêm artboard tại abPositions[k], nhân bản pon vào giữa AB.
      var ponGroups = []; // group pon đã nhân bản cho từng artboard
      for (var k = 0; k < numFaces; k++) {
        var pos = abPositions[k];
        // thêm artboard
        try {
          doc.artboards.add(pos);
        } catch (e) {}
        // nhân bản pon vào từng artboard, giữ đúng offset gốc của pon so với AB
        if (ponGroupDup) {
          var g;
          try {
            g = ponGroupDup.duplicate(
              doc.activeLayer,
              ElementPlacement.PLACEATEND,
            );
            var gb = g.geometricBounds;
            var gcx = (gb[0] + gb[2]) / 2,
              gcy = (gb[1] + gb[3]) / 2;
            var acx = (pos[0] + pos[2]) / 2,
              acy = (pos[1] + pos[3]) / 2;
            // đặt tâm pon = tâm artboard + offset gốc (giữ nội dung không đối xứng đúng chỗ)
            g.translate(acx + ponOffsetX - gcx, acy + ponOffsetY - gcy);
            ponGroups.push(g);
          } catch (e) {}
        }
      }
      // xóa pon gốc (bản duplicate đầu) + artboard cũ
      try {
        if (ponGroupDup) ponGroupDup.remove();
      } catch (e) {}
      // xóa các artboard cũ (index 0..oldAbCount-1)
      if (doc.artboards.length > numFaces) {
        for (var a2 = oldAbCount - 1; a2 >= 0; a2--) {
          try {
            doc.artboards.remove(a2);
          } catch (e) {}
        }
      }

      // ---- Dàn trang vào giữa từng artboard (cụm 2 trang / artboard) ----
      //  Thứ tự cụm (mặt): tờ 0 trước = AB0, tờ 0 sau = AB1, tờ 1 trước = AB2...
      //  faces[k] = cặp [L,R] trang của cụm k.
      var faces = [];
      for (var sf = 0; sf < numSheets; sf++) {
        faces.push(sheets[sf].front); // mặt trước
        faces.push(sheets[sf].back); // mặt sau
      }

      // đặt 1 cụm 2 trang vào giữa artboard abPositions[k]
      function placeFaceCentered(pair, pos) {
        var leftItem = processed[pair[0] - 1];
        var rightItem = processed[pair[1] - 1];
        var acx = (pos[0] + pos[2]) / 2,
          acy = (pos[1] + pos[3]) / 2;
        // cụm 2 trang rộng spreadWpt, cao pageHpt -> căn giữa artboard
        // trang trái tâm tại acx - spreadWpt/2 + pageWpt/2
        var cxL = acx - spreadWpt / 2 + pageWpt / 2;
        var cxR = acx - spreadWpt / 2 + pageWpt + gapPt + pageWpt / 2;
        var cy = acy;
        if (leftItem) centerAt(leftItem, cxL, cy);
        if (rightItem) centerAt(rightItem, cxR, cy);
      }

      for (k = 0; k < faces.length; k++) {
        placeFaceCentered(faces[k], abPositions[k]);
      }

      // ============================================================
      //  BƯỚC CUỐI: BÓP NGANG CỤM ĐÃ DÀN (KHÔNG ĐỤNG PON/ARTBOARD)
      //  Sau khi mọi trang đã nằm đúng vị trí, co ngang hai trang quanh
      //  đúng tâm cụm hiện có. Chiều cao không đổi, khe giữa vẫn bằng 0.
      //  Cụm 1 = 422.000mm (42.200cm); cụm 2 = 421.750mm (42.175cm);
      //  cụm 3 = 421.500mm (42.150cm); ...
      //  Artboard 1-2 = 422.000mm (42.200cm); artboard 3-4 = 421.750mm
      //  (42.175cm); artboard 5-6 = 421.500mm (42.150cm); ...
      // ============================================================
      function squeezePlacedFace(pair, faceIndex) {
        var leftItem = processed[pair[0] - 1];
        var rightItem = processed[pair[1] - 1];
        if (!leftItem || !rightItem) return;

        // Ghi lại đúng tâm/vị trí dọc mà BƯỚC 3 vừa đặt.
        var leftBefore = sizeMM(leftItem);
        var rightBefore = sizeMM(rightItem);
        var faceCx = (leftBefore.b[0] + rightBefore.b[2]) / 2;
        var leftCy = (leftBefore.b[1] + leftBefore.b[3]) / 2;
        var rightCy = (rightBefore.b[1] + rightBefore.b[3]) / 2;

        // Tổng phần giảm chia đều cho 2 trang; chỉ resize trục X.
        // Hai artboard liên tiếp dùng cùng một mức bóp: 1-2, 3-4, 5-6...
        var artboardPairIndex = Math.floor(faceIndex / 2);
        var reductionPt = faceIndex * PAIR_REDUCTION * MM;
        var reductionPt = artboardPairIndex * PAIR_REDUCTION * MM;
        var targetPageWpt = pageWpt - reductionPt / 2;
        var scaleX = (targetPageWpt / pageWpt) * 100;
        try {
          leftItem.resize(scaleX, 100);
        } catch (e) {}
        try {
          rightItem.resize(scaleX, 100);
        } catch (e) {}

        // Đưa hai trang về sát nhau quanh đúng tâm cũ của cụm.
        var targetSpreadWpt = targetPageWpt * 2 + gapPt;
        var leftCx = faceCx - targetSpreadWpt / 2 + targetPageWpt / 2;
        var rightCx =
          faceCx -
          targetSpreadWpt / 2 +
          targetPageWpt +
          gapPt +
          targetPageWpt / 2;
        centerAt(leftItem, leftCx, leftCy);
        centerAt(rightItem, rightCx, rightCy);
      }

      for (k = 0; k < faces.length; k++) {
        squeezePlacedFace(faces[k], k);
      }

      app.redraw();

      // ============================================================
      //  BƯỚC GHI CHÚ: hiện bảng nhập, điền chữ vào artboard lẻ.
      //  - AB index lẻ theo NGƯỜI DÙNG đếm từ 1: AB1=bìa, AB3=ruột1, AB5=ruột2...
      //    (tức index 0-based: 0=bìa, 2=ruột1, 4=ruột2...)
      //  - Font 13, đen. Vị trí: trên cụm 2 trang 0.2cm, cách mép TRÁI bài dàn 1cm.
      // ============================================================
      function showNoteDialog() {
        var w = new Window("dialog", "Nhập ghi chú");
        w.orientation = "column";
        w.alignChildren = "fill";
        w.margins = 16;
        w.spacing = 10;

        w.add("statictext", undefined, "Ghi chú BÌA (artboard 1):");
        var edBia = w.add("edittext", undefined, "");
        edBia.characters = 40;

        w.add(
          "statictext",
          undefined,
          "Ghi chú RUỘT (tự thêm 'RUỘT 1, RUỘT 2...'):",
        );
        var edRuot = w.add("edittext", undefined, "");
        edRuot.characters = 40;

        var row = w.add("group");
        row.alignment = "right";
        var btnCancel = row.add("button", undefined, "Bỏ qua", {
          name: "cancel",
        });
        var btnOK = row.add("button", undefined, "Điền ghi chú", {
          name: "ok",
        });

        var res = null;
        btnOK.onClick = function () {
          res = { bia: edBia.text, ruot: edRuot.text };
          w.close();
        };
        btnCancel.onClick = function () {
          res = null;
          w.close();
        };
        w.show();
        return res;
      }

      // Tạo 1 text ghi chú tại vị trí: trên cụm 0.2cm, cách mép trái bài dàn 1cm.
      function addNote(text, pos) {
        if (!text) return;
        try {
          var lay = doc.activeLayer;
          var tf = lay.textFrames.add();
          tf.contents = text;
          try {
            tf.textRange.characterAttributes.size = 13;
          } catch (e) {}
          // màu đen
          try {
            var black = new CMYKColor();
            black.black = 100;
            tf.textRange.characterAttributes.fillColor = black;
          } catch (e) {
            try {
              var rgb = new RGBColor();
              rgb.red = 0;
              rgb.green = 0;
              rgb.blue = 0;
              tf.textRange.characterAttributes.fillColor = rgb;
            } catch (e2) {}
          }
          // vị trí: x = mép trái artboard + 1cm; y = mép trên cụm + 0.2cm
          //  pos = [l,t,r,b] của artboard. Cụm nằm giữa artboard.
          //  mép trên cụm = tâm artboard + pageHpt/2. Ghi chú trên đó 0.2cm.
          var acy = (pos[1] + pos[3]) / 2;
          var topCum = acy + pageHpt / 2;
          var x = pos[0] + 10 * MM; // cách mép trái 1cm
          var y = topCum + 2 * MM + 4 * MM; // trên cụm 0.2cm + nâng thêm 4mm
          tf.position = [x, y]; // [left, top] của text
        } catch (e) {}
      }

      var note = showNoteDialog();
      if (note) {
        // điền vào các artboard index chẵn 0-based (0=bìa, 2=ruột1, 4=ruột2...)
        var ruotNo = 0;
        for (var ab = 0; ab < abPositions.length; ab += 2) {
          var pos = abPositions[ab];
          if (ab === 0) {
            addNote(note.bia, pos); // bìa
          } else {
            ruotNo++;
            var t = "RUỘT " + ruotNo + (note.ruot ? " " + note.ruot : "");
            addNote(t, pos);
          }
        }
        app.redraw();
      }
    })();
    return "OK: \u0110\u00e3 ch\u1ea1y d\u00e0n catalogue A4.";
  } catch (e) {
    return "ERR: catalogue A4: " + e.toString();
  }
}

function dcRunCatalogueA5() {
  try {
    // ============================================================
    //  TEST: Dàn trang Catalogue (imposition sách đóng gáy giữa)
    //  Chạy riêng để test, CHƯA tích hợp panel.
    //
    //  Cách dùng:
    //   1. Mở file có các trang catalogue (mỗi trang 1 object/group).
    //   2. Chọn N object theo THỨ TỰ z-order = trang 1, 2, 3...
    //      (N phải là bội số của 4).
    //   3. File > Scripts > chạy script này.
    //
    //  Xử lý mỗi trang: raster (nếu chưa phẳng) -> clip A4 (21x29.7cm)
    //   -> phóng to 21.1x29.9cm.
    //  Dàn: mỗi tờ 2 trang A4 nằm ngang. Cặp trang theo công thức
    //   imposition: tờ i mặt trước (N-2i, 1+2i), mặt sau (2+2i, N-1-2i).
    // ============================================================

    (function () {
      var MM = 2.834645669; // pt per mm

      // Kích thước trang
      var A4_W = 210.0,
        A4_H = 297.0; // mm - (không dùng cho A5)
      // A5 DỌC: rộng 149.5, cao 211 (trang nguồn được chọn theo chiều dọc).
      // Dàn 2 cột x 2 hàng sẽ thành cụm 299 x 422mm, vừa Pon A5 dọc.
      var PAGE_W = 149.5,
        PAGE_H = 211.0; // mm - 1 trang A5 sau phóng to (dọc)
      // Chỉ dùng ở BƯỚC CUỐI, sau khi dàn xong: giảm chiều ngang cụm theo từng cặp artboard.
      var PAIR_REDUCTION = 0.25; // mm cho mỗi cụm tiếp theo (= 0.025cm)
      var GAP = 0; // mm - khe giữa 2 trang trên 1 tờ (0 = sát nhau)

      // ---- Cấu hình pon (nhớ đường dẫn 1 lần, như decal) ----
      function _ponMemoFile() {
        return new File(Folder.userData + "/dan_catalogue_pon_A5.txt");
      }
      function _ponRead() {
        var f = _ponMemoFile();
        if (f.exists) {
          f.encoding = "UTF-8";
          f.open("r");
          var t = f.read();
          f.close();
          t = t.replace(/^\s+|\s+$/g, "");
          if (t && t.charAt(0) !== "#") return t;
        }
        return null;
      }
      function _ponWrite(path) {
        var f = _ponMemoFile();
        try {
          f.encoding = "UTF-8";
          f.open("w");
          f.write(path);
          f.close();
        } catch (e) {}
      }
      function _ponGet() {
        var saved = _ponRead();
        if (saved) {
          var f = new File(saved);
          if (f.exists) return f;
        }
        var chosen = File.openDialog(
          "Chọn file pon catalogue A5 (.ai) - chỉ hỏi 1 lần",
          "*.ai",
        );
        if (chosen && chosen.exists) {
          _ponWrite(chosen.fsName);
          return chosen;
        }
        return null;
      }

      if (app.documents.length === 0) {
        alert("Chưa mở tài liệu.");
        return;
      }
      var doc = app.activeDocument;
      var sel = doc.selection;
      if (!sel || sel.length === 0) {
        alert("Chưa chọn object nào.");
        return;
      }

      var N = sel.length;
      if (N % 4 !== 0) {
        alert("Số trang phải là BỘI SỐ CỦA 4.\nĐang chọn: " + N + " trang.");
        return;
      }

      // ---- Gom object và sắp theo VỊ TRÍ (trái→phải, trên→dưới) ----
      //  Vì các trang catalogue xếp thành hàng, sắp theo vị trí là đúng thứ tự đọc.
      //  Tránh dùng zOrderPosition (lỗi 1200 khi khác layer).
      var pages = [];
      // Khung bao của đúng các object được chọn. Đây là vùng giới hạn dàn,
      // hoàn toàn không liên quan đến vùng làm việc của tài liệu.
      var selectionLeft = null,
        selectionTop = null,
        selectionRight = null,
        selectionBottom = null;
      for (var i = 0; i < sel.length; i++) {
        var it = sel[i];
        var b;
        try {
          b = it.visibleBounds;
        } catch (e) {
          b = it.geometricBounds;
        }
        pages.push({ item: it, left: b[0], top: b[1] });
        if (selectionLeft === null) {
          selectionLeft = b[0];
          selectionTop = b[1];
          selectionRight = b[2];
          selectionBottom = b[3];
        } else {
          selectionLeft = Math.min(selectionLeft, b[0]);
          selectionTop = Math.max(selectionTop, b[1]);
          selectionRight = Math.max(selectionRight, b[2]);
          selectionBottom = Math.min(selectionBottom, b[3]);
        }
      }
      // gom theo hàng: sắp theo top giảm dần (trên xuống), trong hàng sắp left tăng
      pages.sort(function (a, b) {
        var dy = b.top - a.top; // top lớn = ở trên = trước
        if (Math.abs(dy) > 50 * MM) return dy; // khác hàng (>5cm) -> theo hàng
        return a.left - b.left; // cùng hàng -> trái sang phải
      });
      // rút item ra
      var pageItems = [];
      for (i = 0; i < pages.length; i++) pageItems.push(pages[i].item);
      pages = pageItems; // pages[0] = trang 1

      // ============================================================
      //  HELPER
      // ============================================================

      // ===== ĐO KÍCH THƯỚC (copy nguyên từ card, xử lý clip mask kỹ) =====
      // Nếu object đã CLIP (group clipped) -> trả bounds của ĐƯỜNG MASK
      // (= khung clip đúng, vd A4). Không đo nội dung tràn bên trong.
      function clipMaskBounds(item) {
        try {
          if (item.typename === "GroupItem" && item.clipped === true) {
            var pit = item.pageItems;
            for (var i = 0; i < pit.length; i++) {
              var isc = false;
              try {
                isc = pit[i].clipping === true;
              } catch (e) {}
              if (isc) return pit[i].geometricBounds; // khung clip
            }
          }
        } catch (e) {}
        return null;
      }
      function sizeMM(item) {
        // Ưu tiên: nếu đã clip -> đo theo khung mask (kích thước clip thật)
        var mb = clipMaskBounds(item);
        if (mb)
          return { w: (mb[2] - mb[0]) / MM, h: (mb[1] - mb[3]) / MM, b: mb };
        // Chưa clip -> đo vùng thật
        var acc = { val: null };
        visibleUnion(item, acc);
        var g = acc.val;
        if (!g) {
          try {
            g = item.visibleBounds;
          } catch (e) {
            try {
              g = item.geometricBounds;
            } catch (e2) {
              g = null;
            }
          }
        }
        if (!g) return { w: 0, h: 0, b: [0, 0, 0, 0] };
        return { w: (g[2] - g[0]) / MM, h: (g[1] - g[3]) / MM, b: g };
      }

      function isVisibleLeaf(it) {
        try {
          if (it.hidden === true) return false;
          if (it.guides === true) return false;
        } catch (e) {}
        try {
          if (it.typename === "PathItem")
            return it.filled === true || it.stroked === true;
          if (it.typename === "CompoundPathItem") {
            if (it.pathItems.length > 0) {
              var p0 = it.pathItems[0];
              return p0.filled === true || p0.stroked === true;
            }
            return false;
          }
        } catch (e) {}
        return true; // text, raster, placed... coi là thấy
      }

      function visibleUnion(item, acc) {
        function merge(b) {
          if (!b) return;
          if (!acc.val) {
            acc.val = b.slice(0);
            return;
          }
          var a = acc.val;
          if (b[0] < a[0]) a[0] = b[0];
          if (b[1] > a[1]) a[1] = b[1];
          if (b[2] > a[2]) a[2] = b[2];
          if (b[3] < a[3]) a[3] = b[3];
        }
        // An toàn: object có thể đã bị xóa/không hợp lệ -> bỏ qua, tránh Error 45.
        var _tn;
        try {
          _tn = item.typename;
        } catch (e) {
          return;
        }
        if (_tn === "GroupItem") {
          var clipped = false;
          try {
            clipped = item.clipped;
          } catch (e) {}
          if (clipped) {
            // Tìm clip mask để lấy VÙNG GIỚI HẠN (không dùng thẳng làm kết quả,
            // vì mask có thể lớn thừa hơn nội dung thật).
            var pit = item.pageItems;
            var maskB = null;
            for (var i = 0; i < pit.length; i++) {
              var isc = false;
              try {
                isc = pit[i].clipping === true;
              } catch (e) {}
              if (isc) {
                maskB = pit[i].geometricBounds;
                break;
              }
            }
            // Đo nội dung THẬT (leaf có fill/stroke) bên trong, bỏ qua chính mask.
            var inner = { val: null };
            for (i = 0; i < pit.length; i++) {
              var isMask = false;
              try {
                isMask = pit[i].clipping === true;
              } catch (e) {}
              if (isMask) continue; // bỏ đường mask
              visibleUnion(pit[i], inner);
            }
            var res = inner.val;
            // Giao nội dung thật với vùng mask (nội dung tràn ngoài mask bị cắt).
            if (res && maskB) {
              var gx0 = Math.max(res[0], maskB[0]);
              var gy1 = Math.min(res[1], maskB[1]);
              var gx2 = Math.min(res[2], maskB[2]);
              var gy3 = Math.max(res[3], maskB[3]);
              if (gx2 > gx0 && gy1 > gy3) merge([gx0, gy1, gx2, gy3]);
              else merge(maskB); // giao rỗng -> fallback mask
            } else if (res) {
              merge(res);
            } else if (maskB) {
              merge(maskB);
            }
            return;
          }
          var pit2 = item.pageItems;
          for (var j = 0; j < pit2.length; j++) visibleUnion(pit2[j], acc);
          return;
        }
        if (isVisibleLeaf(item)) {
          try {
            merge(item.visibleBounds);
          } catch (e) {}
        }
      }

      // Rasterize object (làm phẳng) ở 300ppi
      function rasterize(item) {
        var ro = new RasterizeOptions();
        try {
          ro.resolution = 400;
        } catch (e) {}
        try {
          ro.transparency = true;
        } catch (e) {}
        try {
          ro.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
        } catch (e) {}
        try {
          ro.convertSpotColors = false;
        } catch (e) {}
        var b;
        try {
          b = item.visibleBounds;
        } catch (e) {
          b = item.geometricBounds;
        }
        return doc.rasterize(item, b, ro);
      }

      // Kiểm object đã "phẳng" chưa (là 1 RasterItem hoặc PlacedItem)
      function isFlat(item) {
        try {
          var t = item.typename;
          return t === "RasterItem" || t === "PlacedItem";
        } catch (e) {
          return false;
        }
      }

      // Clip object về đúng khung rect [l,t,r,b] cho trước (như card autoClip).
      function clipToRect(item, rect) {
        var lay = item.layer;
        // rectangle(top, left, width, height)
        var w = rect[2] - rect[0],
          h = rect[1] - rect[3];
        var r = lay.pathItems.rectangle(rect[1], rect[0], w, h);
        var grp = lay.groupItems.add();
        r.move(grp, ElementPlacement.PLACEATBEGINNING);
        item.move(grp, ElementPlacement.PLACEATEND);
        r.clipping = true;
        grp.clipped = true;
        return grp;
      }

      // Đặt tâm object vào (cxPt, cyPt) theo VISIBLE bounds
      function centerAt(item, cxPt, cyPt) {
        var s = sizeMM(item);
        var curCx = (s.b[0] + s.b[2]) / 2,
          curCy = (s.b[1] + s.b[3]) / 2;
        item.translate(cxPt - curCx, cyPt - curCy);
      }

      // ============================================================
      //  BƯỚC 1: XỬ LÝ TỪNG TRANG (làm như card: raster + clip, KHÔNG resize)
      //  Object đã đúng kích thước (đã clip sẵn). Chỉ cần:
      //   1. Raster (làm phẳng thành hình).
      //   2. Clip lại về đúng khung của nó (như card).
      //  KHÔNG bóp/resize -> không méo.
      // ============================================================
      var processed = [];
      var sizeLog = "";
      for (var p = 0; p < pages.length; p++) {
        var item = pages[p];
        var s0 = sizeMM(item); // KT hiện tại (đã clip -> đọc khung clip)

        // Khung để raster = khung hiện tại của object (đã clip đúng KT)
        var frame = s0.b.slice(0); // [l,t,r,b]

        // Raster làm phẳng theo đúng khung (KHÔNG clip lại - object đã clip sẵn)
        var flat = dcFlattenForImposition(doc, item, frame, 400);

        // TĂNG kích thước lên đúng 21.1 x 29.9 (cách A - ép đúng số)
        var gb = flat.geometricBounds; // [l,t,r,b]
        var curW = (gb[2] - gb[0]) / MM,
          curH = (gb[1] - gb[3]) / MM;
        if (curW > 0 && curH > 0) {
          var sx = (PAGE_W / curW) * 100;
          var sy = (PAGE_H / curH) * 100;
          try {
            flat.resize(sx, sy);
          } catch (e) {}
        }

        if (p < 4)
          sizeLog +=
            "Trang " +
            (p + 1) +
            ": " +
            s0.w.toFixed(1) +
            " x " +
            s0.h.toFixed(1) +
            " -> " +
            PAGE_W +
            " x " +
            PAGE_H +
            " mm (A5)\n";
        processed.push(flat);
      }

      // ============================================================
      //  BƯỚC 2: TÍNH CẶP IMPOSITION
      //  Tờ i (0-based): mặt trước (N-2i, 1+2i), mặt sau (2+2i, N-1-2i)
      //  (số trang 1-based). Chuyển sang index 0-based khi lấy processed.
      // ============================================================
      var sheets = []; // mỗi phần tử: {front:[L,R], back:[L,R]} - số trang 1-based
      var numSheets = N / 4;
      for (var s = 0; s < numSheets; s++) {
        var frontL = N - 2 * s; // trái mặt trước
        var frontR = 1 + 2 * s; // phải mặt trước
        var backL = 2 + 2 * s; // trái mặt sau
        var backR = N - 1 - 2 * s; // phải mặt sau
        sheets.push({ front: [frontL, frontR], back: [backL, backR] });
      }

      // ============================================================
      //  BƯỚC 3: IMPORT PON + NHÂN BẢN ARTBOARD + DÀN + CĂN GIỮA
      //  - Pon: 1 artboard 43x32.5 + nội dung. Mỗi cụm 2 trang (1 mặt) vào
      //    giữa 1 artboard. Số cụm = số mặt = numSheets * 2.
      //  - Nhân bản pon + artboard thành (số cụm) cái, xếp 2 cột x nhiều hàng:
      //    [AB1][AB2] hàng 1 (tờ 1 trước|sau), [AB3][AB4] hàng 2 (tờ 2)...
      //  - Căn giữa từng cụm 2 trang vào giữa artboard tương ứng.
      // ============================================================
      var pb = processed[0].geometricBounds; // [l,t,r,b] - KT thật 1 trang
      var pageWpt = pb[2] - pb[0];
      var pageHpt = pb[1] - pb[3];
      var gapPt = GAP * MM;
      var spreadWpt = pageWpt * 2 + gapPt; // 1 hàng 2 trang A5 dọc = 29.9cm

      var numFaces = numSheets * 2; // số cụm 2 trang = số mặt (mỗi tờ 2 mặt)

      // ---- Import pon ----
      var ponFile = _ponGet();
      if (!ponFile) {
        alert("Chưa chọn file pon. Dừng.");
        return;
      }

      var destName = doc.name;
      var oldAbCount = doc.artboards.length;

      // mở pon, lấy artboard + object
      var ponDoc = app.open(ponFile);
      app.activeDocument = ponDoc;
      if (ponDoc.artboards.length === 0) {
        ponDoc.close(SaveOptions.DONOTSAVECHANGES);
        alert("File pon không có artboard.");
        return;
      }
      var ponAbRect = ponDoc.artboards[0].artboardRect.slice(0); // [l,t,r,b]
      var ponAbW = ponAbRect[2] - ponAbRect[0];
      var ponAbH = ponAbRect[1] - ponAbRect[3];

      // gom object pon thành 1 group để nhân bản
      app.activeDocument = doc;
      var destLayer = doc.activeLayer;
      app.activeDocument = ponDoc;
      var ponItems = [];
      for (var pi = 0; pi < ponDoc.pageItems.length; pi++)
        ponItems.push(ponDoc.pageItems[pi]);
      var ponGroupDup = null;
      // Offset của nội dung Pon so với tâm artboard gốc. Không giả định rằng
      // bounds của dấu Pon luôn nằm đúng tâm artboard (thường chúng không đối xứng).
      var ponOffsetX = 0,
        ponOffsetY = 0;
      if (ponItems.length > 0) {
        var ponGroup = ponDoc.groupItems.add();
        for (pi = ponItems.length - 1; pi >= 0; pi--) {
          try {
            ponItems[pi].move(ponGroup, ElementPlacement.PLACEATBEGINNING);
          } catch (e) {}
        }
        // vị trí gốc group pon (để tính offset khi nhân bản)
        // Lưu offset gốc trước khi đưa group sang document đích.
        try {
          var ponGb = ponGroup.geometricBounds;
          var ponGroupCx = (ponGb[0] + ponGb[2]) / 2;
          var ponGroupCy = (ponGb[1] + ponGb[3]) / 2;
          var ponAbCx = (ponAbRect[0] + ponAbRect[2]) / 2;
          var ponAbCy = (ponAbRect[1] + ponAbRect[3]) / 2;
          ponOffsetX = ponGroupCx - ponAbCx;
          ponOffsetY = ponGroupCy - ponAbCy;
        } catch (e) {}
        try {
          ponGroupDup = ponGroup.duplicate(
            destLayer,
            ElementPlacement.PLACEATEND,
          );
        } catch (e) {}
      }
      app.activeDocument = ponDoc;
      ponDoc.close(SaveOptions.DONOTSAVECHANGES);

      // tìm lại doc gốc
      var dd = null;
      for (var di = 0; di < app.documents.length; di++)
        if (app.documents[di].name === destName) {
          dd = app.documents[di];
          break;
        }
      if (dd) {
        doc = dd;
        app.activeDocument = doc;
      }
      // Quay về đúng document đã lưu tham chiếu từ đầu, không tìm bằng tên tab.
      // Tab mới có thể trùng tên hoặc Illustrator có thể tự đổi tên Untitled.
      app.activeDocument = doc;

      // ---- Vị trí các artboard nhân bản: 2 cột x tối đa 16 hàng mỗi KHỐI ----
      //  QUAN TRỌNG: dùng vị trí THẬT của pon sau khi duplicate vào file đích,
      //  KHÔNG dùng ponAbRect (tọa độ file pon) vì khác ruler origin -> lệch.
      //  Đo tâm pon thật -> suy ra vị trí artboard đầu tiên (pon nằm giữa AB).
      var startL, startT;
      if (ponGroupDup) {
        var pgb = ponGroupDup.geometricBounds; // [l,t,r,b] pon thật trong file đích
        var ponRealCx = (pgb[0] + pgb[2]) / 2;
        var ponRealCy = (pgb[1] + pgb[3]) / 2;
        // pon nằm ở tâm artboard + offset gốc -> tâm artboard = tâm pon - offset
        var ab0Cx = ponRealCx - ponOffsetX;
        var ab0Cy = ponRealCy - ponOffsetY;
        // vị trí trái/top của artboard đầu tiên
        startL = ab0Cx - ponAbW / 2;
        startT = ab0Cy + ponAbH / 2;
      } else {
        // không có pon -> dùng tọa độ file pon (dự phòng)
        startL = ponAbRect[0];
        startT = ponAbRect[1];
      }

      var MAX_ROWS = 12; // A5: cum cao 2 hang -> 1 cot chi 12 dong
      var blockWpt = ponAbW * 2; // 1 khối rộng = 2 cột artboard
      var abPositions = []; // [l,t,r,b] cho từng cụm (faceIndex)
      for (var fk = 0; fk < numFaces; fk++) {
        var sheetIdx = Math.floor(fk / 2); // tờ thứ mấy (0-based)
        var faceSide = fk % 2; // 0 = trước (cột trái), 1 = sau (cột phải)
        var blockNo = Math.floor(sheetIdx / MAX_ROWS); // khối thứ mấy
        var rowInBlock = sheetIdx % MAX_ROWS; // hàng trong khối
        var l = startL + blockNo * blockWpt + faceSide * ponAbW;
        var t = startT - rowInBlock * ponAbH;
        abPositions.push([l, t, l + ponAbW, t - ponAbH]);
      }

      // ---- Tạo artboard + nhân bản pon vào từng artboard ----
      //  artboard gốc (index 0 của doc) tạm để, ta thêm mới rồi xóa cũ sau.
      //  Với mỗi cụm: thêm artboard tại abPositions[k], nhân bản pon vào giữa AB.
      var ponGroups = []; // group pon đã nhân bản cho từng artboard
      for (var k = 0; k < numFaces; k++) {
        var pos = abPositions[k];
        // thêm artboard
        try {
          doc.artboards.add(pos);
        } catch (e) {}
        // nhân bản pon vào từng artboard, giữ đúng offset gốc của pon so với AB
        if (ponGroupDup) {
          var g;
          try {
            g = ponGroupDup.duplicate(
              doc.activeLayer,
              ElementPlacement.PLACEATEND,
            );
            var gb = g.geometricBounds;
            var gcx = (gb[0] + gb[2]) / 2,
              gcy = (gb[1] + gb[3]) / 2;
            var acx = (pos[0] + pos[2]) / 2,
              acy = (pos[1] + pos[3]) / 2;
            // đặt tâm pon = tâm artboard + offset gốc (giữ nội dung không đối xứng đúng chỗ)
            g.translate(acx + ponOffsetX - gcx, acy + ponOffsetY - gcy);
            ponGroups.push(g);
          } catch (e) {}
        }
      }
      // xóa pon gốc (bản duplicate đầu) + artboard cũ
      try {
        if (ponGroupDup) ponGroupDup.remove();
      } catch (e) {}
      // xóa các artboard cũ (index 0..oldAbCount-1)
      if (doc.artboards.length > numFaces) {
        for (var a2 = oldAbCount - 1; a2 >= 0; a2--) {
          try {
            doc.artboards.remove(a2);
          } catch (e) {}
        }
      }

      // ---- Dàn trang vào giữa từng artboard (cụm 2 trang / artboard) ----
      //  Thứ tự cụm (mặt): tờ 0 trước = AB0, tờ 0 sau = AB1, tờ 1 trước = AB2...
      //  faces[k] = cặp [L,R] trang của cụm k.
      var faces = [];
      for (var sf = 0; sf < numSheets; sf++) {
        faces.push(sheets[sf].front); // mặt trước
        faces.push(sheets[sf].back); // mặt sau
      }

      // đặt 1 cụm A5 dọc vào artboard: 2 trang HÀNG TRÊN + copy y hệt HÀNG DƯỚI,
      //  rồi GOM cả 4 trang thành 1 group (để bóp chiều cao sau). Trả về group.
      function placeFaceCentered(pair, pos) {
        var leftItem = processed[pair[0] - 1];
        var rightItem = processed[pair[1] - 1];
        var acx = (pos[0] + pos[2]) / 2,
          acy = (pos[1] + pos[3]) / 2;
        var cxL = acx - spreadWpt / 2 + pageWpt / 2;
        var cxR = acx - spreadWpt / 2 + pageWpt + gapPt + pageWpt / 2;
        var cyTop = acy + pageHpt / 2;
        var cyBot = acy - pageHpt / 2;

        var members = [];
        // hàng trên = bản gốc
        if (leftItem) {
          centerAt(leftItem, cxL, cyTop);
          members.push(leftItem);
        }
        if (rightItem) {
          centerAt(rightItem, cxR, cyTop);
          members.push(rightItem);
        }
        // hàng dưới = copy y hệt
        if (leftItem) {
          try {
            var ld = leftItem.duplicate(
              leftItem.layer,
              ElementPlacement.PLACEATEND,
            );
            centerAt(ld, cxL, cyBot);
            members.push(ld);
          } catch (e) {}
        }
        if (rightItem) {
          try {
            var rd = rightItem.duplicate(
              rightItem.layer,
              ElementPlacement.PLACEATEND,
            );
            centerAt(rd, cxR, cyBot);
            members.push(rd);
          } catch (e) {}
        }
        // gom 4 trang thành 1 group
        var grp = null;
        try {
          grp = doc.activeLayer.groupItems.add();
          for (var mi = 0; mi < members.length; mi++) {
            try {
              members[mi].move(grp, ElementPlacement.PLACEATEND);
            } catch (e) {}
          }
        } catch (e) {}
        return grp;
      }

      var faceGroups = []; // group 4 trang của từng cụm
      for (k = 0; k < faces.length; k++) {
        faceGroups[k] = placeFaceCentered(faces[k], abPositions[k]);
      }

      // ============================================================
      //  BƯỚC CUỐI (A5): BÓP CHIỀU NGANG cụm (KHÔNG đụng pon/artboard).
      //  Cụm rộng 29.9cm. Cặp artboard 1-2, 3-4... cùng mức giảm.
      //  Cụm 1-2 = 29.9cm; cụm 3-4 = 29.875cm; cụm 5-6 = 29.85cm...
      //  (giảm PAIR_REDUCTION mm mỗi cặp). Cao 42.2cm giữ nguyên.
      // ============================================================
      function squeezeGroupWidth(grp, faceIndex) {
        if (!grp) return;
        var b = grp.geometricBounds; // [l,t,r,b]
        var curW = b[2] - b[0];
        var cx = (b[0] + b[2]) / 2,
          cy = (b[1] + b[3]) / 2;
        // mức giảm theo cặp artboard (1-2, 3-4...)
        var pairIndex = Math.floor(faceIndex / 2);
        var reductionPt = pairIndex * PAIR_REDUCTION * MM;
        var targetW = curW - reductionPt;
        var scaleX = (targetW / curW) * 100;
        try {
          grp.resize(scaleX, 100);
        } catch (e) {} // chỉ co chiều ngang (X), cao giữ nguyên
        // giữ tâm cụm không đổi
        var b2 = grp.geometricBounds;
        var cx2 = (b2[0] + b2[2]) / 2,
          cy2 = (b2[1] + b2[3]) / 2;
        try {
          grp.translate(cx - cx2, cy - cy2);
        } catch (e) {}
      }

      for (k = 0; k < faceGroups.length; k++) {
        squeezeGroupWidth(faceGroups[k], k);
      }

      app.redraw();

      // ============================================================
      //  BƯỚC GHI CHÚ: hiện bảng nhập, điền chữ vào artboard lẻ.
      //  - AB index lẻ theo NGƯỜI DÙNG đếm từ 1: AB1=bìa, AB3=ruột1, AB5=ruột2...
      //    (tức index 0-based: 0=bìa, 2=ruột1, 4=ruột2...)
      //  - Font 13, đen. Vị trí: trên cụm 2 trang 0.2cm, cách mép TRÁI bài dàn 1cm.
      // ============================================================
      function showNoteDialog() {
        var w = new Window("dialog", "Nhập ghi chú");
        w.orientation = "column";
        w.alignChildren = "fill";
        w.margins = 16;
        w.spacing = 10;

        w.add("statictext", undefined, "Ghi chú BÌA (artboard 1):");
        var edBia = w.add("edittext", undefined, "");
        edBia.characters = 40;

        w.add(
          "statictext",
          undefined,
          "Ghi chú RUỘT (tự thêm 'RUỘT 1, RUỘT 2...'):",
        );
        var edRuot = w.add("edittext", undefined, "");
        edRuot.characters = 40;

        var row = w.add("group");
        row.alignment = "right";
        var btnCancel = row.add("button", undefined, "Bỏ qua", {
          name: "cancel",
        });
        var btnOK = row.add("button", undefined, "Điền ghi chú", {
          name: "ok",
        });

        var res = null;
        btnOK.onClick = function () {
          res = { bia: edBia.text, ruot: edRuot.text };
          w.close();
        };
        btnCancel.onClick = function () {
          res = null;
          w.close();
        };
        w.show();
        return res;
      }

      // Tạo ghi chú dọc: bên phải cụm 2mm, từ mép trên cụm đi xuống 1cm.
      function addNote(text, pos, faceIndex) {
        if (!text) return;
        try {
          var lay = doc.activeLayer;
          var tf = lay.textFrames.add();
          tf.contents = text;
          try {
            tf.textRange.characterAttributes.size = 13;
          } catch (e) {}
          // màu đen
          try {
            var black = new CMYKColor();
            black.black = 100;
            tf.textRange.characterAttributes.fillColor = black;
          } catch (e) {
            try {
              var rgb = new RGBColor();
              rgb.red = 0;
              rgb.green = 0;
              rgb.blue = 0;
              tf.textRange.characterAttributes.fillColor = rgb;
            } catch (e2) {}
          }
          // A5: ghi chú BÊN PHẢI cụm +2mm, từ mép trên cụm đi xuống 1cm, chữ dọc.
          //  Cụm A5 dọc cao 2*pageHpt (42.2), rộng spreadWpt (29.9), nằm giữa artboard.
          var acx = (pos[0] + pos[2]) / 2,
            acy = (pos[1] + pos[3]) / 2;
          var cumH = pageHpt * 2; // chiều cao cụm A5 dọc = 42.2cm
          var pairIndex = Math.floor(faceIndex / 2);
          var squeezedSpreadWpt = spreadWpt - pairIndex * PAIR_REDUCTION * MM;
          var rightCum = acx + squeezedSpreadWpt / 2; // mép phải cụm sau khi bóp ngang
          var topCum = acy + cumH / 2; // mép trên cụm
          var targetLeft = rightCum + 2 * MM; // mép trái chữ: phải cụm 2mm
          var targetTop = topCum - 10 * MM; // mép trên chữ: từ trên xuống 1cm

          // Xoay trước rồi mới đặt theo bounds thực. Nếu đặt trước rồi xoay,
          // Illustrator xoay quanh điểm neo và làm chữ văng sang phải/lên trên.
          tf.position = [0, 0];
          try {
            tf.rotate(-90);
          } catch (e) {}
          var tb = tf.visibleBounds;
          tf.translate(targetLeft - tb[0], targetTop - tb[1]);
        } catch (e) {}
      }

      var note = showNoteDialog();
      if (note) {
        // điền vào các artboard index chẵn 0-based (0=bìa, 2=ruột1, 4=ruột2...)
        var ruotNo = 0;
        for (var ab = 0; ab < abPositions.length; ab += 2) {
          var pos = abPositions[ab];
          if (ab === 0) {
            addNote(note.bia, pos, ab); // bìa
          } else {
            ruotNo++;
            var t = "RUỘT " + ruotNo + (note.ruot ? " " + note.ruot : "");
            addNote(t, pos, ab);
          }
        }
        app.redraw();
      }
    })();
    return "OK: \u0110\u00e3 ch\u1ea1y d\u00e0n catalogue A5.";
  } catch (e) {
    return "ERR: catalogue A5: " + e.toString();
  }
}

// ============================================================
//  CATALOGUE KHỔ TÙY CHỈNH kiểu A4 (nhỏ hơn A4). 1 file = 1 cuốn.
//  Nhập kích thước đích (cm), dàn giống A4. Nhớ pon theo từng khổ.
// ============================================================
function dcRunCatalogueCustom(wCm, hCm) {
  try {
    // ============================================================
    //  CATALOGUE KHỔ TÙY CHỈNH (nhỏ hơn A4). Giống A4, chỉ khác kích thước.
    //  Kích thước đích lấy từ tham số panel (wCm, hCm - cm). Nếu không có
    //  tham số hợp lệ thì mở dialog nhập (để chạy được khi test file lẻ).
    // ============================================================

    (function (wCm, hCm) {
      var MM = 2.834645669; // pt per mm

      // ---- BẢNG NHẬP KÍCH THƯỚC ĐÍCH (cm) - chỉ dùng khi không có tham số ----
      function showSizeDialog() {
        var w = new Window("dialog", "Kich thuoc trang dich (cm)");
        w.orientation = "column";
        w.alignChildren = "fill";
        w.margins = 16;
        w.spacing = 10;

        w.add(
          "statictext",
          undefined,
          "Nhap kich thuoc MOI trang SAU khi phong to (cm).",
        );
        w.add(
          "statictext",
          undefined,
          "Vi du: trang goc 14.7 x 26.7 -> nhap 14.9 x 26.9",
        );

        var rowW = w.add("group");
        rowW.add("statictext", undefined, "Rong (cm):");
        var edW = rowW.add("edittext", undefined, "");
        edW.characters = 8;

        var rowH = w.add("group");
        rowH.add("statictext", undefined, "Cao  (cm):");
        var edH = rowH.add("edittext", undefined, "");
        edH.characters = 8;

        var row = w.add("group");
        row.alignment = "right";
        var btnCancel = row.add("button", undefined, "Bo qua", {
          name: "cancel",
        });
        var btnOK = row.add("button", undefined, "Dan", { name: "ok" });

        var res = null;
        btnOK.onClick = function () {
          var cw = parseFloat(String(edW.text).replace(",", "."));
          var ch = parseFloat(String(edH.text).replace(",", "."));
          if (isNaN(cw) || isNaN(ch) || cw <= 0 || ch <= 0) {
            alert("Kich thuoc khong hop le. Nhap so > 0 (vi du 14.9).");
            return;
          }
          // cm -> mm
          res = { w: cw * 10, h: ch * 10 };
          w.close();
        };
        btnCancel.onClick = function () {
          res = null;
          w.close();
        };
        w.show();
        return res;
      }

      // Ưu tiên tham số từ panel; không hợp lệ thì mở dialog.
      var _sizeInput = null;
      var _pw = parseFloat(String(wCm).replace(",", "."));
      var _ph = parseFloat(String(hCm).replace(",", "."));
      if (!isNaN(_pw) && !isNaN(_ph) && _pw > 0 && _ph > 0) {
        _sizeInput = { w: _pw * 10, h: _ph * 10 }; // cm -> mm
      } else {
        _sizeInput = showSizeDialog();
      }
      if (!_sizeInput) {
        return;
      } // bỏ qua

      // Kích thước trang sau khi phóng to (mm)
      var PAGE_W = _sizeInput.w;
      var PAGE_H = _sizeInput.h;

      // Chỉ dùng ở BƯỚC CUỐI: giảm tổng ngang của mỗi cụm 2 trang.
      var PAIR_REDUCTION = 0.25; // mm cho mỗi cụm tiếp theo (= 0.025cm)
      var GAP = 0; // mm - khe giữa 2 trang trên 1 tờ

      // ---- Cấu hình pon: NHỚ THEO TỪNG KÍCH THƯỚC ----
      //  Mỗi khổ (rộng x cao) nhớ 1 file pon riêng. Đã làm khổ này rồi thì
      //  KHÔNG hỏi link lại; khổ mới -> hỏi 1 lần rồi nhớ luôn.
      //  Lưu trong 1 file, mỗi dòng: "rongxcao<TAB>duong_dan" (TAB separator).
      //  Key kích thước = làm tròn 0.1mm để khớp ổn định.
      function _ponMemoFile() {
        return new File(Folder.userData + "/dan_catalogue_pon_custom.txt");
      }
      function _sizeKey() {
        // dùng PAGE_W/PAGE_H (mm) làm khóa, ví dụ "149.0x269.0"
        return (
          Math.round(PAGE_W * 10) / 10 + "x" + Math.round(PAGE_H * 10) / 10
        );
      }
      // Đọc toàn bộ bảng nhớ -> mảng { key, path }
      function _ponReadAll() {
        var list = [];
        var f = _ponMemoFile();
        if (f.exists) {
          f.encoding = "UTF-8";
          f.open("r");
          var all = f.read();
          f.close();
          var lines = all.split(/\r\n|\r|\n/);
          for (var i = 0; i < lines.length; i++) {
            var ln = lines[i];
            if (!ln || ln.charAt(0) === "#") continue;
            var tab = ln.indexOf("\t");
            if (tab < 0) continue;
            var key = ln.substring(0, tab).replace(/^\s+|\s+$/g, "");
            var pth = ln.substring(tab + 1).replace(/^\s+|\s+$/g, "");
            if (key && pth) list.push({ key: key, path: pth });
          }
        }
        return list;
      }
      // Lấy path đã nhớ cho kích thước hiện tại (hoặc null)
      function _ponReadForSize() {
        var list = _ponReadAll();
        var key = _sizeKey();
        for (var i = 0; i < list.length; i++)
          if (list[i].key === key) return list[i].path;
        return null;
      }
      // Ghi/cập nhật path cho kích thước hiện tại (giữ nguyên các khổ khác)
      function _ponWriteForSize(path) {
        var list = _ponReadAll();
        var key = _sizeKey();
        var found = false;
        for (var i = 0; i < list.length; i++) {
          if (list[i].key === key) {
            list[i].path = path;
            found = true;
            break;
          }
        }
        if (!found) list.push({ key: key, path: path });
        var out =
          "# Bo nho pon catalogue theo kich thuoc: rongxcao<TAB>duong_dan\n";
        for (i = 0; i < list.length; i++)
          out += list[i].key + "\t" + list[i].path + "\n";
        var f = _ponMemoFile();
        try {
          f.encoding = "UTF-8";
          f.open("w");
          f.write(out);
          f.close();
        } catch (e) {}
      }
      function _ponGet() {
        // Đã từng làm khổ này -> dùng lại luôn, không hỏi.
        var saved = _ponReadForSize();
        if (saved) {
          var f = new File(saved);
          if (f.exists) return f;
        }
        // Khổ mới (hoặc file cũ đã mất) -> hỏi 1 lần rồi nhớ theo khổ.
        var chosen = File.openDialog(
          "Chon file pon cho kho " +
            _sizeKey() +
            " mm (.ai) - chi hoi 1 lan cho kho nay",
          "*.ai",
        );
        if (chosen && chosen.exists) {
          _ponWriteForSize(chosen.fsName);
          return chosen;
        }
        return null;
      }

      if (app.documents.length === 0) {
        alert("Chua mo tai lieu.");
        return;
      }
      var doc = app.activeDocument;
      var sel = doc.selection;
      if (!sel || sel.length === 0) {
        alert("Chua chon object nao.");
        return;
      }

      var N = sel.length;
      if (N % 4 !== 0) {
        alert("So trang phai la BOI SO CUA 4.\nDang chon: " + N + " trang.");
        return;
      }

      // ---- Gom object và sắp theo VỊ TRÍ (trái→phải, trên→dưới) ----
      var pages = [];
      var selectionLeft = null,
        selectionTop = null,
        selectionRight = null,
        selectionBottom = null;
      for (var i = 0; i < sel.length; i++) {
        var it = sel[i];
        var b;
        try {
          b = it.visibleBounds;
        } catch (e) {
          b = it.geometricBounds;
        }
        pages.push({ item: it, left: b[0], top: b[1] });
        if (selectionLeft === null) {
          selectionLeft = b[0];
          selectionTop = b[1];
          selectionRight = b[2];
          selectionBottom = b[3];
        } else {
          selectionLeft = Math.min(selectionLeft, b[0]);
          selectionTop = Math.max(selectionTop, b[1]);
          selectionRight = Math.max(selectionRight, b[2]);
          selectionBottom = Math.min(selectionBottom, b[3]);
        }
      }
      pages.sort(function (a, b) {
        var dy = b.top - a.top;
        if (Math.abs(dy) > 50 * MM) return dy;
        return a.left - b.left;
      });
      var pageItems = [];
      for (i = 0; i < pages.length; i++) pageItems.push(pages[i].item);
      pages = pageItems; // pages[0] = trang 1

      // ============================================================
      //  HELPER
      // ============================================================
      function clipMaskBounds(item) {
        try {
          if (item.typename === "GroupItem" && item.clipped === true) {
            var pit = item.pageItems;
            for (var i = 0; i < pit.length; i++) {
              var isc = false;
              try {
                isc = pit[i].clipping === true;
              } catch (e) {}
              if (isc) return pit[i].geometricBounds;
            }
          }
        } catch (e) {}
        return null;
      }
      function sizeMM(item) {
        var mb = clipMaskBounds(item);
        if (mb)
          return { w: (mb[2] - mb[0]) / MM, h: (mb[1] - mb[3]) / MM, b: mb };
        var acc = { val: null };
        visibleUnion(item, acc);
        var g = acc.val;
        if (!g) {
          try {
            g = item.visibleBounds;
          } catch (e) {
            try {
              g = item.geometricBounds;
            } catch (e2) {
              g = null;
            }
          }
        }
        if (!g) return { w: 0, h: 0, b: [0, 0, 0, 0] };
        return { w: (g[2] - g[0]) / MM, h: (g[1] - g[3]) / MM, b: g };
      }

      function isVisibleLeaf(it) {
        try {
          if (it.hidden === true) return false;
          if (it.guides === true) return false;
        } catch (e) {}
        try {
          if (it.typename === "PathItem")
            return it.filled === true || it.stroked === true;
          if (it.typename === "CompoundPathItem") {
            if (it.pathItems.length > 0) {
              var p0 = it.pathItems[0];
              return p0.filled === true || p0.stroked === true;
            }
            return false;
          }
        } catch (e) {}
        return true;
      }

      function visibleUnion(item, acc) {
        function merge(b) {
          if (!b) return;
          if (!acc.val) {
            acc.val = b.slice(0);
            return;
          }
          var a = acc.val;
          if (b[0] < a[0]) a[0] = b[0];
          if (b[1] > a[1]) a[1] = b[1];
          if (b[2] > a[2]) a[2] = b[2];
          if (b[3] < a[3]) a[3] = b[3];
        }
        var _tn;
        try {
          _tn = item.typename;
        } catch (e) {
          return;
        }
        if (_tn === "GroupItem") {
          var clipped = false;
          try {
            clipped = item.clipped;
          } catch (e) {}
          if (clipped) {
            var pit = item.pageItems;
            var maskB = null;
            for (var i = 0; i < pit.length; i++) {
              var isc = false;
              try {
                isc = pit[i].clipping === true;
              } catch (e) {}
              if (isc) {
                maskB = pit[i].geometricBounds;
                break;
              }
            }
            var inner = { val: null };
            for (i = 0; i < pit.length; i++) {
              var isMask = false;
              try {
                isMask = pit[i].clipping === true;
              } catch (e) {}
              if (isMask) continue;
              visibleUnion(pit[i], inner);
            }
            var res = inner.val;
            if (res && maskB) {
              var gx0 = Math.max(res[0], maskB[0]);
              var gy1 = Math.min(res[1], maskB[1]);
              var gx2 = Math.min(res[2], maskB[2]);
              var gy3 = Math.max(res[3], maskB[3]);
              if (gx2 > gx0 && gy1 > gy3) merge([gx0, gy1, gx2, gy3]);
              else merge(maskB);
            } else if (res) {
              merge(res);
            } else if (maskB) {
              merge(maskB);
            }
            return;
          }
          var pit2 = item.pageItems;
          for (var j = 0; j < pit2.length; j++) visibleUnion(pit2[j], acc);
          return;
        }
        if (isVisibleLeaf(item)) {
          try {
            merge(item.visibleBounds);
          } catch (e) {}
        }
      }

      function centerAt(item, cxPt, cyPt) {
        var s = sizeMM(item);
        var curCx = (s.b[0] + s.b[2]) / 2,
          curCy = (s.b[1] + s.b[3]) / 2;
        item.translate(cxPt - curCx, cyPt - curCy);
      }

      // ============================================================
      //  BƯỚC 1: XỬ LÝ TỪNG TRANG (raster + phóng về PAGE_W x PAGE_H)
      // ============================================================
      var processed = [];
      var sizeLog = "";
      for (var p = 0; p < pages.length; p++) {
        var item = pages[p];
        var s0 = sizeMM(item);
        var frame = s0.b.slice(0);

        var flat = dcFlattenForImposition(doc, item, frame, 400);

        // Phóng lên đúng PAGE_W x PAGE_H (cách A - ép đúng số, không méo với raster)
        var gb = flat.geometricBounds;
        var curW = (gb[2] - gb[0]) / MM,
          curH = (gb[1] - gb[3]) / MM;
        if (curW > 0 && curH > 0) {
          var sx = (PAGE_W / curW) * 100;
          var sy = (PAGE_H / curH) * 100;
          try {
            flat.resize(sx, sy);
          } catch (e) {}
        }

        if (p < 4)
          sizeLog +=
            "Trang " +
            (p + 1) +
            ": " +
            s0.w.toFixed(1) +
            " x " +
            s0.h.toFixed(1) +
            " -> " +
            PAGE_W +
            " x " +
            PAGE_H +
            " mm\n";
        processed.push(flat);
      }

      // ============================================================
      //  BƯỚC 2: TÍNH CẶP IMPOSITION
      // ============================================================
      var sheets = [];
      var numSheets = N / 4;
      for (var s = 0; s < numSheets; s++) {
        var frontL = N - 2 * s;
        var frontR = 1 + 2 * s;
        var backL = 2 + 2 * s;
        var backR = N - 1 - 2 * s;
        sheets.push({ front: [frontL, frontR], back: [backL, backR] });
      }

      // ============================================================
      //  BƯỚC 3: IMPORT PON + NHÂN BẢN ARTBOARD + DÀN + CĂN GIỮA
      // ============================================================
      var pb = processed[0].geometricBounds;
      var pageWpt = pb[2] - pb[0];
      var pageHpt = pb[1] - pb[3];
      var gapPt = GAP * MM;
      var spreadWpt = pageWpt * 2 + gapPt;

      var numFaces = numSheets * 2;

      var ponFile = _ponGet();
      if (!ponFile) {
        alert("Chua chon file pon. Dung.");
        return;
      }

      var destName = doc.name;
      var oldAbCount = doc.artboards.length;

      var ponDoc = app.open(ponFile);
      app.activeDocument = ponDoc;
      if (ponDoc.artboards.length === 0) {
        ponDoc.close(SaveOptions.DONOTSAVECHANGES);
        alert("File pon khong co artboard.");
        return;
      }
      var ponAbRect = ponDoc.artboards[0].artboardRect.slice(0);
      var ponAbW = ponAbRect[2] - ponAbRect[0];
      var ponAbH = ponAbRect[1] - ponAbRect[3];

      app.activeDocument = doc;
      var destLayer = doc.activeLayer;
      app.activeDocument = ponDoc;
      var ponItems = [];
      for (var pi = 0; pi < ponDoc.pageItems.length; pi++)
        ponItems.push(ponDoc.pageItems[pi]);
      var ponGroupDup = null;
      var ponOffsetX = 0,
        ponOffsetY = 0;
      if (ponItems.length > 0) {
        var ponGroup = ponDoc.groupItems.add();
        for (pi = ponItems.length - 1; pi >= 0; pi--) {
          try {
            ponItems[pi].move(ponGroup, ElementPlacement.PLACEATBEGINNING);
          } catch (e) {}
        }
        try {
          var ponGb = ponGroup.geometricBounds;
          var ponGroupCx = (ponGb[0] + ponGb[2]) / 2;
          var ponGroupCy = (ponGb[1] + ponGb[3]) / 2;
          var ponAbCx = (ponAbRect[0] + ponAbRect[2]) / 2;
          var ponAbCy = (ponAbRect[1] + ponAbRect[3]) / 2;
          ponOffsetX = ponGroupCx - ponAbCx;
          ponOffsetY = ponGroupCy - ponAbCy;
        } catch (e) {}
        try {
          ponGroupDup = ponGroup.duplicate(
            destLayer,
            ElementPlacement.PLACEATEND,
          );
        } catch (e) {}
      }
      app.activeDocument = ponDoc;
      ponDoc.close(SaveOptions.DONOTSAVECHANGES);

      var dd = null;
      for (var di = 0; di < app.documents.length; di++)
        if (app.documents[di].name === destName) {
          dd = app.documents[di];
          break;
        }
      if (dd) {
        doc = dd;
        app.activeDocument = doc;
      }
      app.activeDocument = doc;

      var startL, startT;
      if (ponGroupDup) {
        var pgb = ponGroupDup.geometricBounds;
        var ponRealCx = (pgb[0] + pgb[2]) / 2;
        var ponRealCy = (pgb[1] + pgb[3]) / 2;
        var ab0Cx = ponRealCx - ponOffsetX;
        var ab0Cy = ponRealCy - ponOffsetY;
        startL = ab0Cx - ponAbW / 2;
        startT = ab0Cy + ponAbH / 2;
      } else {
        startL = ponAbRect[0];
        startT = ponAbRect[1];
      }

      var MAX_ROWS = 16;
      var blockWpt = ponAbW * 2;
      var abPositions = [];
      for (var fk = 0; fk < numFaces; fk++) {
        var sheetIdx = Math.floor(fk / 2);
        var faceSide = fk % 2;
        var blockNo = Math.floor(sheetIdx / MAX_ROWS);
        var rowInBlock = sheetIdx % MAX_ROWS;
        var l = startL + blockNo * blockWpt + faceSide * ponAbW;
        var t = startT - rowInBlock * ponAbH;
        abPositions.push([l, t, l + ponAbW, t - ponAbH]);
      }

      var ponGroups = [];
      for (var k = 0; k < numFaces; k++) {
        var pos = abPositions[k];
        try {
          doc.artboards.add(pos);
        } catch (e) {}
        if (ponGroupDup) {
          var g;
          try {
            g = ponGroupDup.duplicate(
              doc.activeLayer,
              ElementPlacement.PLACEATEND,
            );
            var gb = g.geometricBounds;
            var gcx = (gb[0] + gb[2]) / 2,
              gcy = (gb[1] + gb[3]) / 2;
            var acx = (pos[0] + pos[2]) / 2,
              acy = (pos[1] + pos[3]) / 2;
            g.translate(acx + ponOffsetX - gcx, acy + ponOffsetY - gcy);
            ponGroups.push(g);
          } catch (e) {}
        }
      }
      try {
        if (ponGroupDup) ponGroupDup.remove();
      } catch (e) {}
      if (doc.artboards.length > numFaces) {
        for (var a2 = oldAbCount - 1; a2 >= 0; a2--) {
          try {
            doc.artboards.remove(a2);
          } catch (e) {}
        }
      }

      var faces = [];
      for (var sf = 0; sf < numSheets; sf++) {
        faces.push(sheets[sf].front);
        faces.push(sheets[sf].back);
      }

      function placeFaceCentered(pair, pos) {
        var leftItem = processed[pair[0] - 1];
        var rightItem = processed[pair[1] - 1];
        var acx = (pos[0] + pos[2]) / 2,
          acy = (pos[1] + pos[3]) / 2;
        var cxL = acx - spreadWpt / 2 + pageWpt / 2;
        var cxR = acx - spreadWpt / 2 + pageWpt + gapPt + pageWpt / 2;
        var cy = acy;
        if (leftItem) centerAt(leftItem, cxL, cy);
        if (rightItem) centerAt(rightItem, cxR, cy);
      }

      for (k = 0; k < faces.length; k++) {
        placeFaceCentered(faces[k], abPositions[k]);
      }

      // ============================================================
      //  BƯỚC CUỐI: BÓP NGANG CỤM ĐÃ DÀN
      // ============================================================
      function squeezePlacedFace(pair, faceIndex) {
        var leftItem = processed[pair[0] - 1];
        var rightItem = processed[pair[1] - 1];
        if (!leftItem || !rightItem) return;

        var leftBefore = sizeMM(leftItem);
        var rightBefore = sizeMM(rightItem);
        var faceCx = (leftBefore.b[0] + rightBefore.b[2]) / 2;
        var leftCy = (leftBefore.b[1] + leftBefore.b[3]) / 2;
        var rightCy = (rightBefore.b[1] + rightBefore.b[3]) / 2;

        var artboardPairIndex = Math.floor(faceIndex / 2);
        var reductionPt = artboardPairIndex * PAIR_REDUCTION * MM;
        var targetPageWpt = pageWpt - reductionPt / 2;
        var scaleX = (targetPageWpt / pageWpt) * 100;
        try {
          leftItem.resize(scaleX, 100);
        } catch (e) {}
        try {
          rightItem.resize(scaleX, 100);
        } catch (e) {}

        var targetSpreadWpt = targetPageWpt * 2 + gapPt;
        var leftCx = faceCx - targetSpreadWpt / 2 + targetPageWpt / 2;
        var rightCx =
          faceCx -
          targetSpreadWpt / 2 +
          targetPageWpt +
          gapPt +
          targetPageWpt / 2;
        centerAt(leftItem, leftCx, leftCy);
        centerAt(rightItem, rightCx, rightCy);
      }

      for (k = 0; k < faces.length; k++) {
        squeezePlacedFace(faces[k], k);
      }

      app.redraw();

      // ============================================================
      //  BƯỚC GHI CHÚ
      // ============================================================
      function showNoteDialog() {
        var w = new Window("dialog", "Nhap ghi chu");
        w.orientation = "column";
        w.alignChildren = "fill";
        w.margins = 16;
        w.spacing = 10;

        w.add("statictext", undefined, "Ghi chu BIA (artboard 1):");
        var edBia = w.add("edittext", undefined, "");
        edBia.characters = 40;

        w.add(
          "statictext",
          undefined,
          "Ghi chu RUOT (tu them 'RUOT 1, RUOT 2...'):",
        );
        var edRuot = w.add("edittext", undefined, "");
        edRuot.characters = 40;

        var row = w.add("group");
        row.alignment = "right";
        var btnCancel = row.add("button", undefined, "Bo qua", {
          name: "cancel",
        });
        var btnOK = row.add("button", undefined, "Dien ghi chu", {
          name: "ok",
        });

        var res = null;
        btnOK.onClick = function () {
          res = { bia: edBia.text, ruot: edRuot.text };
          w.close();
        };
        btnCancel.onClick = function () {
          res = null;
          w.close();
        };
        w.show();
        return res;
      }

      function addNote(text, pos) {
        if (!text) return;
        try {
          var lay = doc.activeLayer;
          var tf = lay.textFrames.add();
          tf.contents = text;
          try {
            tf.textRange.characterAttributes.size = 13;
          } catch (e) {}
          try {
            var black = new CMYKColor();
            black.black = 100;
            tf.textRange.characterAttributes.fillColor = black;
          } catch (e) {
            try {
              var rgb = new RGBColor();
              rgb.red = 0;
              rgb.green = 0;
              rgb.blue = 0;
              tf.textRange.characterAttributes.fillColor = rgb;
            } catch (e2) {}
          }
          var acy = (pos[1] + pos[3]) / 2;
          var topCum = acy + pageHpt / 2;
          var x = pos[0] + 10 * MM;
          var y = topCum + 2 * MM + 4 * MM;
          tf.position = [x, y];
        } catch (e) {}
      }

      var note = showNoteDialog();
      if (note) {
        var ruotNo = 0;
        for (var ab = 0; ab < abPositions.length; ab += 2) {
          var pos = abPositions[ab];
          if (ab === 0) {
            addNote(note.bia, pos);
          } else {
            ruotNo++;
            var t = "RUOT " + ruotNo + (note.ruot ? " " + note.ruot : "");
            addNote(t, pos);
          }
        }
        app.redraw();
      }
    })(wCm, hCm);
    return "OK: \u0110\u00e3 ch\u1ea1y d\u00e0n catalogue kh\u1ed5 t\u00f9y ch\u1ec9nh.";
  } catch (e) {
    return "ERR: catalogue custom: " + e.toString();
  }
}

// ============================================================
//  CATALOGUE KHỔ TÙY CHỈNH kiểu A5 (2 con 1 tờ, nhỏ hơn A5).
//  Nhập kích thước 1 trang (cm), dàn giống A5. Nhớ pon theo từng khổ.
// ============================================================
function dcRunCatalogueCustomA5(wCm, hCm) {
  try {
    // ============================================================
    //  CATALOGUE KHỔ TÙY CHỈNH kiểu A5 (2 CON 1 TỜ, nhỏ hơn A5).
    //  Kích thước 1 trang lấy từ tham số panel (wCm, hCm - cm). Không có
    //  tham số hợp lệ thì mở dialog (để chạy được khi test file lẻ).
    // ============================================================

    (function (wCm, hCm) {
      var MM = 2.834645669; // pt per mm

      // ---- BẢNG NHẬP KÍCH THƯỚC ĐÍCH (cm) - chỉ dùng khi không có tham số ----
      function showSizeDialog() {
        var w = new Window("dialog", "Kich thuoc 1 trang dich (cm)");
        w.orientation = "column";
        w.alignChildren = "fill";
        w.margins = 16;
        w.spacing = 10;

        w.add(
          "statictext",
          undefined,
          "Nhap kich thuoc MOI 1 trang SAU khi phong to (cm).",
        );
        w.add(
          "statictext",
          undefined,
          "Se dan 2 con 1 to (2 trang tren + copy xuong duoi).",
        );

        var rowW = w.add("group");
        rowW.add("statictext", undefined, "Rong (cm):");
        var edW = rowW.add("edittext", undefined, "");
        edW.characters = 8;

        var rowH = w.add("group");
        rowH.add("statictext", undefined, "Cao  (cm):");
        var edH = rowH.add("edittext", undefined, "");
        edH.characters = 8;

        var row = w.add("group");
        row.alignment = "right";
        var btnCancel = row.add("button", undefined, "Bo qua", {
          name: "cancel",
        });
        var btnOK = row.add("button", undefined, "Dan", { name: "ok" });

        var res = null;
        btnOK.onClick = function () {
          var cw = parseFloat(String(edW.text).replace(",", "."));
          var ch = parseFloat(String(edH.text).replace(",", "."));
          if (isNaN(cw) || isNaN(ch) || cw <= 0 || ch <= 0) {
            alert("Kich thuoc khong hop le. Nhap so > 0 (vi du 12.5).");
            return;
          }
          res = { w: cw * 10, h: ch * 10 }; // cm -> mm
          w.close();
        };
        btnCancel.onClick = function () {
          res = null;
          w.close();
        };
        w.show();
        return res;
      }

      // Ưu tiên tham số từ panel; không hợp lệ thì mở dialog.
      var _sizeInput = null;
      var _pw = parseFloat(String(wCm).replace(",", "."));
      var _ph = parseFloat(String(hCm).replace(",", "."));
      if (!isNaN(_pw) && !isNaN(_ph) && _pw > 0 && _ph > 0) {
        _sizeInput = { w: _pw * 10, h: _ph * 10 }; // cm -> mm
      } else {
        _sizeInput = showSizeDialog();
      }
      if (!_sizeInput) {
        return;
      }

      var PAGE_W = _sizeInput.w; // mm - 1 trang sau phóng to
      var PAGE_H = _sizeInput.h; // mm

      var PAIR_REDUCTION = 0.25; // mm giảm ngang mỗi cặp artboard
      var GAP = 0; // mm - khe giữa 2 trang trên 1 hàng

      // ---- Cấu hình pon: NHỚ THEO TỪNG KÍCH THƯỚC (kiểu A5) ----
      //  File nhớ riêng cho bản A5-custom, không đụng bản A4-custom.
      function _ponMemoFile() {
        return new File(Folder.userData + "/dan_catalogue_pon_custom_A5.txt");
      }
      function _sizeKey() {
        return (
          Math.round(PAGE_W * 10) / 10 + "x" + Math.round(PAGE_H * 10) / 10
        );
      }
      function _ponReadAll() {
        var list = [];
        var f = _ponMemoFile();
        if (f.exists) {
          f.encoding = "UTF-8";
          f.open("r");
          var all = f.read();
          f.close();
          var lines = all.split(/\r\n|\r|\n/);
          for (var i = 0; i < lines.length; i++) {
            var ln = lines[i];
            if (!ln || ln.charAt(0) === "#") continue;
            var tab = ln.indexOf("\t");
            if (tab < 0) continue;
            var key = ln.substring(0, tab).replace(/^\s+|\s+$/g, "");
            var pth = ln.substring(tab + 1).replace(/^\s+|\s+$/g, "");
            if (key && pth) list.push({ key: key, path: pth });
          }
        }
        return list;
      }
      function _ponReadForSize() {
        var list = _ponReadAll();
        var key = _sizeKey();
        for (var i = 0; i < list.length; i++)
          if (list[i].key === key) return list[i].path;
        return null;
      }
      function _ponWriteForSize(path) {
        var list = _ponReadAll();
        var key = _sizeKey();
        var found = false;
        for (var i = 0; i < list.length; i++) {
          if (list[i].key === key) {
            list[i].path = path;
            found = true;
            break;
          }
        }
        if (!found) list.push({ key: key, path: path });
        var out =
          "# Bo nho pon catalogue A5-custom theo kich thuoc: rongxcao<TAB>duong_dan\n";
        for (i = 0; i < list.length; i++)
          out += list[i].key + "\t" + list[i].path + "\n";
        var f = _ponMemoFile();
        try {
          f.encoding = "UTF-8";
          f.open("w");
          f.write(out);
          f.close();
        } catch (e) {}
      }
      function _ponGet() {
        var saved = _ponReadForSize();
        if (saved) {
          var f = new File(saved);
          if (f.exists) return f;
        }
        var chosen = File.openDialog(
          "Chon file pon cho kho " +
            _sizeKey() +
            " mm (.ai) - chi hoi 1 lan cho kho nay",
          "*.ai",
        );
        if (chosen && chosen.exists) {
          _ponWriteForSize(chosen.fsName);
          return chosen;
        }
        return null;
      }

      if (app.documents.length === 0) {
        alert("Chua mo tai lieu.");
        return;
      }
      var doc = app.activeDocument;
      var sel = doc.selection;
      if (!sel || sel.length === 0) {
        alert("Chua chon object nao.");
        return;
      }

      var N = sel.length;
      if (N % 4 !== 0) {
        alert("So trang phai la BOI SO CUA 4.\nDang chon: " + N + " trang.");
        return;
      }

      // ---- Gom object và sắp theo VỊ TRÍ ----
      var pages = [];
      for (var i = 0; i < sel.length; i++) {
        var it = sel[i];
        var b;
        try {
          b = it.visibleBounds;
        } catch (e) {
          b = it.geometricBounds;
        }
        pages.push({ item: it, left: b[0], top: b[1] });
      }
      pages.sort(function (a, b) {
        var dy = b.top - a.top;
        if (Math.abs(dy) > 50 * MM) return dy;
        return a.left - b.left;
      });
      var pageItems = [];
      for (i = 0; i < pages.length; i++) pageItems.push(pages[i].item);
      pages = pageItems;

      // ============================================================
      //  HELPER (giống A4/A5)
      // ============================================================
      function clipMaskBounds(item) {
        try {
          if (item.typename === "GroupItem" && item.clipped === true) {
            var pit = item.pageItems;
            for (var i = 0; i < pit.length; i++) {
              var isc = false;
              try {
                isc = pit[i].clipping === true;
              } catch (e) {}
              if (isc) return pit[i].geometricBounds;
            }
          }
        } catch (e) {}
        return null;
      }
      function sizeMM(item) {
        var mb = clipMaskBounds(item);
        if (mb)
          return { w: (mb[2] - mb[0]) / MM, h: (mb[1] - mb[3]) / MM, b: mb };
        var acc = { val: null };
        visibleUnion(item, acc);
        var g = acc.val;
        if (!g) {
          try {
            g = item.visibleBounds;
          } catch (e) {
            try {
              g = item.geometricBounds;
            } catch (e2) {
              g = null;
            }
          }
        }
        if (!g) return { w: 0, h: 0, b: [0, 0, 0, 0] };
        return { w: (g[2] - g[0]) / MM, h: (g[1] - g[3]) / MM, b: g };
      }
      function isVisibleLeaf(it) {
        try {
          if (it.hidden === true) return false;
          if (it.guides === true) return false;
        } catch (e) {}
        try {
          if (it.typename === "PathItem")
            return it.filled === true || it.stroked === true;
          if (it.typename === "CompoundPathItem") {
            if (it.pathItems.length > 0) {
              var p0 = it.pathItems[0];
              return p0.filled === true || p0.stroked === true;
            }
            return false;
          }
        } catch (e) {}
        return true;
      }
      function visibleUnion(item, acc) {
        function merge(b) {
          if (!b) return;
          if (!acc.val) {
            acc.val = b.slice(0);
            return;
          }
          var a = acc.val;
          if (b[0] < a[0]) a[0] = b[0];
          if (b[1] > a[1]) a[1] = b[1];
          if (b[2] > a[2]) a[2] = b[2];
          if (b[3] < a[3]) a[3] = b[3];
        }
        var _tn;
        try {
          _tn = item.typename;
        } catch (e) {
          return;
        }
        if (_tn === "GroupItem") {
          var clipped = false;
          try {
            clipped = item.clipped;
          } catch (e) {}
          if (clipped) {
            var pit = item.pageItems;
            var maskB = null;
            for (var i = 0; i < pit.length; i++) {
              var isc = false;
              try {
                isc = pit[i].clipping === true;
              } catch (e) {}
              if (isc) {
                maskB = pit[i].geometricBounds;
                break;
              }
            }
            var inner = { val: null };
            for (i = 0; i < pit.length; i++) {
              var isMask = false;
              try {
                isMask = pit[i].clipping === true;
              } catch (e) {}
              if (isMask) continue;
              visibleUnion(pit[i], inner);
            }
            var res = inner.val;
            if (res && maskB) {
              var gx0 = Math.max(res[0], maskB[0]);
              var gy1 = Math.min(res[1], maskB[1]);
              var gx2 = Math.min(res[2], maskB[2]);
              var gy3 = Math.max(res[3], maskB[3]);
              if (gx2 > gx0 && gy1 > gy3) merge([gx0, gy1, gx2, gy3]);
              else merge(maskB);
            } else if (res) {
              merge(res);
            } else if (maskB) {
              merge(maskB);
            }
            return;
          }
          var pit2 = item.pageItems;
          for (var j = 0; j < pit2.length; j++) visibleUnion(pit2[j], acc);
          return;
        }
        if (isVisibleLeaf(item)) {
          try {
            merge(item.visibleBounds);
          } catch (e) {}
        }
      }
      function centerAt(item, cxPt, cyPt) {
        var s = sizeMM(item);
        var curCx = (s.b[0] + s.b[2]) / 2,
          curCy = (s.b[1] + s.b[3]) / 2;
        item.translate(cxPt - curCx, cyPt - curCy);
      }

      // ============================================================
      //  BƯỚC 1: XỬ LÝ TỪNG TRANG (raster + phóng về PAGE_W x PAGE_H)
      // ============================================================
      var processed = [];
      for (var p = 0; p < pages.length; p++) {
        var item = pages[p];
        var s0 = sizeMM(item);
        var frame = s0.b.slice(0);

        var flat = dcFlattenForImposition(doc, item, frame, 400);

        var gb = flat.geometricBounds;
        var curW = (gb[2] - gb[0]) / MM,
          curH = (gb[1] - gb[3]) / MM;
        if (curW > 0 && curH > 0) {
          var sx = (PAGE_W / curW) * 100;
          var sy = (PAGE_H / curH) * 100;
          try {
            flat.resize(sx, sy);
          } catch (e) {}
        }
        processed.push(flat);
      }

      // ============================================================
      //  BƯỚC 2: TÍNH CẶP IMPOSITION
      // ============================================================
      var sheets = [];
      var numSheets = N / 4;
      for (var s = 0; s < numSheets; s++) {
        var frontL = N - 2 * s;
        var frontR = 1 + 2 * s;
        var backL = 2 + 2 * s;
        var backR = N - 1 - 2 * s;
        sheets.push({ front: [frontL, frontR], back: [backL, backR] });
      }

      // ============================================================
      //  BƯỚC 3: IMPORT PON + NHÂN BẢN ARTBOARD + DÀN + CĂN GIỮA
      // ============================================================
      var pb = processed[0].geometricBounds;
      var pageWpt = pb[2] - pb[0];
      var pageHpt = pb[1] - pb[3];
      var gapPt = GAP * MM;
      var spreadWpt = pageWpt * 2 + gapPt; // 1 hàng 2 trang

      var numFaces = numSheets * 2;

      var ponFile = _ponGet();
      if (!ponFile) {
        alert("Chua chon file pon. Dung.");
        return;
      }

      var destName = doc.name;
      var oldAbCount = doc.artboards.length;

      var ponDoc = app.open(ponFile);
      app.activeDocument = ponDoc;
      if (ponDoc.artboards.length === 0) {
        ponDoc.close(SaveOptions.DONOTSAVECHANGES);
        alert("File pon khong co artboard.");
        return;
      }
      var ponAbRect = ponDoc.artboards[0].artboardRect.slice(0);
      var ponAbW = ponAbRect[2] - ponAbRect[0];
      var ponAbH = ponAbRect[1] - ponAbRect[3];

      app.activeDocument = doc;
      var destLayer = doc.activeLayer;
      app.activeDocument = ponDoc;
      var ponItems = [];
      for (var pi = 0; pi < ponDoc.pageItems.length; pi++)
        ponItems.push(ponDoc.pageItems[pi]);
      var ponGroupDup = null;
      var ponOffsetX = 0,
        ponOffsetY = 0;
      if (ponItems.length > 0) {
        var ponGroup = ponDoc.groupItems.add();
        for (pi = ponItems.length - 1; pi >= 0; pi--) {
          try {
            ponItems[pi].move(ponGroup, ElementPlacement.PLACEATBEGINNING);
          } catch (e) {}
        }
        try {
          var ponGb = ponGroup.geometricBounds;
          var ponGroupCx = (ponGb[0] + ponGb[2]) / 2;
          var ponGroupCy = (ponGb[1] + ponGb[3]) / 2;
          var ponAbCx = (ponAbRect[0] + ponAbRect[2]) / 2;
          var ponAbCy = (ponAbRect[1] + ponAbRect[3]) / 2;
          ponOffsetX = ponGroupCx - ponAbCx;
          ponOffsetY = ponGroupCy - ponAbCy;
        } catch (e) {}
        try {
          ponGroupDup = ponGroup.duplicate(
            destLayer,
            ElementPlacement.PLACEATEND,
          );
        } catch (e) {}
      }
      app.activeDocument = ponDoc;
      ponDoc.close(SaveOptions.DONOTSAVECHANGES);

      var dd = null;
      for (var di = 0; di < app.documents.length; di++)
        if (app.documents[di].name === destName) {
          dd = app.documents[di];
          break;
        }
      if (dd) {
        doc = dd;
        app.activeDocument = doc;
      }
      app.activeDocument = doc;

      var startL, startT;
      if (ponGroupDup) {
        var pgb = ponGroupDup.geometricBounds;
        var ponRealCx = (pgb[0] + pgb[2]) / 2;
        var ponRealCy = (pgb[1] + pgb[3]) / 2;
        var ab0Cx = ponRealCx - ponOffsetX;
        var ab0Cy = ponRealCy - ponOffsetY;
        startL = ab0Cx - ponAbW / 2;
        startT = ab0Cy + ponAbH / 2;
      } else {
        startL = ponAbRect[0];
        startT = ponAbRect[1];
      }

      var MAX_ROWS = 12; // A5-style: cụm cao 2 hàng -> 1 cột chỉ 12 dòng
      var blockWpt = ponAbW * 2;
      var abPositions = [];
      for (var fk = 0; fk < numFaces; fk++) {
        var sheetIdx = Math.floor(fk / 2);
        var faceSide = fk % 2;
        var blockNo = Math.floor(sheetIdx / MAX_ROWS);
        var rowInBlock = sheetIdx % MAX_ROWS;
        var l = startL + blockNo * blockWpt + faceSide * ponAbW;
        var t = startT - rowInBlock * ponAbH;
        abPositions.push([l, t, l + ponAbW, t - ponAbH]);
      }

      var ponGroups = [];
      for (var k = 0; k < numFaces; k++) {
        var pos = abPositions[k];
        try {
          doc.artboards.add(pos);
        } catch (e) {}
        if (ponGroupDup) {
          var g;
          try {
            g = ponGroupDup.duplicate(
              doc.activeLayer,
              ElementPlacement.PLACEATEND,
            );
            var gb = g.geometricBounds;
            var gcx = (gb[0] + gb[2]) / 2,
              gcy = (gb[1] + gb[3]) / 2;
            var acx = (pos[0] + pos[2]) / 2,
              acy = (pos[1] + pos[3]) / 2;
            g.translate(acx + ponOffsetX - gcx, acy + ponOffsetY - gcy);
            ponGroups.push(g);
          } catch (e) {}
        }
      }
      try {
        if (ponGroupDup) ponGroupDup.remove();
      } catch (e) {}
      if (doc.artboards.length > numFaces) {
        for (var a2 = oldAbCount - 1; a2 >= 0; a2--) {
          try {
            doc.artboards.remove(a2);
          } catch (e) {}
        }
      }

      var faces = [];
      for (var sf = 0; sf < numSheets; sf++) {
        faces.push(sheets[sf].front);
        faces.push(sheets[sf].back);
      }

      // ---- DÀN 2 CON 1 TỜ: 2 trang hàng trên + copy y hệt hàng dưới, gom group ----
      function placeFaceCentered(pair, pos) {
        var leftItem = processed[pair[0] - 1];
        var rightItem = processed[pair[1] - 1];
        var acx = (pos[0] + pos[2]) / 2,
          acy = (pos[1] + pos[3]) / 2;
        var cxL = acx - spreadWpt / 2 + pageWpt / 2;
        var cxR = acx - spreadWpt / 2 + pageWpt + gapPt + pageWpt / 2;
        var cyTop = acy + pageHpt / 2;
        var cyBot = acy - pageHpt / 2;

        var members = [];
        // hàng trên = bản gốc
        if (leftItem) {
          centerAt(leftItem, cxL, cyTop);
          members.push(leftItem);
        }
        if (rightItem) {
          centerAt(rightItem, cxR, cyTop);
          members.push(rightItem);
        }
        // hàng dưới = copy y hệt
        if (leftItem) {
          try {
            var ld = leftItem.duplicate(
              leftItem.layer,
              ElementPlacement.PLACEATEND,
            );
            centerAt(ld, cxL, cyBot);
            members.push(ld);
          } catch (e) {}
        }
        if (rightItem) {
          try {
            var rd = rightItem.duplicate(
              rightItem.layer,
              ElementPlacement.PLACEATEND,
            );
            centerAt(rd, cxR, cyBot);
            members.push(rd);
          } catch (e) {}
        }
        // gom 4 trang thành 1 group
        var grp = null;
        try {
          grp = doc.activeLayer.groupItems.add();
          for (var mi = 0; mi < members.length; mi++) {
            try {
              members[mi].move(grp, ElementPlacement.PLACEATEND);
            } catch (e) {}
          }
        } catch (e) {}
        return grp;
      }

      var faceGroups = [];
      for (k = 0; k < faces.length; k++) {
        faceGroups[k] = placeFaceCentered(faces[k], abPositions[k]);
      }

      // ============================================================
      //  BƯỚC CUỐI: BÓP CHIỀU NGANG cụm (theo group), cao giữ nguyên
      // ============================================================
      function squeezeGroupWidth(grp, faceIndex) {
        if (!grp) return;
        var b = grp.geometricBounds;
        var curW = b[2] - b[0];
        var cx = (b[0] + b[2]) / 2,
          cy = (b[1] + b[3]) / 2;
        var pairIndex = Math.floor(faceIndex / 2);
        var reductionPt = pairIndex * PAIR_REDUCTION * MM;
        var targetW = curW - reductionPt;
        var scaleX = (targetW / curW) * 100;
        try {
          grp.resize(scaleX, 100);
        } catch (e) {}
        var b2 = grp.geometricBounds;
        var cx2 = (b2[0] + b2[2]) / 2,
          cy2 = (b2[1] + b2[3]) / 2;
        try {
          grp.translate(cx - cx2, cy - cy2);
        } catch (e) {}
      }

      for (k = 0; k < faceGroups.length; k++) {
        squeezeGroupWidth(faceGroups[k], k);
      }

      app.redraw();

      // ============================================================
      //  BƯỚC GHI CHÚ: chữ DỌC, bên phải cụm +2mm, từ trên xuống 1cm
      // ============================================================
      function showNoteDialog() {
        var w = new Window("dialog", "Nhap ghi chu");
        w.orientation = "column";
        w.alignChildren = "fill";
        w.margins = 16;
        w.spacing = 10;

        w.add("statictext", undefined, "Ghi chu BIA (artboard 1):");
        var edBia = w.add("edittext", undefined, "");
        edBia.characters = 40;

        w.add(
          "statictext",
          undefined,
          "Ghi chu RUOT (tu them 'RUOT 1, RUOT 2...'):",
        );
        var edRuot = w.add("edittext", undefined, "");
        edRuot.characters = 40;

        var row = w.add("group");
        row.alignment = "right";
        var btnCancel = row.add("button", undefined, "Bo qua", {
          name: "cancel",
        });
        var btnOK = row.add("button", undefined, "Dien ghi chu", {
          name: "ok",
        });

        var res = null;
        btnOK.onClick = function () {
          res = { bia: edBia.text, ruot: edRuot.text };
          w.close();
        };
        btnCancel.onClick = function () {
          res = null;
          w.close();
        };
        w.show();
        return res;
      }

      function addNote(text, pos, faceIndex) {
        if (!text) return;
        try {
          var lay = doc.activeLayer;
          var tf = lay.textFrames.add();
          tf.contents = text;
          try {
            tf.textRange.characterAttributes.size = 13;
          } catch (e) {}
          try {
            var black = new CMYKColor();
            black.black = 100;
            tf.textRange.characterAttributes.fillColor = black;
          } catch (e) {
            try {
              var rgb = new RGBColor();
              rgb.red = 0;
              rgb.green = 0;
              rgb.blue = 0;
              tf.textRange.characterAttributes.fillColor = rgb;
            } catch (e2) {}
          }
          var acx = (pos[0] + pos[2]) / 2,
            acy = (pos[1] + pos[3]) / 2;
          var cumH = pageHpt * 2; // cụm cao 2 hàng
          var pairIndex = Math.floor(faceIndex / 2);
          var squeezedSpreadWpt = spreadWpt - pairIndex * PAIR_REDUCTION * MM;
          var rightCum = acx + squeezedSpreadWpt / 2;
          var topCum = acy + cumH / 2;
          var targetLeft = rightCum + 2 * MM;
          var targetTop = topCum - 10 * MM;

          tf.position = [0, 0];
          try {
            tf.rotate(-90);
          } catch (e) {}
          var tb = tf.visibleBounds;
          tf.translate(targetLeft - tb[0], targetTop - tb[1]);
        } catch (e) {}
      }

      var note = showNoteDialog();
      if (note) {
        var ruotNo = 0;
        for (var ab = 0; ab < abPositions.length; ab += 2) {
          var pos = abPositions[ab];
          if (ab === 0) {
            addNote(note.bia, pos, ab);
          } else {
            ruotNo++;
            var t = "RUOT " + ruotNo + (note.ruot ? " " + note.ruot : "");
            addNote(t, pos, ab);
          }
        }
        app.redraw();
      }
    })(wCm, hCm);
    return "OK: \u0110\u00e3 ch\u1ea1y d\u00e0n catalogue A5 kh\u1ed5 t\u00f9y ch\u1ec9nh.";
  } catch (e) {
    return "ERR: catalogue custom A5: " + e.toString();
  }
}

// ============================================================
//  DÀN CATALOGUE KHỔ LỚN 65x68 (đóng gáy giữa lồng nhau)
//  1 cụm = 8 trang = 1 mặt in (2 hàng x 4 cột, hàng trên xoay 180).
//
//  CHIA CỤM (lồng từ ngoài vào trong):
//    - Nếu CÓ BÌA: 4 trang ngoài cùng (1,2,N-1,N) = TT4 bìa (khổ 65x43).
//    - Phần ruột (theo dư khi chia 16): dư 12 = TT4 + TT8; dư 8 = TT8;
//      dư 4 = TT4; dư 0 = không có tự trở. Rồi phần bội 16 = các tờ AB.
//    - TT4 = 4 trang (khổ 65x43); TT8 = 8 trang; mỗi tờ AB = 16 trang (2 mặt).
//    - Ví dụ 80 trang có bìa: 2 TT4 + 1 TT8 + 4 tờ AB.
//
//  BỐ TRÍ:
//    - Tự trở (TT4/TT8) đứng 1 mình 1 hàng.
//    - Mỗi tờ AB xếp 2 cột: mặt A trái, mặt B phải.
//    - Tờ AB: 4 cụm-4-con đặt vị trí A(trái C3, phải C1) B(trái C2, phải C4).
//
//  KÍCH THƯỚC / BÓP:
//    - Trang căn giữa artboard, đỉnh cụm cách đỉnh artboard 2.3cm (65x86).
//    - TT4 (65x43): 2 cụm 2-trang xoay 90 (trái CCW, phải CW), căn giữa,
//      khe giữa 0.76cm.
//    - Cụm 8 (65x86): 2 nửa cách nhau 0.8cm.
//    - Bóp theo tờ: bìa không bóp; ruột 1 = -0.1cm, ruột 2 = -0.2cm...
//      (co chiều rộng cụm 2-trang; TT4 bóp dọc).
//
//  PON: pon chính (65x86) cho TT8/AB; pon riêng (65x43) cho TT4.
//       Nhớ theo khổ, chỉ hỏi 1 lần mỗi khổ. Pon nằm trên cùng.
//
//  GHI CHÚ: "RUỘT N" (+ chữ thêm), bìa dùng ô riêng. TT4 chữ dọc.
//
//  Cách dùng:
//   1. Chọn N trang theo thứ tự đọc (bội số của 4; phần ruột dư 0/4/8/12).
//   2. File > Scripts > chạy script.
//   3. Nhập kích thước 1 trang (cm) + tick "Có bìa" nếu chọn cả file.
//   4. Chọn pon chính (và pon TT4 nếu có cụm 4).
//   5. Nhập ghi chú (bìa + ruột).
// ============================================================

function dcRunSignature8(wCm, hCm, coBia) {
  try {
    var MM = 2.834645669;

    // ---------- BẢNG NHẬP KÍCH THƯỚC (cm) ----------
    function showSizeDialog() {
      var w = new Window("dialog", "Kích thước 1 trang (cm)");
      w.orientation = "column";
      w.alignChildren = "fill";
      w.margins = 16;
      w.spacing = 10;
      w.add(
        "statictext",
        undefined,
        "Nhập kích thước 1 TRANG sau phóng to (cm).",
      );
      var rW = w.add("group");
      rW.add("statictext", undefined, "Rộng (cm):");
      var edW = rW.add("edittext", undefined, "");
      edW.characters = 8;
      var rH = w.add("group");
      rH.add("statictext", undefined, "Cao  (cm):");
      var edH = rH.add("edittext", undefined, "");
      edH.characters = 8;
      var cbBia = w.add(
        "checkbox",
        undefined,
        "Có bìa (4 trang ngoài cùng 1,2,N-1,N làm TT4 bìa)",
      );
      cbBia.value = true; // mặc định có bìa (chọn cả file)
      var row = w.add("group");
      row.alignment = "right";
      var bC = row.add("button", undefined, "Bỏ qua", { name: "cancel" });
      var bO = row.add("button", undefined, "Dàn", { name: "ok" });
      var res = null;
      bO.onClick = function () {
        var cw = parseFloat(String(edW.text).replace(",", "."));
        var ch = parseFloat(String(edH.text).replace(",", "."));
        if (isNaN(cw) || isNaN(ch) || cw <= 0 || ch <= 0) {
          alert("Kích thước sai.");
          return;
        }
        res = { w: cw * 10, h: ch * 10, coBia: cbBia.value };
        w.close();
      };
      bC.onClick = function () {
        res = null;
        w.close();
      };
      w.show();
      return res;
    }
    var _si = null;
    var _pw = parseFloat(String(wCm).replace(",", "."));
    var _ph = parseFloat(String(hCm).replace(",", "."));
    if (!isNaN(_pw) && !isNaN(_ph) && _pw > 0 && _ph > 0) {
      var _cb =
        coBia === true || coBia === "true" || coBia === 1 || coBia === "1";
      _si = { w: _pw * 10, h: _ph * 10, coBia: _cb };
    } else {
      _si = showSizeDialog();
    }
    if (!_si) return "OK: (bỏ qua)";
    var PAGE_W = _si.w,
      PAGE_H = _si.h;
    var CO_BIA = _si.coBia;

    var TOP_GAP = 23 * MM; // mép trên bài dàn cách mép trên artboard 2.3cm

    // ---------- PON NHỚ THEO KÍCH THƯỚC (có suffix để phân biệt pon chính / pon TT4) ----------
    function _ponMemoFile() {
      return new File(Folder.userData + "/dan_catalogue_pon_sig8.txt");
    }
    function _sizeKey(suffix) {
      var k = Math.round(PAGE_W * 10) / 10 + "x" + Math.round(PAGE_H * 10) / 10;
      return suffix ? k + "_" + suffix : k;
    }
    function _ponReadAll() {
      var list = [],
        f = _ponMemoFile();
      if (f.exists) {
        f.encoding = "UTF-8";
        f.open("r");
        var a = f.read();
        f.close();
        var ln = a.split(/\r\n|\r|\n/);
        for (var i = 0; i < ln.length; i++) {
          var s = ln[i];
          if (!s || s.charAt(0) == "#") continue;
          var t = s.indexOf("\t");
          if (t < 0) continue;
          list.push({
            key: s.substring(0, t).replace(/^\s+|\s+$/g, ""),
            path: s.substring(t + 1).replace(/^\s+|\s+$/g, ""),
          });
        }
      }
      return list;
    }
    function _ponForSize(suffix) {
      var l = _ponReadAll(),
        k = _sizeKey(suffix);
      for (var i = 0; i < l.length; i++) if (l[i].key === k) return l[i].path;
      return null;
    }
    function _ponWrite(p, suffix) {
      var l = _ponReadAll(),
        k = _sizeKey(suffix),
        f = false;
      for (var i = 0; i < l.length; i++)
        if (l[i].key === k) {
          l[i].path = p;
          f = true;
          break;
        }
      if (!f) l.push({ key: k, path: p });
      var o = "# pon signature8 theo kich thuoc\n";
      for (i = 0; i < l.length; i++) o += l[i].key + "\t" + l[i].path + "\n";
      var ff = _ponMemoFile();
      try {
        ff.encoding = "UTF-8";
        ff.open("w");
        ff.write(o);
        ff.close();
      } catch (e) {}
    }
    //  suffix: null = pon chính (65x86); "tt4" = pon riêng cho cụm 4 (65x43)
    //  labelKho: chữ hiện trong hộp thoại chọn file
    function _ponGet(suffix, labelKho) {
      var s = _ponForSize(suffix);
      if (s) {
        var f = new File(s);
        if (f.exists) return f;
      }
      var c = File.openDialog(
        "Chọn pon " + labelKho + " (.ai) - chỉ hỏi 1 lần",
        "*.ai",
      );
      if (c && c.exists) {
        _ponWrite(c.fsName, suffix);
        return c;
      }
      return null;
    }

    if (app.documents.length === 0) {
      alert("Chưa mở tài liệu.");
      return "OK: (dừng)";
    }
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) {
      alert("Chưa chọn trang ruột.");
      return "OK: (dừng)";
    }

    var N = sel.length;
    if (N % 4 !== 0) {
      alert("Số trang phải là BỘI SỐ CỦA 4.\nĐang chọn: " + N);
      return "OK: (dừng)";
    }
    // Nếu có bìa, 4 trang ngoài cùng làm TT4 bìa -> phần ruột còn lại = N-4.
    var _nRuot = CO_BIA ? N - 4 : N;
    if (_nRuot < 0) {
      alert("Số trang quá ít.");
      return "OK: (dừng)";
    }
    var _du16 = _nRuot % 16;
    if (_du16 !== 0 && _du16 !== 4 && _du16 !== 8 && _du16 !== 12) {
      alert(
        "Số trang không hợp lệ (phần ruột dư " +
          _du16 +
          " khi chia 16).\nChỉ hỗ trợ dư 0/4/8/12.",
      );
      return "OK: (dừng)";
    }

    // ---------- Gom + sắp theo VỊ TRÍ (thứ tự đọc) ----------
    var arr = [];
    for (var i = 0; i < sel.length; i++) {
      var it = sel[i];
      var b;
      try {
        b = it.visibleBounds;
      } catch (e) {
        b = it.geometricBounds;
      }
      arr.push({ item: it, left: b[0], top: b[1] });
    }
    arr.sort(function (a, b) {
      var dy = b.top - a.top;
      if (Math.abs(dy) > 50 * MM) return dy;
      return a.left - b.left;
    });
    var pages = [];
    for (i = 0; i < arr.length; i++) pages.push(arr[i].item); // pages[0]=trang ruột đầu tiên

    // ============================================================
    //  HELPER (đo/clip/union giống các hàm catalogue khác)
    // ============================================================
    function clipMaskBounds(item) {
      try {
        if (item.typename === "GroupItem" && item.clipped === true) {
          var p = item.pageItems;
          for (var i = 0; i < p.length; i++) {
            var c = false;
            try {
              c = p[i].clipping === true;
            } catch (e) {}
            if (c) return p[i].geometricBounds;
          }
        }
      } catch (e) {}
      return null;
    }
    function sizeMM(item) {
      var mb = clipMaskBounds(item);
      if (mb)
        return { w: (mb[2] - mb[0]) / MM, h: (mb[1] - mb[3]) / MM, b: mb };
      var acc = { val: null };
      visibleUnion(item, acc);
      var g = acc.val;
      if (!g) {
        try {
          g = item.visibleBounds;
        } catch (e) {
          try {
            g = item.geometricBounds;
          } catch (e2) {
            g = null;
          }
        }
      }
      if (!g) return { w: 0, h: 0, b: [0, 0, 0, 0] };
      return { w: (g[2] - g[0]) / MM, h: (g[1] - g[3]) / MM, b: g };
    }
    function isVisibleLeaf(it) {
      try {
        if (it.hidden === true) return false;
        if (it.guides === true) return false;
      } catch (e) {}
      try {
        if (it.typename === "PathItem")
          return it.filled === true || it.stroked === true;
        if (it.typename === "CompoundPathItem") {
          if (it.pathItems.length > 0) {
            var p0 = it.pathItems[0];
            return p0.filled === true || p0.stroked === true;
          }
          return false;
        }
      } catch (e) {}
      return true;
    }
    function visibleUnion(item, acc) {
      function merge(b) {
        if (!b) return;
        if (!acc.val) {
          acc.val = b.slice(0);
          return;
        }
        var a = acc.val;
        if (b[0] < a[0]) a[0] = b[0];
        if (b[1] > a[1]) a[1] = b[1];
        if (b[2] > a[2]) a[2] = b[2];
        if (b[3] < a[3]) a[3] = b[3];
      }
      var tn;
      try {
        tn = item.typename;
      } catch (e) {
        return;
      }
      if (tn === "GroupItem") {
        var cl = false;
        try {
          cl = item.clipped;
        } catch (e) {}
        if (cl) {
          var p = item.pageItems,
            mB = null;
          for (var i = 0; i < p.length; i++) {
            var c = false;
            try {
              c = p[i].clipping === true;
            } catch (e) {}
            if (c) {
              mB = p[i].geometricBounds;
              break;
            }
          }
          var inn = { val: null };
          for (i = 0; i < p.length; i++) {
            var m = false;
            try {
              m = p[i].clipping === true;
            } catch (e) {}
            if (m) continue;
            visibleUnion(p[i], inn);
          }
          var r = inn.val;
          if (r && mB) {
            var x0 = Math.max(r[0], mB[0]),
              y1 = Math.min(r[1], mB[1]),
              x2 = Math.min(r[2], mB[2]),
              y3 = Math.max(r[3], mB[3]);
            if (x2 > x0 && y1 > y3) merge([x0, y1, x2, y3]);
            else merge(mB);
          } else if (r) merge(r);
          else if (mB) merge(mB);
          return;
        }
        var p2 = item.pageItems;
        for (var j = 0; j < p2.length; j++) visibleUnion(p2[j], acc);
        return;
      }
      if (isVisibleLeaf(item)) {
        try {
          merge(item.visibleBounds);
        } catch (e) {}
      }
    }
    function centerAt(item, cx, cy) {
      var s = sizeMM(item);
      var ccx = (s.b[0] + s.b[2]) / 2,
        ccy = (s.b[1] + s.b[3]) / 2;
      item.translate(cx - ccx, cy - ccy);
    }

    // ============================================================
    //  BƯỚC 1: raster từng trang + phóng về PAGE_W x PAGE_H
    //  Raster tại frame gốc (đo bằng clipMaskBounds/visibleUnion) rồi resize
    //  về đúng kích thước đích (cách A - ép đúng số, raster không méo).
    // ============================================================
    var processed = [];
    for (var p = 0; p < pages.length; p++) {
      var item = pages[p];
      var s0 = sizeMM(item); // do kich thuoc that (xu ly clip neu co)
      var frame = s0.b.slice(0); // khung để raster

      var flat = dcFlattenForImposition(doc, item, frame, 400);

      // phong ve dung PAGE_W x PAGE_H
      var gb;
      try {
        gb = flat.geometricBounds;
      } catch (e) {
        gb = null;
      }
      if (gb) {
        var cw = (gb[2] - gb[0]) / MM,
          ch = (gb[1] - gb[3]) / MM;
        if (cw > 0 && ch > 0) {
          try {
            flat.resize((PAGE_W / cw) * 100, (PAGE_H / ch) * 100);
          } catch (e) {}
        }
      }
      processed.push(flat);
    }

    // ============================================================
    //  BƯỚC 2: CHIA CỤM (đóng gáy giữa lồng nhau, từ ngoài vào trong)
    //  Quy tac:
    //   - Phần dư (N%16) xử lý TỰ TRỞ trước: dư 12=cụm4+cụm8; dư 8=cụm8;
    //     dư 4=cụm4; dư 0=không có tự trở.
    //   - Thứ tự bình: cụm4 (65x43) -> cụm8 (65x86) -> các tờ AB (16 trang).
    //   - Cụm lồng từ ngoài vào (2 đầu dãy).
    //
    //  Công thức trang (a=đầu lớp, b=cuối lớp, 1-based):
    //   cum4 (2 cot): tren=[b, a]        duoi=[a+1, b-1]        (cuối-đầu/đầu-cuối)
    //   cụm8 (4 cột): trên=[b-3,a+3,a+2,b-2] dưới=[b,a,a+1,b-1]
    //  Khớp mẫu N=76: cum4 tren=[76,1] duoi=[2,75]; cum8 tren=[71,6,5,72]...
    //  *** Nếu lệch, sửa 2 công thức dưới trong cum4Pages/cum8Pages ***
    // ============================================================
    //  TT4: 1 HÀNG 4 trang, thứ tự trái->phải = [b, a, a+1, b-1].
    //   2 trang trái (b, a) xoay 180; 2 trang phải (a+1, b-1) xuôi. Khe 0.76cm giữa.
    //   Ví dụ N=76: [76, 1, 2, 75].
    function cum4Pages(a, b) {
      return { type: "TT4", row: [b, a, a + 1, b - 1] };
    }
    function cum8Pages(a, b) {
      return {
        type: "AB",
        top: [b - 3, a + 3, a + 2, b - 2],
        bottom: [b, a, a + 1, b - 1],
      };
    }

    // ---- 1 CỤM-4-CON của tờ AB (2 hàng x 2 cột) theo lớp [a..b] ----
    //  C1 (ngoài): cặp (a,b)+(a+3,b-3); C2: (a+1,b-1)+(a+2,b-2);
    //  C3: (a+4,b-4)+(a+7,b-7);        C4 (trong): (a+5,b-5)+(a+6,b-6).
    function cum4con(a, b) {
      var a2 = a + 4,
        b2 = b - 4;
      return {
        C1: { top: [b - 3, a + 3], bottom: [b, a] },
        C2: { top: [a + 2, b - 2], bottom: [a + 1, b - 1] },
        C3: { top: [b2 - 3, a2 + 3], bottom: [b2, a2] },
        C4: { top: [a2 + 2, b2 - 2], bottom: [a2 + 1, b2 - 1] },
      };
    }
    //  Ghép 1 mặt từ 2 cụm-4-con (nửa trái + nửa phải). top/bottom = 4 cột.
    function faceFrom(left, right) {
      return {
        top: left.top.concat(right.top),
        bottom: left.bottom.concat(right.bottom),
      };
    }
    //  1 TO AB (16 trang lop [a..b]) -> 2 mặt, dat cum dung vi tri:
    //   Mặt A: trái=C3, phải=C1 ; Mặt B: trái=C2, phải=C4.
    function buildToAB(a, b) {
      var c = cum4con(a, b);
      return { A: faceFrom(c.C3, c.C1), B: faceFrom(c.C2, c.C4) };
    }

    // Xây dựng danh sách FACES (mỗi face = 1 artboard).
    //  sheetNo = số TỜ RUỘT dùng để bóp: bia=0 (không bóp), mỗi TT ruột=1 tờ,
    //  mỗi cặp AB (2 mặt) dùng chung 1 sheetNo.
    var faces = [];
    var _a = 1,
      _b = N;
    var sheetNo = 0; // to ruot hien tai (0 = bia, không bóp)

    // Nếu CÓ BÌA: cụm ngoài cùng nhất (1,2,N-1,N) = TT4 BIA. Làm đầu tiên.
    if (CO_BIA) {
      var fBia = cum4Pages(_a, _b);
      faces.push({
        type: "TT4",
        label: "TT4 BIA (65x43)",
        row: fBia.row,
        sheetNo: 0,
      });
      _a += 2;
      _b -= 2;
    }

    // Phần còn lại (ruot) = số trang từ _a den _b.
    var nRemain = _b - _a + 1;
    var du = nRemain % 16;
    var ttOrder = [];
    if (du === 12) ttOrder = [4, 8];
    else if (du === 8) ttOrder = [8];
    else if (du === 4) ttOrder = [4];
    // else dư===0 -> không thêm tự trở cho ruột

    // Tự trở cho ruột (cum4 -> cum8 theo thứ tự ttOrder). Mỗi TT ruột = 1 to.
    for (var oi = 0; oi < ttOrder.length; oi++) {
      sheetNo++;
      if (ttOrder[oi] === 4) {
        var f4 = cum4Pages(_a, _b);
        faces.push({
          type: "TT4",
          label: "TU TRO 4 (65x43)",
          row: f4.row,
          sheetNo: sheetNo,
        });
        _a += 2;
        _b -= 2;
      } else {
        var f8 = cum8Pages(_a, _b);
        faces.push({
          type: "TT8",
          label: "TU TRO 8 (65x86)",
          top: f8.top,
          bottom: f8.bottom,
          cols: 4,
          sheetNo: sheetNo,
        });
        _a += 4;
        _b -= 4;
      }
    }

    // Phần còn lại = cac TO AB (mỗi tờ 16 trang lop [_a.._b] -> 2 mặt A,B).
    var toNo = 0;
    while (_a < _b) {
      toNo++;
      sheetNo++;
      var t = buildToAB(_a, _b); // lấy 16 trang: 8 dau + 8 cuoi cua lop
      _a += 8;
      _b -= 8; // 1 tờ tiêu thụ 16 trang (8 moi dau)
      faces.push({
        type: "AB",
        label: "To" + toNo + " - A",
        top: t.A.top,
        bottom: t.A.bottom,
        cols: 4,
        sheetNo: sheetNo,
      });
      faces.push({
        type: "AB",
        label: "To" + toNo + " - B",
        top: t.B.top,
        bottom: t.B.bottom,
        cols: 4,
        sheetNo: sheetNo,
      });
    }

    var numFaces = faces.length;

    // Đánh dấu xem face nào là TỰ TRỞ (đứng 1 mình) và gom cặp AB.
    //  isSolo = artboard đứng 1 mình 1 hàng (TT4, TT8).
    //  Các face AB đi theo cặp: A bên trái, B bên phải.
    for (var fi = 0; fi < faces.length; fi++) {
      faces[fi].solo = faces[fi].type === "TT4" || faces[fi].type === "TT8";
    }

    // ============================================================
    //  BƯỚC 3: IMPORT PON (2 loai: chinh 65x86 + rieng TT4 65x43)
    //  -> artboard theo pon -> nhân bản pon -> đặt cụm căn giữa, đỉnh 2.3cm.
    // ============================================================
    var pb = processed[0].geometricBounds;
    var pageWpt = pb[2] - pb[0],
      pageHpt = pb[1] - pb[3];

    var GAP_ROW = 12 * MM;
    var GAP_COL = 20 * MM;

    var destName = doc.name;
    var oldAb = doc.artboards.length;

    //  Mở 1 file pon, gom thành group, duplicate sang file đích.
    //  Trả về { dup, W, H, offX, offY } hoặc null.
    function loadPon(suffix, label) {
      var ponFile = _ponGet(suffix, label);
      if (!ponFile) return null;
      var ponDoc = app.open(ponFile);
      app.activeDocument = ponDoc;
      if (ponDoc.artboards.length === 0) {
        ponDoc.close(SaveOptions.DONOTSAVECHANGES);
        return null;
      }
      var ponRect = ponDoc.artboards[0].artboardRect.slice(0);
      var W = ponRect[2] - ponRect[0],
        H = ponRect[1] - ponRect[3];

      app.activeDocument = doc;
      var destLayer = doc.activeLayer;
      app.activeDocument = ponDoc;
      var pit = [];
      for (var q = 0; q < ponDoc.pageItems.length; q++)
        pit.push(ponDoc.pageItems[q]);
      var dup = null,
        offX = 0,
        offY = 0;
      if (pit.length > 0) {
        var pg = ponDoc.groupItems.add();
        for (q = pit.length - 1; q >= 0; q--) {
          try {
            pit[q].move(pg, ElementPlacement.PLACEATBEGINNING);
          } catch (e) {}
        }
        try {
          var gbp = pg.geometricBounds;
          var gcx = (gbp[0] + gbp[2]) / 2,
            gcy = (gbp[1] + gbp[3]) / 2;
          var acx = (ponRect[0] + ponRect[2]) / 2,
            acy = (ponRect[1] + ponRect[3]) / 2;
          offX = gcx - acx;
          offY = gcy - acy;
        } catch (e) {}
        try {
          dup = pg.duplicate(destLayer, ElementPlacement.PLACEATEND);
        } catch (e) {}
      }
      app.activeDocument = ponDoc;
      ponDoc.close(SaveOptions.DONOTSAVECHANGES);
      // quay lại file đích
      var dd = null;
      for (var di = 0; di < app.documents.length; di++)
        if (app.documents[di].name === destName) {
          dd = app.documents[di];
          break;
        }
      if (dd) {
        doc = dd;
      }
      app.activeDocument = doc;
      return { dup: dup, W: W, H: H, offX: offX, offY: offY };
    }

    // Load pon chinh (65x86) cho TT8/AB.
    var ponMain = loadPon(null, "chính (khổ 65x86 / " + _sizeKey() + ")");
    if (!ponMain) {
      alert("Chưa chọn pon chính. Dừng.");
      return "OK: (dừng)";
    }

    // Neu co face TT4 -> load them pon rieng (65x43).
    var hasTT4 = false;
    for (var ci2 = 0; ci2 < faces.length; ci2++)
      if (faces[ci2].type === "TT4") {
        hasTT4 = true;
        break;
      }
    var ponTT4 = null;
    if (hasTT4) {
      ponTT4 = loadPon("tt4", "riêng cho cụm 4 (khổ 65x43)");
      if (!ponTT4) {
        alert("Chưa chọn pon TT4. Dừng.");
        return "OK: (dừng)";
      }
    }

    //  Chọn pon theo loại face.
    function ponFor(face) {
      return face.type === "TT4" && ponTT4 ? ponTT4 : ponMain;
    }

    // Gốc đặt: dựa theo vị trí THẬT của pon chính vừa duplicate.
    var startL, startT;
    if (ponMain.dup) {
      var pgb = ponMain.dup.geometricBounds;
      var rcx = (pgb[0] + pgb[2]) / 2,
        rcy = (pgb[1] + pgb[3]) / 2;
      var ab0Cx = rcx - ponMain.offX,
        ab0Cy = rcy - ponMain.offY;
      startL = ab0Cx - ponMain.W / 2;
      startT = ab0Cy + ponMain.H / 2;
    } else {
      startL = 0;
      startT = 0;
    }

    // ---- Vị trí artboard theo faces[] ----
    //  - SOLO (TT4/TT8): 1 minh 1 hang (cot 0).
    //  - AB: cặp A|B cùng hàng.
    //  Chiều cao mỗi hàng lấy theo pon của face đầu hàng; row cách nhau GAP_ROW.
    var mainW = ponMain.W,
      mainH = ponMain.H;
    var abPos = [];
    var curT = startT; // dinh hang hien tai
    var fk = 0;
    while (fk < numFaces) {
      var pA = ponFor(faces[fk]);
      var wA = pA.W,
        hA = pA.H;
      if (faces[fk].solo) {
        abPos[fk] = [startL, curT, startL + wA, curT - hA];
        curT = curT - hA - GAP_ROW;
        fk++;
      } else {
        var lA = startL;
        abPos[fk] = [lA, curT, lA + wA, curT - hA];
        var hRow = hA;
        if (fk + 1 < numFaces) {
          var pB = ponFor(faces[fk + 1]);
          var lB = startL + mainW + GAP_COL; // cột phải canh theo pon chính
          abPos[fk + 1] = [lB, curT, lB + pB.W, curT - pB.H];
          if (pB.H > hRow) hRow = pB.H;
        }
        curT = curT - hRow - GAP_ROW;
        fk += 2;
      }
    }

    // ---- Tạo artboard (chưa nhân bản pon - sẽ làm SAU khi đặt trang) ----
    for (var k = 0; k < numFaces; k++) {
      var pos = abPos[k];
      try {
        doc.artboards.add(pos);
      } catch (e) {}
    }
    if (doc.artboards.length > numFaces) {
      for (var a2 = oldAb - 1; a2 >= 0; a2--) {
        try {
          doc.artboards.remove(a2);
        } catch (e) {}
      }
    }

    // ---------- đặt trang lên 1 MẶT ----------
    function centerItem(it, cx, cy) {
      var gb;
      try {
        gb = it.geometricBounds;
      } catch (e) {
        return;
      }
      if (!gb || gb.length < 4) return;
      var ccx = (gb[0] + gb[2]) / 2,
        ccy = (gb[1] + gb[3]) / 2;
      var dx = cx - ccx,
        dy = cy - ccy;
      if (isNaN(dx) || isNaN(dy)) return;
      try {
        it.translate(dx, dy);
      } catch (e) {}
    }
    //  face.top/bottom = số trang THẬT (1-based).
    //  - Cụm 8 (TT8/AB, 4 cột): đỉnh cụm cách đỉnh artboard 2.3cm;
    //    2 cụm nhỏ 4 trang trái/phải cách nhau MID_GAP (0.8cm).
    //  - Cụm 4 (TT4, 2 cột): CĂN GIỮA artboard (ngang+dọc);
    //    2 cột (2 cụm nhỏ 2 trang) cách nhau MID_GAP_TT4 (0.76cm).
    var MID_GAP = 8 * MM; // khe cụm 8 = 0.8cm
    var MID_GAP_TT4 = 7.6 * MM; // khe TT4 = 0.76cm

    //  Đặt 1 hàng (top/bottom) cho CỤM 8 (4 cột), căn giữa ngang, đỉnh = cumTop.
    function placeRow8(pageArr, rot, pos, cumTop, rowIsTop) {
      var acx = (pos[0] + pos[2]) / 2;
      var totalW = pageWpt * 4 + MID_GAP;
      var leftEdge = acx - totalW / 2;
      var cy = rowIsTop ? cumTop - pageHpt / 2 : cumTop - pageHpt * 1.5;
      for (var c = 0; c < 4; c++) {
        var it = processed[pageArr[c] - 1];
        if (!it) continue;
        if (rot) {
          try {
            it.rotate(180);
          } catch (e) {}
        }
        var extra = c >= 2 ? MID_GAP : 0;
        centerItem(it, leftEdge + c * pageWpt + extra + pageWpt / 2, cy);
      }
    }
    function placeFace8(face, pos) {
      var cumTop = pos[1] - TOP_GAP;
      placeRow8(face.top, true, pos, cumTop, true);
      placeRow8(face.bottom, false, pos, cumTop, false);

      // ---- BÓP: co ngang mỗi NỬA (cụm 2-trang) theo sheetNo ----
      //  Nửa trái = 4 trang (top[0],top[1],bottom[0],bottom[1]);
      //  nửa phải = 4 trang (top[2],top[3],bottom[2],bottom[3]).
      //  Bề rộng cụm 2-trang gốc = 2*pageWpt. Bóp bớt sheetNo*0.1cm (giữ cao).
      var reducePt = face.sheetNo * 1 * MM; // 0.1cm = 1mm mỗi tờ
      if (reducePt <= 0) return; // bia (sheetNo 0) không bóp
      var origW = 2 * pageWpt;
      var scaleX = ((origW - reducePt) / origW) * 100;

      function squeezeHalf(pArr) {
        // pArr = 4 số trang tạo thành 1 nửa. Gom group, scale ngang, giữ tâm.
        var members = [];
        for (var i = 0; i < pArr.length; i++) {
          var it = processed[pArr[i] - 1];
          if (it) members.push(it);
        }
        if (members.length === 0) return;
        var grp;
        try {
          grp = doc.activeLayer.groupItems.add();
          for (var m = 0; m < members.length; m++) {
            try {
              members[m].move(grp, ElementPlacement.PLACEATEND);
            } catch (e) {}
          }
          var b = grp.geometricBounds;
          var cx = (b[0] + b[2]) / 2,
            cy = (b[1] + b[3]) / 2;
          grp.resize(scaleX, 100); // co ngang, giữ cao
          var b2 = grp.geometricBounds;
          var cx2 = (b2[0] + b2[2]) / 2,
            cy2 = (b2[1] + b2[3]) / 2;
          grp.translate(cx - cx2, cy - cy2); // giu tam nua
          // KHÔNG ungroup - để nguyên group cũng được; nhưng để an toàn ungroup:
          // tách members ra lại (Illustrator giữ vị trí sau resize)
          for (var mm2 = grp.pageItems.length - 1; mm2 >= 0; mm2--) {
            try {
              grp.pageItems[mm2].move(
                doc.activeLayer,
                ElementPlacement.PLACEATEND,
              );
            } catch (e) {}
          }
          try {
            grp.remove();
          } catch (e) {}
        } catch (e) {}
      }
      squeezeHalf([face.top[0], face.top[1], face.bottom[0], face.bottom[1]]); // nửa trái
      squeezeHalf([face.top[2], face.top[3], face.bottom[2], face.bottom[3]]); // nửa phải
    }

    //  Đặt CỤM 4 (TT4): 2 CỤM NHỎ, mỗi cụm 2 trang, XOAY CẢ CỤM 90 độ.
    //  row = [b, a, a+1, b-1] = [76,1,2,75] (N=76).
    //   Cụm TRÁI  = 2 trang (row[0], row[1]) xếp cạnh nhau ngang -> xoay CẢ CỤM 90 CCW.
    //   Cụm PHẢI  = 2 trang (row[2], row[3]) xếp cạnh nhau ngang -> xoay CẢ CỤM 90 CW.
    //  2 cụm cách nhau 0.76cm. Căn giữa artboard.
    function buildPairGroup(pageL, pageR) {
      // gom 2 trang thành 1 group, đặt cạnh nhau ngang (L trái, R phải), căn tâm.
      var itL = processed[pageL - 1],
        itR = processed[pageR - 1];
      if (!itL || !itR) return null;
      // đặt itR ngay bên phải itL (theo bề rộng trang gốc)
      var bl = itL.geometricBounds;
      var lcx = (bl[0] + bl[2]) / 2,
        lcy = (bl[1] + bl[3]) / 2;
      var br = itR.geometricBounds;
      var rcx = (br[0] + br[2]) / 2,
        rcy = (br[1] + br[3]) / 2;
      // đưa itR về cùng hàng, cạnh phải itL
      var targetRcx = lcx + pageWpt; // cạnh nhau, không khe trong cụm
      itR.translate(targetRcx - rcx, lcy - rcy);
      // gom group
      var grp = null;
      try {
        grp = doc.activeLayer.groupItems.add();
        itL.move(grp, ElementPlacement.PLACEATEND);
        itR.move(grp, ElementPlacement.PLACEATEND);
      } catch (e) {
        grp = null;
      }
      return grp;
    }
    function centerGroupAt(grp, cx, cy) {
      if (!grp) return;
      var gb;
      try {
        gb = grp.geometricBounds;
      } catch (e) {
        return;
      }
      var gcx = (gb[0] + gb[2]) / 2,
        gcy = (gb[1] + gb[3]) / 2;
      try {
        grp.translate(cx - gcx, cy - gcy);
      } catch (e) {}
    }
    function placeFace4(face, pos) {
      var acx = (pos[0] + pos[2]) / 2,
        acy = (pos[1] + pos[3]) / 2; // tâm artboard
      // cụm trái (row0,row1) + cụm phải (row2,row3)
      var gL = buildPairGroup(face.row[0], face.row[1]);
      var gR = buildPairGroup(face.row[2], face.row[3]);
      // xoay cả cụm: trái 90 CCW, phải 90 CW
      if (gL) {
        try {
          gL.rotate(90);
        } catch (e) {}
      }
      if (gR) {
        try {
          gR.rotate(-90);
        } catch (e) {}
      }
      // sau khi xoay, bề rộng 1 cụm = chiều cao trước xoay = pageHpt (1 hàng 1 trang cao)
      // (cụm 2 trang ngang cao = pageHpt, rộng = 2*pageWpt; xoay 90 -> rộng=pageHpt, cao=2*pageWpt)
      var cumW = pageHpt; // bề rộng 1 cụm sau xoay
      var totalW = cumW * 2 + MID_GAP_TT4;
      var leftEdge = acx - totalW / 2;
      centerGroupAt(gL, leftEdge + cumW / 2, acy);
      centerGroupAt(gR, leftEdge + cumW + MID_GAP_TT4 + cumW / 2, acy);

      // ---- BÓP DỌC: co chiều DỌC (= bề rộng cụm 2-trang gốc) theo sheetNo ----
      //  Sau xoay 90, chiều "rộng cụm 2-trang gốc" (2*pageWpt) nằm DỌC (cao group).
      //  Bop bot sheetNo*0.1cm o chieu do. Bia (sheetNo 0) không bóp.
      var reducePt4 = face.sheetNo * 1 * MM; // 1mm = 0.1cm mỗi tờ
      if (reducePt4 > 0) {
        var origH = 2 * pageWpt; // chiều dọc cụm sau xoay
        var scaleY = ((origH - reducePt4) / origH) * 100;
        function squeezeGroupV(grp) {
          if (!grp) return;
          var b = grp.geometricBounds;
          var cx = (b[0] + b[2]) / 2,
            cy = (b[1] + b[3]) / 2;
          try {
            grp.resize(100, scaleY);
          } catch (e) {} // co dọc, giữ ngang
          var b2 = grp.geometricBounds;
          var cx2 = (b2[0] + b2[2]) / 2,
            cy2 = (b2[1] + b2[3]) / 2;
          try {
            grp.translate(cx - cx2, cy - cy2);
          } catch (e) {}
        }
        squeezeGroupV(gL);
        squeezeGroupV(gR);
      }
    }

    function placeFace(face, pos) {
      if (face.type === "TT4") placeFace4(face, pos);
      else placeFace8(face, pos);
    }

    for (var ff = 0; ff < numFaces; ff++) {
      placeFace(faces[ff], abPos[ff]);
    }

    // ---- Nhân bản PON vào từng artboard, đặt LÊN TRÊN CÙNG (PLACEATBEGINNING) ----
    //  Làm SAU khi đặt trang để pon hiện đè lên bài dàn (không bị trang che).
    for (var kp = 0; kp < numFaces; kp++) {
      var posP = abPos[kp];
      var pf = ponFor(faces[kp]);
      if (pf.dup) {
        try {
          var g = pf.dup.duplicate(
            doc.activeLayer,
            ElementPlacement.PLACEATBEGINNING,
          );
          var gb = g.geometricBounds;
          var gcx = (gb[0] + gb[2]) / 2,
            gcy = (gb[1] + gb[3]) / 2;
          var acx = (posP[0] + posP[2]) / 2,
            acy = (posP[1] + posP[3]) / 2;
          g.translate(acx + pf.offX - gcx, acy + pf.offY - gcy);
        } catch (e) {}
      }
    }
    // Xóa bản pon gốc (dup mẫu).
    try {
      if (ponMain.dup) ponMain.dup.remove();
    } catch (e) {}
    try {
      if (ponTT4 && ponTT4.dup) ponTT4.dup.remove();
    } catch (e) {}

    // ============================================================
    //  GHI CHU "RUOT N" (+ text them). Giong A4/A5, chỉ khác VỊ TRÍ.
    //   - TT4 (65x43): chữ DỌC, cách mép DƯỚI lên 1.5cm, mép TRÁI vào 0.9cm.
    //   - TT8/AB (65x86): chữ NGANG, cách mép TRÁI vào 2cm, mep TREN xuong 1.1cm.
    //   - Mép = mép ARTBOARD.
    //   - TT: điền cho artboard đó. AB: chỉ điền MẶT A (ben trai), mặt B bỏ trống.
    //   - Bia (sheetNo 0) KHÔNG ghi chú.
    // ============================================================
    function showNoteDialog() {
      var w = new Window("dialog", "Nhập ghi chú");
      w.orientation = "column";
      w.alignChildren = "fill";
      w.margins = 16;
      w.spacing = 10;
      w.add(
        "statictext",
        undefined,
        "Ghi chú BÌA (artboard bìa, không tự thêm chữ):",
      );
      var edBia = w.add("edittext", undefined, "");
      edBia.characters = 40;
      w.add(
        "statictext",
        undefined,
        "Ghi chú RUỘT (tool tự điền 'RUỘT N', bạn gõ thêm phía sau):",
      );
      var edRuot = w.add("edittext", undefined, "");
      edRuot.characters = 40;
      var row = w.add("group");
      row.alignment = "right";
      var btnCancel = row.add("button", undefined, "Bỏ qua", {
        name: "cancel",
      });
      var btnOK = row.add("button", undefined, "Điền ghi chú", { name: "ok" });
      var res = null;
      btnOK.onClick = function () {
        res = { bia: edBia.text, ruot: edRuot.text };
        w.close();
      };
      btnCancel.onClick = function () {
        res = null;
        w.close();
      };
      w.show();
      return res;
    }

    function setNoteStyle(tf) {
      try {
        tf.textRange.characterAttributes.size = 13;
      } catch (e) {}
      try {
        var black = new CMYKColor();
        black.black = 100;
        tf.textRange.characterAttributes.fillColor = black;
      } catch (e) {
        try {
          var rgb = new RGBColor();
          rgb.red = 0;
          rgb.green = 0;
          rgb.blue = 0;
          tf.textRange.characterAttributes.fillColor = rgb;
        } catch (e2) {}
      }
    }
    //  Ghi chú cho TT4 (chữ DỌC): mép dưới lên 1.5cm, mép trái vào 0.9cm.
    function addNote4(text, pos) {
      if (!text) return;
      try {
        var tf = doc.activeLayer.textFrames.add();
        tf.contents = text;
        setNoteStyle(tf);
        var abLeft = pos[0],
          abBottom = pos[3];
        var targetLeft = abLeft + 9 * MM; // mép trái vào 0.9cm
        var targetBottom = abBottom + 15 * MM; // mép dưới lên 1.5cm (day chu)
        // xoay chữ dọc trước, rồi đặt theo bounds
        tf.position = [0, 0];
        try {
          tf.rotate(90);
        } catch (e) {} // chữ dọc (đọc từ dưới lên)
        var tb = tf.visibleBounds; // [l,t,r,b]
        // dat: cạnh trái chữ = targetLeft ; cạnh dưới chữ = targetBottom
        tf.translate(targetLeft - tb[0], targetBottom - tb[3]);
      } catch (e) {}
    }
    //  Ghi chú cho TT8/AB (chữ NGANG): mép trái vào 2cm, mép trên xuống 1.1cm.
    function addNote8(text, pos) {
      if (!text) return;
      try {
        var tf = doc.activeLayer.textFrames.add();
        tf.contents = text;
        setNoteStyle(tf);
        var abLeft = pos[0],
          abTop = pos[1];
        var x = abLeft + 20 * MM; // mép trái vào 2cm
        var y = abTop - 11 * MM; // mép trên xuống 1.1cm
        tf.position = [x, y];
      } catch (e) {}
    }

    var note = showNoteDialog();
    if (note) {
      for (var ni = 0; ni < numFaces; ni++) {
        var face = faces[ni];
        // AB: chỉ điền MẶT A (label ket thuc " - A"); mặt B bỏ qua.
        if (face.type === "AB" && face.label.indexOf("- B") >= 0) continue;
        if (face.sheetNo <= 0) {
          // BÌA (sheetNo 0): điền ghi chú bìa (chữ tự do). Bìa là TT4 -> addNote4.
          if (note.bia) addNote4(note.bia, abPos[ni]);
          continue;
        }
        var txt = "RUỘT " + face.sheetNo + (note.ruot ? " " + note.ruot : "");
        if (face.type === "TT4") addNote4(txt, abPos[ni]);
        else addNote8(txt, abPos[ni]);
      }
    }

    app.redraw();
    alert(
      "Đã dàn " +
        numFaces +
        " artboard.\n" +
        "Dư " +
        du +
        " -> tự trở trước (4 và/hoặc 8), rồi các tờ AB.\n" +
        (hasTT4 ? "TT4 dùng pon riêng (65x43).\n" : "") +
        "Pon trên cùng. Ghi chú RUỘT N đã điền.",
    );
  } catch (e) {
    return "ERR: signature8: " + e.toString();
  }
  return "OK: Đã dàn CTL Offset.";
}

// ============================================================
//  TEST: Dàn CATALOGUE KEO GÁY (dán keo gáy, in offset khổ lớn 65×86)
//  Khác signature đóng gáy giữa: TUẦN TỰ, KHÔNG bóp, KHÔNG khe.
//
//  CHIA TAY (tuần tự, mỗi tay 16 trang liên tiếp):
//    - Ruột 1 = trang 1..16; ruột 2 = 17..32; ruột 3 = 33..48...
//    - Mỗi tay = 2 mặt (A, B), mỗi mặt 2 hàng × 4 cột (8 trang).
//    - Hàng trên xoay 180°, hàng dưới xuôi. Các trang SÁT NHAU (không khe).
//
//  CÔNG THỨC SIGNATURE 16 KEO GÁY (local 1..16 theo mỗi tay), khớp file mẫu:
//    Mặt A: trên(180)=[5,12,9,8]  dưới=[4,13,16,1]
//    Mặt B: trên(180)=[7,10,11,6] dưới=[2,15,14,3]
//    (trang thật = base + local, base = 16*(tay-1))
//
//  BỐ TRÍ: mỗi tay 2 artboard: mặt A trái, mặt B phải.
//  KÍCH THƯỚC: trang căn giữa ngang; mép trên bài dàn cách mép trên
//              artboard 2.37cm. KHÔNG bóp.
//  PON: pon 65×86 cho tất cả (nhớ theo khổ, hỏi 1 lần). Pon nằm trên cùng.
//  GHI CHÚ: "RUỘT N" (+ chữ thêm), vị trí như signature (mép trái vào 2cm,
//           mép trên xuống 1.1cm). Điền mặt A của mỗi tay.
//
//  *** BẢN NHÁP - bìa KHÔNG dàn (tự dàn tay). Phần lẻ 4/8 tự trở làm sau. ***
//
//  Cách dùng:
//   1. Chọn N trang ruột theo thứ tự đọc (bội số của 16).
//   2. File > Scripts > chạy script.
//   3. Nhập kích thước 1 trang (cm).
//   4. Chọn pon (hỏi 1 lần theo khổ).
//   5. Nhập ghi chú (RUỘT N + chữ thêm).
// ============================================================

function dcRunKeoGay(wCm, hCm) {
  try {
    var MM = 2.834645669;

    // ---------- BẢNG NHẬP KÍCH THƯỚC (cm) ----------
    function showSizeDialog() {
      var w = new Window("dialog", "Kích thước 1 trang (cm)");
      w.orientation = "column";
      w.alignChildren = "fill";
      w.margins = 16;
      w.spacing = 10;
      w.add(
        "statictext",
        undefined,
        "Nhập kích thước 1 TRANG sau phóng to (cm).",
      );
      var rW = w.add("group");
      rW.add("statictext", undefined, "Rộng (cm):");
      var edW = rW.add("edittext", undefined, "");
      edW.characters = 8;
      var rH = w.add("group");
      rH.add("statictext", undefined, "Cao  (cm):");
      var edH = rH.add("edittext", undefined, "");
      edH.characters = 8;
      var row = w.add("group");
      row.alignment = "right";
      var bC = row.add("button", undefined, "Bỏ qua", { name: "cancel" });
      var bO = row.add("button", undefined, "Dàn", { name: "ok" });
      var res = null;
      bO.onClick = function () {
        var cw = parseFloat(String(edW.text).replace(",", "."));
        var ch = parseFloat(String(edH.text).replace(",", "."));
        if (isNaN(cw) || isNaN(ch) || cw <= 0 || ch <= 0) {
          alert("Kích thước sai.");
          return;
        }
        res = { w: cw * 10, h: ch * 10 };
        w.close();
      };
      bC.onClick = function () {
        res = null;
        w.close();
      };
      w.show();
      return res;
    }
    var _si = null;
    var _pw = parseFloat(String(wCm).replace(",", "."));
    var _ph = parseFloat(String(hCm).replace(",", "."));
    if (!isNaN(_pw) && !isNaN(_ph) && _pw > 0 && _ph > 0) {
      _si = { w: _pw * 10, h: _ph * 10 };
    } else {
      _si = showSizeDialog();
    }
    if (!_si) return "OK: (bỏ qua)";
    var PAGE_W = _si.w,
      PAGE_H = _si.h;

    var TOP_GAP = 23.7 * MM; // mép trên bài dàn cách mép trên artboard 2.37cm

    // ---------- PON NHỚ THEO KÍCH THƯỚC (suffix để phân biệt pon chính / TT4) ----------
    function _ponMemoFile() {
      return new File(Folder.userData + "/dan_catalogue_pon_keogay.txt");
    }
    function _sizeKey(suffix) {
      var k = Math.round(PAGE_W * 10) / 10 + "x" + Math.round(PAGE_H * 10) / 10;
      return suffix ? k + "_" + suffix : k;
    }
    function _ponReadAll() {
      var list = [],
        f = _ponMemoFile();
      if (f.exists) {
        f.encoding = "UTF-8";
        f.open("r");
        var a = f.read();
        f.close();
        var ln = a.split(/\r\n|\r|\n/);
        for (var i = 0; i < ln.length; i++) {
          var s = ln[i];
          if (!s || s.charAt(0) == "#") continue;
          var t = s.indexOf("\t");
          if (t < 0) continue;
          list.push({
            key: s.substring(0, t).replace(/^\s+|\s+$/g, ""),
            path: s.substring(t + 1).replace(/^\s+|\s+$/g, ""),
          });
        }
      }
      return list;
    }
    function _ponForSize(suffix) {
      var l = _ponReadAll(),
        k = _sizeKey(suffix);
      for (var i = 0; i < l.length; i++) if (l[i].key === k) return l[i].path;
      return null;
    }
    function _ponWrite(p, suffix) {
      var l = _ponReadAll(),
        k = _sizeKey(suffix),
        f = false;
      for (var i = 0; i < l.length; i++)
        if (l[i].key === k) {
          l[i].path = p;
          f = true;
          break;
        }
      if (!f) l.push({ key: k, path: p });
      var o = "# pon keo gáy theo kích thước\n";
      for (i = 0; i < l.length; i++) o += l[i].key + "\t" + l[i].path + "\n";
      var ff = _ponMemoFile();
      try {
        ff.encoding = "UTF-8";
        ff.open("w");
        ff.write(o);
        ff.close();
      } catch (e) {}
    }
    function _ponGet(suffix, labelKho) {
      var s = _ponForSize(suffix);
      if (s) {
        var f = new File(s);
        if (f.exists) return f;
      }
      var c = File.openDialog(
        "Chọn pon " + labelKho + " (.ai) - chỉ hỏi 1 lần",
        "*.ai",
      );
      if (c && c.exists) {
        _ponWrite(c.fsName, suffix);
        return c;
      }
      return null;
    }

    if (app.documents.length === 0) {
      alert("Chưa mở tài liệu.");
      return "OK: (dừng)";
    }
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) {
      alert("Chưa chọn trang ruột.");
      return "OK: (dừng)";
    }

    var N = sel.length;
    if (N % 4 !== 0) {
      alert("Số trang phải là BỘI SỐ CỦA 4.\nĐang chọn: " + N);
      return "OK: (dừng)";
    }
    var _du = N % 16;
    if (_du !== 0 && _du !== 4 && _du !== 8 && _du !== 12) {
      alert(
        "Số trang không hợp lệ (dư " +
          _du +
          " khi chia 16).\nChỉ hỗ trợ dư 0/4/8/12.",
      );
      return "OK: (dừng)";
    }

    // ---------- Gom + sắp theo VỊ TRÍ (thứ tự đọc) ----------
    var arr = [];
    for (var i = 0; i < sel.length; i++) {
      var it = sel[i];
      var b;
      try {
        b = it.visibleBounds;
      } catch (e) {
        b = it.geometricBounds;
      }
      arr.push({ item: it, left: b[0], top: b[1] });
    }
    arr.sort(function (a, b) {
      var dy = b.top - a.top;
      if (Math.abs(dy) > 50 * MM) return dy;
      return a.left - b.left;
    });
    var pages = [];
    for (i = 0; i < arr.length; i++) pages.push(arr[i].item); // pages[0]=trang ruột đầu tiên

    // ============================================================
    //  HELPER (đo/clip/union giống các hàm catalogue khác)
    // ============================================================
    function clipMaskBounds(item) {
      try {
        if (item.typename === "GroupItem" && item.clipped === true) {
          var p = item.pageItems;
          for (var i = 0; i < p.length; i++) {
            var c = false;
            try {
              c = p[i].clipping === true;
            } catch (e) {}
            if (c) return p[i].geometricBounds;
          }
        }
      } catch (e) {}
      return null;
    }
    function sizeMM(item) {
      var mb = clipMaskBounds(item);
      if (mb)
        return { w: (mb[2] - mb[0]) / MM, h: (mb[1] - mb[3]) / MM, b: mb };
      var acc = { val: null };
      visibleUnion(item, acc);
      var g = acc.val;
      if (!g) {
        try {
          g = item.visibleBounds;
        } catch (e) {
          try {
            g = item.geometricBounds;
          } catch (e2) {
            g = null;
          }
        }
      }
      if (!g) return { w: 0, h: 0, b: [0, 0, 0, 0] };
      return { w: (g[2] - g[0]) / MM, h: (g[1] - g[3]) / MM, b: g };
    }
    function isVisibleLeaf(it) {
      try {
        if (it.hidden === true) return false;
        if (it.guides === true) return false;
      } catch (e) {}
      try {
        if (it.typename === "PathItem")
          return it.filled === true || it.stroked === true;
        if (it.typename === "CompoundPathItem") {
          if (it.pathItems.length > 0) {
            var p0 = it.pathItems[0];
            return p0.filled === true || p0.stroked === true;
          }
          return false;
        }
      } catch (e) {}
      return true;
    }
    function visibleUnion(item, acc) {
      function merge(b) {
        if (!b) return;
        if (!acc.val) {
          acc.val = b.slice(0);
          return;
        }
        var a = acc.val;
        if (b[0] < a[0]) a[0] = b[0];
        if (b[1] > a[1]) a[1] = b[1];
        if (b[2] > a[2]) a[2] = b[2];
        if (b[3] < a[3]) a[3] = b[3];
      }
      var tn;
      try {
        tn = item.typename;
      } catch (e) {
        return;
      }
      if (tn === "GroupItem") {
        var cl = false;
        try {
          cl = item.clipped;
        } catch (e) {}
        if (cl) {
          var p = item.pageItems,
            mB = null;
          for (var i = 0; i < p.length; i++) {
            var c = false;
            try {
              c = p[i].clipping === true;
            } catch (e) {}
            if (c) {
              mB = p[i].geometricBounds;
              break;
            }
          }
          var inn = { val: null };
          for (i = 0; i < p.length; i++) {
            var m = false;
            try {
              m = p[i].clipping === true;
            } catch (e) {}
            if (m) continue;
            visibleUnion(p[i], inn);
          }
          var r = inn.val;
          if (r && mB) {
            var x0 = Math.max(r[0], mB[0]),
              y1 = Math.min(r[1], mB[1]),
              x2 = Math.min(r[2], mB[2]),
              y3 = Math.max(r[3], mB[3]);
            if (x2 > x0 && y1 > y3) merge([x0, y1, x2, y3]);
            else merge(mB);
          } else if (r) merge(r);
          else if (mB) merge(mB);
          return;
        }
        var p2 = item.pageItems;
        for (var j = 0; j < p2.length; j++) visibleUnion(p2[j], acc);
        return;
      }
      if (isVisibleLeaf(item)) {
        try {
          merge(item.visibleBounds);
        } catch (e) {}
      }
    }

    // ============================================================
    //  BƯỚC 1: raster từng trang + phóng về PAGE_W x PAGE_H
    // ============================================================
    var processed = [];
    for (var p = 0; p < pages.length; p++) {
      var item = pages[p];
      var s0 = sizeMM(item);
      var frame = s0.b.slice(0);
      var flat = dcFlattenForImposition(doc, item, frame, 300);
      var gb;
      try {
        gb = flat.geometricBounds;
      } catch (e) {
        gb = null;
      }
      if (gb) {
        var cw = (gb[2] - gb[0]) / MM,
          ch = (gb[1] - gb[3]) / MM;
        if (cw > 0 && ch > 0) {
          try {
            flat.resize((PAGE_W / cw) * 100, (PAGE_H / ch) * 100);
          } catch (e) {}
        }
      }
      processed.push(flat);
    }

    // ============================================================
    //  BƯỚC 2: CHIA TAY + TỰ TRỞ
    //  - Phần bội 16 (từ đầu): các tay AB tuần tự (signature 16 keo gáy).
    //  - Phần dư (cuối): tự trở lồng nhau (TT8 lớp ngoài, TT4 lớp trong).
    //    dư 12 = TT8 + TT4; dư 8 = TT8; dư 4 = TT4.
    //  *** SỬA Ở ĐÂY nếu số trang lệch ô ***
    //  Công thức signature 16 AB (local 1..16, trang thật = base + local):
    // ============================================================
    var SIG16 = {
      A: { top: [5, 12, 9, 8], bottom: [4, 13, 16, 1] }, // top xoay 180
      B: { top: [7, 10, 11, 6], bottom: [2, 15, 14, 3] },
    };

    //  faces[]: mỗi face = 1 artboard. Dùng TRANG THẬT (1-based) trong top/bottom.
    //  type: "AB" (65x86, 4 cột sát nhau) / "TT8" (65x86) / "TT4" (65x43, xoay 90).
    //  sheetNo dùng cho ghi chú "RUỘT N".
    var faces = [];
    var du = N % 16;
    var nAB = N - du; // số trang làm AB (bội 16), từ đầu
    var numTay = nAB / 16;
    var sheetNo = 0;

    function mkAB(base, side) {
      var s = SIG16[side];
      var top = [],
        bot = [];
      for (var i = 0; i < 4; i++) {
        top.push(base + s.top[i]);
        bot.push(base + s.bottom[i]);
      }
      return { top: top, bottom: bot };
    }
    for (var ty = 0; ty < numTay; ty++) {
      sheetNo++;
      var base = ty * 16;
      var A = mkAB(base, "A"),
        B = mkAB(base, "B");
      faces.push({
        type: "AB",
        sheetNo: sheetNo,
        label: "Ruột" + sheetNo + "-A",
        top: A.top,
        bottom: A.bottom,
      });
      faces.push({
        type: "AB",
        sheetNo: sheetNo,
        label: "Ruột" + sheetNo + "-B",
        top: B.top,
        bottom: B.bottom,
      });
    }

    // Phần dư (cuối) -> tự trở lồng nhau. Khối [_a.._b] (trang thật 1-based).
    var _a = nAB + 1,
      _b = N;
    var ttOrder = [];
    if (du === 12) ttOrder = [8, 4];
    else if (du === 8) ttOrder = [8];
    else if (du === 4) ttOrder = [4];
    for (var oi = 0; oi < ttOrder.length; oi++) {
      sheetNo++;
      if (ttOrder[oi] === 8) {
        // TT8 (65x86): công thức đóng gáy giữa lớp ngoài khối dư.
        faces.push({
          type: "TT8",
          sheetNo: sheetNo,
          label: "Ruột" + sheetNo + " TT8",
          top: [_b - 3, _a + 3, _a + 2, _b - 2],
          bottom: [_b, _a, _a + 1, _b - 1],
        });
        _a += 4;
        _b -= 4;
      } else {
        // TT4 (65x43): trái(_a trên, _b dưới), phải(_a+1 trên, _b-1 dưới), xoay 90.
        faces.push({
          type: "TT4",
          sheetNo: sheetNo,
          label: "Ruột" + sheetNo + " TT4",
          row: [_a, _b, _a + 1, _b - 1],
        }); // [trái-trên, trái-dưới, phải-trên, phải-dưới]
        _a += 2;
        _b -= 2;
      }
    }
    var numFaces = faces.length;

    // ============================================================
    //  BƯỚC 3: IMPORT PON -> artboard theo pon -> đặt trang -> pon lên trên
    // ============================================================
    var pb = processed[0].geometricBounds;
    var pageWpt = pb[2] - pb[0],
      pageHpt = pb[1] - pb[3];

    var GAP_ROW = 12 * MM;
    var GAP_COL = 20 * MM;
    var MID_GAP_TT4 = 6 * MM; // khe TT4 (65x43) = 6mm

    var destName = doc.name;
    var oldAb = doc.artboards.length;

    //  Load 1 pon: mở, gom group, duplicate sang file đích. Trả { dup, W, H, offX, offY }.
    function loadPon(suffix, label) {
      var pf = _ponGet(suffix, label);
      if (!pf) return null;
      var pd = app.open(pf);
      app.activeDocument = pd;
      if (pd.artboards.length === 0) {
        pd.close(SaveOptions.DONOTSAVECHANGES);
        return null;
      }
      var pr = pd.artboards[0].artboardRect.slice(0);
      var W = pr[2] - pr[0],
        H = pr[1] - pr[3];
      app.activeDocument = doc;
      var dl = doc.activeLayer;
      app.activeDocument = pd;
      var pit = [];
      for (var q = 0; q < pd.pageItems.length; q++) pit.push(pd.pageItems[q]);
      var dup = null,
        offX = 0,
        offY = 0;
      if (pit.length > 0) {
        var pg = pd.groupItems.add();
        for (q = pit.length - 1; q >= 0; q--) {
          try {
            pit[q].move(pg, ElementPlacement.PLACEATBEGINNING);
          } catch (e) {}
        }
        try {
          var gbp = pg.geometricBounds;
          var gcx = (gbp[0] + gbp[2]) / 2,
            gcy = (gbp[1] + gbp[3]) / 2;
          var acx = (pr[0] + pr[2]) / 2,
            acy = (pr[1] + pr[3]) / 2;
          offX = gcx - acx;
          offY = gcy - acy;
        } catch (e) {}
        try {
          dup = pg.duplicate(dl, ElementPlacement.PLACEATEND);
        } catch (e) {}
      }
      app.activeDocument = pd;
      pd.close(SaveOptions.DONOTSAVECHANGES);
      var dd = null;
      for (var di = 0; di < app.documents.length; di++)
        if (app.documents[di].name === destName) {
          dd = app.documents[di];
          break;
        }
      if (dd) {
        doc = dd;
      }
      app.activeDocument = doc;
      return { dup: dup, W: W, H: H, offX: offX, offY: offY };
    }

    var ponMain = loadPon(null, "chính (khổ 65x86 / " + _sizeKey() + ")");
    if (!ponMain) {
      alert("Chưa chọn pon chính. Dừng.");
      return "OK: (dừng)";
    }
    var hasTT4 = false;
    for (var ci2 = 0; ci2 < faces.length; ci2++)
      if (faces[ci2].type === "TT4") {
        hasTT4 = true;
        break;
      }
    var ponTT4 = null;
    if (hasTT4) {
      ponTT4 = loadPon("tt4", "riêng cho cụm 4 (khổ 65x43)");
      if (!ponTT4) {
        alert("Chưa chọn pon TT4. Dừng.");
        return "OK: (dừng)";
      }
    }
    function ponFor(face) {
      return face.type === "TT4" && ponTT4 ? ponTT4 : ponMain;
    }

    var startL, startT;
    if (ponMain.dup) {
      var pgb = ponMain.dup.geometricBounds;
      var rcx = (pgb[0] + pgb[2]) / 2,
        rcy = (pgb[1] + pgb[3]) / 2;
      var ab0Cx = rcx - ponMain.offX,
        ab0Cy = rcy - ponMain.offY;
      startL = ab0Cx - ponMain.W / 2;
      startT = ab0Cy + ponMain.H / 2;
    } else {
      startL = 0;
      startT = 0;
    }

    // Vị trí artboard: AB đi cặp (A trái, B phải) cùng hàng; TT (solo) đứng 1 mình.
    var mainW = ponMain.W;
    var abPos = [];
    var curT = startT;
    var fk = 0;
    while (fk < numFaces) {
      var pA = ponFor(faces[fk]);
      if (faces[fk].type === "AB") {
        // cặp A|B cùng hàng
        abPos[fk] = [startL, curT, startL + pA.W, curT - pA.H];
        var hRow = pA.H;
        if (fk + 1 < numFaces && faces[fk + 1].type === "AB") {
          var pB = ponFor(faces[fk + 1]);
          var lB = startL + mainW + GAP_COL;
          abPos[fk + 1] = [lB, curT, lB + pB.W, curT - pB.H];
          if (pB.H > hRow) hRow = pB.H;
          curT = curT - hRow - GAP_ROW;
          fk += 2;
        } else {
          curT = curT - hRow - GAP_ROW;
          fk += 1;
        }
      } else {
        // TT solo
        abPos[fk] = [startL, curT, startL + pA.W, curT - pA.H];
        curT = curT - pA.H - GAP_ROW;
        fk += 1;
      }
    }

    // Tạo artboard (chưa nhân bản pon).
    for (var k = 0; k < numFaces; k++) {
      try {
        doc.artboards.add(abPos[k]);
      } catch (e) {}
    }
    if (doc.artboards.length > numFaces) {
      for (var a2 = oldAb - 1; a2 >= 0; a2--) {
        try {
          doc.artboards.remove(a2);
        } catch (e) {}
      }
    }

    // ---------- HÀM ĐẶT TRANG ----------
    function centerItem(it, cx, cy) {
      var gb;
      try {
        gb = it.geometricBounds;
      } catch (e) {
        return;
      }
      if (!gb || gb.length < 4) return;
      var ccx = (gb[0] + gb[2]) / 2,
        ccy = (gb[1] + gb[3]) / 2;
      var dx = cx - ccx,
        dy = cy - ccy;
      if (isNaN(dx) || isNaN(dy)) return;
      try {
        it.translate(dx, dy);
      } catch (e) {}
    }
    //  AB / TT8: 4 cột SÁT NHAU (không khe), căn giữa, đỉnh cách 2.37cm.
    //  pageArr = 4 trang THẬT (1-based). rot=true xoay 180.
    function placeRow4(pageArr, rot, pos, cumTop, rowIsTop) {
      var acx = (pos[0] + pos[2]) / 2;
      var leftEdge = acx - (pageWpt * 4) / 2;
      var cy = rowIsTop ? cumTop - pageHpt / 2 : cumTop - pageHpt * 1.5;
      for (var c = 0; c < 4; c++) {
        var it = processed[pageArr[c] - 1];
        if (!it) continue;
        if (rot) {
          try {
            it.rotate(180);
          } catch (e) {}
        }
        centerItem(it, leftEdge + c * pageWpt + pageWpt / 2, cy);
      }
    }
    function placeFace48(face, pos) {
      var cumTop = pos[1] - TOP_GAP; // đỉnh cụm cách đỉnh artboard 2.37cm
      placeRow4(face.top, true, pos, cumTop, true);
      placeRow4(face.bottom, false, pos, cumTop, false);
    }
    //  TT4 (65x43): 2 cụm 2-trang, xoay 90 (trái CCW, phải CW), căn giữa, khe 0.76cm.
    function buildPair(pageL, pageR) {
      var itL = processed[pageL - 1],
        itR = processed[pageR - 1];
      if (!itL || !itR) return null;
      var bl = itL.geometricBounds;
      var lcx = (bl[0] + bl[2]) / 2,
        lcy = (bl[1] + bl[3]) / 2;
      var br = itR.geometricBounds;
      var rcx = (br[0] + br[2]) / 2,
        rcy = (br[1] + br[3]) / 2;
      itR.translate(lcx + pageWpt - rcx, lcy - rcy);
      var grp = null;
      try {
        grp = doc.activeLayer.groupItems.add();
        itL.move(grp, ElementPlacement.PLACEATEND);
        itR.move(grp, ElementPlacement.PLACEATEND);
      } catch (e) {
        grp = null;
      }
      return grp;
    }
    function centerGroup(grp, cx, cy) {
      if (!grp) return;
      var gb;
      try {
        gb = grp.geometricBounds;
      } catch (e) {
        return;
      }
      var gcx = (gb[0] + gb[2]) / 2,
        gcy = (gb[1] + gb[3]) / 2;
      try {
        grp.translate(cx - gcx, cy - gcy);
      } catch (e) {}
    }
    function placeFace4(face, pos) {
      var acx = (pos[0] + pos[2]) / 2,
        acy = (pos[1] + pos[3]) / 2;
      // row = [trái-trên, trái-dưới, phải-trên, phải-dưới]
      // Cụm TRÁI xoay 90 CCW: buildPair(L,R) đặt L-trái R-phải, sau CCW -> L xuống dưới,
      //   R lên trên. Muốn (trái-trên=row[0], trái-dưới=row[1]) => truyền (row[1], row[0]).
      // Cụm PHẢI xoay 90 CW: sau CW -> L lên trên, R xuống dưới.
      //   Muốn (phải-trên=row[2], phải-dưới=row[3]) => truyền (row[2], row[3]).
      var gL = buildPair(face.row[1], face.row[0]); // đảo cho CCW
      var gR = buildPair(face.row[2], face.row[3]);
      if (gL) {
        try {
          gL.rotate(90);
        } catch (e) {}
      } // trái CCW
      if (gR) {
        try {
          gR.rotate(-90);
        } catch (e) {}
      } // phải CW
      var cumW = pageHpt; // bề rộng 1 cụm sau xoay
      var totalW = cumW * 2 + MID_GAP_TT4;
      var leftEdge = acx - totalW / 2;
      centerGroup(gL, leftEdge + cumW / 2, acy);
      centerGroup(gR, leftEdge + cumW + MID_GAP_TT4 + cumW / 2, acy);
    }

    for (var ff = 0; ff < numFaces; ff++) {
      if (faces[ff].type === "TT4") placeFace4(faces[ff], abPos[ff]);
      else placeFace48(faces[ff], abPos[ff]);
    }

    // ---- Nhân bản PON lên trên cùng (đúng loại theo face) ----
    for (var kp = 0; kp < numFaces; kp++) {
      var posP = abPos[kp];
      var pf = ponFor(faces[kp]);
      if (pf.dup) {
        try {
          var g = pf.dup.duplicate(
            doc.activeLayer,
            ElementPlacement.PLACEATBEGINNING,
          );
          var gb2 = g.geometricBounds;
          var gcx2 = (gb2[0] + gb2[2]) / 2,
            gcy2 = (gb2[1] + gb2[3]) / 2;
          var acx2 = (posP[0] + posP[2]) / 2,
            acy2 = (posP[1] + posP[3]) / 2;
          g.translate(acx2 + pf.offX - gcx2, acy2 + pf.offY - gcy2);
        } catch (e) {}
      }
    }
    try {
      if (ponMain.dup) ponMain.dup.remove();
    } catch (e) {}
    try {
      if (ponTT4 && ponTT4.dup) ponTT4.dup.remove();
    } catch (e) {}

    // ============================================================
    //  GHI CHÚ "RUỘT N" (giống signature): mép trái vào 2cm, mép trên xuống 1.1cm.
    //  Điền mặt A của mỗi tay. N = số tay (ruột).
    // ============================================================
    function showNoteDialog() {
      var w = new Window("dialog", "Nhập ghi chú");
      w.orientation = "column";
      w.alignChildren = "fill";
      w.margins = 16;
      w.spacing = 10;
      w.add(
        "statictext",
        undefined,
        "Ghi chú RUỘT (tool tự điền 'RUỘT N', bạn gõ thêm phía sau):",
      );
      var edRuot = w.add("edittext", undefined, "");
      edRuot.characters = 40;
      var row = w.add("group");
      row.alignment = "right";
      var btnCancel = row.add("button", undefined, "Bỏ qua", {
        name: "cancel",
      });
      var btnOK = row.add("button", undefined, "Điền ghi chú", { name: "ok" });
      var res = null;
      btnOK.onClick = function () {
        res = { ruot: edRuot.text };
        w.close();
      };
      btnCancel.onClick = function () {
        res = null;
        w.close();
      };
      w.show();
      return res;
    }
    function setNoteStyle(tf) {
      try {
        tf.textRange.characterAttributes.size = 13;
      } catch (e) {}
      try {
        var black = new CMYKColor();
        black.black = 100;
        tf.textRange.characterAttributes.fillColor = black;
      } catch (e) {
        try {
          var rgb = new RGBColor();
          rgb.red = 0;
          rgb.green = 0;
          rgb.blue = 0;
          tf.textRange.characterAttributes.fillColor = rgb;
        } catch (e2) {}
      }
    }
    //  Ghi chú NGANG (AB / TT8, 65x86): mép trái vào 2cm, mép trên xuống 1.1cm.
    function addNote8(text, pos) {
      if (!text) return;
      try {
        var tf = doc.activeLayer.textFrames.add();
        tf.contents = text;
        setNoteStyle(tf);
        tf.position = [pos[0] + 20 * MM, pos[1] - 11 * MM];
      } catch (e) {}
    }
    //  Ghi chú DỌC (TT4, 65x43): xoay 90 CCW, mép dưới lên 1.5cm, mép trái vào 0.9cm.
    function addNote4(text, pos) {
      if (!text) return;
      try {
        var tf = doc.activeLayer.textFrames.add();
        tf.contents = text;
        setNoteStyle(tf);
        tf.position = [0, 0];
        try {
          tf.rotate(90);
        } catch (e) {}
        var tb = tf.visibleBounds;
        tf.translate(pos[0] + 9 * MM - tb[0], pos[3] + 15 * MM - tb[3]);
      } catch (e) {}
    }

    var note = showNoteDialog();
    if (note) {
      for (var ni = 0; ni < numFaces; ni++) {
        var face = faces[ni];
        // AB: chỉ điền MẶT A (label kết thúc "-A"); mặt B bỏ qua.
        if (face.type === "AB" && face.label.indexOf("-B") >= 0) continue;
        var txt = "RUỘT " + face.sheetNo + (note.ruot ? " " + note.ruot : "");
        if (face.type === "TT4") addNote4(txt, abPos[ni]);
        else addNote8(txt, abPos[ni]);
      }
    }

    app.redraw();
    alert(
      "Đã dàn keo gáy: " +
        numFaces +
        " artboard.\n" +
        "AB tuần tự 16 trang/tay; phần dư tự trở (TT8/TT4) ở cuối.\n" +
        "Pon trên cùng. Ghi chú RUỘT N đã điền (mặt A).",
    );
  } catch (e) {
    return "ERR: keo gáy: " + e.toString();
  }
  return "OK: Đã dàn keo gáy.";
}

// ============================================================
//  DÀN THEO MẪU (tích hợp vào panel) — 2 hàm gọi từ CEP:
//    dcHocMau()  = FILE 1 (học mẫu, bước 1/2)
//    dcApMau(multiSourcePerArtboard) = FILE 2 (áp mẫu, bước 2/2)
//  Logic giữ nguyên từ 1_hoc_mau.jsx / 2_ap_mau.jsx (bản Loc gửi).
//  Chỉ đổi: bọc thành hàm, trả chuỗi "OK:"/"ERR:" cho panel.
// ============================================================

// ---------- FILE 1: HỌC MẪU ----------
function dcHocMau() {
  var MM = 2.834645669;
  if (app.documents.length === 0) {
    alert("Chưa mở tài liệu.");
    return "ERR: Chưa mở tài liệu.";
  }
  var doc = app.activeDocument;
  var sel = doc.selection;
  if (!sel || sel.length === 0) {
    alert("Hãy chọn TẤT CẢ bản mẫu đã dàn tay.");
    return "ERR: Chưa chọn bản mẫu.";
  }

  // ---------- Hỏi kiểu: 1 mặt / mặt trước / mặt sau ----------
  // Dùng nút riêng cho từng lựa chọn để tránh ScriptUI giữ sai trạng thái
  // radiobutton, khiến mẫu 1 mặt bị lưu nhầm thành "Mặt trước".
  var w = new Window("dialog", "Học mẫu - chọn loại bố cục");
  w.orientation = "column";
  w.alignChildren = "fill";
  w.margins = 14;
  w.spacing = 8;
  w.add("statictext", undefined, "Bấm đúng loại bố cục đang chọn:");
  var which = "";
  var btnOne = w.add("button", undefined, "Học 1 mặt");
  var btnFront = w.add("button", undefined, "Học Mặt TRƯỚC (bố cục 2 mặt)");
  var btnBack = w.add("button", undefined, "Học Mặt SAU (bố cục 2 mặt)");
  var gg = w.add("group");
  gg.alignment = "right";
  gg.add("button", undefined, "Hủy", { name: "cancel" });
  btnOne.onClick = function () {
    which = "one";
    w.close(1);
  };
  btnFront.onClick = function () {
    which = "front";
    w.close(1);
  };
  btnBack.onClick = function () {
    which = "back";
    w.close(1);
  };
  if (w.show() !== 1 || which === "") return "ERR: Đã hủy.";

  // ---------- đo và lưu biên dạng thật ----------
  // V3 không chỉ học visibleBounds. Mỗi path Bézier của slot được chuẩn hóa
  // theo khung riêng của nó để có thể dựng lại thành clipping mask khi áp mẫu.
  function rootOfPath(path) {
    try {
      if (path.parent && path.parent.typename === "CompoundPathItem")
        return path.parent;
    } catch (e) {}
    return path;
  }
  function clippingRoot(group) {
    var fallback = null;
    try {
      var pp = group.pathItems;
      for (var i = 0; i < pp.length; i++) {
        var isClip = false;
        try {
          isClip = pp[i].clipping === true;
        } catch (e) {}
        if (!isClip) continue;
        var root = rootOfPath(pp[i]);
        try {
          if (root.parent === group) return root;
        } catch (e2) {}
        if (!fallback) fallback = root;
      }
    } catch (e3) {}
    // Một số bản Illustrator không đưa path nằm trong CompoundPathItem vào
    // group.pathItems, nên quét collection compound trực tiếp thêm một lần.
    try {
      var cps = group.compoundPathItems;
      for (var ci = 0; ci < cps.length; ci++) {
        for (var cj = 0; cj < cps[ci].pathItems.length; cj++) {
          var compoundClip = false;
          try {
            compoundClip = cps[ci].pathItems[cj].clipping === true;
          } catch (e4) {}
          if (!compoundClip) continue;
          try {
            if (cps[ci].parent === group) return cps[ci];
          } catch (e5) {}
          if (!fallback) fallback = cps[ci];
        }
      }
    } catch (e6) {}
    return fallback;
  }
  function clipMaskBounds(item) {
    try {
      if (item.typename === "GroupItem" && item.clipped === true) {
        var root = clippingRoot(item);
        if (root) return root.geometricBounds;
      }
    } catch (e) {}
    return null;
  }
  function bnd(item) {
    var mb = clipMaskBounds(item);
    if (mb) return mb;
    try {
      return item.visibleBounds;
    } catch (e) {
      try {
        return item.geometricBounds;
      } catch (e2) {
        return null;
      }
    }
  }
  function shapeKind(item) {
    var type = "";
    try {
      type = item.typename;
    } catch (e) {}
    if (type === "GroupItem") {
      try {
        if (item.clipped === true) return "clip";
      } catch (e2) {}
      return "group";
    }
    if (type === "CompoundPathItem") return "compound";
    if (type === "PathItem") return "path";
    if (type === "TextFrame") return "text";
    if (type === "PlacedItem" || type === "RasterItem") return "image";
    return type || "object";
  }
  function readAngle(item) {
    var m = null;
    try {
      m = item.matrix;
    } catch (e) {}
    if (!m) return null;
    var ang = (Math.atan2(m.mValueB, m.mValueA) * 180) / Math.PI;
    ang = ang % 360;
    if (ang < 0) ang += 360;
    return ang;
  }
  function normDeg(ang) {
    ang = ang % 360;
    return ang < 0 ? ang + 360 : ang;
  }
  function directKids(group) {
    var result = [];
    try {
      for (var i = 0; i < group.pageItems.length; i++) {
        var child = group.pageItems[i];
        try {
          if (child.parent === group) result.push(child);
        } catch (e) {}
      }
    } catch (e2) {}
    return result;
  }
  function isMaskDesc(item, maskRoot) {
    if (!maskRoot) return false;
    try {
      if (item === maskRoot) return true;
    } catch (e) {}
    try {
      if (
        item.typename === "PathItem" &&
        (item.clipping === true || rootOfPath(item) === maskRoot)
      )
        return true;
    } catch (e2) {}
    return false;
  }
  function itemAngleWeight(item) {
    var gb = geoBounds(item);
    if (!gb) return 0;
    var iw = Math.abs(gb[2] - gb[0]),
      ih = Math.abs(gb[1] - gb[3]);
    if (iw < 0.01 || ih < 0.01) return 0;
    // Vòng tròn/mask vuông không chứa thông tin hướng. Text và ảnh vẫn được
    // giữ vì pixel bên trong có thể có hướng dù khung là hình vuông.
    var ratio = Math.max(iw, ih) / Math.min(iw, ih);
    var directional = Math.min(1, Math.max(0, (ratio - 1) / 0.2));
    var type = "";
    try {
      type = item.typename;
    } catch (e) {}
    if (type === "TextFrame") directional = Math.max(directional, 0.75);
    if (type === "PlacedItem" || type === "RasterItem")
      directional = Math.max(directional, 0.35);
    if (directional < 0.08) return 0;
    return Math.sqrt(iw * ih) * directional;
  }
  function readContentAngle(slot) {
    var maskRoot = null;
    try {
      if (slot.typename === "GroupItem" && slot.clipped === true)
        maskRoot = clippingRoot(slot);
    } catch (e) {}
    var candidates = [];
    function walk(item, isOuter) {
      if (!item || isMaskDesc(item, maskRoot)) return;
      try {
        if (item.hidden === true || item.opacity === 0) return;
      } catch (e) {}
      var type = "";
      try {
        type = item.typename;
      } catch (e2) {}
      // Không lấy matrix của group vỏ: với clip tròn nó có thể quay mà hình
      // nhìn thấy bên trong không quay. Chỉ học matrix của artwork thực.
      if (!isOuter) {
        var weight = itemAngleWeight(item),
          angle = readAngle(item);
        if (weight > 0 && angle !== null)
          candidates.push({ angle: angle, weight: weight });
      }
      if (type === "GroupItem") {
        var kids = directKids(item);
        for (var k = 0; k < kids.length; k++) walk(kids[k], false);
      }
    }
    walk(slot, true);
    if (candidates.length === 0) return readAngle(slot);
    // Sticker tròn thường dùng 0/90/180/270. Vote tách 0 với 180 để không
    // mất hướng khi khung ngoài là hình tròn hoặc hình vuông.
    var bins = [0, 0, 0, 0],
      total = 0,
      i;
    for (i = 0; i < candidates.length; i++) {
      var q = Math.round(normDeg(candidates[i].angle) / 90) % 4;
      bins[q] += candidates[i].weight;
      total += candidates[i].weight;
    }
    var best = 0;
    for (i = 1; i < 4; i++) if (bins[i] > bins[best]) best = i;
    if (bins[best] >= total * 0.48) return best * 90;
    // Với artwork quay tự do, lấy trung bình vòng có trọng số.
    var sx = 0,
      sy = 0;
    for (i = 0; i < candidates.length; i++) {
      var rad = (candidates[i].angle * Math.PI) / 180;
      sx += Math.cos(rad) * candidates[i].weight;
      sy += Math.sin(rad) * candidates[i].weight;
    }
    return normDeg((Math.atan2(sy, sx) * 180) / Math.PI);
  }
  function isClosedPath(path) {
    try {
      return path.closed === true && path.pathPoints.length >= 3;
    } catch (e) {
      return false;
    }
  }
  function geoBounds(item) {
    try {
      var g = item.geometricBounds;
      if (g && g.length === 4 && g[2] > g[0] && g[1] > g[3]) return g;
    } catch (e) {}
    return null;
  }
  function pointArray(point, prop) {
    try {
      var a = point[prop];
      if (a && a.length >= 2 && isFinite(a[0]) && isFinite(a[1]))
        return [a[0], a[1]];
    } catch (e) {}
    return null;
  }
  function describePath(path, frame) {
    if (!isClosedPath(path)) return null;
    var fw = frame[2] - frame[0],
      fh = frame[1] - frame[3];
    if (!(fw > 0 && fh > 0)) return null;
    var cx = (frame[0] + frame[2]) / 2,
      cy = (frame[1] + frame[3]) / 2;
    var pts = [];
    try {
      for (var i = 0; i < path.pathPoints.length; i++) {
        var pp = path.pathPoints[i];
        var a = pointArray(pp, "anchor"),
          l = pointArray(pp, "leftDirection"),
          r = pointArray(pp, "rightDirection");
        if (!a || !l || !r) return null;
        var typ = "C";
        try {
          if (pp.pointType === PointType.SMOOTH) typ = "S";
        } catch (e) {}
        pts.push({
          ax: (a[0] - cx) / fw,
          ay: (a[1] - cy) / fh,
          lx: (l[0] - cx) / fw,
          ly: (l[1] - cy) / fh,
          rx: (r[0] - cx) / fw,
          ry: (r[1] - cy) / fh,
          typ: typ,
        });
      }
    } catch (e2) {
      return null;
    }
    var even = false;
    try {
      even = path.evenodd === true;
    } catch (e3) {}
    return { closed: true, evenodd: even, pts: pts };
  }
  function describeRoot(root) {
    if (!root) return null;
    var frame = geoBounds(root);
    if (!frame) return null;
    var type = "";
    try {
      type = root.typename;
    } catch (e) {}
    var paths = [],
      i,
      d;
    if (type === "PathItem") {
      d = describePath(root, frame);
      if (d) paths.push(d);
    } else if (type === "CompoundPathItem") {
      try {
        for (i = 0; i < root.pathItems.length; i++) {
          d = describePath(root.pathItems[i], frame);
          if (!d) return null;
          paths.push(d);
        }
      } catch (e2) {
        return null;
      }
    } else return null;
    if (paths.length === 0) return null;
    return {
      root: type === "CompoundPathItem" ? "compound" : "path",
      frame: frame,
      paths: paths,
    };
  }
  function getSlotShape(item) {
    var type = "";
    try {
      type = item.typename;
    } catch (e) {}
    if (type === "PathItem" || type === "CompoundPathItem")
      return describeRoot(item);
    if (type === "GroupItem") {
      var root = null;
      try {
        if (item.clipped === true) root = clippingRoot(item);
      } catch (e2) {}
      // Group ghép nhiều artwork không có một contour duy nhất đáng tin cậy.
      // Không đoán path lớn nhất để tránh cắt mất nội dung; dùng clip mask
      // tường minh nếu có, còn lại raster alpha theo khung của group.
      return describeRoot(root);
    }
    return null;
  }
  function n6(v) {
    return Number(v).toFixed(6);
  }
  function encodeRing(ring) {
    var parts = [];
    for (var i = 0; i < ring.pts.length; i++) {
      var p = ring.pts[i];
      parts.push(
        n6(p.ax) +
          "," +
          n6(p.ay) +
          "," +
          n6(p.lx) +
          "," +
          n6(p.ly) +
          "," +
          n6(p.rx) +
          "," +
          n6(p.ry) +
          "," +
          p.typ,
      );
    }
    return parts.join(";");
  }

  // ---------- đo bố cục đang chọn ----------
  var items = [];
  var X0 = null,
    Y0 = null,
    X1 = null,
    Y1 = null;
  for (var i = 0; i < sel.length; i++) {
    var shape = getSlotShape(sel[i]);
    // Với path/mask thật, geometricBounds chính là khung của silhouette.
    // Các object không có contour vector vẫn học được khung để báo fallback rõ ràng.
    var b = shape ? shape.frame : bnd(sel[i]);
    if (!b) continue;
    var cx = (b[0] + b[2]) / 2,
      cy = (b[1] + b[3]) / 2,
      wI = b[2] - b[0],
      hI = b[1] - b[3];
    var ang = readContentAngle(sel[i]);
    items.push({
      cx: cx,
      cy: cy,
      w: wI,
      h: hI,
      landscape: wI >= hI,
      angle: ang === null ? -1 : ang,
      kind: shapeKind(sel[i]),
      shape: shape,
    });
    if (X0 === null) {
      X0 = b[0];
      Y0 = b[1];
      X1 = b[2];
      Y1 = b[3];
    } else {
      if (b[0] < X0) X0 = b[0];
      if (b[1] > Y0) Y0 = b[1];
      if (b[2] > X1) X1 = b[2];
      if (b[3] < Y1) Y1 = b[3];
    }
  }
  if (items.length === 0) {
    alert("Không đo được bản mẫu nào.");
    return "ERR: Không đo được bản mẫu.";
  }
  var gcx = (X0 + X1) / 2,
    gcy = (Y0 + Y1) / 2;
  var m0 = items[0];
  var sideHi = Math.max(m0.w, m0.h) / MM,
    sideLo = Math.min(m0.w, m0.h) / MM;
  var slots = [];
  for (var k = 0; k < items.length; k++) {
    // Lưu khung của TỪNG slot. Không dùng một khổ chữ nhật chung cho mọi hình.
    slots.push({
      dx: items[k].cx - gcx,
      dy: items[k].cy - gcy,
      land: items[k].landscape,
      angle: items[k].angle,
      w: items[k].w,
      h: items[k].h,
      kind: items[k].kind,
      shape: items[k].shape,
    });
  }

  // ---------- ghi file tạm ----------
  var f = new File(Folder.temp + "/dan_theo_mau_tmp.txt");

  function writeBlock(fh, tag) {
    fh.write("BLOCK\t" + tag + "\n");
    fh.write("sideHi\t" + sideHi.toFixed(4) + "\n");
    fh.write("sideLo\t" + sideLo.toFixed(4) + "\n");
    fh.write("n\t" + slots.length + "\n");
    for (var s = 0; s < slots.length; s++) {
      fh.write(
        "slot\t" +
          slots[s].dx.toFixed(4) +
          "\t" +
          slots[s].dy.toFixed(4) +
          "\t" +
          (slots[s].land ? "1" : "0") +
          "\t" +
          (slots[s].angle >= 0 ? slots[s].angle.toFixed(4) : "-1") +
          "\t" +
          slots[s].w.toFixed(4) +
          "\t" +
          slots[s].h.toFixed(4) +
          "\t" +
          slots[s].kind +
          "\n",
      );
    }
    // Mỗi ring nằm trên dòng riêng để đường Bézier phức tạp không tạo line quá dài.
    for (s = 0; s < slots.length; s++) {
      var mask = slots[s].shape;
      if (!mask || !mask.paths || mask.paths.length === 0) continue;
      fh.write(
        "mask\t" + s + "\t" + mask.root + "\t" + mask.paths.length + "\n",
      );
      for (var r = 0; r < mask.paths.length; r++) {
        var ring = mask.paths[r];
        fh.write(
          "ring\t" +
            s +
            "\t" +
            r +
            "\t" +
            (ring.closed ? "1" : "0") +
            "\t" +
            (ring.evenodd ? "1" : "0") +
            "\t" +
            encodeRing(ring) +
            "\n",
        );
      }
    }
  }

  var maskCount = 0;
  for (var mi = 0; mi < slots.length; mi++) if (slots[mi].shape) maskCount++;
  var maskNote =
    "Đã lưu " +
    maskCount +
    "/" +
    slots.length +
    " biên dạng vector để cắt sau khi raster.";
  if (maskCount < slots.length)
    maskNote +=
      "\nCác slot còn lại không có path/mask kín nên sẽ dùng khung raster.";
  function exportSlotPreviews() {
    var result = { files: [], error: "" },
      previewDoc = null,
      originalDoc = doc;
    var stamp = new Date().getTime();
    try {
      previewDoc = app.documents.add(DocumentColorSpace.RGB, 100, 100);
      var opt = new ExportOptionsPNG24();
      try {
        opt.transparency = true;
      } catch (e) {}
      try {
        opt.artBoardClipping = true;
      } catch (e2) {}
      try {
        opt.horizontalScale = 100;
        opt.verticalScale = 100;
      } catch (e3) {}
      for (var pi = 0; pi < sel.length; pi++) {
        app.activeDocument = originalDoc;
        var copied = sel[pi].duplicate(
          previewDoc.layers[0],
          ElementPlacement.PLACEATEND,
        );
        app.activeDocument = previewDoc;
        var pb = bnd(copied);
        if (!pb)
          throw new Error("Không đo được preview vị trí " + (pi + 1) + ".");
        previewDoc.artboards[0].artboardRect = [pb[0], pb[1], pb[2], pb[3]];
        var png = new File(
          Folder.temp + "/dan_theo_mau_thumb_" + stamp + "_" + pi + ".png",
        );
        previewDoc.exportFile(png, ExportType.PNG24, opt);
        try {
          copied.remove();
        } catch (removeCopyError) {}
        if (!png.exists)
          throw new Error("Không xuất được preview vị trí " + (pi + 1) + ".");
        result.files.push(png.fsName);
      }
    } catch (err) {
      result.error = String(err);
    }
    try {
      if (previewDoc) previewDoc.close(SaveOptions.DONOTSAVECHANGES);
    } catch (closeError) {}
    try {
      app.activeDocument = originalDoc;
    } catch (restoreError) {}
    return result;
  }
  function pendingVisualAngles(tag) {
    // Raster/Placed có thể đã chứa artwork quay sẵn nên matrix = 0. Export
    // thumbnail để panel so pixel và học đúng 0/90/180/270 của ảnh nhìn thấy.
    var previews = exportSlotPreviews();
    if (previews.error || previews.files.length !== slots.length)
      return (
        "ERR: Không tạo được thumbnail để học hướng artwork. " + previews.error
      );
    return "PENDING:" + tag + "|" + previews.files.join("|");
  }

  if (which === "one") {
    f.encoding = "UTF-8";
    f.open("w");
    f.write(
      "# dan theo mau v5 - raster mask va huong artwork\nMODE\tone\nSTATE\tpending\n",
    );
    writeBlock(f, "F");
    f.close();
    return pendingVisualAngles("F");
  } else if (which === "front") {
    f.encoding = "UTF-8";
    f.open("w");
    f.write(
      "# dan theo mau v5 - raster mask va huong artwork\nMODE\ttwo\nSTATE\tpending\n",
    );
    writeBlock(f, "F");
    f.close();
    return pendingVisualAngles("F");
  } else {
    if (!f.exists) {
      alert("Chưa học mặt trước. Hãy học 'Mặt TRƯỚC' trước.");
      return "ERR: Chưa học MẶT TRƯỚC.";
    }
    f.encoding = "UTF-8";
    f.open("r");
    var old = f.read();
    f.close();
    if (old.indexOf("MODE\ttwo") < 0)
      old = old.replace(/MODE\tone/, "MODE\ttwo");
    if (old.indexOf("STATE\t") >= 0)
      old = old.replace(/STATE\t[^\r\n]*/, "STATE\tpending");
    else old = old.replace(/(MODE\ttwo\r?\n?)/, "$1STATE\tpending\n");
    var cut = old.indexOf("BLOCK\tB");
    if (cut >= 0) old = old.substring(0, cut);
    if (old.length > 0 && old.charAt(old.length - 1) !== "\n") old += "\n";
    f.encoding = "UTF-8";
    f.open("w");
    f.write(old);
    writeBlock(f, "B");
    f.close();
    return pendingVisualAngles("B");
  }
}

// Panel gọi sau khi đã so pixel các thumbnail do dcHocMau xuất ra.
function dcHocMauCapNhatGoc(tag, csvAngles) {
  var f = new File(Folder.temp + "/dan_theo_mau_tmp.txt");
  if (!f.exists) return "ERR: Không tìm thấy dữ liệu mẫu đang chờ hoàn tất.";
  f.encoding = "UTF-8";
  f.open("r");
  var all = f.read();
  f.close();
  if (all.indexOf("# dan theo mau v5") < 0)
    return "ERR: Dữ liệu mẫu không đúng phiên bản học hướng.";
  var values = String(csvAngles || "").split(","),
    lines = all.split(/\r\n|\r|\n/);
  var current = "",
    used = 0,
    mode = "one",
    stateWritten = false;
  for (var i = 0; i < lines.length; i++) {
    var p = lines[i].split("\t");
    if (p[0] === "MODE") mode = p[1];
    else if (p[0] === "STATE") {
      lines[i] = "STATE\tready";
      stateWritten = true;
    } else if (p[0] === "BLOCK") current = p[1];
    else if (p[0] === "slot" && current === tag) {
      if (used >= values.length) return "ERR: Thiếu dữ liệu hướng artwork.";
      var angle = parseFloat(values[used++]);
      if (!isFinite(angle)) return "ERR: Dữ liệu hướng artwork không hợp lệ.";
      angle = angle % 360;
      if (angle < 0) angle += 360;
      p[4] = angle.toFixed(4);
      lines[i] = p.join("\t");
    }
  }
  if (used === 0 || used !== values.length)
    return "ERR: Số hướng artwork không khớp số slot.";
  if (!stateWritten) return "ERR: Dữ liệu mẫu đang thiếu trạng thái hoàn tất.";
  f.encoding = "UTF-8";
  f.open("w");
  f.write(lines.join("\n"));
  f.close();
  var msg;
  if (tag === "B")
    msg =
      "Đã HỌC MẶT SAU (" +
      used +
      " vị trí) và nhận diện hướng artwork từ ảnh mẫu.\nGiờ bấm Áp mẫu, chọn nguồn mặt trước rồi mặt sau.";
  else if (mode === "two")
    msg =
      "Đã HỌC MẶT TRƯỚC (" +
      used +
      " vị trí) và nhận diện hướng artwork từ ảnh mẫu.\nGiờ chọn bố cục MẶT SAU, bấm Học mẫu và chọn 'Mặt SAU'.";
  else
    msg =
      "Đã HỌC 1 mặt (" +
      used +
      " vị trí) và nhận diện hướng artwork từ ảnh mẫu.\nChọn CON NGUỒN rồi bấm Áp mẫu.";
  alert(msg);
  return "OK: " + msg.replace(/\n/g, " ");
}

function dcXoaPreviewMau(pathsText) {
  var paths = String(pathsText || "").split("|");
  for (var i = 0; i < paths.length; i++) {
    try {
      var f = new File(paths[i]);
      if (f.exists) f.remove();
    } catch (e) {}
  }
  return "OK";
}

// ---------- FILE 2: ÁP MẪU ----------
function dcApMau(multiSourcePerArtboard) {
  var MM = 2.834645669;
  // Mặc định giữ cách dàn gốc: 1 con nguồn -> 1 artboard.
  // Chỉ khi tick trên panel mới gán nhiều nguồn khác nhau vào từng slot.
  var useMultiSource = multiSourcePerArtboard === true;
  if (app.documents.length === 0) {
    alert("Chưa mở tài liệu.");
    return "ERR: Chưa mở tài liệu.";
  }
  var doc = app.activeDocument;
  var sel = doc.selection;
  if (!sel || sel.length === 0) {
    alert("Hãy chọn các CON NGUỒN cần dàn.");
    return "ERR: Chưa chọn con nguồn.";
  }

  // ---------- đọc bố cục đã học ----------
  var f = new File(Folder.temp + "/dan_theo_mau_tmp.txt");
  if (!f.exists) {
    alert("Chưa có dữ liệu mẫu.\nHãy bấm Học mẫu trước.");
    return "ERR: Chưa có dữ liệu mẫu. Học mẫu trước.";
  }
  f.encoding = "UTF-8";
  f.open("r");
  var all = f.read();
  f.close();
  if (all.indexOf("# dan theo mau v5") < 0) {
    alert(
      "Dữ liệu mẫu cũ chưa có hướng artwork nhìn thấy.\nHãy bấm Học mẫu lại để lưu biên dạng và góc thật của từng vị trí.",
    );
    return "ERR: Dữ liệu mẫu cũ. Học mẫu lại để lưu biên dạng và hướng artwork.";
  }
  if (all.indexOf("STATE\tready") < 0) {
    alert(
      "Dữ liệu mẫu đang chờ đọc hướng artwork.\nHãy đợi Học mẫu chạy xong, hoặc bấm Học mẫu lại.",
    );
    return "ERR: Học mẫu chưa hoàn tất nhận diện hướng artwork.";
  }
  var lines = all.split(/\r\n|\r|\n/);

  var MODE = "one";
  var blocks = { F: null, B: null };
  var cur = null;
  function decodeRing(data, closed, evenodd) {
    if (!data) return null;
    var source = data.split(";"),
      pts = [];
    for (var ri = 0; ri < source.length; ri++) {
      if (!source[ri]) continue;
      var q = source[ri].split(",");
      if (q.length < 7) return null;
      var n = [];
      for (var qi = 0; qi < 6; qi++) {
        n[qi] = parseFloat(q[qi]);
        if (!isFinite(n[qi])) return null;
      }
      pts.push({
        ax: n[0],
        ay: n[1],
        lx: n[2],
        ly: n[3],
        rx: n[4],
        ry: n[5],
        typ: q[6] === "S" ? "S" : "C",
      });
    }
    if (pts.length < 3) return null;
    return { closed: closed === "1", evenodd: evenodd === "1", pts: pts };
  }
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    if (!ln || ln.charAt(0) == "#") continue;
    var p = ln.split("\t");
    if (p[0] == "MODE") {
      MODE = p[1];
    } else if (p[0] == "BLOCK") {
      cur = { sideHi: 0, sideLo: 0, slots: [] };
      blocks[p[1]] = cur;
    } else if (p[0] == "sideHi" && cur) cur.sideHi = parseFloat(p[1]);
    else if (p[0] == "sideLo" && cur) cur.sideLo = parseFloat(p[1]);
    else if (p[0] == "slot" && cur)
      cur.slots.push({
        dx: parseFloat(p[1]),
        dy: parseFloat(p[2]),
        land: p[3] == "1",
        angle: p[4] != null ? parseFloat(p[4]) : -1,
        w: p[5] != null ? parseFloat(p[5]) : 0,
        h: p[6] != null ? parseFloat(p[6]) : 0,
        kind: p[7] || "legacy",
        shape: null,
      });
    else if (p[0] == "mask" && cur) {
      var maskIndex = parseInt(p[1], 10);
      if (isFinite(maskIndex) && cur.slots[maskIndex]) {
        cur.slots[maskIndex].shape = {
          root: p[2] === "compound" ? "compound" : "path",
          expected: parseInt(p[3], 10),
          paths: [],
        };
      }
    } else if (p[0] == "ring" && cur) {
      var ringSlot = parseInt(p[1], 10),
        ringIndex = parseInt(p[2], 10);
      if (isFinite(ringSlot) && isFinite(ringIndex) && cur.slots[ringSlot]) {
        var targetSlot = cur.slots[ringSlot];
        if (!targetSlot.shape)
          targetSlot.shape = { root: "path", expected: 0, paths: [] };
        var decoded = decodeRing(p[5], p[3], p[4]);
        if (decoded) targetSlot.shape.paths[ringIndex] = decoded;
      }
    } else if (p[0] == "sideHi") {
      if (!blocks.F) blocks.F = { sideHi: 0, sideLo: 0, slots: [] };
      blocks.F.sideHi = parseFloat(p[1]);
      cur = blocks.F;
    }
  }
  if (!blocks.F || blocks.F.slots.length === 0) {
    alert("Bố cục mẫu rỗng. Học mẫu lại.");
    return "ERR: Bố cục mẫu rỗng.";
  }
  if (MODE === "two" && (!blocks.B || blocks.B.slots.length === 0)) {
    alert("Mẫu 2 mặt nhưng chưa học MẶT SAU. Học mẫu lại MẶT SAU.");
    return "ERR: Chưa học MẶT SAU.";
  }

  // Do not start output from a damaged or incomplete template file. Every
  // learned slot needs a real position and size; templates may still mix
  // circles, rectangles, and arbitrary vector masks.
  function validateLearnedBlock(block, label) {
    if (!block || !block.slots || block.slots.length === 0)
      return "ERR: Mẫu " + label + " không có vị trí.";
    for (var vi = 0; vi < block.slots.length; vi++) {
      var vs = block.slots[vi];
      if (
        !isFinite(vs.dx) ||
        !isFinite(vs.dy) ||
        !isPositiveSize(vs.w) ||
        !isPositiveSize(vs.h) ||
        !isFinite(vs.angle)
      )
        return (
          "ERR: Mẫu " +
          label +
          " có dữ liệu không hợp lệ ở vị trí " +
          (vi + 1) +
          ". Hãy Học mẫu lại."
        );
    }
    return "";
  }
  var learnedError = validateLearnedBlock(blocks.F, "MẶT TRƯỚC");
  if (!learnedError && MODE === "two")
    learnedError = validateLearnedBlock(blocks.B, "MẶT SAU");
  if (learnedError) {
    alert(learnedError.substring(5));
    return learnedError;
  }

  var slots = blocks.F.slots;
  var sideHi = blocks.F.sideHi;
  var sideLo = blocks.F.sideLo;
  var sideHiPt = sideHi * MM,
    sideLoPt = sideLo * MM;

  // ---------- helper ----------
  function makeRO() {
    var ro = new RasterizeOptions();
    try {
      ro.resolution = 400;
    } catch (e) {}
    try {
      ro.transparency = true;
    } catch (e) {}
    try {
      ro.padding = 0;
    } catch (e) {}
    try {
      ro.clippingMask = false;
    } catch (e) {}
    try {
      ro.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
    } catch (e) {}
    try {
      ro.convertSpotColors = false;
    } catch (e) {}
    return ro;
  }
  function rootOfPath(path) {
    try {
      if (path.parent && path.parent.typename === "CompoundPathItem")
        return path.parent;
    } catch (e) {}
    return path;
  }
  function clippingRoot(group) {
    var fallback = null;
    try {
      var pp = group.pathItems;
      for (var ci = 0; ci < pp.length; ci++) {
        var isClip = false;
        try {
          isClip = pp[ci].clipping === true;
        } catch (e) {}
        if (!isClip) continue;
        var root = rootOfPath(pp[ci]);
        try {
          if (root.parent === group) return root;
        } catch (e2) {}
        if (!fallback) fallback = root;
      }
    } catch (e3) {}
    try {
      var cps = group.compoundPathItems;
      for (var cpi = 0; cpi < cps.length; cpi++) {
        for (var cpj = 0; cpj < cps[cpi].pathItems.length; cpj++) {
          var compoundClip = false;
          try {
            compoundClip = cps[cpi].pathItems[cpj].clipping === true;
          } catch (e4) {}
          if (!compoundClip) continue;
          try {
            if (cps[cpi].parent === group) return cps[cpi];
          } catch (e5) {}
          if (!fallback) fallback = cps[cpi];
        }
      }
    } catch (e6) {}
    return fallback;
  }
  function clipMaskBounds(item) {
    try {
      if (item.typename === "GroupItem" && item.clipped === true) {
        var root = clippingRoot(item);
        if (root) return root.geometricBounds;
      }
    } catch (e) {}
    return null;
  }
  function bnd(item) {
    var mb = clipMaskBounds(item);
    if (mb) return mb;
    try {
      return item.visibleBounds;
    } catch (e) {
      try {
        return item.geometricBounds;
      } catch (e2) {
        return null;
      }
    }
  }
  function readAngle(item) {
    var m = null;
    try {
      m = item.matrix;
    } catch (e) {}
    if (!m) return null;
    var ang = (Math.atan2(m.mValueB, m.mValueA) * 180) / Math.PI;
    ang = ang % 360;
    if (ang < 0) ang += 360;
    return ang;
  }
  function normDeg(ang) {
    ang = ang % 360;
    return ang < 0 ? ang + 360 : ang;
  }
  function geoBounds(item) {
    try {
      var g = item.geometricBounds;
      if (g && g.length === 4 && g[2] > g[0] && g[1] > g[3]) return g;
    } catch (e) {}
    return null;
  }
  function directKids(group) {
    var result = [];
    try {
      for (var i = 0; i < group.pageItems.length; i++) {
        var child = group.pageItems[i];
        try {
          if (child.parent === group) result.push(child);
        } catch (e) {}
      }
    } catch (e2) {}
    return result;
  }
  function isMaskDesc(item, maskRoot) {
    if (!maskRoot) return false;
    try {
      if (item === maskRoot) return true;
    } catch (e) {}
    try {
      if (
        item.typename === "PathItem" &&
        (item.clipping === true || rootOfPath(item) === maskRoot)
      )
        return true;
    } catch (e2) {}
    return false;
  }
  function itemAngleWeight(item) {
    var gb = geoBounds(item);
    if (!gb) return 0;
    var iw = Math.abs(gb[2] - gb[0]),
      ih = Math.abs(gb[1] - gb[3]);
    if (iw < 0.01 || ih < 0.01) return 0;
    var ratio = Math.max(iw, ih) / Math.min(iw, ih);
    var directional = Math.min(1, Math.max(0, (ratio - 1) / 0.2));
    var type = "";
    try {
      type = item.typename;
    } catch (e) {}
    if (type === "TextFrame") directional = Math.max(directional, 0.75);
    if (type === "PlacedItem" || type === "RasterItem")
      directional = Math.max(directional, 0.35);
    if (directional < 0.08) return 0;
    return Math.sqrt(iw * ih) * directional;
  }
  function readContentAngle(slot) {
    var maskRoot = null;
    try {
      if (slot.typename === "GroupItem" && slot.clipped === true)
        maskRoot = clippingRoot(slot);
    } catch (e) {}
    var candidates = [];
    function walk(item, isOuter) {
      if (!item || isMaskDesc(item, maskRoot)) return;
      try {
        if (item.hidden === true || item.opacity === 0) return;
      } catch (e) {}
      var type = "";
      try {
        type = item.typename;
      } catch (e2) {}
      if (!isOuter) {
        var weight = itemAngleWeight(item),
          angle = readAngle(item);
        if (weight > 0 && angle !== null)
          candidates.push({ angle: angle, weight: weight });
      }
      if (type === "GroupItem") {
        var kids = directKids(item);
        for (var k = 0; k < kids.length; k++) walk(kids[k], false);
      }
    }
    walk(slot, true);
    if (candidates.length === 0) return readAngle(slot);
    var bins = [0, 0, 0, 0],
      total = 0,
      i;
    for (i = 0; i < candidates.length; i++) {
      var q = Math.round(normDeg(candidates[i].angle) / 90) % 4;
      bins[q] += candidates[i].weight;
      total += candidates[i].weight;
    }
    var best = 0;
    for (i = 1; i < 4; i++) if (bins[i] > bins[best]) best = i;
    if (bins[best] >= total * 0.48) return best * 90;
    var sx = 0,
      sy = 0;
    for (i = 0; i < candidates.length; i++) {
      var rad = (candidates[i].angle * Math.PI) / 180;
      sx += Math.cos(rad) * candidates[i].weight;
      sy += Math.sin(rad) * candidates[i].weight;
    }
    return normDeg((Math.atan2(sy, sx) * 180) / Math.PI);
  }
  function clearlyHorizontalOrVertical(w, h) {
    if (!(w > 0 && h > 0)) return false;
    return Math.max(w, h) / Math.min(w, h) > 1.04;
  }
  function isPositiveSize(value) {
    return typeof value === "number" && isFinite(value) && value > 0;
  }
  // RasterItem/PlacedItem có thể giữ matrix 90 độ bên trong. Khi đó
  // item.resize(x, y) scale theo trục nội bộ, còn visibleBounds lại đo theo
  // trục trang. Không được lấy W/H trang rồi đưa thẳng vào resize. Thử tăng
  // rất nhẹ trục X để biết nó đang tác động lên chiều ngang hay chiều dọc,
  // sau đó scale đúng theo trục thực tế của object. Không tạo clipping mask
  // và cũng không raster thêm RasterItem/PlacedItem.
  function resizeToVisibleSize(item, wantedW, wantedH) {
    if (!isPositiveSize(wantedW) || !isPositiveSize(wantedH))
      throw new Error("Kích thước resize không hợp lệ.");
    var before = bnd(item);
    if (!before) throw new Error("Không đo được biên dạng trước khi resize.");
    var beforeW = before[2] - before[0],
      beforeH = before[1] - before[3];
    if (!isPositiveSize(beforeW) || !isPositiveSize(beforeH))
      throw new Error("Kích thước bản sao không hợp lệ.");

    // 101% đủ lớn để phân biệt trục X/Y bằng point, nhưng không làm giảm
    // chất lượng bitmap: lệnh scale ngay sau đó bù chính xác phần 1% này.
    try {
      item.resize(
        101,
        100,
        true,
        true,
        true,
        true,
        100,
        Transformation.CENTER,
      );
    } catch (probeCenterError) {
      item.resize(101, 100);
    }
    var probe = bnd(item);
    if (!probe) throw new Error("Không đo được biên dạng khi xác định trục resize.");
    var probeW = probe[2] - probe[0],
      probeH = probe[1] - probe[3];
    if (!isPositiveSize(probeW) || !isPositiveSize(probeH))
      throw new Error("Kích thước bản sao sau khi đo trục không hợp lệ.");

    // Nếu X nội bộ làm rộng visibleBounds thì X -> W trang; ngược lại
    // X -> H trang (đây là trường hợp ảnh đã xoay 90/270 độ từ trước).
    var xChangesWidth = Math.abs(probeW - beforeW) >= Math.abs(probeH - beforeH);
    var scaleX = xChangesWidth ? wantedW / probeW : wantedH / probeH;
    var scaleY = xChangesWidth ? wantedH / probeH : wantedW / probeW;
    if (!isPositiveSize(scaleX) || !isPositiveSize(scaleY))
      throw new Error("Không tính được tỉ lệ resize.");
    try {
      item.resize(
        scaleX * 100,
        scaleY * 100,
        true,
        true,
        true,
        true,
        100,
        Transformation.CENTER,
      );
    } catch (resizeCenterError) {
      item.resize(scaleX * 100, scaleY * 100);
    }
  }
  function outputLayer(d) {
    var layerName = "__DAN_THEO_MAU_KET_QUA__",
      ly = null;
    for (var i = 0; i < d.layers.length; i++) {
      if (d.layers[i].name === layerName) {
        ly = d.layers[i];
        break;
      }
    }
    if (!ly) {
      ly = d.layers.add();
      ly.name = layerName;
    }
    try {
      ly.locked = false;
    } catch (e) {}
    try {
      ly.visible = true;
    } catch (e) {}
    try {
      d.activeLayer = ly;
    } catch (e) {}
    return ly;
  }

  function isSourceOrAncestor(item, sources) {
    for (var si = 0; si < sources.length; si++) {
      var node = sources[si];
      while (node) {
        try {
          if (node === item) return true;
          if (node.typename === "Layer") break;
          node = node.parent;
        } catch (e) {
          break;
        }
      }
    }
    return false;
  }

  // A previous run may leave artwork at the same coordinates after its
  // artboards are removed.  Clear only top-level items owned by this result
  // layer, while preserving any selected source that happens to be there.
  function clearPreviousOutput(ly, sources) {
    var stale = [];
    try {
      for (var i = 0; i < ly.pageItems.length; i++) {
        var item = ly.pageItems[i];
        try {
          if (item.parent === ly && !isSourceOrAncestor(item, sources))
            stale.push(item);
        } catch (e) {}
      }
    } catch (e2) {}
    for (var j = stale.length - 1; j >= 0; j--) {
      try {
        stale[j].remove();
      } catch (e3) {}
    }
  }

  var sourceItems = [];
  for (var si = 0; si < sel.length; si++) sourceItems.push(sel[si]);
  var outLayer = outputLayer(doc);
  clearPreviousOutput(outLayer, sourceItems);
  var errors = [];
  var filledSlotCount = 0,
    outputBatchCount = 0;
  var destName = doc.name;

  function loadPon(label) {
    var ponFile = File.openDialog(label, "*.ai");
    var R = {
      dup: null,
      W: 0,
      H: 0,
      cx: 0,
      cy: 0,
      offX: 0,
      offY: 0,
    };
    if (!ponFile || !ponFile.exists) return R;
    var pd = app.open(ponFile);
    app.activeDocument = pd;
    if (pd.artboards.length > 0) {
      var pr = pd.artboards[0].artboardRect.slice(0);
      R.W = pr[2] - pr[0];
      R.H = pr[1] - pr[3];
      R.cx = (pr[0] + pr[2]) / 2;
      R.cy = (pr[1] + pr[3]) / 2;
      app.activeDocument = doc;
      var dl = outLayer;
      app.activeDocument = pd;
      var pit = [];
      for (var q = 0; q < pd.pageItems.length; q++) pit.push(pd.pageItems[q]);
      if (pit.length > 0) {
        var pg = pd.groupItems.add();
        for (q = pit.length - 1; q >= 0; q--) {
          try {
            pit[q].move(pg, ElementPlacement.PLACEATBEGINNING);
          } catch (e) {}
        }
        try {
          var gb = pg.geometricBounds;
          var gcx = (gb[0] + gb[2]) / 2,
            gcy = (gb[1] + gb[3]) / 2;
          var acx = (pr[0] + pr[2]) / 2,
            acy = (pr[1] + pr[3]) / 2;
          R.offX = gcx - acx;
          R.offY = gcy - acy;
        } catch (e) {}
        try {
          R.dup = pg.duplicate(dl, ElementPlacement.PLACEATEND);
        } catch (e) {}
      }
    }
    app.activeDocument = pd;
    pd.close(SaveOptions.DONOTSAVECHANGES);
    var dd = null;
    for (var di = 0; di < app.documents.length; di++)
      if (app.documents[di].name === destName) {
        dd = app.documents[di];
        break;
      }
    if (dd) {
      doc = dd;
    }
    app.activeDocument = doc;
    outLayer = outputLayer(doc);
    return R;
  }

  function hasUsablePon(pon) {
    // PON trắng vẫn là PON hợp lệ: chỉ cần artboard có kích thước dương.
    return pon && isPositiveSize(pon.W) && isPositiveSize(pon.H);
  }
  function removePonCopy(pon) {
    try {
      if (pon && pon.dup) pon.dup.remove();
    } catch (e) {}
  }

  var ponF = loadPon(
    MODE === "two"
      ? "Chọn pon MẶT TRƯỚC (.ai)"
      : "Chọn file pon (.ai) - artboard cho mỗi con",
  );
  if (!hasUsablePon(ponF)) {
    removePonCopy(ponF);
    return "ERR: Chưa chọn pon MẶT TRƯỚC có artboard hợp lệ. Chưa tạo kết quả nào.";
  }
  var ponB = null;
  if (MODE === "two") {
    ponB = loadPon("Chọn pon MẶT SAU (.ai)");
    if (!hasUsablePon(ponB)) {
      removePonCopy(ponF);
      removePonCopy(ponB);
      return "ERR: Chưa chọn pon MẶT SAU có artboard hợp lệ. Chưa tạo kết quả nào.";
    }
  }

  // Lấy tâm artboard PON, không lấy tâm artwork. Nhờ vậy PON trắng vẫn
  // tạo được artboard, còn artwork PON giữ đúng offset so với artboard.
  var startCx = ponF.cx;
  var startCy = ponF.cy;

  var ARTBOARDS_PER_COLUMN = 15;
  var oldAb = doc.artboards.length;

  // Một job tạo một artboard. Ở chế độ nhiều mẫu, mỗi slot nhận nguồn tương ứng;
  // ở chế độ gốc, tất cả slot dùng cùng một nguồn.
  // Các object lặp vẫn dùng chung raster tạm, không làm giảm chất lượng.
  function danMotCon(block, slotSources, cxBo, cyBo, pon, tag) {
    var bSlots = block.slots;
    var bHiPt = block.sideHi * MM,
      bLoPt = block.sideLo * MM;
    var ponDup = pon ? pon.dup : null;
    var ponW = pon ? pon.W : 0,
      ponH = pon ? pon.H : 0;
    var offX = pon ? pon.offX : 0,
      offY = pon ? pon.offY : 0;

    if (!slotSources || slotSources.length !== bSlots.length) {
      errors.push(
        "Mẫu " +
          tag +
          ": số nguồn (" +
          (slotSources ? slotSources.length : 0) +
          ") không khớp số slot (" +
          bSlots.length +
          ").",
      );
      return;
    }

    var batchGroup = outLayer.groupItems.add();
    batchGroup.name = "DAN_THEO_MAU_" + tag;
    var sourceCache = [];
    function isReadyImage(item) {
      try {
        return item.typename === "RasterItem" || item.typename === "PlacedItem";
      } catch (e) {
        return false;
      }
    }
    function rasterForSource(it, sourceNo) {
      for (var rc = 0; rc < sourceCache.length; rc++)
        if (sourceCache[rc].it === it) return sourceCache[rc];
      var entry = { it: it, flat: null, failed: false };
      sourceCache.push(entry);
      var workCopy = null;
      try {
        // Raster theo visibleBounds hoặc clipping mask nên giữ alpha của hình tròn,
        // tam giác, logo, chữ... trước khi nhân vào slot tương ứng.
        workCopy = it.duplicate(outLayer, ElementPlacement.PLACEATEND);
        var sourceFrame = bnd(workCopy);
        if (!sourceFrame) throw new Error("Không đo được biên dạng object.");
        if (isReadyImage(workCopy)) {
          entry.flat = workCopy;
          workCopy = null;
        } else {
          entry.flat = doc.rasterize(workCopy, sourceFrame, makeRO());
        }
        if (!entry.flat) throw new Error("Illustrator không trả về RasterItem.");
        // The raster already contains the source's visible pixels.  Reading
        // a nested source group's matrix can report an unrelated 90-degree
        // transform and rotate every learned slot the wrong way.
      } catch (rasterError) {
        entry.failed = true;
        try {
          if (workCopy) workCopy.remove();
        } catch (cleanupWorkCopyError) {}
        errors.push(
          "Mẫu " + tag + ", nguồn " + sourceNo + ": " + rasterError,
        );
      }
      return entry;
    }

    var made = 0;
    for (var s = 0; s < bSlots.length; s++) {
      var sl = bSlots[s];
      var rasterCopy = null;
      try {
        var sourceEntry = rasterForSource(slotSources[s], s + 1);
        if (sourceEntry.failed || !sourceEntry.flat)
          throw new Error("không raster được nguồn cho slot này.");
        // Không bọc ảnh trong GroupItem ở đây. Với ảnh đã có matrix xoay nội
        // bộ, GroupItem.resize có thể scale theo trục local trong khi bounds
        // lại được đo theo trục trang, làm card dọc thành ngang.
        rasterCopy = sourceEntry.flat.duplicate(
          outLayer,
          ElementPlacement.PLACEATEND,
        );
        // W/H này đã được học RIÊNG cho từng slot. Không dùng ternary lồng
        // nhau ở đây: ExtendScript đã đánh giá biểu thức đó sai và làm mọi ô
        // rơi về khổ chung 12.2 x 8.2. Ưu tiên tuyệt đối số đo thật của slot;
        // chỉ dùng khổ cũ khi template rất cũ không có W/H.
        var useW = Number(sl.w);
        var useH = Number(sl.h);
        if (!(useW > 0) || !(useH > 0)) {
          useW = sl.land ? bHiPt : bLoPt;
          useH = sl.land ? bLoPt : bHiPt;
        }
        if (!(useW > 0) || !(useH > 0))
          throw new Error("Kích thước slot không hợp lệ.");

        // Góc học được là góc tương đối với artwork đang nhìn thấy. Không đọc
        // matrix của nguồn vì Raster/PlacedItem hoặc group lồng nhau có thể trả
        // một góc nội bộ 90 độ dù ảnh thực tế đang đứng thẳng.
        var hasVisualAngle = sl.angle >= 0;
        var rot = 0;
        if (hasVisualAngle) {
          rot = sl.angle % 360;
          if (rot < 0) rot += 360;
          if (rot > 180) rot -= 360;
        } else {
          // Mẫu cũ chưa lưu góc: chỉ suy hướng khi cả nguồn lẫn slot là hình
          // chữ nhật rõ ràng. Hình tròn sẽ giữ nguyên, không bị lật 90 độ.
          var hbA = bnd(rasterCopy);
          if (!hbA) throw new Error("Không đo được biên dạng bản sao.");
          var sourceW = hbA[2] - hbA[0],
            sourceH = hbA[1] - hbA[3];
          if (
            clearlyHorizontalOrVertical(sourceW, sourceH) &&
            clearlyHorizontalOrVertical(sl.w, sl.h)
          ) {
            if ((sourceW >= sourceH) !== sl.land) rot = 90;
          }
        }

        // Xoay artwork trước, rồi mới resize theo W/H nhìn thấy của slot.
        // resizeToVisibleSize tự nhận biết trục nội bộ của Raster/PlacedItem,
        // nên ảnh có matrix xoay sẵn vẫn ra đúng kích thước cuối cùng.
        if (Math.abs(rot) > 0.01) {
          try {
            rasterCopy.rotate(rot, true, true, true, true, Transformation.CENTER);
          } catch (rotateCenterError) {
            rasterCopy.rotate(rot);
          }
        }
        resizeToVisibleSize(rasterCopy, useW, useH);
        var hb = bnd(rasterCopy);
        if (!hb) throw new Error("Không đo được biên dạng sau khi scale.");
        // Xác nhận sau xoay theo đúng W/H slot. Với ảnh Illustrator có matrix
        // nội bộ khác thường, hiệu chỉnh lần cuối theo visibleBounds để không
        // còn xảy ra ô dọc thành 12.2 x 8.2 cm.
        var finalW = hb[2] - hb[0],
          finalH = hb[1] - hb[3];
        var SIZE_TOLERANCE = 0.75;
        if (
          Math.abs(finalW - useW) > SIZE_TOLERANCE ||
          Math.abs(finalH - useH) > SIZE_TOLERANCE
        ) {
          resizeToVisibleSize(rasterCopy, useW, useH);
          hb = bnd(rasterCopy);
          if (!hb) throw new Error("Không đo được biên dạng sau khi hiệu chỉnh.");
          finalW = hb[2] - hb[0];
          finalH = hb[1] - hb[3];
          if (
            Math.abs(finalW - useW) > SIZE_TOLERANCE ||
            Math.abs(finalH - useH) > SIZE_TOLERANCE
          )
            throw new Error("Resize không đạt kích thước slot yêu cầu.");
        }
        var hcx = (hb[0] + hb[2]) / 2,
          hcy = (hb[1] + hb[3]) / 2;
        var targetCx = cxBo + sl.dx,
          targetCy = cyBo + sl.dy;
        rasterCopy.translate(targetCx - hcx, targetCy - hcy);

        // Đặt bản sao đã resize vào đúng tâm slot; không tạo clipping mask.
        rasterCopy.move(batchGroup, ElementPlacement.PLACEATEND);
        rasterCopy = null;
        made++;
      } catch (e) {
        try {
          if (rasterCopy) rasterCopy.remove();
        } catch (e2) {}
        errors.push("Mẫu " + tag + ", vị trí " + (s + 1) + ": " + e);
      }
    }
    for (var removeIndex = 0; removeIndex < sourceCache.length; removeIndex++) {
      try {
        if (sourceCache[removeIndex].flat) sourceCache[removeIndex].flat.remove();
      } catch (removeFlatError) {}
    }
    if (made === 0) {
      try {
        batchGroup.remove();
      } catch (emptyGroupError) {}
      return;
    }

    if (ponDup) {
      try {
        var g = ponDup.duplicate(outLayer, ElementPlacement.PLACEATBEGINNING);
        var ggb = g.geometricBounds;
        var gcx = (ggb[0] + ggb[2]) / 2,
          gcy = (ggb[1] + ggb[3]) / 2;
        g.translate(cxBo + offX - gcx, cyBo + offY - gcy);
      } catch (e) {}
    }
  }

  function addAB(cx, cy, w, h) {
    try {
      doc.artboards.add([cx - w / 2, cy + h / 2, cx + w / 2, cy - h / 2]);
    } catch (e) {}
  }

  // Nguồn được đọc theo thứ tự từ trên xuống, trong cùng hàng từ trái sang phải.
  // Không dùng thứ tự selection của Illustrator vì thứ tự đó không ổn định.
  function orderSourceItems(items) {
    var measured = [];
    for (var oi = 0; oi < items.length; oi++) {
      var ob = bnd(items[oi]);
      if (!ob) {
        errors.push("Nguồn " + (oi + 1) + ": không đo được biên dạng.");
        continue;
      }
      measured.push({
        it: items[oi],
        cx: (ob[0] + ob[2]) / 2,
        cy: (ob[1] + ob[3]) / 2,
        h: Math.abs(ob[1] - ob[3]),
        original: oi,
      });
    }
    measured.sort(function (a, b) {
      if (Math.abs(a.cy - b.cy) > Math.max(1, Math.min(a.h, b.h) * 0.35))
        return b.cy - a.cy;
      if (Math.abs(a.cx - b.cx) > 0.01) return a.cx - b.cx;
      return a.original - b.original;
    });
    var ordered = [];
    for (var om = 0; om < measured.length; om++) ordered.push(measured[om].it);
    return ordered;
  }

  // Một lô không đủ số slot được bù theo đúng yêu cầu: con cuối, rồi gần cuối,
  // lặp lại hai con đó. Không thay thế những nguồn đã có trong lô.
  function fillSourceBatch(seed, slotCount) {
    var filled = [];
    for (var fi = 0; fi < seed.length; fi++) filled.push(seed[fi]);
    var extra = 0;
    var tailCount = Math.min(2, seed.length);
    while (filled.length < slotCount) {
      var pick = seed[seed.length - 1 - (extra % tailCount)];
      filled.push(pick);
      extra++;
    }
    return { sources: filled, extra: extra };
  }

  function buildSourceBatches(items, slotCount) {
    var batches = [];
    for (var bs = 0; bs < items.length; bs += slotCount) {
      var seed = [];
      for (var bi = bs; bi < items.length && seed.length < slotCount; bi++)
        seed.push(items[bi]);
      if (seed.length > 0) batches.push(fillSourceBatch(seed, slotCount));
    }
    return batches;
  }

  // Chế độ gốc: mỗi nguồn là một artboard riêng, nhân nguồn đó vào toàn bộ slot.
  function buildSingleSourceBatches(items, slotCount) {
    var batches = [];
    for (var ss = 0; ss < items.length; ss++) {
      var repeated = [];
      for (var sl = 0; sl < slotCount; sl++) repeated.push(items[ss]);
      batches.push({ sources: repeated, extra: 0 });
    }
    return batches;
  }

  // Bản hai mặt bù theo từng CẶP, nhờ vậy mặt trước và mặt sau của cùng nguồn
  // luôn đi cùng nhau khi thiếu nguồn.
  function buildPairSourceBatches(frontItems, backItems, slotCount) {
    var batches = [];
    for (var ps = 0; ps < frontItems.length; ps += slotCount) {
      var frontSeed = [],
        backSeed = [];
      for (
        var pi = ps;
        pi < frontItems.length && frontSeed.length < slotCount;
        pi++
      ) {
        frontSeed.push(frontItems[pi]);
        backSeed.push(backItems[pi]);
      }
      var frontPlan = fillSourceBatch(frontSeed, slotCount);
      var backPlan = fillSourceBatch(backSeed, slotCount);
      batches.push({
        front: frontPlan.sources,
        back: backPlan.sources,
        extra: frontPlan.extra,
      });
    }
    return batches;
  }

  // Chế độ gốc cho 2 mặt: một cặp trái/phải tạo một cặp artboard,
  // mỗi mặt nhân chính nguồn của mặt đó vào toàn bộ slot đã học.
  function buildSinglePairSourceBatches(frontItems, backItems, slotCount) {
    var batches = [];
    for (var sp = 0; sp < frontItems.length; sp++) {
      var frontRepeated = [],
        backRepeated = [];
      for (var sl = 0; sl < slotCount; sl++) {
        frontRepeated.push(frontItems[sp]);
        backRepeated.push(backItems[sp]);
      }
      batches.push({ front: frontRepeated, back: backRepeated, extra: 0 });
    }
    return batches;
  }

  if (MODE === "one") {
    var orderedSources = orderSourceItems(sourceItems);
    if (orderedSources.length === 0) {
      removePonCopy(ponF);
      return "ERR: Không có nguồn nào có biên dạng hợp lệ. Chưa tạo kết quả nào.";
    }
    var sourceBatches = useMultiSource
      ? buildSourceBatches(orderedSources, blocks.F.slots.length)
      : buildSingleSourceBatches(orderedSources, blocks.F.slots.length);
    outputBatchCount = sourceBatches.length;
    var jobs = [];
    for (var bi = 0; bi < sourceBatches.length; bi++) {
      var colI = Math.floor(bi / ARTBOARDS_PER_COLUMN);
      var rowI = bi % ARTBOARDS_PER_COLUMN;
      jobs.push({
        sources: sourceBatches[bi].sources,
        cx: startCx + colI * ponF.W,
        cy: startCy - rowI * ponF.H,
        block: blocks.F,
        pon: ponF,
        tag: bi + 1,
      });
      filledSlotCount += sourceBatches[bi].extra;
    }
    for (var ji = 0; ji < jobs.length; ji++)
      addAB(jobs[ji].cx, jobs[ji].cy, ponF.W, ponF.H);
    for (var jj = 0; jj < jobs.length; jj++)
      danMotCon(
        jobs[jj].block,
        jobs[jj].sources,
        jobs[jj].cx,
        jobs[jj].cy,
        jobs[jj].pon,
        jobs[jj].tag,
      );
  } else {
    var cxs = [];
    for (var ci = 0; ci < sourceItems.length; ci++) {
      var bb = bnd(sourceItems[ci]);
      if (!bb) {
        removePonCopy(ponF);
        removePonCopy(ponB);
        return (
          "ERR: Nguồn " +
          (ci + 1) +
          " không có biên dạng hợp lệ. Chưa tạo kết quả nào."
        );
      }
      cxs.push({
        it: sourceItems[ci],
        cx: (bb[0] + bb[2]) / 2,
        cy: (bb[1] + bb[3]) / 2,
      });
    }
    var sumX = 0;
    for (var ci2 = 0; ci2 < cxs.length; ci2++) sumX += cxs[ci2].cx;
    var midX = sumX / cxs.length;
    var colTrai = [],
      colPhai = [];
    for (var ci3 = 0; ci3 < cxs.length; ci3++) {
      if (cxs[ci3].cx < midX) colTrai.push(cxs[ci3]);
      else colPhai.push(cxs[ci3]);
    }
    function byY(a, b) {
      return b.cy - a.cy;
    }
    colTrai.sort(byY);
    colPhai.sort(byY);
    if (colTrai.length !== colPhai.length) {
      removePonCopy(ponF);
      removePonCopy(ponB);
      var pairError =
        "ERR: Mẫu 2 mặt cần hai cột bằng nhau (trái=mặt trước, phải=mặt sau). Hiện có trái " +
        colTrai.length +
        ", phải " +
        colPhai.length +
        ". Chưa tạo kết quả nào.";
      alert(pairError.substring(5));
      return pairError;
    }
    if (blocks.F.slots.length !== blocks.B.slots.length) {
      removePonCopy(ponF);
      removePonCopy(ponB);
      var slotError =
        "ERR: Mẫu 2 mặt cần số slot trước/sau bằng nhau để ghép từng cặp nguồn. Hiện có trước " +
        blocks.F.slots.length +
        ", sau " +
        blocks.B.slots.length +
        ". Hãy Học mẫu lại.";
      alert(slotError.substring(5));
      return slotError;
    }
    var frontItems = [],
      backItems = [];
    for (var cp = 0; cp < colTrai.length; cp++) {
      frontItems.push(colTrai[cp].it);
      backItems.push(colPhai[cp].it);
    }
    var pairBatches = useMultiSource
      ? buildPairSourceBatches(frontItems, backItems, blocks.F.slots.length)
      : buildSinglePairSourceBatches(
          frontItems,
          backItems,
          blocks.F.slots.length,
        );
    outputBatchCount = pairBatches.length;

    var stepX = ponF.W + ponB.W;
    var jobs2 = [];
    for (var pi2 = 0; pi2 < pairBatches.length; pi2++) {
      var colP = Math.floor(pi2 / ARTBOARDS_PER_COLUMN);
      var rowP = pi2 % ARTBOARDS_PER_COLUMN;
      var cyRow = startCy - rowP * ponF.H;
      var cxF = startCx + colP * stepX;
      var cxB = cxF + ponF.W;
      jobs2.push({
        sources: pairBatches[pi2].front,
        cx: cxF,
        cy: cyRow,
        block: blocks.F,
        pon: ponF,
        tag: pi2 * 2 + 1,
        w: ponF.W,
        h: ponF.H,
      });
      jobs2.push({
        sources: pairBatches[pi2].back,
        cx: cxB,
        cy: cyRow,
        block: blocks.B,
        pon: ponB,
        tag: pi2 * 2 + 2,
        w: ponB.W,
        h: ponB.H,
      });
      filledSlotCount += pairBatches[pi2].extra * 2;
    }
    for (var ja = 0; ja < jobs2.length; ja++)
      addAB(jobs2[ja].cx, jobs2[ja].cy, jobs2[ja].w, jobs2[ja].h);
    for (var jb = 0; jb < jobs2.length; jb++)
      danMotCon(
        jobs2[jb].block,
        jobs2[jb].sources,
        jobs2[jb].cx,
        jobs2[jb].cy,
        jobs2[jb].pon,
        jobs2[jb].tag,
      );
  }

  try {
    if (ponF && ponF.dup) ponF.dup.remove();
  } catch (e) {}
  try {
    if (ponB && ponB.dup) ponB.dup.remove();
  } catch (e) {}
  if (doc.artboards.length > oldAb) {
    for (var a2 = oldAb - 1; a2 >= 0; a2--) {
      try {
        doc.artboards.remove(a2);
      } catch (e) {}
    }
  }

  app.redraw();
  var msg =
    MODE === "one"
      ? "Đã dàn " +
        sourceItems.length +
        " nguồn thành " +
        outputBatchCount +
        " artboard; " +
        (useMultiSource
          ? "mỗi artboard gán các nguồn lần lượt vào " +
            blocks.F.slots.length +
            " slot mẫu."
          : "mỗi artboard nhân 1 nguồn vào " +
            blocks.F.slots.length +
            " slot mẫu.")
      : "Đã dàn 2 mặt " +
        sourceItems.length / 2 +
        " cặp nguồn thành " +
        outputBatchCount +
        " cặp artboard (trái=trước, phải=sau); " +
        (useMultiSource
          ? "mỗi artboard gán các nguồn lần lượt vào slot mẫu."
          : "mỗi artboard nhân 1 nguồn tương ứng vào toàn bộ slot mẫu.");
  if (filledSlotCount > 0)
    msg +=
      "\nĐã bù " +
      filledSlotCount +
      " slot còn thiếu bằng con cuối rồi gần cuối của từng lô nguồn.";
  if (errors.length > 0) msg += "\n\nLưu ý:\n- " + errors.join("\n- ");
  alert(msg);
  return (
    "OK: " +
    (MODE === "one"
      ? "Đã dàn 1 mặt " +
        sourceItems.length +
        " nguồn thành " +
        outputBatchCount +
        " artboard (" +
        (useMultiSource ? "nhiều mẫu/1 artboard" : "1 mẫu/1 artboard") +
        ")." +
        (errors.length ? " (" + errors.length + " lưu ý)" : "")
      : "Đã dàn 2 mặt " +
        outputBatchCount +
        " cặp artboard (" +
        (useMultiSource ? "nhiều mẫu/1 artboard" : "1 mẫu/1 artboard") +
        ")." +
        (errors.length ? " (" + errors.length + " lưu ý)" : ""))
  );
}

// ============================================================
//  dcAutoSavePDF — Auto Save từng con card ra PDF (mặt trước + mặt sau)
//  Tác giả: LỘC (Code dạo) — thêm cho DanCard
//
//  Ý tưởng:
//    - Chọn (n x 2) object trên trang: mỗi HÀNG = [trước][sau]
//      (sort y giảm dần -> hàng trên trước; trong 1 cặp sort x tăng
//       -> trái = MẶT TRƯỚC, phải = MẶT SAU). Giống dcDan.
//    - Mỗi con card -> 1 file PDF 2 TRANG:
//         trang 1 = mặt trước, trang 2 = mặt sau.
//    - KHÔNG đụng file gốc: nhân đôi 2 object của con card sang 1
//      TÀI LIỆU TẠM, tạo 2 artboard vừa khít, export PDF rồi đóng
//      không lưu. Nhờ vậy PDF chỉ chứa đúng con card đó (đã "xóa
//      rác" một cách an toàn), file nhẹ, và file gốc nguyên vẹn —
//      không cần Ctrl+Z, không rủi ro mất artwork.
//
//  Tên file: 1088 - {STT} - {soHop} hộp - {ghiChu} - [1 mat] - {canMang} - {ngay}.pdf
//    vd: "1088 - 01 - 5 hộp - ghi chú - 1 mat - cm - 16.pdf"
//    "1 mat" chỉ thêm cho con được nhận diện là 1 mặt.
//
//  Tham số (đều là chuỗi, panel truyền vào):
//    prefix   : mã bắt buộc, mặc định "1088"
//    startNo  : STT bắt đầu (vd "1")
//    pad      : đệm số 0 cho STT (vd "2" -> 01,02..; "0" -> 1,2..)
//    soHop    : số hộp (vd "5") -> ghi "5 hộp"
//    canMang  : "cm" (cán màng) hoặc "km" (không màng)
//    ngay     : ngày đặt in (vd "16")
//    outFolder: thư mục lưu; rỗng -> hỏi chọn thư mục
//  Trả về "OK: ..." hoặc "ERR: ..."
// ============================================================
// ============================================================
//  Lưu kết quả Dàn theo mẫu ra PDF sạch.
//  Mỗi lần xuất dựng một document tạm chỉ có object của artboard cần lưu,
//  rồi đóng không lưu, nên file PDF không mang theo object ngoài artboard.
// ============================================================
function dcLuuDanTheoMauPDF_CopyObjectLegacy(saveMode, suffix) {
  try {
    if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
    var doc = app.activeDocument;
    var mode = String(saveMode === undefined || saveMode === null ? "each" : saveMode);
    if (mode !== "each" && mode !== "pair")
      return "ERR: Kiểu lưu PDF không hợp lệ.";

    suffix = String(suffix === undefined || suffix === null ? "" : suffix).replace(
      /^\s+|\s+$/g,
      "",
    );

    function positiveRect(rect) {
      return (
        rect &&
        rect.length === 4 &&
        isFinite(rect[0]) &&
        isFinite(rect[1]) &&
        isFinite(rect[2]) &&
        isFinite(rect[3]) &&
        rect[2] > rect[0] &&
        rect[1] > rect[3]
      );
    }
    function itemBounds(item) {
      try {
        var b = item.visibleBounds;
        if (positiveRect(b)) return b;
      } catch (e) {}
      try {
        var g = item.geometricBounds;
        if (positiveRect(g)) return g;
      } catch (e2) {}
      return null;
    }
    function overlaps(rect, bounds) {
      return (
        bounds[2] > rect[0] &&
        bounds[0] < rect[2] &&
        bounds[1] > rect[3] &&
        bounds[3] < rect[1]
      );
    }
    function centerIn(rect, bounds) {
      var cx = (bounds[0] + bounds[2]) / 2;
      var cy = (bounds[1] + bounds[3]) / 2;
      var eps = 0.1;
      return (
        cx >= rect[0] - eps &&
        cx <= rect[2] + eps &&
        cy >= rect[3] - eps &&
        cy <= rect[1] + eps
      );
    }
    function directChildren(group) {
      var result = [];
      try {
        for (var i = 0; i < group.pageItems.length; i++) {
          var child = group.pageItems[i];
          try {
            if (child.parent === group) result.push(child);
          } catch (e) {}
        }
      } catch (e2) {}
      return result;
    }
    function addItemForArtboard(item, rect, result) {
      var bounds = itemBounds(item);
      if (!bounds || !overlaps(rect, bounds)) return;
      if (centerIn(rect, bounds)) {
        result.push(item);
        return;
      }

      // Nhóm dấu cắt có thể trải qua nhiều artboard. Tách nhóm không clip
      // theo object con để mỗi PDF chỉ nhận phần của chính artboard đó.
      var type = "";
      var clipped = false;
      try {
        type = item.typename;
        clipped = item.clipped === true;
      } catch (e) {}
      if (type === "GroupItem" && !clipped) {
        var children = directChildren(item);
        for (var ci = 0; ci < children.length; ci++)
          addItemForArtboard(children[ci], rect, result);
        return;
      }
      result.push(item);
    }
    function collectArtboardItems(rect) {
      var result = [];
      for (var li = 0; li < doc.layers.length; li++) {
        var layer = doc.layers[li];
        try {
          if (layer.visible === false || layer.locked === true) continue;
        } catch (e) {}
        var topItems = [];
        try {
          for (var pi = 0; pi < layer.pageItems.length; pi++) {
            var item = layer.pageItems[pi];
            try {
              if (item.parent === layer) topItems.push(item);
            } catch (e2) {}
          }
        } catch (e3) {}
        for (var ti = 0; ti < topItems.length; ti++)
          addItemForArtboard(topItems[ti], rect, result);
      }
      return result;
    }
    function sanitizeName(value) {
      return String(value)
        .replace(/[\\\/:*?"<>|]/g, "-")
        .replace(/^\s+|\s+$/g, "");
    }
    function makePdfOptions(pageCount) {
      var opt = new PDFSaveOptions();
      try {
        opt.compatibility = PDFCompatibility.ACROBAT5;
      } catch (e) {}
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
      try {
        opt.artboardRange = pageCount === 1 ? "1" : "1-" + pageCount;
      } catch (e7) {}
      return opt;
    }
    function exportPages(pages, filePath) {
      var tmp = null;
      var completed = false;
      try {
        tmp = app.documents.add(DocumentColorSpace.CMYK);
        tmp.artboards[0].artboardRect = pages[0].rect.slice(0);
        for (var ai = 1; ai < pages.length; ai++)
          tmp.artboards.add(pages[ai].rect.slice(0));

        for (var page = 0; page < pages.length; page++) {
          var items = collectArtboardItems(pages[page].rect);
          if (items.length === 0)
            throw new Error(
              "Artboard " + (pages[page].index + 1) + " không có object để lưu.",
            );
          for (var oi = 0; oi < items.length; oi++) {
            app.activeDocument = doc;
            items[oi].duplicate(tmp.layers[0], ElementPlacement.PLACEATEND);
            app.activeDocument = tmp;
          }
        }
        tmp.saveAs(new File(filePath), makePdfOptions(pages.length));
        completed = true;
      } finally {
        try {
          if (tmp) tmp.close(SaveOptions.DONOTSAVECHANGES);
        } catch (e) {}
        if (!completed) {
          try {
            var incomplete = new File(filePath);
            if (incomplete.exists) incomplete.remove();
          } catch (e2) {}
        }
        try {
          app.activeDocument = doc;
        } catch (e3) {}
      }
    }

    var artboards = [];
    for (var i = 0; i < doc.artboards.length; i++) {
      var rect = doc.artboards[i].artboardRect.slice(0);
      if (!positiveRect(rect))
        return "ERR: Artboard " + (i + 1) + " không có kích thước hợp lệ.";
      artboards.push({ index: i, rect: rect });
    }
    if (artboards.length === 0) return "ERR: Không có artboard nào để lưu.";
    if (mode === "pair" && artboards.length % 2 !== 0)
      return "ERR: Lưu mặt trước + mặt sau cần số artboard chẵn.";

    var folder = dcChonThuMucLuuPDF("Chọn nơi lưu PDF đã dàn theo mẫu");
    if (!folder) return "ERR: Chưa chọn thư mục lưu PDF - đã huỷ.";

    var suffixPart = sanitizeName(suffix);
    var jobs = [];
    for (var ab = 0; ab < artboards.length; ab += mode === "pair" ? 2 : 1) {
      var pages = [artboards[ab]];
      if (mode === "pair") pages.push(artboards[ab + 1]);
      var fileNo = jobs.length + 1;
      var name = "file " + fileNo + (suffixPart ? " - " + suffixPart : "") + ".pdf";
      jobs.push({ pages: pages, name: name, path: folder.fsName + "/" + name });
    }

    var seen = {};
    for (var ji = 0; ji < jobs.length; ji++) {
      var key = String(jobs[ji].path).toLowerCase();
      if (seen[key]) return "ERR: Có hai PDF trùng tên " + jobs[ji].name + ".";
      if (new File(jobs[ji].path).exists)
        return "ERR: File đã tồn tại: " + jobs[ji].name + ". Hãy đổi hậu tố hoặc thư mục.";
      seen[key] = true;
    }

    var done = 0;
    var errors = [];
    for (var jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
      try {
        exportPages(jobs[jobIndex].pages, jobs[jobIndex].path);
        done++;
      } catch (exportError) {
        errors.push(
          jobs[jobIndex].name + ": " +
            (typeof dcMoTaLoi === "function"
              ? dcMoTaLoi(exportError)
              : exportError.toString()),
        );
      }
    }
    if (done === 0)
      return "ERR: Không lưu được PDF nào." + (errors.length ? " " + errors.join(" | ") : "");
    var message =
      "OK: Đã lưu " +
      done +
      " PDF " +
      (mode === "pair" ? "mặt trước + mặt sau" : "theo từng artboard") +
      ".";
    if (errors.length) message += " Lỗi " + errors.length + " file: " + errors.join(" | ");
    return message;
  } catch (e) {
    return "ERR: " + (typeof dcMoTaLoi === "function" ? dcMoTaLoi(e) : e.toString());
  }
}

// Xuất trực tiếp artboard từ một bản sao AI, không copy từng object.
// Bản sao giúp file người dùng đang mở không bị saveAs thành PDF.
function dcLuuDanTheoMauPDF_SavedAICopyLegacy(saveMode, suffix) {
  try {
    if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
    var sourceDoc = app.activeDocument;
    var mode = String(saveMode === undefined || saveMode === null ? "each" : saveMode);
    if (mode !== "each" && mode !== "pair")
      return "ERR: Kiểu lưu PDF không hợp lệ.";
    // Dàn theo mẫu vừa tạo artboard và object mới, nên document có dấu *.
    // Lưu AI trước khi copy để PDF luôn nhận đúng kết quả vừa dàn.
    if (!sourceDoc.saved) {
      try {
        sourceDoc.save();
      } catch (saveSourceError) {
        return "ERR: Không tự lưu được file AI trước khi xuất PDF. " +
          (typeof dcMoTaLoi === "function"
            ? dcMoTaLoi(saveSourceError)
            : saveSourceError.toString());
      }
    }

    var sourceFile = null;
    try {
      sourceFile = sourceDoc.fullName;
    } catch (e) {}
    if (!sourceFile || !sourceFile.exists || !/\.ai$/i.test(sourceFile.name))
      return "ERR: Chỉ xuất được file dàn đã lưu dưới dạng AI.";

    var artboardCount = sourceDoc.artboards.length;
    if (artboardCount === 0) return "ERR: Không có artboard nào để lưu.";
    if (mode === "pair" && artboardCount % 2 !== 0)
      return "ERR: Lưu mặt trước + mặt sau cần số artboard chẵn.";
    // PDF dùng point và Illustrator sẽ hạ độ chính xác khi ghi MediaBox. Nới
    // không quá 0.01 pt theo cả hai phía để khi mở lại PDF, trường W/H vẫn
    // hiện đúng số cm của artboard gốc (ví dụ 35.4 thay vì 35.399).
    function pdfStableArtboardRect(rect) {
      var left = rect[0], top = rect[1], right = rect[2], bottom = rect[3];
      var width = right - left, height = top - bottom;
      var stableWidth = Math.ceil(width * 100 - 0.000001) / 100;
      var stableHeight = Math.ceil(height * 100 - 0.000001) / 100;
      var centerX = (left + right) / 2, centerY = (top + bottom) / 2;
      return [
        centerX - stableWidth / 2,
        centerY + stableHeight / 2,
        centerX + stableWidth / 2,
        centerY - stableHeight / 2,
      ];
    }
    var artboardRects = [];
    for (var sourceAb = 0; sourceAb < artboardCount; sourceAb++)
      artboardRects.push(
        pdfStableArtboardRect(sourceDoc.artboards[sourceAb].artboardRect),
      );

    suffix = String(suffix === undefined || suffix === null ? "" : suffix)
      .replace(/^\s+|\s+$/g, "")
      .replace(/[\\\\\/:*?\"<>|]/g, "-");
    var folder = dcChonThuMucLuuPDF("Chọn nơi lưu PDF đã dàn theo mẫu");
    if (!folder) return "ERR: Chưa chọn thư mục lưu PDF - đã huỷ.";

    var jobs = [];
    var span = mode === "pair" ? 2 : 1;
    for (var first = 0; first < artboardCount; first += span) {
      var startNo = first + 1;
      var endNo = first + span;
      var fileNo = jobs.length + 1;
      var fileName =
        "file " + fileNo + (suffix ? " - " + suffix : "") + ".pdf";
      var outputFile = new File(folder.fsName + "/" + fileName);
      if (outputFile.exists) return "ERR: File đã tồn tại: " + fileName + ".";
      jobs.push({
        file: outputFile,
        name: fileName,
        range: startNo === endNo ? String(startNo) : startNo + "-" + endNo,
      });
    }

    function makePdfOptions(range) {
      var opt = new PDFSaveOptions();
      try {
        opt.compatibility = PDFCompatibility.ACROBAT5;
      } catch (e) {}
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
      try {
        opt.artboardRange = range;
      } catch (e7) {}
      return opt;
    }

    var tempFile = new File(
      Folder.temp.fsName +
        "/DanCardPdf-" +
        new Date().getTime() +
        "-" +
        Math.floor(Math.random() * 1000000) +
        ".ai",
    );
    if (!sourceFile.copy(tempFile))
      return "ERR: Không tạo được bản tạm để xuất PDF.";

    var workDoc = null;
    var done = 0;
    var errors = [];
    try {
      workDoc = app.open(tempFile);
      for (var ji = 0; ji < jobs.length; ji++) {
        try {
          // Range dùng đúng số thứ tự trong bảng Artboards của Illustrator.
          workDoc.saveAs(jobs[ji].file, makePdfOptions(jobs[ji].range));
          done++;
        } catch (saveError) {
          errors.push(
            jobs[ji].name + ": " +
              (typeof dcMoTaLoi === "function"
                ? dcMoTaLoi(saveError)
                : saveError.toString()),
          );
        }
      }
    } finally {
      try {
        if (workDoc) workDoc.close(SaveOptions.DONOTSAVECHANGES);
      } catch (closeError) {}
      try {
        if (tempFile.exists) tempFile.remove();
      } catch (removeError) {}
      try {
        sourceDoc.activate();
      } catch (activateError) {}
    }

    if (done === 0)
      return "ERR: Không lưu được PDF nào." +
        (errors.length ? " " + errors.join(" | ") : "");
    var message =
      "OK: Đã lưu " +
      done +
      " PDF theo thứ tự Artboard" +
      (mode === "pair" ? " (1+2, 3+4...)." : ".");
    if (errors.length) message += " Lỗi " + errors.length + " file: " + errors.join(" | ");
    return message;
  } catch (e) {
    return "ERR: " + (typeof dcMoTaLoi === "function" ? dcMoTaLoi(e) : e.toString());
  }
}

// Xuất từ document tạm: copy artwork một lần, sau đó xuất đúng artboard range.
// Không save file AI người dùng đang mở và không lặp copy cho từng PDF.
function dcLuuDanTheoMauPDF_TempLayoutLegacy(saveMode, suffix) {
  try {
    if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
    var sourceDoc = app.activeDocument;
    var mode = String(saveMode === undefined || saveMode === null ? "each" : saveMode);
    if (mode !== "each" && mode !== "pair")
      return "ERR: Kiểu lưu PDF không hợp lệ.";

    var artboardCount = sourceDoc.artboards.length;
    if (artboardCount === 0) return "ERR: Không có artboard nào để lưu.";
    if (mode === "pair" && artboardCount % 2 !== 0)
      return "ERR: Lưu mặt trước + mặt sau cần số artboard chẵn.";
    var artboardRects = [];
    for (var sourceAb = 0; sourceAb < artboardCount; sourceAb++)
      artboardRects.push(sourceDoc.artboards[sourceAb].artboardRect.slice(0));

    // Document tạm dùng hệ tọa độ riêng, sắp artboard theo lưới cố định.
    // Không mang tọa độ toàn trang từ file gốc sang nên artboard ở cột 2, 3...
    // được xuất giống hệt artboard ở cột đầu.
    function makeWorkArtboardRects(sourceRects) {
      var maxWidth = 0, maxHeight = 0;
      for (var rectIndex = 0; rectIndex < sourceRects.length; rectIndex++) {
        maxWidth = Math.max(maxWidth, sourceRects[rectIndex][2] - sourceRects[rectIndex][0]);
        maxHeight = Math.max(maxHeight, sourceRects[rectIndex][1] - sourceRects[rectIndex][3]);
      }
      var perColumn = 15, gap = 36, result = [];
      for (var targetIndex = 0; targetIndex < sourceRects.length; targetIndex++) {
        var sourceRect = sourceRects[targetIndex];
        var column = Math.floor(targetIndex / perColumn);
        var row = targetIndex % perColumn;
        var left = column * (maxWidth + gap);
        var top = -row * (maxHeight + gap);
        result.push([
          left,
          top,
          left + (sourceRect[2] - sourceRect[0]),
          top - (sourceRect[1] - sourceRect[3]),
        ]);
      }
      return result;
    }
    var workArtboardRects = makeWorkArtboardRects(artboardRects);

    suffix = String(suffix === undefined || suffix === null ? "" : suffix)
      .replace(/^\s+|\s+$/g, "")
      .replace(/[\\\\\/:*?\"<>|]/g, "-");
    var folder = dcChonThuMucLuuPDF("Chọn nơi lưu PDF đã dàn theo mẫu");
    if (!folder) return "ERR: Chưa chọn thư mục lưu PDF - đã huỷ.";

    var jobs = [];
    var span = mode === "pair" ? 2 : 1;
    for (var first = 0; first < artboardCount; first += span) {
      var startNo = first + 1;
      var endNo = first + span;
      var fileNo = jobs.length + 1;
      var fileName =
        "file " + fileNo + (suffix ? " - " + suffix : "") + ".pdf";
      var outputFile = new File(folder.fsName + "/" + fileName);
      if (outputFile.exists) return "ERR: File đã tồn tại: " + fileName + ".";
      jobs.push({
        file: outputFile,
        name: fileName,
        range: startNo === endNo ? String(startNo) : startNo + "-" + endNo,
      });
    }

    function makePdfOptions(range) {
      var opt = new PDFSaveOptions();
      try {
        opt.compatibility = PDFCompatibility.ACROBAT5;
      } catch (e) {}
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
      try {
        opt.artboardRange = range;
      } catch (e7) {}
      return opt;
    }
    function placementBounds(item) {
      var bounds = null;
      try {
        bounds = item.visibleBounds;
      } catch (visibleBoundsError) {}
      if (
        bounds &&
        bounds.length === 4 &&
        isFinite(bounds[0]) &&
        isFinite(bounds[1]) &&
        isFinite(bounds[2]) &&
        isFinite(bounds[3])
      )
        return bounds.slice(0);
      try {
        bounds = item.geometricBounds;
      } catch (geometricBoundsError) {}
      if (
        bounds &&
        bounds.length === 4 &&
        isFinite(bounds[0]) &&
        isFinite(bounds[1]) &&
        isFinite(bounds[2]) &&
        isFinite(bounds[3])
      )
        return bounds.slice(0);
      return null;
    }
    function copyLayerItems(layerPlan, targetLayer, copyErrors) {
      layerPlan.items.sort(function (a, b) {
        if (a.artboardIndex !== b.artboardIndex)
          return a.artboardIndex - b.artboardIndex;
        return a.z - b.z;
      });
      var copiedItems = [];
      // Giữ document gốc active cho cả layer, tránh nhảy qua lại từng object.
      sourceDoc.activate();
      for (var ii = 0; ii < layerPlan.items.length; ii++) {
        try {
          copiedItems.push({
            source: layerPlan.items[ii],
            item: layerPlan.items[ii].item.duplicate(
              targetLayer,
              ElementPlacement.PLACEATEND,
            ),
          });
        } catch (copyError) {
          copyErrors.push(
            "Layer " + layerPlan.name + ": " +
              (typeof dcMoTaLoi === "function"
                ? dcMoTaLoi(copyError)
                : copyError.toString()),
          );
        }
      }

      var copied = 0;
      workDoc.activate();
      for (var ci = 0; ci < copiedItems.length; ci++) {
        try {
          // Đặt artwork theo tọa độ tương đối trong artboard của nó. Cách này
          // không phụ thuộc artboard gốc nằm ở cột nào trên canvas.
          var copiedBounds = placementBounds(copiedItems[ci].item);
          if (!copiedBounds) throw new Error("Không đo được vùng hiển thị object đã copy.");
          var sourceEntry = copiedItems[ci].source;
          var targetLeft =
            sourceEntry.targetRect[0] +
            (sourceEntry.bounds[0] - sourceEntry.sourceRect[0]);
          var targetTop =
            sourceEntry.targetRect[1] +
            (sourceEntry.bounds[1] - sourceEntry.sourceRect[1]);
          copiedItems[ci].item.translate(
            targetLeft - copiedBounds[0],
            targetTop - copiedBounds[1],
          );
          copied++;
        } catch (positionError) {
          copyErrors.push(
            "Layer " + layerPlan.name + ": " +
              (typeof dcMoTaLoi === "function"
                ? dcMoTaLoi(positionError)
                : positionError.toString()),
          );
        }
      }
      return copied;
    }

    // Dùng chính selection theo artboard của Illustrator, thay vì tự so tọa độ
    // hay bounds. Group/clipping mask ở artboard nằm ngoài cột dàn vẫn được
    // Illustrator nhận diện và lấy đủ artwork con.
    var originalSelection = [];
    var originalArtboard = 0;
    try {
      for (var originalIndex = 0; originalIndex < sourceDoc.selection.length; originalIndex++)
        originalSelection.push(sourceDoc.selection[originalIndex]);
    } catch (originalSelectionError) {}
    try {
      originalArtboard = sourceDoc.artboards.getActiveArtboardIndex();
    } catch (originalArtboardError) {}

    var layerPlans = [];
    function topLevelItem(item) {
      var top = item;
      try {
        while (top.parent && top.parent.typename !== "Layer") top = top.parent;
      } catch (topLevelError) {}
      return top;
    }
    function sourceLayerFor(item) {
      try {
        return item.parent && item.parent.typename === "Layer" ? item.parent : null;
      } catch (sourceLayerError) {}
      return null;
    }
    function findLayerPlan(layer) {
      for (var planIndex = 0; planIndex < layerPlans.length; planIndex++)
        if (layerPlans[planIndex].layer === layer) return layerPlans[planIndex];
      var plan = { layer: layer, name: "Layer", items: [] };
      try {
        plan.name = layer.name;
      } catch (layerNameError) {}
      layerPlans.push(plan);
      return plan;
    }
    function planContainsItem(plan, item, artboardIndex) {
      for (var itemIndex = 0; itemIndex < plan.items.length; itemIndex++)
        if (
          plan.items[itemIndex].item === item &&
          plan.items[itemIndex].artboardIndex === artboardIndex
        )
          return true;
      return false;
    }
    for (var snapshotAb = 0; snapshotAb < artboardCount; snapshotAb++) {
      sourceDoc.activate();
      sourceDoc.artboards.setActiveArtboardIndex(snapshotAb);
      sourceDoc.selection = null;
      sourceDoc.selectObjectsOnActiveArtboard();
      for (var snapshotSelection = 0; snapshotSelection < sourceDoc.selection.length; snapshotSelection++) {
        try {
          var snapshotItem = topLevelItem(sourceDoc.selection[snapshotSelection]);
          var snapshotLayer = sourceLayerFor(snapshotItem);
          if (!snapshotLayer || snapshotLayer.visible === false) continue;
          var targetPlan = findLayerPlan(snapshotLayer);
          if (planContainsItem(targetPlan, snapshotItem, snapshotAb)) continue;
          var snapshotBounds = placementBounds(snapshotItem);
          if (!snapshotBounds) continue;
          targetPlan.items.push({
            item: snapshotItem,
            z: snapshotItem.zOrderPosition,
            bounds: snapshotBounds,
            sourceRect: artboardRects[snapshotAb],
            targetRect: workArtboardRects[snapshotAb],
            artboardIndex: snapshotAb,
          });
        } catch (snapshotItemError) {}
      }
    }

    var colorSpace = DocumentColorSpace.CMYK;
    try {
      colorSpace = sourceDoc.documentColorSpace;
    } catch (e) {}
    var workDoc = null;
    var copiedCount = 0;
    var copyErrors = [];
    var done = 0;
    var saveErrors = [];
    try {
      // Illustrator có thể báo lỗi 1200 khi gọi artboards.add() liên tiếp
      // trên document tạm. Tạo đủ artboard ngay khi tạo document, sau đó mới
      // đặt từng rect; cách này không phụ thuộc artboard đang ở cột nào.
      var maxWorkWidth = 1;
      var maxWorkHeight = 1;
      for (var sizeIndex = 0; sizeIndex < workArtboardRects.length; sizeIndex++) {
        var sizeRect = workArtboardRects[sizeIndex];
        maxWorkWidth = Math.max(maxWorkWidth, sizeRect[2] - sizeRect[0]);
        maxWorkHeight = Math.max(maxWorkHeight, sizeRect[1] - sizeRect[3]);
      }
      workDoc = app.documents.add(
        colorSpace,
        maxWorkWidth,
        maxWorkHeight,
        artboardCount,
      );
      if (workDoc.artboards.length !== artboardCount)
        throw new Error("Không tạo đủ artboard tạm để xuất PDF.");
      // Some Illustrator files fail with error 1200 when assigning
      // artboardRect after creation. Use Illustrator's native rects instead.
      var nativeWorkArtboardRects = [];
      for (var ab = 0; ab < artboardCount; ab++)
        nativeWorkArtboardRects.push(workDoc.artboards[ab].artboardRect.slice(0));
      for (var nativePlanIndex = 0; nativePlanIndex < layerPlans.length; nativePlanIndex++) {
        var nativePlanItems = layerPlans[nativePlanIndex].items;
        for (var nativeItemIndex = 0; nativeItemIndex < nativePlanItems.length; nativeItemIndex++)
          nativePlanItems[nativeItemIndex].targetRect =
            nativeWorkArtboardRects[nativePlanItems[nativeItemIndex].artboardIndex];
      }

      // Layers.add() thêm lên đầu; đi từ layer dưới lên để giữ thứ tự chồng lớp.
      for (var li = 0; li < layerPlans.length; li++) {
        var layerPlan = layerPlans[li];
        var targetLayer = workDoc.layers.add();
        try {
          targetLayer.name = layerPlan.name;
        } catch (e3) {}
        copiedCount += copyLayerItems(layerPlan, targetLayer, copyErrors);
      }
      if (copiedCount === 0)
        return "ERR: Không tìm thấy object nào nằm trong artboard để xuất.";

      for (var ji = 0; ji < jobs.length; ji++) {
        try {
          // Range dùng đúng số thứ tự trong bảng Artboards của Illustrator.
          workDoc.saveAs(jobs[ji].file, makePdfOptions(jobs[ji].range));
          done++;
        } catch (saveError) {
          saveErrors.push(
            jobs[ji].name + ": " +
              (typeof dcMoTaLoi === "function"
                ? dcMoTaLoi(saveError)
                : saveError.toString()),
          );
        }
      }
    } finally {
      try {
        if (workDoc) workDoc.close(SaveOptions.DONOTSAVECHANGES);
      } catch (closeError) {}
      try {
        sourceDoc.activate();
        sourceDoc.artboards.setActiveArtboardIndex(originalArtboard);
        sourceDoc.selection = null;
        for (var restoreSelection = 0; restoreSelection < originalSelection.length; restoreSelection++)
          originalSelection[restoreSelection].selected = true;
      } catch (activateError) {}
    }

    if (done === 0)
      return "ERR: Không lưu được PDF nào." +
        (saveErrors.length ? " " + saveErrors.join(" | ") : "");
    var message =
      "OK: Đã lưu " +
      done +
      " PDF theo thứ tự Artboard" +
      (mode === "pair" ? " (1+2, 3+4...)." : ".");
    if (copyErrors.length)
      message += " Bỏ qua " + copyErrors.length + " object lỗi khi copy.";
    if (saveErrors.length)
      message += " Lỗi " + saveErrors.length + " file: " + saveErrors.join(" | ");
    return message;
  } catch (e) {
    return "ERR: " + (typeof dcMoTaLoi === "function" ? dcMoTaLoi(e) : e.toString());
  }
}

// Xuất từng artboard bằng selection native của Illustrator. Không quét toàn bộ
// document, không lưu AI gốc và mỗi PDF chỉ chứa artwork của artboard cần xuất.
// Active exporter: use the existing AI artboards directly from a temporary copy.
// This avoids creating, moving, or editing artboards in a second document.
function dcLuuDanTheoMauPDF(saveMode, suffix) {
  return dcLuuDanTheoMauPDF_SavedAICopyLegacy(saveMode, suffix);
}

function dcLuuDanTheoMauPDF_SelectedLegacy(saveMode, suffix) {
  try {
    if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
    var sourceDoc = app.activeDocument;
    var mode = String(saveMode === undefined || saveMode === null ? "each" : saveMode);
    if (mode !== "each" && mode !== "pair")
      return "ERR: Kiểu lưu PDF không hợp lệ.";
    var artboardCount = sourceDoc.artboards.length;
    if (artboardCount === 0) return "ERR: Không có artboard nào để lưu.";
    if (mode === "pair" && artboardCount % 2 !== 0)
      return "ERR: Lưu mặt trước + mặt sau cần số artboard chẵn.";

    suffix = String(suffix === undefined || suffix === null ? "" : suffix)
      .replace(/^\s+|\s+$/g, "")
      .replace(/[\\\\\/:*?\"<>|]/g, "-");
    var folder = dcChonThuMucLuuPDF("Chọn nơi lưu PDF đã dàn theo mẫu");
    if (!folder) return "ERR: Chưa chọn thư mục lưu PDF - đã huỷ.";

    var jobs = [];
    var span = mode === "pair" ? 2 : 1;
    for (var first = 0; first < artboardCount; first += span) {
      var fileNo = jobs.length + 1;
      var fileName =
        "file " + fileNo + (suffix ? " - " + suffix : "") + ".pdf";
      var outputFile = new File(folder.fsName + "/" + fileName);
      if (outputFile.exists) return "ERR: File đã tồn tại: " + fileName + ".";
      var indices = [first];
      if (span === 2) indices.push(first + 1);
      jobs.push({ file: outputFile, name: fileName, indices: indices });
    }

    var originalSelection = [];
    try {
      for (var os = 0; os < sourceDoc.selection.length; os++)
        originalSelection.push(sourceDoc.selection[os]);
    } catch (e) {}
    var originalArtboard = 0;
    try {
      originalArtboard = sourceDoc.artboards.getActiveArtboardIndex();
    } catch (e2) {}

    var colorSpace = DocumentColorSpace.CMYK;
    try {
      colorSpace = sourceDoc.documentColorSpace;
    } catch (e3) {}
    var sourceLayers = [];
    for (var li = 0; li < sourceDoc.layers.length; li++) {
      var sourceLayer = sourceDoc.layers[li];
      var sourceLayerName = "Layer";
      try {
        sourceLayerName = sourceLayer.name;
      } catch (layerNameError) {}
      sourceLayers.push({ layer: sourceLayer, name: sourceLayerName });
    }

    function sourceLayerIndex(item) {
      var parent = item;
      try {
        while (parent.parent && parent.parent.typename !== "Layer")
          parent = parent.parent;
        var layer = parent.parent;
        for (var layerIndex = 0; layerIndex < sourceLayers.length; layerIndex++)
          if (sourceLayers[layerIndex].layer === layer) return layerIndex;
      } catch (e) {}
      return 0;
    }
    function topLevelItem(item) {
      var top = item;
      try {
        while (top.parent && top.parent.typename === "GroupItem") top = top.parent;
      } catch (e) {}
      return top;
    }
    function containsItem(entries, item) {
      for (var ci = 0; ci < entries.length; ci++)
        if (entries[ci].item === item) return true;
      return false;
    }
    function snapshotActiveArtboard(index) {
      sourceDoc.activate();
      sourceDoc.artboards.setActiveArtboardIndex(index);
      sourceDoc.selection = null;
      sourceDoc.selectObjectsOnActiveArtboard();
      var entries = [];
      for (var si = 0; si < sourceDoc.selection.length; si++) {
        var item = topLevelItem(sourceDoc.selection[si]);
        try {
          if (containsItem(entries, item)) continue;
          entries.push({
            item: item,
            bounds: item.geometricBounds.slice(0),
            layerIndex: sourceLayerIndex(item),
            z: item.zOrderPosition,
          });
        } catch (snapshotError) {}
      }
      return {
        index: index,
        rect: sourceDoc.artboards[index].artboardRect.slice(0),
        entries: entries,
      };
    }
    function makePdfOptions(pageCount) {
      var opt = new PDFSaveOptions();
      try {
        opt.compatibility = PDFCompatibility.ACROBAT5;
      } catch (e) {}
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
      try {
        opt.artboardRange = pageCount === 1 ? "1" : "1-" + pageCount;
      } catch (e7) {}
      return opt;
    }
    function makeTargetLayers(workDoc) {
      var targetLayers = [];
      // Layers.add() thêm lên đầu; đi từ dưới lên để giữ thứ tự chồng lớp.
      for (var layerIndex = sourceLayers.length - 1; layerIndex >= 0; layerIndex--) {
        var targetLayer = workDoc.layers.add();
        try {
          targetLayer.name = sourceLayers[layerIndex].name;
        } catch (e) {}
        targetLayers[layerIndex] = targetLayer;
      }
      return targetLayers;
    }
    function copyPageEntries(page, workDoc, targetLayers, errors) {
      page.entries.sort(function (a, b) {
        if (a.layerIndex !== b.layerIndex) return b.layerIndex - a.layerIndex;
        return a.z - b.z;
      });
      var copied = 0;
      for (var ei = 0; ei < page.entries.length; ei++) {
        var entry = page.entries[ei];
        try {
          sourceDoc.activate();
          var copiedItem = entry.item.duplicate(
            targetLayers[entry.layerIndex],
            ElementPlacement.PLACEATEND,
          );
          workDoc.activate();
          var copiedBounds = copiedItem.geometricBounds;
          copiedItem.translate(
            entry.bounds[0] - copiedBounds[0],
            entry.bounds[1] - copiedBounds[1],
          );
          copied++;
        } catch (copyError) {
          errors.push(
            "Artboard " + (page.index + 1) + ": " +
              (typeof dcMoTaLoi === "function"
                ? dcMoTaLoi(copyError)
                : copyError.toString()),
          );
        }
      }
      return copied;
    }
    function exportJob(job, errors) {
      var pages = [];
      for (var pi = 0; pi < job.indices.length; pi++) {
        var page = snapshotActiveArtboard(job.indices[pi]);
        if (page.entries.length === 0)
          throw new Error("Artboard " + (page.index + 1) + " không có object để lưu.");
        pages.push(page);
      }

      var workDoc = null;
      try {
        workDoc = app.documents.add(colorSpace);
        workDoc.artboards[0].artboardRect = pages[0].rect.slice(0);
        for (var ai = 1; ai < pages.length; ai++)
          workDoc.artboards.add(pages[ai].rect.slice(0));
        var targetLayers = makeTargetLayers(workDoc);
        var copied = 0;
        for (var pageIndex = 0; pageIndex < pages.length; pageIndex++)
          copied += copyPageEntries(pages[pageIndex], workDoc, targetLayers, errors);
        if (copied === 0) throw new Error("Không copy được object của artboard.");
        workDoc.saveAs(job.file, makePdfOptions(pages.length));
      } finally {
        try {
          if (workDoc) workDoc.close(SaveOptions.DONOTSAVECHANGES);
        } catch (closeError) {}
      }
    }

    var done = 0;
    var copyErrors = [];
    var saveErrors = [];
    try {
      for (var ji = 0; ji < jobs.length; ji++) {
        try {
          exportJob(jobs[ji], copyErrors);
          done++;
        } catch (saveError) {
          saveErrors.push(
            jobs[ji].name + ": " +
              (typeof dcMoTaLoi === "function"
                ? dcMoTaLoi(saveError)
                : saveError.toString()),
          );
        }
      }
    } finally {
      try {
        sourceDoc.activate();
        sourceDoc.artboards.setActiveArtboardIndex(originalArtboard);
        sourceDoc.selection = null;
        for (var rs = 0; rs < originalSelection.length; rs++)
          originalSelection[rs].selected = true;
      } catch (restoreError) {}
    }

    if (done === 0)
      return "ERR: Không lưu được PDF nào." +
        (saveErrors.length ? " " + saveErrors.join(" | ") : "");
    var message =
      "OK: Đã lưu " + done + " PDF theo thứ tự Artboard.";
    if (copyErrors.length)
      message += " Bỏ qua " + copyErrors.length + " object lỗi khi copy.";
    if (saveErrors.length)
      message += " Lỗi " + saveErrors.length + " file: " + saveErrors.join(" | ");
    return message;
  } catch (e) {
    return "ERR: " + (typeof dcMoTaLoi === "function" ? dcMoTaLoi(e) : e.toString());
  }
}

function dcAutoSavePDF(
  prefix,
  startNo,
  pad,
  soHop,
  canMang,
  ngay,
  outFolder,
  note,
) {
  try {
    return _dcAutoSavePDFCore(
      prefix,
      startNo,
      pad,
      soHop,
      canMang,
      ngay,
      outFolder,
      note,
    );
  } catch (e) {
    return (
      "ERR: " + (typeof dcMoTaLoi === "function" ? dcMoTaLoi(e) : e.toString())
    );
  }
}

function _dcAutoSavePDFCore(
  prefix,
  startNo,
  pad,
  soHop,
  canMang,
  ngay,
  outFolder,
  note,
) {
  if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
  var doc = app.activeDocument;

  // ---------- Chuẩn hoá tham số ----------
  prefix =
    prefix === undefined || prefix === null || String(prefix) === ""
      ? "1088"
      : String(prefix).replace(/^\s+|\s+$/g, "");
  if (prefix === "") return "ERR: Mã không được để trống.";
  var startText =
    startNo === undefined || startNo === null
      ? "1"
      : String(startNo).replace(/^\s+|\s+$/g, "");
  if (startText === "") startText = "1";
  if (!/^\d+$/.test(startText))
    return "ERR: STT bắt đầu phải là số nguyên từ 0 trở lên.";
  var startN = parseInt(startText, 10);
  var padText =
    pad === undefined || pad === null
      ? "0"
      : String(pad).replace(/^\s+|\s+$/g, "");
  if (padText === "") padText = "0";
  if (!/^\d+$/.test(padText))
    return "ERR: Số đệm phải là số nguyên từ 0 đến 8.";
  var padN = parseInt(padText, 10);
  if (padN > 8) return "ERR: Số đệm tối đa là 8.";
  soHop = soHop === undefined || soHop === null ? "" : String(soHop);
  // Ghi chú (tuỳ chọn) -> chèn vào tên file giữa số hộp và cán màng.
  note =
    note === undefined || note === null
      ? ""
      : String(note).replace(/^\s+|\s+$/g, "");
  var notePart = note !== "" ? " - " + note : "";
  // Tách danh sách số hộp theo dấu phẩy: "100, 200" -> ["100","200"].
  //  - con thứ i dùng hopList[i]; thiếu thì dùng phần tử cuối.
  var hopList = [];
  var _hp = soHop.split(",");
  for (var _hi = 0; _hi < _hp.length; _hi++) {
    var _v = _hp[_hi].replace(/^\s+|\s+$/g, "");
    if (_v !== "") hopList.push(_v);
  }
  if (hopList.length === 0) hopList.push("");
  function hopForIndex(idx) {
    return idx < hopList.length ? hopList[idx] : hopList[hopList.length - 1];
  }
  canMang =
    canMang === undefined || canMang === null || String(canMang) === ""
      ? "cm"
      : String(canMang);
  ngay = ngay === undefined || ngay === null ? "" : String(ngay);

  // ---------- Kiểm tra selection ----------
  //  Đặt bài thành hàng: cột trái = mặt trước, cột phải = mặt sau.
  //  Hàng chỉ có object ở cột trái được coi là con 1 mặt.
  var sel = doc.selection;
  if (!sel || sel.length === 0)
    return "ERR: Chưa chọn object nào. Hãy chọn các object theo hàng (trái = trước, phải = sau).";

  // ---------- Thư mục lưu ----------
  //  CHỈ lưu vào folder người dùng chọn. KHÔNG tự tạo folder mới.
  //  Lưu ý: ExtendScript hiểu path dạng '/'; path Windows '\' + khoảng
  //  trắng + ngoặc phải chuẩn hoá, nếu không folder.exists sẽ báo sai.
  function resolveFolder(p) {
    if (!p) return null;
    p = String(p);
    var cands = [];
    cands.push(p); // nguyên gốc
    cands.push(p.replace(/\\/g, "/")); // đổi \ -> /
    // Bọc dạng URI (encode khoảng trắng, ngoặc...) để ExtendScript đọc đúng.
    try {
      cands.push(decodeURI(p));
    } catch (e) {}
    for (var i = 0; i < cands.length; i++) {
      var f = new Folder(cands[i]);
      if (f.exists) return f;
    }
    return null;
  }

  var folder;
  if (outFolder && String(outFolder) !== "") {
    folder = resolveFolder(outFolder);
    if (!folder) {
      // Không mở được path đã nhập -> mở hộp chọn thay vì báo lỗi cụt.
      folder = dcChonThuMucLuuPDF("Không mở được thư mục đã nhập. Chọn lại");
      if (!folder)
        return (
          "ERR: Thư mục lưu không mở được: " +
          outFolder +
          '\nHãy bấm "Chọn…" để chọn đúng thư mục.'
        );
    }
  } else {
    // Chưa nhập -> mở hộp thoại cho chọn (không tự tạo, không tự đoán).
    folder = dcChonThuMucLuuPDF("Chọn nơi lưu PDF");
    if (!folder) return "ERR: Chưa chọn thư mục lưu — đã huỷ.";
  }

  // ---------- Đọc bao mỗi object (geometricBounds) ----------
  // Illustrator trả về [left, top, right, bottom]; y hướng lên (top > bottom).
  var items = [];
  var minH = Number.MAX_VALUE;
  for (var i = 0; i < sel.length; i++) {
    var g = null;
    try {
      g = sel[i].geometricBounds;
    } catch (boundsError) {}
    if (
      !g ||
      g.length !== 4 ||
      !isFinite(g[0]) ||
      !isFinite(g[1]) ||
      !isFinite(g[2]) ||
      !isFinite(g[3]) ||
      g[2] <= g[0] ||
      g[1] <= g[3]
    )
      return (
        "ERR: Object " +
        (i + 1) +
        " không có khung hợp lệ. Hãy bỏ object lỗi/đang ẩn rồi thử lại."
      );
    var left = g[0],
      top = g[1],
      right = g[2],
      bottom = g[3];
    var h = top - bottom;
    if (h > 0 && h < minH) minH = h;
    items.push({
      o: sel[i],
      top: top,
      left: left,
      cy: (top + bottom) / 2,
      cx: (left + right) / 2,
    });
  }
  if (!isFinite(minH) || minH <= 0) minH = 10;

  // ---------- Gom theo hàng rồi nhận diện 1 mặt / 2 mặt ----------
  //  Các mặt trong cùng hàng có thể lệch dọc một ít. Dùng 45% chiều cao
  //  object nhỏ nhất làm dung sai để không ghép nhầm object ở hai hàng kề nhau.
  // Illustrator có trục Y tăng dần lên trên, nên tâm Y lớn hơn là hàng trên.
  // Sắp giảm dần để STT và file được xuất từ trên xuống dưới.
  items.sort(function (a, b) {
    return b.cy - a.cy;
  });

  var ROW_TOLERANCE = Math.max(minH * 0.45, 4);
  var rows = [];
  for (i = 0; i < items.length; i++) {
    var lastRow = rows.length ? rows[rows.length - 1] : null;
    if (!lastRow || Math.abs(items[i].cy - lastRow.cy) > ROW_TOLERANCE) {
      rows.push({ cy: items[i].cy, items: [items[i]] });
    } else {
      var oldCount = lastRow.items.length;
      lastRow.items.push(items[i]);
      lastRow.cy = (lastRow.cy * oldCount + items[i].cy) / (oldCount + 1);
    }
  }

  // Lấy vị trí cột từ những hàng có đủ 2 mặt. Chỉ dùng để kiểm tra các
  // hàng lẻ: object đơn phải nằm gần cột trái, nếu nằm gần cột phải thì
  // có khả năng người dùng chọn thiếu mặt trước nên dừng để tránh xuất sai.
  var leftColumnTotal = 0,
    rightColumnTotal = 0,
    twoSideRows = 0;
  for (i = 0; i < rows.length; i++) {
    var rowItems = rows[i].items;
    rowItems.sort(function (a, b) {
      return a.cx - b.cx;
    });
    if (rowItems.length > 2)
      return (
        "ERR: Hàng " +
        (i + 1) +
        " có " +
        rowItems.length +
        " object. Mỗi hàng chỉ đặt 1 object (1 mặt) hoặc 2 object (trước + sau)."
      );
    if (rowItems.length === 2) {
      leftColumnTotal += rowItems[0].left;
      rightColumnTotal += rowItems[1].left;
      twoSideRows++;
    }
  }

  var leftColumnX = twoSideRows ? leftColumnTotal / twoSideRows : 0;
  var rightColumnX = twoSideRows ? rightColumnTotal / twoSideRows : 0;

  // Mỗi hàng đủ 2 object là con 2 mặt. Hàng chỉ có cột trái là con 1 mặt.
  var cards = [];
  var oneSideCards = 0;
  for (i = 0; i < rows.length; i++) {
    var row = rows[i].items;
    if (row.length === 2) {
      cards.push({ front: row[0].o, back: row[1].o, oneSide: false });
      continue;
    }

    var single = row[0];
    if (
      twoSideRows > 0 &&
      Math.abs(single.left - rightColumnX) < Math.abs(single.left - leftColumnX)
    )
      return (
        "ERR: Hàng " +
        (i + 1) +
        " chỉ có object ở gần cột phải. Hãy chọn thêm mặt trước ở cột trái, hoặc đặt con 1 mặt ở cột trái."
      );

    cards.push({ front: single.o, back: null, oneSide: true });
    oneSideCards++;
  }

  // ---------- Tuỳ chọn PDF (nhẹ, giữ vector, không hạ chất lượng) ----------
  function makePdfOptions() {
    var opt = new PDFSaveOptions();
    try {
      opt.compatibility = PDFCompatibility.ACROBAT5;
    } catch (e) {}
    opt.generateThumbnails = false;
    opt.preserveEditability = false; // KHÔNG nhúng dữ liệu AI -> file nhẹ
    try {
      opt.optimization = true;
    } catch (e) {}
    try {
      opt.viewAfterSaving = false;
    } catch (e) {}
    // Ép xuất TẤT CẢ artboard (2 trang: trước + sau).
    try {
      opt.saveMultipleArtboards = true;
    } catch (e) {}
    // Không set artboardRange -> mặc định toàn bộ artboard.
    return opt;
  }

  // ---------- Xuất 1 con card ra PDF 2 trang ----------
  //  Theo đúng cách cross-doc đã chạy ổn trong panel (dcHocMau):
  //    - PHẢI active doc GỐC trước mỗi lần .duplicate()
  //    - Duplicate xong mới đo bounds thật rồi set artboardRect
  //  Tránh lỗi 1220 "Illegal Argument".
  var MM = 2.834645669;
  var GAP = 20 * MM; // khoảng cách 2 mặt trong doc tạm (pt)

  // Bounds an toàn: ưu tiên visibleBounds, fallback geometricBounds.
  function bndOf(item) {
    try {
      return item.visibleBounds;
    } catch (e) {
      try {
        return item.geometricBounds;
      } catch (e2) {
        return null;
      }
    }
  }

  // Lấy khung của CLIP MASK trên object (nếu có). Con card đã clip
  // 9.2x5.6 -> trả về đúng bao của đường clip, KHÔNG tính phần lòi ra
  // ngoài như visibleBounds. Không có clip -> trả null.
  function clipRectOf(item) {
    try {
      if (item.typename === "GroupItem" && item.clipped === true) {
        var p = item.pageItems;
        for (var i = 0; i < p.length; i++) {
          try {
            if (p[i].clipping === true) return p[i].geometricBounds;
          } catch (eC) {}
        }
      }
    } catch (e) {}
    return null;
  }
  // Ưu tiên khung clip; không có clip thì mới dùng visibleBounds.
  function frameOf(item) {
    var c = clipRectOf(item);
    if (c) return c;
    return bndOf(item);
  }

  function exportCard(card, filePath) {
    // Always close the temporary document. If Illustrator fails part-way
    // through a PDF, remove that incomplete file instead of leaving it mixed
    // with successful exports.
    var tmp = null,
      completed = false;
    try {
      // Doc tạm nhỏ, KHÔNG truyền khổ (dùng mặc định) -> tránh 1220.
      tmp = app.documents.add(DocumentColorSpace.CMYK);
      var lay = tmp.layers[0];

      // --- Mặt trước: duplicate từ doc gốc (phải active gốc trước) ---
      app.activeDocument = doc;
      var dupF = card.front.duplicate(lay, ElementPlacement.PLACEATEND);
      app.activeDocument = tmp;
      // Đo theo KHUNG CLIP có sẵn trên object (không lấy phần lòi ra).
      var gf = frameOf(dupF); // [left, top, right, bottom]
      if (!gf) throw new Error("Không đo được mặt trước.");

      var ab = tmp.artboards;
      // Trang 1 = mặt trước (khớp đúng khung clip).
      ab[0].artboardRect = [gf[0], gf[1], gf[2], gf[3]];

      if (!card.oneSide && card.back) {
        // --- Con 2 MẶT: thêm mặt sau -> 2 trang ---
        app.activeDocument = doc;
        var dupB = card.back.duplicate(lay, ElementPlacement.PLACEATEND);
        app.activeDocument = tmp;
        var gb = frameOf(dupB);
        if (!gb) throw new Error("Không đo được mặt sau.");

        // Dời mặt sau sang phải mặt trước (cạnh nhau), cùng mép trên.
        //  Dời theo mép của KHUNG CLIP để 2 trang khớp nhau.
        var wantLeft = gf[2] + GAP;
        var wantTop = gf[1];
        dupB.translate(wantLeft - gb[0], wantTop - gb[1]);
        var gb2 = frameOf(dupB);
        if (!gb2) throw new Error("Không đo được mặt sau sau khi dời trang.");
        ab.add([gb2[0], gb2[1], gb2[2], gb2[3]]); // trang 2: mặt sau
      }

      tmp.saveAs(new File(filePath), makePdfOptions());
      completed = true;
    } finally {
      try {
        if (tmp) tmp.close(SaveOptions.DONOTSAVECHANGES);
      } catch (closeTempError) {}
      if (!completed) {
        try {
          var incomplete = new File(filePath);
          if (incomplete.exists) incomplete.remove();
        } catch (removeIncompleteError) {}
      }
    }
  }

  // ---------- Tạo tên file an toàn ----------
  function pad0(n, width) {
    var s = String(n);
    while (s.length < width) s = "0" + s;
    return s;
  }
  function sanitize(s) {
    // Loại ký tự cấm trong tên file Windows.
    return String(s)
      .replace(/[\\\/:*?"<>|]/g, "-")
      .replace(/\s+$/g, "");
  }
  function makePdfName(sttValue, card, hopValue) {
    var sttStr = padN > 0 ? pad0(sttValue, padN) : String(sttValue);
    var oneSidePart = card.oneSide ? " - 1 mat" : "";
    return sanitize(
      prefix +
        " - " +
        sttStr +
        " - " +
        hopValue +
        " hop" +
        notePart +
        oneSidePart +
        " - " +
        canMang +
        " - " +
        ngay +
        ".pdf",
    );
  }
  function buildOutputPlan() {
    var result = [],
      seen = {},
      nextStt = startN;
    for (var pi = 0; pi < cards.length; pi++) {
      for (var ph = 0; ph < hopList.length; ph++) {
        var fileName = makePdfName(nextStt, cards[pi], hopList[ph]);
        var filePath = folder.fsName + "/" + fileName;
        var fileKey = String(filePath).toLowerCase();
        if (!fileName || fileName === ".pdf")
          return { error: "Tên file PDF rỗng sau khi chuẩn hoá." };
        if (fileName.length > 220 || filePath.length > 245)
          return {
            error:
              "Tên hoặc đường dẫn PDF quá dài ở STT " +
              nextStt +
              ". Hãy rút gọn ghi chú hoặc chọn thư mục ngắn hơn.",
          };
        if (seen[fileKey])
          return {
            error:
              "Có hai file trùng tên: " +
              fileName +
              ". Hãy đổi STT, số hộp hoặc ghi chú.",
          };
        if (new File(filePath).exists)
          return {
            error:
              "File đã tồn tại: " +
              fileName +
              ". Auto Save dừng để không ghi đè file cũ.",
          };
        seen[fileKey] = true;
        result.push({
          card: cards[pi],
          stt: nextStt,
          sttStr: padN > 0 ? pad0(nextStt, padN) : String(nextStt),
          full: filePath,
        });
        nextStt++;
      }
    }
    return { files: result, error: "" };
  }

  // ---------- Vòng lặp xuất ----------
  //  Mỗi CON CARD xuất 1 file cho MỖI số hộp trong danh sách.
  //  Vd chọn 1 con + nhập "100,200,300" -> 3 file cùng con đó,
  //  số hộp 100/200/300. STT tăng theo từng FILE.
  var done = 0,
    errs = [];
  var plan = buildOutputPlan();
  if (plan.error) return "ERR: " + plan.error;
  var totalFiles = plan.files.length;
  for (i = 0; i < plan.files.length; i++) {
    var job = plan.files[i];
    try {
      exportCard(job.card, job.full);
      done++;
    } catch (e2) {
      errs.push(
        "Con " +
          job.sttStr +
          ": " +
          (typeof dcMoTaLoi === "function" ? dcMoTaLoi(e2) : e2.toString()),
      );
    }
  }

  // Trả tiêu điểm về file gốc.
  try {
    app.activeDocument = doc;
  } catch (e) {}

  var msg =
    "OK: Đã lưu " +
    done +
    "/" +
    totalFiles +
    " file PDF.\n" +
    "Nhận diện: " +
    oneSideCards +
    " con 1 mặt, " +
    (cards.length - oneSideCards) +
    " con 2 mặt.\n" +
    "Thư mục: " +
    folder.fsName;
  if (twoSideRows === 0 && cards.length > 0)
    msg += "\nKhông có hàng 2 cột: toàn bộ selection được coi là con 1 mặt.";
  if (errs.length) {
    msg =
      (done > 0 ? "OK: " : "ERR: ") +
      "Lưu được " +
      done +
      "/" +
      totalFiles +
      " file.\n" +
      "Nhận diện: " +
      oneSideCards +
      " con 1 mặt, " +
      (cards.length - oneSideCards) +
      " con 2 mặt.\n" +
      "Lỗi:\n- " +
      errs.join("\n- ") +
      "\nThư mục: " +
      folder.fsName;
    if (twoSideRows === 0 && cards.length > 0)
      msg += "\nKhông có hàng 2 cột: toàn bộ selection được coi là con 1 mặt.";
  }
  return msg;
}

// ============================================================
//  dcChonThuMucLuuPDF — mở Save As Windows đầy đủ và trả thư mục được chọn.
// ============================================================
function dcChonThuMucLuuPDF(dialogTitle) {
  var startFolder = Folder.myDocuments;
  try {
    if (Folder.current && Folder.current.exists) startFolder = Folder.current;
  } catch (currentFolderError) {}
  // saveDlg của một File có sẵn tên sẽ mở cửa sổ Windows đầy đủ nhưng người
  // dùng chỉ cần chọn thư mục và bấm Save; tên này không bao giờ được tạo.
  var defaultFile = new File(startFolder.fsName + "/chon-thu-muc.pdf");
  var picked = defaultFile.saveDlg(
    dialogTitle + " - chọn thư mục rồi bấm Save",
    "*.pdf",
  );
  if (!picked) return null;
  try {
    return picked.parent && picked.parent.exists ? picked.parent : null;
  } catch (e) {}
  return null;
}

// ============================================================
//  dcPickFolder — trả đường dẫn cho ô Thư mục lưu của Auto Save.
// ============================================================
function dcPickFolder() {
  try {
    var f = dcChonThuMucLuuPDF("Chọn nơi lưu PDF");
    if (!f) return "ERR:huỷ";
    return "OK:" + f.fsName;
  } catch (e) {
    return "ERR:" + e.toString();
  }
}

// ============================================================
//  dcClipToSize — Clip từng object đang chọn thành khung KT nhập,
//  CANH GIỮA (tâm) mỗi object.
//  Tác giả: LỘC (Code dạo) — thêm cho DanCard
//
//  Dùng: bấm Raster (nút có sẵn) để biến object thành hình trước,
//  rồi bấm Clip -> nhập Rộng x Cao -> mỗi object bị cắt thành đúng
//  khung KT đó (phần thừa ẩn đi, phần thiếu để trống).
//
//  Tham số:
//    wCm, hCm : Rộng, Cao (đơn vị theo unit; mặc định "cm")
//    unit     : "cm" | "mm" | "in" | "pt"  (mặc định "cm")
//  Trả về "OK: ..." hoặc "ERR: ...".
// ============================================================
function dcClipToSize(wCm, hCm, unit) {
  try {
    return _dcClipToSizeCore(wCm, hCm, unit);
  } catch (e) {
    return (
      "ERR: " + (typeof dcMoTaLoi === "function" ? dcMoTaLoi(e) : e.toString())
    );
  }
}

function _dcClipToSizeCore(wCm, hCm, unit) {
  if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
  var doc = app.activeDocument;

  // ----- Đổi đơn vị sang point -----
  unit =
    unit === undefined || unit === null || String(unit) === ""
      ? "cm"
      : String(unit);
  var PER = { "cm": 28.34645669, "mm": 2.834645669, "in": 72, "pt": 1 };
  var k = PER[unit];
  if (!k) return "ERR: Đơn vị không hợp lệ: " + unit;

  var W = parseFloat(String(wCm).replace(",", ".")) * k;
  var H = parseFloat(String(hCm).replace(",", ".")) * k;
  if (isNaN(W) || isNaN(H) || W <= 0 || H <= 0)
    return "ERR: Kích thước không hợp lệ (Rộng × Cao phải > 0).";

  var sel = doc.selection;
  if (!sel || sel.length === 0)
    return "ERR: Hãy chọn ít nhất 1 object để clip.";

  // Bounds an toàn (ưu tiên visibleBounds).
  function bndOf(item) {
    try {
      return item.visibleBounds;
    } catch (e) {
      try {
        return item.geometricBounds;
      } catch (e2) {
        return null;
      }
    }
  }

  // Clip 1 object thành khung W x H canh giữa tâm object.
  function clipOne(item) {
    var g = bndOf(item); // [left, top, right, bottom]
    if (!g) throw new Error("không đo được object.");
    var cx = (g[0] + g[2]) / 2;
    var cy = (g[1] + g[3]) / 2;

    var parent = item.parent;
    var lay = item.layer;

    // Nhóm bọc: mask + object -> clip group.
    var wrapper = parent.groupItems.add();
    try {
      wrapper.move(item, ElementPlacement.PLACEBEFORE);
    } catch (e) {}

    // Rectangle(top, left, width, height) — top là y lớn (hướng lên).
    var maskTop = cy + H / 2;
    var maskLeft = cx - W / 2;
    var mask = lay.pathItems.rectangle(maskTop, maskLeft, W, H);
    mask.filled = false;
    mask.stroked = false;
    mask.move(wrapper, ElementPlacement.PLACEATBEGINNING);

    item.move(wrapper, ElementPlacement.PLACEATEND);
    mask.clipping = true;
    wrapper.clipped = true;
    return wrapper;
  }

  // Chọn lại các bản đã clip cho tiện thao tác tiếp.
  var results = [];
  var done = 0,
    errs = [];
  // Lưu tham chiếu selection ra mảng (clip làm thay đổi selection).
  var arr = [];
  for (var i = 0; i < sel.length; i++) arr.push(sel[i]);

  for (i = 0; i < arr.length; i++) {
    try {
      var w = clipOne(arr[i]);
      results.push(w);
      done++;
    } catch (e2) {
      errs.push(
        "Object " +
          (i + 1) +
          ": " +
          (typeof dcMoTaLoi === "function" ? dcMoTaLoi(e2) : e2.toString()),
      );
    }
  }

  try {
    app.selection = null;
    for (i = 0; i < results.length; i++) results[i].selected = true;
  } catch (e) {}

  var msg =
    "OK: Đã clip " +
    done +
    "/" +
    arr.length +
    " object thành " +
    wCm +
    " × " +
    hCm +
    " " +
    unit +
    " (canh giữa).";
  if (errs.length) {
    msg =
      (done > 0 ? "OK: " : "ERR: ") +
      "Clip được " +
      done +
      "/" +
      arr.length +
      " object.\nLỗi:\n- " +
      errs.join("\n- ");
  }
  return msg;
}

// ============================================================
//  dcClipCard926 — Clip nhanh card 9.2 x 5.6 cm cho tab Auto Save.
//  Cố định KT 9.2 x 5.6; TỰ XOAY KHUNG theo object:
//    - object nằm ngang (rộng >= cao) -> khung 9.2 x 5.6
//    - object đứng dọc  (cao  >  rộng) -> khung 5.6 x 9.2
//  Canh giữa (tâm) mỗi object. Không xoay object, chỉ xoay khung clip.
//  Trả về "OK: ..." hoặc "ERR: ...".
// ============================================================
function dcClipCard926() {
  try {
    return _dcClipCard926Core();
  } catch (e) {
    return (
      "ERR: " + (typeof dcMoTaLoi === "function" ? dcMoTaLoi(e) : e.toString())
    );
  }
}

function _dcClipCard926Core() {
  if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";
  var doc = app.activeDocument;

  var CM = 28.34645669;
  var LONG = 9.2 * CM; // cạnh dài
  var SHORT = 5.6 * CM; // cạnh ngắn

  var sel = doc.selection;
  if (!sel || sel.length === 0)
    return "ERR: Hãy chọn ít nhất 1 object để clip 9.2×5.6.";

  function bndOf(item) {
    try {
      return item.visibleBounds;
    } catch (e) {
      try {
        return item.geometricBounds;
      } catch (e2) {
        return null;
      }
    }
  }

  function clipOne(item) {
    var g = bndOf(item); // [left, top, right, bottom]
    if (!g) throw new Error("không đo được object.");
    var w = g[2] - g[0]; // rộng
    var h = g[1] - g[3]; // cao
    var cx = (g[0] + g[2]) / 2;
    var cy = (g[1] + g[3]) / 2;

    // Tự xoay khung: đứng dọc -> khung dọc (5.6 rộng x 9.2 cao).
    var W, H;
    if (h > w) {
      W = SHORT;
      H = LONG;
    } // object đứng
    else {
      W = LONG;
      H = SHORT;
    } // object nằm ngang

    var parent = item.parent;
    var lay = item.layer;

    var wrapper = parent.groupItems.add();
    try {
      wrapper.move(item, ElementPlacement.PLACEBEFORE);
    } catch (e) {}

    var maskTop = cy + H / 2;
    var maskLeft = cx - W / 2;
    var mask = lay.pathItems.rectangle(maskTop, maskLeft, W, H);
    mask.filled = false;
    mask.stroked = false;
    mask.move(wrapper, ElementPlacement.PLACEATBEGINNING);

    item.move(wrapper, ElementPlacement.PLACEATEND);
    mask.clipping = true;
    wrapper.clipped = true;
    return wrapper;
  }

  var arr = [];
  for (var i = 0; i < sel.length; i++) arr.push(sel[i]);

  var results = [],
    done = 0,
    errs = [];
  for (i = 0; i < arr.length; i++) {
    try {
      results.push(clipOne(arr[i]));
      done++;
    } catch (e2) {
      errs.push(
        "Object " +
          (i + 1) +
          ": " +
          (typeof dcMoTaLoi === "function" ? dcMoTaLoi(e2) : e2.toString()),
      );
    }
  }

  try {
    app.selection = null;
    for (i = 0; i < results.length; i++) results[i].selected = true;
  } catch (e) {}

  var msg =
    "OK: Đã clip " +
    done +
    "/" +
    arr.length +
    " object thành 9.2×5.6 (tự xoay khung, canh giữa).";
  if (errs.length) {
    msg =
      (done > 0 ? "OK: " : "ERR: ") +
      "Clip được " +
      done +
      "/" +
      arr.length +
      " object.\nLỗi:\n- " +
      errs.join("\n- ");
  }

  return msg;
}
