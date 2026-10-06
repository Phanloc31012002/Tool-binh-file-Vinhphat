// Test tích hợp chỉ chạy khi chủ động bật. Mọi bài/PON cắt nằm trong một dữ liệu mẫu riêng, chưa lưu.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var folder = Folder(root + "/tmp/auto_cut_marks_20261003");
  if (!folder.exists) folder.create();
  var previous = app.documents.length ? app.activeDocument : null,
    guard = null,
    doc = null;
  var savedCoordinates = app.coordinateSystem,
    savedInteraction = app.userInteractionLevel;
  var report = { cases: [], passed: true },
    marks = null,
    input = null;
  function read(path) {
    var f = File(path);
    f.encoding = "UTF-8";
    f.open("r");
    var s = f.read();
    f.close();
    return s;
  }
  function count() {
    var n = 0;
    if (marks)
      for (var i = 0; i < marks.pathItems.length; i++)
        if (
          !marks.pathItems[i].filled &&
          marks.pathItems[i].pathPoints.length === 2
        )
          n++;
    return n;
  }
  function snapshot() {
    var result = [];
    if (marks)
      for (var i = 0; i < marks.pathItems.length; i++) {
        var p = marks.pathItems[i];
        if (!p.filled && p.pathPoints.length === 2)
          result.push({
            item: p,
            a: p.pathPoints[0].anchor.slice(0),
            b: p.pathPoints[1].anchor.slice(0),
          });
      }
    return result;
  }
  function equal(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++)
      if (Math.abs(a[i] - b[i]) > 0.001) return false;
    return true;
  }
  function source(layer, x, y, name) {
    var p = layer.pathItems.rectangle(y, x, 80, 80);
    p.name = name;
    p.filled = true;
    p.stroked = false;
    var c = new CMYKColor();
    c.cyan = 25;
    p.fillColor = c;
    return p;
  }
  function run(label, items, newMarks, failure) {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    var old = snapshot(),
      oldCount = count(),
      bounds = [];
    doc.selection = null;
    for (var i = 0; i < items.length; i++) {
      items[i].selected = true;
      bounds.push(items[i].geometricBounds.slice(0));
    }
    var originalLayer = doc.activeLayer;
    var coord = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    if (label === "second artboard with ARTBOARD coordinates")
      coord = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
    app.coordinateSystem = coord;
    var status = dcThemDauCatTuDong("1.4", "4", "0"),
      coordinateRestored = app.coordinateSystem === coord;
    var layerRestored = doc.activeLayer === originalLayer;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    if (!marks)
      for (var li = 0; li < doc.layers.length; li++)
        if (doc.layers[li].name === "Dau cat tu dong") marks = doc.layers[li];
    var unchanged = true;
    for (var si = 0; si < old.length; si++)
      if (
        !equal(old[si].a, old[si].item.pathPoints[0].anchor) ||
        !equal(old[si].b, old[si].item.pathPoints[1].anchor)
      )
        unchanged = false;
    for (var si = 0; si < items.length; si++)
      if (!equal(bounds[si], items[si].geometricBounds)) unchanged = false;
    var expected = "OK:";
    if (failure) expected = "ERR:";
    var entry = {
      name: label,
      status: status,
      marks: count(),
      oldKept: unchanged,
      coordinateRestored: coordinateRestored,
      layerRestored: layerRestored,
    };
    entry.passed =
      status.indexOf(expected) === 0 &&
      entry.marks === oldCount + newMarks &&
      unchanged &&
      coordinateRestored &&
      layerRestored;
    report.cases.push(entry);
    if (!entry.passed) report.passed = false;
  }
  try {
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    if (!previous) guard = app.documents.add(DocumentColorSpace.CMYK, 100, 100);
    var lib = read(root + "/DanCardCEP/jsx/dan_card_lib.jsx");
    eval(
      lib.substring(
        lib.indexOf("var dcAutoCutMarksVersion"),
        lib.indexOf("var dcDanToiUuVersion = 2;"),
      ),
    );
    doc = app.documents.add(DocumentColorSpace.CMYK, 600, 400);
    doc.artboards.add([700, 400, 1300, 0]);
    input = doc.layers[0];
    input.name = "NATIVE INPUT";
    var first = source(input, 100, 300, "FIRST_INPUT");
    run("first run", [first], 8, false);
    var sameLayer = source(marks, 300, 300, "ARTWORK_ON_PON_LAYER");
    run("new artwork on existing PON layer", [sameLayer], 8, false);
    run("repeat same artwork", [sameLayer], 0, false);
    var selection = [sameLayer];
    for (var i = 0; i < marks.pathItems.length; i++)
      if (marks.pathItems[i].note === "DANCARD_AUTO_CUT_MARK")
        selection.push(marks.pathItems[i]);
    run("artwork plus selected new marks", selection, 0, false);
    for (var i = 0; i < marks.pathItems.length; i++)
      if (marks.pathItems[i].note === "DANCARD_AUTO_CUT_MARK")
        marks.pathItems[i].note = "";
    run("artwork plus old untagged marks", selection, 0, false);
    var third = source(input, 100, 150, "THIRD_INPUT");
    doc.activeLayer = input;
    marks.locked = true;
    marks.visible = false;
    run("append to locked hidden PON layer", [third], 8, false);
    report.lockRestored = marks.locked === true;
    report.marksVisible = marks.visible === true;
    if (!report.lockRestored || !report.marksVisible) report.passed = false;
    var secondBoard = source(input, 800, 300, "SECOND_BOARD_INPUT");
    doc.artboards.setActiveArtboardIndex(1);
    run("second artboard with ARTBOARD coordinates", [secondBoard], 8, false);
    marks.locked = false;
    run("PON-only selection", [marks.pathItems[0]], 0, true);
    report.outputLayers = 0;
    for (var i = 0; i < doc.layers.length; i++)
      if (doc.layers[i].name === "Dau cat tu dong") report.outputLayers++;
    if (report.outputLayers !== 1) report.passed = false;
    var capture = new ImageCaptureOptions();
    capture.resolution = 72;
    capture.antiAliasing = true;
    capture.transparency = false;
    doc.imageCapture(
      File(folder.fsName + "/native-result.png"),
      [0, 400, 600, 0],
      capture,
    );
    doc.close(SaveOptions.DONOTSAVECHANGES);
    doc = null;
  } catch (error) {
    report.passed = false;
    report.error = String(error);
    report.line = error.line;
  } finally {
    if (doc) {
      doc.activate();
      doc.close(SaveOptions.DONOTSAVECHANGES);
    }
    if (previous) previous.activate();
    app.coordinateSystem = savedCoordinates;
    app.userInteractionLevel = savedInteraction;
    var f = File(folder.fsName + "/native-result.txt");
    f.encoding = "UTF-8";
    f.open("w");
    f.write(report.toSource());
    f.close();
    if (guard) guard.close(SaveOptions.DONOTSAVECHANGES);
  }
  return report.toSource();
})();
