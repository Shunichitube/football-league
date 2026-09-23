import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from '../js/random.js';
import { calculateOverall, createClub, createPlayer, displayPlayer, FIRST_NAMES, LAST_NAMES } from '../js/data.js';
import { simulateMatch } from '../js/sim.js';
import { applySeasonFinances, clubsForController, createLeague, createSchedule, playCurrentRound, simulateRemainingSeason, standings, startNextSeason } from '../js/league.js';
import { cpuBid, createAuctionPool, createDraftPool, createScoutComment, resolveAuctionActions, resolveDraftActions, SPECIAL_ABILITIES } from '../js/market.js';
import { processOffseason, renewalFee, trainingSkills } from '../js/development.js';
import { exportSave, importSave } from '../js/storage.js';
import { runBatch } from '../js/batch.js';
import { matchOutcomeForClub, positionCounts, renderLineupEditor, renderMatchDetail, renderPlayerCard, renderPlayerDetail, renderRosterPanel, renderSeasonMatchList, renderSeasonPlayerStats } from '../js/ui.js';
import { autoSetCpuTactic, decideCpuAuctionAction, decideCpuDraftAction, manageCpuContracts, prepareCpuClubs, prepareCpuMarketSpace, processLeagueOffseason, selectBestLineup, selectCpuTraining } from '../js/cpu.js';
import { ACTION_TYPES, applyClubAction, createLineupPlacement, LINEUP_SLOTS, positionSuitability, validateLineup } from '../js/rules.js';

