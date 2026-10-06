// Test Illustrator chỉ chạy khi chủ động bật: gán dcKtsTestSourceName đúng bằng tên tài liệu
// nguồn đang mở. Chỉ các bản nhân bản trong một tài liệu mới chưa lưu mới bị sửa.
$.evalFile(
  File(
    "C:/Users/ADMIN/Downloads/DanCard_Setup_23/DanCardCEP/jsx/dan_card_lib.jsx",
  ),
);
$.evalFile(
  File(
    "C:/Users/ADMIN/Downloads/DanCard_Setup_23/DanCardCEP/jsx/dan_be_bridge.jsx",
  ),
);
(function () {
  var previous = app.activeDocument,
    oldCoordinates = app.coordinateSystem,
    testDoc = null;
  var sourceDoc = null,
    sourceLayer = null,
    i,
    j,
    records = [],
    snapshots = [],
    resultRows = [];
  function fail(message) {
    throw new Error(message);
  }
  function near(a, b) {
    return Math.abs(a - b) < 0.02;
  }
  function contains(rect, bounds) {
    return (
      bounds[0] >= rect[0] - 0.02 &&
      bounds[2] <= rect[2] + 0.02 &&
      bounds[1] <= rect[1] + 0.02 &&
      bounds[3] >= rect[3] - 0.02
    );
  }
  try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    for (i = 0; i < app.documents.length; i++) {
      if (app.documents[i].name === dcKtsTestSourceName)
        sourceDoc = app.documents[i];
    }
    if (!sourceDoc) fail("Exact source document is not open.");
    for (i = 0; i < sourceDoc.layers.length; i++)
      if (sourceDoc.layers[i].name === "Layer 1")
        sourceLayer = sourceDoc.layers[i];
    if (!sourceLayer) fail("Missing source Layer 1.");
    var sourceBoardCount = sourceDoc.artboards.length,
      sourceLayerCount = sourceDoc.layers.length;
    for (i = 0; i < sourceLayer.pageItems.length; i++) {
      var it = sourceLayer.pageItems[i];
      if (it.typename !== "RasterItem" || it.parent !== sourceLayer) continue;
      var b = it.visibleBounds.slice(0);
      records.push({
        item: it,
        bounds: b,
        cx: (b[0] + b[2]) / 2,
        cy: (b[1] + b[3]) / 2,
      });
      snapshots.push({
        item: it,
        bounds: b,
        note: it.note,
        selected: it.selected,
      });
    }
    // File làm việc đang mở có thể chứa thêm các ví dụ khác. Chỉ sao chép bảy
    // hàng đầy đủ của khung 9.2 x 5.2 cm đã biết, bỏ qua các hàng không khớp cặp.
    // Đây là việc chọn dữ liệu mẫu, không phải phương án dự phòng trong bộ ghép cặp của code thật.
    var candidates = [],
      testRecords = [],
      MM = 2.834645669;
    for (i = 0; i < records.length; i++) {
      var rb = records[i].bounds;
      if (near(rb[2] - rb[0], 92 * MM) && near(rb[1] - rb[3], 52 * MM))
        candidates.push(records[i]);
    }
    candidates.sort(function (a, b) {
      return a.cx - b.cx;
    });
    if (!candidates.length) fail("Missing known-size source frames.");
    var leftX = candidates[0].cx,
      rows = [];
    for (i = 0; i < candidates.length; i++) {
      if (!near(candidates[i].cx, leftX)) continue;
      for (j = 0; j < candidates.length; j++) {
        if (
          candidates[j].bounds[0] >= candidates[i].bounds[2] &&
          near(candidates[j].cy, candidates[i].cy)
        ) {
          rows.push([candidates[i], candidates[j]]);
          break;
        }
      }
    }
    rows.sort(function (a, b) {
      return b[0].cy - a[0].cy;
    });
    if (rows.length < 7)
      fail(
        "Fewer than seven complete known-size source rows; refusing to guess.",
      );
    for (i = 0; i < 7; i++) {
      testRecords.push(rows[i][0]);
      testRecords.push(rows[i][1]);
    }
    var pairs = dcKtsPairSourceRecords(testRecords, 0.01);
    if (pairs.length !== 7) fail("Expected seven source pairs.");
    for (var mode = 0; mode < 2; mode++) {
      testDoc = app.documents.add(DocumentColorSpace.CMYK, 100, 100);
      var inputLayer = testDoc.layers[0];
      inputLayer.name = "KTS TEST INPUT";
      var selected = [];
      for (i = 0; i < pairs.length; i++) {
        var front = pairs[i].front.item.duplicate(
          inputLayer,
          ElementPlacement.PLACEATEND,
        );
        var back = pairs[i].back.item.duplicate(
          inputLayer,
          ElementPlacement.PLACEATEND,
        );
        front.note = "KTS_FRONT_" + i;
        back.note = "KTS_BACK_" + i;
        back.translate(0, i % 2 ? -0.02 : 0.02);
        selected.push(back);
        selected.push(front); // cố ý đảo thứ tự selection
      }
      testDoc.selection = selected;
      var result = dcDanToiUu("33", "35.4", true, mode === 1);
      if (result.indexOf("OK:") !== 0) fail(result);
      var frontLayer = null,
        backLayer = null;
      for (i = 0; i < testDoc.layers.length; i++) {
        if (testDoc.layers[i].name === "Dan toi uu - Mat truoc")
          frontLayer = testDoc.layers[i];
        if (testDoc.layers[i].name === "Dan toi uu - Mat sau")
          backLayer = testDoc.layers[i];
      }
      if (
        !frontLayer ||
        !backLayer ||
        frontLayer.pageItems.length !== backLayer.pageItems.length
      )
        fail("Native duplex counts mismatch.");
      var checked = 0;
      for (i = 0; i < frontLayer.pageItems.length; i++) {
        var f = frontLayer.pageItems[i],
          fb = f.visibleBounds,
          match = false,
          fi = -1;
        if (f.note.indexOf("KTS_FRONT_") !== 0)
          fail("Native back leaked into front layer.");
        for (j = 0; j < testDoc.artboards.length; j += 2)
          if (contains(testDoc.artboards[j].artboardRect, fb)) {
            fi = j;
            break;
          }
        if (fi < 0) fail("Native front outside its artboard.");
        var fr = testDoc.artboards[fi].artboardRect,
          br = testDoc.artboards[fi + 1].artboardRect;
        var targetX = br[0] + fr[2] - (fb[0] + fb[2]) / 2;
        var targetY = br[1] - fr[1] + (fb[1] + fb[3]) / 2;
        var expectedNote = f.note.replace("KTS_FRONT_", "KTS_BACK_");
        for (j = 0; j < backLayer.pageItems.length; j++) {
          var backItem = backLayer.pageItems[j],
            bb = backItem.visibleBounds;
          if (
            backItem.note === expectedNote &&
            contains(br, bb) &&
            near((bb[0] + bb[2]) / 2, targetX) &&
            near((bb[1] + bb[3]) / 2, targetY)
          ) {
            match = true;
            break;
          }
        }
        if (!match) fail("Native duplex identity/mirrored centre mismatch.");
        checked++;
      }
      if (testDoc.artboards.length !== (mode ? 2 : 14))
        fail("Native per-model/mixed artboard count mismatch.");
      for (i = 0; i < backLayer.pageItems.length; i++)
        if (backLayer.pageItems[i].note.indexOf("KTS_BACK_") !== 0)
          fail("Front leaked into back layer.");
      resultRows.push({
        mode: mode ? "mixed" : "separate",
        checkedDuplexSlots: checked,
        artboards: testDoc.artboards.length,
      });
      testDoc.close(SaveOptions.DONOTSAVECHANGES);
      testDoc = null;
    }
    if (
      sourceDoc.artboards.length !== sourceBoardCount ||
      sourceDoc.layers.length !== sourceLayerCount
    )
      fail("Source structure changed.");
    for (i = 0; i < snapshots.length; i++) {
      var snap = snapshots[i],
        now = snap.item.visibleBounds;
      for (j = 0; j < 4; j++)
        if (!near(now[j], snap.bounds[j])) fail("Source geometry changed.");
      if (snap.item.note !== snap.note || snap.item.selected !== snap.selected)
        fail("Source note/selection changed.");
    }
    var auditFile = File(
      "C:/Users/ADMIN/Downloads/DanCard_Setup_23/tmp/kts_native_pairs_2_15_2.json",
    );
    auditFile.encoding = "UTF-8";
    if (!auditFile.open("w")) fail("Cannot write generated native audit.");
    auditFile.write(dcDanBeJSON.stringify(resultRows));
    auditFile.close();
    return dcDanBeJSON.stringify(resultRows) + " | Original source unchanged.";
  } finally {
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
