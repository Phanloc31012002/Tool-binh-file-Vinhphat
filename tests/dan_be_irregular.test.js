"use strict";
const assert = require('node:assert/strict');
const nester = require('../DanCardCEP/js/dan_be_nester');

// Synthetic closed outlines: exercise generic geometry, not product-specific
// recognisers. Coordinates and all requested clearances are in millimetres.
const cat=[[[[0,18],[5,0],[16,9],[29,9],[41,0],[46,18],[40,28],
  [36,32],[39,43],[32,55],[26,55],[25,42],[20,42],[19,55],
  [12,55],[7,43],[10,32],[6,28]]]];
const rabbit=[[[[10,30],[4,14],[2,0],[7,0],[14,23],[19,0],[24,0],
  [22,15],[21,28],[31,34],[36,47],[32,60],[24,65],[10,65],
  [1,59],[0,45],[5,35]]]];
const elbow=[[[[0,0],[30,0],[30,10],[10,10],[10,30],[0,30]]]];
function ring(radius, count=64) {
  return Array.from({length:count},(_,i)=>[radius*Math.cos(i*2*Math.PI/count),
    radius*Math.sin(i*2*Math.PI/count)]);
}
const star=[[[...Array.from({length:10},(_,i)=> {
  const a=i*Math.PI/5-Math.PI/2,r=i%2?10:23;
  return [r*Math.cos(a),r*Math.sin(a)];
})]]];
const holed=[[ring(22),ring(10).reverse()]];

function pointIn(p, groups) {
  return groups.some(group=> {
    let inside=false;
    for (const contour of group) for (let i=0,j=contour.length-1;i<contour.length;j=i++) {
      const a=contour[i],b=contour[j];
      if ((a[1]>p[1])!==(b[1]>p[1]) &&
        p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
    }
    return inside;
  });
}
function pointSegment(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function cross(a,b,c) { return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); }
function segmentDistance(a,b,c,d) {
  const ac=cross(a,b,c),ad=cross(a,b,d),ca=cross(c,d,a),cb=cross(c,d,b);
  if (((ac<=0 && ad>=0)||(ac>=0 && ad<=0)) &&
    ((ca<=0 && cb>=0)||(ca>=0 && cb<=0)) &&
    Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0])) &&
    Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))) return 0;
  return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
}
function placedOutline(groups,slot) {
  function turn(p) {
    switch(slot.angle) {
      case 90:return [-p[1],p[0]];
      case 180:return [-p[0],-p[1]];
      case 270:return [p[1],-p[0]];
      default:return p.slice();
    }
  }
  const rotated=groups.map(g=>g.map(c=>c.map(turn))),points=rotated.flat(2);
  const x0=Math.min(...points.map(p=>p[0])),y0=Math.min(...points.map(p=>p[1]));
  const placed=rotated.map(g=>g.map(c=>c.map(p=>[p[0]-x0+slot.x,p[1]-y0+slot.y])));
  const vertices=placed.flat(2),edges=[];
  placed.forEach(g=>g.forEach(c=>c.forEach((p,i)=>edges.push([p,c[(i+1)%c.length]]))));
  return {groups:placed,vertices,edges,x0:slot.x,y0:slot.y,
    x1:Math.max(...vertices.map(p=>p[0])),y1:Math.max(...vertices.map(p=>p[1]))};
}
function physicalGuard(input,result) {
  const outlines=result.slots.map(s=>placedOutline(input.types[s.mi].groups,s));
  const tolerance=.001;
  for (const a of outlines) {
    assert.ok(a.x0>=input.marginMm-tolerance && a.y0>=input.marginMm-tolerance &&
      a.x1<=input.sheet.widthMm-input.marginMm+tolerance &&
      a.y1<=input.sheet.heightMm-input.marginMm+tolerance,'physical sheet margin');
    for (const d of input.sheet.dots) {
      const p=[d.x,d.y];
      assert.equal(pointIn(p,a.groups),false,'PON cannot be inside a filled cutter');
      const distance=Math.min(...a.edges.map(e=>pointSegment(p,e[0],e[1])));
      assert.ok(distance+tolerance>=d.r+input.ponClearMm,'distance from physical PON edge');
    }
  }
  for (let i=0;i<outlines.length;i++) for (let j=i+1;j<outlines.length;j++) {
    const a=outlines[i],b=outlines[j];
    const dx=Math.max(a.x0-b.x1,b.x0-a.x1,0),dy=Math.max(a.y0-b.y1,b.y0-a.y1,0);
    if (Math.hypot(dx,dy)>=input.gapMm) continue;
    for (const p of a.vertices) assert.equal(pointIn(p,b.groups),false,'filled outlines must not overlap');
    for (const p of b.vertices) assert.equal(pointIn(p,a.groups),false,'filled outlines must not contain each other');
    let distance=Infinity;
    for (const ea of a.edges) for (const eb of b.edges)
      distance=Math.min(distance,segmentDistance(ea[0],ea[1],eb[0],eb[1]));
    assert.ok(distance+tolerance>=input.gapMm,'physical cutter-to-cutter gap');
  }
}
function sheet(widthMm,heightMm) {
  return {widthMm,heightMm,dots:[{x:5,y:5,r:1},{x:widthMm-5,y:5,r:1},
    {x:5,y:heightMm-5,r:1},{x:widthMm-5,y:heightMm-5,r:1}]};
}
function bboxGridBaseline(groups,input) {
  let maximum=0;
  for (const angle of [0,90,180,270]) {
    const v=placedOutline(groups,{angle,x:0,y:0});
    const columns=Math.max(0,Math.floor((input.sheet.widthMm-2*input.marginMm+input.gapMm)/(v.x1+input.gapMm)));
    const rows=Math.max(0,Math.floor((input.sheet.heightMm-2*input.marginMm+input.gapMm)/(v.y1+input.gapMm)));
    maximum=Math.max(maximum,columns*rows);
  }
  // The rectangle baseline ignores PON exclusions, favouring it fairly.
  return maximum;
}

