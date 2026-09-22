import { createLeague, playCurrentRound, standings } from './league.js';
import { displayPlayer } from './data.js';
import { createRandom } from './random.js';
import { addPlayer, createAuctionPool, createDraftPool, cpuBid, cpuCandidatePick } from './market.js';
const app=document.querySelector('#app');let s={view:'title',league:null,draft:null,auction:null,match:null,round:0,note:''};
const e=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));const me=()=>s.league.clubs.find(c=>c.id===1);const player=p=>{const d=displayPlayer(p);return `<article class="player-card"><b>${e(d.name)}</b><span>${d.primaryPosition} · ${d.age}歳 · Overall ${d.overallRank}</span><small>SHOOT ${d.ranks.shoot} · SPEED ${d.ranks.speed} · DEFENSE ${d.ranks.defense}</small></article>`};
function head(){let c=me(),r=standings(s.league).find(x=>x.club.id===1);return `<header><a data-nav="home" class="brand">FOOTBALL <b>LEAGUE</b></a><span>SEASON 1 / 10</span><span>${e(c.name)} · ${r.rank}位 · ${c.funds}pt</span></header>`}function title(){return `<main class="title"><p>5-A-SIDE CLUB MANAGEMENT</p><h1>FOOTBALL<br><b>LEAGUE</b></h1><button data-a="setup">NEW GAME</button><footer>v0.3.0 · Stage 3</footer></main>`}function setup(){return `<main class="setup"><h2>クラブを作成</h2><label>クラブ名<input id="name" placeholder="Tokyo Five"></label><label>チームカラー<input id="color" type="color" value="#4ade80"></label><label>Seed<input id="seed" placeholder="任意"></label><button data-a="start">START GAME</button><button data-a="title" class="subtle">BACK</button></main>`}
function draft(){let d=s.draft,c=me();return `${head()}<main><p class="eyebrow">SEASON 1 DRAFT · ROUND ${d.round}/4</p><h2>同時秘密指名</h2><p class="hint">1ptで獲得。${e(s.note)}</p><p>資金 <b>${c.funds}pt</b>　ロスター ${c.roster.length}/12</p><section class="candidate-grid">${d.pool.map(p=>`<article class="candidate">${player(p)}<p>${e(p.scoutComment)}</p><button data-p="${p.id}">SELECT</button></article>`).join('')}</section><button data-a="skipDraft" class="subtle">SKIP REMAINING ROUNDS</button></main>`}
function auction(){let a=s.auction,p=a.pool[a.i],c=me();if(!p)return `${head()}<main><section class="hero"><p>AUCTION COMPLETE</p><h2>市場が終了しました</h2><button data-a="squad">GO TO SQUAD</button></section></main>`;return `${head()}<main><p class="eyebrow">AUCTION ${a.i+1}/${a.pool.length}</p><h2>秘密入札</h2><p class="hint">${e(s.note)}</p><article class="candidate">${player(p)}<p>${e(p.scoutComment)}</p></article><label>YOUR BID<input id="bid" type="number" min="0" max="${c.funds}" value="0"></label><button data-a="bid">BID</button><button data-a="pass" class="subtle">PASS</button><p>資金 ${c.funds}pt · ロスター ${c.roster.length}/12</p></main>`}
function table(){let rows=standings(s.league).map(r=>`<tr class="${r.club.id===1?'you':''}"><td>${r.rank}</td><td>${e(r.club.name)}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td>${r.goalsFor}</td><td>${r.goalsAgainst}</td><td>${r.goalDifference}</td><td>${r.points}</td></tr>`).join('');return `${head()}<main><h2>TABLE</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>CLUB</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th></tr></thead><tbody>${rows}</tbody></table></div><button data-nav="home" class="subtle">BACK</button></main>`}
function fixture(){let f=s.league.schedule[s.league.currentRound-1]?.fixtures.find(f=>f.homeId===1||f.awayId===1);return f&&{home:s.league.clubs.find(c=>c.id===f.homeId),away:s.league.clubs.find(c=>c.id===f.awayId)}}function home(){let c=me(),f=fixture();if(s.league.completed)return `${head()}<main><section class="hero"><h2>SEASON 1 FINISHED</h2><button data-nav="table">FINAL TABLE</button></section></main>`;return `${head()}<main><section class="hero" style="--club:${c.color}"><p>ROUND ${s.league.currentRound}/10</p><h2>${e(f.home.name)} VS ${e(f.away.name)}</h2><button data-a="match">PLAY ROUND</button></section><nav><button data-nav="squad">SQUAD</button><button data-nav="table">TABLE</button></nav></main>`}function squad(){let c=me();return `${head()}<main><h2>SQUAD</h2><section class="candidate-grid">${c.roster.map(player).join('')}</section><button data-a="match">PLAY ROUND</button><button data-nav="home" class="subtle">BACK</button></main>`}
function result(){let x=s.match,r=x.result,b=[...r.playerResults].sort((a,b)=>b.rating-a.rating)[0];return `${head()}<main><p>ROUND ${s.round} RESULT</p><div class="scoreboard"><span>${e(x.fixture.home.name)}</span><b>${r.score.home} - ${r.score.away}</b><span>${e(x.fixture.away.name)}</span></div><section class="potm"><p>PLAYER OF THE MATCH</p><h2>${e(b.player.name)}</h2><b>Rating ${b.rating.toFixed(1)}</b></section><div class="log static">${r.events.map(x=>`<p>${x.time} <b>${x.kind}</b> ${e(x.player)}</p>`).join('')}</div><button data-a="continue">CONTINUE</button></main>`}
function render(){app.innerHTML=s.view==='title'?title():s.view==='setup'?setup():s.view==='draft'?draft():s.view==='auction'?auction():s.view==='table'?table():s.view==='squad'?squad():s.view==='result'?result():home()}
function pickDraft(p){let d=s.draft,c=me(),cpu=s.league.clubs.filter(x=>x.id!==1),rival=cpu[0],rPick=cpuCandidatePick(rival,d.pool,d.rng),won=rPick.id!==p.id||d.rng.int(0,1)===0;if(won){addPlayer(c,p,1);d.pool=d.pool.filter(x=>x.id!==p.id);s.note=`${p.name}を獲得しました。`;d.round++}else{s.note=`${p.name}は競合抽選で外れました。再指名してください。`;addPlayer(rival,p,1);d.pool=d.pool.filter(x=>x.id!==p.id);return}for(const x of cpu){let q=cpuCandidatePick(x,d.pool,d.rng);if(q&&x.funds>=1){addPlayer(x,q,1);d.pool=d.pool.filter(z=>z.id!==q.id)}}if(d.round>4){s.auction={pool:createAuctionPool(s.league.seed),i:0,rng:createRandom(`${s.league.seed}:auction`)};s.view='auction';s.note='ドラフト終了。オークションを開始します。'}}
function bid(amount){let a=s.auction,p=a.pool[a.i],bids=s.league.clubs.map(c=>({c,n:c.id===1?amount:cpuBid(c,p,a.rng)})),high=Math.max(...bids.map(x=>x.n));if(high>0){let top=bids.filter(x=>x.n===high),w=top[a.rng.int(0,top.length-1)];addPlayer(w.c,p,high);s.note=`SOLD — ${w.c.name} が ${high}ptで落札しました。`}else s.note=`${p.name}は見送りになりました。`;a.i++}
app.addEventListener('click',ev=>{let a=ev.target.closest('[data-a]')?.dataset.a,n=ev.target.closest('[data-nav]')?.dataset.nav,p=ev.target.closest('[data-p]')?.dataset.p;if(n){s.view=n;return render()}if(p){let x=s.draft.pool.find(q=>q.id===p);if(x&&me().funds>=1)pickDraft(x);return render()}if(a==='setup'||a==='title'){s.view=a;return render()}if(a==='start'){let name=document.querySelector('#name').value.trim();if(!name)return alert('クラブ名を入力してください。');let seed=document.querySelector('#seed').value.trim()||String(Date.now());s.league=createLeague({name,color:document.querySelector('#color').value,seed});s.draft={pool:createDraftPool(seed),round:1,rng:createRandom(`${seed}:draft`)};s.note='Season 1ドラフトを開始します。';s.view='draft';return render()}if(a==='skipDraft'){s.auction={pool:createAuctionPool(s.league.seed),i:0,rng:createRandom(`${s.league.seed}:auction`)};s.view='auction';return render()}if(a==='bid'||a==='pass'){let n=a==='pass'?0:Number(document.querySelector('#bid').value);if(n<0||n>me().funds)return alert('入札額を確認してください。');bid(n);return render()}if(a==='squad'){s.view='squad';return render()}if(a==='match'){let r=playCurrentRound(s.league);s.round=r.round;s.match=r.userMatch;s.view='result';return render()}if(a==='continue'){s.view='home';return render()}});render();

