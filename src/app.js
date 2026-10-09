(()=>{
  'use strict';
  const $=s=>document.querySelector(s),app=$('#app');
  const ART={icon:'__ICON_DATA__',mascot:'__MASCOT_DATA__'};
  const presets={
    points:{label:'积分',unit:'点',precision:0,totalText:'100',icon:'coin'},
    money:{label:'奖金',unit:'元',precision:2,totalText:'1000',icon:'wallet'},
    time:{label:'时长',unit:'分钟',precision:0,totalText:'120',icon:'clock'},
    custom:{label:'资源',unit:'份',precision:0,totalText:'100',icon:'grid'}
  };
  const colors=['#7968ee','#e59bbb','#6dc3a4','#edb563','#83b9e8','#b69bd9'];
  const icons={
    lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    eye:'<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M8 5.5A11 11 0 0 1 12 5c5 0 9 7 9 7a20 20 0 0 1-3 3.5M6 6.5A20 20 0 0 0 3 12s4 7 9 7a11 11 0 0 0 4-.5"/>',
    box:'<path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7 5l10 4"/>',
    users:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    coin:'<circle cx="12" cy="12" r="9"/><path d="M8 10h8M8 14h8"/>',
    wallet:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 8V5a2 2 0 0 1 2-2h12v3M21 11h-6v5h6M17 13.5h.1"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M14 17.5h7M17.5 14v7"/>'
  };
  const icon=(name,size=20)=>'<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.box)+'</svg>';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mascot=(cls='mascot',alt='蒙眼歪歪抱着三份等量金币')=>'<img class="'+cls+'" src="'+ART.mascot+'" alt="'+alt+'" draggable="false">';
  let config={kind:'points',count:3,...presets.points},total=100,seats=[],phase='home',ballots=[],draft=null,result=null,accepted=[],opening=false,timer=null;
  const value=ticks=>(ticks/10**config.precision).toLocaleString('zh-CN',{minimumFractionDigits:ticks%(10**config.precision)?config.precision:0,maximumFractionDigits:config.precision});
  const raw=ticks=>(ticks/10**config.precision).toFixed(config.precision).replace(/\.00$/,'');
  const quantity=ticks=>value(ticks)+' '+config.unit;
  const color=i=>colors[i%colors.length];
  function announce(message){$('#announcement').textContent=message}
  function mount(html,keep=false){
    const y=scrollY;document.body.dataset.phase=phase;app.innerHTML='<div class="screen">'+html+'</div>';$('#reset-btn').hidden=phase==='home';
    window.scrollTo(0,keep?y:0);const h=app.querySelector('h1');if(h&&!keep){h.tabIndex=-1;h.focus({preventScroll:true})}
  }
  function home(){
    phase='home';
    mount('<div class="home-grid"><section class="panel hero"><div><h1>想拿多少？<br>先藏好。</h1><p class="hero-intro">各自出牌，一起揭晓。</p></div><div class="hero-art">'+mascot()+'<span class="speech">我蒙好了，你们分。</span></div><div class="hero-foot">'+icon('eye',16)+'<b>盲填 · 猜心 · 开盒</b></div></section><form class="panel start-panel" id="setup" novalidate><div class="setup-head"><h2>这局，分什么？</h2><div class="resource-tabs" role="group" aria-label="选择资源">'+Object.entries(presets).map(([key,p])=>'<button type="button" data-kind="'+key+'" aria-pressed="'+(key===config.kind)+'">'+icon(p.icon,21)+'<span>'+(key==='custom'?'自定义':p.label)+'</span></button>').join('')+'</div></div>'+(config.kind==='custom'?'<div class="custom-fields"><input id="resource-label" maxlength="12" value="'+esc(config.label)+'" aria-label="资源名称" placeholder="分什么"><input id="resource-unit" maxlength="6" value="'+esc(config.unit)+'" aria-label="资源单位" placeholder="单位"><div class="precision-choices" role="group" aria-label="分配精度"><button type="button" data-precision="0" aria-pressed="'+(config.precision===0)+'">整份</button><button type="button" data-precision="2" aria-pressed="'+(config.precision===2)+'">可带小数</button></div></div>':'')+'<div class="money-card"><label class="label" for="prize">一共多少</label><div class="money-field"><input id="prize" type="text" inputmode="'+(config.precision?'decimal':'numeric')+'" maxlength="12" value="'+esc(config.totalText)+'" autocomplete="off" aria-describedby="prize-error"><span class="unit-label">'+esc(config.unit)+'</span></div><p id="prize-error" class="error" role="alert"></p></div><div class="player-counter"><div><span class="label">几个人分？</span><span class="small muted">2–12 人 · 同一台设备</span></div><div class="counter"><button type="button" id="count-minus" aria-label="减少人数" '+(config.count===2?'disabled':'')+'>−</button><output id="player-count" aria-live="polite">'+config.count+'</output><button type="button" id="count-plus" aria-label="增加人数" '+(config.count===12?'disabled':'')+'>＋</button></div></div><div class="start-bottom"><button class="primary wide" type="submit">开一局 '+icon('arrow')+'</button><p class="small">各自盲填，最后只看分配结果</p></div></form></div><div class="mini-steps"><span><b>1</b>我想拿多少</span>'+icon('arrow',16)+'<span><b>2</b>猜猜 TA 想要</span>'+icon('arrow',16)+'<span><b>3</b>封好，一起开</span></div>');
    document.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{config={...config,kind:b.dataset.kind,...presets[b.dataset.kind]};home()}));
    $('#prize').addEventListener('input',e=>{config.totalText=e.target.value;$('#prize-error').textContent=''});
    $('#resource-label')?.addEventListener('input',e=>config.label=e.target.value);
    $('#resource-unit')?.addEventListener('input',e=>{config.unit=e.target.value;$('.unit-label').textContent=e.target.value});
    document.querySelectorAll('[data-precision]').forEach(b=>b.addEventListener('click',()=>{config.precision=Number(b.dataset.precision);home()}));
    const setCount=delta=>{config.count=Math.max(2,Math.min(12,config.count+delta));$('#player-count').textContent=config.count;$('#count-minus').disabled=config.count===2;$('#count-plus').disabled=config.count===12};
    $('#count-minus').addEventListener('click',()=>setCount(-1));$('#count-plus').addEventListener('click',()=>setCount(1));
    $('#setup').addEventListener('submit',e=>{
      e.preventDefault();const ticks=Allocation.parseQuantity(config.totalText,config.precision);
      if(ticks===null||ticks<1){$('#prize-error').textContent=config.precision?'填入 0.01–1,000,000，最多两位小数。':'填入 1–1,000,000 的整数。';$('#prize').focus();return}
      config.label=config.label.trim()||'资源';config.unit=config.unit.trim()||'份';total=ticks;seats=Array.from({length:config.count},(_,i)=>'玩家 '+(i+1));accepted=Array(config.count).fill(false);handoff();
    });
  }
  function slots(){
    return '<div class="vault-slots count-'+seats.length+'" aria-label="封存进度">'+seats.map((n,i)=>'<div class="vault-slot '+(i<ballots.length?'done':'')+'" style="--order:'+i+'"><div class="row"><b>'+String(i+1).padStart(2,'0')+'</b>'+icon(i<ballots.length?'lock':'box',18)+'</div><span>'+(i<ballots.length?'已封存':'待填写')+'</span></div>').join('')+'</div>';
  }
  function handoff(){
    phase=ballots.length===seats.length?'ready':'handoff';draft=null;const ready=phase==='ready';
    mount('<div class="handoff '+(ready?'reveal':'')+'"><section class="panel handoff-main"><span class="badge">'+icon('lock',15)+' '+ballots.length+' / '+seats.length+' 已封存</span><h1>'+(ready?'都到齐了，开盒吧。':ballots.length?'这一份，藏好了。':'歪歪就位，开始盲填。')+'</h1><p>'+(ready?'把大家叫回来，一起看结果。':'请其他人暂时回避，轮流拿设备。')+'</p><div class="guard-art">'+mascot()+'<span class="speech">'+(ready?'都有份，别挤～':'放心，我不偷看。')+'</span></div>'+slots()+'</section><section class="panel handoff-next"><h2>'+(ready?esc(config.label)+' · '+esc(quantity(total)):seats[ballots.length]+'，轮到你啦')+'</h2><button type="button" class="primary wide" id="next">'+(ready?'一起开盒':'这是我的回合')+' '+icon('arrow')+'</button></section></div>');
    $('#next').addEventListener('click',()=>{if(ready)reveal();else beginTurn()});announce(ready?'所有人已完成，可以一起开盒':'轮到'+seats[ballots.length]);
  }
  function beginTurn(){
    const expected=Math.round(total/seats.length);
    draft={name:'',expected,expectedText:raw(expected),guesses:seats.map(()=>expected),guessText:seats.map(()=>raw(expected)),tolerance:10,step:0,cursor:0,agreed:false};
    privateForm();
  }
  function privateForm(){
    phase='private';const i=ballots.length,s=draft.step,peers=seats.map((_,j)=>j).filter(j=>j!==i),peer=peers[draft.cursor];
    const titles=['我的这一份。','猜猜 TA 的小算盘。','这个范围，可以吗？'];
    const sideTitles=['想要多少，<br>大胆说。','换位想一想，<br>TA 会怎么选？','留点余地，<br>更容易合拍。'];
    let body='';
    if(s===0){
      body='<input id="player-name" type="text" maxlength="16" placeholder="你的名字（选填）" aria-label="你的名字" value="'+esc(draft.name)+'" autocomplete="off" spellcheck="false"><div class="expect"><div class="row"><label for="expected" class="label" style="margin:0">我希望拿到</label><span id="own-percent" class="small muted"></span></div><div class="amount-input"><input id="expected" type="text" inputmode="'+(config.precision?'decimal':'numeric')+'" maxlength="12" value="'+esc(draft.expectedText)+'" autocomplete="off" aria-describedby="ballot-error"><span>'+esc(config.unit)+'</span></div><input id="own-range" type="range" min="0" max="'+total+'" step="1" value="'+(draft.expected??0)+'" aria-label="我的期望数量"><div class="scale"><span>0</span><span>'+esc(quantity(total))+'</span></div></div><div class="quick-adjust"><button type="button" id="own-less">少一点</button><button type="button" id="own-even">先均分</button><button type="button" id="own-more">多一点</button></div>';
    }else if(s===1){
      body='<div class="guess-deck" id="guess-deck"><div class="guess-card" style="--card-color:'+color(peer)+'"><div class="guess-player"><span class="seat-number">'+String(peer+1).padStart(2,'0')+'</span><span>'+seats[peer]+'</span>'+mascot('guess-mascot','')+'</div><label for="guess-amount" class="small">你猜 TA 想拿</label><div class="amount-input"><input id="guess-amount" type="text" inputmode="'+(config.precision?'decimal':'numeric')+'" maxlength="12" value="'+esc(draft.guessText[peer])+'" autocomplete="off" aria-describedby="ballot-error"><span>'+esc(config.unit)+'</span></div><input id="guess-range" type="range" min="0" max="'+total+'" step="1" value="'+(draft.guesses[peer]??0)+'" aria-label="猜测'+seats[peer]+'的期望数量"><div class="scale"><span>0</span><span>'+esc(quantity(total))+'</span></div></div></div><div class="guess-pagination"><span>'+String(draft.cursor+1).padStart(2,'0')+' / '+String(peers.length).padStart(2,'0')+'</span><div class="guess-dots">'+peers.map((_,j)=>'<i class="'+(j===draft.cursor?'active':'')+'"></i>').join('')+'</div><span>可左右滑动</span></div><p class="step-hint">按你的直觉猜，彼此的答案保密。</p>';
    }else{
      body='<div class="range-card"><div class="row"><span class="small">我的期待</span><strong class="num">'+esc(quantity(draft.expected))+'</strong></div><div class="segment" role="group" aria-label="可接受浮动"><div class="glass-lens" aria-hidden="true"></div>'+[0,10,20,30].map(t=>'<button type="button" data-tolerance="'+t+'" aria-pressed="'+(draft.tolerance===t)+'">'+(t===0?'就这些':'± '+t+'%')+'</button>').join('')+'</div><p class="range-note num" id="range-description"></p><div class="tolerance-visual" aria-hidden="true"><div id="range-width"></div><i></i></div><p class="small">范围越宽，可调整的空间越大。</p></div><div class="seal-message">'+mascot('seal-mascot','')+'<div><strong>你的小算盘已装好。</strong><span>'+peers.length+' 位队友的猜测也在盒子里。</span></div>'+icon('lock',22)+'</div><label class="agree"><input type="checkbox" id="agreed" '+(draft.agreed?'checked':'')+'><span>这个范围，我可以接受。</span></label>';
    }
    const action=s===2?icon('lock',18)+' 封存我的盲盒':s===1?(draft.cursor===peers.length-1?'猜好了':'下一张')+' '+icon('arrow'):'去猜猜队友 '+icon('arrow');
    mount('<div class="game-layout"><aside class="panel companion"><span class="badge">'+icon('eye',15)+' 歪歪已蒙眼</span>'+mascot()+'<h2>'+sideTitles[s]+'</h2><div class="table-info"><span>'+esc(config.label)+'</span><strong>'+esc(quantity(total))+'</strong></div></aside><form id="ballot" class="panel turn-card" autocomplete="off" novalidate><div class="private-toolbar"><div class="turn-chip"><b>'+String(i+1).padStart(2,'0')+'</b>'+seats[i]+'的秘密回合</div><button type="button" class="privacy-button" id="cover" aria-label="遮住屏幕">'+icon('eye',17)+'<span>遮一下</span></button></div><div class="step-track" aria-label="第 '+(s+1)+' 步，共 3 步">'+['我想要','猜队友','封盲盒'].map((n,k)=>'<div class="step-item '+(k===s?'current':k<s?'done':'')+'" '+(k===s?'aria-current="step"':'')+'><i>'+(k<s?'✓':k+1)+'</i>'+n+'</div>').join('')+'</div><div class="step-title"><div><h1>'+titles[s]+'</h1></div>'+mascot('mini-host','')+'</div><div class="step-content">'+body+'<p id="ballot-error" role="alert" class="error"></p></div><div class="actions">'+(s>0?'<button type="button" class="secondary back" id="back-step" aria-label="上一张">'+icon('arrow')+'</button>':'')+'<button type="submit" class="primary" id="'+(s===2?'seal':'step-next')+'">'+action+'</button></div></form></div>');
    $('#player-name')?.addEventListener('input',e=>draft.name=e.target.value);
    const parse=v=>{const x=Allocation.parseQuantity(v,config.precision);return x!==null&&x<=total?x:null};
    $('#expected')?.addEventListener('input',e=>{draft.expectedText=e.target.value;draft.expected=parse(e.target.value);draft.agreed=false;updateForm()});
    const changeExpected=x=>{draft.expected=Math.max(0,Math.min(total,x));draft.expectedText=raw(draft.expected);$('#expected').value=draft.expectedText;draft.agreed=false;updateForm()};
    $('#own-range')?.addEventListener('input',e=>changeExpected(Number(e.target.value)));
    $('#own-even')?.addEventListener('click',()=>changeExpected(Math.round(total/seats.length)));
    $('#own-less')?.addEventListener('click',()=>changeExpected((draft.expected??0)-Math.max(1,Math.round(total*.05))));
    $('#own-more')?.addEventListener('click',()=>changeExpected((draft.expected??0)+Math.max(1,Math.round(total*.05))));
    $('#guess-amount')?.addEventListener('input',e=>{draft.guessText[peer]=e.target.value;draft.guesses[peer]=parse(e.target.value);updateForm()});
    $('#guess-range')?.addEventListener('input',e=>{draft.guesses[peer]=Number(e.target.value);draft.guessText[peer]=raw(draft.guesses[peer]);$('#guess-amount').value=draft.guessText[peer];updateForm()});
    document.querySelectorAll('[data-tolerance]').forEach(b=>b.addEventListener('click',()=>{draft.tolerance=Number(b.dataset.tolerance);draft.agreed=false;$('#agreed').checked=false;updateForm()}));
    $('#agreed')?.addEventListener('change',e=>{draft.agreed=e.target.checked;$('#ballot-error').textContent=''});
    $('#back-step')?.addEventListener('click',previousCard);
    $('#cover').addEventListener('click',cover);
    $('#ballot').addEventListener('submit',e=>{e.preventDefault();advanceCard()});
    const deck=$('#guess-deck');if(deck){
      let pointer=null;
      deck.addEventListener('pointerdown',e=>{if(e.target.closest('input,button'))return;pointer={x:e.clientX,y:e.clientY}});
      deck.addEventListener('pointerup',e=>{if(!pointer)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.6){if(dx<0)advanceCard();else previousCard()}});
      deck.addEventListener('pointercancel',()=>pointer=null);
    }
    updateForm();
  }
  function updateForm(){
    $('#ballot-error').textContent='';
    if(draft.step===0){
      $('#own-percent').textContent=draft.expected===null?'待填写':(draft.expected/total*100).toFixed(0)+'%';
      if(draft.expected!==null){$('#own-range').value=draft.expected;$('#own-range').setAttribute('aria-valuetext',quantity(draft.expected))}
    }else if(draft.step===1){
      const peers=seats.map((_,j)=>j).filter(j=>j!==ballots.length),v=draft.guesses[peers[draft.cursor]];
      if(v!==null){$('#guess-range').value=v;$('#guess-range').setAttribute('aria-valuetext',quantity(v))}
    }else{
      document.querySelectorAll('[data-tolerance]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.tolerance)===draft.tolerance)));
      $('.glass-lens').style.transform='translateX('+[0,10,20,30].indexOf(draft.tolerance)*100+'%)';
      const range=Allocation.bounds(draft.expected,draft.tolerance,total);
      $('#range-description').textContent=value(range[0])+' – '+value(range[1])+' '+config.unit;
      $('#range-width').style.width=(draft.tolerance*2+3)+'%';
    }
  }
  function advanceCard(){
    if(phase!=='private')return;
    const fail=(text,selector)=>{$('#ballot-error').textContent=text;$(selector).focus()};
    if(draft.step===0){
      if(draft.expected===null)return fail('填入 0 到 '+quantity(total)+(config.precision?'，最多两位小数。':'的整数。'),'#expected');
      draft.step=1;draft.cursor=0;
    }else if(draft.step===1){
      const peers=seats.map((_,j)=>j).filter(j=>j!==ballots.length);
      if(draft.guesses[peers[draft.cursor]]===null)return fail('猜测应在 0 到 '+quantity(total)+'之间。','#guess-amount');
      if(draft.cursor<peers.length-1)draft.cursor++;else draft.step=2;
    }else{
      if(!draft.agreed)return fail('确认这个范围，再封盒。','#agreed');
      ballots.push({name:draft.name.trim()||seats[ballots.length],expected:draft.expected,guesses:draft.guesses.slice(),tolerance:draft.tolerance});draft=null;handoff();return;
    }
    privateForm();
  }
  function previousCard(){
    if(phase!=='private'||draft.step===0)return;
    if(draft.step===1&&draft.cursor>0){draft.cursor--}else{draft.step--;if(draft.step===1)draft.cursor=seats.length-2}privateForm();
  }
  function cover(){
    if(phase!=='private')return;phase='covered';
    mount('<section class="panel curtain">'+mascot()+'<h1>帮你盖好了。</h1><p>'+seats[ballots.length]+'的回合，回来继续。</p><button type="button" class="primary wide" id="resume">继续我的回合 '+icon('arrow')+'</button></section>');
    $('#resume').addEventListener('click',privateForm);
  }
  function reveal(){
    if(opening||ballots.length!==seats.length||phase!=='ready')return;
    opening=true;
    try{result=Allocation.settle(total,ballots)}catch{opening=false;toast('计算未完成，请重新开局。');return}
    $('#next').disabled=true;$('#next').textContent='开盒中…';$('.handoff').classList.add('opening');
    timer=setTimeout(()=>{opening=false;renderResult()},matchMedia('(prefers-reduced-motion: reduce)').matches?0:900);
  }
  function renderResult(keep=false){
    phase='result';const count=accepted.filter(Boolean).length,all=count===seats.length;
    const note=result.feasible?'所有结果都在各自接受的范围内。':result.shortage?'大家的最低期待合计超出 '+quantity(result.shortage)+'。以下供协商。':'大家的最高期待合计还剩 '+quantity(result.surplus)+' 未覆盖。以下供协商。';
    mount('<div class="result-banner"><div><span class="badge">'+icon('box',16)+' '+(all?'全员认可':result.feasible?'已开盒':'参考方案')+'</span><h1>'+(all?'这次，谈妥了。':result.feasible?'分好啦，各有所获。':'还差一点共识。')+'</h1><p>'+esc(config.label)+' · '+esc(quantity(total))+' · '+seats.length+' 人</p></div>'+mascot('result-host','')+'</div><p class="result-notice '+(result.feasible?'':'conflict')+'">'+esc(note)+'</p><div class="result-grid">'+ballots.map((b,i)=>'<article class="panel result-card" style="--order:'+i+';--seat-color:'+color(i)+'"><div class="person"><div class="avatar-tile">'+String(i+1).padStart(2,'0')+'</div><div class="person-text"><span class="player-label">'+seats[i]+'</span><h2 class="result-name">'+esc(b.name)+'</h2></div></div><div class="payout num '+(value(result.amounts[i]).length>7?'long-value':'')+'"><span class="payout-value">'+value(result.amounts[i])+'</span><small>'+esc(config.unit)+'</small></div><div class="share-line"><div style="width:'+(result.amounts[i]/total*100)+'%"></div></div><div class="result-share"><span>'+(result.amounts[i]/total*100).toFixed(1)+'%</span><span>'+(!result.feasible&&!result.within[i]?'超出原定范围':'')+'</span></div><button type="button" class="accept" data-accept="'+i+'" aria-pressed="'+accepted[i]+'">'+icon(accepted[i]?'check':'users',17)+(accepted[i]?'我已认可':'这份，我认可')+'</button></article>').join('')+'</div><div class="consensus" id="consensus">'+icon(all?'check':'users',20)+'<span>'+count+' / '+seats.length+' 已认可'+(all?' · 本局达成共识':'')+'</span></div><div class="result-tools"><button type="button" class="primary" id="save">'+icon('download',18)+' 保存结果</button><button type="button" class="secondary" id="another">再开一局</button></div>',keep);
    document.querySelectorAll('[data-accept]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.accept);accepted[i]=!accepted[i];renderResult(true);document.querySelectorAll('[data-accept]')[i].focus({preventScroll:true});announce(accepted.filter(Boolean).length+' 人已认可')}));
    $('#save').addEventListener('click',saveResult);$('#another').addEventListener('click',()=>$('#restart').showModal());
  }
  function saveResult(){
    if(phase!=='result')return;
    const text=['均匀分赃',config.label+'：'+quantity(total),'参与人数：'+seats.length,'状态：'+(result.feasible?'各自范围内的综合建议':'参考方案，原定范围有冲突'),'现场认可：'+accepted.filter(Boolean).length+' / '+seats.length,'',...ballots.map((b,i)=>seats[i]+' · '+b.name+'：'+quantity(result.amounts[i])+'（'+(accepted[i]?'已认可':'待认可')+'）'),'','结果由每个人的期望与猜测等权综合，供共同确认。'].join('\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='均匀分赃-本局结果.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('结果已生成');
  }
  function toast(message){document.querySelector('.toast')?.remove();const t=document.createElement('div');t.className='toast';t.role='status';t.textContent=message;document.body.append(t);setTimeout(()=>t.remove(),2400)}
  function reset(){clearTimeout(timer);timer=null;phase='home';total=100;seats=[];ballots=[];draft=null;result=null;accepted=[];opening=false;config={kind:'points',count:3,...presets.points};home();announce('已清空，开始新一局')}
  $('#rules-btn').addEventListener('click',()=>$('#rules').showModal());$('#close-rules').addEventListener('click',()=>$('#rules').close());
  $('#reset-btn').addEventListener('click',()=>$('#restart').showModal());$('#cancel-reset').addEventListener('click',()=>$('#restart').close());$('#confirm-reset').addEventListener('click',()=>{$('#restart').close();reset()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='private')cover()});
  window.addEventListener('pageshow',e=>{if(e.persisted)reset()});
  $('#brand-avatar').src=ART.icon;$('#favicon').href=ART.icon;$('#touch-icon').href=ART.icon;home();
})();
