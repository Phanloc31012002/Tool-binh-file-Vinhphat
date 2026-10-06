"use strict";

// Pha thứ hai, chỉ chạy khi chủ động bật, của test trong Illustrator thật. Hình học CHỈ lấy từ
// điểm neo/tay nắm điều khiển trong kết quả Illustrator thật, do chính test JSX của bộ test xuất ra.
// Không dùng tới raster, đa giác đã chuẩn bị hay chốt chặn chồng lấn của phần lõi.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const MM = 2.834645669;
const FLATNESS_MM = 0.0001;
const EPS_MM = 0.001;

function finiteTuple(tuple, size, label) {
  assert.ok(Array.isArray(tuple) && tuple.length === size, `${label}: wrong coordinate arity`);
  tuple.forEach((v) => assert.ok(Number.isFinite(v), `${label}: nonfinite coordinate`));
}
function readIndependentGeometry() {
  const source = fs.readFileSync(path.join(__dirname, "dan_be_variable_native.jsx"), "utf8");
  const start = /function pointSegmentDistance\s*\(/.exec(source);
  const end = /function insidePolygon\s*\(/.exec(source);
  assert.ok(start && end && end.index > start.index, "Native geometry helpers were not found");
  return source.slice(start.index, end.index);
}
function validateNativeReport(report) {
  assert.equal(report.passed, true, report.error || "Native integration did not finish successfully");
  assert.equal(report.originalDocumentsUnchanged, true, "Native test changed a user document");
  assert.equal(report.originalApplicationStateRestored, true, "Native test did not restore app state");
  assert.ok(report.requested && Array.isArray(report.rows) && report.rows.length,
    "Native export has no requested settings/rows");
  const input = report.requested;
  for (const field of ["gapMm", "marginMm", "ponClearMm", "paperWidthMm", "paperHeightMm"])
    assert.ok(Number.isFinite(input[field]) && input[field] >= 0, `Invalid ${field}`);
  const context = {
    MM,
    CURVE_FLATNESS_MM: FLATNESS_MM,
    input,
    copy: (v) => v.slice(),
    assert: (condition, message) => assert.ok(condition, message),
  };
  vm.runInNewContext(readIndependentGeometry(), context, { timeout: 10000 });
  const proof = {
    passed: false,
    tag: report.tag || "",
    source: "actual Illustrator output cubic anchors/control handles",
    requestedGapMm: input.gapMm,
    adaptiveFlatteningMm: FLATNESS_MM,
    externalPairCheckPassed: false,
    faces: [],
    originalDocumentsUnchanged: true,
    originalApplicationStateRestored: true,
  };
  for (const row of report.rows) {
    assert.ok(Number.isInteger(row.count) && row.count > 0, "Native count is invalid");
    assert.ok(Array.isArray(row.nativeFaces), "No actual native faces were exported");
    assert.equal(row.nativeFaces.length, row.mode === "two-face" ? 2 : 1,
      "Wrong number of exported native faces");
    assert.equal(row.sourceNativeNodesUnchanged, true, "Owned native source nodes changed");
    finiteTuple(row.sourceMm, 2, "Native source dimensions");
    assert.ok(Array.isArray(row.originalSourceCutNodes) && row.originalSourceCutNodes.length >= 3,
      "Original native source nodes are missing");
    for (const face of row.nativeFaces) {
      finiteTuple(face.rectPt, 4, "Native paper rectangle");
      const rect = face.rectPt;
      const paperW = (rect[2] - rect[0]) / MM;
      const paperH = (rect[1] - rect[3]) / MM;
      assert.ok(Math.abs(paperW - input.paperWidthMm) < EPS_MM &&
        Math.abs(paperH - input.paperHeightMm) < EPS_MM, "Actual paper dimensions changed");
      assert.equal(face.cuts.length, row.count, "Actual cutter count differs from native count");
      assert.equal(face.ponCirclesPt.length, 4, "Actual PON count is not four");
      const cuts = face.cuts.map((cut, ci) => {
        finiteTuple(cut.boundsPt, 4, `Cut ${ci} native bounds`);
        assert.equal(cut.nodes.length, row.originalSourceCutNodes.length,
          `Cut ${ci}: native control node count changed`);
        for (const node of cut.nodes) {
          finiteTuple(node.a, 2, `Cut ${ci} anchor`);
          finiteTuple(node.l, 2, `Cut ${ci} left handle`);
          finiteTuple(node.r, 2, `Cut ${ci} right handle`);
        }
        const b = cut.boundsPt;
        const margins = [(b[0] - rect[0]) / MM, (rect[2] - b[2]) / MM,
          (rect[1] - b[1]) / MM, (b[3] - rect[3]) / MM];
        assert.ok(margins.every((m) => m >= input.marginMm - EPS_MM),
          `Cut ${ci} violates actual artboard margins`);
        const w = (b[2] - b[0]) / MM, h = (b[1] - b[3]) / MM;
        const direct = Math.abs(w - row.sourceMm[0]) < EPS_MM &&
          Math.abs(h - row.sourceMm[1]) < EPS_MM;
        const quarter = Math.abs(w - row.sourceMm[1]) < EPS_MM &&
          Math.abs(h - row.sourceMm[0]) < EPS_MM;
        assert.ok(direct || quarter, `Cut ${ci} was resized/distorted`);
        return { item: { pathPoints: cut.nodes.map((n) => ({
          anchor: n.a.slice(), leftDirection: n.l.slice(), rightDirection: n.r.slice(),
        })) } };
      });
      const geometry = context.checkNativeCutters(cuts, rect, `${row.mode} ${face.name}`);
      const nativeMeshes = cuts.map((cut) => context.nativeMesh(cut.item, rect));
      let minimumPonEdgeClearance = Infinity;
      const positions = new Set();
      for (const dot of face.ponCirclesPt) {
        assert.ok(Number.isFinite(dot.cx) && Number.isFinite(dot.cy) && Number.isFinite(dot.r),
          "Native PON coordinates are invalid");
        finiteTuple(dot.boundsPt, 4, "Native PON bounds");
        assert.ok(Math.abs(dot.r / MM - 2.5) < EPS_MM &&
          Math.abs((dot.boundsPt[1] - dot.boundsPt[3]) / MM - 5) < EPS_MM,
        "Actual PON diameter is not 5 mm");
        const p = [(dot.cx - rect[0]) / MM, (dot.cy - rect[3]) / MM];
        const xSide = Math.abs(p[0] - 10) < EPS_MM ? "left" :
          Math.abs(p[0] - (paperW - 10)) < EPS_MM ? "right" : null;
        const ySide = Math.abs(p[1] - 10) < EPS_MM ? "bottom" :
          Math.abs(p[1] - (paperH - 10)) < EPS_MM ? "top" : null;
        assert.ok(xSide && ySide, "Actual PON centre does not have the expected 10 mm inset");
        positions.add(`${xSide}/${ySide}`);
        for (let ci = 0; ci < cuts.length; ci++) {
          const mesh = nativeMeshes[ci];
          assert.notEqual(context.strictMeshPoint(p, mesh), 1,
            `PON centre lies inside native cut ${ci}`);
          let minimum = Infinity;
          for (const edge of mesh.edges)
            minimum = Math.min(minimum, context.pointSegmentDistance(p, edge.a, edge.b));
          const clear = minimum - dot.r / MM;
          minimumPonEdgeClearance = Math.min(minimumPonEdgeClearance, clear);
          assert.ok(clear + FLATNESS_MM >= input.ponClearMm - EPS_MM,
            `PON edge clearance ${clear} mm is below ${input.ponClearMm} mm`);
        }
      }
      assert.equal(positions.size, 4, "Actual PON corner positions are not distinct");
      proof.faces.push({ mode: row.mode, name: face.name, count: cuts.length,
        paperMm: [paperW, paperH], minimumPonEdgeClearanceMm: minimumPonEdgeClearance,
        nativeDimensionsUnchanged: true, nativeMarginsVerified: true,
        ...JSON.parse(JSON.stringify(geometry)),
      });
    }
  }
  proof.passed = true;
  proof.externalPairCheckPassed = true;
  return proof;
}

if (require.main === module) {
  try {
    const reportPath = process.argv[2];
    assert.ok(reportPath, "Usage: node tests/dan_be_native_curve_guard.js path/to/native_audit.json");
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8").replace(/^\uFEFF/, ""));
    console.log(JSON.stringify(validateNativeReport(report), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ passed: false, error: String(error) }, null, 2));
    process.exitCode = 1;
  }
}
module.exports = { validateNativeReport };
