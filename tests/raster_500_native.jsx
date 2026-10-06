// Kiểm tra trong Illustrator thật, chỉ chạy khi chủ động bật: chỉ sửa các tài liệu test CMYK tí hon của riêng nó.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var folder = new Folder(root + "/tmp/raster_500_" + new Date().getTime());
  folder.create();
  var previous = app.documents.length ? app.activeDocument : null;
  var coords = app.coordinateSystem,
    interaction = app.userInteractionLevel,
    owned = null;
  var report = { passed: false, results: [] };
  function read(path) {
    var f = new File(path);
    f.encoding = "UTF-8";
    f.open("r");
    var s = f.read();
    f.close();
    return s;
  }
  function assert(ok, msg) {
    if (!ok) throw new Error(msg);
  }
  function snapshot(doc) {
    var s = [doc.artboards.length, doc.pageItems.length, doc.layers.length];
    for (var i = 0; i < doc.pageItems.length; i++)
      s.push(
        doc.pageItems[i].name +
          ":" +
          doc.pageItems[i].geometricBounds.join(","),
      );
    for (i = 0; i < doc.selection.length; i++)
      s.push("selected:" + doc.selection[i].name);
    return s.join("|");
  }
  try {
    eval(read(root + "/DanCardCEP/jsx/dan_card_lib.jsx"));
    var js = read(root + "/DanCardCEP/js/main.js"),
      from = js.indexOf("function rasterizeSelectionInHost()"),
      to = js.indexOf("var btnRaster =", from);
    eval(js.substring(from, to));
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    for (var mode = 0; mode < 3; mode++) {
      owned = app.documents.add(DocumentColorSpace.CMYK, 120, 100);
      var shape = owned.pathItems.rectangle(80, 10, 60, 60);
      shape.name = "RASTER_SOURCE";
      shape.stroked = false;
      shape.filled = true;
      var ink = new CMYKColor();
      ink.cyan = 100;
      shape.fillColor = ink;
      owned.selection = null;
      shape.selected = true;
      var result;
      if (mode === 0) result = rasterizeSelectionInHost();
      else if (mode === 1) result = dcRasterizeSelection();
      else {
        dcFlattenForImposition(owned, shape, shape.geometricBounds, 300);
        result = "OK: shared";
      }
      assert(result.indexOf("OK:") === 0, result);
      assert(owned.rasterItems.length === 1, "Wrong independent raster count");
      var raster = owned.rasterItems[0],
        matrix = raster.matrix;
      var x =
        72 /
        Math.sqrt(
          matrix.mValueA * matrix.mValueA + matrix.mValueB * matrix.mValueB,
        );
      var y =
        72 /
        Math.sqrt(
          matrix.mValueC * matrix.mValueC + matrix.mValueD * matrix.mValueD,
        );
      assert(
        Math.abs(x - 500) < 0.01 && Math.abs(y - 500) < 0.01,
        "Not native 500ppi",
      );
      report.results.push({
        mode: mode,
        xPpi: x,
        yPpi: y,
        space: String(raster.imageColorSpace),
      });
      owned.close(SaveOptions.DONOTSAVECHANGES);
      owned = null;
    }
    owned = app.documents.add(DocumentColorSpace.CMYK, 300, 200);
    for (var page = 0; page < 4; page++) {
      var p = owned.pathItems.rectangle(150, 10 + page * 60, 40, 40);
      p.stroked = false;
      p.name = "PAGE_" + page;
    }
    owned.selection = null;
    for (var i = 0; i < owned.pathItems.length; i++)
      owned.pathItems[i].selected = true;
    var before = snapshot(owned);
    var rejected = dcRunKeoGay("2", "3");
    assert(
      rejected.indexOf("ERR:") === 0 && rejected.indexOf("không bóp bài") >= 0,
      rejected,
    );
    assert(
      before === snapshot(owned),
      "Ratio mismatch changed original pages/boards",
    );
    assert(
      owned.rasterItems.length === 0,
      "Mismatch rasterized before rejecting",
    );
    report.ratioMismatchRejected = rejected;
    report.sourcePreserved = true;
    report.passed = true;
  } catch (e) {
    report.error = String(e) + " [line " + e.line + "]";
  } finally {
    if (owned) {
      owned.activate();
      owned.close(SaveOptions.DONOTSAVECHANGES);
    }
    if (previous) previous.activate();
    app.coordinateSystem = coords;
    app.userInteractionLevel = interaction;
    var out = new File(folder.fsName + "/result.txt");
    out.encoding = "UTF-8";
    out.open("w");
    out.write(report.toSource());
    out.close();
  }
  return report.toSource();
})();
