import { playTrainingCinematic } from './training-cinematic.js?v=3';
import { renderSeasonResults } from './season-results-ui.js?v=3';
import { createInitialState } from './app-state.js';
import { createAuctionClock } from './auction-clock.js';
import { dialogs } from './dialogs.js';
import { openLot, raiseBid, passLot, tickLot } from './live-auction.js?v=0.21.1';
import { auctionAvatar, renderLiveAuction } from './auction-ui.js?v=complete-modal-v1-development-room-v1';
import { applySeasonFinances, awards, clubAchievements, createLeague, finalizeSeason, recordDraftAcquisition, simulateRemainingSeason, standings as singleStandings, startNextSeason } from './league.js?v=0.17.29';
import { displayPlayer, POSITION_LABELS, STAT_LABELS } from './data.js?v=appearance-v21';
import { createRandom } from './random.js';
import { createAuctionPool, createDraftPool, resolveDraftActions } from './market.js?v=0.22.0';
import { renderContractPlayerCard, configureRename, escapeHtml as e, renderLineupEditor, renderSquadComparison, renderMatchDetail, renderPlayerCard, renderRosterPanel, renderSeasonMatchList, renderSeasonPlayerStats } from './ui.js?v=match-back-top-v1';
import { decideCpuDraftAction, manageCpuContracts, prepareCpuClubs, prepareCpuMarketSpace, processLeagueOffseason, selectBestLineup } from './cpu.js?v=0.17.30';
import { ACTION_TYPES, applyClubAction, createLineupPlacement, validateLineup } from './rules.js?v=0.17.2';
import { RoomAdapter } from './room-adapter.js?v=0.20.0';
import { classifyScreens } from './screen-classifier.js';
import { createContractEvents, createSpecialTrainingOffers, renewalFee, trainingSkills } from './development.js?v=0.17.31';
import { exportSave, importSave, loadSlot, saveSlot, slotInfo } from './storage.js?v=0.17.27';
const clickHandlers=[];
const onGameClick=(scope,handler)=>clickHandlers.push({scope,handler});
let roomAdapter=null;
const standings=league=>roomAdapter?.active?roomAdapter.standings(league,singleStandings):singleStandings(league);
const app = document.querySelector('#app');
let s = createInitialState();
function returnToTitle() {
  roomAdapter?.leave();
  s = createInitialState();
}

const me=()=>s.mode==='room'?s.league.clubs.find(c=>c.id===s.league.humanClubId):s.league.clubs.find(c=>c.controllerType==='HUMAN')||s.league.clubs.find(c=>c.id===s.league.humanClubId);const player=(p,options)=>renderPlayerCard(p,options);const positionLabel=position=>POSITION_LABELS[position]||position;
const POSITION_SORT_ORDER={GK:0,DF:1,MF:2,FW:3},RANK_SORT_ORDER={SS:0,S:1,A:2,B:3,C:4,D:5,E:6,F:7,G:8};
function sortPlayers(players,mode='position'){return [...players].map((player,index)=>({player,index})).sort((a,b)=>{const pa=a.player,pb=b.player,pos=(POSITION_SORT_ORDER[pa.primaryPosition]??99)-(POSITION_SORT_ORDER[pb.primaryPosition]??99),rank=RANK_SORT_ORDER[displayPlayer(pa).overallRank]-RANK_SORT_ORDER[displayPlayer(pb).overallRank],age=pa.age-pb.age,contract=pa.contractYears-pb.contractYears,joined=a.index-b.index;if(mode==='overall')return rank||pos||age||contract||joined;if(mode==='age')return age||pos||rank||contract||joined;if(mode==='contract')return contract||pos||rank||age||joined;return pos||rank||age||contract||joined}).map(row=>row.player)}
function sortControl(scope,value){return `<div class="phase-sort-heading"><span></span><label>並び順<select data-player-sort="${scope}"><option value="position" ${value==='position'?'selected':''}>ポジション順</option><option value="overall" ${value==='overall'?'selected':''}>総合ランク順</option><option value="age" ${value==='age'?'selected':''}>年齢順</option><option value="contract" ${value==='contract'?'selected':''}>契約年数順</option></select></label></div>`}
function head(){let c=me(),r=standings(s.league).find(x=>x.club.id===c.id);return `<header><a data-nav="home" class="brand">FOOTBALL <b>LEAGUE</b></a><span>シーズン ${s.league.season} / 10</span><span><i class="club-color-dot" style="--club:${e(c.color)}"></i>${e(c.name)}・${r.rank}位・${c.funds}pt</span>${s.mode==='room'?`<span><button data-room="leave" class="subtle">タイトルへ</button></span>`:''}</header>${s.mode==='room'?roomSync():''}`}
function title(){return `<main class="title arena-title" aria-label="FOOTBALL LEAGUE タイトル画面"><span class="arena-crest" aria-hidden="true">♛</span><h1>FOOTBALL<b>LEAGUE</b></h1><button data-a="setup">新しく始める</button><button data-stage19="loadTitle" class="subtle">続きから</button><button data-room="open" class="subtle">マルチプレイ</button><button type="button" class="arena-motion" data-arena-motion aria-pressed="false">演出を一時停止</button></main>`}
function setup(){return `<main class="setup"><h2>クラブを作成</h2><label>クラブ名<input id="name" placeholder="東京ファイブ"></label><label>チームカラー<input id="color" type="color" value="#4ade80"></label><label>シード（任意）<input id="seed" placeholder="同じ値なら同じ展開"></label><button data-a="start">ゲーム開始</button><button data-a="title" class="subtle">戻る</button></main>`}
function recordDraftAcquisitions(d,result){if(!d||!result?.acquired?.length)return;d.history ||= [];for(const row of result.acquired){if(d.history.some(item=>item.player.id===row.player.id))continue;d.history.push({round:d.round,clubId:row.clubId,player:row.player,contested:!!row.contested,contenderIds:[...(row.contenderIds||[])]});if(s.league)recordDraftAcquisition(s.league,row.clubId,row.player);}}
function renderDraftHistory(d){const history=d?.history||[];if(!history.length)return '<section class="draft-history"><div class="draft-history-heading"><h3>ここまでの指名結果</h3><span>まだ獲得選手はいません</span></div></section>';const humanId=me().id,rows=history.map(row=>{const club=s.league.clubs.find(candidate=>candidate.id===row.clubId),shown=displayPlayer(row.player),losers=(row.contenderIds||[]).filter(id=>id!==row.clubId).map(id=>s.league.clubs.find(candidate=>candidate.id===id)).filter(Boolean),lottery=row.contested?`<div class="draft-lottery-result"><span class="draft-lottery">抽選</span><small>外れ：${losers.length?losers.map(loser=>`<i class="club-color-dot" style="--club:${e(loser.color||'#64748b')}"></i>${e(loser.name)}`).join(' / '):'なし'}</small></div>`:'—';return `<tr class="${row.clubId===humanId?'you':''}"><td><b>${row.round}巡</b></td><td><i class="club-color-dot" style="--club:${e(club?.color||'#64748b')}"></i>${e(club?.name||'不明')}</td><td><strong>${e(row.player.name)}</strong></td><td>${e(positionLabel(row.player.primaryPosition))}</td><td>${row.player.age}歳</td><td><b class="draft-rank">${e(shown.overallRank)}</b></td><td>${lottery}</td></tr>`}).join('');return `<section class="draft-history"><div class="draft-history-heading"><h3>ここまでの指名結果</h3><span>${history.length}名獲得</span></div><div class="draft-history-table-wrap"><table class="draft-history-table"><thead><tr><th>巡</th><th>獲得クラブ</th><th>選手</th><th>POS</th><th>年齢</th><th>総合</th><th>抽選結果</th></tr></thead><tbody>${rows}</tbody></table></div></section>`}
function renderAuctionHistory(a){const history=a?.history||[];if(!history.length)return '<section class="draft-history"><div class="draft-history-heading"><h3>ここまでのオークション結果</h3><span>まだ結果はありません</span></div></section>';const humanId=me().id,rows=history.map((row,index)=>{const club=row.winnerClubId?s.league.clubs.find(candidate=>candidate.id===row.winnerClubId):null,shown=displayPlayer(row.player);return `<tr class="${row.winnerClubId===humanId?'you':''}"><td><b>${index+1}</b></td><td><strong>${e(row.player.name)}</strong></td><td>${e(positionLabel(row.player.primaryPosition))}</td><td>${row.player.age}歳</td><td><b class="draft-rank">${e(shown.overallRank)}</b></td><td>${club?`<i class="club-color-dot" style="--club:${e(club.color||'#64748b')}"></i>${e(club.name)}`:'<span class="hint">落札なし</span>'}</td><td>${club?`<b>${row.bid}pt</b>`:'—'}</td></tr>`}).join('');return `<section class="draft-history"><div class="draft-history-heading"><h3>ここまでのオークション結果</h3><span>${history.length}件</span></div><div class="draft-history-table-wrap"><table class="draft-history-table"><thead><tr><th>#</th><th>選手</th><th>POS</th><th>年齢</th><th>総合</th><th>落札クラブ</th><th>落札額</th></tr></thead><tbody>${rows}</tbody></table></div></section>`}
function renderDraftAvatar(selected){return `<div class="draft-stage-avatar" aria-live="polite">${selected?`<img src="${auctionAvatar(selected)}" alt="${e(selected.name)}のアバター">`:'<p class="hint">カードを選択</p>'}</div>`}
function draft(){let d=s.draft,c=me();if(d.completed)return `${head()}<main class="phase-complete-screen"><section class="phase-complete-modal" role="dialog" aria-modal="true" aria-label="ドラフト完了"><p>ドラフト完了</p><h2>全4巡の指名が終了しました</h2><p class="hint">指名結果を確認してからオークションへ進めます。</p><button data-a="toggleDraftHistory" class="subtle">指名結果を見る</button><button data-a="toAuction">オークションへ</button></section></main>`;let canPick=d.pendingClubIds.includes(c.id),simultaneous=d.mode==='SIMULTANEOUS',pool=sortPlayers(d.pool,s.draftSort),selected=pool.find(p=>p.id===s.selectedDraftPlayerId)||pool[0];if(selected&&s.selectedDraftPlayerId!==selected.id)s.selectedDraftPlayerId=selected.id;return `${head()}<main><p class="eyebrow">シーズン${s.league.season} ドラフト・第${d.round}/4巡</p><div class="screen-heading"><h2>${simultaneous?'完全同時指名':'前年順位順指名'}</h2></div><p class="hint">${simultaneous?'6クラブが同時に指名し、重複時だけ抽選します。外れたクラブは再指名します。':'前年順位に基づく指名順で、1クラブずつ指名します。'}${e(s.note)}</p><p>資金 <b>${c.funds}pt</b>・登録 ${c.roster.length}/12人・指名料 <b>5pt</b></p>${renderDraftAvatar(selected)}${sortControl('draft',s.draftSort)}<section class="candidate-grid draft-card-grid">${pool.map(p=>{const active=selected?.id===p.id;return `<article class="candidate draft-choice-card ${active?'is-selected':''}" data-draft-select="${e(p.id)}" tabindex="0" aria-pressed="${active?'true':'false'}">${active?'<span class="draft-selected-badge">選択中</span>':''}${player(p,{specialHover:true})}<p class="scout-comment"><b>スカウト：</b>${e(p.scoutComment)}</p></article>`}).join('')}</section><section class="draft-action-dock"><button data-p="${selected?e(selected.id):''}" data-draft-confirm ${canPick&&selected?'':'disabled'}>決定</button><button data-a="skipDraft" class="subtle" ${canPick?'':'disabled'}>辞退</button><button data-a="toggleDraftHistory" class="subtle">ドラフト結果</button><button data-stage10="roster" class="subtle">所属一覧</button></section></main>`}
function auction(){return renderLiveAuction(s,me(),player,e,head());}
function table(){let humanId=me().id,rows=standings(s.league).map(r=>`<tr class="${r.club.id===humanId?'you':''}"><td>${r.rank}</td><td><i class="club-color-dot" style="--club:${e(r.club.color)}"></i>${e(r.club.name)}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td>${r.goalsFor}</td><td>${r.goalsAgainst}</td><td>${r.goalDifference}</td><td>${r.points}</td></tr>`).join('');return `${head()}<main><h2>順位表</h2><div class="table-wrap"><table><thead><tr><th>順位</th><th>クラブ</th><th>試合</th><th>勝</th><th>分</th><th>敗</th><th>得点</th><th>失点</th><th>得失</th><th>勝点</th></tr></thead><tbody>${rows}</tbody></table></div><button data-nav="home" class="subtle">戻る</button></main>`}
function home(){let c=me(),lineup=validateLineup(c),remaining=Math.max(0,11-s.league.currentRound);if(s.league.completed)return seasonResults();return `${head()}<main><section class="hero" style="--club:${c.color}"><p>残り${remaining}節</p><h2>編成と戦術を決めてシーズンを開始</h2>${lineup.ok?'<button data-a="season">シーズンをシミュレート</button>':`<p class="lineup-error">${e(lineup.error)}</p><button data-nav="squad">編成を確認する</button>`}</section><nav><button data-nav="squad">編成</button><button data-nav="table">順位表</button><button data-nav="stats">個人成績</button></nav></main>`}
function squad(){let c=me();return `${head()}<main style="--club:${e(c.color)}"><div class="squad-heading-row"><div class="squad-heading-copy"><h2>編成</h2></div><div class="squad-actions"><button data-nav="home" class="subtle">戻る</button></div></div>${renderLineupEditor(c,s.selectedLineupPlayerId,s.lineupMessage,s.lineupError,s.benchSort,renderTactics())}</main>`}
function stats(){const c=me();return `${head()}<main><p class="eyebrow">シーズン${s.league.season}</p><h2>所属選手の個人成績</h2>${renderSeasonPlayerStats(c)}<button data-nav="${s.league.completed?'seasonResults':'home'}" class="subtle">戻る</button></main>`}
function seasonResults(){const c=me();return head()+renderSeasonResults({state:s,club:c,rows:standings(s.league),trophy:awards(s.league),escapeHtml:e,avatar:auctionAvatar,matches:renderSeasonMatchList(s.league.seasonResults||[],c.id),stats:renderSeasonPlayerStats(c),actions:s.mode==='room'?(roomAdapter.room.phase==='season-result'?'<button data-stage4="offseason">結果確認完了</button>':''):renderCompletedSeasonActions()});}

