const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../src/allocation.js');
const sum=a=>a.reduce((s,x)=>s+x,0);
const report={seed:172913,simulations:0,feasible:0,conflicts:0,byCount:[],cases:[]};
let state=report.seed;const rnd=n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%n};
const independentBounds=(self,t,total)=>[Math.ceil(self*(100-t)/100),Math.min(total,Math.floor(self*(100+t)/100))];
function verify(total,ballots){
 const before=JSON.stringify(ballots),r=A.settle(total,ballots);
 const limits=ballots.map((b,i)=>independentBounds(b.shares[i],b.tolerance,total));
 const feasible=sum(limits.map(x=>x[0]))<=total&&sum(limits.map(x=>x[1]))>=total;
 assert.equal(r.feasible,feasible);assert.equal(sum(r.amounts),total);assert.ok(r.amounts.every(x=>Number.isSafeInteger(x)&&x>=0&&x<=total));
 assert.equal(JSON.stringify(ballots),before);
 if(feasible)assert.ok(r.amounts.every((x,i)=>x>=limits[i][0]&&x<=limits[i][1]));
 else{assert.ok(r.shortage>0||r.surplus>0);assert.ok(r.within.some(x=>!x));}
 return r;
}
function caseRow(name,total,rows,tolerance=20){
 const ballots=rows.map(shares=>({shares,tolerance})),r=verify(total,ballots);
 report.cases.push({name,total,count:rows.length,expected:rows.map((r,i)=>r[i]),ranges:ballots.map((b,i)=>independentBounds(b.shares[i],b.tolerance,total)),amounts:r.amounts,feasible:r.feasible,shortage:r.shortage,surplus:r.surplus,rows});return r;
}
test('3 to 12 players: 10000 independently checked range and budget scenarios',()=>{
 for(let n=3;n<=12;n++){
  let feasible=0,conflicts=0;
  for(let k=0;k<1000;k++){
   const total=[1,7,100,100000,100000000][k%5];
   let target=A.equal(total,n);
   for(let j=0;j<n;j++)target=A.redistribute(total,target,j,rnd(total+1));
   const bs=Array.from({length:n},(_,i)=>{
    const tolerance=[0,10,20,30][rnd(4)];let row=A.equal(total,n);
    for(let j=0;j<n;j++)row=A.redistribute(total,row,j,rnd(total+1));
    // Even trials have a known feasible target; odd trials are unconstrained proposals.
    if(k%2===0)row=A.redistribute(total,row,i,target[i]);
    return {shares:row,tolerance};
   });
   const r=verify(total,bs);if(k%2===0)assert.equal(r.feasible,true);
   if(r.feasible)feasible++;else conflicts++;
  }
  report.byCount.push({players:n,simulations:1000,feasible,conflicts});report.simulations+=1000;report.feasible+=feasible;report.conflicts+=conflicts;
 }
});
test('human-readable payouts cover 3,4,6,8,12 people and incompatible expectations',()=>{
 assert.deepEqual(caseRow('3 人：期望不同，仍落在各自范围',10000,[[5000,3000,2000],[4000,4000,2000],[4000,3000,3000]]).amounts,[4300,3300,2400]);
 for(const n of [4,6,8,12]){
  const total=n*(n+1)/2*1000;
  const rows=Array.from({length:n},(_,i)=>{let row=A.equal(total,n);row=A.redistribute(total,row,i===0?1:0,Math.floor(total*.75));return A.redistribute(total,row,i,(i+1)*1000)});
  caseRow(n+' 人：对他人的分法不同',total,rows,10);
 }
 const over=caseRow('3 人：最低各要 400，预算只有 1000',1000,[[400,300,300],[300,400,300],[300,300,400]],0);assert.equal(over.feasible,false);assert.equal(over.shortage,200);
 const tiny=caseRow('5 人分 3 个整份资源',3,Array.from({length:5},()=>[1,1,1,0,0]),0);assert.deepEqual(tiny.amounts,[1,1,1,0,0]);
 const extreme=caseRow('3 人：一人全拿且所有人认可这个期望',1000,Array.from({length:3},()=>[1000,0,0]),0);assert.deepEqual(extreme.amounts,[1000,0,0]);
 fs.writeFileSync(path.join(__dirname,'v7-allocation-report.json'),JSON.stringify(report,null,2));
 const rows=report.cases.map(c=>`| ${c.name} | ${c.total} | ${c.expected.join(' / ')} | ${c.amounts.join(' / ')} | ${c.feasible?'全部在填写范围内':'无共同可行解，缺 '+c.shortage} |`).join('\n');
 fs.writeFileSync(path.join(__dirname,'v7-allocation-results.md'),`# 分配效果实测\n\n固定随机种子 ${report.seed}，3–12 人各 1000 组，共 ${report.simulations} 组。${report.feasible} 组有共同可接受解，全部满足个人范围与总量；${report.conflicts} 组冲突，全部正确标记。这里的样本是构造测试，不能当作真实用户满意率。\n\n| 情况 | 总量 | 各人自己期望 | 最终结果 | 判定 |\n|---|---:|---|---|---|\n${rows}\n\n算法保证的是可行时落在填写范围；实际满意需要每位参与者确认。金额单位以下表输入为准；整数资源少于人数时，部分人得到 0。\n`);
});
