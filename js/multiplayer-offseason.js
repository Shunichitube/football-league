import { applySeasonFinances } from './league.js?v=0.17.27';
import { createContractEvents, createSpecialTrainingOffers, renewalFee } from './development.js?v=0.17.3';
import { manageCpuContracts, selectBestLineup } from './cpu.js?v=0.17.27';
import { createRandom } from './random.js';
import { ACTION_TYPES, applyClubAction } from './rules.js?v=0.17.2';
import { renderPlayerCard } from './ui.js?v=0.17.29';

const SESSION_KEY='football-league:multiplayer-session';
const DRAFT_KEY='football-league:multiplayer-offseason-events';
const app=document.querySelector('#app');

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
function roomId(){return document.querySelector('.multiplayer-room .room-id')?.textContent?.trim()||null;}
function session(id){try{const value=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');return value&&(!id||value.roomId===id)?value:null;}catch{return null;}}
function key(id,playerId){return DRAFT_KEY+':'+id+':'+playerId;}
function readDraft(id,playerId){try{return JSON.parse(localStorage.getItem(key(id,playerId))||'null')||{contract:{},retention:{},special:{}};}catch{return {contract:{},retention:{},special:{}};}}
function saveDraft(id,playerId,draft){localStorage.setItem(key(id,playerId),JSON.stringify(draft));}
function clearDraft(id,playerId){localStorage.removeItem(key(id,playerId));}
async function requestJson(url,options={}){const response=await fetch(url,{headers:{ 'Content-Type':'application/json', ...(session?.()?.playerToken ? { 'x-player-token': session().playerToken } : {}), ...(options.headers||{}) },...options});const text=await response.text();let data=null;try{data=text?JSON.parse(text):null;}catch{throw new Error('APIからJSON以外の応答が返りました。');}if(!response.ok)throw new Error(data?.error||data?.message||('通信エラー '+response.status));return data;}
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));