function match(seed) { const source = createRandom(seed); const home = createClub({ id: 1, name: 'HOME', color: '#fff', seed: source }); const away = createClub({ id: 2, name: 'AWAY', color: '#000', seed: source }); return simulateMatch(home, away, createRandom(`${seed}:match:1`)); }
function draftActions(league,pending,pool,rng,humanPickId=pool[0]?.id){return pending.map(id=>league.clubs.find(club=>club.id===id)).map(club=>club.controllerType==='CPU'?decideCpuDraftAction(club,pool,rng):{type:ACTION_TYPES.DRAFT_PICK,clubId:club.id,playerId:humanPickId}).filter(Boolean);}
test('同じseedは同じ試合結果になる', () => assert.deepEqual(match('repeatable'), match('repeatable')));
test('1試合は80フェーズを完走し、初期ロスターは5人', () => { const r = match('complete'); assert.equal(r.phases, 80); assert.equal(r.playerResults.length, 10); assert.ok(r.score.home >= 0 && r.score.away >= 0); });
test('6クラブの日程は全30試合で、各クラブが10試合になる', () => { const schedule = createSchedule([1, 2, 3, 4, 5, 6]); assert.equal(schedule.length, 10); assert.equal(schedule.flatMap(r => r.fixtures).length, 30); const count = new Map([1,2,3,4,5,6].map(id => [id, 0])); schedule.flatMap(r => r.fixtures).forEach(f => { count.set(f.homeId, count.get(f.homeId) + 1); count.set(f.awayId, count.get(f.awayId) + 1); }); assert.deepEqual([...count.values()], [10,10,10,10,10,10]); });
test('リーグは10節・全30試合を完走し、順位表の勝点を正常に集計する', () => { const league = createLeague({ name: 'YOU', color: '#fff', seed: 'season' }); while (!league.completed) playCurrentRound(league); const table = standings(league); assert.equal(league.currentRound, 11); assert.equal(table.reduce((n, row) => n + row.played, 0), 60); assert.equal(table.reduce((n, row) => n + row.wins, 0), table.reduce((n, row) => n + row.losses, 0)); assert.ok(table.every(row => row.played === 10 && row.points >= 0)); });
test('シーズン一括進行は10節・全30試合を処理し、人間クラブ10試合を保存する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'bulk-season'}), result=simulateRemainingSeason(league);
  assert.equal(result.rounds.length,10);
  assert.equal(result.matchesProcessed,30);
  assert.equal(result.humanMatches.length,10);
  assert.equal(league.seasonResults.length,10);
  assert.equal(league.completed,true);
  assert.equal(league.currentRound,11);
  assert.ok(standings(league).every(row=>row.played===10));
});
test('途中節からの一括進行は残り試合だけを処理し、保存結果を10試合へ揃える', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'remaining-season'});
  playCurrentRound(league);
  const result=simulateRemainingSeason(league);
  assert.equal(result.rounds.length,9);
  assert.equal(result.matchesProcessed,27);
  assert.equal(league.seasonResults.length,10);
  assert.deepEqual(league.seasonResults.map(match=>match.round),[1,2,3,4,5,6,7,8,9,10]);
});
test('保存した人間クラブ戦は節・対戦・スコア・選手成績・イベント・試合ごとの調子を保持する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'saved-matches'});
  simulateRemainingSeason(league);
  for(const match of league.seasonResults){
    assert.ok(match.round>=1&&match.round<=10);
    assert.ok(match.fixture.homeId===1||match.fixture.awayId===1);
    assert.ok(Number.isInteger(match.result.score.home)&&Number.isInteger(match.result.score.away));
    assert.equal(match.result.playerResults.length,10);
    assert.ok(match.result.events.length>0);
    assert.equal(Object.keys(match.result.forms).length,10);
    assert.ok(match.result.playerResults.every(row=>['↑','−','↓'].includes(match.result.forms[row.player.id])));
  }
});
test('市場候補は仕様数で生成され、CPU入札は資金と登録上限を超えない', () => { const league = createLeague({ name: 'YOU', color: '#fff', seed: 'market' }); const draft = createDraftPool('market'), auction = createAuctionPool('market'); assert.equal(draft.length, 24); assert.equal(auction.length, 18); const bid = cpuBid(league.clubs[1], auction[0], createRandom('bid')); assert.ok(bid >= 0 && bid <= 95); league.clubs[1].roster = Array(12).fill({}); assert.equal(cpuBid(league.clubs[1], auction[0], createRandom('full')), 0); });
test('市場候補はOverallティアを保ちながら能力ランクが個別にばらける', () => {
  const players=Array.from({length:100},(_,i)=>[...createDraftPool(`varied-${i}`),...createAuctionPool(`varied-${i}`)]).flat();
  const abilityKeys=p=>p.primaryPosition==='GK'?['shoot','speed','defense','dribble','pass','gk']:['shoot','speed','defense','dribble','pass'];
  assert.ok(players.every(p=>displayPlayer(p).overallRank===p.marketTier));
  const varied=players.filter(p=>new Set(abilityKeys(p).map(key=>displayPlayer(p).ranks[key])).size>=2);
  assert.ok(varied.length/players.length>=.85,`varied rate: ${varied.length/players.length}`);
  const rankA=players.filter(p=>p.marketTier==='A');
  assert.ok(rankA.length>=20);
  assert.ok(rankA.every(p=>new Set(abilityKeys(p).map(key=>displayPlayer(p).ranks[key])).size>=2));
});
test('市場候補の能力傾向はポジションの役割を反映する', () => {
  const players=Array.from({length:120},(_,i)=>createAuctionPool(`position-profile-${i}`)).flat();
  const average=(position,key)=>{const list=players.filter(p=>p.primaryPosition===position);return list.reduce((sum,p)=>sum+p.stats[key],0)/list.length;};
  assert.ok(average('GK','gk')>average('GK','defense'));
  assert.ok(average('FIXO','defense')>average('FIXO','shoot'));
  assert.ok(average('ALA','speed')>average('ALA','defense'));
  assert.ok(average('ALA','dribble')>average('ALA','defense'));
  assert.ok(average('PIVO','shoot')>average('PIVO','defense'));
});
test('オフシーズンは年齢・契約を進め、育成対象は選択可能な能力だけを使う', () => { const league = createLeague({ name: 'YOU', color: '#fff', seed: 'growth' }); const p = league.clubs[0].roster[0]; assert.ok(trainingSkills(p).includes('gk')); const before = p.contractYears; const result = processOffseason(league.clubs[0], new Map([[p.id, 'gk']]), createRandom('growth')); assert.equal(p.age, 26); assert.equal(p.contractYears, before - 1); assert.equal(result.length, 5); assert.ok(renewalFee(p) >= 1 && renewalFee(p) <= 20); });
test('調子・戦術・特殊能力を含む試合は能力値を恒久的に変更しない', () => { const source = createRandom('tactic'); const home = createClub({ id: 1, name: 'HOME', color: '#fff', seed: source }); const away = createClub({ id: 2, name: 'AWAY', color: '#000', seed: source }); home.tactic = 'COUNTER'; away.tactic = 'POSSESSION'; home.roster[4].specialAbility = 'フィニッシャー'; away.roster[0].specialAbility = 'ショットストッパー'; const before = JSON.stringify(home.roster.map(p => p.stats)); const result = simulateMatch(home, away, createRandom('tactic-match')); assert.equal(result.phases, 80); assert.equal(JSON.stringify(home.roster.map(p => p.stats)), before); assert.equal(Object.keys(result.forms).length, 10); });
test('10シーズンの履歴を保存して完走できる', () => { const l=createLeague({name:'YOU',color:'#fff',seed:'ten'}); for(let i=0;i<10;i++){while(!l.completed)playCurrentRound(l); startNextSeason(l);} assert.equal(l.history.length,10); assert.equal(l.history[0].table.length,6); });
test('ExportしたJSONはImportでき、不正形式は拒否する', () => { const state={league:createLeague({name:'YOU',color:'#fff',seed:'save'})}; assert.equal(importSave(exportSave(state)).league.seed,'save'); assert.throws(()=>importSave('{}')); });
test('旧セーブはcontrollerTypeを補完して読み込める', () => { const state={league:createLeague({name:'YOU',color:'#fff',seed:'legacy-controller'})}; state.league.clubs.forEach(club=>delete club.controllerType); const restored=importSave(exportSave(state)); assert.equal(restored.league.clubs.filter(club=>club.controllerType==='HUMAN').length,1); assert.equal(restored.league.clubs.filter(club=>club.controllerType==='CPU').length,5); });
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

