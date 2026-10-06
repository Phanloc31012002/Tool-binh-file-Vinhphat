// Test render trong Illustrator thật, chỉ chạy khi chủ động bật. Tạo rồi đóng tài liệu test chưa lưu.
// Không đụng tới tài liệu của người dùng hay file AI test đã lưu.
$.evalFile(
  File(
    "C:/Users/ADMIN/Downloads/DanCard_Setup_23/DanCardCEP/jsx/dan_be_bridge.jsx",
  ),
);
(function () {
  var previous = app.activeDocument,
    oldCoordinates = app.coordinateSystem,
    testDoc = null,
    rows = [];
  var file = File(
    "C:/Users/ADMIN/Downloads/DanCard_Setup_23/tmp/dan_be_native_sheets_plan_2_15_2.json",
  );
  file.encoding = "UTF-8";
  if (!file.open("r")) throw new Error("Missing generated native plans.");
  var data = dcDanBeJSON.parse(file.read());
  file.close();
  var MM = 2.834645669,
    jobId = null;
  function near(a, b) {
    return Math.abs(a - b) < 0.02;
  }
  function fail(message) {
    throw new Error(message);
  }
  function layerNamed(name) {
    for (var i = 0; i < testDoc.layers.length; i++)
      if (testDoc.layers[i].name === name) return testDoc.layers[i];
    fail("Missing output layer " + name);
  }
  try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    for (var mode = 0; mode < 2; mode++) {
      testDoc = app.documents.add(DocumentColorSpace.CMYK, 180 * MM, 180 * MM);
      var cutLayer = testDoc.layers.add();
      cutLayer.name = "Khuôn bế";
      var artLayer = testDoc.layers.add();
      artLayer.name = "Bài";
      var models = [],
        modelIndex,
        paperW = data.input.sheet.widthMm * MM,
        paperH = data.input.sheet.heightMm * MM;
      for (modelIndex = 0; modelIndex < 2; modelIndex++) {
        var size = modelIndex ? 30 : 50;
        var k = cutLayer.pathItems.ellipse(
          (160 - modelIndex * 70) * MM,
          15 * MM,
          size * MM,
          size * MM,
        );
        k.name = "NATIVE_CUT_" + modelIndex;
        k.filled = false;
        k.stroked = true;
        k.strokeWidth = 0.25;
        var a = artLayer.pathItems.ellipse(
          (160.5 - modelIndex * 70) * MM,
          94.5 * MM,
          (size + 1) * MM,
          (size + 1) * MM,
        );
        a.name = "NATIVE_ART_" + modelIndex;
        a.filled = true;
        a.stroked = false;
        var color = new CMYKColor();
        color.yellow = 100;
        color.magenta = modelIndex ? 100 : 0;
        a.fillColor = color;
        models.push({ khuon: { item: k }, bai: { item: a } });
      }
      var dots = [];
      for (var i = 0; i < data.input.sheet.dots.length; i++) {
        var dot = data.input.sheet.dots[i];
        dots.push({ cx: dot.x * MM, cy: dot.y * MM, r: dot.r * MM });
      }
      jobId = "native_sheets_test_" + dcDanBeJobCounter++;
      dcDanBeJobs[jobId] = {
        doc: testDoc,
        models: models,
        MM: MM,
        paperW: paperW,
        paperH: paperH,
        pon: { rect: [0, paperH, paperW, 0], dots: dots },
      };
      var layout = mode ? data.mixed : data.separate;
      var result = dcDanBeRender(jobId, dcDanBeJSON.stringify(layout), "{}");
      if (result.indexOf("OK:") !== 0) fail(result);
      var expectedSheets = mode ? 1 : 2;
      if (testDoc.artboards.length !== expectedSheets)
        fail("Native artboard count mismatch.");
      var total = 0;
      for (var si = 0; si < expectedSheets; si++) {
        var suffix = mode ? "" : " - mẫu " + (si + 1);
        var cuts = layerNamed("Dàn bế - Khuôn" + suffix).pageItems;
        var arts = layerNamed("Dàn bế - Bài" + suffix).pageItems;
        var outputDots = layerNamed("Dàn bế - PON" + suffix).pageItems;
        var slots = mode ? data.mixed : data.separate.sheets[si].slots;
        var rect = testDoc.artboards[si].artboardRect;
        if (
          cuts.length !== slots.length ||
          arts.length !== slots.length ||
          outputDots.length !== 4
        )
          fail("Native output counts mismatch.");
        if (
          !near(rect[2] - rect[0], paperW) ||
          !near(rect[1] - rect[3], paperH)
        )
          fail("Native PON sheet size mismatch.");
        for (i = 0; i < slots.length; i++) {
          var slot = slots[i],
            targetX = rect[0] + slot.x * MM,
            targetY = rect[3] + slot.y * MM;
          var die = null,
            artwork = null,
            j;
          for (j = 0; j < cuts.length; j++) {
            var cb = cuts[j].geometricBounds;
            if (
              cuts[j].name === "NATIVE_CUT_" + slot.mi &&
              near(cb[0], targetX) &&
              near(cb[3], targetY)
            ) {
              die = cb;
              break;
            }
          }
          if (!die) fail("Native die identity/slot mismatch.");
          var cx = (die[0] + die[2]) / 2,
            cy = (die[1] + die[3]) / 2;
          for (j = 0; j < arts.length; j++) {
            var ab = arts[j].visibleBounds;
            if (
              arts[j].name === "NATIVE_ART_" + slot.mi &&
              near((ab[0] + ab[2]) / 2, cx) &&
              near((ab[1] + ab[3]) / 2, cy)
            ) {
              artwork = ab;
              break;
            }
          }
          if (!artwork) fail("Native artwork not centred on its own die.");
          if (
            die[0] < rect[0] + 4 * MM - 0.02 ||
            die[2] > rect[2] - 4 * MM + 0.02 ||
            die[1] > rect[1] - 4 * MM + 0.02 ||
            die[3] < rect[3] + 4 * MM - 0.02
          )
            fail("Native die outside margin.");
        }
        for (i = 0; i < dots.length; i++) {
          var found = false;
          for (var di = 0; di < outputDots.length; di++) {
            var db = outputDots[di].geometricBounds;
            if (
              near((db[0] + db[2]) / 2, rect[0] + dots[i].cx) &&
              near((db[1] + db[3]) / 2, rect[3] + dots[i].cy) &&
              near((db[2] - db[0]) / 2, dots[i].r)
            ) {
              found = true;
              break;
            }
          }
          if (!found) fail("Native PON moved/resized.");
        }
        total += slots.length;
      }
      if (cutLayer.pageItems.length !== 2 || artLayer.pageItems.length !== 2)
        fail("Source shapes changed.");
      rows.push({
        mode: mode ? "mixed" : "separate",
        artboards: expectedSheets,
        checkedSlots: total,
        ponPerArtboard: 4,
      });
      testDoc.close(SaveOptions.DONOTSAVECHANGES);
      testDoc = null;
      jobId = null;
    }
    var output = File(
      "C:/Users/ADMIN/Downloads/DanCard_Setup_23/tmp/dan_be_native_sheets_audit_2_15_2.json",
    );
    output.encoding = "UTF-8";
    if (!output.open("w")) fail("Cannot write generated native audit.");
    output.write(dcDanBeJSON.stringify(rows));
    output.close();
    return (
      dcDanBeJSON.stringify(rows) +
      " | Die/art identity, centres, margins and all PON verified."
    );
  } finally {
    try {
      if (jobId) delete dcDanBeJobs[jobId];
    } catch (jobError) {}
    try {
      if (testDoc) testDoc.close(SaveOptions.DONOTSAVECHANGES);
    } catch (closeError) {}
    try {
      previous.activate();
    } catch (activateError) {}
    try {
      app.coordinateSystem = oldCoordinates;
    } catch (coordinateError) {}
  }
})();
