import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from '../js/random.js';
import { calculateOverall, createClub, createPlayer, displayPlayer, FIRST_NAMES, LAST_NAMES } from '../js/data.js';
import { simulateMatch } from '../js/sim.js';
import { applySeasonFinances, clubsForController, createLeague, createSchedule, playCurrentRound, simulateRemainingSeason, standings, startNextSeason } from '../js/league.js';
import { cpuBid, createAuctionPool, createDraftPool, createScoutComment, resolveAuctionActions, resolveDraftActions, SPECIAL_ABILITIES, SPECIAL_ABILITY_DESCRIPTIONS } from '../js/market.js';
import { processOffseason, renewalFee, trainingSkills } from '../js/development.js';
import { exportSave, importSave } from '../js/storage.js';
import { matchOutcomeForClub, positionCounts, renderLineupEditor, renderMatchDetail, renderPlayerCard, renderRosterPanel, renderSeasonMatchList, renderSeasonPlayerStats } from '../js/ui.js';
import { autoSetCpuTactic, decideCpuAuctionAction, decideCpuDraftAction, manageCpuContracts, prepareCpuClubs, prepareCpuMarketSpace, processLeagueOffseason, selectBestLineup, selectCpuTraining } from '../js/cpu.js';
import { ACTION_TYPES, applyClubAction, createLineupPlacement, LINEUP_SLOTS, positionSuitability, validateLineup } from '../js/rules.js';

function match(seed) {
  const source = createRandom(seed);
  const home = createClub({ id: 1, name: 'HOME', color: '#fff', seed: source });
  const away = createClub({ id: 2, name: 'AWAY', color: '#000', seed: source });
  return simulateMatch(home, away, createRandom(`${seed}:match:1`));
}

function draftActions(league, pending, pool, rng, humanPickId = pool[0]?.id) {
  return pending
    .map(id => league.clubs.find(club => club.id === id))
    .map(club => club.controllerType === 'CPU'
      ? decideCpuDraftAction(club, pool, rng)
      : { type: ACTION_TYPES.DRAFT_PICK, clubId: club.id, playerId: humanPickId })
    .filter(Boolean);
}

test('同じseedは同じ試合結果になる', () => {
  assert.deepEqual(match('repeatable'), match('repeatable'));
});

test('1試合は80フェーズを完走し、初期ロスターは5人', () => {
  const result = match('complete');
  assert.equal(result.phases, 80);
  assert.equal(result.playerResults.length, 10);
  assert.ok(result.score.home >= 0 && result.score.away >= 0);
});

test('6クラブの日程は全30試合で、各クラブが10試合になる', () => {
  const schedule = createSchedule([1, 2, 3, 4, 5, 6]);
  assert.equal(schedule.length, 10);
  assert.equal(schedule.flatMap(round => round.fixtures).length, 30);
  const count = new Map([1, 2, 3, 4, 5, 6].map(id => [id, 0]));
  schedule.flatMap(round => round.fixtures).forEach(fixture => {
    count.set(fixture.homeId, count.get(fixture.homeId) + 1);
    count.set(fixture.awayId, count.get(fixture.awayId) + 1);
  });
  assert.deepEqual([...count.values()], [10, 10, 10, 10, 10, 10]);
});

test('リーグ一括進行は10節・全30試合を処理し、人間クラブ10試合を保存する', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'bulk-season' });
  const result = simulateRemainingSeason(league);
  assert.equal(result.rounds.length, 10);
  assert.equal(result.matchesProcessed, 30);
  assert.equal(result.humanMatches.length, 10);
  assert.equal(league.seasonResults.length, 10);
  assert.equal(league.completed, true);
  assert.equal(league.currentRound, 11);
  assert.ok(standings(league).every(row => row.played === 10));
});

