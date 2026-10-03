const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const illustrator = require('./illustrator_geometry_mock');
const library = fs.readFileSync(require.resolve('../DanCardCEP/jsx/dan_card_lib.jsx'), 'utf8');
const MM = 2.834645669;
const EPS = 0.001;
const pure = vm.createContext({});
vm.runInContext(library, pure);
function noOverlap(rectangles) {
  for(let i=0;i<rectangles.length;i++) for(let j=0;j<i;j++) {
    const a=rectangles[i],b=rectangles[j];
    assert(a[2]<=b[0]+EPS || b[2]<=a[0]+EPS || a[3]>=b[1]-EPS || b[3]>=a[1]-EPS,
      `Overlap: ${a} and ${b}`);
  }
}
function auditPlan(specs,w,h) {
  const before=JSON.stringify(specs);
  const plan=pure.dcKtsMixedSizePlan(specs,w,h);
  assert.strictEqual(JSON.stringify(specs),before);
  assert(plan.minimum>=1);
  assert(Math.max(...plan.counts)-Math.min(...plan.counts)<=1);
  assert.strictEqual(plan.count,plan.slots.length);
  const counts=specs.map(()=>0);
  for(const s of plan.slots) {
    assert(s.x>=-EPS && s.y>=-EPS && s.x+s.w<=w+EPS && s.y+s.h<=h+EPS);
    const spec=specs[s.modelIndex]; counts[s.modelIndex]++;
    assert(s.angle===0 || s.angle===90);
    assert(Math.abs(s.w-(s.angle?spec.h:spec.w))<EPS);
    assert(Math.abs(s.h-(s.angle?spec.w:spec.h))<EPS);
  }
  assert.deepStrictEqual(Array.from(plan.counts),counts);
  noOverlap(Array.from(plan.slots,s=>[s.x,-s.y,s.x+s.w,-s.y-s.h]));
  assert.strictEqual(JSON.stringify(pure.dcKtsMixedSizePlan(specs,w,h)),JSON.stringify(plan));
  return plan;
}
// A large square and a smaller rectangle fit alongside each other; forcing
// all models into the largest bounding box loses the smaller positions.
const holePlan=auditPlan([{w:60,h:60},{w:40,h:60}],100,120);
assert.strictEqual(holePlan.count,4);
assert.deepStrictEqual(Array.from(holePlan.counts),[2,2]);
for(const specs of [
  [{w:90,h:50},{w:60,h:40}],
  [{w:120,h:75},{w:85,h:45},{w:60,h:60}],
  [{w:80,h:30},{w:47,h:50},{w:85,h:90},{w:39,h:60},{w:70,h:55}],
  [{w:80,h:200},{w:90,h:200}],
]) auditPlan(specs,324,348);
assert.throws(()=>pure.dcKtsMixedSizePlan([{w:1,h:1}],Infinity,100));
assert.throws(()=>pure.dcKtsMixedSizePlan([{w:400,h:400}],324,348),/khong vua/);
assert.throws(()=>pure.dcKtsMixedSizePlan([{w:60,h:60},{w:60,h:60}],100,100),/Khong ghep du/);
assert.throws(()=>pure.dcKtsMixedSizePlan([{w:.1,h:.1}],324,348),/Qua nhieu/);

