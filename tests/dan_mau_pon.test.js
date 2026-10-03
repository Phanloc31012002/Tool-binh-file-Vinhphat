const assert=require('assert'),fs=require('fs'),vm=require('vm');
const lib=fs.readFileSync(require.resolve('../DanCardCEP/jsx/dan_card_lib.jsx'),'utf8');
const main=fs.readFileSync(require.resolve('../DanCardCEP/js/main.js'),'utf8');
const start=lib.indexOf('function dcApMau('),end=lib.indexOf('function dcApMauCore(',start);
const wrapper=lib.slice(start,end);
for(const throws of [false,true]) {
  const app={coordinateSystem:'ARTBOARD'}, calls=[];
  const ctx={app,CoordinateSystem:{DOCUMENTCOORDINATESYSTEM:'DOCUMENT'},dcApMauCore(flag){
    calls.push(flag);assert.strictEqual(app.coordinateSystem,'DOCUMENT');
    if(throws)throw Error('injected failure');return 'OK: test';
  }};
  vm.createContext(ctx);vm.runInContext(wrapper,ctx);
  if(throws)assert.throws(()=>ctx.dcApMau(true),/injected failure/);
  else assert.strictEqual(ctx.dcApMau(true),'OK: test');
  assert.strictEqual(app.coordinateSystem,'ARTBOARD','restore on success AND exception');
  assert.deepStrictEqual(calls,[true],'keep multi-source option');
}
const core=lib.slice(end,lib.indexOf('//  dcAutoSavePDF',end));
assert.match(core,/var startCx = ponF\.cx;\s*var startCy = ponF\.cy;/);
assert.match(core,/R\.cx = \(pr\[0\] \+ pr\[2\]\) \/ 2;/);
assert.match(core,/R\.cy = \(pr\[1\] \+ pr\[3\]\) \/ 2;/);
assert.match(main,/loadDanTheoMauJsx\(\) \+ "dcApMau\("/);
assert.match(main,/dcDanTheoMauVersion < 1/);
console.log('Dàn theo mẫu: document-coordinate PON anchor, restore on failure/success, multi-source forwarding and stale-engine reload passed.');
