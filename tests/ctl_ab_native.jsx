// Test hồi quy trong Illustrator cho giấy AB rút ngắn, chỉ chạy khi chủ động bật. Chỉ sửa các
// tài liệu tự dựng của riêng test; code engine/raster/lưới/PON/ghi chú thật đều được chạy.
// Câu trả lời hộp thoại modal và việc đọc/ghi file icon ngoài dùng dữ liệu mẫu cô lập, tất định.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var ci = typeof taskCtlABCase === "undefined" ? 0 : Number(taskCtlABCase);
  var spec =
    ci === 0
      ? { n: 16, w: 21.2, h: 30, name: "STAPLE_A4_AB" }
      : { n: 32, w: 15, h: 21.15, name: "STAPLE_A5_AB" };
  var MM = 2.834645669;
  var out = new Folder(root + "/tmp/ctl_ab_2.16.4_" + new Date().getTime());
  if (!out.exists) out.create();
  var previous = app.documents.length ? app.activeDocument : null;
  var oldCoordinates = app.coordinateSystem,
    oldInteraction = app.userInteractionLevel;
  var oldAlert = alert,
    oldFlatten,
    productionSignature,
    doc = null;
  var pages = [],
    messages = [],
    report = { name: spec.name, passed: false };
  function read(path) {
    var f = File(path);
    f.encoding = "UTF-8";
    if (!f.open("r")) throw Error("Cannot read " + path);
    var text = f.read();
    f.close();
    return text;
  }
  function json(value) {
    if (value === null || typeof value === "undefined") return "null";
    if (typeof value === "string")
      return (
        '"' +
        value
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\r/g, "\\r")
          .replace(/\n/g, "\\n") +
        '"'
      );
    if (typeof value !== "object") return String(value);
    var parts = [],
      key;
    if (value instanceof Array) {
      for (key = 0; key < value.length; key++) parts.push(json(value[key]));
      return "[" + parts.join(",") + "]";
    }
    for (key in value)
      if (value.hasOwnProperty(key))
        parts.push(json(key) + ":" + json(value[key]));
    return "{" + parts.join(",") + "}";
  }
  function snapshot() {
    var result = [];
    for (var i = 0; i < app.documents.length; i++) {
      var d = app.documents[i],
        rects = [];
      for (var j = 0; j < d.artboards.length; j++) {
        var r = d.artboards[j].artboardRect;
        rects.push([d.artboards[j].name, r[0], r[1], r[2], r[3]]);
      }
      result.push({
        name: d.name,
        saved: d.saved,
        layers: d.layers.length,
        items: d.pageItems.length,
        boards: rects,
        selected: d.selection ? d.selection.length : 0,
      });
    }
    return json(result);
  }
  function replaceBody(source, name, body) {
    var start = source.indexOf("function " + name + "(");
    if (start < 0) throw Error("Missing helper " + name);
    var open = source.indexOf("{", start),
      depth = 1,
      state = "code",
      quote;
    for (var i = open + 1; i < source.length; i++) {
      var c = source.charAt(i),
        n = source.charAt(i + 1);
      if (state === "string") {
        if (c === "\\") i++;
        else if (c === quote) state = "code";
      } else if (state === "line") {
        if (c === "\r" || c === "\n") state = "code";
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
      else if (c === "}" && --depth === 0)
        return source.substring(0, open + 1) + body + source.substring(i);
    }
    throw Error("Unbalanced helper " + name);
  }
  function assert(ok, message) {
    if (!ok) throw Error(message);
  }
  function copy(b) {
    return [b[0], b[1], b[2], b[3]];
  }
  function inside(rect, b) {
    return (
      b[0] >= rect[0] - 0.05 &&
      b[2] <= rect[2] + 0.05 &&
      b[1] <= rect[1] + 0.05 &&
      b[3] >= rect[3] - 0.05
    );
  }
  var before = snapshot();
  try {
    eval(read(root + "/DanCardCEP/jsx/dan_card_lib.jsx"));
    oldFlatten = dcFlattenForImposition;
    productionSignature = dcRunSignature8;
    dcFlattenForImposition = function (d, item, frame, dpi) {
      assert(d === doc, "Raster target is not owned test document");
      assert(dpi === 500, "Production processing raster is not 500ppi");
      var raster = oldFlatten(d, item, frame, dpi);
      pages.push(raster);
      return raster;
    };
    alert = function (text) {
      messages.push(String(text));
    };
    var source = replaceBody(
      productionSignature.toString(),
      "showNoteDialog",
      'return {ab:"AB TEST",smallAB:"AB TEST"};',
    );
    source = replaceBody(
      source,
      "loadNoteIconTemplate",
      'var icon=artworkLayer.pathItems.ellipse(0,0,7,7); icon.name="AB_TEST_ICON"; icon.stroked=false; icon.hidden=true; return icon;',
    );
    eval(source);
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    doc = app.documents.add(DocumentColorSpace.CMYK, 600, 500);
    doc.artboards[0].name = "OWNED_AB_TEST_SOURCE";
    var keep = doc.pathItems.rectangle(200, -200, 20, 20);
    var keepBounds = copy(keep.geometricBounds);
    for (var pi = 0; pi < spec.n; pi++) {
      var x = 100 + (pi % 8) * 100,
        y = 600 - Math.floor(pi / 8) * 250;
      var g = doc.groupItems.add();
      g.name = "TEST_PAGE_" + (pi + 1);
      var p = g.pathItems.rectangle(y, x, 60, (60 * spec.h) / spec.w);
      p.stroked = false;
      p.filled = true;
      var ink = new CMYKColor();
      ink.cyan = pi % 2 ? 10 : 60;
      ink.magenta = 10;
      ink.yellow = 5;
      ink.black = 0;
      p.fillColor = ink;
      var label = g.textFrames.add();
      label.contents = String(pi + 1) + " TOP";
      label.textRange.characterAttributes.size = 10;
      label.position = [x + 2, y - 4];
    }
    doc.selection = null;
    for (var gi = 0; gi < doc.groupItems.length; gi++)
      doc.groupItems[gi].selected = true;
    app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
    var status = dcRunSignature8(String(spec.w), String(spec.h), false);
    assert(status.indexOf("OK:") === 0, status);
    assert(
      app.coordinateSystem === CoordinateSystem.ARTBOARDCOORDINATESYSTEM,
      "Coordinate mode not restored",
    );
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    assert(doc.artboards.length === 2, "AB must have exactly two artboards");
    assert(pages.length === spec.n, "Raster page count mismatch");
    assert(
      json(copy(keep.geometricBounds)) === json(keepBounds),
      "Unselected source moved",
    );
    var rects = [],
      pageSizes = [];
    for (var bi = 0; bi < 2; bi++) {
      var rect = copy(doc.artboards[bi].artboardRect);
      rects.push(rect);
      assert(
        Math.abs(rect[2] - rect[0] - 858 * MM) < 0.02 &&
          Math.abs(rect[1] - rect[3] - 625 * MM) < 0.02,
        "Wrong AB paper dimensions",
      );
    }
    for (pi = 0; pi < pages.length; pi++) {
      var bounds = copy(pages[pi].geometricBounds);
      assert(
        inside(rects[0], bounds) || inside(rects[1], bounds),
        "Page outside shortened AB",
      );
      pageSizes.push([bounds[2] - bounds[0], bounds[1] - bounds[3]]);
    }
    var paper = doc.layers.getByName("Pon CTL Offset tu dong").pathItems;
    var cuts = doc.layers.getByName("Pon cat CTL Offset tu dong").pathItems;
    assert(paper.length === 16, "Paper PON count mismatch");
    for (bi = 0; bi < 2; bi++) {
      rect = rects[bi];
      var corners = [
        [rect[0], rect[1]],
        [rect[2], rect[1]],
        [rect[0], rect[3]],
        [rect[2], rect[3]],
      ];
      for (var ci2 = 0; ci2 < 4; ci2++) {
        var hits = 0;
        for (var mi = 0; mi < paper.length; mi++) {
          var points = paper[mi].pathPoints;
          for (var qi = 0; qi < points.length; qi++) {
            var a = points[qi].anchor;
            if (
              Math.abs(a[0] - corners[ci2][0]) < 0.02 &&
              Math.abs(a[1] - corners[ci2][1]) < 0.02
            ) {
              hits++;
              break;
            }
          }
        }
        assert(hits === 2, "Paper PON not centred at new artboard corner");
      }
    }
    for (mi = 0; mi < cuts.length; mi++) {
      var markBounds = copy(cuts[mi].geometricBounds);
      assert(
        inside(rects[0], markBounds) || inside(rects[1], markBounds),
        "Cut PON outside shortened paper",
      );
    }
    var noteCount = 0;
    for (var ti = 0; ti < doc.textFrames.length; ti++) {
      var note = doc.textFrames[ti];
      if (note.contents.indexOf("RUỘT ") !== 0) continue;
      assert(
        inside(rects[0], note.visibleBounds),
        "AB note outside front artboard",
      );
      assert(
        note.textRange.characterAttributes.size === 13,
        "Note font size changed",
      );
      noteCount++;
    }
    assert(noteCount === 1, "AB note must stay on A only");
    var plan = eval("(" + status.split("||CTLPDF:")[1] + ")");
    assert(plan.total === 2, "Save plan lost AB pairing");
    var capture = new ImageCaptureOptions();
    capture.resolution = 72;
    capture.antiAliasing = true;
    doc.imageCapture(
      File(out.fsName + "/" + spec.name + ".png"),
      rects[0],
      capture,
    );
    report = {
      name: spec.name,
      passed: true,
      version: dcSignature8AutoPonVersion,
      paperMm: [858, 625],
      artboards: rects,
      rasterPages: pages.length,
      pageSizesPt: pageSizes,
      paperMarks: paper.length,
      cutMarks: cuts.length,
      notes: noteCount,
      status: status,
      alerts: messages,
    };
  } catch (error) {
    report.error = String(error);
    report.line = error.line;
    report.alerts = messages;
  } finally {
    if (oldFlatten) dcFlattenForImposition = oldFlatten;
    if (productionSignature) dcRunSignature8 = productionSignature;
    alert = oldAlert;
    if (doc) {
      doc.activate();
      doc.close(SaveOptions.DONOTSAVECHANGES);
    }
    if (previous) previous.activate();
    app.coordinateSystem = oldCoordinates;
    app.userInteractionLevel = oldInteraction;
  }
  report.originalDocumentsUnchanged = before === snapshot();
  if (!report.originalDocumentsUnchanged) {
    report.passed = false;
    report.error = "Original document structure changed";
  }
  var result = File(out.fsName + "/" + spec.name + ".json");
  result.encoding = "UTF-8";
  result.open("w");
  result.write(json(report));
  result.close();
  return json({
    name: spec.name,
    passed: report.passed,
    error: report.error,
    result: result.fsName,
  });
})();