function matchDetail(){return `${head()}${renderMatchDetail(s.match)}`}
function draftEligibleIds(){let humanId=me().id;return s.league.clubs.filter(club=>club.funds>=5&&club.roster.length<12&&(!s.draft?.humanDeclined||club.id!==humanId)).map(club=>club.id)}
function startAuction(){const season=s.league.season;s.draftHistoryOpen=false;s.auctionHistoryOpen=false;s.league.clubs.forEach(club=>delete club.reserveAuctionSlot);s.auction={pool:createAuctionPool(s.league.seed,season,s.league.releasedPlayers),i:0,rng:createRandom(`${s.league.seed}:season:${season}:auction`),history:[],completed:false};openLot(s.auction,s.league.clubs,s.league.seed);s.view='auction';s.note=`シーズン${season}ドラフト終了。競売を開始します。`}
function draftMode(round){return s.league.season===1||round===1?'SIMULTANEOUS':'ORDERED'}
function orderedDraftIds(round){const ranks=s.league.previousStandings||standings(s.league).map(row=>({clubId:row.club.id,rank:row.rank})),descending=round===2||round===4;return [...ranks].sort((a,b)=>descending?b.rank-a.rank:a.rank-b.rank).map(row=>row.clubId).filter(id=>draftEligibleIds().includes(id))}
function prepareDraftRound(d){d.mode=draftMode(d.round);if(d.mode==='SIMULTANEOUS'){d.pendingClubIds=draftEligibleIds();return}d.order=orderedDraftIds(d.round);d.orderIndex=0;d.pendingClubIds=d.order.length?[d.order[0]]:[]}
function nextOrderedPick(d){d.orderIndex++;while(d.orderIndex<d.order.length&&!draftEligibleIds().includes(d.order[d.orderIndex]))d.orderIndex++;d.pendingClubIds=d.orderIndex<d.order.length?[d.order[d.orderIndex]]:[]}
function advanceDraftRound(){let d=s.draft;if(d.pendingClubIds.length)return false;if(d.round>=4){d.completed=true;s.note='ドラフトが終了しました。指名結果を確認してオークションへ進んでください。';return true}d.round++;prepareDraftRound(d);return false}
function runCpuDraft(){let guard=0;while(s.view==='draft'&&guard++<100){let d=s.draft,humanId=me().id;if(d.pendingClubIds.includes(humanId))break;if(!d.pendingClubIds.length){if(advanceDraftRound())break;continue}const actions=d.pendingClubIds.map(id=>s.league.clubs.find(club=>club.id===id)).filter(club=>club?.controllerType==='CPU').map(club=>decideCpuDraftAction(club,d.pool,d.rng)).filter(Boolean);const result=resolveDraftActions({clubs:s.league.clubs,candidates:d.pool,pendingClubIds:d.pendingClubIds,actions,rng:d.rng});recordDraftAcquisitions(d,result);d.pool=result.candidates;if(d.mode==='ORDERED')nextOrderedPick(d);else d.pendingClubIds=result.pendingClubIds;if(!result.acquired.length&&result.declinedIds.length===0&&d.mode==='SIMULTANEOUS')d.pendingClubIds=[]}}
function beginDraft(){const season=s.league.season;s.draftHistoryOpen=false;s.selectedDraftPlayerId=null;s.league.releasePhaseOpen=false;s.match=null;s.seasonSimulation=null;s.league.clubs.forEach(club=>{club.reserveAuctionSlot=club.controllerType==='CPU'&&12-club.roster.length>=2});s.draft={pool:createDraftPool(s.league.seed,season),round:1,rng:createRandom(`${s.league.seed}:season:${season}:draft`),pendingClubIds:[],humanDeclined:false,history:[],completed:false};prepareDraftRound(s.draft);s.view='draft';s.note=`シーズン${season}ドラフトを開始します。`;runCpuDraft()}
function pickDraft(p){let d=s.draft,humanId=me().id;if(!d.pendingClubIds.includes(humanId))return;const actions=d.pendingClubIds.map(id=>s.league.clubs.find(club=>club.id===id)).map(club=>club?.controllerType==='CPU'?decideCpuDraftAction(club,d.pool,d.rng):club?.id===humanId?{type:ACTION_TYPES.DRAFT_PICK,clubId:club.id,playerId:p.id}:null).filter(Boolean);const result=resolveDraftActions({clubs:s.league.clubs,candidates:d.pool,pendingClubIds:d.pendingClubIds,actions,rng:d.rng});recordDraftAcquisitions(d,result);d.pool=result.candidates;const acquired=result.acquired.find(row=>row.clubId===humanId);if(d.mode==='ORDERED')nextOrderedPick(d);else d.pendingClubIds=result.pendingClubIds;if(!acquired&&d.mode==='SIMULTANEOUS'){s.note=`${p.name}は競合抽選で外れました。外れクラブとして再指名してください。`;return}s.note=`${p.name}を${acquired?.contested?'競合抽選で':''}獲得しました。`;runCpuDraft()}
function bid(amount){if(amount===0)passLot(s.auction,me().id);else raiseBid(s.auction,s.league.clubs,me().id,amount);}
function refreshAuctionState(){
  const room=app.querySelector('main.auction-room');
  if(!room)return render();
  dialogs.beforeRender();
  const fresh=new DOMParser().parseFromString(auction(),'text/html');
  for(const selector of ['.auction-price','.auction-leader','.auction-live p','.auction-controls','.auction-desks']){
    const old=room.querySelector(selector),next=fresh.querySelector(selector);
    if(old&&next&&old.outerHTML!==next.outerHTML)old.replaceWith(next);
  }
  dialogs.sync();
  updateRoomStatus();
}
function updateAuction() {
  if(s.view!=='auction'||!s.auction||s.auction.completed)return;
  const a=s.auction,now=Date.now();
  if(s.mode!=='room'){
    if(!a.live)openLot(a,s.league.clubs,s.league.seed,now);
    if(a.live.closed&&now>=a.live.nextAt){
      a.i++;
      if(a.i>=a.pool.length){a.completed=true;s.league.releasedPlayers=[];prepareCpuClubs(s.league);}
      else openLot(a,s.league.clubs,s.league.seed,now);
      render();
    }else{
      const lot=a.live,previousHigh=lot.high,previousClosed=lot.closed,previousPasses=lot.passed.length;
      if(tickLot(a,s.league,now)&&(lot.high!==previousHigh||lot.closed!==previousClosed||lot.passed.length!==previousPasses)){
        if(lot.closed)render();else refreshAuctionState();
      }
    }
  }
  const clock=document.querySelector('[data-auction-time]');
  if(clock){const remaining=a.live?.closed?0:Math.max(0,Math.ceil(((a.live?.endAt||now)-now-(s.mode==='room'?(roomAdapter.clockOffset||0):0))/1000));clock.textContent=`0:${String(remaining).padStart(2,'0')}`;clock.classList.toggle('urgent',remaining<=5);}
}
const auctionClock=createAuctionClock(updateAuction);
onGameClick('app',ev=>{const resultTab=ev.target.closest('[data-result-tab]')?.dataset.resultTab;if(resultTab){s.resultTab=resultTab;return render()}let draftSelect=ev.target.closest('[data-draft-select]')?.dataset.draftSelect,a=ev.target.closest('[data-a]')?.dataset.a,n=ev.target.closest('[data-nav]')?.dataset.nav,p=ev.target.closest('[data-p]')?.dataset.p,m=ev.target.closest('[data-season-match]')?.dataset.seasonMatch;if(draftSelect){s.selectedDraftPlayerId=draftSelect;return render()}if(m!==undefined){s.match=s.league.seasonResults[Number(m)];s.view='matchDetail';return render()}if(n){s.view=n;if(n!=='squad'){s.selectedLineupPlayerId=null;s.lineupMessage='';s.lineupError=false}return render()}if(p){let x=s.draft.pool.find(q=>q.id===p);if(x&&me().funds>=5&&me().roster.length<12)pickDraft(x);return render()}if(a==='toggleDraftHistory'){s.draftHistoryOpen=true;return render()}if(a==='toggleAuctionHistory'){s.auctionHistoryOpen=true;return render()}if(a==='toAuction'){startAuction();return render()}if(a==='setup'||a==='title'){if(a==='title')returnToTitle();else s.view=a;return render()}if(a==='start'){let name=document.querySelector('#name').value.trim();if(!name)return alert('クラブ名を入力してください。');let seed=document.querySelector('#seed').value.trim()||String(Date.now());s.league=createLeague({name,color:document.querySelector('#color').value,seed});s.offseasonComplete=false;beginDraft();return render()}if(a==='skipDraft'){s.selectedDraftPlayerId=null;s.draft.humanDeclined=true;if(s.draft.mode==='ORDERED')nextOrderedPick(s.draft);else s.draft.pendingClubIds=s.draft.pendingClubIds.filter(id=>id!==me().id);runCpuDraft();return render()}if(a==='bid'||a==='pass'){let n=a==='pass'?0:Number(document.querySelector('#bid').value);if(n<0||n>me().funds)return alert('入札額を確認してください。');bid(n);return render()}if(a==='squad'){s.view='squad';return render()}if(a==='season'){let lineup=validateLineup(me());if(!lineup.ok)return alert(lineup.error);s.seasonSimulation=simulateRemainingSeason(s.league);if(s.league.season===10)finalizeSeason(s.league);s.view='seasonResults';return render()}});

