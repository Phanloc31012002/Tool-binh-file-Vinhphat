const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const library = fs.readFileSync(
  require.resolve("../DanCardCEP/jsx/dan_card_lib.jsx"),
  "utf8",
);
const start = library.indexOf("function dcLuuCtlOffsetPDF(");
const exporter = library.slice(
  start,
  library.indexOf("//  TEST: Dàn CATALOGUE KEO GÁY", start),
);
assert(
  !/executeMenuCommand|app\.undo|selectObjectsOnActiveArtboard/.test(exporter),
);

function fixture(failName) {
  const files = new Set(),
    saves = [],
    docs = [];
  let app;
  let batchTranslations = 0;
  function addGroup(parent) {
    const group = {
      name: "",
      parent,
      doc: parent.doc,
      pageItems: [],
      locked: false,
    };
    group.move = (target) => {
      group.parent.pageItems.splice(group.parent.pageItems.indexOf(group), 1);
      group.parent = target;
      target.pageItems.push(group);
    };
    group.remove = () =>
      group.parent.pageItems.splice(group.parent.pageItems.indexOf(group), 1);
    group.translate = (x, y) => {
      assert.strictEqual(app.activeDocument, group.doc);
      batchTranslations++;
      function walk(node) {
        for (const child of node.pageItems) {
          if (child.pageItems) walk(child);
          else
            child.geometricBounds = child.geometricBounds.map(
              (v, i) => v + (i % 2 ? y : x),
            );
        }
      }
      walk(group);
    };
    parent.pageItems.push(group);
    return group;
  }
  function layersFor(doc) {
    const layers = [];
    layers.add = () => {
      assert.strictEqual(
        app.activeDocument,
        doc,
        "create layers on active work document",
      );
      const layer = {
        name: "",
        visible: true,
        printable: true,
        locked: false,
        pageItems: [],
        doc,
      };
      layer.layers = layersFor(doc);
      layer.groupItems = { add: () => addGroup(layer) };
      layer.remove = () => layers.splice(layers.indexOf(layer), 1);
      layers.unshift(layer);
      return layer;
    };
    return layers;
  }
  function doc(name, rects) {
    const d = {
      name,
      documentColorSpace: "CMYK",
      activate() {
        app.activeDocument = d;
      },
    };
    let selection = [];
    Object.defineProperty(d, "selection", {
      get: () => selection,
      set: (value) => {
        selection = value || [];
      },
    });
    let abIndex = 0;
    const boards = rects.map((rect, n) => ({
      artboardRect: rect,
      name: "Board " + (n + 1),
    }));
    boards.getActiveArtboardIndex = () => abIndex;
    boards.setActiveArtboardIndex = (n) => {
      abIndex = n;
    };
    Object.defineProperty(d, "artboards", {
      get() {
        assert.strictEqual(
          app.activeDocument,
          d,
          "artboard reads must target active document",
        );
        return boards;
      },
    });
    d.layers = layersFor(d);
    d.close = () => {
      assert.strictEqual(app.activeDocument, d);
      docs.splice(docs.indexOf(d), 1);
      app.activeDocument = source;
    };
    d.saveAs = (file, options) => {
      assert.strictEqual(
        app.activeDocument,
        d,
        "save must have work document active",
      );
      files.add(file.fsName);
      if (file.fsName.includes(failName || "NEVER_FAIL"))
        throw Error("injected save failure");
      saves.push({ name: file.fsName, options, doc: d });
    };
    docs.push(d);
    return d;
  }
  app = {
    documents: docs,
    coordinateSystem: "user-coordinate-mode",
    executeMenuCommand() {
      throw Error("source mutation");
    },
    undo() {
      throw Error("source undo");
    },
  };
  const source = doc("USER.ai", [
    [-1000, 1000, -700, 800],
    [-600, 1000, -300, 800],
    [-200, 1000, 100, 800],
  ]);
  source.activate();
  const body = source.layers.add();
  body.name = "Bai";
  const pon = source.layers.add();
  pon.name = "PON";
  pon.locked = true;
  const hidden = source.layers.add();
  hidden.name = "hidden";
  hidden.visible = false;
  const nested = body.layers.add();
  nested.name = "nested";
  source.activeLayer = body;
  function item(layer, name, bounds) {
    const it = {
      name,
      parent: layer,
      hidden: false,
      locked: layer === pon,
      geometricBounds: bounds,
      visibleBounds: bounds,
      duplicate(target) {
        assert.strictEqual(
          app.activeDocument,
          source,
          "duplicate from active source",
        );
        if (name === "nestedChild") assert.strictEqual(target.name, "nested");
        const copy = {
          name,
          locked: it.locked,
          // Lệnh nhân bản giữa hai tài liệu áp một độ lệch hệ toạ độ chung,
          // không phải mỗi item một gốc toạ độ riêng.
          geometricBounds: bounds.map((v, i) => v + (i % 2 ? -950 : 2000)),
          translate() {
            throw Error("per-object snapping is forbidden");
          },
        };
        copy.parent = target;
        copy.move = (parent) => {
          assert.strictEqual(app.activeDocument, target.doc);
          copy.parent.pageItems.splice(copy.parent.pageItems.indexOf(copy), 1);
          copy.parent = parent;
          parent.pageItems.push(copy);
        };
        target.pageItems.push(copy);
        // Mô phỏng trường hợp host đổi tài liệu đang active trong lúc nhân bản.
        app.activeDocument = target.doc;
        return copy;
      },
    };
    Object.defineProperty(it, "selected", {
      set: (value) => {
        if (value && !source.selection.includes(it)) source.selection.push(it);
      },
    });
    layer.pageItems.push(it);
    return it;
  }
  for (let n = 0; n < 3; n++) {
    const x = -1000 + n * 400;
    item(body, "body" + n, [x + 10, 990, x + 110, 890]);
    item(pon, "pon" + n, [x + 2, 998, x + 7, 998]); // PON cắt có nét viền, chiều cao bằng 0
    item(hidden, "hidden" + n, [x, 1000, x + 300, 800]);
  }
  item(nested, "nestedChild", [-990, 980, -980, 970]);
  // Phần tử con đã nằm trong một group thì không được sao chép lần thứ hai.
  body.pageItems.push({
    name: "groupChild",
    parent: { typename: "GroupItem" },
    hidden: false,
  });
  body.pageItems.push({
    name: "empty raster source group",
    parent: body,
    typename: "GroupItem",
    pageItems: [],
    hidden: false,
    get visibleBounds() {
      throw Error("PARM on empty group");
    },
  });
  source.selection = [body.pageItems[0]];
  source.artboards.setActiveArtboardIndex(2);
  const before = JSON.stringify({
    locks: source.layers.map((l) => l.locked),
    selection: source.selection.map((i) => i.name),
    bounds: body.pageItems
      .filter((i) => i.geometricBounds)
      .map((i) => i.geometricBounds),
  });
  docs.add = (space, w, h, count) => {
    const d = doc(
      "TEMP",
      Array.from({ length: count }, (_, n) => [
        n * (w + 20),
        h,
        n * (w + 20) + w,
        0,
      ]),
    );
    d.activate();
    d.layers.add();
    return d;
  };
  function File(path) {
    this.fsName = path;
    Object.defineProperty(this, "exists", { get: () => files.has(path) });
    Object.defineProperty(this, "length", { get: () => files.has(path) ? 100 : -1 });
    this.remove = () => files.delete(path);
  }
  const context = {
    app,
    File,
    dcChonThuMucLuuPDF: () => ({ fsName: "OUTPUT" }),
    DocumentColorSpace: { CMYK: "CMYK" },
    CoordinateSystem: { DOCUMENTCOORDINATESYSTEM: "document" },
    PDFSaveOptions: function () {},
    IllustratorSaveOptions: function () {
      this.typename = "IllustratorSaveOptions";
    },
    Folder: {system:{fsName:'SYSTEM'},temp:{fsName:'TEMP'}},
    dcCtlExportJpeg(d,file) {
      assert.strictEqual(app.activeDocument,d);
      files.add(file.fsName);
      if(file.fsName.includes(failName || 'NEVER_FAIL')) throw Error('injected JPEG failure');
    },
    PDFCompatibility: { ACROBAT5: 5 },
    ElementPlacement: { PLACEATEND: 1 },
    SaveOptions: { DONOTSAVECHANGES: 0 },
  };
  vm.createContext(context);
  vm.runInContext(exporter, context);
  return {
    run: (jobs) => context.dcLuuCtlOffsetPDF("3", jobs),
    runAI: (jobs, total = "3") => context.dcLuuCtlOffsetAI(total, jobs),
    runPackage: (jobs,suffix='') => context.dcLuuCtlOffsetAIPackage('3',jobs,suffix),
    files,
    saves,
    source,
    docs,
    batchTranslations: () => batchTranslations,
    before,
    unchanged() {
      assert.strictEqual(app.activeDocument, source);
      assert.strictEqual(app.coordinateSystem, "user-coordinate-mode");
      assert.strictEqual(source.artboards.getActiveArtboardIndex(), 2);
      assert.strictEqual(source.activeLayer, body);
      assert.strictEqual(
        JSON.stringify({
          locks: source.layers.map((l) => l.locked),
          selection: source.selection.map((i) => i.name),
          bounds: body.pageItems
            .filter((i) => i.geometricBounds)
            .map((i) => i.geometricBounds),
        }),
        before,
      );
      assert.strictEqual(docs.length, 1, "no temporary document leaks");
    },
  };
}
const jobs = "BIA=1@300x200|RUOT 1=2,3@300x200";
function leaves(layer) {
  return layer.pageItems.flatMap((item) =>
    item.pageItems ? leaves(item) : [item],
  );
}
const good = fixture();
assert.match(good.run(jobs), /^OK:.*2 PDF/);
good.unchanged();
assert.deepStrictEqual(
  good.saves.map((s) => s.options.artboardRange),
  ["1", "1-2"],
);
assert.deepStrictEqual(
  good.saves[0].doc.layers.map((l) => l.name),
  ["PON", "Bai", ""],
);
assert.deepStrictEqual(
  leaves(good.saves[0].doc.layers[0]).map((i) => i.name),
  ["pon0"],
);
assert.deepStrictEqual(
  leaves(good.saves[1].doc.layers[0]).map((i) => i.name),
  ["pon1", "pon2"],
);
assert.deepStrictEqual(
  leaves(good.saves[0].doc.layers[1])[0].geometricBounds,
  [10, 190, 110, 90],
);
assert.match(good.run(jobs), /^ERR: File đã tồn tại/);
good.unchanged();
const bad = fixture("RUOT");
assert.match(bad.run(jobs), /^OK:.*1 PDF.*Lỗi 1 file/);
bad.unchanged();
assert.deepStrictEqual(
  [...bad.files],
  ["OUTPUT/BIA.pdf"],
  "remove only the incomplete failed output",
);
const duplicate = fixture();
assert.match(
  duplicate.run("BIA=1@300x200|bia=2@300x200"),
  /^ERR: Hai tờ trùng tên/,
);
duplicate.unchanged();
const ai = fixture();
assert.match(ai.runAI(jobs), /^OK:.*2 AI/);
ai.unchanged();
assert.deepStrictEqual([...ai.files], ["OUTPUT/BIA.ai", "OUTPUT/RUOT 1.ai"]);
for (const save of ai.saves) {
  assert.strictEqual(save.options.typename, "IllustratorSaveOptions");
  assert.strictEqual(save.options.pdfCompatible, false);
  assert.strictEqual(save.options.compressed, true);
  assert.strictEqual(save.options.embedLinkedFiles, true);
  assert.strictEqual(save.options.embedICCProfile, true);
  assert.strictEqual(save.options.artboardRange, undefined);
  assert.strictEqual(save.options.saveMultipleArtboards, undefined);
}
// A/B là hai artboard thật trong MỘT file AI đời mới, không phải tài nguyên tách rời kiểu cũ.
assert.strictEqual(ai.saves[0].doc.name, "TEMP");
ai.saves[1].doc.activate();
assert.deepStrictEqual(
  ai.saves[1].doc.artboards.map((a) => a.name),
  ["Board 2", "Board 3"],
);
assert.strictEqual(ai.saves[1].doc.artboards.length, 2);
ai.source.activate();
assert.deepStrictEqual(
  leaves(ai.saves[1].doc.layers[0]).map((i) => i.name),
  ["pon1", "pon2"],
);
assert.strictEqual(
  ai.batchTranslations(),
  3,
  "one whole-sheet snap per artboard, never one per object",
);
assert.strictEqual(
  ai.saves[1].doc.layers[0].pageItems.length,
  2,
  "one PON group for each A/B artboard",
);
assert.match(ai.runAI(jobs), /^ERR: File đã tồn tại: BIA\.ai/);
ai.unchanged();
const aiBad = fixture("RUOT");
assert.match(aiBad.runAI(jobs), /^OK:.*1 AI.*Lỗi 1 file/);
aiBad.unchanged();
assert.deepStrictEqual([...aiBad.files], ["OUTPUT/BIA.ai"]);
const aiInvalid = fixture();
assert.match(aiInvalid.runAI(jobs, "4"), /^ERR:.*lưu AI/);
assert.match(
  aiInvalid.runAI("BIA=1@300x200|bia=2@300x200"),
  /^ERR: Hai tờ trùng tên AI/,
);
assert.match(aiInvalid.runAI("BIA=1@310x200"), /^ERR:.*lưu AI/);
assert.match(aiInvalid.runAI("invalid"), /^ERR:.*lưu AI/);
assert.strictEqual(aiInvalid.files.size, 0);
aiInvalid.unchanged();
const packaged = fixture();
const suffix = "CATALOGUE thử ' & $ = @ (1)";
const packageResult = packaged.runPackage(jobs,suffix);
assert.match(packageResult,/^OK:.*2 AI \+ JPG/);
const manifest = JSON.parse(packageResult.split('||CTLPACK:')[1]);
assert.strictEqual(manifest.jobs.length,2);
assert.deepStrictEqual(manifest.jobs.map(j=>j.baseName),['BIA '+suffix,'RUOT 1 '+suffix]);
for(const job of manifest.jobs) {
  assert.strictEqual(job.ai,'OUTPUT/'+job.baseName+'.ai');
  assert.strictEqual(job.jpg,'OUTPUT/'+job.baseName+'.jpg');
  assert.strictEqual(job.zip,'OUTPUT/'+job.baseName+'.zip');
  assert(packaged.files.has(job.ai));assert(packaged.files.has(job.jpg));
  assert(!packaged.files.has(job.zip),'ZIP is created after host export completes');
}
assert.strictEqual(packaged.batchTranslations(),3);
packaged.unchanged();
for(const badSuffix of ['bad/name','bad:name','bad\\name','bad\nname','bad.']) {
  const invalid=fixture();
  assert.match(invalid.runPackage(jobs,badSuffix),/^ERR:.*tên file|^ERR: Tên file/);
  assert.strictEqual(invalid.files.size,0);
  invalid.unchanged();
}
for(const ext of ['ai','jpg','zip']) {
  const collision=fixture();
  collision.files.add('OUTPUT/BIA.'+ext);
  assert.match(collision.runPackage(jobs),/^ERR: File đã tồn tại/);
  assert.deepStrictEqual([...collision.files],['OUTPUT/BIA.'+ext]);
  collision.unchanged();
}
const jpegFailure=fixture('.jpg');
assert.match(jpegFailure.runPackage(jobs),/^ERR:.*AI đã lưu; xuất JPG lỗi/);
assert.deepStrictEqual([...jpegFailure.files],['OUTPUT/BIA.ai','OUTPUT/RUOT 1.ai']);
jpegFailure.unchanged();
const partial=fixture('RUOT 1.jpg');
const partialResult=partial.runPackage(jobs);
assert.match(partialResult,/^OK:.*1 AI \+ JPG.*Lỗi 1 file/);
assert.deepStrictEqual([...partial.files],['OUTPUT/BIA.ai','OUTPUT/BIA.jpg','OUTPUT/RUOT 1.ai']);
assert.strictEqual(JSON.parse(partialResult.split('||CTLPACK:')[1]).jobs.length,1);
partial.unchanged();
console.log(
  "CTL AI/PDF: format isolation, native A/B boards, active-document guards, locked PON, layers, coordinates, source preservation and failure cleanup passed.",
);