test('CPUは新加入の強い選手を含めてスタメン5人を再選出する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'cpu-lineup'}), club=league.clubs[1];
  const signing=createPlayer(9901,'ALA',createRandom('cpu-signing'));
  signing.stats={shoot:95,speed:95,defense:95,dribble:95,pass:95};
  club.roster.push(signing);
  selectBestLineup(club);
  const starters=club.lineup.map(id=>club.roster.find(p=>p.id===id));
  assert.equal(new Set(club.lineup).size,5);
  assert.equal(starters.filter(p=>p.primaryPosition==='GK').length,1);
  assert.ok(club.lineup.includes(signing.id));
});

test('CPUはスタメン能力に応じて戦術を自動変更する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'cpu-tactic'}), club=league.clubs[1];
  selectBestLineup(club);
  const field=club.lineup.map(id=>club.roster.find(p=>p.id===id)).filter(p=>p.primaryPosition!=='GK');
  field.forEach(p=>Object.assign(p.stats,{pass:90,dribble:60,speed:60}));
  assert.equal(autoSetCpuTactic(club),'POSSESSION');
  field.forEach(p=>Object.assign(p.stats,{pass:60,dribble:60,speed:90}));
  assert.equal(autoSetCpuTactic(club),'COUNTER');
  field.forEach(p=>Object.assign(p.stats,{pass:70,dribble:70,speed:70}));
  assert.equal(autoSetCpuTactic(club),'BALANCED');
});

test('CPU育成対象は公開能力・年齢・起用実績から2人を選びhiddenGrowthを参照しない', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'cpu-training'}), club=league.clubs[1];
  const before=[...selectCpuTraining(club).entries()];
  club.roster.forEach((p,i)=>{p.hiddenGrowth={shoot:i%2?99:0,speed:99,defense:0,dribble:99,pass:0,gk:99};});
  const after=[...selectCpuTraining(club).entries()];
  assert.equal(before.length,2);
  assert.deepEqual(after,before);
});

test('全6クラブへ加齢・成長・衰退・契約年数処理を適用する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'all-offseason'});
  const veteran=league.clubs[1].roster[1]; veteran.age=29; veteran.stats.speed=80;
  const tracked=league.clubs.map(club=>({club,id:club.roster[1].id,age:club.roster[1].age,contract:club.roster[1].contractYears}));
  const speedBefore=veteran.stats.speed;
  const summaries=processLeagueOffseason(league,new Map());
  assert.equal(summaries.length,6);
  for(const row of tracked){const p=row.club.roster.find(player=>player.id===row.id);assert.ok(p);assert.equal(p.age,row.age+1);assert.equal(p.contractYears,row.contract-1);}
  assert.ok(veteran.stats.speed<speedBefore);
  assert.ok(summaries.slice(1).every(row=>row.training.length===2));
});