test('保存した人間クラブ戦は節・スコア・選手成績・イベント・調子を保持する', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'saved-matches' });
  simulateRemainingSeason(league);
  for (const match of league.seasonResults) {
    assert.ok(match.round >= 1 && match.round <= 10);
    assert.ok(match.fixture.homeId === 1 || match.fixture.awayId === 1);
    assert.ok(Number.isInteger(match.result.score.home));
    assert.ok(Number.isInteger(match.result.score.away));
    assert.equal(match.result.playerResults.length, 10);
    assert.ok(match.result.events.length > 0);
    assert.equal(Object.keys(match.result.forms).length, 10);
  }
});

test('市場候補は仕様数で生成され、CPU入札は資金と登録上限を超えない', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'market' });
  const draft = createDraftPool('market');
  const auction = createAuctionPool('market');
  assert.equal(draft.length, 24);
  assert.equal(auction.length, 18);
  const bid = cpuBid(league.clubs[1], auction[0], createRandom('bid'));
  assert.ok(bid >= 0 && bid <= 95);
  league.clubs[1].roster = Array(12).fill({});
  assert.equal(cpuBid(league.clubs[1], auction[0], createRandom('full')), 0);
});

test('市場候補の能力傾向は現在のDF/MF/FW/GK役割を反映する', () => {
  const players = Array.from({ length: 80 }, (_, i) => createAuctionPool(`position-profile-${i}`)).flat();
  const average = (position, key) => {
    const list = players.filter(player => player.primaryPosition === position);
    return list.reduce((sum, player) => sum + player.stats[key], 0) / list.length;
  };
  assert.ok(average('GK', 'gk') > average('GK', 'pass'));
  assert.ok(average('DF', 'defense') > average('DF', 'shoot'));
  assert.ok(average('MF', 'speed') > average('MF', 'defense'));
  assert.ok(average('FW', 'shoot') > average('FW', 'defense'));
});

test('GK特殊能力は現行6種類で、旧GK特能は生成対象に含まれない', () => {
  assert.deepEqual(SPECIAL_ABILITIES.GK, ['セービング', '安定感', '守護神', 'スイーパーGK', 'パワープレー', 'ロングフィード']);
  for (const oldName of ['ショットストッパー', 'ビッグセーバー', 'ロングレンジキラー', '反応型']) {
    assert.equal(SPECIAL_ABILITIES.GK.includes(oldName), false);
    assert.equal(Object.hasOwn(SPECIAL_ABILITY_DESCRIPTIONS, oldName), false);
  }
});

test('市場の特殊能力は約40%で、全候補が生成対象に含まれる', () => {
  let total = 0, withAbility = 0;
  const seen = new Set();
  for (let i = 0; i < 120; i++) {
    for (const player of [...createDraftPool(`ability-${i}`), ...createAuctionPool(`ability-${i}`)]) {
      total++;
      if (player.specialAbility) { withAbility++; seen.add(player.specialAbility); }
    }
  }
  const rate = withAbility / total;
  assert.ok(rate >= .36 && rate <= .44, `special ability rate: ${rate}`);
  assert.deepEqual([...seen].sort(), Object.values(SPECIAL_ABILITIES).flat().sort());
});

test('hiddenGrowthは能力別で、GKはGK能力・守備・走力・パスが成長期待の中心になる', () => {
  const gkPlayers = Array.from({ length: 120 }, (_, i) => createPlayer(10000 + i, 'GK', createRandom(`gk-growth-${i}`)));
  const focusKeys = gkPlayers.map(player => ['gk', 'defense', 'speed', 'pass'].sort((a, b) => player.hiddenGrowth[b] - player.hiddenGrowth[a])[0]);
  assert.ok(focusKeys.filter(key => key === 'gk').length > focusKeys.filter(key => key !== 'gk').length);
  assert.ok(gkPlayers.every(player => typeof player.hiddenGrowth.gk === 'number'));
  assert.ok(gkPlayers.every(player => player.hiddenGrowth.shoot === 0));
  assert.ok(gkPlayers.every(player => player.hiddenGrowth.dribble === 0));
  assert.ok(gkPlayers.every(player => typeof player.hiddenGrowth.stamina === 'undefined'));
});

