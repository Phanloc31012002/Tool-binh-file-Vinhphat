// Test tích hợp trong Illustrator thật, chỉ chạy khi chủ động bật. Tiến trình cha chạy nó qua COM.
// Mọi thay đổi chỉ nằm trong một tài liệu test mới, riêng, chưa lưu. Tài liệu người dùng
// đang mở chỉ được đọc để chụp snapshot, không bao giờ bị chọn, sửa, lưu hay đóng.
(function () {
  var root = "C:/Users/ADMIN/Downloads/DanCard_Setup_23";
  var MM = 2.834645669,
    EPS = 0.025,
    CURVE_FLATNESS_MM = 0.0001;
  var previous = app.documents.length ? app.activeDocument : null;
  var oldCoordinates = app.coordinateSystem;
  var oldInteraction = app.userInteractionLevel;
  var doc = null,
    jobId = null,
    originalDocs = [],
    originalSelections = [];
  var report = {
    passed: false,
    rows: [],
    output: root + "/tmp/dan_be_variable_native.png",
  };
  function fail(message) {
    throw Error(message);
  }
  function assert(value, message) {
    if (!value) fail(message);
  }
  function near(a, b) {
    return Math.abs(a - b) < EPS;
  }
  function copy(a) {
    return a.slice(0);
  }
  function centre(b) {
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  }
  function readUtf8(path) {
    var f = new File(path);
    f.encoding = "UTF-8";
    if (!f.open("r")) fail("Cannot read " + path);
    var content = f.read();
    f.close();
    return content;
  }
  function selectionArray(d) {
    var selected = d.selection,
      out = [];
    if (!selected) return out;
    if (typeof selected.length === "undefined") return [selected];
    for (var i = 0; i < selected.length; i++) out.push(selected[i]);
    return out;
  }
  function selectedState(item) {
    var state = { type: item.typename };
    try {
      state.name = item.name;
    } catch (ignoreName) {}
    try {
      state.bounds = copy(item.geometricBounds);
    } catch (ignoreBounds) {}
    try {
      state.hidden = item.hidden;
      state.locked = item.locked;
    } catch (ignoreFlags) {}
    return state;
  }
  function documentState(d) {
    var state = {
      name: d.name,
      saved: d.saved,
      itemCount: d.pageItems.length,
      layers: [],
      boards: [],
      selected: [],
      activeBoard: d.artboards.getActiveArtboardIndex(),
    };
    for (var li = 0; li < d.layers.length; li++) {
      var l = d.layers[li];
      state.layers.push([
        l.name,
        l.visible,
        l.locked,
        l.pageItems.length,
        l.layers.length,
      ]);
    }
    for (var bi = 0; bi < d.artboards.length; bi++)
      state.boards.push([
        d.artboards[bi].name,
        copy(d.artboards[bi].artboardRect),
      ]);
    var selected = selectionArray(d);
    for (var si = 0; si < selected.length; si++)
      state.selected.push(selectedState(selected[si]));
    return state;
  }
  function userSnapshot() {
    var out = [];
    for (var di = 0; di < app.documents.length; di++)
      out.push(documentState(app.documents[di]));
    return dcDanBeJSON.stringify(out);
  }
  function originalIdentityUnchanged() {
    if (app.documents.length !== originalDocs.length) return false;
    for (var di = 0; di < originalDocs.length; di++) {
      if (app.documents[di] !== originalDocs[di]) return false;
      var selected = selectionArray(originalDocs[di]),
        expected = originalSelections[di];
      if (selected.length !== expected.length) return false;
      for (var si = 0; si < expected.length; si++)
        if (selected[si] !== expected[si]) return false;
    }
    return !previous || app.activeDocument === previous;
  }
  function guardOwned() {
    assert(
      doc && app.activeDocument === doc,
      "Active document is not the owned native fixture",
    );
    for (var di = 0; di < originalDocs.length; di++)
      assert(
        doc !== originalDocs[di],
        "Refusing to mutate an original user document",
      );
  }
  function closeOwned() {
    if (!doc) return;
    for (var di = 0; di < originalDocs.length; di++)
      assert(doc !== originalDocs[di], "Refusing to close a user document");
    for (var ai = 0; ai < app.documents.length; ai++)
      if (app.documents[ai] === doc) {
        doc.close(SaveOptions.DONOTSAVECHANGES);
        break;
      }
    doc = null;
  }
  function sourceState(items) {
    var out = [];
    for (var i = 0; i < items.length; i++) out.push(selectedState(items[i]));
    return dcDanBeJSON.stringify(out);
  }
  function nativeNodes(item) {
    var result=[], pp=item.pathPoints, i;
    for(i=0;i<pp.length;i++) result.push({a:copy(pp[i].anchor),
      l:copy(pp[i].leftDirection),r:copy(pp[i].rightDirection)});
    return result;
  }
  function unchangedNativeRotation(item, original, originalBounds, outputBounds, angle) {
    var pp=item.pathPoints, before=centre(originalBounds), after=centre(outputBounds), i,j;
    assert(pp.length===original.length,"Native cut node count changed");
    for(i=0;i<pp.length;i++) {
      var pairs=[[original[i].a,copy(pp[i].anchor)],
        [original[i].l,copy(pp[i].leftDirection)],[original[i].r,copy(pp[i].rightDirection)]];
      for(j=0;j<pairs.length;j++) {
        var v=rotatedVector([pairs[j][0][0]-before[0],pairs[j][0][1]-before[1]],angle);
        assert(near(pairs[j][1][0]-after[0],v[0]) && near(pairs[j][1][1]-after[1],v[1]),
          "Native cut node/control handle was resized or altered");
      }
    }
  }
  function nativeFaceExport(cuts,rect,dots,back,paperW,label,ponItems) {
    var result={name:label,rectPt:copy(rect),ponCirclesPt:[],cuts:[]},i;
    for(i=0;i<ponItems.length;i++) {
      var pb=ponItems[i].bounds;
      result.ponCirclesPt.push({cx:(pb[0]+pb[2])/2,cy:(pb[1]+pb[3])/2,
        r:(pb[2]-pb[0])/2,boundsPt:copy(pb)});
    }
    for(i=0;i<cuts.length;i++) result.cuts.push({boundsPt:copy(cuts[i].bounds),
      nodes:nativeNodes(cuts[i].item)});
    return result;
  }
  function sourcePath(container, left, bottom, name, filled, color) {
    guardOwned();
    var p = container.pathItems.add();
    p.name = name;
    var anchors = [],
      i;
    for (i = 0; i < nodes.length; i++)
      anchors.push([left + nodes[i].a[0] * MM, bottom + nodes[i].a[1] * MM]);
    p.setEntirePath(anchors);
    p.closed = true;
    for (i = 0; i < nodes.length; i++) {
      var pp = p.pathPoints[i];
      pp.leftDirection = [
        left + nodes[i].l[0] * MM,
        bottom + nodes[i].l[1] * MM,
      ];
      pp.rightDirection = [
        left + nodes[i].r[0] * MM,
        bottom + nodes[i].r[1] * MM,
      ];
    }
    p.filled = filled;
    p.stroked = !filled;
    if (filled) p.fillColor = color;
    else {
      p.strokeWidth = 0.25;
      var k = new CMYKColor();
      k.black = 100;
      p.strokeColor = k;
    }
    return p;
  }
  function artwork(layer, left, bottom, name, back) {
    var g = layer.groupItems.add();
    g.name = name;
    var fill = new CMYKColor();
    fill.cyan = back ? 0 : 75;
    fill.magenta = back ? 75 : 0;
    fill.yellow = back ? 5 : 35;
    sourcePath(g, left, bottom, "artwork-source", true, fill);
    var marker = g.pathItems.add();
    marker.name = "direction-marker";
    marker.setEntirePath([
      [left + sourceWidthMm * 0.43 * MM, bottom + sourceHeightMm * 0.36 * MM],
      [left + sourceWidthMm * 0.57 * MM, bottom + sourceHeightMm * 0.33 * MM],
      [left + sourceWidthMm * 0.47 * MM, bottom + sourceHeightMm * 0.27 * MM],
    ]);
    marker.closed = true;
    marker.filled = true;
    marker.stroked = false;
    var white = new CMYKColor();
    marker.fillColor = white;
    return g;
  }
  function markerVectors(group) {
    for (var pi = 0; pi < group.pathItems.length; pi++) {
      var p = group.pathItems[pi];
      if (p.name !== "direction-marker") continue;
      var pp = p.pathPoints,
        a = pp[0].anchor,
        b = pp[1].anchor,
        c = pp[2].anchor;
      return [
        [b[0] - a[0], b[1] - a[1]],
        [c[0] - a[0], c[1] - a[1]],
      ];
    }
    fail("Missing direction marker");
  }
  function rotatedVector(v, degrees) {
    var a = (degrees * Math.PI) / 180;
    return [
      v[0] * Math.cos(a) - v[1] * Math.sin(a),
      v[0] * Math.sin(a) + v[1] * Math.cos(a),
    ];
  }
  function checkArtworkDirection(group, original, angle, label) {
    var vectors = markerVectors(group);
    for (var i = 0; i < 2; i++) {
      var target = rotatedVector(original[i], angle);
      assert(
        near(vectors[i][0], target[0]) && near(vectors[i][1], target[1]),
        label + " rotation mismatch",
      );
    }
    var originalHand =
      original[0][0] * original[1][1] - original[0][1] * original[1][0];
    var outputHand =
      vectors[0][0] * vectors[1][1] - vectors[0][1] * vectors[1][0];
    assert(near(originalHand, outputHand), label + " artwork was mirrored");
  }
  function layerNamed(name) {
    for (var li = 0; li < doc.layers.length; li++)
      if (doc.layers[li].name === name) return doc.layers[li];
    fail("Missing output layer " + name);
  }
  // Đọc bounds từ Illustrator một lần cho mỗi item kết quả, rồi so khớp bằng các số đã cache.
  function records(layer, visible) {
    var out = [];
    for (var pi = 0; pi < layer.pageItems.length; pi++) {
      var it = layer.pageItems[pi];
      if (it.parent === layer)
        out.push({
          item: it,
          bounds: copy(visible ? it.visibleBounds : it.geometricBounds),
        });
    }
    return out;
  }
  function itemAt(items, x, y, bottomLeft) {
    for (var i = 0; i < items.length; i++) {
      var b = items[i].bounds,
        p = bottomLeft ? [b[0], b[3]] : centre(b);
      if (near(p[0], x) && near(p[1], y)) return items[i];
    }
    fail("No output item at the expected slot");
  }
  function insideMargin(rect, bounds) {
    return (
      bounds[0] >= rect[0] + input.marginMm * MM - EPS &&
      bounds[2] <= rect[2] - input.marginMm * MM + EPS &&
      bounds[1] <= rect[1] - input.marginMm * MM + EPS &&
      bounds[3] >= rect[3] + input.marginMm * MM - EPS
    );
  }
  function checkBlockCentre(items, rect) {
    var b = [Infinity, -Infinity, -Infinity, Infinity],
      i,
      r;
    for (i = 0; i < items.length; i++) {
      r = items[i].bounds;
      b[0] = Math.min(b[0], r[0]);
      b[1] = Math.max(b[1], r[1]);
      b[2] = Math.max(b[2], r[2]);
      b[3] = Math.min(b[3], r[3]);
    }
    var cx = (b[0] + b[2] - (rect[0] + rect[2])) / 2 / MM,
      cy = (b[1] + b[3] - (rect[1] + rect[3])) / 2 / MM;
    if (data.centering && data.centering.exact)
      assert(
        Math.abs(cx) < EPS / MM && Math.abs(cy) < EPS / MM,
        "Physical output block is not centred on its artboard",
      );
    return {
      left: (b[0] - rect[0]) / MM,
      right: (rect[2] - b[2]) / MM,
      top: (rect[1] - b[1]) / MM,
      bottom: (b[3] - rect[3]) / MM,
    };
  }
  function checkPon(items, rect, dots, back, paperW) {
    assert(items.length === 4, "PON count must be four per face");
    for (var di = 0; di < dots.length; di++) {
      var x = back ? paperW - dots[di].cx : dots[di].cx;
      var item = itemAt(items, rect[0] + x, rect[3] + dots[di].cy, false);
      assert(
        near(item.bounds[2] - item.bounds[0], 5 * MM) &&
          near(item.bounds[1] - item.bounds[3], 5 * MM),
        "PON diameter changed",
      );
    }
  }
  function pointSegmentDistance(p, a, b) {
    var dx = b[0] - a[0],
      dy = b[1] - a[1],
      den = dx * dx + dy * dy;
    var t = den ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den : 0;
    t = Math.max(0, Math.min(1, t));
    dx = p[0] - a[0] - t * dx;
    dy = p[1] - a[1] - t * dy;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function flattenedNativePath(item) {
    var pp = item.pathPoints, out = [copy(pp[0].anchor)], i, hasCurve = false;
    function midpoint(a, b) { return [(a[0]+b[0])/2,(a[1]+b[1])/2]; }
    function flatten(a, b, c, d, depth) {
      var error = Math.max(pointSegmentDistance(b, a, d), pointSegmentDistance(c, a, d));
      if (error > 0) hasCurve = true;
      if (error <= CURVE_FLATNESS_MM * MM) { out.push(copy(d)); return; }
      assert(depth < 24, "Native cubic flattening exceeded its precision bound");
      var ab = midpoint(a,b), bc = midpoint(b,c), cd = midpoint(c,d),
        abc = midpoint(ab,bc), bcd = midpoint(bc,cd), m = midpoint(abc,bcd);
      flatten(a,ab,abc,m,depth+1); flatten(m,bcd,cd,d,depth+1);
    }
    for (i = 0; i < pp.length; i++) {
      var next = pp[(i+1)%pp.length];
      flatten(copy(pp[i].anchor),copy(pp[i].rightDirection),
        copy(next.leftDirection),copy(next.anchor),0);
    }
    out.pop(); // Điểm cuối của đường kín chính là điểm đầu.
    // Một cubic có cả hai tay nắm trên đoạn dây cung không cần xấp xỉ.
    // Đặc biệt, hình chữ nhật có tay nắm trùng điểm neo có sai số đúng bằng 0.
    out.flattenErrorMm = hasCurve ? CURVE_FLATNESS_MM : 0;
    return out;
  }

  // Các phép kiểm tra hình học độc lập trong Illustrator thật dùng milimét cục bộ, không dùng raster,
  // đầu vào đã làm phẳng hay hàm xét chồng lấn của phần lõi. Lưới cạnh giới hạn số phép kiểm tra cặp
  // trên các đường cubic dày điểm; các dải ngang giúp xét nhanh điểm nằm hẳn trong vùng tô.
  function nativeMesh(item, rect) {
    var raw = flattenedNativePath(item), points = [], edges = [], grid = {}, bands = {},
      pitch = 2, bounds = [Infinity,Infinity,-Infinity,-Infinity], i, x, y;
    function add(table, key, index) {
      if (!table[key]) table[key] = [];
      table[key].push(index);
    }
    for (i = 0; i < raw.length; i++) {
      var p = [(raw[i][0]-rect[0])/MM,(raw[i][1]-rect[3])/MM];
      points.push(p); bounds[0]=Math.min(bounds[0],p[0]); bounds[1]=Math.min(bounds[1],p[1]);
      bounds[2]=Math.max(bounds[2],p[0]); bounds[3]=Math.max(bounds[3],p[1]);
    }
    for (i = 0; i < points.length; i++) {
      var a = points[i], b = points[(i+1)%points.length],
        e = {a:a,b:b,x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),
          y0:Math.min(a[1],b[1]),y1:Math.max(a[1],b[1])};
      edges.push(e);
      for (x=Math.floor(e.x0/pitch);x<=Math.floor(e.x1/pitch);x++)
        for (y=Math.floor(e.y0/pitch);y<=Math.floor(e.y1/pitch);y++) add(grid,x+":"+y,i);
      for (y=Math.floor(e.y0/pitch);y<=Math.floor(e.y1/pitch);y++) add(bands,String(y),i);
    }
    return {points:points,edges:edges,grid:grid,bands:bands,pitch:pitch,bounds:bounds,stamp:0,
      flattenErrorMm:raw.flattenErrorMm};
  }
  function nearbyMeshEdges(mesh, bounds, fn) {
    var stamp = ++mesh.stamp, x, y, bucket, i, edge;
    for (x=Math.floor(bounds[0]/mesh.pitch);x<=Math.floor(bounds[2]/mesh.pitch);x++)
      for (y=Math.floor(bounds[1]/mesh.pitch);y<=Math.floor(bounds[3]/mesh.pitch);y++) {
        bucket = mesh.grid[x+":"+y] || [];
        for (i=0;i<bucket.length;i++) {
          edge=mesh.edges[bucket[i]];
          if (edge.stamp===stamp) continue;
          edge.stamp=stamp;
          if (fn(edge)===false) return false;
        }
      }
    return true;
  }
  function strictMeshPoint(p, mesh) {
    var b=mesh.bounds, boundary=false, inside=false, i, e, ids;
    if (p[0]<b[0] || p[0]>b[2] || p[1]<b[1] || p[1]>b[3]) return -1;
    nearbyMeshEdges(mesh,[p[0]-1e-8,p[1]-1e-8,p[0]+1e-8,p[1]+1e-8],function(edge) {
      if (pointSegmentDistance(p,edge.a,edge.b)<=1e-8) {boundary=true;return false;}
    });
    if (boundary) return 0;
    ids=mesh.bands[String(Math.floor(p[1]/mesh.pitch))] || [];
    for (i=0;i<ids.length;i++) {
      e=mesh.edges[ids[i]];
      if ((e.a[1]>p[1])!==(e.b[1]>p[1]) &&
          p[0]<e.a[0]+(p[1]-e.a[1])*(e.b[0]-e.a[0])/(e.b[1]-e.a[1])) inside=!inside;
    }
    return inside ? 1 : -1;
  }
  function nativeFilledOverlap(a, b) {
    function shared(p) {return strictMeshPoint(p,a)===1 && strictMeshPoint(p,b)===1;}
    function probes(mesh, other) {
      var i, e, p, dx,dy,length, side, q;
      for (i=0;i<mesh.edges.length;i++) {
        e=mesh.edges[i];
        if (strictMeshPoint(e.a,other)===1) return true;
        p=[(e.a[0]+e.b[0])/2,(e.a[1]+e.b[1])/2];
        if (strictMeshPoint(p,other)===1) return true;
        dx=e.b[0]-e.a[0];dy=e.b[1]-e.a[1];length=Math.sqrt(dx*dx+dy*dy);
        if (!length) continue;
        for (side=-1;side<=1;side+=2) {
          q=[p[0]-side*dy/length*1e-6,p[1]+side*dx/length*1e-6];
          if(shared(q)) return true;
        }
      }
      return false;
    }
    return probes(a,b) || probes(b,a);
  }
  function properNativeCross(a,b,c,d) {
    function cross(p,q,r) {return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);}
    var x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
    return ((x>1e-10 && y< -1e-10)||(x< -1e-10 && y>1e-10)) &&
      ((u>1e-10 && v< -1e-10)||(u< -1e-10 && v>1e-10));
  }
  function bboxDistance(a,b) {
    var dx=Math.max(a[0]-b[2],b[0]-a[2],0),dy=Math.max(a[1]-b[3],b[1]-a[3],0);
    return Math.sqrt(dx*dx+dy*dy);
  }
  function nativePointSegmentDistanceSq(p,a,b) {
    var x=b[0]-a[0],y=b[1]-a[1],den=x*x+y*y,
      t=den ? ((p[0]-a[0])*x+(p[1]-a[1])*y)/den : 0;
    t=Math.max(0,Math.min(1,t));x=p[0]-a[0]-t*x;y=p[1]-a[1]-t*y;
    return x*x+y*y;
  }
  function checkNativeCutters(cuts, rect, label) {
    var meshes=[],i,j,k,a,b,e, minimumSq=Infinity,checkedPairs=0,
      radius=Math.max(2,input.gapMm+0.01),segments=0,maximumError=0,
      pathErrors=[],minimumCertifiedGap=Infinity;
    for(i=0;i<cuts.length;i++) {
      var mesh=nativeMesh(cuts[i].item,rect); meshes.push(mesh);segments+=mesh.edges.length;
      pathErrors.push(mesh.flattenErrorMm); maximumError=Math.max(maximumError,mesh.flattenErrorMm);
    }
    for(i=0;i<meshes.length;i++) for(j=0;j<i;j++) {
      a=meshes[i];b=meshes[j];checkedPairs++;
      var pairError=a.flattenErrorMm+b.flattenErrorMm,
        requiredGap=Math.max(0,input.gapMm-0.001),pairMinimumSq=Infinity,
        queryRadius=Math.max(Math.min(radius,Math.sqrt(minimumSq)),requiredGap+pairError),
        boxGap=bboxDistance(a.bounds,b.bounds);
      if (boxGap>queryRadius) {
        minimumCertifiedGap=Math.min(minimumCertifiedGap,boxGap-pairError);
        continue;
      }
      for(k=0;k<a.edges.length;k++) {
        e=a.edges[k];
        nearbyMeshEdges(b,[e.x0-queryRadius-1e-8,e.y0-queryRadius-1e-8,
          e.x1+queryRadius+1e-8,e.y1+queryRadius+1e-8],function(f) {
          var dx=Math.max(e.x0-f.x1,f.x0-e.x1,0),dy=Math.max(e.y0-f.y1,f.y0-e.y1,0);
          if (dx*dx+dy*dy>queryRadius*queryRadius+1e-16) return;
          assert(!properNativeCross(e.a,e.b,f.a,f.b),label+" native cubic cutters cross: "+i+"/"+j);
          var d=Math.min(nativePointSegmentDistanceSq(e.a,f.a,f.b),nativePointSegmentDistanceSq(e.b,f.a,f.b),
            nativePointSegmentDistanceSq(f.a,e.a,e.b),nativePointSegmentDistanceSq(f.b,e.a,e.b));
          minimumSq=Math.min(minimumSq,d);
          pairMinimumSq=Math.min(pairMinimumSq,d);
        });
      }
      if (bboxDistance(a.bounds,b.bounds)<=1e-8)
        assert(!nativeFilledOverlap(a,b),label+" native cubic cutters have filled overlap: "+i+"/"+j);
      var pairLowerBound=(pairMinimumSq===Infinity ? queryRadius : Math.sqrt(pairMinimumSq))-pairError;
      assert(pairLowerBound>=requiredGap,
        label+" native cubic minimum gap bound "+pairLowerBound+" mm is below requested "+input.gapMm+" mm: "+i+"/"+j);
      minimumCertifiedGap=Math.min(minimumCertifiedGap,pairLowerBound);
    }
    var minimum=Math.sqrt(minimumSq);
    assert(minimum<=radius,"Native fixture has no measurable close contour pairs");
    // Cận dây cung được trừ riêng cho từng cặp: thẳng/thẳng là 0,
    // thẳng/cong là một cận, cong/cong là hai cận. Không nới kiểm tra vùng tô/giao cắt.
    return {minimumGapMm:minimum,flattenErrorMm:maximumError,
      nativePathFlattenErrorsMm:pathErrors,minimumCertifiedGapMm:minimumCertifiedGap,
      denseSegments:segments,checkedPairs:checkedPairs,noFilledOverlap:true};
  }
  function insidePolygon(p, polygon) {
    var inside = false,
      i,
      j = polygon.length - 1;
    for (i = 0; i < polygon.length; j = i++) {
      var a = polygon[i],
        b = polygon[j];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        inside = !inside;
    }
    return inside;
  }
  function checkNativePonClearance(cuts, rect, dots, back, paperW) {
    var minimum = Infinity,
      i,
      di,
      pi;
    for (i = 0; i < cuts.length; i++) {
      var polygon = flattenedNativePath(cuts[i].item);
      for (di = 0; di < dots.length; di++) {
        var p = [
          rect[0] + (back ? paperW - dots[di].cx : dots[di].cx),
          rect[3] + dots[di].cy,
        ];
        assert(
          !insidePolygon(p, polygon),
          "PON centre is inside a native cut contour",
        );
        var distance = Infinity;
        for (pi = 0; pi < polygon.length; pi++)
          distance = Math.min(
            distance,
            pointSegmentDistance(
              p,
              polygon[pi],
              polygon[(pi + 1) % polygon.length],
            ),
          );
        minimum = Math.min(minimum, distance - dots[di].r);
        // Việc lấy mẫu đường cong và phép làm phẳng gốc của Illustrator có thể lệch nhau
        // vài phần nghìn milimét; tuyệt đối không nới lỏng với va chạm PON thật.
        assert(
          distance - dots[di].r >= input.ponClearMm * MM - EPS,
          "Native output cut violates PON-edge clearance",
        );
      }
    }
    return minimum / MM;
  }
  // eval UTF-8 chỉ nằm trong phạm vi IIFE này; nó không thể thay thế các biến toàn cục
  // của engine panel hay đọc/sửa bài đang mở của người dùng thông qua bước chuẩn bị test.
  eval(readUtf8(root + "/DanCardCEP/jsx/dan_be_bridge.jsx"));
  // Test hồi quy này phải chạy trong ExtendScript thật: Node tính các biểu thức điều kiện
  // boolean nối tiếp nhau theo cách khác nên không tái hiện được lỗi NaN.
  assert(
    dcDanBeJSON.parse("true") === true &&
      dcDanBeJSON.parse("false") === false &&
      dcDanBeJSON.parse("null") === null,
    "Native JSON boolean/null scalar types were not preserved",
  );
  var literalProbe = dcDanBeJSON.parse(
    '{"flags":[true,false,null],"nested":{"closed":true}}',
  );
  assert(
    literalProbe.flags[0] === true &&
      literalProbe.flags[1] === false &&
      literalProbe.flags[2] === null &&
      literalProbe.nested.closed === true &&
      dcDanBeJSON.stringify(literalProbe) ===
        '{"flags":[true,false,null],"nested":{"closed":true}}',
    "Native JSON nested boolean types or round trip changed",
  );
  var data = dcDanBeJSON.parse(
    readUtf8(root + "/tmp/dan_be_variable_native_plan.json"),
  );
  var capturePath=data.capturePath ? String(data.capturePath) : root+"/tmp/dan_be_spoon_capture.json";
  if(!/^[A-Za-z]:[\\\/]/.test(capturePath)) capturePath=root+"/"+capturePath;
  var captureResolved=new File(capturePath).fsName.replace(/\\/g,"/");
  assert(captureResolved.toLowerCase().indexOf((root+"/tmp/").toLowerCase())===0,
    "Native capture must be an owned fixture inside workspace tmp");
  var captured = dcDanBeJSON.parse(readUtf8(captureResolved));
  assert(
    captured.input && captured.sources && captured.sources.length,
    "Missing captured variable contour",
  );
  var input = captured.input,
    source = captured.sources[0],
    nodes = [],
    ni;
  assert(
    source.kind === "PathItem" && source.closed && source.nodes.length >= 3,
    "Expected captured closed native path with at least three nodes",
  );
  function localPair(p) {
    return [(p[0] - source.bounds[0]) / MM, (p[1] - source.bounds[3]) / MM];
  }
  for (ni = 0; ni < source.nodes.length; ni++)
    nodes.push({
      a: localPair(source.nodes[ni].anchor),
      l: localPair(source.nodes[ni].left),
      r: localPair(source.nodes[ni].right),
    });
  var sourceWidthMm = (source.bounds[2] - source.bounds[0]) / MM,
    sourceHeightMm = (source.bounds[1] - source.bounds[3]) / MM;
  input=data.input || input;
  var tag=data.tag ? String(data.tag).replace(/[^a-zA-Z0-9_-]/g,"_") : "";
  report.tag=tag;
  report.requestedGapMm=input.gapMm;
  report.output=root+"/tmp/dan_be_variable_native"+(tag ? "_"+tag : "")+".png";
  report.audit=root+"/tmp/dan_be_variable_native"+(tag ? "_"+tag : "")+"_audit.json";
  var deferPairCheck=data.deferPairCheck===true;
  report.requiresExternalPairCheck=deferPairCheck;
  report.pairChecksPassed=false;
  report.requested={gapMm:input.gapMm,marginMm:input.marginMm,ponClearMm:input.ponClearMm,
    paperWidthMm:input.sheet.widthMm,paperHeightMm:input.sheet.heightMm};
  assert(
    data.slots && data.slots.length === data.count && data.count > 0,
    "Native integration requires a nonempty independently checked plan",
  );
  for (var odi = 0; odi < app.documents.length; odi++) {
    originalDocs.push(app.documents[odi]);
    originalSelections.push(selectionArray(app.documents[odi]));
  }
  var before = userSnapshot();
  try {
    app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    for (var mode = 0; mode < 2; mode++) {
      doc = app.documents.add(
        DocumentColorSpace.CMYK,
        input.sheet.widthMm * MM,
        input.sheet.heightMm * MM,
      );
      guardOwned();
      var inputLayer = doc.layers[0];
      inputLayer.name = "NATIVE VARIABLE CONTOUR SOURCE";
      var cut = sourcePath(
        inputLayer,
        10 * MM,
        260 * MM,
        "NATIVE_VARIABLE_CUT",
        false,
        null,
      );
      var front = artwork(
        inputLayer,
        95 * MM,
        260 * MM,
        "NATIVE_VARIABLE_FRONT",
        false,
      );
      var back = mode
        ? artwork(inputLayer, 180 * MM, 260 * MM, "NATIVE_VARIABLE_BACK", true)
        : null;
      var sources = mode ? [cut, front, back] : [cut, front];
      var originalSource = sourceState(sources);
      var originalCutNodes=nativeNodes(cut), originalCutNodeText=dcDanBeJSON.stringify(originalCutNodes);
      var cutBounds = copy(cut.geometricBounds);
      var sourceW = cutBounds[2] - cutBounds[0],
        sourceH = cutBounds[1] - cutBounds[3];
      assert(
        Math.abs(sourceW / MM - sourceWidthMm) < 0.025 &&
          Math.abs(sourceH / MM - sourceHeightMm) < 0.025,
        "Captured variable source die dimensions changed",
      );
      var frontVectors = markerVectors(front),
        backVectors = mode ? markerVectors(back) : null;
      doc.selection = mode ? [back, cut, front] : [front, cut];
      guardOwned();
      var prepared = dcDanBePrepare(
        String(input.gapMm),
        String(input.marginMm),
        String(input.ponClearMm),
        mode === 1,
        String(input.sheet.widthMm / 10),
        String(input.sheet.heightMm / 10),
        "10",
        "10",
        "10",
        "10",
      );
      guardOwned();
      assert(prepared.indexOf("OKJSON:") === 0, prepared);
      var payload = dcDanBeJSON.parse(prepared.substring(7));
      jobId = payload.jobId;
      var job = dcDanBeJobs[jobId];
      assert(
        job.doc === doc &&
          job.models.length === 1 &&
          job.models[0].khuon.item === cut &&
          job.models[0].bai.item === front &&
          (!mode || job.models[0].sau.item === back),
        "Left-to-right native source roles were not fixed correctly",
      );
      assert(
        near(job.gap, input.gapMm * MM) &&
          near(job.margin, input.marginMm * MM) &&
          near(job.ponClear, input.ponClearMm * MM),
        "Native physical clearance inputs changed",
      );
      var paperW = job.paperW,
        paperH = job.paperH,
        dots = job.pon.dots;
      assert(
        near(paperW, input.sheet.widthMm * MM) &&
          near(paperH, input.sheet.heightMm * MM),
        "Native paper size mismatch",
      );
      var result = dcDanBeRender(
        jobId,
        dcDanBeJSON.stringify(data.slots),
        "{}",
      );
      jobId = null;
      guardOwned();
      assert(result.indexOf("OK:[[COUNT:" + data.count + "]]") === 0, result);
      assert(
        doc.artboards.length === (mode ? 2 : 1),
        "Native result artboard count mismatch",
      );
      var suffix = mode ? " - mặt trước" : "";
      var frontCuts = records(layerNamed("Dàn bế - Khuôn" + suffix), false);
      var frontArts = records(layerNamed("Dàn bế - Bài" + suffix), true);
      var frontPon = records(layerNamed("Dàn bế - PON" + suffix), false);
      var fr = copy(doc.artboards[0].artboardRect),
        br = mode ? copy(doc.artboards[1].artboardRect) : null;
      var backCuts = mode
        ? records(layerNamed("Dàn bế - Khuôn - mặt sau"), false)
        : null;
      var backArts = mode
        ? records(layerNamed("Dàn bế - Bài - mặt sau"), true)
        : null;
      assert(
        frontCuts.length === data.count && frontArts.length === data.count,
        "Front native cut/art counts differ from the precomputed plan",
      );
      assert(
        near(fr[0], -7200 + 10 * MM) && near(fr[1], 7200 - 10 * MM),
        "First sheet is not at the KTS canvas origin",
      );
      assert(
        near(fr[2] - fr[0], paperW) && near(fr[1] - fr[3], paperH),
        "Front artboard dimensions mismatch",
      );
      checkPon(frontPon, fr, dots, false, paperW);
      var frontMargins = checkBlockCentre(frontCuts, fr),
        backMargins = null;
      var frontPonClearance = deferPairCheck ? null : checkNativePonClearance(
          frontCuts,
          fr,
          dots,
          false,
          paperW,
        ),
        backPonClearance = null;
      var frontCutterGeometry=deferPairCheck ? {deferred:true} : checkNativeCutters(frontCuts,fr,"Front"),
        backCutterGeometry=null;
      if (mode) {
        assert(
          backCuts.length === data.count && backArts.length === data.count,
          "Back native counts mismatch",
        );
        assert(
          near(br[0] - fr[2], 10 * MM) &&
            near(br[2] - br[0], paperW) &&
            near(br[1] - br[3], paperH),
          "Back artboard size/gap mismatch",
        );
        checkPon(
          records(layerNamed("Dàn bế - PON - mặt sau"), false),
          br,
          dots,
          true,
          paperW,
        );
        backMargins = checkBlockCentre(backCuts, br);
        backPonClearance = deferPairCheck ? null : checkNativePonClearance(
          backCuts,
          br,
          dots,
          true,
          paperW,
        );
        backCutterGeometry=deferPairCheck ? {deferred:true} : checkNativeCutters(backCuts,br,"Back");
      }
      for (var si = 0; si < data.slots.length; si++) {
        var s = data.slots[si],
          angle = s.vi * 90;
        assert(s.mi === 0 && s.angle === angle, "Plan rotation/index mismatch");
        var fk = itemAt(frontCuts, fr[0] + s.x * MM, fr[3] + s.y * MM, true);
        var fb = fk.bounds,
          fc = centre(fb),
          fa = itemAt(frontArts, fc[0], fc[1], false);
        var expectedW = s.vi % 2 ? sourceH : sourceW,
          expectedH = s.vi % 2 ? sourceW : sourceH;
        assert(
          near(fb[2] - fb[0], expectedW) && near(fb[1] - fb[3], expectedH),
          "Physical cut dimensions changed after rotation",
        );
        assert(
          insideMargin(fr, fb),
          "Front physical cut exceeds paper margins",
        );
        unchangedNativeRotation(fk.item,originalCutNodes,cutBounds,fb,angle);
        checkArtworkDirection(fa.item, frontVectors, angle, "Front");
        if (mode) {
          var bx = br[0] + paperW - (fc[0] - fr[0]),
            by = br[3] + fc[1] - fr[3];
          var bk = itemAt(backCuts, bx, by, false),
            ba = itemAt(backArts, bx, by, false);
          assert(
            near(bk.bounds[2] - bk.bounds[0], expectedW) &&
              near(bk.bounds[1] - bk.bounds[3], expectedH) &&
              insideMargin(br, bk.bounds),
            "Back physical die dimensions/margins mismatch",
          );
          assert(
            fk.item.pathPoints.length === nodes.length &&
              bk.item.pathPoints.length === nodes.length,
            "Native cubic contour node count changed",
          );
          for (var pi = 0; pi < nodes.length; pi++) {
            var fp = fk.item.pathPoints[pi],
              bp = bk.item.pathPoints[pi];
            var pairs = [
              [fp.anchor, bp.anchor],
              [fp.leftDirection, bp.leftDirection],
              [fp.rightDirection, bp.rightDirection],
            ];
            for (var ni = 0; ni < pairs.length; ni++)
              assert(
                near(
                  pairs[ni][1][0] - br[0],
                  paperW - (pairs[ni][0][0] - fr[0]),
                ) && near(pairs[ni][1][1] - br[3], pairs[ni][0][1] - fr[3]),
                "Native curved cut reflection mismatch",
              );
          }
          checkArtworkDirection(
            ba.item,
            backVectors,
            -angle,
            "Back unmirrored",
          );
        }
      }
      assert(
        sourceState(sources) === originalSource &&
          dcDanBeJSON.stringify(nativeNodes(cut))===originalCutNodeText &&
          records(inputLayer, false).length === sources.length,
        "Owned source shapes were changed or consumed by rendering",
      );
      if (!mode) {
        guardOwned();
        var capture = new ImageCaptureOptions();
        capture.resolution = 72;
        capture.antiAliasing = true;
        capture.transparency = false;
        doc.imageCapture(new File(report.output), fr, capture);
        assert(
          new File(report.output).exists,
          "Owned one-face PNG capture was not created",
        );
      }
      var nativeFaces=[nativeFaceExport(frontCuts,fr,dots,false,paperW,"front",frontPon)];
      if(mode) nativeFaces.push(nativeFaceExport(backCuts,br,dots,true,paperW,"back",
        records(layerNamed("Dàn bế - PON - mặt sau"),false)));
      report.rows.push({
        mode: mode ? "two-face" : "one-face",
        count: data.count,
        artboards: doc.artboards.length,
        ponPerFace: 4,
        sourceMm: [sourceW / MM, sourceH / MM],
        checkedSlots: data.slots.length,
        physicalDimensionsUnchanged: true,
        artworkCentresMatch: true,
        artworkDirectionsMatch: true,
        unmirroredBackArtwork: mode === 1,
        originalOwnedSourcesUnchanged: true,
        physicalBlockCentred: !!(data.centering && data.centering.exact),
        frontMarginsMm: frontMargins,
        backMarginsMm: backMargins,
        minimumFrontPonEdgeClearanceMm: frontPonClearance,
        minimumBackPonEdgeClearanceMm: backPonClearance,
        frontNativeCutters: frontCutterGeometry,
        backNativeCutters: backCutterGeometry,
        sourceNativeNodesUnchanged: true,
        nativeFaces: nativeFaces,
        originalSourceCutNodes: originalCutNodes,
        originalSourceCutBoundsPt: copy(cutBounds),
        pairChecksDeferred: deferPairCheck,
      });
      closeOwned();
    }
    report.passed = true;
    report.pairChecksPassed=!deferPairCheck;
  } catch (error) {
    report.error = String(error);
  } finally {
    try {
      if (jobId) delete dcDanBeJobs[jobId];
    } catch (jobError) {}
    try {
      closeOwned();
    } catch (closeError) {
      report.passed = false;
      report.closeError = String(closeError);
    }
    try {
      if (previous) previous.activate();
    } catch (activeError) {
      report.passed = false;
    }
    try {
      app.coordinateSystem = oldCoordinates;
    } catch (coordinatesError) {
      report.passed = false;
    }
    try {
      app.userInteractionLevel = oldInteraction;
    } catch (interactionError) {
      report.passed = false;
    }
  }
  report.originalDocumentsUnchanged =
    originalIdentityUnchanged() && userSnapshot() === before;
  report.originalApplicationStateRestored =
    app.coordinateSystem === oldCoordinates &&
    app.userInteractionLevel === oldInteraction &&
    (!previous || app.activeDocument === previous);
  if (
    !report.originalDocumentsUnchanged ||
    !report.originalApplicationStateRestored
  )
    report.passed = false;
  var output = new File(report.audit);
  output.encoding = "UTF-8";
  if (!output.open("w")) fail("Cannot write native integration audit");
  output.write(dcDanBeJSON.stringify(report));
  output.close();
  return dcDanBeJSON.stringify(report);
})();