test('CPUは契約満了者を更新・放出しつつ最低5人とGKを維持する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'cpu-contract'}), club=league.clubs[1];
  const strong=createPlayer(9902,'PIVO',createRandom('strong-contract'));
  strong.stats={shoot:95,speed:90,defense:80,dribble:92,pass:88}; strong.contractYears=0;
  const weak=createPlayer(9903,'PIVO',createRandom('weak-contract'));
  weak.stats={shoot:35,speed:35,defense:35,dribble:35,pass:35}; weak.age=34; weak.contractYears=0;
  club.roster.push(strong,weak); selectBestLineup(club); club.funds=100;
  const decisions=manageCpuContracts(club);
  assert.equal(decisions.find(row=>row.player.id===strong.id)?.action,'RENEW');
  assert.equal(decisions.find(row=>row.player.id===weak.id)?.action,'RELEASE');
  assert.ok(club.roster.length>=5);
  assert.ok(club.roster.some(p=>p.primaryPosition==='GK'));
});

test('CPU5クラブは毎シーズンの編成と戦術設定を完了する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'cpu-prepare'});
  const result=prepareCpuClubs(league);
  assert.equal(result.length,5);
  assert.ok(result.every(row=>row.lineup.length===5));
  assert.ok(result.every(row=>['BALANCED','POSSESSION','DRIBBLE','COUNTER'].includes(row.tactic)));
});

test('Season 1ドラフトは6クラブ同時指名で競合抽選し、外れクラブを再指名へ残す', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'simultaneous'});
  const candidate=createDraftPool('simultaneous',1)[0];
  const pending=league.clubs.map(club=>club.id);
  const actions=league.clubs.map(club=>({type:ACTION_TYPES.DRAFT_PICK,clubId:club.id,playerId:candidate.id}));
  const first=resolveDraftActions({clubs:league.clubs,candidates:[candidate],pendingClubIds:pending,actions,rng:{int:()=>0,next:()=>0}});
  assert.equal(first.acquired.length,1);
  assert.equal(first.acquired[0].contested,true);
  assert.equal(first.acquired[0].contenderIds.length,6);
  assert.equal(first.pendingClubIds.length,5);
  assert.equal(league.clubs.reduce((sum,club)=>sum+club.roster.length,0),31);
  const second=resolveDraftActions({clubs:league.clubs,candidates:first.candidates,pendingClubIds:first.pendingClubIds,actions:[],rng:createRandom('decline')});
  assert.equal(second.pendingClubIds.length,0);
  assert.equal(second.declinedIds.length,5);
});

test('完全同時指名を4巡行うと全6クラブが各巡1人を獲得する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'four-rounds'});
  let pool=createDraftPool(league.seed,1); const rng=createRandom('four-rounds:resolve');
  for(let round=1;round<=4;round++){
    let pending=league.clubs.map(club=>club.id), guard=0;
    while(pending.length&&guard++<30){
      const actions=draftActions(league,pending,pool,rng);
      const result=resolveDraftActions({clubs:league.clubs,candidates:pool,pendingClubIds:pending,actions,rng});
      pool=result.candidates; pending=result.pendingClubIds;
    }
    assert.equal(pending.length,0);
  }
  assert.deepEqual(league.clubs.map(club=>club.roster.length),[9,9,9,9,9,9]);
});

test('全クラブへ年間100ptと順位賞金を加算し、持越しを150ptに制限する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'finances'});
  league.clubs.forEach((club,index)=>{club.funds=[10,49,60,100,149,150][index];});
  const summary=applySeasonFinances(league);
  assert.equal(summary.length,6);
  assert.equal(summary.find(row=>row.rank===1).prize,10);
  assert.equal(summary.find(row=>row.rank===2).prize,5);
  assert.deepEqual(league.clubs.map(club=>club.funds),[120,150,150,150,150,150]);
  assert.deepEqual(applySeasonFinances(league),[]);
  assert.deepEqual(league.clubs.map(club=>club.funds),[120,150,150,150,150,150]);
});

