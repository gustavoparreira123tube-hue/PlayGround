(() => {
  'use strict';
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const mini = document.getElementById('minimap');
  const mctx = mini.getContext('2d');
  const WORLD = 3000, TILE = 60;
  const COLORS = ['#dfb38b', '#9bc3b2', '#c4a0d4', '#df8c7e'];
  const itemMeta = {
    wood: ['🪵','Wood'], stone: ['🪨','Stone'], berries: ['🫐','Wild berries'], water: ['💧','Fresh water'],
    fiber: ['🌿','Plant fiber'], hide: ['🐾','Wolf pelt'], campfire: ['🔥','Campfire'], bandage: ['🩹','Bandage'],
    cooked: ['🍲','Trail stew']
  };
  const recipes = [
    {id:'campfire', icon:'🔥', name:'Campfire', desc:'5 wood · 3 stone', cost:{wood:5,stone:3}},
    {id:'bandage', icon:'🩹', name:'Field bandage', desc:'2 fiber · 1 wild berry', cost:{fiber:2,berries:1}},
    {id:'cooked', icon:'🍲', name:'Trail stew', desc:'3 berries · 1 wood', cost:{berries:3,wood:1}}
  ];
  const state = {
    started:false, paused:true, name:'Wanderer', trail:COLORS[0], player:{x:WORLD/2,y:WORLD/2,faceX:0,faceY:1,hp:100,water:100,food:100,xp:0,level:1},
    inv:{wood:0,stone:0,berries:0,water:0,fiber:0,hide:0,campfire:0,bandage:0,cooked:0},
    keys:{}, entities:[], particles:[], day:1, time:0, last:0, selected:0, companion:false, sound:true, toastTimer:0, attackCooldown:0
  };
  const rand = (seed) => { let t=seed+0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; };
  let seed=18721;
  function random(){ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }
  function loadSaved(){
    try { const s=JSON.parse(localStorage.getItem('eternal-world-save')); if(!s)return;
      if(s.player)Object.assign(state.player,s.player); if(s.inv)Object.assign(state.inv,s.inv); if(s.day)state.day=s.day;
      state.name=s.name||state.name; state.trail=s.trail||state.trail;
    } catch(e) { /* Fresh browser save. */ }
  }
  function save(){ localStorage.setItem('eternal-world-save',JSON.stringify({player:state.player,inv:state.inv,day:state.day,name:state.name,trail:state.trail})); toast('Journey saved in this browser.'); }
  function generateWorld(){
    for(let i=0;i<176;i++){
      const x=90+random()*(WORLD-180), y=100+random()*(WORLD-200);
      if(Math.hypot(x-WORLD/2,y-WORLD/2)<185)continue;
      const roll=random(), type=roll<.47?'tree':roll<.7?'rock':roll<.84?'berry':roll<.91?'fiber':roll<.965?'wolf':'deer';
      state.entities.push({type,x,y,alive:true,hp:type==='wolf'?3:1,phase:random()*Math.PI*2,respawn:0});
    }
    // A readable stream cuts through the eastern woods and provides a reliable water source.
    for(let i=0;i<7;i++)state.entities.push({type:'water',x:WORLD/2+310+Math.sin(i*.72)*36,y:WORLD/2-270+i*84,alive:true,phase:i});
    state.entities.push({type:'camp',x:WORLD/2+16,y:WORLD/2+26,alive:true});
  }
  function resize(){const dpr=Math.min(devicePixelRatio||1,2), r=canvas.getBoundingClientRect();canvas.width=Math.floor(r.width*dpr);canvas.height=Math.floor(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  window.addEventListener('resize',resize); resize(); loadSaved(); generateWorld();
  const el=id=>document.getElementById(id);
  function toast(message){el('toast-text').textContent=message;el('toast').classList.add('show');state.toastTimer=2.6;}
  function modalOpen(id){el(id).classList.add('active');state.paused=true;}
  function modalClose(id){el(id).classList.remove('active');if(state.started&&!document.querySelector('.modal-backdrop.active'))state.paused=false;}
  function nearestEntity(max=88){let best=null,dist=max;for(const e of state.entities){if(!e.alive||!['tree','rock','berry','fiber','water','wolf','deer','camp'].includes(e.type))continue;const d=Math.hypot(e.x-state.player.x,e.y-state.player.y);if(d<dist){dist=d;best=e;}}return best?{entity:best,dist}:null;}
  function begin(){state.name=(el('character-name').value.trim().slice(0,16)||'Wanderer');state.started=true;state.paused=false;el('player-name-hud').textContent=state.name;el('party-name').textContent=state.name;el('welcome-modal').classList.remove('active');showBanner('DAYBREAK','The wilds are yours to explore.');toast('Gather wood and stone. The first night is coming.');saveSilent();}
  function saveSilent(){localStorage.setItem('eternal-world-save',JSON.stringify({player:state.player,inv:state.inv,day:state.day,name:state.name,trail:state.trail}));}
  function showBanner(title,sub){const b=el('day-banner');b.querySelector('b').textContent=title;b.querySelector('small').textContent=sub;b.classList.add('show');setTimeout(()=>b.classList.remove('show'),2800);}

  function update(dt){
    if(state.paused)return;
    const p=state.player,speed=205*(state.keys.Shift?1.38:1), dx=(state.keys.d||state.keys.ArrowRight?1:0)-(state.keys.a||state.keys.ArrowLeft?1:0),dy=(state.keys.s||state.keys.ArrowDown?1:0)-(state.keys.w||state.keys.ArrowUp?1:0);
    if(dx||dy){const l=Math.hypot(dx,dy);p.faceX=dx/l;p.faceY=dy/l;p.x=Math.max(40,Math.min(WORLD-40,p.x+dx/l*speed*dt));p.y=Math.max(40,Math.min(WORLD-40,p.y+dy/l*speed*dt));if(state.keys.Shift){p.water=Math.max(0,p.water-dt*.42);p.food=Math.max(0,p.food-dt*.28);}}
    state.time+=dt; if(state.time>=300){state.time-=300;state.day++;el('day-label').textContent=`DAY ${String(state.day).padStart(2,'0')}`;showBanner('DAYBREAK',`Day ${state.day} begins. Keep moving.`);}
    p.water=Math.max(0,p.water-dt*.055);p.food=Math.max(0,p.food-dt*.035);
    if(p.water===0||p.food===0)p.hp=Math.max(0,p.hp-dt*.75);
    if(state.attackCooldown>0)state.attackCooldown-=dt;
    for(const e of state.entities){if(!e.alive&&e.respawn>0){e.respawn-=dt;if(e.respawn<=0){e.alive=true;e.hp=e.type==='wolf'?3:1;}}
      if(e.type==='wolf'&&e.alive){const d=Math.hypot(p.x-e.x,p.y-e.y);if(d<245){const sp=d<48?0:41;e.x+=(p.x-e.x)/d*sp*dt;e.y+=(p.y-e.y)/d*sp*dt;if(d<47){e.phase+=dt;if(e.phase>1.3){p.hp=Math.max(0,p.hp-7);e.phase=0;}}}}
    }
    if(p.hp<=0){state.paused=true;modalOpen('death-modal');}
    if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)el('toast').classList.remove('show');}
    updateHud();
  }
  function gather(){const near=nearestEntity(102);if(!near){toast('Nothing close enough to gather.');return;}const e=near.entity;
    const drops={tree:['wood',3,'Chopped wood'],rock:['stone',2,'Collected stone'],berry:['berries',3,'Picked wild berries'],fiber:['fiber',2,'Gathered plant fiber'],water:['water',1,'Filled fresh water'],wolf:['hide',1,'Collected wolf pelt'],deer:['hide',1,'Collected soft hide']};
    if(e.type==='camp'){if(state.inv.cooked>0){state.inv.cooked--;state.player.food=Math.min(100,state.player.food+38);toast('Trail stew restored your nourishment.');}else toast('A safe place to rest. Eat berries with key 4.');return;}
    if(e.type==='wolf'||e.type==='deer'){toast('That creature is wary. Try approaching carefully.');return;}
    const [item,amount,label]=drops[e.type];state.inv[item]+=amount;e.alive=false;e.respawn=54;
    if(item==='berries')state.player.food=Math.min(100,state.player.food+8);
    if(item==='water')state.player.water=Math.min(100,state.player.water+15);
    state.player.xp+=4;levelCheck();toast(`${label} · +${amount} ${itemMeta[item][1].toLowerCase()}`);updateHud();renderInventory();
  }
  function attack(){if(state.attackCooldown>0)return;state.attackCooldown=.48;const near=nearestEntity(118);if(!near||!['wolf','deer'].includes(near.entity.type)){toast('No wildlife in range.');return;}const e=near.entity;e.hp--;state.particles.push({x:e.x,y:e.y,text:'✦',life:.45,color:'#f1d2aa'});if(e.hp<=0){e.alive=false;e.respawn=70;state.inv.hide++;state.player.xp+=12;levelCheck();toast(`Wildlife defeated · +1 hide`);}else toast('A hit landed. Keep your distance.');}
  function levelCheck(){const need=state.player.level*35;if(state.player.xp>=need){state.player.xp-=need;state.player.level++;state.player.hp=Math.min(100,state.player.hp+15);showBanner(`LEVEL ${state.player.level}`, 'You are learning the language of the wild.');}}
  function consumeSelected(){if(state.selected===3&&state.inv.berries){state.inv.berries--;state.player.food=Math.min(100,state.player.food+22);toast('You ate wild berries.');}else if(state.selected===4&&state.inv.water){state.inv.water--;state.player.water=Math.min(100,state.player.water+35);toast('Fresh water restored your hydration.');}else if(state.selected===1&&state.inv.wood)toast('Wood is a crafting material.');else if(state.selected===2&&state.inv.stone)toast('Stone is a crafting material.');else toast('Nothing to use in this slot.');updateHud();renderInventory();}
  function craft(id){const r=recipes.find(x=>x.id===id);if(!r||!canCraft(r)){toast('You need more materials.');return;}Object.entries(r.cost).forEach(([k,v])=>state.inv[k]-=v);state.inv[id]++;if(id==='campfire'){state.player.hp=Math.min(100,state.player.hp+10);toast('Campfire crafted. Your first-night goal is complete!');}else toast(`${r.name} crafted.`);updateHud();renderInventory();saveSilent();}
  function canCraft(r){return Object.entries(r.cost).every(([k,v])=>state.inv[k]>=v);}
  function updateHud(){const p=state.player;el('health-value').textContent=`${Math.ceil(p.hp)} / 100`;el('health-bar').style.width=`${p.hp}%`;el('water-value').textContent=`${Math.ceil(p.water)}%`;el('water-bar').style.width=`${p.water}%`;el('food-value').textContent=`${Math.ceil(p.food)}%`;el('food-bar').style.width=`${p.food}%`;
    for(const [item,id] of [['wood','hot-wood'],['stone','hot-stone'],['berries','hot-berries'],['water','hot-water']])el(id).textContent=state.inv[item];
    el('wood-count').textContent=`${Math.min(5,state.inv.wood)} / 5`;el('stone-count').textContent=`${Math.min(3,state.inv.stone)} / 3`;el('fire-count').textContent=`${Math.min(1,state.inv.campfire)} / 1`;
    for(const [id,done] of [['wood-check',state.inv.wood>=5],['stone-check',state.inv.stone>=3],['fire-check',state.inv.campfire>=1]]){el(id).textContent=done?'✓':'○';el(id).classList.toggle('done',done);}
    el('level-label').textContent=`LEVEL ${String(p.level).padStart(2,'0')} · ${p.level>2?'WILDSWORN':'PATHFINDER'}`;el('level-hud').textContent=p.level;
    el('coords-label').textContent=`X ${String(Math.floor(p.x/TILE)).padStart(3,'0')} · Y ${String(Math.floor(p.y/TILE)).padStart(3,'0')}`;
    const n=nearestEntity(100);const hint=el('interaction-hint');if(n){hint.classList.add('visible');el('interaction-text').textContent=n.entity.type==='water'?'Collect fresh water':n.entity.type==='camp'?'Rest at camp':`Gather ${n.entity.type}`;}else hint.classList.remove('visible');
  }
  function renderInventory(){const grid=el('inventory-grid');grid.innerHTML='';const items=Object.entries(state.inv).filter(([,n])=>n>0);el('inventory-slots').textContent=`${items.length} / 24`;
    items.forEach(([id,n])=>{const [icon,name]=itemMeta[id];const cell=document.createElement('div');cell.className='inventory-cell';cell.innerHTML=`<span class="item-amount">${n}</span><span class="item-icon">${icon}</span><span class="item-name">${name}</span>`;grid.append(cell);});
    for(let i=items.length;i<24;i++){const c=document.createElement('div');c.className='inventory-cell empty';grid.append(c);}
    const recipesEl=el('recipes');recipesEl.innerHTML='';recipes.forEach(r=>{const d=document.createElement('div');d.className='recipe';const cost=Object.entries(r.cost).map(([k,v])=>`${v} ${itemMeta[k][1].toLowerCase()}`).join(' · ');d.innerHTML=`<span class="recipe-icon">${r.icon}</span><div class="recipe-main"><b>${r.name}</b><small>${cost}</small></div><button ${canCraft(r)?'':'disabled'} data-craft="${r.id}">CRAFT</button>`;recipesEl.append(d);});
  }

  function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;ctx.clearRect(0,0,w,h);const p=state.player,cx=p.x-w/2,cy=p.y-h/2;
    const night=.14+.12*(.5+.5*Math.sin(state.time/300*Math.PI*2));ctx.fillStyle='#334a39';ctx.fillRect(0,0,w,h);
    const left=Math.floor(cx/TILE)-1,top=Math.floor(cy/TILE)-1,right=left+Math.ceil(w/TILE)+3,bottom=top+Math.ceil(h/TILE)+3;
    for(let ty=top;ty<bottom;ty++)for(let tx=left;tx<right;tx++){const x=tx*TILE-cx,y=ty*TILE-cy,r=rand((tx+1000)*7919+(ty+1000)*104729);ctx.fillStyle=r>.83?'#405640':r<.12?'#3b523d':'#3e573f';ctx.fillRect(x,y,TILE+1,TILE+1);if(r>.88){ctx.fillStyle='#71835a';ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(x+r*30,y+r*40,7,3,-.4,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}}
    // Distant stream ribbon in the eastern woods.
    ctx.save();ctx.translate(-cx,-cy);ctx.beginPath();for(let i=0;i<=18;i++){const y=WORLD/2-310+i*38,x=WORLD/2+310+Math.sin(i*.48)*48;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle='#679a91';ctx.globalAlpha=.52;ctx.lineWidth=44;ctx.lineCap='round';ctx.stroke();ctx.strokeStyle='#9dc5b4';ctx.globalAlpha=.2;ctx.lineWidth=22;ctx.stroke();ctx.restore();
    const visible=state.entities.filter(e=>e.alive&&e.x>cx-100&&e.x<cx+w+100&&e.y>cy-100&&e.y<cy+h+100).sort((a,b)=>a.y-b.y);
    visible.forEach(e=>drawEntity(e,e.x-cx,e.y-cy));drawPlayer(w/2,h/2);
    state.particles=state.particles.filter(pt=>pt.life>0);state.particles.forEach(pt=>{pt.life-=.016;ctx.globalAlpha=Math.max(0,pt.life*2);ctx.fillStyle=pt.color;ctx.font='16px sans-serif';ctx.fillText(pt.text,pt.x-cx,pt.y-cy-pt.life*40);ctx.globalAlpha=1;});
    ctx.fillStyle=`rgba(9,17,18,${night})`;ctx.fillRect(0,0,w,h);drawMinimap();requestAnimationFrame(frame);
  }
  function drawEntity(e,x,y){ctx.save();ctx.translate(x,y);const pulse=Math.sin(state.time*2+e.phase)*1.5;
    if(e.type==='tree'){ctx.fillStyle='#1e3528';ctx.beginPath();ctx.ellipse(3,18,22,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#604b36';ctx.fillRect(-4,-5,9,24);ctx.fillStyle='#31573b';ctx.beginPath();ctx.arc(0,-17,19,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3e6b45';ctx.beginPath();ctx.arc(-7,-23,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#527b4c';ctx.beginPath();ctx.arc(3,-29,7,0,Math.PI*2);ctx.fill();}
    else if(e.type==='rock'){ctx.fillStyle='#263a31';ctx.beginPath();ctx.ellipse(0,8,19,9,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#858b78';ctx.beginPath();ctx.moveTo(-17,5);ctx.lineTo(-11,-11);ctx.lineTo(1,-17);ctx.lineTo(16,-8);ctx.lineTo(20,7);ctx.lineTo(8,12);ctx.lineTo(-11,11);ctx.closePath();ctx.fill();ctx.fillStyle='#a8a990';ctx.beginPath();ctx.moveTo(-11,-9);ctx.lineTo(1,-16);ctx.lineTo(5,-5);ctx.lineTo(-8,0);ctx.closePath();ctx.fill();}
    else if(e.type==='berry'||e.type==='fiber'){ctx.fillStyle='#294331';ctx.beginPath();ctx.ellipse(0,6,14,7,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#68875a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,5);ctx.lineTo(-4,-12);ctx.moveTo(0,3);ctx.lineTo(8,-9);ctx.stroke();ctx.fillStyle=e.type==='berry'?'#9b6681':'#9eb56d';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(-7+i*7,-8+(i%2)*5,4,0,Math.PI*2);ctx.fill();}}
    else if(e.type==='water'){ctx.fillStyle='#263a31';ctx.beginPath();ctx.ellipse(0,8,21,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#75aaa0';ctx.beginPath();ctx.ellipse(0,0,17,8,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b7d4be';ctx.globalAlpha=.6;ctx.beginPath();ctx.moveTo(-7,-1);ctx.lineTo(6,-1);ctx.stroke();ctx.globalAlpha=1;}
    else if(e.type==='wolf'||e.type==='deer'){ctx.fillStyle='#17251d';ctx.beginPath();ctx.ellipse(0,9,19,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=e.type==='wolf'?'#77756b':'#9f815c';ctx.beginPath();ctx.ellipse(0,0,14,8,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(11,-4,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#dfb278';ctx.beginPath();ctx.arc(13,-5,1.3,0,Math.PI*2);ctx.fill();if(e.type==='wolf'){ctx.fillStyle='#cf8b76';ctx.font='9px sans-serif';ctx.fillText('!',-3,-19);}}
    else if(e.type==='camp'){ctx.fillStyle='#252b21';ctx.beginPath();ctx.ellipse(0,6,22,12,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a3784c';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-10,6);ctx.lineTo(9,-1);ctx.moveTo(-9,-1);ctx.lineTo(10,6);ctx.stroke();ctx.fillStyle=`rgba(237,159,92,${.65+pulse*.05})`;ctx.beginPath();ctx.ellipse(0,-4,7,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffe0a2';ctx.beginPath();ctx.ellipse(0,-3,3,6,0,0,Math.PI*2);ctx.fill();}
    ctx.restore();}
  function drawPlayer(x,y){ctx.save();ctx.translate(x,y);ctx.fillStyle='#13201b';ctx.globalAlpha=.55;ctx.beginPath();ctx.ellipse(0,10,14,7,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=state.trail;ctx.beginPath();ctx.ellipse(0,2,10,13,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d5bd98';ctx.beginPath();ctx.arc(0,-11,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#443d32';ctx.beginPath();ctx.arc(0,-14,7,Math.PI,Math.PI*2);ctx.fill();ctx.strokeStyle='#efe2c7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(state.player.faceX*3,state.player.faceY*3);ctx.lineTo(state.player.faceX*12,state.player.faceY*12);ctx.stroke();ctx.restore();}
  function drawMinimap(){const W=mini.width,H=mini.height;mctx.fillStyle='#304834';mctx.fillRect(0,0,W,H);mctx.strokeStyle='#79aaa0';mctx.globalAlpha=.65;mctx.lineWidth=8;mctx.beginPath();for(let i=0;i<18;i++){const y=H*.25+i*5,x=W*.68+Math.sin(i*.48)*7;if(!i)mctx.moveTo(x,y);else mctx.lineTo(x,y);}mctx.stroke();mctx.globalAlpha=1;
    state.entities.forEach(e=>{if(!e.alive||e.type==='camp')return;const x=e.x/WORLD*W,y=e.y/WORLD*H;mctx.fillStyle=e.type==='wolf'?'#df987d':e.type==='water'?'#a7d6ce':e.type==='rock'?'#b8b59b':'#a2bd83';mctx.globalAlpha=e.type==='tree'?.45:.9;mctx.fillRect(x,y,e.type==='tree'?2:3,e.type==='tree'?2:3);});mctx.globalAlpha=1;mctx.fillStyle='#efd597';mctx.beginPath();mctx.arc(state.player.x/WORLD*W,state.player.y/WORLD*H,3,0,Math.PI*2);mctx.fill();mctx.strokeStyle='#fff4c8';mctx.lineWidth=1;mctx.stroke();}
  function frame(now){const dt=Math.min(.05,(now-state.last)/1000||.016);state.last=now;update(dt);draw();}

  document.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;state.keys[e.key.toLowerCase()]=true;state.keys[e.code]=true;
    if(e.key.toLowerCase()==='e')gather();if(e.code==='Space')attack();if(e.key.toLowerCase()==='i'){renderInventory();modalOpen('inventory-modal');}if(e.key==='Escape'){if(document.querySelector('.modal-backdrop.active'))document.querySelectorAll('.modal-backdrop.active').forEach(m=>m.classList.remove('active'));else modalOpen('pause-modal');state.paused=!!document.querySelector('.modal-backdrop.active');}
    if(['1','2','3','4','5'].includes(e.key)){state.selected=Number(e.key)-1;document.querySelectorAll('.hot-slot').forEach((b,i)=>b.classList.toggle('selected',i===state.selected));if(e.key==='4'||e.key==='5')consumeSelected();}
  });document.addEventListener('keyup',e=>{state.keys[e.key.toLowerCase()]=false;state.keys[e.code]=false;});window.addEventListener('blur',()=>{state.keys={};});
  el('begin-btn').addEventListener('click',begin);el('character-name').addEventListener('input',e=>{state.name=e.target.value||'Wanderer';el('party-name').textContent=state.name;});
  document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{document.querySelector('.swatch.active')?.classList.remove('active');b.classList.add('active');state.trail=b.dataset.color;document.querySelector('.custom-preview').style.setProperty('--trail',state.trail);}));
  el('inventory-open').addEventListener('click',()=>{renderInventory();modalOpen('inventory-modal');});document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>modalClose(b.dataset.close)));
  el('pause-btn').addEventListener('click',()=>modalOpen('pause-modal'));el('resume-btn').addEventListener('click',()=>modalClose('pause-modal'));el('lobby-open').addEventListener('click',()=>{modalClose('pause-modal');modalOpen('lobby-modal');});el('lobby-done').addEventListener('click',()=>modalClose('lobby-modal'));el('save-btn').addEventListener('click',save);el('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(el('room-code').textContent);toast('Room code copied. Invite a friend to the local preview.');}catch(e){toast('Room code: WILD-042');}});
  el('simulate-friend').addEventListener('click',()=>{if(state.companion){toast('Your preview companion is already at camp.');return;}state.companion=true;const row=document.createElement('div');row.className='party-person';row.innerHTML='<div class="party-avatar">M</div><b>Mira · preview</b><span>LOCAL SIMULATION</span><i class="online-dot"></i>';document.querySelector('.lobby-people').append(row);document.querySelector('.lobby-people .section-label span').textContent='2 / 4';toast('Companion preview added locally — no online player connected.');});
  el('respawn-btn').addEventListener('click',()=>{state.player.x=WORLD/2;state.player.y=WORLD/2;state.player.hp=75;state.player.water=Math.max(35,state.player.water);state.player.food=Math.max(35,state.player.food);el('death-modal').classList.remove('active');state.paused=false;toast('You woke beside the old campfire.');});
  el('touch-interact').addEventListener('pointerdown',e=>{e.preventDefault();gather();});el('touch-attack').addEventListener('pointerdown',e=>{e.preventDefault();attack();});document.querySelectorAll('[data-move]').forEach(b=>{const key={up:'w',down:'s',left:'a',right:'d'}[b.dataset.move];b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);state.keys[key]=true;});['pointerup','pointercancel','lostpointercapture'].forEach(ev=>b.addEventListener(ev,()=>state.keys[key]=false));});
  document.body.addEventListener('click',e=>{const b=e.target.closest('[data-craft]');if(b)craft(b.dataset.craft);});el('sound-btn').addEventListener('click',()=>{state.sound=!state.sound;el('sound-btn').textContent=state.sound?'♪':'♩';toast(state.sound?'Ambient sound enabled.':'Ambient sound muted.');});
  el('day-label').textContent=`DAY ${String(state.day).padStart(2,'0')}`;el('player-name-hud').textContent=state.name;el('party-name').textContent=state.name;updateHud();renderInventory();requestAnimationFrame(frame);
})();
