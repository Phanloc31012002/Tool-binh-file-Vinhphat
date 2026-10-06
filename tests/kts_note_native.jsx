// Test hồi quy sao chép ghi chú trong Illustrator thật: chỉ sửa các tài liệu tự dựng của riêng nó.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var folder = new Folder(root + "/tmp/kts_notes_20261003");
  if (!folder.exists) folder.create();
  var original = app.documents.length ? app.activeDocument : null;
  var oldCoordinates = app.coordinateSystem,
    owned = null,
    result = { cases: [] };
  var lib = File(root + "/DanCardCEP/jsx/dan_card_lib.jsx");
  lib.encoding = "UTF-8";
  lib.open("r");
  var text = lib.read();
  lib.close();
  eval(
    text.substring(
      text.indexOf("function dcCopyToiUuNoteToOddArtboards("),
      text.indexOf("// Pure geometry: lock left/right roles"),
    ),
  );
  function fail(s) {
    throw new Error(s);
  }
  function near(a, b) {
    return Math.abs(a - b) < 0.03;
  }
  try {
    for (var mode = 0; mode < 5; mode++) {
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      var count = 5;
      if (mode === 1) count = 6;
      if (mode === 3) count = 1;
      owned = app.documents.add(DocumentColorSpace.CMYK, 400, 220, count);
      for (var i = 0; i < count; i++)
        owned.artboards[i].artboardRect = [
          -4000 + i * 500,
          5000,
          -3600 + i * 500,
          4780,
        ];
      var layer = owned.layers[0];
      layer.name = "NOTES_TEST";
      var group = layer.groupItems.add();
      var icon = group.pathItems.rectangle(4975, -3980, 8, 8);
      icon.stroked = false;
      var frame = group.textFrames.add();
      frame.contents = "Ghi chu chung";
      frame.position = [-3960, 4975];
      frame.textRange.characterAttributes.size = 11;
      owned.selection = null;
      group.selected = true;
      owned.artboards.setActiveArtboardIndex(Math.min(2, count - 1));
      app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
      var prefixes = "";
      if (mode === 0) prefixes = "F1,F2,F3,F4,F5";
      if (mode === 1) prefixes = "F1,F2,F3";
      if (mode === 3) prefixes = "F1";
      if (mode === 4) prefixes = "F1,F2";
      var status =
        mode === 1
          ? dcCopyToiUuNoteToOddArtboards(prefixes)
          : dcCopyToiUuNoteToAllArtboards(prefixes);
      var restored =
        app.coordinateSystem === CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      var entry = {
        mode: mode,
        status: status,
        coordinateRestored: restored,
        notes: [],
      };
      for (var t = 0; t < owned.textFrames.length; t++) {
        var tf = owned.textFrames[t],
          b = tf.visibleBounds;
        var cx = (b[0] + b[2]) / 2,
          cy = (b[1] + b[3]) / 2,
          board = -1;
        for (var a = 0; a < count; a++) {
          var r = owned.artboards[a].artboardRect;
          if (cx >= r[0] && cx <= r[2] && cy <= r[1] && cy >= r[3]) board = a;
        }
        entry.notes.push({
          board: board,
          text: tf.contents,
          size: tf.textRange.characterAttributes.size,
          left: b[0] - owned.artboards[board].artboardRect[0],
          top: b[1] - owned.artboards[board].artboardRect[1],
        });
      }
      entry.notes.sort(function (a, b) {
        return a.board - b.board;
      });
      entry.icons = owned.pathItems.length;
      if (mode === 4) {
        if (
          status.indexOf("ERR:") !== 0 ||
          owned.textFrames.length !== 1 ||
          frame.contents !== "Ghi chu chung"
        )
          fail("Invalid prefixes changed source");
      } else {
        if (status.indexOf("OK:") !== 0) fail(status);
        var expected = mode === 1 ? 3 : count;
        if (entry.notes.length !== expected || entry.icons !== expected)
          fail("Wrong note/icon count");
        for (var n = 0; n < entry.notes.length; n++) {
          var note = entry.notes[n];
          if (note.board !== (mode === 1 ? n * 2 : n))
            fail("Wrong destination artboard");
          var wanted =
            mode === 2 ? "Ghi chu chung" : "F" + (n + 1) + " - Ghi chu chung";
          if (note.text !== wanted || note.size !== 11)
            fail("Content/style changed");
          if (
            !near(note.left, entry.notes[0].left) ||
            !near(note.top, entry.notes[0].top)
          )
            fail("Relative position drift");
        }
      }
      if (!restored) fail("Coordinates not restored");
      result.cases.push(entry);
      if (mode === 0) {
        var opt = new ImageCaptureOptions();
        opt.resolution = 72;
        opt.antiAliasing = true;
        opt.transparency = false;
        owned.imageCapture(
          new File(folder.fsName + "/one-sided.png"),
          [-4000, 5000, -1600, 4780],
          opt,
        );
      }
      owned.close(SaveOptions.DONOTSAVECHANGES);
      owned = null;
    }
    result.passed = true;
  } catch (e) {
    result.error = String(e);
  } finally {
    if (owned) {
      owned.activate();
      owned.close(SaveOptions.DONOTSAVECHANGES);
    }
    if (original) original.activate();
    app.coordinateSystem = oldCoordinates;
    var out = File(folder.fsName + "/result.txt");
    out.encoding = "UTF-8";
    out.open("w");
    out.write(result.toSource());
    out.close();
  }
  return result.toSource();
})();
