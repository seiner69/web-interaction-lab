'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const effects = [
  { name:'镜头拉远', en:'Layered scene collapse', detail:'画面边界收成蓝色胶囊，人物独立留在前景。文字被遮罩裁掉，花朵与人物以不同速度后退。', tag:'MASK × LAYERS', label:'收合进度', value:0 },
  { name:'弧形轮播', en:'Curved 3D carousel', detail:'唱片沿立体弧线流动，中心唱片靠近，远处唱片后退。拖拽、滚轮或方向键都能切换。', tag:'DRAG × PERSPECTIVE', label:'弧形幅度', value:75 },
  { name:'玻璃倾斜', en:'Independent glass panes', detail:'五片玻璃分别响应指针，反光掠过表面。同一份文字裁进各片玻璃，接缝张开时，字形也随之错位。', tag:'POINTER × PANES', label:'倾斜幅度', value:45 },
  { name:'文件夹展开', en:'Hover to unfold', detail:'悬停或点击文件夹，卡片依次扇形展开。指向单张卡片，它会进一步抬起，成为视觉焦点。', tag:'HOVER × FAN OUT', label:'展开幅度', value:70 },
  { name:'粒子扰动', en:'Interactive particle physics', detail:'指针推动周围的咖啡豆，速度与惯性决定它们的翻滚轨迹。移开后，粒子逐渐回到松散的平衡。', tag:'POINTER × PHYSICS', label:'扰动强度', value:65 }
];
let activeEffect = 0, autoRunning = false, autoStart = 0, autoLastDisc = -1;
let animationFrame = 0, lastFrame = 0, toastTimer;
const stage = $('#stage'), strength = $('#strength');
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2200);}
function stopAuto(){autoRunning=false;$('#autoplay').setAttribute('aria-pressed','false');$('#autoplay').innerHTML='▷ <span>自动演示</span>';autoLastDisc=-1;}
function updateControls(){const e=effects[activeEffect];$('#strength-label').textContent=e.label;strength.value=e.value;$('#strength-value').value=`${e.value}%`;}
function selectEffect(index){
  if(index===activeEffect)return;
  stopAuto(); activeEffect=index;
  $$('.effect-tab').forEach((tab,i)=>{tab.classList.toggle('active',i===index);if(i===index)tab.setAttribute('aria-current','true');else tab.removeAttribute('aria-current');});
  $$('.effect-panel').forEach((panel,i)=>{panel.hidden=i!==index;panel.classList.toggle('active',i===index);});
  $('.current-index').textContent=`0${index+1} / 05`;
  $('.description-number').textContent=`0${index+1}`;
  $('#effect-title').replaceChildren(document.createTextNode(effects[index].name));
  const subtitle=document.createElement('span');subtitle.textContent=effects[index].en;$('#effect-title').append(subtitle);
  $('#effect-detail').textContent=effects[index].detail;$('#tech-tag').textContent=effects[index].tag;
  updateControls();
  if(index===0)setZoom(effects[0].value);
  if(index===1)renderDiscs();
  if(index===2){glassMetrics();tilt(0,0);}
  if(index===3){setFolder(folderPinned);applyFolderSpread();}
  if(index===4){resizeParticles();pointer.active=false;}
}
$$('.effect-tab').forEach(tab=>tab.addEventListener('click',()=>selectEffect(Number(tab.dataset.effect))));
strength.addEventListener('input',()=>{stopAuto();effects[activeEffect].value=Number(strength.value);updateControls();if(activeEffect===0)setZoom(effects[0].value);if(activeEffect===1)renderDiscs();if(activeEffect===2)tilt(lastTilt.x,lastTilt.y);if(activeEffect===3)applyFolderSpread();});
$('#reset').addEventListener('click',()=>{
  stopAuto();effects[activeEffect].value=[0,75,45,70,65][activeEffect];updateControls();
  if(activeEffect===0)setZoom(0);
  if(activeEffect===1){recordIndex=0;renderDiscs();}
  if(activeEffect===2)tilt(0,0);
  if(activeEffect===3){folderPinned=false;setFolder(false);applyFolderSpread();$$('.fan-card').forEach(c=>c.classList.remove('selected'));folderCaption();}
  if(activeEffect===4){pointer.active=false;createParticles();}
});
$('#autoplay').addEventListener('click',()=>{
  if(autoRunning){stopAuto();if(activeEffect===2)tilt(0,0);if(activeEffect===3)setFolder(folderPinned);if(activeEffect===4)pointer.active=false;return;}
  autoRunning=true;autoStart=performance.now();autoLastDisc=-1;$('#autoplay').setAttribute('aria-pressed','true');$('#autoplay').innerHTML='Ⅱ <span>暂停演示</span>';
});
let immersive=false;
function setImmersive(value){immersive=value;$('#stage-wrap').classList.toggle('immersive',value);document.body.style.overflow=value?'hidden':'';$('.fullscreen-control').setAttribute('aria-label',value?'退出全屏演示':'进入全屏演示');if(value)$('.exit-fullscreen').focus();else $('.fullscreen-control').focus();}
$('.fullscreen-control').addEventListener('click',()=>setImmersive(!immersive));$('.exit-fullscreen').addEventListener('click',()=>setImmersive(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&immersive)setImmersive(false);});
/* Frame audit: the mask collapses faster than the separate foreground person.
   Wheel/drag are demo controls; the reference recording does not prove its trigger. */
