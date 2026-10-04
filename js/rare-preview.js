import {RARE_CHARACTERS,applyRareCharacter} from './rare-characters.js';
import {createPlayer} from './data.js?v=formations-v1';
import {createRandom} from './random.js';
import {playerAppearance} from './avatar-profile.js?v=rare-v2';
import {renderPlayerCard,escapeHtml} from './ui.js?v=formation-points-v7';
import {loadMotionAtlas,drawMotion} from './player-motion.js?v=rare-fit-v5';
const players=[createPlayer('normal-size-reference','MF',createRandom('normal-size-reference')),...Object.keys(RARE_CHARACTERS).map(kind=>applyRareCharacter(createPlayer(kind,'MF',createRandom(kind)),kind,createRandom(kind)))];
const view=document.querySelector('#preview');
view.innerHTML=players.map(p=>`<article>${p.rareCharacter?'':'<h2>通常選手・大きさの比較用</h2>'}${renderPlayerCard(p)}<p>${escapeHtml(p.scoutComment||'')}</p><canvas width="480" height="480" aria-label="${p.name}の動作"></canvas></article>`).join('');
let motion='idle',direction='right';
document.querySelector('#actions').innerHTML=Object.entries({idle:'待機',run:'移動',dribble:'ドリブル',shoot:'シュート',celebrate:'喜び'}).map(([key,label])=>`<button data-motion="${key}" aria-pressed="${key===motion}">${label}</button>`).join('')+'<button id="direction">向き：右</button>';
let started=performance.now();
document.querySelector('#actions').addEventListener('click',e=>{
  if(e.target.dataset.motion){motion=e.target.dataset.motion;started=performance.now();document.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.motion===motion));}
  if(e.target.id==='direction'){direction=direction==='right'?'left':'right';e.target.textContent=`向き：${direction==='right'?'右':'左'}`;}
});
const atlas=await loadMotionAtlas(),canvases=[...view.querySelectorAll('canvas')];
function tick(now){canvases.forEach((canvas,i)=>drawMotion(canvas.getContext('2d'),atlas,motion,(now-started)/1000,{appearance:playerAppearance(players[i]),direction,ball:motion==='dribble'}));requestAnimationFrame(tick);}
requestAnimationFrame(tick);