test('GKのシュート・ドリブルは育成選択肢に残るが通常成長・覚醒・特別特訓では伸びない', () => {
  const club = createClub({ id: 99, name: 'GK TEST', color: '#fff', seed: createRandom('gk-frozen-growth') });
  const gk = club.roster.find(player => player.primaryPosition === 'GK');
  gk.age = 18;
  gk.season.appearances = 10;
  Object.assign(gk.stats, { shoot: 50, dribble: 50, speed: 50, defense: 50, pass: 50, gk: 50 });
  gk.hiddenGrowth = { shoot: 99, dribble: 99, speed: 1.30, defense: 1.30, pass: 1.30, gk: 1.30 };
  assert.ok(trainingSkills(gk).includes('shoot'));
  assert.ok(trainingSkills(gk).includes('dribble'));
  const results = processOffseason(club, new Map([[gk.id, 'shoot']]), { next: () => 0, int: (min, max) => max }, new Set([gk.id]));
  assert.equal(gk.stats.shoot, 50);
  assert.equal(gk.stats.dribble, 50);
  assert.ok(results[0].awakeningKeys.every(key => !['shoot', 'dribble'].includes(key)));
});

test('スカウトコメントは能力別成長傾向で変わる', () => {
  const player = createPlayer(88, 'MF', createRandom('scout-base'));
  player.age = 19;
  player.specialAbility = 'ドリブラー';
  player.hiddenGrowth = { shoot: 1.30, speed: .70, defense: .70, dribble: .70, pass: .70, stamina: .70 };
  const shoot = createScoutComment(player, { pick: values => values[0], next: () => 1 });
  player.hiddenGrowth = { shoot: .70, speed: .70, defense: .70, dribble: .70, pass: 1.30, stamina: .70 };
  const pass = createScoutComment(player, { pick: values => values[0], next: () => 1 });
  assert.match(shoot, /得点感覚/);
  assert.match(pass, /配球面/);
  assert.notEqual(shoot, pass);
  assert.doesNotMatch(shoot, /成長率|確実に|必ず/);
});

test('選手カードは公開ランクだけを表示し、内部能力値とhiddenGrowthを表示しない', () => {
  const player = createPlayer(501, 'MF', createRandom('ui-card'));
  player.age = 21;
  player.contractYears = 2;
  player.stats = { shoot: 83, speed: 79, defense: 67, dribble: 76, pass: 71, gk: 50, stamina: 66 };
  player.specialAbility = 'ドリブラー';
  const html = renderPlayerCard(player);
  for (const label of ['総合', 'シュート', '走力', '守備', 'ドリブル', 'パス', 'スタミナ', '★ ドリブラー', '契約 <b>2年']) assert.match(html, new RegExp(label));
  for (const internal of ['83', '79', '67', '76', '71']) assert.doesNotMatch(html, new RegExp(`>${internal}<`));
  assert.doesNotMatch(html, /hiddenGrowth/);
});

test('GKカードはGK能力ランクと現行特殊能力の説明を表示する', () => {
  const player = createPlayer(502, 'GK', createRandom('ui-gk'));
  player.specialAbility = 'セービング';
  player.stats.gk = 86;
  const html = renderPlayerCard(player);
  assert.match(html, /GK能力/);
  assert.match(html, /★ セービング/);
  assert.match(html, /シュート対応全般に強い/);
  assert.doesNotMatch(html, />86</);
});

test('所属選手パネルは現在のポジション人数と全選手の公開情報を表示する', () => {
  const club = createClub({ id: 7, name: 'TEST CLUB', color: '#fff', seed: createRandom('roster-panel') });
  assert.deepEqual(positionCounts(club.roster).map(row => row.count), [1, 1, 2, 1]);
  const html = renderRosterPanel(club);
  assert.match(html, /所属選手/);
  assert.match(html, /GK <b>1<\/b>/);
  assert.match(html, /MF <b>2<\/b>/);
  for (const player of club.roster) assert.match(html, new RegExp(player.name));
});