function setup(specs,twoSided,backDust=0) {
  const mock=illustrator(),c=vm.createContext(mock.context);
  vm.runInContext(library,c);
  let top=1000;
  for(let m=0;m<specs.length;m++) {
    const [w,h]=specs[m].map(v=>v*MM);
    mock.source([0,top,w,top-h],'F'+m);
    if(twoSided) mock.source([500,top+(m%2?.02:-.02),500+w+backDust,top-h+(m%2?.02:-.02)-backDust],'B'+m);
    top-=Math.max(h,200)+100;
  }
  mock.doc.selection=mock.originals.slice().reverse();
  return {mock,c};
}
for(const twoSided of [false,true]) for(const dust of [0,.1]) {
  const specs=[[90,50],[60,40],[75,65]];
  const {mock,c}=setup(specs,twoSided,dust);
  const source=JSON.stringify(mock.originals.map(i=>i.geometricBounds));
  const result=c.dcDanToiUu('33','35.4',twoSided,true);
  assert.match(result,/^OK:/,result);
  assert.match(result,/Ghep nhieu kich thuoc; so con tung mau:/);
  assert.strictEqual(mock.doc.artboards.length,twoSided?2:1);
  const fronts=mock.duplicates.filter(i=>twoSided ? i.layer.name.startsWith('Dan toi uu - Mat truoc') : i.layer.name==='Dan toi uu');
  const backs=mock.duplicates.filter(i=>i.layer.name.startsWith('Dan toi uu - Mat sau'));
  const counts=specs.map(()=>0);
  assert(fronts.length>0);
  noOverlap(fronts.map(i=>i.visibleBounds));
  noOverlap(backs.map(i=>i.visibleBounds));
  const fr=mock.doc.artboards[0].artboardRect;
  for(let i=0;i<fronts.length;i++) {
    const f=fronts[i],fb=f.visibleBounds,m=+f.identity.slice(1);counts[m]++;
    assert(fb[0]>=fr[0]+3*MM-EPS && fb[2]<=fr[2]-3*MM+EPS && fb[1]<=fr[1]-3*MM+EPS && fb[3]>=fr[3]+3*MM-EPS);
    assert(Math.abs(fb[2]-fb[0]-(f.angle?specs[m][1]:specs[m][0])*MM)<EPS);
    assert(Math.abs(fb[1]-fb[3]-(f.angle?specs[m][0]:specs[m][1])*MM)<EPS);
    assert(!f.reflected);
    if(twoSided) {
      const b=backs[i],bb=b.visibleBounds,br=mock.doc.artboards[1].artboardRect;
      assert.strictEqual(b.identity,'B'+m);
      assert.strictEqual(b.angle,f.angle?-90:0);
      assert(!b.reflected);
      const fx=(fb[0]+fb[2])/2-fr[0],bx=(bb[0]+bb[2])/2-br[0];
      assert(Math.abs(fx+bx-(fr[2]-fr[0]))<EPS,'Duplex X centres must mirror even with slight size dust.');
      assert(Math.abs(fr[1]-(fb[1]+fb[3])/2-(br[1]-(bb[1]+bb[3])/2))<EPS,'Duplex Y centres must match.');
    }
  }
  assert(Math.min(...counts)>0);
  assert(Math.max(...counts)-Math.min(...counts)<=1);
  assert.strictEqual(JSON.stringify(mock.originals.map(i=>i.geometricBounds)),source);
}
for(const scenario of ['no-tick','too-large','pair-mismatch','not-all-fit']) {
  const specs=scenario==='too-large'?[[400,400],[40,60]]:scenario==='not-all-fit'?[[240,240],[250,250]]:[[90,50],[60,40]];
  const {mock,c}=setup(specs,scenario==='pair-mismatch',scenario==='pair-mismatch'?10:0);
  const before=JSON.stringify(mock.originals.map(i=>i.geometricBounds));
  assert.match(c.dcDanToiUu('33','35.4',scenario==='pair-mismatch',scenario!=='no-tick'),/^ERR:/);
  assert.strictEqual(mock.duplicates.length,0,'Invalid mix fails before host writes.');
  assert.strictEqual(mock.doc.layers.length,1);
  assert.strictEqual(mock.doc.artboards.length,1);
  assert.strictEqual(JSON.stringify(mock.originals.map(i=>i.geometricBounds)),before);
}
console.log('KTS mixed sizes: true-size hole filling, balanced counts, deterministic fit, duplex centres, unchanged sources and preflight rejection passed.');
