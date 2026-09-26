/* main.js — Công cụ bình: Dàn file (Card+Decal), Đổi tên, Variable. */
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
      var base = 0.45 + Math.random() * 0.5; // 0.45..0.95 of span
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
  var TESTER_DEFAULT =
    '<span class="tan-battle">' +
    '<canvas class="battle-fx" aria-hidden="true"></canvas>' +
    '<span class="saitama" aria-hidden="true">' +
    '<svg viewBox="0 0 60 80" width="100%" height="100%">' +
    '<path class="s-cape" d="M22 26 C10 34 6 52 12 66 C18 58 24 56 30 56 L28 30 Z" fill="#f4f6f7"/>' +
    '<rect x="26" y="54" width="6" height="20" rx="3" fill="#e2564b"/>' +
    '<rect x="34" y="54" width="6" height="20" rx="3" fill="#c9463c"/>' +
    '<path class="s-torso" d="M24 30 q9 -5 18 0 l-2 26 q-7 4 -14 0 Z" fill="#f4d03f"/>' +
    '<rect x="24" y="50" width="18" height="4" rx="1.5" fill="#8a6d1e"/>' +
    '<rect x="31" y="22" width="4" height="6" fill="#f6c9a0"/>' +
    '<circle cx="33" cy="16" r="9" fill="#f6c9a0"/>' +
    '<circle cx="30" cy="16" r="1.2" fill="#20303a"/>' +
    '<circle cx="37" cy="16" r="1.2" fill="#20303a"/>' +
    '<path d="M29 20 q4 2 8 0" stroke="#c98d63" stroke-width="1" fill="none" stroke-linecap="round"/>' +
    '<rect x="22" y="32" width="5" height="12" rx="2.5" fill="#f4d03f" transform="rotate(24 24 34)"/>' +
    '<g class="s-arm-g">' +
    '<rect x="40" y="33" width="16" height="5" rx="2.5" fill="#f4d03f"/>' +
    '<circle cx="57" cy="35" r="5" fill="#e2564b"/>' +
    '<circle cx="57" cy="35" r="5" fill="none" stroke="#b83d34" stroke-width="1"/>' +
    "</g>" +
    "</svg>" +
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
  // ===== SAITAMA đấm chữ "Tân 1 cú" — engine (canvas fire+nổ, đi/gồng/đấm) =====
  var saiRAF = null,
    saiGen = 0;
  function stopSaitamaBattle() {
    saiGen++;
    if (saiRAF !== null) {
      window.cancelAnimationFrame(saiRAF);
      saiRAF = null;
    }
  }
  function startSaitamaBattle() {
    if (!testerName) return;
    var root = testerName.querySelector(".tan-battle");
    if (!root) return;
    var cv = root.querySelector(".battle-fx");
    var sai = root.querySelector(".saitama");
    var word = root.querySelector(".tan-word");
    var units = root.querySelectorAll(".shatter-unit");
    if (!cv || !cv.getContext || !sai || !word || !units.length) return;
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

    var gen = saiGen,
      CYCLE = 10000,
      start = 0;
    var lastSaiDraw = 0,
      SAI_FRAME_MS = 1000 / 30,
      saiIdle = false;
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

    var punched = false;
    function reset() {
      punched = false;
      sparks.length = flames.length = smoke.length = 0;
      flash = 0;
      shake = 0;
      crackPaths = [];
      crackChips = [];
      shockWaves = [];
      word.style.transform = "none";
      sai.className = "saitama";
      sai.style.transform = "scaleX(-1) translateX(-70px)";
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

    // mốc (ms)
    var T_IN = 2200; // đi vào tới cạnh chữ
    var T_WIND = 2400; // bắt đầu gồng (fire)
    var T_PUNCH = 3600; // đấm -> nổ
    var T_SCATTER = 3600,
      T_SCATTER_END = 4400; // mảnh bay ra
    var T_HOLD = 5200; // mảnh lơ lửng
    var T_BACK0 = 5400,
      T_BACK1 = 7000; // mảnh bay về
    var T_OUT0 = 4200,
      T_OUT1 = 6200; // saitama lùi ra
    var SAI_STOP = 0; // vị trí đứng cạnh chữ (px transform)
    var SAI_HIDE = -70;

    function clamp(v, a, b) {
      return v < a ? a : v > b ? b : v;
    }
    function easeOut(p) {
      return 1 - Math.pow(1 - p, 3);
    }
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
      if (gen !== saiGen) return;
      if (!start) {
        start = now;
        lastSaiDraw = now - SAI_FRAME_MS;
      }
      var t = (now - start) % CYCLE;
      // Khi cảnh đã xong, chỉ chờ chu kỳ mới thay vì liên tục vẽ canvas rỗng.
      if (t >= T_BACK1 + 100) {
        if (!saiIdle) {
          ctx.clearRect(0, 0, W, H);
          saiIdle = true;
        }
        saiRAF = window.requestAnimationFrame(loop);
        return;
      }
      saiIdle = false;
      if (now - lastSaiDraw >= SAI_FRAME_MS) {
        lastSaiDraw = now;
        if (t < 200 && punched) reset();
        measure();
        draw(t);
      }
      saiRAF = window.requestAnimationFrame(loop);
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      // ---- Saitama đi vào / lùi ra ----
      var sx;
      if (t < T_IN) sx = SAI_HIDE + easeOut(t / T_IN) * (SAI_STOP - SAI_HIDE);
      else if (t < T_OUT0) sx = SAI_STOP;
      else if (t < T_OUT1) {
        var q = (t - T_OUT0) / (T_OUT1 - T_OUT0);
        sx = SAI_STOP + q * q * (SAI_HIDE - SAI_STOP);
      } else sx = SAI_HIDE;
      sai.style.transform = "scaleX(-1) translateX(" + sx.toFixed(1) + "px)";

      // ---- pose: gồng (wind+fire) -> đấm (punch+nổ) ----
      var cls = "saitama";
      if (t >= T_WIND && t < T_PUNCH) cls = "saitama wind";
      else if (t >= T_PUNCH && t < T_PUNCH + 260) cls = "saitama punch";
      if (sai.className !== cls) sai.className = cls;

      // lửa gồng: quanh nắm đấm của saitama (bên phải cụm chữ)
      if (t >= T_WIND && t < T_PUNCH) {
        var fx = target.x + word.offsetWidth * 0.5 + 4;
        var fy = target.y + 2;
        if (flames.length < 14 && Math.random() < 0.55) addFlame(fx, fy, false);
      }

      // ---- đấm trúng -> nổ + mạng kính vỡ + giật mạnh ----
      if (!punched && t >= T_PUNCH) {
        punched = true;
        addExplosion(target.x, target.y);
        makeGlassCracks(target.x, target.y);
        flash = 1.3;
        shake = 1.4;
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
    }

    saiRAF = window.requestAnimationFrame(loop);
  }

  function updateTester(tabKey) {
    if (!testerName) return;
    stopTesterLightning();
    stopSaitamaBattle();
    testerName.innerHTML = tabKey === "offset" ? TESTER_OFFSET : TESTER_DEFAULT;
    if (tabKey !== "offset") {
      startTesterLightning();
      startSaitamaBattle();
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

  // ---- accordion (Card / Decal) ----
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
  function loadDanToiUuJsx() {
    // CEP co the giu ExtendScript engine cu sau khi cai thu panel. Nạp lại khi
    // chưa có, hoặc khi engine vẫn giữ bộ tính Dàn tối ưu phiên bản cũ.
    try {
      var extensionRoot = cs
        .getSystemPath(SystemPath.EXTENSION)
        .replace(/\\/g, "/");
      var jsxPath = extensionRoot + "/jsx/dan_card_lib.jsx";
      return (
        "if (typeof dcDanToiUu !== 'function' || typeof dcDanToiUuVersion === 'undefined' || dcDanToiUuVersion < 9) { $.evalFile(" +
        jsStr(jsxPath) +
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
  function handleRes(el, res) {
    if (res === "EvalScript error." || res === undefined || res === "")
      show(el, "Lỗi gọi ExtendScript.", "warn");
    else if (res.indexOf("ERR:") === 0)
      show(el, res.substring(4).replace(/^\s+/, ""), "warn");
    else if (res.indexOf("OK:") === 0)
      showOkWithWarn(el, res.substring(3).replace(/^\s+/, ""));
    else show(el, res, "ok");
  }
  function showDanToiUuResult(res) {
    if (res === "EvalScript error." || res === undefined || res === "") {
      show(outDanToiUu, "Lỗi gọi ExtendScript.", "warn");
      return;
    }
    if (res.indexOf("ERR:") === 0) {
      show(outDanToiUu, res.substring(4).replace(/^\s+/, ""), "warn");
      return;
    }
    if (res.indexOf("OK:") !== 0) {
      show(outDanToiUu, res, "ok");
      return;
    }

    var message = res.substring(3).replace(/^\s+/, "");
    var match = /^\[\[COUNT:(\d+)\]\]\s*/.exec(message);
    if (!match) {
      showOkWithWarn(outDanToiUu, message);
      return;
    }
    var safe = message
      .substring(match[0].length)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    outDanToiUu.className = "out ok";
    outDanToiUu.innerHTML =
      '<strong class="optimal-capacity">' +
      match[1] +
      " con / tờ</strong><br>" +
      safe;
    fitOut(outDanToiUu);
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
      cs.evalScript(
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
    cs.evalScript(expr, function (res) {
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
      cs.evalScript(
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
          throw new Error("preview tong co kich thuoc khong hop le.");
        function readNextBatch() {
          try {
            var end = Math.min(regions.length, index + 24);
            for (; index < end; index++) {
              var region = regions[index];
              if (!region || region.length !== 4)
                throw new Error("khung preview " + (index + 1) + " khong hop le.");
              var rx = Number(region[0]),
                ry = Number(region[1]),
                rw = Number(region[2]),
                rh = Number(region[3]);
              if (!isFinite(rx) || !isFinite(ry) || !(rw > 0) || !(rh > 0))
                throw new Error("khung preview " + (index + 1) + " khong hop le.");
              var sx = Math.max(0, Math.floor(rx * imageW)),
                sy = Math.max(0, Math.floor(ry * imageH)),
                ex = Math.min(imageW, Math.ceil((rx + rw) * imageW)),
                ey = Math.min(imageH, Math.ceil((ry + rh) * imageH));
              if (!(ex > sx) || !(ey > sy))
                throw new Error("khung preview " + (index + 1) + " nam ngoai anh tong.");
              signals.push(sheetSignal(image, sx, sy, ex - sx, ey - sy));
            }
            if (index < regions.length) setTimeout(readNextBatch, 0);
            else done(signals);
          } catch (err) {
            fail("Khong doc duoc preview tong: " + err);
          }
        }
        readNextBatch();
      } catch (err) {
        fail("Khong doc duoc preview tong: " + err);
      }
    };
    image.onerror = function () {
      fail("Khong mo duoc preview tong: " + path);
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
        // The user-selected reference slot is the only 0-degree baseline.
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
          fail("Khong co preview tong de hoc huong artwork.");
          return;
        }
        if (
          !isFinite(referenceIndex) ||
          referenceIndex < 0 ||
          referenceIndex >= signals.length
        ) {
          fail("Con mau chuan khong khop du lieu preview tong.");
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
      cs.evalScript("dcXoaPreviewMau(" + jsStr(paths.join("|")) + ")");
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
      cs.evalScript("dcHocMau()", function (res) {
        if (res && res.indexOf("PENDING_SHEET:") === 0) {
          var sheetData = res.substring(14).split("|");
          var sheetTag = sheetData.shift();
          var sheetPath = sheetData.shift();
          var regions = parseSheetRegions(sheetData.join("|"));
          if (!sheetTag || !sheetPath || !regions) {
            btnHocMau.disabled = false;
            show(outHocMau, "Preview tổng không hợp lệ. Hãy thử Học mẫu lại.", "warn");
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
            "Chọn đúng 1 con mẫu cùng chiều với con nguồn trong Illustrator, rồi bấm Xác nhận con chuẩn.",
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
            "Chọn đúng 1 con mẫu cùng chiều với con nguồn trong Illustrator, rồi bấm Xác nhận con chuẩn.",
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
      cs.evalScript(
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
            show(outHocMau, "Không xác định được con chuẩn. Hãy chọn lại.", "warn");
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
              cs.evalScript(expr, function (finalRes) {
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
      cs.evalScript(
        "dcApMau(" + (useMultiSource ? "true" : "false") + ")",
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
      cs.evalScript(
        "dcLuuDanTheoMauPDF(" +
          jsStr(mode) +
          ", " +
          jsStr(suffix) +
          ")",
        function (res) {
          btnSaveDanMau.disabled = false;
          handleRes(outSaveDanMau, res);
        },
      );
    });
  }

  // ---- Raster object đang chọn ----
  // Luôn xác nhận khung card, clip một lần ở ngoài rồi mới raster.
  function rasterizeSelectionInHost() {
    try {
      if (app.documents.length === 0) return "ERR: Chưa mở tài liệu nào.";

      var doc = app.activeDocument;
      var selection = doc.selection;
      if (!selection || selection.length === 0)
        return "ERR: Hãy chọn ít nhất 1 object để raster.";
      if (doc.documentColorSpace !== DocumentColorSpace.CMYK)
        return "ERR: Tài liệu đang ở RGB. Hãy đổi File > Document Color Mode > CMYK Color rồi bấm Raster.";

      var options = new RasterizeOptions();
      options.resolution = 450;
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
        " object theo khung card — CMYK, 450 ppi, nền trong suốt."
      );
    } catch (e) {
      return "ERR: " + e;
    }
  }
  var btnRaster = document.getElementById("btnRaster");
  btnRaster.addEventListener("click", function () {
    btnRaster.disabled = true;
    btnRaster.textContent = "Đang raster…";
    cs.evalScript(
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
        cs.evalScript(expr, function (res) {
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

  // ---- Clip theo KT (nút Clip cạnh Raster) ----
  var btnClip = document.getElementById("btnClip");
  var clipPopover = document.getElementById("clipPopover");
  var clipOk = document.getElementById("clipOk");
  var clipCancel = document.getElementById("clipCancel");
  var clipMsg = document.getElementById("clipMsg");
  if (btnClip && clipPopover) {
    ["clipW", "clipH"].forEach(attachSelectFirst);
    btnClip.addEventListener("click", function () {
      if (resizePopover) resizePopover.classList.add("hidden");
      clipPopover.classList.toggle("hidden");
      if (!clipPopover.classList.contains("hidden")) {
        if (clipMsg) clipMsg.textContent = "";
        var w = document.getElementById("clipW");
        if (w) {
          w.focus();
          w.select();
        }
      }
    });
    if (clipCancel)
      clipCancel.addEventListener("click", function () {
        clipPopover.classList.add("hidden");
      });
    if (clipOk)
      clipOk.addEventListener("click", function () {
        var wv = document.getElementById("clipW").value || "";
        var hv = document.getElementById("clipH").value || "";
        var uv = document.getElementById("clipUnit").value || "cm";
        if (clipMsg) clipMsg.textContent = "Đang clip…";
        clipOk.disabled = true;
        var expr =
          "dcClipToSize(" +
          jsStr(wv) +
          ", " +
          jsStr(hv) +
          ", " +
          jsStr(uv) +
          ")";
        cs.evalScript(expr, function (res) {
          clipOk.disabled = false;
          if (!clipMsg) return;
          if (res && res.indexOf("OK:") === 0) {
            clipMsg.textContent = res.substring(3).replace(/^\s+/, "");
            setTimeout(function () {
              clipPopover.classList.add("hidden");
            }, 900);
          } else if (res && res.indexOf("ERR:") === 0) {
            clipMsg.textContent = res.substring(4).replace(/^\s+/, "");
          } else {
            clipMsg.textContent = "Lỗi gọi ExtendScript.";
          }
        });
      });
  }

  // ---- Dàn Decal ----
  var btnDecal = document.getElementById("btnDecal");
  var outDecal = document.getElementById("outDecal");
  btnDecal.addEventListener("click", function () {
    var ponSize = "33x35.4",
      pc = document.querySelector('input[name="decalPon"]:checked');
    if (pc) ponSize = pc.value;
    var decalSize = "6",
      dc = document.querySelector('input[name="decalSize"]:checked');
    if (dc) decalSize = dc.value;
    show(outDecal, "Đang dàn decal…");
    btnDecal.disabled = true;
    cs.evalScript(
      "dcDanDecal(" + jsStr(decalSize) + ", " + jsStr(ponSize) + ")",
      function (res) {
        btnDecal.disabled = false;
        handleRes(outDecal, res);
      },
    );
  });

  // ---- Dàn Catalogue ----
  var outCatalogue = document.getElementById("outCatalogue");

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
    cs.evalScript(expr, function (res) {
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
        show(outCatalogue, "Nhập kích thước hợp lệ (rộng × cao, cm).", "warn");
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
        show(outCatalogue, "Nhập kích thước hợp lệ (rộng × cao, cm).", "warn");
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
  var btnOffset = document.getElementById("btnOffset");
  var outOffset = document.getElementById("outOffset");
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
      "dcRunSignature8(" +
      jsStr(w) +
      ", " +
      jsStr(h) +
      ", " +
      (coBia ? "true" : "false") +
      ")";
    cs.evalScript(expr, function (res) {
      btnOffset.disabled = false;
      handleRes(outOffset, res);
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
    var expr = "dcRunKeoGay(" + jsStr(w) + ", " + jsStr(h) + ")";
    cs.evalScript(expr, function (res) {
      btnKeo.disabled = false;
      handleRes(outOffset, res);
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
    cs.evalScript(expr, function (res) {
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
    cs.evalScript("dcRunVariable()", function (res) {
      btnVariable.disabled = false;
      handleRes(outVariable, res);
    });
  });

  // ---- Auto Save PDF ----
  var btnAutoSave = document.getElementById("btnAutoSave");
  var outAutoSave = document.getElementById("outAutoSave");
  var asPreview = document.getElementById("asPreview");
  var btnPickFolder = document.getElementById("btnPickFolder");
  var asHopTheoThuTu = document.getElementById("asHopTheoThuTu");

  // ---- Clip nhanh 9.2×5.6 (trong tab Auto Save) ----
  var btnClipCard = document.getElementById("btnClipCard");
  var outClipCard = document.getElementById("outClipCard");
  if (btnClipCard) {
    btnClipCard.addEventListener("click", function () {
      if (outClipCard) outClipCard.textContent = "Đang clip 9.2×5.6…";
      btnClipCard.disabled = true;
      cs.evalScript("dcClipCard926()", function (res) {
        btnClipCard.disabled = false;
        if (!outClipCard) return;
        if (res && res.indexOf("OK:") === 0)
          outClipCard.textContent = res.substring(3).replace(/^\s+/, "");
        else if (res && res.indexOf("ERR:") === 0)
          outClipCard.textContent = res.substring(4).replace(/^\s+/, "");
        else outClipCard.textContent = "Lỗi gọi ExtendScript.";
      });
    });
  }

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
  if (asHopTheoThuTu) asHopTheoThuTu.addEventListener("change", asUpdatePreview);
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
      cs.evalScript("dcPickFolder()", function (res) {
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
    cs.evalScript(expr, function (res) {
      btnAutoSave.disabled = false;
      handleRes(outAutoSave, res);
    });
  });
})();
