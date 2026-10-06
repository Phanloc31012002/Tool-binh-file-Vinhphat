// Test tích hợp trong Illustrator thật, chỉ chạy khi chủ động bật. Tiến trình cha chạy nó qua COM.
// Mọi thay đổi chỉ nằm trong một tài liệu test mới, riêng, chưa lưu. Tài liệu người dùng
// đang mở chỉ được đọc để chụp snapshot, không bao giờ bị chọn, sửa, lưu hay đóng.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var MM = 2.834645669,
    EPS = 0.025;
  var previous = app.documents.length ? app.activeDocument : null;
  var oldCoordinates = app.coordinateSystem;
  var oldInteraction = app.userInteractionLevel;
  var doc = null,
    jobId = null,
    originalDocs = [],
    originalSelections = [];
  var report = {
    passed: false,
    rows: [],
    output: root + "/tmp/dan_be_centered_native.png",
  };
  function fail(message) {
    throw Error(message);
  }
  function assert(value, message) {
    if (!value) fail(message);
  }
  function near(a, b) {
    return Math.abs(a - b) < EPS;
  }
  function copy(a) {
    return a.slice(0);
  }
  function centre(b) {
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  }
  function readUtf8(path) {
    var f = new File(path);
    f.encoding = "UTF-8";
    if (!f.open("r")) fail("Cannot read " + path);
    var content = f.read();
    f.close();
    return content;
  }
  function selectionArray(d) {
    var selected = d.selection,
      out = [];
    if (!selected) return out;
    if (typeof selected.length === "undefined") return [selected];
    for (var i = 0; i < selected.length; i++) out.push(selected[i]);
    return out;
  }
  function selectedState(item) {
    var state = { type: item.typename };
    try {
      state.name = item.name;
    } catch (ignoreName) {}
    try {
      state.bounds = copy(item.geometricBounds);
    } catch (ignoreBounds) {}
    try {
      state.hidden = item.hidden;
      state.locked = item.locked;
    } catch (ignoreFlags) {}
    return state;
  }
  function documentState(d) {
    var state = {
      name: d.name,
      saved: d.saved,
      itemCount: d.pageItems.length,
      layers: [],
      boards: [],
      selected: [],
      activeBoard: d.artboards.getActiveArtboardIndex(),
    };
    for (var li = 0; li < d.layers.length; li++) {
      var l = d.layers[li];
      state.layers.push([
        l.name,
        l.visible,
        l.locked,
        l.pageItems.length,
        l.layers.length,
      ]);
    }
    for (var bi = 0; bi < d.artboards.length; bi++)
      state.boards.push([
        d.artboards[bi].name,
        copy(d.artboards[bi].artboardRect),
      ]);
    var selected = selectionArray(d);
    for (var si = 0; si < selected.length; si++)
      state.selected.push(selectedState(selected[si]));
    return state;
  }
  function userSnapshot() {
    var out = [];
    for (var di = 0; di < app.documents.length; di++)
      out.push(documentState(app.documents[di]));
    return dcDanBeJSON.stringify(out);
  }
  function originalIdentityUnchanged() {
    if (app.documents.length !== originalDocs.length) return false;
    for (var di = 0; di < originalDocs.length; di++) {
      if (app.documents[di] !== originalDocs[di]) return false;
      var selected = selectionArray(originalDocs[di]),
        expected = originalSelections[di];
      if (selected.length !== expected.length) return false;
      for (var si = 0; si < expected.length; si++)
        if (selected[si] !== expected[si]) return false;
    }
    return !previous || app.activeDocument === previous;
  }
  function guardOwned() {
    assert(
      doc && app.activeDocument === doc,
      "Active document is not the owned native fixture",
    );
    for (var di = 0; di < originalDocs.length; di++)
      assert(
        doc !== originalDocs[di],
        "Refusing to mutate an original user document",
      );
  }
  function closeOwned() {
    if (!doc) return;
    for (var di = 0; di < originalDocs.length; di++)
      assert(doc !== originalDocs[di], "Refusing to close a user document");
    for (var ai = 0; ai < app.documents.length; ai++)
      if (app.documents[ai] === doc) {
        doc.close(SaveOptions.DONOTSAVECHANGES);
        break;
      }
    doc = null;
  }
  function sourceState(items) {
    var out = [];
    for (var i = 0; i < items.length; i++) out.push(selectedState(items[i]));
    return dcDanBeJSON.stringify(out);
  }
  function capPath(container, left, bottom, name, filled, color) {
    guardOwned();
    var p = container.pathItems.add();
    p.name = name;
    var anchors = [],
      i;
    for (i = 0; i < nodes.length; i++)
      anchors.push([left + nodes[i].a[0] * MM, bottom + nodes[i].a[1] * MM]);
    p.setEntirePath(anchors);
    p.closed = true;
    for (i = 0; i < nodes.length; i++) {
      var pp = p.pathPoints[i];
      pp.leftDirection = [
        left + nodes[i].l[0] * MM,
        bottom + nodes[i].l[1] * MM,
      ];
      pp.rightDirection = [
        left + nodes[i].r[0] * MM,
        bottom + nodes[i].r[1] * MM,
      ];
    }
    p.filled = filled;
    p.stroked = !filled;
    if (filled) p.fillColor = color;
    else {
      p.strokeWidth = 0.25;
      var k = new CMYKColor();
      k.black = 100;
      p.strokeColor = k;
    }
    return p;
  }
  function artwork(layer, left, bottom, name, back) {
    var g = layer.groupItems.add();
    g.name = name;
    var fill = new CMYKColor();
    fill.cyan = back ? 0 : 75;
    fill.magenta = back ? 75 : 0;
    fill.yellow = back ? 5 : 35;
    capPath(g, left, bottom, "artwork-cap", true, fill);
    var marker = g.pathItems.add();
    marker.name = "direction-marker";
    marker.setEntirePath([
      [left + 12 * MM, bottom + 22 * MM],
      [left + 19 * MM, bottom + 20 * MM],
      [left + 15 * MM, bottom + 14 * MM],
    ]);
    marker.closed = true;
    marker.filled = true;
    marker.stroked = false;
    var white = new CMYKColor();
    marker.fillColor = white;
    return g;
  }
  function markerVectors(group) {
    for (var pi = 0; pi < group.pathItems.length; pi++) {
      var p = group.pathItems[pi];
      if (p.name !== "direction-marker") continue;
      var pp = p.pathPoints,
        a = pp[0].anchor,
        b = pp[1].anchor,
        c = pp[2].anchor;
      return [
        [b[0] - a[0], b[1] - a[1]],
        [c[0] - a[0], c[1] - a[1]],
      ];
    }
    fail("Missing direction marker");
  }
  function rotatedVector(v, degrees) {
    var a = (degrees * Math.PI) / 180;
    return [
      v[0] * Math.cos(a) - v[1] * Math.sin(a),
      v[0] * Math.sin(a) + v[1] * Math.cos(a),
    ];
  }
  function checkArtworkDirection(group, original, angle, label) {
    var vectors = markerVectors(group);
    for (var i = 0; i < 2; i++) {
      var target = rotatedVector(original[i], angle);
      assert(
        near(vectors[i][0], target[0]) && near(vectors[i][1], target[1]),
        label + " rotation mismatch",
      );
    }
    var originalHand =
      original[0][0] * original[1][1] - original[0][1] * original[1][0];
    var outputHand =
      vectors[0][0] * vectors[1][1] - vectors[0][1] * vectors[1][0];
    assert(near(originalHand, outputHand), label + " artwork was mirrored");
  }
  function layerNamed(name) {
    for (var li = 0; li < doc.layers.length; li++)
      if (doc.layers[li].name === name) return doc.layers[li];
    fail("Missing output layer " + name);
  }
  // Đọc bounds từ Illustrator một lần cho mỗi item kết quả, rồi so khớp bằng các số đã cache.
  function records(layer, visible) {
    var out = [];
    for (var pi = 0; pi < layer.pageItems.length; pi++) {
      var it = layer.pageItems[pi];
      if (it.parent === layer)
        out.push({
          item: it,
          bounds: copy(visible ? it.visibleBounds : it.geometricBounds),
        });
    }
    return out;
  }
  function itemAt(items, x, y, bottomLeft) {
    for (var i = 0; i < items.length; i++) {
      var b = items[i].bounds,
        p = bottomLeft ? [b[0], b[3]] : centre(b);
      if (near(p[0], x) && near(p[1], y)) return items[i];
    }
    fail("No output item at the expected slot");
  }
  function insideMargin(rect, bounds) {
    return (
      bounds[0] >= rect[0] + 4 * MM - EPS &&
      bounds[2] <= rect[2] - 4 * MM + EPS &&
      bounds[1] <= rect[1] - 4 * MM + EPS &&
      bounds[3] >= rect[3] + 4 * MM - EPS
    );
  }
  function checkBlockCentre(items, rect) {
    var b = [Infinity, -Infinity, -Infinity, Infinity],
      i,
      r;
    for (i = 0; i < items.length; i++) {
      r = items[i].bounds;
      b[0] = Math.min(b[0], r[0]);
      b[1] = Math.max(b[1], r[1]);
      b[2] = Math.max(b[2], r[2]);
      b[3] = Math.min(b[3], r[3]);
    }
    assert(
      near((b[0] + b[2]) / 2, (rect[0] + rect[2]) / 2) &&
        near((b[1] + b[3]) / 2, (rect[1] + rect[3]) / 2),
      "Physical output block is not centred on its artboard",
    );
    return {
      left: (b[0] - rect[0]) / MM,
      right: (rect[2] - b[2]) / MM,
      top: (rect[1] - b[1]) / MM,
      bottom: (b[3] - rect[3]) / MM,
    };
  }
  function checkPon(items, rect, dots, back, paperW) {
    assert(items.length === 4, "PON count must be four per face");
    for (var di = 0; di < dots.length; di++) {
      var x = back ? paperW - dots[di].cx : dots[di].cx;
      var item = itemAt(items, rect[0] + x, rect[3] + dots[di].cy, false);
      assert(
        near(item.bounds[2] - item.bounds[0], 5 * MM) &&
          near(item.bounds[1] - item.bounds[3], 5 * MM),
        "PON diameter changed",
      );
    }
  }
  // eval UTF-8 chỉ nằm trong phạm vi IIFE này; nó không thể thay thế các biến toàn cục
  // của engine panel hay đọc/sửa bài đang mở của người dùng thông qua bước chuẩn bị test.
  eval(readUtf8(root + "/DanCardCEP/jsx/dan_be_bridge.jsx"));
  var nodeLiteral = readUtf8(root + "/tests/dan_be_cap_fixture.js").match(
    /const nodes = ([\s\S]+?);\s*function cap/,
  );
  assert(nodeLiteral, "Missing portable seven-node curve fixture");
  var nodes = eval("(" + nodeLiteral[1] + ")");
  var data = dcDanBeJSON.parse(
    readUtf8(root + "/tmp/dan_be_alternating_native_plan.json"),
  );
  assert(
    data.slots && data.slots.length === data.count && data.count === 94,
    "Native integration requires the independently checked 94-slot plan",
  );
  for (var odi = 0; odi < app.documents.length; odi++) {
    originalDocs.push(app.documents[odi]);
    originalSelections.push(selectionArray(app.documents[odi]));
  }
  var before = userSnapshot();
  try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    for (var mode = 0; mode < 2; mode++) {
      doc = app.documents.add(DocumentColorSpace.CMYK, 330 * MM, 354 * MM);
      guardOwned();
      var inputLayer = doc.layers[0];
      inputLayer.name = "NATIVE CURVED CAP SOURCE";
      var cut = capPath(
        inputLayer,
        10 * MM,
        260 * MM,
        "NATIVE_CAP_CUT",
        false,
        null,
      );
      var front = artwork(
        inputLayer,
        95 * MM,
        260 * MM,
        "NATIVE_CAP_FRONT",
        false,
      );
      var back = mode
        ? artwork(inputLayer, 180 * MM, 260 * MM, "NATIVE_CAP_BACK", true)
        : null;
      var sources = mode ? [cut, front, back] : [cut, front];
      var originalSource = sourceState(sources);
      var cutBounds = copy(cut.geometricBounds);
      var sourceW = cutBounds[2] - cutBounds[0],
        sourceH = cutBounds[1] - cutBounds[3];
      assert(
        Math.abs(sourceW / MM - 53.0009035168) < 0.025 &&
          Math.abs(sourceH / MM - 26.5116043437) < 0.025,
        "Curved source die dimensions changed",
      );
      var frontVectors = markerVectors(front),
        backVectors = mode ? markerVectors(back) : null;
      doc.selection = mode ? [back, cut, front] : [front, cut];
      guardOwned();
      var prepared = dcDanBePrepare(
        "1",
        "4",
        "7.5",
        mode === 1,
        "33",
        "35.4",
        "10",
        "10",
        "10",
        "10",
      );
      guardOwned();
      assert(prepared.indexOf("OKJSON:") === 0, prepared);
      var payload = dcDanBeJSON.parse(prepared.substring(7));
      jobId = payload.jobId;
      var job = dcDanBeJobs[jobId];
      assert(
        job.doc === doc &&
          job.models.length === 1 &&
          job.models[0].khuon.item === cut &&
          job.models[0].bai.item === front &&
          (!mode || job.models[0].sau.item === back),
        "Left-to-right native source roles were not fixed correctly",
      );
      assert(
        near(job.gap, MM) &&
          near(job.margin, 4 * MM) &&
          near(job.ponClear, 7.5 * MM),
        "Native physical clearance inputs changed",
      );
      var paperW = job.paperW,
        paperH = job.paperH,
        dots = job.pon.dots;
      assert(
        near(paperW, 330 * MM) && near(paperH, 354 * MM),
        "Native paper size mismatch",
      );
      var result = dcDanBeRender(
        jobId,
        dcDanBeJSON.stringify(data.slots),
        "{}",
      );
      jobId = null;
      guardOwned();
      assert(result.indexOf("OK:[[COUNT:94]]") === 0, result);
      assert(
        doc.artboards.length === (mode ? 2 : 1),
        "Native result artboard count mismatch",
      );
      var suffix = mode ? " - mặt trước" : "";
      var frontCuts = records(layerNamed("Dàn bế - Khuôn" + suffix), false);
      var frontArts = records(layerNamed("Dàn bế - Bài" + suffix), true);
      var frontPon = records(layerNamed("Dàn bế - PON" + suffix), false);
      var fr = copy(doc.artboards[0].artboardRect),
        br = mode ? copy(doc.artboards[1].artboardRect) : null;
      var backCuts = mode
        ? records(layerNamed("Dàn bế - Khuôn - mặt sau"), false)
        : null;
      var backArts = mode
        ? records(layerNamed("Dàn bế - Bài - mặt sau"), true)
        : null;
      assert(
        frontCuts.length === data.count && frontArts.length === data.count,
        "Front native cut/art counts differ from the precomputed plan",
      );
      assert(
        near(fr[0], -7200 + 10 * MM) && near(fr[1], 7200 - 10 * MM),
        "First sheet is not at the KTS canvas origin",
      );
      assert(
        near(fr[2] - fr[0], paperW) && near(fr[1] - fr[3], paperH),
        "Front artboard dimensions mismatch",
      );
      checkPon(frontPon, fr, dots, false, paperW);
      var frontMargins = checkBlockCentre(frontCuts, fr),
        backMargins = null;
      if (mode) {
        assert(
          backCuts.length === data.count && backArts.length === data.count,
          "Back native counts mismatch",
        );
        assert(
          near(br[0] - fr[2], 10 * MM) &&
            near(br[2] - br[0], paperW) &&
            near(br[1] - br[3], paperH),
          "Back artboard size/gap mismatch",
        );
        checkPon(
          records(layerNamed("Dàn bế - PON - mặt sau"), false),
          br,
          dots,
          true,
          paperW,
        );
        backMargins = checkBlockCentre(backCuts, br);
      }
      for (var si = 0; si < data.slots.length; si++) {
        var s = data.slots[si],
          angle = s.vi * 90;
        assert(s.mi === 0 && s.angle === angle, "Plan rotation/index mismatch");
        var fk = itemAt(frontCuts, fr[0] + s.x * MM, fr[3] + s.y * MM, true);
        var fb = fk.bounds,
          fc = centre(fb),
          fa = itemAt(frontArts, fc[0], fc[1], false);
        var expectedW = s.vi % 2 ? sourceH : sourceW,
          expectedH = s.vi % 2 ? sourceW : sourceH;
        assert(
          near(fb[2] - fb[0], expectedW) && near(fb[1] - fb[3], expectedH),
          "Physical cut dimensions changed after rotation",
        );
        assert(
          insideMargin(fr, fb),
          "Front physical cut exceeds paper margins",
        );
        checkArtworkDirection(fa.item, frontVectors, angle, "Front");
        if (mode) {
          var bx = br[0] + paperW - (fc[0] - fr[0]),
            by = br[3] + fc[1] - fr[3];
          var bk = itemAt(backCuts, bx, by, false),
            ba = itemAt(backArts, bx, by, false);
          assert(
            near(bk.bounds[2] - bk.bounds[0], expectedW) &&
              near(bk.bounds[1] - bk.bounds[3], expectedH) &&
              insideMargin(br, bk.bounds),
            "Back physical die dimensions/margins mismatch",
          );
          assert(
            fk.item.pathPoints.length === 7 && bk.item.pathPoints.length === 7,
            "Native cubic contour node count changed",
          );
          for (var pi = 0; pi < 7; pi++) {
            var fp = fk.item.pathPoints[pi],
              bp = bk.item.pathPoints[pi];
            var pairs = [
              [fp.anchor, bp.anchor],
              [fp.leftDirection, bp.leftDirection],
              [fp.rightDirection, bp.rightDirection],
            ];
            for (var ni = 0; ni < pairs.length; ni++)
              assert(
                near(
                  pairs[ni][1][0] - br[0],
                  paperW - (pairs[ni][0][0] - fr[0]),
                ) && near(pairs[ni][1][1] - br[3], pairs[ni][0][1] - fr[3]),
                "Native curved cut reflection mismatch",
              );
          }
          checkArtworkDirection(
            ba.item,
            backVectors,
            -angle,
            "Back unmirrored",
          );
        }
      }
      assert(
        sourceState(sources) === originalSource &&
          records(inputLayer, false).length === sources.length,
        "Owned source shapes were changed or consumed by rendering",
      );
      if (!mode) {
        guardOwned();
        var capture = new ImageCaptureOptions();
        capture.resolution = 72;
        capture.antiAliasing = true;
        capture.transparency = false;
        doc.imageCapture(new File(report.output), fr, capture);
        assert(
          new File(report.output).exists,
          "Owned one-face PNG capture was not created",
        );
      }
      report.rows.push({
        mode: mode ? "two-face" : "one-face",
        count: data.count,
        artboards: doc.artboards.length,
        ponPerFace: 4,
        sourceMm: [sourceW / MM, sourceH / MM],
        checkedSlots: data.slots.length,
        physicalDimensionsUnchanged: true,
        artworkCentresMatch: true,
        artworkDirectionsMatch: true,
        unmirroredBackArtwork: mode === 1,
        originalOwnedSourcesUnchanged: true,
        physicalBlockCentred: true,
        frontMarginsMm: frontMargins,
        backMarginsMm: backMargins,
      });
      closeOwned();
    }
    report.passed = true;
  } catch (error) {
    report.error = String(error);
  } finally {
    try {
      if (jobId) delete dcDanBeJobs[jobId];
    } catch (jobError) {}
    try {
      closeOwned();
    } catch (closeError) {
      report.passed = false;
      report.closeError = String(closeError);
    }
    try {
      if (previous) previous.activate();
    } catch (activeError) {
      report.passed = false;
    }
    try {
      app.coordinateSystem = oldCoordinates;
    } catch (coordinatesError) {
      report.passed = false;
    }
    try {
      app.userInteractionLevel = oldInteraction;
    } catch (interactionError) {
      report.passed = false;
    }
  }
  report.originalDocumentsUnchanged =
    originalIdentityUnchanged() && userSnapshot() === before;
  report.originalApplicationStateRestored =
    app.coordinateSystem === oldCoordinates &&
    app.userInteractionLevel === oldInteraction &&
    (!previous || app.activeDocument === previous);
  if (
    !report.originalDocumentsUnchanged ||
    !report.originalApplicationStateRestored
  )
    report.passed = false;
  var output = new File(root + "/tmp/dan_be_centered_native_audit.json");
  output.encoding = "UTF-8";
  if (!output.open("w")) fail("Cannot write native integration audit");
  output.write(dcDanBeJSON.stringify(report));
  output.close();
  return dcDanBeJSON.stringify(report);
})();