test('CPUは新加入の強い選手を含めてスタメン5人を再選出する', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'cpu-lineup' });
  const club = league.clubs[1];
  const signing = createPlayer(9901, 'FW', createRandom('cpu-signing'));
  signing.stats = { shoot: 95, speed: 95, defense: 95, dribble: 95, pass: 95, gk: 50, stamina: 90 };
  club.roster.push(signing);
  selectBestLineup(club);
  const starters = club.lineup.map(id => club.roster.find(player => player.id === id));
  assert.equal(new Set(club.lineup).size, 5);
  assert.equal(starters.filter(player => player.primaryPosition === 'GK').length, 1);
  assert.ok(club.lineup.includes(signing.id));
});

test('CPUはスタメン能力に応じて戦術を自動変更する', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'cpu-tactic' });
  const club = league.clubs[1];
  selectBestLineup(club);
  const field = club.lineup.map(id => club.roster.find(player => player.id === id)).filter(player => player.primaryPosition !== 'GK');
  field.forEach(player => Object.assign(player.stats, { pass: 90, dribble: 60, speed: 60 }));
  assert.equal(autoSetCpuTactic(club), 'POSSESSION');
  field.forEach(player => Object.assign(player.stats, { pass: 60, dribble: 60, speed: 90 }));
  assert.equal(autoSetCpuTactic(club), 'COUNTER');
  field.forEach(player => Object.assign(player.stats, { pass: 70, dribble: 70, speed: 70 }));
  assert.equal(autoSetCpuTactic(club), 'BALANCED');
});

test('CPU育成対象は公開能力・年齢・起用実績から2人を選びhiddenGrowthを参照しない', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'cpu-training' });
  const club = league.clubs[1];
  const before = [...selectCpuTraining(club).entries()];
  club.roster.forEach((player, index) => { player.hiddenGrowth = { shoot: index % 2 ? 99 : 0, speed: 99, defense: 0, dribble: 99, pass: 0, stamina: 0, gk: 99 }; });
  const after = [...selectCpuTraining(club).entries()];
  assert.equal(before.length, 2);
  assert.deepEqual(after, before);
});

test('全6クラブへ加齢・成長・衰退・契約年数処理を適用する', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'all-offseason' });
  const veteran = league.clubs[1].roster[1];
  veteran.age = 29;
  veteran.stats.speed = 80;
  const tracked = league.clubs.map(club => ({ club, id: club.roster[1].id, age: club.roster[1].age, contract: club.roster[1].contractYears }));
  const speedBefore = veteran.stats.speed;
  const summaries = processLeagueOffseason(league, new Map());
  assert.equal(summaries.length, 6);
  for (const row of tracked) {
    const player = row.club.roster.find(candidate => candidate.id === row.id);
    assert.ok(player);
    assert.equal(player.age, row.age + 1);
    assert.equal(player.contractYears, row.contract - 1);
  }
  assert.ok(veteran.stats.speed < speedBefore);
});

test('CPUは契約満了者を更新・放出しつつ最低5人とGKを維持する', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'cpu-contract' });
  const club = league.clubs[1];
  const strong = createPlayer(9902, 'FW', createRandom('strong-contract'));
  strong.stats = { shoot: 95, speed: 90, defense: 80, dribble: 92, pass: 88, gk: 50, stamina: 80 };
  strong.contractYears = 0;
  const weak = createPlayer(9903, 'FW', createRandom('weak-contract'));
  weak.stats = { shoot: 50, speed: 50, defense: 50, dribble: 50, pass: 50, gk: 50, stamina: 50 };
  weak.age = 34;
  weak.contractYears = 0;
  club.roster.push(strong, weak);
  selectBestLineup(club);
  club.funds = 100;
  const decisions = manageCpuContracts(club);
  assert.equal(decisions.find(row => row.player.id === strong.id)?.action, 'RENEW');
  assert.equal(decisions.find(row => row.player.id === weak.id)?.action, 'RELEASE');
  assert.ok(club.roster.length >= 5);
  assert.ok(club.roster.some(player => player.primaryPosition === 'GK'));
});

