/* main.js — Công cụ bình: Dàn Card, Dàn tối ưu/Dàn bế, Đổi tên, Variable. */
(function () {
  "use strict";
  var cs = new CSInterface();

  // ===== VÒNG SÁNG QUANH CHỮ "LỘC" (author) =====
  // Các hạt sáng CHẠY THEO QUỸ ĐẠO VÒNG TRÒN, để lại vệt sáng phía sau
  // (đầu sáng nhất, đuôi mờ dần). Chạy tới đâu sáng hơn tới đó.
  // Đồng thời bắn tia nhỏ ra ngoài tại nơi hạt vừa qua.
  // Nửa trái ấm (vàng/cam/đỏ/hồng), nửa phải lạnh (xanh dương/lam).
  (function initLocBurst() {
    var cv = document.querySelector(".loc-burst-canvas");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 1.25);
    var W, H, CX, CY, R, RMAX;
    function size() {
      W = cv.clientWidth || 104;
      H = cv.clientHeight || 104;
      cv.width = W * DPR;
      cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      CX = W / 2;
      CY = H / 2;
      R = Math.min(W, H) * 0.172;
      RMAX = Math.min(W, H) / 2 - 3; // mép an toàn để tia không bị cắt
    }
    size();
    window.addEventListener("resize", size);

    var TWO_PI = Math.PI * 2;

    // Màu theo góc (giống hình mẫu): nửa TRÁI ấm (đỏ/cam/vàng),
    // nửa PHẢI lạnh (xanh dương/lam), chuyển mượt ở trên & dưới.
    function hueForAngle(a) {
      // a: 0 = phải, PI/2 = xuống, PI = trái. Dùng cos để lấy trái/phải.
      var c = Math.cos(a); // 1 phải .. -1 trái
      var t = (c + 1) / 2; // 0 trái .. 1 phải
      if (t < 0.5) {
        // trái: vàng(48) -> cam -> đỏ -> hồng(345)
        var k = t / 0.5; // 0..1 (0 = trái nhất)
        var hue = 45 - (1 - k) * 60; // k=1 ->45(vàng cam); k=0 -> -15=345(hồng đỏ)
        if (hue < 0) hue += 360;
        return hue;
      }
      // phải: tím xanh(255) -> xanh dương(205)
      var k2 = (t - 0.5) / 0.5; // 0..1 (1 = phải nhất)
      return 255 - k2 * 52;
    }

    // ================= TIA BẮN THẲNG RA NGOÀI =================
    // Dày đặc quanh vòng, độ dài ngẫu nhiên (viền lởm chởm như hình).
    // Mỗi tia tự "thở": sáng lên rồi mờ đi rồi đổi độ dài -> động liên tục.
    var NRAY = 108;
    var rays = [];
    function newRayLen() {
      // đa số DÀI (như hình), một số ngắn để viền lởm chởm.
      var base = 0.45 + Math.random() * 0.5; // 0.45..0.95 lần span
      if (Math.random() < 0.25) base = 0.2 + Math.random() * 0.3; // vài tia ngắn
      return base;
    }
    function mkRay(i) {
      var ang =
        (i / NRAY) * TWO_PI + (Math.random() - 0.5) * (TWO_PI / NRAY) * 1.2;
      return {
        ang: ang,
        lenR: newRayLen(),
        w: 0.4 + Math.random() * 1.3,
        phase: Math.random() * TWO_PI,
        speed: 0.6 + Math.random() * 1.8,
        bright: 0.4 + Math.random() * 0.6,
      };
    }
    for (var i = 0; i < NRAY; i++) rays.push(mkRay(i));

    // ================= ĐỐM (vuông + tròn) BÊN TRONG =================
    var motes = [];
    var NMOTE = 52;
    function mkMote(seed) {
      var ang = Math.random() * TWO_PI;
      // tụ quanh vòng (hơi vào trong) như vành bokeh trong hình
      var rr = R * (0.5 + Math.random() * 0.72);
      return {
        ang: ang,
        r: rr,
        hue: hueForAngle(ang),
        size: 0.8 + Math.random() * 3.4,
        square: Math.random() < 0.5,
        prog: seed ? Math.random() : 0,
        life: 1.4 + Math.random() * 2.2,
        drift: (Math.random() - 0.5) * 0.004,
        rDrift: (Math.random() - 0.25) * 0.22,
        spin: Math.random() * TWO_PI,
      };
    }
    for (var mI = 0; mI < NMOTE; mI++) motes.push(mkMote(true));

    // ================= ELECTRON BAY QUANH (kiểu nguyên tử) =================
    // Nhiều electron chạy trên các quỹ đạo elip nghiêng quanh hạt nhân,
    // mỗi cái để lại vệt sáng đuôi mờ dần.
    var orbits = [];
    var NORBIT = 3;
    function mkOrbit(i) {
      var tilt = (i / NORBIT) * Math.PI + Math.random() * 0.4; // góc nghiêng mặt phẳng quỹ đạo
      return {
        tilt: tilt,
        rx: R * (1.15 + Math.random() * 0.5), // bán trục lớn
        ry: R * (0.32 + Math.random() * 0.4), // bán trục nhỏ (elip dẹt -> cảm giác 3D)
        speed: (0.9 + Math.random() * 1.1) * (Math.random() < 0.5 ? 1 : -1),
        phase: Math.random() * TWO_PI,
        hue: hueForAngle(Math.cos(tilt) > 0 ? 0 : Math.PI),
        trail: [],
      };
    }
    for (var oi = 0; oi < NORBIT; oi++) orbits.push(mkOrbit(oi));

    // điểm trên quỹ đạo elip nghiêng (quay mặt phẳng theo tilt)
    function orbitPoint(o, ph) {
      var ex = Math.cos(ph) * o.rx;
      var ey = Math.sin(ph) * o.ry;
      var ct = Math.cos(o.tilt),
        st = Math.sin(o.tilt);
      return {
        x: CX + ex * ct - ey * st,
        y: CY + ex * st + ey * ct,
        // "chiều sâu": sin(ph) <0 -> phía sau hạt nhân (mờ hơn)
        depth: Math.sin(ph),
      };
    }

    var t = 0,
      lastFrame = 0;
    function frame(now) {
      if (!lastFrame) lastFrame = now;
      var elapsed = now - lastFrame;
      if (elapsed < 33) {
        requestAnimationFrame(frame);
        return;
      }
      lastFrame = now;
      t += Math.min(elapsed, 80) / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      var span = RMAX - R;

      // -------- QUẦNG SÁNG NỀN (ấm trái / lạnh phải) --------
      var glowL = ctx.createRadialGradient(
        CX - R * 0.6,
        CY,
        R * 0.2,
        CX - R * 0.6,
        CY,
        RMAX * 0.9,
      );
      glowL.addColorStop(0, "hsla(2,100%,55%,0.18)");
      glowL.addColorStop(0.5, "hsla(20,100%,55%,0.07)");
      glowL.addColorStop(1, "hsla(30,100%,55%,0)");
      ctx.fillStyle = glowL;
      ctx.beginPath();
      ctx.arc(CX, CY, RMAX, 0, TWO_PI);
      ctx.fill();
      var glowR = ctx.createRadialGradient(
        CX + R * 0.6,
        CY,
        R * 0.2,
        CX + R * 0.6,
        CY,
        RMAX * 0.9,
      );
      glowR.addColorStop(0, "hsla(220,100%,58%,0.18)");
      glowR.addColorStop(0.5, "hsla(210,100%,58%,0.07)");
      glowR.addColorStop(1, "hsla(210,100%,58%,0)");
      ctx.fillStyle = glowR;
      ctx.beginPath();
      ctx.arc(CX, CY, RMAX, 0, TWO_PI);
      ctx.fill();

      // -------- TIA quanh hạt nhân (sáng đều, thở nhẹ) --------
      for (var i = 0; i < rays.length; i++) {
        var ry = rays[i];
        var puls = 0.5 + 0.5 * Math.sin(t * ry.speed + ry.phase);
        var alpha = ry.bright * (0.3 + 0.7 * puls);
        var hue = hueForAngle(ry.ang);
        var dx = Math.cos(ry.ang),
          dy = Math.sin(ry.ang);
        var r0 = R + 1;
        var lenNow = span * ry.lenR * (0.7 + 0.3 * puls) * 0.62;
        if (r0 + lenNow > RMAX) lenNow = RMAX - r0;
        var x1 = CX + dx * r0,
          y1 = CY + dy * r0;
        var x2 = CX + dx * (r0 + lenNow),
          y2 = CY + dy * (r0 + lenNow);
        var g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, "hsla(" + hue + ",100%,68%," + alpha + ")");
        g.addColorStop(0.35, "hsla(" + hue + ",100%,58%," + alpha * 0.75 + ")");
        g.addColorStop(1, "hsla(" + hue + ",100%,52%,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = ry.w;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (Math.random() < 0.006) ry.lenR = newRayLen();
      }

      // -------- ĐỐM bên trong (sáng đều) --------
      for (var m = 0; m < motes.length; m++) {
        var mo = motes[m];
        mo.prog += 0.016 / mo.life;
        mo.ang += mo.drift;
        mo.r += mo.rDrift;
        if (mo.prog >= 1 || mo.r > R * 1.5 || mo.r < R * 0.3) {
          motes[m] = mkMote(false);
          continue;
        }
        var fade = Math.sin(mo.prog * Math.PI);
        var tw = 0.6 + 0.4 * Math.sin(t * 6 + mo.spin);
        var a = fade * tw * 0.85;
        var mx = CX + Math.cos(mo.ang) * mo.r,
          my = CY + Math.sin(mo.ang) * mo.r;
        ctx.fillStyle = "hsla(" + mo.hue + ",100%,66%," + a + ")";
        if (mo.square) {
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(mo.spin + t * 0.6);
          ctx.fillRect(-mo.size / 2, -mo.size / 2, mo.size, mo.size);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(mx, my, mo.size * 0.6, 0, TWO_PI);
          ctx.fill();
        }
      }

      // -------- VÒNG hạt nhân (màu đều + lõi trắng mảnh) --------
      var seg = 64;
      for (var s = 0; s < seg; s++) {
        var a0 = (s / seg) * TWO_PI,
          a1 = ((s + 1) / seg) * TWO_PI;
        var hue2 = hueForAngle((a0 + a1) / 2);
        ctx.beginPath();
        ctx.arc(CX, CY, R, a0, a1);
        ctx.strokeStyle = "hsla(" + hue2 + ",100%,60%,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, TWO_PI);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.1;
      ctx.shadowBlur = 6;
      ctx.shadowColor = "rgba(255,255,255,0.7)";
      ctx.stroke();
      ctx.shadowBlur = 0;

      // -------- ELECTRON bay quanh: vệt sáng phía sau mờ, phía trước rực --------
      var TRAIL = 8;
      for (var o = 0; o < orbits.length; o++) {
        var ob = orbits[o];
        var ph = ob.phase + t * ob.speed;
        // vẽ đường quỹ đạo mờ (elip)
        ctx.beginPath();
        for (var k = 0; k <= 24; k++) {
          var pp = orbitPoint(ob, (k / 24) * TWO_PI);
          if (k === 0) ctx.moveTo(pp.x, pp.y);
          else ctx.lineTo(pp.x, pp.y);
        }
        ctx.strokeStyle = "hsla(" + ob.hue + ",90%,65%,0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // vệt đuôi của electron
        for (var tr = TRAIL; tr >= 1; tr--) {
          var pt = orbitPoint(ob, ph - tr * 0.09);
          var frac = 1 - tr / TRAIL; // 0 đuôi -> 1 đầu
          var depthA = pt.depth < 0 ? 0.4 : 1; // sau hạt nhân thì mờ
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 0.6 + frac * 1.8, 0, TWO_PI);
          ctx.fillStyle =
            "hsla(" +
            ob.hue +
            ",100%," +
            (60 + frac * 25) +
            "%," +
            frac * 0.5 * depthA +
            ")";
          ctx.fill();
        }
        // electron (đầu) sáng chói
        var head = orbitPoint(ob, ph);
        var depthH = head.depth < 0 ? 0.5 : 1;
        var hg = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 5);
        hg.addColorStop(0, "rgba(255,255,255," + 0.95 * depthH + ")");
        hg.addColorStop(
          0.4,
          "hsla(" + ob.hue + ",100%,70%," + 0.6 * depthH + ")",
        );
        hg.addColorStop(1, "hsla(" + ob.hue + ",100%,60%,0)");
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 5, 0, TWO_PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(head.x, head.y, 1.4 * depthH, 0, TWO_PI);
        ctx.fillStyle = "rgba(255,255,255," + 0.95 * depthH + ")";
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  // ---- chuyển tab ----
  var tabs = document.querySelectorAll(".tab");
  var panes = {
    danfile: document.getElementById("pane-danfile"),
    toiuu: document.getElementById("pane-toiuu"),
    cutmarks: document.getElementById("pane-cutmarks"),
    danmau: document.getElementById("pane-danmau"),
    catalogue: document.getElementById("pane-catalogue"),
    offset: document.getElementById("pane-offset"),
    rename: document.getElementById("pane-rename"),
    variable: document.getElementById("pane-variable"),
    tagbd: document.getElementById("pane-tagbd"),
    autosave: document.getElementById("pane-autosave"),
  };
  // Tester hiển thị ở header: mặc định "Tân 1 cú"; tab CTL Offset -> "Duẫn".
  // ===== TESTER ELECTRIC EFFECT =====
  // 7 tia mẫu cũ + 10 tia dọc dài hơn; chỉ thứ tự kích hoạt là ngẫu nhiên.
  var testerName = document.getElementById("testerName");
  var TESTER_LIGHTNING =
    '<span class="tester-lightning" aria-hidden="true">' +
    '<svg class="tester-bolt bolt-1" viewBox="0 0 26 44"><defs><linearGradient id="tester-electric-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-1)" class="bolt-halo" points="13,1 8,11 15,16 7,27 13,32 9,41"></polyline><polyline style="stroke:url(#tester-electric-gradient-1)" class="bolt-mid" points="13,1 8,11 15,16 7,27 13,32 9,41"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="13,1 8,11 15,16 7,27 13,32 9,41"></polyline><polyline style="stroke:url(#tester-electric-gradient-1)" class="bolt-halo" points="15,16 22,10 19,21"></polyline><polyline style="stroke:url(#tester-electric-gradient-1)" class="bolt-mid" points="15,16 22,10 19,21"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="15,16 22,10 19,21"></polyline></svg>' +
    '<svg class="tester-bolt bolt-2" viewBox="0 0 38 25"><defs><linearGradient id="tester-electric-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-2)" class="bolt-halo" points="1,5 10,8 8,14 19,12 17,21 36,18"></polyline><polyline style="stroke:url(#tester-electric-gradient-2)" class="bolt-mid" points="1,5 10,8 8,14 19,12 17,21 36,18"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="1,5 10,8 8,14 19,12 17,21 36,18"></polyline><polyline style="stroke:url(#tester-electric-gradient-2)" class="bolt-halo" points="19,12 25,4 29,9"></polyline><polyline style="stroke:url(#tester-electric-gradient-2)" class="bolt-mid" points="19,12 25,4 29,9"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="19,12 25,4 29,9"></polyline></svg>' +
    '<svg class="tester-bolt bolt-3" viewBox="0 0 31 35"><defs><linearGradient id="tester-electric-gradient-3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-3)" class="bolt-halo" points="5,1 12,9 8,15 17,19 13,27 23,34"></polyline><polyline style="stroke:url(#tester-electric-gradient-3)" class="bolt-mid" points="5,1 12,9 8,15 17,19 13,27 23,34"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="5,1 12,9 8,15 17,19 13,27 23,34"></polyline><polyline style="stroke:url(#tester-electric-gradient-3)" class="bolt-halo" points="17,19 28,14 26,25"></polyline><polyline style="stroke:url(#tester-electric-gradient-3)" class="bolt-mid" points="17,19 28,14 26,25"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="17,19 28,14 26,25"></polyline></svg>' +
    '<svg class="tester-bolt bolt-4" viewBox="0 0 42 22"><defs><linearGradient id="tester-electric-gradient-4" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-4)" class="bolt-halo" points="1,15 9,10 15,14 21,5 27,10 33,4 41,8"></polyline><polyline style="stroke:url(#tester-electric-gradient-4)" class="bolt-mid" points="1,15 9,10 15,14 21,5 27,10 33,4 41,8"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="1,15 9,10 15,14 21,5 27,10 33,4 41,8"></polyline><polyline style="stroke:url(#tester-electric-gradient-4)" class="bolt-halo" points="21,5 19,1 15,3"></polyline><polyline style="stroke:url(#tester-electric-gradient-4)" class="bolt-mid" points="21,5 19,1 15,3"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="21,5 19,1 15,3"></polyline></svg>' +
    '<svg class="tester-bolt bolt-5" viewBox="0 0 34 38"><defs><linearGradient id="tester-electric-gradient-5" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-5)" class="bolt-halo" points="28,1 20,10 25,16 14,21 18,29 7,37"></polyline><polyline style="stroke:url(#tester-electric-gradient-5)" class="bolt-mid" points="28,1 20,10 25,16 14,21 18,29 7,37"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="28,1 20,10 25,16 14,21 18,29 7,37"></polyline><polyline style="stroke:url(#tester-electric-gradient-5)" class="bolt-halo" points="14,21 4,17 8,27"></polyline><polyline style="stroke:url(#tester-electric-gradient-5)" class="bolt-mid" points="14,21 4,17 8,27"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="14,21 4,17 8,27"></polyline></svg>' +
    '<svg class="tester-bolt bolt-6" viewBox="0 0 32 31"><defs><linearGradient id="tester-electric-gradient-6" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-6)" class="bolt-halo" points="2,5 11,10 8,17 18,15 16,25 30,29"></polyline><polyline style="stroke:url(#tester-electric-gradient-6)" class="bolt-mid" points="2,5 11,10 8,17 18,15 16,25 30,29"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="2,5 11,10 8,17 18,15 16,25 30,29"></polyline><polyline style="stroke:url(#tester-electric-gradient-6)" class="bolt-halo" points="11,10 17,2 22,7"></polyline><polyline style="stroke:url(#tester-electric-gradient-6)" class="bolt-mid" points="11,10 17,2 22,7"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="11,10 17,2 22,7"></polyline></svg>' +
    '<svg class="tester-bolt bolt-7" viewBox="0 0 23 43"><defs><linearGradient id="tester-electric-gradient-7" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-7)" class="bolt-halo" points="11,1 15,9 9,16 14,23 6,31 11,41"></polyline><polyline style="stroke:url(#tester-electric-gradient-7)" class="bolt-mid" points="11,1 15,9 9,16 14,23 6,31 11,41"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="11,1 15,9 9,16 14,23 6,31 11,41"></polyline><polyline style="stroke:url(#tester-electric-gradient-7)" class="bolt-halo" points="9,16 1,12 3,20"></polyline><polyline style="stroke:url(#tester-electric-gradient-7)" class="bolt-mid" points="9,16 1,12 3,20"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="9,16 1,12 3,20"></polyline></svg>' +
    '<svg class="tester-bolt bolt-8" viewBox="0 0 24 78"><defs><linearGradient id="tester-electric-gradient-8" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-8)" class="bolt-halo" points="12,1 10,12 13,24 16,36 6,49 9,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-8)" class="bolt-mid" points="12,1 10,12 13,24 16,36 6,49 9,61 12,76"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="12,1 10,12 13,24 16,36 6,49 9,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-8)" class="bolt-halo" points="6,49 10,54 15,64"></polyline><polyline style="stroke:url(#tester-electric-gradient-8)" class="bolt-mid" points="6,49 10,54 15,64"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="6,49 10,54 15,64"></polyline></svg>' +
    '<svg class="tester-bolt bolt-9" viewBox="0 0 24 78"><defs><linearGradient id="tester-electric-gradient-9" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-9)" class="bolt-halo" points="12,1 15,12 18,24 8,36 11,49 14,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-9)" class="bolt-mid" points="12,1 15,12 18,24 8,36 11,49 14,61 12,76"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="12,1 15,12 18,24 8,36 11,49 14,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-9)" class="bolt-halo" points="18,24 13,31 10,37"></polyline><polyline style="stroke:url(#tester-electric-gradient-9)" class="bolt-mid" points="18,24 13,31 10,37"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="18,24 13,31 10,37"></polyline></svg>' +
    '<svg class="tester-bolt bolt-10" viewBox="0 0 24 78"><defs><linearGradient id="tester-electric-gradient-10" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-10)" class="bolt-halo" points="12,1 7,12 10,24 13,36 16,49 6,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-10)" class="bolt-mid" points="12,1 7,12 10,24 13,36 16,49 6,61 12,76"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="12,1 7,12 10,24 13,36 16,49 6,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-10)" class="bolt-halo" points="13,36 19,45 22,53"></polyline><polyline style="stroke:url(#tester-electric-gradient-10)" class="bolt-mid" points="13,36 19,45 22,53"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="13,36 19,45 22,53"></polyline></svg>' +
    '<svg class="tester-bolt bolt-11" viewBox="0 0 24 78"><defs><linearGradient id="tester-electric-gradient-11" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-11)" class="bolt-halo" points="12,1 12,12 15,24 18,36 8,49 11,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-11)" class="bolt-mid" points="12,1 12,12 15,24 18,36 8,49 11,61 12,76"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="12,1 12,12 15,24 18,36 8,49 11,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-11)" class="bolt-halo" points="8,49 2,60 2,70"></polyline><polyline style="stroke:url(#tester-electric-gradient-11)" class="bolt-mid" points="8,49 2,60 2,70"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="8,49 2,60 2,70"></polyline></svg>' +
    '<svg class="tester-bolt bolt-12" viewBox="0 0 24 78"><defs><linearGradient id="tester-electric-gradient-12" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-12)" class="bolt-halo" points="12,1 17,12 7,24 10,36 13,49 16,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-12)" class="bolt-mid" points="12,1 17,12 7,24 10,36 13,49 16,61 12,76"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="12,1 17,12 7,24 10,36 13,49 16,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-12)" class="bolt-halo" points="7,24 11,29 14,35"></polyline><polyline style="stroke:url(#tester-electric-gradient-12)" class="bolt-mid" points="7,24 11,29 14,35"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="7,24 11,29 14,35"></polyline></svg>' +
    '<svg class="tester-bolt bolt-13" viewBox="0 0 24 78"><defs><linearGradient id="tester-electric-gradient-13" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-13)" class="bolt-halo" points="12,1 9,12 12,24 15,36 18,49 8,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-13)" class="bolt-mid" points="12,1 9,12 12,24 15,36 18,49 8,61 12,76"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="12,1 9,12 12,24 15,36 18,49 8,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-13)" class="bolt-halo" points="15,36 10,43 6,51"></polyline><polyline style="stroke:url(#tester-electric-gradient-13)" class="bolt-mid" points="15,36 10,43 6,51"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="15,36 10,43 6,51"></polyline></svg>' +
    '<svg class="tester-bolt bolt-14" viewBox="0 0 24 78"><defs><linearGradient id="tester-electric-gradient-14" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-14)" class="bolt-halo" points="12,1 14,12 17,24 7,36 10,49 13,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-14)" class="bolt-mid" points="12,1 14,12 17,24 7,36 10,49 13,61 12,76"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="12,1 14,12 17,24 7,36 10,49 13,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-14)" class="bolt-halo" points="10,49 16,58 21,68"></polyline><polyline style="stroke:url(#tester-electric-gradient-14)" class="bolt-mid" points="10,49 16,58 21,68"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="10,49 16,58 21,68"></polyline></svg>' +
    '<svg class="tester-bolt bolt-15" viewBox="0 0 24 78"><defs><linearGradient id="tester-electric-gradient-15" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-15)" class="bolt-halo" points="12,1 6,12 9,24 12,36 15,49 18,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-15)" class="bolt-mid" points="12,1 6,12 9,24 12,36 15,49 18,61 12,76"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="12,1 6,12 9,24 12,36 15,49 18,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-15)" class="bolt-halo" points="9,24 2,35 2,41"></polyline><polyline style="stroke:url(#tester-electric-gradient-15)" class="bolt-mid" points="9,24 2,35 2,41"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="9,24 2,35 2,41"></polyline></svg>' +
    '<svg class="tester-bolt bolt-16" viewBox="0 0 24 78"><defs><linearGradient id="tester-electric-gradient-16" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-16)" class="bolt-halo" points="12,1 11,12 14,24 17,36 7,49 10,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-16)" class="bolt-mid" points="12,1 11,12 14,24 17,36 7,49 10,61 12,76"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="12,1 11,12 14,24 17,36 7,49 10,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-16)" class="bolt-halo" points="17,36 21,41 22,49"></polyline><polyline style="stroke:url(#tester-electric-gradient-16)" class="bolt-mid" points="17,36 21,41 22,49"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="17,36 21,41 22,49"></polyline></svg>' +
    '<svg class="tester-bolt bolt-17" viewBox="0 0 24 78"><defs><linearGradient id="tester-electric-gradient-17" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0d7cc0"></stop><stop offset="52%" stop-color="#3e58b3"></stop><stop offset="100%" stop-color="#7a2d9d"></stop></linearGradient></defs><polyline style="stroke:url(#tester-electric-gradient-17)" class="bolt-halo" points="12,1 16,12 6,24 9,36 12,49 15,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-17)" class="bolt-mid" points="12,1 16,12 6,24 9,36 12,49 15,61 12,76"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="12,1 16,12 6,24 9,36 12,49 15,61 12,76"></polyline><polyline style="stroke:url(#tester-electric-gradient-17)" class="bolt-halo" points="12,49 7,56 2,66"></polyline><polyline style="stroke:url(#tester-electric-gradient-17)" class="bolt-mid" points="12,49 7,56 2,66"></polyline><polyline style="stroke:#ffffff" class="bolt-core" points="12,49 7,56 2,66"></polyline></svg>' +
    "</span>";
  // ===== VÕ SĨ "1 CÚ" — nhân vật riêng của tool cho tester Tân (vẽ 2D, không 3D) =====
  // Hình dựng theo khung xương: mỗi đoạn tay/chân là một nhóm <g> vẽ dọc trục +y từ khớp,
  // JS chỉ đổi transform từng khung hình. Toạ độ khung: gốc ở mặt đất dưới hông, +x là hướng
  // nhìn/hướng đấm; nhóm ngoài cùng lật gương để nhân vật quay mặt về phía chữ (bên trái).
  function vsLimb(len, w0, w1) {
    var a = (w0 / 2).toFixed(2),
      b = (w1 / 2).toFixed(2),
      L = len.toFixed(2);
    return (
      "M-" + a + ",0A" + a + "," + a + " 0 0 1 " + a + ",0L" + b + "," + L +
      "A" + b + "," + b + " 0 0 1 -" + b + "," + L + "Z"
    );
  }
  function buildVoSiSvg() {
    var OL = ' stroke="#1d1642" stroke-width="0.7" stroke-linejoin="round"';
    function arm(cls, skinG, sleeveG, wrap, fist, crease) {
      return (
        '<g class="' + cls + '-u">' +
        '<path d="' + vsLimb(11.5, 5.8, 4.6) + '" fill="url(#' + skinG + ')"' + OL + "/>" +
        '<path d="M-3.9,-1.4A3.9,3.9 0 0 1 3.9,-1.4L3.4,6.2Q0,7.5 -3.4,6.2Z" fill="url(#' + sleeveG + ')"' + OL + "/>" +
        '<path d="M-3.4,5Q0,6.3 3.4,5" stroke="#1d1642" stroke-width="0.45" fill="none" opacity="0.6"/>' +
        "</g>" +
        '<g class="' + cls + '-f">' +
        '<path d="' + vsLimb(10.5, 5.0, 4.1) + '" fill="url(#' + skinG + ')"' + OL + "/>" +
        '<rect x="-2.35" y="6.2" width="4.7" height="4.6" rx="0.9" fill="' + wrap + '"' + OL + "/>" +
        '<path d="M-2.2,7.4L2.2,9.2M-2.2,9.2L2.2,7.4" stroke="' + crease + '" stroke-width="0.4" fill="none"/>' +
        '<rect x="-3.2" y="9.6" width="6.4" height="5.8" rx="1.9" fill="' + fist + '"' + OL + "/>" +
        '<path d="M-2.4,13.6L2.4,13.6M-0.8,10.8L-0.8,12.9M0.85,10.8L0.85,12.9M2.2,10.4Q3,11.6 2.3,12.6" stroke="' + crease +
        '" stroke-width="0.45" fill="none"/>' +
        "</g>"
      );
    }
    function leg(cls, pantsG, stripe, cuff, shoe) {
      return (
        '<g class="' + cls + '-t">' +
        '<path d="' + vsLimb(15.5, 8.0, 6.0) + '" fill="url(#' + pantsG + ')"' + OL + "/>" +
        '<rect x="-0.5" y="1" width="1" height="13.6" fill="' + stripe + '"/>' +
        "</g>" +
        '<g class="' + cls + '-s">' +
        '<path d="' + vsLimb(15, 6.0, 4.6) + '" fill="url(#' + pantsG + ')"' + OL + "/>" +
        '<rect x="-0.45" y="0" width="0.9" height="12.2" fill="' + stripe + '"/>' +
        '<rect x="-2.7" y="12.2" width="5.4" height="2.6" rx="0.8" fill="' + cuff + '"' + OL + "/>" +
        "</g>" +
        '<g class="' + cls + '-f">' +
        '<path d="M3.1,-0.2C3.2,-1.9 2,-3 0.3,-3.1L-3.4,-4.7L-6.1,-4.3C-7.1,-3.6 -7.2,-1.7 -6.9,-0.2Z" fill="' +
        shoe + '"' + OL + "/>" +
        '<path d="M-7.1,-0.45L3.3,-0.45L3.2,0.6L-7.1,0.6Z" fill="#ff8a3d"' + OL + "/>" +
        '<path d="M-1,-3.1L0.5,-2.1M-2.3,-3.7L-0.8,-2.6" stroke="#9aa0b5" stroke-width="0.4" fill="none"/>' +
        "</g>"
      );
    }
    function cel(id, shade, base) {
      return (
        '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="' + shade + '"/><stop offset="0.36" stop-color="' + shade + '"/>' +
        '<stop offset="0.36" stop-color="' + base + '"/><stop offset="1" stop-color="' + base + '"/></linearGradient>'
      );
    }
    var ghost = '<use class="vs-ghost" xlink:href="#vsRig" opacity="0" style="display:none"/>';
    return (
      '<svg viewBox="-40 -70 80 76" width="100%" height="100%" focusable="false">' +
      "<defs>" +
      '<radialGradient id="vsGlowG"><stop offset="0" stop-color="#ffffff"/>' +
      '<stop offset="0.28" stop-color="#ffe08a"/><stop offset="0.6" stop-color="#ff5aa8" stop-opacity="0.7"/>' +
      '<stop offset="1" stop-color="#8a5cff" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="vsSmearG" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#8a5cff" stop-opacity="0"/><stop offset="0.6" stop-color="#d45cff" stop-opacity="0.42"/>' +
      '<stop offset="1" stop-color="#ffffff" stop-opacity="0.95"/></linearGradient>' +
      cel("vsSkinN", "#dda07d", "#f4c6a0") + cel("vsSkinF", "#b9805f", "#cf9874") +
      cel("vsSleeveN", "#4535c4", "#6150ea") + cel("vsSleeveF", "#2c2280", "#3a2e9e") +
      cel("vsPantsN", "#1f2130", "#2e3246") + cel("vsPantsF", "#17181f", "#21232f") +
      '<linearGradient id="vsHoodG" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#7464f6"/><stop offset="1" stop-color="#4433c6"/></linearGradient>' +
      "</defs>" +
      '<g transform="scale(-1,1)">' +
      '<g class="vs-ghosts">' + ghost + ghost + ghost + "</g>" +
      '<g id="vsRig" class="vs-rig" opacity="0">' +
      '<ellipse class="vs-shadow" cx="0" cy="0.4" rx="12" ry="1.7" fill="#05030d" opacity="0.32"/>' +
      // tay xa (tay trước, tay thủ) và chân xa vẽ sau lưng, tông tối hơn
      arm("vs-fa", "vsSkinF", "vsSleeveF", "#cfcabd", "#d9d4c9", "#9d97ad") +
      leg("vs-fl", "vsPantsF", "#b23a68", "#14151d", "#d6d5cf") +
      '<g class="vs-hips"><path d="M-5.6,-2L5.4,-2L5.7,2.6C5.5,4.8 3.4,5.9 0.5,5.9C-2.7,5.9 -5.5,5 -5.9,2.7Z" fill="#262838"' + OL + "/></g>" +
      leg("vs-nl", "vsPantsN", "#ff4f8b", "#1b1d2b", "#f7f6f1") +
      // thân: áo hoodie tím, khoá kéo vàng, mũ áo sau gáy
      '<g class="vs-torso">' +
      '<rect x="-2" y="-21.8" width="4" height="4.4" rx="1.4" fill="#e3ab84"' + OL + "/>" +
      '<path d="M-1.4,-18.6C-3.4,-21.8 -7.6,-21.4 -8,-17.8C-8.2,-15.6 -6.8,-13.8 -5,-14Z" fill="#33279c"' + OL + "/>" +
      '<path d="M5,2.6C5.6,-1 5.6,-4.5 6.2,-8C6.9,-11.5 6.6,-14 5.2,-16C4.2,-17.4 3.4,-18.1 2.4,-18.5L-2.4,-18.8' +
      'C-4.8,-18 -6.6,-16.6 -6.6,-13.6C-6.6,-9.5 -5.6,-5 -5.2,-1C-5.1,0.6 -5,1.8 -5,2.6Q0,3.8 5,2.6Z" fill="url(#vsHoodG)"' + OL + "/>" +
      '<path d="M-2.4,-18.6C-4.6,-17.8 -6.3,-16.4 -6.3,-13.6C-6.3,-9.5 -5.3,-5 -4.9,-1C-4.8,0.6 -4.8,1.8 -4.8,2.6' +
      'L-2.6,3C-2.9,-2 -3.6,-7 -3.6,-12C-3.6,-15 -3,-17.2 -2.4,-18.6Z" fill="#3626a8" opacity="0.9"/>' +
      '<path d="M3.2,-15.4C4.8,-14.2 5.6,-12.4 5.6,-10.4" stroke="#9d90ff" stroke-width="0.6" fill="none" opacity="0.8"/>' +
      '<path d="M-5,1.6Q0,2.8 5.1,1.6L5,2.6Q0,3.8 -5,2.6Z" fill="#2c2190"/>' +
      '<path d="M2.6,-3.6Q4,-4.3 5.4,-5.7M1.4,-6.9Q3.2,-7.7 5.9,-9.5" stroke="#2c2190" stroke-width="0.5" fill="none"/>' +
      '<path d="M0.4,-0.6Q3,-1.2 5,-3.2" stroke="#2c2190" stroke-width="0.55" fill="none"/>' +
      '<path d="M4.5,2.1C5.1,-1.6 5.2,-4.8 5.7,-8C6.3,-11.4 5.9,-13.9 4.7,-15.7C3.9,-16.9 3.1,-17.6 2.2,-18.1" stroke="#ffc94a" stroke-width="0.6" fill="none"/>' +
      '<path d="M0.5,-18.7L2.6,-18.3L1.3,-16.5Z" fill="#17131f"/>' +
      "</g>" +
      // đầu: mặt nghiêng 3/4, mắt sắc, tóc xanh than vuốt ngược
      '<g class="vs-head">' +
      '<path d="M-5.2,-1.5C-5.4,-6.5 -1.5,-7.6 1.5,-6.8C4.6,-6 5.6,-3 5.3,0.2C5.1,2.4 4.6,4.2 3.6,5.4' +
      'C2.6,6.4 0.8,6.3 -0.6,5.4C-2.8,4 -5,2.2 -5.2,-1.5Z" fill="#f2c29b"' + OL + "/>" +
      '<path d="M-1.8,-0.6C-3.2,-0.8 -3.4,1.6 -1.9,2Z" fill="#e3a57f"' + OL + "/>" +
      '<path d="M1.3,-1.1L4.4,-1.6L4.1,-0.2C3.3,0.35 2.1,0.3 1.5,-0.25Z" fill="#1b1530"/>' +
      '<circle cx="3" cy="-0.6" r="0.62" fill="#7a5cff"/>' +
      '<circle cx="3.3" cy="-0.95" r="0.32" fill="#ffffff"/>' +
      '<circle class="vs-eye-glow" cx="3" cy="-0.6" r="1.6" fill="#ff7ad9" opacity="0"/>' +
      '<path d="M5.25,0.6L5.6,1.5L5.05,1.65" stroke="#c98d6b" stroke-width="0.4" fill="none"/>' +
      '<path class="vs-mouth-c" d="M3,3.5L4.4,3.3" stroke="#7a3b2e" stroke-width="0.45" fill="none"/>' +
      '<path class="vs-mouth-o" d="M2.8,3L4.6,2.8L4.3,4.6Q3.4,5 2.9,4.2Z" fill="#4a1620" opacity="0"/>' +
      '<path d="M5.2,-3.2L3.6,-1.9L3.4,-3.3L1.9,-2L1.6,-3.9C0.2,-3.6 -1,-2.6 -1.6,-1.2L-2.6,0.9L-3.6,-0.4' +
      'L-5.6,1.9L-5.3,-0.9L-8.4,-0.6L-6,-3.2L-8.9,-4.6L-5.6,-5.8L-7.4,-8.6L-3.6,-7.4L-3.4,-10L-0.6,-7.6' +
      'L1.6,-9L2,-6.9C4.2,-6.6 5.6,-5.2 5.2,-3.2Z" fill="#1c2142" stroke="#0e1024" stroke-width="0.7" stroke-linejoin="round"/>' +
      '<path d="M-4.8,-6L-1.6,-7L0.8,-6.6L-1.2,-6.1Z" fill="#4c55c8" opacity="0.85"/>' +
      '<path d="M1,-3.1L4.7,-2.3L4.6,-1.85L1.1,-2.55Z" fill="#1c2142"/>' +
      "</g>" +
      '<polygon class="vs-smear" points="0,0 0,0 0,0" fill="url(#vsSmearG)" opacity="0"/>' +
      // tay gần (tay sau, tay đấm chính) vẽ trên cùng
      arm("vs-na", "vsSkinN", "vsSleeveN", "#f7f4ec", "#faf7f0", "#b5afc6") +
      '<circle class="vs-glow" cx="0" cy="0" r="5" fill="url(#vsGlowG)" opacity="0"/>' +
      "</g>" +
      "</g>" +
      "</svg>"
    );
  }
  var TESTER_DEFAULT =
    '<span class="tan-battle">' +
    '<canvas class="battle-fx" aria-hidden="true"></canvas>' +
    '<span class="vo-si" aria-hidden="true">' +
    buildVoSiSvg() +
    "</span>" +
    '<span class="tan-word">' +
    '<span class="shatter-unit unit-tan">' +
    '<span class="tan rainbow-text unit-base">Tân</span>' +
    '<span class="unit-shards" aria-hidden="true">' +
    '<span class="tan shard shard-1">Tân</span>' +
    '<span class="tan shard shard-2">Tân</span>' +
    '<span class="tan shard shard-3">Tân</span>' +
    '<span class="tan shard shard-4">Tân</span>' +
    '<span class="tan shard shard-5">Tân</span>' +
    '<span class="tan shard shard-6">Tân</span>' +
    '<span class="tan shard shard-7">Tân</span>' +
    '<span class="tan shard shard-8">Tân</span>' +
    '<span class="tan shard shard-9">Tân</span>' +
    '<span class="tan shard shard-10">Tân</span>' +
    "</span>" +
    "</span>" +
    '<span class="wsp"> </span>' +
    '<span class="shatter-unit unit-gu">' +
    '<span class="goku tim-vang unit-base">1 cú</span>' +
    '<span class="unit-shards" aria-hidden="true">' +
    '<span class="goku shard shard-1">1 cú</span>' +
    '<span class="goku shard shard-2">1 cú</span>' +
    '<span class="goku shard shard-3">1 cú</span>' +
    '<span class="goku shard shard-4">1 cú</span>' +
    '<span class="goku shard shard-5">1 cú</span>' +
    '<span class="goku shard shard-6">1 cú</span>' +
    '<span class="goku shard shard-7">1 cú</span>' +
    '<span class="goku shard shard-8">1 cú</span>' +
    '<span class="goku shard shard-9">1 cú</span>' +
    '<span class="goku shard shard-10">1 cú</span>' +
    "</span>" +
    "</span>" +
    "</span>" +
    "</span>" +
    TESTER_LIGHTNING;
  var TESTER_OFFSET =
    '<span class="ufo-tester" aria-label="Duẫn">' +
    '<span class="ufo-glow" aria-hidden="true"></span>' +
    '<span class="ufo" aria-hidden="true">' +
    '<span class="ufo-dome"><span class="ufo-alien"></span><span class="ufo-shine"></span></span>' +
    '<span class="ufo-body"></span>' +
    '<span class="ufo-lights"><span></span><span></span><span></span></span>' +
    "</span>" +
    '<span class="ufo-beam" aria-hidden="true">' +
    '<span class="beam-ray"></span>' +
    '<span class="beam-particles">' +
    "<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>" +
    "</span>" +
    "</span>" +
    '<span class="ufo-puddle" aria-hidden="true"></span>' +
    '<span class="ufo-ring" aria-hidden="true"></span>' +
    '<span class="tan rainbow-text duan-word">Duẫn</span>' +
    "</span>";
  var testerLightningTimer = null;
  var testerLightningGeneration = 0;
  var testerLightningLastIndex = -1;
  function stopTesterLightning() {
    testerLightningGeneration++;
    if (testerLightningTimer !== null) {
      window.clearTimeout(testerLightningTimer);
      testerLightningTimer = null;
    }
    if (!testerName) return;
    var active = testerName.querySelectorAll(".tester-bolt.bolt-active");
    for (var i = 0; i < active.length; i++)
      active[i].classList.remove("bolt-active");
  }
  function triggerRandomTesterLightning(generation) {
    if (generation !== testerLightningGeneration || !testerName) return;
    var all = testerName.querySelectorAll(".tester-bolt");
    var choices = [];
    for (var i = 0; i < all.length; i++) {
      if (
        i !== testerLightningLastIndex &&
        !all[i].classList.contains("bolt-active")
      )
        choices.push(i);
    }
    if (!choices.length) {
      for (var j = 0; j < all.length; j++) {
        if (!all[j].classList.contains("bolt-active")) choices.push(j);
      }
    }
    if (!choices.length) return;

    // Phần lớn chớp một tia; đôi lúc 2–3 tia cùng đánh để tạo một đợt sét dày hơn.
    var roll = Math.random();
    var burstSize = roll < 0.06 ? 3 : roll < 0.28 ? 2 : 1;
    burstSize = Math.min(burstSize, choices.length);

    for (var k = 0; k < burstSize; k++) {
      var choiceAt = Math.floor(Math.random() * choices.length);
      var index = choices.splice(choiceAt, 1)[0];
      var bolt = all[index];
      testerLightningLastIndex = index;
      bolt.classList.remove("bolt-active");
      void bolt.offsetWidth;
      bolt.classList.add("bolt-active");
      (function (activeBolt, expectedGeneration) {
        window.setTimeout(
          function () {
            if (expectedGeneration === testerLightningGeneration)
              activeBolt.classList.remove("bolt-active");
          },
          100 + Math.floor(Math.random() * 500),
        );
      })(bolt, generation);
    }
  }
  function scheduleRandomTesterLightning(generation) {
    if (
      generation !== testerLightningGeneration ||
      !testerName ||
      !testerName.querySelector(".tester-lightning")
    )
      return;
    triggerRandomTesterLightning(generation);
    testerLightningTimer = window.setTimeout(
      function () {
        scheduleRandomTesterLightning(generation);
      },
      1000 + Math.floor(Math.random() * 500),
    );
  }
  function startTesterLightning() {
    testerLightningLastIndex = -1;
    scheduleRandomTesterLightning(testerLightningGeneration);
  }
  // ===== VÕ SĨ "1 CÚ" đấm chữ "Tân 1 cú" — engine =====
  // Nhân vật cập nhật mỗi khung hình (mượt theo màn hình); hiệu ứng canvas (tụ lực, bụi, nổ, kính vỡ,
  // mảnh chữ) vẽ 30 hình/giây để nhẹ máy. Một chu kỳ 10 giây: lướt vào -> thủ thế -> gồng tụ lực
  // -> lấy đà -> đấm thẳng (hông dẫn, vai xoay, tay duỗi) -> khựng hình khi trúng -> thu tay -> lùi ra.
  var tanRAF = null,
    tanGen = 0;
  function stopTanBattle() {
    tanGen++;
    if (tanRAF !== null) {
      window.cancelAnimationFrame(tanRAF);
      tanRAF = null;
    }
  }
  function startTanBattle() {
    if (!testerName) return;
    var root = testerName.querySelector(".tan-battle");
    if (!root) return;
    var cv = root.querySelector(".battle-fx");
    var fighter = root.querySelector(".vo-si");
    var word = root.querySelector(".tan-word");
    var units = root.querySelectorAll(".shatter-unit");
    if (!cv || !cv.getContext || !fighter || !word || !units.length) return;
    var ctx = cv.getContext("2d");
    // Khung kính vỡ nhỏ trong panel: 1.25x vẫn nét, nhưng giảm mạnh số pixel phải blend.
    var DPR = Math.min(window.devicePixelRatio || 1, 1.25);

    var U = [];
    for (var ui = 0; ui < units.length; ui++) {
      var el = units[ui];
      U.push({
        base: el.querySelector(".unit-base"),
        shards: el.querySelectorAll(".unit-shards .shard"),
      });
    }

    var gen = tanGen,
      CYCLE = 10000,
      start = 0;
    var lastFxDraw = 0,
      FX_FRAME_MS = 1000 / 30,
      fxIdle = false;
    var W = 0,
      H = 0,
      target = { x: 0, y: 0 };
    function measure() {
      var nextW = cv.clientWidth || 300,
        nextH = cv.clientHeight || 160;
      var pixelW = Math.round(nextW * DPR),
        pixelH = Math.round(nextH * DPR);
      // Không cấp phát lại Canvas mỗi frame: resize là thao tác nặng nhất của glass crack.
      if (
        nextW === W &&
        nextH === H &&
        cv.width === pixelW &&
        cv.height === pixelH
      )
        return;
      W = nextW;
      H = nextH;
      cv.width = pixelW;
      cv.height = pixelH;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var cx = cv.offsetLeft,
        cy = cv.offsetTop;
      target.x = word.offsetLeft - cx + word.offsetWidth * 0.5;
      target.y = word.offsetTop - cy + word.offsetHeight * 0.5;
    }
    measure();

    var sparks = [],
      flames = [],
      smoke = [],
      flash = 0,
      shake = 0;
    function addFlame(x, y, big) {
      if (flames.length >= (big ? 20 : 14)) return;
      flames.push({
        x: x + (Math.random() - 0.5) * (big ? 26 : 16),
        y: y + (Math.random() - 0.5) * 8,
        r: (big ? 7 : 5) + Math.random() * (big ? 11 : 7),
        vy: 0.7 + Math.random() * 1.3,
        life: 1,
        decay: 0.03 + Math.random() * 0.04,
        hue: 4 + Math.random() * 36,
      });
    }
    function addExplosion(x, y) {
      flash = 1;
      shake = 1;
      for (var i = 0; i < 36; i++) {
        var a = Math.random() * Math.PI * 2,
          sp = 2 + Math.random() * 7;
        sparks.push({
          x: x,
          y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1.4,
          life: 1,
          decay: 0.015 + Math.random() * 0.03,
          hue: 15 + Math.random() * 40,
          r: 1 + Math.random() * 2.6,
        });
      }
      for (var s = 0; s < 10; s++)
        smoke.push({
          x: x,
          y: y,
          vx: (Math.random() - 0.5) * 2,
          vy: -Math.random() * 1.6 - 0.3,
          r: 4 + Math.random() * 7,
          life: 1,
          decay: 0.01 + Math.random() * 0.016,
        });
      for (var f = 0; f < 6; f++) addFlame(x, y, true);
    }

    // kế hoạch mảnh: hướng bay NGẪU NHIÊN mỗi chu kỳ (có trọng lực nhẹ)
    var plan = [];
    function planShards() {
      plan = [];
      for (var u = 0; u < U.length; u++) {
        var arr = [];
        for (var i = 0; i < U[u].shards.length; i++) {
          var ang = Math.random() * Math.PI * 2;
          var dist = 34 + Math.random() * 56;
          arr.push({
            ex: Math.cos(ang) * dist,
            ey: Math.sin(ang) * dist * 0.75 - 10,
            grav: 14 + Math.random() * 26, // rơi thêm khi lơ lửng
            rot: (Math.random() * 2 - 1) * 260,
            outDelay: Math.random() * 0.16,
            backDelay: Math.random() * 0.42,
          });
        }
        plan.push(arr);
      }
    }

    // Mạng kính vỡ xanh: các tia là polyline ziczac, có nhánh và sóng dư chấn.
    // Tất cả được lập một lần cho mỗi cú đấm để đường nứt không bị nhấp nháy theo frame.
    var crackPaths = [],
      crackChips = [],
      shockWaves = [];
    function makeZigZagPath(x, y, angle, distance, steps, jitter, kind) {
      var points = [{ x: x, y: y }],
        px = x,
        py = y,
        dir = angle;
      for (var s = 0; s < steps; s++) {
        var step = (distance / steps) * (0.66 + Math.random() * 0.68);
        dir += (Math.random() - 0.5) * jitter;
        px += Math.cos(dir) * step;
        py += Math.sin(dir) * step;
        points.push({ x: px, y: py });
      }
      return {
        points: points,
        delay: Math.random() * (kind === 0 ? 0.18 : 0.54),
        kind: kind || 0,
      };
    }
    function makeZigZagConnector(a, b) {
      var dx = b.x - a.x,
        dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len,
        ny = dx / len;
      var steps = 2 + Math.floor(Math.random() * 3),
        points = [{ x: a.x, y: a.y }];
      for (var i = 1; i <= steps; i++) {
        var p = i / (steps + 1);
        var off = (i % 2 ? 1 : -1) * (3 + Math.random() * 8);
        points.push({ x: a.x + dx * p + nx * off, y: a.y + dy * p + ny * off });
      }
      points.push({ x: b.x, y: b.y });
      return { points: points, delay: 0.16 + Math.random() * 0.48, kind: 2 };
    }
    function makeGlassCracks(x, y) {
      crackPaths = [];
      crackChips = [];
      shockWaves = [];
      var radius = Math.min(112, Math.max(90, Math.min(W, H) * 0.52));
      var main = [],
        count = 12 + Math.floor(Math.random() * 3),
        i,
        p,
        b;

      // Tia chính và nhánh nhỏ: đổi hướng rõ ở từng đoạn để thành nứt ziczac.
      for (i = 0; i < count; i++) {
        var angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
        var path = makeZigZagPath(
          x,
          y,
          angle,
          radius * (0.68 + Math.random() * 0.22),
          4 + Math.floor(Math.random() * 3),
          0.88,
          0,
        );
        crackPaths.push(path);
        main.push(path);
        for (p = 1; p < path.points.length - 1; p++) {
          if (Math.random() < 0.82) {
            var from = path.points[p],
              before = path.points[p - 1],
              after = path.points[p + 1];
            var dir = Math.atan2(after.y - before.y, after.x - before.x);
            var branchAngle =
              dir +
              (Math.random() < 0.5 ? -1 : 1) * (0.58 + Math.random() * 0.86);
            crackPaths.push(
              makeZigZagPath(
                from.x,
                from.y,
                branchAngle,
                radius * (0.16 + Math.random() * 0.2),
                2 + Math.floor(Math.random() * 3),
                1.18,
                1,
              ),
            );
          }
        }
      }

      // Các đường nối gãy giữa tia chính làm mạng kính vỡ dày hơn.
      for (i = 0; i < main.length; i += 2) {
        var left = main[i],
          right = main[(i + 1) % main.length];
        var li = Math.min(
          left.points.length - 1,
          1 + Math.floor(Math.random() * (left.points.length - 2)),
        );
        var ri = Math.min(
          right.points.length - 1,
          1 + Math.floor(Math.random() * (right.points.length - 2)),
        );
        crackPaths.push(makeZigZagConnector(left.points[li], right.points[ri]));
      }

      // Dư chấn: vòng không tròn, gồm nhiều đỉnh gãy ziczac chạy loang từ tâm.
      for (i = 0; i < 3; i++) {
        var vertices = 14 + Math.floor(Math.random() * 5),
          wavePoints = [];
        var waveRadius = 28 + i * 22 + Math.random() * 8,
          phase = Math.random() * Math.PI * 2;
        for (p = 0; p < vertices; p++) {
          var wa = phase + (p / vertices) * Math.PI * 2;
          var wr = waveRadius * (0.76 + Math.random() * 0.46);
          wavePoints.push({
            x: x + Math.cos(wa) * wr,
            y: y + Math.sin(wa) * wr,
          });
        }
        shockWaves.push({
          points: wavePoints,
          delay: 0.04 + i * 0.11 + Math.random() * 0.05,
        });
      }

      // Mảnh phản chiếu rất nhỏ của bề mặt kính quanh tâm nứt.
      for (i = 0; i < 18; i++) {
        var chipAngle = Math.random() * Math.PI * 2,
          chipDist = 18 + Math.random() * radius * 0.94;
        crackChips.push({
          x: x + Math.cos(chipAngle) * chipDist,
          y: y + Math.sin(chipAngle) * chipDist,
          size: 1.4 + Math.random() * 4.4,
          angle: Math.random() * Math.PI * 2,
          delay: 0.12 + Math.random() * 0.62,
        });
      }
    }


    // ---- Khung xương võ sĩ: tham chiếu các nhóm SVG ----
    function part(selector) {
      return fighter.querySelector(selector);
    }
    var RIG = part(".vs-rig");
    var P = {
      nau: part(".vs-na-u"),
      naf: part(".vs-na-f"),
      fau: part(".vs-fa-u"),
      faf: part(".vs-fa-f"),
      nlt: part(".vs-nl-t"),
      nls: part(".vs-nl-s"),
      nlf: part(".vs-nl-f"),
      flt: part(".vs-fl-t"),
      fls: part(".vs-fl-s"),
      flf: part(".vs-fl-f"),
      torso: part(".vs-torso"),
      hips: part(".vs-hips"),
      eyeGlow: part(".vs-eye-glow"),
      head: part(".vs-head"),
      shadow: part(".vs-shadow"),
      glow: part(".vs-glow"),
      smear: part(".vs-smear"),
      mouthC: part(".vs-mouth-c"),
      mouthO: part(".vs-mouth-o"),
      ghosts: fighter.querySelectorAll(".vs-ghost"),
    };
    if (!RIG || !P.nau || !P.naf || !P.torso || !P.head || !P.nlf || !P.flf) return;

    var DEG = Math.PI / 180;
    var L_UA = 11.5, // cánh tay trên
      L_FA = 10.5, // cẳng tay
      L_TH = 15.5, // đùi
      L_SH = 15; // cẳng chân
    var OFF_X = -112; // vị trí ngoài khung (phía sau lưng nhân vật)

    // Các tư thế khoá (đơn vị khung xương; y âm là lên trên). Toạ độ nắm đấm tính theo hông,
    // toạ độ mũi bàn chân tính tuyệt đối để chân đứng yên trên mặt đất khi hông dồn lực.
    // Thế thủ: tay sau che cằm, tay trước đưa ra đo khoảng cách, gót chân sau kiễng nhẹ.
    var STANCE = { x: 0, y: -28.8, lean: 5, twist: 0.15, head: 3, nfx: 5.4, nfy: -19.4,
      ffx: 12.6, ffy: -21.6, nbx: -9, nh: 10, nby: 0, fbx: 11, fh: 0, fby: 0, mouth: 0, glow: 0 };
    // Lướt: hạ thấp, đổ người tới trước; bàn chân trượt theo người.
    var DASH = { x: 0, y: -26.6, lean: 13, twist: 0.1, head: -6, nfx: 7, nfy: -19.2,
      ffx: 12.6, ffy: -19.8, nbx: -12.5, nh: 22, nby: 0, fbx: 9.5, fh: 0, fby: -1.2, mouth: 0, glow: 0 };
    // Gồng: dồn trọng tâm về chân sau, vai đấm kéo ra sau, nắm đấm thu sát vai.
    var COIL = { x: -2.4, y: -27.2, lean: -3, twist: -0.35, head: 3, nfx: -0.6, nfy: -18.6,
      ffx: 14.2, ffy: -20.4, nbx: -9.4, nh: 0, nby: 0, fbx: 11.2, fh: 0, fby: 0, mouth: 0, glow: 0.75 };
    // Lấy đà: xoắn thêm một nhịp ngắn trước khi bung.
    var LOAD = { x: -3.3, y: -26.5, lean: -6, twist: -0.55, head: 4, nfx: -2.2, nfy: -18,
      ffx: 15, ffy: -20, nbx: -9.4, nh: 0, nby: 0, fbx: 11.2, fh: 0, fby: 0, mouth: 0, glow: 1 };
    // Trúng đích: hông dồn tới, vai xoay, tay đấm duỗi thẳng, tay kia thu về che cằm, gót sau xoay lên.
    var HIT = { x: 6.5, y: -27.4, lean: 18, twist: 1, head: 6, nfx: 33, nfy: -15.2,
      ffx: 3.2, ffy: -23.4, nbx: -8, nh: 40, nby: 0, fbx: 13.4, fh: 0, fby: 0, mouth: 1, glow: 1 };
    // Dư lực: giữ tay một nhịp, giật nhẹ về.
    var FOLLOW = { x: 5.4, y: -27.9, lean: 14, twist: 0.82, head: 5, nfx: 28.4, nfy: -15.8,
      ffx: 3.8, ffy: -23, nbx: -8, nh: 30, nby: 0, fbx: 13.4, fh: 0, fby: 0, mouth: 0, glow: 0 };
    var KEYS = ["x", "y", "lean", "twist", "head", "nfx", "nfy", "ffx", "ffy", "nbx", "nh", "nby",
      "fbx", "fh", "fby", "mouth", "glow"];
    function mixPose(a, b, k) {
      var o = {}, i, key;
      for (i = 0; i < KEYS.length; i++) {
        key = KEYS[i];
        o[key] = a[key] + (b[key] - a[key]) * k;
      }
      return o;
    }
    function copyPose(a) {
      return mixPose(a, a, 0);
    }
    function clamp(v, a, b) {
      return v < a ? a : v > b ? b : v;
    }
    function easeOut(p) {
      return 1 - Math.pow(1 - p, 3);
    }
    function eOutQuint(u) {
      return 1 - Math.pow(1 - u, 5);
    }
    function eInOutCubic(u) {
      return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    }
    function eInOutSine(u) {
      return -(Math.cos(Math.PI * u) - 1) / 2;
    }
    function eOutBack(u) {
      var c1 = 1.5;
      return 1 + (c1 + 1) * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
    }
    function phase(t, a, b) {
      return clamp((t - a) / (b - a), 0, 1);
    }

    // mốc (ms) — giữ mốc nổ T_PUNCH và nhịp mảnh chữ như trước
    var T_DASH0 = 1300,
      T_DASH1 = 1700; // lướt vào
    var T_SET1 = 2250; // trượt dừng, vào thế thủ
    var T_COIL0 = 2400,
      T_COIL1 = 3300; // gồng tụ lực
    var T_LOAD1 = 3470; // lấy đà
    var T_PUNCH = 3600; // nắm đấm chạm chữ -> nổ
    var T_FREEZE = 3680; // khựng hình khi trúng
    var T_FOLLOW1 = 4250,
      T_GUARD1 = 4620; // thu tay về thế thủ
    var T_OUT0 = 4900,
      T_OUT1 = 5320; // lùi nhanh ra
    var T_SCATTER = 3600,
      T_SCATTER_END = 4400; // mảnh bay ra
    var T_BACK0 = 5400,
      T_BACK1 = 7000; // mảnh bay về

    function bounce(t, amp) {
      return -Math.abs(Math.sin(t * 0.0075)) * amp; // nhún ~2,4 nhịp/giây
    }
    function tremble(p, a) {
      p.x += (Math.random() - 0.5) * a;
      p.y += (Math.random() - 0.5) * a;
      p.nfx += (Math.random() - 0.5) * a * 1.4;
      p.nfy += (Math.random() - 0.5) * a * 1.4;
      p.ffx += (Math.random() - 0.5) * a;
      p.ffy += (Math.random() - 0.5) * a;
    }
    function dashX(t) {
      return OFF_X + (2.8 - OFF_X) * eOutQuint(phase(t, T_DASH0, T_DASH1));
    }
    function outX(t) {
      return OFF_X * eInOutCubic(phase(t, T_OUT0, T_OUT1));
    }
    function poseAt(t) {
      var p, u, uh, ut, ua, k;
      if (t < T_DASH0 || t >= T_OUT1) return null;
      if (t < T_DASH1) {
        u = phase(t, T_DASH0, T_DASH1);
        p = copyPose(DASH);
        p.x = dashX(t);
        p.nbx = p.x + DASH.nbx;
        p.fbx = p.x + DASH.fbx;
        p.fby = DASH.fby * (1 - u);
        return p;
      }
      if (t < T_SET1) {
        u = phase(t, T_DASH1, T_SET1);
        var from = copyPose(DASH);
        from.x = 2.8;
        from.nbx = 2.8 + DASH.nbx;
        from.fbx = 2.8 + DASH.fbx;
        from.fby = 0;
        p = mixPose(from, STANCE, eOutBack(u));
        p.y += bounce(t, 0.9 * u);
        return p;
      }
      if (t < T_COIL0) {
        p = copyPose(STANCE);
        p.y += bounce(t, 0.9);
        return p;
      }
      if (t < T_COIL1) {
        u = phase(t, T_COIL0, T_COIL1);
        p = mixPose(STANCE, COIL, eInOutSine(u));
        p.y += bounce(t, 0.9 * (1 - u));
        tremble(p, 0.1 + 0.4 * u);
        return p;
      }
      if (t < T_LOAD1) {
        p = mixPose(COIL, LOAD, eInOutCubic(phase(t, T_COIL1, T_LOAD1)));
        tremble(p, 0.5);
        return p;
      }
      if (t < T_PUNCH) {
        // Chuỗi lực: hông bung trước, vai xoay theo, nắm đấm tới sau cùng và nhanh dần tới lúc chạm.
        u = phase(t, T_LOAD1, T_PUNCH);
        uh = easeOut(clamp(u * 1.45, 0, 1));
        ut = eInOutCubic(clamp(u * 1.25 - 0.05, 0, 1));
        ua = clamp((u - 0.12) / 0.88, 0, 1);
        ua = ua * ua;
        p = mixPose(LOAD, HIT, ut);
        p.x = LOAD.x + (HIT.x - LOAD.x) * uh;
        p.y = LOAD.y + (HIT.y - LOAD.y) * uh;
        p.nbx = LOAD.nbx + (HIT.nbx - LOAD.nbx) * uh;
        p.nh = LOAD.nh + (HIT.nh - LOAD.nh) * uh;
        p.nfx = LOAD.nfx + (HIT.nfx - LOAD.nfx) * ua;
        p.nfy = LOAD.nfy + (HIT.nfy - LOAD.nfy) * ua;
        p.fby = -1.3 * Math.sin(Math.PI * ut);
        p.mouth = u > 0.55 ? 1 : 0;
        return p;
      }
      if (t < T_FREEZE) {
        p = copyPose(HIT); // khựng hình lúc trúng
        tremble(p, 0.3);
        return p;
      }
      if (t < T_FOLLOW1) {
        u = phase(t, T_FREEZE, T_FOLLOW1);
        p = mixPose(HIT, FOLLOW, easeOut(u));
        p.mouth = u < 0.4 ? 1 : 0;
        return p;
      }
      if (t < T_GUARD1) {
        u = phase(t, T_FOLLOW1, T_GUARD1);
        p = mixPose(FOLLOW, STANCE, eOutBack(u));
        p.fby = -1 * Math.sin(Math.PI * clamp(u * 1.3, 0, 1));
        return p;
      }
      if (t < T_OUT0) {
        p = copyPose(STANCE);
        p.y += bounce(t, 0.9);
        return p;
      }
      // Lùi nhanh: bật khỏi mặt đất, ngả người ra sau, giữ thế thủ.
      u = phase(t, T_OUT0, T_OUT1);
      k = Math.sin(Math.PI * u);
      p = copyPose(STANCE);
      p.x = outX(t);
      p.y += -2.2 * k;
      p.lean = STANCE.lean - 10 * k;
      p.nbx = p.x + STANCE.nbx;
      p.fbx = p.x + STANCE.fbx;
      p.nby = -1.6 * k;
      p.fby = -2.4 * k;
      return p;
    }
    function fadeAt(t) {
      if (t < T_DASH0 || t >= T_OUT1) return 0;
      if (t < T_DASH0 + 90) return (t - T_DASH0) / 90;
      if (t > T_OUT1 - 160) return (T_OUT1 - t) / 160;
      return 1;
    }

    // IK hai đoạn: khớp gốc (ax, ay) -> điểm cuối (bx, by). "low": khuỷu tay chúc xuống,
    // "front": đầu gối hướng về phía trước. Ngoài tầm với thì duỗi thẳng về phía điểm cuối.
    function ik(ax, ay, bx, by, l1, l2, mode) {
      var dx = bx - ax,
        dy = by - ay,
        d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      var dMax = l1 + l2 - 0.02,
        dMin = Math.abs(l1 - l2) + 0.02;
      var dc = clamp(d, dMin, dMax);
      dx = (dx / d) * dc;
      dy = (dy / d) * dc;
      var base = Math.atan2(dy, dx);
      var A = Math.acos(clamp((l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc), -1, 1));
      var e1x = ax + l1 * Math.cos(base + A),
        e1y = ay + l1 * Math.sin(base + A);
      var e2x = ax + l1 * Math.cos(base - A),
        e2y = ay + l1 * Math.sin(base - A);
      var pickFirst = mode === "low" ? e1y >= e2y : e1x >= e2x;
      return {
        ex: pickFirst ? e1x : e2x,
        ey: pickFirst ? e1y : e2y,
        tx: ax + dx,
        ty: ay + dy,
      };
    }
    function f2(v) {
      return v.toFixed(2);
    }
    function setT(el, value) {
      if (el) el.setAttribute("transform", value);
    }
    // Đoạn chi vẽ dọc +y từ khớp: xoay để trục +y trùng hướng khớp -> khớp kế tiếp.
    function placeSeg(el, ax, ay, bx, by) {
      var th = Math.atan2(-(bx - ax), by - ay) / DEG;
      setT(el, "translate(" + f2(ax) + "," + f2(ay) + ") rotate(" + f2(th) + ")");
    }
    function ankleOf(bx, by, heelDeg) {
      var r = heelDeg * DEG,
        c = Math.cos(r),
        s = Math.sin(r);
      return [bx - 3.8 * c + 3.2 * s, by - 3.8 * s - 3.2 * c];
    }
    var rig = { fist: [0, 0], feet: [[0, 0], [0, 0]], x: 0, visible: false };
    var LOAD_WRIST = null;
    function applyPose(p, t) {
      var lr = p.lean * DEG,
        c = Math.cos(lr),
        s = Math.sin(lr);
      function tp(lx, ly) {
        return [p.x + lx * c - ly * s, p.y + lx * s + ly * c];
      }
      var shN = tp(1 + p.twist * 3.2, -16.6),
        shF = tp(-1.2 - p.twist * 2, -16.9),
        hc = tp(0.5, -25.6);
      var aN = ik(shN[0], shN[1], p.x + p.nfx, p.y + p.nfy, L_UA, L_FA, "low");
      var aF = ik(shF[0], shF[1], p.x + p.ffx, p.y + p.ffy, L_UA, L_FA, "low");
      var ankN = ankleOf(p.nbx, p.nby, p.nh),
        ankF = ankleOf(p.fbx, p.fby, p.fh);
      var hipN = [p.x + 1, p.y + 0.6],
        hipF = [p.x - 1, p.y + 0.6];
      var lN = ik(hipN[0], hipN[1], ankN[0], ankN[1], L_TH, L_SH, "front");
      var lF = ik(hipF[0], hipF[1], ankF[0], ankF[1], L_TH, L_SH, "front");

      placeSeg(P.fau, shF[0], shF[1], aF.ex, aF.ey);
      placeSeg(P.faf, aF.ex, aF.ey, aF.tx, aF.ty);
      placeSeg(P.flt, hipF[0], hipF[1], lF.ex, lF.ey);
      placeSeg(P.fls, lF.ex, lF.ey, lF.tx, lF.ty);
      setT(P.flf, "translate(" + f2(p.fbx) + "," + f2(p.fby) + ") rotate(" + f2(p.fh) + ")");
      placeSeg(P.nlt, hipN[0], hipN[1], lN.ex, lN.ey);
      placeSeg(P.nls, lN.ex, lN.ey, lN.tx, lN.ty);
      setT(P.nlf, "translate(" + f2(p.nbx) + "," + f2(p.nby) + ") rotate(" + f2(p.nh) + ")");
      setT(P.hips, "translate(" + f2(p.x) + "," + f2(p.y) + ") rotate(" + f2(p.lean * 0.35) + ")");
      setT(P.torso, "translate(" + f2(p.x) + "," + f2(p.y) + ") rotate(" + f2(p.lean) + ")");
      setT(P.head, "translate(" + f2(hc[0]) + "," + f2(hc[1]) + ") rotate(" + f2(p.lean * 0.5 + p.head) + ") scale(0.92)");
      if (P.eyeGlow) P.eyeGlow.setAttribute("opacity", f2(p.glow * 0.85));
      placeSeg(P.nau, shN[0], shN[1], aN.ex, aN.ey);
      placeSeg(P.naf, aN.ex, aN.ey, aN.tx, aN.ty);

      // tâm nắm đấm nằm trước cổ tay 2,4 đơn vị theo hướng cẳng tay
      var fdx = aN.tx - aN.ex,
        fdy = aN.ty - aN.ey,
        fl = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
      var fistX = aN.tx + (fdx / fl) * 2.4,
        fistY = aN.ty + (fdy / fl) * 2.4;
      if (t >= T_COIL1 && t < T_LOAD1 + 20) LOAD_WRIST = [aN.tx, aN.ty];

      // quầng tụ lực ở nắm đấm
      var glow = p.glow * (0.82 + Math.random() * 0.18);
      if (P.glow) {
        P.glow.setAttribute("opacity", glow > 0.01 ? f2(glow) : "0");
        setT(P.glow, "translate(" + f2(fistX) + "," + f2(fistY) + ") scale(" + f2(0.55 + p.glow * 0.85) + ")");
      }
      // vệt gió của cú đấm: từ chỗ thu tay tới nắm đấm, đậm nhất lúc tay lao nhanh
      if (P.smear) {
        var sm = 0;
        if (t >= T_LOAD1 + 30 && t < T_PUNCH + 70 && LOAD_WRIST) {
          sm = t < T_PUNCH ? phase(t, T_LOAD1 + 30, T_PUNCH) : 1 - phase(t, T_PUNCH, T_PUNCH + 70);
        }
        if (sm > 0.02) {
          var nx = -fdy / fl,
            ny = fdx / fl;
          P.smear.setAttribute(
            "points",
            f2(LOAD_WRIST[0]) + "," + f2(LOAD_WRIST[1]) + " " +
              f2(fistX + nx * 2.8) + "," + f2(fistY + ny * 2.8) + " " +
              f2(fistX - nx * 2.8) + "," + f2(fistY - ny * 2.8),
          );
          P.smear.setAttribute("opacity", f2(sm * 0.9));
        } else P.smear.setAttribute("opacity", "0");
      }
      if (P.mouthC && P.mouthO) {
        P.mouthO.setAttribute("opacity", p.mouth > 0.5 ? "1" : "0");
        P.mouthC.setAttribute("opacity", p.mouth > 0.5 ? "0" : "1");
      }
      if (P.shadow) {
        P.shadow.setAttribute("cx", f2(p.x + 1));
        P.shadow.setAttribute("rx", f2(10 + Math.abs(p.fbx - p.nbx) * 0.18));
        P.shadow.setAttribute("opacity", f2(0.32 * clamp(1 + (p.nby + p.fby) * 0.12, 0.4, 1)));
      }

      // bóng mờ khi lướt (tàn ảnh) nằm phía sau hướng di chuyển
      var ghostOn = (t >= T_DASH0 && t < T_DASH1 + 60) || (t >= T_OUT0 && t < T_OUT1);
      for (var gi = 0; gi < P.ghosts.length; gi++) {
        var g = P.ghosts[gi];
        if (!ghostOn) {
          if (g.style.display !== "none") g.style.display = "none";
          continue;
        }
        var lag = (gi + 1) * 34;
        var px = t < T_OUT0 ? dashX(Math.max(T_DASH0, t - lag)) : outX(Math.max(T_OUT0, t - lag));
        var gap = px - p.x;
        var alpha = clamp(Math.abs(gap) / 14, 0, 1) * [0.34, 0.2, 0.1][gi];
        g.style.display = alpha > 0.01 ? "" : "none";
        g.setAttribute("opacity", f2(alpha));
        setT(g, "translate(" + f2(gap) + ",0)");
      }
      RIG.setAttribute("opacity", f2(fadeAt(t)));

      rig.fist = [fistX, fistY];
      rig.feet = [[p.nbx - 2, p.nby], [p.fbx - 2, p.fby]];
      rig.x = p.x;
      rig.visible = true;
    }
    function hideFighter() {
      RIG.setAttribute("opacity", "0");
      for (var gi = 0; gi < P.ghosts.length; gi++) P.ghosts[gi].style.display = "none";
      if (P.glow) P.glow.setAttribute("opacity", "0");
      if (P.smear) P.smear.setAttribute("opacity", "0");
      rig.visible = false;
    }
    // Toạ độ khung xương -> toạ độ canvas (nhóm SVG đã lật gương: +x khung là sang trái màn hình).
    function rigToCanvas(x, y) {
      var S = (fighter.clientWidth || 60) / 80;
      return {
        x: fighter.offsetLeft + (40 - x) * S - cv.offsetLeft,
        y: fighter.offsetTop + (y + 70) * S - cv.offsetTop,
      };
    }

    // ---- hiệu ứng riêng của võ sĩ (canvas) ----
    var motes = [],
      streaks = [],
      dust = [],
      impact = 0,
      impactAt = { x: 0, y: 0 },
      events = {};
    function addMote() {
      if (motes.length >= 26 || !rig.visible) return;
      var f = rigToCanvas(rig.fist[0], rig.fist[1]);
      var a = Math.random() * Math.PI * 2,
        r = 14 + Math.random() * 16;
      motes.push({
        x: f.x + Math.cos(a) * r,
        y: f.y + Math.sin(a) * r,
        life: 1,
        hue: Math.random() < 0.65 ? 270 + Math.random() * 50 : 36 + Math.random() * 14,
        size: 0.9 + Math.random() * 1.3,
      });
    }
    function addStreaks(dir) {
      if (!rig.visible || streaks.length > 18) return;
      var body = rigToCanvas(rig.x, -30);
      for (var i = 0; i < 2; i++)
        streaks.push({
          x: body.x + dir * (10 + Math.random() * 22),
          y: body.y + (Math.random() - 0.5) * 34,
          len: 10 + Math.random() * 18,
          dir: dir,
          life: 1,
        });
    }
    function addDust(rx, ry, n, push) {
      var c = rigToCanvas(rx, ry);
      for (var i = 0; i < n; i++)
        dust.push({
          x: c.x + (Math.random() - 0.5) * 6,
          y: c.y - Math.random() * 2,
          vx: (Math.random() - 0.5) * 0.9 + push,
          vy: -0.25 - Math.random() * 0.45,
          r: 1.6 + Math.random() * 2.2,
          life: 1,
        });
    }

    var punched = false;
    function reset() {
      punched = false;
      sparks.length = flames.length = smoke.length = 0;
      motes.length = streaks.length = dust.length = 0;
      events = {};
      impact = 0;
      LOAD_WRIST = null;
      flash = 0;
      shake = 0;
      crackPaths = [];
      crackChips = [];
      shockWaves = [];
      word.style.transform = "none";
      hideFighter();
      for (var u = 0; u < U.length; u++) {
        U[u].base.style.opacity = "1";
        U[u].base.style.filter = "none";
        for (var i = 0; i < U[u].shards.length; i++) {
          U[u].shards[i].style.opacity = "0";
          U[u].shards[i].style.transform = "none";
        }
      }
      planShards();
      measure();
    }
    reset();

    function traceGlassPath(points, amount, closePath) {
      var last = points.length - 1,
        whole,
        frac,
        i,
        from,
        to;
      if (last < 1 || amount <= 0) return false;
      amount = clamp(amount, 0, 1);
      var length = amount * last;
      whole = Math.floor(length);
      frac = length - whole;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (i = 1; i <= whole && i <= last; i++)
        ctx.lineTo(points[i].x, points[i].y);
      if (whole < last && frac > 0) {
        from = points[whole];
        to = points[whole + 1];
        ctx.lineTo(
          from.x + (to.x - from.x) * frac,
          from.y + (to.y - from.y) * frac,
        );
      }
      if (closePath && amount >= 0.999) ctx.closePath();
      return true;
    }
    function strokeGlassPath(path, amount, opacity, isWave, glowActive) {
      if (amount <= 0.004 || opacity <= 0) return;
      var strength = isWave
        ? 0.68
        : path.kind === 0
          ? 1
          : path.kind === 1
            ? 0.78
            : 0.6;
      var showGlow = glowActive !== false && (isWave || path.kind === 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "miter";
      ctx.miterLimit = 3.5;
      if (!traceGlassPath(path.points, amount, isWave)) return;

      // Chỉ tia chính và vòng dư chấn cần quầng blur dày; nhánh nhỏ dùng nét mảnh.
      // Điều này giảm đáng kể số lần blur Canvas mỗi frame nhưng vẫn giữ dáng kính vỡ.
      if (showGlow) {
        ctx.strokeStyle = "rgba(10,108,255," + opacity * 0.38 * strength + ")";
        ctx.lineWidth = (isWave ? 3.8 : 5.2) * strength;
        ctx.shadowBlur = isWave ? 9 : 11;
        ctx.shadowColor = "rgba(18,146,255," + opacity * 0.82 + ")";
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(82,216,255," + opacity * 0.92 * strength + ")";
      ctx.lineWidth = (isWave ? 1.45 : 2.05) * strength;
      ctx.shadowBlur = showGlow ? 7 : 0;
      ctx.shadowColor = "rgba(116,229,255," + opacity * 0.9 + ")";
      ctx.stroke();

      // Lõi trắng chỉ vẽ cho tia chính, tránh nhân ba số lần stroke của các nhánh.
      if (!isWave && path.kind === 0 && glowActive !== false) {
        ctx.strokeStyle = "rgba(240,253,255," + opacity * 0.82 + ")";
        ctx.lineWidth = 0.72;
        ctx.shadowBlur = 2;
        ctx.shadowColor = "rgba(235,252,255," + opacity * 0.85 + ")";
        ctx.stroke();
      }
    }


    function loop(now) {
      if (gen !== tanGen) return;
      if (!start) {
        start = now;
        lastFxDraw = now - FX_FRAME_MS;
      }
      var t = (now - start) % CYCLE;
      if (punched && t < T_DASH0) reset();
      // Võ sĩ: cập nhật từng khung hình cho chuyển động mượt.
      var pose = poseAt(t);
      if (pose) applyPose(pose, t);
      else if (rig.visible) hideFighter();
      // Hiệu ứng canvas: nghỉ hẳn khi cảnh đã xong, chờ chu kỳ mới.
      if (t < T_DASH0 || t >= T_BACK1 + 100) {
        if (!fxIdle) {
          ctx.clearRect(0, 0, W, H);
          fxIdle = true;
        }
        tanRAF = window.requestAnimationFrame(loop);
        return;
      }
      fxIdle = false;
      if (now - lastFxDraw >= FX_FRAME_MS) {
        lastFxDraw = now;
        measure();
        draw(t);
      }
      tanRAF = window.requestAnimationFrame(loop);
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      // ---- lướt vào / lùi ra: vệt gió + bụi khi trượt dừng ----
      if (t >= T_DASH0 && t < T_DASH1 - 60) addStreaks(1);
      if (t >= T_OUT0 + 40 && t < T_OUT1 - 80) addStreaks(-1);
      if (!events.skid && t >= T_DASH1 - 40) {
        events.skid = true;
        addDust(rig.feet[0][0], 0, 6, 0.7);
        addDust(rig.feet[1][0], 0, 5, 0.9);
      }
      if (!events.pivot && t >= T_PUNCH - 70) {
        events.pivot = true;
        addDust(rig.feet[0][0], 0, 4, 0.5);
      }
      if (!events.hop && t >= T_OUT0) {
        events.hop = true;
        addDust(rig.feet[1][0], 0, 5, -0.8);
      }

      // ---- gồng: hạt sáng hút vào nắm đấm ----
      if (t >= T_COIL0 && t < T_PUNCH - 40) {
        addMote();
        if (t >= T_COIL1) addMote();
      }

      // ---- đấm trúng -> nổ + mạng kính vỡ + giật mạnh ----
      if (!punched && t >= T_PUNCH) {
        punched = true;
        addExplosion(target.x, target.y);
        makeGlassCracks(target.x, target.y);
        flash = 1.3;
        shake = 1.4;
        impact = 1;
        impactAt = rigToCanvas(rig.fist[0], rig.fist[1]);
      }

      // ---- giật + nhấn mạnh cụm chữ khi trúng ----
      if (shake > 0) {
        var sc = 1 + shake * 0.1; // nhấn to lúc trúng rồi co về
        word.style.transform =
          "translate(" +
          ((Math.random() - 0.5) * 7 * shake).toFixed(1) +
          "px," +
          ((Math.random() - 0.5) * 5 * shake).toFixed(1) +
          "px) scale(" +
          sc.toFixed(3) +
          ")";
        shake -= 0.05;
        if (shake < 0) {
          shake = 0;
          word.style.transform = "none";
        }
      }

      // ---- mảnh: bay random lộn xộn -> lơ lửng -> bay về chỗ cũ ----
      if (punched) {
        for (var u = 0; u < U.length; u++) {
          var pl = plan[u] || [];
          if (t < T_BACK1 - 150) U[u].base.style.opacity = "0";
          for (var i = 0; i < U[u].shards.length; i++) {
            var d = pl[i] || {
              ex: 0,
              ey: -10,
              rot: 0,
              outDelay: 0,
              backDelay: 0,
            };
            var sh = U[u].shards[i];
            if (t < T_BACK0) {
              var op = clamp((t - T_SCATTER) / 120 - d.outDelay, 0, 1);
              var fp = clamp(
                (t - T_SCATTER) / (T_SCATTER_END - T_SCATTER) - d.outDelay,
                0,
                1,
              );
              fp = easeOut(fp);
              var gy = (d.grav || 0) * fp * fp; // trọng lực: rơi thêm theo thời gian
              sh.style.opacity = op.toFixed(2);
              sh.style.transform =
                "translate(" +
                (d.ex * fp).toFixed(1) +
                "px," +
                (d.ey * fp + gy).toFixed(1) +
                "px) rotate(" +
                (d.rot * fp).toFixed(1) +
                "deg)";
            } else if (t < T_BACK1) {
              var rp = clamp(
                (t - T_BACK0) / (T_BACK1 - T_BACK0) - d.backDelay * 0.4,
                0,
                1,
              );
              rp = easeOut(rp);
              var gyB = (d.grav || 0) * (1 - rp); // thu dần trọng lực khi về
              sh.style.opacity = (1 - rp * 0.1).toFixed(2);
              sh.style.transform =
                "translate(" +
                (d.ex * (1 - rp)).toFixed(1) +
                "px," +
                (d.ey * (1 - rp) + gyB).toFixed(1) +
                "px) rotate(" +
                (d.rot * (1 - rp)).toFixed(1) +
                "deg)";
            } else {
              sh.style.opacity = "0";
              sh.style.transform = "none";
            }
          }
          if (t >= T_BACK1 - 150) U[u].base.style.opacity = "1";
        }
      }

      // ---- KÍNH VỠ XANH: tâm lớn, mạng nứt ziczac và dư chấn loang ra ----
      if (crackPaths.length && t < T_BACK1) {
        var cA;
        if (t < T_PUNCH + 650) cA = clamp((t - T_PUNCH) / 650, 0, 1);
        else if (t < T_BACK0) cA = 1;
        else cA = clamp(1 - (t - T_BACK0) / (T_BACK1 - T_BACK0), 0, 1);
        var grow = clamp((t - T_PUNCH) / 820, 0, 1);
        var glowActive = t < T_PUNCH + 1100;
        // Tâm chỉ bùng ngắn lúc va chạm; mạng nứt vẫn giữ lại sau khi tâm tắt.
        var coreStrength = clamp(1 - (t - T_PUNCH) / 980, 0, 1);
        var pulse = 1 + Math.sin((t - T_PUNCH) / 88) * 0.05;
        var haloRadius = (36 + 54 * grow) * pulse;
        var coreRadius = (13 + 34 * grow) * pulse;
        var ci, cr, reveal;

        ctx.globalCompositeOperation = "lighter";
        // Tâm xanh nhỏ hơn, bùng nhanh rồi tắt để không giữ vùng cộng sáng nặng.
        if (coreStrength > 0.01) {
          var halo = ctx.createRadialGradient(
            target.x,
            target.y,
            0,
            target.x,
            target.y,
            haloRadius,
          );
          halo.addColorStop(
            0,
            "rgba(222,250,255," + cA * 0.46 * coreStrength + ")",
          );
          halo.addColorStop(
            0.18,
            "rgba(82,210,255," + cA * 0.29 * coreStrength + ")",
          );
          halo.addColorStop(
            0.52,
            "rgba(20,106,255," + cA * 0.15 * coreStrength + ")",
          );
          halo.addColorStop(1, "rgba(18,92,255,0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(target.x, target.y, haloRadius, 0, 7);
          ctx.fill();
        }

        for (ci = 0; ci < crackPaths.length; ci++) {
          cr = crackPaths[ci];
          reveal = clamp((grow * 1.78 - cr.delay) / (1 - cr.delay), 0, 1);
          strokeGlassPath(cr, reveal, cA, false, glowActive);
        }
        // Các vòng dư chấn cũng là đường gãy ziczac, không còn là tia thẳng.
        if (glowActive)
          for (ci = 0; ci < shockWaves.length; ci++) {
            var wave = shockWaves[ci];
            reveal = clamp((grow * 1.55 - wave.delay) / (1 - wave.delay), 0, 1);
            strokeGlassPath(wave, reveal, cA * (0.82 - ci * 0.08), true, true);
          }
        // Hạt phản chiếu chạy xuất hiện theo sau mạng nứt.
        if (glowActive)
          for (ci = 0; ci < crackChips.length; ci++) {
            var chip = crackChips[ci];
            reveal = clamp((grow * 1.66 - chip.delay) / (1 - chip.delay), 0, 1);
            if (reveal <= 0) continue;
            var cs = chip.size * (0.55 + reveal * 0.72),
              ca = cA * reveal * 0.64;
            var c1x = chip.x + Math.cos(chip.angle) * cs,
              c1y = chip.y + Math.sin(chip.angle) * cs;
            var c2x = chip.x + Math.cos(chip.angle + 2.35) * cs * 0.74,
              c2y = chip.y + Math.sin(chip.angle + 2.35) * cs * 0.74;
            var c3x = chip.x + Math.cos(chip.angle - 2.18) * cs * 0.56,
              c3y = chip.y + Math.sin(chip.angle - 2.18) * cs * 0.56;
            ctx.beginPath();
            ctx.moveTo(c1x, c1y);
            ctx.lineTo(c2x, c2y);
            ctx.lineTo(c3x, c3y);
            ctx.closePath();
            ctx.fillStyle = "rgba(174,239,255," + ca + ")";
            ctx.shadowBlur = 0;
            ctx.fill();
          }

        if (coreStrength > 0.01) {
          var core = ctx.createRadialGradient(
            target.x,
            target.y,
            0,
            target.x,
            target.y,
            coreRadius,
          );
          core.addColorStop(
            0,
            "rgba(255,255,255," + cA * 0.88 * coreStrength + ")",
          );
          core.addColorStop(
            0.13,
            "rgba(196,247,255," + cA * 0.84 * coreStrength + ")",
          );
          core.addColorStop(
            0.38,
            "rgba(60,202,255," + cA * 0.62 * coreStrength + ")",
          );
          core.addColorStop(
            0.72,
            "rgba(26,98,255," + cA * 0.24 * coreStrength + ")",
          );
          core.addColorStop(1, "rgba(20,86,255,0)");
          ctx.fillStyle = core;
          ctx.shadowBlur = 8;
          ctx.shadowColor = "rgba(58,185,255," + cA * 0.65 * coreStrength + ")";
          ctx.beginPath();
          ctx.arc(target.x, target.y, coreRadius, 0, 7);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = "source-over";
      }

      // ---- FLASH ----
      if (flash > 0) {
        ctx.globalCompositeOperation = "lighter";
        var fg = ctx.createRadialGradient(
          target.x,
          target.y,
          0,
          target.x,
          target.y,
          66,
        );
        fg.addColorStop(0, "rgba(255,244,210," + flash * 0.95 + ")");
        fg.addColorStop(0.5, "rgba(255,180,90," + flash * 0.5 + ")");
        fg.addColorStop(1, "rgba(255,150,60,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(target.x, target.y, 66, 0, 7);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        flash -= 0.05;
        if (flash < 0) flash = 0;
      }

      // ---- SMOKE ----
      for (var s = smoke.length - 1; s >= 0; s--) {
        var pk = smoke[s];
        pk.x += pk.vx;
        pk.y += pk.vy;
        pk.vy -= 0.004;
        pk.r += 0.32;
        pk.life -= pk.decay;
        if (pk.life <= 0) {
          smoke.splice(s, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, pk.r, 0, 7);
        ctx.fillStyle = "rgba(120,120,120," + pk.life * 0.28 + ")";
        ctx.fill();
      }
      // ---- FLAMES ----
      ctx.globalCompositeOperation = "lighter";
      for (var fI = flames.length - 1; fI >= 0; fI--) {
        var fl = flames[fI];
        fl.y -= fl.vy;
        fl.vy += 0.015;
        fl.r *= 0.965;
        fl.life -= fl.decay;
        if (fl.life <= 0 || fl.r < 1) {
          flames.splice(fI, 1);
          continue;
        }
        var gg = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, fl.r);
        gg.addColorStop(
          0,
          "hsla(" + fl.hue + ",100%,66%," + fl.life * 0.85 + ")",
        );
        gg.addColorStop(1, "hsla(" + fl.hue + ",100%,46%,0)");
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(fl.x, fl.y, fl.r, 0, 7);
        ctx.fill();
      }
      // ---- SPARKS ----
      for (var k = sparks.length - 1; k >= 0; k--) {
        var spk = sparks[k];
        spk.x += spk.vx;
        spk.y += spk.vy;
        spk.vy += 0.14;
        spk.life -= spk.decay;
        if (spk.life <= 0) {
          sparks.splice(k, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(spk.x, spk.y, spk.r, 0, 7);
        ctx.fillStyle = "hsla(" + spk.hue + ",100%,62%," + spk.life + ")";
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // ---- VÕ SĨ: chớp sáng ở nắm đấm lúc chạm (tia trắng toả ra) ----
      if (impact > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(255,255,255," + impact * 0.9 + ")";
        ctx.lineWidth = 1.4;
        ctx.lineCap = "round";
        for (var ia = 0; ia < 10; ia++) {
          var ang = (ia / 10) * Math.PI * 2 + 0.3;
          var r0 = 4 + (1 - impact) * 10,
            r1 = r0 + 6 + impact * 9;
          ctx.beginPath();
          ctx.moveTo(impactAt.x + Math.cos(ang) * r0, impactAt.y + Math.sin(ang) * r0);
          ctx.lineTo(impactAt.x + Math.cos(ang) * r1, impactAt.y + Math.sin(ang) * r1);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
        impact -= 0.2;
        if (impact < 0) impact = 0;
      }
      // ---- hạt tụ lực bay vào nắm đấm ----
      if (motes.length) {
        var fc = rigToCanvas(rig.fist[0], rig.fist[1]);
        ctx.globalCompositeOperation = "lighter";
        for (var mi = motes.length - 1; mi >= 0; mi--) {
          var mo = motes[mi];
          mo.x += (fc.x - mo.x) * 0.2;
          mo.y += (fc.y - mo.y) * 0.2;
          mo.life -= 0.07;
          var md = Math.abs(fc.x - mo.x) + Math.abs(fc.y - mo.y);
          if (mo.life <= 0 || md < 1.5 || t >= T_PUNCH) {
            motes.splice(mi, 1);
            continue;
          }
          ctx.beginPath();
          ctx.arc(mo.x, mo.y, mo.size, 0, 7);
          ctx.fillStyle = "hsla(" + mo.hue + ",100%,72%," + Math.min(1, mo.life * 1.3) + ")";
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }
      // ---- vệt gió khi lướt ----
      for (var si = streaks.length - 1; si >= 0; si--) {
        var st = streaks[si];
        st.life -= 0.16;
        if (st.life <= 0) {
          streaks.splice(si, 1);
          continue;
        }
        st.x += st.dir * 2.4;
        ctx.strokeStyle = "rgba(214,200,255," + st.life * 0.55 + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(st.x, st.y);
        ctx.lineTo(st.x + st.dir * st.len, st.y);
        ctx.stroke();
      }
      // ---- bụi dưới chân ----
      for (var di = dust.length - 1; di >= 0; di--) {
        var du = dust[di];
        du.x += du.vx;
        du.y += du.vy;
        du.vy += 0.02;
        du.r += 0.22;
        du.life -= 0.045;
        if (du.life <= 0) {
          dust.splice(di, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(du.x, du.y, du.r, 0, 7);
        ctx.fillStyle = "rgba(196,184,168," + du.life * 0.3 + ")";
        ctx.fill();
      }
    }

    tanRAF = window.requestAnimationFrame(loop);
  }

  function updateTester(tabKey) {
    if (!testerName) return;
    stopTesterLightning();
    stopTanBattle();
    testerName.innerHTML = tabKey === "offset" ? TESTER_OFFSET : TESTER_DEFAULT;
    if (tabKey !== "offset") {
      startTesterLightning();
      startTanBattle();
    }
  }
  updateTester("danfile");
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (x) {
        x.classList.remove("active");
      });
      t.classList.add("active");
      for (var k in panes) panes[k].classList.remove("active");
      var tab = t.getAttribute("data-tab");
      panes[tab].classList.add("active");
      updateTester(tab);
    });
  });

  // ---- accordion cho các nhóm chức năng ----
  document.querySelectorAll(".acc-head").forEach(function (h) {
    h.addEventListener("click", function () {
      var body = h.nextElementSibling;
      var arrow = h.querySelector(".acc-arrow");
      var open = body.classList.toggle("open");
      arrow.innerHTML = open ? "&#9660;" : "&#9654;"; // ▼ mở / ▶ thu
    });
  });

  // ---- danh sách loại card ----
  var LAYOUTS = [
    { key: "9.2x5.6", name: "9.2 × 5.6  (20 chỗ)" },
    { key: "9x5.5", name: "9 × 5.5  (20 chỗ)" },
    { key: "9.2x5.2", name: "9.2 × 5.2  (21 chỗ)" },
    { key: "8.7x5.5", name: "8.7 × 5.5  (22 chỗ)" },
    { key: "10.2x15.2", name: "10.2 × 15.2  (6 chỗ)" },
    { key: "15.2x7.2", name: "15.2 × 7.2  (voucher, 8 chỗ)" },
  ];
  var layoutList = document.getElementById("layoutList");
  var voucherOpt = document.getElementById("voucherOpt");
  var voucherCard = document.getElementById("voucherCard");
  var selectedKey = LAYOUTS[0].key;
  LAYOUTS.forEach(function (lo, i) {
    var row = document.createElement("label");
    row.className = "radio-row";
    row.innerHTML =
      '<input type="radio" name="layout" value="' +
      lo.key +
      '"' +
      (i === 0 ? " checked" : "") +
      " /><span>" +
      lo.name +
      "</span>";
    layoutList.appendChild(row);
    row.querySelector("input").addEventListener("change", function () {
      selectedKey = this.value;
      if (selectedKey === "15.2x7.2") voucherOpt.classList.remove("hidden");
      else voucherOpt.classList.add("hidden");
    });
  });

  // Ô .out tự xuống dòng trong khung (CSS lo), không cần chỉnh cỡ chữ.
  function fitOut(el) {}

  // Gắn "bôi đen hết ở LẦN ĐẦU focus" cho 1 ô input theo id.
  //  - Tab tới / click vào ô chưa focus  -> select all (gõ đè nhanh).
  //  - Click lần 2 trong ô đang focus     -> đặt con trỏ để sửa giữa.
  function attachSelectFirst(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var hadFocus = false;
    el.addEventListener("mousedown", function () {
      // Nếu ô CHƯA focus, click này là lần đầu -> cho phép select.
      hadFocus = document.activeElement === el;
    });
    el.addEventListener("focus", function () {
      var t = this;
      setTimeout(function () {
        try {
          t.select();
        } catch (e) {}
      }, 0);
    });
    el.addEventListener("click", function () {
      // Chỉ select-all khi click này KHỞI TẠO focus (ô trước đó chưa focus).
      // Click tiếp khi đã focus -> để nguyên vị trí con trỏ.
      if (!hadFocus) {
        var t = this;
        setTimeout(function () {
          try {
            t.select();
          } catch (e) {}
        }, 0);
      }
      hadFocus = true;
    });
  }
  function show(el, msg, state) {
    el.textContent = msg;
    el.className = "out" + (state ? " " + state : "");
    fitOut(el);
  }
  // Hiện kết quả OK kèm dòng cảnh báo sai KT (chữ đỏ) nếu có.
  function showOkWithWarn(el, msg) {
    var sai = 0;
    var idx = msg.indexOf("||SAIKT:");
    if (idx >= 0) {
      sai = parseInt(msg.substring(idx + 8), 10) || 0;
      msg = msg.substring(0, idx);
    }
    el.className = "out ok";
    if (sai > 0) {
      // dùng innerHTML để tô đỏ dòng cảnh báo
      var safe = msg
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      el.innerHTML =
        safe +
        '<br><span style="color:#ff5a5a;font-weight:600;">⚠ Có ' +
        sai +
        " con SAI KÍCH THƯỚC (đã dàn nhưng khác khổ - kiểm tra lại).</span>";
    } else {
      el.textContent = msg;
    }
    fitOut(el);
  }
  function jsStr(s) {
    // Escape CẢ dấu \ (nếu không, path Windows C:\Users\... sẽ bị
    // ExtendScript hiểu \U \A... là escape rồi nuốt mất dấu \).
    return "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  }
  // Tick "Transform" ở header (giai đoạn kiểm chứng, mặc định tắt): bật thì mọi lệnh đo khổ
  // theo khung Transform của Illustrator; tắt thì đo như các bản trước. Nhớ trong localStorage.
  var HDR_TRANSFORM_KEY = "dc.hdrTransform";
  var hdrTransformBox = document.getElementById("hdrTransform");
  // Mặc định BẬT (anh Lộc 22/10: toàn bộ dùng Transform để dàn); tắt được để so với cách cũ.
  function doTheoTransform() {
    return hdrTransformBox ? hdrTransformBox.checked : true;
  }
  if (hdrTransformBox) {
    try {
      hdrTransformBox.checked =
        window.localStorage.getItem(HDR_TRANSFORM_KEY) !== "0";
    } catch (storageReadError) {}
    hdrTransformBox.addEventListener("change", function () {
      try {
        window.localStorage.setItem(
          HDR_TRANSFORM_KEY,
          hdrTransformBox.checked ? "1" : "0",
        );
      } catch (storageWriteError) {}
    });
  }
  // Tiền tố ExtendScript cho MỌI lệnh: cờ đo khổ + thư mục extension (để jsx tìm assets
  // như icon ghi chú). Chạy trước phần nạp jsx của từng lệnh.
  function jsxPrelude() {
    var root = "";
    try {
      root = cs.getSystemPath(SystemPath.EXTENSION).replace(/\\/g, "/");
    } catch (rootError) {}
    return (
      "var dcDoTheoKhungTransform = " +
      (doTheoTransform() ? "true" : "false") +
      "; var dcExtensionRoot = " +
      jsStr(root) +
      "; "
    );
  }
  function evalJsx(expr, callback) {
    cs.evalScript(jsxPrelude() + expr, callback);
  }
  function loadAutoCutMarksJsx() {
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var jsxPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      return (
        "if (typeof dcThemDauCatTuDong !== 'function' || typeof dcAutoCutMarksVersion === 'undefined' || dcAutoCutMarksVersion < 2) { $.evalFile(" +
        jsStr(jsxPath) +
        "); } "
      );
    } catch (e) {
      return "";
    }
  }
  function loadDanTheoMauJsx() {
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var jsxPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      return (
        "if (typeof dcApMau !== 'function' || typeof dcDanTheoMauVersion === 'undefined' || dcDanTheoMauVersion < 3) { $.evalFile(" +
        jsStr(jsxPath) +
        "); } "
      );
    } catch (e) {
      return "";
    }
  }
  function loadDanToiUuJsx() {
    // CEP co the giu ExtendScript engine cu sau khi cai thu panel. Nạp lại khi
    // chưa có, hoặc khi engine vẫn giữ bộ tính Dàn tối ưu phiên bản cũ.
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var jsxPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      var danBeBridgePath = extensionRoot + "/jsx/dan_be_bridge.jsx";
      return (
        "if (typeof dcDanToiUu !== 'function' || typeof dcCopyToiUuNoteToAllArtboards !== 'function' || typeof dcCopyToiUuNoteToOddArtboards !== 'function' || typeof dcDanToiUuVersion === 'undefined' || dcDanToiUuVersion < 24) { $.evalFile(" +
        jsStr(jsxPath) +
        "); } " +
        "if (typeof dcDanBePrepare !== 'function' || typeof dcDanBeRender !== 'function' || typeof dcDanBeNestingVersion === 'undefined' || dcDanBeNestingVersion < 14) { $.evalFile(" +
        jsStr(danBeBridgePath) +
        "); } "
      );
    } catch (e) {
      return "";
    }
  }
  function loadResizeJsx() {
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var jsxPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      return (
        "if (typeof dcResizeSelectionToSize !== 'function') { $.evalFile(" +
        jsStr(jsxPath) +
        "); } "
      );
    } catch (e) {
      return "";
    }
  }
  function loadClipJsx() {
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var jsxPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      return (
        "if (typeof dcClipTheoTransform !== 'function' || typeof dcClipToSizeVersion === 'undefined' || dcClipToSizeVersion < 9) { $.evalFile(" +
        jsStr(jsxPath) +
        "); } "
      );
    } catch (e) {
      return "";
    }
  }
  function loadCatalogueJsx() {
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var jsxPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      return (
        "if (typeof dcRunCatalogueAuto !== 'function' || typeof dcCatalogueAutoVersion === 'undefined' || dcCatalogueAutoVersion < 16) { $.evalFile(" +
        jsStr(jsxPath) +
        "); } "
      );
    } catch (e) {
      return "";
    }
  }
  function loadOffsetJsx() {
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var jsxPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      return (
        "if (typeof dcRunSignature8 !== 'function' || typeof dcSignature8AutoPonVersion === 'undefined' || dcSignature8AutoPonVersion < 43) { $.evalFile(" +
        jsStr(jsxPath) +
        "); } "
      );
    } catch (e) {
      return "";
    }
  }
  function loadKeoGayJsx() {
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var jsxPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      return (
        "if (typeof dcRunKeoGay !== 'function' || typeof dcKeoGayAutoPonVersion === 'undefined' || dcKeoGayAutoPonVersion < 16) { $.evalFile(" +
        jsStr(jsxPath) +
        "); } "
      );
    } catch (e) {
      return "";
    }
  }
  function loadOffsetPdfJsx() {
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var jsxPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      return (
        "if (typeof dcLuuCtlOffsetAIPackage !== 'function' || typeof dcCtlOffsetPdfVersion === 'undefined' || dcCtlOffsetPdfVersion < 6) { $.evalFile(" +
        jsStr(jsxPath) +
        "); } "
      );
    } catch (e) {
      return "";
    }
  }
  function loadDanTuTroJsx() {
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var jsxPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      return (
        "if (typeof dcDanTuTro !== 'function' || typeof dcDanTuTroVersion === 'undefined' || dcDanTuTroVersion < 12) { $.evalFile(" +
        jsStr(jsxPath) +
        "); } "
      );
    } catch (e) {
      return "";
    }
  }
  function handleRes(el, res) {
    if (res === "EvalScript error." || res === undefined || res === "")
      show(el, "Lỗi gọi ExtendScript.", "warn");
    else if (res.indexOf("ERR:") === 0)
      show(el, res.substring(4).replace(/^\s+/, ""), "warn");
    else if (res.indexOf("OK:") === 0)
      showOkWithWarn(el, res.substring(3).replace(/^\s+/, ""));
    else show(el, res, "ok");
  }
  // Hiển thị kết quả dàn có kèm số con/tờ: "OK:[[COUNT:n]] ghi chú…"
  function showCountResult(el, res) {
    if (res === "EvalScript error." || res === undefined || res === "") {
      show(el, "Lỗi gọi ExtendScript.", "warn");
      return;
    }
    if (res.indexOf("ERR:") === 0) {
      show(el, res.substring(4).replace(/^\s+/, ""), "warn");
      return;
    }
    if (res.indexOf("OK:") !== 0) {
      show(el, res, "ok");
      return;
    }

    var message = res.substring(3).replace(/^\s+/, "");
    var match = /^\[\[COUNT:(\d+)\]\]\s*/.exec(message);
    if (!match) {
      showOkWithWarn(el, message);
      return;
    }
    var safe = message
      .substring(match[0].length)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    el.className = "out ok";
    el.innerHTML =
      '<strong class="optimal-capacity">' +
      match[1] +
      " con / tờ</strong><br>" +
      safe;
    fitOut(el);
  }
  function showDanToiUuResult(res) {
    showCountResult(outDanToiUu, res);
  }

  // ---- Dấu cắt ----
  var btnCutMarks = document.getElementById("btnCutMarks");
  var outCutMarks = document.getElementById("outCutMarks");
  if (btnCutMarks && outCutMarks) {
    ["cutMarkLength", "cutMarkGap", "cutMarkEdge"].forEach(attachSelectFirst);
    btnCutMarks.addEventListener("click", function () {
      var length = document.getElementById("cutMarkLength").value || "1.4";
      var gap = document.getElementById("cutMarkGap").value || "0";
      var edge = document.getElementById("cutMarkEdge").value || "4";
      show(outCutMarks, "Đang tạo dấu cắt…");
      btnCutMarks.disabled = true;
      evalJsx(
        loadAutoCutMarksJsx() +
          "dcThemDauCatTuDong(" +
          jsStr(length) +
          ", " +
          jsStr(edge) +
          ", " +
          jsStr(gap) +
          ")",
        function (res) {
          btnCutMarks.disabled = false;
          handleRes(outCutMarks, res);
        },
      );
    });
  }

  // ---- Dàn Card ----
  var btnDan = document.getElementById("btnDan");
  var out = document.getElementById("out");
  btnDan.addEventListener("click", function () {
    var withCard = selectedKey === "15.2x7.2" && voucherCard.checked;
    show(out, "Đang dàn…");
    btnDan.disabled = true;
    var expr =
      "dcDan(" +
      jsStr(selectedKey) +
      ", " +
      (withCard ? "true" : "false") +
      ")";
    evalJsx(expr, function (res) {
      btnDan.disabled = false;
      handleRes(out, res);
    });
  });

  // ---- Dàn tối ưu không pon ----
  var btnDanToiUu = document.getElementById("btnDanToiUu");
  var outDanToiUu = document.getElementById("outDanToiUu");
  if (btnDanToiUu && outDanToiUu) {
    ["autoSheetWidth", "autoSheetHeight"].forEach(attachSelectFirst);
    btnDanToiUu.addEventListener("click", function () {
      var width = document.getElementById("autoSheetWidth").value || "";
      var height = document.getElementById("autoSheetHeight").value || "";
      var twoSided = document.getElementById("autoSheetTwoSided").checked;
      var multiPerArtboard = document.getElementById(
        "autoSheetMultiPerArtboard",
      ).checked;
      show(outDanToiUu, "Đang tính bố cục và tạo tờ giấy…");
      btnDanToiUu.disabled = true;
      evalJsx(
        loadDanToiUuJsx() +
          "dcDanToiUu(" +
          jsStr(width) +
          ", " +
          jsStr(height) +
          ", " +
          (twoSided ? "true" : "false") +
          ", " +
          (multiPerArtboard ? "true" : "false") +
          ")",
        function (res) {
          btnDanToiUu.disabled = false;
          showDanToiUuResult(res);
        },
      );
    });
  }

  // ---- Dàn bế decal/tag: tự tạo PON, dàn biên thật của bài + khuôn ----
  // Chia khu cách nhau (Dàn bế): khối tuỳ chọn chỉ hiện khi tick "Dàn nhiều mẫu vào một tờ";
  // ô khoảng cách chỉ hiện khi tick thêm "Chia khu cách nhau". Nằm ngoài khối click Dàn bế.
  function syncBeZoneOptions() {
    var multi = document.getElementById("beMultiPerArtboard");
    var split = document.getElementById("beZoneSplit");
    var opt = document.getElementById("beZoneOpt");
    var field = document.getElementById("beZoneGapField");
    if (!multi || !split || !opt || !field) return;
    if (multi.checked) opt.classList.remove("hidden");
    else opt.classList.add("hidden");
    if (multi.checked && split.checked) field.classList.remove("hidden");
    else field.classList.add("hidden");
  }
  (function () {
    var multi = document.getElementById("beMultiPerArtboard");
    var split = document.getElementById("beZoneSplit");
    if (multi) multi.addEventListener("change", syncBeZoneOptions);
    if (split) split.addEventListener("change", syncBeZoneOptions);
    syncBeZoneOptions();
  })();

  var btnDanBe = document.getElementById("btnDanBe");
  var outDanBe = document.getElementById("outDanBe");
  if (btnDanBe && outDanBe) {
    btnDanBe.addEventListener("click", function () {
      var beGapEl = document.getElementById("beGap");
      var beMarginEl = document.getElementById("beMargin");
      var bePonEl = document.getElementById("bePonClear");
      var beGap = beGapEl ? beGapEl.value || "2" : "2";
      var beMargin = beMarginEl ? beMarginEl.value || "4" : "4";
      var bePon = bePonEl ? bePonEl.value || "7.5" : "7.5";
      var bePaperWEl = document.getElementById("bePaperW");
      var bePaperHEl = document.getElementById("bePaperH");
      var bePonTopEl = document.getElementById("bePonTop");
      var bePonBottomEl = document.getElementById("bePonBottom");
      var bePonLeftEl = document.getElementById("bePonLeft");
      var bePonRightEl = document.getElementById("bePonRight");
      var bePaperW = bePaperWEl ? bePaperWEl.value || "33" : "33";
      var bePaperH = bePaperHEl ? bePaperHEl.value || "35.4" : "35.4";
      var bePonTop = bePonTopEl ? bePonTopEl.value || "10" : "10";
      var bePonBottom = bePonBottomEl ? bePonBottomEl.value || "10" : "10";
      var bePonLeft = bePonLeftEl ? bePonLeftEl.value || "10" : "10";
      var bePonRight = bePonRightEl ? bePonRightEl.value || "10" : "10";
      var beMultiEl = document.getElementById("beMultiPerArtboard");
      var beMulti = !!(beMultiEl && beMultiEl.checked);
      var beTwoEl = document.getElementById("beTwoSided");
      var beTwo = !!(beTwoEl && beTwoEl.checked);
      // Chia khu cách nhau: chỉ đọc ô mm khi gộp một tờ VÀ tick; không tick thì các khu cách nhau bằng khe.
      var beZoneSplitEl = document.getElementById("beZoneSplit");
      var beZoneGapEl = document.getElementById("beZoneGap");
      var beZoneSplit = beMulti && !!(beZoneSplitEl && beZoneSplitEl.checked);
      var beZoneGap = null;
      if (beZoneSplit) {
        var zoneText = String(beZoneGapEl ? beZoneGapEl.value : "").replace(",", ".").trim();
        beZoneGap = zoneText === "" ? NaN : Number(zoneText);
        if (!isFinite(beZoneGap) || beZoneGap < 0 || beZoneGap > 50) {
          show(outDanBe, "ERR: Khoảng cách khu phải là số từ 0 đến 50 mm.");
          return;
        }
      }
      show(outDanBe, "Đang đo khuôn và tạo PON theo khổ giấy nhập…");
      btnDanBe.disabled = true;
      evalJsx(
        loadDanToiUuJsx() +
          "dcDanBePrepare(" +
          jsStr(beGap) +
          ", " +
          jsStr(beMargin) +
          ", " +
          jsStr(bePon) +
          ", " +
          (beTwo ? "true" : "false") +
          ", " +
          JSON.stringify(String(bePaperW)) +
          ", " +
          JSON.stringify(String(bePaperH)) +
          ", " +
          JSON.stringify(String(bePonTop)) +
          ", " +
          JSON.stringify(String(bePonBottom)) +
          ", " +
          JSON.stringify(String(bePonLeft)) +
          ", " +
          JSON.stringify(String(bePonRight)) +
          ")",
        function (prepared) {
          var preparedText = String(prepared || "");
          if (preparedText.indexOf("OKJSON:") !== 0) {
            btnDanBe.disabled = false;
            showCountResult(outDanBe, preparedText);
            return;
          }

          var payload;
          try {
            payload = JSON.parse(preparedText.substring(7));
          } catch (parseError) {
            btnDanBe.disabled = false;
            show(
              outDanBe,
              "ERR: Không đọc được dữ liệu biên dạng từ Illustrator.",
            );
            return;
          }
          if (
            !window.DanBeNester ||
            typeof window.DanBeNester.nest !== "function"
          ) {
            btnDanBe.disabled = false;
            show(outDanBe, "ERR: Chưa nạp được lõi dàn bế silhouette.");
            return;
          }

          if (!payload || !payload.types || !payload.types.length) {
            btnDanBe.disabled = false;
            show(outDanBe, "ERR: Không có mẫu khuôn hợp lệ để dàn.");
            return;
          }
          var separate = !beMulti && payload.types.length > 1;
          var planCount = separate ? payload.types.length : 1;
          if (!separate && beZoneSplit) payload.zoneGapMm = beZoneGap;
          var plans = [],
            planIndex = 0,
            totalCount = 0,
            cachedPlans = {};

          function renderPlans() {
            var layout = separate ? { sheets: plans } : plans[0].slots;
            var report = { detail: plans[0].detail, mode: plans[0].mode };
            show(
              outDanBe,
              separate
                ? "Đã tính " +
                    planCount +
                    " tờ riêng" +
                    (beTwo ? " hai mặt" : "") +
                    ", tổng " +
                    totalCount +
                    " con; đang vẽ…"
                : "Đã tìm " +
                    totalCount +
                    " con; đang vẽ " +
                    (beTwo
                      ? "cặp trước/sau, Khuôn và PON…"
                      : "Khuôn, Bài và PON…"),
            );
            evalJsx(
              loadDanToiUuJsx() +
                "dcDanBeRender(" +
                jsStr(payload.jobId) +
                ", " +
                jsStr(JSON.stringify(layout)) +
                ", " +
                jsStr(JSON.stringify(report)) +
                ")",
              function (rendered) {
                btnDanBe.disabled = false;
                showCountResult(outDanBe, rendered);
              },
            );
          }

          // Nhận kết quả tìm (đồng bộ hoặc qua nestAsync) rồi xếp vào danh sách phương án.
          function acceptPlan(result) {
            if (!result || !result.ok) {
              btnDanBe.disabled = false;
              show(
                outDanBe,
                "ERR: " +
                  (result && result.error
                    ? result.error
                    : "Không tìm được cách dàn hợp lệ."),
              );
              return;
            }
            if (!result.slots || !result.slots.length) {
              btnDanBe.disabled = false;
              show(
                outDanBe,
                "ERR: Mẫu " + (planIndex + 1) + " không có vị trí dàn hợp lệ.",
              );
              return;
            }
            var slots = JSON.parse(JSON.stringify(result.slots));
            if (separate) {
              for (var slotIndex = 0; slotIndex < slots.length; slotIndex++)
                slots[slotIndex].mi = planIndex;
            }
            plans.push({
              modelIndex: planIndex,
              slots: slots,
              detail: result.detail,
              mode: result.mode,
            });
            totalCount += slots.length;
            planIndex++;
            if (planIndex < planCount) queuePlan();
            else renderPlans();
          }

          function searchPlan() {
            var result;
            // Gộp một tờ: chạy từng bước qua nestAsync để panel hiện "Đang suy nghĩ…" trong lúc chia khu.
            if (!separate && typeof window.DanBeNester.nestAsync === "function") {
              try {
                window.DanBeNester.nestAsync(
                  payload,
                  function (progress) {
                    if (progress && progress.total)
                      show(
                        outDanBe,
                        "Đang suy nghĩ… phương án " + progress.done + "/" + progress.total,
                      );
                  },
                  acceptPlan,
                );
              } catch (asyncError) {
                btnDanBe.disabled = false;
                show(
                  outDanBe,
                  "ERR: " +
                    (asyncError && asyncError.message
                      ? asyncError.message
                      : asyncError),
                );
              }
              return;
            }
            try {
              var input = payload,
                cacheKey = null;
              if (separate) {
                input = {};
                for (var key in payload) {
                  if (Object.prototype.hasOwnProperty.call(payload, key))
                    input[key] = payload[key];
                }
                input.types = [payload.types[planIndex]];
                // Chỉ dùng lại khi đường bao khuôn giống hệt nhau trên cùng khổ tờ.
                // Sao chép trước khi gán lại mi; không bao giờ sửa phương án dàn cục bộ đã cache.
                cacheKey = JSON.stringify(input.types[0].groups);
              }
              result =
                cacheKey && cachedPlans[cacheKey]
                  ? cachedPlans[cacheKey]
                  : window.DanBeNester.nest(input);
              if (cacheKey && result && result.ok)
                cachedPlans[cacheKey] = result;
            } catch (nestError) {
              btnDanBe.disabled = false;
              show(
                outDanBe,
                "ERR: " +
                  (nestError && nestError.message
                    ? nestError.message
                    : nestError),
              );
              return;
            }
            acceptPlan(result);
          }

          function queuePlan() {
            show(
              outDanBe,
              separate
                ? "Đang dàn mẫu " +
                    (planIndex + 1) +
                    "/" +
                    planCount +
                    " trên tờ riêng…"
                : "Đang tìm cách lồng khuôn theo đường bao thật…",
            );
            // Nhường cho Chromium vẽ lại giữa các mẫu. Chưa tạo object Illustrator nào
            // cho tới khi mọi phương án dàn đều thành công.
            window.setTimeout(searchPlan, 20);
          }
          queuePlan();
        },
      );
    });
  }

  var btnCopyToiUuNote = document.getElementById("btnCopyToiUuNote");
  var btnCopyToiUuNoteOneSide = document.getElementById(
    "btnCopyToiUuNoteOneSide",
  );
  var outCopyDanMauNote = document.getElementById("outCopyDanMauNote");
  function wireToiUuNoteButton(button, twoSided) {
    if (!button || !outCopyDanMauNote) return;
    button.addEventListener("click", function () {
      var notePrefixInput = document.getElementById("autoSheetNotePrefixes");
      var notePrefixes = notePrefixInput ? notePrefixInput.value || "" : "";
      show(
        outCopyDanMauNote,
        twoSided
          ? "Đang điền ghi chú bài 2 mặt (1, 3, 5…)…"
          : "Đang điền ghi chú bài 1 mặt (1, 2, 3…)…",
      );
      if (btnCopyToiUuNote) btnCopyToiUuNote.disabled = true;
      if (btnCopyToiUuNoteOneSide) btnCopyToiUuNoteOneSide.disabled = true;
      evalJsx(
        loadDanToiUuJsx() +
          (twoSided
            ? "dcCopyToiUuNoteToOddArtboards("
            : "dcCopyToiUuNoteToAllArtboards(") +
          jsStr(notePrefixes) +
          ")",
        function (res) {
          if (btnCopyToiUuNote) btnCopyToiUuNote.disabled = false;
          if (btnCopyToiUuNoteOneSide) btnCopyToiUuNoteOneSide.disabled = false;
          handleRes(outCopyDanMauNote, res);
        },
      );
    });
  }
  wireToiUuNoteButton(btnCopyToiUuNote, true);
  wireToiUuNoteButton(btnCopyToiUuNoteOneSide, false);

  // ---- Dàn Offset: Tự trở (1 artboard) ----
  var btnDanOffset = document.getElementById("btnDanOffset");
  var outDanOffset = document.getElementById("outDanOffset");
  if (btnDanOffset && outDanOffset) {
    [
      "offsetSheetWidth",
      "offsetSheetHeight",
      "offsetMargin",
      "offsetMaxBop",
    ].forEach(attachSelectFirst);

    btnDanOffset.addEventListener("click", function () {
      var width = document.getElementById("offsetSheetWidth").value || "";
      var height = document.getElementById("offsetSheetHeight").value || "";
      var margin = document.getElementById("offsetMargin").value || "0";
      var maxBop = document.getElementById("offsetMaxBop").value || "0";
      var repeatFillBox = document.getElementById("offsetRepeatFill");
      var repeatFill = repeatFillBox ? repeatFillBox.checked : false;
      show(outDanOffset, "Đang tính bố cục tự trở và tạo tờ giấy…");
      btnDanOffset.disabled = true;
      evalJsx(
        loadDanTuTroJsx() +
          "dcDanTuTro(" +
          jsStr(width) +
          ", " +
          jsStr(height) +
          ", " +
          jsStr(margin) +
          ", " +
          jsStr(maxBop) +
          ", " +
          (repeatFill ? "true" : "false") +
          ")",
        function (res) {
          btnDanOffset.disabled = false;
          showCountResult(outDanOffset, res);
        },
      );
    });
  }

  // ---- Dàn theo mẫu: Học mẫu / Áp mẫu ----
  var btnHocMau = document.getElementById("btnHocMau");
  var outHocMau = document.getElementById("outHocMau");
  var btnXacNhanConChuan = document.getElementById("btnXacNhanConChuan");
  var pendingHocMau = null;
  function localFileUrl(path) {
    // CEP chạy từ file:// nên thumbnail trong %TEMP% có thể được canvas đọc trực tiếp.
    return (
      "file:///" +
      encodeURI(String(path).replace(/\\/g, "/")).replace(/#/g, "%23")
    );
  }
  function loadThumbSignal(path, done, fail) {
    var image = new Image();
    image.onload = function () {
      try {
        var N = 128,
          cv = document.createElement("canvas"),
          ctx = cv.getContext("2d");
        cv.width = N;
        cv.height = N;
        ctx.clearRect(0, 0, N, N);
        ctx.drawImage(image, 0, 0, N, N);
        var pixels = ctx.getImageData(0, 0, N, N).data;
        var signal = new Float32Array(N * N);
        for (var i = 0, p = 0; i < signal.length; i++, p += 4) {
          var alpha = pixels[p + 3] / 255;
          var luminance =
            pixels[p] * 0.2126 +
            pixels[p + 1] * 0.7152 +
            pixels[p + 2] * 0.0722;
          // Chỉ dùng artwork tối để vòng tròn/nền màu không đánh lừa phép xoay.
          signal[i] = alpha * Math.max(0, (190 - luminance) / 190);
        }
        done(signal);
      } catch (err) {
        fail("Không đọc được pixel thumbnail: " + err);
      }
    };
    image.onerror = function () {
      fail("Không mở được thumbnail mẫu: " + path);
    };
    image.src = localFileUrl(path);
  }
  function sheetSignal(image, sx, sy, sw, sh) {
    var N = 128,
      cv = document.createElement("canvas"),
      ctx = cv.getContext("2d");
    cv.width = N;
    cv.height = N;
    ctx.clearRect(0, 0, N, N);
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, N, N);
    var pixels = ctx.getImageData(0, 0, N, N).data;
    var signal = new Float32Array(N * N);
    for (var i = 0, p = 0; i < signal.length; i++, p += 4) {
      var alpha = pixels[p + 3] / 255;
      var luminance =
        pixels[p] * 0.2126 + pixels[p + 1] * 0.7152 + pixels[p + 2] * 0.0722;
      signal[i] = alpha * Math.max(0, (190 - luminance) / 190);
    }
    return signal;
  }
  function loadSheetSignals(path, regions, done, fail) {
    var image = new Image();
    image.onload = function () {
      try {
        var imageW = image.naturalWidth || image.width,
          imageH = image.naturalHeight || image.height,
          signals = [],
          index = 0;
        if (!(imageW > 0) || !(imageH > 0))
          throw new Error("preview tổng có kích thước không hợp lệ.");
        function readNextBatch() {
          try {
            var end = Math.min(regions.length, index + 24);
            for (; index < end; index++) {
              var region = regions[index];
              if (!region || region.length !== 4)
                throw new Error(
                  "khung preview " + (index + 1) + " không hợp lệ.",
                );
              var rx = Number(region[0]),
                ry = Number(region[1]),
                rw = Number(region[2]),
                rh = Number(region[3]);
              if (!isFinite(rx) || !isFinite(ry) || !(rw > 0) || !(rh > 0))
                throw new Error(
                  "khung preview " + (index + 1) + " không hợp lệ.",
                );
              var sx = Math.max(0, Math.floor(rx * imageW)),
                sy = Math.max(0, Math.floor(ry * imageH)),
                ex = Math.min(imageW, Math.ceil((rx + rw) * imageW)),
                ey = Math.min(imageH, Math.ceil((ry + rh) * imageH));
              if (!(ex > sx) || !(ey > sy))
                throw new Error(
                  "khung preview " + (index + 1) + " nằm ngoài ảnh tổng.",
                );
              signals.push(sheetSignal(image, sx, sy, ex - sx, ey - sy));
            }
            if (index < regions.length) setTimeout(readNextBatch, 0);
            else done(signals);
          } catch (err) {
            fail("Không đọc được preview tổng: " + err);
          }
        }
        readNextBatch();
      } catch (err) {
        fail("Không đọc được preview tổng: " + err);
      }
    };
    image.onerror = function () {
      fail("Không mở được preview tổng: " + path);
    };
    image.src = localFileUrl(path);
  }
  function rotateSignal(source, turns) {
    var N = 128,
      out = new Float32Array(N * N),
      x,
      y;
    turns = ((turns % 4) + 4) % 4;
    for (y = 0; y < N; y++)
      for (x = 0; x < N; x++) {
        if (turns === 0) out[y * N + x] = source[y * N + x];
        else if (turns === 1) out[y * N + x] = source[(N - 1 - x) * N + y];
        else if (turns === 2)
          out[y * N + x] = source[(N - 1 - y) * N + (N - 1 - x)];
        else out[y * N + x] = source[x * N + (N - 1 - y)];
      }
    return out;
  }
  function signalDistance(a, b) {
    var N = 128,
      best = Infinity,
      dx,
      dy,
      x,
      y;
    // Artboard/raster anti-alias có thể lệch khoảng một pixel: thử dịch nhẹ.
    for (dy = -2; dy <= 2; dy++)
      for (dx = -2; dx <= 2; dx++) {
        var total = 0,
          count = 0;
        for (y = 2; y < N - 2; y++)
          for (x = 2; x < N - 2; x++) {
            var bx = x + dx,
              by = y + dy;
            if (bx < 0 || bx >= N || by < 0 || by >= N) continue;
            total += Math.abs(a[y * N + x] - b[by * N + bx]);
            count++;
          }
        if (count && total / count < best) best = total / count;
      }
    return best;
  }
  function inferVisualAngles(paths, referenceIndex, done, fail) {
    var signals = [],
      index = 0;
    function next() {
      if (index >= paths.length) {
        if (!signals.length) {
          fail("Không có thumbnail để học hướng artwork.");
          return;
        }
        if (
          !isFinite(referenceIndex) ||
          referenceIndex < 0 ||
          referenceIndex >= signals.length
        ) {
          fail("Con mẫu chuẩn không khớp dữ liệu snapshot.");
          return;
        }
        var base = signals[referenceIndex],
          rotations = [],
          i,
          k;
        var rotatedBase = [
          rotateSignal(base, 0),
          rotateSignal(base, 1),
          rotateSignal(base, 2),
          rotateSignal(base, 3),
        ];
        for (i = 0; i < signals.length; i++) {
          var best = 0,
            bestScore = Infinity;
          for (k = 0; k < 4; k++) {
            var score = signalDistance(signals[i], rotatedBase[k]);
            if (score < bestScore) {
              bestScore = score;
              best = k;
            }
          }
          rotations.push(best);
        }
        // Slot tham chiếu do người dùng chọn là mốc 0 độ duy nhất.
        var angles = [];
        for (i = 0; i < rotations.length; i++) {
          var visualTurns = rotations[i];
          // Canvas quay dương theo chiều kim đồng hồ; Illustrator rotate dương
          // theo hệ trục trang, nên đổi chiều cho các góc 90/270.
          angles.push(((4 - visualTurns) % 4) * 90);
        }
        done(angles);
        return;
      }
      loadThumbSignal(
        paths[index],
        function (signal) {
          signals.push(signal);
          index++;
          next();
        },
        fail,
      );
    }
    next();
  }
  function inferSheetVisualAngles(path, regions, referenceIndex, done, fail) {
    loadSheetSignals(
      path,
      regions,
      function (signals) {
        if (!signals.length) {
          fail("Không có preview tổng để học hướng artwork.");
          return;
        }
        if (
          !isFinite(referenceIndex) ||
          referenceIndex < 0 ||
          referenceIndex >= signals.length
        ) {
          fail("Con mẫu chuẩn không khớp dữ liệu preview tổng.");
          return;
        }
        var base = signals[referenceIndex],
          rotations = [],
          i,
          k;
        var rotatedBase = [
          rotateSignal(base, 0),
          rotateSignal(base, 1),
          rotateSignal(base, 2),
          rotateSignal(base, 3),
        ];
        for (i = 0; i < signals.length; i++) {
          var best = 0,
            bestScore = Infinity;
          for (k = 0; k < 4; k++) {
            var score = signalDistance(signals[i], rotatedBase[k]);
            if (score < bestScore) {
              bestScore = score;
              best = k;
            }
          }
          rotations.push(best);
        }
        var angles = [];
        for (i = 0; i < rotations.length; i++)
          angles.push(((4 - rotations[i]) % 4) * 90);
        done(angles);
      },
      fail,
    );
  }
  function cleanupVisualThumbs(paths) {
    try {
      evalJsx("dcXoaPreviewMau(" + jsStr(paths.join("|")) + ")");
    } catch (e) {}
  }
  function parseSheetRegions(encoded) {
    if (!encoded) return null;
    var pieces = encoded.split(";"),
      regions = [];
    for (var i = 0; i < pieces.length; i++) {
      var values = pieces[i].split(",");
      if (values.length !== 4) return null;
      var region = [
        parseFloat(values[0]),
        parseFloat(values[1]),
        parseFloat(values[2]),
        parseFloat(values[3]),
      ];
      if (
        !isFinite(region[0]) ||
        !isFinite(region[1]) ||
        !(region[2] > 0) ||
        !(region[3] > 0)
      )
        return null;
      regions.push(region);
    }
    return regions.length ? regions : null;
  }
  function clearPendingHocMau(removeFiles) {
    if (removeFiles && pendingHocMau && pendingHocMau.paths)
      cleanupVisualThumbs(pendingHocMau.paths);
    pendingHocMau = null;
    if (btnXacNhanConChuan) {
      btnXacNhanConChuan.disabled = true;
      btnXacNhanConChuan.style.display = "none";
    }
  }
  if (btnHocMau) {
    btnHocMau.addEventListener("click", function () {
      clearPendingHocMau(true);
      show(outHocMau, "Đang học mẫu…");
      btnHocMau.disabled = true;
      evalJsx("dcHocMau()", function (res) {
        if (res && res.indexOf("PENDING_SHEET:") === 0) {
          var sheetData = res.substring(14).split("|");
          var sheetTag = sheetData.shift();
          var sheetPath = sheetData.shift();
          var regions = parseSheetRegions(sheetData.join("|"));
          if (!sheetTag || !sheetPath || !regions) {
            btnHocMau.disabled = false;
            show(
              outHocMau,
              "Preview tổng không hợp lệ. Hãy thử Học mẫu lại.",
              "warn",
            );
            return;
          }
          pendingHocMau = {
            tag: sheetTag,
            paths: [sheetPath],
            sheetPath: sheetPath,
            regions: regions,
          };
          if (btnXacNhanConChuan) {
            btnXacNhanConChuan.style.display = "";
            btnXacNhanConChuan.disabled = false;
          }
          btnHocMau.disabled = false;
          show(
            outHocMau,
            "Chọn 1 con mẫu cùng chiều nguồn → Xác nhận con chuẩn.",
          );
          return;
        }
        if (res && res.indexOf("PENDING:") === 0) {
          var data = res.substring(8).split("|");
          var tag = data.shift();
          pendingHocMau = { tag: tag, paths: data };
          if (btnXacNhanConChuan) {
            btnXacNhanConChuan.style.display = "";
            btnXacNhanConChuan.disabled = false;
          }
          btnHocMau.disabled = false;
          show(
            outHocMau,
            "Chọn 1 con mẫu cùng chiều nguồn → Xác nhận con chuẩn.",
          );
          return;
        } else {
          btnHocMau.disabled = false;
          handleRes(outHocMau, res);
        }
      });
    });
  }
  if (btnXacNhanConChuan) {
    btnXacNhanConChuan.addEventListener("click", function () {
      if (!pendingHocMau) {
        show(outHocMau, "Hãy bấm Học mẫu trước.", "warn");
        return;
      }
      var pending = pendingHocMau;
      btnXacNhanConChuan.disabled = true;
      if (btnHocMau) btnHocMau.disabled = true;
      show(outHocMau, "Đang đọc hướng artwork từ con chuẩn…");
      evalJsx(
        "dcHocMauXacNhanConChuan(" + jsStr(pending.tag) + ")",
        function (referenceRes) {
          if (!referenceRes || referenceRes.indexOf("OK:") !== 0) {
            btnXacNhanConChuan.disabled = false;
            if (btnHocMau) btnHocMau.disabled = false;
            handleRes(outHocMau, referenceRes);
            return;
          }
          var referenceIndex = parseInt(referenceRes.substring(3), 10);
          if (
            !isFinite(referenceIndex) ||
            referenceIndex < 0 ||
            referenceIndex >=
              (pending.regions ? pending.regions.length : pending.paths.length)
          ) {
            btnXacNhanConChuan.disabled = false;
            if (btnHocMau) btnHocMau.disabled = false;
            show(
              outHocMau,
              "Không xác định được con chuẩn. Hãy chọn lại.",
              "warn",
            );
            return;
          }
          var readAngles = pending.sheetPath
            ? function (done, fail) {
                inferSheetVisualAngles(
                  pending.sheetPath,
                  pending.regions,
                  referenceIndex,
                  done,
                  fail,
                );
              }
            : function (done, fail) {
                inferVisualAngles(pending.paths, referenceIndex, done, fail);
              };
          readAngles(
            function (angles) {
              var expr =
                "dcHocMauCapNhatGoc(" +
                jsStr(pending.tag) +
                ", " +
                jsStr(angles.join(",")) +
                ")";
              evalJsx(expr, function (finalRes) {
                cleanupVisualThumbs(pending.paths);
                if (pendingHocMau === pending) clearPendingHocMau(false);
                if (btnHocMau) btnHocMau.disabled = false;
                handleRes(outHocMau, finalRes);
              });
            },
            function (message) {
              cleanupVisualThumbs(pending.paths);
              if (pendingHocMau === pending) clearPendingHocMau(false);
              if (btnHocMau) btnHocMau.disabled = false;
              show(outHocMau, message + " Hãy thử Học mẫu lại.", "warn");
            },
          );
        },
      );
    });
  }
  var btnApMau = document.getElementById("btnApMau");
  var outApMau = document.getElementById("outApMau");
  var multiSourcePerArtboard = document.getElementById(
    "multiSourcePerArtboard",
  );
  if (btnApMau) {
    btnApMau.addEventListener("click", function () {
      show(outApMau, "Đang áp mẫu…");
      btnApMau.disabled = true;
      var useMultiSource = !!(
        multiSourcePerArtboard && multiSourcePerArtboard.checked
      );
      evalJsx(
        loadDanTheoMauJsx() +
          "dcApMau(" +
          (useMultiSource ? "true" : "false") +
          ")",
        function (res) {
          btnApMau.disabled = false;
          handleRes(outApMau, res);
        },
      );
    });
  }

  // ---- Lưu PDF kết quả Dàn theo mẫu ----
  var btnSaveDanMau = document.getElementById("btnSaveDanMau");
  var outSaveDanMau = document.getElementById("outSaveDanMau");
  var danMauSaveMode = document.getElementById("danMauSaveMode");
  var danMauSaveSuffix = document.getElementById("danMauSaveSuffix");
  attachSelectFirst("danMauSaveSuffix");
  if (btnSaveDanMau && outSaveDanMau) {
    btnSaveDanMau.addEventListener("click", function () {
      var mode = danMauSaveMode ? danMauSaveMode.value : "each";
      var suffix = danMauSaveSuffix ? danMauSaveSuffix.value : "";
      show(outSaveDanMau, "Mở cửa sổ chọn nơi lưu PDF…");
      btnSaveDanMau.disabled = true;
      evalJsx(
        "dcLuuDanTheoMauPDF(" + jsStr(mode) + ", " + jsStr(suffix) + ")",
        function (res) {
          btnSaveDanMau.disabled = false;
          handleRes(outSaveDanMau, res);
        },
      );
    });
  }

  // ---- Raster object đang chọn ----
  // Raster mỗi object đang chọn thành đúng một kết quả. Không tự suy ra artboard,
  // mask lồng bên trong hay group cha: đoán như vậy có thể gộp nhầm các trang riêng.
  function rasterizeSelectionInHost() {
    function rasterizeExactSelection(doc, liveSelection) {
      var options = new RasterizeOptions();
      options.resolution = 500;
      options.transparency = true;
      options.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
      // clipBounds đã cắt sẵn phần điểm ảnh. Nếu bảo Illustrator tạo thêm một
      // clipping mask nữa thì sẽ để lại phần mask vector thừa không cần thiết.
      options.clippingMask = false;
      options.padding = 0;
      options.convertSpotColors = false;

      function copyBounds(bounds) {
        if (!bounds || bounds.length < 4) return null;
        var result = [
          Number(bounds[0]),
          Number(bounds[1]),
          Number(bounds[2]),
          Number(bounds[3]),
        ];
        return result[2] > result[0] && result[1] > result[3] ? result : null;
      }

      function directChildren(group) {
        var result = [];
        try {
          var items = group.pageItems;
          for (var i = 0; i < items.length; i++) {
            try {
              if (items[i].parent === group) result.push(items[i]);
            } catch (parentError) {}
          }
          if (result.length === 0)
            for (var j = 0; j < items.length; j++) result.push(items[j]);
        } catch (childrenError) {}
        return result;
      }

      function isClipPath(item) {
        try {
          if (item.clipping === true) return true;
        } catch (clipError) {}
        try {
          if (item.typename === "CompoundPathItem") {
            for (var i = 0; i < item.pathItems.length; i++)
              if (item.pathItems[i].clipping === true) return true;
          }
        } catch (compoundError) {}
        return false;
      }

      // Clipping path chỉ có giá trị quyết định khi nó thuộc trực tiếp về
      // group đang chọn. Không bao giờ lấy khung của object con cháu gán cho cha nó.
      function directClipFrame(item) {
        try {
          if (item.typename !== "GroupItem" || item.clipped !== true)
            return null;
        } catch (groupError) {
          return null;
        }
        var children = directChildren(item);
        for (var i = 0; i < children.length; i++) {
          if (!isClipPath(children[i])) continue;
          try {
            return copyBounds(children[i].geometricBounds);
          } catch (boundsError) {}
        }
        return null;
      }

      function frameArea(frame) {
        if (!frame) return 0;
        return (
          Math.max(0, frame[2] - frame[0]) * Math.max(0, frame[1] - frame[3])
        );
      }

      function frameCoversItem(frame, item) {
        var itemBounds = null;
        try {
          itemBounds = copyBounds(item.visibleBounds);
        } catch (visibleError) {}
        if (!itemBounds) {
          try {
            itemBounds = copyBounds(item.geometricBounds);
          } catch (geometricError) {}
        }
        if (!itemBounds) return false;

        var itemWidth = itemBounds[2] - itemBounds[0];
        var itemHeight = itemBounds[1] - itemBounds[3];
        var overlapWidth = Math.max(
          0,
          Math.min(frame[2], itemBounds[2]) - Math.max(frame[0], itemBounds[0]),
        );
        var overlapHeight = Math.max(
          0,
          Math.min(frame[1], itemBounds[1]) - Math.max(frame[3], itemBounds[3]),
        );

        // Clip của trang có thể gồm cả tràn lề, nhưng vẫn phải phủ gần hết
        // vùng bao nhìn thấy của group đang chọn. Clip của ảnh sẽ không đạt.
        return (
          overlapWidth >= itemWidth * 0.9 &&
          overlapHeight >= itemHeight * 0.9 &&
          overlapWidth * overlapHeight >= frameArea(itemBounds) * 0.85
        );
      }

      // Một số trang nhập vào có một group thường bọc ngoài, còn group clip
      // thật của trang nằm thấp hơn một cấp. Chỉ gom các object con có clip ngoài cùng
      // để mask ảnh bên trong trang không bị lấy làm ranh giới raster.
      function collectNestedPageFrames(group, frames) {
        var children = directChildren(group);
        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          try {
            if (child.typename !== "GroupItem") continue;
            if (child.clipped === true) {
              var frame = directClipFrame(child);
              if (frame) frames.push(frame);
              continue;
            }
            collectNestedPageFrames(child, frames);
          } catch (childError) {}
        }
      }

      function nestedPageFrame(item) {
        try {
          if (item.typename !== "GroupItem") return null;
        } catch (itemError) {
          return null;
        }

        var frames = [];
        collectNestedPageFrames(item, frames);
        if (frames.length === 1)
          return frameCoversItem(frames[0], item) ? frames[0] : null;
        if (frames.length < 2) return null;

        // Khung trang phải lớn hơn hẳn các mask ảnh/chi tiết. Hai khung
        // lớn xấp xỉ nhau nghĩa là selection chứa nhiều hơn một trang,
        // nên giữ nguyên cả object đang chọn sẽ an toàn hơn là đoán.
        frames.sort(function (a, b) {
          return frameArea(b) - frameArea(a);
        });
        return frameArea(frames[0]) >= frameArea(frames[1]) * 2 &&
          frameCoversItem(frames[0], item)
          ? frames[0]
          : null;
      }

      function rasterFrame(item) {
        var clipFrame = directClipFrame(item);
        if (clipFrame) return clipFrame;
        var nestedFrame = nestedPageFrame(item);
        if (nestedFrame) return nestedFrame;
        try {
          var visible = copyBounds(item.visibleBounds);
          if (visible) return visible;
        } catch (visibleError) {}
        try {
          return copyBounds(item.geometricBounds);
        } catch (geometricError) {
          return null;
        }
      }

      function isEditable(item) {
        try {
          if (
            item.locked === true ||
            item.hidden === true ||
            item.guides === true
          )
            return false;
        } catch (itemStateError) {}
        try {
          if (item.layer.locked === true || item.layer.visible === false)
            return false;
        } catch (layerStateError) {}
        return true;
      }

      function isAncestor(ancestor, item) {
        var current = item;
        while (current) {
          try {
            current = current.parent;
          } catch (parentError) {
            return false;
          }
          if (!current || current === ancestor) return current === ancestor;
          try {
            if (current.typename === "Layer" || current.typename === "Document")
              return false;
          } catch (endError) {
            return false;
          }
        }
        return false;
      }

      // Object nguồn được giữ nguyên cho tới khi bản nhân bản đã clip trở thành
      // RasterItem. Nhờ vậy không mất trang nếu Illustrator từ chối một object.
      function rasterOne(source, frame) {
        var duplicate = null;
        var raster = null;
        try {
          duplicate = source.duplicate(source, ElementPlacement.PLACEAFTER);
          // Document.rasterize tự huỷ bản sao của nguồn và clip điểm ảnh
          // theo frame. Clip group đã chuẩn bị sẵn thì đã chứa nền của nó.
          raster = doc.rasterize(duplicate, frame, options);
          if (!raster) throw new Error("Illustrator không trả về RasterItem.");
          // Đa số phiên bản Illustrator dùng xong là mất luôn duplicate. Một số group clip
          // phức tạp lại để duplicate đó còn sống, nên chỉ xoá bản sao còn sót
          // không phải raster trước khi xoá object nguồn ban đầu.
          try {
            if (duplicate !== raster && duplicate.typename !== "RasterItem")
              duplicate.remove();
          } catch (removeDuplicateError) {}
          try {
            raster.move(source, ElementPlacement.PLACEBEFORE);
          } catch (moveError) {}
          try {
            source.remove();
          } catch (removeSourceError) {
            try {
              raster.remove();
            } catch (removeRasterError) {}
            throw new Error("Không thể thay object gốc: " + removeSourceError);
          }
          return raster;
        } catch (rasterError) {
          try {
            if (raster) raster.remove();
          } catch (removeRasterError2) {}
          try {
            if (duplicate) duplicate.remove();
          } catch (cleanupError) {}
          throw rasterError;
        }
      }

      // Chụp lại danh sách trước lần thay đổi đầu tiên. Nếu không, selection sống của
      // Illustrator có thể bỏ sót object hoặc nhảy sang object cha khi các object trước bị xoá.
      var snapshot = [];
      for (var s = 0; s < liveSelection.length; s++)
        snapshot.push(liveSelection[s]);

      var unique = [];
      for (var u = 0; u < snapshot.length; u++) {
        var seen = false;
        for (var q = 0; q < unique.length; q++) {
          if (unique[q] === snapshot[u]) {
            seen = true;
            break;
          }
        }
        if (!seen) unique.push(snapshot[u]);
      }

      // Khi object cha đang chọn lại chứa một object con cũng đang chọn, chỉ raster
      // object cha được chọn tường minh đó một lần. Các object ngang hàng chọn riêng vẫn độc lập.
      var targets = [];
      for (var i = 0; i < unique.length; i++) {
        var nested = false;
        for (var j = 0; j < unique.length; j++) {
          if (i !== j && isAncestor(unique[j], unique[i])) {
            nested = true;
            break;
          }
        }
        if (!nested) targets.push(unique[i]);
      }

      var rasters = [];
      var errors = [];
      for (var t = 0; t < targets.length; t++) {
        try {
          if (!isEditable(targets[t]))
            throw new Error("object hoặc layer đang khóa/ẩn.");
          var frame = rasterFrame(targets[t]);
          if (!frame) throw new Error("không đo được khung object.");
          rasters.push(rasterOne(targets[t], frame));
        } catch (itemError) {
          errors.push("Object " + (t + 1) + ": " + itemError);
        }
      }

      if (rasters.length > 0) {
        try {
          doc.selection = rasters;
        } catch (selectError) {}
      }
      app.redraw();
      if (errors.length > 0)
        return (
          "OK: Đã raster " +
          rasters.length +
          "/" +
          targets.length +
          " object độc lập. Cảnh báo: " +
          errors.join(" | ")
        );
      return (
        "OK: Đã raster " +
        rasters.length +
        " object độc lập - CMYK, 500 ppi, nền trong suốt."
      );
    }

    try {
      if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";

      var doc = app.activeDocument;
      var selection = doc.selection;
      if (!selection || selection.length === 0)
        return "ERR: Hãy chọn ít nhất 1 object để raster.";
      if (doc.documentColorSpace !== DocumentColorSpace.CMYK)
        return "ERR: Tài liệu đang ở RGB. Hãy đổi File > Document Color Mode > CMYK Color rồi bấm Raster.";

      return rasterizeExactSelection(doc, selection);

      var options = new RasterizeOptions();
      options.resolution = 500;
      options.transparency = true;
      options.antiAliasingMethod = AntiAliasingMethod.ARTOPTIMIZED;
      options.clippingMask = false;
      options.padding = 0;
      options.convertSpotColors = false;

      function copyBounds(b) {
        if (!b || b.length < 4) return null;
        return [Number(b[0]), Number(b[1]), Number(b[2]), Number(b[3])];
      }

      function frameWidth(b) {
        return b ? b[2] - b[0] : 0;
      }

      function frameHeight(b) {
        return b ? b[1] - b[3] : 0;
      }

      function isUsableFrame(b) {
        return !!(b && frameWidth(b) > 0.01 && frameHeight(b) > 0.01);
      }

      function frameCenterX(b) {
        return (b[0] + b[2]) / 2;
      }

      function frameCenterY(b) {
        return (b[1] + b[3]) / 2;
      }

      // Dung sai nhỏ để chấp nhận sai số Illustrator, nhưng không nhận nhầm nền khác khung.
      function sameFrame(a, b) {
        if (!isUsableFrame(a) || !isUsableFrame(b)) return false;
        var smallest = Math.min(
          frameWidth(a),
          frameHeight(a),
          frameWidth(b),
          frameHeight(b),
        );
        var tolerance = Math.max(1, smallest * 0.003);
        return (
          Math.abs(frameWidth(a) - frameWidth(b)) <= tolerance &&
          Math.abs(frameHeight(a) - frameHeight(b)) <= tolerance &&
          Math.abs(frameCenterX(a) - frameCenterX(b)) <= tolerance &&
          Math.abs(frameCenterY(a) - frameCenterY(b)) <= tolerance
        );
      }

      function frameDifference(a, b) {
        return (
          Math.abs(frameWidth(a) - frameWidth(b)) +
          Math.abs(frameHeight(a) - frameHeight(b)) +
          Math.abs(frameCenterX(a) - frameCenterX(b)) +
          Math.abs(frameCenterY(a) - frameCenterY(b))
        );
      }

      function frameArea(b) {
        return frameWidth(b) * frameHeight(b);
      }

      function mergeBounds(acc, b) {
        if (!isUsableFrame(b)) return;
        if (!acc.value) {
          acc.value = copyBounds(b);
          return;
        }
        var a = acc.value;
        if (b[0] < a[0]) a[0] = b[0];
        if (b[1] > a[1]) a[1] = b[1];
        if (b[2] > a[2]) a[2] = b[2];
        if (b[3] < a[3]) a[3] = b[3];
      }

      function intersectBounds(a, b) {
        if (!isUsableFrame(a) || !isUsableFrame(b)) return null;
        var left = Math.max(a[0], b[0]);
        var top = Math.min(a[1], b[1]);
        var right = Math.min(a[2], b[2]);
        var bottom = Math.max(a[3], b[3]);
        if (right <= left || top <= bottom) return null;
        return [left, top, right, bottom];
      }

      function isHiddenOrGuide(item) {
        try {
          if (item.hidden === true) return true;
        } catch (hiddenError) {}
        try {
          if (item.guides === true) return true;
        } catch (guideError) {}
        return false;
      }

      function directChildren(group) {
        var result = [];
        var all = null;
        try {
          all = group.pageItems;
        } catch (childrenError) {
          return result;
        }
        var i;
        for (i = 0; i < all.length; i++) {
          try {
            if (all[i].parent === group) result.push(all[i]);
          } catch (parentError) {}
        }
        // Một số version Illustrator không trả parent đồng nhất; khi đó dùng collection gốc.
        if (result.length === 0 && all.length > 0) {
          for (i = 0; i < all.length; i++) result.push(all[i]);
        }
        return result;
      }

      function isClipShape(item) {
        try {
          if (item.clipping === true) return true;
        } catch (clipError) {}
        var type = "";
        try {
          type = item.typename;
        } catch (typeError) {
          return false;
        }
        if (type === "CompoundPathItem") {
          try {
            var paths = item.pathItems;
            for (var i = 0; i < paths.length; i++) {
              if (paths[i].clipping === true) return true;
            }
          } catch (compoundClipError) {}
        }
        return false;
      }

      // Lấy mask trực tiếp của chính clipping group, gồm cả compound path.
      function ownClipFrame(group) {
        try {
          if (group.typename !== "GroupItem" || group.clipped !== true)
            return null;
        } catch (groupError) {
          return null;
        }
        var children = directChildren(group);
        for (var i = 0; i < children.length; i++) {
          if (!isClipShape(children[i])) continue;
          try {
            return copyBounds(children[i].geometricBounds);
          } catch (maskBoundsError) {}
        }
        return null;
      }

      function pushUniqueFrame(frames, frame) {
        if (!isUsableFrame(frame)) return;
        for (var i = 0; i < frames.length; i++) {
          if (sameFrame(frames[i], frame)) return;
        }
        frames.push(copyBounds(frame));
      }

      // Nhặt clip của các group con. Gặp một clipping group thì chỉ lấy mask của nó.
      function collectChildClipFrames(node, frames) {
        var type = "";
        try {
          type = node.typename;
        } catch (typeError) {
          return;
        }
        if (type !== "GroupItem") return;
        var own = ownClipFrame(node);
        if (own) {
          pushUniqueFrame(frames, own);
          return;
        }
        var children = directChildren(node);
        for (var i = 0; i < children.length; i++)
          collectChildClipFrames(children[i], frames);
      }

      // Vùng nhìn thấy thật: group clip được giao với mask, nên không lấy phần bị che.
      function visibleUnionClipped(item, acc) {
        var type = "";
        try {
          type = item.typename;
        } catch (typeError) {
          return;
        }
        if (isHiddenOrGuide(item)) return;

        if (type === "GroupItem") {
          var own = ownClipFrame(item);
          var children = directChildren(item);
          if (own) {
            var inner = { value: null };
            for (var i = 0; i < children.length; i++) {
              if (isClipShape(children[i])) continue;
              visibleUnionClipped(children[i], inner);
            }
            var clippedInner = inner.value
              ? intersectBounds(inner.value, own)
              : null;
            mergeBounds(acc, clippedInner || own);
            return;
          }
          for (var j = 0; j < children.length; j++)
            visibleUnionClipped(children[j], acc);
          return;
        }

        if (isClipShape(item)) return;
        try {
          mergeBounds(acc, item.visibleBounds);
        } catch (visibleError) {
          try {
            mergeBounds(acc, item.geometricBounds);
          } catch (geometricError) {}
        }
      }

      function visibleFrame(item) {
        var acc = { value: null };
        visibleUnionClipped(item, acc);
        if (isUsableFrame(acc.value)) return acc.value;
        try {
          if (isUsableFrame(item.visibleBounds))
            return copyBounds(item.visibleBounds);
        } catch (visibleFallbackError) {}
        try {
          if (isUsableFrame(item.geometricBounds))
            return copyBounds(item.geometricBounds);
        } catch (geometricFallbackError) {}
        return null;
      }

      function isFilledClosedPath(path) {
        try {
          return path.closed === true && path.filled === true;
        } catch (pathError) {
          return false;
        }
      }

      function isBackgroundCandidate(item) {
        if (isHiddenOrGuide(item) || isClipShape(item)) return false;
        var type = "";
        try {
          type = item.typename;
        } catch (typeError) {
          return false;
        }
        if (type === "PathItem") return isFilledClosedPath(item);
        if (type === "CompoundPathItem") {
          try {
            var paths = item.pathItems;
            for (var i = 0; i < paths.length; i++) {
              if (isFilledClosedPath(paths[i])) return true;
            }
          } catch (compoundError) {}
          return false;
        }
        return (
          type === "RasterItem" ||
          type === "PlacedItem" ||
          type === "MeshItem" ||
          type === "SymbolItem"
        );
      }

      // Chỉ coi là rectangle khi 4 anchor thực sự nằm ở 4 góc, không nhận hình thoi.
      function isAxisAlignedRectangle(item, bounds) {
        var path = item;
        var type = "";
        try {
          type = item.typename;
        } catch (typeError) {
          return false;
        }
        if (type === "CompoundPathItem") {
          try {
            if (item.pathItems.length !== 1) return false;
            path = item.pathItems[0];
          } catch (compoundError) {
            return false;
          }
        }
        try {
          if (
            path.typename !== "PathItem" ||
            path.closed !== true ||
            path.pathPoints.length !== 4
          )
            return false;
          var tolerance = Math.max(
            0.5,
            Math.min(frameWidth(bounds), frameHeight(bounds)) * 0.001,
          );
          var corners = 0;
          for (var i = 0; i < 4; i++) {
            var anchor = path.pathPoints[i].anchor;
            var left = Math.abs(anchor[0] - bounds[0]) <= tolerance;
            var right = Math.abs(anchor[0] - bounds[2]) <= tolerance;
            var top = Math.abs(anchor[1] - bounds[1]) <= tolerance;
            var bottom = Math.abs(anchor[1] - bounds[3]) <= tolerance;
            if ((!left && !right) || (!top && !bottom)) return false;
            if (left && top) corners |= 1;
            else if (right && top) corners |= 2;
            else if (right && bottom) corners |= 4;
            else if (left && bottom) corners |= 8;
          }
          return corners === 15;
        } catch (rectError) {
          return false;
        }
      }

      function matchingReferenceError(bounds, references) {
        var best = null;
        for (var i = 0; i < references.length; i++) {
          if (!sameFrame(bounds, references[i])) continue;
          var difference = frameDifference(bounds, references[i]);
          if (best === null || difference < best) best = difference;
        }
        return best;
      }

      // Nền chỉ được nhận khi khớp kích thước + tâm với mask con hoặc khung group nhìn thấy.
      function findValidatedBackgroundFrame(source, references) {
        var best = null;
        function consider(item) {
          if (!isBackgroundCandidate(item)) return;
          var bounds = null;
          try {
            bounds = copyBounds(item.geometricBounds);
          } catch (boundsError) {
            return;
          }
          if (!isUsableFrame(bounds)) return;
          var difference = matchingReferenceError(bounds, references);
          if (difference === null) return;
          var candidate = {
            bounds: bounds,
            rectangle: isAxisAlignedRectangle(item, bounds),
            area: frameArea(bounds),
            difference: difference,
          };
          if (
            !best ||
            (candidate.rectangle && !best.rectangle) ||
            (candidate.rectangle === best.rectangle &&
              (candidate.area > best.area ||
                (candidate.area === best.area &&
                  candidate.difference < best.difference)))
          )
            best = candidate;
        }
        function scan(node) {
          var type = "";
          try {
            type = node.typename;
          } catch (typeError) {
            return;
          }
          if (type === "GroupItem") {
            var children = directChildren(node);
            for (var i = 0; i < children.length; i++) scan(children[i]);
            return;
          }
          consider(node);
        }
        scan(source);
        return best ? best.bounds : null;
      }

      function frameContains(outer, inner) {
        if (!isUsableFrame(outer) || !isUsableFrame(inner)) return false;
        var tolerance = Math.max(
          1,
          Math.min(frameWidth(outer), frameHeight(outer)) * 0.003,
        );
        return (
          inner[0] >= outer[0] - tolerance &&
          inner[1] <= outer[1] + tolerance &&
          inner[2] <= outer[2] + tolerance &&
          inner[3] >= outer[3] - tolerance
        );
      }

      // Không dùng mask con làm frame khi group còn có nội dung nhìn thấy nằm ngoài nó.
      function hasVisibleContentOutsideFrame(group, frame) {
        var type = "";
        try {
          type = group.typename;
        } catch (typeError) {
          return false;
        }
        if (type !== "GroupItem") return false;
        var children = directChildren(group);
        for (var i = 0; i < children.length; i++) {
          if (isHiddenOrGuide(children[i]) || isClipShape(children[i]))
            continue;
          var childFrame = visibleFrame(children[i]);
          if (isUsableFrame(childFrame) && !frameContains(frame, childFrame))
            return true;
        }
        return false;
      }

      function commonChildClipFrame(source, frames, groupFrame) {
        var best = null;
        var bestMatches = 0;
        var i;
        var j;
        // Một clip duy nhất chỉ là khung card khi mọi nội dung thấy được đều nằm trong nó.
        if (frames.length === 1) {
          if (!hasVisibleContentOutsideFrame(source, frames[0]))
            return copyBounds(frames[0]);
          return null;
        }
        for (i = 0; i < frames.length; i++) {
          var matches = groupFrame && sameFrame(frames[i], groupFrame) ? 1 : 0;
          for (j = 0; j < frames.length; j++) {
            if (i !== j && sameFrame(frames[i], frames[j])) matches++;
          }
          if (
            matches > bestMatches ||
            (matches === bestMatches &&
              best &&
              frameArea(frames[i]) > frameArea(best))
          ) {
            best = frames[i];
            bestMatches = matches;
          }
        }
        if (
          best &&
          bestMatches > 0 &&
          !hasVisibleContentOutsideFrame(source, best)
        )
          return copyBounds(best);
        return null;
      }
      function resolveRasterFrame(source) {
        // Clip cha có mask riêng thì đó là khung đúng nhất.
        var directMask = ownClipFrame(source);
        if (directMask) return directMask;

        var groupFrame = visibleFrame(source);
        var childFrames = [];
        collectChildClipFrames(source, childFrames);

        var references = [];
        if (isUsableFrame(groupFrame)) pushUniqueFrame(references, groupFrame);
        for (var i = 0; i < childFrames.length; i++)
          pushUniqueFrame(references, childFrames[i]);

        var background = findValidatedBackgroundFrame(source, references);
        if (background) return background;

        var childFrame = commonChildClipFrame(source, childFrames, groupFrame);
        if (childFrame) return childFrame;

        // Không đoán nền lớn nhất khi không có đối chiếu; clip theo phần đang thấy là an toàn.
        return groupFrame;
      }

      function isEditable(item) {
        try {
          if (item.locked === true) return false;
        } catch (itemLockError) {}
        try {
          if (item.layer.locked === true || item.layer.visible === false)
            return false;
        } catch (layerLockError) {}
        return true;
      }

      // Tạo outer clip trên BẢN SAO. Nếu raster lỗi, object gốc vẫn còn nguyên.
      function makeClipCopy(source, frame) {
        if (!isEditable(source))
          throw new Error("object hoặc layer đang bị khóa/ẩn.");

        var duplicate = null;
        var wrapper = null;
        try {
          duplicate = source.duplicate(source, ElementPlacement.PLACEAFTER);
          var parent = source.parent;
          wrapper = parent.groupItems.add();
          try {
            wrapper.move(source, ElementPlacement.PLACEBEFORE);
          } catch (orderError) {}

          var width = frameWidth(frame);
          var height = frameHeight(frame);
          var mask = source.layer.pathItems.rectangle(
            frame[1],
            frame[0],
            width,
            height,
          );
          mask.filled = false;
          mask.stroked = false;
          mask.move(wrapper, ElementPlacement.PLACEATBEGINNING);
          duplicate.move(wrapper, ElementPlacement.PLACEATEND);
          mask.clipping = true;
          wrapper.clipped = true;
          return { wrapper: wrapper, original: source };
        } catch (clipError) {
          try {
            if (wrapper) wrapper.remove();
            else if (duplicate) duplicate.remove();
          } catch (cleanupError) {}
          throw clipError;
        }
      }

      // Clip bắt buộc được tạo trước. Chỉ xóa object gốc sau khi Illustrator trả RasterItem.
      function rasterAfterRequiredClip(source, frame) {
        var prepared = makeClipCopy(source, frame);
        var raster = null;
        try {
          raster = doc.rasterize(prepared.wrapper, frame, options);
          if (!raster) throw new Error("Illustrator không trả về RasterItem.");
          try {
            raster.move(prepared.original, ElementPlacement.PLACEBEFORE);
          } catch (moveError) {}
          try {
            prepared.original.remove();
          } catch (removeError) {
            try {
              raster.remove();
            } catch (rasterCleanupError) {}
            throw new Error("không thay được object gốc: " + removeError);
          }
          return raster;
        } catch (rasterError) {
          if (!raster) {
            try {
              prepared.wrapper.remove();
            } catch (wrapperCleanupError) {}
          }
          throw rasterError;
        }
      }

      // Nếu người dùng chọn group cha thì giữ chính group đó để bắt trường hợp chỉ có clip con.
      function groupHasClipDescendant(group) {
        var frames = [];
        collectChildClipFrames(group, frames);
        return frames.length > 0;
      }

      function getRasterTarget(item) {
        try {
          if (
            item.typename === "GroupItem" ||
            item.typename === "CompoundPathItem"
          )
            return item;
        } catch (itemTypeError) {}

        var fallbackGroup = null;
        var current = item;
        while (current) {
          var type = "";
          try {
            type = current.typename;
          } catch (parentTypeError) {
            break;
          }
          if (type === "GroupItem") {
            var own = ownClipFrame(current);
            if (own) return current;
            if (!fallbackGroup && groupHasClipDescendant(current))
              fallbackGroup = current;
          }
          try {
            current = current.parent;
          } catch (parentError) {
            break;
          }
          if (!current) break;
          try {
            if (current.typename === "Layer" || current.typename === "Document")
              break;
          } catch (endParentError) {
            break;
          }
        }
        return fallbackGroup || item;
      }

      function isAncestor(ancestor, item) {
        var current = item;
        while (current) {
          try {
            current = current.parent;
          } catch (parentError) {
            return false;
          }
          if (!current) return false;
          if (current === ancestor) return true;
          try {
            if (current.typename === "Layer" || current.typename === "Document")
              return false;
          } catch (typeError) {
            return false;
          }
        }
        return false;
      }

      var rawTargets = [];
      for (var s = 0; s < selection.length; s++) {
        var target = getRasterTarget(selection[s]);
        var duplicateTarget = false;
        for (var q = 0; q < rawTargets.length; q++) {
          if (rawTargets[q] === target) {
            duplicateTarget = true;
            break;
          }
        }
        if (!duplicateTarget) rawTargets.push(target);
      }

      // Khi chọn cả group cha lẫn object con, chỉ raster group cha một lần.
      var sources = [];
      for (var r = 0; r < rawTargets.length; r++) {
        var nested = false;
        for (var t = 0; t < rawTargets.length; t++) {
          if (r !== t && isAncestor(rawTargets[t], rawTargets[r])) {
            nested = true;
            break;
          }
        }
        if (!nested) sources.push(rawTargets[r]);
      }

      var rasters = [];
      var errors = [];
      for (var k = 0; k < sources.length; k++) {
        try {
          var source = sources[k];
          var frame = resolveRasterFrame(source);
          if (!isUsableFrame(frame))
            throw new Error("không xác định được khung card/clip an toàn.");
          rasters.push(rasterAfterRequiredClip(source, frame));
        } catch (itemError) {
          errors.push("Object " + (k + 1) + ": " + itemError);
        }
      }

      if (rasters.length > 0) doc.selection = rasters;
      app.redraw();
      if (errors.length > 0)
        return (
          "ERR: Raster được " +
          rasters.length +
          "/" +
          sources.length +
          " object.\n" +
          errors.join("\n")
        );
      return (
        "OK: Đã clip rồi raster " +
        rasters.length +
        " object theo khung card — CMYK, 500 ppi, nền trong suốt."
      );
    } catch (e) {
      return "ERR: " + e;
    }
  }
  var btnRaster = document.getElementById("btnRaster");
  btnRaster.addEventListener("click", function () {
    btnRaster.disabled = true;
    btnRaster.textContent = "Đang raster…";
    evalJsx(
      "(" + rasterizeSelectionInHost.toString() + ")()",
      function (res) {
        btnRaster.disabled = false;
        btnRaster.textContent = "Raster";
        if (
          res === "EvalScript error." ||
          res === undefined ||
          res === "" ||
          res.indexOf("ERR:") === 0
        ) {
          window.alert(
            "Raster không chạy:\n\n" +
              (res || "Không nhận được phản hồi từ Illustrator."),
          );
          return;
        }
        // Thành công -> hiện alert báo số object đã raster.
        window.alert(
          res.indexOf("OK:") === 0 ? res.substring(3).replace(/^\s+/, "") : res,
        );
        btnRaster.textContent = "Đã xong";
        btnRaster.title = res;
        window.setTimeout(function () {
          btnRaster.textContent = "Raster";
        }, 1600);
      },
    );
  });

  // ---- Đo khung (kiểm chứng cách đo Transform, cạnh nút Raster) ----
  var btnDoKhung = document.getElementById("btnDoKhung");
  if (btnDoKhung)
    btnDoKhung.addEventListener("click", function () {
      btnDoKhung.disabled = true;
      evalJsx(loadDanToiUuJsx() + "dcDoKhungChon()", function (res) {
        btnDoKhung.disabled = false;
        if (
          res === "EvalScript error." ||
          res === undefined ||
          res === "" ||
          res.indexOf("ERR:") === 0
        ) {
          window.alert(
            "Đo khung không chạy:\n\n" +
              (res || "Không nhận được phản hồi từ Illustrator."),
          );
          return;
        }
        // Kết quả đã hiện bằng bảng ScriptUI trong Illustrator (cuộn được, chép được);
        // alert của CEP cắt mất dòng nên không dùng nữa.
        btnDoKhung.textContent = "Đã đo";
        window.setTimeout(function () {
          btnDoKhung.textContent = "Đo khung";
        }, 1600);
      });
    });

  // ---- Resize theo KT (nut Resize canh Raster) ----
  var btnResize = document.getElementById("btnResize");
  var resizePopover = document.getElementById("resizePopover");
  var resizeOk = document.getElementById("resizeOk");
  var resizeCancel = document.getElementById("resizeCancel");
  var resizeMsg = document.getElementById("resizeMsg");
  if (btnResize && resizePopover) {
    ["resizeW", "resizeH"].forEach(attachSelectFirst);
    btnResize.addEventListener("click", function () {
      if (clipPopover) clipPopover.classList.add("hidden");
      resizePopover.classList.toggle("hidden");
      if (!resizePopover.classList.contains("hidden")) {
        if (resizeMsg) resizeMsg.textContent = "";
        var w = document.getElementById("resizeW");
        if (w) {
          w.focus();
          w.select();
        }
      }
    });
    if (resizeCancel)
      resizeCancel.addEventListener("click", function () {
        resizePopover.classList.add("hidden");
      });
    if (resizeOk)
      resizeOk.addEventListener("click", function () {
        var wv = document.getElementById("resizeW").value || "";
        var hv = document.getElementById("resizeH").value || "";
        var uv = document.getElementById("resizeUnit").value || "cm";
        if (resizeMsg) resizeMsg.textContent = "Đang resize…";
        resizeOk.disabled = true;
        var expr =
          "(function(){try{" +
          loadResizeJsx() +
          "return dcResizeSelectionToSize(" +
          jsStr(wv) +
          ", " +
          jsStr(hv) +
          ", " +
          jsStr(uv) +
          ");}catch(e){return 'ERR: ' + e.toString();}})()";
        evalJsx(expr, function (res) {
          resizeOk.disabled = false;
          if (!resizeMsg) return;
          if (res && res.indexOf("OK:") === 0) {
            resizeMsg.textContent = res.substring(3).replace(/^\s+/, "");
            setTimeout(function () {
              resizePopover.classList.add("hidden");
            }, 900);
          } else if (res && res.indexOf("ERR:") === 0) {
            resizeMsg.textContent = res.substring(4).replace(/^\s+/, "");
          } else {
            resizeMsg.textContent = "Lỗi gọi ExtendScript.";
          }
        });
      });
  }

  // ---- Clip theo khung Transform (nút Clip cạnh Raster) ----
  //  Bấm là clip ngay, không hỏi kích thước: mỗi object đang chọn được bọc bằng mask
  //  đúng khung Transform của nó. Kết quả hiện trong bảng nhỏ dưới header; OK thì tự ẩn,
  //  lỗi thì để nguyên cho tới lần bấm sau.
  var btnClip = document.getElementById("btnClip");
  var clipPopover = document.getElementById("clipPopover");
  var clipMsg = document.getElementById("clipMsg");
  var clipHideTimer = null;
  if (btnClip && clipPopover) {
    btnClip.addEventListener("click", function () {
      if (resizePopover) resizePopover.classList.add("hidden");
      if (clipHideTimer) clearTimeout(clipHideTimer);
      clipPopover.classList.remove("hidden");
      if (clipMsg) clipMsg.textContent = "Đang clip theo khung Transform…";
      btnClip.disabled = true;
      var expr =
        "(function(){try{" +
        loadClipJsx() +
        "return dcClipTheoTransform();}catch(e){return 'ERR: ' + e.toString();}})()";
      evalJsx(expr, function (res) {
        btnClip.disabled = false;
        if (!clipMsg) return;
        if (res && res.indexOf("OK:") === 0) {
          clipMsg.textContent = res.substring(3).replace(/^\s+/, "");
          clipHideTimer = setTimeout(function () {
            clipPopover.classList.add("hidden");
          }, 2500);
        } else if (res && res.indexOf("ERR:") === 0) {
          clipMsg.textContent = res.substring(4).replace(/^\s+/, "");
        } else {
          clipMsg.textContent = "Lỗi gọi ExtendScript.";
        }
      });
    });
  }

  // ---- Dàn Catalogue ----
  var outCatalogue = document.getElementById("outCatalogue");
  // Chỉ giữ các handler này khi đang mở file HTML cũ còn nằm trong cache của CEP.
  if (document.getElementById("selCatA4")) {
    // dropdown chọn khổ -> ẩn/hiện ô nhập kích thước
    var selCatA4 = document.getElementById("selCatA4");
    var sizeCatA4 = document.getElementById("sizeCatA4");
    var selCatA5 = document.getElementById("selCatA5");
    var sizeCatA5 = document.getElementById("sizeCatA5");
    function syncSize(sel, box) {
      if (sel.value === "custom") box.classList.remove("hidden");
      else box.classList.add("hidden");
    }
    selCatA4.addEventListener("change", function () {
      syncSize(selCatA4, sizeCatA4);
    });
    selCatA5.addEventListener("change", function () {
      syncSize(selCatA5, sizeCatA5);
    });
    syncSize(selCatA4, sizeCatA4);
    syncSize(selCatA5, sizeCatA5);

    function runCat(expr, label, button) {
      show(outCatalogue, "Đang mở dàn catalogue " + label + "…");
      button.disabled = true;
      evalJsx(expr, function (res) {
        button.disabled = false;
        handleRes(outCatalogue, res);
      });
    }
    function validSize(w, h) {
      var pw = parseFloat(String(w).replace(",", "."));
      var ph = parseFloat(String(h).replace(",", "."));
      return !isNaN(pw) && !isNaN(ph) && pw > 0 && ph > 0;
    }

    var btnCatA4 = document.getElementById("btnCatA4");
    btnCatA4.addEventListener("click", function () {
      if (selCatA4.value === "a4") {
        runCat("dcRunCatalogueA4()", "A4", btnCatA4);
      } else {
        var w = document.getElementById("wCatA4").value;
        var h = document.getElementById("hCatA4").value;
        if (!validSize(w, h)) {
          show(
            outCatalogue,
            "Nhập kích thước hợp lệ (rộng × cao, cm).",
            "warn",
          );
          return;
        }
        runCat(
          "dcRunCatalogueCustom(" + jsStr(w) + "," + jsStr(h) + ")",
          "khổ " + w + "×" + h,
          btnCatA4,
        );
      }
    });

    var btnCatA5 = document.getElementById("btnCatA5");
    btnCatA5.addEventListener("click", function () {
      if (selCatA5.value === "a5") {
        runCat("dcRunCatalogueA5()", "A5", btnCatA5);
      } else {
        var w = document.getElementById("wCatA5").value;
        var h = document.getElementById("hCatA5").value;
        if (!validSize(w, h)) {
          show(
            outCatalogue,
            "Nhập kích thước hợp lệ (rộng × cao, cm).",
            "warn",
          );
          return;
        }
        runCat(
          "dcRunCatalogueCustomA5(" + jsStr(w) + "," + jsStr(h) + ")",
          "khổ A5 " + w + "×" + h,
          btnCatA5,
        );
      }
    });

    // ---- Dàn CTL Offset (signature 8) ----
  }

  var btnCatalogueAuto = document.getElementById("btnCatalogueAuto");
  if (btnCatalogueAuto && outCatalogue) {
    btnCatalogueAuto.addEventListener("click", function () {
      var w = document.getElementById("wCatalogueAuto").value;
      var h = document.getElementById("hCatalogueAuto").value;
      var pw = parseFloat(String(w).replace(",", "."));
      var ph = parseFloat(String(h).replace(",", "."));
      if (isNaN(pw) || isNaN(ph) || pw <= 0 || ph <= 0) {
        show(outCatalogue, "Kích thước không hợp lệ (rộng x cao, cm).", "warn");
        return;
      }
      show(outCatalogue, "Đang tính 1 hay 2 cuốn trên tờ...");
      btnCatalogueAuto.disabled = true;
      evalJsx(
        loadCatalogueJsx() +
          "dcRunCatalogueAuto(" +
          jsStr(w) +
          "," +
          jsStr(h) +
          ")",
        function (res) {
          btnCatalogueAuto.disabled = false;
          handleRes(outCatalogue, res);
        },
      );
    });
  }

  var btnOffset = document.getElementById("btnOffset");
  var outOffset = document.getElementById("outOffset");

  // ---- Lưu AI theo khổ (Đóng ghim giữa + Keo gáy) ----
  //  Dàn xong, JSX gắn đuôi "||CTLPDF:{json}" sau chuỗi OK, liệt kê từng khổ
  //  có trong bài. Bài có khổ nào thì hiện nút Lưu AI của khổ đó, giống bảng
  //  ghi chú chỉ hiện ô của loại tờ thật sự có.
  var offsetPdfBox = document.getElementById("offsetPdfBox");
  var offsetPdfButtons = document.getElementById("offsetPdfButtons");
  var outOffsetPdf = document.getElementById("outOffsetPdf");
  var offsetFileSuffix = document.getElementById("offsetFileSuffix");
  var OFFSET_PDF_LABELS = {
    BIA: "Bìa",
    TT4: "Tự trở 4 trang",
    TT8: "Tự trở 8 trang",
    TT16: "Tự trở 16 trang",
    AB: "Tờ AB",
    SMALL4: "Tự trở 4 trang",
    SMALL8: "Tự trở 8 trang",
    SMALL16: "Tự trở 16 trang",
    SMALLAB: "Tờ AB",
  };
  // pt -> cm, làm tròn tới mm: 1213.23 pt -> "42.8".
  function offsetPdfCm(pt) {
    return String(Math.round(pt / 2.834645669) / 10);
  }
  function hideOffsetPdf() {
    offsetPdfBox.classList.add("hidden");
    offsetPdfButtons.innerHTML = "";
  }
  function saveOffsetPdf(total, jobsText, label) {
    if (!window.DanCardCtlPackage || !window.DanCardCtlPackage.supported()) {
      show(
        outOffsetPdf,
        "Không có bộ nén ZIP; chưa xuất file. Hãy mở lại panel.",
        "warn",
      );
      return;
    }
    var buttons = offsetPdfButtons.querySelectorAll("button");
    function setDisabled(disabled) {
      for (var i = 0; i < buttons.length; i++) buttons[i].disabled = disabled;
      if (offsetFileSuffix) offsetFileSuffix.disabled = disabled;
    }
    setDisabled(true);
    show(outOffsetPdf, "Chọn nơi lưu AI + JPG + ZIP " + label + "…");
    evalJsx(
      loadOffsetPdfJsx() +
        "dcLuuCtlOffsetAIPackage(" +
        jsStr(total) +
        ", " +
        jsStr(jobsText) +
        ", " +
        jsStr(offsetFileSuffix ? offsetFileSuffix.value : "") +
        ")",
      function (res) {
        var at = typeof res === "string" ? res.indexOf("||CTLPACK:") : -1;
        if (at < 0) {
          setDisabled(false);
          handleRes(outOffsetPdf, res);
          return;
        }
        var text = res.substring(0, at),
          plan;
        try {
          plan = JSON.parse(res.substring(at + 10));
        } catch (e) {
          setDisabled(false);
          show(
            outOffsetPdf,
            text + " Không đọc được danh sách ZIP; AI/JPG đã giữ nguyên.",
            "warn",
          );
          return;
        }
        window.DanCardCtlPackage.pack(
          plan,
          function (status) {
            show(outOffsetPdf, status);
          },
          function (error, result) {
            setDisabled(false);
            if (error) {
              show(
                outOffsetPdf,
                text + " Nén ZIP lỗi: " + error.message,
                "warn",
              );
              return;
            }
            var files = result.files || [],
              errors = result.errors || [];
            var message = text + " Đã nén " + files.length + " ZIP.";
            if (errors.length) {
              message += " AI/JPG được giữ lại. Lỗi: ";
              for (var i = 0; i < errors.length; i++)
                message +=
                  (i ? " | " : "") + errors[i].name + ": " + errors[i].error;
              show(outOffsetPdf, message, "warn");
            } else handleRes(outOffsetPdf, message);
          },
        );
      },
    );
  }
  function renderOffsetPdf(plan) {
    offsetPdfButtons.innerHTML = "";
    var shown = 0;
    plan.groups.forEach(function (group) {
      if (!group || !group.jobs || !group.jobs.length) return;
      var first = group.jobs[0];
      var label = OFFSET_PDF_LABELS[group.key] || group.key;
      var text =
        "Lưu AI + JPG + ZIP " +
        label +
        " — " +
        offsetPdfCm(first.w) +
        " × " +
        offsetPdfCm(first.h) +
        " cm";
      if (group.jobs.length > 1) text += " (" + group.jobs.length + " file)";
      // Mỗi phần "TÊN=artboard,artboard@rộngxcao" là một file AI.
      var jobsText = group.jobs
        .map(function (job) {
          return job.name + "=" + job.ab.join(",") + "@" + job.w + "x" + job.h;
        })
        .join("|");
      var btn = document.createElement("button");
      btn.type = "buttton";
      btn.className = "btn";
      btn.textContent = text;
      btn.addEventListener("click", function () {
        saveOffsetPdf(plan.total, jobsText, label);
      });
      offsetPdfButtons.appendChild(btn);
      shown++;
    });
    if (!shown) {
      hideOffsetPdf();
      return;
    }
    offsetPdfBox.classList.remove("hidden");
    show(outOffsetPdf, "Bấm nút của khổ cần lưu.");
  }
  // Tách đuôi kế hoạch PDF khỏi kết quả dàn rồi mới hiện thông báo.
  function showOffsetResult(res) {
    var text = res;
    var plan = null;
    if (typeof res === "string") {
      var at = res.indexOf("||CTLPDF:");
      if (at >= 0) {
        text = res.substring(0, at);
        try {
          plan = JSON.parse(res.substring(at + 9));
        } catch (e) {
          plan = null;
        }
      }
    }
    handleRes(outOffset, text);
    if (!offsetPdfBox || !offsetPdfButtons || !outOffsetPdf) return;
    if (plan && plan.groups && plan.groups.length) renderOffsetPdf(plan);
    // Bấm Dàn rồi huỷ ngay ở bảng nhập khổ thì tài liệu chưa bị đụng tới, nút
    // của lượt dàn trước vẫn đúng. Mọi trường hợp khác đều giấu nút cũ đi.
    else if (res !== "OK: (bỏ qua)") hideOffsetPdf();
  }
  btnOffset.addEventListener("click", function () {
    var w = document.getElementById("wOffset").value;
    var h = document.getElementById("hOffset").value;
    var coBia = document.getElementById("offsetCoBia").checked;
    var pw = parseFloat(String(w).replace(",", "."));
    var ph = parseFloat(String(h).replace(",", "."));
    if (isNaN(pw) || isNaN(ph) || pw <= 0 || ph <= 0) {
      show(outOffset, "Nhập kích thước hợp lệ (rộng × cao, cm).", "warn");
      return;
    }
    show(outOffset, "Đang dàn CTL Offset…");
    btnOffset.disabled = true;
    var expr =
      loadOffsetJsx() +
      "dcRunSignature8(" +
      jsStr(w) +
      ", " +
      jsStr(h) +
      ", " +
      (coBia ? "true" : "false") +
      ")";
    evalJsx(expr, function (res) {
      btnOffset.disabled = false;
      showOffsetResult(res);
    });
  });

  // ---- Keo gáy ----
  var btnKeo = document.getElementById("btnKeo");
  btnKeo.addEventListener("click", function () {
    var w = document.getElementById("wKeo").value;
    var h = document.getElementById("hKeo").value;
    var pw = parseFloat(String(w).replace(",", "."));
    var ph = parseFloat(String(h).replace(",", "."));
    if (isNaN(pw) || isNaN(ph) || pw <= 0 || ph <= 0) {
      show(outOffset, "Nhập kích thước hợp lệ (rộng × cao, cm).", "warn");
      return;
    }
    show(outOffset, "Đang dàn keo gáy…");
    btnKeo.disabled = true;
    var expr =
      loadKeoGayJsx() + "dcRunKeoGay(" + jsStr(w) + ", " + jsStr(h) + ")";
    evalJsx(expr, function (res) {
      btnKeo.disabled = false;
      showOffsetResult(res);
    });
  });

  // ---- Đổi tên ----
  var btnRename = document.getElementById("btnRename");
  var outRename = document.getElementById("outRename");
  btnRename.addEventListener("click", function () {
    var prefix = document.getElementById("rnPrefix").value;
    var mode =
      (document.querySelector('input[name="rnMode"]:checked') || {}).value ||
      "num";
    var start = document.getElementById("rnStart").value;
    var pad = document.getElementById("rnPad").value;
    var dir =
      (document.querySelector('input[name="rnDir"]:checked') || {}).value ||
      "bottom";
    var bottomUp = dir === "bottom" ? "true" : "false";
    var repeat = document.getElementById("rnRepeat").value || "1";
    show(outRename, "Đang đổi tên…");
    btnRename.disabled = true;
    var expr =
      "dcRename(" +
      jsStr(prefix) +
      ", " +
      jsStr(mode) +
      ", " +
      jsStr(start) +
      ", " +
      jsStr(pad) +
      ", " +
      bottomUp +
      ", " +
      jsStr(repeat) +
      ")";
    evalJsx(expr, function (res) {
      btnRename.disabled = false;
      handleRes(outRename, res);
    });
  });

  // ---- Variable ----
  var btnVariable = document.getElementById("btnVariable");
  var outVariable = document.getElementById("outVariable");
  btnVariable.addEventListener("click", function () {
    show(outVariable, "Đang mở…");
    btnVariable.disabled = true;
    evalJsx("dcRunVariable()", function (res) {
      btnVariable.disabled = false;
      handleRes(outVariable, res);
    });
  });

  // ---- Dàn tag BD (xưởng Bình Dương: ghép tag vào khối ô card 9,2 × 5,6 đã tràn) ----
  // Luật chốt với anh Lộc 22/10/2026 (docs/THIET_KE_DAN_TAG_BD.md). Lõi ghép khối chạy ở
  // Chromium (js/dan_tag_bd.js), Illustrator chỉ đọc tag, đóng artboard và xuất PDF.
  function loadDanTagBdJsx() {
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var libPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      var bridgePath = extensionRoot + "/jsx/dan_tag_bd_bridge.jsx";
      return (
        "if (typeof dcKhungThanhPham !== 'function' || typeof dcPickFolder !== 'function') { $.evalFile(" +
        jsStr(libPath) +
        "); } " +
        "if (typeof dcDanTagBdVe !== 'function' || typeof dcDanTagBdXuatPdf !== 'function' || typeof dcDanTagBdVersion === 'undefined' || dcDanTagBdVersion < 7) { $.evalFile(" +
        jsStr(bridgePath) +
        "); } "
      );
    } catch (e) {
      return "";
    }
  }
  // Danh sách tag đã thêm (giữ trong bộ nhớ panel): { id, name, w, h, twoSided, qty }.
  var tagBdDanhSach = [];
  var tagBdKhoiCuoi = null; // kết quả lõi của lượt Dàn gần nhất (để xem trước tên file)
  var tagBdDangDan = false; // đang tìm/đóng artboard: khoá Thêm/Xoá/✕ để danh sách không đổi giữa chừng
  function tagBdKhoa(dang) {
    tagBdDangDan = dang;
    if (btnTagBdDan) btnTagBdDan.disabled = dang;
    if (btnTagBdThem) btnTagBdThem.disabled = dang;
    if (btnTagBdXoa) btnTagBdXoa.disabled = dang;
  }
  // "500", "2 000", "2.000" -> số; chỉ nhận 500 hoặc bội của 1000, sai trả null.
  function tagBdSoLuongHopLe(text) {
    var t = String(text === undefined || text === null ? "" : text).replace(/[\s.,]/g, "");
    if (!/^\d+$/.test(t)) return null;
    var n = parseInt(t, 10);
    if (n === 500) return 500;
    if (n >= 1000 && n % 1000 === 0) return n;
    return null;
  }
  function tagBdBai(qty) {
    return qty === 500 ? 500 : 1000;
  }
  function tagBdSoCon(qty) {
    return qty === 500 ? 1 : qty / 1000;
  }
  function tagBdEscape(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function tagBdSo(mm) {
    return String(Math.round(mm * 10) / 10);
  }
  var tagBdList = document.getElementById("tagBdList");
  var tagBdTotal = document.getElementById("tagBdTotal");
  var outTagBd = document.getElementById("outTagBd");
  var btnTagBdThem = document.getElementById("btnTagBdThem");
  var btnTagBdXoa = document.getElementById("btnTagBdXoa");
  var btnTagBdDan = document.getElementById("btnTagBdDan");
  var tagBdExport = document.getElementById("tagBdExport");
  var btnTagBdXuat = document.getElementById("btnTagBdXuat");
  var outTagBdXuat = document.getElementById("outTagBdXuat");
  var tbPreview = document.getElementById("tbPreview");
  var btnTagBdPickFolder = document.getElementById("btnTagBdPickFolder");
  function tagBdVeDanhSach() {
    if (!tagBdList || !tagBdTotal) return;
    if (!tagBdDanhSach.length) {
      tagBdList.innerHTML = "Chưa có tag nào.";
      tagBdTotal.textContent = "";
      return;
    }
    var rows = [],
      i,
      t,
      tong = { 500: { tag: 0, con: 0 }, 1000: { tag: 0, con: 0 } };
    for (i = 0; i < tagBdDanhSach.length; i++) {
      t = tagBdDanhSach[i];
      var bai = tagBdBai(t.qty),
        con = tagBdSoCon(t.qty);
      tong[bai].tag++;
      tong[bai].con += con;
      rows.push(
        "<tr><td>" +
          (i + 1) +
          '</td><td class="tagbd-name" title="' +
          tagBdEscape(t.name) +
          '">' +
          tagBdEscape(t.name) +
          "</td><td>" +
          tagBdSo(t.w) +
          " × " +
          tagBdSo(t.h) +
          "</td><td>" +
          (t.twoSided ? "2 mặt" : "1 mặt") +
          "</td><td>" +
          t.qty +
          "</td><td>" +
          bai +
          "</td><td>" +
          con +
          '</td><td><button type="button" class="tagbd-remove" data-remove="' +
          i +
          '" title="Bỏ tag này">✕</button></td></tr>',
      );
    }
    tagBdList.innerHTML =
      "<table><tr><th>#</th><th>Tag</th><th>Khổ (mm)</th><th>Mặt</th><th>SL</th><th>Bài</th><th>Con</th><th></th></tr>" +
      rows.join("") +
      "</table>";
    var parts = [];
    if (tong[500].tag) parts.push("Bài 500: " + tong[500].tag + " tag = " + tong[500].con + " con");
    if (tong[1000].tag) parts.push("Bài 1000: " + tong[1000].tag + " tag = " + tong[1000].con + " con");
    tagBdTotal.textContent = parts.join(" · ");
  }
  if (tagBdList) {
    tagBdList.addEventListener("click", function (ev) {
      if (tagBdDangDan) return;
      var target = ev && ev.target ? ev.target : null;
      var idx = target && target.getAttribute ? target.getAttribute("data-remove") : null;
      if (idx === null || idx === undefined) return;
      idx = parseInt(idx, 10);
      if (isNaN(idx) || idx < 0 || idx >= tagBdDanhSach.length) return;
      tagBdDanhSach.splice(idx, 1);
      tagBdVeDanhSach();
    });
  }
  if (btnTagBdThem) {
    btnTagBdThem.addEventListener("click", function () {
      if (tagBdDangDan) return;
      var qtyEl = document.getElementById("tbQty");
      var qty = tagBdSoLuongHopLe(qtyEl ? qtyEl.value : "");
      if (qty === null) {
        show(outTagBd, "Số lượng phải là 500 hoặc bội của 1000 (1000, 2000, 3000…).", "warn");
        return;
      }
      show(outTagBd, "Đang đọc tag đang chọn…");
      btnTagBdThem.disabled = true;
      evalJsx(loadDanTagBdJsx() + "dcDanTagBdDocTag()", function (res) {
        btnTagBdThem.disabled = false;
        var text = String(res || "");
        if (text.indexOf("OKJSON:") !== 0) {
          handleRes(outTagBd, text);
          return;
        }
        var data;
        try {
          data = JSON.parse(text.substring(7));
        } catch (parseError) {
          show(outTagBd, "Không đọc được dữ liệu tag từ Illustrator.", "warn");
          return;
        }
        if (!data || !data.tags || !data.tags.length) {
          show(outTagBd, "Không có tag hợp lệ trong vùng chọn.", "warn");
          return;
        }
        for (var i = 0; i < data.tags.length; i++) {
          var t = data.tags[i];
          tagBdDanhSach.push({ id: t.id, name: t.name, w: t.w, h: t.h, twoSided: !!t.twoSided, qty: qty });
        }
        tagBdVeDanhSach();
        // Object không phải tag (guide, ẩn, rỗng) lọt vào vùng chọn: đã bỏ qua, báo để người dùng biết.
        var boQua = data.boQua && data.boQua.length ? " Bỏ qua " + data.boQua.length + " object không phải tag: " + data.boQua.join("; ") + "." : "";
        show(
          outTagBd,
          "Đã thêm " + data.tags.length + " tag, số lượng " + qty + " (bài " + tagBdBai(qty) + ", " + tagBdSoCon(qty) + " con/tag)." + boQua + " Chọn tiếp hoặc bấm Dàn tag.",
          boQua ? "warn" : "ok",
        );
      });
    });
  }
  if (btnTagBdXoa) {
    btnTagBdXoa.addEventListener("click", function () {
      if (tagBdDangDan) return;
      tagBdDanhSach = [];
      tagBdVeDanhSach();
      show(outTagBd, "Đã xoá danh sách.");
    });
  }
  // Xem trước tên file theo khối đầu tiên của lượt Dàn gần nhất (chưa có thì ghi khổ mẫu).
  function tagBdTenMau() {
    var prefix = (document.getElementById("tbPrefix") || {}).value || "1088";
    var start = parseInt((document.getElementById("tbStart") || {}).value, 10);
    if (isNaN(start)) start = 1;
    var pad = parseInt((document.getElementById("tbPad") || {}).value, 10);
    if (isNaN(pad)) pad = 0;
    var cm = (document.getElementById("tbCanMang") || {}).value || "cm";
    var ngay = (document.getElementById("tbNgay") || {}).value || "";
    var note = String((document.getElementById("tbNote") || {}).value || "").replace(/^\s+|\s+$/g, "");
    var sttStr = String(start);
    while (sttStr.length < pad) sttStr = "0" + sttStr;
    var hop = "10",
      kho = "110 x 458";
    if (tagBdKhoiCuoi && tagBdKhoiCuoi.jobs && tagBdKhoiCuoi.jobs.length && tagBdKhoiCuoi.jobs[0].blocks.length) {
      var b = tagBdKhoiCuoi.jobs[0].blocks[0];
      hop = String(tagBdKhoiCuoi.jobs[0].hop);
      kho = tagBdSo(b.w - 2) + " x " + tagBdSo(b.h - 2);
    }
    return prefix + " - " + sttStr + " - " + hop + " hop " + kho + (note ? " - " + note : "") + " - " + cm + " - " + ngay + ".pdf";
  }
  function tagBdCapNhatXemTruoc() {
    if (tbPreview) tbPreview.textContent = tagBdTenMau() + (tagBdKhoiCuoi ? "" : "  (khổ ví dụ)");
  }
  ["tbStart", "tbPad", "tbCanMang", "tbNgay", "tbNote"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", tagBdCapNhatXemTruoc);
      el.addEventListener("change", tagBdCapNhatXemTruoc);
    }
  });
  ["tbQty", "tbStart", "tbPad", "tbNgay", "tbNote", "tbFolder"].forEach(attachSelectFirst);
  (function tagBdNgayHomNay() {
    var el = document.getElementById("tbNgay");
    if (el && !el.value) el.value = String(new Date().getDate());
  })();
  // Hỏi Illustrator có bao nhiêu cặp artboard TagBD để hiện/ẩn khối xuất PDF.
  function tagBdCapNhatXuat() {
    if (!tagBdExport) return;
    evalJsx(loadDanTagBdJsx() + "dcDanTagBdDemArtboard()", function (res) {
      var text = String(res || ""),
        n = text.indexOf("OK:") === 0 ? parseInt(text.substring(3), 10) : 0;
      if (isNaN(n)) n = 0;
      if (n > 0) tagBdExport.classList.remove("hidden");
      else tagBdExport.classList.add("hidden");
      tagBdCapNhatXemTruoc();
    });
  }
  (function () {
    var tabTagBd = document.querySelector('.tab[data-tab="tagbd"]');
    if (tabTagBd) tabTagBd.addEventListener("click", tagBdCapNhatXuat);
  })();
  if (btnTagBdDan) {
    btnTagBdDan.addEventListener("click", function () {
      if (!tagBdDanhSach.length) {
        show(outTagBd, "Chưa có tag nào trong danh sách. Chọn tag, nhập số lượng rồi bấm Thêm.", "warn");
        return;
      }
      if (!window.DanTagBd || typeof window.DanTagBd.packAsync !== "function") {
        show(outTagBd, "Chưa nạp được lõi ghép khối (js/dan_tag_bd.js).", "warn");
        return;
      }
      var tags = [];
      for (var i = 0; i < tagBdDanhSach.length; i++) {
        var t = tagBdDanhSach[i];
        tags.push({ id: t.id, name: t.name, w: t.w, h: t.h, qty: t.qty });
      }
      tagBdKhoa(true);
      show(outTagBd, "Đang suy nghĩ cách ghép khối…");
      window.DanTagBd.packAsync(
        { tags: tags },
        function (progress) {
          if (progress && progress.total) show(outTagBd, "Đang suy nghĩ… " + progress.done + "/" + progress.total);
        },
        function (result) {
          if (!result || !result.ok) {
            tagBdKhoa(false);
            show(outTagBd, result && result.error ? result.error : "Không ghép được khối.", "warn");
            return;
          }
          show(outTagBd, "Đã tìm xong, đang đóng artboard… " + (result.detail || ""));
          evalJsx(loadDanTagBdJsx() + "dcDanTagBdVe(" + jsStr(JSON.stringify(result)) + ")", function (res) {
            tagBdKhoa(false);
            handleRes(outTagBd, res);
            if (String(res || "").indexOf("OK:") === 0) {
              tagBdDanhSach = [];
              tagBdVeDanhSach();
              tagBdKhoiCuoi = result;
              tagBdCapNhatXuat();
            }
          });
        },
      );
    });
  }
  if (btnTagBdPickFolder) {
    btnTagBdPickFolder.addEventListener("click", function () {
      btnTagBdPickFolder.disabled = true;
      evalJsx(loadDanTagBdJsx() + "dcPickFolder()", function (res) {
        btnTagBdPickFolder.disabled = false;
        var text = String(res || "");
        if (text.indexOf("OK:") === 0) {
          var el = document.getElementById("tbFolder");
          if (el) el.value = text.substring(3);
        }
      });
    });
  }
  if (btnTagBdXuat) {
    btnTagBdXuat.addEventListener("click", function () {
      var opts = {
        prefix: (document.getElementById("tbPrefix") || {}).value || "1088",
        start: (document.getElementById("tbStart") || {}).value || "1",
        pad: (document.getElementById("tbPad") || {}).value || "0",
        canMang: (document.getElementById("tbCanMang") || {}).value || "cm",
        ngay: (document.getElementById("tbNgay") || {}).value || "",
        folder: (document.getElementById("tbFolder") || {}).value || "",
        note: (document.getElementById("tbNote") || {}).value || "",
      };
      show(outTagBdXuat, "Đang xuất PDF…");
      btnTagBdXuat.disabled = true;
      evalJsx(loadDanTagBdJsx() + "dcDanTagBdXuatPdf(" + jsStr(JSON.stringify(opts)) + ")", function (res) {
        btnTagBdXuat.disabled = false;
        handleRes(outTagBdXuat, res);
      });
    });
  }
  tagBdVeDanhSach();
  tagBdCapNhatXemTruoc();

  // ---- Auto Save PDF ----
  var btnAutoSave = document.getElementById("btnAutoSave");
  var outAutoSave = document.getElementById("outAutoSave");
  var asPreview = document.getElementById("asPreview");
  var btnPickFolder = document.getElementById("btnPickFolder");
  var asHopTheoThuTu = document.getElementById("asHopTheoThuTu");

  function asPad0(n, width) {
    var s = String(n);
    while (s.length < width) s = "0" + s;
    return s;
  }
  // Tách "100, 200" -> ["100","200"]; con thứ idx dùng phần tử idx,
  // thiếu thì dùng phần tử cuối.
  function asHopList() {
    var raw = document.getElementById("asHop").value || "";
    var out = [];
    var p = raw.split(",");
    for (var i = 0; i < p.length; i++) {
      var v = p[i].replace(/^\s+|\s+$/g, "");
      if (v !== "") out.push(v);
    }
    if (out.length === 0) out.push("");
    return out;
  }
  function asBuildName(stt, idx) {
    var prefix = document.getElementById("asPrefix").value || "1088";
    var pad = parseInt(document.getElementById("asPad").value, 10);
    if (isNaN(pad)) pad = 0;
    var list = asHopList();
    var hop = idx < list.length ? list[idx] : list[list.length - 1];
    var cm = document.getElementById("asCanMang").value || "cm";
    var ngay = document.getElementById("asNgay").value || "";
    var note = (document.getElementById("asNote").value || "").replace(
      /^\s+|\s+$/g,
      "",
    );
    var sttStr = pad > 0 ? asPad0(stt, pad) : String(stt);
    var notePart = note !== "" ? " - " + note : "";
    return (
      prefix +
      " - " +
      sttStr +
      " - " +
      hop +
      " hop" +
      notePart +
      " - " +
      cm +
      " - " +
      ngay +
      ".pdf"
    );
  }
  function asUpdatePreview() {
    if (!asPreview) return;
    var start = parseInt(document.getElementById("asStart").value, 10);
    if (isNaN(start)) start = 1;
    // Mỗi số hộp = 1 file (cho con đầu tiên). Hiện tối đa 4 dòng.
    var list = asHopList();
    var lines = [];
    var n = Math.min(list.length, 4);
    for (var k = 0; k < n; k++) {
      lines.push(asBuildName(start + k, k));
    }
    if (list.length > 4) lines.push("…");
    else if (list.length === 1) lines.push("(mỗi con card 1 file)");
    asPreview.textContent = lines.join("\n");
  }
  [
    "asPrefix",
    "asStart",
    "asPad",
    "asHop",
    "asNote",
    "asCanMang",
    "asNgay",
  ].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", asUpdatePreview);
      el.addEventListener("change", asUpdatePreview);
    }
  });
  if (asHopTheoThuTu)
    asHopTheoThuTu.addEventListener("change", asUpdatePreview);
  // Lần ĐẦU focus (Tab tới, hoặc click vào ô chưa focus) -> bôi đen hết
  // để gõ đè nhanh. Click LẦN 2 trong ô đang focus -> đặt con trỏ bình
  // thường để sửa giữa chuỗi.
  ["asStart", "asPad", "asHop", "asNote", "asNgay", "asFolder"].forEach(
    attachSelectFirst,
  );
  // Ngày đặt in mặc định = NGÀY hôm nay theo Windows (chỉ số ngày,
  // vd hôm nay 18 -> điền "18"). Người dùng vẫn sửa được.
  (function setNgayHomNay() {
    var elNgay = document.getElementById("asNgay");
    if (elNgay) {
      var d = new Date();
      elNgay.value = String(d.getDate());
    }
  })();

  asUpdatePreview();

  // Nút "Chọn…" -> mở hộp thoại chọn thư mục trong Illustrator.
  if (btnPickFolder) {
    btnPickFolder.addEventListener("click", function () {
      btnPickFolder.disabled = true;
      evalJsx("dcPickFolder()", function (res) {
        btnPickFolder.disabled = false;
        if (res && res.indexOf("OK:") === 0) {
          document.getElementById("asFolder").value = res.substring(3);
        }
        // ERR:huỷ -> không làm gì.
      });
    });
  }

  btnAutoSave.addEventListener("click", function () {
    var prefix = document.getElementById("asPrefix").value || "1088";
    var start = document.getElementById("asStart").value || "1";
    var pad = document.getElementById("asPad").value || "0";
    var hop = document.getElementById("asHop").value || "";
    var cm = document.getElementById("asCanMang").value || "cm";
    var ngay = document.getElementById("asNgay").value || "";
    var folder = document.getElementById("asFolder").value || "";
    var note = document.getElementById("asNote").value || "";
    var hopTheoThuTu = asHopTheoThuTu && asHopTheoThuTu.checked === true;
    show(outAutoSave, "Đang lưu PDF…");
    btnAutoSave.disabled = true;
    var expr =
      "dcAutoSavePDF(" +
      jsStr(prefix) +
      ", " +
      jsStr(start) +
      ", " +
      jsStr(pad) +
      ", " +
      jsStr(hop) +
      ", " +
      jsStr(cm) +
      ", " +
      jsStr(ngay) +
      ", " +
      jsStr(folder) +
      ", " +
      jsStr(note) +
      ", " +
      (hopTheoThuTu ? "true" : "false") +
      ")";
    evalJsx(expr, function (res) {
      btnAutoSave.disabled = false;
      handleRes(outAutoSave, res);
    });
  });
})();
