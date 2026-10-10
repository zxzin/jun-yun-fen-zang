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
test('locking 500 lets the other two reach 300 and 200 exactly',()=>{
 let row=A.redistribute(100000,[33334,33333,33333],0,50000);
 const locked=[true,false,false];
 assert.deepEqual(arr(A.adjustmentRange(100000,row,1,locked)),[0,50000]);
 row=A.redistribute(100000,row,1,30000,locked);
 assert.deepEqual(arr(row),[50000,30000,20000]);
 assert.throws(()=>A.redistribute(100000,row,0,40000,locked));
 assert.throws(()=>A.redistribute(100000,row,1,50001,locked));
 assert.deepEqual(arr(A.redistribute(100000,row,0,50000,locked)),arr(row));
});
test('rounding, zero peers, last remainder and all locks preserve exact amounts',()=>{
 assert.deepEqual(arr(A.redistribute(11,[5,2,2,2],1,1,[true,false,false,false])),[5,1,3,2]);
 assert.deepEqual(arr(A.redistribute(100,[40,60,0,0],1,20,[true,false,false,false])),[40,20,20,20]);
 const row=[50,30,20],locked=[true,true,false];
 assert.deepEqual(arr(A.adjustmentRange(100,row,2,locked)),[20,20]);
 assert.throws(()=>A.redistribute(100,row,2,10,locked));
 assert.deepEqual(arr(A.equalUnlocked(100,row,locked)),row);
 assert.deepEqual(arr(A.equalUnlocked(100,row,[true,true,true])),row);
 assert.deepEqual(arr(A.equalUnlocked(100,row,[true,false,false])),[50,25,25]);
 assert.deepEqual(arr(A.equalUnlocked(100,row,[false,false,false])),[34,33,33]);
 assert.throws(()=>A.redistribute(100,row,1,30,[true]));
 assert.throws(()=>A.adjustmentRange(100,row,1,[1,0,0]));
 assert.deepEqual(row,[50,30,20]);assert.deepEqual(locked,[true,true,false]);
});
test('2–12 players can construct any sampled valid target by entering then locking each share',()=>{
 let seed=29583;const rnd=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n};
 for(let n=2;n<=12;n++)for(const total of [1,7,100,10000,100000000])for(let run=0;run<25;run++){
  // Independently generate a target partition and a shuffled editing order.
  const cuts=[0,total,...Array.from({length:n-1},()=>rnd(total+1))].sort((a,b)=>a-b);
  const target=cuts.slice(1).map((x,i)=>x-cuts[i]);
  const order=Array.from({length:n},(_,i)=>i);
  for(let k=n-1;k>0;k--){const j=rnd(k+1);[order[k],order[j]]=[order[j],order[k]]}
  let row=A.equal(total,n);const locked=Array(n).fill(false);
  for(const i of order.slice(0,-1)){
   const before=arr(row);row=A.redistribute(total,row,i,target[i],locked);
   assert.ok(A.validRow(total,row));assert.equal(row[i],target[i]);
   locked.forEach((yes,j)=>{if(yes)assert.equal(row[j],before[j])});locked[i]=true;
   const even=A.equalUnlocked(total,row,locked);assert.ok(A.validRow(total,even));
   locked.forEach((yes,j)=>{if(yes)assert.equal(even[j],row[j])});
  }
  assert.deepEqual(arr(row),target);
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