// Stage 4 off-season screens are layered onto the existing season flow.
const rankScore = { SS: 9, S: 8, A: 7, B: 6, C: 5, D: 4, E: 3, F: 2, G: 1 };
const marketRelease = (league, club, player) => { club.roster=club.roster.filter(candidate=>candidate.id!==player.id); club.lineup=club.lineup.filter(id=>id!==player.id); if(!player.isInitial){league.releasedPlayers ||= []; if(!league.releasedPlayers.some(candidate=>candidate.id===player.id)) league.releasedPlayers.push(player);} };
const wouldBreakTeam = (club, player) => club.roster.length <= 5 || (player.primaryPosition === 'GK' && club.roster.filter(candidate=>candidate.primaryPosition==='GK').length <= 1);
function decrementContracts(){for(const club of s.league.clubs) for(const player of club.roster) player.contractYears--;}
function finishOffseasonEvents(){s.specialOffers=(s.specialOffers||[]).filter(row=>me().roster.some(player=>player.id===row.playerId));s.view='development'}
function runCpuOffseasonEvents(eventsByClub, offersByClub){
  s.cpuSpecialTraining = new Map();
  for(const club of s.league.clubs.filter(club=>club.controllerType==='CPU')){
    manageCpuContracts(club,s.league);
    const events=[...(eventsByClub.get(club.id)||[])].sort((a,b)=>rankScore[b.rank]-rankScore[a.rank] || Number(b.starter)-Number(a.starter));
    for(const event of events){const player=club.roster.find(candidate=>candidate.id===event.playerId); if(!player) continue; const mustKeep=wouldBreakTeam(club,player); if((club.funds-event.cost>=50)||mustKeep) club.funds=Math.max(0,club.funds-event.cost); else marketRelease(s.league,club,player);}
    const accepted=new Set();
    for(const offer of offersByClub.get(club.id)||[]) if(club.funds-offer.cost>=50){club.funds-=offer.cost; accepted.add(offer.playerId);}
    if(accepted.size) s.cpuSpecialTraining.set(club.id,accepted);
  }
}
function offseasonEvents() {
    const c=me();
    const due=c.roster.filter(p=>p.contractYears<=0), pending=due.length+s.retentionEvents.length+s.specialOffers.length;
    return `${head()}<main class="contract-room"><p class="eyebrow">オフシーズンイベント</p><div class="screen-heading"><h2>契約・要求・特別特訓</h2><button data-stage10="roster" class="subtle">所属選手を見る</button></div><p class="hint">このフェーズ終了後、育成フェーズへ進みます。特別特訓の結果は成長結果で表示されます。</p><h3>年数契約</h3>${due.length?due.map(p=>`<article class="candidate">${renderContractPlayerCard(p,c)}<p>更新費 <b>${renewalFee(p)}pt</b></p><button data-renew="${p.id}" ${c.funds>=renewalFee(p)?'':'disabled'}>契約更新</button><button data-release="${p.id}" class="subtle">更新しない</button></article>`).join(''):'<p class="hint">契約満了者はいません。</p>'}<h3>不満・先発ボーナス要求</h3>${s.retentionEvents.length?s.retentionEvents.map(event=>{const p=c.roster.find(player=>player.id===event.playerId);return p?`<article class="candidate">${renderContractPlayerCard(p,c)}<p>${event.starter?'先発ボーナス要求':'不満による要求'}：<b>${event.cost}pt</b></p><button data-retention-pay="${p.id}" ${c.funds>=event.cost?'':'disabled'}>支払う</button><button data-retention-release="${p.id}" class="subtle">支払わない</button></article>`:''}).join(''):'<p class="hint">今回の追加要求はありません。</p>'}<h3>若手の特別特訓</h3>${s.specialOffers.length?s.specialOffers.map(offer=>{const p=c.roster.find(player=>player.id===offer.playerId);return p?`<article class="candidate">${renderContractPlayerCard(p,c)}<p>特別特訓費用：<b>${offer.cost}pt</b></p><button data-special-pay="${p.id}" ${c.funds>=offer.cost?'':'disabled'}>実行する</button><button data-special-skip="${p.id}" class="subtle">見送る</button></article>`:''}).join(''):'<p class="hint">今回の特別特訓候補はありません。</p>'}<button data-stage4="eventsDone" ${pending?'disabled':''}>育成フェーズへ進む</button></main>`;
}

