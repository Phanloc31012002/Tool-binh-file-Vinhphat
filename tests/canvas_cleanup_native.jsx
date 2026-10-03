// Opt-in native cleanup regression. Only owned, unsaved fixtures are changed.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var folder = new Folder(root + "/tmp/dan_mau_canvas_20261003");
  if (!folder.exists) folder.create();
  var previous = app.documents.length ? app.activeDocument : null,
    guard = null,
    doc = null;
  var savedCoordinates = app.coordinateSystem,
    savedInteraction = app.userInteractionLevel;
  var report = { cases: [], passed: true },
    MM = 2.834645669;
  function read(path) {
    var file = File(path);
    file.encoding = "UTF-8";
    file.open("r");
    var value = file.read();
    file.close();
    return value;
  }
  function same(a, b) {
    for (var i = 0; i < 4; i++) if (Math.abs(a[i] - b[i]) > 0.02) return false;
    return true;
  }
  function rect(left, top, w, h, name) {
    var item = doc.pathItems.rectangle(top, left, w, h);
    item.name = name;
    item.stroked = false;
    return item;
  }
  try {
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    if (!previous) guard = app.documents.add(DocumentColorSpace.CMYK, 100, 100);
    eval(read(root + "/DanCardCEP/jsx/dan_card_lib.jsx"));
    eval(read(root + "/DanCardCEP/jsx/dan_be_bridge.jsx"));
    var names = [
      "KTS one",
      "KTS duplex",
      "Offset self-turn",
      "Offset AB",
      "Offset mixed",
      "Be one",
      "Be duplex",
      "KTS validation failure",
      "Be validation failure",
    ];
    for (var ci = 0; ci < names.length; ci++) {
      if (
        typeof taskCleanupCaseIndex !== "undefined" &&
        ci !== taskCleanupCaseIndex
      )
        continue;
      doc = app.documents.add(DocumentColorSpace.CMYK, 500, 300);
      doc.artboards[0].name = "OLD_SOURCE_A";
      doc.artboards.add([700, 300, 1200, 0]).name = "OLD_SOURCE_B";
      var front = rect(50, 220, 80, 100, "SOURCE_FRONT"),
        back = rect(200, 220, 80, 100, "SOURCE_BACK");
      var keep = rect(350, 220, 20, 20, "UNSELECTED_KEEP"),
        keepBounds = keep.geometricBounds.slice(0);
      var sources = [front, back],
        bounds = [
          front.geometricBounds.slice(0),
          back.geometricBounds.slice(0),
        ];
      doc.selection = null;
      front.selected = true;
      var status = "",
        expectedCount = 1,
        sourceUnchanged = true;
      if (ci === 0) status = dcDanToiUu("33", "35.4", false, false);
      if (ci === 1) {
        back.selected = true;
        expectedCount = 2;
        status = dcDanToiUu("33", "35.4", true, false);
      }
      if (ci === 2 || ci === 3 || ci === 4) {
        back.selected = true;
        if (ci === 4) {
          var f2 = rect(50, 90, 60, 70, "SOURCE_FRONT_2"),
            b2 = rect(200, 90, 60, 70, "SOURCE_BACK_2");
          f2.selected = true;
          b2.selected = true;
        }
        var mode = "self";
        if (ci === 3) {
          mode = "ab";
          expectedCount = 2;
        }
        status = dcDanTuTro("33", "35.4", "4", "0", false, mode);
        // Offset already consumes placed pairs; cleanup adds no source removal.
        sources = [];
      }
      if (ci === 5 || ci === 6 || ci === 8) {
        var two = ci === 6,
          cut = rect(300, 150, 70, 90, "SOURCE_CUT");
        sources.push(cut);
        bounds.push(cut.geometricBounds.slice(0));
        var w = 330 * MM,
          h = 354 * MM;
        if (ci === 8) w = 16000;
        var dots = [
          { cx: 10 * MM, cy: 10 * MM, r: 2.5 * MM },
          { cx: 320 * MM, cy: 10 * MM, r: 2.5 * MM },
          { cx: 10 * MM, cy: 344 * MM, r: 2.5 * MM },
          { cx: 320 * MM, cy: 344 * MM, r: 2.5 * MM },
        ];
        dcDanBeJobs.cleanup = {
          doc: doc,
          models: [
            { khuon: { item: cut }, bai: { item: front }, sau: { item: back } },
          ],
          twoSided: two,
          MM: MM,
          paperW: w,
          paperH: h,
          pon: { rect: [0, h, w, 0], dots: dots },
        };
        status = dcDanBeRender(
          "cleanup",
          '[{"mi":0,"vi":0,"x":20,"y":20}]',
          "{}",
        );
        if (two) expectedCount = 2;
      }
      var failure = ci === 7 || ci === 8;
      if (ci === 7) {
        doc.selection = null;
        status = dcDanToiUu("33", "35.4", false, false);
      }
      if (failure) expectedCount = 2;
      doc.activate();
      var oldFrames = false;
      for (var bi = 0; bi < doc.artboards.length; bi++)
        if (doc.artboards[bi].name.indexOf("OLD_SOURCE_") === 0)
          oldFrames = true;
      for (var si = 0; si < sources.length; si++)
        if (!same(sources[si].geometricBounds, bounds[si]))
          sourceUnchanged = false;
      var entry = {
        name: names[ci],
        status: status,
        artboards: doc.artboards.length,
        oldFrames: oldFrames,
        sourceUnchanged: sourceUnchanged,
        unselectedKept: same(keep.geometricBounds, keepBounds),
        active: doc.artboards.getActiveArtboardIndex(),
      };
      entry.passed =
        entry.artboards === expectedCount &&
        entry.oldFrames === failure &&
        entry.sourceUnchanged &&
        entry.unselectedKept;
      var expectedStatus = "OK:";
      if (failure) expectedStatus = "ERR:";
      if (status.indexOf(expectedStatus) !== 0) entry.passed = false;
      if (!failure && entry.active !== 0) entry.passed = false;
      report.cases.push(entry);
      if (!entry.passed) report.passed = false;
      doc.close(SaveOptions.DONOTSAVECHANGES);
      doc = null;
    }
  } catch (error) {
    report.passed = false;
    report.error = String(error);
    report.line = error.line;
    report.caseIndex = ci;
  } finally {
    if (doc) {
      doc.activate();
      doc.close(SaveOptions.DONOTSAVECHANGES);
    }
    if (previous) previous.activate();
    app.coordinateSystem = savedCoordinates;
    app.userInteractionLevel = savedInteraction;
    var prefix = "cleanup-native";
    if (typeof taskCleanupCaseIndex !== "undefined")
      prefix += "-" + taskCleanupCaseIndex;
    var output = File(folder.fsName + "/" + prefix + ".txt");
    output.encoding = "UTF-8";
    output.open("w");
    output.write(report.toSource());
    output.close();
    if (guard) guard.close(SaveOptions.DONOTSAVECHANGES);
  }
  return report.toSource();
})();
