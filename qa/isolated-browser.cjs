// Render this project's compiled HTML in a fresh, isolated browser context.
// The virtual test origin serves only the supplied application artifact.
const fs=require('node:fs'),path=require('node:path');
const TEST_ORIGIN='https://junyun.test/';
function install(browser,url=TEST_ORIGIN){
 const create=browser.newContext.bind(browser);
 browser.newContext=async options=>{const ctx=await create(options);if(url.startsWith(TEST_ORIGIN))await ctx.route(TEST_ORIGIN+'**',route=>route.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../index.html'),'utf8')}));return ctx};return browser;
}
module.exports={install,TEST_ORIGIN};