function development() {
    const c = me();
    const finance=s.financeSummary?.find(row=>row.clubId===c.id);
    return `${head()}<main class="development-room"><div class="phase-topbar"><p class="eyebrow">育成</p><h2>育成する2選手を選択</h2>${finance?`<p class="hint">年間基本資金 +${finance.base}pt${finance.prize?`・順位賞金 +${finance.prize}pt`:''}／持越し上限150pt → 現在${finance.after}pt</p>`:''}<p class="hint">${s.training?.size || 0}/2 選択中</p>${sortControl('development',s.developmentSort)}</div><section class="candidate-grid">${sortPlayers(c.roster,s.developmentSort).map(p => `<article class="candidate ${s.training?.has(p.id)?'training-selected':''}">${renderContractPlayerCard(p,c)}<button data-train="${p.id}" class="${s.training?.has(p.id) ? '' : 'subtle'}">${s.training?.has(p.id) ? '選択済み' : '育成対象にする'}</button></article>`).join('')}</section><button data-stage4="confirm" ${s.training?.size === 2 ? '' : 'disabled'}>重点能力を選ぶ</button></main>`;
}

function focus() {
    const picks = [...s.training.keys()]; const c = me();
    return `${head()}<main class="development-room focus-room"><p class="eyebrow">育成</p><h2>重点能力を選択</h2><div class="focus-card-grid">${picks.map(id => { const p=c.roster.find(x=>x.id===id); return `<section class="candidate">${renderContractPlayerCard(p,c)}<label>重点育成<select data-focus="${id}">${trainingSkills(p).map(k=>`<option value="${k}" ${s.training.get(id)===k?'selected':''}>${STAT_LABELS[k]}</option>`).join('')}</select></label></section>`; }).join('')}</div><div class="focus-action"><button data-stage4="grow">育成を実行</button></div></main>`;
}

function growth() {
    const priority = x => x.specialTrainingResult ? 0 : x.focus ? 1 : x.awakeningKeys?.length ? 2 : 3;
    const resultsById = new Map(s.growth.map(x => [x.player.id, x]));
    const growthResults = sortPlayers(s.growth.map(x => x.player), s.developmentSort).map(p => resultsById.get(p.id)).sort((a,b) => priority(a)-priority(b));
    return `${head()}<main class="development-room growth-modal" role="dialog" aria-modal="true" aria-label="育成結果"><div class="phase-topbar"><p class="eyebrow">成長結果</p><h2>育成・特別特訓の結果</h2><p class="hint">${s.mode==='room'?'全クラブの育成・成長・衰退・加齢を完了しました。':'CPU5クラブも育成・成長・衰退・加齢を完了しました。'}</p></div><section class="candidate-grid">${growthResults.map(x => `<article class="candidate growth-result ${x.specialTrainingResult ? `growth-special-${x.specialTrainingResult.steps}` : x.focus ? 'growth-focus' : x.awakeningKeys?.length ? 'growth-awakened' : ''}"><div class="growth-labels">${x.specialTrainingResult ? '<span>若手育成イベント</span>' : ''}${x.focus ? `<span>重点育成：${e(STAT_LABELS[x.focus] || x.focus)}</span>` : ''}${x.awakeningKeys?.length ? '<span>覚醒</span>' : ''}</div>${renderContractPlayerCard(x.player,me())}<p>年齢 ${x.player.age - 1} → ${x.player.age}</p>${x.awakeningKeys?.length ? `<p><b>覚醒！</b></p>` : ''}${x.specialTrainingResult?`<p><b>特別特訓：</b>${x.specialTrainingResult.label}</p>`:''}<p>${x.retired ? '35歳で引退' : x.changes.map(c=>`${STAT_LABELS[c.key]} ${c.from === c.to && c.increased ? `${c.from} ↑` : `${c.from} → ${c.to}`}`).join(' ／ ') || 'ランク変化なし'}</p>${x.learnedAbility ? `<p><b>特殊能力を習得！</b><br>★ ${x.learnedAbility}</p>` : ''}</article>`).join('')}</section><button data-stage4="releasePhase">放出フェイズへ進む</button></main>`;
}

function release() {
    const c=me();
    return `${head()}<main class="release-office"><div class="phase-topbar"><p class="eyebrow">選手整理</p><h2>放出フェイズ</h2><p class="hint">市場開始前にロスターを整理できます。登録選手は最低5人、GKは最低1人必要です。各選手カードの放出ボタンから放出できます。</p>${sortControl('release',s.releaseSort)}</div><section class="candidate-grid">${sortPlayers(c.roster,s.releaseSort).map(p => `<article class="candidate">${renderContractPlayerCard(p,c)}<button type="button" data-stage10="release" data-release-player="${e(p.id)}" class="subtle release-button">この選手を放出</button></article>`).join('')}</section><button data-stage4="releaseDone">選手整理を終了してドラフトへ進む</button></main>`;
}

onGameClick('app', ev => {
  const action = ev.target.closest('[data-stage4]')?.dataset.stage4;
  const trainingId = ev.target.closest('[data-train]')?.dataset.train;
  const renewId = ev.target.closest('[data-renew]')?.dataset.renew;
  const releaseId = ev.target.closest('[data-release]')?.dataset.release;
  const retentionPay = ev.target.closest('[data-retention-pay]')?.dataset.retentionPay;
  const retentionRelease = ev.target.closest('[data-retention-release]')?.dataset.retentionRelease;
  const specialPay = ev.target.closest('[data-special-pay]')?.dataset.specialPay;
  const specialSkip = ev.target.closest('[data-special-skip]')?.dataset.specialSkip;
  if (retentionPay || retentionRelease) { const id=retentionPay||retentionRelease,event=s.retentionEvents.find(row=>row.playerId===id),p=me().roster.find(player=>player.id===id); if(event&&p){ if(retentionPay&&me().funds>=event.cost) me().funds-=event.cost; else marketRelease(s.league,me(),p); s.retentionEvents=s.retentionEvents.filter(row=>row.playerId!==id); s.specialOffers=s.specialOffers.filter(row=>me().roster.some(player=>player.id===row.playerId)); selectBestLineup(me()); } return render(); }
  if (specialPay || specialSkip) { const id=specialPay||specialSkip,offer=s.specialOffers.find(row=>row.playerId===id); if(offer&&specialPay&&me().funds>=offer.cost){me().funds-=offer.cost; s.specialTrainingAccepted.add(id);} s.specialOffers=s.specialOffers.filter(row=>row.playerId!==id); return render(); }
  if (trainingId) { if (s.training.has(trainingId)) s.training.delete(trainingId); else if (s.training.size < 2) s.training.set(trainingId, null); return render(); }
  if (renewId) { applyClubAction(me(),{type:ACTION_TYPES.RENEW_CONTRACT,clubId:me().id,playerId:renewId}); return render(); }
  if (releaseId) { const result=applyClubAction(me(),{type:ACTION_TYPES.RELEASE_PLAYER,clubId:me().id,playerId:releaseId,contractDecision:true},s.league); if(!result.ok) alert(result.error); s.retentionEvents=(s.retentionEvents||[]).filter(row=>row.playerId!==releaseId); s.specialOffers=(s.specialOffers||[]).filter(row=>row.playerId!==releaseId); selectBestLineup(me()); return render(); }
  if (!action) return;
  if (action==='offseason') { s.financeSummary=applySeasonFinances(s.league); decrementContracts(); s.training=new Map(); s.specialTrainingAccepted=new Set(); const eventsByClub=new Map(),offersByClub=new Map(); for(const club of s.league.clubs){eventsByClub.set(club.id,createContractEvents(club,createRandom(`${s.league.seed}:season:${s.league.season}:club:${club.id}:retention`))); offersByClub.set(club.id,createSpecialTrainingOffers(club,createRandom(`${s.league.seed}:season:${s.league.season}:club:${club.id}:special-training`)));} runCpuOffseasonEvents(eventsByClub,offersByClub); s.retentionEvents=eventsByClub.get(me().id)||[]; s.specialOffers=offersByClub.get(me().id)||[]; s.view='offseasonEvents'; }
  if (action==='eventsDone') finishOffseasonEvents();
  if (action==='confirm') s.view='focus';
  if (action==='grow') { const focus=new Map([...s.training.keys()].map(id=>[id,document.querySelector(`[data-focus="${id}"]`).value])); const specialByClub=new Map(s.cpuSpecialTraining||[]); specialByClub.set(me().id,s.specialTrainingAccepted||new Set()); const summaries=processLeagueOffseason(s.league,focus,specialByClub); s.growth=summaries.find(x=>x.clubId===me().id).growth; s.cpuOffseason=summaries.filter(x=>s.league.clubs.find(club=>club.id===x.clubId)?.controllerType==='CPU'); s.view='growth'; }
  if (action==='releasePhase') { s.league.releasePhaseOpen=true; s.cpuReleaseSummary=prepareCpuMarketSpace(s.league); s.view='release'; }
  if (action==='releaseDone') { const advanced=startNextSeason(s.league); if(advanced){s.offseasonComplete=false;beginDraft()}else{s.league.releasePhaseOpen=false;s.offseasonComplete=true;s.view='home'} }
  render();
});

