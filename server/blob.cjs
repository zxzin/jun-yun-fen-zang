'use strict';
const {get,put,BlobPreconditionFailedError}=require('@vercel/blob');
const options={access:'private',addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:0};
module.exports={
 async read(path){const r=await get(path,{access:'private',useCache:false});if(!r)return null;if(r.blob.etag.startsWith('W/'))console.warn('blob-read-weak-etag',JSON.stringify({encoding:r.headers.get('content-encoding'),size:r.blob.size}));return {value:await new Response(r.stream).json(),etag:r.blob.etag}},
 async create(path,value){try{await put(path,JSON.stringify(value),{...options,allowOverwrite:false});return true}catch(e){if(e instanceof BlobPreconditionFailedError||/already exists/i.test(e.message))return false;throw e}},
 async write(path,value,etag){try{await put(path,JSON.stringify(value),{...options,allowOverwrite:true,ifMatch:etag});return true}catch(e){if(e instanceof BlobPreconditionFailedError)return false;throw e}}
};
