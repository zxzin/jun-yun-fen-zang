'use strict';
const {createService,RoomError}=require('../server/rooms.cjs');
const store=require('../server/blob.cjs');
const service=createService(store);
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 const origin=req.headers.origin;
 const allowed=origin==='https://zxzin.github.io';
 if(origin&&!allowed)return res.status(403).json({error:'请从均匀分赃网页打开。'});
 if(allowed){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');}
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return res.status(405).json({error:'请从网页操作。'});
 if(!req.headers['content-type']?.startsWith('application/json'))return res.status(415).json({error:'请求格式无效。'});
 if(!process.env.BLOB_READ_WRITE_TOKEN&&!process.env.BLOB_STORE_ID)return res.status(503).json({error:'云端保存尚未接通，请先使用本地分。'});
 try{
  const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
  if(Buffer.byteLength(raw)>16384)return res.status(413).json({error:'内容过长。'});
  const body=JSON.parse(raw),credential=(req.headers.authorization||'').replace(/^Bearer /,'');
  return res.status(200).json(await service(body,credential));
 }catch(e){return res.status(e instanceof RoomError?e.status:503).json({error:e instanceof RoomError?e.message:'暂时无法保存，请稍后重试。'})}
};
