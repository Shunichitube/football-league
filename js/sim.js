import { CONFIG } from './config.js';
import { calculateOverall } from './data.js?v=0.17.2';
import { weightedPick } from './random.js';
import { LINEUP_SLOTS, positionSuitability } from './rules.js?v=0.17.2';

const FIELD_KEYS = ['shoot', 'speed', 'defense', 'dribble', 'pass'];
const avg = (players, valueOf) => players.reduce((sum, player) => sum + valueOf(player), 0) / Math.max(1, players.length);
const luck = (rng, range) => rng.int(-range, range);
const latePhase = phase => phase >= CONFIG.phaseCount - 19;
const oneGoalGame = score => Math.abs(score.home - score.away) <= 1;
const staminaLimit = value => ({ G: 12, F: 13, E: 14, D: 15, C: 16, B: 17, A: 18, S: 19, SS: 20 }[rankOf(value || 50)] || 12);
const fatigueMultiplier = state => {
  const over = state.activePhases - staminaLimit(state.player.stats.stamina);
  if (over < 0) return 1;
  if (over < 10) return .90;
  if (over < 20) return .80;
  return .70;
};
function rankOf(value) { return CONFIG.ranks.find(([min]) => value >= min)?.[1] ?? 'G'; }

const NORMAL_RESTART_WEIGHTS = Object.freeze({
  BALANCED: { PASS: 50, DRIBBLE: 50 },
  POSSESSION: { PASS: 80, DRIBBLE: 20 },
  DRIBBLE: { PASS: 20, DRIBBLE: 80 },
  COUNTER: { PASS: 50, DRIBBLE: 50 }
});

const DEFENSE_RESTART_WEIGHTS = Object.freeze({
  BALANCED: { PASS: 45, DRIBBLE: 45, COUNTER: 10 },
  POSSESSION: { PASS: 75, DRIBBLE: 15, COUNTER: 10 },
  DRIBBLE: { PASS: 15, DRIBBLE: 75, COUNTER: 10 },
  COUNTER: { PASS: 35, DRIBBLE: 35, COUNTER: 30 }
});

