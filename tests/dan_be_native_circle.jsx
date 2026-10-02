// Isolated native integration fixture. Never changes any user's source document.
$.evalFile(File('C:/Users/ADMIN/AppData/Roaming/Adobe/CEP/extensions/DanCardCEP/jsx/dan_be_bridge.jsx'));
(function () {
  var root = 'C:/Users/ADMIN/Downloads/DanCard_Setup_23/tmp/', MM = 2.834645669;
  function write(name, data) {
    var file = File(root + name); file.encoding = 'UTF-8';
    if (!file.open('w')) throw new Error('Cannot write native fixture artifact.');
    file.write(data); file.close();
  }
  if (dcNativeCirclePhase === 'prepare') {
    // Refuse an existing fixture rather than overwrite it.
    if (File(root + 'dan_be_test_circle.ai').exists) throw new Error('Circle fixture already exists.');
    var doc = app.documents.add(DocumentColorSpace.CMYK, 160 * MM, 100 * MM);
    var cutLayer = doc.layers.add(); cutLayer.name = 'Khuôn bế';
    var artLayer = doc.layers.add(); artLayer.name = 'Bài';
    var black = new CMYKColor(); black.black = 100;
    var yellow = new CMYKColor(); yellow.yellow = 100;
    var cut = cutLayer.pathItems.ellipse(80 * MM, 15 * MM, 50 * MM, 50 * MM);
    cut.filled = false; cut.stroked = true; cut.strokeColor = black; cut.strokeWidth = .25;
    var art = artLayer.pathItems.ellipse(80.5 * MM, 94.5 * MM, 51 * MM, 51 * MM);
    art.filled = true; art.fillColor = yellow; art.stroked = false;
    doc.selection = [cut, art];
    doc.saveAs(File(root + 'dan_be_test_circle.ai'), new IllustratorSaveOptions());
    var prepared = dcDanBePrepare('1', '4', '7.5');
    write('dan_be_circle_payload.json', prepared);
    return prepared.substr(0, 100);
  }
  if (dcNativeCirclePhase !== 'render') throw new Error('Unknown native fixture phase.');
  if (!app.documents.length || app.activeDocument.name !== 'dan_be_test_circle.ai')
    throw new Error('Circle fixture is not active; refusing to change another document.');
  var planFile = File(root + 'dan_be_circle_plan.json'); planFile.encoding = 'UTF-8';
  if (!planFile.open('r')) throw new Error('Missing generated circle plan.');
  var data = dcDanBeJSON.parse(planFile.read()); planFile.close();
  var result = dcDanBeRender(data.jobId, dcDanBeJSON.stringify(data.plan.slots), dcDanBeJSON.stringify(data.plan));
  if (result.indexOf('OK:') !== 0) throw new Error(result);
  var doc = app.activeDocument, rect = doc.artboards[doc.artboards.length - 1].artboardRect.slice(0);
  var audit = {rect:rect, cuts:[], arts:[], dots:[]}, i, j, layer, list;
  for (i = 0; i < doc.layers.length; i++) {
    layer = doc.layers[i]; list = null;
    if (layer.name.indexOf('Dàn bế - Khuôn') === 0) list = audit.cuts;
    if (layer.name.indexOf('Dàn bế - Bài') === 0) list = audit.arts;
    if (layer.name.indexOf('Dàn bế - PON') === 0) list = audit.dots;
    if (!list) continue;
    for (j = 0; j < layer.pageItems.length; j++) list.push(
      (list === audit.arts ? layer.pageItems[j].visibleBounds : layer.pageItems[j].geometricBounds).slice(0));
  }
  if (audit.cuts.length !== 42 || audit.arts.length !== 42 || audit.dots.length !== 4)
    throw new Error('Native circle count is not 42/42/4.');
  write('dan_be_circle_audit.json', dcDanBeJSON.stringify(audit));
  doc.artboards[doc.artboards.length - 1].name = 'Dan be - 42 con tron 5 cm';
  doc.save();
  doc.activeView.zoom = .5; doc.activeView.centerPoint = [(rect[0] + rect[2])/2, (rect[1] + rect[3])/2];
  app.redraw();
  return result + '\nNative circle: 42 dies / 42 artworks / 4 PON.';
})();
