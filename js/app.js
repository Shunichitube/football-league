import { applySeasonFinances, awards, createLeague, finalizeSeason, simulateRemainingSeason, standings, startNextSeason } from './league.js?v=0.17.4';
import { displayPlayer, POSITION_LABELS, STAT_LABELS } from './data.js?v=0.17.2';
import { createRandom } from './random.js';
import { createAuctionPool, createDraftPool, resolveAuctionActions, resolveDraftActions } from './market.js?v=0.17.2';
import { escapeHtml as e, renderLineupEditor, renderMatchDetail, renderPlayerCard, renderRosterPanel, renderSeasonMatchList, renderSeasonPlayerStats } from './ui.js?v=0.17.5';
import { decideCpuAuctionAction, decideCpuDraftAction, manageCpuContracts, prepareCpuClubs, prepareCpuMarketSpace, processLeagueOffseason, selectBestLineup } from './cpu.js?v=0.17.2';
import { ACTION_TYPES, applyClubAction, createLineupPlacement, validateLineup } from './rules.js?v=0.17.2';
const app=document.querySelector('#app');let s={view:'title',league:null,draft:null,auction:null,match:null,round:0,note:'',rosterOpen:false,detailPlayerId:null,selectedLineupPlayerId:null,lineupMessage:'',lineupError:false,seasonSimulation:null,benchSort:'position',draftSort:'position',developmentSort:'position',releaseSort:'position'};
const me=()=>s.league.clubs.find(c=>c.controllerType==='HUMAN')||s.league.clubs.find(c=>c.id===s.league.humanClubId);const player=p=>renderPlayerCard(p);const positionLabel=position=>POSITION_LABELS[position]||position;
const POSITION_SORT_ORDER={GK:0,DF:1,MF:2,FW:3},RANK_SORT_ORDER={SS:0,S:1,A:2,B:3,C:4,D:5,E:6,F:7,G:8};
function sortPlayers(players,mode='position'){return [...players].map((player,index)=>({player,index})).sort((a,b)=>{const pa=a.player,pb=b.player,pos=(POSITION_SORT_ORDER[pa.primaryPosition]??99)-(POSITION_SORT_ORDER[pb.primaryPosition]??99),rank=RANK_SORT_ORDER[displayPlayer(pa).overallRank]-RANK_SORT_ORDER[displayPlayer(pb).overallRank],age=pa.age-pb.age,contract=pa.contractYears-pb.contractYears,joined=a.index-b.index;if(mode==='overall')return rank||pos||age||contract||joined;if(mode==='age')return age||pos||rank||contract||joined;if(mode==='contract')return contract||pos||rank||age||joined;return pos||rank||age||contract||joined}).map(row=>row.player)}
function sortControl(scope,value){return `<div class="phase-sort-heading"><span></span><label>並び順<select data-player-sort="${scope}"><option value="position" ${value==='position'?'selected':''}>ポジション順</option><option value="overall" ${value==='overall'?'selected':''}>総合ランク順</option><option value="age" ${value==='age'?'selected':''}>年齢順</option><option value="contract" ${value==='contract'?'selected':''}>契約年数順</option></select></label></div>`}
function head(){let c=me(),r=standings(s.league).find(x=>x.club.id===c.id);return `<header><a data-nav="home" class="brand">FOOTBALL <b>LEAGUE</b></a><span>シーズン ${s.league.season} / 10</span><span><i class="club-color-dot" style="--club:${e(c.color)}"></i>${e(c.name)}・${r.rank}位・${c.funds}pt</span></header>`}
function title(){return `<main class="title"><p>5人制クラブ運営ゲーム</p><h1>FOOTBALL<br><b>LEAGUE</b></h1><button data-a="setup">新しく始める</button><button data-stage19="loadTitle" class="subtle">続きから</button><footer>v0.17.2・Offseason System v1</footer></main>`}
function setup(){return `<main class="setup"><h2>クラブを作成</h2><label>クラブ名<input id="name" placeholder="東京ファイブ"></label><label>チームカラー<input id="color" type="color" value="#4ade80"></label><label>シード（任意）<input id="seed" placeholder="同じ値なら同じ展開"></label><button data-a="start">ゲーム開始</button><button data-a="title" class="subtle">戻る</button></main>`}
function draft(){let d=s.draft,c=me(),canPick=d.pendingClubIds.includes(c.id),simultaneous=d.mode==='SIMULTANEOUS';return `${head()}<main><p class="eyebrow">シーズン${s.league.season} ドラフト・第${d.round}/4巡</p><div class="screen-heading"><h2>${simultaneous?'完全同時指名':'前年順位順指名'}</h2><button data-stage10="roster" class="subtle">所属選手を見る</button></div><p class="hint">${simultaneous?'6クラブが同時に指名し、重複時だけ抽選します。外れたクラブは再指名します。':'前年順位に基づく指名順で、1クラブずつ指名します。'}${e(s.note)}</p><p>資金 <b>${c.funds}pt</b>・登録 ${c.roster.length}/12人</p>${sortControl('draft',s.draftSort)}<section class="candidate-grid">${sortPlayers(d.pool,s.draftSort).map(p=>`<article class="candidate">${player(p)}<p class="scout-comment"><b>スカウト：</b>${e(p.scoutComment)}</p>${canPick?`<button data-p="${p.id}">この選手を指名</button>`:''}</article>`).join('')}</section><button data-a="skipDraft" class="subtle">残りの指名を辞退</button></main>`}
function auction(){let a=s.auction,p=a.pool[a.i],c=me();if(!p)return `${head()}<main><section class="hero"><p>競売完了</p><h2>市場が終了しました</h2><button data-a="squad">編成へ進む</button></section></main>`;return `${head()}<main><p class="eyebrow">競売 ${a.i+1}/${a.pool.length}</p><div class="screen-heading"><h2>秘密入札</h2><button data-stage10="roster" class="subtle">所属選手を見る</button></div><p class="hint">${e(s.note)}</p><article class="candidate">${player(p)}<p class="scout-comment"><b>スカウト：</b>${e(p.scoutComment)}</p></article><label>入札額<input id="bid" type="number" min="0" max="${c.funds}" value="0"></label><button data-a="bid">入札する</button><button data-a="pass" class="subtle">見送る</button><p>資金 ${c.funds}pt・登録 ${c.roster.length}/12人</p></main>`}
function table(){let humanId=me().id,rows=standings(s.league).map(r=>`<tr class="${r.club.id===humanId?'you':''}"><td>${r.rank}</td><td><i class="club-color-dot" style="--club:${e(r.club.color)}"></i>${e(r.club.name)}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td>${r.goalsFor}</td><td>${r.goalsAgainst}</td><td>${r.goalDifference}</td><td>${r.points}</td></tr>`).join('');return `${head()}<main><h2>順位表</h2><div class="table-wrap"><table><thead><tr><th>順位</th><th>クラブ</th><th>試合</th><th>勝</th><th>分</th><th>敗</th><th>得点</th><th>失点</th><th>得失</th><th>勝点</th></tr></thead><tbody>${rows}</tbody></table></div><button data-nav="home" class="subtle">戻る</button></main>`}
function home(){let c=me(),lineup=validateLineup(c),remaining=Math.max(0,11-s.league.currentRound);if(s.league.completed)return `${head()}<main><section class="hero"><p>全10節・リーグ全30試合終了</p><h2>シーズン${s.league.season}終了</h2><button data-nav="seasonResults">シーズン結果を見る</button><button data-nav="stats" class="subtle">個人成績を見る</button></section></main>`;return `${head()}<main><section class="hero" style="--club:${c.color}"><p>残り${remaining}節</p><h2>編成と戦術を決めてシーズンを開始</h2>${lineup.ok?'<button data-a="season">シーズンをシミュレート</button>':`<p class="lineup-error">${e(lineup.error)}</p><button data-nav="squad">編成を確認する</button>`}</section><nav><button data-nav="squad">編成</button><button data-nav="table">順位表</button><button data-nav="stats">個人成績</button></nav></main>`}
function squad(){let c=me(),lineup=validateLineup(c);return `${head()}<main style="--club:${e(c.color)}"><div class="squad-heading-row"><div class="squad-heading-copy"><h2>編成</h2><p class="hint">所属選手を選び、配置したい枠を押してください。能力はすべてランク表示です。</p></div></div>${renderLineupEditor(c,s.selectedLineupPlayerId,s.lineupMessage,s.lineupError,s.benchSort)}<button data-a="season" ${lineup.ok?'':'disabled'}>シーズンをシミュレート</button><button data-nav="home" class="subtle">戻る</button></main>`}
function stats(){const c=me();return `${head()}<main><p class="eyebrow">シーズン${s.league.season}</p><h2>所属選手の個人成績</h2>${renderSeasonPlayerStats(c)}<button data-nav="${s.league.completed?'seasonResults':'home'}" class="subtle">戻る</button></main>`}
function seasonResults(){const c=me(),row=standings(s.league).find(result=>result.club.id===c.id),matches=s.league.seasonResults||[];return `${head()}<main><p class="eyebrow">シーズン${s.league.season} 結果</p><h2>最終順位 ${row.rank}位</h2><section class="season-summary-grid"><div><span>勝点</span><b>${row.points}</b></div><div><span>勝</span><b>${row.wins}</b></div><div><span>分</span><b>${row.draws}</b></div><div><span>敗</span><b>${row.losses}</b></div><div><span>得点</span><b>${row.goalsFor}</b></div><div><span>失点</span><b>${row.goalsAgainst}</b></div><div><span>得失点差</span><b>${row.goalDifference}</b></div></section><h2>全10試合</h2>${renderSeasonMatchList(matches,c.id)}<div class="season-result-actions"><button data-nav="stats">シーズン個人成績</button><button data-nav="table" class="subtle">最終順位表</button><button data-nav="home" class="subtle">ホームへ戻る</button></div></main>`}
function matchDetail(){return `${head()}${renderMatchDetail(s.match)}`}
function render(){app.innerHTML=s.view==='title'?title():s.view==='setup'?setup():s.view==='draft'?draft():s.view==='auction'?auction():s.view==='table'?table():s.view==='stats'?stats():s.view==='squad'?squad():s.view==='seasonResults'?seasonResults():s.view==='matchDetail'?matchDetail():home()}
function draftEligibleIds(){let humanId=me().id;return s.league.clubs.filter(club=>club.funds>=1&&club.roster.length<12&&(!s.draft?.humanDeclined||club.id!==humanId)).map(club=>club.id)}
function startAuction(){const season=s.league.season;s.league.clubs.forEach(club=>delete club.reserveAuctionSlot);s.auction={pool:createAuctionPool(s.league.seed,season,s.league.releasedPlayers),i:0,rng:createRandom(`${s.league.seed}:season:${season}:auction`)};s.view='auction';s.note=`シーズン${season}ドラフト終了。競売を開始します。`}
function draftMode(round){return s.league.season===1||round===1?'SIMULTANEOUS':'ORDERED'}
function orderedDraftIds(round){const ranks=s.league.previousStandings||standings(s.league).map(row=>({clubId:row.club.id,rank:row.rank})),descending=round===2||round===4;return [...ranks].sort((a,b)=>descending?b.rank-a.rank:a.rank-b.rank).map(row=>row.clubId).filter(id=>draftEligibleIds().includes(id))}
function prepareDraftRound(d){d.mode=draftMode(d.round);if(d.mode==='SIMULTANEOUS'){d.pendingClubIds=draftEligibleIds();return}d.order=orderedDraftIds(d.round);d.orderIndex=0;d.pendingClubIds=d.order.length?[d.order[0]]:[]}
function nextOrderedPick(d){d.orderIndex++;while(d.orderIndex<d.order.length&&!draftEligibleIds().includes(d.order[d.orderIndex]))d.orderIndex++;d.pendingClubIds=d.orderIndex<d.order.length?[d.order[d.orderIndex]]:[]}
function advanceDraftRound(){let d=s.draft;if(d.pendingClubIds.length)return false;if(d.round>=4){startAuction();return true}d.round++;prepareDraftRound(d);return false}
function runCpuDraft(){let guard=0;while(s.view==='draft'&&guard++<100){let d=s.draft,humanId=me().id;if(d.pendingClubIds.includes(humanId))break;if(!d.pendingClubIds.length){if(advanceDraftRound())break;continue}const actions=d.pendingClubIds.map(id=>s.league.clubs.find(club=>club.id===id)).filter(club=>club?.controllerType==='CPU').map(club=>decideCpuDraftAction(club,d.pool,d.rng)).filter(Boolean);const result=resolveDraftActions({clubs:s.league.clubs,candidates:d.pool,pendingClubIds:d.pendingClubIds,actions,rng:d.rng});d.pool=result.candidates;if(d.mode==='ORDERED')nextOrderedPick(d);else d.pendingClubIds=result.pendingClubIds;if(!result.acquired.length&&result.declinedIds.length===0&&d.mode==='SIMULTANEOUS')d.pendingClubIds=[]}}
function beginDraft(){const season=s.league.season;s.league.releasePhaseOpen=false;s.match=null;s.seasonSimulation=null;s.league.clubs.forEach(club=>{club.reserveAuctionSlot=club.controllerType==='CPU'&&12-club.roster.length>=2});s.draft={pool:createDraftPool(s.league.seed,season),round:1,rng:createRandom(`${s.league.seed}:season:${season}:draft`),pendingClubIds:[],humanDeclined:false};prepareDraftRound(s.draft);s.view='draft';s.note=`シーズン${season}ドラフトを開始します。`;runCpuDraft()}
function pickDraft(p){let d=s.draft,humanId=me().id;if(!d.pendingClubIds.includes(humanId))return;const actions=d.pendingClubIds.map(id=>s.league.clubs.find(club=>club.id===id)).map(club=>club?.controllerType==='CPU'?decideCpuDraftAction(club,d.pool,d.rng):club?.id===humanId?{type:ACTION_TYPES.DRAFT_PICK,clubId:club.id,playerId:p.id}:null).filter(Boolean);const result=resolveDraftActions({clubs:s.league.clubs,candidates:d.pool,pendingClubIds:d.pendingClubIds,actions,rng:d.rng});d.pool=result.candidates;const acquired=result.acquired.find(row=>row.clubId===humanId);if(d.mode==='ORDERED')nextOrderedPick(d);else d.pendingClubIds=result.pendingClubIds;if(!acquired&&d.mode==='SIMULTANEOUS'){s.note=`${p.name}は競合抽選で外れました。外れクラブとして再指名してください。`;return}s.note=`${p.name}を${acquired?.contested?'競合抽選で':''}獲得しました。`;runCpuDraft()}
function bid(amount){let a=s.auction,p=a.pool[a.i],human=me(),actions=s.league.clubs.map(club=>club.controllerType==='CPU'?decideCpuAuctionAction(club,p,a.rng):club.id===human.id?{type:ACTION_TYPES.AUCTION_BID,clubId:club.id,playerId:p.id,bid:club.roster.length<12?amount:0}:null).filter(Boolean),result=resolveAuctionActions({clubs:s.league.clubs,player:p,actions,rng:a.rng});if(result.winner)s.league.releasedPlayers=(s.league.releasedPlayers||[]).filter(candidate=>candidate.id!==p.id);s.note=result.winner?`落札 — ${result.winner.name} が ${result.bid}ptで獲得しました。`:`${p.name}は見送りになりました。`;a.i++;if(a.i>=a.pool.length){s.league.releasedPlayers=[];prepareCpuClubs(s.league)}}
app.addEventListener('click',ev=>{let a=ev.target.closest('[data-a]')?.dataset.a,n=ev.target.closest('[data-nav]')?.dataset.nav,p=ev.target.closest('[data-p]')?.dataset.p,m=ev.target.closest('[data-season-match]')?.dataset.seasonMatch;if(m!==undefined){s.match=s.league.seasonResults[Number(m)];s.view='matchDetail';return render()}if(n){s.view=n;if(n!=='squad'){s.selectedLineupPlayerId=null;s.lineupMessage='';s.lineupError=false}return render()}if(p){let x=s.draft.pool.find(q=>q.id===p);if(x&&me().funds>=1&&me().roster.length<12)pickDraft(x);return render()}if(a==='setup'||a==='title'){s.view=a;return render()}if(a==='start'){let name=document.querySelector('#name').value.trim();if(!name)return alert('クラブ名を入力してください。');let seed=document.querySelector('#seed').value.trim()||String(Date.now());s.league=createLeague({name,color:document.querySelector('#color').value,seed});s.offseasonComplete=false;beginDraft();return render()}if(a==='skipDraft'){s.draft.humanDeclined=true;if(s.draft.mode==='ORDERED')nextOrderedPick(s.draft);else s.draft.pendingClubIds=s.draft.pendingClubIds.filter(id=>id!==me().id);runCpuDraft();return render()}if(a==='bid'||a==='pass'){let n=a==='pass'?0:Number(document.querySelector('#bid').value);if(n<0||n>me().funds)return alert('入札額を確認してください。');bid(n);return render()}if(a==='squad'){s.view='squad';return render()}if(a==='season'){let lineup=validateLineup(me());if(!lineup.ok)return alert(lineup.error);s.seasonSimulation=simulateRemainingSeason(s.league);if(s.league.season===10)finalizeSeason(s.league);s.view='seasonResults';return render()}});render();

