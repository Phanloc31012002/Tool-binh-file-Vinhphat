// Opt-in native Illustrator regression for the centred A4 TT4 cover grid.
// Only the owned synthetic document is edited or closed. Existing documents
// are read for structure/selection snapshots, then their active state returns.
// taskCtlTT4Case: 0=20.9x30 cover, 1=20x29.7 cover, 2=21x30 reject,
//                3=21.2x30, 16 pages, no cover (maximum existing AB input).
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var ci = typeof taskCtlTT4Case === "undefined" ? 0 : Number(taskCtlTT4Case);
  var cases = [
    { n: 20, w: 20.9, h: 30, cover: true, margin: 0, name: "TT4_MAX_COVER" },
    {
      n: 20,
      w: 20,
      h: 29.7,
      cover: true,
      margin: 9,
      name: "TT4_CLASSIC_COVER",
    },
    {
      n: 20,
      w: 21,
      h: 30,
      cover: true,
      reject: true,
      name: "TT4_TOO_TALL_REJECT",
    },
    { n: 16, w: 21.2, h: 30, cover: false, name: "AB_MAX_WITHOUT_COVER" },
  ];
  var spec = cases[ci],
    MM = 2.834645669,
    EPS = 0.02;
  var out = new Folder(
    root + "/tmp/ctl_tt4_2.16.8_" + new Date().getTime() + "_" + ci,
  );
  var previous = app.documents.length ? app.activeDocument : null;
  var oldCoordinates = app.coordinateSystem,
    oldInteraction = app.userInteractionLevel;
  var oldAlert = alert,
    oldFlatten,
    productionSignature,
    doc = null;
  var pages = [],
    sourcePages = [],
    flattenCalls = [],
    messages = [],
    originalDocs = [];
  var originalSelections = [],
    report = { caseIndex: ci, passed: false };
  function read(path) {
    var f = File(path);
    f.encoding = "UTF-8";
    if (!f.open("r")) throw Error("Cannot read " + path);
    var text = f.read();
    f.close();
    return text;
  }
  function json(value) {
    if (value === null || typeof value === "undefined") return "null";
    if (typeof value === "string")
      return (
        '"' +
        value
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\r/g, "\\r")
          .replace(/\n/g, "\\n") +
        '"'
      );
    if (typeof value !== "object") return String(value);
    var parts = [],
      key;
    if (value instanceof Array) {
      for (key = 0; key < value.length; key++) parts.push(json(value[key]));
      return "[" + parts.join(",") + "]";
    }
    for (key in value)
      if (value.hasOwnProperty(key))
        parts.push(json(key) + ":" + json(value[key]));
    return "{" + parts.join(",") + "}";
  }
  function assert(ok, message) {
    if (!ok) throw Error(message);
  }
  function near(a, b) {
    return Math.abs(a - b) < EPS;
  }
  function copy(b) {
    return [b[0], b[1], b[2], b[3]];
  }
  function center(b) {
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  }
  function inside(rect, b) {
    return (
      b[0] >= rect[0] - EPS &&
      b[2] <= rect[2] + EPS &&
      b[1] <= rect[1] + EPS &&
      b[3] >= rect[3] - EPS
    );
  }
  function pointInside(rect, p) {
    return inside(rect, [p[0], p[1], p[0], p[1]]);
  }
  function owned(item) {
    for (var depth = 0, ancestor = item; ancestor && depth < 50; depth++) {
      if (ancestor === doc) return true;
      if (ancestor.typename === "Document") return false;
      ancestor = ancestor.parent;
    }
    return false;
  }
  function itemState(item) {
    var result = {
      name: item.name,
      type: item.typename,
      bounds: copy(item.geometricBounds),
      hidden: item.hidden,
      locked: item.locked,
      selected: item.selected,
    };
    if (item.typename === "PathItem") {
      result.points = [];
      for (var pi = 0; pi < item.pathPoints.length; pi++) {
        var a = item.pathPoints[pi].anchor;
        result.points.push([a[0], a[1]]);
      }
    }
    if (item.typename === "RasterItem") {
      var m = item.matrix;
      result.matrix = [
        m.mValueA,
        m.mValueB,
        m.mValueC,
        m.mValueD,
        m.mValueTX,
        m.mValueTY,
      ];
    }
    return result;
  }
  function documentState(d, includeAllItems) {
    var result = {
      name: d.name,
      saved: d.saved,
      layers: [],
      boards: [],
      items: d.pageItems.length,
      selected: [],
    };
    for (var li = 0; li < d.layers.length; li++) {
      var l = d.layers[li];
      result.layers.push([
        l.name,
        l.locked,
        l.visible,
        l.pageItems.length,
        l.layers.length,
      ]);
    }
    for (var bi = 0; bi < d.artboards.length; bi++) {
      var r = d.artboards[bi].artboardRect;
      result.boards.push([d.artboards[bi].name, r[0], r[1], r[2], r[3]]);
    }
    var selection = d.selection;
    for (var si = 0; selection && si < selection.length; si++)
      result.selected.push(itemState(selection[si]));
    if (includeAllItems) {
      result.itemStates = [];
      for (var ii = 0; ii < d.pageItems.length; ii++)
        result.itemStates.push(itemState(d.pageItems[ii]));
    }
    return result;
  }
  function userSnapshot() {
    var result = [];
    for (var di = 0; di < app.documents.length; di++)
      result.push(documentState(app.documents[di], false));
    return json(result);
  }
  function originalIdentityUnchanged() {
    if (app.documents.length !== originalDocs.length) return false;
    for (var di = 0; di < originalDocs.length; di++) {
      if (app.documents[di] !== originalDocs[di]) return false;
      var selected = originalDocs[di].selection,
        expected = originalSelections[di];
      if ((selected ? selected.length : 0) !== expected.length) return false;
      for (var si = 0; si < expected.length; si++)
        if (selected[si] !== expected[si]) return false;
    }
    return !previous || app.activeDocument === previous;
  }
  function replaceBody(source, name, body) {
    var start = source.indexOf("function " + name + "(");
    if (start < 0) throw Error("Missing helper " + name);
    var open = source.indexOf("{", start),
      depth = 1,
      state = "code",
      quote;
    for (var i = open + 1; i < source.length; i++) {
      var c = source.charAt(i),
        n = source.charAt(i + 1);
      if (state === "string") {
        if (c === "\\") i++;
        else if (c === quote) state = "code";
      } else if (state === "line") {
        if (c === "\r" || c === "\n") state = "code";
      } else if (state === "block") {
        if (c === "*" && n === "/") {
          i++;
          state = "code";
        }
      } else if (c === '"' || c === "'") {
        state = "string";
        quote = c;
      } else if (c === "/" && n === "/") {
        i++;
        state = "line";
      } else if (c === "/" && n === "*") {
        i++;
        state = "block";
      } else if (c === "{") depth++;
      else if (c === "}" && --depth === 0)
        return source.substring(0, open + 1) + body + source.substring(i);
    }
    throw Error("Unbalanced helper " + name);
  }
  for (var odi = 0; odi < app.documents.length; odi++) {
    var original = app.documents[odi],
      selected = original.selection,
      selectionRefs = [];
    originalDocs.push(original);
    for (var osi = 0; selected && osi < selected.length; osi++)
      selectionRefs.push(selected[osi]);
    originalSelections.push(selectionRefs);
  }
  var before = userSnapshot();
  try {
    assert(spec, "taskCtlTT4Case must be 0, 1, 2, or 3");
    report.name = spec.name;
    assert(out.exists || out.create(), "Cannot create report folder");
    eval(read(root + "/DanCardCEP/jsx/dan_card_lib.jsx"));
    oldFlatten = dcFlattenForImposition;
    productionSignature = dcRunSignature8;
    dcFlattenForImposition = function (d, item, frame, dpi) {
      assert(
        d === doc && app.activeDocument === doc && owned(item),
        "Flatten target is not the owned test document",
      );
      assert(dpi === 500, "Production flatten call is not 500ppi");
      assert(
        item.typename === "RasterItem",
        "Fixture must exercise existing-image reuse",
      );
      var raster = oldFlatten(d, item, frame, dpi);
      assert(
        raster === item,
        "Existing RasterItem was replaced or rasterized again",
      );
      pages.push(raster);
      flattenCalls.push({ source: item.name, dpi: dpi, reused: true });
      return raster;
    };
    alert = function (text) {
      messages.push(String(text));
    };
    var source = replaceBody(
      productionSignature.toString(),
      "showNoteDialog",
      'return {bia:"TT4 COVER TEST",tt4:"TT4 TEST",tt8:"TT8 TEST",ab:"AB TEST",small4:"",small8:"",small16:"",smallAB:""};',
    );
    source = replaceBody(
      source,
      "loadNoteIconTemplate",
      'var icon=artworkLayer.pathItems.ellipse(0,0,7,7); icon.name="TT4_TEST_ICON"; icon.stroked=false; icon.hidden=true; return icon;',
    );
    eval(source);
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    doc = app.documents.add(DocumentColorSpace.CMYK, 600, 500);
    doc.artboards[0].name = "OWNED_TT4_TEST_SOURCE";
    var artwork = doc.activeLayer;
    artwork.name = "OWNED_TT4_TEST_ARTWORK";
    var keep = artwork.pathItems.rectangle(200, -200, 20, 20);
    keep.name = "UNSELECTED_OWNED_ITEM";
    keep.stroked = false;
    keep.filled = true;
    var keepBefore = json(itemState(keep));

    // A tiny 72ppi fixture image is made once. Actual production flatten is
    // still called with 500, and its existing-image branch returns this image.
    var seed = artwork.groupItems.add(),
      seedH = (48 * spec.h) / spec.w;
    var base = seed.pathItems.rectangle(100, 0, 48, seedH);
    base.stroked = false;
    base.filled = true;
    var ink = new CMYKColor();
    ink.cyan = 50;
    ink.magenta = 10;
    ink.yellow = 5;
    ink.black = 0;
    base.fillColor = ink;
    var stripe = seed.pathItems.rectangle(100, 0, 48, 8);
    stripe.stroked = false;
    stripe.filled = true;
    var stripeInk = new CMYKColor();
    stripeInk.black = 80;
    stripe.fillColor = stripeInk;
    var fixtureRasterOptions = new RasterizeOptions();
    fixtureRasterOptions.resolution = 72;
    fixtureRasterOptions.transparency = true;
    fixtureRasterOptions.padding = 0;
    var first = doc.rasterize(
      seed,
      copy(seed.geometricBounds),
      fixtureRasterOptions,
    );
    assert(
      first && first.typename === "RasterItem" && owned(first),
      "Cannot create owned raster fixture",
    );
    for (var pi = 0; pi < spec.n; pi++) {
      var page =
        pi === 0
          ? first
          : first.duplicate(artwork, ElementPlacement.PLACEATEND);
      page.name = "TT4_TEST_PAGE_" + (pi + 1);
      var pb = page.geometricBounds;
      page.translate(
        100 + (pi % 5) * 100 - pb[0],
        700 - Math.floor(pi / 5) * 200 - pb[1],
      );
      sourcePages.push(page);
    }
    // Rejection must leave existing generated layers untouched as well.
    var oldPaper = doc.layers.add();
    oldPaper.name = "Pon CTL Offset tu dong";
    var oldPaperMark = oldPaper.pathItems.rectangle(100, -100, 4, 4);
    oldPaperMark.name = "OLD_OWNED_PAPER_PON";
    oldPaper.locked = true;
    var oldCut = doc.layers.add();
    oldCut.name = "Pon cat CTL Offset tu dong";
    var oldCutMark = oldCut.pathItems.rectangle(80, -100, 4, 4);
    oldCutMark.name = "OLD_OWNED_CUT_PON";
    oldCut.locked = true;
    doc.activeLayer = artwork;
    doc.selection = null;
    for (pi = 0; pi < sourcePages.length; pi++) sourcePages[pi].selected = true;
    assert(app.activeDocument === doc, "Engine target is not owned");
    assert(
      doc.selection.length === spec.n,
      "Synthetic page selection count mismatch",
    );
    for (pi = 0; pi < doc.selection.length; pi++) {
      assert(
        owned(doc.selection[pi]) &&
          doc.selection[pi].typename === "RasterItem" &&
          doc.selection[pi].name.indexOf("TT4_TEST_PAGE_") === 0,
        "Selection contains a non-fixture page",
      );
    }
    var ownedBefore = json(documentState(doc, true));
    var ownedRefs = [];
    for (pi = 0; pi < doc.pageItems.length; pi++)
      ownedRefs.push(doc.pageItems[pi]);
    var selectedRefs = [];
    for (pi = 0; pi < doc.selection.length; pi++)
      selectedRefs.push(doc.selection[pi]);
    app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
    var status = dcRunSignature8(String(spec.w), String(spec.h), spec.cover);
    report.status = status;
    assert(
      app.activeDocument === doc,
      "Engine changed the active owned target",
    );
    assert(
      app.coordinateSystem === CoordinateSystem.ARTBOARDCOORDINATESYSTEM,
      "Engine coordinate mode not restored",
    );
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    assert(
      json(itemState(keep)) === keepBefore,
      "Unselected owned item changed",
    );
    if (spec.reject) {
      assert(
        status.indexOf("ERR:") === 0 && status.indexOf("648 x 418") >= 0,
        "Expected TT4 size preflight rejection: " + status,
      );
      assert(pages.length === 0, "Rejected input reached production flatten");
      assert(
        ownedBefore === json(documentState(doc, true)),
        "Rejected preflight changed document content, layers, boards, or selection",
      );
      for (pi = 0; pi < ownedRefs.length; pi++)
        assert(
          doc.pageItems[pi] === ownedRefs[pi],
          "Rejected preflight replaced an item",
        );
      for (pi = 0; pi < selectedRefs.length; pi++)
        assert(
          doc.selection[pi] === selectedRefs[pi],
          "Rejected preflight changed selected identities",
        );
      report.preflightUnchanged = true;
    } else {
      assert(
        status.indexOf("OK:") === 0 && status.indexOf("||CTLPDF:") >= 0,
        status,
      );
      assert(
        pages.length === spec.n && doc.rasterItems.length === spec.n,
        "Raster page count mismatch",
      );
      assert(
        doc.artboards.length === (spec.cover ? 3 : 2),
        "Unexpected cover/AB artboard count",
      );
      var rects = [],
        pageSizes = [],
        coverPages = [],
        coverBounds = null;
      for (var bi = 0; bi < doc.artboards.length; bi++) {
        var rect = copy(doc.artboards[bi].artboardRect);
        rects.push(rect);
        var isCover = spec.cover && bi === 0;
        assert(
          near(rect[2] - rect[0], (isCover ? 648 : 858) * MM) &&
            near(rect[1] - rect[3], (isCover ? 418 : 625) * MM),
          "Wrong fixed cover or AB paper dimensions",
        );
      }
      for (pi = 0; pi < pages.length; pi++) {
        var bounds = copy(pages[pi].geometricBounds),
          fits = false;
        for (bi = 0; bi < rects.length; bi++)
          if (inside(rects[bi], bounds)) fits = true;
        assert(fits, "Artwork page outside paper: " + (pi + 1));
        var coverPage = spec.cover && (pi < 2 || pi >= spec.n - 2);
        var expectedW = (coverPage ? spec.h * 10 : spec.w * 10 - 0.5) * MM;
        var expectedH = (coverPage ? spec.w * 10 : spec.h * 10) * MM;
        assert(
          near(bounds[2] - bounds[0], expectedW) &&
            near(bounds[1] - bounds[3], expectedH),
          coverPage
            ? "TT4 cover changed size after 90 degree rotation or received creep"
            : "AB size or existing 1mm-per-sheet creep changed",
        );
        pageSizes.push({
          page: pi + 1,
          cover: coverPage,
          widthMm: (bounds[2] - bounds[0]) / MM,
          heightMm: (bounds[1] - bounds[3]) / MM,
        });
        if (coverPage) {
          assert(inside(rects[0], bounds), "Cover page not on TT4 sheet");
          coverPages.push({
            page: pi + 1,
            bounds: bounds,
            center: center(bounds),
          });
          coverBounds = coverBounds
            ? [
                Math.min(coverBounds[0], bounds[0]),
                Math.max(coverBounds[1], bounds[1]),
                Math.max(coverBounds[2], bounds[2]),
                Math.min(coverBounds[3], bounds[3]),
              ]
            : bounds;
        }
      }
      var paperLayer = doc.layers.getByName("Pon CTL Offset tu dong"),
        paper = paperLayer.pathItems;
      var cutLayer = doc.layers.getByName("Pon cat CTL Offset tu dong"),
        cuts = cutLayer.pathItems;
      assert(
        paperLayer.locked && cutLayer.locked,
        "Nominal PON layers not locked",
      );
      assert(paper.length === rects.length * 8, "Paper PON count mismatch");
      for (bi = 0; bi < rects.length; bi++) {
        rect = rects[bi];
        var corners = [
          [rect[0], rect[1]],
          [rect[2], rect[1]],
          [rect[0], rect[3]],
          [rect[2], rect[3]],
        ];
        for (var corner = 0; corner < 4; corner++) {
          var hits = 0;
          for (var mi = 0; mi < paper.length; mi++) {
            var points = paper[mi].pathPoints;
            for (var qi = 0; qi < points.length; qi++) {
              var a = points[qi].anchor;
              if (
                near(a[0], corners[corner][0]) &&
                near(a[1], corners[corner][1])
              ) {
                hits++;
                break;
              }
            }
          }
          assert(
            hits === 2,
            "Paper PON stroke centres lost an artboard corner",
          );
        }
      }
      var coverMarks = [];
      for (mi = 0; mi < cuts.length; mi++) {
        var anchors = [],
          markFits = false;
        for (qi = 0; qi < cuts[mi].pathPoints.length; qi++) {
          a = cuts[mi].pathPoints[qi].anchor;
          anchors.push([a[0], a[1]]);
          var pointFits = false;
          for (bi = 0; bi < rects.length; bi++)
            if (pointInside(rects[bi], a)) pointFits = true;
          assert(pointFits, "Cut PON anchor outside all artboards");
        }
        for (bi = 0; bi < rects.length; bi++)
          if (inside(rects[bi], cuts[mi].geometricBounds)) markFits = true;
        assert(markFits, "Cut PON crosses outside paper");
        if (spec.cover && pointInside(rects[0], anchors[0]))
          coverMarks.push(anchors);
      }
      if (spec.cover) {
        rect = rects[0];
        var cx = (rect[0] + rect[2]) / 2,
          cy = (rect[1] + rect[3]) / 2;
        var w = spec.w * 10 * MM,
          h = spec.h * 10 * MM,
          gap = 7.6 * MM;
        var left = cx - (2 * h + gap) / 2,
          top = cy + w,
          bottom = cy - w;
        var axes = [left, left + h, cx, left + h + gap, left + 2 * h + gap];
        assert(
          coverPages.length === 4 &&
            near(center(coverBounds)[0], cx) &&
            near(center(coverBounds)[1], cy),
          "Cover art is not centred/mirrored",
        );
        assert(
          near(rect[1] - coverBounds[1], spec.margin * MM) &&
            near(coverBounds[3] - rect[3], spec.margin * MM),
          "TT4 outer artwork margins changed",
        );
        var slots = [
          [left + h / 2, cy + w / 2],
          [left + h / 2, cy - w / 2],
          [left + h + gap + h / 2, cy + w / 2],
          [left + h + gap + h / 2, cy - w / 2],
        ];
        for (var slot = 0; slot < slots.length; slot++) {
          hits = 0;
          for (pi = 0; pi < coverPages.length; pi++)
            if (
              near(coverPages[pi].center[0], slots[slot][0]) &&
              near(coverPages[pi].center[1], slots[slot][1])
            )
              hits++;
          assert(
            hits === 1,
            "Cover page centre does not match its mirrored nominal slot",
          );
        }
        assert(
          coverMarks.length === 10,
          "TT4 must have ten vertical cut ticks",
        );
        for (var axis = 0; axis < axes.length; axis++)
          for (var row = 0; row < 2; row++) {
            var edge = row === 0 ? top : bottom;
            hits = 0;
            for (mi = 0; mi < coverMarks.length; mi++) {
              var mark = coverMarks[mi];
              if (near(mark[0][0], axes[axis]) && near(mark[0][1], edge)) {
                assert(
                  mark.length === 2 &&
                    near(mark[1][0], axes[axis]) &&
                    near(Math.abs(mark[1][1] - edge), 2 * MM),
                  "TT4 cut tick is not a nominal vertical 2mm line",
                );
                hits++;
              }
            }
            assert(
              hits === 1,
              "TT4 PON grid drifted from its artwork edge/axis",
            );
          }
        report.coverNominal = {
          widthMm: 648,
          heightMm: 418,
          artMarginsMm: [spec.margin, spec.margin],
          topAxisFromPaperMm: (rect[1] - top) / MM,
          bottomAxisFromPaperMm: (rect[1] - bottom) / MM,
          xAxesMm: [],
          pageCentersMm: [],
          verticalCutMarksMm: [],
        };
        for (axis = 0; axis < axes.length; axis++)
          report.coverNominal.xAxesMm.push((axes[axis] - rect[0]) / MM);
        for (pi = 0; pi < coverPages.length; pi++)
          report.coverNominal.pageCentersMm.push([
            coverPages[pi].page,
            (coverPages[pi].center[0] - rect[0]) / MM,
            (rect[1] - coverPages[pi].center[1]) / MM,
          ]);
        for (mi = 0; mi < coverMarks.length; mi++)
          report.coverNominal.verticalCutMarksMm.push([
            [
              (coverMarks[mi][0][0] - rect[0]) / MM,
              (rect[1] - coverMarks[mi][0][1]) / MM,
            ],
            [
              (coverMarks[mi][1][0] - rect[0]) / MM,
              (rect[1] - coverMarks[mi][1][1]) / MM,
            ],
          ]);
      }
      var coverNotes = 0,
        insideNotes = 0;
      for (var ti = 0; ti < doc.textFrames.length; ti++) {
        var note = doc.textFrames[ti];
        if (note.contents === "TT4 COVER TEST") {
          assert(
            spec.cover && inside(rects[0], note.visibleBounds),
            "Cover note outside TT4",
          );
          coverNotes++;
        } else if (note.contents.indexOf("RUỘT ") === 0) {
          assert(
            inside(rects[spec.cover ? 1 : 0], note.visibleBounds),
            "AB note not on A",
          );
          insideNotes++;
        } else continue;
        assert(
          note.textRange.characterAttributes.size === 13,
          "Note font size changed",
        );
      }
      assert(
        coverNotes === (spec.cover ? 1 : 0) && insideNotes === 1,
        "Cover/AB notes lost or duplicated",
      );
      var plan = eval("(" + status.split("||CTLPDF:")[1] + ")");
      assert(plan.total === rects.length, "Save plan lost TT4 or AB pairing");
      var capture = new ImageCaptureOptions();
      capture.resolution = 72;
      capture.antiAliasing = true;
      var captureFile = File(out.fsName + "/" + spec.name + ".png");
      assert(app.activeDocument === doc, "Capture target is not owned");
      doc.imageCapture(captureFile, rects[0], capture);
      assert(captureFile.exists, "72ppi capture missing");
      report.capture = captureFile.fsName;
      report.capturePpi = 72;
      report.artboards = rects;
      report.pageSizesMm = pageSizes;
      report.paperMarks = paper.length;
      report.cutMarks = cuts.length;
      report.coverNotes = coverNotes;
      report.abNotes = insideNotes;
      report.maxABInputUnchanged =
        !spec.cover && spec.w === 21.2 && spec.h === 30;
    }
    report.version = dcSignature8AutoPonVersion;
    report.input = {
      pages: spec.n,
      widthCm: spec.w,
      heightCm: spec.h,
      cover: spec.cover,
    };
    report.flattenCalls = flattenCalls;
    report.fixturePpi = 72;
    report.unselectedOwnedItemUnchanged = true;
    report.passed = true;
  } catch (error) {
    report.error = String(error);
    report.line = error.line;
  } finally {
    if (oldFlatten) dcFlattenForImposition = oldFlatten;
    if (productionSignature) dcRunSignature8 = productionSignature;
    alert = oldAlert;
    try {
      if (doc) {
        doc.activate();
        assert(app.activeDocument === doc, "Cleanup target is not owned");
        doc.close(SaveOptions.DONOTSAVECHANGES);
      }
    } catch (cleanupError) {
      report.passed = false;
      report.cleanupError = String(cleanupError);
    }
    if (previous) previous.activate();
    app.coordinateSystem = oldCoordinates;
    app.userInteractionLevel = oldInteraction;
  }
  report.alerts = messages;
  report.originalDocumentsUnchanged =
    before === userSnapshot() && originalIdentityUnchanged();
  report.originalApplicationStateRestored =
    app.coordinateSystem === oldCoordinates &&
    app.userInteractionLevel === oldInteraction;
  if (
    !report.originalDocumentsUnchanged ||
    !report.originalApplicationStateRestored
  ) {
    report.passed = false;
    report.error =
      "Original document structure, selection, or application state changed";
  }
  if (!out.exists) out.create();
  var result = File(
    out.fsName + "/" + (spec ? spec.name : "INVALID_CASE") + ".json",
  );
  result.encoding = "UTF-8";
  if (result.open("w")) {
    result.write(json(report));
    result.close();
  } else
    return json({
      passed: false,
      error: "Cannot write report",
      report: report,
    });
  return json({
    name: report.name,
    caseIndex: ci,
    passed: report.passed,
    error: report.error,
    result: result.fsName,
  });
})();
