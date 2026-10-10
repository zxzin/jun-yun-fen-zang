const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 class Conflict extends Error {}
 let value={players:Array.from({length:12},()=>({ballot:{shares:Array(12).fill(100),tolerance:20}}))},revision=1;
 const sdk={BlobPreconditionFailedError:Conflict,
  async get(path,options){assert.equal(options.access,'private');assert.equal(options.useCache,false);const compressed=options.headers?.['Accept-Encoding']!=='identity';return {stream:new Response(JSON.stringify(value)).body,headers:new Headers(compressed?{'content-encoding':'gzip'}:{}),blob:{etag:(compressed?'W/':'')+'"'+revision+'"',size:1500}}},
  async put(path,body,options){if(options.ifMatch!=='"'+revision+'"')throw new Conflict();value=JSON.parse(body);revision++}
 };
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../server/blob.cjs'),'utf8'),{module,require:()=>sdk,Response,console:{warn(){}}});return module.exports;
}
test('larger room reads preserve the strong version tag needed for conditional updates',async()=>{
 const store=fixture(),first=await store.read('rooms/test.json');first.value.players[11].accepted=true;
 assert.equal(await store.write('rooms/test.json',first.value,first.etag),true);
 const next=await store.read('rooms/test.json');assert.equal(next.value.players[11].accepted,true);
 assert.equal(await store.write('rooms/test.json',first.value,first.etag),false,'a genuinely stale version is rejected');
});
