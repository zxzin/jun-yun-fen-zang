const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const core=html.match(/<script id="allocation-core">\s*([\s\S]*?)<\/script>/)[1];
const A=vm.runInNewContext(core+';Allocation;');
const sum=a=>a.reduce((s,x)=>s+x,0);
const ballot=(expected,n,tolerance=20)=>({expected,tolerance,guesses:Array(n).fill(expected)});
test('quantity parser supports discrete and hundredth units safely',()=>{
 assert.equal(A.parseQuantity('10',0),10);assert.equal(A.parseQuantity('10.25',2),1025);assert.equal(A.parseQuantity('1000000',2),100000000);
 for(const v of ['1.1','-1','NaN','1e3','1000001',''])assert.equal(A.parseQuantity(v,0),null);
 for(const v of ['1.001','Infinity','9007199254740993','1,000'])assert.equal(A.parseQuantity(v,2),null);
});
test('opinions normalize all claims equally and preserve original self expectation',()=>{
 assert.deepEqual(Array.from(A.opinion(100,0,60,[0,30,10])),[60,30,10]);
 assert.deepEqual(Array.from(A.opinion(100,0,60,[0,60,80])),[30,30,40]);
 const b=[ballot(60,3,100),ballot(20,3,100),ballot(20,3,100)];const frozen=JSON.stringify(b);
 const r=A.settle(100,b);assert.equal(sum(r.amounts),100);assert.equal(JSON.stringify(b),frozen);assert.equal(r.upper[0],100);
});
test('unanimous claims, exact integer allocation, zero claims and one-unit cases',()=>{
 const b=[40,30,30].map(expected=>({expected,tolerance:0,guesses:[40,30,30]}));assert.deepEqual(Array.from(A.settle(100,b).amounts),[40,30,30]);
 for(let n=2;n<=12;n++){const r=A.settle(1,Array.from({length:n},()=>ballot(0,n,0)));assert.equal(sum(r.amounts),1);assert.ok(r.amounts.every(Number.isInteger));assert.equal(r.feasible,false)}
});
test('conflicts preserve the original individual bounds and total',()=>{
 let r=A.settle(100,[ballot(60,3,10),ballot(60,3,10),ballot(60,3,10)]);assert.equal(r.shortage,62);assert.equal(r.feasible,false);assert.equal(sum(r.amounts),100);
 r=A.settle(100,[ballot(10,3,0),ballot(10,3,0),ballot(10,3,0)]);assert.equal(r.surplus,70);assert.equal(r.lower[0],10);assert.equal(r.upper[0],10);
});
test('invalid participant count, guesses and self claims are rejected',()=>{
 for(const n of [0,1,13])assert.throws(()=>A.settle(100,Array.from({length:n},()=>ballot(1,n))));
 assert.throws(()=>A.opinion(100,0,101,[10,20]));assert.throws(()=>A.opinion(100,0,10,[10,-1]));assert.throws(()=>A.settle(100,[{expected:10,tolerance:10,guesses:[1]},ballot(20,2)]));
});
test('400 random small problems match independent exhaustive integer optimization',()=>{
 let state=28493;const random=n=>{state=(state*1664525+1013904223)>>>0;return state%n};
 for(let k=0;k<400;k++){
  const n=2+random(3),total=1+random(9),bs=Array.from({length:n},()=>({expected:random(total+1),tolerance:random(101),guesses:Array.from({length:n},()=>random(total+1))}));
  const r=A.settle(total,bs),lo=r.feasible?Array.from(r.lower):Array(n).fill(0),hi=r.feasible?Array.from(r.upper):Array(n).fill(total);
  let best=Infinity;
  function search(i,remaining,cost){if(i===n){if(remaining===0)best=Math.min(best,cost);return}for(let x=lo[i];x<=Math.min(hi[i],remaining);x++)search(i+1,remaining-x,cost+(x-r.mean[i])**2)}
  search(0,total,0);const cost=r.amounts.reduce((s,x,i)=>s+(x-r.mean[i])**2,0);assert.ok(Math.abs(best-cost)<1e-6);assert.equal(sum(r.amounts),total);
 }
});
test('2–12 players and maximum quantities retain totals and feasible bounds',()=>{
 for(let n=2;n<=12;n++)for(const total of [1,7,100,1000000,100000000]){
  const e=Math.round(total/n),bs=Array.from({length:n},(_,i)=>({expected:e,tolerance:30,guesses:Array.from({length:n},(_,j)=>Math.min(total,e+(i+j)%3))})),r=A.settle(total,bs);
  assert.equal(sum(r.amounts),total);assert.ok(r.amounts.every(x=>Number.isInteger(x)&&x>=0));if(r.feasible)assert.ok(r.within.every(Boolean));
 }
});
