// Kiểm tra Illustrator qua COM, chỉ chạy khi chủ động bật. Chỉ tạo/đóng các dữ liệu mẫu nhỏ của riêng nó.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var folder = new Folder(root + "/tmp/ctl_package_" + new Date().getTime());
  folder.create();
  var previous = app.documents.length ? app.activeDocument : null;
  var coords = app.coordinateSystem,
    interaction = app.userInteractionLevel;
  var owned = null,
    opened = null,
    oldPicker = null;
  var result = { folder: folder.fsName, passed: false, outputs: [] };
  function assert(ok, message) {
    if (!ok) throw new Error(message);
  }
  function write(name, contents) {
    var out = new File(folder.fsName + "/" + name);
    out.encoding = "UTF-8";
    out.open("w");
    out.write(contents);
    out.close();
  }
  function snapshot(doc) {
    doc.activate();
    var data = [
      doc.name,
      doc.saved,
      doc.activeLayer.name,
      doc.artboards.getActiveArtboardIndex(),
    ];
    for (var a = 0; a < doc.artboards.length; a++)
      data.push(
        doc.artboards[a].name + ":" + doc.artboards[a].artboardRect.join(","),
      );
    for (var l = 0; l < doc.layers.length; l++)
      data.push(
        doc.layers[l].name +
          ":" +
          doc.layers[l].visible +
          ":" +
          doc.layers[l].locked,
      );
    for (var i = 0; i < doc.pageItems.length; i++) {
      var item = doc.pageItems[i];
      if (item.typename === "GroupItem" && !item.pageItems.length) continue;
      data.push(
        item.name +
          ":" +
          item.parent.name +
          ":" +
          item.locked +
          ":" +
          item.geometricBounds.join(","),
      );
    }
    for (var s = 0; s < doc.selection.length; s++)
      data.push("selected:" + doc.selection[s].name);
    return data.join("\n");
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
    var f = new File(root + "/DanCardCEP/jsx/dan_card_lib.jsx");
    f.encoding = "UTF-8";
    f.open("r");
    var code = f.read();
    f.close();
    eval(code);
    oldPicker = dcChonThuMucLuuPDF;
    dcChonThuMucLuuPDF = function () {
      return folder;
    };
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    owned = app.documents.add(DocumentColorSpace.CMYK, 200, 100, 3);
    var body = owned.layers[0];
    body.name = "Bai";
    var notes = owned.layers.add();
    notes.name = "Ghi chu";
    var pon = owned.layers.add();
    pon.name = "PON";
    for (var n = 0; n < 3; n++) {
      var left = -1000 + n * 250,
        top = 500;
      owned.artboards[n].artboardRect = [left, top, left + 200, top - 100];
      owned.artboards[n].name = "SOURCE_" + n;
      var g = body.groupItems.add();
      g.name = "GROUP_" + n;
      var p = g.pathItems.rectangle(top - 20, left + 20, 140, 60);
      p.name = "COLOR_" + n;
      p.stroked = false;
      p.filled = true;
      p.fillColor = color(
        n === 1 ? 100 : 0,
        n === 2 ? 100 : 0,
        n === 0 ? 100 : 0,
        0,
      );
      if (n === 1) {
        var ro = new RasterizeOptions();
        ro.resolution = 72;
        ro.transparency = true;
        var raster = owned.rasterize(p, p.geometricBounds, ro);
        raster.name = "RASTER_1";
      }
      var t = notes.textFrames.add();
      t.contents = "RUOT " + n + " CMYK";
      t.position = [left + 20, top - 8];
      t.textRange.characterAttributes.size = 7;
      t.name = "NOTE_" + n;
      // Một dấu PON vắt qua mép artboard. Lệnh xuất không clip theo artboard
      // phải giữ được nó; không được lẫn bài nào nằm ngoài tờ này.
      var mark = pon.pathItems.add();
      mark.setEntirePath([
        [left - 2, top - 4],
        [left + 5, top - 4],
      ]);
      mark.stroked = true;
      mark.filled = false;
      mark.strokeWidth = 1;
      mark.strokeColor = color(0, 0, 0, 100);
      mark.name = "PON_" + n;
    }
    pon.pageItems[0].locked = true;
    pon.locked = true;
    var hidden = owned.layers.add();
    hidden.name = "HIDDEN";
    var h = hidden.pathItems.rectangle(500, -1000, 200, 100);
    h.name = "HIDDEN_ITEM";
    hidden.visible = false;
    owned.activeLayer = body;
    owned.selection = null;
    body.pageItems[0].selected = true;
    owned.artboards.setActiveArtboardIndex(1);
    var before = snapshot(owned);
    var jobs = "BIA=1@200x100|RUOT 1=2,3@200x100";
    var suffix = "CATALOGUE thử Việt ' & $ = @ [1]";
    var started = new Date().getTime();
    var response = dcLuuCtlOffsetAIPackage("3", jobs, suffix);
    result.elapsedMs = new Date().getTime() - started;
    assert(response.indexOf("OK:") === 0, response);
    var marker = response.indexOf("||CTLPACK:");
    assert(marker >= 0, "No package manifest");
    var manifest = response.substring(marker + 10);
    write("manifest.json", manifest);
    result.sourceUnchanged = before === snapshot(owned);
    assert(result.sourceUnchanged, "Source changed");
    result.collision = dcLuuCtlOffsetAIPackage("3", jobs, suffix);
    assert(
      result.collision.indexOf("ERR: File đã tồn tại") === 0,
      "Overwrite not blocked",
    );
    result.invalid = dcLuuCtlOffsetAIPackage("3", jobs, "bad/name");
    assert(result.invalid.indexOf("ERR:") === 0, "Invalid suffix accepted");
    var names = ["BIA " + suffix, "RUOT 1 " + suffix],
      expected = [[0], [1, 2]];
    for (var j = 0; j < names.length; j++) {
      var ai = new File(folder.fsName + "/" + names[j] + ".ai"),
        jpg = new File(folder.fsName + "/" + names[j] + ".jpg");
      assert(
        ai.exists && ai.length > 100 && jpg.exists && jpg.length > 100,
        "Missing AI/JPG",
      );
      opened = app.open(ai);
      opened.activate();
      assert(
        opened.artboards.length === expected[j].length,
        "Incorrect A/B artboard count",
      );
      assert(
        opened.textFrames.length === expected[j].length,
        "Missing editable notes",
      );
      assert(opened.rasterItems.length === (j === 1 ? 1 : 0), "Raster lost");
      var bounds = [Infinity, -Infinity, -Infinity, Infinity];
      for (var i = 0; i < opened.pageItems.length; i++) {
        var item = opened.pageItems[i];
        if (item.typename === "GroupItem" && !item.pageItems.length) continue;
        assert(item.name !== "HIDDEN_ITEM", "Hidden source copied");
        var b = item.visibleBounds;
        bounds = [
          Math.min(bounds[0], b[0]),
          Math.max(bounds[1], b[1]),
          Math.max(bounds[2], b[2]),
          Math.min(bounds[3], b[3]),
        ];
      }
      for (var a = 0; a < expected[j].length; a++) {
        var number = expected[j][a],
          ab = opened.artboards[a];
        assert(ab.name === "SOURCE_" + number, "Wrong page name");
        var found = 0;
        for (var k = 0; k < opened.pageItems.length; k++) {
          var it = opened.pageItems[k];
          if (it.name === "PON_" + number) {
            assert(
              Math.abs(it.geometricBounds[0] - ab.artboardRect[0] + 2) < 0.01,
              "PON shifted",
            );
            found++;
          }
          if (
            it.name === "NOTE_" + number ||
            it.name === (number === 1 ? "RASTER_1" : "COLOR_" + number)
          )
            found++;
        }
        assert(found === 3, "Missing body/PON/note");
      }
      result.outputs.push({
        baseName: names[j],
        ai: ai.fsName,
        jpg: jpg.fsName,
        boards: opened.artboards.length,
        profile: opened.colorProfileName,
        width300: ((bounds[2] - bounds[0]) * 300) / 72,
        height300: ((bounds[1] - bounds[3]) * 300) / 72,
      });
      opened.close(SaveOptions.DONOTSAVECHANGES);
      opened = null;
      owned.activate();
    }
    assert(before === snapshot(owned), "Source changed after reopen/errors");
    result.passed = true;
  } catch (e) {
    result.error = String(e) + " [line " + e.line + "]";
  } finally {
    if (opened) {
      opened.activate();
      opened.close(SaveOptions.DONOTSAVECHANGES);
    }
    if (owned) {
      owned.activate();
      owned.close(SaveOptions.DONOTSAVECHANGES);
    }
    if (previous) previous.activate();
    if (oldPicker) dcChonThuMucLuuPDF = oldPicker;
    app.coordinateSystem = coords;
    app.userInteractionLevel = interaction;
    write("result.txt", result.toSource());
  }
  return result.toSource();
})();