function prepareLeague(room){
  if(!room?.leagueState?.clubs?.length)return null;
  const league=clone(room.leagueState);
  applySeasonFinances(league);
  for(const club of league.clubs)for(const player of club.roster)player.contractYears--;
  return league;
}
function bundle(league,club){
  return {
    due:club.roster.filter(player=>player.contractYears<=0),
    retention:createContractEvents(club,createRandom(league.seed+':season:'+league.season+':club:'+club.id+':retention')),
    special:createSpecialTrainingOffers(club,createRandom(league.seed+':season:'+league.season+':club:'+club.id+':special-training'))
  };
}
function localContext(room,player){
  const league=prepareLeague(room);if(!league||!player)return null;
  const club=league.clubs.find(candidate=>candidate.multiplayerPlayerId===player.id);
  return club?{league,club,bundle:bundle(league,club)}:null;
}
function selectHtml(group,id,value,options){
  let html='<label>選択<select data-mp-offseason-choice="'+esc(group+':'+id)+'"><option value="">選択してください</option>';
  for(const option of options)html+='<option value="'+option[0]+'" '+(value===option[0]?'selected':'')+'>'+option[1]+'</option>';
  return html+'</select></label>';
}
function budget(context,draft){
  let funds=context.club.funds;
  for(const player of context.bundle.due)if(draft.contract?.[player.id]==='renew')funds-=renewalFee(player);
  for(const event of context.bundle.retention)if(draft.retention?.[event.playerId]==='pay')funds-=event.cost;
  for(const offer of context.bundle.special)if(draft.special?.[offer.playerId]==='execute')funds-=offer.cost;
  return funds;
}
function complete(context,draft){
  return context.bundle.due.every(player=>['renew','release'].includes(draft.contract?.[player.id]))
    &&context.bundle.retention.every(event=>['pay','release'].includes(draft.retention?.[event.playerId]))
    &&context.bundle.special.every(offer=>['execute','skip'].includes(draft.special?.[offer.playerId]));
}
function eventCards(context,draft){
  const byId=id=>context.club.roster.find(player=>player.id===id);
  let html='<h3>年数契約</h3>';
  html+=context.bundle.due.length?context.bundle.due.map(player=>'<article class="candidate">'+renderPlayerCard(player)+'<p>更新費 <b>'+renewalFee(player)+'pt</b></p>'+selectHtml('contract',player.id,draft.contract?.[player.id],[['renew','契約更新'],['release','更新しない']])+'</article>').join(''):'<p class="hint">契約満了者はいません。</p>';
  html+='<h3>不満・先発ボーナス要求</h3>';
  html+=context.bundle.retention.length?context.bundle.retention.map(event=>{const player=byId(event.playerId);return player?'<article class="candidate">'+renderPlayerCard(player)+'<p>'+(event.starter?'先発ボーナス要求':'不満による要求')+'：<b>'+event.cost+'pt</b></p>'+selectHtml('retention',player.id,draft.retention?.[player.id],[['pay','支払う'],['release','支払わない']])+'</article>':'';}).join(''):'<p class="hint">今回の追加要求はありません。</p>';
  html+='<h3>若手の特別特訓</h3>';
  html+=context.bundle.special.length?context.bundle.special.map(offer=>{const player=byId(offer.playerId);return player?'<article class="candidate">'+renderPlayerCard(player)+'<p>特別特訓費用：<b>'+offer.cost+'pt</b></p>'+selectHtml('special',player.id,draft.special?.[player.id],[['execute','実行する'],['skip','見送る']])+'</article>':'';}).join(''):'<p class="hint">今回の特別特訓候補はありません。</p>';
  return html;
}
function marketRelease(league,club,player){club.roster=club.roster.filter(candidate=>candidate.id!==player.id);club.lineup=club.lineup.filter(id=>id!==player.id);if(!player.isInitial){league.releasedPlayers||=[];if(!league.releasedPlayers.some(candidate=>candidate.id===player.id))league.releasedPlayers.push(player);}}
function applyHuman(league,club,events,input){
  const accepted=new Set();
  for(const player of events.due){if(!club.roster.some(candidate=>candidate.id===player.id))continue;const decision=input?.contract?.[player.id];if(decision==='renew'){const result=applyClubAction(club,{type:ACTION_TYPES.RENEW_CONTRACT,clubId:club.id,playerId:player.id});if(!result.ok)throw new Error(result.error||'契約更新に失敗しました。');}else if(decision==='release')marketRelease(league,club,player);else throw new Error(player.name+'の契約判断が未入力です。');}
  for(const event of events.retention){const player=club.roster.find(candidate=>candidate.id===event.playerId);if(!player)continue;const decision=input?.retention?.[event.playerId];if(decision==='pay'){if(club.funds<event.cost)throw new Error(player.name+'の要求を支払う資金が不足しています。');club.funds-=event.cost;}else if(decision==='release')marketRelease(league,club,player);else throw new Error(player.name+'の要求判断が未入力です。');}
  for(const offer of events.special){const player=club.roster.find(candidate=>candidate.id===offer.playerId);if(!player)continue;const decision=input?.special?.[offer.playerId];if(decision==='execute'){if(club.funds<offer.cost)throw new Error(player.name+'の特別特訓費用が不足しています。');club.funds-=offer.cost;accepted.add(player.id);}else if(decision!=='skip')throw new Error(player.name+'の特別特訓判断が未入力です。');}
  selectBestLineup(club);return accepted;
}
function applyCpu(league,club,events){
  manageCpuContracts(club,league);
  const score={SS:9,S:8,A:7,B:6,C:5,D:4,E:3,F:2,G:1};
  for(const event of [...events.retention].sort((a,b)=>(score[b.rank]||0)-(score[a.rank]||0)||Number(b.starter)-Number(a.starter))){const player=club.roster.find(candidate=>candidate.id===event.playerId);if(!player)continue;const mustKeep=club.roster.length<=5||(player.primaryPosition==='GK'&&club.roster.filter(candidate=>candidate.primaryPosition==='GK').length<=1);if(club.funds-event.cost>=50||mustKeep)club.funds=Math.max(0,club.funds-event.cost);else marketRelease(league,club,player);}
  const accepted=new Set();for(const offer of events.special){const player=club.roster.find(candidate=>candidate.id===offer.playerId);if(player&&club.funds-offer.cost>=50){club.funds-=offer.cost;accepted.add(player.id);}}selectBestLineup(club);return accepted;
}
function resolve(room){
  const league=prepareLeague(room);if(!league)throw new Error('シーズン状態を取得できません。');
  const acceptedByClub={};
  for(const club of league.clubs){const events=bundle(league,club);let accepted;if(club.controllerType==='CPU')accepted=applyCpu(league,club,events);else{const owner=room.players.find(player=>player.id===club.multiplayerPlayerId);if(!owner?.phaseInput)throw new Error(club.name+'の入力が見つかりません。');accepted=applyHuman(league,club,events,owner.phaseInput);}acceptedByClub[club.id]=[...accepted];}
  return {league,acceptedByClub};
}
async function renderPanel(){
  const id=roomId();if(!id)return;let data;try{data=await requestJson('/api/rooms/'+encodeURIComponent(id));}catch{return;}const room=data?.room||data;const phase=room?.phase;
  document.querySelector('[data-mp-offseason-panel]')?.remove();
  if(!['offseason-events','offseason-events-ready'].includes(phase))return;
  const s=session(id),player=room.players?.find(candidate=>candidate.id===s?.playerId)||null;if(!player)return;
  const panel=document.createElement('section');panel.className='match-card';panel.dataset.mpOffseasonPanel='true';
  if(phase==='offseason-events-ready'){panel.innerHTML='<p class="eyebrow">OFFSEASON</p><h2>契約・要求・特別特訓</h2><p class="hint">全クラブの入力が完了しました。'+(player.id===room.hostPlayerId?'結果を確定して育成へ進んでください。':'ホストの確定を待っています。')+'</p>'+(player.id===room.hostPlayerId?'<button type="button" data-mp-offseason-resolve="'+esc(id)+'">イベント結果を確定して育成へ</button>':'');}
  else if(player.phaseComplete){panel.innerHTML='<p class="eyebrow">OFFSEASON</p><h2>契約・要求・特別特訓</h2><p class="hint">入力済みです。他クラブの完了を待っています。</p>';}
  else{const context=localContext(room,player);if(!context){panel.innerHTML='<h2>契約・要求・特別特訓</h2><p class="lineup-error">シーズン状態を取得できませんでした。</p>';}else{const draft=readDraft(id,player.id),remaining=budget(context,draft),done=complete(context,draft);panel.innerHTML='<p class="eyebrow">OFFSEASON</p><h2>契約・要求・特別特訓</h2><p class="hint">シングルプレイと同じ条件で処理します。</p><p><b>現在の資金：'+context.club.funds+'pt</b>　選択後：<b>'+remaining+'pt</b></p>'+(remaining<0?'<p class="lineup-error">資金が不足しています。</p>':'')+eventCards(context,draft)+'<button type="button" data-mp-offseason-submit="'+esc(id)+'" '+(done&&remaining>=0?'':'disabled')+'>この内容で作業完了</button>';}}
  const anchor=document.querySelector('.multiplayer-room .season-result-actions');anchor?.insertAdjacentElement('beforebegin',panel);
}
async function submit(id){const s=session(id);if(!s?.playerId)return alert('参加情報が見つかりません。');const data=await requestJson('/api/rooms/'+encodeURIComponent(id));const room=data?.room||data;const player=room.players?.find(candidate=>candidate.id===s.playerId);const context=localContext(room,player);const draft=readDraft(id,s.playerId);if(!context||!complete(context,draft))return alert('未選択の項目があります。');if(budget(context,draft)<0)return alert('資金が不足しています。');try{await requestJson('/api/rooms/'+encodeURIComponent(id)+'/submit-offseason-events',{method:'POST',body:JSON.stringify({playerId:s.playerId,input:draft})});clearDraft(id,s.playerId);document.querySelector('[data-mp-refresh="'+CSS.escape(id)+'"]')?.click();setTimeout(renderPanel,50);}catch(error){alert(error.message);}}
async function resolvePhase(id){const s=session(id);if(!s?.playerId)return alert('参加情報が見つかりません。');try{const prepared=await requestJson('/api/rooms/'+encodeURIComponent(id)+'/prepare-offseason-resolution',{method:'POST',body:JSON.stringify({playerId:s.playerId})});const room={roomId:id,leagueState:prepared.leagueState,players:prepared.players,offseasonState:prepared.offseasonState};const result=resolve(room);await requestJson('/api/rooms/'+encodeURIComponent(id)+'/advance-offseason-events',{method:'POST',body:JSON.stringify({playerId:s.playerId,leagueState:result.league,specialTrainingByClub:result.acceptedByClub})});document.querySelector('[data-mp-refresh="'+CSS.escape(id)+'"]')?.click();setTimeout(renderPanel,50);}catch(error){alert(error.message);}}

document.addEventListener('change',event=>{const raw=event.target.closest('[data-mp-offseason-choice]')?.dataset.mpOffseasonChoice;if(!raw)return;const id=roomId(),s=session(id);if(!id||!s?.playerId)return;const parts=raw.split(':'),group=parts[0],playerId=parts.slice(1).join(':');const draft=readDraft(id,s.playerId);draft[group]||={};if(event.target.value)draft[group][playerId]=event.target.value;else delete draft[group][playerId];saveDraft(id,s.playerId,draft);renderPanel();});
document.addEventListener('click',event=>{const submitId=event.target.closest('[data-mp-offseason-submit]')?.dataset.mpOffseasonSubmit;if(submitId)submit(submitId);const resolveId=event.target.closest('[data-mp-offseason-resolve]')?.dataset.mpOffseasonResolve;if(resolveId)resolvePhase(resolveId);});
let timer=null;const observer=new MutationObserver(mutations=>{if(mutations.some(mutation=>!mutation.target.closest?.('[data-mp-offseason-panel]'))){clearTimeout(timer);timer=setTimeout(renderPanel,40);}});observer.observe(app,{childList:true,subtree:true});renderPanel();