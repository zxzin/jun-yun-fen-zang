'use strict';
const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const Allocation = require('../src/allocation.js');
const TTL = 7 * 86400000;
const token = () => randomBytes(32).toString('base64url');
const hash = x => createHash('sha256').update(x).digest('hex');
const same = (a,b) => typeof a==='string' && typeof b==='string' && a.length===b.length && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const validToken = x => typeof x==='string' && /^[A-Za-z0-9_-]{43}$/.test(x);
class RoomError extends Error { constructor(status,message){super(message);this.status=status} }
const fail=(status,message)=>{throw new RoomError(status,message)};
const clean=(s,max)=> typeof s==='string' && s.trim().length>0 && s.trim().length<=max && !/[\u0000-\u001f]/.test(s);
function validateConfig(body){
 const c=body.config,n=c?.count;
 if(!c||!['money','percent','custom'].includes(c.kind)||![0,2].includes(c.precision)||!Number.isInteger(n)||n<2||n>12||!clean(body.topic,40)||!clean(c.label,12)||!clean(c.unit,6)||!Number.isInteger(body.total)||body.total<1||body.total>1000000*10**c.precision||!Array.isArray(body.seats)||body.seats.length!==n||!body.seats.every(s=>clean(s,16)))fail(400,'请检查主题、人数和分配总量。');
 if(c.kind==='percent'&&(body.total!==10000||c.precision!==2)||c.kind==='money'&&c.precision!==2)fail(400,'分配单位不正确。');
 return {kind:c.kind,count:n,precision:c.precision,label:c.label.trim(),unit:c.unit.trim()};
}
function snapshot(r,seat=null,host=false){
 const done=r.players.every(p=>p.ballot);
 let result=null;
 if(done){
  const a=Allocation.settle(r.total,r.players.map(p=>p.ballot));
  // Raw proposals and individual bounds stay private after revealing the final allocation.
  result={amounts:a.amounts,feasible:a.feasible,shortage:a.shortage,surplus:a.surplus};
 }
 const out={id:r.id,topic:r.topic,config:r.config,total:r.total,seats:r.seats,expiresAt:r.expiresAt,seat,host,progress:r.players.map(p=>({claimed:!!p.memberHash,submitted:!!p.ballot,accepted:p.accepted})),result};
 if(seat!==null && done)out.ownWithin=Allocation.settle(r.total,r.players.map(p=>p.ballot)).within[seat];
 return out;
}
function createService(store,{now=Date.now}={}){
 async function read(id){
  if(typeof id!=='string'||!/^[-\w]{22}$/.test(id))fail(404,'邀请不存在或已过期。');
  const record=await store.read('rooms/'+id+'.json');
  if(!record||record.value.expiresAt<=now())fail(410,'邀请已过期，请重新开一局。');
  return record;
 }
 async function edit(id,fn){
  for(let tries=0;tries<8;tries++){
   const item=await read(id),out=fn(item.value);
   if(await store.write('rooms/'+id+'.json',item.value,item.etag))return out;
  }
  fail(409,'大家正在同时操作，请再试一次。');
 }
 function auth(r,credential){
  if(!validToken(credential))fail(403,'请使用自己的邀请或本机记录进入。');
  const digest=hash(credential);
  if(same(r.hostHash,digest))return {host:true,seat:null};
  const seat=r.players.findIndex(p=>same(p.memberHash,digest));
  if(seat<0)fail(403,'请使用自己的邀请或本机记录进入。');
  return {host:false,seat};
 }
 async function quota(){
  const key='limits/create-'+Math.floor(now()/3600000)+'.json';
  for(let i=0;i<8;i++){
   const old=await store.read(key);
   if(old?.value.count>=30)fail(429,'当前新建次数较多，请稍后再试。');
   if(!old){if(await store.create(key,{count:1}))return}
   else if(await store.write(key,{count:old.value.count+1},old.etag))return;
  }
  fail(429,'请稍后再创建。');
 }
 return async function handle(body,credential){
  if(!body||typeof body!=='object')fail(400,'请求无效。');
  if(body.action==='create'){
   const config=validateConfig(body);await quota();
   const id=randomBytes(16).toString('base64url'),host=token(),invites=body.seats.map(()=>token());
   const room={v:1,id,topic:body.topic.trim(),config,total:body.total,seats:body.seats.map(s=>s.trim()),hostHash:hash(host),createdAt:now(),expiresAt:now()+TTL,players:invites.map(t=>({inviteHash:hash(t),memberHash:null,ballot:null,accepted:false}))};
   if(!await store.create('rooms/'+id+'.json',room))fail(503,'创建失败，请重试。');
   return {...snapshot(room,null,true),credential:host,invites};
  }
  if(body.action==='preview'||body.action==='claim'){
   const item=await read(body.room),r=item.value,i=body.seat;
   if(!Number.isInteger(i)||i<0||i>=r.players.length||!validToken(body.invite)||!same(hash(body.invite),r.players[i].inviteHash))fail(403,'邀请无效，请确认收到的是自己的链接。');
   if(body.action==='preview')return {id:r.id,topic:r.topic,seats:r.seats,config:r.config,total:r.total,seat:i,expiresAt:r.expiresAt,claimed:!!r.players[i].memberHash};
   if(!validToken(body.member))fail(400,'当前浏览器无法生成安全凭证。');
   return edit(body.room,room=>{
    const player=room.players[i],digest=hash(body.member);
    if(player.memberHash&&!same(player.memberHash,digest))fail(409,'这个位置已被领取。请用领取时的浏览器继续。');
    if(!same(hash(body.invite),player.inviteHash))fail(403,'邀请无效。');
    player.memberHash=digest;
    return snapshot(room,i);
   });
  }
  if(body.action==='status'){
   const {value:r}=await read(body.room),identity=auth(r,credential);return snapshot(r,identity.seat,identity.host);
  }
  if(body.action==='submit'||body.action==='accept')return edit(body.room,r=>{
   const identity=auth(r,credential);if(identity.host)fail(403,'发起人凭证只能查看进度。请领取自己的位置后填写。');
   const p=r.players[identity.seat];
   if(body.action==='submit'){
    const b=body.ballot;
    if(!b||!Allocation.validRow(r.total,b.shares)||b.shares.length!==r.seats.length||![0,10,20,30].includes(b.tolerance))fail(400,'分配总量或接受范围不正确。');
    const proposal={shares:b.shares.slice(),tolerance:b.tolerance};
    if(p.ballot&&JSON.stringify(p.ballot)!==JSON.stringify(proposal))fail(409,'你的方案已经封存。');
    p.ballot=proposal;
   }else{
    if(!r.players.every(p=>p.ballot))fail(409,'等所有人封存后再确认。');
    if(typeof body.accepted!=='boolean')fail(400,'确认状态无效。');
    p.accepted=body.accepted;
   }
   return snapshot(r,identity.seat);
  });
  fail(400,'请求无效。');
 };
}
module.exports={createService,RoomError};
