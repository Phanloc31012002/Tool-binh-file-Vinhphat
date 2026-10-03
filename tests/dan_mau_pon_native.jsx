// Opt-in native placement diagnostic: no user's document/template is edited.
(function () {
  var root="C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var folder=new Folder(root+"/tmp/dan_mau_pon_20261003"); if(!folder.exists)folder.create();
  var original=app.documents.length?app.activeDocument:null;
  var savedCoordinates=app.coordinateSystem, savedInteraction=app.userInteractionLevel;
  var ponDoc=null, source=null, oldAlert=alert, messages=[];
  var prefix=typeof taskMauCasePrefix!=="undefined"?taskMauCasePrefix:"baseline";
  var result={cases:[]};
  function write(name,text){var f=new File(folder.fsName+"/"+name);f.encoding="UTF-8";f.open("w");f.write(text);f.close();}
  function read(path){var f=new File(path);f.encoding="UTF-8";f.open("r");var s=f.read();f.close();return s;}
  function selectFixturePon(){return new File(folder.fsName+"/pon.ai");}
  function equal(a,b){for(var i=0;i<4;i++)if(Math.abs(a[i]-b[i])>.02)return false;return true;}
  try {
    app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
    app.coordinateSystem=CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    alert=function(s){messages.push(String(s));};
    var rect=[1000,2000,1600,1600];
    ponDoc=app.documents.add(DocumentColorSpace.CMYK,600,400);
    ponDoc.artboards[0].artboardRect=rect;
    var mark=ponDoc.pathItems.rectangle(1980,1020,10,10);mark.name="PON_MARK";
    var aiOptions=new IllustratorSaveOptions();aiOptions.pdfCompatible=false;
    ponDoc.saveAs(new File(folder.fsName+"/pon.ai"),aiOptions);
    ponDoc.close(SaveOptions.DONOTSAVECHANGES);ponDoc=null;
    // far-away learned absolute references; actual dx/dy are centred slots.
    var template="# dan theo mau v5\nMODE\tone\nSTATE\tready\nBLOCK\tF\nsideHi\t35.2778\nsideLo\t17.6389\nn\t2\nslot\t-70\t0\t1\t0\t100\t50\timage\nslot\t70\t0\t1\t0\t100\t50\timage\nlearnref\t0\t6000\t7000\t100\t50\nlearnref\t1\t6140\t7000\t100\t50\n";
    write("template.txt",template);
    var lib=read(root+"/DanCardCEP/jsx/dan_card_lib.jsx");
    var from=lib.indexOf("function dcApMau("),to=lib.indexOf("//  dcAutoSavePDF",from);
    var code=lib.substring(from,to)
      .replace('Folder.temp + "/dan_theo_mau_tmp.txt"','"'+folder.fsName.replace(/\\/g,"/")+'/template.txt"')
      .replace('File.openDialog(label, "*.ai")','selectFixturePon()');
    // New wrapper helper is loaded separately when present.
    if(lib.indexOf("function dcApMauCore(")>=0) {
      var v=lib.indexOf("var dcDanTheoMauVersion");
      code=lib.substring(v,to)
        .replace('Folder.temp + "/dan_theo_mau_tmp.txt"','"'+folder.fsName.replace(/\\/g,"/")+'/template.txt"')
        .replace('File.openDialog(label, "*.ai")','selectFixturePon()');
    }
    eval(code);
    for(var c=0;c<4;c++) {
      write("template.txt", c===2 ? template.replace("MODE\tone", "MODE\ttwo\nBACK_MIRROR\tHORIZONTAL") : template);
      source=app.documents.add(DocumentColorSpace.CMYK,500,300,2);
      source.artboards[0].artboardRect=[-5000,6000,-4500,5700];
      source.artboards[1].artboardRect=[-4000,6000,-3500,5700];
      source.artboards.setActiveArtboardIndex(1);
      source.rulerOrigin=c===0?[600,-900]:[0,0];
      var artwork=source.pathItems.rectangle(5900,-4900,100,50);
      artwork.name="INPUT_ONLY";source.selection=null;artwork.selected=true;
      var originalBounds=artwork.geometricBounds.slice(0);
      var second=null,secondBounds=null;
      if(c>=2){second=source.pathItems.rectangle(5900,-4700,100,50);second.name="SECOND_INPUT";second.selected=true;secondBounds=second.geometricBounds.slice(0);}
      app.coordinateSystem=c===1?CoordinateSystem.DOCUMENTCOORDINATESYSTEM:CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
      var beforeCoordinates=app.coordinateSystem;
      var status=dcApMau(c===3);
      source.activate();
      var coordinateRestored=app.coordinateSystem===beforeCoordinates;
      app.coordinateSystem=CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
      var afterRect=source.artboards[0].artboardRect.slice(0);
      var caseResult={status:status,requested:rect,actual:afterRect,matched:equal(rect,afterRect),coordinateRestored:coordinateRestored};
      caseResult.sourceUnchanged=equal(originalBounds,artwork.geometricBounds);
      if(second)caseResult.sourceUnchanged=caseResult.sourceUnchanged&&equal(secondBounds,second.geometricBounds);
      caseResult.artboardCount=source.artboards.length;
      var output=null;for(var l=0;l<source.layers.length;l++)if(source.layers[l].name==="__DAN_THEO_MAU_KET_QUA__")output=source.layers[l];
      caseResult.outputs=[];
      if(output)for(var j=0;j<output.pageItems.length;j++)if(output.pageItems[j].parent===output)caseResult.outputs.push({kind:output.pageItems[j].typename,bounds:output.pageItems[j].geometricBounds.slice(0)});
      result.cases.push(caseResult);
      var capture=new ImageCaptureOptions();capture.resolution=72;capture.antiAliasing=true;capture.transparency=false;
      source.imageCapture(new File(folder.fsName+"/"+prefix+"-"+c+".png"),afterRect,capture);
      source.close(SaveOptions.DONOTSAVECHANGES);source=null;
    }
    result.passed=true;
    for(var checked=0;checked<result.cases.length;checked++) {
      var entry=result.cases[checked];
      if(!entry.matched||!entry.coordinateRestored||!entry.sourceUnchanged||entry.status.indexOf("OK:")!==0)result.passed=false;
    }
  } catch(e) {result.error=String(e);}
  finally {
    if(ponDoc){ponDoc.activate();ponDoc.close(SaveOptions.DONOTSAVECHANGES);}
    if(source){source.activate();source.close(SaveOptions.DONOTSAVECHANGES);}
    if(original)original.activate();app.coordinateSystem=savedCoordinates;app.userInteractionLevel=savedInteraction;alert=oldAlert;
    result.messages=messages;write(prefix+".txt",result.toSource());
  }
  return result.toSource();
})();