// Stage 4 off-season screens are layered onto the existing season flow.
import { processOffseason, renewalFee, trainingSkills } from './development.js';
const stage4BaseRender = render;
function stage4Render() {
  if (s.view === 'development') {
    const c = me();
    app.innerHTML = `${head()}<main><p class="eyebrow">DEVELOPMENT</p><h2>育成する2選手を選択</h2><p class="hint">${s.training?.size || 0}/2 選択中</p><section class="candidate-grid">${c.roster.map(p => `<article class="candidate">${player(p)}<button data-train="${p.id}" class="${s.training?.has(p.id) ? '' : 'subtle'}">${s.training?.has(p.id) ? 'SELECTED' : 'SELECT'}</button></article>`).join('')}</section><button data-stage4="confirm" ${s.training?.size === 2 ? '' : 'disabled'}>CONFIRM DEVELOPMENT</button></main>`; return;
  }
  if (s.view === 'focus') {
    const picks = [...s.training.keys()]; const c = me();
    app.innerHTML = `${head()}<main><p class="eyebrow">DEVELOPMENT</p><h2>重点能力を選択</h2>${picks.map(id => { const p=c.roster.find(x=>x.id===id); return `<section class="candidate">${player(p)}<label>重点育成<select data-focus="${id}">${trainingSkills(p).map(k=>`<option value="${k}">${k.toUpperCase()}</option>`).join('')}</select></label></section>`; }).join('')}<button data-stage4="grow">CONFIRM</button></main>`; return;
  }
  if (s.view === 'growth') {
    app.innerHTML = `${head()}<main><p class="eyebrow">GROWTH RESULT</p><h2>シーズン後の変化</h2><section class="candidate-grid">${s.growth.map(x => `<article class="candidate">${player(x.player)}<p>${x.player.age - 1} → ${x.player.age}</p><p>${x.retired ? 'RETIRED' : x.changes.map(c=>`${c.key.toUpperCase()} ${c.from} → ${c.to}`).join('<br>') || 'ランク変化なし'}</p></article>`).join('')}</section><button data-stage4="contracts">CONTINUE TO CONTRACTS</button></main>`; return;
  }
  if (s.view === 'contracts') {
    const c=me(), due=c.roster.filter(p=>p.contractYears<=0);
    app.innerHTML = `${head()}<main><p class="eyebrow">CONTRACT</p><h2>契約確認</h2>${due.length ? due.map(p=>`<article class="candidate">${player(p)}<p>更新費 ${renewalFee(p)}pt</p><button data-renew="${p.id}">RENEW</button><button data-release="${p.id}" class="subtle">RELEASE</button></article>`).join('') : '<p class="hint">今季の契約満了者はいません。</p>'}<button data-stage4="done">FINISH OFFSEASON</button></main>`; return;
  }
  stage4BaseRender();
  if (s.view === 'home' && s.league?.completed) app.querySelector('main')?.insertAdjacentHTML('beforeend', '<button data-stage4="offseason">CONTINUE TO OFFSEASON</button>');
}
render = stage4Render;
app.addEventListener('click', ev => {
  const action = ev.target.closest('[data-stage4]')?.dataset.stage4;
  const trainingId = ev.target.closest('[data-train]')?.dataset.train;
  const renewId = ev.target.closest('[data-renew]')?.dataset.renew;
  const releaseId = ev.target.closest('[data-release]')?.dataset.release;
  if (trainingId) { if (s.training.has(trainingId)) s.training.delete(trainingId); else if (s.training.size < 2) s.training.set(trainingId, null); return render(); }
  if (renewId) { const p=me().roster.find(x=>x.id===renewId), fee=renewalFee(p); if (me().funds >= fee) { me().funds -= fee; p.contractYears=3; } return render(); }
  if (releaseId) { me().roster=me().roster.filter(p=>p.id!==releaseId); return render(); }
  if (!action) return;
  if (action==='offseason') { s.training=new Map(); s.view='development'; }
  if (action==='confirm') s.view='focus';
  if (action==='grow') { const focus=new Map([...s.training.keys()].map(id=>[id,document.querySelector(`[data-focus="${id}"]`).value])); s.growth=processOffseason(me(),focus,createRandom(`${s.league.seed}:offseason:1`)); s.view='growth'; }
  if (action==='contracts') s.view='contracts';
  if (action==='done') s.view='home';
  render();
});

