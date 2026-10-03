// Opt-in native regression: synthetic documents only; never edits user files.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var folder = new Folder(root + "/tmp/kts_mixed_2.15.20_" + new Date().getTime());
  folder.create();
  var previous = app.documents.length ? app.activeDocument : null;
  var oldCoords = app.coordinateSystem, oldInteraction = app.userInteractionLevel;
  var owned = null, result = {passed:false,cases:[],folder:folder.fsName};
  var MM = 2.834645669, EPS = 0.1;
  function assert(value,message) { if(!value) throw Error(message); }
  function snapshot(items) {
    var values=[];
    for(var i=0;i<items.length;i++) values.push(items[i].name+":"+items[i].visibleBounds.join(","));
    return values.join("|");
  }
  function paint(c,m,y,k) { var v=new CMYKColor();v.cyan=c;v.magenta=m;v.yellow=y;v.black=k;return v; }
  function fixture(layer, name, x, top, w, h, model, back) {
    var g=layer.groupItems.add();g.name=name;
    var body=g.pathItems.rectangle(top,x,w,h);
    body.stroked=false;body.filled=true;
    body.fillColor=paint(model===0?80:0,model===1?70:0,model===2?85:15,back?25:0);
    var label=g.textFrames.add();label.contents=name;
    label.textRange.characterAttributes.size=12;
    label.position=[x+8,top-10];
    var corner=g.pathItems.rectangle(top-5,x+5,4,4);corner.stroked=false;
    corner.filled=true;corner.fillColor=paint(0,0,0,100);
    return g;
  }
  function noOverlap(items) {
    for(var i=0;i<items.length;i++) for(var j=0;j<i;j++) {
      var a=items[i].visibleBounds,b=items[j].visibleBounds;
      assert(a[2]<=b[0]+EPS||b[2]<=a[0]+EPS||a[3]>=b[1]-EPS||b[3]>=a[1]-EPS,"Overlapping copies");
    }
  }
  try {
    app.coordinateSystem=CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
    $.evalFile(new File(root+"/DanCardCEP/jsx/dan_card_lib.jsx"));
    for(var sideCase=0;sideCase<2;sideCase++) {
      owned=app.documents.add(DocumentColorSpace.CMYK,900,1100);
      owned.selection=null;
      var sources=[],specs=[[90,50],[60,40],[75,65]],top=1000;
      var sourceLayer=owned.layers[0]; sourceLayer.name="MIXED_SOURCE";
      for(var m=0;m<specs.length;m++) {
        sources.push(fixture(sourceLayer,"F"+m,0,top,specs[m][0]*MM,specs[m][1]*MM,m,false));
        if(sideCase) sources.push(fixture(sourceLayer,"B"+m,500,top+(m%2?.02:-.02),specs[m][0]*MM,specs[m][1]*MM,m,true));
        top-=Math.max(specs[m][1]*MM,200)+100;
      }
      var before=snapshot(sources);
      owned.selection=sources.slice(0).reverse();
      var started=new Date().getTime();
      var status=dcDanToiUu("33","35.4",sideCase===1,true);
      assert(status.indexOf("OK:")===0,status);
      assert(owned.artboards.length===(sideCase?2:1),"Wrong output artboard count");
      assert(before===snapshot(sources),"Source changed");
      var fronts=[],backs=[],counts=[0,0,0],frontLayer=null,backLayer=null;
      for(var li=0;li<owned.layers.length;li++) {
        var layer=owned.layers[li];
        if(layer.name===(sideCase?"Dan toi uu - Mat truoc":"Dan toi uu")) frontLayer=layer;
        if(layer.name==="Dan toi uu - Mat sau") backLayer=layer;
      }
      for(var pi=0;pi<frontLayer.pageItems.length;pi++) {
        var f=frontLayer.pageItems[pi];
        if(f.parent===frontLayer && f.typename==="GroupItem") fronts.push(f);
      }
      if(backLayer) for(pi=0;pi<backLayer.pageItems.length;pi++) {
        var b=backLayer.pageItems[pi];
        if(b.parent===backLayer && b.typename==="GroupItem") backs.push(b);
      }
      assert(fronts.length>0,"No copies");
      assert(!sideCase||fronts.length===backs.length,"Duplex counts differ");
      noOverlap(fronts);noOverlap(backs);
      var fr=owned.artboards[0].artboardRect;
      var br=sideCase?owned.artboards[1].artboardRect:null;
      for(pi=0;pi<fronts.length;pi++) {
        f=fronts[pi]; var fb=f.visibleBounds,model=parseInt(f.name.substring(1),10);
        assert(model>=0&&model<3,"Wrong front identity");counts[model]++;
        assert(fb[0]>=fr[0]+3*MM-EPS&&fb[2]<=fr[2]-3*MM+EPS&&fb[1]<=fr[1]-3*MM+EPS&&fb[3]>=fr[3]+3*MM-EPS,"Copy outside safe margin");
        var w=fb[2]-fb[0],h=fb[1]-fb[3],sw=specs[model][0]*MM,sh=specs[model][1]*MM;
        assert((Math.abs(w-sw)<EPS&&Math.abs(h-sh)<EPS)||(Math.abs(w-sh)<EPS&&Math.abs(h-sw)<EPS),"Source resized");
        if(sideCase) {
          var found=false,fx=(fb[0]+fb[2])/2-fr[0],fy=fr[1]-(fb[1]+fb[3])/2;
          for(var bi=0;bi<backs.length;bi++) {
            b=backs[bi]; if(b.name!=="B"+model) continue;
            var bb=b.visibleBounds,bx=(bb[0]+bb[2])/2-br[0],by=br[1]-(bb[1]+bb[3])/2;
            if(Math.abs(fx+bx-(fr[2]-fr[0]))<EPS&&Math.abs(fy-by)<EPS) {found=true;break;}
          }
          assert(found,"Wrong duplex identity/mirror position");
        }
      }
      var minimum=Math.min(counts[0],counts[1],counts[2]),maximum=Math.max(counts[0],counts[1],counts[2]);
      assert(minimum>0&&maximum-minimum<=1,"Unbalanced model counts");
      var capture=new ImageCaptureOptions();capture.resolution=72;capture.antiAliasing=true;
      owned.imageCapture(new File(folder.fsName+(sideCase?"/two_sided.png":"/one_sided.png")),fr,capture);
      result.cases.push({twoSided:sideCase===1,status:status,counts:counts,elapsedMs:new Date().getTime()-started,sourceUnchanged:true,passed:true});
      owned.close(SaveOptions.DONOTSAVECHANGES);owned=null;
    }
    result.passed=true;
  } catch(e) {result.error=String(e)+" [line "+e.line+"]";}
  finally {
    var out=new File(folder.fsName+"/result.txt");out.encoding="UTF-8";out.open("w");out.write(result.toSource());out.close();
    if(owned) owned.close(SaveOptions.DONOTSAVECHANGES);
    if(previous) previous.activate();
    app.coordinateSystem=oldCoords;app.userInteractionLevel=oldInteraction;
  }
  return result.toSource();
})();
