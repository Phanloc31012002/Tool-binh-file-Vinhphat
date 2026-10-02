// Opt-in Illustrator API integration test. All work is in new unsaved docs.
// No open user artwork or saved AI fixture is edited or overwritten.
$.evalFile(File('C:/Users/ADMIN/Downloads/DanCard_Setup_23/DanCardCEP/jsx/dan_be_bridge.jsx'));
(function () {
  var previous = app.documents.length ? app.activeDocument : null;
  var oldCoordinates = app.coordinateSystem, doc = null, jobId = null, rows = [];
  var MM = 2.834645669, paperW = 330 * MM, paperH = 354 * MM;
  function fail(message) { throw new Error(message); }
  function near(a, b) { return Math.abs(a - b) < .02; }
  function centre(b) { return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; }
  function directCount(layer) {
    var count = 0;
    for (var i = 0; i < layer.pageItems.length; i++) if (layer.pageItems[i].parent === layer) count++;
    return count;
  }
  function findLayer(name) {
    for (var i = 0; i < doc.layers.length; i++) if (doc.layers[i].name === name) return doc.layers[i];
    var observed = [];
    for (var li = 0; li < doc.layers.length; li++) observed.push(doc.layers[li].name);
    fail('Missing native layer ' + name + ' | observed=' + observed.join(' / '));
  }
  function itemAt(layer, name, x, y, useLeftBottom) {
    for (var i = 0; i < layer.pageItems.length; i++) {
      var it = layer.pageItems[i]; if (it.parent !== layer || it.name !== name) continue;
      var b = it.geometricBounds, p = useLeftBottom ? [b[0], b[3]] : centre(b);
      if (near(p[0], x) && near(p[1], y)) return it;
    }
    fail('Missing native item/position: ' + name);
  }
  function artwork(layer, left, top, w, h, name, role) {
    var group = layer.groupItems.add(); group.name = name;
    var frame = group.pathItems.rectangle(top, left, w, h);
    frame.filled = true; frame.stroked = false;
    var white = new CMYKColor(); frame.fillColor = white;
    var mark = group.pathItems.add(); mark.name = 'direction-marker';
    mark.setEntirePath([[left + 2 * MM, top - 2 * MM], [left + 8 * MM, top - 3 * MM], [left + 4 * MM, top - 9 * MM]]);
    mark.closed = true; mark.filled = true; mark.stroked = false;
    var color = new CMYKColor(); color.cyan = role === 'front' ? 100 : 0; color.magenta = role === 'back' ? 100 : 0;
    mark.fillColor = color;
    return group;
  }
  function markerVector(group) {
    for (var i = 0; i < group.pathItems.length; i++) {
      if (group.pathItems[i].name !== 'direction-marker') continue;
      var pp = group.pathItems[i].pathPoints;
      return [pp[1].anchor[0] - pp[0].anchor[0], pp[1].anchor[1] - pp[0].anchor[1]];
    }
    fail('Missing direction marker.');
  }
  try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    for (var mode = 0; mode < 2; mode++) {
      doc = app.documents.add(DocumentColorSpace.CMYK, 250 * MM, 250 * MM);
      var inputLayer = doc.layers[0]; inputLayer.name = 'NATIVE TAG INPUT';
      var selected = [], originalVectors = [];
      for (var mi = 0; mi < 2; mi++) {
        var left = 10 * MM, top = (220 - mi * 80) * MM;
        var shape = mi ? [[0, 0], [45, 0], [38, 25], [4, 20]] :
          [[0, 0], [20, 0], [20, 10], [5, 10], [5, 30], [0, 30]];
        var w = (mi ? 45 : 20) * MM, h = (mi ? 25 : 30) * MM;
        var cut = inputLayer.pathItems.add(); cut.name = 'CUT_' + mi;
        var points = []; for (var pi = 0; pi < shape.length; pi++) points.push([left + shape[pi][0] * MM, top - h + shape[pi][1] * MM]);
        cut.setEntirePath(points); cut.closed = true; cut.filled = false; cut.stroked = true; cut.strokeWidth = .25;
        var front = artwork(inputLayer, 85 * MM, top + .5 * MM, w + MM, h + MM, 'FRONT_' + mi, 'front');
        var back = artwork(inputLayer, 165 * MM, top + .5 * MM + .02, w + MM, h + MM, 'BACK_' + mi, 'back');
        originalVectors.push(markerVector(back)); selected.push(back); selected.push(cut); selected.push(front);
      }
      doc.selection = selected;
      var models = dcDanBeTripleModels(doc.selection, .01);
      if (models.length !== 2) fail('Native triples were not resolved.');
      for (mi = 0; mi < models.length; mi++) if (models[mi].khuon.item.name !== 'CUT_' + mi ||
          models[mi].bai.item.name !== 'FRONT_' + mi || models[mi].sau.item.name !== 'BACK_' + mi) fail('Native triple roles inverted.');
      var nativeParams = mode ? ['32', '34', '12', '15', '11', '16'] : ['33', '35.4', '10', '10', '10', '10'];
      var prepared = dcDanBePrepare('2', '4', '7.5', true, nativeParams[0], nativeParams[1],
        nativeParams[2], nativeParams[3], nativeParams[4], nativeParams[5]);
      if (prepared.indexOf('OKJSON:') !== 0) fail(prepared);
      var payload = dcDanBeJSON.parse(prepared.substring(7)); jobId = payload.jobId;
      var nativeJob = dcDanBeJobs[jobId], dots = nativeJob.pon.dots, di;
      paperW = nativeJob.paperW; paperH = nativeJob.paperH;
      if (!near(paperW, Number(nativeParams[0]) * 10 * MM) || !near(paperH, Number(nativeParams[1]) * 10 * MM))
        fail('Native custom paper size mismatch.');
      for (di = 0; di < dots.length; di++) if (!near(dots[di].r, 2.5 * MM)) fail('Native auto PON diameter is not 5 mm.');
      var expectedDots = [[Number(nativeParams[4]), Number(nativeParams[1]) * 10 - Number(nativeParams[2])],
        [Number(nativeParams[0]) * 10 - Number(nativeParams[5]), Number(nativeParams[1]) * 10 - Number(nativeParams[2])],
        [Number(nativeParams[4]), Number(nativeParams[3])],
        [Number(nativeParams[0]) * 10 - Number(nativeParams[5]), Number(nativeParams[3])]];
      for (di = 0; di < 4; di++) if (!near(dots[di].cx, expectedDots[di][0] * MM) ||
          !near(dots[di].cy, expectedDots[di][1] * MM)) fail('Native auto PON centre offset mismatch.');
      var plans = [], mixedSlots = [];
      for (mi = 0; mi < 2; mi++) {
        var slots = [];
        for (var vi = 0; vi < 4; vi++) {
          var slot = { mi: mi, vi: vi, x: 25 + vi * 70, y: 35 + mi * 80 }; slots.push(slot); mixedSlots.push(slot);
        }
        plans.push({ modelIndex: mi, slots: slots });
      }
      var result = dcDanBeRender(jobId, dcDanBeJSON.stringify(mode ? mixedSlots : { sheets: plans }), '{}');
      if (result.indexOf('OK:') !== 0) fail(result);
      var sheetCount = mode ? 1 : 2, checked = 0;
      if (doc.artboards.length !== 1 + sheetCount * 2) fail('Native duplex artboard count mismatch.');
      for (var si = 0; si < sheetCount; si++) {
        var suffix = mode ? '' : ' - mẫu ' + (si + 1);
        var frontCuts = findLayer('Dàn bế - Khuôn' + suffix + ' - mặt trước');
        var backCuts = findLayer('Dàn bế - Khuôn' + suffix + ' - mặt sau');
        var frontArts = findLayer('Dàn bế - Bài' + suffix + ' - mặt trước');
        var backArts = findLayer('Dàn bế - Bài' + suffix + ' - mặt sau');
        var frontPon = findLayer('Dàn bế - PON' + suffix + ' - mặt trước');
        var backPon = findLayer('Dàn bế - PON' + suffix + ' - mặt sau');
        var fr = doc.artboards[1 + si * 2].artboardRect, br = doc.artboards[2 + si * 2].artboardRect;
        if (si === 0 && (!near(fr[0], -7200 + 10 * MM) || !near(fr[1], 7200 - 10 * MM)))
          fail('First sheet does not begin at the KTS canvas position.');
        if (!near(br[0] - fr[2], 10 * MM)) fail('Native duplex sheet gap differs from KTS.');
        if (!near(fr[2] - fr[0], paperW) || !near(fr[1] - fr[3], paperH)) fail('Native artboard size mismatch.');
        var faceSlots = mode ? mixedSlots : plans[si].slots;
        if (directCount(frontCuts) !== faceSlots.length || directCount(backCuts) !== faceSlots.length ||
            directCount(frontArts) !== faceSlots.length || directCount(backArts) !== faceSlots.length)
          fail('Native duplex item count mismatch.');
        for (var i = 0; i < faceSlots.length; i++) {
          var s = faceSlots[i], fk = itemAt(frontCuts, 'CUT_' + s.mi, fr[0] + s.x * MM, fr[3] + s.y * MM, true);
          var fc = centre(fk.geometricBounds), bx = br[0] + paperW - (fc[0] - fr[0]), by = br[3] + fc[1] - fr[3];
          var bk = itemAt(backCuts, 'CUT_' + s.mi, bx, by, false);
          var fa = itemAt(frontArts, 'FRONT_' + s.mi, fc[0], fc[1], false);
          var ba = itemAt(backArts, 'BACK_' + s.mi, bx, by, false);
          if (fk.pathPoints.length !== bk.pathPoints.length) fail('Native cut vertex count changed.');
          for (pi = 0; pi < fk.pathPoints.length; pi++) {
            var fp = fk.pathPoints[pi].anchor, bp = bk.pathPoints[pi].anchor;
            if (!near(bp[0] - br[0], paperW - (fp[0] - fr[0])) || !near(bp[1] - br[3], fp[1] - fr[3])) fail('Native asymmetric cut reflection mismatch.');
          }
          var vector = markerVector(ba), original = originalVectors[s.mi], angle = -s.vi * Math.PI / 2;
          var vx = original[0] * Math.cos(angle) - original[1] * Math.sin(angle);
          var vy = original[0] * Math.sin(angle) + original[1] * Math.cos(angle);
          if (!near(vector[0], vx) || !near(vector[1], vy)) fail('Native back artwork was mirrored or rotated incorrectly.');
          checked++;
        }
        if (frontPon.pageItems.length !== 4 || backPon.pageItems.length !== 4) fail('Native PON count mismatch.');
        for (di = 0; di < dots.length; di++) {
          itemAt(frontPon, frontPon.pageItems[0].name, fr[0] + dots[di].cx, fr[3] + dots[di].cy, false);
          var bd = itemAt(backPon, backPon.pageItems[0].name, br[0] + paperW - dots[di].cx, br[3] + dots[di].cy, false);
          var db = bd.geometricBounds; if (!near((db[2] - db[0]) / 2, dots[di].r)) fail('Native PON was resized.');
        }
      }
      rows.push({ mode: mode ? 'mixed' : 'separate', artboards: sheetCount * 2, checkedPhysicalTags: checked,
        asymmetricCutReflection: true, unmirroredBackArtwork: true, ponPerFace: 4,
        autoPonDiameterMm: 5, paperCm: [nativeParams[0], nativeParams[1]], firstPositionMatchesKts: true });
      doc.close(SaveOptions.DONOTSAVECHANGES); doc = null; jobId = null;
    }
    var output = File('C:/Users/ADMIN/Downloads/DanCard_Setup_23/tmp/dan_be_duplex_native_2_15_4_audit.json');
    output.encoding = 'UTF-8'; if (!output.open('w')) fail('Cannot write generated native audit.');
    output.write(dcDanBeJSON.stringify(rows)); output.close();
    return dcDanBeJSON.stringify(rows);
  } finally {
    try { if (jobId) delete dcDanBeJobs[jobId]; } catch (jobError) {}
    try { if (doc) doc.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {}
    try { if (previous) previous.activate(); } catch (activateError) {}
    try { app.coordinateSystem = oldCoordinates; } catch (coordinateError) {}
  }
})();
