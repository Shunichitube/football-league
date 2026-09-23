import { applySeasonFinances, awards, createLeague, simulateRemainingSeason, standings, startNextSeason } from './league.js?v=0.10.0';
import { STAT_LABELS } from './data.js';
import { createRandom } from './random.js';
import { createAuctionPool, createDraftPool, resolveAuctionActions, resolveDraftActions } from './market.js?v=0.9.0';
import { escapeHtml as e, renderLineupEditor, renderMatchDetail, renderPlayerCard, renderPlayerDetail, renderRosterPanel, renderSeasonMatchList, renderSeasonPlayerStats } from './ui.js?v=0.10.0';
import { decideCpuAuctionAction, decideCpuDraftAction, prepareCpuClubs, prepareCpuMarketSpace, processLeagueOffseason, selectBestLineup } from './cpu.js?v=0.9.0';
import { ACTION_TYPES, applyClubAction, createLineupPlacement, validateLineup } from './rules.js?v=0.9.0';
const app=document.querySelector('#app');let s={view:'title',league:null,draft:null,auction:null,match:null,round:0,note:'',rosterOpen:false,detailPlayerId:null,selectedLineupPlayerId:null,lineupMessage:'',lineupError:false,seasonSimulation:null};
const me=()=>s.league.clubs.find(c=>c.controllerType==='HUMAN')||s.league.clubs.find(c=>c.id===s.league.humanClubId);const player=p=>renderPlayerCard(p);
function head(){let c=me(),r=standings(s.league).find(x=>x.club.id===c.id);return `<header><a data-nav="home" class="brand">FOOTBALL <b>LEAGUE</b></a><span>シーズン ${s.league.season} / 10</span><span>${e(c.name)}・${r.rank}位・${c.funds}pt</span></header>`}
function title(){return `<main class="title"><p>5人制クラブ運営ゲーム</p><h1>FOOTBALL<br><b>LEAGUE</b></h1><button data-a="setup">新しく始める</button><footer>v0.11.0・Stage 16</footer></main>`}
function setup(){return `<main class="setup"><h2>クラブを作成</h2><label>クラブ名<input id="name" placeholder="東京ファイブ"></label><label>チームカラー<input id="color" type="color" value="#4ade80"></label><label>シード（任意）<input id="seed" placeholder="同じ値なら同じ展開"></label><button data-a="start">ゲーム開始</button><button data-a="title" class="subtle">戻る</button></main>`}
function draft(){let d=s.draft,c=me(),canPick=d.pendingClubIds.includes(c.id);return `${head()}<main><p class="eyebrow">シーズン${s.league.season} ドラフト・第${d.round}/4巡</p><div class="screen-heading"><h2>完全同時指名</h2><button data-stage10="roster" class="subtle">所属選手を見る</button></div><p class="hint">6クラブが同時に指名し、重複時だけ抽選します。外れたクラブは再指名します。${e(s.note)}</p><p>資金 <b>${c.funds}pt</b>・登録 ${c.roster.length}/12人</p><section class="candidate-grid">${d.pool.map(p=>`<article class="candidate">${player(p)}<p class="scout-comment"><b>スカウト：</b>${e(p.scoutComment)}</p>${canPick?`<button data-p="${p.id}">この選手を指名</button>`:''}</article>`).join('')}</section><button data-a="skipDraft" class="subtle">残りの指名を辞退</button></main>`}
function auction(){let a=s.auction,p=a.pool[a.i],c=me();if(!p)return `${head()}<main><section class="hero"><p>競売完了</p><h2>市場が終了しました</h2><button data-a="squad">編成へ進む</button></section></main>`;return `${head()}<main><p class="eyebrow">競売 ${a.i+1}/${a.pool.length}</p><div class="screen-heading"><h2>秘密入札</h2><button data-stage10="roster" class="subtle">所属選手を見る</button></div><p class="hint">${e(s.note)}</p><article class="candidate">${player(p)}<p class="scout-comment"><b>スカウト：</b>${e(p.scoutComment)}</p></article><label>入札額<input id="bid" type="number" min="0" max="${c.funds}" value="0"></label><button data-a="bid">入札する</button><button data-a="pass" class="subtle">見送る</button><p>資金 ${c.funds}pt・登録 ${c.roster.length}/12人</p></main>`}
function table(){let humanId=me().id,rows=standings(s.league).map(r=>`<tr class="${r.club.id===humanId?'you':''}"><td>${r.rank}</td><td>${e(r.club.name)}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td>${r.goalsFor}</td><td>${r.goalsAgainst}</td><td>${r.goalDifference}</td><td>${r.points}</td></tr>`).join('');return `${head()}<main><h2>順位表</h2><div class="table-wrap"><table><thead><tr><th>順位</th><th>クラブ</th><th>試合</th><th>勝</th><th>分</th><th>敗</th><th>得点</th><th>失点</th><th>得失</th><th>勝点</th></tr></thead><tbody>${rows}</tbody></table></div><button data-nav="home" class="subtle">戻る</button></main>`}
function home(){let c=me(),lineup=validateLineup(c),remaining=Math.max(0,11-s.league.currentRound);if(s.league.completed)return `${head()}<main><section class="hero"><p>全10節・リーグ全30試合終了</p><h2>シーズン${s.league.season}終了</h2><button data-nav="seasonResults">シーズン結果を見る</button><button data-nav="stats" class="subtle">個人成績を見る</button></section></main>`;return `${head()}<main><section class="hero" style="--club:${c.color}"><p>残り${remaining}節</p><h2>編成と戦術を決めてシーズンを開始</h2>${lineup.ok?'<button data-a="season">シーズンをシミュレート</button>':`<p class="lineup-error">${e(lineup.error)}</p><button data-nav="squad">編成を確認する</button>`}</section><nav><button data-nav="squad">編成</button><button data-nav="table">順位表</button><button data-nav="stats">個人成績</button></nav></main>`}
function squad(){let c=me(),lineup=validateLineup(c);return `${head()}<main><h2>編成</h2><p class="hint">所属選手を選び、配置したい枠を押してください。能力はすべてランク表示です。</p>${renderLineupEditor(c,s.selectedLineupPlayerId,s.lineupMessage,s.lineupError)}<button data-a="season" ${lineup.ok?'':'disabled'}>シーズンをシミュレート</button><button data-nav="home" class="subtle">戻る</button></main>`}
function stats(){const c=me();return `${head()}<main><p class="eyebrow">シーズン${s.league.season}</p><h2>所属選手の個人成績</h2>${renderSeasonPlayerStats(c)}<button data-nav="${s.league.completed?'seasonResults':'home'}" class="subtle">戻る</button></main>`}
function seasonResults(){const c=me(),row=standings(s.league).find(result=>result.club.id===c.id),matches=s.league.seasonResults||[];return `${head()}<main><p class="eyebrow">シーズン${s.league.season} 結果</p><h2>最終順位 ${row.rank}位</h2><section class="season-summary-grid"><div><span>勝点</span><b>${row.points}</b></div><div><span>勝</span><b>${row.wins}</b></div><div><span>分</span><b>${row.draws}</b></div><div><span>敗</span><b>${row.losses}</b></div><div><span>得点</span><b>${row.goalsFor}</b></div><div><span>失点</span><b>${row.goalsAgainst}</b></div><div><span>得失点差</span><b>${row.goalDifference}</b></div></section><h2>全10試合</h2>${renderSeasonMatchList(matches,c.id)}<div class="season-result-actions"><button data-nav="stats">シーズン個人成績</button><button data-nav="table" class="subtle">最終順位表</button><button data-nav="home" class="subtle">ホームへ戻る</button></div></main>`}
function matchDetail(){return `${head()}${renderMatchDetail(s.match)}`}
function render(){app.innerHTML=s.view==='title'?title():s.view==='setup'?setup():s.view==='draft'?draft():s.view==='auction'?auction():s.view==='table'?table():s.view==='stats'?stats():s.view==='squad'?squad():s.view==='seasonResults'?seasonResults():s.view==='matchDetail'?matchDetail():home()}
function draftEligibleIds(){let humanId=me().id;return s.league.clubs.filter(club=>club.funds>=1&&club.roster.length<12&&(!s.draft?.humanDeclined||club.id!==humanId)).map(club=>club.id)}
function startAuction(){const season=s.league.season;s.auction={pool:createAuctionPool(s.league.seed,season),i:0,rng:createRandom(`${s.league.seed}:season:${season}:auction`)};s.view='auction';s.note=`シーズン${season}ドラフト終了。競売を開始します。`}
function advanceDraftRound(){let d=s.draft;if(d.pendingClubIds.length)return false;if(d.round>=4){startAuction();return true}d.round++;d.pendingClubIds=draftEligibleIds();return false}
function runCpuDraft(){let guard=0;while(s.view==='draft'&&guard++<100){let d=s.draft,humanId=me().id;if(d.pendingClubIds.includes(humanId))break;if(!d.pendingClubIds.length){if(advanceDraftRound())break;continue}const actions=d.pendingClubIds.map(id=>s.league.clubs.find(club=>club.id===id)).filter(club=>club?.controllerType==='CPU').map(club=>decideCpuDraftAction(club,d.pool,d.rng)).filter(Boolean);const result=resolveDraftActions({clubs:s.league.clubs,candidates:d.pool,pendingClubIds:d.pendingClubIds,actions,rng:d.rng});d.pool=result.candidates;d.pendingClubIds=result.pendingClubIds;if(!result.acquired.length&&result.declinedIds.length===0){d.pendingClubIds=[]}}}
function beginDraft(){const season=s.league.season;prepareCpuMarketSpace(s.league);s.match=null;s.seasonSimulation=null;s.draft={pool:createDraftPool(s.league.seed,season),round:1,rng:createRandom(`${s.league.seed}:season:${season}:draft`),pendingClubIds:s.league.clubs.filter(club=>club.funds>=1&&club.roster.length<12).map(club=>club.id),humanDeclined:false};s.view='draft';s.note=`シーズン${season}ドラフトを開始します。`;runCpuDraft()}
function pickDraft(p){let d=s.draft,humanId=me().id;if(!d.pendingClubIds.includes(humanId))return;const actions=d.pendingClubIds.map(id=>s.league.clubs.find(club=>club.id===id)).map(club=>club?.controllerType==='CPU'?decideCpuDraftAction(club,d.pool,d.rng):club?.id===humanId?{type:ACTION_TYPES.DRAFT_PICK,clubId:club.id,playerId:p.id}:null).filter(Boolean);const result=resolveDraftActions({clubs:s.league.clubs,candidates:d.pool,pendingClubIds:d.pendingClubIds,actions,rng:d.rng});d.pool=result.candidates;d.pendingClubIds=result.pendingClubIds;const acquired=result.acquired.find(row=>row.clubId===humanId);if(!acquired){s.note=`${p.name}は競合抽選で外れました。外れクラブとして再指名してください。`;return}s.note=`${p.name}を${acquired.contested?'競合抽選で':''}獲得しました。`;runCpuDraft()}
function bid(amount){let a=s.auction,p=a.pool[a.i],human=me(),actions=s.league.clubs.map(club=>club.controllerType==='CPU'?decideCpuAuctionAction(club,p,a.rng):club.id===human.id?{type:ACTION_TYPES.AUCTION_BID,clubId:club.id,playerId:p.id,bid:club.roster.length<12?amount:0}:null).filter(Boolean),result=resolveAuctionActions({clubs:s.league.clubs,player:p,actions,rng:a.rng});s.note=result.winner?`落札 — ${result.winner.name} が ${result.bid}ptで獲得しました。`:`${p.name}は見送りになりました。`;a.i++;if(a.i>=a.pool.length)prepareCpuClubs(s.league)}
app.addEventListener('click',ev=>{let a=ev.target.closest('[data-a]')?.dataset.a,n=ev.target.closest('[data-nav]')?.dataset.nav,p=ev.target.closest('[data-p]')?.dataset.p,m=ev.target.closest('[data-season-match]')?.dataset.seasonMatch;if(m!==undefined){s.match=s.league.seasonResults[Number(m)];s.view='matchDetail';return render()}if(n){s.view=n;if(n!=='squad'){s.selectedLineupPlayerId=null;s.lineupMessage='';s.lineupError=false}return render()}if(p){let x=s.draft.pool.find(q=>q.id===p);if(x&&me().funds>=1&&me().roster.length<12)pickDraft(x);return render()}if(a==='setup'||a==='title'){s.view=a;return render()}if(a==='start'){let name=document.querySelector('#name').value.trim();if(!name)return alert('クラブ名を入力してください。');let seed=document.querySelector('#seed').value.trim()||String(Date.now());s.league=createLeague({name,color:document.querySelector('#color').value,seed});s.offseasonComplete=false;beginDraft();return render()}if(a==='skipDraft'){s.draft.humanDeclined=true;s.draft.pendingClubIds=s.draft.pendingClubIds.filter(id=>id!==me().id);runCpuDraft();return render()}if(a==='bid'||a==='pass'){let n=a==='pass'?0:Number(document.querySelector('#bid').value);if(n<0||n>me().funds)return alert('入札額を確認してください。');bid(n);return render()}if(a==='squad'){s.view='squad';return render()}if(a==='season'){let lineup=validateLineup(me());if(!lineup.ok)return alert(lineup.error);s.seasonSimulation=simulateRemainingSeason(s.league);s.view='seasonResults';return render()}});render();

