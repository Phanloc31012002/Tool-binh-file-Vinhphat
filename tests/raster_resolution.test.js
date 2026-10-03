"use strict";
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const lib=fs.readFileSync(require.resolve('../DanCardCEP/jsx/dan_card_lib.jsx'),'utf8');
const main=fs.readFileSync(require.resolve('../DanCardCEP/js/main.js'),'utf8');
for(const source of [lib,main]) {
  const assignments=[...source.matchAll(/\w+\.resolution\s*=\s*([^;]+);/g)];
  assert(assignments.length>0);
  assignments.forEach(m=>assert.equal(m[1].trim(),'500','every processing raster must be 500ppi'));
}
const calls=[...lib.matchAll(/dcFlattenForImposition\([^;\n]+,\s*(\d+)\)/g)];
assert.equal(calls.length,7);
calls.forEach(m=>assert.equal(m[1],'500'));
assert(!/\b(?:300|400|450)\s*ppi/.test(main+lib));
const from=lib.indexOf('function dcFlattenForImposition('),to=lib.indexOf('// Catalogue KTS A4 uses',from);
const context=vm.createContext({dcIsImageOnly:i=>i.imageOnly,RasterizeOptions:function(){},AntiAliasingMethod:{ARTOPTIMIZED:'ART'}});
vm.runInContext(lib.slice(from,to),context);
const item={};let ppi;
const doc={rasterize(i,b,ro){assert.equal(i,item);ppi=ro.resolution;assert.equal(ro.transparency,true);return {raster:true};}};
for(const oldCallerPpi of [undefined,0,300,400,450,500]) {
  assert(context.dcFlattenForImposition(doc,item,[0,10,10,0],oldCallerPpi).raster);
  assert.equal(ppi,500,'cached/legacy caller cannot lower the shared raster resolution');
}
const image={imageOnly:true};
assert.equal(context.dcFlattenForImposition(doc,image,[0,10,10,0],300),image,'existing bitmap is not pointlessly upsampled');
const html=fs.readFileSync(require.resolve('../DanCardCEP/index.html'),'utf8');
assert.match(html,/Raster CMYK · 500 ppi/);
assert.match(lib,/300\*65536/,'CTL JPG intentionally remains 300ppi');
console.log('Raster: all panel/JSX options and imposition call sites at 500ppi, legacy caller protection, existing bitmap preservation and JPG 300ppi isolation passed.');
