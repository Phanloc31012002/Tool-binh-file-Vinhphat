// Opt-in Illustrator integration. Only the parent runner may invoke this file.
// Creates and closes its own unsaved documents; user documents are read-only.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var MM = 2.834645669, EPS = 0.025;
  var previous = app.documents.length ? app.activeDocument : null;
  var oldCoordinates = app.coordinateSystem, oldInteraction = app.userInteractionLevel;
  var originalDocs = [], originalSelections = [], doc = null, jobId = null;
  var report = { passed:false, rows:[], audit:root+"/tmp/dan_be_cut_outline_native_audit.json" };
  function fail(message) { throw Error(message); }
  function assert(value, message) { if (!value) fail(message); }
  function near(a,b) { return Math.abs(a-b)<EPS; }
  function copy(a) { return a.slice(0); }
  function centre(b) { return [(b[0]+b[2])/2,(b[1]+b[3])/2]; }
  function readUtf8(path) {
    var f=new File(path); f.encoding="UTF-8";
    if (!f.open("r")) fail("Cannot read "+path);
    var text=f.read(); f.close(); return text;
  }
  function selectionArray(d) {
    var s=d.selection, out=[], i;
    if (!s) return out;
    if (typeof s.length==="undefined") return [s];
    for(i=0;i<s.length;i++) out.push(s[i]);
    return out;
  }
  function selectionState(item) {
    var state={type:item.typename};
    try { state.name=item.name; } catch(e) {}
    try { state.bounds=copy(item.geometricBounds); } catch(e2) {}
    try { state.hidden=item.hidden; state.locked=item.locked; } catch(e3) {}
    return state;
  }
  function documentState(d) {
    var out={name:d.name,saved:d.saved,itemCount:d.pageItems.length,
      activeBoard:d.artboards.getActiveArtboardIndex(),layers:[],boards:[],selection:[]},i,s;
    for(i=0;i<d.layers.length;i++) {
      var l=d.layers[i];
      out.layers.push([l.name,l.visible,l.locked,l.pageItems.length,l.layers.length]);
    }
    for(i=0;i<d.artboards.length;i++) out.boards.push([d.artboards[i].name,copy(d.artboards[i].artboardRect)]);
    s=selectionArray(d);
    for(i=0;i<s.length;i++) out.selection.push(selectionState(s[i]));
    return out;
  }
  function userSnapshot() {
    var out=[],i;
    for(i=0;i<app.documents.length;i++) out.push(documentState(app.documents[i]));
    return dcDanBeJSON.stringify(out);
  }
  function originalIdentityUnchanged() {
    if(app.documents.length!==originalDocs.length) return false;
    for(var i=0;i<originalDocs.length;i++) {
      if(app.documents[i]!==originalDocs[i]) return false;
      var now=selectionArray(originalDocs[i]), expected=originalSelections[i];
      if(now.length!==expected.length) return false;
      for(var j=0;j<expected.length;j++) if(now[j]!==expected[j]) return false;
    }
    return !previous || app.activeDocument===previous;
  }
  function guardOwned() {
    assert(doc && app.activeDocument===doc,"Active document is not the owned fixture");
    for(var i=0;i<originalDocs.length;i++) assert(doc!==originalDocs[i],"Refusing to mutate a user document");
  }
  function closeOwned() {
    if(!doc) return;
    for(var i=0;i<originalDocs.length;i++) assert(doc!==originalDocs[i],"Refusing to close a user document");
    for(var j=0;j<app.documents.length;j++) if(app.documents[j]===doc) {
      doc.close(SaveOptions.DONOTSAVECHANGES); break;
    }
    doc=null;
  }
  function colour(c) {
    var out={type:c.typename};
    if(c.typename==="CMYKColor") {out.c=c.cyan;out.m=c.magenta;out.y=c.yellow;out.k=c.black;}
    else if(c.typename==="RGBColor") {out.r=c.red;out.g=c.green;out.b=c.blue;}
    else if(c.typename==="GrayColor") out.gray=c.gray;
    else if(c.typename==="SpotColor") {out.spot=c.spot.name;out.tint=c.tint;}
    return out;
  }
  function nodes(p) {
    var out=[],i;
    for(i=0;i<p.pathPoints.length;i++) {
      var q=p.pathPoints[i]; out.push({a:copy(q.anchor),l:copy(q.leftDirection),r:copy(q.rightDirection)});
    }
    return out;
  }
  function pathState(p) {
    var out={name:p.name,closed:p.closed,clipping:p.clipping,filled:p.filled,stroked:p.stroked,
      bounds:copy(p.geometricBounds),nodes:nodes(p)};
    if(p.stroked) {out.strokeWidth=p.strokeWidth;out.strokeColor=colour(p.strokeColor);}
    if(p.filled) out.fillColor=colour(p.fillColor);
    return out;
  }
  function itemState(item) {
    var out={type:item.typename,name:item.name,bounds:copy(item.geometricBounds),children:[]},i;
    if(item.typename==="PathItem") return pathState(item);
    if(item.typename==="GroupItem") {
      out.clipped=item.clipped;
      for(i=0;i<item.pageItems.length;i++) if(item.pageItems[i].parent===item)
        out.children.push(itemState(item.pageItems[i]));
    } else if(item.typename==="CompoundPathItem") {
      for(i=0;i<item.pathItems.length;i++) out.children.push(pathState(item.pathItems[i]));
    }
    return out;
  }
  function findPath(item,name) {
    var i,found;
    if(item.typename==="PathItem") return item.name===name ? item : null;
    if(item.typename==="CompoundPathItem") {
      for(i=0;i<item.pathItems.length;i++) if(item.pathItems[i].name===name) return item.pathItems[i];
    } else if(item.typename==="GroupItem") {
      for(i=0;i<item.pageItems.length;i++) if(item.pageItems[i].parent===item) {
        found=findPath(item.pageItems[i],name); if(found) return found;
      }
    }
    return null;
  }
  function cmyk(c,m,y,k) {
    var q=new CMYKColor();q.cyan=c;q.magenta=m;q.yellow=y;q.black=k;return q;
  }
  function style(p,name,ink) {
    p.name=name;p.closed=true;p.filled=false;p.stroked=true;p.strokeWidth=0.25;p.strokeColor=ink;
    return p;
  }
  function rectangle(container,left,bottom,ink) {
    return style(container.pathItems.rectangle(bottom+56*MM,left,92*MM,56*MM),"outer-cut",ink);
  }
  function hole(container,left,bottom,ink) {
    // Intentionally off-centre: its offset must rotate with the outer outline.
    return style(container.pathItems.ellipse(bottom+24*MM,left+59*MM,12*MM,12*MM),"red-hole",ink);
  }
  function twoAnchorOuter(container,left,bottom,ink) {
    var p=container.pathItems.add();p.setEntirePath([[left,bottom+28*MM],[left+92*MM,bottom+28*MM]]);
    p.closed=true;
    p.pathPoints[0].leftDirection=[left,bottom-(28/3)*MM];
    p.pathPoints[0].rightDirection=[left,bottom+(196/3)*MM];
    p.pathPoints[1].leftDirection=[left+92*MM,bottom+(196/3)*MM];
    p.pathPoints[1].rightDirection=[left+92*MM,bottom-(28/3)*MM];
    return style(p,"outer-cut",ink);
  }
  function construct(kind,layer,left,bottom) {
    guardOwned();
    var black=cmyk(0,0,0,100),red=cmyk(0,100,100,0),g=layer.groupItems.add(),outer,inner;
    g.name="NATIVE_OUTLINE_"+kind;
    if(kind==="compound-hole-first") {
      var cp=g.compoundPathItems.add();cp.name="compound-cut";
      outer=rectangle(g,left,bottom,black);inner=hole(g,left,bottom,red);
      outer.move(cp,ElementPlacement.PLACEATEND);
      inner.move(cp,ElementPlacement.PLACEATBEGINNING);
      assert(cp.pathItems.length===2 && cp.pathItems[0].name==="red-hole",
        "Owned compound fixture did not retain hole-first path order");
      // Illustrator may share appearance between compound subpaths. Compare each
      // actual constructed source appearance rather than forcing unsupported styles.
    } else {
      outer=kind==="closed-two-anchor" ? twoAnchorOuter(g,left,bottom,black) : rectangle(g,left,bottom,black);
      inner=hole(g,left,bottom,red);
      if(kind==="clipping-outer") {
        // Enable clipping only after the outer path is closed and belongs to the group.
        outer.move(g,ElementPlacement.PLACEATBEGINNING);
        outer.clipping=true;g.clipped=true;
        outer.stroked=true;outer.strokeColor=black;
        assert(outer.closed && outer.clipping && g.clipped,"Invalid native clipping fixture");
      }
      assert(colour(outer.strokeColor).k===100 && colour(inner.strokeColor).m===100,
        "Owned black/red fixture colours were not constructed");
    }
    return {group:g,outer:outer,hole:inner};
  }
  function artwork(layer,left,bottom) {
    guardOwned();
    var g=layer.groupItems.add();g.name="NATIVE_SOURCE_ART";
    var p=g.pathItems.rectangle(bottom+56*MM,left,92*MM,56*MM);
    p.closed=true;p.stroked=false;p.filled=true;p.fillColor=cmyk(70,0,25,0);
    return g;
  }
  function footprint(groups) {
    var b=[Infinity,Infinity,-Infinity,-Infinity],gi,ci,pi,p;
    for(gi=0;gi<groups.length;gi++) for(ci=0;ci<groups[gi].length;ci++)
      for(pi=0;pi<groups[gi][ci].length;pi++) {
        p=groups[gi][ci][pi];b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);
        b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);
      }
    return b;
  }
  function topItems(layer) {
    var out=[],i;
    for(i=0;i<layer.pageItems.length;i++) if(layer.pageItems[i].parent===layer) out.push(layer.pageItems[i]);
    return out;
  }
  function layerNamed(name) {
    for(var i=0;i<doc.layers.length;i++) if(doc.layers[i].name===name) return doc.layers[i];
    fail("Missing owned result layer "+name);
  }
  function rotate(v,degrees) {
    if(degrees===90) return [-v[1],v[0]];
    if(degrees===180) return [-v[0],-v[1]];
    if(degrees===270) return [v[1],-v[0]];
    return copy(v);
  }
  function verifyPath(p,before,sourceCentre,targetCentre,angle,label) {
    var pp=nodes(p),i,j;
    assert(pp.length===before.nodes.length,label+" node count changed");
    assert(p.closed===before.closed && p.clipping===before.clipping,label+" closed/clipping flags changed");
    assert(p.filled===before.filled && p.stroked===before.stroked,label+" paint flags changed");
    if(before.stroked) assert(near(p.strokeWidth,before.strokeWidth) &&
      dcDanBeJSON.stringify(colour(p.strokeColor))===dcDanBeJSON.stringify(before.strokeColor),label+" stroke colour/width changed");
    if(before.filled) assert(dcDanBeJSON.stringify(colour(p.fillColor))===dcDanBeJSON.stringify(before.fillColor),label+" fill changed");
    for(i=0;i<pp.length;i++) for(j=0;j<3;j++) {
      var key=j===0 ? "a" : j===1 ? "l" : "r",a=before.nodes[i][key],b=pp[i][key],
        v=rotate([a[0]-sourceCentre[0],a[1]-sourceCentre[1]],angle);
      assert(near(b[0]-targetCentre[0],v[0]) && near(b[1]-targetCentre[1],v[1]),
        label+" anchor/handle was distorted or separated from its outer outline");
    }
    var b=copy(p.geometricBounds),old=before.bounds;
    var width=angle%180 ? old[1]-old[3] : old[2]-old[0],
      height=angle%180 ? old[2]-old[0] : old[1]-old[3];
    assert(near(b[2]-b[0],width) && near(b[1]-b[3],height),label+" physical dimensions changed");
  }
  // Bridge evaluation remains scoped to this closure, never replacing the panel engine.
  eval(readUtf8(root+"/DanCardCEP/jsx/dan_be_bridge.jsx"));
  assert(dcDanBeNestingVersion>=12,"Native clipping/short-closed-path bridge fix is not loaded");
  for(var odi=0;odi<app.documents.length;odi++) {
    originalDocs.push(app.documents[odi]);originalSelections.push(selectionArray(app.documents[odi]));
  }
  var beforeUser=userSnapshot();
  try {
    app.coordinateSystem=CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
    var kinds=["clipping-outer","closed-two-anchor","compound-hole-first"];
    var slots=[{mi:0,vi:0,angle:0,x:20,y:30},{mi:0,vi:1,angle:90,x:150,y:30},
      {mi:0,vi:2,angle:180,x:20,y:165},{mi:0,vi:3,angle:270,x:150,y:165}];
    for(var ki=0;ki<kinds.length;ki++) {
      doc=app.documents.add(DocumentColorSpace.CMYK,330*MM,354*MM);guardOwned();
      var cutLayer=doc.layers[0];cutLayer.name="Khuon be";
      var artLayer=doc.layers.add();artLayer.name="Bai";
      var source=construct(kinds[ki],cutLayer,20*MM,260*MM),art=artwork(artLayer,145*MM,260*MM);
      var originalState=dcDanBeJSON.stringify([itemState(source.group),itemState(art)]);
      var outerState=pathState(source.outer),holeState=pathState(source.hole),sourceCentre=centre(source.group.geometricBounds);
      assert(near(outerState.bounds[2]-outerState.bounds[0],92*MM) &&
        near(outerState.bounds[1]-outerState.bounds[3],56*MM),"Native source outer dimensions are not92x56");
      doc.selection=null;guardOwned();
      var prepared=dcDanBePrepare("1","4","7.5",false,"33","35.4","10","10","10","10");
      assert(prepared.indexOf("OKJSON:")===0,prepared);
      var payload=dcDanBeJSON.parse(prepared.substring(7));jobId=payload.jobId;
      assert(payload.types.length===1,"Native prepare split one source into multiple types");
      assert(dcDanBeJobs[jobId].doc===doc && dcDanBeJobs[jobId].models.length===1 &&
        dcDanBeJobs[jobId].models[0].khuon.item===source.group &&
        dcDanBeJobs[jobId].models[0].bai.item===art,"Explicit Khuon/Bai source ownership changed");
      var b=footprint(payload.types[0].groups);
      assert(Math.abs(b[2]-b[0]-92)<0.001 && Math.abs(b[3]-b[1]-56)<0.001,
        "Native footprint used the red hole instead of the complete black outer outline");
      assert(payload.types[0].groups.length>0,"Native geometry is empty");
      var rendered=dcDanBeRender(jobId,dcDanBeJSON.stringify(slots),"{}");jobId=null;
      assert(rendered.indexOf("OK:[[COUNT:4]]")===0,rendered);guardOwned();
      var copies=topItems(layerNamed("Dàn bế - Khuôn")),rect=copy(doc.artboards[0].artboardRect),checked=[];
      assert(copies.length===4,"Native renderer did not copy the complete cut groups four times");
      for(var si=0;si<slots.length;si++) {
        var slot=slots[si],copyItem=null;
        for(var oi=0;oi<copies.length;oi++) {
          var cb=copy(copies[oi].geometricBounds);
          if(near(cb[0],rect[0]+slot.x*MM) && near(cb[3],rect[3]+slot.y*MM)) {copyItem=copies[oi];break;}
        }
        assert(copyItem,"Missing native group at a quarter-turn slot");
        var copyBounds=copy(copyItem.geometricBounds),targetCentre=centre(copyBounds),
          outerCopy=findPath(copyItem,"outer-cut"),holeCopy=findPath(copyItem,"red-hole");
        assert(outerCopy && holeCopy,"Renderer lost a native outer or hole path");
        assert(copyItem.typename==="GroupItem" && copyItem.clipped===source.group.clipped,
          "Native clipping group structure changed");
        verifyPath(outerCopy,outerState,sourceCentre,targetCentre,slot.angle,"Outer");
        verifyPath(holeCopy,holeState,sourceCentre,targetCentre,slot.angle,"Hole");
        var width=slot.vi%2 ? 56 : 92,height=slot.vi%2 ? 92 : 56;
        assert(near(copyBounds[2]-copyBounds[0],width*MM) && near(copyBounds[1]-copyBounds[3],height*MM),
          "Copied native outer/hole footprint changed after rotation");
        checked.push({angle:slot.angle,outerNodes:outerCopy.pathPoints.length,holeNodes:holeCopy.pathPoints.length,
          physicalMm:[(copyBounds[2]-copyBounds[0])/MM,(copyBounds[1]-copyBounds[3])/MM],
          coloursAndHandlesPreserved:true,relativeHoleOffsetPreserved:true});
      }
      assert(dcDanBeJSON.stringify([itemState(source.group),itemState(art)])===originalState,
        "Preparing/rendering changed an owned source path, hole or artwork");
      report.rows.push({fixture:kinds[ki],footprintMm:[b[2]-b[0],b[3]-b[1]],
        preparedTypes:payload.types.length,geometryGroups:payload.types[0].groups.length,
        originalOwnedSourcesUnchanged:true,checkedQuarterTurns:checked});
      closeOwned();
    }
    report.passed=true;
  } catch(error) { report.error=String(error); }
  finally {
    try { if(jobId) delete dcDanBeJobs[jobId]; } catch(jobError) {}
    try { closeOwned(); } catch(closeError) {report.passed=false;report.closeError=String(closeError);}
    try { if(previous) previous.activate(); } catch(activeError) {report.passed=false;report.activeError=String(activeError);}
    try { app.coordinateSystem=oldCoordinates; } catch(coordinateError) {report.passed=false;}
    try { app.userInteractionLevel=oldInteraction; } catch(interactionError) {report.passed=false;}
  }
  report.originalDocumentsUnchanged=originalIdentityUnchanged() && userSnapshot()===beforeUser;
  report.originalApplicationStateRestored=app.coordinateSystem===oldCoordinates &&
    app.userInteractionLevel===oldInteraction && (!previous || app.activeDocument===previous);
  if(!report.originalDocumentsUnchanged || !report.originalApplicationStateRestored) report.passed=false;
  var output=new File(report.audit);output.encoding="UTF-8";
  if(!output.open("w")) fail("Cannot write owned cut-outline native report");
  output.write(dcDanBeJSON.stringify(report));output.close();
  return dcDanBeJSON.stringify(report);
})();
