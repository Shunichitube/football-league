import {loadMotionAtlas} from './player-motion.js?v=motion-ui-v24';
import {playerAppearance} from './avatar-profile.js?v=appearance-v29';
import {drawAvatar} from './player-avatar.js?v=modular-motion-v4';
import {celebrationTexture} from './avatar-celebration.js?v=motion-ui-v24';
import {fixedDisplayEnabled,setFixedDisplay} from './display-settings.js?v=fixed-display-v1';

const AUDIO_KEY='football-league:audio-settings';
export function normalizeAudio(value={}){
 const volume=v=>Number.isFinite(Number(v))?Math.max(0,Math.min(100,Number(v))):70;
 return {bgm:volume(value?.bgm??70),se:volume(value?.se??70)};
}
export function growthCelebrates(row){
 return !row.retired&&!!(row.focus||row.awakeningKeys?.length||row.specialTrainingResult||row.hatched||row.learnedAbility)&&
  (row.changes||[]).some(change=>change.increased||change.toValue>change.fromValue);
}
let assets;
async function celebrationAssets(){
 assets??=loadMotionAtlas();
 try{return await assets;}catch(error){assets=null;throw error;}
}
export function createGameExperience({dialogs,onExit}){
 let audio;try{audio=normalizeAudio(JSON.parse(localStorage.getItem(AUDIO_KEY)||'{}'));}catch{audio=normalizeAudio();}
 let active=null,queue=[],settings=null,growthRaf=0,growthGeneration=0,awardRaf=0,awardGeneration=0;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const sync=()=>dialogs.sync();
 function openNext(){
  if(active||!queue.length)return;
  const item=queue.shift(),backdrop=document.createElement('div'),panel=document.createElement('section');
  backdrop.className='experience-backdrop';panel.className=`experience-popup ${item.won===false?'is-lost':''}`;
  panel.dataset.uiDialog='game-feedback';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-label',item.title);
  const title=document.createElement('h2');title.textContent=item.title;panel.append(title);
  let canvas;
  if(item.player){
   canvas=document.createElement('canvas');canvas.width=420;canvas.height=550;canvas.setAttribute('aria-label',item.player.name);panel.append(canvas);
   const name=document.createElement('p');name.textContent=item.player.name;panel.append(name);
  }
  if(item.subtitle){const text=document.createElement('p');text.textContent=item.subtitle;panel.append(text);}
  if(item.won){
   const confetti=document.createElement('div');confetti.className='experience-confetti';confetti.setAttribute('aria-hidden','true');
   for(let i=0;i<48;i++){const piece=document.createElement('i');piece.style.cssText=`--x:${(i*37)%100}%;--delay:${-(i%15)/10}s;--color:${['#ffe89b','#7be5c0','#ff8fbc','#b4afff'][i%4]};`;confetti.append(piece);}panel.append(confetti);
  }
  dialogs.beforeRender();document.body.append(backdrop,panel);
  let timer=0,raf=0,dead=false;
  const finish=notify=>{
   if(dead)return;dead=true;clearTimeout(timer);cancelAnimationFrame(raf);dialogs.beforeRender();backdrop.remove();panel.remove();active=null;sync();
   if(notify)item.onDone?.();openNext();
  };
  active={item,dispose:()=>finish(false)};sync();
  if(canvas)celebrationAssets().then(atlas=>{
   if(dead)return;
   const paint=now=>{
    if(dead)return;const ctx=canvas.getContext('2d');
    if(item.won){ctx.clearRect(0,0,420,550);const im=celebrationTexture(atlas,playerAppearance(item.player),{kit:item.club.color,goalkeeper:item.player.primaryPosition==='GK',pose:reduced()?1:Math.floor(now/280)%4});ctx.drawImage(im,0,0);}
    else {const portrait=document.createElement('canvas');portrait.width=300;portrait.height=470;drawAvatar(portrait.getContext('2d'),atlas.avatar,playerAppearance(item.player),{kit:item.club.color,goalkeeper:item.player.primaryPosition==='GK'});ctx.clearRect(0,0,420,550);ctx.drawImage(portrait,60,40);}
    if(item.won&&!reduced())raf=requestAnimationFrame(paint);
   };paint(performance.now());
  }).catch(error=>console.warn('Feedback avatar unavailable',error));
  timer=setTimeout(()=>finish(true),3000);
 }
 function enqueue(item){queue.push(item);openNext();return ()=>{queue=queue.filter(row=>row!==item);if(active?.item===item)active.dispose();};}
 function closeSettings(){if(!settings)return;dialogs.beforeRender();settings.backdrop.remove();settings.panel.remove();settings=null;sync();}
 const gear=document.createElement('button');gear.className='game-settings-button';gear.type='button';gear.textContent='⚙ 設定';gear.setAttribute('aria-label','ゲーム設定');document.body.append(gear);
 gear.addEventListener('click',()=>{
  if(settings)return;
  const backdrop=document.createElement('div'),panel=document.createElement('section');backdrop.className='settings-backdrop';panel.className='game-settings-panel';panel.dataset.uiDialog='game-settings';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','ゲーム設定');
  panel.innerHTML='<h2>設定</h2><label>BGM <output data-volume="bgm"></output><input type="range" min="0" max="100" step="1" data-audio="bgm"></label><label>効果音 <output data-volume="se"></output><input type="range" min="0" max="100" step="1" data-audio="se"></label><button type="button" data-settings-return data-dialog-close>ゲームに戻る</button><button type="button" class="subtle" data-settings-exit>ゲーム終了</button><p>ゲーム終了でタイトルへ戻ります。</p>';
  panel.querySelector('h2').insertAdjacentHTML('afterend','<label class="fixed-display-option"><input type="checkbox" data-fixed-display>画面比率を固定する（16:9）</label><p>2560×1440を基準に、FHD・4Kでも同じ配置で拡大・縮小します。画面に合わせて余白が入ります。</p>');
  const displayInput=panel.querySelector('[data-fixed-display]');displayInput.checked=fixedDisplayEnabled();
  displayInput.addEventListener('change',()=>setFixedDisplay(displayInput.checked));
  for(const input of panel.querySelectorAll('[data-audio]')){
   const key=input.dataset.audio;input.value=audio[key];panel.querySelector(`[data-volume="${key}"]`).value=`${audio[key]}%`;
   input.addEventListener('input',()=>{audio=normalizeAudio({...audio,[key]:input.value});panel.querySelector(`[data-volume="${key}"]`).value=`${audio[key]}%`;try{localStorage.setItem(AUDIO_KEY,JSON.stringify(audio));}catch{}document.dispatchEvent(new CustomEvent('football-league:audio-settings',{detail:{...audio}}));});
  }
  panel.querySelector('[data-settings-return]').addEventListener('click',closeSettings);
  panel.querySelector('[data-settings-exit]').addEventListener('click',()=>{closeSettings();onExit();});
  dialogs.beforeRender();document.body.append(backdrop,panel);settings={backdrop,panel};sync();
 });
 function stopAwards(){awardGeneration++;cancelAnimationFrame(awardRaf);awardRaf=0;}
 function stopGrowth(){growthGeneration++;cancelAnimationFrame(growthRaf);growthRaf=0;}
 return {
  syncHeader(header){
   if(!header){document.body.append(gear);return;}
   let actions=header.querySelector('.header-actions');
   if(!actions){actions=document.createElement('span');actions.className='header-actions';header.append(actions);}
   actions.append(gear);
  },
  showDraft(player,won,club){return enqueue({title:won?'獲得しました！':'獲得できませんでした。',player,won,club});},
  showLeagueStart(season,onDone){return enqueue({title:'リーグ戦スタート！',subtitle:`第${season}シーズン · 全10試合`,onDone});},
  reset(){queue=[];active?.dispose();closeSettings();stopGrowth();stopAwards();},
  syncMvp(winner){
   stopAwards();const generation=awardGeneration;
   const node=document.querySelector('.results-winner.is-mvp, .award-card.mvp');
   if(!winner||!node)return;
   celebrationAssets().then(atlas=>{
    if(generation!==awardGeneration||!node.isConnected)return;
    const canvas=document.createElement('canvas');canvas.width=420;canvas.height=550;
    canvas.className='mvp-joy-avatar';canvas.setAttribute('aria-label',`${winner.p.name}が喜んでいます`);
    const portrait=node.querySelector('img, .mvp-joy-avatar');if(portrait)portrait.replaceWith(canvas);else node.append(canvas);
    let last=-1;
    const paint=now=>{
     if(generation!==awardGeneration||!canvas.isConnected)return;
     const pose=reduced()?1:Math.floor(now/280)%4;
     if(pose!==last){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,420,550);ctx.drawImage(celebrationTexture(atlas,playerAppearance(winner.p),{kit:winner.c.color,goalkeeper:winner.p.primaryPosition==='GK',pose}),0,0);last=pose;}
     if(!reduced())awardRaf=requestAnimationFrame(paint);
    };paint(performance.now());
   }).catch(error=>console.warn('MVP celebration unavailable',error));
  },
  syncGrowth(rows,club){
   stopGrowth();const generation=growthGeneration;
   const targets=rows.filter(growthCelebrates).map(row=>({row,node:document.querySelector(`[data-growth-player="${CSS.escape(row.player.id)}"] .squad-avatar`)})).filter(x=>x.node);
   if(!targets.length)return;
   celebrationAssets().then(atlas=>{
    if(generation!==growthGeneration)return;
    const actors=targets.filter(x=>x.node.isConnected).map(({row,node})=>{
     const canvas=document.createElement('canvas');canvas.width=420;canvas.height=550;canvas.className='growth-joy-avatar';canvas.setAttribute('aria-hidden','true');node.querySelector('img')?.replaceWith(canvas);return {row,canvas};
    });
    let last=-1;
    const paint=now=>{
     if(generation!==growthGeneration)return;
     const pose=reduced()?1:Math.floor(now/280)%4;
     if(pose!==last){for(const {row,canvas} of actors){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,420,550);ctx.drawImage(celebrationTexture(atlas,playerAppearance(row.player),{kit:club.color,goalkeeper:row.player.primaryPosition==='GK',pose}),0,0);}last=pose;}
     if(!reduced())growthRaf=requestAnimationFrame(paint);
    };paint(performance.now());
   }).catch(error=>console.warn('Growth celebration unavailable',error));
  }
 };
}
