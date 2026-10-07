"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const illustrator = require("./illustrator_geometry_mock");
const { nodesFor } = require("./dan_be_circle_fixture");
const bridge = fs.readFileSync(require.resolve("../DanCardCEP/jsx/dan_be_bridge.jsx"), "utf8");
const MM = 2.834645669;
const WIDTH = 40, HEIGHT = 70;
const offset = [10, 20];
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-7, `${message}: ${a} != ${b}`);

function rectangleNodes() {
  return [[0, 0], [WIDTH, 0], [WIDTH, HEIGHT], [0, HEIGHT]]
    .map((p) => ({ a: p.slice(), l: p.slice(), r: p.slice() }));
}
function twoAnchorNodes() {
  // A valid closed two-cubic outline. Each half reaches its exact vertical
  // extremum at t=0.5; the anchors alone have zero height, so bbox substitution
  // or a >=3-anchor check cannot represent this exterior die.
  const mid = HEIGHT / 2, reach = HEIGHT * 2 / 3;
  return [
    { a: [0, mid], l: [0, mid - reach], r: [0, mid + reach] },
    { a: [WIDTH, mid], l: [WIDTH, mid + reach], r: [WIDTH, mid - reach] },
  ];
}
function boundsOf(contour) {
  return { x0: Math.min(...contour.map((p) => p[0])), y0: Math.min(...contour.map((p) => p[1])),
    x1: Math.max(...contour.map((p) => p[0])), y1: Math.max(...contour.map((p) => p[1])) };
}
function inside(point, groups) {
  return groups.some((group) => {
    let parity = false;
    for (const contour of group)
      for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
        const a = contour[i], b = contour[j];
        if ((a[1] > point[1]) !== (b[1] > point[1]) &&
          point[0] < a[0] + (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1])) parity = !parity;
      }
    return parity;
  });
}
function pointSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
  const t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function cubic(a, b, c, d, t) {
  const u = 1 - t;
  return [0, 1].map((axis) => u * u * u * a[axis] + 3 * u * u * t * b[axis] +
    3 * u * t * t * c[axis] + t * t * t * d[axis]);
}
function trueCurveGuard(contour, nodes) {
  assert.ok(contour.length > 100, "two-anchor native curves become accurate exterior contours, not rectangles or chords");
  let maximum = 0;
  for (let ni = 0; ni < nodes.length; ni++) {
    const a = nodes[ni], b = nodes[(ni + 1) % nodes.length];
    for (let sample = 0; sample <= 128; sample++) {
      const p = cubic(a.a, a.r, b.l, b.a, sample / 128);
      let nearest = Infinity;
      for (let ei = 0; ei < contour.length; ei++)
        nearest = Math.min(nearest, pointSegment(p, contour[ei], contour[(ei + 1) % contour.length]));
      maximum = Math.max(maximum, nearest);
    }
  }
  assert.ok(maximum <= 0.00025 + 1e-7, `original exterior Bézier error ${maximum} mm exceeds the real bridge reserve`);
}
function fixture(kind, redFirst, twoAnchors) {
  const f = illustrator(), c = vm.createContext(f.context);
  vm.runInContext(bridge, c);
  const toPoint = (p) => [(offset[0] + p[0]) * MM, (offset[1] + p[1]) * MM];
  const trueBounds = [offset[0] * MM, (offset[1] + HEIGHT) * MM,
    (offset[0] + WIDTH) * MM, offset[1] * MM];
  const cut = f.source(trueBounds, "exterior-die-container");
  const nodes = twoAnchors ? twoAnchorNodes() : rectangleNodes();
  function path(localNodes, identity, clipping, bounds) {
    return { identity, typename: "PathItem", closed: true, clipping, hidden: false,
      filled: false, stroked: true, strokeWidth: 0.2 * MM,
      strokeColor: identity === "black-exterior" ? { typename: "CMYKColor", cyan: 0, magenta: 0, yellow: 0, black: 100 } :
        { typename: "RGBColor", red: 255, green: 0, blue: 0 },
      geometricBounds: bounds.slice(), visibleBounds: bounds.slice(),
      pathPoints: localNodes.map((n) => ({ anchor: toPoint(n.a), leftDirection: toPoint(n.l), rightDirection: toPoint(n.r) })) };
  }
  const outer = path(nodes, "black-exterior", kind === "clipped", trueBounds);
  const redNodes = nodesFor(14).map((n) => ({
    a: [n.a[0] + 13, n.a[1] + 28], l: [n.l[0] + 13, n.l[1] + 28], r: [n.r[0] + 13, n.r[1] + 28],
  }));
  const hole = path(redNodes, "red-inner-circle", false,
    [(offset[0] + 13) * MM, (offset[1] + 42) * MM, (offset[0] + 27) * MM, (offset[1] + 28) * MM]);
  const children = redFirst ? [hole, outer] : [outer, hole];
  if (kind === "compound") {
    cut.typename = "CompoundPathItem";
    cut.pathItems = children;
    children.forEach((p) => { p.parent = cut; });
  } else {
    cut.typename = "GroupItem";
    cut.clipped = kind === "clipped";
    if (kind === "clipped") {
      const nested = { identity: "nested-clipped-group", typename: "GroupItem", clipped: true,
        parent: cut, pageItems: children, geometricBounds: trueBounds.slice(), visibleBounds: trueBounds.slice() };
      children.forEach((p) => { p.parent = nested; });
      cut.pageItems = [nested];
    } else {
      cut.pageItems = children;
      children.forEach((p) => { p.parent = cut; });
    }
  }
  const art = f.source([90 * MM, 91 * MM, 132 * MM, 19 * MM], "front-artwork");
  f.doc.selection = [art, cut]; // Pair roles are geometric, not selection order.
  f.doc.saved = true;
  f.doc.rulerOrigin = [17, 23];
  let externalCalls = 0;
  c.File = { openDialog() { externalCalls++; throw new Error("Prepare cannot ask for another file"); } };
  c.app.open = () => { externalCalls++; throw new Error("Prepare cannot open another document"); };
  return { ...f, c, cut, art, nodes, externalCalls: () => externalCalls };
}
function snapshot(f) {
  const items = [];
  function visit(item) {
    items.push({ identity: item.identity, typename: item.typename,
      parent: item.parent.identity || item.parent.name, bounds: item.geometricBounds, visibleBounds: item.visibleBounds,
      pathPoints: item.pathPoints, closed: item.closed, clipping: item.clipping, clipped: item.clipped,
      hidden: item.hidden, filled: item.filled, stroked: item.stroked, strokeWidth: item.strokeWidth,
      strokeColor: item.strokeColor, points: item._points,
      children: (item.pageItems || item.pathItems || []).map((p) => p.identity) });
    (item.pageItems || item.pathItems || []).forEach(visit);
  }
  f.originals.forEach(visit);
  return JSON.stringify({ items, saved: f.doc.saved, rulerOrigin: f.doc.rulerOrigin,
    coordinateSystem: f.c.app.coordinateSystem, activeLayer: f.doc.activeLayer.name,
    activeBoard: f.doc.artboards.getActiveArtboardIndex(),
    selection: f.doc.selection.map((p) => p.identity),
    layers: f.doc.layers.map((l) => ({ name: l.name, visible: l.visible, locked: l.locked,
      items: l.pageItems.map((p) => p.identity) })),
    artboards: f.doc.artboards.map((b) => ({ rect: b.artboardRect, name: b.name })),
    duplicateCount: f.duplicates.length });
}
function checked(kind, redFirst, twoAnchors) {
  const f = fixture(kind, redFirst, twoAnchors), before = snapshot(f), selection = f.doc.selection.slice();
  const result = f.c.dcDanBePrepare("1.5", "4", "7.5", false);
  assert.equal(snapshot(f), before, "Prepare must preserve all original containers, clipping flags, points, handles, colors and document state");
  assert.deepEqual(f.doc.selection, selection, "selection object identities/order stay unchanged");
  assert.equal(f.externalCalls(), 0, "no external files or dialogs");
  assert.match(result, /^OKJSON:/, result);
  const payload = JSON.parse(result.slice(7)), job = f.c.dcDanBeJobs[payload.jobId];
  assert.equal(payload.types.length, 1, "one die container is one planning type, not an inner-hole-only type");
  assert.equal(job.models.length, 1);
  assert.equal(job.models[0].khuon.item, f.cut, "the whole exterior die stays bound to the original artwork");
  assert.equal(job.models[0].bai.item, f.art);
  assert.equal(f.duplicates.length, 0, "Prepare cannot duplicate or replace any original source");
  const groups = payload.types[0].groups, bounds = boundsOf(groups.flat(1).flat());
  near(bounds.x0, 0, "normalized exterior x origin");
  near(bounds.y0, 0, "normalized exterior y origin");
  near(bounds.x1, WIDTH, "planning footprint includes the full black exterior width, not the red-circle diameter");
  near(bounds.y1, HEIGHT, "planning footprint includes the full black exterior height, not the red-circle diameter");
  const exterior = groups.flat(1).find((contour) => {
    const b = boundsOf(contour);
    return Math.abs(b.x1 - b.x0 - WIDTH) < 1e-7 && Math.abs(b.y1 - b.y0 - HEIGHT) < 1e-7;
  });
  assert.ok(exterior, "an actual exterior contour must remain in the groups");
  assert.equal(inside([20, 60], groups), true, "filled exterior away from the inner circle remains part of the cutter footprint");
  near(payload.types[0].curveErrorMm, 0.00025, "curved contour flattening carries its real error reserve");
  if (kind === "compound") {
    assert.equal(groups.length, 1, "a real CompoundPath remains one even/odd group");
    assert.equal(groups[0].length, 2, "the exterior and real compound hole are both preserved regardless of order");
    assert.equal(inside([20, 35], groups), false, "the real compound circular hole keeps its even/odd semantics");
  } else {
    assert.equal(inside([20, 35], groups), true, "ordinary groups retain union semantics, not accidental compound holes");
  }
  if (twoAnchors) {
    trueCurveGuard(exterior, f.nodes);
    assert.equal(inside([1, 65], groups), false, "the real two-anchor exterior is not replaced with its rectangular bounding box");
  } else assert.equal(exterior.length, 4, "straight exterior is represented exactly");
  console.log(`${kind} / ${redFirst ? "red-first" : "outer-first"} / ${twoAnchors ? "two-anchor cubic" : "four-anchor rectangle"}: full exterior + inner contour preserved`);
  return groups.map((g) => g.map((c) => ({ bounds: boundsOf(c), length: c.length })));
}

const began = Date.now(), failures = [];
for (const kind of ["clipped", "group", "compound"])
  for (const twoAnchors of [false, true]) {
    let first;
    for (const redFirst of [false, true]) {
      const label = `${kind}/${twoAnchors ? "2" : "4"} anchors/${redFirst ? "red-first" : "outer-first"}`;
      try {
        const shape = checked(kind, redFirst, twoAnchors);
        const sorted = shape.flat().map((c) => JSON.stringify(c)).sort();
        if (first) assert.deepEqual(sorted, first, "child z-order does not change the planning contours");
        else first = sorted;
      } catch (e) { failures.push(`${label}: ${e.message}`); }
    }
  }
assert.deepEqual(failures, [], failures.join("\n"));
assert.ok(Date.now() - began < 4000, "bridge-only cut outline regression remains bounded");
console.log(`Cut-outline bridge regression completed in ${Date.now() - began} ms; real compound-hole behavior unchanged.`);
