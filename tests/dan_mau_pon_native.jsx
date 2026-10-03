// Opt-in native canvas diagnostic: no user's document/template is edited.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var folder = new Folder(root + "/tmp/dan_mau_canvas_20261003");
  if (!folder.exists) folder.create();
  var original = app.documents.length ? app.activeDocument : null;
  var guardDoc = null;
  var savedCoordinates = app.coordinateSystem,
    savedInteraction = app.userInteractionLevel;
  var ponDoc = null,
    source = null,
    oldAlert = alert,
    messages = [];
  var prefix =
    typeof taskMauCasePrefix !== "undefined" ? taskMauCasePrefix : "canvas";
  var ponSelections = 0,
    useUnequalPon = false;
  var result = { cases: [] };
  function write(name, text) {
    var f = new File(folder.fsName + "/" + name);
    f.encoding = "UTF-8";
    f.open("w");
    f.write(text);
    f.close();
  }
  function read(path) {
    var f = new File(path);
    f.encoding = "UTF-8";
    f.open("r");
    var s = f.read();
    f.close();
    return s;
  }
  function selectFixturePon() {
    ponSelections++;
    var name = "pon.ai";
    if (useUnequalPon && ponSelections === 2) name = "pon-back.ai";
    return new File(folder.fsName + "/" + name);
  }
  function equal(a, b) {
    for (var i = 0; i < 4; i++) if (Math.abs(a[i] - b[i]) > 0.02) return false;
    return true;
  }
  try {
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    alert = function (s) {
      messages.push(String(s));
    };
    // Keep a document open while restoring app state/writing diagnostics.
    // Some Illustrator builds abort the script when the last document closes.
    if (!original)
      guardDoc = app.documents.add(DocumentColorSpace.CMYK, 100, 100);
    var rect = [1000, 2000, 1600, 1600];
    ponDoc = app.documents.add(DocumentColorSpace.CMYK, 600, 400);
    ponDoc.artboards[0].artboardRect = rect;
    var mark = ponDoc.pathItems.rectangle(1980, 1020, 10, 10);
    mark.name = "PON_MARK";
    var aiOptions = new IllustratorSaveOptions();
    aiOptions.pdfCompatible = false;
    ponDoc.saveAs(new File(folder.fsName + "/pon.ai"), aiOptions);
    ponDoc.close(SaveOptions.DONOTSAVECHANGES);
    ponDoc = null;
    ponDoc = app.documents.add(DocumentColorSpace.CMYK, 450, 500);
    ponDoc.artboards[0].artboardRect = [2100, 3000, 2550, 2500];
    ponDoc.pathItems.rectangle(2980, 2120, 10, 10).name = "BACK_PON_MARK";
    ponDoc.saveAs(new File(folder.fsName + "/pon-back.ai"), aiOptions);
    ponDoc.close(SaveOptions.DONOTSAVECHANGES);
    ponDoc = null;
    // far-away learned absolute references; actual dx/dy are centred slots.
    var template =
      "# dan theo mau v5\nMODE\tone\nSTATE\tready\nBLOCK\tF\nsideHi\t35.2778\nsideLo\t17.6389\nn\t2\nslot\t-70\t0\t1\t0\t100\t50\timage\nslot\t70\t0\t1\t0\t100\t50\timage\nlearnref\t0\t6000\t7000\t100\t50\nlearnref\t1\t6140\t7000\t100\t50\n";
    write("template.txt", template);
    var lib = read(root + "/DanCardCEP/jsx/dan_card_lib.jsx");
    eval(
      lib.substring(
        lib.indexOf("function dcRemoveOldCanvasArtboards("),
        lib.indexOf("function dcCopyToiUuNoteToOddArtboards("),
      ),
    );
    var from = lib.indexOf("function dcApMau("),
      to = lib.indexOf("//  dcAutoSavePDF", from);
    var code = lib
      .substring(from, to)
      .replace(
        'Folder.temp + "/dan_theo_mau_tmp.txt"',
        '"' + folder.fsName.replace(/\\/g, "/") + '/template.txt"',
      )
      .replace('File.openDialog(label, "*.ai")', "selectFixturePon()");
    // New wrapper helper is loaded separately when present.
    if (lib.indexOf("function dcApMauCore(") >= 0) {
      var v = lib.indexOf("var dcDanTheoMauVersion");
      code = lib
        .substring(v, to)
        .replace(
          'Folder.temp + "/dan_theo_mau_tmp.txt"',
          '"' + folder.fsName.replace(/\\/g, "/") + '/template.txt"',
        )
        .replace('File.openDialog(label, "*.ai")', "selectFixturePon()");
    }
    eval(code);
    for (var c = 0; c < 7; c++) {
      if (typeof taskMauCaseIndex !== "undefined" && c !== taskMauCaseIndex)
        continue;
      var two = c === 2 || c === 5;
      write(
        "template.txt",
        two
          ? template.replace("MODE\tone", "MODE\ttwo\nBACK_MIRROR\tHORIZONTAL")
          : template,
      );
      ponSelections = 0;
      useUnequalPon = c === 5;
      source = app.documents.add(DocumentColorSpace.CMYK, 500, 300, 2);
      source.artboards[0].artboardRect = [-5000, 6000, -4500, 5700];
      source.artboards[1].artboardRect = [-4000, 6000, -3500, 5700];
      source.artboards.setActiveArtboardIndex(1);
      source.rulerOrigin = c === 0 ? [600, -900] : [0, 0];
      var inputBoard = source.artboards[0].artboardRect.slice(0),
        inputX = inputBoard[0] + 100,
        inputY = inputBoard[1] - 100;
      var artwork = source.pathItems.rectangle(inputY, inputX, 100, 50);
      artwork.name = "INPUT_ONLY";
      source.selection = null;
      artwork.selected = true;
      var originalBounds = artwork.geometricBounds.slice(0);
      var second = null,
        secondBounds = null;
      if (c === 2 || c === 3 || c === 5) {
        second = source.pathItems.rectangle(inputY, inputX + 200, 100, 50);
        second.name = "SECOND_INPUT";
        second.selected = true;
        secondBounds = second.geometricBounds.slice(0);
      }
      var extraInputs = [],
        extraBounds = [];
      var inputCount = 1;
      if (c === 4) inputCount = 26;
      if (c === 5) inputCount = 14;
      for (var n = 1; n < inputCount; n++) {
        var item = source.pathItems.rectangle(inputY - n * 60, inputX, 100, 50);
        item.selected = true;
        extraInputs.push(item);
        extraBounds.push(item.geometricBounds.slice(0));
        if (two) {
          item = source.pathItems.rectangle(
            inputY - n * 60,
            inputX + 200,
            100,
            50,
          );
          item.selected = true;
          extraInputs.push(item);
          extraBounds.push(item.geometricBounds.slice(0));
        }
      }
      var sentinel = null;
      if (c === 6) {
        source.saveAs(
          new File(folder.fsName + "/source-c" + c + ".ai"),
          aiOptions,
        );
        var occupiedCanvas = dcDanTheoMauReadCanvasBounds(source),
          edgeGap = 10 * 2.834645669;
        var midCanvas = (occupiedCanvas[0] + occupiedCanvas[2]) / 2;
        source.artboards[0].artboardRect = [
          occupiedCanvas[0] + edgeGap,
          occupiedCanvas[1] - edgeGap,
          midCanvas,
          occupiedCanvas[3] + edgeGap,
        ];
        source.artboards[1].artboardRect = [
          midCanvas,
          occupiedCanvas[1] - edgeGap,
          occupiedCanvas[2] - edgeGap,
          occupiedCanvas[3] + edgeGap,
        ];
        var previousLayer = source.layers.add();
        previousLayer.name = "__DAN_THEO_MAU_KET_QUA__";
        sentinel = previousLayer.pathItems.rectangle(100, 100, 20, 20);
        sentinel.name = "KEEP_PREVIOUS_ON_FAILURE";
      }
      app.coordinateSystem =
        c === 1
          ? CoordinateSystem.DOCUMENTCOORDINATESYSTEM
          : CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
      source.saveAs(
        new File(folder.fsName + "/source-c" + c + ".ai"),
        aiOptions,
      );
      var beforeCoordinates = app.coordinateSystem;
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      var requestedCanvas = dcDanTheoMauReadCanvasBounds(source);
      var originalRects = [];
      for (var oi = 0; oi < source.artboards.length; oi++)
        originalRects.push(source.artboards[oi].artboardRect.slice(0));
      source.selection = null;
      artwork.selected = true;
      if (second) second.selected = true;
      for (var reselect = 0; reselect < extraInputs.length; reselect++)
        extraInputs[reselect].selected = true;
      app.coordinateSystem = beforeCoordinates;
      var status = dcApMau(c === 3);
      source.activate();
      var coordinateRestored = app.coordinateSystem === beforeCoordinates;
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      var afterRect = source.artboards[0].artboardRect.slice(0);
      var gap = 10 * 2.834645669,
        expected = [
          requestedCanvas[0] + gap,
          requestedCanvas[1] - gap,
          requestedCanvas[0] + gap + 600,
          requestedCanvas[1] - gap - 400,
        ];
      if (c === 6) expected = originalRects[0];
      var caseResult = {
        caseIndex: c,
        status: status,
        requested: expected,
        actual: afterRect,
        matched: equal(expected, afterRect),
        coordinateRestored: coordinateRestored,
      };
      caseResult.sourceUnchanged = equal(
        originalBounds,
        artwork.geometricBounds,
      );
      if (second)
        caseResult.sourceUnchanged =
          caseResult.sourceUnchanged &&
          equal(secondBounds, second.geometricBounds);
      for (var n = 0; n < extraInputs.length; n++)
        caseResult.sourceUnchanged =
          caseResult.sourceUnchanged &&
          equal(extraBounds[n], extraInputs[n].geometricBounds);
      caseResult.artboardCount = source.artboards.length;
      caseResult.rects = [];
      for (var ab = 0; ab < source.artboards.length; ab++)
        caseResult.rects.push(source.artboards[ab].artboardRect.slice(0));
      caseResult.layoutMatched = true;
      var expectedCount = 1;
      if (c === 2) expectedCount = 2;
      if (c === 4) expectedCount = 26;
      if (c === 5) expectedCount = 28;
      if (c === 6) expectedCount = 2;
      if (caseResult.artboardCount !== expectedCount)
        caseResult.layoutMatched = false;
      if (c === 4 || c === 5) {
        var columns = 22,
          bundleW = 600,
          bundleH = 400;
        if (c === 5) {
          columns = 12;
          bundleW = 600 + gap + 450;
          bundleH = 500;
        }
        for (var q = 0; q < inputCount; q++) {
          var x = requestedCanvas[0] + gap + (q % columns) * (bundleW + gap),
            y =
              requestedCanvas[1] -
              gap -
              Math.floor(q / columns) * (bundleH + gap);
          var index = q;
          if (c === 5) index = q * 2;
          if (!equal(caseResult.rects[index], [x, y, x + 600, y - 400]))
            caseResult.layoutMatched = false;
          if (
            c === 5 &&
            !equal(caseResult.rects[index + 1], [
              x + 600 + gap,
              y,
              x + 600 + gap + 450,
              y - 500,
            ])
          )
            caseResult.layoutMatched = false;
        }
      }
      if (c === 6) {
        caseResult.previousRetained =
          sentinel.name === "KEEP_PREVIOUS_ON_FAILURE";
        caseResult.layoutMatched =
          caseResult.layoutMatched && caseResult.previousRetained;
      }
      var output = null;
      for (var l = 0; l < source.layers.length; l++)
        if (source.layers[l].name === "__DAN_THEO_MAU_KET_QUA__")
          output = source.layers[l];
      caseResult.outputs = [];
      if (output)
        for (var j = 0; j < output.pageItems.length; j++)
          if (output.pageItems[j].parent === output)
            caseResult.outputs.push({
              kind: output.pageItems[j].typename,
              bounds: output.pageItems[j].geometricBounds.slice(0),
            });
      result.cases.push(caseResult);
      var capture = new ImageCaptureOptions();
      capture.resolution = 72;
      capture.antiAliasing = true;
      capture.transparency = false;
      if (c !== 6)
        source.imageCapture(
          new File(folder.fsName + "/" + prefix + "-" + c + ".png"),
          afterRect,
          capture,
        );
      source.close(SaveOptions.DONOTSAVECHANGES);
      source = null;
    }
    result.passed = true;
    for (var checked = 0; checked < result.cases.length; checked++) {
      var entry = result.cases[checked];
      var expectedStatus = "OK:";
      if (entry.caseIndex === 6) expectedStatus = "ERR:";
      if (
        !entry.matched ||
        !entry.layoutMatched ||
        !entry.coordinateRestored ||
        !entry.sourceUnchanged ||
        entry.status.indexOf(expectedStatus) !== 0
      )
        result.passed = false;
    }
  } catch (e) {
    result.error = String(e);
    result.line = e.line;
    result.caseIndex = c;
  } finally {
    if (ponDoc) {
      ponDoc.activate();
      ponDoc.close(SaveOptions.DONOTSAVECHANGES);
    }
    if (source) {
      source.activate();
      source.close(SaveOptions.DONOTSAVECHANGES);
    }
    if (original) original.activate();
    app.coordinateSystem = savedCoordinates;
    app.userInteractionLevel = savedInteraction;
    alert = oldAlert;
    result.messages = messages;
    write(prefix + ".txt", result.toSource());
    if (guardDoc) guardDoc.close(SaveOptions.DONOTSAVECHANGES);
  }
  return result.toSource();
})();
