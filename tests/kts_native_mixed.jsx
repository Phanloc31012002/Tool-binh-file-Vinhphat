// Test hồi quy trong Illustrator thật, chỉ chạy khi chủ động bật: chỉ dùng tài liệu tự dựng; không bao giờ sửa file người dùng.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var folder = new Folder(
    root + "/tmp/kts_mixed_2.16.9_" + new Date().getTime(),
  );
  folder.create();
  var previous = app.documents.length ? app.activeDocument : null;
  var oldCoords = app.coordinateSystem,
    oldInteraction = app.userInteractionLevel;
  var owned = null,
    result = { passed: false, cases: [], folder: folder.fsName };
  var MM = 2.834645669,
    EPS = 0.1;
  function userDocumentsSnapshot() {
    var state = [];
    for(var di = 0; di < app.documents.length; di++) {
      var d = app.documents[di], boards = [];
      for(var ai = 0; ai < d.artboards.length; ai++) boards.push(d.artboards[ai].artboardRect.join(","));
      state.push(d.name+":"+d.saved+":"+d.pageItems.length+":"+d.layers.length+":"+boards.join("|"));
    }
    return state.join("\n");
  }
  var userStateBefore = userDocumentsSnapshot();
  function assert(value, message) {
    if (!value) throw Error(message);
  }
  function snapshot(items) {
    var values = [];
    for (var i = 0; i < items.length; i++)
      values.push(items[i].name + ":" + items[i].visibleBounds.join(","));
    return values.join("|");
  }
  function paint(c, m, y, k) {
    var v = new CMYKColor();
    v.cyan = c;
    v.magenta = m;
    v.yellow = y;
    v.black = k;
    return v;
  }
  function fixture(layer, name, x, top, w, h, model, back) {
    var g = layer.groupItems.add();
    g.name = name;
    assert(w > 0 && h > 0 && isFinite(top) && isFinite(x), "Invalid fixture dimensions: " + [top,x,w,h].join(","));
    var body;
    try { body = g.pathItems.rectangle(top, x, w, h); }
    catch(e) { throw Error("Fixture rectangle " + [top,x,w,h].join(",") + ": " + String(e)); }
    body.stroked = false;
    body.filled = true;
    var palette = [[80,0,0],[0,70,0],[0,0,85],[40,30,0],[0,20,50],[30,0,60],[0,45,80]];
    var ink = palette[model % palette.length];
    body.fillColor = paint(ink[0],ink[1],ink[2],back ? 25 : 0);
    var label = g.textFrames.add();
    label.contents = name;
    label.textRange.characterAttributes.size = 12;
    label.position = [x + 8, top - 10];
    var corner = g.pathItems.rectangle(top - 5, x + 5, 4, 4);
    corner.stroked = false;
    corner.filled = true;
    corner.fillColor = paint(0, 0, 0, 100);
    return g;
  }
  function noOverlap(items) {
    for (var i = 0; i < items.length; i++)
      for (var j = 0; j < i; j++) {
        var a = items[i].visibleBounds,
          b = items[j].visibleBounds;
        assert(
          a[2] <= b[0] + EPS ||
            b[2] <= a[0] + EPS ||
            a[3] >= b[1] - EPS ||
            b[3] >= a[1] - EPS,
          "Overlapping copies",
        );
      }
  }
  try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    var libFile = new File(root + "/DanCardCEP/jsx/dan_card_lib.jsx");
    libFile.encoding = "UTF-8";
    libFile.open("r");
    var libSource = libFile.read();
    libFile.close();
    eval(libSource);
    var nativeCases = [
      {name:"generic",specs:[[90,50],[60,40],[75,65]],unplaced:2},
      {name:"152_six",specs:[[152,72],[152,72],[152,72],[152,72],[152,72],[152,72],[92,56]],large:8,small:3},
      {name:"184_five",specs:[[184,56],[184,56],[184,56],[184,56],[184,56],[92,56]],large:8,small:3},
      {name:"184_six_portrait",specs:[[184,56],[184,56],[184,56],[184,56],[184,56],[184,56],[56,92]],large:8,small:3},
      {name:"184_overflow",specs:[[184,56],[184,56],[184,56],[184,56],[184,56],[184,56],[184,56],[184,56],[184,56],[92,56]],large:8,small:3,unplaced:1},
      {name:"184_single",specs:[[184,56],[92,56]],large:8,small:3}
    ];
    for (var nativeCase = 0; nativeCase < nativeCases.length*2; nativeCase++) {
      var sideCase = nativeCase % 2, definition = nativeCases[Math.floor(nativeCase/2)];
      owned = app.documents.add(DocumentColorSpace.CMYK, 900, 1100);
      owned.activate();
      app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      app.redraw();
      owned.selection = null;
      var sources = [], specs = definition.specs, top = 1000;
      var sourceLayer = owned.layers.add();
      sourceLayer.name = "MIXED_SOURCE";
      sourceLayer.locked = false;
      sourceLayer.visible = true;
      owned.activeLayer = sourceLayer;
      for (var m = 0; m < specs.length; m++) {
        sources.push(
          fixture(
            sourceLayer,
            "F" + m,
            0,
            top,
            specs[m][0] * MM,
            specs[m][1] * MM,
            m,
            false,
          ),
        );
        if (sideCase)
          sources.push(
            fixture(
              sourceLayer,
              "B" + m,
              800,
              top + (m % 2 ? 0.02 : -0.02),
              specs[m][0] * MM,
              specs[m][1] * MM,
              m,
              true,
            ),
          );
        top -= Math.max(specs[m][1] * MM, 200) + 100;
      }
      var sourceSnapshots = [];
      for(m = 0; m < sources.length; m++) sourceSnapshots.push(snapshot([sources[m]]));
      assert(app.activeDocument === owned, "Test lost its owned active document; refusing to render");
      owned.selection = sources.slice(0).reverse();
      var started = new Date().getTime();
      var status = dcDanToiUu("33", "35.4", sideCase === 1, true);
      assert(status.indexOf("OK:") === 0, status);
      assert(
        owned.artboards.length === (sideCase ? 2 : 1),
        "Wrong output artboard count",
      );
      var fronts = [],
        backs = [],
        counts = [],
        frontLayer = null,
        backLayer = null;
      for(m = 0; m < specs.length; m++) counts.push(0);
      for (var li = 0; li < owned.layers.length; li++) {
        var layer = owned.layers[li];
        if (layer.name === (sideCase ? "Dan toi uu - Mat truoc" : "Dan toi uu"))
          frontLayer = layer;
        if (layer.name === "Dan toi uu - Mat sau") backLayer = layer;
      }
      for (var pi = 0; pi < frontLayer.pageItems.length; pi++) {
        var f = frontLayer.pageItems[pi];
        if (f.parent === frontLayer && f.typename === "GroupItem")
          fronts.push(f);
      }
      if (backLayer)
        for (pi = 0; pi < backLayer.pageItems.length; pi++) {
          var b = backLayer.pageItems[pi];
          if (b.parent === backLayer && b.typename === "GroupItem")
            backs.push(b);
        }
      assert(fronts.length > 0, "No copies");
      assert(
        !sideCase || fronts.length === backs.length,
        "Duplex counts differ",
      );
      noOverlap(fronts);
      noOverlap(backs);
      var fr = owned.artboards[0].artboardRect;
      var br = sideCase ? owned.artboards[1].artboardRect : null;
      for (pi = 0; pi < fronts.length; pi++) {
        f = fronts[pi];
        var fb = f.visibleBounds,
          model = parseInt(f.name.substring(1), 10);
        assert(model >= 0 && model < specs.length, "Wrong front identity");
        counts[model]++;
        assert(
          fb[0] >= fr[0] + 3 * MM - EPS &&
            fb[2] <= fr[2] - 3 * MM + EPS &&
            fb[1] <= fr[1] - 3 * MM + EPS &&
            fb[3] >= fr[3] + 3 * MM - EPS,
          "Copy outside safe margin",
        );
        var w = fb[2] - fb[0],
          h = fb[1] - fb[3],
          sw = specs[model][0] * MM,
          sh = specs[model][1] * MM;
        assert(
          (Math.abs(w - sw) < EPS && Math.abs(h - sh) < EPS) ||
            (Math.abs(w - sh) < EPS && Math.abs(h - sw) < EPS),
          "Source resized",
        );
        if (sideCase) {
          var found = false,
            fx = (fb[0] + fb[2]) / 2 - fr[0],
            fy = fr[1] - (fb[1] + fb[3]) / 2;
          for (var bi = 0; bi < backs.length; bi++) {
            b = backs[bi];
            if (b.name !== "B" + model) continue;
            var bb = b.visibleBounds,
              bx = (bb[0] + bb[2]) / 2 - br[0],
              by = br[1] - (bb[1] + bb[3]) / 2;
            if (
              Math.abs(fx + bx - (fr[2] - fr[0])) < EPS &&
              Math.abs(fy - by) < EPS
            ) {
              found = true;
              break;
            }
          }
          assert(found, "Wrong duplex identity/mirror position");
        }
      }
      var exactSpecs = [];
      for(m = 0; m < specs.length; m++) exactSpecs.push({w:specs[m][0]*MM,h:specs[m][1]*MM});
      var expectedPlan = dcKtsMixedSizePlan(exactSpecs,324*MM,348*MM);
      assert(counts.join(",") === expectedPlan.counts.join(","), "Rendered counts differ from planned counts");
      assert(expectedPlan.cutCount > 0, "No proven industrial knife route");
      var unplaced = 0, remainingGroups = 0;
      for(m = 0; m < specs.length; m++) {
        if(counts[m] !== 0) continue;
        unplaced++;
        var sourceIndex = m*(sideCase ? 2 : 1);
        assert(sourceSnapshots[sourceIndex] === snapshot([sources[sourceIndex]]), "Unplaced front moved or removed");
        if(sideCase) assert(sourceSnapshots[sourceIndex+1] === snapshot([sources[sourceIndex+1]]), "Unplaced back moved or removed");
      }
      for(pi = 0; pi < sourceLayer.groupItems.length; pi++)
        if(sourceLayer.groupItems[pi].parent === sourceLayer) remainingGroups++;
      assert(remainingGroups === unplaced*(sideCase ? 2 : 1), "Placed sources/pairs were not removed exactly once");
      if(definition.small !== undefined) {
        assert(counts[counts.length-1] === definition.small, "Small filler count is wrong");
        var largeTotal = 0, leastUsed = Infinity, mostUsed = 0;
        for(m = 0; m < counts.length-1; m++) {
          largeTotal += counts[m];
          if(counts[m] > 0) {
            leastUsed = Math.min(leastUsed, counts[m]);
            mostUsed = Math.max(mostUsed, counts[m]);
          }
        }
        assert(largeTotal === definition.large, "Largest geometry was not filled before small filler");
        assert(mostUsed-leastUsed <= 1, "Largest copies are not balanced among templates that fit");
      }
      assert(unplaced === (definition.unplaced || 0), "Wrong number of retained sources");
      var capture = new ImageCaptureOptions();
      capture.resolution = 72;
      capture.antiAliasing = true;
      owned.imageCapture(
        new File(
          folder.fsName + "/" + definition.name + (sideCase ? "_two_sided.png" : "_one_sided.png"),
        ),
        fr,
        capture,
      );
      result.cases.push({
        twoSided: sideCase === 1,
        name: definition.name,
        status: status,
        counts: counts,
        cutCount: expectedPlan.cutCount,
        knifeWork: expectedPlan.workCount,
        elapsedMs: new Date().getTime() - started,
        unplacedSourcesRetained: unplaced,
        placedSourcesRemoved: specs.length-unplaced,
        passed: true,
      });
      owned.close(SaveOptions.DONOTSAVECHANGES);
      owned = null;
      assert(userDocumentsSnapshot() === userStateBefore, "A user document changed");
    }
    result.passed = true;
    result.userDocumentsUnchanged = true;
  } catch (e) {
    result.error = String(e) + " [line " + e.line + "]";
  } finally {
    var out = new File(folder.fsName + "/result.txt");
    out.encoding = "UTF-8";
    out.open("w");
    out.write(result.toSource());
    out.close();
    if (owned) owned.close(SaveOptions.DONOTSAVECHANGES);
    if (previous) previous.activate();
    app.coordinateSystem = oldCoords;
    app.userInteractionLevel = oldInteraction;
  }
  return result.toSource();
})();