const zoomKeys=[
  [0,96,82,44,76,1,0],[.12,85,73,46,71,.97,.07],
  [.24,67,58,46,66,.92,.20],[.36,53,47,47,61,.85,.34],
  [.48,44,39,48,57,.78,.46],[.60,35,31,48,53,.72,.65],
  [.72,29,25,49,49,.68,.75],[.82,14,13,50,43,.64,.89],
  [.90,6.5,8.2,50,39,.60,.98],[1,6.5,8.2,50,39,.58,1]
];
function setZoom(value){
  value=clamp(value,0,100);effects[0].value=value;const t=value/100;
  let a=zoomKeys[0],b=zoomKeys[1];for(let i=1;i<zoomKeys.length;i++){b=zoomKeys[i];a=zoomKeys[i-1];if(t<=b[0])break;}
  const mix=clamp((t-a[0])/(b[0]-a[0]),0,1),v=a.map((n,i)=>n+(b[i]-n)*mix);
  const panel=$('#effect-0'),style=panel.style;
  if(t>.82)v[1]=Math.max(v[1],v[2]*panel.clientHeight/Math.max(panel.clientWidth,1)*1.42);
  style.setProperty('--frame-w',`${v[1]}%`);style.setProperty('--frame-h',`${v[2]}%`);style.setProperty('--frame-y',`${v[3]}%`);
  style.setProperty('--person-h',`${v[4]}%`);style.setProperty('--flower-scale',v[5]);style.setProperty('--blue-opacity',v[6]);
  style.setProperty('--scene-radius',`${6+Math.pow(t,.6)*90}px`);style.setProperty('--backdrop-opacity',1-Math.pow(1-t,1.6));
  style.setProperty('--footer-opacity',1-clamp((t-.24)/.18,0,1));style.setProperty('--options-opacity',clamp((t-.94)/.06,0,1));
  style.setProperty('--stage-w',`${panel.clientWidth}px`);style.setProperty('--stage-h',`${panel.clientHeight}px`);
  style.setProperty('--mark-opacity',clamp((t-.95)/.05,0,1));panel.classList.toggle('is-collapsed',t>=.98);
  $('.capsule-options').setAttribute('aria-hidden',String(t<.98));$$('.capsule-options button').forEach(button=>button.disabled=t<.98);
  $('#zoom-progress-bar').style.width=`${value}%`;$('.zoom-hint').style.opacity=String(1-clamp(t*5,0,1));
  if(activeEffect===0){strength.value=Math.round(value);$('#strength-value').value=`${Math.round(value)}%`;}
}
$('#effect-0').addEventListener('wheel',e=>{e.preventDefault();stopAuto();const delta=e.deltaMode===1?e.deltaY*16:e.deltaY;setZoom(effects[0].value+clamp(delta*.065,-14,14));},{passive:false});
let zoomDrag=null;
$('#effect-0').addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;stopAuto();zoomDrag={y:e.clientY,value:effects[0].value};e.currentTarget.setPointerCapture(e.pointerId);});
$('#effect-0').addEventListener('pointermove',e=>{if(zoomDrag)setZoom(zoomDrag.value+(zoomDrag.y-e.clientY)*.3);});
['pointerup','pointercancel'].forEach(event=>$('#effect-0').addEventListener(event,()=>zoomDrag=null));
$('.capsule-reopen').addEventListener('click',()=>{stopAuto();setZoom(0);});
const atmosphereColors=['#cfdfef','#eee7be','#d1d6e7','#e4d4e3'];
$$('.capsule-option').forEach(button=>button.addEventListener('click',()=>{stopAuto();$('#effect-0').style.setProperty('--atmosphere',atmosphereColors[Number(button.dataset.atmosphere)]);}));
/* Curved carousel supports drag, wheel, keyboard and individual covers. */
const records=[
  {title:'AFTER HOURS',cover:'AFTER<br>HOURS',subtitle:'深夜时刻 · ELECTRONIC / 2026'},
  {title:'SUNSET RADIO',cover:'SUNSET<br>RADIO',subtitle:'落日电台 · SOUL / 2026'},
  {title:'SLOW BLOOM',cover:'Slow<br>Bloom',subtitle:'缓慢盛开 · AMBIENT / 2026'},
  {title:'NEW WAVE',cover:'NEW<br>WAVE',subtitle:'新的浪潮 · ALTERNATIVE / 2026'},
  {title:'THE QUIET EARTH',cover:'The Quiet<br>Earth',subtitle:'安静大地 · JAZZ / 2026'},
  {title:'GOLDEN DAYS',cover:'GOLDEN<br>DAYS',subtitle:'金色日子 · INDIE / 2026'},
  {title:'MIDNIGHT CLUB',cover:'MIDNIGHT<br>CLUB',subtitle:'午夜俱乐部 · HOUSE / 2026'}
];
let recordIndex=0, discDrag=null, dragFraction=0, suppressDiscClickUntil=0, wheelAccumulator=0, wheelLockedUntil=0;
const discTrack=$('#disc-track');
records.forEach((record,i)=>{const disc=document.createElement('button');disc.className=`disc disc-${i}`;disc.dataset.record=i;disc.setAttribute('aria-label',`切换到 ${record.title}`);disc.innerHTML=`<span class="disc-cover"><strong>${record.cover}</strong><small>LISTENING ROOM · 0${i+1}</small></span>`;disc.addEventListener('click',()=>{if(performance.now()<suppressDiscClickUntil)return;stopAuto();recordIndex=i;renderDiscs();});discTrack.append(disc);});
function relativeRecord(i){return ((i-recordIndex+10)%7)-3;}
function renderDiscs(){
  const width=discTrack.clientWidth, factor=.55+effects[1].value/100*.6;
  const spread=width*.43, narrow=width<500;
  $$('.disc').forEach((disc,i)=>{const offset=relativeRecord(i)-dragFraction, angle=offset*.48;const x=Math.sin(angle)*spread;const y=(1-Math.cos(angle))*100*factor;const z=-Math.abs(offset)*74;const scale=1-Math.min(Math.abs(offset)*.11,.34);disc.style.transform=`translate(-50%,-50%) translate3d(${x}px,${y}px,${z}px) rotateY(${-angle*21}deg) rotateZ(${offset*9*factor}deg) scale(${scale})`;disc.style.zIndex=String(10-Math.round(Math.abs(offset)*2));disc.style.filter=`brightness(${1-Math.min(Math.abs(offset)*.08,.25)})`;disc.style.opacity=String(Math.abs(offset)>2.9?(narrow?.18:.45):1);disc.setAttribute('aria-pressed',String(i===recordIndex));});
  $('#record-title').textContent=records[recordIndex].title;$('#record-subtitle').textContent=records[recordIndex].subtitle;$('.record-counter').textContent=`0${recordIndex+1} — 07`;
}
function moveRecord(delta){recordIndex=(recordIndex+delta+7)%7;dragFraction=0;renderDiscs();}
$('#disc-prev').addEventListener('click',()=>{stopAuto();moveRecord(-1);});$('#disc-next').addEventListener('click',()=>{stopAuto();moveRecord(1);});
discTrack.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stopAuto();moveRecord(e.key==='ArrowRight'?1:-1);}});
$('#effect-1').addEventListener('wheel',e=>{e.preventDefault();stopAuto();if(performance.now()<wheelLockedUntil)return;wheelAccumulator+=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(Math.abs(wheelAccumulator)>30){moveRecord(wheelAccumulator>0?1:-1);wheelAccumulator=0;wheelLockedUntil=performance.now()+300;}},{passive:false});
discTrack.addEventListener('pointerdown',e=>{if(e.button!==0)return;stopAuto();discDrag={x:e.clientX,id:e.pointerId,moved:false};});
discTrack.addEventListener('pointermove',e=>{if(!discDrag)return;const dx=e.clientX-discDrag.x;if(Math.abs(dx)>8){discDrag.moved=true;discTrack.setPointerCapture(e.pointerId);dragFraction=clamp(-dx/(discTrack.clientWidth*.25),-1.9,1.9);renderDiscs();}});
discTrack.addEventListener('pointerup',()=>{if(discDrag?.moved){const delta=Math.abs(dragFraction)>.18?(dragFraction>0?Math.max(1,Math.round(dragFraction)):Math.min(-1,Math.round(dragFraction))):0;moveRecord(delta);suppressDiscClickUntil=performance.now()+300;}discDrag=null;dragFraction=0;});
discTrack.addEventListener('pointercancel',()=>{discDrag=null;dragFraction=0;renderDiscs();});
/* Native-resolution reference frames show text divided by the same pane seams.
   Each tile clips an identical page layer in shared coordinates, then tilts separately. */