// Stage 5 adds visible tactic selection without exposing internal values.
const stage5BaseRender = render;
function stage5Render() {
  stage5BaseRender();
  if (s.view === 'squad') {
    const c = me();
    app.querySelector('main')?.insertAdjacentHTML('afterbegin', `<section class="match-card"><p class="eyebrow">TACTIC</p><div class="tactic-row">${['BALANCED','POSSESSION','DRIBBLE','COUNTER'].map(t => `<button data-tactic="${t}" class="${c.tactic===t ? '' : 'subtle'}">${t}</button>`).join('')}</div><p class="hint">現在：${c.tactic}</p></section>`);
  }
}
render = stage5Render;
app.addEventListener('click', ev => { const tactic = ev.target.closest('[data-tactic]')?.dataset.tactic; if (tactic) { me().tactic = tactic; render(); } });

import { awards, startNextSeason } from './league.js';
const stage6BaseRender = render;
function stage6Render() { stage6BaseRender(); if (s.view==='home' && s.league?.completed) { const a=awards(s.league); app.querySelector('main')?.insertAdjacentHTML('beforeend', `<section class="potm"><p>SEASON ${s.league.season} AWARDS</p><h2>MVP ${e(a.mvp?.p.name||'—')}</h2><p>BEST 5: ${a.best5.map(x=>e(x.p.name)).join(' / ')}</p><button data-stage6="next">START NEXT SEASON</button>${s.league.season===10?'<button data-stage6="history" class="subtle">10 SEASON HISTORY</button>':''}</section>`); } if(s.view==='history'){app.innerHTML=`${head()}<main><p class="eyebrow">10 SEASONS COMPLETE</p><h2>SEASON HISTORY</h2>${s.league.history.map(h=>`<section class="candidate"><b>SEASON ${h.season} · ${e(h.champion)}</b><p>MVP ${e(h.mvp||'—')}</p></section>`).join('')}</main>`;} }
render=stage6Render;
app.addEventListener('click',ev=>{const x=ev.target.closest('[data-stage6]')?.dataset.stage6;if(x==='next'){if(startNextSeason(s.league))s.view='home';render()}if(x==='history'){s.view='history';render()}});

