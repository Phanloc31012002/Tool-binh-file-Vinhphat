// Test hồi quy (chỉ chạy khi chủ động bật) trên bản sao riêng của file AI đã lưu có canvas bị lệch.
// Không bao giờ lưu, group, rasterize hay xoá bất cứ thứ gì trong tài liệu của người dùng.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var folder = new Folder(
    root + "/tmp/ctl_canvas_2.15.20_" + new Date().getTime(),
  );
  folder.create();
  var original = app.activeDocument,
    owned = null;
  var previousCoordinates = app.coordinateSystem,
    previousInteraction = app.userInteractionLevel;
  var previousAlert = alert,
    productionFlatten,
    productionSignature,
    productionKeo;
  var report = { passed: false, cases: [], folder: folder.fsName };
  function read(path) {
    var f = new File(path);
    f.encoding = "UTF-8";
    f.open("r");
    var s = f.read();
    f.close();
    return s;
  }
  function log(text) {
    var f = new File(folder.fsName + "/phase.txt");
    f.encoding = "UTF-8";
    f.open("a");
    f.writeln(text);
    f.close();
  }
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  function snapshot(doc) {
    doc.activate();
    var parts = [
      doc.name,
      doc.saved,
      doc.artboards.length,
      doc.activeLayer.name,
      doc.artboards.getActiveArtboardIndex(),
    ];
    for (var a = 0; a < doc.artboards.length; a++)
      parts.push(doc.artboards[a].artboardRect.join(","));
    for (var l = 0; l < doc.layers.length; l++)
      parts.push(
        doc.layers[l].name +
          ":" +
          doc.layers[l].locked +
          ":" +
          doc.layers[l].visible,
      );
    for (var i = 0; i < doc.pageItems.length; i++) {
      var item = doc.pageItems[i];
      try {
        var itemDescription =
        item.typename +
          ":" +
          item.name +
          ":" +
          item.parent.name +
          ":" +
          (item.typename === "GroupItem" && item.pageItems.length === 0 ? "EMPTY" : item.geometricBounds.join(",")) +
          ":" +
          item.locked;
        parts.push(itemDescription);
      } catch (emptyItemError) { parts.push("UNREADABLE_ITEM:" + i); }
    }
    var sel = doc.selection;
    for (var s = 0; s < sel.length; s++)
      parts.push("SEL:" + sel[s].name + ":" + sel[s].geometricBounds.join(","));
    return parts.join("\n");
  }
  function replaceFunctionBody(source, name, body) {
    var start = source.indexOf("function " + name + "("),
      open = source.indexOf("{", start);
    assert(start >= 0, "Missing modal function " + name);
    var depth = 1,
      state = "code",
      quote;
    for (var i = open + 1; i < source.length; i++) {
      var c = source.charAt(i),
        next = source.charAt(i + 1);
      if (state === "string") {
        if (c === "\\") i++;
        else if (c === quote) state = "code";
      } else if (state === "line") {
        if (c === "\n" || c === "\r") state = "code";
      } else if (state === "block") {
        if (c === "*" && next === "/") {
          i++;
          state = "code";
        }
      } else if (c === '"' || c === "'") {
        state = "string";
        quote = c;
      } else if (c === "/" && next === "/") {
        i++;
        state = "line";
      } else if (c === "/" && next === "*") {
        i++;
        state = "block";
      } else if (c === "{") depth++;
      else if (c === "}" && --depth === 0)
        return source.substring(0, open + 1) + body + source.substring(i);
    }
    throw new Error("Unbalanced modal function");
  }
  try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    var originalBefore = snapshot(original);
    var input = new File(original.fullName);
    assert(
      input.exists && /\.ai$/i.test(input.name),
      "Need saved AI for shifted canvas fixture",
    );
    $.evalFile(new File(root + "/DanCardCEP/jsx/dan_card_lib.jsx"));
    productionFlatten = dcFlattenForImposition;
    productionSignature = dcRunSignature8;
    productionKeo = dcRunKeoGay;
    var signatureFixtureSource =
      replaceFunctionBody(
        dcRunSignature8.toString(),
        "showNoteDialog",
        "return null;",
      );
    signatureFixtureSource = signatureFixtureSource.replace('e.toString();', 'e.toString() + " native-line=" + e.line;');
    eval(signatureFixtureSource);
    eval(
      replaceFunctionBody(
        dcRunKeoGay.toString(),
        "showNoteDialog",
        "return null;",
      ),
    );
    alert = function () {};
    for (var mode = 0; mode < 4; mode++) {
      var isKeo = mode % 2 === 1,
        reject = mode >= 2;
      var fixturePath = new File(folder.fsName + "/fixture_" + mode + ".ai");
      assert(input.copy(fixturePath.fsName), "Could not make owned AI copy");
      owned = app.open(fixturePath);
      owned.activate();
      owned.selection = null;
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      var canvas = dcDanTheoMauReadCanvasBounds(owned);
      assert(
        canvas && canvas[0] < -10000,
        "Fixture lost shifted canvas metadata",
      );
      var layer = owned.layers.add();
      layer.name = "CTL_CANVAS_TEST_INPUT";
      layer.locked = false;
      layer.visible = true;
      owned.activeLayer = layer;
      app.redraw();
      var left = reject ? canvas[0] + 5 : -10894.843930306;
      var top = 7320.524756344,
        pages = [];
      log("INPUT " + mode + " canvas=" + canvas + " pageOrigin=" + owned.pageOrigin + " coordinates=" + app.coordinateSystem);
      for (var p = 0; p < 12; p++) {
        assert(owned.rasterItems.length > 0, "Saved fixture needs one existing raster page");
        var page = owned.rasterItems[0].duplicate(layer, ElementPlacement.PLACEATEND);
        page.locked = false;
        page.name = "CANVAS_TEST_PAGE_" + p;
        var createdBounds = page.geometricBounds;
        page.translate(left + p * 70 - createdBounds[0], top - createdBounds[1]);
        pages.push(page);
      }
      owned.selection = null;
      for (p = 0; p < pages.length; p++) pages[p].selected = true;
      var before = snapshot(owned),
        anchor = owned.selection[0].geometricBounds;
      var rasterCalls = 0;
      dcFlattenForImposition = function (doc, item, frame, dpi) {
        assert(
          doc === owned && doc !== original,
          "Refuse to raster user document",
        );
        rasterCalls++;
        return productionFlatten(doc, item, frame, dpi);
      };
      app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
      log("RUN " + mode + " canvas=" + canvas);
      var status;
      if (isKeo) status = dcRunKeoGay("14.5", "20.7");
      else status = dcRunSignature8("14.5", "20.7", true);
      assert(
        app.coordinateSystem === CoordinateSystem.ARTBOARDCOORDINATESYSTEM,
        "User coordinates not restored",
      );
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      log("RESULT " + status);
      if (reject) {
        assert(
          status.indexOf("ERR:") === 0 && rasterCalls === 0,
          "Real edge not rejected before raster",
        );
        assert(
          before === snapshot(owned),
          "Rejected preflight changed source/old PON/artboards",
        );
      } else {
        assert(
          status.indexOf("OK:") === 0 && status.indexOf("||CTLPDF:") > 0,
          "Layout failed or lost save buttons: " + status,
        );
        assert(
          rasterCalls === 12 && owned.artboards.length === 2,
          "Wrong page/frame count",
        );
        var first = owned.artboards[0].artboardRect;
        assert(
          Math.abs(first[0] - left) < 0.01 && Math.abs(first[1] - top) < 0.01,
          "First sheet anchor shifted",
        );
        for (var a = 0; a < owned.artboards.length; a++) {
          var r = owned.artboards[a].artboardRect;
          assert(
            r[0] >= canvas[0] &&
              r[1] <= canvas[1] &&
              r[2] <= canvas[2] &&
              r[3] >= canvas[3],
            "Sheet outside actual canvas",
          );
        }
        owned.artboards.setActiveArtboardIndex(0);
        var image = new ImageCaptureOptions();
        image.resolution = 72;
        image.antiAliasing = true;
        owned.imageCapture(
          new File(
            folder.fsName + "/" + (isKeo ? "keo" : "signature") + ".png",
          ),
          first,
          image,
        );
      }
      report.cases.push({
        mode: isKeo ? "Keo" : "Signature",
        rejected: reject,
        rasterCalls: rasterCalls,
        status: status,
        passed: true,
      });
      owned.close(SaveOptions.DONOTSAVECHANGES);
      owned = null;
      original.activate();
    }
    report.userSourceUnchanged = originalBefore === snapshot(original);
    assert(report.userSourceUnchanged, "User source changed");
    report.passed = true;
  } catch (e) {
    report.error = String(e) + " line " + e.line;
    log("ERROR " + report.error);
  } finally {
    if (owned) {
      owned.activate();
      owned.close(SaveOptions.DONOTSAVECHANGES);
    }
    original.activate();
    if (productionFlatten) dcFlattenForImposition = productionFlatten;
    if (productionSignature) dcRunSignature8 = productionSignature;
    if (productionKeo) dcRunKeoGay = productionKeo;
    alert = previousAlert;
    app.coordinateSystem = previousCoordinates;
    app.userInteractionLevel = previousInteraction;
    var result = new File(folder.fsName + "/result.txt");
    result.encoding = "UTF-8";
    result.open("w");
    result.write(report.toSource());
    result.close();
  }
  return report.toSource();
})();