test('Season 2以降も固有IDのドラフト候補と競売候補を生成する', () => {
  const draft1=createDraftPool('yearly-market',1), draft2=createDraftPool('yearly-market',2);
  const auction1=createAuctionPool('yearly-market',1), auction2=createAuctionPool('yearly-market',2);
  assert.equal(draft2.length,24); assert.equal(auction2.length,18);
  assert.equal(new Set([...draft1,...draft2,...auction1,...auction2].map(player=>player.id)).size,84);
  assert.notDeepEqual(draft1.map(player=>player.name),draft2.map(player=>player.name));
});

test('補強・試合・資金・育成・契約を含む10シーズンサイクルを全6クラブで完走する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'ten-season-cycle'});
  const marketSeasons=[];
  for(let season=1;season<=10;season++){
    marketSeasons.push(season);
    prepareCpuMarketSpace(league);
    let pool=createDraftPool(league.seed,season), rng=createRandom(`${league.seed}:draft:${season}`);
    for(let round=1;round<=4;round++){
      let pending=league.clubs.filter(club=>club.funds>=1&&club.roster.length<12).map(club=>club.id), guard=0;
      while(pending.length&&guard++<40){
        const actions=draftActions(league,pending,pool,rng);
        const result=resolveDraftActions({clubs:league.clubs,candidates:pool,pendingClubIds:pending,actions,rng});
        pool=result.candidates; pending=result.pendingClubIds;
      }
      assert.equal(pending.length,0);
    }
    const auction=createAuctionPool(league.seed,season), auctionRng=createRandom(`${league.seed}:auction:${season}`);
    for(const player of auction){
      const actions=league.clubs.map(club=>club.controllerType==='CPU'?decideCpuAuctionAction(club,player,auctionRng):{type:ACTION_TYPES.AUCTION_BID,clubId:club.id,playerId:player.id,bid:0});
      resolveAuctionActions({clubs:league.clubs,player,actions,rng:auctionRng});
    }
    prepareCpuClubs(league);
    while(!league.completed) playCurrentRound(league);
    assert.equal(applySeasonFinances(league).length,6);
    const summaries=processLeagueOffseason(league,new Map());
    assert.equal(summaries.length,6);
    if(season<10) assert.equal(startNextSeason(league),true); else assert.equal(startNextSeason(league),false);
  }
  assert.deepEqual(marketSeasons,[1,2,3,4,5,6,7,8,9,10]);
  assert.equal(league.history.length,10);
  assert.ok(league.clubs.every(club=>club.roster.length>=5&&club.roster.some(player=>player.primaryPosition==='GK')),JSON.stringify(league.clubs.map(club=>({name:club.name,count:club.roster.length,positions:club.roster.map(player=>player.primaryPosition)}))));
  assert.ok(league.clubs.every(club=>club.funds<=150));
});

test('ClubとControllerは同一Club構造のcontrollerTypeで分離される', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'controllers'});
  assert.equal(clubsForController(league,'HUMAN').length,1);
  assert.equal(clubsForController(league,'CPU').length,5);
  const keys=club=>Object.keys(club).filter(key=>key!=='controllerType').sort();
  assert.deepEqual(keys(league.clubs[0]),keys(league.clubs[1]));
  league.clubs[1].controllerType='HUMAN';
  assert.equal(clubsForController(league,'HUMAN').length,2);
});

test('人間とCPUのドラフトActionは同じ共通ルールで処理される', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'draft-actions'}), pool=createDraftPool('draft-actions',1), rng=createRandom('draft-actions:resolve');
  const pending=league.clubs.map(club=>club.id), actions=draftActions(league,pending,pool,rng,pool[0].id);
  assert.ok(actions.every(action=>action.type===ACTION_TYPES.DRAFT_PICK));
  const result=resolveDraftActions({clubs:league.clubs,candidates:pool,pendingClubIds:pending,actions,rng});
  assert.ok(result.acquired.length>=1);
  assert.equal(league.clubs.reduce((sum,club)=>sum+club.roster.length,0),30+result.acquired.length);
});

