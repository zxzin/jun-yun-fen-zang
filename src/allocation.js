const Allocation=(()=>{
  const sum=a=>a.reduce((s,x)=>s+x,0);
  const clamp=(v,l,u)=>Math.max(l,Math.min(u,v));
  function parseQuantity(value,precision=0){
    if(![0,2].includes(precision))return null;
    const s=String(value).trim();
    if(!(precision===0?/^\d+$/:/^\d+(?:\.\d{1,2})?$/).test(s))return null;
    const [whole,fraction='']=s.split('.');
    const scale=10**precision;
    const valueInTicks=Number(whole)*scale+Number(fraction.padEnd(precision,'0'));
    return Number.isSafeInteger(valueInTicks)&&valueInTicks<=1000000*scale?valueInTicks:null;
  }
  function bounds(expected,tolerance,total){
    return [Math.max(0,Math.ceil(expected*(100-tolerance)/100)),Math.min(total,Math.floor(expected*(100+tolerance)/100))];
  }
  function project(mean,lower,upper,total){
    if(sum(lower)>total||sum(upper)<total)return null;
    let lo=-total*2-1,hi=total*2+1;
    for(let k=0;k<110;k++){
      const shift=(lo+hi)/2;
      if(sum(mean.map((v,i)=>clamp(v+shift,lower[i],upper[i])))<total)lo=shift;else hi=shift;
    }
    const continuous=mean.map((v,i)=>clamp(v+(lo+hi)/2,lower[i],upper[i]));
    const result=continuous.map((v,i)=>clamp(Math.floor(v),lower[i],upper[i]));
    let remainder=total-sum(result);
    while(remainder>0){
      const candidates=result.map((x,i)=>({i,cost:2*(x-mean[i])+1})).filter(v=>result[v.i]<upper[v.i]).sort((a,b)=>Math.abs(a.cost-b.cost)<1e-7?a.i-b.i:a.cost-b.cost);
      if(!candidates.length)throw Error('分配精度校验失败');
      result[candidates[0].i]++;remainder--;
    }
    if(sum(result)!==total||result.some((x,i)=>!Number.isInteger(x)||x<lower[i]||x>upper[i]))throw Error('分配总量校验失败');
    return result;
  }
  function validRow(total,row){
    return Number.isInteger(total)&&total>0&&total<=100000000&&Array.isArray(row)&&row.length>=2&&row.length<=12&&row.every(x=>Number.isInteger(x)&&x>=0&&x<=total)&&sum(row)===total;
  }
  function equal(total,count){
    if(!Number.isInteger(total)||total<1||total>100000000||!Number.isInteger(count)||count<2||count>12)throw Error('无效的总量或人数');
    return Array.from({length:count},(_,i)=>Math.floor(total/count)+(i<total%count?1:0));
  }
  function redistribute(total,row,index,next){
    if(!validRow(total,row)||!Number.isInteger(index)||index<0||index>=row.length||!Number.isInteger(next)||next<0||next>total)throw Error('无效的分配');
    const remaining=total-next,oldRemaining=total-row[index];
    const peers=row.map((x,i)=>({i,exact:oldRemaining?remaining*x/oldRemaining:remaining/(row.length-1)})).filter(x=>x.i!==index);
    const result=row.map(()=>0);result[index]=next;
    peers.forEach(p=>result[p.i]=Math.floor(p.exact));
    peers.sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact))||a.i-b.i);
    let left=total-sum(result);
    for(let k=0;k<left;k++)result[peers[k].i]++;
    return result;
  }
  function settle(total,ballots){
    const n=ballots?.length;
    if(!Number.isInteger(total)||total<1||total>100000000||!Array.isArray(ballots)||n<2||n>12)throw Error('需要完整提交');
    for(const b of ballots){
      if(!b||!Number.isInteger(b.tolerance)||b.tolerance<0||b.tolerance>100||!validRow(total,b.shares)||b.shares.length!==n)throw Error('提交数据校验失败');
    }
    const rows=ballots.map(b=>b.shares);
    const mean=Array.from({length:n},(_,i)=>sum(rows.map(row=>row[i]))/n);
    const limits=ballots.map((b,i)=>bounds(b.shares[i],b.tolerance,total));
    const lower=limits.map(x=>x[0]),upper=limits.map(x=>x[1]);
    const exact=project(mean,lower,upper,total),feasible=exact!==null;
    const amounts=exact||project(mean,Array(n).fill(0),Array(n).fill(total),total);
    return {amounts,mean,feasible,lower,upper,shortage:Math.max(0,sum(lower)-total),surplus:Math.max(0,total-sum(upper)),within:amounts.map((x,i)=>x>=lower[i]&&x<=upper[i])};
  }
  return Object.freeze({parseQuantity,bounds,validRow,equal,redistribute,project,settle});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Allocation;
