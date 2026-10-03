"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const child=require('node:child_process');
const zlib=require('node:zlib');
const packager=require('../DanCardCEP/js/ctl_package');
const btoa=s=>Buffer.from(s,'latin1').toString('base64');
const name="RUOT 1 thử ' & $() [1] = @";
function planFor(folder,names) {
  folder=folder.replace(/\\/g,'/');
  return {folder,system:'C:/Windows/System32',temp:'C:/Temp',jobs:names.map(baseName=>({baseName,ai:folder+'/'+baseName+'.ai',jpg:folder+'/'+baseName+'.jpg',zip:folder+'/'+baseName+'.zip'}))};
}
const plan=planFor('C:/output',[name]);
assert.deepEqual(packager.validate(plan).jobs,plan.jobs);
for(const change of [
  {folder:'../output'}, {jobs:[]},
  {jobs:[{...plan.jobs[0],jpg:'C:/outside/'+name+'.jpg'}]},
  {jobs:[plan.jobs[0],plan.jobs[0]]},
  {jobs:[{...plan.jobs[0],baseName:'bad/name'}]},
]) assert.throws(()=>packager.validate({...plan,...change}));
const script=packager.command(plan,'C:/Temp/test.json',btoa);
assert(!script.includes(name),'user names are JSON data, not shell code');
const large=planFor('C:/output',Array.from({length:1000},(_,i)=>'RUOT '+i+' '+name));
assert.equal(packager.command(large,'C:/Temp/test.json',btoa).length,script.length,'no Windows command-line limit with large batches');
assert.equal(Buffer.from(packager.utf16Base64("thử ' & $",btoa),'base64').toString('utf16le'),"thử ' & $");
function mocked(options={}) {
  const files=new Map(),tasks=[],deletes=[],calls=[],results=[];
  let statePath;
  const env={
    btoa, setTimeout(fn){tasks.push(fn);},
    cep:{fs:{
      stat(){return {err:options.collision?0:3};},
      writeFile(p,s){statePath=p;files.set(p,s);return {err:options.writeError?5:0};},
      readFile(p){if(options.readError)throw Error('read failure');return {err:0,data:files.get(p)};},
      deleteFile(p){deletes.push(p);files.delete(p);return {err:0};},
    },process:{
      createProcess(...args){calls.push(args);return {err:options.launchError?1:0,data:options.launchError?0:123};},
      isRunning(){return {err:0,data:!options.stopped};},
    }},
  };
  packager.pack(plan,()=>{},(error,result)=>results.push({error,result}),env);
  return {files,tasks,deletes,calls,results,state:()=>statePath};
}
const good=mocked();
assert(good.calls[0].includes('Hidden'));
assert(good.calls[0].includes('-NonInteractive'));
assert.deepEqual(JSON.parse(good.files.get(good.state())).jobs,plan.jobs);
good.files.set(good.state(),JSON.stringify({done:true,files:[{}],errors:[]}));
good.tasks.shift()();
assert.equal(good.results.length,1);assert.equal(good.results[0].error,null);
assert.deepEqual(good.deletes,[good.state()]);
for(const options of [{collision:true},{launchError:true},{writeError:true},{readError:true},{stopped:true}]) {
  const mock=mocked(options);
  for(let k=0;mock.tasks.length && k<4;k++) mock.tasks.shift()();
  assert.equal(mock.results.length,1);assert(mock.results[0].error);
  assert.equal(mock.deletes.length,options.collision||options.writeError?0:1);
}
assert.equal(packager.supported({}),false);
// Read both central and local ZIP headers, inflate entries and compare bytes.
// This checks actual archive data, not merely the worker's success message.
function unzip(file) {
  const b=fs.readFileSync(file);let end=-1;
  for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--) if(b.readUInt32LE(p)===0x06054b50){end=p;break;}
  assert(end>=0);const count=b.readUInt16LE(end+10),files=new Map();
  let p=b.readUInt32LE(end+16);
  for(let i=0;i<count;i++) {
    assert.equal(b.readUInt32LE(p),0x02014b50);
    const method=b.readUInt16LE(p+10),size=b.readUInt32LE(p+20),rawSize=b.readUInt32LE(p+24);
    const n=b.readUInt16LE(p+28),extra=b.readUInt16LE(p+30),comment=b.readUInt16LE(p+32);
    const local=b.readUInt32LE(p+42),name=b.toString('utf8',p+46,p+46+n);
    assert.equal(b.readUInt32LE(local),0x04034b50);
    const dataStart=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28);
    const compressed=b.subarray(dataStart,dataStart+size);
    const content=method===8?zlib.inflateRawSync(compressed):compressed;
    assert.equal(content.length,rawSize);assert(!files.has(name));files.set(name,content);
    p+=46+n+extra+comment;
  }
  return files;
}
function runNative(plan,statusPath) {
  fs.writeFileSync(statusPath,JSON.stringify({...packager.validate(plan),pending:true}),'utf8');
  const script=packager.command(plan,statusPath,btoa);
  const exe=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  const run=child.spawnSync(exe,['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',packager.utf16Base64(script,btoa)],{windowsHide:true,encoding:'utf8',timeout:120000});
  assert.equal(run.status,0,run.stderr||String(run.error));
  return JSON.parse(fs.readFileSync(statusPath,'utf8'));
}
function verifyPairs(plan) {
  for(const job of plan.jobs) {
    const entries=unzip(job.zip);
    assert.equal(entries.size,2);
    for(const ext of ['ai','jpg']) assert.deepEqual(entries.get(job.baseName+'.'+ext),fs.readFileSync(job[ext]));
  }
}
if(process.platform==='win32') {
  const tmp=path.resolve(__dirname,'../tmp');fs.mkdirSync(tmp,{recursive:true});
  const output=fs.mkdtempSync(path.join(tmp,'ctl_zip_test_'));
  const actual=planFor(output,[name,'RUOT 2 catalogue']);
  for(const job of actual.jobs) for(const ext of ['ai','jpg']) fs.writeFileSync(job[ext],Buffer.from((ext+' thử '+job.baseName+'\n').repeat(1000)));
  const status=path.join(output,'status.json');
  const res=runNative(actual,status);
  assert.equal(res.errors.length,0,JSON.stringify(res));assert.equal(res.files.length,2);
  verifyPairs(actual);
  const before=actual.jobs.map(j=>fs.readFileSync(j.zip));
  const collision=runNative(actual,status);
  assert.equal(collision.files.length,0);assert.equal(collision.errors.length,2);
  actual.jobs.forEach((j,i)=>assert.deepEqual(fs.readFileSync(j.zip),before[i]));
  const missing=planFor(output,['RUOT 3 missing JPG']);fs.writeFileSync(missing.jobs[0].ai,'AI intact');
  const bad=runNative(missing,status);assert.equal(bad.errors.length,1);
  assert.equal(fs.readFileSync(missing.jobs[0].ai,'utf8'),'AI intact');assert(!fs.existsSync(missing.jobs[0].zip));
  assert(!fs.readdirSync(output).some(n=>n.startsWith('.ctlzip_')),'no partial ZIP leaks');
  if(process.argv[2]) {
    const native=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
    const res=runNative(native,path.join(native.folder,'zip_status_test.json'));
    assert.equal(res.errors.length,0,JSON.stringify(res));assert.equal(res.files.length,native.jobs.length);
    verifyPairs(native);
    console.log('Native Illustrator AI/JPG pairs compressed and verified byte-for-byte:',native.folder);
  }
}
console.log('CTL ZIP: async CEP lifecycle, hidden launch, large batches, Unicode names, two exact entries, no overwrite and failure preservation passed.');
