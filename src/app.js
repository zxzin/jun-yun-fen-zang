(()=>{
  'use strict';
  const $=s=>document.querySelector(s),app=$('#app');
  const ART='__MASCOT_DATA__',STORE='junyun-v4-local';
  const presets={money:{label:'金钱',unit:'元',precision:2,totalText:'1000',symbol:'¥'},percent:{label:'百分比',unit:'%',precision:2,totalText:'100',symbol:'%'},custom:{label:'资源',unit:'份',precision:0,totalText:'100',symbol:'✳'}};
  const colors=['#6553da','#d34c73','#16816e','#af6100','#2867bc','#8d46aa','#397935','#b5433e','#047a8e','#6650a2','#8e6818','#396c8e'];
  const fills=['#b5a4ff','#ffabc6','#7ed9bb','#ffd581','#9ccfff','#dcb0f2','#b0dc86','#ffb3a1','#8fdfe7','#c5b3ef','#e5d184','#abcbdc'];
  const paths={arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',eye:'<path d="m3 3 18 18M10 5a10 10 0 0 1 2 0c5 0 9 7 9 7l-2 3M6 6 3 12s4 7 9 7l4-1"/>',check:'<path d="m5 12 4 4L19 6"/>',box:'<path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',link:'<path d="m10 13 4-4M9 6l2-2a5 5 0 0 1 7 7l-2 2M15 18l-2 2a5 5 0 0 1-7-7l2-2"/>'};
  const icon=(name,size=20)=>'<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.box)+'</svg>';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mascot=(cls='mascot')=>'<img class="'+cls+'" src="'+ART+'" alt="蒙眼歪歪抱着三等份拼图" draggable="false">';
  let config={kind:'money',count:3,...presets.money},total=100000,seats=[],phase='home',ballots=[],draft=null,result=null,accepted=[],timer=null,sealing=false;
  let saved=null,storageOK=true;
  const raw=x=>(x/10**config.precision).toFixed(config.precision).replace(/\.00$/,'');
  const value=x=>(x/10**config.precision).toLocaleString('zh-CN',{maximumFractionDigits:config.precision});
  const quantity=x=>value(x)+(config.unit==='%'?'%':' '+config.unit);
  const pct=x=>+(x/total*100).toFixed(1);
  const announce=s=>$('#announcement').textContent=s;
  function toast(s){$('.toast')?.remove();const t=document.createElement('div');t.className='toast';t.role='status';t.textContent=s;document.body.append(t);setTimeout(()=>t.remove(),3000)}
  function mount(html,keep=false){
    const y=scrollY;app.innerHTML='<div class="screen">'+html+'</div>';document.body.dataset.phase=phase;
    $('#reset-btn').hidden=phase==='home';window.scrollTo(0,keep?y:0);
    const h=$('h1');if(h&&!keep){h.tabIndex=-1;h.focus({preventScroll:true})}
  }
  function persist(){
    try{localStorage.setItem(STORE,JSON.stringify({v:4,config,total,seats,ballots,accepted,finished:phase==='result'}));storageOK=true;}
    catch{storageOK=false;toast('浏览器未允许保存，请保持页面打开。')}
  }
  function loadSaved(){
    try{
      const s=JSON.parse(localStorage.getItem(STORE)||'null');
      if(!s||s.v!==4||!s.config||!presets[s.config.kind]||!Number.isInteger(s.config.count)||s.config.count<2||s.config.count>12||![0,2].includes(s.config.precision)||typeof s.config.label!=='string'||s.config.label.length>12||typeof s.config.unit!=='string'||s.config.unit.length>6||!Number.isInteger(s.total)||s.total<1||s.total>1000000*10**s.config.precision||!Array.isArray(s.seats)||s.seats.length!==s.config.count||!s.seats.every(x=>typeof x==='string'&&x.length<=16)||!Array.isArray(s.ballots)||s.ballots.length>s.seats.length)return null;
      if(s.config.kind==='percent'&&(s.total!==10000||s.config.precision!==2)||s.config.kind==='money'&&s.config.precision!==2)return null;
      if(s.ballots.some(b=>!b||typeof b.name!=='string'||b.name.length>16||!Allocation.validRow(s.total,b.shares)||b.shares.length!==s.seats.length||![0,10,20,30].includes(b.tolerance)))return null;
      s.accepted=Array.from({length:s.seats.length},(_,i)=>s.accepted?.[i]===true);s.seats=Array.from({length:s.config.count},(_,i)=>'玩家 '+(i+1));return s;
    }catch{return null}
  }
  function home(){
    phase='home';saved=loadSaved();
    mount('<div class="home-grid"><section class="hero"><span class="eyebrow">歪歪的秘密分配局</span><h1>小算盘，<br><em>一起打。</em></h1><p>各自分一桌，最后开一盒。</p><div class="hero-art">'+mascot()+'<span class="speech">眼罩焊死了！</span><span class="equal-token" aria-hidden="true">=</span></div><div class="hero-caption"><span>01 一起比着分</span><span>02 拖进盒子藏好</span></div></section><section class="setup-card"><div class="section-title"><span class="step-number">01</span><h2>这局，分什么？</h2></div><form id="setup" novalidate><div class="resource-tabs" role="group" aria-label="选择资源">'+Object.entries(presets).map(([key,p])=>'<button type="button" data-kind="'+key+'" aria-pressed="'+(key===config.kind)+'"><b>'+p.symbol+'</b><span>'+(key==='custom'?'自定义':p.label)+'</span></button>').join('')+'</div>'+(config.kind==='custom'?'<div class="custom-fields"><input id="resource-label" aria-label="资源名称" maxlength="12" placeholder="分什么" value="'+esc(config.label)+'"><input id="resource-unit" aria-label="资源单位" maxlength="6" placeholder="单位" value="'+esc(config.unit)+'"></div><div class="precision-choices">'+[0,2].map(n=>'<button type="button" data-precision="'+n+'" aria-pressed="'+(config.precision===n)+'">'+(n?'精确到 0.01':'按整份分')+'</button>').join('')+'</div>':'')+'<div class="total-card"><label for="prize">'+(config.kind==='percent'?'完整的一份':'放多少到桌上？')+'</label><div class="total-input"><input id="prize" inputmode="'+(config.precision?'decimal':'numeric')+'" maxlength="12" value="'+esc(config.totalText)+'" '+(config.kind==='percent'?'readonly':'')+' aria-describedby="setup-error"><span id="unit-label">'+esc(config.unit)+'</span></div></div><div class="player-counter"><div><label>几个人分？</label><small>2–12 人</small></div><div class="counter"><button type="button" id="count-minus" aria-label="减少人数" '+(config.count===2?'disabled':'')+'>−</button><output id="player-count">'+config.count+'</output><button type="button" id="count-plus" aria-label="增加人数" '+(config.count===12?'disabled':'')+'>＋</button></div></div><p class="error" id="setup-error" role="alert"></p><button type="submit" class="primary wide">'+(saved?'开一局新的':'人齐了，开玩')+icon('arrow')+'</button><p class="micro center">一台手机轮流玩 · 封存后自动存到本机</p></form>'+(saved?'<button type="button" id="resume" class="resume">'+icon('lock')+' 继续上次 · '+saved.ballots.length+'/'+saved.seats.length+' 已封存 '+icon('arrow',16)+'</button>':'')+'</section></div><button type="button" class="share-link" id="share-home">'+icon('link',17)+' 发给朋友 / 保存说明</button>');
    document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{config={...config,kind:b.dataset.kind,...presets[b.dataset.kind]};home()});
    $('#prize').oninput=e=>config.totalText=e.target.value;
    $('#resource-label')?.addEventListener('input',e=>config.label=e.target.value);
    $('#resource-unit')?.addEventListener('input',e=>{config.unit=e.target.value;$('#unit-label').textContent=e.target.value});
    document.querySelectorAll('[data-precision]').forEach(b=>b.onclick=()=>{config.precision=+b.dataset.precision;home()});
    const count=delta=>{config.count=Math.max(2,Math.min(12,config.count+delta));$('#player-count').textContent=config.count;$('#count-minus').disabled=config.count===2;$('#count-plus').disabled=config.count===12};
    $('#count-minus').onclick=()=>count(-1);$('#count-plus').onclick=()=>count(1);
    $('#setup').onsubmit=e=>{
      e.preventDefault();const ticks=Allocation.parseQuantity(config.kind==='percent'?'100':config.totalText,config.precision);
      if(ticks===null||ticks<1){$('#setup-error').textContent=config.precision?'填 0.01–1,000,000，最多两位小数。':'填 1–1,000,000 的整数。';$('#prize').focus();return}
      config.label=config.label.trim()||'资源';config.unit=config.unit.trim()||'份';total=ticks;
      const start=()=>{seats=Array.from({length:config.count},(_,i)=>'玩家 '+(i+1));ballots=[];accepted=seats.map(()=>false);result=null;persist();handoff()};
      if(saved){pendingReset=start;$('#restart-copy').textContent='新一局将替换这台设备上保存的上一局。';$('#restart').showModal()}else start();
    };
    $('#resume')?.addEventListener('click',()=>{({config,total,seats,ballots,accepted}=saved);if(saved.finished&&ballots.length===seats.length){result=Allocation.settle(total,ballots);renderResult()}else handoff()});
    $('#share-home').onclick=()=>$('#sharing').showModal();
  }
  function slots(){return '<div class="slots" aria-label="封存进度">'+seats.map((_,i)=>'<div class="slot '+(i<ballots.length?'done':'')+'"><span>'+String(i+1).padStart(2,'0')+'</span>'+icon(i<ballots.length?'lock':'box',24)+'<small>'+(i<ballots.length?'藏好了':'等你来')+'</small></div>').join('')+'</div>'}
  function handoff(){
    draft=null;phase=ballots.length===seats.length?'ready':'handoff';const ready=phase==='ready';
    mount('<section class="handoff-card"><span class="eyebrow">'+ballots.length+' / '+seats.length+' 份秘密已入盒</span><h1>'+(ready?'到齐了。<br>开盒见！':ballots.length?'藏得严严实实。':'先排个号，<br>再打小算盘。')+'</h1><p>'+(ready?'把大家叫回来，一起看这份建议。':'约定好各自几号，其他人暂时回避。')+'</p><div class="handoff-art">'+mascot()+'<span class="speech">'+(ready?'一碗水，努力端平。':'我真的看不见。')+'</span></div>'+slots()+'<div class="next-turn"><div><small>'+(ready?esc(config.label):'请把手机交给')+'</small><h2>'+(ready?esc(quantity(total)):seats[ballots.length])+'</h2></div><button type="button" id="next" class="primary">'+(ready?'一起开盒':'是我，开始')+icon('arrow')+'</button></div><p class="micro">'+(storageOK?'本机已保存 · 刷新后可继续':'本局暂未保存，请保持页面打开')+'</p></section>');
    $('#next').onclick=()=>ready?reveal():beginTurn();announce(ready?'全员已封存，可以开盒':'轮到'+seats[ballots.length]);
  }
  function beginTurn(){draft={name:'',shares:Allocation.equal(total,seats.length),tolerance:20,step:'allocate',invalid:new Set()};allocationView()}
  function toolbar(step){return '<div class="private-toolbar"><span class="turn-chip"><b>'+String(ballots.length+1).padStart(2,'0')+'</b> '+seats[ballots.length]+' · 私密回合</span><button type="button" id="cover" class="text-button">'+icon('eye',17)+' 遮一下</button></div><div class="step-track"><span class="'+(step===1?'active':'complete')+'">1 比着分</span><i></i><span class="'+(step===2?'active':'')+'">2 拖进盒子</span></div>'}
  function segmentBar(shares,cls='allocation-bar'){return '<div class="'+cls+'" aria-hidden="true">'+shares.map((x,i)=>'<span style="width:'+x/total*100+'%;background:'+fills[i]+'"><b>'+(i+1)+'</b></span>').join('')+'</div>'}
  function allocationView(){
    phase='private';draft.step='allocate';const own=ballots.length;
    mount('<section class="game-card">'+toolbar(1)+'<div class="heading-with-mascot"><div><h1>这一桌，你来分。</h1><p>我想拿多少？也替大家想一想。</p></div>'+mascot('mini-mascot')+'</div><div class="name-row"><span class="seat-avatar" style="--tint:'+fills[own]+'">'+(own+1)+'</span><input id="player-name" maxlength="16" placeholder="你的名字（选填）" aria-label="你的名字" value="'+esc(draft.name)+'" autocomplete="off"></div><div class="table-total"><span>桌上一共 <b>'+esc(quantity(total))+'</b></span><button type="button" id="equalize">重新均分 ↺</button></div>'+segmentBar(draft.shares)+'<p class="drag-teach">↔ 拉一个，其他人的份额会一起调整</p><form id="ballot" novalidate><div class="allocation-list">'+seats.map((name,i)=>'<section class="allocation-row '+(i===own?'own':'')+'" style="--tint:'+fills[i]+';--ink:'+colors[i]+'"><div class="allocation-row-head"><label for="amount-'+i+'"><span class="seat-avatar">'+(i+1)+'</span><b>'+name+'</b>'+(i===own?'<em>我</em>':'')+'</label><div class="row-amount"><input id="amount-'+i+'" data-amount="'+i+'" inputmode="'+(config.precision?'decimal':'numeric')+'" maxlength="12" value="'+raw(draft.shares[i])+'" aria-label="'+name+'分配数量" aria-describedby="ballot-error"><span>'+esc(config.unit)+'</span></div></div><input type="range" id="share-'+i+'" data-share="'+i+'" min="0" max="'+total+'" step="1" value="'+draft.shares[i]+'" aria-label="'+name+'分配滑杆"><div class="row-scale"><span>0</span><output id="percent-'+i+'">'+pct(draft.shares[i])+'%</output><span>'+esc(quantity(total))+'</span></div></section>').join('')+'</div><p class="error" id="ballot-error" role="alert"></p><button class="primary wide" id="step-next" type="submit">分好了，去封存 '+icon('arrow')+'</button></form></section>');
    $('#cover').onclick=cover;$('#player-name').oninput=e=>draft.name=e.target.value;
    document.querySelectorAll('[data-share]').forEach(slider=>{
      let base=null;slider.onpointerdown=()=>base=draft.shares.slice();slider.onpointerup=slider.onpointercancel=()=>base=null;
      slider.oninput=()=>{const i=+slider.dataset.share;draft.shares=Allocation.redistribute(total,base||draft.shares,i,+slider.value);draft.invalid.clear();syncShares()};
    });
    document.querySelectorAll('[data-amount]').forEach(input=>input.oninput=()=>{
      const i=+input.dataset.amount,x=Allocation.parseQuantity(input.value,config.precision);
      if(x===null||x>total){draft.invalid.add(i);input.setAttribute('aria-invalid','true');$('#ballot-error').textContent='每份填 0–'+quantity(total)+(config.precision?'，最多两位小数。':'，使用整数。');return}
      draft.invalid.delete(i);draft.shares=Allocation.redistribute(total,draft.shares,i,x);syncShares(i);
    });
    $('#equalize').onclick=()=>{draft.shares=Allocation.equal(total,seats.length);draft.invalid.clear();syncShares();announce('已重新均分')};
    $('#ballot').onsubmit=e=>{e.preventDefault();if(draft.invalid.size){$('#ballot-error').textContent='先修改标出的数量，再封存。';$('#amount-'+[...draft.invalid][0]).focus();return}sealView()};syncShares();
  }
  function syncShares(editing=-1){
    draft.shares.forEach((x,i)=>{const input=$('#amount-'+i),slider=$('#share-'+i);if(i!==editing&&!draft.invalid.has(i))input.value=raw(x);input.setAttribute('aria-invalid',String(draft.invalid.has(i)));slider.value=x;slider.style.setProperty('--fill',x/total*100+'%');slider.setAttribute('aria-valuetext',quantity(x)+'，占 '+pct(x)+'%');$('#percent-'+i).textContent=pct(x)+'%'});
    $('.allocation-bar').outerHTML=segmentBar(draft.shares);if(!draft.invalid.size)$('#ballot-error').textContent='';
  }
  function sealView(){
    phase='private';draft.step='seal';const own=ballots.length;
    mount('<section class="game-card seal-card">'+toolbar(2)+'<div class="seal-heading"><button type="button" id="back" class="back" aria-label="返回修改分配">←</button><div><h1>把小算盘藏好。</h1><p>拖住整张卡，塞进歪歪的盲盒。</p></div></div><div class="range-control"><div class="range-head"><span>我的接受范围</span><strong id="range-description"></strong></div><div class="segment" role="group" aria-label="可接受浮动"><div class="glass-lens" aria-hidden="true"></div>'+[0,10,20,30].map(t=>'<button type="button" data-tolerance="'+t+'" aria-pressed="'+(t===draft.tolerance)+'">'+(t?'±'+t+'%':'就这些')+'</button>').join('')+'</div><p class="micro">以我的 '+esc(quantity(draft.shares[own]))+' 为中心 · 封存即确认范围</p></div><div class="seal-stage" id="seal-stage" data-state="idle"><div class="seal-stage-caption" id="seal-status" role="status">拖住卡片，往下放 ↓</div><button type="button" id="proposal-card" class="proposal-card" aria-label="秘密分配卡。拖入下方盒子，或按回车封存。"><span class="card-tab"></span><span class="ticket-head">'+icon('eye',17)+' '+(own+1)+' 号的秘密</span><span class="ticket-bars">'+draft.shares.map((x,i)=>'<i style="height:'+Math.max(8,x/total*54)+'px;background:'+fills[i]+'"></i>').join('')+'</span><span class="ticket-bottom">一整桌的分配 <b>↕</b></span></button><div class="drop-halo" id="drop-zone" aria-label="盲盒投入口"><div class="toy-box"><div class="box-slot"></div><div class="box-lid"><i></i></div><div class="box-body"><span class="box-equals">=</span><span class="box-label">YY 的秘密保管箱</span></div><span class="box-lock">'+icon('lock',27)+'</span><span class="sealed-stamp">已封存 ✓</span></div></div>'+mascot('box-keeper')+'<span class="box-speech" id="box-speech">放这里！</span></div><div class="seal-bottom"><button type="button" class="secondary" id="tap-seal">'+icon('box',17)+' 也可以点这里放入</button><span class="micro">封好后交给下一位</span></div><div id="sealed-next" hidden><button type="button" class="primary wide" id="handoff-next">'+(own+1===seats.length?'都藏好了，准备开盒':'藏好了，交给下一位')+icon('arrow')+'</button></div></section>');
    $('#cover').onclick=cover;$('#back').onclick=allocationView;
    document.querySelectorAll('[data-tolerance]').forEach(b=>b.onclick=()=>{draft.tolerance=+b.dataset.tolerance;syncRange()});syncRange();
    $('#tap-seal').onclick=()=>startSealing();$('#handoff-next').onclick=handoff;bindDrag();
  }
  function syncRange(){
    const [lo,hi]=Allocation.bounds(draft.shares[ballots.length],draft.tolerance,total);$('#range-description').textContent=quantity(lo)+' – '+quantity(hi);
    $('.glass-lens').style.transform='translateX('+[0,10,20,30].indexOf(draft.tolerance)*100+'%)';document.querySelectorAll('[data-tolerance]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.tolerance===draft.tolerance)));
  }
  function bindDrag(){
    const card=$('#proposal-card'),stage=$('#seal-stage'),zone=$('#drop-zone');let drag=null,moved=false;
    const inside=(x,y)=>{const r=zone.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom};
    const reset=()=>{drag=null;card.style.transform='';stage.dataset.state='idle';$('#seal-status').textContent='拖住卡片，往下放 ↓';$('#box-speech').textContent='再试一次～'};
    card.addEventListener('pointerdown',e=>{if(sealing||e.button!==0)return;const r=card.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:r.left+r.width/2,cy:r.top+r.height/2};moved=false;card.setPointerCapture(e.pointerId);stage.dataset.state='dragging';$('#seal-status').textContent='对，就是这样！往盒口移';e.preventDefault()});
    card.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;moved=moved||Math.hypot(dx,dy)>5;const hit=inside(drag.cx+dx,drag.cy+dy);card.style.transform='translate('+dx+'px,'+dy+'px) rotate('+Math.max(-9,Math.min(9,dx/10))+'deg) scale(1.04)';stage.dataset.state=hit?'over':'dragging';$('#box-speech').textContent=hit?'松手，我接住！':'往这里～';$('#seal-status').textContent=hit?'松手，封存这份方案':'把整张卡拖进盒口'});
    card.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;const hit=inside(drag.cx+e.clientX-drag.x,drag.cy+e.clientY-drag.y);drag=null;if(hit&&moved)startSealing();else reset()});
    card.addEventListener('pointercancel',()=>{if(!sealing)reset()});card.addEventListener('lostpointercapture',()=>{if(drag&&!sealing)reset()});
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();startSealing()}});
    card.addEventListener('click',e=>{if(e.detail===0&&!sealing)startSealing()});
  }
  function startSealing(){
    if(sealing||phase!=='private'||draft?.step!=='seal')return;
    sealing=true;phase='sealing';document.body.dataset.phase=phase;
    // Commit once at the acceptance boundary; animation never determines data durability.
    ballots.push({name:draft.name.trim()||seats[ballots.length],shares:draft.shares.slice(),tolerance:draft.tolerance});draft=null;persist();
    document.querySelectorAll('.game-card button').forEach(b=>b.disabled=true);$('#reset-btn').disabled=true;
    const stage=$('#seal-stage'),card=$('#proposal-card'),zone=$('#drop-zone'),r=zone.getBoundingClientRect(),s=stage.getBoundingClientRect();
    card.style.setProperty('--sink-y',(r.top-s.top+30-50)+'px');card.style.setProperty('--from-transform',getComputedStyle(card).transform);card.style.transform='';stage.dataset.state='swallow';$('#seal-status').textContent='咻——小算盘收好了！';$('#box-speech').textContent='接住啦！';
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer=setTimeout(()=>{stage.dataset.state='closed';$('#seal-status').textContent='咔哒！秘密锁好了';$('#box-speech').textContent='谁也不许偷看';timer=setTimeout(finishSealing,reduce?0:850)},reduce?0:650);
  }
  function finishSealing(){
    clearTimeout(timer);timer=null;if(!sealing)return;sealing=false;phase='sealed';document.body.dataset.phase=phase;$('#reset-btn').disabled=false;
    const stage=$('#seal-stage');if(!stage){handoff();return}stage.dataset.state='sealed';$('#proposal-card')?.remove();$('.range-control')?.remove();$('#back')?.remove();$('#cover')?.remove();$('.seal-heading h1').textContent='这份秘密，锁住了。';$('.seal-heading p').textContent=storageOK?'你的方案已保存，交接时只显示进度。':'已封存；浏览器未允许保存，请保持页面打开。';$('.seal-bottom').hidden=true;$('#sealed-next').hidden=false;$('#handoff-next').disabled=false;$('#handoff-next').focus({preventScroll:true});$('#seal-status').textContent='封存成功 ✓';announce(storageOK?'方案已封存并保存':'方案已封存，暂未保存到本机');
  }
  function cover(){
    if(phase!=='private')return;phase='covered';mount('<section class="covered-card">'+mascot()+'<h1>嘘，暂时盖住。</h1><p>'+seats[ballots.length]+'，回来再继续。</p><button type="button" class="primary" id="uncover">继续我的回合 '+icon('arrow')+'</button></section>');$('#uncover').onclick=()=>draft.step==='seal'?sealView():allocationView();
  }
  function reveal(){
    if(phase!=='ready')return;phase='opening';$('#next').disabled=true;$('.handoff-card').classList.add('opening');$('#next').textContent='歪歪正在端水…';timer=setTimeout(()=>{result=Allocation.settle(total,ballots);renderResult();persist()},matchMedia('(prefers-reduced-motion: reduce)').matches?0:850);
  }
  function renderResult(keep=false){
    phase='result';const count=accepted.filter(Boolean).length;
    mount('<section class="results"><div class="result-heading"><div><span class="eyebrow">'+seats.length+' 份完整方案 · 每人一票</span><h1>'+(result.feasible?'这一桌，分好了。':'这一桌，还得聊聊。')+'</h1><p>'+(result.feasible?'都在各自填写的范围里，看看合不合心意。':'接受范围有冲突，下面是综合参考。')+'</p></div>'+mascot('result-mascot')+'</div><div class="result-total"><span>'+esc(config.label)+'总量</span><strong>'+esc(quantity(total))+'</strong><span>一份没多，一份没少</span></div>'+(!result.feasible?'<div class="conflict" role="status"><b>'+(result.shortage?'大家的最低期望合计多了 '+esc(quantity(result.shortage)):'大家的最高期望合计还少 '+esc(quantity(result.surplus)))+'</b><p>先商量可接受范围，再决定是否采用。</p></div>':'')+'<div class="result-list">'+ballots.map((b,i)=>'<article class="result-player" style="--tint:'+fills[i]+';--ink:'+colors[i]+'"><div class="result-person"><span class="seat-avatar">'+(i+1)+'</span><div><small>'+seats[i]+'</small><h2>'+esc(b.name)+'</h2></div><span class="result-percent">'+pct(result.amounts[i])+'%</span></div><div class="result-amount"><strong>'+value(result.amounts[i])+'</strong><span>'+esc(config.unit)+'</span></div><div class="result-meter"><i style="width:'+result.amounts[i]/total*100+'%"></i></div>'+(!result.within[i]?'<p class="outside">超出原定范围，需本人确认</p>':'')+'<button type="button" class="accept" data-accept="'+i+'" aria-pressed="'+accepted[i]+'">'+icon(accepted[i]?'check':'eye',16)+(accepted[i]?'这份，我认可':'请本人确认')+'</button></article>').join('')+'</div><div class="consensus">'+icon(count===seats.length?'check':'box')+' '+count+' / '+seats.length+' 现场认可'+(count===seats.length?' · 达成共识':'')+'</div><div class="result-tools"><button type="button" class="primary" id="save">'+icon('download')+' 保存结果</button><button type="button" class="secondary" id="algorithm">怎么算的？</button></div><p class="micro center">认可按钮由大家现场操作 · 提供协商建议</p></section>',keep);
    document.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>{const i=+b.dataset.accept;accepted[i]=!accepted[i];persist();renderResult(true);document.querySelectorAll('[data-accept]')[i].focus({preventScroll:true})});$('#save').onclick=saveResult;$('#algorithm').onclick=()=>$('#rules').showModal();
  }
  function saveResult(){
    const text=['均匀分赃',config.label+'：'+quantity(total),'状态：'+(result.feasible?'各自范围内的综合建议':'接受范围冲突，需协商'),'现场认可：'+accepted.filter(Boolean).length+'/'+seats.length,'',...ballots.map((b,i)=>seats[i]+' · '+b.name+'：'+quantity(result.amounts[i])+'（'+(accepted[i]?'已认可':'待认可')+'）'),'','每人一份完整分配，等权平均，再按接受范围调整。'].join('\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='均匀分赃-分配结果.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('结果文件已生成');
  }
  let pendingReset=null;
  function reset(){clearTimeout(timer);sealing=false;timer=null;try{localStorage.removeItem(STORE)}catch{}saved=null;draft=null;ballots=[];result=null;seats=[];accepted=[];$('#reset-btn').disabled=false;config={kind:'money',count:3,...presets.money};home()}
  $('#rules-btn').onclick=()=>$('#rules').showModal();$('#close-rules').onclick=()=>$('#rules').close();
  $('#reset-btn').onclick=()=>{pendingReset=reset;$('#restart-copy').textContent='本机保存的本局内容会清空。';$('#restart').showModal()};
  $('#cancel-reset').onclick=()=>{$('#restart').close();pendingReset=null};$('#confirm-reset').onclick=()=>{$('#restart').close();const action=pendingReset;pendingReset=null;action?.()};
  $('#close-sharing').onclick=()=>$('#sharing').close();$('#copy-site').onclick=async()=>{try{await navigator.clipboard.writeText('https://zxzin.github.io/jun-yun-fen-zang/');toast('网址已复制；朋友打开会各自开局')}catch{const input=$('#site-url');input.focus();input.select();toast('长按或按 ⌘C 复制网址')}};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(phase==='private')cover();else if(sealing){finishSealing();handoff()}}});
  window.addEventListener('pageshow',e=>{if(e.persisted){clearTimeout(timer);sealing=false;draft=null;$('#reset-btn').disabled=false;home()}});
  $('#brand-avatar').src=ART;$('#favicon').href=ART;$('#touch-icon').href=ART;home();
})();