test('Season 1ドラフトは6クラブ同時指名で競合抽選し、外れクラブを再指名へ残す', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'simultaneous' });
  const candidate = createDraftPool('simultaneous', 1)[0];
  const pending = league.clubs.map(club => club.id);
  const actions = league.clubs.map(club => ({ type: ACTION_TYPES.DRAFT_PICK, clubId: club.id, playerId: candidate.id }));
  const first = resolveDraftActions({ clubs: league.clubs, candidates: [candidate], pendingClubIds: pending, actions, rng: { int: () => 0, next: () => 0 } });
  assert.equal(first.acquired.length, 1);
  assert.equal(first.acquired[0].contested, true);
  assert.equal(first.pendingClubIds.length, 5);
});

test('人間とCPUの競売Actionは同じ共通ルールで資金・移籍を処理する', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'auction-actions' });
  const player = createAuctionPool('auction-actions', 1)[0];
  const rng = createRandom('auction-actions:resolve');
  const actions = league.clubs.map(club => club.controllerType === 'CPU' ? decideCpuAuctionAction(club, player, rng) : { type: ACTION_TYPES.AUCTION_BID, clubId: club.id, playerId: player.id, bid: 10 });
  const before = league.clubs.reduce((sum, club) => sum + club.roster.length, 0);
  const result = resolveAuctionActions({ clubs: league.clubs, player, actions, rng });
  assert.ok(result.winner);
  assert.equal(league.clubs.reduce((sum, club) => sum + club.roster.length, 0), before + 1);
});

test('編成・戦術・契約はControllerに依存しない共通Actionで更新する', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'club-actions' });
  const human = league.clubs[0], cpu = league.clubs[1];
  for (const club of [human, cpu]) {
    const rearranged = [club.lineup[0], club.lineup[4], club.lineup[3], club.lineup[2], club.lineup[1]];
    assert.equal(applyClubAction(club, { type: ACTION_TYPES.SET_LINEUP, clubId: club.id, lineup: rearranged }).ok, true);
    assert.equal(applyClubAction(club, { type: ACTION_TYPES.SET_TACTIC, clubId: club.id, tactic: 'COUNTER' }).ok, true);
    assert.equal(club.tactic, 'COUNTER');
  }
  const due = human.roster[0];
  due.contractYears = 0;
  const renewed = applyClubAction(human, { type: ACTION_TYPES.RENEW_CONTRACT, clubId: human.id, playerId: due.id });
  assert.equal(renewed.ok, true);
  assert.equal(due.contractYears, 3);
});

test('人間編成は現在の5枠・重複禁止・適性外警告を共通ルールで判定する', () => {
  const club = createLeague({ name: 'YOU', color: '#fff', seed: 'human-lineup' }).clubs[0];
  assert.deepEqual(LINEUP_SLOTS, ['GK', 'DF', 'MF', 'MF', 'FW']);
  assert.equal(validateLineup(club, club.lineup.slice(0, 4)).ok, false);
  assert.equal(validateLineup(club, [club.lineup[0], club.lineup[1], club.lineup[2], club.lineup[3], club.lineup[3]]).ok, false);
  const outOfPosition = [club.lineup[0], club.lineup[4], club.lineup[2], club.lineup[3], club.lineup[1]];
  const result = applyClubAction(club, { type: ACTION_TYPES.SET_LINEUP, clubId: club.id, lineup: outOfPosition });
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 2);
  assert.equal(positionSuitability(club.roster.find(player => player.id === outOfPosition[1]), 'DF'), .85);
  assert.equal(positionSuitability(club.roster.find(player => player.id === outOfPosition[0]), 'GK'), 1);
});