// Stage 4 off-season screens are layered onto the existing season flow.
import { renewalFee, trainingSkills } from './development.js?v=0.11.0';
const stage4BaseRender = render;
function stage4Render() {
  if (s.view === 'development') {
    const c = me();
    const finance=s.financeSummary?.find(row=>row.clubId===c.id);
    app.innerHTML = `${head()}<main><p class="eyebrow">育成</p><h2>育成する2選手を選択</h2>${finance?`<p class="hint">年間基本資金 +${finance.base}pt${finance.prize?`・順位賞金 +${finance.prize}pt`:''}／持越し上限150pt → 現在${finance.after}pt</p>`:''}<p class="hint">${s.training?.size || 0}/2 選択中</p><section class="candidate-grid">${c.roster.map(p => `<article class="candidate">${player(p)}<button data-train="${p.id}" class="${s.training?.has(p.id) ? '' : 'subtle'}">${s.training?.has(p.id) ? '選択済み' : '育成対象にする'}</button></article>`).join('')}</section><button data-stage4="confirm" ${s.training?.size === 2 ? '' : 'disabled'}>重点能力を選ぶ</button></main>`; return;
  }
  if (s.view === 'focus') {
    const picks = [...s.training.keys()]; const c = me();
    app.innerHTML = `${head()}<main><p class="eyebrow">育成</p><h2>重点能力を選択</h2>${picks.map(id => { const p=c.roster.find(x=>x.id===id); return `<section class="candidate">${player(p)}<label>重点育成<select data-focus="${id}">${trainingSkills(p).map(k=>`<option value="${k}">${STAT_LABELS[k]}</option>`).join('')}</select></label></section>`; }).join('')}<button data-stage4="grow">育成を実行</button></main>`; return;
  }
  if (s.view === 'growth') {
    app.innerHTML = `${head()}<main><p class="eyebrow">成長結果</p><h2>シーズン後の変化</h2><p class="hint">CPU5クラブも育成・成長・衰退・加齢・契約判断を完了しました。</p><section class="candidate-grid">${s.growth.map(x => `<article class="candidate">${player(x.player)}<p>年齢 ${x.player.age - 1} → ${x.player.age}</p>${x.awakeningKeys?.length ? `<p><b>覚醒！</b></p>` : ''}<p>${x.retired ? '35歳で引退' : x.changes.map(c=>`${STAT_LABELS[c.key]} ${c.from === c.to && c.increased ? `${c.from} ↑` : `${c.from} → ${c.to}`}`).join('<br>') || 'ランク変化なし'}</p>${x.learnedAbility ? `<p><b>特殊能力を習得！</b><br>★ ${x.learnedAbility}</p>` : ''}</article>`).join('')}</section><button data-stage4="contracts">契約確認へ進む</button></main>`; return;
  }
  if (s.view === 'contracts') {
    const c=me(), due=c.roster.filter(p=>p.contractYears<=0);
    app.innerHTML = `${head()}<main><p class="eyebrow">契約</p><h2>契約確認</h2>${due.length ? due.map(p=>`<article class="candidate">${player(p)}<p>更新費 ${renewalFee(p)}pt</p><button data-renew="${p.id}">契約更新</button><button data-release="${p.id}" class="subtle">放出</button></article>`).join('') : '<p class="hint">今季の契約満了者はいません。</p>'}<button data-stage4="done" ${due.length?'disabled':''}>${s.league.season>=10?'10シーズンを完了':'次年度ドラフトへ進む'}</button></main>`; return;
  }
  stage4BaseRender();
  if (s.view === 'home' && s.league?.completed && !s.offseasonComplete) app.querySelector('main')?.insertAdjacentHTML('beforeend', '<button data-stage4="offseason">オフシーズンへ進む</button>');
}
render = stage4Render;
app.addEventListener('click', ev => {
  const action = ev.target.closest('[data-stage4]')?.dataset.stage4;
  const trainingId = ev.target.closest('[data-train]')?.dataset.train;
  const renewId = ev.target.closest('[data-renew]')?.dataset.renew;
  const releaseId = ev.target.closest('[data-release]')?.dataset.release;
  if (trainingId) { if (s.training.has(trainingId)) s.training.delete(trainingId); else if (s.training.size < 2) s.training.set(trainingId, null); return render(); }
  if (renewId) { applyClubAction(me(),{type:ACTION_TYPES.RENEW_CONTRACT,clubId:me().id,playerId:renewId}); return render(); }
  if (releaseId) { applyClubAction(me(),{type:ACTION_TYPES.RELEASE_PLAYER,clubId:me().id,playerId:releaseId}); selectBestLineup(me()); return render(); }
  if (!action) return;
  if (action==='offseason') { s.financeSummary=applySeasonFinances(s.league); s.training=new Map(); s.view='development'; }
  if (action==='confirm') s.view='focus';
  if (action==='grow') { const focus=new Map([...s.training.keys()].map(id=>[id,document.querySelector(`[data-focus="${id}"]`).value])); const summaries=processLeagueOffseason(s.league,focus); s.growth=summaries.find(x=>x.clubId===me().id).growth; s.cpuOffseason=summaries.filter(x=>s.league.clubs.find(club=>club.id===x.clubId)?.controllerType==='CPU'); s.view='growth'; }
  if (action==='contracts') s.view='contracts';
  if (action==='done') { const advanced=startNextSeason(s.league); if(advanced){s.offseasonComplete=false;beginDraft()}else{s.offseasonComplete=true;s.view='home'} }
  render();
});