test('人間とCPUの競売Actionは同じ共通ルールで資金・移籍を処理する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'auction-actions'}), player=createAuctionPool('auction-actions',1)[0], rng=createRandom('auction-actions:resolve');
  const actions=league.clubs.map(club=>club.controllerType==='CPU'?decideCpuAuctionAction(club,player,rng):{type:ACTION_TYPES.AUCTION_BID,clubId:club.id,playerId:player.id,bid:10});
  const before=league.clubs.reduce((sum,club)=>sum+club.roster.length,0), result=resolveAuctionActions({clubs:league.clubs,player,actions,rng});
  assert.ok(result.winner);
  assert.equal(league.clubs.reduce((sum,club)=>sum+club.roster.length,0),before+1);
  assert.equal(result.winner.funds,100-result.bid);
});

test('編成・戦術・契約はControllerに依存しない共通Actionで更新する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'club-actions'}), human=league.clubs[0], cpu=league.clubs[1];
  for(const club of [human,cpu]){
    const rearranged=[club.lineup[0],club.lineup[4],club.lineup[3],club.lineup[2],club.lineup[1]];
    assert.equal(applyClubAction(club,{type:ACTION_TYPES.SET_LINEUP,clubId:club.id,lineup:rearranged}).ok,true);
    assert.deepEqual(club.lineup,rearranged);
    assert.equal(applyClubAction(club,{type:ACTION_TYPES.SET_TACTIC,clubId:club.id,tactic:'COUNTER'}).ok,true);
    assert.equal(club.tactic,'COUNTER');
  }
  assert.equal(applyClubAction(human,{type:ACTION_TYPES.SET_LINEUP,clubId:human.id,lineup:[human.roster[0].id,human.roster[0].id]}).ok,false);
  const due=human.roster[0];due.contractYears=0;const funds=human.funds;
  const renewed=applyClubAction(human,{type:ACTION_TYPES.RENEW_CONTRACT,clubId:human.id,playerId:due.id});
  assert.equal(renewed.ok,true);assert.equal(due.contractYears,3);assert.equal(human.funds,funds-renewed.fee);
});

test('人間編成は5枠・重複禁止・適性外警告を共通ルールで判定する', () => {
  const club=createLeague({name:'YOU',color:'#fff',seed:'human-lineup'}).clubs[0];
  assert.deepEqual(LINEUP_SLOTS,['GK','FIXO','ALA','ALA','PIVO']);
  assert.equal(validateLineup(club,club.lineup.slice(0,4)).ok,false);
  assert.equal(validateLineup(club,[club.lineup[0],club.lineup[1],club.lineup[2],club.lineup[3],club.lineup[3]]).ok,false);
  const outOfPosition=[club.lineup[0],club.lineup[4],club.lineup[2],club.lineup[3],club.lineup[1]];
  const result=applyClubAction(club,{type:ACTION_TYPES.SET_LINEUP,clubId:club.id,lineup:outOfPosition});
  assert.equal(result.ok,true);
  assert.equal(result.warnings.length,2);
  assert.equal(positionSuitability(club.roster.find(player=>player.id===outOfPosition[1]),'FIXO'),.85);
  assert.equal(positionSuitability(club.roster.find(player=>player.id===outOfPosition[0]),'GK'),1);
});

test('編成配置は既存スタメンの移動時に入替え、同一選手を重複させない', () => {
  const club=createLeague({name:'YOU',color:'#fff',seed:'lineup-swap'}).clubs[0];
  const next=createLineupPlacement(club.lineup,club.lineup[4],1);
  assert.equal(next[1],club.lineup[4]);
  assert.equal(next[4],club.lineup[1]);
  assert.equal(new Set(next).size,5);
  assert.equal(applyClubAction(club,{type:ACTION_TYPES.SET_LINEUP,clubId:club.id,lineup:next}).ok,true);
});

test('編成画面はスタメン5枠と控えを分離し、カード上で能力ランクを表示する', () => {
  const club=createLeague({name:'YOU',color:'#fff',seed:'lineup-ui'}).clubs[0];
  const bench=createPlayer('bench','ALA',createRandom('lineup-ui-bench'));
  club.roster.push(bench);
  const html=renderLineupEditor(club,bench.id);
  assert.equal((html.match(/data-lineup-slot=/g)||[]).length,5);
  assert.match(html,/スタメン/);
  assert.match(html,/控え/);
  assert.match(html,/シュート/);
  assert.match(html,/走力/);
  assert.match(html,/守備/);
  assert.match(html,/ドリブル/);
  assert.match(html,/パス/);
  assert.doesNotMatch(html,/hiddenGrowth/);
});