// Stage 5 adds visible tactic selection without exposing internal values.
function renderTactics() {
    const c = me();
    const labels={BALANCED:'バランス',POSSESSION:'ポゼッション',DRIBBLE:'ドリブル',COUNTER:'カウンター'};
    const descriptions={BALANCED:'通常再開はPASS 50%・DRIBBLE 50%。攻撃全般 +2。守備成功後はCOUNTER 10%。',POSSESSION:'通常再開はPASS 80%・DRIBBLE 20%。PASS攻撃 +4。守備成功後はCOUNTER 10%。',DRIBBLE:'通常再開はPASS 20%・DRIBBLE 80%。DRIBBLE攻撃 +4。守備成功後はCOUNTER 10%。',COUNTER:'通常再開はPASS 50%・DRIBBLE 50%。COUNTER攻撃・守備・速攻発動判定 +4。守備成功後はCOUNTER 30%。'};
    // All figures below are the existing tactic probabilities and modifiers; this is presentation only.
    const tendency={BALANCED:{pass:50,dribble:50,counter:10,bonus:'攻撃全般 +2'},POSSESSION:{pass:80,dribble:20,counter:10,bonus:'PASS攻撃 +4'},DRIBBLE:{pass:20,dribble:80,counter:10,bonus:'DRIBBLE攻撃 +4'},COUNTER:{pass:50,dribble:50,counter:30,bonus:'COUNTER攻撃・守備・速攻発動判定 +4'}}[c.tactic] || {pass:50,dribble:50,counter:10,bonus:'攻撃全般 +2'};
    const gauge=(label,value)=>`<div class="tactic-gauge"><span>${label}</span><i role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" style="--meter:${value}%"><b></b></i><strong>${value}%</strong></div>`;
    return `<section class="match-card tactic-panel"><h3>戦術 <small>TACTICS</small></h3><div class="tactic-row">${Object.keys(labels).map(t => `<button data-tactic="${t}" class="${c.tactic===t ? 'active' : 'subtle'}" title="${descriptions[t]}">${labels[t]}</button>`).join('')}</div><div class="tactic-tendencies">${gauge('パス傾向',tendency.pass)}${gauge('ドリブル傾向',tendency.dribble)}${gauge('守備後カウンター',tendency.counter)}</div><p class="tactic-bonus"><span>戦術効果</span><b>${tendency.bonus}</b></p></section>`;
}
onGameClick('app', ev => { const tactic = ev.target.closest('[data-tactic]')?.dataset.tactic; if (tactic) { applyClubAction(me(),{type:ACTION_TYPES.SET_TACTIC,clubId:me().id,tactic}); render(); } });

function rankLabelFromOverall(value){return value>=91?'SS':value>=86?'S':value>=81?'A':value>=76?'B':value>=71?'C':value>=66?'D':value>=61?'E':value>=56?'F':'G'}
function clubCareerValue(record,clubId,key){return record?.clubCareer?.[clubId]?.[key]||0}
function renderRankHistoryChart(league){
  const history=league.history||[];if(!history.length)return '';
  const clubs=league.clubs||[],w=760,h=330,left=56,right=18,top=28,bottom=58,plotW=w-left-right,plotH=h-top-bottom;
  const x=season=>left+((season-1)/9)*plotW,y=rank=>top+((rank-1)/5)*plotH;
  const grid=[1,2,3,4,5,6].map(rank=>`<g><line x1="${left}" y1="${y(rank)}" x2="${w-right}" y2="${y(rank)}" class="rank-chart-grid"/><text x="${left-12}" y="${y(rank)+4}" text-anchor="end">${rank}位</text></g>`).join('');
  const seasons=Array.from({length:10},(_,i)=>i+1).map(season=>`<text x="${x(season)}" y="${h-24}" text-anchor="middle">S${season}</text>`).join('');
  const lines=clubs.map(club=>{const pts=history.map(entry=>{const row=entry.table?.find(r=>r.clubId===club.id);return row?{season:entry.season,rank:row.rank}:null}).filter(Boolean);if(!pts.length)return '';const d=pts.map((p,i)=>`${i?'L':'M'} ${x(p.season).toFixed(1)} ${y(p.rank).toFixed(1)}`).join(' ');const circles=pts.map(p=>`<circle cx="${x(p.season).toFixed(1)}" cy="${y(p.rank).toFixed(1)}" r="4"></circle>`).join('');return `<g class="rank-chart-line" style="--club:${e(club.color||'#64748b')}"><path d="${d}"></path>${circles}</g>`;}).join('');
  const legend=clubs.map(club=>`<span><i class="club-color-dot" style="--club:${e(club.color||'#64748b')}"></i>${e(club.name)}</span>`).join('');
  return `<section class="history-chart-card"><div class="history-section-heading"><div><p class="eyebrow">LEAGUE HISTORY</p><h2>10年間の順位推移</h2></div></div><div class="history-chart-wrap"><svg class="rank-history-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="全6クラブの10年間順位推移"><g class="rank-chart-axis">${grid}${seasons}</g>${lines}</svg></div><div class="rank-chart-legend">${legend}</div></section>`;
}
function renderClubAchievements(league,club){
  const a=clubAchievements(league,club.id);
  const stat=(label,value,suffix='')=>`<div><span>${label}</span><b>${value??'—'}${value==null?'':suffix}</b></div>`;
  const playerRecord=(title,record,key,suffix='')=>`<article class="history-record"><span>${title}</span><strong>${record?e(record.name):'—'}</strong><small>${record?`${clubCareerValue(record,club.id,key)}${suffix}`:'記録なし'}</small></article>`;
  const peak=a.highestPeak,peakOverall=peak?.peakOverallByClub?.[club.id],draft=a.draftMasterpiece;
  return `<section class="club-achievements" style="--club:${e(club.color||'#64748b')}"><div class="history-section-heading"><div><p class="eyebrow">YOUR CLUB</p><h2>${e(club.name)} 10年間の実績</h2></div></div><section class="achievement-grid">${stat('リーグ優勝',a.championships,'回')}${stat('最高順位',a.bestRank,'位')}${stat('通算勝利',a.totalWins,'勝')}${stat('通算得点',a.totalGoals,'点')}${stat('最大連勝',a.maxWinStreak,'連勝')}${stat('MVP輩出',a.mvpCount,'回')}${stat('Best 5選出人数',a.best5Players,'人')}${stat('得点王',a.topScorerCount,'回')}</section><section class="history-record-grid">${playerRecord('最多出場選手',a.mostAppearances,'appearances','試合')}${playerRecord('クラブ最多得点',a.mostGoals,'goals','得点')}${playerRecord('クラブ最多アシスト',a.mostAssists,'assists','アシスト')}<article class="history-record"><span>最長在籍選手</span><strong>${a.longestTenure?e(a.longestTenure.name):'—'}</strong><small>${a.longestTenure?`${a.longestTenure.clubSeasons?.[club.id]||0}シーズン`:'記録なし'}</small></article><article class="history-record"><span>最高到達ランク</span><strong>${peak&&peakOverall!=null?`${rankLabelFromOverall(peakOverall)}・${e(peak.name)}`:'—'}</strong><small>${peakOverall!=null?'クラブ在籍中の最高ランク':'記録なし'}</small></article><article class="history-record draft-masterpiece"><span>ドラフト最高傑作</span><strong>${draft?e(draft.name):'—'}</strong><small>${draft?`${draft.initialRank} → ${draft.peakRank}・S${draft.season}指名`:'記録なし'}</small></article></section></section>`;
}
function renderSeasonAwards() {
  const a = awards(s.league);
  return `<section class="season-awards"><p class="eyebrow">シーズン${s.league.season} 表彰</p><h2>最優秀選手 / ベスト5</h2><div class="candidate-grid">${a.mvp?'<article class="award-card mvp">'+player(a.mvp.p)+'<p class="award-club"><i class="club-color-dot" style="--club:'+e(a.mvp.c.color)+'"></i>'+e(a.mvp.c.name)+'</p><span class="mvp-badge">MVP</span></article>':'<p>該当者なし</p>'}${a.best5.map(x=>'<article class="award-card">'+player(x.p)+'<p class="award-club"><i class="club-color-dot" style="--club:'+e(x.c.color)+'"></i>'+e(x.c.name)+'</p></article>').join('')}</div>${s.league.season===10?'<button data-stage6="history" class="subtle">10シーズンの歴史</button>':'<p class="hint">オフシーズン処理後に次年度市場へ進みます。</p>'}</section>`;
}
function history() {
  const club = me();
  return `${head()}<main class="history-page"><p class="eyebrow">10 SEASONS COMPLETE</p><h1>クラブ10年間の歩み</h1>${renderClubAchievements(s.league,club)}${renderRankHistoryChart(s.league)}<details class="season-history-details"><summary>シーズン別の記録を見る</summary>${s.league.history.map(h=>`<section class="candidate"><b><i class="club-color-dot" style="--club:${e(h.championColor||'#64748b')}"></i>シーズン${h.season}・優勝 ${e(h.champion)}</b><p>最優秀選手 ${e(h.mvp||'—')}</p><p>得点王 ${(h.topScorers||[]).map(row=>`${e(row.name)} ${row.goals}得点`).join(' ／ ')||'—'}</p><p>最終順位 ${h.table.map(row=>`${row.rank}位 ${e(row.club)}`).join(' ／ ')}</p><p>Best5 ${h.best5.map(row=>typeof row==='string'?e(row):`${positionLabel(row.position)} ${e(row.name)}`).join(' ／ ')||'—'}</p></section>`).join('')}</details><div class="history-actions"><button data-nav="home" class="subtle">シーズン結果に戻る</button><button data-a="title" class="subtle">ホーム画面に戻る</button></div></main>`;
}
function renderCompletedSeasonActions() {
  if (s.offseasonComplete) return '';
  return s.league.season === 10
    ? '<button data-a="title" class="subtle">ホーム画面に戻る</button>'
    : '<button data-stage4="offseason">オフシーズンへ進む</button>';
}
onGameClick('app',ev=>{const x=ev.target.closest('[data-stage6]')?.dataset.stage6;if(x==='history'){s.view='history';render()}});


