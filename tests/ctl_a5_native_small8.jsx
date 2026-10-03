// Opt-in SYNTHETIC Illustrator SMALL8 edge-case regression. Creates eight
// small vector rectangles in an owned unsaved document, then runs real CTL
// flatten/resize/grid/creep/PON/notes. Never copies or edits original artwork.
(function () {
  var base = "C:/Users/ADMIN/Downloads/DanCard_Setup_23/";
  var libPath = typeof dcCtlSmall8LibraryPath !== "undefined"
    ? dcCtlSmall8LibraryPath : base + "DanCardCEP/jsx/dan_card_lib.jsx";
  var lib = File(libPath); lib.encoding = "UTF-8";
  if (!lib.open("r")) throw new Error("Cannot read production CTL library.");
  var libText = lib.read(); lib.close(); eval(libText);
  var MM = 2.834645669, previous = app.activeDocument, previousCoordinates = app.coordinateSystem;
  var oldAlert = alert, originalFlatten = dcFlattenForImposition;
  var testDoc = null, testName = null, inputTag = "CTL_SMALL8_SYNTHETIC_ONLY_" + (new Date()).getTime();
  var w = typeof dcCtlSmall8Width !== "undefined" ? Number(dcCtlSmall8Width) : 15;
  var h = typeof dcCtlSmall8Height !== "undefined" ? Number(dcCtlSmall8Height) : 21.15;
  var iconPath = typeof dcCtlSmall8IconPath !== "undefined" ? dcCtlSmall8IconPath
    : base + "tmp/ctl_a5_open_48_20261002/icon_fixture.ai";
  var outputDir = typeof dcCtlSmall8OutputDir !== "undefined" ? dcCtlSmall8OutputDir
    : base + "tmp/ctl_a5_open_48_20261002";
  var stem = "native_synthetic_small8_" + String(w).replace(".", "p") + "x" + String(h).replace(".", "p");
  var processed = [], note = null, messages = [], report = null;
  function fail(message) { throw new Error(message); }
  function near(a, b) { return Math.abs(a - b) < .02; }
  function copy(b) { return [b[0], b[1], b[2], b[3]]; }
  function union(a, b) {
    if (!a) return copy(b);
    return [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]), Math.min(a[3], b[3])];
  }
  function inside(r, b) {
    return b[0] >= r[0] - .02 && b[2] <= r[2] + .02 && b[1] <= r[1] + .02 && b[3] >= r[3] - .02;
  }
  function intersects(a, b) {
    return a[0] < b[2] - .02 && a[2] > b[0] + .02 && a[3] < b[1] - .02 && a[1] > b[3] + .02;
  }
  function escape(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      .replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
  }
  function json(value) {
    if (value === null || typeof value === "undefined") return "null";
    if (typeof value === "string") return '"' + escape(value) + '"';
    if (typeof value === "number") return isFinite(value) ? String(value) : "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    var parts = [], i, key;
    if (value instanceof Array) {
      for (i = 0; i < value.length; i++) parts.push(json(value[i]));
      return "[" + parts.join(",") + "]";
    }
    for (key in value) if (value.hasOwnProperty(key)) parts.push('"' + escape(key) + '":' + json(value[key]));
    return "{" + parts.join(",") + "}";
  }
  function bodyRange(source, name) {
    var start = source.indexOf("function " + name + "(");
    if (start < 0) fail("Cannot locate production helper " + name);
    var open = source.indexOf("{", start), depth = 1, state = "code", quote = "";
    for (var i = open + 1; i < source.length; i++) {
      var c = source.charAt(i), n = source.charAt(i + 1);
      if (state === "string") { if (c === "\\") i++; else if (c === quote) state = "code"; }
      else if (state === "line") { if (c === "\n" || c === "\r") state = "code"; }
      else if (state === "block") { if (c === "*" && n === "/") { i++; state = "code"; } }
      else if (c === '"' || c === "'") { state = "string"; quote = c; }
      else if (c === "/" && n === "/") { i++; state = "line"; }
      else if (c === "/" && n === "*") { i++; state = "block"; }
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return { open: open, close: i };
    }
    fail("Unbalanced production helper " + name);
  }
  function replaceBody(source, name, body) {
    var range = bodyRange(source, name);
    return source.substring(0, range.open + 1) + body + source.substring(range.close);
  }
  function captureNote(face, pos, tf, icon, template) {
    var textB = copy(tf.visibleBounds), iconB = icon ? copy(icon.visibleBounds) : null;
    var templateB = template ? copy(template.visibleBounds) : null;
    note = { type: face.type, sheetNo: face.sheetNo, rect: copy(pos), text: tf.contents,
      textBounds: textB, iconBounds: iconB, templateBounds: templateB,
      combinedBounds: iconB ? union(textB, iconB) : textB };
  }
  function ownsIcon(doc) {
    try { return String(doc.name) === String(File(iconPath).name) && doc.fullName.fsName === File(iconPath).fsName; }
    catch (error) { return false; }
  }
  function originalStructure() {
    var active = app.activeDocument; previous.activate();
    try {
      var boards = [], layers = [];
      for (var i = 0; i < previous.artboards.length; i++) boards.push(copy(previous.artboards[i].artboardRect));
      for (i = 0; i < previous.layers.length; i++) layers.push({ name: previous.layers[i].name,
        locked: previous.layers[i].locked === true, visible: previous.layers[i].visible === true });
      return { name: previous.name, boards: boards, layers: layers,
        activeArtboard: previous.artboards.getActiveArtboardIndex(), saved: previous.saved === true,
        items: previous.pageItems.length, selection: previous.selection ? previous.selection.length : 0 };
    } finally { active.activate(); }
  }
  function assertOwned() {
    testDoc.activate();
    if (String(app.activeDocument.name) !== testName || testName === String(previous.name))
      fail("Refusing to run/capture a non-owned synthetic document.");
  }
  var before = null;
  try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    if (!(w > 0 && h > 0 && w <= 15 && h <= 21.15)) fail("Synthetic fixture expects portrait A5 dimensions.");
    if (!Folder(outputDir).exists || !File(iconPath).exists) fail("Missing synthetic output directory/icon fixture.");
    for (var di = 0; di < app.documents.length; di++) if (ownsIcon(app.documents[di])) fail("Isolated icon fixture is already open.");
    before = originalStructure();
    testDoc = app.documents.add(DocumentColorSpace.CMYK, 100 * MM, 100 * MM);
    testName = String(testDoc.name);
    var layer = testDoc.layers[0]; layer.name = inputTag;
    var frames = [], colors = [[0, 80, 90, 0], [100, 0, 40, 0], [0, 10, 100, 0],
      [50, 90, 0, 0], [90, 0, 10, 0], [0, 60, 0, 0], [40, 0, 100, 0], [0, 40, 80, 40]];
    for (var i = 0; i < 8; i++) {
      var frame = layer.pathItems.rectangle(-(Math.floor(i / 4) * 15) * MM,
        (i % 4) * 15 * MM, 10 * MM, 10 * MM);
      var ink = new CMYKColor(); ink.cyan = colors[i][0]; ink.magenta = colors[i][1];
      ink.yellow = colors[i][2]; ink.black = colors[i][3];
      frame.filled = true; frame.stroked = false; frame.fillColor = ink;
      frame.name = "SYNTHETIC_PAGE_" + (i + 1); frames.push(frame);
    }
    testDoc.selection = frames; assertOwned();
    if (app.activeDocument.selection.length !== 8 || String(app.activeDocument.layers[0].name) !== inputTag)
      fail("Synthetic owned input/selection guard failed.");
    var source = dcRunSignature8.toString();
    source = replaceBody(source, "showNoteDialog",
      "return {bia:'',tt4:'',tt8:'',ab:'',small4:'',small8:'',small16:'',smallAB:''};");
    var range = bodyRange(source, "addNoteA5");
    source = replaceBody(source, "addNoteA5", source.substring(range.open + 1, range.close) +
      "\nif(tf) captureNote(face,pos,tf,icon,noteIconTemplate);\n");
    var iconLiteral = 'new File("C:/Users/ADMIN/Downloads/icon.ai")';
    if (source.indexOf(iconLiteral) < 0) fail("Production note icon path changed.");
    source = source.replace(iconLiteral, 'new File("' + escape(iconPath) + '")');
    var captureLiteral = "var doc = app.activeDocument;";
    if (source.indexOf(captureLiteral) < 0) fail("Production document capture changed.");
    source = source.replace(captureLiteral, captureLiteral +
      "\nif(String(doc.name)!==testName || String(doc.layers[0].name)!==inputTag) " +
      "throw new Error('Synthetic diagnostic refused non-owned document');\n");
    var run = eval("(" + source + ")");
    dcFlattenForImposition = function (doc, item, bounds, resolution) {
      if (String(doc.name) !== testName) fail("Refusing flatten on an original document.");
      var raster = originalFlatten(doc, item, bounds, resolution);
      processed.push(raster); return raster;
    };
    alert = function (message) { messages.push(String(message)); };
    assertOwned();
    var status = run(w, h, false);
    if (status.indexOf("OK:") !== 0) fail(status);
    assertOwned(); // Artboard collections on this build are active-coupled.
    if (testDoc.artboards.length !== 1 || processed.length !== 8) fail("Expected one SMALL8 output with eight rasters.");
    var rect = copy(testDoc.artboards[0].artboardRect), art = null, sizes = [];
    if (!near(rect[2] - rect[0], 648 * MM) || !near(rect[1] - rect[3], 418 * MM)) fail("Fixed SMALL8 sheet changed.");
    for (i = 0; i < processed.length; i++) {
      var b = copy(processed[i].visibleBounds);
      if (processed[i].typename !== "RasterItem") fail("Synthetic vector page was not actually rasterized.");
      if (!inside(rect, b)) fail("Synthetic native artwork is outside paper.");
      if (!near(b[1] - b[3], h * 10 * MM) || !near(b[2] - b[0], (w * 10 - .5) * MM))
        fail("Native full height/centred two-page creep changed.");
      art = union(art, b); sizes.push({ widthMm: (b[2] - b[0]) / MM, heightMm: (b[1] - b[3]) / MM });
    }
    var expectedHeight = Math.min(2 * h * 10, 418);
    if (!near(art[3], rect[3]) || !near(art[1], rect[3] + expectedHeight * MM)) fail("Native SMALL8 outer artwork edges do not fit.");
    if (!note || note.type !== "SMALL8" || note.sheetNo !== 1 || !inside(rect, note.combinedBounds)) fail("Synthetic note/icon is missing or outside paper.");
    if (intersects(note.combinedBounds, art)) fail("Synthetic note overlaps artwork.");
    if (!note.iconBounds || !note.templateBounds ||
      !near(note.iconBounds[2] - note.iconBounds[0], note.templateBounds[2] - note.templateBounds[0]) ||
      !near(note.iconBounds[1] - note.iconBounds[3], note.templateBounds[1] - note.templateBounds[3]))
      fail("Synthetic note icon was resized/rotated.");
    var cutLayer = null, paperLayer = null;
    for (i = 0; i < testDoc.layers.length; i++) {
      if (testDoc.layers[i].name === "Pon cat CTL Offset tu dong") cutLayer = testDoc.layers[i];
      if (testDoc.layers[i].name === "Pon CTL Offset tu dong") paperLayer = testDoc.layers[i];
    }
    if (!cutLayer || !paperLayer || cutLayer.pathItems.length !== 22 || paperLayer.pathItems.length !== 8)
      fail("Synthetic native nominal PON path counts changed.");
    var nominalLeft = rect[0] + (648 - (4 * w * 10 + 8)) * MM / 2;
    var nominalRight = rect[2] - (648 - (4 * w * 10 + 8)) * MM / 2;
    var gapLeft = nominalLeft + 2 * w * 10 * MM;
    var gapRight = gapLeft + 8 * MM;
    var nominalAxes = [nominalLeft, gapLeft, gapRight, nominalRight,
      (rect[0] + rect[2]) / 2];
    var seamY = rect[3] + expectedHeight * MM / 2;
    var nominalRows = [rect[3] + expectedHeight * MM, seamY, rect[3]], cutRecords = [];
    var seamAxes = [nominalLeft, gapLeft, gapRight, nominalRight], seamRecords = [];
    var ponLayers = [cutLayer, paperLayer];
    for (var li = 0; li < ponLayers.length; li++) for (i = 0; i < ponLayers[li].pathItems.length; i++) {
      var path = ponLayers[li].pathItems[i];
      if (intersects(note.combinedBounds, path.visibleBounds)) fail("Synthetic note overlaps PON stroke.");
      if (li === 0) {
        var anchors = [];
        for (var qi = 0; qi < path.pathPoints.length; qi++) {
          var p = path.pathPoints[qi].anchor; anchors.push([p[0], p[1]]);
          if (p[0] < rect[0] - .02 || p[0] > rect[2] + .02 || p[1] < rect[3] - .02 || p[1] > rect[1] + .02)
            fail("Synthetic crop PON is outside paper.");
        }
        if (anchors.length !== 2) fail("Synthetic crop PON is not a simple two-point tick.");
        var validAxis = false, validRow = false;
        for (var axisIndex = 0; axisIndex < nominalAxes.length; axisIndex++)
          if (near(anchors[0][0], nominalAxes[axisIndex])) validAxis = true;
        for (var rowIndex = 0; rowIndex < nominalRows.length; rowIndex++)
          if (near(anchors[0][1], nominalRows[rowIndex])) validRow = true;
        if (!validAxis || !validRow) fail("Synthetic crop PON moved off the nominal pre-squeeze grid.");
        if (!near(Math.abs(anchors[1][0] - anchors[0][0]) + Math.abs(anchors[1][1] - anchors[0][1]), 2 * MM))
          fail("Synthetic nominal crop tick length changed.");
        if (near(anchors[0][1], seamY)) {
          if (!near(anchors[1][1], seamY)) fail("Middle-row cut PON must be horizontal.");
          seamRecords.push(anchors);
        }
        cutRecords.push({ points: anchors, strokeWidth: path.strokeWidth });
      }
    }
    if (seamRecords.length !== 4) fail("Expected four horizontal PON at the cut between rows.");
    for (i = 0; i < seamAxes.length; i++) {
      var foundSeam = false;
      for (var si = 0; si < seamRecords.length; si++)
        if (near(seamRecords[si][0][0], seamAxes[i])) foundSeam = true;
      if (!foundSeam) fail("Horizontal cut PON is missing at an outer/gutter edge.");
    }
    var noteLeftMm = (note.combinedBounds[0] - rect[0]) / MM;
    var noteBottomMm = (note.combinedBounds[3] - rect[3]) / MM;
    if (!near(noteLeftMm, 9) || !near(noteBottomMm, 15) ||
      note.textBounds[1] - note.textBounds[3] <= note.textBounds[2] - note.textBounds[0])
      fail("SMALL8 note must be vertical at the lower-left 9mm/15mm anchor.");
    var after = originalStructure();
    if (json(before) !== json(after)) fail("Original document structure changed during synthetic test.");
    assertOwned();
    var image = File(outputDir + "/" + stem + ".png"), options = new ImageCaptureOptions();
    options.resolution = 72; options.antiAliasing = true; options.matte = true; options.transparency = false;
    testDoc.imageCapture(image, rect, options);
    report = { fixture: "SYNTHETIC_8_VECTOR_PAGES_NOT_USER_CONTENT", version: dcSignature8AutoPonVersion,
      pageWidthCm: w, pageHeightCm: h, physicalSheetMm: [648, 418], actualRasterPages: 8,
      status: status, originalUnchanged: true, originalBefore: before, originalAfter: after,
      artworkBounds: art, artworkInside: true, fullUncroppedPageSizes: sizes,
      internalOverlapMm: Math.max(0, 2 * h * 10 - 418), note: note,
      noteInside: true, noteClearOfArtworkAndPon: true, iconUnscaled: true,
      noteLeftMm: noteLeftMm, noteBottomMm: noteBottomMm,
      horizontalSeamTicks: seamRecords.length, horizontalSeamFromBottomMm: (seamY - rect[3]) / MM,
      cutPonPaths: 22, cutPonNominalCoordinates: cutRecords, paperPonPaths: 8,
      capturedImage: image.fsName, suppressedAlerts: messages };
    var output = File(outputDir + "/" + stem + ".json"); output.encoding = "UTF-8";
    if (!output.open("w")) fail("Cannot write synthetic native audit.");
    output.write(json(report)); output.close();
    return "OK: Native synthetic SMALL8 " + w + "x" + h + " passed; original unchanged; " + image.fsName;
  } finally {
    alert = oldAlert; dcFlattenForImposition = originalFlatten;
    for (var ci = app.documents.length - 1; ci >= 0; ci--) {
      try { if (ownsIcon(app.documents[ci])) app.documents[ci].close(SaveOptions.DONOTSAVECHANGES); } catch (iconCloseError) {}
    }
    try { if (testDoc && String(testDoc.name) === testName && String(testDoc.name) !== String(previous.name)) testDoc.close(SaveOptions.DONOTSAVECHANGES); }
    catch (closeError) {}
    try { previous.activate(); } catch (activateError) {}
    try { app.coordinateSystem = previousCoordinates; } catch (coordinateError) {}
  }
})();
