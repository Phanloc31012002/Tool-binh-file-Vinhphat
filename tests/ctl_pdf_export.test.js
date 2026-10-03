const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const library = fs.readFileSync(require.resolve('../DanCardCEP/jsx/dan_card_lib.jsx'), 'utf8');
const start = library.indexOf('function dcLuuCtlOffsetPDF(');
const exporter = library.slice(start, library.indexOf('//  TEST: Dàn CATALOGUE KEO GÁY', start));
assert(!/executeMenuCommand|app\.undo|selectObjectsOnActiveArtboard/.test(exporter));

function fixture(failName) {
  const files = new Set(), saves = [], docs = [];
  let app;
  function layersFor(doc) {
    const layers = [];
    layers.add = () => {
      assert.strictEqual(app.activeDocument, doc, 'create layers on active work document');
      const layer = { name: '', visible: true, printable: true, locked: false, pageItems: [], doc };
      layer.layers = layersFor(doc);
      layers.unshift(layer);
      return layer;
    };
    return layers;
  }
  function doc(name, rects) {
    const d = { name, documentColorSpace: 'CMYK', activate() { app.activeDocument = d; } };
    let selection=[];
    Object.defineProperty(d,'selection',{get:()=>selection,set:value=>{selection=value||[];}});
    let abIndex = 0;
    const boards = rects.map(rect => ({ artboardRect: rect }));
    boards.getActiveArtboardIndex = () => abIndex;
    boards.setActiveArtboardIndex = n => { abIndex = n; };
    Object.defineProperty(d, 'artboards', { get() {
      assert.strictEqual(app.activeDocument, d, 'artboard reads must target active document');
      return boards;
    }});
    d.layers = layersFor(d);
    d.close = () => { assert.strictEqual(app.activeDocument, d); docs.splice(docs.indexOf(d), 1); app.activeDocument = source; };
    d.saveAs = (file, options) => {
      assert.strictEqual(app.activeDocument, d, 'PDF save must have work document active');
      files.add(file.fsName);
      if (file.fsName.includes(failName || 'NEVER_FAIL')) throw Error('injected save failure');
      saves.push({ name: file.fsName, options, doc: d });
    };
    docs.push(d);
    return d;
  }
  app = { documents: docs, executeMenuCommand() { throw Error('source mutation'); }, undo() { throw Error('source undo'); } };
  const source = doc('USER.ai', [[-1000, 1000, -700, 800], [-600, 1000, -300, 800], [-200, 1000, 100, 800]]);
  source.activate();
  const body = source.layers.add(); body.name = 'Bai';
  const pon = source.layers.add(); pon.name = 'PON'; pon.locked = true;
  const hidden = source.layers.add(); hidden.name = 'hidden'; hidden.visible = false;
  const nested = body.layers.add(); nested.name = 'nested';
  source.activeLayer = body;
  function item(layer, name, bounds) {
    const it = { name, parent: layer, hidden: false, locked: layer === pon,
      geometricBounds: bounds, visibleBounds: bounds,
      duplicate(target) {
        assert.strictEqual(app.activeDocument, source, 'duplicate from active source');
        if (name === 'nestedChild') assert.strictEqual(target.name, 'nested');
        const copy = { name, locked: it.locked, geometricBounds: [0, 50, bounds[2]-bounds[0], 50-(bounds[1]-bounds[3])],
          translate(x,y) { assert.strictEqual(app.activeDocument, target.doc); this.geometricBounds = this.geometricBounds.map((v,i)=>v+(i%2 ? y : x)); } };
        target.pageItems.push(copy);
        // Model a host changing the active document during duplicate.
        app.activeDocument = target.doc;
        return copy;
      }};
    Object.defineProperty(it,'selected',{set:value=>{if(value&&!source.selection.includes(it))source.selection.push(it);}});
    layer.pageItems.push(it); return it;
  }
  for (let n=0;n<3;n++) {
    const x=-1000+n*400;
    item(body, 'body'+n, [x+10,990,x+110,890]);
    item(pon, 'pon'+n, [x+2,998,x+7,998]); // zero-height stroked crop mark
    item(hidden, 'hidden'+n, [x,1000,x+300,800]);
  }
  item(nested,'nestedChild',[-990,980,-980,970]);
  // A child already included in a group must not be copied a second time.
  body.pageItems.push({ name:'groupChild',parent:{typename:'GroupItem'}, hidden:false });
  source.selection=[body.pageItems[0]];
  source.artboards.setActiveArtboardIndex(2);
  const before = JSON.stringify({ locks:source.layers.map(l=>l.locked), selection:source.selection.map(i=>i.name), bounds:body.pageItems.filter(i=>i.geometricBounds).map(i=>i.geometricBounds) });
  docs.add = (space,w,h,count) => {
    const d=doc('TEMP',Array.from({length:count},(_,n)=>[n*(w+20),h,n*(w+20)+w,0]));
    d.activate();d.layers.add();return d;
  };
  function File(path) { this.fsName=path; Object.defineProperty(this,'exists',{get:()=>files.has(path)}); this.remove=()=>files.delete(path); }
  const context = { app, File, dcChonThuMucLuuPDF:()=>({fsName:'OUTPUT'}), DocumentColorSpace:{CMYK:'CMYK'},
    PDFSaveOptions:function(){},PDFCompatibility:{ACROBAT5:5},ElementPlacement:{PLACEATEND:1},SaveOptions:{DONOTSAVECHANGES:0} };
  vm.createContext(context); vm.runInContext(exporter,context);
  return { run: jobs=>context.dcLuuCtlOffsetPDF('3',jobs), files,saves,source,docs,before,
    unchanged() {
      assert.strictEqual(app.activeDocument,source);
      assert.strictEqual(source.artboards.getActiveArtboardIndex(),2);
      assert.strictEqual(source.activeLayer,body);
      assert.strictEqual(JSON.stringify({locks:source.layers.map(l=>l.locked),selection:source.selection.map(i=>i.name),bounds:body.pageItems.filter(i=>i.geometricBounds).map(i=>i.geometricBounds)}),before);
      assert.strictEqual(docs.length,1,'no temporary document leaks');
    } };
}
const jobs='BIA=1@300x200|RUOT 1=2,3@300x200';
const good=fixture(); assert.match(good.run(jobs),/^OK:.*2 PDF/);good.unchanged();
assert.deepStrictEqual(good.saves.map(s=>s.options.artboardRange),['1','1-2']);
assert.deepStrictEqual(good.saves[0].doc.layers.map(l=>l.name),['PON','Bai','']);
assert.deepStrictEqual(good.saves[0].doc.layers[0].pageItems.map(i=>i.name),['pon0']);
assert.deepStrictEqual(good.saves[1].doc.layers[0].pageItems.map(i=>i.name),['pon1','pon2']);
assert.deepStrictEqual(good.saves[0].doc.layers[1].pageItems[0].geometricBounds,[10,190,110,90]);
assert.match(good.run(jobs),/^ERR: File đã tồn tại/);good.unchanged();
const bad=fixture('RUOT');assert.match(bad.run(jobs),/^OK:.*1 PDF.*Lỗi 1 file/);bad.unchanged();
assert.deepStrictEqual([...bad.files],['OUTPUT/BIA.pdf'],'remove only the incomplete failed output');
const duplicate=fixture();assert.match(duplicate.run('BIA=1@300x200|bia=2@300x200'),/^ERR: Hai tờ trùng tên/);duplicate.unchanged();
console.log('CTL PDF: active-document guards, locked PON, layers, coordinates, A/B, source preservation and failure cleanup passed.');