test('変更したスタメンだけが実際の試合へ出場する', () => {
  const rng=createRandom('lineup-match-clubs');
  const home=createClub({id:1,name:'HOME',color:'#fff',seed:rng}),away=createClub({id:2,name:'AWAY',color:'#000',seed:rng});
  const bench=createPlayer('lineup-match-bench','PIVO',createRandom('lineup-match-bench'));
  home.roster.push(bench);
  const replacedId=home.lineup[4];
  const next=createLineupPlacement(home.lineup,bench.id,4);
  assert.equal(applyClubAction(home,{type:ACTION_TYPES.SET_LINEUP,clubId:home.id,lineup:next}).ok,true);
  const result=simulateMatch(home,away,createRandom('lineup-match'));
  const ids=result.playerResults.map(row=>row.player.id);
  assert.equal(result.playerResults.length,10);
  assert.ok(ids.includes(bench.id));
  assert.ok(!ids.includes(replacedId));
});

test('シーズン結果一覧は10試合を○△●とホーム・アウェー付きで表示する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'season-list'});
  simulateRemainingSeason(league);
  const html=renderSeasonMatchList(league.seasonResults,league.clubs[0].id);
  assert.equal((html.match(/data-season-match=/g)||[]).length,10);
  assert.match(html,/第1節/);
  assert.match(html,/ホーム|アウェー/);
  assert.match(html,/○|△|●/);
  const outcome=matchOutcomeForClub(league.seasonResults[0],league.clubs[0].id);
  assert.ok(['○','△','●'].includes(outcome.mark));
  assert.ok(outcome.opponent.name);
});

test('試合詳細は指定されたスコア・得点者・アシスト・MVP・全選手成績・調子・イベントを表示する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'match-detail'});
  simulateRemainingSeason(league);
  const match=league.seasonResults[0], html=renderMatchDetail(match);
  assert.match(html,/試合詳細/);
  assert.match(html,/得点者/);
  assert.match(html,/アシスト/);
  assert.match(html,/試合MVP/);
  assert.match(html,/評価/);
  assert.match(html,/シュート/);
  assert.match(html,/攻撃貢献/);
  assert.match(html,/守備成功/);
  assert.match(html,/セーブ/);
  assert.match(html,/調子/);
  assert.match(html,/試合イベント/);
  assert.equal((html.match(/match-player-result/g)||[]).length,10);
  assert.doesNotMatch(html,/hiddenGrowth/);
});

test('所属選手のシーズン個人成績は出場・得点・アシスト・平均評価・全指定指標を表示する', () => {
  const league=createLeague({name:'YOU',color:'#fff',seed:'season-player-stats'});
  simulateRemainingSeason(league);
  const club=league.clubs[0], html=renderSeasonPlayerStats(club);
  assert.match(html,/出場 10/);
  assert.match(html,/得点/);
  assert.match(html,/アシスト/);
  assert.match(html,/平均評価/);
  assert.match(html,/シュート/);
  assert.match(html,/攻撃貢献/);
  assert.match(html,/守備成功/);
  assert.match(html,/セーブ/);
  assert.doesNotMatch(html,/hiddenGrowth/);
});

test('試合結果はcontrollerTypeに依存しない', () => {
  const rngA=createRandom('controller-match'),rngB=createRandom('controller-match');
  const homeA=createClub({id:1,name:'A',color:'#fff',seed:rngA,controllerType:'HUMAN'}),awayA=createClub({id:2,name:'B',color:'#000',seed:rngA,controllerType:'CPU'});
  const homeB=structuredClone(homeA),awayB=structuredClone(awayA);homeB.controllerType='REMOTE';awayB.controllerType='HUMAN';
  assert.deepEqual(simulateMatch(homeA,awayA,createRandom('same-controller-match')),simulateMatch(homeB,awayB,createRandom('same-controller-match')));
});
