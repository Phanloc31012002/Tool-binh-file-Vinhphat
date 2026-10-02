"use strict";
const assert=require('node:assert/strict');
const nester=require('../DanCardCEP/js/dan_be_nester');
const fixtures=require('./dan_be_fixtures');

// Same measured spoon cutter, oriented as the actual Illustrator payload.
const step=.25, margin=4, rw=1288, rh=1384;
const groups=nester._test.buildVariant(fixtures.spoon(),0,2,180,1,step).groups;
const variants=[0,90,180,270].map((angle,vi)=>
  nester._test.buildVariant(groups,0,vi,angle,1,step));
const dots=[{x:10,y:10,r:2.5},{x:320,y:10,r:2.5},
  {x:10,y:344,r:2.5},{x:320,y:344,r:2.5}]
  .map(d=>({x:(d.x-margin)/step,y:(d.y-margin)/step,radius:(d.r+7.5)/step}));
const original=[];
for(let i=0;i<4;i++) original.push({mi:0,v:0,x:(16.25+i*67-margin)/step,y:(176.75-margin)/step});
for(let i=0;i<4;i++) original.push({mi:0,v:2,x:(47.5+i*67-margin)/step,y:(114.25-margin)/step});
original.push({mi:0,v:1,x:(77-margin)/step,y:0});
original.push({mi:0,v:1,x:(21.75-margin)/step,y:(52.5-margin)/step});
assert.equal(nester._test.verifyGeometry(original,variants,rw,rh,dots,1,step),true);
const before=margin+step*nester._test.edgeMargin(original,variants,rw,rh);
const started=Date.now();
const polished=nester._test.polishEdges(original,variants,rw,rh,dots,1,step,started+550);
const after=margin+step*nester._test.edgeMargin(polished,variants,rw,rh);
assert.equal(polished.length,original.length,'polish cannot lose a cutter');
assert.equal(nester._test.verifyPlan(polished,variants,rw,rh,dots),true);
assert.equal(nester._test.verifyGeometry(polished,variants,rw,rh,dots,1,step),true);
assert.ok(after>=before+5,'180-degree alternatives should measurably improve the minimum edge margin');
assert.ok(Date.now()-started<3000,'small count-preserving polish remains bounded');
assert.deepEqual(polished.map(s=>s.mi).sort(),original.map(s=>s.mi).sort(),'artwork counts unchanged');
console.log('Spoon pair polish: '+before.toFixed(2)+' -> '+after.toFixed(2)+' mm minimum edge margin, all 10 cutters physically valid');