import { exportSave, importSave, loadSlot, saveSlot } from './storage.js';
const stage7BaseRender = render;
function stage7Render() { stage7BaseRender(); if (s.league) app.querySelector('header')?.insertAdjacentHTML('beforeend','<span><button data-stage7="save">SAVE</button><button data-stage7="export" class="subtle">EXPORT</button><button data-stage7="import" class="subtle">IMPORT</button></span>'); }
render=stage7Render;
app.addEventListener('click',ev=>{const x=ev.target.closest('[data-stage7]')?.dataset.stage7;if(!x)return;try{if(x==='save'){saveSlot(1,s);alert('スロット1に保存しました。')}if(x==='export'){const blob=new Blob([exportSave(s)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='football-league-save.json';a.click();URL.revokeObjectURL(a.href);}if(x==='import'){const text=prompt('ExportしたJSONを貼り付けてください。');if(text){s=importSave(text);render();}}}catch(err){alert(`セーブエラー: ${err.message}`)}});

const stage7SlotsRender = render;
function stage7Slots() { stage7SlotsRender(); if (s.league) app.querySelector('header')?.insertAdjacentHTML('beforeend','<span><button data-slot="s1">S1</button><button data-slot="s2">S2</button><button data-slot="s3">S3</button><button data-slot="l1" class="subtle">L1</button><button data-slot="l2" class="subtle">L2</button><button data-slot="l3" class="subtle">L3</button></span>'); }
render=stage7Slots;
app.addEventListener('click',ev=>{const x=ev.target.closest('[data-slot]')?.dataset.slot;if(!x)return;try{const n=Number(x[1]);if(x[0]==='s'){saveSlot(n,s);alert(`スロット${n}に保存しました。`)}else{const saved=loadSlot(n);if(!saved)throw new Error('このスロットは空です。');s=saved;render();}}catch(err){alert(`セーブエラー: ${err.message}`)}});