test('編成配置は既存スタメンの移動時に入替え、同一選手を重複させない', () => {
  const club = createLeague({ name: 'YOU', color: '#fff', seed: 'lineup-swap' }).clubs[0];
  const next = createLineupPlacement(club.lineup, club.lineup[4], 1);
  assert.equal(next[1], club.lineup[4]);
  assert.equal(next[4], club.lineup[1]);
  assert.equal(new Set(next).size, 5);
  assert.equal(applyClubAction(club, { type: ACTION_TYPES.SET_LINEUP, clubId: club.id, lineup: next }).ok, true);
});

test('編成画面はスタメン5枠と控えを分離し、カード上で能力ランクを表示する', () => {
  const club = createLeague({ name: 'YOU', color: '#fff', seed: 'lineup-ui' }).clubs[0];
  const bench = createPlayer('bench', 'MF', createRandom('lineup-ui-bench'));
  club.roster.push(bench);
  const html = renderLineupEditor(club, bench.id);
  assert.equal((html.match(/data-lineup-slot=/g) || []).length, 5);
  assert.match(html, /スタメン/);
  assert.match(html, /控え/);
  assert.match(html, /シュート/);
  assert.match(html, /走力/);
  assert.match(html, /守備/);
  assert.match(html, /ドリブル/);
  assert.match(html, /パス/);
  assert.doesNotMatch(html, /hiddenGrowth/);
});

test('変更したスタメンだけが実際の試合へ出場する', () => {
  const rng = createRandom('lineup-match-clubs');
  const home = createClub({ id: 1, name: 'HOME', color: '#fff', seed: rng });
  const away = createClub({ id: 2, name: 'AWAY', color: '#000', seed: rng });
  const bench = createPlayer('lineup-match-bench', 'FW', createRandom('lineup-match-bench'));
  home.roster.push(bench);
  const replacedId = home.lineup[4];
  const next = createLineupPlacement(home.lineup, bench.id, 4);
  assert.equal(applyClubAction(home, { type: ACTION_TYPES.SET_LINEUP, clubId: home.id, lineup: next }).ok, true);
  const result = simulateMatch(home, away, createRandom('lineup-match'));
  const ids = result.playerResults.map(row => row.player.id);
  assert.equal(result.playerResults.length, 10);
  assert.ok(ids.includes(bench.id));
  assert.ok(!ids.includes(replacedId));
});

test('シーズン結果一覧・試合詳細・個人成績は現行UIで表示できる', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'season-ui' });
  simulateRemainingSeason(league);
  const club = league.clubs[0];
  const listHtml = renderSeasonMatchList(league.seasonResults, club.id);
  assert.equal((listHtml.match(/data-season-match=/g) || []).length, 10);
  const outcome = matchOutcomeForClub(league.seasonResults[0], club.id);
  assert.ok(['○', '△', '●'].includes(outcome.mark));
  assert.ok(outcome.opponent.name);
  const detailHtml = renderMatchDetail(league.seasonResults[0]);
  assert.match(detailHtml, /試合詳細/);
  assert.match(detailHtml, /得点者/);
  assert.match(detailHtml, /試合イベント/);
  const statsHtml = renderSeasonPlayerStats(club);
  assert.match(statsHtml, /出場 10/);
  assert.match(statsHtml, /平均評価/);
  assert.doesNotMatch(statsHtml, /hiddenGrowth/);
});

test('全クラブへ年間100ptと順位賞金を加算し、持越しを150ptに制限する', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'finances' });
  league.clubs.forEach((club, index) => { club.funds = [10, 49, 60, 100, 149, 150][index]; });
  const summary = applySeasonFinances(league);
  assert.equal(summary.length, 6);
  assert.equal(summary.find(row => row.rank === 1).prize, 10);
  assert.equal(summary.find(row => row.rank === 2).prize, 5);
  assert.ok(league.clubs.every(club => club.funds <= 150));
  assert.deepEqual(applySeasonFinances(league), []);
});

