// Script chẩn đoán Illustrator qua COM, chỉ chạy khi chủ động bật. Chỉ dùng tài liệu tự dựng của riêng nó.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  // Đặt $.global.dcCtlExportAuditFormat = "AI" để chạy vòng lưu/mở lại file AI còn chỉnh sửa được.
  var isAI = $.global.dcCtlExportAuditFormat === "AI";
  var folder = new Folder(
    root +
      (isAI
        ? "/tmp/ctl_ai_20261003_" + new Date().getTime()
        : "/tmp/ctl_pdf_crash_20261003"),
  );
  if (!folder.exists) folder.create();
  var phase = new File(folder.fsName + "/phase.txt");
  function log(s) {
    phase.encoding = "UTF-8";
    phase.open("a");
    phase.writeln(s);
    phase.close();
  }
  var original = app.documents.length ? app.activeDocument : null;
  var owned = null;
  var oldPicker =
    typeof dcChonThuMucLuuPDF === "function" ? dcChonThuMucLuuPDF : null;
  var oldErrorFormatter = typeof dcMoTaLoi === "function" ? dcMoTaLoi : null;
  var oldInteraction = app.userInteractionLevel;
  var oldCoordinates = app.coordinateSystem;
  var openedOutput = null;
  var result = {};
  function snapshot(doc) {
    doc.activate();
    var a = [],
      layers = [],
      items = [];
    for (var k = 0; k < doc.artboards.length; k++)
      a.push(doc.artboards[k].artboardRect.join(","));
    for (var l = 0; l < doc.layers.length; l++)
      layers.push(
        doc.layers[l].name +
          ":" +
          doc.layers[l].locked +
          ":" +
          doc.layers[l].visible,
      );
    for (var i = 0; i < doc.pageItems.length; i++) {
      var item = doc.pageItems[i];
      items.push(
        item.typename +
          ":" +
          item.name +
          ":" +
          item.parent.name +
          ":" +
          item.geometricBounds.join(",") +
          ":" +
          item.locked,
      );
    }
    var sel = [];
    for (var s = 0; s < doc.selection.length; s++)
      sel.push(doc.selection[s].name);
    return [
      doc.name,
      doc.saved,
      a.join("|"),
      layers.join("|"),
      items.join("|"),
      sel.join("|"),
      doc.activeLayer.name,
      doc.artboards.getActiveArtboardIndex(),
    ].join("\n");
  }
  function color(c, m, y, k) {
    var v = new CMYKColor();
    v.cyan = c;
    v.magenta = m;
    v.yellow = y;
    v.black = k;
    return v;
  }
  try {
    log("START");
    var lib = new File(root + "/DanCardCEP/jsx/dan_card_lib.jsx");
    lib.encoding = "UTF-8";
    lib.open("r");
    var text = lib.read();
    lib.close();
    var from = text.indexOf("function dcLuuCtlOffsetPDF(");
    var to = text.indexOf("//  TEST: Dàn CATALOGUE KEO GÁY", from);
    var exportSource = text.substring(from, to);
    eval(exportSource);
    dcMoTaLoi = function (e) {
      return String(e) + " [line " + e.line + "]";
    };
    dcChonThuMucLuuPDF = function () {
      return folder;
    };
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    owned = app.documents.add(DocumentColorSpace.CMYK, 300, 200, 4);
    var MM = 2.834645669;
    var sizes = [
      [428, 313],
      [648, 418],
      [858, 638],
      [858, 638],
    ];
    var body = owned.layers[0];
    body.name = "Bai";
    var notes = owned.layers.add();
    notes.name = "Ghi chu";
    var pon = owned.layers.add();
    pon.name = "Pon cat CTL Offset tu dong";
    var artColors = [
      color(0, 100, 100, 0),
      color(100, 0, 100, 0),
      color(100, 0, 0, 0),
      color(0, 100, 0, 0),
    ];
    for (var n = 0; n < sizes.length; n++) {
      var left = -6000 + n * 2600,
        top = 6000;
      var w = sizes[n][0] * MM,
        h = sizes[n][1] * MM;
      owned.artboards[n].artboardRect = [left, top, left + w, top - h];
      owned.artboards[n].name = "SOURCE_" + n;
      var group = body.groupItems.add();
      group.name = "BAI_" + n;
      var p = group.pathItems.rectangle(
        top - 25 * MM,
        left + 25 * MM,
        60 * MM,
        60 * MM,
      );
      p.fillColor = artColors[n];
      p.stroked = false;
      p.name = "COLOR_" + n;
      var t = notes.textFrames.add();
      t.contents = n === 0 ? "BIA" : "RUOT " + n;
      t.position = [left + 12 * MM, top - 12 * MM];
      t.name = "NOTE_" + n;
      var mark = pon.pathItems.add();
      mark.setEntirePath([
        [left + 4 * MM, top - 4 * MM],
        [left + 9 * MM, top - 4 * MM],
      ]);
      mark.filled = false;
      mark.stroked = true;
      mark.strokeWidth = 1;
      mark.strokeColor = color(0, 0, 0, 100);
      mark.name = "PON_" + n;
      if (n === 1) {
        owned.selection = null;
        p.selected = true;
        var ro = new RasterizeOptions();
        ro.resolution = 300;
        ro.transparency = true;
        var image = owned.rasterize(p, p.geometricBounds, ro);
        image.name = "RASTER_1";
      }
    }
    // Nội dung ẩn và một PON riêng lẻ bị khoá không được làm ảnh hưởng tới việc xuất.
    pon.pageItems[0].locked = true;
    pon.locked = true;
    var hidden = owned.layers.add();
    hidden.name = "HIDDEN";
    var hiddenItem = hidden.pathItems.rectangle(6000, -6000, 300, 300);
    hiddenItem.filled = true;
    hiddenItem.fillColor = color(0, 0, 100, 0);
    hidden.visible = false;
    owned.activeLayer = body;
    owned.artboards.setActiveArtboardIndex(1);
    owned.selection = null;
    body.pageItems[0].selected = true;
    var before = snapshot(owned);
    log("BEFORE_EXPORT");
    var jobs =
      "BIA=1@" +
      428 * MM +
      "x" +
      313 * MM +
      "|RUOT 1=2@" +
      648 * MM +
      "x" +
      418 * MM +
      "|RUOT 2=3,4@" +
      858 * MM +
      "x" +
      638 * MM;
    var saveOffset = isAI ? dcLuuCtlOffsetAI : dcLuuCtlOffsetPDF;
    var started = new Date().getTime();
    result.exportResult = saveOffset("4", jobs);
    result.elapsedMs = new Date().getTime() - started;
    result.folder = folder.fsName;
    log(result.exportResult);
    result.sourceUnchanged = before === snapshot(owned);
    result.openDocs = app.documents.length;
    result.files = [];
    var ext = isAI ? ".ai" : ".pdf";
    var names = ["BIA" + ext, "RUOT 1" + ext, "RUOT 2" + ext];
    for (var f = 0; f < names.length; f++) {
      var file = new File(folder.fsName + "/" + names[f]);
      result.files.push(names[f] + ":" + file.exists + ":" + file.length);
      if (!file.exists || file.length < 100)
        throw new Error("Missing output " + names[f]);
    }
    result.collisionResult = saveOffset("4", jobs);
    result.invalidResult = saveOffset("5", jobs);
    result.afterErrorsUnchanged = before === snapshot(owned);
    if (
      result.exportResult.indexOf("OK:") !== 0 ||
      !result.sourceUnchanged ||
      !result.afterErrorsUnchanged ||
      result.collisionResult.indexOf("ERR: File đã tồn tại") !== 0 ||
      result.invalidResult.indexOf("ERR:") !== 0
    )
      throw new Error("Native audit failed");
    if (isAI) {
      result.reopened = [];
      var expectedPages = [[0], [1], [2, 3]];
      for (var aiFile = 0; aiFile < names.length; aiFile++) {
        openedOutput = app.open(new File(folder.fsName + "/" + names[aiFile]));
        openedOutput.activate();
        var expected = expectedPages[aiFile];
        if (openedOutput.artboards.length !== expected.length)
          throw new Error("Wrong AI artboard count: " + names[aiFile]);
        if (openedOutput.textFrames.length !== expected.length)
          throw new Error("Missing editable notes: " + names[aiFile]);
        var pageSummary = [];
        for (var aiPage = 0; aiPage < expected.length; aiPage++) {
          var sourcePage = expected[aiPage];
          var ab = openedOutput.artboards[aiPage];
          var abRect = ab.artboardRect;
          if (
            ab.name !== "SOURCE_" + sourcePage ||
            Math.abs(abRect[2] - abRect[0] - sizes[sourcePage][0] * MM) > 0.1 ||
            Math.abs(abRect[1] - abRect[3] - sizes[sourcePage][1] * MM) > 0.1
          )
            throw new Error("AI page identity/size mismatch");
          var markFound = false,
            noteFound = false,
            bodyFound = false;
          for (
            var outputItem = 0;
            outputItem < openedOutput.pageItems.length;
            outputItem++
          ) {
            var savedItem = openedOutput.pageItems[outputItem];
            if (savedItem.name === "PON_" + sourcePage) {
              var mb = savedItem.geometricBounds;
              if (
                Math.abs(mb[0] - abRect[0] - 4 * MM) > 0.1 ||
                Math.abs(mb[1] - abRect[1] + 4 * MM) > 0.1
              )
                throw new Error("PON shifted in AI");
              markFound = true;
            }
            if (savedItem.name === "NOTE_" + sourcePage) noteFound = true;
            if (
              savedItem.name ===
              (sourcePage === 1 ? "RASTER_1" : "COLOR_" + sourcePage)
            )
              bodyFound = true;
          }
          if (!markFound || !noteFound || !bodyFound)
            throw new Error("Missing art/PON/note in AI");
          pageSummary.push(ab.name + ":art+PON+note");
        }
        if (aiFile === 1 && openedOutput.rasterItems.length !== 1)
          throw new Error("Raster lost");
        result.reopened.push(names[aiFile] + ":" + pageSummary.join(","));
        openedOutput.close(SaveOptions.DONOTSAVECHANGES);
        openedOutput = null;
        owned.activate();
      }
      result.afterReopenUnchanged = before === snapshot(owned);
      if (!result.afterReopenUnchanged)
        throw new Error("Source changed during reopen");
    }
    result.passed = true;
  } catch (e) {
    result.error = String(e) + " [line " + e.line + "]";
    log("ERROR " + e);
  } finally {
    if (openedOutput) {
      openedOutput.activate();
      openedOutput.close(SaveOptions.DONOTSAVECHANGES);
    }
    // Ghi chẩn đoán trước khi đóng dữ liệu mẫu cuối cùng (một số host COM thoát ngay lúc đó).
    var out = new File(folder.fsName + "/result.json");
    out.encoding = "UTF-8";
    out.open("w");
    out.write(result.toSource());
    out.close();
    if (owned) {
      owned.activate();
      owned.close(SaveOptions.DONOTSAVECHANGES);
    }
    if (original) original.activate();
    if (oldPicker) dcChonThuMucLuuPDF = oldPicker;
    else dcChonThuMucLuuPDF = undefined;
    dcMoTaLoi = oldErrorFormatter || undefined;
    app.userInteractionLevel = oldInteraction;
    app.coordinateSystem = oldCoordinates;
    $.global.dcCtlExportAuditFormat = undefined;
  }
  return result.toSource();
})();