// Stage 5 adds visible tactic selection without exposing internal values.
const stage5BaseRender = render;
function stage5Render() {
  stage5BaseRender();
  if (s.view === 'squad') {
    const c = me();
    const labels={BALANCED:'バランス',POSSESSION:'ポゼッション',DRIBBLE:'ドリブル',COUNTER:'カウンター'};
    app.querySelector('main')?.insertAdjacentHTML('afterbegin', `<section class="match-card"><p class="eyebrow">戦術</p><div class="tactic-row">${Object.keys(labels).map(t => `<button data-tactic="${t}" class="${c.tactic===t ? '' : 'subtle'}">${labels[t]}</button>`).join('')}</div><p class="hint">現在：${labels[c.tactic]}</p></section>`);
  }
}
render = stage5Render;
app.addEventListener('click', ev => { const tactic = ev.target.closest('[data-tactic]')?.dataset.tactic; if (tactic) { applyClubAction(me(),{type:ACTION_TYPES.SET_TACTIC,clubId:me().id,tactic}); render(); } });

const stage6BaseRender = render;
function stage6Render() { stage6BaseRender(); if (s.view==='home' && s.league?.completed) { const a=awards(s.league); app.querySelector('main')?.insertAdjacentHTML('beforeend', `<section class="season-awards"><p class="eyebrow">シーズン${s.league.season} 表彰</p><h2>最優秀選手</h2>${a.mvp?player(a.mvp.p):'<p>該当者なし</p>'}<h2>ベスト5</h2><div class="candidate-grid">${a.best5.map(x=>player(x.p)).join('')}</div>${s.offseasonComplete&&s.league.season===10?'<button data-stage6="history" class="subtle">10シーズンの歴史</button>':'<p class="hint">オフシーズン処理後に次年度市場へ進みます。</p>'}</section>`); } if(s.view==='history'){app.innerHTML=`${head()}<main><p class="eyebrow">10シーズン完了</p><h2>シーズン記録</h2>${s.league.history.map(h=>`<section class="candidate"><b>シーズン${h.season}・優勝 ${e(h.champion)}</b><p>最優秀選手 ${e(h.mvp||'—')}</p></section>`).join('')}</main>`;} }
render=stage6Render;
app.addEventListener('click',ev=>{const x=ev.target.closest('[data-stage6]')?.dataset.stage6;if(x==='history'){s.view='history';render()}});