const fixtures=[
  {name:'Cat ears and concave legs',groups:[cat],sheet:sheet(180,180)},
  {name:'Rabbit ears and body',groups:[rabbit],sheet:sheet(180,180)},
  {name:'Five-point concave star',groups:[star],sheet:sheet(180,180)},
  {name:'Compound contour with a real hole',groups:[holed],sheet:sheet(180,180)},
  {name:'Two distinct irregular types alternate',groups:[cat,rabbit],sheet:sheet(220,220)},
  {name:'L contours interlock beyond every rotated bbox grid',groups:[elbow],sheet:sheet(65,65),beatBbox:true}
];
const failures=[];
const began=Date.now();
for (const f of fixtures) {
  const input={sheet:f.sheet,types:f.groups.map(groups=>({groups})),gapMm:2,
    marginMm:4,ponClearMm:7.5,resolutionMm:.25,budgetMs:1200};
  try {
    const result=nester.nest(input);
    assert.equal(result.ok,true,result.error);
    assert.ok(result.count>0,'a valid irregular cutter must receive copies');
    physicalGuard(input,result);
    if (f.groups.length>1) assert.ok(Math.max(...result.counts)-Math.min(...result.counts)<=1,'balanced distinct types');
    const bbox=bboxGridBaseline(f.groups[0],input);
    if (f.beatBbox) assert.ok(result.count>bbox,'silhouette nesting must beat the best 0/90/180/270 bbox-grid baseline');
    console.log(f.name+': '+result.count+' dies ['+result.counts+']; bbox baseline '+bbox+'; independent physical guard passed');
  } catch (error) {
    failures.push(f.name+': '+error.message);
    console.error('FAIL '+failures[failures.length-1]);
  }
}
assert.ok(Date.now()-began<20000,'irregular regression suite must remain bounded');
assert.deepEqual(failures,[],'irregular outline regression failures');
