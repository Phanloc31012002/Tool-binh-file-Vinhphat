// Opt-in Illustrator COM diagnostic. Uses only its own synthetic document.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var folder = new Folder(root + "/tmp/ctl_pdf_crash_20261003");
  if (!folder.exists) folder.create();
  var phase = new File(folder.fsName + "/phase.txt");
  function log(s) { phase.encoding = "UTF-8"; phase.open("a"); phase.writeln(s); phase.close(); }
  var original = app.documents.length ? app.activeDocument : null;
  var owned = null;
  var oldPicker = typeof dcChonThuMucLuuPDF === "function" ? dcChonThuMucLuuPDF : null;
  var oldInteraction = app.userInteractionLevel;
  var result = {};
  function snapshot(doc) {
    doc.activate();
    var a = [], layers = [], items = [];
    for (var k = 0; k < doc.artboards.length; k++) a.push(doc.artboards[k].artboardRect.join(","));
    for (var l = 0; l < doc.layers.length; l++) layers.push(doc.layers[l].name + ":" + doc.layers[l].locked + ":" + doc.layers[l].visible);
    for (var i = 0; i < doc.pageItems.length; i++) {
      var item = doc.pageItems[i];
      items.push(item.typename + ":" + item.name + ":" + item.parent.name + ":" + item.geometricBounds.join(",") + ":" + item.locked);
    }
    var sel = []; for (var s = 0; s < doc.selection.length; s++) sel.push(doc.selection[s].name);
    return [doc.name, doc.saved, a.join("|"), layers.join("|"), items.join("|"), sel.join("|"), doc.activeLayer.name, doc.artboards.getActiveArtboardIndex()].join("\n");
  }
  function color(c,m,y,k) { var v = new CMYKColor(); v.cyan=c;v.magenta=m;v.yellow=y;v.black=k;return v; }
  try {
    log("START");
    var lib = new File(root + "/DanCardCEP/jsx/dan_card_lib.jsx");
    lib.encoding="UTF-8"; lib.open("r"); var text=lib.read(); lib.close();
    var from=text.indexOf("function dcLuuCtlOffsetPDF(");
    var to=text.indexOf("//  TEST: Dàn CATALOGUE KEO GÁY",from);
    eval(text.substring(from,to));
    dcChonThuMucLuuPDF = function () { return folder; };
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    owned = app.documents.add(DocumentColorSpace.CMYK, 300, 200, 4);
    var MM=2.834645669;
    var sizes=[[428,313],[648,418],[858,638],[858,638]];
    var body=owned.layers[0];body.name="Bai";
    var notes=owned.layers.add();notes.name="Ghi chu";
    var pon=owned.layers.add();pon.name="Pon cat CTL Offset tu dong";
    var artColors=[color(0,100,100,0),color(100,0,100,0),color(100,0,0,0),color(0,100,0,0)];
    for (var n=0;n<sizes.length;n++) {
      var left=-6000+n*2600, top=6000;
      var w=sizes[n][0]*MM,h=sizes[n][1]*MM;
      owned.artboards[n].artboardRect=[left,top,left+w,top-h];
      var group=body.groupItems.add();group.name="BAI_"+n;
      var p=group.pathItems.rectangle(top-25*MM,left+25*MM,60*MM,60*MM);
      p.fillColor=artColors[n];p.stroked=false;p.name="COLOR_"+n;
      var t=notes.textFrames.add();t.contents=n===0?"BIA":"RUOT "+n;t.position=[left+12*MM,top-12*MM];t.name="NOTE_"+n;
      var mark=pon.pathItems.add();mark.setEntirePath([[left+4*MM,top-4*MM],[left+9*MM,top-4*MM]]);
      mark.filled=false;mark.stroked=true;mark.strokeWidth=1;mark.strokeColor=color(0,0,0,100);mark.name="PON_"+n;
      if(n===1) {
        owned.selection=null;p.selected=true;
        var ro=new RasterizeOptions();ro.resolution=300;ro.transparency=true;
        var image=owned.rasterize(p,p.geometricBounds,ro);image.name="RASTER_1";
      }
    }
    // Hidden content and a locked individual PON must not disturb export.
    pon.pageItems[0].locked=true;pon.locked=true;
    var hidden=owned.layers.add();hidden.name="HIDDEN";
    var hiddenItem=hidden.pathItems.rectangle(6000,-6000,300,300);hiddenItem.filled=true;hiddenItem.fillColor=color(0,0,100,0);hidden.visible=false;
    owned.activeLayer=body;owned.artboards.setActiveArtboardIndex(1);owned.selection=null;
    body.pageItems[0].selected=true;
    var before=snapshot(owned);
    log("BEFORE_EXPORT");
    var jobs="BIA=1@"+(428*MM)+"x"+(313*MM)+"|RUOT 1=2@"+(648*MM)+"x"+(418*MM)+"|RUOT 2=3,4@"+(858*MM)+"x"+(638*MM);
    result.exportResult=dcLuuCtlOffsetPDF("4",jobs);
    log(result.exportResult);
    result.sourceUnchanged=before===snapshot(owned);
    result.openDocs=app.documents.length;
    result.files=[];
    var names=["BIA.pdf","RUOT 1.pdf","RUOT 2.pdf"];
    for(var f=0;f<names.length;f++){var file=new File(folder.fsName+"/"+names[f]);result.files.push(names[f]+":"+file.exists+":"+file.length);}
    result.collisionResult=dcLuuCtlOffsetPDF("4",jobs);
    result.invalidResult=dcLuuCtlOffsetPDF("5",jobs);
    result.afterErrorsUnchanged=before===snapshot(owned);
    if(result.exportResult.indexOf("OK:")!==0||!result.sourceUnchanged||!result.afterErrorsUnchanged)throw new Error("Native audit failed");
    result.passed=true;
  } catch (e) { result.error=String(e);log("ERROR "+e); }
  finally {
    if(owned){owned.activate();owned.close(SaveOptions.DONOTSAVECHANGES);}
    if(original) original.activate();
    if(oldPicker)dcChonThuMucLuuPDF=oldPicker;
    app.userInteractionLevel=oldInteraction;
    var out=new File(folder.fsName+"/result.json");out.encoding="UTF-8";out.open("w");out.write(result.toSource());out.close();
  }
  return result.toSource();
})();