const paneShapes=[
  [[0,0],[180,0],[366,382],[332,500],[0,500]],
  [[187,0],[518,0],[518,261],[375,382]],
  [[525,0],[906,0],[733,261],[525,261]],
  [[376,391],[523,268],[734,268],[820,500],[340,500]],
  [[914,0],[1000,0],[1000,500],[830,500],[742,269]]
];
function roundedPolygon(points,r=12){
  const corners=points.map((p,i)=>{const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];const l1=Math.hypot(prev[0]-p[0],prev[1]-p[1]),l2=Math.hypot(next[0]-p[0],next[1]-p[1]);const d=Math.min(r,l1/3,l2/3);return {p,in:[p[0]+(prev[0]-p[0])*d/l1,p[1]+(prev[1]-p[1])*d/l1],out:[p[0]+(next[0]-p[0])*d/l2,p[1]+(next[1]-p[1])*d/l2]};});
  return `M ${corners[0].out.join(' ')} `+corners.slice(1).concat(corners[0]).map(c=>`L ${c.in.join(' ')} Q ${c.p.join(' ')} ${c.out.join(' ')}`).join(' ')+' Z';
}
const paneCenters=paneShapes.map(points=>points.reduce((c,p)=>[c[0]+p[0]/points.length,c[1]+p[1]/points.length],[0,0]));
const paneCopy='<div class="pane-copy"><span>MAKE THE MATERIAL YOURS</span><h2>Designed<br>in glass.</h2><p>Every movement. A new perspective.<br>Material follows the light.</p><b>Feel the surface ↗</b></div><div class="pane-footer"><span>FORMA / MATERIAL STUDIO</span><span>LIGHT. MOTION. REFLECTION.</span></div>';
function glassMetrics(){const board=$('#glass-board');board.style.setProperty('--copy-sy',board.clientWidth/(Math.max(board.clientHeight,1)*.86*2));}
paneShapes.forEach((points,i)=>{const pane=document.createElement('div');pane.className=`pane pane-${i}`;const path=roundedPolygon(points);pane.style.transformOrigin=`${paneCenters[i][0]/10}% ${paneCenters[i][1]/5}%`;pane.innerHTML=`<svg viewBox="0 0 1000 500" preserveAspectRatio="none"><defs><clipPath id="tile-clip-${i}"><path d="${path}"/></clipPath></defs><foreignObject x="0" y="0" width="1000" height="500" clip-path="url(#tile-clip-${i})"><div xmlns="http://www.w3.org/1999/xhtml" class="pane-surface">${paneCopy}</div></foreignObject><path class="pane-edge" d="${path}"/></svg>`;$('#glass-tiles').append(pane);});
function insidePolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
let lastTilt={x:0,y:0};
function tilt(x,y){
  lastTilt={x,y};const neutral=x===0&&y===0,px=(x+1)*500,py=((y+1)/2-.14)/.86*500,power=4+effects[2].value*.15;
  $('#glass-board').style.transform=`rotateX(${-y*2}deg) rotateY(${x*2}deg) rotateZ(${x*.9}deg)`;
  const selected=neutral?-1:paneShapes.findIndex(p=>insidePolygon(px,py,p));let maxAngle=0;
  $$('.pane').forEach((pane,i)=>{const [cx,cy]=paneCenters[i],distance=Math.hypot((px-cx)/1000,(py-cy)/500),weight=neutral?0:(i===selected?1:.12*Math.exp(-distance*3));
    const lx=clamp((px-cx)/260,-1,1),ly=clamp((py-cy)/190,-1,1),rx=-ly*power*weight,ry=lx*power*weight;
    pane.style.setProperty('--rx',`${rx.toFixed(2)}deg`);pane.style.setProperty('--ry',`${ry.toFixed(2)}deg`);pane.style.setProperty('--lift',`${weight*8}px`);
    pane.style.setProperty('--light-x',`${(x+1)*50}%`);pane.style.setProperty('--light-y',`${clamp(py/5,0,100)}%`);
    pane.style.setProperty('--shine',neutral?.12:.12+weight*.48);pane.style.setProperty('--shine-angle',`${125+ry*3-rx*2}deg`);pane.classList.toggle('is-hovered',i===selected);maxAngle=Math.max(maxAngle,Math.abs(rx),Math.abs(ry));
  });
  $('.glass-top').style.transform=`rotateX(${-y*1.5}deg) rotateY(${x*1.5}deg)`;
  $('#tilt-readout').textContent=selected<0?'5 INDEPENDENT PANES':`PANE 0${selected+1} / ${maxAngle.toFixed(1)}°`;
}
$('#glass-perspective').addEventListener('pointermove',e=>{if(autoRunning)stopAuto();const r=$('#glass-board').getBoundingClientRect();tilt(clamp((e.clientX-r.left)/r.width*2-1,-1,1),clamp((e.clientY-r.top)/r.height*2-1,-1,1));});
$('#glass-perspective').addEventListener('pointerleave',()=>{if(!autoRunning)tilt(0,0);});
$('#glass-perspective').addEventListener('pointercancel',()=>tilt(0,0));
$('#glass-perspective').addEventListener('keydown',e=>{const directions={ArrowLeft:[-.2,0],ArrowRight:[.2,0],ArrowUp:[0,-.2],ArrowDown:[0,.2]};if(directions[e.key]){e.preventDefault();stopAuto();const [dx,dy]=directions[e.key];tilt(clamp(lastTilt.x+dx,-1,1),clamp(lastTilt.y+dy,-1,1));}});
/* Folder pinning gives touch devices the same access as hover. */
let folderPinned=false;
const folder=$('#folder-system'),cardNames=['FORM / 形态探索','PLAY / 创意能量','FIELD / 设计档案','TYPE / 字体实验','IDEA / 灵感练习'];
function setFolder(value){folder.classList.toggle('is-open',value);$('#folder-toggle').setAttribute('aria-expanded',String(value));$('#folder-toggle').setAttribute('aria-label',value?'收起作品文件夹':'展开作品文件夹');$$('.fan-card').forEach(card=>{card.tabIndex=value?0:-1;card.setAttribute('aria-hidden',String(!value));});}
function folderCaption(text){$('#folder-caption').replaceChildren(document.createTextNode(text||'移到文件夹上，让灵感展开。'));const hint=document.createElement('span');hint.textContent='手机上点击打开 · 指向卡片，让它浮起';$('#folder-caption').append(hint);}
function applyFolderSpread(){const xs=[-153,-81,0,89,161],ys=[-76,-125,-143,-120,-65],factor=.65+effects[3].value*.005;$$('.fan-card').forEach((card,i)=>{card.style.setProperty('--open-x',`${xs[i]*factor}px`);card.style.setProperty('--open-y',`${ys[i]*factor}px`);});}
folder.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){stopAuto();setFolder(true);}});
folder.addEventListener('pointerleave',()=>{if(!folderPinned&&!folder.contains(document.activeElement)&&!autoRunning)setFolder(false);});
folder.addEventListener('focusin',()=>setFolder(true));
folder.addEventListener('focusout',e=>{if(!folder.contains(e.relatedTarget)&&!folderPinned&&!folder.matches(':hover'))setFolder(false);});
$('#folder-toggle').addEventListener('click',()=>{stopAuto();folderPinned=!folderPinned;setFolder(folderPinned);});
$$('.fan-card').forEach(card=>card.addEventListener('click',()=>{stopAuto();folderPinned=true;setFolder(true);$$('.fan-card').forEach(c=>c.classList.toggle('selected',c===card));folderCaption(`已选中 ${cardNames[Number(card.dataset.card)]}`);}));
/* Coffee beans: a sprite rendered from gradients, then a spring + inertial system. */
const canvas=$('#particle-canvas'),ctx=canvas.getContext('2d',{alpha:false});
let particles=[],canvasW=0,canvasH=0,seed=151;
const pointer={x:-999,y:-999,vx:0,vy:0,active:false};
function random(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
const beanSprites=[0,1,2].map(i=>{const bean=document.createElement('canvas');bean.width=64;bean.height=88;const c=bean.getContext('2d');c.save();c.translate(32,44);c.rotate(.16);c.shadowColor='#000';c.shadowBlur=7;c.shadowOffsetY=4;const g=c.createRadialGradient(-10,-20,2,3,6,42);g.addColorStop(0,['#cc9d57','#bc8342','#ae7b45'][i]);g.addColorStop(.25,['#8c5829','#79431e','#82522d'][i]);g.addColorStop(.65,'#3e2413');g.addColorStop(1,'#120e09');c.fillStyle=g;c.beginPath();c.ellipse(0,0,22,34,0,0,Math.PI*2);c.fill();c.shadowBlur=0;c.strokeStyle='#130c08';c.lineWidth=4;c.beginPath();c.moveTo(3,-31);c.bezierCurveTo(-13,-6,13,4,-3,31);c.stroke();c.strokeStyle='#b489443f';c.lineWidth=1.4;c.beginPath();c.moveTo(7,-29);c.bezierCurveTo(-7,-8,15,6,0,29);c.stroke();c.strokeStyle='#d9a9632f';c.beginPath();c.ellipse(-2,-4,17,28,.05,Math.PI*.9,Math.PI*1.8);c.stroke();c.restore();return bean;});
function createParticles(){seed=151;const count=canvasW<500?310:550;particles=Array.from({length:count},()=>{const x=random()*canvasW,y=random()*canvasH;return{x,y,hx:x,hy:y,vx:0,vy:0,angle:random()*Math.PI*2,av:0,size:5+random()*12,depth:.3+random()*.7,phase:random()*Math.PI*2,sprite:Math.floor(random()*3)};});$('#particle-count').textContent=String(count);}
function resizeParticles(){const rect=stage.getBoundingClientRect();if(!rect.width||!rect.height)return;if(Math.abs(canvasW-rect.width)<1&&Math.abs(canvasH-rect.height)<1)return;canvasW=rect.width;canvasH=rect.height;const dpr=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.round(canvasW*dpr);canvas.height=Math.round(canvasH*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);createParticles();}
function updatePointer(e){if(autoRunning)stopAuto();const r=canvas.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;pointer.vx=pointer.active?clamp(x-pointer.x,-40,40):0;pointer.vy=pointer.active?clamp(y-pointer.y,-40,40):0;pointer.x=x;pointer.y=y;pointer.active=true;}
canvas.addEventListener('pointermove',updatePointer);canvas.addEventListener('pointerdown',updatePointer);
['pointerleave','pointercancel'].forEach(name=>canvas.addEventListener(name,()=>{pointer.active=false;pointer.vx=pointer.vy=0;}));
canvas.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')pointer.active=false;});
function drawParticles(time,dt){
  ctx.fillStyle='#080b08';ctx.fillRect(0,0,canvasW,canvasH);const force=.5+effects[4].value*.022,radius=72+effects[4].value*.95;
  const halo=ctx.createRadialGradient(canvasW*.7,canvasH*.5,0,canvasW*.7,canvasH*.5,canvasW*.65);halo.addColorStop(0,'#44351c24');halo.addColorStop(1,'#080b0800');ctx.fillStyle=halo;ctx.fillRect(0,0,canvasW,canvasH);
  for(const p of particles){const drift=reducedMotion?0:7;const tx=p.hx+Math.sin(time*.00022+p.phase)*drift,ty=p.hy+Math.cos(time*.00017+p.phase)*drift;p.vx+=(tx-p.x)*.0009*dt;p.vy+=(ty-p.y)*.0009*dt;
    const dx=p.x-pointer.x,dy=p.y-pointer.y,dist=Math.hypot(dx,dy);
    if(pointer.active&&dist<radius){const falloff=(1-dist/radius)**2,den=Math.max(dist,1);p.vx+=(dx/den*force*.65+pointer.vx*.09)*falloff*dt;p.vy+=(dy/den*force*.65+pointer.vy*.09)*falloff*dt;p.av+=(dx/den*.025+pointer.vx*.002)*falloff;}
    p.vx*=Math.pow(.973,dt);p.vy*=Math.pow(.973,dt);p.av*=Math.pow(.95,dt);p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=(p.av+(reducedMotion?0:Math.sin(time*.00013+p.phase)*.0007))*dt;
    if(p.x<-25){p.x=-25;p.vx=Math.abs(p.vx)*.6;}if(p.x>canvasW+25){p.x=canvasW+25;p.vx=-Math.abs(p.vx)*.6;}if(p.y<-25){p.y=-25;p.vy=Math.abs(p.vy)*.6;}if(p.y>canvasH+25){p.y=canvasH+25;p.vy=-Math.abs(p.vy)*.6;}
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);let alpha=.25+p.depth*.46;if(p.x<canvasW*.47&&p.y>canvasH*.2&&p.y<canvasH*.78)alpha*=.4;if(pointer.active&&dist<radius)alpha=Math.min(alpha+.35,1);ctx.globalAlpha=alpha;ctx.drawImage(beanSprites[p.sprite],-p.size/2,-p.size*.6875,p.size,p.size*1.375);ctx.restore();
  }
  pointer.vx*=.85;pointer.vy*=.85;
}
const resizeObserver=new ResizeObserver(()=>{if(activeEffect===0)setZoom(effects[0].value);if(activeEffect===1)renderDiscs();if(activeEffect===2)glassMetrics();if(activeEffect===4)resizeParticles();});resizeObserver.observe(stage);
function frame(time){
  const dt=clamp((time-lastFrame)/16.667,.4,2);lastFrame=time;
  if(!document.hidden){
    if(autoRunning){const elapsed=(time-autoStart)/1000;
      if(activeEffect===0)setZoom((1-Math.cos(elapsed*.8))*50);
      if(activeEffect===1){const step=Math.floor(elapsed/2);if(step!==autoLastDisc){if(autoLastDisc>=0)moveRecord(1);autoLastDisc=step;}}
      if(activeEffect===2)tilt(Math.sin(elapsed*.7)*.8,Math.cos(elapsed*.8)*.6);
      if(activeEffect===3){setFolder(Math.sin(elapsed*.9)>-.25);const picked=Math.floor(elapsed/1.5)%5;$$('.fan-card').forEach((card,i)=>card.classList.toggle('selected',i===picked));}
      if(activeEffect===4){const x=canvasW*(.55+Math.sin(elapsed*.8)*.3),y=canvasH*(.5+Math.cos(elapsed*1.1)*.32);pointer.vx=clamp(x-pointer.x,-40,40);pointer.vy=clamp(y-pointer.y,-40,40);pointer.x=x;pointer.y=y;pointer.active=true;}
    }
    if(activeEffect===4)drawParticles(time,dt);
  }
  animationFrame=requestAnimationFrame(frame);
}
setZoom(0);setFolder(false);applyFolderSpread();updateControls();animationFrame=requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>cancelAnimationFrame(animationFrame));
window.addEventListener('pageshow',e=>{if(e.persisted){lastFrame=performance.now();animationFrame=requestAnimationFrame(frame);}});
// The still image is replaceable; missing assets fail visibly without hiding controls.
$('.scene-image').addEventListener('error',()=>{toast('场景图片未加载；缩放交互仍可体验。');});
if(reducedMotion)toast('已遵循系统的减少动态效果偏好。自动演示需手动启动。');