// Stage 4 off-season screens are layered onto the existing season flow.
import { createContractEvents, createSpecialTrainingOffers, renewalFee, trainingSkills } from './development.js?v=0.17.2';
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
const stage4BaseRender = render;
function stage4Render() {
  if (s.view === 'offseasonEvents') {
    const c=me();
    const due=c.roster.filter(p=>p.contractYears<=0), pending=due.length+s.retentionEvents.length+s.specialOffers.length;
    app.innerHTML = `${head()}<main><p class="eyebrow">オフシーズンイベント</p><h2>契約・要求・特別特訓</h2><p class="hint">このフェーズ終了後、育成フェーズへ進みます。特別特訓の結果は成長結果で表示されます。</p><h3>年数契約</h3>${due.length?due.map(p=>`<article class="candidate">${player(p)}<p>更新費 <b>${renewalFee(p)}pt</b></p><button data-renew="${p.id}" ${c.funds>=renewalFee(p)?'':'disabled'}>契約更新</button><button data-release="${p.id}" class="subtle">更新しない</button></article>`).join(''):'<p class="hint">契約満了者はいません。</p>'}<h3>不満・先発ボーナス要求</h3>${s.retentionEvents.length?s.retentionEvents.map(event=>{const p=c.roster.find(player=>player.id===event.playerId);return p?`<article class="candidate">${player(p)}<p>${event.starter?'先発ボーナス要求':'不満による要求'}：<b>${event.cost}pt</b></p><button data-retention-pay="${p.id}" ${c.funds>=event.cost?'':'disabled'}>支払う</button><button data-retention-release="${p.id}" class="subtle">支払わない</button></article>`:''}).join(''):'<p class="hint">今回の追加要求はありません。</p>'}<h3>若手の特別特訓</h3>${s.specialOffers.length?s.specialOffers.map(offer=>{const p=c.roster.find(player=>player.id===offer.playerId);return p?`<article class="candidate">${player(p)}<p>特別特訓費用：<b>${offer.cost}pt</b></p><button data-special-pay="${p.id}" ${c.funds>=offer.cost?'':'disabled'}>実行する</button><button data-special-skip="${p.id}" class="subtle">見送る</button></article>`:''}).join(''):'<p class="hint">今回の特別特訓候補はありません。</p>'}<button data-stage4="eventsDone" ${pending?'disabled':''}>育成フェーズへ進む</button></main>`; return;
  }
  if (s.view === 'development') {
    const c = me();
    const finance=s.financeSummary?.find(row=>row.clubId===c.id);
    app.innerHTML = `${head()}<main><p class="eyebrow">育成</p><h2>育成する2選手を選択</h2>${finance?`<p class="hint">年間基本資金 +${finance.base}pt${finance.prize?`・順位賞金 +${finance.prize}pt`:''}／持越し上限150pt → 現在${finance.after}pt</p>`:''}<p class="hint">${s.training?.size || 0}/2 選択中</p>${sortControl('development',s.developmentSort)}<section class="candidate-grid">${sortPlayers(c.roster,s.developmentSort).map(p => `<article class="candidate">${player(p)}<button data-train="${p.id}" class="${s.training?.has(p.id) ? '' : 'subtle'}">${s.training?.has(p.id) ? '選択済み' : '育成対象にする'}</button></article>`).join('')}</section><button data-stage4="confirm" ${s.training?.size === 2 ? '' : 'disabled'}>重点能力を選ぶ</button></main>`; return;
  }
  if (s.view === 'focus') {
    const picks = [...s.training.keys()]; const c = me();
    app.innerHTML = `${head()}<main><p class="eyebrow">育成</p><h2>重点能力を選択</h2>${picks.map(id => { const p=c.roster.find(x=>x.id===id); return `<section class="candidate">${player(p)}<label>重点育成<select data-focus="${id}">${trainingSkills(p).map(k=>`<option value="${k}">${STAT_LABELS[k]}</option>`).join('')}</select></label></section>`; }).join('')}<button data-stage4="grow">育成を実行</button></main>`; return;
  }
  if (s.view === 'growth') {
    app.innerHTML = `${head()}<main><p class="eyebrow">成長結果</p><h2>育成・特別特訓の結果</h2><p class="hint">CPU5クラブも育成・成長・衰退・加齢を完了しました。</p><section class="candidate-grid">${s.growth.map(x => `<article class="candidate">${player(x.player)}<p>年齢 ${x.player.age - 1} → ${x.player.age}</p>${x.awakeningKeys?.length ? `<p><b>覚醒！</b></p>` : ''}${x.specialTrainingResult?`<p><b>特別特訓：</b>${x.specialTrainingResult.label}</p>`:''}<p>${x.retired ? '35歳で引退' : x.changes.map(c=>`${STAT_LABELS[c.key]} ${c.from === c.to && c.increased ? `${c.from} ↑` : `${c.from} → ${c.to}`}`).join('<br>') || 'ランク変化なし'}</p>${x.learnedAbility ? `<p><b>特殊能力を習得！</b><br>★ ${x.learnedAbility}</p>` : ''}</article>`).join('')}</section><button data-stage4="releasePhase">放出フェイズへ進む</button></main>`; return;
  }
  if (s.view === 'release') {
    const c=me();
    app.innerHTML = `${head()}<main><p class="eyebrow">選手整理</p><h2>放出フェイズ</h2><p class="hint">市場開始前にロスターを整理できます。登録選手は最低5人、GKは最低1人必要です。各選手カードの放出ボタンから放出できます。</p>${sortControl('release',s.releaseSort)}<section class="candidate-grid">${sortPlayers(c.roster,s.releaseSort).map(p => renderPlayerCard(p, { allowRelease: true })).join('')}</section><button data-stage4="releaseDone">選手整理を終了してドラフトへ進む</button></main>`; return;
  }
  stage4BaseRender();
  if (s.view === 'home' && s.league?.completed && !s.offseasonComplete) app.querySelector('main')?.insertAdjacentHTML('beforeend', s.league.season === 10 ? '<button data-stage6="history">10シーズンの歴史</button>' : '<button data-stage4="offseason">オフシーズンへ進む</button>');
}
render = stage4Render;
app.addEventListener('click', ev => {
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
const stage5BaseRender = render;
function stage5Render() {
  stage5BaseRender();
  if (s.view === 'squad') {
    const c = me();
    const labels={BALANCED:'バランス',POSSESSION:'ポゼッション',DRIBBLE:'ドリブル',COUNTER:'カウンター'};
    const descriptions={BALANCED:'通常再開はPASS 50%・DRIBBLE 50%。攻撃全般 +2。守備成功後はCOUNTER 10%。',POSSESSION:'通常再開はPASS 80%・DRIBBLE 20%。PASS攻撃 +4。守備成功後はCOUNTER 10%。',DRIBBLE:'通常再開はPASS 20%・DRIBBLE 80%。DRIBBLE攻撃 +4。守備成功後はCOUNTER 10%。',COUNTER:'通常再開はPASS 50%・DRIBBLE 50%。COUNTER攻撃・守備・速攻発動判定 +4。守備成功後はCOUNTER 30%。'};
    app.querySelector('.squad-heading-row')?.insertAdjacentHTML('beforeend', `<section class="match-card tactic-panel"><p class="eyebrow">戦術</p><div class="tactic-row">${Object.keys(labels).map(t => `<button data-tactic="${t}" class="${c.tactic===t ? '' : 'subtle'}">${labels[t]}</button>`).join('')}</div><p class="hint">現在：${labels[c.tactic]} — ${descriptions[c.tactic]}</p></section>`);
  }
}
render = stage5Render;
app.addEventListener('click', ev => { const tactic = ev.target.closest('[data-tactic]')?.dataset.tactic; if (tactic) { applyClubAction(me(),{type:ACTION_TYPES.SET_TACTIC,clubId:me().id,tactic}); render(); } });

const stage6BaseRender = render;
function stage6Render() { stage6BaseRender(); if (s.view==='home' && s.league?.completed) { const a=awards(s.league); app.querySelector('main')?.insertAdjacentHTML('beforeend', `<section class="season-awards"><p class="eyebrow">シーズン${s.league.season} 表彰</p><h2>最優秀選手 / ベスト5</h2><div class="candidate-grid">${a.mvp?'<article class="award-card mvp">'+player(a.mvp.p)+'<p class="award-club"><i class="club-color-dot" style="--club:'+e(a.mvp.c.color)+'"></i>'+e(a.mvp.c.name)+'</p><span class="mvp-badge">MVP</span></article>':'<p>該当者なし</p>'}${a.best5.map(x=>'<article class="award-card">'+player(x.p)+'<p class="award-club"><i class="club-color-dot" style="--club:'+e(x.c.color)+'"></i>'+e(x.c.name)+'</p></article>').join('')}</div>${s.league.season===10?'<button data-stage6="history" class="subtle">10シーズンの歴史</button>':'<p class="hint">オフシーズン処理後に次年度市場へ進みます。</p>'}</section>`); } if(s.view==='history'){const records=[...(s.league.careerRecords||[])].sort((a,b)=>b.career.goals-a.career.goals);const leader=(key)=>[...records].sort((a,b)=>b.career[key]-a.career[key]).slice(0,5);app.innerHTML=`${head()}<main><p class="eyebrow">10シーズン完了</p><h2>10シーズンの歴史</h2>${s.league.history.map(h=>`<section class="candidate"><b><i class="club-color-dot" style="--club:${e(h.championColor||'#64748b')}"></i>シーズン${h.season}・優勝 ${e(h.champion)}</b><p>最優秀選手 ${e(h.mvp||'—')}</p><p>最終順位 ${h.table.map(row=>`${row.rank}位 ${row.club}`).join(' ／ ')}</p><p>Best5 ${h.best5.map(row=>typeof row==='string'?row:`${positionLabel(row.position)} ${row.name}`).join(' ／ ')||'—'}</p></section>`).join('')}<h2>通算記録</h2><section class="candidate-grid">${[['得点', 'goals'],['アシスト','assists'],['出場','appearances']].map(([label,key])=>`<section class="candidate"><h3>通算${label}</h3>${leader(key).map((row,index)=>`<p>${index+1}. ${e(row.name)}　${row.career[key]}</p>`).join('')||'<p>記録なし</p>'}</section>`).join('')}</section><button data-nav="home" class="subtle">戻る</button></main>`;} }
render=stage6Render;
app.addEventListener('click',ev=>{const x=ev.target.closest('[data-stage6]')?.dataset.stage6;if(x==='history'){s.view='history';render()}});

import { exportSave, importSave, loadSlot, saveSlot, slotInfo } from './storage.js?v=0.17.2';
const stage7BaseRender = render;
function stage7Render() { stage7BaseRender(); if (s.league) app.querySelector('header')?.insertAdjacentHTML('beforeend','<span><button data-stage7="save">保存</button><button data-stage7="export" class="subtle">書き出し</button><button data-stage7="import" class="subtle">読込</button></span>'); }
render=stage7Render;
app.addEventListener('click',ev=>{const x=ev.target.closest('[data-stage7]')?.dataset.stage7;if(!x)return;try{if(x==='save'){saveSlot(1,s);alert('スロット1に保存しました。')}if(x==='export'){const blob=new Blob([exportSave(s)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='football-league-save.json';a.click();URL.revokeObjectURL(a.href);}if(x==='import'){const text=prompt('ExportしたJSONを貼り付けてください。');if(text){s=importSave(text);render();}}}catch(err){alert(`セーブエラー: ${err.message}`)}});

const stage7SlotsRender = render;
function stage7Slots() { stage7SlotsRender(); if (s.league) app.querySelector('header')?.insertAdjacentHTML('beforeend','<span class="slot-actions"><button data-slot="s1">保存1</button><button data-slot="s2">保存2</button><button data-slot="s3">保存3</button><button data-slot="l1" class="subtle">読込1</button><button data-slot="l2" class="subtle">読込2</button><button data-slot="l3" class="subtle">読込3</button></span>'); }
render=stage7Slots;
app.addEventListener('click',ev=>{const x=ev.target.closest('[data-slot]')?.dataset.slot;if(!x)return;try{const n=Number(x[1]);if(x[0]==='s'){saveSlot(n,s);alert(`スロット${n}に保存しました。`)}else{const saved=loadSlot(n);if(!saved)throw new Error('このスロットは空です。');s=saved;render();}}catch(err){alert(`セーブエラー: ${err.message}`)}});

// Stage 14 lets the human controller submit the same SET_LINEUP action used by CPU controllers.
app.addEventListener('click', event => {
  const playerId = event.target.closest('[data-lineup-player]')?.dataset.lineupPlayer;
  const slotValue = event.target.closest('[data-lineup-slot]')?.dataset.lineupSlot;
  if (playerId) {
    s.selectedLineupPlayerId = playerId;
    s.lineupMessage = '';
    s.lineupError = false;
    render();
    return;
  }
  if (slotValue === undefined || !s.selectedLineupPlayerId) return;
  const slotIndex = Number(slotValue);
  const selected = me().roster.find(player => player.id === s.selectedLineupPlayerId);
  const nextLineup = createLineupPlacement(me().lineup, s.selectedLineupPlayerId, slotIndex);
  const result = applyClubAction(me(), { type: ACTION_TYPES.SET_LINEUP, clubId: me().id, lineup: nextLineup });
  if (!result.ok) { s.lineupMessage = result.error; s.lineupError = true; }
  else {
    const slotNames = ['GK', 'DF', 'MF 1', 'MF 2', 'FW'];
    s.lineupMessage = `${selected.name}を${slotNames[slotIndex]}へ配置しました。${result.warnings.length ? ' 適性外配置があります。' : ''}`;
    s.lineupError = false;
    s.selectedLineupPlayerId = null;
  }
  render();
});

// Stage 10 keeps all public player information in one rank-only card and adds
// in-place roster and player-detail panels to market screens.
const stage10BaseRender = render;
function stage10Players() {
  const lists = [
    ...(s.league?.clubs || []).map(club => club.roster),
    s.draft?.pool || [],
    s.auction?.pool || [],
    s.match?.result?.playerResults?.map(row => row.player) || []
  ];
  return [...new Map(lists.flat().map(player => [player.id, player])).values()];
}
function stage10Render() {
  document.querySelectorAll('.overlay-backdrop,.overlay-panel').forEach(node=>node.remove());
  stage10BaseRender();
  if (!s.league || !s.rosterOpen) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="overlay-backdrop" data-stage10="close"></div>${renderRosterPanel(me(), { allowRelease: Boolean(s.league.releasePhaseOpen) })}`);
}
render = stage10Render;
document.addEventListener('click', event => {
  const action = event.target.closest('[data-stage10]')?.dataset.stage10;
  if (action==='roster') { s.rosterOpen=true; s.detailPlayerId=null; render(); }
  if (action==='release') { const playerId=event.target.closest('[data-release-player]')?.dataset.releasePlayer; if(playerId){const result=applyClubAction(me(),{type:ACTION_TYPES.RELEASE_PLAYER,clubId:me().id,playerId},s.league);if(!result.ok){s.releaseMessage=result.error;render();return}selectBestLineup(me());s.releaseMessage='';s.rosterOpen=s.view !== 'release';s.detailPlayerId=null;render();} }
  if (action==='close') { s.rosterOpen=false; s.detailPlayerId=null; document.querySelectorAll('.overlay-backdrop,.overlay-panel').forEach(node=>node.remove()); }
});
document.addEventListener('keydown', event => { if(event.key==='Escape'&&s.rosterOpen){s.rosterOpen=false;s.detailPlayerId=null;render();} });

// Stage 19 consolidates save controls and limits saves to JSON-safe phases.
const stage19BaseRender = render;
const unsafeSaveViews = new Set(['draft', 'auction', 'development', 'focus']);
const saveAllowed = () => Boolean(s.league) && !unsafeSaveViews.has(s.view);
function slotRows(loadOnly = false) {
  return [1,2,3].map(slot => {
    const info = slotInfo(slot);
    return `<section class="candidate save-slot"><h3>スロット${slot}</h3>${info ? `<p>${e(info.clubName)}・シーズン${info.season}${info.completed?' 終了':''}</p><p class="hint">${e(new Date(info.savedAt).toLocaleString('ja-JP'))}</p>` : '<p class="hint">データなし</p>'}${!loadOnly ? `<button data-stage19="save" data-save-slot="${slot}" ${saveAllowed() ? '' : 'disabled'}>保存</button>` : ''}<button data-stage19="load" data-load-slot="${slot}" class="subtle" ${info ? '' : 'disabled'}>ロード</button></section>`;
  }).join('');
}
function stage19Render() {
  if (s.view === 'loadTitle') {
    app.innerHTML = `<main class="setup"><p class="eyebrow">続きから</p><h2>セーブデータをロード</h2><section class="candidate-grid">${slotRows(true)}</section><button data-stage19="backTitle" class="subtle">タイトルへ戻る</button></main>`;
    return;
  }
  if (s.view === 'savePanel') {
    app.innerHTML = `${head()}<main><p class="eyebrow">セーブ / ロード</p><h2>セーブデータ</h2>${saveAllowed() ? '<p class="hint">現在の画面は保存できます。</p>' : '<p class="lineup-error">この画面ではセーブできません。フェイズ完了後に保存してください。</p>'}<section class="candidate-grid">${slotRows()}</section><div class="season-result-actions"><button data-stage19="export" class="subtle">セーブデータ書き出し</button><button data-stage19="import" class="subtle">セーブデータ読み込み</button><button data-stage19="closeSave" class="subtle">戻る</button></div></main>`;
    return;
  }
  stage19BaseRender();
  if (s.league) {
    const header = app.querySelector('header');
    header?.querySelectorAll('[data-stage7],.slot-actions').forEach(node => node.remove());
    header?.insertAdjacentHTML('beforeend', '<span><button data-stage19="savePanel" class="subtle">セーブ / ロード</button></span>');
  }
}
render = stage19Render;
document.addEventListener('click', event => {
  const action = event.target.closest('[data-stage19]')?.dataset.stage19;
  if (!action) return;
  try {
    if (action === 'loadTitle') { s.view='loadTitle'; return render(); }
    if (action === 'backTitle') { s.view='title'; return render(); }
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
  const scope=event.target.closest('[data-player-sort]')?.dataset.playerSort;
  if(scope==='draft')s.draftSort=event.target.value;
  if(scope==='development')s.developmentSort=event.target.value;
  if(scope==='release')s.releaseSort=event.target.value;
  if(scope)render();
});