test('ExportしたJSONはImportでき、不正形式は拒否する', () => {
  const state = { league: createLeague({ name: 'YOU', color: '#fff', seed: 'save' }) };
  assert.equal(importSave(exportSave(state)).league.seed, 'save');
  assert.throws(() => importSave('{}'));
});

test('補強・試合・資金・育成・契約を含む10シーズンサイクルを全6クラブで完走する', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'ten-season-cycle' });
  for (let season = 1; season <= 10; season++) {
    prepareCpuMarketSpace(league);
    let pool = createDraftPool(league.seed, season);
    const draftRng = createRandom(`${league.seed}:draft:${season}`);
    for (let round = 1; round <= 4; round++) {
      let pending = league.clubs.filter(club => club.funds >= 1 && club.roster.length < 12).map(club => club.id);
      let guard = 0;
      while (pending.length && guard++ < 40) {
        const actions = draftActions(league, pending, pool, draftRng);
        const result = resolveDraftActions({ clubs: league.clubs, candidates: pool, pendingClubIds: pending, actions, rng: draftRng });
        pool = result.candidates;
        pending = result.pendingClubIds;
      }
      assert.equal(pending.length, 0);
    }
    const auction = createAuctionPool(league.seed, season);
    const auctionRng = createRandom(`${league.seed}:auction:${season}`);
    for (const player of auction) {
      const actions = league.clubs.map(club => club.controllerType === 'CPU' ? decideCpuAuctionAction(club, player, auctionRng) : { type: ACTION_TYPES.AUCTION_BID, clubId: club.id, playerId: player.id, bid: 0 });
      resolveAuctionActions({ clubs: league.clubs, player, actions, rng: auctionRng });
    }
    prepareCpuClubs(league);
    while (!league.completed) playCurrentRound(league);
    assert.equal(applySeasonFinances(league).length, 6);
    assert.equal(processLeagueOffseason(league, new Map()).length, 6);
    if (season < 10) assert.equal(startNextSeason(league), true);
    else assert.equal(startNextSeason(league), false);
  }
  assert.equal(league.history.length, 10);
  assert.ok(league.clubs.every(club => club.roster.length >= 5 && club.roster.some(player => player.primaryPosition === 'GK')));
  assert.ok(league.clubs.every(club => club.funds <= 150));
});

test('ClubとControllerは同一Club構造のcontrollerTypeで分離される', () => {
  const league = createLeague({ name: 'YOU', color: '#fff', seed: 'controllers' });
  assert.equal(clubsForController(league, 'HUMAN').length, 1);
  assert.equal(clubsForController(league, 'CPU').length, 5);
  const keys = club => Object.keys(club).filter(key => key !== 'controllerType').sort();
  assert.deepEqual(keys(league.clubs[0]), keys(league.clubs[1]));
  league.clubs[1].controllerType = 'HUMAN';
  assert.equal(clubsForController(league, 'HUMAN').length, 2);
});

test('試合結果はcontrollerTypeに依存しない', () => {
  const rngA = createRandom('controller-match'), rngB = createRandom('controller-match');
  const homeA = createClub({ id: 1, name: 'A', color: '#fff', seed: rngA, controllerType: 'HUMAN' });
  const awayA = createClub({ id: 2, name: 'B', color: '#000', seed: rngA, controllerType: 'CPU' });
  const homeB = structuredClone(homeA), awayB = structuredClone(awayA);
  homeB.controllerType = 'REMOTE';
  awayB.controllerType = 'HUMAN';
  assert.deepEqual(simulateMatch(homeA, awayA, createRandom('same-controller-match')), simulateMatch(homeB, awayB, createRandom('same-controller-match')));
});
