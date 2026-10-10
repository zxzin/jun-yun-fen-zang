(()=>{
  'use strict';
  const $=s=>document.querySelector(s),app=$('#app');
  const ART='__MASCOT_DATA__',BLIND_ART='__BLIND_MASCOT_DATA__',STORE='junyun-v4-local';
  const BOX_OPEN='__BOX_OPEN_DATA__',BOX_CLOSED='__BOX_CLOSED_DATA__';
  const boxArt=(className='',open=false)=>'<img class="'+className+'" src="'+(open?BOX_OPEN:BOX_CLOSED)+'" alt="蒙眼歪歪抱着保密盒" draggable="false">';
  const API='https://junyun-rooms.vercel.app/api/rooms',CLOUD_STORE='junyun-cloud-v1';
  let cloud=null,poll=null,mode='cloud',topic='',names=[],interactionCleanup=()=>{};
  const ownIndex=()=>cloud?.seat??ballots.length;
  const isCloud=()=>!!cloud;
  const presets={money:{label:'金钱',unit:'元',precision:2,totalText:'1000',symbol:'¥'},percent:{label:'百分比',unit:'%',precision:2,totalText:'100',symbol:'%'},custom:{label:'资源',unit:'份',precision:0,totalText:'100',symbol:'✳'}};
  const colors=['#6553da','#d34c73','#16816e','#af6100','#2867bc','#8d46aa','#397935','#b5433e','#047a8e','#6650a2','#8e6818','#396c8e'];
  const fills=['#b5a4ff','#ffabc6','#7ed9bb','#ffd581','#9ccfff','#dcb0f2','#b0dc86','#ffb3a1','#8fdfe7','#c5b3ef','#e5d184','#abcbdc'];
  const paths={arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',eye:'<path d="m3 3 18 18M10 5a10 10 0 0 1 2 0c5 0 9 7 9 7l-2 3M6 6 3 12s4 7 9 7l4-1"/>',check:'<path d="m5 12 4 4L19 6"/>',box:'<path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',link:'<path d="m10 13 4-4M9 6l2-2a5 5 0 0 1 7 7l-2 2M15 18l-2 2a5 5 0 0 1-7-7l2-2"/>'};
  const icon=(name,size=20)=>'<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.box)+'</svg>';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mascot=(cls='mascot',blind=false)=>'<img class="'+cls+'" src="'+(blind?BLIND_ART:ART)+'" alt="'+(blind?'蒙眼的圆球歪歪':'圆球歪歪')+'" draggable="false">';
  let config={kind:'money',count:3,...presets.money},total=100000,seats=[],phase='home',ballots=[],draft=null,result=null,accepted=[],timer=null,sealing=false;
  let saved=null,storageOK=true,viewEpoch=0;
  const raw=x=>(x/10**config.precision).toFixed(config.precision).replace(/\.00$/,'');
  const value=x=>(x/10**config.precision).toLocaleString('zh-CN',{maximumFractionDigits:config.precision});
  const quantity=x=>value(x)+(config.unit==='%'?'%':' '+config.unit);
  const pct=x=>+(x/total*100).toFixed(1);
  const announce=s=>$('#announcement').textContent=s;
  function toast(s){$('.toast')?.remove();const t=document.createElement('div');t.className='toast';t.role='status';t.textContent=s;document.body.append(t);setTimeout(()=>t.remove(),3000)}
  function mount(html,keep=false){
    interactionCleanup();interactionCleanup=()=>{};viewEpoch++;const y=scrollY;app.innerHTML='<div class="screen'+(keep?' screen-still':'')+'">'+html+'</div>';document.body.dataset.phase=phase;
    $('#reset-btn').hidden=phase==='home';window.scrollTo(0,keep?y:0);
    const h=$('h1');if(h&&!keep){h.tabIndex=-1;h.focus({preventScroll:true})}
  }
  function persist(){
    if(cloud)return;
    try{localStorage.setItem(STORE,JSON.stringify({v:4,config,total,seats,ballots,accepted,topic,finished:phase==='result'}));storageOK=true;}
    catch{storageOK=false;toast('浏览器未允许保存，请保持页面打开。')}
  }
  function loadSaved(){
    try{
      const s=JSON.parse(localStorage.getItem(STORE)||'null');
      if(!s||s.v!==4||!s.config||!presets[s.config.kind]||!Number.isInteger(s.config.count)||s.config.count<2||s.config.count>12||![0,2].includes(s.config.precision)||typeof s.config.label!=='string'||s.config.label.length>12||typeof s.config.unit!=='string'||s.config.unit.length>6||!Number.isInteger(s.total)||s.total<1||s.total>1000000*10**s.config.precision||!Array.isArray(s.seats)||s.seats.length!==s.config.count||!s.seats.every(x=>typeof x==='string'&&x.length<=16)||!Array.isArray(s.ballots)||s.ballots.length>s.seats.length)return null;
      if(s.config.kind==='percent'&&(s.total!==10000||s.config.precision!==2)||s.config.kind==='money'&&s.config.precision!==2)return null;
      if(s.ballots.some(b=>!b||typeof b.name!=='string'||b.name.length>16||!Allocation.validRow(s.total,b.shares)||b.shares.length!==s.seats.length||![0,10,20,30].includes(b.tolerance)))return null;
      s.accepted=Array.from({length:s.seats.length},(_,i)=>s.accepted?.[i]===true);s.topic=typeof s.topic==='string'?s.topic.slice(0,40):'';return s;
    }catch{return null}
  }
  const calmMotion=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
  const setupNames=()=>Array.from({length:config.count},(_,i)=>`<label><span class="seat-avatar" style="--tint:${fills[i]}">${i+1}</span><input data-name="${i}" maxlength="16" aria-label="玩家 ${i+1}名字" placeholder="玩家 ${i+1}" value="${esc(names[i]||'')}"></label>`).join('');
  const partyDots=()=>Array.from({length:config.count},(_,i)=>`<i style="--tint:${fills[i]}"></i>`).join('');
  const controlLens=(group,index)=>`<span class="control-lens" data-lens="${group}" style="transform:translateX(${index*100}%)" aria-hidden="true"></span>`;
  function home(keep=false,focusSelector=''){
    const previous=new Map(keep?[...document.querySelectorAll('[data-lens]')].map(e=>[e.dataset.lens,new DOMMatrixReadOnly(getComputedStyle(e).transform).m41]):[]);
    stopPoll();cloud=null;phase='home';saved=loadSaved();$('.local').textContent='';$('#reset-btn').textContent='重开';
    mount(`<div class="home-grid"><section class="hero"><h1>小算盘，<br><em>一起打。</em></h1><div class="hero-art">${boxArt("mascot")}</div></section><section class="setup-card"><div class="mode-tabs" role="group" aria-label="参与方式">${controlLens("mode",mode==='local'?1:0)}<button type="button" data-mode="cloud" aria-pressed="${mode==='cloud'}">${icon('link')} 分享邀请</button><button type="button" data-mode="local" aria-pressed="${mode==='local'}">${icon('box')} 本地分</button></div><form id="setup" novalidate><label class="field-label" for="topic">主题</label><input id="topic" maxlength="40" placeholder="例如：周末比赛奖金" value="${esc(topic)}"><h2 class="resource-heading">今天分什么</h2><div class="resource-tabs" role="group" aria-label="选择资源">${controlLens("resource",Object.keys(presets).indexOf(config.kind))}${Object.entries(presets).map(([key,p])=>`<button type="button" data-kind="${key}" aria-pressed="${key===config.kind}"><b>${p.symbol}</b><span>${key==='custom'?'自定义':p.label}</span></button>`).join('')}</div>${config.kind==='custom'?`<div class="custom-fields"><input id="resource-label" aria-label="资源名称" maxlength="12" placeholder="分什么" value="${esc(config.label)}"><input id="resource-unit" aria-label="资源单位" maxlength="6" placeholder="单位" value="${esc(config.unit)}"></div><div class="precision-choices">${[0,2].map(n=>`<button type="button" data-precision="${n}" aria-pressed="${config.precision===n}">${n?'精确到 0.01':'按整份分'}</button>`).join('')}</div>`:''}<div class="total-card"><label for="prize">分多少</label><div class="total-input"><input id="prize" inputmode="${config.precision?'decimal':'numeric'}" maxlength="12" value="${esc(config.totalText)}" ${config.kind==='percent'?'readonly':''} aria-describedby="setup-error"><span id="unit-label">${esc(config.unit)}</span></div></div><div class="player-counter"><div class="party-label"><label for="player-count">人数</label><span class="party-dots" aria-hidden="true">${partyDots()}</span></div><div class="counter"><button type="button" id="count-minus" aria-label="减少人数" ${config.count===2?'disabled':''}>−</button><output id="player-count" aria-live="polite" aria-atomic="true">${config.count}</output><button type="button" id="count-plus" aria-label="增加人数" ${config.count===12?'disabled':''}>＋</button></div></div>${mode==='cloud'?`<div class="setup-names">${setupNames()}</div>`:''}<p class="error" id="setup-error" role="alert"></p><button type="submit" class="primary wide">${mode==='cloud'?'创建邀请':'开始分'} ${icon('arrow')}</button><p class="micro center">${mode==='cloud'?'每人专属邀请 · 全员封存后揭晓':'同一台手机 · 轮流填写'}</p></form>${saved?`<button type="button" id="resume" class="resume">${icon('lock')} 继续本地分 · ${saved.ballots.length}/${saved.seats.length}</button>`:''}<div id="cloud-recents"></div></section></div>`,keep);
    document.querySelectorAll('[data-lens]').forEach(e=>{
      const from=previous.get(e.dataset.lens),to=new DOMMatrixReadOnly(getComputedStyle(e).transform).m41;
      if(from!==undefined&&Math.abs(from-to)>.5&&!calmMotion())e.animate([{transform:`translateX(${from}px) scaleX(.96)`},{transform:`translateX(${to}px) scaleX(1)`}],{duration:360,easing:'cubic-bezier(.2,.85,.25,1)'});
    });
    if(focusSelector)$(focusSelector)?.focus({preventScroll:true});
    document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;home(true,'[data-mode="'+mode+'"]')});
    $('#topic').oninput=e=>topic=e.target.value;
    $('#setup').addEventListener('input',e=>{if(e.target.matches('[data-name]'))names[+e.target.dataset.name]=e.target.value});
    document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{config={...config,kind:b.dataset.kind,...presets[b.dataset.kind]};home(true,'[data-kind="'+config.kind+'"]')});
    $('#prize').oninput=e=>config.totalText=e.target.value;
    $('#resource-label')?.addEventListener('input',e=>config.label=e.target.value);
    $('#resource-unit')?.addEventListener('input',e=>{config.unit=e.target.value;$('#unit-label').textContent=e.target.value});
    document.querySelectorAll('[data-precision]').forEach(b=>b.onclick=()=>{config.precision=+b.dataset.precision;home(true,'[data-precision="'+config.precision+'"]')});
    const count=d=>{
      const next=Math.max(2,Math.min(12,config.count+d));if(next===config.count)return;config.count=next;
      const out=$('#player-count');out.textContent=config.count;out.getAnimations().forEach(a=>a.cancel());
      if(!calmMotion())out.animate([{transform:`translateY(${d*5}px) scale(.85)`,opacity:.55},{transform:'translateY(0) scale(1.08)',opacity:1,offset:.65},{transform:'translateY(0) scale(1)'}],{duration:260,easing:'ease-out'});
      $('#count-minus').disabled=config.count===2;$('#count-plus').disabled=config.count===12;
      $('.party-dots').innerHTML=partyDots();if($('.setup-names'))$('.setup-names').innerHTML=setupNames();
    };$('#count-minus').onclick=()=>count(-1);$('#count-plus').onclick=()=>count(1);
    $('#setup').onsubmit=async e=>{
      e.preventDefault();const ticks=Allocation.parseQuantity(config.kind==='percent'?'100':config.totalText,config.precision);
      if(ticks===null||ticks<1){$('#setup-error').textContent=config.precision?'填 0.01–1,000,000，最多两位小数。':'填 1–1,000,000 的整数。';return}
      config.label=config.label.trim()||'资源';config.unit=config.unit.trim()||'份';total=ticks;topic=topic.trim()||'今天的'+config.label;
      seats=Array.from({length:config.count},(_,i)=>names[i]?.trim()||'玩家 '+(i+1));
      if(mode==='cloud'){await createCloud();return}
      const start=()=>{ballots=[];accepted=seats.map(()=>false);result=null;persist();handoff()};
      if(saved){pendingReset=start;$('#restart-copy').textContent='新一局将替换这台设备上保存的上一局。';$('#restart').showModal()}else start();
    };
    $('#resume')?.addEventListener('click',()=>{({config,total,seats,ballots,accepted}=saved);topic=saved.topic||'';if(saved.finished&&ballots.length===seats.length){result=Allocation.settle(total,ballots);renderResult()}else handoff()});
    showRecents();
  }
  const hasSubmitted=i=>cloud?cloud.progress[i].submitted||(cloud.submitted&&i===cloud.seat):i<ballots.length;
  const submittedCount=()=>seats.filter((_,i)=>hasSubmitted(i)).length;
  function slots(){return '<div class="slots" aria-label="封存进度">'+seats.map((_,i)=>'<span class="slot '+(hasSubmitted(i)?'done':'')+'" style="--tint:'+fills[i]+'" aria-label="玩家 '+(i+1)+(hasSubmitted(i)?'已封存':'待填写')+'">'+(hasSubmitted(i)?icon('check',17):i+1)+'</span>').join('')+'</div>'}
  function handoff(){
    draft=null;phase=ballots.length===seats.length?'ready':'handoff';const ready=phase==='ready';
    mount('<section class="handoff-card"><div class="round-hud"><span>'+esc(topic||config.label)+'</span><b class="eyebrow">'+ballots.length+' / '+seats.length+' 已封存</b></div><h1>'+(ready?'一起揭晓':'轮到'+esc(seats[ballots.length]))+'</h1><div class="handoff-art">'+boxArt('mascot',ready)+'</div>'+slots()+'<div class="next-turn"><button type="button" id="next" class="primary wide">'+(ready?'揭晓分配':'是我，开始分')+icon('arrow')+'</button></div>'+(!storageOK?'<p class="micro">本局暂未保存，请保持页面打开</p>':'')+'</section>');
    $('#next').onclick=()=>ready?reveal():beginTurn();announce(ready?'全员已封存，可以开盒':'轮到'+seats[ballots.length]);
  }
  function beginTurn(){stopPoll();draft={name:cloud?seats[ownIndex()]:'',shares:Allocation.equal(total,seats.length),tolerance:20,step:'allocate',invalid:new Set()};allocationView()}
  function toolbar(editName=false){return '<div class="private-toolbar"><span class="turn-chip">'+(editName&&!cloud?'<input id="player-name" aria-label="你的名字" placeholder="'+esc(seats[ownIndex()])+'" maxlength="16" value="'+esc(draft.name)+'" autocomplete="off">':esc(seats[ownIndex()]))+'<b>'+String(ownIndex()+1)+' / '+seats.length+'</b></span><button type="button" id="cover" class="text-button">'+icon('eye',20)+' 遮住</button></div>'}
  const pushStep=()=>Math.max(1,Math.round(total/100));
  function coinHeights(x){
    const count=x?Math.max(1,Math.ceil(x/total*60)):0,heights=[0,0,0],order=[1,0,2,1,0,2,1,0];
    for(let i=0;i<count;i++)heights[order[i%order.length]]++;
    return heights;
  }
  function syncCoinPile(pile,x){
    const animate=pile.dataset.ready==='true';
    coinHeights(x).forEach((n,i)=>{
      let stack=pile.querySelector('[data-stack="'+i+'"]');
      if(!stack){stack=document.createElement('span');stack.className='coin-stack';stack.dataset.stack=i;stack.style.setProperty('--stack',i);pile.append(stack)}
      stack.style.setProperty('--layers',n);stack.hidden=n===0;
      while(stack.children.length>n)stack.lastElementChild.remove();
      while(stack.children.length<n){const coin=document.createElement('i');coin.className='gold-coin'+(animate?' new-coin':'');coin.style.setProperty('--layer',stack.children.length);coin.innerHTML='<svg viewBox="0 0 64 30" aria-hidden="true" focusable="false"><use href="#coin-model"/></svg>';stack.append(coin)}
    });
    pile.dataset.ready='true';
  }
  function allocationView(){
    phase='private';draft.step='allocate';const own=ownIndex();
    mount(`<section class="game-card coin-game">${toolbar(true)}<div class="play-heading"><h1>上下推金币</h1><button type="button" id="equalize" class="equalize">均分 ↺</button></div><form id="ballot" novalidate><div class="table-scene"><div class="table-total"><span>${esc(topic||config.label)}</span><b>${esc(quantity(total))}</b></div><div class="coin-table" data-count="${seats.length}" data-dense="${seats.length>4}">${seats.map((name,i)=>`<section class="coin-seat ${i===own?'own':''}" data-seat="${i}" style="--tint:${fills[i]};--ink:${colors[i]}"><div class="coin-person"><span class="seat-avatar">${i+1}</span><b>${esc(name)}</b>${i===own?'<em>我</em>':''}</div><div class="row-amount"><input id="amount-${i}" data-amount="${i}" inputmode="${config.precision?'decimal':'numeric'}" maxlength="12" value="${raw(draft.shares[i])}" aria-label="${esc(name)}分配数量，单位${esc(config.unit)}" aria-describedby="ballot-error"></div><div class="push-stage" data-push="${i}" role="slider" tabindex="0" aria-label="${esc(name)}的金币，向上增加，向下减少" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="${raw(total)}" aria-valuenow="${raw(draft.shares[i])}"><span class="push-track" aria-hidden="true"></span><span class="push-fill" aria-hidden="true"></span><span class="push-floor" aria-hidden="true"></span><span class="coin-pile" aria-hidden="true"></span><span class="push-thumb" aria-hidden="true">↕</span></div><div class="lane-controls"><button type="button" data-nudge="${i}" data-direction="-1" aria-label="减少${esc(name)}的份额">−</button><output id="percent-${i}">${pct(draft.shares[i])}%</output><button type="button" data-nudge="${i}" data-direction="1" aria-label="增加${esc(name)}的份额">＋</button></div></section>`).join('')}</div></div><p class="error" id="ballot-error" role="alert"></p><div class="action-dock"><button class="primary wide" id="step-next" type="submit">分好了，去封存 ${icon('arrow',24)}</button></div></form></section>`);
    $('#cover').onclick=cover;$('#player-name')?.addEventListener('input',e=>{draft.name=e.target.value;$('[data-seat="'+own+'"] .coin-person b').textContent=draft.name.trim()||seats[own]});
    document.querySelectorAll('[data-amount]').forEach(input=>input.oninput=()=>{
      const i=+input.dataset.amount,x=Allocation.parseQuantity(input.value,config.precision);
      if(x===null||x>total){draft.invalid.add(i);input.setAttribute('aria-invalid','true');$('#ballot-error').textContent='每份填 0–'+quantity(total)+(config.precision?'，最多两位小数。':'，使用整数。');return}
      draft.invalid.delete(i);draft.shares=Allocation.redistribute(total,draft.shares,i,x);syncShares(i);markPlayed();
    });
    $('#equalize').onclick=()=>{draft.shares=Allocation.equal(total,seats.length);draft.invalid.clear();syncShares();announce('已均分')};
    $('#ballot').onsubmit=e=>{e.preventDefault();if(draft.invalid.size){$('#ballot-error').textContent='先修改标出的数量。';$('#amount-'+[...draft.invalid][0]).focus();return}sealView()};bindPushers();syncShares();
  }
  function markPlayed(){document.querySelector('.coin-game')?.classList.add('has-played')}
  function syncShares(editing=-1){
    draft.shares.forEach((x,i)=>{
      const input=$('#amount-'+i),stage=$('[data-push="'+i+'"]'),pile=stage.querySelector('.coin-pile');
      if(i!==editing&&!draft.invalid.has(i))input.value=raw(x);
      input.setAttribute('aria-invalid',String(draft.invalid.has(i)));input.style.setProperty('--digits',Math.max(4,raw(x).length));
      $('#percent-'+i).textContent=pct(x)+'%';stage.style.setProperty('--share',x/total);
      syncCoinPile(pile,x);
      stage.setAttribute('aria-valuenow',raw(x));stage.setAttribute('aria-valuetext',quantity(x));stage.dataset.empty=String(x===0);
    });
    if(!draft.invalid.size)$('#ballot-error').textContent='';
  }
  function bindPushers(){
    let drag=null,frame=0;
    const render=()=>{cancelAnimationFrame(frame);frame=0;if(draft&&phase==='private')syncShares()};
    const finish=(cancel=false)=>{if(!drag)return;const d=drag;drag=null;if(cancel&&draft)draft.shares=d.base;render();d.stage.closest('.coin-seat').classList.remove('pushing');if(d.stage.hasPointerCapture(d.id))d.stage.releasePointerCapture(d.id);if(!cancel)announce(seats[d.i]+' '+quantity(draft.shares[d.i]))};
    const update=(i,next)=>{if(draft.invalid.size){toast('先修改标出的数量');return}draft.shares=Allocation.redistribute(total,draft.shares,i,Math.max(0,Math.min(total,next)));syncShares();markPlayed()};
    document.querySelectorAll('[data-push]').forEach(stage=>{
      const i=+stage.dataset.push;
      stage.onpointerdown=e=>{if(e.button!==0||e.isPrimary===false||drag)return;if(draft.invalid.size){toast('先修改标出的数量');return}const travel=Math.max(80,stage.clientHeight-52);drag={id:e.pointerId,i,stage,y:e.clientY,start:draft.shares[i],base:draft.shares.slice(),travel};stage.setPointerCapture(e.pointerId);stage.closest('.coin-seat').classList.add('pushing');markPlayed();e.preventDefault()};
      stage.onpointermove=e=>{if(!drag||e.pointerId!==drag.id||phase!=='private')return;const next=Math.max(0,Math.min(total,Math.round(drag.start+(drag.y-e.clientY)/drag.travel*total)));draft.shares=Allocation.redistribute(total,drag.base,i,next);if(!frame)frame=requestAnimationFrame(render)};
      stage.onpointerup=e=>{if(drag?.id===e.pointerId)finish()};
      stage.onpointercancel=stage.onlostpointercapture=()=>finish(true);
      stage.onkeydown=e=>{const direction={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1,PageUp:10,PageDown:-10}[e.key];if(direction||e.key==='Home'||e.key==='End'){e.preventDefault();update(i,e.key==='Home'?0:e.key==='End'?total:draft.shares[i]+direction*pushStep());announce(seats[i]+' '+quantity(draft.shares[i]))}};
    });
    document.querySelectorAll('[data-nudge]').forEach(b=>b.onclick=()=>update(+b.dataset.nudge,draft.shares[+b.dataset.nudge]+Number(b.dataset.direction)*pushStep()));
    interactionCleanup=()=>{cancelAnimationFrame(frame);drag=null;frame=0};
  }
  function sealView(){
    phase='private';draft.step='seal';const own=ownIndex();
    mount('<section class="game-card seal-card">'+toolbar()+'<div class="seal-heading"><button type="button" id="back" class="back" aria-label="返回修改分配">←</button><div><h1>封存方案</h1><p></p></div></div><div class="range-control"><div class="range-head"><span>我能接受</span><strong id="range-description"></strong></div><div class="segment" role="group" aria-label="可接受浮动"><div class="glass-lens" aria-hidden="true"></div>'+[0,10,20,30].map(t=>'<button type="button" data-tolerance="'+t+'" aria-pressed="'+(t===draft.tolerance)+'">'+(t?'±'+t+'%':'就这些')+'</button>').join('')+'</div><p class="range-ideal">我想拿 <b>'+esc(quantity(draft.shares[own]))+'</b></p></div><div class="seal-stage" id="seal-stage" data-state="idle"><div class="seal-stage-caption" id="seal-status" role="status">放进盒子</div><div class="seal-composition"><svg class="ticket-route" viewBox="0 0 360 280" aria-hidden="true"><path d="M65 99 C65 179 129 197 222 197"/><path d="m212 188 12 9-12 9"/></svg><div class="seal-actor">'+boxArt('actor-open',true)+boxArt('actor-closed')+'</div><div class="seal-front" aria-hidden="true">'+boxArt('actor-open',true)+boxArt('actor-closed')+'</div><button type="button" id="proposal-card" class="proposal-card" aria-label="我的方案。拖入盒子，或按回车封存。"><span class="ticket-fold"></span>'+icon('lock',22)+'<b>我的方案</b><span class="ticket-tabs" aria-hidden="true">'+draft.shares.map((x,i)=>'<i style="background:'+fills[i]+'"></i>').join('')+'</span></button><div class="drop-halo" id="drop-zone" aria-label="盲盒投入口"><span class="drop-signal">↓</span></div></div></div><div class="seal-bottom action-dock"><button type="button" class="primary wide" id="tap-seal">'+icon('lock',24)+' 封存我的方案</button></div><div id="sealed-next" hidden><button type="button" class="primary wide" id="handoff-next">'+(cloud?'查看进度':own+1===seats.length?'查看结果':'下一位')+icon('arrow')+'</button></div></section>');
    $('#cover').onclick=cover;$('#back').onclick=allocationView;
    document.querySelectorAll('[data-tolerance]').forEach(b=>b.onclick=()=>{draft.tolerance=+b.dataset.tolerance;syncRange()});syncRange();
    $('#tap-seal').onclick=()=>startSealing();$('#handoff-next').onclick=()=>{if(cloud){loadCloud();return}if(ballots.length===seats.length){phase='ready';reveal()}else beginTurn()};bindDrag();
  }
  function syncRange(){
    const [lo,hi]=Allocation.bounds(draft.shares[ownIndex()],draft.tolerance,total);$('#range-description').textContent=quantity(lo)+' – '+quantity(hi);
    $('.glass-lens').style.transform='translateX('+[0,10,20,30].indexOf(draft.tolerance)*100+'%)';document.querySelectorAll('[data-tolerance]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.tolerance===draft.tolerance)));
  }
  function bindDrag(){
    const card=$('#proposal-card'),stage=$('#seal-stage'),zone=$('#drop-zone');let drag=null,moved=false;
    const inside=(x,y)=>{const r=zone.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom};
    const reset=()=>{drag=null;card.style.transform='';stage.dataset.state='idle';$('#seal-status').textContent='放进盒子'};
    card.addEventListener('pointerdown',e=>{if(sealing||e.button!==0)return;const r=card.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:r.left+r.width/2,cy:r.top+r.height/2};moved=false;card.setPointerCapture(e.pointerId);stage.dataset.state='dragging';$('#seal-status').textContent='拖入盒口';e.preventDefault()});
    card.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;moved=moved||Math.hypot(dx,dy)>5;const hit=inside(drag.cx+dx,drag.cy+dy);card.style.transform='translate('+dx+'px,'+dy+'px) rotate('+Math.max(-9,Math.min(9,dx/10))+'deg) scale(1.04)';stage.dataset.state=hit?'over':'dragging';$('.drop-signal').textContent=hit?'✓':'↓';$('#seal-status').textContent=hit?'松手封存':'拖入盒口'});
    card.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;const hit=inside(drag.cx+e.clientX-drag.x,drag.cy+e.clientY-drag.y);drag=null;if(hit&&moved)startSealing();else reset()});
    card.addEventListener('pointercancel',()=>{if(!sealing)reset()});card.addEventListener('lostpointercapture',()=>{if(drag&&!sealing)reset()});
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();startSealing()}});
    card.addEventListener('click',e=>{if(e.detail===0&&!sealing)startSealing()});
  }
  async function startSealing(){
    if(sealing||phase!=='private'||draft?.step!=='seal')return;
    sealing=true;phase=cloud?'submitting':'sealing';document.body.dataset.phase=phase;document.querySelectorAll('.game-card button').forEach(b=>b.disabled=true);$('#reset-btn').disabled=true;
    // Commit once at the acceptance boundary; animation never determines data durability.
    if(cloud){
      const context=cloud,epoch=viewEpoch;
      try{const committed=await cloudRequest({action:'submit',room:cloud.id,ballot:{shares:draft.shares.slice(),tolerance:draft.tolerance}},context.credential);context.progress=committed.progress;context.submitted=true;saveCloudSession(context);if(viewEpoch!==epoch){sealing=false;$('#reset-btn').disabled=false;return}}
      catch(e){sealing=false;$('#reset-btn').disabled=false;if(viewEpoch!==epoch)return;sealView();if(document.hidden)cover();toast(e.message);return}
    }else{ballots.push({name:draft.name.trim()||seats[ballots.length],shares:draft.shares.slice(),tolerance:draft.tolerance});persist()}
    draft=null;phase='sealing';document.body.dataset.phase=phase;
    document.querySelectorAll('.game-card button').forEach(b=>b.disabled=true);$('#reset-btn').disabled=true;
    const stage=$('#seal-stage'),card=$('#proposal-card'),zone=$('#drop-zone');const cx=card.offsetLeft+card.offsetWidth/2,cy=card.offsetTop+card.offsetHeight/2;
    card.style.setProperty('--sink-x',(zone.offsetLeft+zone.offsetWidth/2-cx)+'px');card.style.setProperty('--sink-y',(zone.offsetTop+zone.offsetHeight/2-cy)+'px');card.style.setProperty('--from-transform',getComputedStyle(card).transform);card.style.transform='';stage.dataset.state='swallow';$('#seal-status').textContent='正在封存…';$('.drop-signal').textContent='✓';
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer=setTimeout(()=>{stage.dataset.state='closed';$('#seal-status').textContent='已封存';$('.drop-signal').textContent='✓';timer=setTimeout(finishSealing,reduce?0:850)},reduce?0:650);
  }
  function finishSealing(){
    clearTimeout(timer);timer=null;if(!sealing)return;sealing=false;phase='sealed';document.body.dataset.phase=phase;$('#reset-btn').disabled=false;
    const stage=$('#seal-stage');if(!stage){if(cloud)loadCloud();else handoff();return}stage.dataset.state='sealed';$('#proposal-card')?.remove();$('.range-control')?.remove();$('#back')?.remove();$('.private-toolbar')?.remove();$('.seal-heading').insertAdjacentHTML('beforebegin','<div class="round-hud"><span>'+esc(topic||config.label)+'</span><b>'+submittedCount()+' / '+seats.length+' 已封存</b></div>');$('.seal-heading h1').textContent=cloud?'已封存':ballots.length===seats.length?'一起揭晓':('轮到'+seats[ballots.length]);$('.seal-heading p').textContent=storageOK?'':'浏览器未允许保存，请保持页面打开。';$('.seal-bottom').hidden=true;$('#sealed-next').hidden=false;$('#handoff-next').disabled=false;$('#handoff-next').innerHTML=(cloud?'查看进度':ballots.length===seats.length?'揭晓分配':'我是'+esc(seats[ballots.length])+'，开始分')+icon('arrow');stage.insertAdjacentHTML('afterend',slots());$('#handoff-next').focus({preventScroll:true});$('#seal-status').textContent='已封存 ✓';announce(storageOK?'方案已封存并保存':'方案已封存，暂未保存到本机');
  }
  function cover(){
    if(phase!=='private')return;phase='covered';mount('<section class="covered-card">'+mascot('mascot',true)+'<h1>嘘，暂时盖住。</h1><p>'+esc(seats[ownIndex()])+'，回来再继续。</p><button type="button" class="primary" id="uncover">继续我的回合 '+icon('arrow')+'</button></section>');$('#uncover').onclick=()=>draft.step==='seal'?sealView():allocationView();
  }
  function reveal(){
    if(phase!=='ready')return;phase='opening';const button=$('#next')||$('#handoff-next');button.disabled=true;($('.handoff-card')||$('.seal-card')).classList.add('opening');button.textContent='正在揭晓…';timer=setTimeout(()=>{result=Allocation.settle(total,ballots);renderResult();persist()},matchMedia('(prefers-reduced-motion: reduce)').matches?0:850);
  }
  function renderResult(keep=false){
    phase='result';const count=accepted.filter(Boolean).length;
    mount('<section class="results"><div class="result-heading"><div><h1>'+(count===seats.length?'都同意了':result.feasible?'分配结果':'还差一点共识')+'</h1><p>'+(count===seats.length?'按这个方案分。':result.feasible?'每个人都在自己填写的范围内':'下面是参考方案，需要大家确认')+'</p></div>'+boxArt('result-mascot',true)+'</div><div class="result-total"><span>'+esc(config.label)+'总量</span><strong>'+esc(quantity(total))+'</strong></div>'+(!result.feasible?'<div class="conflict" role="status"><b>'+(result.shortage?'大家的最低期望合计多了 '+esc(quantity(result.shortage)):'大家的最高期望合计还少 '+esc(quantity(result.surplus)))+'</b><p>先商量可接受范围，再决定是否采用。</p><button type="button" class="primary" id="renegotiate">再分一轮 '+icon('arrow')+'</button></div>':'')+'<div class="result-list">'+ballots.map((b,i)=>'<article class="result-player" style="--tint:'+fills[i]+';--ink:'+colors[i]+'"><div class="result-person"><span class="seat-avatar">'+(i+1)+'</span><div><h2>'+esc(b.name)+'</h2></div><span class="result-percent">'+pct(result.amounts[i])+'%</span></div><div class="result-amount"><strong>'+value(result.amounts[i])+'</strong><span>'+esc(config.unit)+'</span></div><div class="result-meter"><i style="width:'+result.amounts[i]/total*100+'%"></i></div>'+(result.within[i]===false?'<p class="outside">超出原定范围，需本人确认</p>':'')+'<button type="button" class="accept" data-accept="'+i+'" '+(cloud&&cloud.seat!==i?'disabled':'')+' aria-pressed="'+accepted[i]+'">'+icon('check',16)+(accepted[i]?'我同意了':'这个数，可以')+'</button></article>').join('')+'</div><div class="consensus">'+icon(count===seats.length?'check':'box')+' '+count+' / '+seats.length+' 已认可'+(count===seats.length?' · 达成共识':'')+'</div><div class="result-tools"><button type="button" class="primary" id="save">'+icon('download')+' 保存结果</button><button type="button" class="secondary" id="algorithm">怎么算的？</button></div><p class="micro center">每位参与者确认自己的结果</p></section>',keep);
    document.querySelectorAll('[data-accept]').forEach(b=>b.onclick=async()=>{const i=+b.dataset.accept;if(cloud){try{applyCloud(await cloudRequest({action:'accept',room:cloud.id,accepted:!accepted[i]},cloud.credential),true)}catch(e){toast(e.message)}}else{accepted[i]=!accepted[i];persist();renderResult(true);document.querySelectorAll('[data-accept]')[i].focus({preventScroll:true})}});$('#save').onclick=saveResult;$('#algorithm').onclick=()=>$('#rules').showModal();$('#renegotiate')?.addEventListener('click',()=>{if(cloud){names=seats.slice();mode='cloud';home();return}pendingReset=()=>{seats=ballots.map((b,i)=>b.name||seats[i]);ballots=[];accepted=seats.map(()=>false);result=null;draft=null;persist();handoff()};$('#restart-copy').textContent='保留主题、总量和名字，重新填写所有人的方案。本机上一轮方案会被替换。';$('#restart').showModal()});
  }
  function saveResult(){
    const text=['均匀分赃',config.label+'：'+quantity(total),'状态：'+(result.feasible?'各自范围内的综合建议':'接受范围冲突，需协商'),'现场认可：'+accepted.filter(Boolean).length+'/'+seats.length,'',...ballots.map((b,i)=>seats[i]+' · '+b.name+'：'+quantity(result.amounts[i])+'（'+(accepted[i]?'已认可':'待认可')+'）'),'','每人一份完整分配，等权平均，再按接受范围调整。'].join('\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='均匀分赃-分配结果.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('结果文件已生成');
  }
  let pendingReset=null;
  function reset(){stopPoll();if(cloud){cloud=null;history.replaceState(null,'',location.pathname+location.search);home();return}clearTimeout(timer);sealing=false;timer=null;try{localStorage.removeItem(STORE)}catch{}saved=null;draft=null;ballots=[];result=null;seats=[];accepted=[];$('#reset-btn').disabled=false;config={kind:'money',count:3,...presets.money};home()}
  $('#rules-btn').onclick=()=>$('#rules').showModal();$('#close-rules').onclick=()=>$('#rules').close();
  $('#reset-btn').onclick=()=>{if(cloud){reset();return}pendingReset=reset;$('#restart-copy').textContent='本机保存的本局内容会清空。';$('#restart').showModal()};
  $('#cancel-reset').onclick=()=>{$('#restart').close();pendingReset=null};$('#confirm-reset').onclick=()=>{$('#restart').close();const action=pendingReset;pendingReset=null;action?.()};
  function cloudRecords(){try{const a=JSON.parse(localStorage.getItem(CLOUD_STORE)||'[]');return Array.isArray(a)?a.filter(x=>x&&typeof x.id==='string'&&typeof x.credential==='string'&&x.expiresAt>Date.now()).slice(0,10):[]}catch{return []}}
  function saveCloudSession(s){const a=cloudRecords().filter(x=>!(x.id===s.id&&x.seat===s.seat));const record={id:s.id,topic:s.topic,seat:s.seat,credential:s.credential,invites:s.invites,expiresAt:s.expiresAt,pendingInvite:s.pendingInvite};try{localStorage.setItem(CLOUD_STORE,JSON.stringify([record,...a].slice(0,10)))}catch{throw Error('请允许浏览器保存数据，再领取邀请。')}}
  function stopPoll(){clearTimeout(poll);poll=null}
  async function cloudRequest(body,credential){
    let response;try{response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',...(credential?{Authorization:'Bearer '+credential}:{})},body:JSON.stringify(body),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(18000)})}catch{throw Error('连接失败，请检查网络后重试。')}
    let out;try{out=await response.json()}catch{throw Error('云端暂时不可用，请稍后再试。')}
    if(!response.ok)throw Error(out.error||'暂时无法完成，请重试。');return out;
  }
  function showRecents(){
    const records=cloudRecords();$('#cloud-recents').innerHTML=records.map((s,i)=>`<button type="button" class="resume cloud-resume" data-recent="${i}">${icon('link')} ${esc(s.topic)} <small>${s.seat===null?'邀请管理':'我的回合'}</small></button>`).join('');
    document.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>{cloud=records[+b.dataset.recent];loadCloud()});
  }
  async function createCloud(){
    const button=$('#setup button[type=submit]');document.querySelectorAll('#app button,#app input').forEach(e=>e.disabled=true);button.textContent='正在创建…';
    try{
      // Test persistence before creating a room, so access is never silently lost.
      localStorage.setItem('junyun-storage-check','1');localStorage.removeItem('junyun-storage-check');
      const r=await cloudRequest({action:'create',topic,config,total,seats});cloud={...r,seat:null};saveCloudSession(cloud);applyCloud(r);
    }catch(e){$('#setup-error').textContent=e.name==='SecurityError'?'请允许浏览器保存数据，再创建邀请。':e.message;document.querySelectorAll('#app button,#app input').forEach(e=>e.disabled=false);$('#count-minus').disabled=config.count===2;$('#count-plus').disabled=config.count===12;button.innerHTML='创建邀请 '+icon('arrow')}
  }
  function inviteUrl(i){return 'https://zxzin.github.io/jun-yun-fen-zang/#invite='+cloud.id+'.'+i+'.'+cloud.invites[i]}
  function applyCloud(r,keep=false){
    config={...r.config,totalText:String(r.total/10**r.config.precision)};total=r.total;seats=r.seats;topic=r.topic;accepted=r.progress.map(p=>p.accepted);cloud={...cloud,...r};saveCloudSession(cloud);
    $('.local').textContent='分享邀请';$('#reset-btn').textContent='首页';
    if(r.result){result={...r.result,within:seats.map((_,i)=>i===r.seat?r.ownWithin:null)};ballots=seats.map(name=>({name}));renderResult(keep)}else cloudLobby(keep);
    schedulePoll();
  }
  function schedulePoll(){stopPoll();poll=setTimeout(()=>{if(document.hidden){schedulePoll();return}if(cloud&&['lobby','result'].includes(phase))loadCloud(true)},15000)}
  async function loadCloud(quiet=false){
    if(!cloud)return;const id=cloud.id,credential=cloud.credential;
    if(!quiet){phase='loading';mount('<section class="handoff-card"><h1>正在打开…</h1></section>')}
    try{if(cloud.pendingInvite){await cloudRequest({action:'claim',...cloud.pendingInvite,member:credential});delete cloud.pendingInvite;saveCloudSession(cloud)}const r=await cloudRequest({action:'status',room:id},credential);if(cloud?.credential!==credential)return;
      if(quiet&&['private','covered','submitting','sealing','sealed'].includes(phase))return;
      if(quiet&&JSON.stringify(r.progress)===JSON.stringify(cloud.progress)&&!!r.result===!!cloud.result){schedulePoll();return}
      applyCloud(r,quiet);
    }catch(e){if(quiet){toast(e.message);schedulePoll()}else cloudError(e.message,()=>loadCloud())}
  }
  function cloudLobby(keep=false){
    phase='lobby';const done=cloud.progress.filter(p=>p.submitted).length,own=cloud.seat;
    mount(`<section class="cloud-card"><div class="cloud-heading"><div><span class="eyebrow">${own===null?'邀请管理':'分享邀请'}</span><h1>${esc(topic)}</h1><p>${esc(quantity(total))} · ${seats.length} 人</p></div>${boxArt('mini-mascot')}</div><div class="room-progress"><strong>${done}<small> / ${seats.length}</small></strong><span>已封存</span></div><div class="invite-list">${seats.map((name,i)=>`<article class="invite-person"><span class="seat-avatar" style="--tint:${fills[i]}">${i+1}</span><div><b>${esc(name)}</b><small>${cloud.progress[i].submitted?'已封存':cloud.progress[i].claimed?'已领取':'待领取'}</small></div>${own===null&&!cloud.progress[i].claimed&&cloud.invites?`<button type="button" class="secondary" data-invite="${i}">邀请</button><button type="button" class="text-button" data-claim-self="${i}">这是我</button>`:icon(cloud.progress[i].submitted?'lock':'box')}</article>`).join('')}</div>${own!==null&&!cloud.progress[own].submitted?'<button type="button" id="cloud-start" class="primary wide">开始分 '+icon('arrow')+'</button>':''}<p class="micro center">${own===null?'邀请发给对应的人。请保留这个浏览器的记录。':'全员封存后，结果自动出现。'}</p><div class="cloud-tools"><button type="button" id="refresh-cloud" class="text-button">刷新进度</button><button type="button" id="cloud-privacy" class="text-button">私密性</button></div><p class="micro center">有效至 ${new Date(cloud.expiresAt).toLocaleDateString('zh-CN')}</p></section>`,keep);
    $('#cloud-start')?.addEventListener('click',beginTurn);$('#refresh-cloud').onclick=()=>loadCloud(true);$('#cloud-privacy').onclick=()=>$('#privacy').showModal();
    document.querySelectorAll('[data-invite]').forEach(b=>b.onclick=()=>{const i=+b.dataset.invite;$('#invite-title').textContent='邀请 '+seats[i];$('#invite-link').value=inviteUrl(i);$('#invite-copy-status').textContent='';$('#invite-share').showModal()});
    document.querySelectorAll('[data-claim-self]').forEach(b=>b.onclick=()=>openInvite({room:cloud.id,seat:+b.dataset.claimSelf,invite:cloud.invites[+b.dataset.claimSelf]}));
  }
  function cloudError(message,retry){phase='cloud-error';mount(`<section class="covered-card">${boxArt('mini-mascot')}<h1>暂时没连上</h1><p>${esc(message)}</p><button type="button" id="retry-cloud" class="primary">重试</button><button type="button" id="back-home" class="text-button">首页</button></section>`);$('#retry-cloud').onclick=retry;$('#back-home').onclick=()=>{cloud=null;history.replaceState(null,'',location.pathname+location.search);home()}}
  function newSecret(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
  async function openInvite(inv){
    stopPoll();const existing=cloudRecords().find(s=>s.id===inv.room&&s.seat===inv.seat);
    if(existing){cloud=existing;await loadCloud();return}
    phase='loading';mount('<section class="handoff-card"><h1>正在打开邀请…</h1></section>');
    try{
      const r=await cloudRequest({action:'preview',...inv});config=r.config;total=r.total;seats=r.seats;topic=r.topic;phase='invite';$('#reset-btn').textContent='首页';
      mount(`<section class="invite-card"><span class="eyebrow">你收到一份邀请</span><h1>${esc(r.topic)}</h1><p>${esc(quantity(r.total))} · ${r.seats.length} 人</p>${boxArt('invite-mascot')}<div class="claim-name"><span class="seat-avatar" style="--tint:${fills[r.seat]}">${r.seat+1}</span><strong>${esc(r.seats[r.seat])}</strong></div><p class="error" id="claim-error" role="alert">${r.claimed?'这个位置已被领取，请用领取时的浏览器继续。':''}</p><button type="button" id="claim-invite" class="primary wide" ${r.claimed?'disabled':''}>我是 ${esc(r.seats[r.seat])}</button><p class="micro center">领取后仅此浏览器可继续 · 请勿代领</p><button type="button" id="invite-privacy" class="text-button">私密性</button></section>`);
      $('#invite-privacy').onclick=()=>$('#privacy').showModal();
      $('#claim-invite').onclick=async()=>{
        const button=$('#claim-invite');button.disabled=true;let session;
        try{
          session={id:r.id,topic:r.topic,seat:r.seat,credential:newSecret(),expiresAt:r.expiresAt,pendingInvite:inv};saveCloudSession(session);
          const out=await cloudRequest({action:'claim',...inv,member:session.credential});delete session.pendingInvite;cloud=session;history.replaceState(null,'',location.pathname+location.search);applyCloud(out);
        }catch(e){$('#claim-error').textContent=e.message;button.disabled=false;
          // Retain a possible successful claim for retry after a lost network response.
          if(session)button.onclick=()=>{cloud=session;loadCloud()};
        }
      };
    }catch(e){cloudError(e.message,()=>openInvite(inv))}
  }
  function boot(){
    const m=location.hash.match(/^#invite=([\w-]{22})\.(\d{1,2})\.([\w-]{43})$/);
    if(m){openInvite({room:m[1],seat:+m[2],invite:m[3]});return}
    if(location.hash.startsWith('#invite=')){cloudError('邀请链接不完整，请让发起人重新复制。',boot);return}
    home();
  }
  $('#close-privacy').onclick=()=>$('#privacy').close();$('#close-invite-share').onclick=()=>$('#invite-share').close();
  $('#copy-invite').onclick=async()=>{try{await navigator.clipboard.writeText($('#invite-link').value);$('#invite-copy-status').textContent='已复制，发给对应的人即可。'}catch{$('#invite-link').select();$('#invite-copy-status').textContent='长按链接复制。'}};

  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(phase==='private')cover();else if(sealing&&phase==='sealing'){finishSealing();if(cloud)loadCloud();else handoff()}}});
  window.addEventListener('pageshow',e=>{if(e.persisted){clearTimeout(timer);sealing=false;draft=null;$('#reset-btn').disabled=false;boot()}});
  $('#brand-avatar').src=BLIND_ART;$('#favicon').href=BLIND_ART;$('#touch-icon').href=BLIND_ART;boot();
})();