// Stage 14 lets the human controller submit the same SET_LINEUP action used by CPU controllers.
function placeLineupPlayer(playerId, slotIndex) {
  const selected = me().roster.find(player => player.id === playerId);
  if (!selected || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 4) return;
  const nextLineup = createLineupPlacement(me().lineup, playerId, slotIndex);
  const result = applyClubAction(me(), { type: ACTION_TYPES.SET_LINEUP, clubId: me().id, lineup: nextLineup });
  if (!result.ok) { s.lineupMessage = result.error; s.lineupError = true; }
  else {
    const slotNames = ['GK', 'DF', 'MF 1', 'MF 2', 'FW'];
    s.lineupMessage = `${selected.name}を${slotNames[slotIndex]}へ配置しました。${result.warnings.length ? ' 適性外配置があります。' : ''}`;
    s.lineupError = false;
    s.selectedLineupPlayerId = null;
    s.comparisonSourcePlayerId = null;
  }
  render();
}
onGameClick('app', event => {
  if (event.target.closest('[data-rename-player]')) return;
  const playerId = event.target.closest('[data-lineup-player]')?.dataset.lineupPlayer || event.target.closest('.squad-player[data-compare-player]')?.dataset.comparePlayer;
  const slotValue = event.target.closest('[data-lineup-slot]')?.dataset.lineupSlot;
  if (playerId) {
    const sourceId = s.comparisonSourcePlayerId;
    s.selectedLineupPlayerId = playerId;
    s.lineupMessage = '';
    s.lineupError = false;
    render();
    if (sourceId && sourceId !== playerId) {
      s.comparisonSourcePlayerId = sourceId;
      const content = app.querySelector('.squad-compare-content');
      if (content) content.innerHTML = renderSquadComparison(me(), sourceId, playerId);
    }
    return;
  }
  if (slotValue === undefined) return;
  const slotIndex = Number(slotValue), occupantId = me().lineup[slotIndex];
  if (!s.selectedLineupPlayerId) {
    if (!occupantId) return;
    s.selectedLineupPlayerId = occupantId;
    s.comparisonSourcePlayerId = occupantId;
    s.lineupMessage = '';
    s.lineupError = false;
    render();
  } else if (s.selectedLineupPlayerId === occupantId) {
    s.selectedLineupPlayerId = null;
    s.comparisonSourcePlayerId = null;
    render();
  } else placeLineupPlayer(s.selectedLineupPlayerId, slotIndex);
});
let draggingLineupPlayerId = null;
function showSquadComparison(targetId) {
  if (s.view !== 'squad' || !s.comparisonSourcePlayerId) return;
  const content = app.querySelector('.squad-compare-content');
  if (content) content.innerHTML = renderSquadComparison(me(), s.comparisonSourcePlayerId, targetId);
}
app.addEventListener('pointerover', event => {
  const card = event.target.closest('[data-compare-player]');
  if (card && !card.contains(event.relatedTarget)) showSquadComparison(card.dataset.comparePlayer);
});
app.addEventListener('focusin', event => {
  const card = event.target.closest('[data-compare-player]');
  if (card) showSquadComparison(card.dataset.comparePlayer);
});
app.addEventListener('pointerout', event => {
  const card = event.target.closest('[data-compare-player]');
  if (card && !card.contains(event.relatedTarget)) showSquadComparison(null);
});
function previewLineupDrop(slot, playerId) {
  const player = me().roster.find(candidate => candidate.id === playerId);
  const index = Number(slot.dataset.lineupSlot), replacedId = me().lineup[index];
  if (!player) return;
  const replaced = me().roster.find(candidate => candidate.id === replacedId);
  const originalIndex = me().lineup.indexOf(playerId);
  const action = replacedId === playerId ? '現在の配置' : replaced ? `${originalIndex >= 0 ? '位置交換' : '交代'}：${player.name} ⇄ ${replaced.name}` : `配置：${player.name} → ${['GK','DF','MF 1','MF 2','FW'][index]}`;
  const status = app.querySelector('.lineup-status');
  status?.removeAttribute('hidden');
  app.querySelector('.formation-drop-status')?.replaceChildren(document.createTextNode(action));
  slot.classList.add('drop-preview');
  slot.dataset.dropLabel = action;
}
app.addEventListener('dragstart', event => {
  const source = event.target.closest('[data-lineup-drag]');
  if (!source || s.view !== 'squad' || (s.mode === 'room' && (roomAdapter.locked || roomAdapter.room.phase !== 'team-setup'))) return;
  const id = source.dataset.lineupDrag;
  if (!id || !me().roster.some(player => player.id === id)) return;
  draggingLineupPlayerId = id;
  source.classList.add('is-dragging');
  app.querySelector('.formation-pitch')?.classList.add('awaiting-drop');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', id);
  const avatar = source.matches('.squad-avatar') ? source : source.querySelector('.squad-avatar');
  if (avatar) event.dataTransfer.setDragImage(avatar, avatar.offsetWidth / 2, avatar.offsetHeight / 2);
});
app.addEventListener('dragover', event => {
  const slot = event.target.closest('.formation-pitch [data-lineup-slot]');
  if (!slot || !draggingLineupPlayerId) return;
  event.preventDefault();event.dataTransfer.dropEffect = 'move';
  app.querySelectorAll('.formation-token.drop-preview').forEach(node => { if (node !== slot) node.classList.remove('drop-preview'); });
  previewLineupDrop(slot, draggingLineupPlayerId);
});
app.addEventListener('drop', event => {
  const slot = event.target.closest('.formation-pitch [data-lineup-slot]');
  if (!slot || !draggingLineupPlayerId) return;
  event.preventDefault();
  const id = draggingLineupPlayerId;
  draggingLineupPlayerId = null;
  if (me().lineup[Number(slot.dataset.lineupSlot)] === id) return;
  placeLineupPlayer(id, Number(slot.dataset.lineupSlot));
});
app.addEventListener('dragend', () => {
  draggingLineupPlayerId = null;
  app.querySelectorAll('.is-dragging,.awaiting-drop').forEach(node => node.classList.remove('is-dragging','awaiting-drop'));
  app.querySelectorAll('.formation-token.drop-preview').forEach(node => node.classList.remove('drop-preview'));
  app.querySelector('.formation-drop-status')?.replaceChildren();
  const status = app.querySelector('.lineup-status');
  if (status && !status.querySelector('b')?.textContent) status.hidden = true;
});

// Stage 10 keeps all public player information in one rank-only card and adds
// in-place roster and player-detail panels to market screens.
function renderRosterDialog() {
  if (!s.league || !s.rosterOpen) return;
  const rosterClub={...me(),roster:sortPlayers(me().roster,s.rosterSort)};document.body.insertAdjacentHTML('beforeend', `<div data-app-overlay class="overlay-backdrop" data-stage10="close"></div>${renderRosterPanel(rosterClub, { allowRelease: Boolean(s.league.releasePhaseOpen), rosterSort: s.rosterSort })}`);
}
function renderDraftHistoryDialog(){
  if(!s.draftHistoryOpen || s.view!=='draft' || !s.draft) return;
  document.body.insertAdjacentHTML('beforeend', `<div data-app-overlay class="overlay-backdrop" data-draft-history-modal="close"></div><section data-app-overlay data-ui-dialog="draft-history" class="overlay-panel detail-panel" data-draft-history-modal="panel" role="dialog" aria-modal="true" aria-label="ドラフト指名結果"><div class="overlay-heading"><div><p class="eyebrow">ドラフト</p><h2>指名結果</h2></div><button type="button" data-dialog-close data-draft-history-modal="close" class="subtle">閉じる</button></div>${renderDraftHistory(s.draft)}</section>`);
}
function renderAuctionHistoryDialog(){
  if(!s.auctionHistoryOpen || s.view!=='auction' || !s.auction) return;
  document.body.insertAdjacentHTML('beforeend', `<div data-app-overlay class="overlay-backdrop" data-auction-history-modal="close"></div><section data-app-overlay data-ui-dialog="auction-history" class="overlay-panel detail-panel" data-auction-history-modal="panel" role="dialog" aria-modal="true" aria-label="オークション結果"><div class="overlay-heading"><div><p class="eyebrow">オークション</p><h2>落札結果</h2></div><button type="button" data-dialog-close data-auction-history-modal="close" class="subtle">閉じる</button></div>${renderAuctionHistory(s.auction)}</section>`);
}
onGameClick('document', event => {
  const action = event.target.closest('[data-stage10]')?.dataset.stage10;
  if (action==='roster') { s.rosterOpen=true;  render(); }
  if (action==='release') { const playerId=event.target.closest('[data-release-player]')?.dataset.releasePlayer; if(playerId){const result=applyClubAction(me(),{type:ACTION_TYPES.RELEASE_PLAYER,clubId:me().id,playerId},s.league);if(!result.ok){s.releaseMessage=result.error;render();return}selectBestLineup(me());s.releaseMessage='';s.rosterOpen=s.view !== 'release';render();} }
  if (action==='close') { s.rosterOpen=false;  render(); }
});

