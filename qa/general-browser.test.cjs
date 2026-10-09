const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=__dirname,url=process.env.TEST_URL||pathToFileURL(path.join(dir,'../index.html')).href;
const sha256=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(dir,'../index.html'))).digest('hex');
const report={sha256,url,checks:[],errors:[],requests:[],screenshots:[]};
const check=(name,pass)=>{assert.ok(pass,name);report.checks.push(name)};
async function snap(p,name){await p.screenshot({path:path.join(dir,'v3-'+name+'.png'),fullPage:true,animations:'disabled'});report.screenshots.push('v3-'+name+'.png')}
async function fits(p,name){check(name,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check(name+' cards',await p.locator('.payout,.result-card,.guess-card').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)))}
async function start(p,{n=3,kind='points',total='100',label,unit,precision=0}={}){
 await p.goto(url);if(kind!=='points')await p.locator('[data-kind="'+kind+'"]').click();
 if(kind==='custom'){await p.locator('#resource-label').fill(label||'资源');await p.locator('#resource-unit').fill(unit||'份');if(precision)await p.locator('[data-precision="2"]').click()}
 while(Number(await p.locator('#player-count').innerText())!==n)await p.locator(n>Number(await p.locator('#player-count').innerText())?'#count-plus':'#count-minus').click();
 await p.locator('#prize').fill(total);await p.locator('#setup button[type=submit]').click();await p.locator('#next').click();
}
async function first(p,name,expected){await p.locator('#player-name').fill(name);await p.locator('#expected').fill(String(expected));await p.locator('#step-next').click()}
async function guesses(p,own,values){for(let j=0;j<values.length;j++){if(j===own)continue;await p.locator('#guess-amount').fill(String(values[j]));await p.locator('#step-next').click()}}
async function seal(p,tol=10){await p.locator('[data-tolerance="'+tol+'"]').click();await p.locator('#agreed').check();await p.locator('#seal').click()}
async function ballot(p,name,own,expected,values,tol=10){await first(p,name,expected);await guesses(p,own,values);await seal(p,tol)}
async function reveal(p){await p.locator('#next').click();await p.locator('.result-card').first().waitFor()}
const amounts=async p=>(await p.locator('.payout-value').allTextContents()).map(x=>Number(x.replaceAll(',','')));
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
try{
const ctx=await browser.newContext({viewport:{width:390,height:844},offline:url.startsWith('file:'),acceptDownloads:true,reducedMotion:'reduce'});
const p=await ctx.newPage();
p.on('request',r=>{if(!/^(file|data):/.test(r.url()))report.requests.push({url:r.url(),type:r.resourceType(),method:r.method()})});
p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
await p.goto(url);await snap(p,'390-home');await fits(p,'390 home');
check('default resource is generic points',await p.locator('.unit-label').innerText()==='点');
check('embedded artwork loaded',await p.locator('img').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth>0)));
check('mobile start visible',await p.locator('#setup button[type=submit]').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight));
for(let i=0;i<15;i++)await p.locator('#count-plus').evaluate(e=>e.click());check('count stops at 12',await p.locator('#player-count').innerText()==='12');
for(let i=0;i<15;i++)await p.locator('#count-minus').evaluate(e=>e.click());check('count stops at 2',await p.locator('#player-count').innerText()==='2');
await p.locator('#prize').fill('1.5');await p.locator('#setup button[type=submit]').click();check('integer resource rejects fractions',await p.locator('#prize-error').isVisible());
await start(p);await p.locator('#player-name').fill('阿蓝');await p.locator('#expected').fill('101');await p.locator('#step-next').click();check('over-total expectation rejected',await p.locator('#ballot-error').isVisible());
await p.locator('#expected').fill('40');await snap(p,'390-own');await p.locator('#cover').click();check('curtain removes private name',await p.locator('#player-name').count()===0&&!(await p.locator('#app').innerHTML()).includes('阿蓝'));await snap(p,'390-covered');await p.locator('#resume').click();check('draft restored',await p.locator('#expected').inputValue()==='40');
await p.locator('#step-next').click();await p.locator('#guess-amount').fill('30');await snap(p,'390-guess');await fits(p,'390 guess');
await p.locator('#step-next').click();check('next card targets next peer',(await p.locator('.guess-player').innerText()).includes('玩家 3'));await p.locator('#guess-amount').fill('20');
await p.locator('#cover').click();await p.locator('#resume').click();check('curtain preserves guess cursor and value',await p.locator('#guess-amount').inputValue()==='20'&&(await p.locator('.guess-player').innerText()).includes('玩家 3'));
await p.locator('#back-step').click();check('previous guess retained',await p.locator('#guess-amount').inputValue()==='30');
const deck=await p.locator('#guess-deck').boundingBox();await p.mouse.move(deck.x+deck.width-25,deck.y+30);await p.mouse.down();await p.mouse.move(deck.x+30,deck.y+30,{steps:8});await p.mouse.up();check('horizontal swipe advances card',(await p.locator('.guess-player').innerText()).includes('玩家 3'));
await p.locator('#guess-amount').fill('30');await p.locator('#step-next').click();await snap(p,'390-seal');await p.locator('#seal').click();check('range consent required',await p.locator('#ballot-error').isVisible());await p.locator('#agreed').check();await p.locator('[data-tolerance="20"]').click();check('range changes reset consent',!(await p.locator('#agreed').isChecked()));await seal(p,0);
check('sealed data absent from next handoff',!(await p.locator('#app').innerHTML()).includes('阿蓝')&&await p.locator('input').count()===0);await snap(p,'390-handoff');
await p.locator('#next').click();check('next person starts privately',await p.locator('#player-name').inputValue()==='');await ballot(p,'薄荷',1,30,[40,30,30],0);await p.locator('#next').click();await ballot(p,'桃桃',2,30,[40,30,30],0);
check('no results before reveal',await p.locator('.payout').count()===0);await snap(p,'390-ready');await reveal(p);await snap(p,'390-result');
check('exact allocation and generic unit',JSON.stringify(await amounts(p))==='[40,30,30]'&&(await p.locator('.payout').first().innerText()).includes('点'));
check('results emphasize outcomes without raw ballot table',await p.locator('table').count()===0);await fits(p,'390 results');
await p.locator('[data-accept="2"]').scrollIntoViewIfNeeded();const y=await p.evaluate(()=>scrollY);await p.locator('[data-accept="2"]').click();check('accept retains scroll',Math.abs(await p.evaluate(()=>scrollY)-y)<10);
await p.locator('[data-accept="0"]').click();await p.locator('[data-accept="1"]').click();check('all participants accept',(await p.locator('#consensus').innerText()).includes('3 / 3'));await p.locator('[data-accept="1"]').click();check('consent retracts',(await p.locator('#consensus').innerText()).includes('2 / 3'));
const d=p.waitForEvent('download');await p.locator('#save').click();await (await d).saveAs(path.join(dir,'v3-result.txt'));const saved=fs.readFileSync(path.join(dir,'v3-result.txt'),'utf8');check('export contains generic quantity and consent',saved.includes('40 点')&&saved.includes('2 / 3')&&!saved.includes('猜测：'));
if(url.startsWith('file:'))check('no persistence',await p.evaluate(()=>localStorage.length===0&&sessionStorage.length===0));
await p.reload();check('reload clears game',await p.locator('#setup').count()===1);
for(const size of [[320,740],[375,667],[430,932],[1440,1000]]){
 const n=size[0];await p.setViewportSize({width:n,height:size[1]});await p.goto(url);await snap(p,n+'-home');await fits(p,n+' home');await start(p);await p.locator('#player-name').fill('测试');await snap(p,n+'-own');await fits(p,n+' own');await p.locator('#step-next').click();await snap(p,n+'-guess');await fits(p,n+' guess');await guesses(p,0,[40,30,30]);await snap(p,n+'-seal');await fits(p,n+' seal');
}
await p.setViewportSize({width:390,height:844});await start(p,{n:2,kind:'time',total:'120'});await ballot(p,'甲',0,60,[60,60],0);await p.locator('#next').click();await ballot(p,'乙',1,60,[60,60],0);await reveal(p);check('2-player time allocation',JSON.stringify(await amounts(p))==='[60,60]'&&(await p.locator('.payout').first().innerText()).includes('分钟'));await snap(p,'2-time-result');
await start(p,{n:6,kind:'custom',total:'12',label:'值班轮次',unit:'次'});for(let i=0;i<6;i++){await ballot(p,'伙伴'+i,i,2,Array(6).fill(2),0);if(i<5)await p.locator('#next').click()}await reveal(p);check('6-player discrete custom allocation',(await amounts(p)).every(x=>x===2)&&(await p.locator('.result-banner').innerText()).includes('值班轮次'));await snap(p,'6-custom-result');await fits(p,'6-player results');
await start(p,{n:12});for(let i=0;i<12;i++){await ballot(p,'伙伴'+i,i,8,Array(12).fill(8),30);if(i<11)await p.locator('#next').click()}await snap(p,'12-ready');await fits(p,'12-player ready');await reveal(p);check('12-player complete flow conserves total',(await amounts(p)).reduce((a,b)=>a+b,0)===100&&await p.locator('.result-card').count()===12);await snap(p,'12-result');await fits(p,'12-player results');
await p.setViewportSize({width:320,height:740});await start(p,{n:2,kind:'money',total:'1000000'});await ballot(p,'十六个汉字的玩家名字也要完整展示',0,1000000,[1000000,0],0);await p.locator('#next').click();await ballot(p,'乙',1,0,[1000000,0],0);await reveal(p);await fits(p,'maximum money and long names');await snap(p,'max-money-result');
await start(p,{n:2,kind:'custom',total:'0.01',label:'<script>份额',unit:'<b>',precision:2});await ballot(p,'<script>甲',0,.01,[.01,0],0);await p.locator('#next').click();await ballot(p,'乙',1,0,[.01,0],0);await reveal(p);check('hundredth custom resource supported',JSON.stringify(await amounts(p))==='[0.01,0]');check('all user markup escaped',await p.locator('#app script,#app b').count()===0&&(await p.locator('.result-name').first().innerText()).includes('<script>'));
await start(p);for(let i=0;i<3;i++){await ballot(p,'高期待'+i,i,60,[60,60,60],10);if(i<2)await p.locator('#next').click()}await reveal(p);check('conflict clearly reported',(await p.locator('.result-notice').innerText()).includes('62 点')&&(await p.locator('.result-banner').innerText()).includes('参考'));await snap(p,'conflict');
await p.locator('#another').click();await p.locator('#cancel-reset').click();check('cancel reset retains outcome',await p.locator('.result-card').count()===3);await p.locator('#reset-btn').click();await p.locator('#confirm-reset').click();check('reset clears all outcomes',await p.locator('.result-card').count()===0);
await start(p,{n:2});await p.locator('#rules-btn').click();check('rules visible',await p.locator('#rules').isVisible());await p.keyboard.press('Escape');check('rules escape closes',!(await p.locator('#rules').isVisible()));
await first(p,'只提交一次',50);await guesses(p,0,[50,50]);await p.locator('#agreed').check();await p.locator('#seal').evaluate(e=>{e.click();e.click()});check('duplicate seal prevented',(await p.locator('.handoff-main').innerText()).includes('1 / 2'));
await p.locator('#next').click();await p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));check('bfcache restoration clears game',await p.locator('#setup').count()===1);
await start(p);await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});check('background visibility event covers',await p.locator('#resume').count()===1);
check('reduced motion honored',await p.locator('.screen').evaluate(e=>getComputedStyle(e).animationName)==='none');check('no browser errors',report.errors.length===0);
check('no data uploads or external resources',report.requests.every(r=>r.url===url&&r.method==='GET'&&r.type==='document'));
fs.writeFileSync(path.join(dir,'v3-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,screenshots:report.screenshots.length,errors:report.errors,requests:report.requests.length}));
}catch(e){fs.writeFileSync(path.join(dir,'v3-failure.json'),JSON.stringify({...report,failure:String(e)},null,2));throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
