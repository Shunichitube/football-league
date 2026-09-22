import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from '../js/random.js';
import { calculateOverall, createClub, createPlayer, FIRST_NAMES, LAST_NAMES } from '../js/data.js';
import { simulateMatch } from '../js/sim.js';
import { createLeague, createSchedule, playCurrentRound, standings, startNextSeason } from '../js/league.js';
import { createAuctionPool, createDraftPool, createScoutComment, cpuBid, SPECIAL_ABILITIES } from '../js/market.js';
import { processOffseason, renewalFee, trainingSkills } from '../js/development.js';
import { exportSave, importSave } from '../js/storage.js';
import { runBatch } from '../js/batch.js';
import { positionCounts, renderPlayerCard, renderPlayerDetail, renderRosterPanel } from '../js/ui.js';

function match(seed) { const source = createRandom(seed); const home = createClub({ id: 1, name: 'HOME', color: '#fff', seed: source }); const away = createClub({ id: 2, name: 'AWAY', color: '#000', seed: source }); return simulateMatch(home, away, createRandom(`${seed}:match:1`)); }
test('同じseedは同じ試合結果になる', () => assert.deepEqual(match('repeatable'), match('repeatable')));
test('1試合は80フェーズを完走し、初期ロスターは5人', () => { const r = match('complete'); assert.equal(r.phases, 80); assert.equal(r.playerResults.length, 10); assert.ok(r.score.home >= 0 && r.score.away >= 0); });
test('6クラブの日程は全30試合で、各クラブが10試合になる', () => { const schedule = createSchedule([1, 2, 3, 4, 5, 6]); assert.equal(schedule.length, 10); assert.equal(schedule.flatMap(r => r.fixtures).length, 30); const count = new Map([1,2,3,4,5,6].map(id => [id, 0])); schedule.flatMap(r => r.fixtures).forEach(f => { count.set(f.homeId, count.get(f.homeId) + 1); count.set(f.awayId, count.get(f.awayId) + 1); }); assert.deepEqual([...count.values()], [10,10,10,10,10,10]); });
test('リーグは10節・全30試合を完走し、順位表の勝点を正常に集計する', () => { const league = createLeague({ name: 'YOU', color: '#fff', seed: 'season' }); while (!league.completed) playCurrentRound(league); const table = standings(league); assert.equal(league.currentRound, 11); assert.equal(table.reduce((n, row) => n + row.played, 0), 60); assert.equal(table.reduce((n, row) => n + row.wins, 0), table.reduce((n, row) => n + row.losses, 0)); assert.ok(table.every(row => row.played === 10 && row.points >= 0)); });
test('市場候補は仕様数で生成され、CPU入札は資金と登録上限を超えない', () => { const league = createLeague({ name: 'YOU', color: '#fff', seed: 'market' }); const draft = createDraftPool('market'), auction = createAuctionPool('market'); assert.equal(draft.length, 24); assert.equal(auction.length, 18); const bid = cpuBid(league.clubs[1], auction[0], createRandom('bid')); assert.ok(bid >= 0 && bid <= 95); league.clubs[1].roster = Array(12).fill({}); assert.equal(cpuBid(league.clubs[1], auction[0], createRandom('full')), 0); });
test('オフシーズンは年齢・契約を進め、育成対象は選択可能な能力だけを使う', () => { const league = createLeague({ name: 'YOU', color: '#fff', seed: 'growth' }); const p = league.clubs[0].roster[0]; assert.ok(trainingSkills(p).includes('gk')); const before = p.contractYears; const result = processOffseason(league.clubs[0], new Map([[p.id, 'gk']]), createRandom('growth')); assert.equal(p.age, 26); assert.equal(p.contractYears, before - 1); assert.equal(result.length, 5); assert.ok(renewalFee(p) >= 1 && renewalFee(p) <= 20); });
test('調子・戦術・特殊能力を含む試合は能力値を恒久的に変更しない', () => { const source = createRandom('tactic'); const home = createClub({ id: 1, name: 'HOME', color: '#fff', seed: source }); const away = createClub({ id: 2, name: 'AWAY', color: '#000', seed: source }); home.tactic = 'COUNTER'; away.tactic = 'POSSESSION'; home.roster[4].specialAbility = 'フィニッシャー'; away.roster[0].specialAbility = 'ショットストッパー'; const before = JSON.stringify(home.roster.map(p => p.stats)); const result = simulateMatch(home, away, createRandom('tactic-match')); assert.equal(result.phases, 80); assert.equal(JSON.stringify(home.roster.map(p => p.stats)), before); assert.equal(Object.keys(result.forms).length, 10); });
test('10シーズンの履歴を保存して完走できる', () => { const l=createLeague({name:'YOU',color:'#fff',seed:'ten'}); for(let i=0;i<10;i++){while(!l.completed)playCurrentRound(l); startNextSeason(l);} assert.equal(l.history.length,10); assert.equal(l.history[0].table.length,6); });
test('ExportしたJSONはImportでき、不正形式は拒否する', () => { const state={league:createLeague({name:'YOU',color:'#fff',seed:'save'})}; assert.equal(importSave(exportSave(state)).league.seed,'save'); assert.throws(()=>importSave('{}')); });
test('バッチ検証は100リーグを完走し、集計値を返す', () => { const r=runBatch(100); assert.equal(r.leagues,100); assert.equal(r.matches,3000); assert.ok(r.averageGoals>0 && r.drawRate>=0 && r.drawRate<=1); });