// Stage 19 consolidates save controls and limits saves to JSON-safe phases.
const unsafeSaveViews = new Set(['draft', 'auction', 'development', 'focus']);
const saveSourceView = () => s.view === 'savePanel' ? s.saveReturnView : s.view;
const saveAllowed = () => s.mode !== 'room' && Boolean(s.league) && !unsafeSaveViews.has(saveSourceView());
function slotRows(loadOnly = false) {
  return [1,2,3].map(slot => {
    const info = slotInfo(slot);
    return `<section class="candidate save-slot"><h3>スロット${slot}</h3>${info ? info.incompatible ? '<p class="lineup-error">旧セーブデータ（読込不可）</p>' : `<p>${e(info.clubName)}・シーズン${info.season}${info.completed?' 終了':''}</p><p class="hint">${info.savedAt ? e(new Date(info.savedAt).toLocaleString('ja-JP')) : ''}</p>` : '<p class="hint">データなし</p>'}${!loadOnly ? `<button data-stage19="save" data-save-slot="${slot}" ${saveAllowed() ? '' : 'disabled'}>保存</button>` : ''}<button data-stage19="load" data-load-slot="${slot}" class="subtle" ${info && !info.incompatible ? '' : 'disabled'}>ロード</button></section>`;
  }).join('');
}
function loadTitle() {
  return `<main class="setup"><p class="eyebrow">続きから</p><h2>セーブデータをロード</h2><section class="candidate-grid">${slotRows(true)}</section><button data-stage19="backTitle" class="subtle">タイトルへ戻る</button></main>`;
}
function savePanel() {
  return `${head()}<main><p class="eyebrow">セーブ / ロード</p><h2>セーブデータ</h2>${saveAllowed() ? '<p class="hint">現在の画面は保存できます。</p>' : '<p class="lineup-error">この画面ではセーブできません。フェイズ完了後に保存してください。</p>'}<section class="candidate-grid">${slotRows()}</section><div class="season-result-actions"><button data-stage19="export" class="subtle">セーブデータ書き出し</button><button data-stage19="import" class="subtle">セーブデータ読み込み</button><button data-stage19="closeSave" class="subtle">戻る</button></div></main>`;
}
onGameClick('document', event => {
  const action = event.target.closest('[data-stage19]')?.dataset.stage19;
  if (!action) return;
  try {
    if (action === 'loadTitle') { s.view='loadTitle'; return render(); }
    if (action === 'backTitle') { returnToTitle(); return render(); }
    if (action === 'savePanel') { s.saveReturnView=s.view; s.view='savePanel'; return render(); }
    if (action === 'closeSave') { s.view=s.saveReturnView||'home'; return render(); }
    if (action === 'save') { if (!saveAllowed()) throw new Error('この画面ではセーブできません。フェイズ完了後に保存してください。'); saveSlot(Number(event.target.closest('[data-save-slot]')?.dataset.saveSlot),s); return render(); }
    if (action === 'load') { const saved=loadSlot(Number(event.target.closest('[data-load-slot]')?.dataset.loadSlot)); if(!saved) throw new Error('このスロットは空です。'); s=saved; return render(); }
    if (action === 'export') { if (!saveAllowed()) throw new Error('この画面ではセーブできません。フェイズ完了後に保存してください。'); const blob=new Blob([exportSave(s)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='football-league-save.json';a.click();URL.revokeObjectURL(a.href); }
    if (action === 'import') { const text=prompt('書き出したJSONを貼り付けてください。'); if(text){s=importSave(text);render();} }
  } catch (error) { alert(`セーブエラー: ${error.message}`); }
});
document.addEventListener('change', event => {
  if (event.target.matches('[data-bench-sort]')) { s.benchSort=event.target.value; return render(); }
  if(event.target.matches('[data-focus]') && s.mode==='room'){ s.training.set(event.target.dataset.focus,event.target.value); roomAdapter.remember(); return; }
  const scope=event.target.closest('[data-player-sort]')?.dataset.playerSort;
  if(scope==='roster')s.rosterSort=event.target.value;
  if(scope==='draft')s.draftSort=event.target.value;
  if(scope==='development')s.developmentSort=event.target.value;
  if(scope==='release')s.releaseSort=event.target.value;
  if(scope)render();
});

onGameClick('document', event => {
  const action = event.target.closest('[data-draft-history-modal]')?.dataset.draftHistoryModal;
  if(action==='close'){ s.draftHistoryOpen=false; render(); }
});

onGameClick('document', event => {
  const action = event.target.closest('[data-auction-history-modal]')?.dataset.auctionHistoryModal;
  if(action==='close'){ s.auctionHistoryOpen=false; render(); }
});

// One event boundary. Both modes use the renderers and local editing handlers above.
// Only committed game operations are replaced by Room actions.
function roomSync() {
  const result=roomAdapter?.draftResultText()||'';
  return `<aside class="room-sync" aria-label="同期状況"><div class="room-sync-summary"><span data-room-status role="status" aria-live="polite">${e(roomAdapter?.statusText()||'')}</span><button data-room="retry" class="subtle" ${roomAdapter?.status.error||roomAdapter?.client.pending?'':'hidden'}>再接続・送信確認</button></div><div class="room-participants" data-room-participants aria-label="各クラブの完了状況">${roomParticipantMarkup()}</div><span class="room-draft-result" data-room-draft-result role="status" aria-live="polite" ${result?'':'hidden'}>${e(result)}</span></aside>`;
}
function roomParticipantMarkup() {
  return (roomAdapter?.participantStatuses()||[]).map(row=>`<span class="room-participant is-${row.state}">${e(row.name)}${row.self?'（自分）':''}：${e(row.label)}</span>`).join('');
}
function roomEntry() {
  return `<main class="setup"><h2>マルチプレイ</h2><label>クラブ名<input id="room-name" maxlength="12" placeholder="東京ファイブ"></label><p class="hint">チームカラーは参加順に自動で割り当てられます。</p><button data-room="create">ルームを作成</button><label>ルームID<input id="room-code" maxlength="12" autocomplete="off" placeholder="12桁のルームID"></label><button data-room="join">ルームに参加</button>${roomAdapter.client.session?'<button data-room="resume" class="subtle">参加中のルームに戻る</button>':''}${roomSync()}<button data-room="leave" class="subtle">戻る</button></main>`;
}
function roomLobby() {
  const room=roomAdapter.room;
  return `<main class="setup"><h2>ロビー</h2><p>ルームID <b>${e(room.roomId)}</b></p><p class="hint">参加者にルームIDを共有してください。未参加の枠はCPUが担当します。</p><ul>${room.players.map(p=>`<li>${e(p.teamName)}${p.id===room.hostPlayerId?'（ホスト）':''}</li>`).join('')}</ul>${roomAdapter.isHost?'<button data-room="start">ゲーム開始</button>':'<p>ホストの開始を待っています。</p>'}${roomSync()}<button data-room="leave" class="subtle">タイトルへ</button></main>`;
}
function updateRoomStatus() {
  if (!roomAdapter) return;
  document.querySelectorAll('[data-room-status]').forEach(node=>{node.textContent=roomAdapter.statusText();});
  const participants=roomParticipantMarkup();
  document.querySelectorAll('[data-room-participants]').forEach(node=>{if(node.innerHTML!==participants)node.innerHTML=participants;});
  const result=roomAdapter.draftResultText();
  document.querySelectorAll('[data-room-draft-result]').forEach(node=>{node.hidden=!result;if(node.textContent!==result)node.textContent=result;});
  document.querySelectorAll('[data-room="retry"]').forEach(node=>{node.hidden=!(roomAdapter.status.error||roomAdapter.client.pending);node.disabled=roomAdapter.status.busy;});
  document.querySelectorAll('[data-room="create"],[data-room="join"],[data-room="resume"],[data-room="start"],[data-room="leave"]').forEach(node=>{node.disabled=roomAdapter.status.busy;});
  if(s.mode!=='room'||!roomAdapter.room?.game)return;
  document.querySelectorAll('[data-live-bid],[data-live-pass]').forEach(node=>{node.dataset.ruleDisabled??=String(node.disabled);node.disabled=node.dataset.ruleDisabled==='true'||roomAdapter.locked;});
  const phase=roomAdapter.room.phase;
  const groups=[
    ['[data-p],[data-a="skipDraft"]',['draft']],

    ['[data-lineup-player],[data-lineup-slot],[data-tactic]',['team-setup']],
    ['[data-renew],[data-release],[data-retention-pay],[data-retention-release],[data-special-pay],[data-special-skip]',['offseason-events']],
    ['[data-train],[data-focus],[data-stage4="confirm"],[data-stage4="grow"]',['development']],
    ['[data-release-player],[data-rename-player]',['release']],
    ['[data-stage4="eventsDone"]',['offseason-events']],
    ['[data-stage4="releasePhase"]',['growth-result']],
    ['[data-stage4="releaseDone"]',['release']],
    ['[data-stage4="offseason"]',['season-result']],
    ['[data-a="toAuction"]',['draft-complete']]
  ];
  for(const [selector,phases] of groups) document.querySelectorAll(selector).forEach(node=>{
    node.dataset.ruleDisabled ??= String(node.disabled);
    node.disabled=node.dataset.ruleDisabled==='true'||roomAdapter.locked||!phases.includes(phase)||(phase==='draft'&&!s.draft.pendingClubIds.includes(me().id));
  });
  document.querySelectorAll('[data-a="season"]').forEach(node=>{
    node.dataset.ruleDisabled ??= String(node.disabled);
    node.textContent=phase==='season-ready'?'シーズンをシミュレート':roomAdapter.player?.completed?'編成完了済み':'編成を確定する';
    node.disabled=node.dataset.ruleDisabled==='true'||roomAdapter.locked||!['team-setup','season-ready'].includes(phase)||(phase==='season-ready'&&!roomAdapter.isHost);
  });
  if(phase==='auction-complete')document.querySelectorAll('[data-a="squad"]').forEach(node=>{node.disabled=roomAdapter.locked;});
}
const screens = Object.freeze({
  title, setup, draft, auction, table, stats, squad, seasonResults, matchDetail, home,
  offseasonEvents, development, focus, growth, release, history, loadTitle, savePanel,
  roomEntry, roomLobby
});
function renderEntryDialog() {
  const popupNames={setup:'クラブを作成',loadTitle:'続きから',roomEntry:'マルチプレイ',roomLobby:'ロビー'};
  if(popupNames[s.view]){
    const content=document.createElement('section');
    content.dataset.uiDialog='entry';
    content.className='arena-popup';content.setAttribute('role','dialog');
    content.setAttribute('aria-modal','true');content.setAttribute('aria-label',popupNames[s.view]);
    while(app.firstChild)content.append(app.firstChild);
    const close=document.createElement('button');close.className='arena-popup-close subtle';
    close.dataset.dialogClose='';
    close.type='button';close.textContent='×';close.setAttribute('aria-label','ホームに戻る');
    if(s.view==='roomEntry'||s.view==='roomLobby'){close.dataset.room='leave';close.disabled=roomAdapter.status.busy;}else close.dataset.a='title';
    content.prepend(close);
    app.innerHTML=title();
    const overlay=document.createElement('div');overlay.className='arena-popup-overlay';overlay.append(content);app.append(overlay);
  }
}
let renderedView = null;
function render() {
  const seasonTransition=s.view==='draft'&&renderedView==='release';
  const trainingTransition=s.view==='growth'&&['focus','development'].includes(renderedView);
  const previousScreen=trainingTransition?app.cloneNode(true):null;
  if(s.league?.completed&&['home','stats','table'].includes(s.view)){
    if(s.view==='stats')s.resultTab='stats';else if(s.view==='table')s.resultTab='summary';
    s.view='seasonResults';
  }
  dialogs.beforeRender();
  if (renderedView !== s.view) document.querySelectorAll('.rename-modal-backdrop,.rename-modal-panel').forEach(node => node.remove());
  document.querySelectorAll('[data-app-overlay]').forEach(node => node.remove());
  app.innerHTML = (screens[s.view] || home)();
  if (s.league && s.mode !== 'room' && !['loadTitle', 'savePanel'].includes(s.view)) {
    app.querySelector('header')?.insertAdjacentHTML('beforeend', '<span><button data-stage19="savePanel" class="subtle">セーブ / ロード</button></span>');
  }
  classifyScreens(s.view);
  updateRoomStatus();
  renderEntryDialog();
  renderRosterDialog();
  renderDraftHistoryDialog();
  renderAuctionHistoryDialog();
  // Keep an in-progress name editor above rebuilt panels during Room updates.
  document.querySelectorAll('.rename-modal-backdrop,.rename-modal-panel').forEach(node => document.body.append(node));
  dialogs.sync();
  auctionClock.sync(s.view === 'auction' && !!s.auction && !s.auction.completed);
  renderedView = s.view;
  document.dispatchEvent(new CustomEvent('football-league:view-rendered'));
  if(trainingTransition)void playTrainingCinematic(me(),previousScreen);
  if(seasonTransition){
    const transition=document.createElement('div');transition.className='season-move-overlay';transition.setAttribute('role','status');
    const message=document.createElement('p');message.textContent=`${s.league.season}シーズン目に移ります・・・`;transition.append(message);document.body.append(transition);
    setTimeout(()=>transition.remove(),3000);
  }
}
roomAdapter=new RoomAdapter(()=>s,next=>{s=next;},()=>render(),()=>updateRoomStatus());
function reportRoomError(error){ roomAdapter.status.error=error.message; updateRoomStatus(); }
function sendRoom(promise){Promise.resolve(promise).catch(reportRoomError);}
function roomClick(event){
  const target=event.target;
  const roomAction=target.closest('[data-room]')?.dataset.room;
  if(roomAction){
    if(roomAction==='open'){s.view='roomEntry';render();}
    if(roomAction==='create'||roomAction==='join')sendRoom(roomAdapter.enter(roomAction,document.querySelector('#room-name').value,document.querySelector('#room-code').value));
    if(roomAction==='resume')sendRoom(roomAdapter.resume());
    if(roomAction==='retry'){roomAdapter.active=true;sendRoom(roomAdapter.client.retry().then(()=>roomAdapter.client.startPolling()));}
    if(roomAction==='start')sendRoom(roomAdapter.client.mutate('start'));
    if(roomAction==='leave'){
      if(roomAdapter.status.busy)return true;
      returnToTitle();
      render();
    }
    return true;
  }
  if(s.mode!=='room')return false;
  const a=target.closest('[data-a]')?.dataset.a, step=target.closest('[data-stage4]')?.dataset.stage4;
  if(a==='title'){returnToTitle();render();return true;}
  if(target.closest('[data-stage19]'))return true;
  const workKeys={renew:'renew',release:'contractRelease',retentionPay:'retentionPay',retentionRelease:'retentionRelease',specialPay:'specialPay',specialSkip:'specialSkip',releasePlayer:'release'};
  for(const [key,type] of Object.entries(workKeys)){
    const attr='data-'+key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase());
    const node=target.closest(`[${attr}]`);
    if(node){roomAdapter.work(type,node.dataset[key]);return true;}
  }
  const pick=target.closest('[data-p]')?.dataset.p;
  const commit=pick||['skipDraft','bid','pass','toAuction','season'].includes(a)||['offseason','eventsDone','grow','releasePhase','releaseDone'].includes(step)||(a==='squad'&&roomAdapter.room.phase==='auction-complete');
  if(commit){
    if(roomAdapter.locked)return true;
    if(pick)sendRoom(roomAdapter.submit({playerId:pick}));
    else if(a==='skipDraft')sendRoom(roomAdapter.submit({pass:true}));
    else if(a==='bid'||a==='pass')sendRoom(roomAdapter.submit({bid:a==='pass'?0:Number(document.querySelector('#bid').value)}));
    else if(a==='season'){
      if(roomAdapter.room.phase==='season-ready')sendRoom(roomAdapter.client.mutate('run-season'));
      else sendRoom(roomAdapter.submit({lineup:me().lineup,tactic:me().tactic}));
    }
    else if(step==='eventsDone'||step==='releaseDone')sendRoom(roomAdapter.submit({actions:roomAdapter.actions}));
    else if(step==='grow')sendRoom(roomAdapter.submit({selections:[...s.training.keys()].map(playerId=>({playerId,focus:document.querySelector(`[data-focus="${CSS.escape(playerId)}"]`).value}))}));
    else sendRoom(roomAdapter.submit());
    return true;
  }
  if(target.closest('[data-lineup-player],[data-lineup-slot],[data-tactic]') && (roomAdapter.locked||roomAdapter.room.phase!=='team-setup'))return true;
  if(target.closest('[data-train],[data-stage4="confirm"]') && (roomAdapter.locked||roomAdapter.room.phase!=='development'))return true;
  if(target.closest('[data-nav]')?.dataset.nav==='squad'&&!['team-setup','season-ready'].includes(roomAdapter.room.phase))return true;
  return false;
}
document.addEventListener('click',event=>{
  try{
    if(event.target.closest('button:disabled'))return;
    const liveBid=event.target.closest('[data-live-bid]'),livePass=event.target.closest('[data-live-pass]');
    if(liveBid||livePass){
      if(s.mode==='room'){if(!roomAdapter.locked)sendRoom(roomAdapter.submit({playerId:s.auction.pool[s.auction.i].id,...(livePass?{pass:true}:{bid:Number(liveBid.dataset.liveBid)})}));}
      else{bid(livePass?0:Number(liveBid.dataset.liveBid));refreshAuctionState();}
      return;
    }
    if(roomClick(event))return;
    for(const {scope,handler} of clickHandlers)if(scope==='document'||app.contains(event.target))handler(event);
    if(s.mode==='room')roomAdapter.remember();
  }catch(error){if(s.mode==='room')reportRoomError(error);else alert(error.message);}
});
configureRename(async(playerId,name)=>{
  if(s.mode==='room'){await roomAdapter.rename(playerId,name);return;}
  return false;
});
render();
