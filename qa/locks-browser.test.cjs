const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {install,TEST_ORIGIN}=require('./isolated-browser.cjs');
const url=process.env.TEST_URL||TEST_ORIGIN,prefix=process.env.TEST_URL?'locks-public':'locks-local';
const report={url,sha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../index.html'))).digest('hex'),checks:[],errors:[],screenshots:[]};
function check(name,pass){assert.ok(pass,name);report.checks.push(name)}
const amounts=p=>p.locator('[data-amount]').evaluateAll(es=>es.map(e=>Math.round(Number(e.value)*100)/100));
const rowIs=async(p,row)=>JSON.stringify(await amounts(p))===JSON.stringify(row);
async function snap(p,name){const file=prefix+'-'+name+'.png';await p.screenshot({path:path.join(__dirname,file),fullPage:true,animations:'disabled'});report.screenshots.push(file)}
async function start(p,n=3,kind='money',total='1000'){
 await p.goto(url);await p.evaluate(()=>localStorage.clear());await p.reload();await p.locator('[data-mode=local]').click();
 if(kind!=='money')await p.locator('[data-kind="'+kind+'"]').click();
 if(kind!=='percent')await p.locator('#prize').fill(total);
 while(Number(await p.locator('#player-count').innerText())!==n)await p.locator(n>Number(await p.locator('#player-count').innerText())?'#count-plus':'#count-minus').click();
 await p.locator('#setup button[type=submit]').click();await p.locator('#next').click();
}
async function enterLock(p,i,value){await p.locator('#amount-'+i).fill(String(value));await p.locator('[data-lock="'+i+'"]').click()}
async function seal(p){await p.locator('#step-next').click();await p.locator('[data-tolerance="0"]').click();await p.locator('#tap-seal').click();await p.locator('#handoff-next').waitFor()}
async function touch(p,ctx,i,dy,cancel=false){
 await p.locator('[data-push="'+i+'"]').scrollIntoViewIfNeeded();const r=await p.locator('[data-push="'+i+'"]').boundingBox(),x=r.x+r.width/2,y=r.y+r.height*.65;
 const cdp=await ctx.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let k=1;k<=6;k++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+dy*k/6}]});
 await p.evaluate(()=>new Promise(requestAnimationFrame));const moving=await amounts(p);
 await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await cdp.detach();return moving;
}
(async()=>{
 const browser=install(await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH}),url);
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(String(e)));
  await start(p);await enterLock(p,0,500);await p.locator('#amount-1').fill('300');
  check('500 locked then 300 yields exact 500/300/200',await rowIs(p,[500,300,200]));
  check('locked amount read-only; slider and nudges disabled',await p.locator('#amount-0').getAttribute('readonly')!==null&&await p.locator('[data-push="0"]').getAttribute('aria-disabled')==='true'&&await p.locator('[data-nudge="0"][data-direction="1"]').isDisabled());
  check('remaining maximum shown to assistive technology',await p.locator('[data-push="1"]').getAttribute('aria-valuemax')==='500');
  check('visible button reports lock state',await p.locator('[data-lock="0"]').innerText()==='已锁定'&&await p.locator('[data-lock="0"]').getAttribute('aria-pressed')==='true');
  await snap(p,'390-locked');
  await p.locator('#amount-1').fill('500.01');await p.locator('#step-next').click();
  check('over remaining maximum blocked without changing locked amount',await p.locator('#amount-1').getAttribute('aria-invalid')==='true'&&await p.locator('#amount-0').inputValue()==='500'&&(await p.locator('#ballot-error').innerText()).includes('先修改'));
  await p.locator('#amount-1').fill('300');await p.locator('[data-nudge="1"][data-direction="1"]').click();check('nudge changes only free shares',await rowIs(p,[500,310,190]));
  await p.locator('#equalize').click();check('equal remainder preserves locked 500',await rowIs(p,[500,250,250]));
  await p.locator('[data-push="1"]').focus();await p.keyboard.press('End');check('keyboard End capped by locked amount',await rowIs(p,[500,500,0]));await p.keyboard.press('Home');check('keyboard Home preserves locked amount',await rowIs(p,[500,0,500]));
  await p.locator('#amount-1').fill('300');const moving=await touch(p,ctx,1,-25);check('real touch moves free money while keeping lock',moving[0]===500&&moving[1]>300&&Math.round(moving.reduce((a,b)=>a+b,0)*100)===100000);
  await p.locator('#amount-1').fill('300');await touch(p,ctx,1,-25,true);check('touch cancel restores original row and lock',await rowIs(p,[500,300,200])&&await p.locator('[data-lock="0"]').getAttribute('aria-pressed')==='true');
  await touch(p,ctx,0,-15);check('locked touch cannot alter amount',await rowIs(p,[500,300,200]));
  await p.locator('[data-lock="1"]').click();check('last free participant gets fixed remainder',await p.locator('#amount-2').getAttribute('readonly')!==null&&await p.locator('[data-push="2"]').getAttribute('aria-valuemin')==='200'&&await p.locator('[data-push="2"]').getAttribute('aria-valuemax')==='200');
  check('last participant state gives actionable unlock hint',(await p.locator('#allocation-hint').innerText()).includes('解锁另一位')&&await p.locator('#equalize').isDisabled());
  await snap(p,'390-remainder');await p.locator('[data-lock="2"]').click();check('all locked still permits sealing',await p.locator('#step-next').isEnabled()&&(await p.locator('#allocation-hint').innerText()).includes('可以封存'));
  await p.locator('#cover').click();check('cover removes lock controls and amounts',await p.locator('[data-lock],[data-amount]').count()===0);await p.locator('#uncover').click();check('cover restore retains locks',await p.locator('[data-lock][aria-pressed=true]').count()===3&&await rowIs(p,[500,300,200]));
  await p.locator('#step-next').click();await p.locator('#back').click();check('back from seal retains locks',await p.locator('[data-lock][aria-pressed=true]').count()===3);
  await p.locator('[data-lock="1"]').click();await p.locator('[data-lock="2"]').click();await p.locator('#amount-1').fill('320');check('unlock resumes editing without changing locked share',await rowIs(p,[500,320,180]));
  await p.locator('#amount-1').fill('300');await p.locator('[data-lock="1"]').click();await seal(p);
  check('local ballot stores only agreed proposal fields',await p.evaluate(()=>{const b=JSON.parse(localStorage.getItem('junyun-v4-local')).ballots[0];return JSON.stringify(b.shares)==='[50000,30000,20000]'&&!('locked' in b)}));
  for(let player=1;player<3;player++){
   await p.locator('#handoff-next').click();check('player '+(player+1)+' begins with no inherited locks',await p.locator('[data-lock][aria-pressed=true]').count()===0);
   await enterLock(p,0,500);await enterLock(p,1,300);await seal(p);
  }
  await p.locator('#handoff-next').click();await p.locator('.result-player').first().waitFor();check('three equal exact proposals settle at 500/300/200',JSON.stringify(await p.locator('.result-amount strong').allTextContents())==='["500","300","200"]');
  for(let i=0;i<3;i++)await p.locator('[data-accept="'+i+'"]').click();check('confirmation flow still completes',(await p.locator('h1').innerText())==='都同意了');await snap(p,'result');
  await p.reload();await p.locator('#resume').click();check('completed result survives reload',await p.locator('.result-player').count()===3);
  for(const [kind,total,target] of [['percent','100',[45.25,34.5,20.25]],['custom','7',[4,2,1]],['money','0.01',[0,0,0.01]]]){
   await start(p,3,kind,total);await enterLock(p,0,target[0]);await enterLock(p,1,target[1]);check(kind+' '+total+' exact allocation with locks',await rowIs(p,target));
  }
  for(const n of [2,6,12]){
   await start(p,n,'custom','101');let remaining=101;const target=[];
   for(let i=0;i<n-1;i++){const x=i+1;target.push(x);remaining-=x;await enterLock(p,i,x)}target.push(remaining);
   check(n+' players construct target in order',await rowIs(p,target));
   for(const width of [320,390,1440]){
    await p.setViewportSize({width,height:width===1440?1000:844});await p.locator('h1').scrollIntoViewIfNeeded();
    check(n+' players fit '+width,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await p.locator('.coin-seat').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)));
    check(n+' players lock targets readable at '+width,await p.locator('[data-lock]').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44&&e.scrollWidth<=e.clientWidth+1)));
    if(n===12||n===2&&width===390)await snap(p,n+'-players-'+width);
   }
  }
  await p.setViewportSize({width:390,height:844});await start(p);await p.emulateMedia({reducedMotion:'no-preference'});await enterLock(p,0,500);await p.waitForTimeout(250);check('normal motion settles lock button',await p.locator('[data-lock="0"]').evaluate(e=>e.getAnimations().every(a=>a.playState==='finished')));await snap(p,'normal-motion');
  const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-reduced-transparency',value:'reduce'}]});
  check('reduced transparency provides solid lock button',await p.locator('[data-lock="0"]').evaluate(e=>getComputedStyle(e).backdropFilter)==='none');
  await p.locator('[data-lock="0"]').click();check('reduced motion lock toggle has no animation',await p.locator('[data-lock="0"]').evaluate(e=>e.getAnimations().length===0));
  check('zero page exceptions',report.errors.length===0);
  fs.writeFileSync(path.join(__dirname,prefix+'-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,screenshots:report.screenshots.length,errors:report.errors}));
 }catch(e){fs.writeFileSync(path.join(__dirname,prefix+'-failure.json'),JSON.stringify({...report,failure:String(e)},null,2));throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
