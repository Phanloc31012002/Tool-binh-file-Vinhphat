// Opt-in native regression. Only creates/changes owned unsaved fixtures.
// Production plan, rasterization, placement, PON and PDF metadata are real;
// only modal answers and icon-file IO are replaced with an isolated vector.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var out = new Folder(root + "/tmp/keo_gay_paper_2.15.20_20261003");
  if (!out.exists) out.create();
  function log(phase) {
    var progress = File(out.fsName + "/phase.txt");
    progress.encoding = "UTF-8";
    progress.open("a");
    progress.writeln(new Date() + " " + phase);
    progress.close();
  }
  var ci = typeof taskKeoCase === "undefined" ? 0 : taskKeoCase;
  var cases = [
    { n: 32, w: 14, h: 20, name: "A5_32", types: ["AB", "AB"] },
    {
      n: 60,
      w: 14,
      h: 20,
      name: "A5_60",
      types: ["AB", "AB", "TT16", "TT8", "TT4"],
    },
    {
      n: 40,
      w: 15,
      h: 21.15,
      name: "A5_allowance_40",
      types: ["AB", "AB", "TT8"],
    },
    {
      n: 48,
      w: 20,
      h: 14,
      name: "A5_sideways_48",
      types: ["AB", "AB", "TT16"],
    },
    { n: 32, w: 21, h: 29.7, name: "A4_32", types: ["AB", "AB", "AB", "AB"] },
    { n: 16, w: 14.8, h: 21, name: "A5_TT16_only", types: ["TT16"] },
    { n: 4, w: 14, h: 20, name: "A5_TT4_only", types: ["TT4"] },
    { n: 4, w: 15, h: 21.15, name: "A5_TT4_max", types: ["TT4"] },
    { n: 4, w: 20, h: 14, name: "A5_TT4_sideways", types: ["TT4"] },
    { n: 8, w: 14.5, h: 20.7, name: "A5_TT8_145_207", types: ["TT8"] },
    {
      n: 12,
      w: 14.5,
      h: 20.7,
      name: "A5_TT8_TT4_145_207",
      types: ["TT8", "TT4"],
    },
  ];
  var spec = cases[ci],
    previous = app.documents.length ? app.activeDocument : null;
  var previousCoordinates = app.coordinateSystem,
    previousInteraction = app.userInteractionLevel;
  var doc = null,
    guard = null,
    previousAlert = alert,
    previousFlatten,
    productionKeo;
  var pages = [],
    initialAngles = [],
    alerts = [],
    report = { name: spec.name, passed: false };
  function read(path) {
    var f = File(path);
    f.encoding = "UTF-8";
    if (!f.open("r")) throw Error("Cannot read " + path);
    var s = f.read();
    f.close();
    return s;
  }
  function bodyRange(source, name) {
    var start = source.indexOf("function " + name + "("),
      open = source.indexOf("{", start);
    if (start < 0) throw Error("Missing substitution " + name);
    var depth = 1,
      state = "code",
      quote;
    for (var i = open + 1; i < source.length; i++) {
      var c = source.charAt(i),
        n = source.charAt(i + 1);
      if (state === "string") {
        if (c === "\\") i++;
        else if (c === quote) state = "code";
      } else if (state === "line") {
        if (c === "\n" || c === "\r") state = "code";
      } else if (state === "block") {
        if (c === "*" && n === "/") {
          i++;
          state = "code";
        }
      } else if (c === '"' || c === "'") {
        state = "string";
        quote = c;
      } else if (c === "/" && n === "/") {
        i++;
        state = "line";
      } else if (c === "/" && n === "*") {
        i++;
        state = "block";
      } else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return { open: open, close: i };
    }
    throw Error("Unbalanced function " + name);
  }
  function replaceBody(source, name, body) {
    var r = bodyRange(source, name);
    return source.substring(0, r.open + 1) + body + source.substring(r.close);
  }
  function json(v) {
    if (v === null || typeof v === "undefined") return "null";
    if (typeof v === "string")
      return (
        '"' +
        v
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\r/g, "\\r")
          .replace(/\n/g, "\\n") +
        '"'
      );
    if (typeof v !== "object") return String(v);
    var parts = [],
      i;
    if (v instanceof Array) {
      for (i = 0; i < v.length; i++) parts.push(json(v[i]));
      return "[" + parts.join(",") + "]";
    }
    for (i in v)
      if (v.hasOwnProperty(i)) parts.push(json(i) + ":" + json(v[i]));
    return "{" + parts.join(",") + "}";
  }
  function assert(value, message) {
    if (!value) throw Error(message);
  }
  function bounds(it) {
    var b = it.geometricBounds;
    return [b[0], b[1], b[2], b[3]];
  }
  function inside(r, b) {
    return (
      b[0] >= r[0] - 0.05 &&
      b[1] <= r[1] + 0.05 &&
      b[2] <= r[2] + 0.05 &&
      b[3] >= r[3] - 0.05
    );
  }
  function numbers(f) {
    var result = [],
      i;
    if (f.blocks) {
      for (i = 0; i < f.blocks.length; i++)
        result = result.concat(f.blocks[i].top, f.blocks[i].bottom);
    } else result = f.row || f.top.concat(f.bottom);
    return result;
  }
  try {
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    if (!previous) guard = app.documents.add(DocumentColorSpace.CMYK, 100, 100);
    eval(read(root + "/DanCardCEP/jsx/dan_card_lib.jsx"));
    log("LOAD v" + dcKeoGayAutoPonVersion + " " + spec.name);
    previousFlatten = dcFlattenForImposition;
    dcFlattenForImposition = function (d, item, frame, dpi) {
      var page = parseInt(item.name.replace("SOURCE_PAGE_", ""), 10);
      var flat = previousFlatten(d, item, frame, dpi);
      flat.name = "KEO_TEST_PAGE_" + page;
      pages[page - 1] = flat;
      initialAngles[page - 1] =
        (Math.atan2(flat.matrix.mValueB, flat.matrix.mValueA) * 180) / Math.PI;
      return flat;
    };
    alert = function (text) {
      alerts.push(String(text));
    };
    productionKeo = dcRunKeoGay;
    var functionSource = dcRunKeoGay.toString();
    functionSource = replaceBody(
      functionSource,
      "showNoteDialog",
      'return {ab:"AB TEST",tt16:"TT16 TEST",tt8:"TT8 TEST",tt4:"TT4 TEST"};',
    );
    functionSource = replaceBody(
      functionSource,
      "loadNoteIconTemplate",
      'var icon = artworkLayer.pathItems.ellipse(0,0,7,7); icon.name="_Mau icon ghi chu CTL Keo Gay"; icon.hidden=true; return icon;',
    );
    eval(functionSource);
    doc = app.documents.add(DocumentColorSpace.CMYK, 600, 500);
    doc.artboards[0].name = "KEO_OLD_SOURCE";
    var keep = doc.pathItems.rectangle(200, -200, 20, 20),
      keepBounds = bounds(keep);
    for (var pi = 0; pi < spec.n; pi++) {
      var x = 100 + (pi % 8) * 100,
        y = 600 - Math.floor(pi / 8) * 250;
      var g = doc.groupItems.add();
      g.name = "SOURCE_PAGE_" + (pi + 1);
      var path = g.pathItems.rectangle(y, x, 60, 90);
      path.stroked = false;
      path.filled = true;
      var ink = new CMYKColor();
      ink.cyan = pi < 16 ? 10 : 60;
      ink.magenta = pi % 2 ? 10 : 35;
      ink.yellow = 5;
      ink.black = 0;
      path.fillColor = ink;
      var label = g.textFrames.add();
      label.contents = String(pi + 1) + " TOP";
      label.textRange.characterAttributes.size = 12;
      label.position = [x + 2, y - 4];
    }
    doc.selection = null;
    for (var gi = 0; gi < doc.groupItems.length; gi++)
      doc.groupItems[gi].selected = true;
    // Exercise coordinate normalisation with a non-document user mode.
    app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
    var status = dcRunKeoGay(String(spec.w), String(spec.h));
    log("RENDER " + status);
    assert(
      app.coordinateSystem === CoordinateSystem.ARTBOARDCOORDINATESYSTEM,
      "Coordinate mode was not restored",
    );
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    assert(status.indexOf("OK:") === 0, status);
    doc.activate();
    var small =
      Math.min(spec.w, spec.h) <= 15 && Math.max(spec.w, spec.h) <= 21.15;
    var faces = dcKeoGayPlan(spec.n, small),
      rects = [],
      captures = [];
    assert(
      doc.artboards.length === spec.types.length,
      "Unexpected artboard count",
    );
    assert(
      json(bounds(keep)) === json(keepBounds),
      "Unselected artwork changed",
    );
    for (var bi = 0; bi < faces.length; bi++) {
      assert(faces[bi].type === spec.types[bi], "Unexpected form order");
      var r = doc.artboards[bi].artboardRect;
      rects.push([r[0], r[1], r[2], r[3]]);
      var MM = 2.834645669;
      var tt8Small =
        faces[bi].smallSelfTurn &&
        Math.min(spec.w, spec.h) * 40 * MM + 4 * MM + 1 <= 648 * MM &&
        Math.max(spec.w, spec.h) * 20 * MM + 1 <= 418 * MM;
      var paperSize = [858, 638];
      if (faces[bi].type === "TT4") {
        if (small) paperSize = [428, 313];
        else paperSize = [648, 418];
      } else if (tt8Small) paperSize = [648, 418];
      assert(
        Math.abs(r[2] - r[0] - paperSize[0] * MM) < 0.05 &&
          Math.abs(r[1] - r[3] - paperSize[1] * MM) < 0.05,
        "Wrong physical paper size: " +
          (r[2] - r[0]) +
          "x" +
          (r[1] - r[3]) +
          " vs " +
          paperSize.join("x") +
          "mm; scale=" +
          MM +
          "; small=" +
          small,
      );
      var ns = numbers(faces[bi]);
      var packed = faces[bi].blocks
        ? dcKeoGayPackedGrid(
            faces[bi],
            Math.min(spec.w, spec.h) * 10 * 2.834645669,
            Math.max(spec.w, spec.h) * 10 * 2.834645669,
            r,
            23.7 * 2.834645669,
          )
        : null;
      for (var ni = 0; ni < ns.length; ni++) {
        var item = pages[ns[ni] - 1];
        assert(!!item, "Missing page " + ns[ni]);
        assert(inside(r, bounds(item)), "Page outside paper " + ns[ni]);
        if (packed) {
          var cell = packed.cells[ni];
          var expectedAngle =
            initialAngles[ns[ni] - 1] + cell.angle + (spec.w > spec.h ? 90 : 0);
          var actualAngle =
            (Math.atan2(item.matrix.mValueB, item.matrix.mValueA) * 180) /
            Math.PI;
          var delta =
            ((((actualAngle - expectedAngle) % 360) + 540) % 360) - 180;
          assert(Math.abs(delta) < 0.01, "Raster rotation mismatch " + ns[ni]);
        }
        captures.push({ page: ns[ni], face: bi, bounds: bounds(item) });
      }
    }
    // Native PON endpoints, including stroke bounds, must remain on paper;
    // no cut-mark midpoint may be inside the interior of a raster page.
    var marks = doc.layers.getByName("Pon cat CTL Keo Gay tu dong").pathItems;
    var paperMarks = doc.layers.getByName("Pon CTL Keo Gay tu dong").pathItems;
    assert(paperMarks.length === faces.length * 8, "Paper PON count mismatch");
    for (bi = 0; bi < faces.length; bi++) {
      var corners = [
        [rects[bi][0], rects[bi][1]],
        [rects[bi][2], rects[bi][1]],
        [rects[bi][0], rects[bi][3]],
        [rects[bi][2], rects[bi][3]],
      ];
      for (var corner = 0; corner < corners.length; corner++) {
        var hits = 0;
        for (var pm = 0; pm < paperMarks.length; pm++) {
          var endpoints = paperMarks[pm].pathPoints;
          for (var pe = 0; pe < endpoints.length; pe++) {
            var anchor = endpoints[pe].anchor;
            if (
              Math.abs(anchor[0] - corners[corner][0]) < 0.01 &&
              Math.abs(anchor[1] - corners[corner][1]) < 0.01
            ) {
              hits++;
              break;
            }
          }
        }
        assert(hits === 2, "Paper PON not centred on paper corner");
      }
      if (faces[bi].blocks) {
        var splitGrid = dcKeoGayPackedGrid(
          faces[bi],
          Math.min(spec.w, spec.h) * 10 * MM,
          Math.max(spec.w, spec.h) * 10 * MM,
          rects[bi],
          23.7 * MM,
        );
        for (var split = 1; split <= 3; split += 2)
          for (var edge = 0; edge < 2; edge++) {
            var sx = splitGrid.left + (split * splitGrid.width) / 4,
              sy = edge ? splitGrid.top - splitGrid.height : splitGrid.top;
            var splitHits = 0;
            for (var cm = 0; cm < marks.length; cm++) {
              var cp0 = marks[cm].pathPoints[0].anchor,
                cp1 = marks[cm].pathPoints[1].anchor;
              if (
                Math.abs(cp0[0] - sx) < 0.01 &&
                Math.abs(cp1[0] - sx) < 0.01 &&
                (Math.abs(cp0[1] - sy) < 0.01 || Math.abs(cp1[1] - sy) < 0.01)
              )
                splitHits++;
            }
            assert(
              splitHits === 1,
              "Missing quarter cut mark splitting two-page panels",
            );
          }
      }
    }
    for (var mi = 0; mi < marks.length; mi++) {
      var mark = marks[mi],
        mb = mark.visibleBounds,
        onPaper = false;
      for (bi = 0; bi < rects.length; bi++)
        if (inside(rects[bi], mb)) onPaper = true;
      assert(onPaper, "Crop mark outside paper");
      var p0 = mark.pathPoints[0].anchor,
        p1 = mark.pathPoints[1].anchor;
      var mx = (p0[0] + p1[0]) / 2,
        my = (p0[1] + p1[1]) / 2;
      for (var pr = 0; pr < pages.length; pr++) {
        var pb = bounds(pages[pr]);
        assert(
          !(
            mx > pb[0] + 0.02 &&
            mx < pb[2] - 0.02 &&
            my < pb[1] - 0.02 &&
            my > pb[3] + 0.02
          ),
          "Crop mark crosses page artwork",
        );
      }
    }
    for (var ai = 0; ai + 1 < faces.length; ai += 2) {
      if (faces[ai].type !== "AB") break;
      var ar = rects[ai],
        br = rects[ai + 1],
        pp = numbers(faces[ai]);
      for (var pn = 0; pn < pp.length; pn++) {
        var p = pp[pn],
          mate = p % 2 ? p + 1 : p - 1;
        var ab = bounds(pages[p - 1]),
          bb = bounds(pages[mate - 1]);
        var ax = (ab[0] + ab[2]) / 2 - ar[0],
          bx = (bb[0] + bb[2]) / 2 - br[0];
        assert(
          Math.abs(ax + bx - (ar[2] - ar[0])) < 0.08 &&
            Math.abs(ab[1] + ab[3] - bb[1] - bb[3]) < 0.1,
          "AB opposite page mismatch " + p,
        );
      }
    }
    var noteCount = 0;
    for (var ti = 0; ti < doc.textFrames.length; ti++) {
      var text = doc.textFrames[ti];
      if (text.contents.indexOf("RUỘT ") !== 0) continue;
      var contained = false;
      for (bi = 0; bi < rects.length; bi++)
        if (inside(rects[bi], text.visibleBounds)) contained = true;
      assert(contained, "Note outside paper");
      noteCount++;
      var nb = text.visibleBounds;
      for (var pageNote = 0; pageNote < pages.length; pageNote++) {
        var pageBounds = bounds(pages[pageNote]);
        assert(
          !(
            nb[0] < pageBounds[2] - 0.05 &&
            nb[2] > pageBounds[0] + 0.05 &&
            nb[1] > pageBounds[3] + 0.05 &&
            nb[3] < pageBounds[1] - 0.05
          ),
          "Note overlaps page artwork",
        );
      }
    }
    assert(
      noteCount === faces.length - Math.floor(spec.n / (small ? 32 : 16)),
      "Missing/extra note: " + noteCount + "/" + faces.length,
    );
    var pdfPlan = eval("(" + status.split("||CTLPDF:")[1] + ")");
    assert(pdfPlan.total === faces.length, "PDF metadata count mismatch");
    report = {
      name: spec.name,
      passed: true,
      status: status,
      types: spec.types,
      artboards: rects,
      cutMarks: marks.length,
      paperMarks: paperMarks.length,
      notes: noteCount,
      pages: captures,
      alerts: alerts,
    };
    var imageRect = [rects[0][0], rects[0][1], rects[0][2], rects[0][3]];
    for (bi = 1; bi < rects.length; bi++) {
      imageRect[0] = Math.min(imageRect[0], rects[bi][0]);
      imageRect[1] = Math.max(imageRect[1], rects[bi][1]);
      imageRect[2] = Math.max(imageRect[2], rects[bi][2]);
      imageRect[3] = Math.min(imageRect[3], rects[bi][3]);
    }
    var captureOptions = new ImageCaptureOptions();
    captureOptions.resolution = 72;
    captureOptions.antiAliasing = true;
    doc.imageCapture(
      File(out.fsName + "/" + spec.name + ".png"),
      imageRect,
      captureOptions,
    );
  } catch (error) {
    report.passed = false;
    report.error = String(error);
    report.line = error.line;
    report.alerts = alerts;
    report.status = status;
  } finally {
    if (previousFlatten) dcFlattenForImposition = previousFlatten;
    if (productionKeo) dcRunKeoGay = productionKeo;
    alert = previousAlert;
    if (doc) {
      doc.activate();
      doc.close(SaveOptions.DONOTSAVECHANGES);
    }
    if (previous) previous.activate();
    app.coordinateSystem = previousCoordinates;
    app.userInteractionLevel = previousInteraction;
  }
  var resultFile = File(out.fsName + "/" + spec.name + ".json");
  resultFile.encoding = "UTF-8";
  resultFile.open("w");
  resultFile.write(json(report));
  resultFile.close();
  if (guard) guard.close(SaveOptions.DONOTSAVECHANGES);
  return json({ name: spec.name, passed: report.passed, error: report.error });
})();
