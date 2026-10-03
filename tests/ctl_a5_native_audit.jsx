// Opt-in native CTL A5 diagnostic. Set dcCtlAuditSourceName to the exact
// OPEN document name. Only duplicates in a new unsaved document are changed.
// No production geometry is stubbed. Dialog answers and the isolated icon
// pathname are substituted; an observer appended to addNoteA5 captures the
// exact assigned face without changing its placement logic. Alerts are logged.
(function () {
  var basePath = "C:/Users/ADMIN/Downloads/DanCard_Setup_23/";
  var libraryPath = typeof dcCtlAuditLibraryPath !== "undefined"
    ? dcCtlAuditLibraryPath : basePath + "DanCardCEP/jsx/dan_card_lib.jsx";
  var libraryFile = File(libraryPath);
  libraryFile.encoding = "UTF-8";
  if (!libraryFile.open("r")) throw new Error("Cannot read CTL production library.");
  var libraryText = libraryFile.read();
  libraryFile.close();
  eval(libraryText);

  var MM = 2.834645669;
  var previous = app.activeDocument;
  var previousCoordinates = app.coordinateSystem;
  var previousAlert = alert;
  var originalFlatten = dcFlattenForImposition;
  var testDoc = null;
  var sourceDoc = null;
  var isolatedIconPath = typeof dcCtlAuditIconPath !== "undefined"
    ? dcCtlAuditIconPath : basePath + "tmp/ctl_a5_open_48_20261002/icon_fixture.ai";
  var outputPath = typeof dcCtlAuditOutputPath !== "undefined"
    ? dcCtlAuditOutputPath : basePath + "tmp/ctl_a5_open_48_20261002/native_baseline.json";
  var snapshotPath = /\.json$/i.test(outputPath)
    ? outputPath.replace(/\.json$/i, ".source_snapshot.json") : outputPath + ".source_snapshot.json";
  var sourceName = typeof dcCtlAuditSourceName !== "undefined"
    ? dcCtlAuditSourceName : String(previous.name);
  var pageW = typeof dcCtlAuditPageWidth !== "undefined" ? dcCtlAuditPageWidth : 14;
  var pageH = typeof dcCtlAuditPageHeight !== "undefined" ? dcCtlAuditPageHeight : 20;
  var sourceMode = typeof dcCtlAuditSourceMode !== "undefined" ? dcCtlAuditSourceMode : "exact48";
  var alerts = [], processed = [], noteCaptures = [], sourceSnapshots = [], boardSnapshots = [];
  var sourceLayerCount = 0, sourcePageCount = 0, sourceActiveLayer = null;
  var sourceWasSaved = null, sourceActiveArtboard = null, testDocumentName = null;
  var ownedLayerName = "CTL_AUDIT_ONLY_" + (new Date()).getTime();
  var sourceStructureBefore = null, sourceStructureAfter = null, report = null;

  function fail(message) { throw new Error(message); }
  function near(a, b) { return Math.abs(a - b) < 0.02; }
  function arrayCopy(value) { return [value[0], value[1], value[2], value[3]]; }
  function escaped(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      .replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
  }
  function stringify(value) {
    if (value === null || typeof value === "undefined") return "null";
    if (typeof value === "string") return '"' + escaped(value) + '"';
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") return isFinite(value) ? String(value) : "null";
    var values = [], i, key;
    if (value instanceof Array) {
      for (i = 0; i < value.length; i++) values.push(stringify(value[i]));
      return "[" + values.join(",") + "]";
    }
    for (key in value) if (value.hasOwnProperty(key))
      values.push('"' + escaped(key) + '":' + stringify(value[key]));
    return "{" + values.join(",") + "}";
  }
  function functionBodyRange(source, functionName) {
    var marker = "function " + functionName + "(";
    var start = source.indexOf(marker);
    if (start < 0 || source.indexOf(marker, start + marker.length) >= 0)
      fail("Diagnostic substitution is not uniquely located: " + functionName);
    var open = source.indexOf("{", start), depth = 1, state = "code", quote = "";
    for (var i = open + 1; i < source.length; i++) {
      var c = source.charAt(i), next = source.charAt(i + 1);
      if (state === "string") {
        if (c === "\\") i++;
        else if (c === quote) state = "code";
      } else if (state === "line") {
        if (c === "\n" || c === "\r") state = "code";
      } else if (state === "block") {
        if (c === "*" && next === "/") { i++; state = "code"; }
      } else if (c === '"' || c === "'") { state = "string"; quote = c; }
      else if (c === "/" && next === "/") { i++; state = "line"; }
      else if (c === "/" && next === "*") { i++; state = "block"; }
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return { open: open, close: i };
    }
    fail("Unbalanced diagnostic function body: " + functionName);
  }
  function replaceFunctionBody(source, functionName, body) {
    var range = functionBodyRange(source, functionName);
    return source.substring(0, range.open + 1) + body + source.substring(range.close);
  }
  function margins(rect, bounds) {
    return {
      leftMm: (bounds[0] - rect[0]) / MM,
      topMm: (rect[1] - bounds[1]) / MM,
      rightMm: (rect[2] - bounds[2]) / MM,
      bottomMm: (bounds[3] - rect[3]) / MM
    };
  }
  function includesCentre(rect, bounds) {
    var x = (bounds[0] + bounds[2]) / 2, y = (bounds[1] + bounds[3]) / 2;
    return x >= rect[0] - .02 && x <= rect[2] + .02 &&
      y <= rect[1] + .02 && y >= rect[3] - .02;
  }
  function inside(rect, bounds) {
    return bounds[0] >= rect[0] - .02 && bounds[2] <= rect[2] + .02 &&
      bounds[1] <= rect[1] + .02 && bounds[3] >= rect[3] - .02;
  }
  function dcCtlCaptureNativeNote(face, text, pos, tf, icon) {
    var textBounds = arrayCopy(tf.visibleBounds);
    var iconBounds = icon ? arrayCopy(icon.visibleBounds) : null;
    var combined = iconBounds ? unionBounds(textBounds, iconBounds) : textBounds;
    noteCaptures.push({ type: face.type, sheetNo: face.sheetNo, label: face.label,
      text: text, rect: arrayCopy(pos), textBounds: textBounds,
      iconBounds: iconBounds, combinedBounds: combined,
      textMargins: margins(pos, textBounds), iconMargins: iconBounds ? margins(pos, iconBounds) : null,
      combinedMargins: margins(pos, combined), inside: inside(pos, combined) });
  }
  function nearestBoard(bounds, rows) {
    var found = -1, best = Infinity;
    var x = (bounds[0] + bounds[2]) / 2, y = (bounds[1] + bounds[3]) / 2;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i].rect;
      if (includesCentre(r, bounds)) return i;
      var dx = Math.max(r[0] - x, 0, x - r[2]);
      var dy = Math.max(r[3] - y, 0, y - r[1]);
      var distance = dx * dx + dy * dy;
      if (distance < best) { best = distance; found = i; }
    }
    return found;
  }
  function unionBounds(a, b) {
    if (!a) return arrayCopy(b);
    return [Math.min(a[0], b[0]), Math.max(a[1], b[1]),
      Math.max(a[2], b[2]), Math.min(a[3], b[3])];
  }
  function ownIconDocument(doc) {
    try {
      if (String(doc.name) !== String(File(isolatedIconPath).name)) return false;
      return doc.fullName.fsName === File(isolatedIconPath).fsName;
    }
    catch (error) { return false; }
  }
  function sourceByName() {
    for (var si = 0; si < app.documents.length; si++)
      if (app.documents[si].name === sourceName) return app.documents[si];
    return null;
  }
  function sourceStructure(doc) {
    if (!doc) return null;
    // Illustrator can expose the active document's artboard collection when
    // querying a different inactive document. Activate the requested original
    // for ALL getters, then restore the prior document immediately.
    var previousActive = app.activeDocument;
    doc.activate();
    try {
      var names = [], layers = [], boardNames = [], activeLayerName = "", activeLayerIndex = -1;
      for (var si = 0; si < doc.layers.length; si++) {
        names.push(String(doc.layers[si].name));
        layers.push({ name: String(doc.layers[si].name), locked: doc.layers[si].locked === true,
          visible: doc.layers[si].visible === true });
        if (doc.layers[si] === doc.activeLayer) activeLayerIndex = si;
      }
      for (si = 0; si < doc.artboards.length; si++) boardNames.push(String(doc.artboards[si].name));
      try { activeLayerName = String(doc.activeLayer.name); } catch (layerReadError) {}
      return { name: String(doc.name), artboards: Number(doc.artboards.length),
        layers: Number(doc.layers.length), pageItems: Number(doc.pageItems.length),
        activeArtboard: Number(doc.artboards.getActiveArtboardIndex()),
        activeLayerName: activeLayerName, activeLayerIndex: activeLayerIndex,
        layerNames: names, layerStates: layers, artboardNames: boardNames,
        saved: doc.saved === true, selectionCount: doc.selection ? doc.selection.length : 0 };
    } finally {
      previousActive.activate();
    }
  }
  function writeReport(data, path) {
    var auditFile = File(path || outputPath); auditFile.encoding = "UTF-8";
    if (!auditFile.open("w")) fail("Cannot write generated native CTL audit.");
    auditFile.write(stringify(data)); auditFile.close();
  }
  function assertSourceUnchanged() {
    if (!sourceDoc) return;
    // Illustrator may invalidate document/item collection wrappers when the
    // copied icon document opens/closes. Resolve the still-open ORIGINAL by
    // exact name again instead of trusting the earlier wrapper's collections.
    var freshSource = sourceByName();
    var previouslyActive = app.activeDocument;
    if (freshSource) freshSource.activate();
    try {
    sourceStructureAfter = sourceStructure(freshSource);
    if (!freshSource || sourceStructureAfter.artboards !== sourceStructureBefore.artboards ||
      sourceStructureAfter.layers !== sourceStructureBefore.layers ||
      sourceStructureAfter.pageItems !== sourceStructureBefore.pageItems)
      fail("Original source structure mismatch: expected " + stringify(sourceStructureBefore) +
        "; actual " + stringify(sourceStructureAfter));
    for (var i = 0; i < boardSnapshots.length; i++) {
      var currentRect = freshSource.artboards[i].artboardRect;
      for (var j = 0; j < 4; j++) if (!near(currentRect[j], boardSnapshots[i][j]))
        fail("Original source artboard changed.");
    }
    for (i = 0; i < sourceSnapshots.length; i++) {
      var snapshot = sourceSnapshots[i], currentItem = freshSource.pageItems[snapshot.sourceIndex];
      var current = currentItem.visibleBounds;
      for (j = 0; j < 4; j++) if (!near(current[j], snapshot.bounds[j]))
        fail("Original source page geometry changed.");
      if (currentItem.selected !== snapshot.selected || currentItem.note !== snapshot.note ||
        String(currentItem.name) !== snapshot.name || String(currentItem.typename) !== snapshot.type)
        fail("Original source page selection/note changed.");
    }
    if (sourceStructureAfter.activeLayerName !== sourceStructureBefore.activeLayerName ||
      sourceStructureAfter.saved !== sourceStructureBefore.saved ||
      sourceStructureAfter.activeArtboard !== sourceStructureBefore.activeArtboard ||
      sourceStructureAfter.selectionCount !== sourceStructureBefore.selectionCount)
      fail("Original source layer/saved/selection state mismatch: expected " + stringify(sourceStructureBefore) +
        "; actual " + stringify(sourceStructureAfter));
    if (stringify(sourceStructureAfter.layerStates) !== stringify(sourceStructureBefore.layerStates) ||
      stringify(sourceStructureAfter.artboardNames) !== stringify(sourceStructureBefore.artboardNames))
      fail("Original source artboard names or layer states changed.");
    } finally {
      previouslyActive.activate();
    }
  }
  function assertOwnedActive() {
    if (String(app.activeDocument.name) !== testDocumentName ||
      String(app.activeDocument.name) === sourceName ||
      String(app.activeDocument.layers[0].name) !== ownedLayerName ||
      app.activeDocument.pageItems.length !== 48 || app.activeDocument.selection.length !== 48)
      fail("Refusing production call: active=" + String(app.activeDocument.name) +
        "; owned=" + testDocumentName + "; pageItems=" + app.activeDocument.pageItems.length +
        "; selected=" + app.activeDocument.selection.length);
  }

  try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    for (var di = 0; di < app.documents.length; di++) {
      if (app.documents[di].name === sourceName) sourceDoc = app.documents[di];
      if (ownIconDocument(app.documents[di])) fail("Isolated icon fixture is already open.");
    }
    if (!sourceDoc) fail("Exact source document is not open: " + sourceName);
    sourceDoc.activate();
    if (!File(isolatedIconPath).exists) fail("Missing isolated icon fixture: " + isolatedIconPath);
    if (sourceMode !== "exact48" && sourceMode !== "raster48") fail("Unsupported diagnostic source mode.");
    if (sourceMode === "exact48" && sourceDoc.pageItems.length !== 48)
      fail("Expected exactly 48 source pageItems; refusing to choose a subset.");
    sourceLayerCount = sourceDoc.layers.length;
    sourcePageCount = sourceDoc.pageItems.length;
    sourceActiveLayer = sourceDoc.activeLayer;
    sourceWasSaved = sourceDoc.saved;
    sourceActiveArtboard = sourceDoc.artboards.getActiveArtboardIndex();
    sourceStructureBefore = sourceStructure(sourceDoc);
    for (var ai = 0; ai < sourceDoc.artboards.length; ai++)
      boardSnapshots.push(arrayCopy(sourceDoc.artboards[ai].artboardRect));
    var roots = [];
    for (var pi = 0; pi < sourceDoc.pageItems.length; pi++) {
      var sourceItem = sourceDoc.pageItems[pi];
      var sourceBounds = arrayCopy(sourceItem.visibleBounds);
      sourceSnapshots.push({ item: sourceItem, sourceIndex: pi, bounds: sourceBounds,
        selected: sourceItem.selected, note: sourceItem.note,
        name: String(sourceItem.name), type: String(sourceItem.typename) });
      if (sourceMode === "exact48") {
        if (!sourceItem.parent || sourceItem.parent.typename !== "Layer")
          fail("Source pageItems contain nested objects; refusing to infer the 48 frames.");
        if (sourceItem.typename !== "RasterItem" && sourceItem.typename !== "PlacedItem" &&
            sourceItem.typename !== "GroupItem")
          fail("Unexpected source page frame type: " + sourceItem.typename);
        if (sourceBounds[2] <= sourceBounds[0] || sourceBounds[1] <= sourceBounds[3])
          fail("Source has an empty page frame.");
        roots.push(sourceItem);
      }
    }
    if (sourceMode === "raster48") {
      // Geometry-only rerun fixture for an already-imposed document. Read its
      // 48 images individually (including images inside the pair/panel groups)
      // and exclude generated PON/text/icon vectors from the COPIED selection.
      // Snapshot/check every original pageItem, not only these copied images.
      if (sourceDoc.rasterItems.length !== 48)
        fail("raster48 diagnostic mode requires exactly 48 source RasterItems.");
      for (pi = 0; pi < sourceDoc.rasterItems.length; pi++) roots.push(sourceDoc.rasterItems[pi]);
    }
    // Persist the original numeric snapshot BEFORE creating/copying anything.
    // A diagnostic must not rely only on a later successful assertion.
    var serializedFrames = [];
    for (pi = 0; pi < sourceSnapshots.length; pi++) {
      var snapshot = sourceSnapshots[pi];
      serializedFrames.push({ sourceIndex: snapshot.sourceIndex, bounds: snapshot.bounds,
        selected: snapshot.selected, note: snapshot.note, name: snapshot.name, type: snapshot.type });
    }
    writeReport({ phase: "original-snapshot-before-copy", sourceName: sourceName,
      sourceMode: sourceMode, copiedFrames: roots.length, libraryPath: libraryPath,
      sourceBefore: sourceStructureBefore, sourceFrames: serializedFrames }, snapshotPath);

    testDoc = app.documents.add(DocumentColorSpace.CMYK, 100 * MM, 100 * MM);
    testDocumentName = String(testDoc.name);
    if (testDocumentName === sourceName) fail("Temporary document is not distinguishable from the original source.");
    var inputLayer = testDoc.layers[0]; inputLayer.name = ownedLayerName;
    var copies = [];
    for (pi = 0; pi < roots.length; pi++)
      copies.push(roots[pi].duplicate(inputLayer, ElementPlacement.PLACEATEND));
    // Preserve source-relative positions while moving only the isolated
    // copies to a predictable safe origin within the normal canvas.
    var copyUnion = null;
    for (pi = 0; pi < copies.length; pi++) copyUnion = unionBounds(copyUnion, copies[pi].visibleBounds);
    for (pi = 0; pi < copies.length; pi++) copies[pi].translate(-copyUnion[0], -copyUnion[1]);
    testDoc.selection = copies;
    // Cross-document duplicate/selection calls can reactivate the source in
    // Illustrator. The production entry point reads app.activeDocument, so
    // explicitly reactivate the owned document and fail BEFORE calling it if
    // its identity or the copied selection is not exactly what we expect.
    testDoc.activate();
    assertOwnedActive();
    assertSourceUnchanged();
    testDoc.activate();
    assertOwnedActive();

    var functionSource = dcRunSignature8.toString();
    functionSource = replaceFunctionBody(functionSource, "showNoteDialog",
      "return {bia:'BÌA',tt4:'',tt8:'',ab:'',small4:'',small8:'',small16:'',smallAB:''};");
    // Preserve the complete original note body. Add an observation only after
    // it has finished, so its exact face/rect remains identifiable even when
    // the legacy note is outside the artboard. Never replace note positions.
    var noteRange = functionBodyRange(functionSource, "addNoteA5");
    var noteBody = functionSource.substring(noteRange.open + 1, noteRange.close);
    functionSource = replaceFunctionBody(functionSource, "addNoteA5", noteBody +
      "\nif (typeof tf !== 'undefined' && tf) dcCtlCaptureNativeNote(face,text,pos,tf,icon);\n");
    // A second assertion at the production document capture prevents its
    // PON-cleanup or resize logic touching any document except our owned copy.
    var documentCapture = "var doc = app.activeDocument;";
    if (functionSource.indexOf(documentCapture) < 0) fail("Production document capture changed; audit needs review.");
    functionSource = functionSource.replace(documentCapture, documentCapture +
      "\nif (String(doc.name) !== testDocumentName || String(doc.name) === sourceName || " +
      "String(doc.layers[0].name) !== ownedLayerName) " +
      "throw new Error('CTL audit refused non-owned active document');\n");
    var iconLiteral = 'new File("C:/Users/ADMIN/Downloads/icon.ai")';
    if (functionSource.indexOf(iconLiteral) < 0) fail("Production icon literal changed; audit needs review.");
    functionSource = functionSource.replace(iconLiteral, 'new File("' + escaped(isolatedIconPath) + '")');
    var auditedSignature = eval("(" + functionSource + ")");
    dcFlattenForImposition = function (doc, item, frame, resolution) {
      if (String(doc.name) !== testDocumentName || String(doc.name) === sourceName)
        fail("Refusing flatten on a non-owned diagnostic document.");
      var result = originalFlatten(doc, item, frame, resolution);
      // Observation only: return exactly the object production flatten made.
      if (doc === testDoc) processed.push(result);
      return result;
    };
    alert = function (message) { alerts.push(String(message)); };
    var status = auditedSignature(pageW, pageH, true);
    if (status.indexOf("OK:") !== 0) fail(status);
    if (processed.length !== 48) fail("Expected 48 actual processed source frames.");
    // The icon open/close can change the active document. Artboard getters
    // are active-document-coupled on this Illustrator build, so reactivate
    // our owned output explicitly before ANY output artboard measurement.
    testDoc.activate();
    if (String(app.activeDocument.name) !== testDocumentName || String(app.activeDocument.name) === sourceName)
      fail("Refusing output measurements on a non-owned active document.");

    var rows = [];
    for (ai = 0; ai < testDoc.artboards.length; ai++) {
      var rect = arrayCopy(testDoc.artboards[ai].artboardRect);
      rows.push({ artboardIndex: ai, rect: rect,
        widthMm: (rect[2] - rect[0]) / MM, heightMm: (rect[1] - rect[3]) / MM,
        artworkCount: 0, artworkBounds: null, artworkMargins: null,
        artwork: [], notes: [], icons: [], paperPonPaths: 0, cutPonPaths: 0 });
    }
    for (pi = 0; pi < processed.length; pi++) {
      var bounds = arrayCopy(processed[pi].visibleBounds);
      var boardIndex = nearestBoard(bounds, rows);
      if (boardIndex < 0) fail("Processed frame is not associated with an output artboard.");
      var row = rows[boardIndex]; row.artworkCount++;
      row.artworkBounds = unionBounds(row.artworkBounds, bounds);
      row.artwork.push({ sourceReadOrder: pi + 1, type: processed[pi].typename,
        widthMm: (bounds[2] - bounds[0]) / MM, heightMm: (bounds[1] - bounds[3]) / MM,
        margins: margins(row.rect, bounds) });
    }
    for (var ni = 0; ni < noteCaptures.length; ni++) {
      var capture = noteCaptures[ni]; boardIndex = -1;
      for (ai = 0; ai < rows.length; ai++) {
        var equal = true;
        for (var ri = 0; ri < 4; ri++) if (!near(rows[ai].rect[ri], capture.rect[ri])) equal = false;
        if (equal) { boardIndex = ai; break; }
      }
      if (boardIndex < 0) fail("Captured note face does not match an output artboard.");
      rows[boardIndex].faceType = capture.type;
      rows[boardIndex].sheetNo = capture.sheetNo;
      rows[boardIndex].faceLabel = capture.label;
      rows[boardIndex].notes.push(capture);
      if (capture.iconBounds) rows[boardIndex].icons.push({ bounds: capture.iconBounds,
        margins: capture.iconMargins });
    }
    for (var li = 0; li < testDoc.layers.length; li++) {
      var layer = testDoc.layers[li], key = "";
      if (layer.name === "Pon CTL Offset tu dong") key = "paperPonPaths";
      else if (layer.name === "Pon cat CTL Offset tu dong") key = "cutPonPaths";
      if (!key) continue;
      for (var pathIndex = 0; pathIndex < layer.pathItems.length; pathIndex++) {
        boardIndex = nearestBoard(layer.pathItems[pathIndex].geometricBounds, rows);
        if (boardIndex >= 0) rows[boardIndex][key]++;
      }
    }
    for (ai = 0; ai < rows.length; ai++) {
      if (rows[ai].artworkBounds) {
        rows[ai].artworkMargins = margins(rows[ai].rect, rows[ai].artworkBounds);
        rows[ai].artworkInside = inside(rows[ai].rect, rows[ai].artworkBounds);
        if (typeof dcCtlAuditExpectInside !== "undefined" && dcCtlAuditExpectInside === true &&
          !rows[ai].artworkInside) fail("Native artwork is outside artboard " + ai + ".");
      }
      for (ni = 0; ni < rows[ai].notes.length; ni++)
        if (typeof dcCtlAuditExpectInside !== "undefined" && dcCtlAuditExpectInside === true &&
          !rows[ai].notes[ni].inside) fail("Native note/icon is outside artboard " + ai + ".");
    }
    report = { sourceName: sourceName, sourceMode: sourceMode, sourceUnchanged: false,
      pageWidthCm: pageW, pageHeightCm: pageH, selectedSourceFrames: 48,
      coverEnabled: true, version: dcSignature8AutoPonVersion, libraryPath: libraryPath,
      sourceSnapshotPath: snapshotPath,
      status: status, suppressedAlerts: alerts, sourceBefore: sourceStructureBefore, artboards: rows };
    assertSourceUnchanged();
    report.sourceUnchanged = true;
    report.sourceAfter = sourceStructureAfter;
    if (typeof dcCtlAuditRenderDir !== "undefined" && dcCtlAuditRenderDir) {
      var renderDirectory = Folder(dcCtlAuditRenderDir);
      if (!renderDirectory.exists) fail("Native capture directory must already exist.");
      testDoc.activate();
      if (String(app.activeDocument.name) !== testDocumentName || String(app.activeDocument.name) === sourceName)
        fail("Refusing image capture on a non-owned active document.");
      var captureOptions = new ImageCaptureOptions();
      captureOptions.resolution = 72;
      captureOptions.antiAliasing = true;
      captureOptions.matte = true;
      captureOptions.transparency = false;
      var renderPrefix = typeof dcCtlAuditRenderPrefix !== "undefined"
        ? String(dcCtlAuditRenderPrefix)
        : "native_fixed_" + String(pageW).replace(".", "p") + "x" + String(pageH).replace(".", "p");
      // Reject path syntax in a filename prefix; the explicit render directory
      // remains the only destination. No original document is ever captured.
      if (/[\\\/\:]/.test(renderPrefix)) fail("Native image prefix must be a filename only.");
      var capturedTypes = {}, images = [];
      for (ai = 0; ai < rows.length; ai++) {
        var captureType = rows[ai].faceType;
        if ((captureType !== "SMALL4" && captureType !== "SMALL8") || capturedTypes[captureType]) continue;
        capturedTypes[captureType] = true;
        var captureFile = File(renderDirectory.fsName + "/" + renderPrefix + "_" + captureType.toLowerCase() + ".png");
        testDoc.imageCapture(captureFile, rows[ai].rect, captureOptions);
        images.push({ type: captureType, artboardIndex: ai, path: captureFile.fsName });
      }
      report.nativeImages = images;
    }
    writeReport(report);
    return "OK: Native CTL A5 audit wrote " + outputPath +
      " | " + rows.length + " artboards, 48 copied frames, original unchanged.";
  } catch (auditError) {
    // Keep native output evidence even when the preservation check fails.
    // Root can compare serializable numeric snapshots before retrying.
    try {
      if (!report) report = { sourceName: sourceName, libraryPath: libraryPath,
        pageWidthCm: pageW, pageHeightCm: pageH, suppressedAlerts: alerts,
        selectedSourceFrames: sourceSnapshots.length, artboards: typeof rows !== "undefined" ? rows : [] };
      report.auditError = String(auditError); report.sourceSnapshotPath = snapshotPath;
      report.sourceBefore = sourceStructureBefore;
      report.sourceAfter = sourceStructureAfter || sourceStructure(sourceByName());
      writeReport(report);
    } catch (partialWriteError) {}
    throw auditError;
  } finally {
    alert = previousAlert;
    dcFlattenForImposition = originalFlatten;
    // The note loader closes its copied icon document normally. If it throws
    // after opening, close only the fixture path, never an original icon.ai.
    for (var closeIndex = app.documents.length - 1; closeIndex >= 0; closeIndex--) {
      try { if (ownIconDocument(app.documents[closeIndex])) app.documents[closeIndex].close(SaveOptions.DONOTSAVECHANGES); }
      catch (closeIconError) {}
    }
    try {
      if (testDoc && String(testDoc.name) === testDocumentName && String(testDoc.name) !== sourceName)
        testDoc.close(SaveOptions.DONOTSAVECHANGES);
    } catch (closeTestError) {}
    try { previous.activate(); } catch (activateError) {}
    try { app.coordinateSystem = previousCoordinates; } catch (coordinateError) {}
  }
})();