test('名前候補は苗字150種・名前100種以上でseeded randomから生成される', () => {
  assert.ok(LAST_NAMES.length >= 150);
  assert.ok(FIRST_NAMES.length >= 100);
  const rngA=createRandom('names'), rngB=createRandom('names');
  const namesA=Array.from({length:100},(_,i)=>createPlayer(9000+i,'ALA',rngA).name);
  const namesB=Array.from({length:100},(_,i)=>createPlayer(9000+i,'ALA',rngB).name);
  assert.deepEqual(namesA,namesB);
  assert.ok(new Set(namesA).size >= 95);
});

test('hiddenGrowthは能力別で、初期選手と通常選手の範囲を守る', () => {
  const initial=createPlayer(1,'GK',createRandom('initial-growth'),{initial:true});
  const normal=createPlayer(2,'PIVO',createRandom('normal-growth'));
  assert.equal(typeof initial.hiddenGrowth,'object');
  assert.deepEqual(Object.keys(normal.hiddenGrowth),['shoot','speed','defense','dribble','pass']);
  assert.ok(Object.values(initial.hiddenGrowth).every(x=>x>=.55&&x<=.75));
  assert.ok(Object.values(normal.hiddenGrowth).every(x=>x>=.70&&x<=1.30));
});

test('能力ごとのhiddenGrowthが個別の成長量に反映される', () => {
  const club=createClub({id:1,name:'TEST',color:'#fff',seed:createRandom('individual-growth')});
  const p=club.roster.find(x=>x.primaryPosition==='ALA');
  p.age=18; p.season.appearances=10; Object.keys(p.stats).forEach(k=>p.stats[k]=60);
  p.hiddenGrowth={shoot:1.30,speed:.70,defense:.70,dribble:.70,pass:.70};
  const before={...p.stats};
  processOffseason(club,new Map(),{next:()=>.5,int:()=>1});
  assert.ok(p.stats.shoot-before.shoot > p.stats.defense-before.defense);
});

test('Overallはポジション別の重みで計算される', () => {
  const stats={shoot:50,speed:50,defense:90,dribble:50,pass:50,gk:50};
  assert.equal(calculateOverall({primaryPosition:'FIXO',stats}),64);
  assert.equal(calculateOverall({primaryPosition:'ALA',stats}),54);
  assert.equal(calculateOverall({primaryPosition:'PIVO',stats}),54);
});

test('市場の特殊能力は約40%で、全候補が生成対象に含まれる', () => {
  let total=0,withAbility=0; const seen=new Set();
  for(let i=0;i<120;i++) for(const p of [...createDraftPool(`ability-${i}`),...createAuctionPool(`ability-${i}`)]) { total++; if(p.specialAbility){withAbility++;seen.add(p.specialAbility);} }
  const rate=withAbility/total;
  assert.ok(rate>=.36&&rate<=.44,`special ability rate: ${rate}`);
  assert.deepEqual([...seen].sort(),Object.values(SPECIAL_ABILITIES).flat().sort());
});

test('スカウトコメントは能力別成長傾向で変わり、レア成長コメントも生成可能', () => {
  const rng=createRandom('scout-base'); const p=createPlayer(88,'ALA',rng); p.age=19; p.specialAbility='ドリブラー';
  p.hiddenGrowth={shoot:1.30,speed:.70,defense:.70,dribble:.70,pass:.70};
  const shoot=createScoutComment(p,{pick:a=>a[0],next:()=>1});
  p.hiddenGrowth={shoot:.70,speed:.70,defense:.70,dribble:.70,pass:1.30};
  const pass=createScoutComment(p,{pick:a=>a[0],next:()=>1});
  assert.match(shoot,/得点感覚/); assert.match(pass,/配球面/); assert.notEqual(shoot,pass);
  p.hiddenGrowth={shoot:1.30,speed:1.30,defense:1.30,dribble:1.30,pass:1.30};
  assert.match(createScoutComment(p,{pick:a=>a[0],next:()=>0}),/天才肌かもしれない/);
  assert.doesNotMatch(shoot,/成長率|確実に|必ず/);
});

test('主要選手カードは全能力をランク表示し、内部能力値を表示しない', () => {
  const p=createPlayer(501,'ALA',createRandom('ui-card'));
  p.age=21; p.contractYears=2; p.stats={shoot:83,speed:79,defense:67,dribble:76,pass:71,gk:50}; p.specialAbility='ドリブラー';
  const html=renderPlayerCard(p);
  for(const label of ['総合','シュート','走力','守備','ドリブル','パス','★ ドリブラー','契約2年','選手詳細']) assert.match(html,new RegExp(label));
  for(const internal of ['83','79','67','76','71']) assert.doesNotMatch(html,new RegExp(`>${internal}<`));
  assert.doesNotMatch(html,/hiddenGrowth/);
});

test('GKカード・選手詳細はGKランクと特殊能力の説明を表示する', () => {
  const p=createPlayer(502,'GK',createRandom('ui-gk')); p.specialAbility='守護神'; p.stats.gk=86;
  const card=renderPlayerCard(p), detail=renderPlayerDetail(p);
  assert.match(card,/<dt>GK<\/dt><dd>S<\/dd>/);
  assert.match(detail,/ゴール前で総合的に力を発揮する/);
  assert.match(detail,/今季成績/);
  assert.doesNotMatch(detail,/>86</);
});

test('所属選手パネルはポジション人数と全選手の公開情報を表示する', () => {
  const club=createClub({id:7,name:'TEST CLUB',color:'#fff',seed:createRandom('roster-panel')});
  assert.deepEqual(positionCounts(club.roster).map(x=>x.count),[1,1,2,1]);
  const html=renderRosterPanel(club);
  assert.match(html,/所属選手/); assert.match(html,/GK <b>1<\/b>/); assert.match(html,/ALA <b>2<\/b>/);
  for(const p of club.roster) assert.match(html,new RegExp(p.name));
});
