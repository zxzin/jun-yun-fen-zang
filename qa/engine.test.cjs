const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const A=vm.runInNewContext(html.match(/<script id="allocation-core">\s*([\s\S]*?)<\/script>/)[1]+';Allocation;');
const sum=a=>a.reduce((s,x)=>s+x,0),arr=Array.from,b=(shares,tolerance=20)=>({shares,tolerance});
test('quantity precision, maxima and invalid formats',()=>{
 assert.equal(A.parseQuantity('10',0),10);assert.equal(A.parseQuantity('10.25',2),1025);assert.equal(A.parseQuantity('1000000',2),100000000);
 for(const v of ['1.1','-1','NaN','1e3','1000001',''])assert.equal(A.parseQuantity(v,0),null);
 for(const v of ['1.001','Infinity','9007199254740993','1,000'])assert.equal(A.parseQuantity(v,2),null);
});
test('moving one share reallocates peers proportionally; zero peers recover equally',()=>{
 assert.deepEqual(arr(A.redistribute(100,[40,30,30],0,60)),[60,20,20]);
 assert.deepEqual(arr(A.redistribute(100,[100,0,0],0,40)),[40,30,30]);
 assert.deepEqual(arr(A.redistribute(100,[40,20,40],0,10)),[10,30,60]);
 const original=[40,30,30];A.redistribute(100,original,0,0);assert.deepEqual(original,[40,30,30]);
});
test('all participant counts preserve total during 1000 sequential slider changes each',()=>{
 let state=117;const rnd=n=>{state=(state*1664525+1013904223)>>>0;return state%n};
 for(let n=2;n<=12;n++)for(const total of [1,7,100,1000000,100000000]){
  let row=A.equal(total,n);assert.equal(sum(row),total);
  for(let k=0;k<200;k++){const i=rnd(n),next=rnd(total+1);row=A.redistribute(total,row,i,next);assert.equal(row[i],next);assert.ok(A.validRow(total,row));}
 }
});
test('documented 10000 example averages full proposals then respects ranges',()=>{
 const bs=[b([5000,3000,2000]),b([4000,4000,2000]),b([4000,3000,3000])],r=A.settle(10000,bs);
 assert.deepEqual(arr(r.amounts),[4300,3300,2400]);assert.equal(r.feasible,true);assert.deepEqual(arr(r.lower),[4000,3200,2400]);
 const same=[b([40,30,30],0),b([40,30,30],0),b([40,30,30],0)];assert.deepEqual(arr(A.settle(100,same).amounts),[40,30,30]);
});
test('impossible minima and maxima yield labeled reference; original bounds preserved',()=>{
 let r=A.settle(100,[b([60,20,20],10),b([20,60,20],10),b([20,20,60],10)]);assert.equal(r.shortage,62);assert.equal(r.feasible,false);assert.equal(sum(r.amounts),100);
 r=A.settle(100,[b([10,45,45],0),b([45,10,45],0),b([45,45,10],0)]);assert.equal(r.surplus,70);assert.equal(r.lower[0],10);assert.equal(r.upper[0],10);
});
test('incomplete, malformed or unbalanced proposals are rejected',()=>{
 for(const row of [[0,0],[20,40],[-1,101],[.5,99.5]])assert.equal(A.validRow(100,row),false);
 for(const n of [0,1,13])assert.throws(()=>A.settle(100,Array.from({length:n},()=>b(Array(n).fill(1)))));
 assert.throws(()=>A.settle(100,[b([50,50]),b([50,50,0])]));assert.throws(()=>A.redistribute(100,[50,50],0,101));assert.throws(()=>A.settle(100,[b([50,50]),null]));
});
test('400 random problems match independent exhaustive integer optimization',()=>{
 let state=28493;const random=n=>{state=(state*1664525+1013904223)>>>0;return state%n};
 for(let k=0;k<400;k++){
  const n=2+random(3),total=1+random(9),bs=Array.from({length:n},()=>{let row=A.equal(total,n);for(let i=0;i<n;i++)row=A.redistribute(total,row,i,random(total+1));return b(row,random(101))});
  const frozen=JSON.stringify(bs),r=A.settle(total,bs),lo=r.feasible?arr(r.lower):Array(n).fill(0),hi=r.feasible?arr(r.upper):Array(n).fill(total);assert.equal(JSON.stringify(bs),frozen);
  let best=Infinity;function search(i,remaining,cost){if(i===n){if(!remaining)best=Math.min(best,cost);return}for(let x=lo[i];x<=Math.min(hi[i],remaining);x++)search(i+1,remaining-x,cost+(x-r.mean[i])**2)}
  search(0,total,0);assert.ok(Math.abs(best-r.amounts.reduce((s,x,i)=>s+(x-r.mean[i])**2,0))<1e-6);assert.equal(sum(r.amounts),total);
 }
});