function assignedPlayer(player, role, fatigue = 1) {
  if (!player) return null;
  const fit = positionSuitability(player, role), stats = { ...player.stats };
  if (role === 'GK') stats.gk *= fit; else for (const key of FIELD_KEYS) stats[key] *= fit * fatigue;
  return { ...player, primaryPosition: role, stats };
}
const fieldValue = (player, key, tactic) => player.stats[key] * (player.specialAbility === '万能型' && tactic === 'BALANCED' ? 1.04 : 1);
function speedValue(player, attackType, tactic, defending = false) {
  let value = fieldValue(player, 'speed', tactic);
  if (!defending && attackType === 'COUNTER' && player.specialAbility === 'スピードスター') value *= 1.10;
  if (player.specialAbility === 'ハードワーカー') value *= 1.06;
  return value;
}
function tacticAttackBonus(type, tactic) {
  if (tactic === 'BALANCED') return 2;
  if (tactic === 'POSSESSION' && type === 'PASS') return 4;
  if (tactic === 'DRIBBLE' && type === 'DRIBBLE') return 4;
  if (tactic === 'COUNTER' && type === 'COUNTER') return 4;
  return 0;
}
function tacticDefenseBonus(tactic) { return tactic === 'COUNTER' ? 4 : 0; }
function pickWeightedType(weights, rng) { return weightedPick(Object.keys(weights), type => weights[type], rng); }
function restartAttackKind(tactic, restartKind, rng) {
  const weights = restartKind === 'defense' ? DEFENSE_RESTART_WEIGHTS[tactic] : NORMAL_RESTART_WEIGHTS[tactic];
  return pickWeightedType(weights || NORMAL_RESTART_WEIGHTS.BALANCED, rng);
}
function secondStageKind(firstType, rng) {
  if (firstType === 'PASS') return pickWeightedType({ PASS: 70, DRIBBLE: 30 }, rng);
  if (firstType === 'DRIBBLE') return pickWeightedType({ DRIBBLE: 70, PASS: 30 }, rng);
  return 'COUNTER';
}
function stageChance(diff) {
  if (diff <= 7) return 'HARD';
  if (diff <= 12) return 'NORMAL';
  if (diff <= 18) return 'CLEAR';
  return 'BIG';
}
function attackScore(type, players, goalkeeper, rng, tactic) {
  let value = avg(players, player => {
    let pass = fieldValue(player, 'pass', tactic), dribble = fieldValue(player, 'dribble', tactic), speed = speedValue(player, type, tactic);
    if (type === 'PASS' && player.specialAbility === 'ビルドアップ') pass *= 1.10;
    if (type === 'PASS' && player.specialAbility === 'チャンスメイカー') pass *= 1.08;
    if (type === 'DRIBBLE' && ['ドリブラー', '個人技'].includes(player.specialAbility)) dribble *= 1.10;
    return type === 'PASS' ? pass * .5 + dribble * .2 + speed * .3 : type === 'DRIBBLE' ? dribble * .6 + speed * .25 + pass * .15 : speed * .5 + pass * .3 + dribble * .2;
  });
  if (type === 'PASS' && players.some(player => player.specialAbility === 'ポストプレーヤー')) value *= 1.06;
  const goalkeeperBuildUp = type === 'PASS' && goalkeeper ? goalkeeper.stats.pass * .08 + goalkeeper.stats.dribble * .02 : 0;
  return value + tacticAttackBonus(type, tactic) + goalkeeperBuildUp + luck(rng, CONFIG.attackLuck);
}
function defenseScore(type, defenders, tactic) {
  return avg(defenders, player => {
    let defense = fieldValue(player, 'defense', tactic), speed = speedValue(player, type, tactic, true);
    if (player.specialAbility === 'ボールハンター') defense *= 1.10;
    if (type === 'DRIBBLE' && player.specialAbility === 'カバーリング') defense *= 1.08;
    if (type === 'PASS' && player.specialAbility === 'パスカット') defense *= 1.08;
    return defense * .7 + speed * .3;
  }) + tacticDefenseBonus(tactic);
}
function formatTime(phase) { const seconds = phase * CONFIG.phaseSeconds; return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function logEvent(phase, kind, player, extra = '', side = null) { return { time: formatTime(phase), kind, player: player.name, extra, side }; }
function matchPlayerPool(club) {
  const starterIds = new Set(club.lineup || []);
  return club.roster.filter(player => starterIds.has(player.id) || player.primaryPosition !== 'GK');
}
function createMatchState(club) {
  const playerState = new Map(matchPlayerPool(club).map(player => [player.id, { player, activePhases: 0, restRemaining: 0, currentSlot: null, playedPhases: 0 }]));
  const keeperPlayer = club.roster.find(player => player.id === club.lineup[0]);
  const slots = LINEUP_SLOTS.slice(1).map((role, offset) => {
    const player = club.roster.find(candidate => candidate.id === club.lineup[offset + 1]);
    const state = playerState.get(player?.id);
    if (state) state.currentSlot = offset;
    return { index: offset, role, starterId: player?.id, currentId: player?.id };
  });
  return { club, keeper: assignedPlayer(keeperPlayer, 'GK'), slots, playerState };
}
function refreshKeeper(matchState) {
  const keeperPlayer = matchState.club.roster.find(player => player.id === matchState.club.lineup[0]);
  matchState.keeper = assignedPlayer(keeperPlayer, 'GK');
}
function restNeeded(player) { return player.specialAbility === '回復力' ? 7 : 10; }
function benchState(state) { state.currentSlot = null; state.activePhases = 0; state.restRemaining = restNeeded(state.player); }
function enterSlot(matchState, slot, state) { state.currentSlot = slot.index; slot.currentId = state.player.id; }
function currentState(matchState, slot) { return matchState.playerState.get(slot.currentId); }
function decrementRest(matchState) {
  for (const state of matchState.playerState.values()) if (state.currentSlot === null && state.restRemaining > 0) state.restRemaining--;
}
function slotEffectiveOverall(player, role, fatigue = 1) { return calculateOverall(player) * positionSuitability(player, role) * fatigue; }
function availableBench(matchState, used = new Set()) {
  return [...matchState.playerState.values()].filter(state => state.currentSlot === null && state.restRemaining <= 0 && !used.has(state.player.id));
}
function returnRecoveredStarters(matchState) {
  for (const slot of matchState.slots) {
    if (slot.currentId === slot.starterId) continue;
    const starter = matchState.playerState.get(slot.starterId);
    if (!starter || starter.currentSlot !== null || starter.restRemaining > 0) continue;
    const current = currentState(matchState, slot);
    if (current) benchState(current);
    enterSlot(matchState, slot, starter);
  }
}
function substituteFatigued(matchState) {
  const fixedOrder = new Map(matchState.slots.map((slot, index) => [slot.index, index]));
  const needs = matchState.slots.map(slot => {
    const current = currentState(matchState, slot);
    if (!current || fatigueMultiplier(current) >= 1) return null;
    const bench = availableBench(matchState);
    if (!bench.length) return null;
    const best = bench.map(candidate => ({ candidate, improvement: slotEffectiveOverall(candidate.player, slot.role, 1) - slotEffectiveOverall(current.player, slot.role, fatigueMultiplier(current)) }))
      .sort((a, b) => b.improvement - a.improvement)[0];
    return best ? { slot, current, candidate: best.candidate, improvement: best.improvement } : null;
  }).filter(Boolean).sort((a, b) => b.improvement - a.improvement || fixedOrder.get(a.slot.index) - fixedOrder.get(b.slot.index));
  const used = new Set();
  for (const need of needs) {
    if (used.has(need.candidate.player.id) || need.candidate.currentSlot !== null || need.candidate.restRemaining > 0) continue;
    benchState(need.current);
    enterSlot(matchState, need.slot, need.candidate);
    used.add(need.candidate.player.id);
  }
}
function advanceSubstitutions(matchState) {
  decrementRest(matchState);
  returnRecoveredStarters(matchState);
  substituteFatigued(matchState);
}
const activeFielders = matchState => matchState.slots.map(slot => {
  const state = currentState(matchState, slot);
  return assignedPlayer(state?.player, slot.role, state ? fatigueMultiplier(state) : 1);
}).filter(Boolean);
function recordPlayedPhase(matchState) {
  for (const slot of matchState.slots) {
    const state = currentState(matchState, slot);
    if (!state) continue;
    state.activePhases++;
    state.playedPhases++;
  }
}
function sideKey(club, home) { return club === home ? 'home' : 'away'; }
function opponent(club, home, away) { return club === home ? away : home; }
function stateFor(club, home, homeState, awayState) { return club === home ? homeState : awayState; }
function fieldersFor(club, home, homeFielders, awayFielders) { return club === home ? homeFielders : awayFielders; }
function pickNeutralAttacker(home, away, homeFielders, awayFielders, rng) {
  const homePoss = avg(homeFielders, player => fieldValue(player, 'pass', home.tactic) * .6 + fieldValue(player, 'dribble', home.tactic) * .2 + speedValue(player, 'PASS', home.tactic) * .2);
  const awayPoss = avg(awayFielders, player => fieldValue(player, 'pass', away.tactic) * .6 + fieldValue(player, 'dribble', away.tactic) * .2 + speedValue(player, 'PASS', away.tactic) * .2);
  const homeChance = Math.max(.35, Math.min(.65, homePoss / Math.max(1, homePoss + awayPoss)));
  return rng.next() < homeChance ? home : away;
}
function pickStopper(defenders, type, tactic, rng) {
  return weightedPick(defenders, player => fieldValue(player, 'defense', tactic) * .7 + speedValue(player, type, tactic, true) * .3, rng);
}
function pickContributor(attackers, type, tactic, rng) {
  return weightedPick(attackers, player => type === 'PASS'
    ? fieldValue(player, 'pass', tactic) * (player.specialAbility === 'ビルドアップ' ? 1.10 : 1) * (player.specialAbility === 'チャンスメイカー' ? 1.08 : 1)
    : type === 'DRIBBLE'
      ? fieldValue(player, 'dribble', tactic) * (['ドリブラー', '個人技'].includes(player.specialAbility) ? 1.10 : 1)
      : speedValue(player, type, tactic), rng);
}
function pickShooter(attackers, tactic, rng) {
  return weightedPick(attackers, player => fieldValue(player, 'shoot', tactic) * CONFIG.positionShotWeight[player.primaryPosition] * (player.specialAbility === 'エース' ? 1.20 : 1), rng);
}

export function simulateMatch(home, away, rng) {
  const homeState = createMatchState(home), awayState = createMatchState(away);
  const all = [...new Map([...matchPlayerPool(home), ...matchPlayerPool(away)].map(player => [player.id, player])).values()];
  const originalStats = new Map(all.map(player => [player.id, { ...player.stats }]));
  const forms = Object.fromEntries(all.map(player => { const roll = rng.next(), factor = roll < .2 ? 1.05 : roll < .8 ? 1 : .95; for (const key of [...FIELD_KEYS, 'gk']) if (typeof player.stats[key] === 'number') player.stats[key] = Math.round(player.stats[key] * factor); return [player.id, factor > 1 ? '↑' : factor < 1 ? '↓' : '−']; }));
  refreshKeeper(homeState); refreshKeeper(awayState);
  const ratings = Object.fromEntries(all.map(player => [player.id, 6])), stat = new Map(all.map(player => [player.id, { shots: 0, goals: 0, assists: 0, attackContributions: 0, defensiveStops: 0, saves: 0, conceded: 0 }]));
  const score = { home: 0, away: 0 }, events = [];
  let activeAttack = null;
  let nextRestart = { club: null, kind: 'normal' };

  for (let phase = 1; phase <= CONFIG.phaseCount; phase++) {
    advanceSubstitutions(homeState); advanceSubstitutions(awayState);
    const homeFielders = activeFielders(homeState), awayFielders = activeFielders(awayState);

    if (!activeAttack) {
      const attackClub = nextRestart.club || pickNeutralAttacker(home, away, homeFielders, awayFielders, rng);
      const type = restartAttackKind(attackClub.tactic, nextRestart.kind, rng);
      activeAttack = { attack: attackClub, defend: opponent(attackClub, home, away), firstType: type, type, stage: 1 };
      nextRestart = { club: null, kind: 'normal' };
    }

    const attack = activeAttack.attack, defend = activeAttack.defend;
    const attackState = stateFor(attack, home, homeState, awayState), defendState = stateFor(defend, home, homeState, awayState);
    const attackers = fieldersFor(attack, home, homeFielders, awayFielders), defenders = fieldersFor(defend, home, homeFielders, awayFielders);
    const type = activeAttack.type;
    const offense = attackScore(type, attackers, attackState.keeper, rng, attack.tactic);
    const defense = defenseScore(type, defenders, defend.tactic) + luck(rng, CONFIG.attackLuck);
    let diff = offense - defense;
    if (activeAttack.stage === 2 && ['CLEAR', 'BIG'].includes(stageChance(Math.max(1, diff))) && defenders.some(player => player.specialAbility === '最終防衛線')) diff -= 3;

    if (activeAttack.stage === 1) {
      if (diff > -2) {
        const contributor = pickContributor(attackers, type, attack.tactic, rng);
        stat.get(contributor.id).attackContributions++; ratings[contributor.id] += .05;
        const nextType = secondStageKind(activeAttack.firstType, rng);
        events.push(logEvent(phase, 'STAGE 1 SUCCESS', contributor, `${type} → ${nextType}`, sideKey(attack, home)));
        activeAttack = { ...activeAttack, type: nextType, stage: 2 };
      } else {
        const stopper = pickStopper(defenders, type, defend.tactic, rng);
        stat.get(stopper.id).defensiveStops++; ratings[stopper.id] += .15;
        events.push(logEvent(phase, 'DEFENSIVE STOP', stopper, `${type} 第1阻止`, sideKey(defend, home)));
        nextRestart = { club: defend, kind: 'defense' };
        activeAttack = null;
      }
      recordPlayedPhase(homeState); recordPlayedPhase(awayState);
      continue;
    }

    if (diff <= 0) {
      const stopper = pickStopper(defenders, type, defend.tactic, rng);
      stat.get(stopper.id).defensiveStops++; ratings[stopper.id] += .18;
      events.push(logEvent(phase, 'DEFENSIVE STOP', stopper, `${type} 第2阻止`, sideKey(defend, home)));
      nextRestart = { club: defend, kind: 'defense' };
      activeAttack = null;
      recordPlayedPhase(homeState); recordPlayedPhase(awayState);
      continue;
    }

    const chance = stageChance(diff);
    const contributor = pickContributor(attackers, type, attack.tactic, rng);
    stat.get(contributor.id).attackContributions++; ratings[contributor.id] += .08;
    const shooter = pickShooter(attackers, attack.tactic, rng);
    stat.get(shooter.id).shots++; ratings[shooter.id] += .05;
    let shooterMultiplier = 1;
    if (shooter.specialAbility === 'カットイン' && type === 'DRIBBLE') shooterMultiplier *= 1.08;
    if (shooter.specialAbility === 'フィニッシャー' && ['CLEAR', 'BIG'].includes(chance)) shooterMultiplier *= 1.10;
    if (shooter.specialAbility === 'ミドルシューター' && chance === 'HARD') shooterMultiplier *= 1.10;
    const attackSide = sideKey(attack, home), defendSide = sideKey(defend, home), oneBehind = score[attackSide] + 1 === score[defendSide];
    if (shooter.specialAbility === '勝負強さ' && latePhase(phase) && (score.home === score.away || oneBehind)) shooterMultiplier *= 1.08;
    const counterShotBonus = type === 'COUNTER' ? 5 : 0;
    const shooterScore = (fieldValue(shooter, 'shoot', attack.tactic) + CONFIG.chanceBonus[chance.toLowerCase()] + counterShotBonus + luck(rng, CONFIG.shotLuck)) * shooterMultiplier;
    const gk = defendState.keeper, baseGoalieScore = gk.stats.gk * .80 + gk.stats.defense * .10 + gk.stats.speed * .10 + CONFIG.gkBaseAdvantage;
    let gkMultiplier = 1;
    if (gk.specialAbility === 'ショットストッパー' && chance === 'NORMAL') gkMultiplier *= 1.08;
    if (gk.specialAbility === 'ビッグセーバー' && ['CLEAR', 'BIG'].includes(chance)) gkMultiplier *= 1.10;
    if (gk.specialAbility === 'ロングレンジキラー' && chance === 'HARD') gkMultiplier *= 1.12;
    if (gk.specialAbility === '反応型' && shooterScore > baseGoalieScore) gkMultiplier *= 1.06;
    if (gk.specialAbility === '守護神' && latePhase(phase) && oneGoalGame(score)) gkMultiplier *= 1.08;
    const goalieScore = baseGoalieScore * gkMultiplier + luck(rng, gk.specialAbility === '安定感' ? 7 : CONFIG.shotLuck);
    if (shooterScore > goalieScore) {
      score[attackSide]++; stat.get(shooter.id).goals++; ratings[shooter.id] += 1.2; stat.get(gk.id).conceded++; ratings[gk.id] -= .15;
      let assist = null; const rate = type === 'PASS' ? .8 : type === 'COUNTER' ? .6 : .35;
      if (contributor !== shooter && rng.next() < rate) { assist = contributor; stat.get(assist.id).assists++; ratings[assist.id] += .7; }
      events.push(logEvent(phase, 'GOAL', shooter, `${type} / ${chance}${assist ? ` / Assist ${assist.name}` : ''}`, attackSide));
      nextRestart = { club: defend, kind: 'normal' };
    } else if (shooterScore < goalieScore - 8) {
      stat.get(gk.id).saves++; ratings[gk.id] += .12; events.push(logEvent(phase, 'SAVE', gk, `${type} / ${chance} / ${shooter.name} shot`, defendSide));
      nextRestart = { club: defend, kind: 'normal' };
    } else {
      events.push(logEvent(phase, 'MISS', shooter, `${type} / ${chance}`, attackSide));
      nextRestart = { club: defend, kind: 'normal' };
    }
    activeAttack = null;
    recordPlayedPhase(homeState); recordPlayedPhase(awayState);
  }
  const played = new Map([...homeState.playerState.values(), ...awayState.playerState.values()].filter(state => state.playedPhases > 0).map(state => [state.player.id, state.playedPhases]));
  const keeperIds = [homeState.keeper?.id, awayState.keeper?.id].filter(Boolean);
  for (const id of keeperIds) played.set(id, CONFIG.phaseCount);
  const playerResults = all.filter(player => played.has(player.id)).map(player => ({ player, rating: Math.max(4, Math.min(10, Math.round(ratings[player.id] * 10) / 10)), playedPhases: played.get(player.id), ...stat.get(player.id) }));
  all.forEach(player => { player.stats = originalStats.get(player.id); });
  return { score, events, playerResults, phases: CONFIG.phaseCount, forms };
}