import { exportSave, importSave, loadSlot, saveSlot } from './storage.js';
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
    const slotNames = ['GK', 'FIXO', 'ALA 1', 'ALA 2', 'PIVO'];
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
  if (!s.league || (!s.rosterOpen && !s.detailPlayerId)) return;
  const selected = s.detailPlayerId ? stage10Players().find(player => player.id === s.detailPlayerId) : null;
  document.body.insertAdjacentHTML('beforeend', `<div class="overlay-backdrop" data-stage10="close"></div>${selected ? renderPlayerDetail(selected) : renderRosterPanel(me())}`);
}
render = stage10Render;
document.addEventListener('click', event => {
  const detailId = event.target.closest('[data-detail]')?.dataset.detail;
  const action = event.target.closest('[data-stage10]')?.dataset.stage10;
  if (detailId) { s.detailPlayerId=detailId; s.rosterOpen=false; render(); return; }
  if (action==='roster') { s.rosterOpen=true; s.detailPlayerId=null; render(); }
  if (action==='close') { s.rosterOpen=false; s.detailPlayerId=null; document.querySelectorAll('.overlay-backdrop,.overlay-panel').forEach(node=>node.remove()); }
});
document.addEventListener('keydown', event => { if(event.key==='Escape'&&(s.rosterOpen||s.detailPlayerId)){s.rosterOpen=false;s.detailPlayerId=null;render();} });
