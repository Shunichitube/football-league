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
const statValue = (player, key) => Number(player?.stats?.[key] || 0);
const fieldValue = (player, key, tactic) => statValue(player, key) * (player?.specialAbility === '万能型' && tactic === 'BALANCED' ? 1.04 : 1);
const isCounterType = type => type === 'COUNTER' || type === 'SHORT_COUNTER';
function speedValue(player, attackType, tactic, defending = false) {
  let value = fieldValue(player, 'speed', tactic);
  if (!defending && isCounterType(attackType) && player.specialAbility === 'スピードスター') value *= 1.10;
  if (player.specialAbility === 'ハードワーカー') value *= 1.06;
  return value;
}
function abilityRoleMultiplier(player, key, context = {}) {
  const ability = player?.specialAbility;
  if (!ability) return 1;
  const { type, stage, role, tactic, chance } = context;
  let multiplier = 1;
  if (ability === '万能型' && tactic === 'BALANCED') multiplier *= 1.04;
  if (key === 'speed' && ability === 'ハードワーカー') multiplier *= 1.06;

  if (key === 'defense') {
    if (stage === 1 && ['passCut', 'dribbleMarker', 'counterReturnDefender', 'shortOrigin'].includes(role) && ability === 'ボールハンター') multiplier *= 1.08;
    if (stage === 2 && ['dribbleCover', 'counterFinalDefender', 'shortFinalDefender'].includes(role) && ability === 'カバーリング') multiplier *= 1.08;
    if (type === 'PASS' && role === 'passCut' && ability === 'パスカット') multiplier *= 1.06;
    if (type === 'PASS' && role === 'passFinalDefender' && ability === 'パスカット') multiplier *= 1.08;
  }

  if (key === 'pass') {
    if (role === 'passFirstPasser' && ability === 'ビルドアップ') multiplier *= 1.08;
    if (role === 'counterOrigin' && ability === 'ビルドアップ') multiplier *= 1.05;
    if (role === 'counterOrigin' && ability === 'カウンター起点') multiplier *= 1.08;
    if (['passSecondPasser', 'passSupport'].includes(role) && ability === 'チャンスメイカー') multiplier *= 1.08;
  }

  if (key === 'dribble') {
    if (['dribbler', 'secondDribbler'].includes(role) && ['ドリブラー', '個人技'].includes(ability)) multiplier *= 1.10;
  }

  if (key === 'speed') {
    if (['dribbler', 'secondDribbler', 'counterRunner', 'shortRunner', 'counterSupport', 'shortSupport'].includes(role) && ability === 'スピードスター') multiplier *= 1.08;
  }

  if (key === 'shoot') {
    if (role === 'passSecondReceiver' && ability === 'ポストプレーヤー') multiplier *= 1.06;
    if (chance && ability === 'フィニッシャー' && ['CLEAR', 'BIG'].includes(chance)) multiplier *= 1.10;
    if (chance && ability === 'ミドルシューター' && chance === 'HARD') multiplier *= 1.10;
  }

  return multiplier;
}
function roleValue(player, key, tactic, context = {}) {
  const base = key === 'speed' ? statValue(player, key) : statValue(player, key);
  return base * abilityRoleMultiplier(player, key, { ...context, tactic });
}
function tacticAttackBonus(type, tactic) {
  if (tactic === 'BALANCED') return 2;
  if (tactic === 'POSSESSION' && type === 'PASS') return 4;
  if (tactic === 'DRIBBLE' && type === 'DRIBBLE') return 4;
  if (tactic === 'COUNTER' && isCounterType(type)) return 4;
  return 0;
}
function tacticDefenseBonus(tactic) { return tactic === 'COUNTER' ? 4 : 0; }
function tacticCounterTriggerBonus(tactic) { return tactic === 'COUNTER' ? 4 : 0; }
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
function finalDefenseChance(chance, defender) {
  if (defender?.specialAbility !== '最終防衛線') return chance;
  if (chance === 'BIG') return 'CLEAR';
  if (chance === 'CLEAR') return 'NORMAL';
  return chance;
}
function reboundRecoveryRate(chance, gk) {
  const base = ['BIG', 'CLEAR'].includes(chance) ? .20 : chance === 'NORMAL' ? .12 : .08;
  return Math.max(.02, Math.min(.35, base - (statValue(gk, 'gk') - 70) * .003));
}
function formatTime(phase) { const seconds = phase * CONFIG.phaseSeconds; return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function logEvent(phase, kind, player, extra = '', side = null) { return { time: formatTime(phase), kind, player: player?.name || 'Unknown', extra, side }; }
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
function enterSlot(matchState, slot, state) { if (!state) return; state.currentSlot = slot.index; slot.currentId = state.player.id; }
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
function availablePlayers(players, excluded = []) {
  const blocked = new Set(excluded.filter(Boolean).map(player => player.id));
  const filtered = players.filter(player => !blocked.has(player.id));
  return filtered.length ? filtered : players;
}
function pickRole(players, weightOf, rng, excluded = []) {
  const pool = availablePlayers(players, excluded);
  return weightedPick(pool, player => Math.max(0.01, weightOf(player)), rng);
}
function posMul(player, values) { return values[player?.primaryPosition] ?? 1; }
function weightedAbility(player, tactic, terms) {
  return terms.reduce((sum, [key, weight]) => sum + fieldValue(player, key, tactic) * weight, 0);
}

const ROLE_WEIGHTS = {
  passFirstPasser: (p, tactic) => fieldValue(p, 'pass', tactic) * posMul(p, { DF: 1.25, MF: 1.10, FW: .60 }),
  passReceiver: (p, tactic) => weightedAbility(p, tactic, [['pass', .35], ['dribble', .30], ['speed', .25], ['shoot', .10]]) * posMul(p, { MF: 1.40, FW: .85, DF: .65 }),
  passSecondReceiver: (p, tactic) => weightedAbility(p, tactic, [['shoot', .35], ['speed', .30], ['dribble', .20], ['pass', .15]]) * posMul(p, { FW: 1.45, MF: .90, DF: .50 }),
  passSupport: (p, tactic) => weightedAbility(p, tactic, [['pass', .40], ['speed', .25], ['dribble', .20], ['shoot', .15]]) * posMul(p, { MF: 1.25, FW: 1.10, DF: .65 }),
  passCut: (p, tactic) => weightedAbility(p, tactic, [['defense', .65], ['speed', .35]]) * posMul(p, { MF: 1.25, DF: .90, FW: .55 }),
  passFinalDefender: (p, tactic) => weightedAbility(p, tactic, [['defense', .75], ['speed', .25]]) * posMul(p, { DF: 1.45, MF: .85, FW: .45 }),
  dribbler: (p, tactic) => weightedAbility(p, tactic, [['dribble', .55], ['speed', .30], ['shoot', .15]]) * posMul(p, { FW: 1.20, MF: 1.20, DF: .65 }),
  dribbleSupport: (p, tactic) => weightedAbility(p, tactic, [['pass', .35], ['speed', .25], ['dribble', .20], ['shoot', .20]]) * posMul(p, { FW: 1.20, MF: 1.20, DF: .60 }),
  dribbleMarker: (p, tactic) => weightedAbility(p, tactic, [['defense', .60], ['speed', .40]]) * posMul(p, { MF: 1.20, DF: 1.00, FW: .55 }),
  dribbleCover: (p, tactic) => weightedAbility(p, tactic, [['defense', .70], ['speed', .30]]) * posMul(p, { DF: 1.40, MF: .90, FW: .45 }),
  counterOrigin: (p, tactic) => weightedAbility(p, tactic, [['defense', .35], ['pass', .40], ['speed', .25]]) * posMul(p, { DF: 1.20, MF: 1.25, FW: .70 }),
  counterRunner: (p, tactic) => weightedAbility(p, tactic, [['speed', .45], ['dribble', .25], ['shoot', .20], ['pass', .10]]) * posMul(p, { FW: 1.40, MF: 1.00, DF: .55 }),
  counterSupport: (p, tactic) => weightedAbility(p, tactic, [['speed', .35], ['pass', .25], ['shoot', .25], ['dribble', .15]]) * posMul(p, { FW: 1.20, MF: 1.15, DF: .55 }),
  counterReturnDefender: (p, tactic) => weightedAbility(p, tactic, [['speed', .55], ['defense', .45]]) * posMul(p, { MF: 1.20, DF: 1.10, FW: .65 }),
  counterFinalDefender: (p, tactic) => weightedAbility(p, tactic, [['defense', .70], ['speed', .30]]) * posMul(p, { DF: 1.45, MF: .85, FW: .45 })
};

function buildFirstStageRoles(type, attackers, defenders, attackTactic, defendTactic, rng) {
  if (type === 'PASS') {
    const passer = pickRole(attackers, p => ROLE_WEIGHTS.passFirstPasser(p, attackTactic), rng);
    const receiver = pickRole(attackers, p => ROLE_WEIGHTS.passReceiver(p, attackTactic), rng, [passer]);
    const support = pickRole(attackers, p => ROLE_WEIGHTS.passSupport(p, attackTactic), rng, [passer, receiver]);
    const defender = pickRole(defenders, p => ROLE_WEIGHTS.passCut(p, defendTactic), rng);
    return { passer, receiver, support, defender, contributor: passer };
  }
  if (type === 'DRIBBLE') {
    const dribbler = pickRole(attackers, p => ROLE_WEIGHTS.dribbler(p, attackTactic), rng);
    const support = pickRole(attackers, p => ROLE_WEIGHTS.dribbleSupport(p, attackTactic), rng, [dribbler]);
    const defender = pickRole(defenders, p => ROLE_WEIGHTS.dribbleMarker(p, defendTactic), rng);
    return { dribbler, support, defender, contributor: dribbler };
  }
  const origin = pickRole(attackers, p => ROLE_WEIGHTS.counterOrigin(p, attackTactic), rng);
  const runner = pickRole(attackers, p => ROLE_WEIGHTS.counterRunner(p, attackTactic), rng, [origin]);
  const defender = pickRole(defenders, p => ROLE_WEIGHTS.counterReturnDefender(p, defendTactic), rng);
  return { origin, runner, defender, contributor: origin };
}
function firstStageScores(type, roles, attackTactic, defendTactic) {
  if (type === 'PASS') {
    return {
      offense: roleValue(roles.passer, 'pass', attackTactic, { type, stage: 1, role: 'passFirstPasser' }) * .45
        + roleValue(roles.receiver, 'dribble', attackTactic, { type, stage: 1, role: 'passReceiver' }) * .20
        + roleValue(roles.receiver, 'speed', attackTactic, { type, stage: 1, role: 'passReceiver' }) * .15
        + roleValue(roles.receiver, 'pass', attackTactic, { type, stage: 1, role: 'passReceiver' }) * .10
        + roleValue(roles.support, 'pass', attackTactic, { type, stage: 1, role: 'passSupport' }) * .10,
      defense: roleValue(roles.defender, 'defense', defendTactic, { type, stage: 1, role: 'passCut' }) * .65
        + roleValue(roles.defender, 'speed', defendTactic, { type, stage: 1, role: 'passCut' }) * .35
    };
  }
  if (type === 'DRIBBLE') {
    return {
      offense: roleValue(roles.dribbler, 'dribble', attackTactic, { type, stage: 1, role: 'dribbler' }) * .55
        + roleValue(roles.dribbler, 'speed', attackTactic, { type, stage: 1, role: 'dribbler' }) * .25
        + roleValue(roles.dribbler, 'pass', attackTactic, { type, stage: 1, role: 'dribbler' }) * .10
        + roleValue(roles.support, 'pass', attackTactic, { type, stage: 1, role: 'dribbleSupport' }) * .10,
      defense: roleValue(roles.defender, 'defense', defendTactic, { type, stage: 1, role: 'dribbleMarker' }) * .60
        + roleValue(roles.defender, 'speed', defendTactic, { type, stage: 1, role: 'dribbleMarker' }) * .40
    };
  }
  return {
    offense: roleValue(roles.origin, 'pass', attackTactic, { type, stage: 1, role: 'counterOrigin' }) * .40
      + roleValue(roles.origin, 'defense', attackTactic, { type, stage: 1, role: 'counterOrigin' }) * .15
      + roleValue(roles.runner, 'speed', attackTactic, { type, stage: 1, role: 'counterRunner' }) * .30
      + roleValue(roles.runner, 'dribble', attackTactic, { type, stage: 1, role: 'counterRunner' }) * .15,
    defense: roleValue(roles.defender, 'speed', defendTactic, { type, stage: 1, role: 'counterReturnDefender' }) * .55
      + roleValue(roles.defender, 'defense', defendTactic, { type, stage: 1, role: 'counterReturnDefender' }) * .45
  };
}
function buildSecondStageRoles(type, firstAttack, attackers, defenders, attackTactic, defendTactic, rng) {
  const firstRoles = firstAttack?.roles || {};
  if (type === 'PASS') {
    if (firstAttack?.firstType === 'PASS' && firstRoles.receiver) {
      const passer = firstRoles.receiver;
      const receiver = pickRole(attackers, p => ROLE_WEIGHTS.passSecondReceiver(p, attackTactic), rng, [passer, firstRoles.passer]);
      const support = pickRole(attackers, p => ROLE_WEIGHTS.passSupport(p, attackTactic), rng, [passer, receiver, firstRoles.passer]);
      const defender = pickRole(defenders, p => ROLE_WEIGHTS.passFinalDefender(p, defendTactic), rng);
      return { passer, receiver, support, defender, contributor: passer, primaryShooter: receiver };
    }
    if (firstAttack?.firstType === 'DRIBBLE' && firstRoles.dribbler) {
      const passer = firstRoles.dribbler;
      const receiver = firstRoles.support || pickRole(attackers, p => ROLE_WEIGHTS.passSecondReceiver(p, attackTactic), rng, [passer]);
      const support = pickRole(attackers, p => ROLE_WEIGHTS.passSupport(p, attackTactic), rng, [passer, receiver]);
      const defender = pickRole(defenders, p => ROLE_WEIGHTS.passFinalDefender(p, defendTactic), rng);
      return { passer, receiver, support, defender, contributor: passer, primaryShooter: receiver };
    }
    const passer = pickRole(attackers, p => ROLE_WEIGHTS.passFirstPasser(p, attackTactic), rng);
    const receiver = pickRole(attackers, p => ROLE_WEIGHTS.passSecondReceiver(p, attackTactic), rng, [passer]);
    const support = pickRole(attackers, p => ROLE_WEIGHTS.passSupport(p, attackTactic), rng, [passer, receiver]);
    const defender = pickRole(defenders, p => ROLE_WEIGHTS.passFinalDefender(p, defendTactic), rng);
    return { passer, receiver, support, defender, contributor: passer, primaryShooter: receiver };
  }
  if (type === 'DRIBBLE') {
    const dribbler = firstAttack?.firstType === 'PASS' && firstRoles.receiver ? firstRoles.receiver : firstRoles.dribbler || pickRole(attackers, p => ROLE_WEIGHTS.dribbler(p, attackTactic), rng);
    const support = firstAttack?.firstType === 'DRIBBLE' && firstRoles.support
      ? firstRoles.support
      : pickRole(attackers, p => ROLE_WEIGHTS.dribbleSupport(p, attackTactic), rng, [dribbler, firstRoles.passer]);
    const defender = pickRole(defenders, p => ROLE_WEIGHTS.dribbleCover(p, defendTactic), rng);
    return { dribbler, support, defender, contributor: dribbler, primaryShooter: dribbler };
  }
  const origin = firstRoles.origin || pickRole(attackers, p => ROLE_WEIGHTS.counterOrigin(p, attackTactic), rng);
  const runner = firstRoles.runner || pickRole(attackers, p => ROLE_WEIGHTS.counterRunner(p, attackTactic), rng, [origin]);
  const support = pickRole(attackers, p => ROLE_WEIGHTS.counterSupport(p, attackTactic), rng, [runner, origin]);
  const defender = pickRole(defenders, p => ROLE_WEIGHTS.counterFinalDefender(p, defendTactic), rng);
  return { origin, runner, support, defender, contributor: runner, primaryShooter: runner };
}
function secondStageScores(type, roles, attackTactic, defendTactic) {
  if (type === 'PASS') {
    let offense = roleValue(roles.passer, 'pass', attackTactic, { type, stage: 2, role: 'passSecondPasser' }) * .45
      + roleValue(roles.receiver, 'speed', attackTactic, { type, stage: 2, role: 'passSecondReceiver' }) * .20
      + roleValue(roles.receiver, 'dribble', attackTactic, { type, stage: 2, role: 'passSecondReceiver' }) * .15
      + roleValue(roles.receiver, 'shoot', attackTactic, { type, stage: 2, role: 'passSecondReceiver' }) * .10
      + roleValue(roles.support, 'pass', attackTactic, { type, stage: 2, role: 'passSupport' }) * .10;
    if (roles.receiver?.specialAbility === 'ポストプレーヤー') offense *= 1.06;
    return {
      offense,
      defense: roleValue(roles.defender, 'defense', defendTactic, { type, stage: 2, role: 'passFinalDefender' }) * .70
        + roleValue(roles.defender, 'speed', defendTactic, { type, stage: 2, role: 'passFinalDefender' }) * .30
    };
  }
  if (type === 'DRIBBLE') {
    return {
      offense: roleValue(roles.dribbler, 'dribble', attackTactic, { type, stage: 2, role: 'secondDribbler' }) * .45
        + roleValue(roles.dribbler, 'speed', attackTactic, { type, stage: 2, role: 'secondDribbler' }) * .20
        + roleValue(roles.dribbler, 'shoot', attackTactic, { type, stage: 2, role: 'secondDribbler' }) * .10
        + roleValue(roles.dribbler, 'pass', attackTactic, { type, stage: 2, role: 'secondDribbler' }) * .10
        + roleValue(roles.support, 'speed', attackTactic, { type, stage: 2, role: 'dribbleSupport' }) * .10
        + roleValue(roles.support, 'shoot', attackTactic, { type, stage: 2, role: 'dribbleSupport' }) * .05,
      defense: roleValue(roles.defender, 'defense', defendTactic, { type, stage: 2, role: 'dribbleCover' }) * .70
        + roleValue(roles.defender, 'speed', defendTactic, { type, stage: 2, role: 'dribbleCover' }) * .30
    };
  }
  if (type === 'SHORT_COUNTER') {
    return {
      offense: roleValue(roles.origin, 'defense', attackTactic, { type, stage: 2, role: 'shortOrigin' }) * .20
        + roleValue(roles.origin, 'pass', attackTactic, { type, stage: 2, role: 'counterOrigin' }) * .25
        + roleValue(roles.runner, 'speed', attackTactic, { type, stage: 2, role: 'shortRunner' }) * .30
        + roleValue(roles.runner, 'shoot', attackTactic, { type, stage: 2, role: 'shortRunner' }) * .15
        + roleValue(roles.support, 'speed', attackTactic, { type, stage: 2, role: 'shortSupport' }) * .10,
      defense: roleValue(roles.defender, 'defense', defendTactic, { type, stage: 2, role: 'shortFinalDefender' }) * .45
        + roleValue(roles.defender, 'speed', defendTactic, { type, stage: 2, role: 'shortFinalDefender' }) * .45
        + statValue(roles.goalkeeper, 'gk') * .10
    };
  }
  return {
    offense: roleValue(roles.runner, 'speed', attackTactic, { type, stage: 2, role: 'counterRunner' }) * .35
      + roleValue(roles.runner, 'dribble', attackTactic, { type, stage: 2, role: 'counterRunner' }) * .20
      + roleValue(roles.runner, 'shoot', attackTactic, { type, stage: 2, role: 'counterRunner' }) * .15
      + roleValue(roles.support, 'speed', attackTactic, { type, stage: 2, role: 'counterSupport' }) * .20
      + roleValue(roles.support, 'pass', attackTactic, { type, stage: 2, role: 'passSupport' }) * .10,
    defense: roleValue(roles.defender, 'defense', defendTactic, { type, stage: 2, role: 'counterFinalDefender' }) * .50
      + roleValue(roles.defender, 'speed', defendTactic, { type, stage: 2, role: 'counterFinalDefender' }) * .50
  };
}
function buildShortCounterRoles(origin, attackers, defenders, attackTactic, defendTactic, goalkeeper, rng) {
  const runner = pickRole(attackers, p => ROLE_WEIGHTS.counterRunner(p, attackTactic), rng, [origin]);
  const support = pickRole(attackers, p => ROLE_WEIGHTS.counterSupport(p, attackTactic), rng, [origin, runner]);
  const defender = pickRole(defenders, p => ROLE_WEIGHTS.counterFinalDefender(p, defendTactic), rng);
  return { origin, runner, support, defender, goalkeeper, contributor: origin, primaryShooter: runner };
}
function scoreSituationBonus(attack, home, score, phase) {
  const attackSide = sideKey(attack, home), defendSide = attackSide === 'home' ? 'away' : 'home';
  const diff = score[attackSide] - score[defendSide];
  if (diff < 0) return 5;
  if (diff === 0) return 0;
  return latePhase(phase) ? -15 : -5;
}
function counterIntent({ tactic, chanceStrength, runner, support, origin, attack, home, score, phase }) {
  const tacticScore = tactic === 'COUNTER' ? 25 : tactic === 'BALANCED' ? 10 : tactic === 'DRIBBLE' ? 5 : -10;
  const chanceScore = chanceStrength === 'strong' ? 20 : 5;
  const runnerScore = statValue(runner, 'speed') - 60;
  const supportScore = (statValue(support, 'speed') - 60) * .5;
  const abilityScore = (origin?.specialAbility === 'カウンター起点' ? 10 : 0) + ([runner?.specialAbility, support?.specialAbility].includes('スピードスター') ? 8 : 0);
  return tacticScore + tacticCounterTriggerBonus(tactic) + chanceScore + runnerScore + supportScore + abilityScore + scoreSituationBonus(attack, home, score, phase);
}
function maybeStartShortCounter({ phase, diff, stopper, attack, defend, home, score, homeState, awayState, homeFielders, awayFielders, rng, events }) {
  if (diff > -4) return null;
  const chanceStrength = diff <= -10 ? 'strong' : 'weak';
  const shortAttack = defend;
  const shortDefend = attack;
  const attackers = fieldersFor(shortAttack, home, homeFielders, awayFielders);
  const defenders = fieldersFor(shortDefend, home, homeFielders, awayFielders);
  const defendState = stateFor(shortDefend, home, homeState, awayState);
  const roles = buildShortCounterRoles(stopper, attackers, defenders, shortAttack.tactic, shortDefend.tactic, defendState.keeper, rng);
  const intent = counterIntent({ tactic: shortAttack.tactic, chanceStrength, runner: roles.runner, support: roles.support, origin: roles.origin, attack: shortAttack, home, score, phase });
  if (intent < 25) return null;
  events.push(logEvent(phase, 'SHORT COUNTER', stopper, `${chanceStrength} / intent ${Math.round(intent)}`, sideKey(shortAttack, home)));
  return { attack: shortAttack, defend: shortDefend, firstType: 'SHORT_COUNTER', type: 'SHORT_COUNTER', stage: 2, roles, shortCounter: true };
}
function roleDescription(type, stage, roles) {
  if (type === 'PASS') return `${roles.passer?.name || 'Unknown'}→${roles.receiver?.name || 'Unknown'}`;
  if (type === 'DRIBBLE') return `${roles.dribbler?.name || 'Unknown'}+${roles.support?.name || 'Unknown'}`;
  if (type === 'SHORT_COUNTER') return `${roles.origin?.name || 'Unknown'}→${roles.runner?.name || 'Unknown'}+${roles.support?.name || 'Unknown'}`;
  if (stage === 1) return `${roles.origin?.name || 'Unknown'}→${roles.runner?.name || 'Unknown'}`;
  return `${roles.runner?.name || 'Unknown'}+${roles.support?.name || 'Unknown'}`;
}
function pickShooterFromRoles(type, roles, attackers, tactic, rng) {
  const primary = roles.primaryShooter || roles.receiver || roles.dribbler || roles.runner;
  const support = roles.support;
  return weightedPick(attackers, player => {
    let multiplier = player === primary ? 1 : player === support ? .12 : player.primaryPosition === 'FW' ? .25 : player.primaryPosition === 'MF' ? .12 : .05;
    if (player === support && type === 'PASS' && roles.receiver?.specialAbility === 'ポストプレーヤー') multiplier += .05;
    if (player.specialAbility === 'エース') multiplier *= 1.20;
    return Math.max(.01, fieldValue(player, 'shoot', tactic) * multiplier);
  }, rng);
}
function shotBonusForAbility(shooter, type, chance, phase, score, attackSide, defendSide, secondRoles) {
  let bonus = 0;
  if (shooter.specialAbility === 'カットイン' && type === 'DRIBBLE' && shooter === secondRoles.dribbler) bonus += 8;
  if (shooter.specialAbility === 'フィニッシャー' && ['CLEAR', 'BIG'].includes(chance)) bonus += 10;
  if (shooter.specialAbility === 'ミドルシューター' && chance === 'HARD') bonus += 10;
  if (shooter.specialAbility === '勝負強さ' && latePhase(phase) && (score.home === score.away || score[attackSide] + 1 === score[defendSide])) bonus += 8;
  return bonus;
}

export function simulateMatch(home, away, rng) {
  const homeState = createMatchState(home), awayState = createMatchState(away);
  const all = [...new Map([...matchPlayerPool(home), ...matchPlayerPool(away)].map(player => [player.id, player])).values()];
  const originalStats = new Map(all.map(player => [player.id, { ...player.stats }]));
  const forms = Object.fromEntries(all.map(player => { const roll = rng.next(), factor = roll < .2 ? 1.05 : roll < .8 ? 1 : .95; for (const key of [...FIELD_KEYS, 'gk']) if (typeof player.stats[key] === 'number') player.stats[key] = Math.round(player.stats[key] * factor); return [player.id, factor > 1 ? '↑' : factor < 1 ? '↓' : '−']; }));
  refreshKeeper(homeState); refreshKeeper(awayState);
  const ratings = Object.fromEntries(all.map(player => [player.id, 6])), stat = new Map(all.map(player => [player.id, { shots: 0, goals: 0, assists: 0, attackContributions: 0, defensiveStops: 0, saves: 0, conceded: 0 }]));
  const score = { home: 0, away: 0 }, events = [];
  const defenseDebuff = new Map([[home.id, 0], [away.id, 0]]);
  let activeAttack = null;
  let nextRestart = { club: null, kind: 'normal' };

  for (let phase = 1; phase <= CONFIG.phaseCount; phase++) {
    advanceSubstitutions(homeState); advanceSubstitutions(awayState);
    const homeFielders = activeFielders(homeState), awayFielders = activeFielders(awayState);

    if (!activeAttack) {
      const attackClub = nextRestart.club || pickNeutralAttacker(home, away, homeFielders, awayFielders, rng);
      const type = restartAttackKind(attackClub.tactic, nextRestart.kind, rng);
      activeAttack = { attack: attackClub, defend: opponent(attackClub, home, away), firstType: type, type, stage: 1, roles: null };
      nextRestart = { club: null, kind: 'normal' };
    }

    const attack = activeAttack.attack, defend = activeAttack.defend;
    const attackState = stateFor(attack, home, homeState, awayState), defendState = stateFor(defend, home, homeState, awayState);
    const attackers = fieldersFor(attack, home, homeFielders, awayFielders), defenders = fieldersFor(defend, home, homeFielders, awayFielders);
    const type = activeAttack.type;

    if (activeAttack.stage === 1) {
      const roles = buildFirstStageRoles(type, attackers, defenders, attack.tactic, defend.tactic, rng);
      const scores = firstStageScores(type, roles, attack.tactic, defend.tactic);
      const offense = scores.offense + tacticAttackBonus(type, attack.tactic) + luck(rng, CONFIG.attackLuck);
      const pendingDebuff = defenseDebuff.get(defend.id) || 0;
      const defense = scores.defense + tacticDefenseBonus(defend.tactic) + pendingDebuff + luck(rng, CONFIG.attackLuck);
      if (pendingDebuff) defenseDebuff.set(defend.id, 0);
      const diff = offense - defense;
      if (diff > -2) {
        const contributor = roles.contributor || attackers[0];
        stat.get(contributor.id).attackContributions++; ratings[contributor.id] += .05;
        const nextType = secondStageKind(activeAttack.firstType, rng);
        events.push(logEvent(phase, 'STAGE 1 SUCCESS', contributor, `${type} → ${nextType} / ${roleDescription(type, 1, roles)}`, sideKey(attack, home)));
        activeAttack = { ...activeAttack, type: nextType, stage: 2, roles };
      } else {
        const stopper = roles.defender || pickRole(defenders, p => fieldValue(p, 'defense', defend.tactic), rng);
        stat.get(stopper.id).defensiveStops++; ratings[stopper.id] += .15;
        events.push(logEvent(phase, 'DEFENSIVE STOP', stopper, `${type} 第1阻止 / ${roleDescription(type, 1, roles)}`, sideKey(defend, home)));
        activeAttack = maybeStartShortCounter({ phase, diff, stopper, attack, defend, home, score, homeState, awayState, homeFielders, awayFielders, rng, events });
        if (!activeAttack) nextRestart = { club: defend, kind: 'defense' };
      }
      recordPlayedPhase(homeState); recordPlayedPhase(awayState);
      continue;
    }

    const secondRoles = activeAttack.shortCounter ? activeAttack.roles : buildSecondStageRoles(type, activeAttack, attackers, defenders, attack.tactic, defend.tactic, rng);
    const scores = secondStageScores(type, secondRoles, attack.tactic, defend.tactic);
    const offense = scores.offense + tacticAttackBonus(type, attack.tactic) + luck(rng, CONFIG.attackLuck);
    const defense = scores.defense + tacticDefenseBonus(defend.tactic) + luck(rng, CONFIG.attackLuck);
    const diff = offense - defense;

    if (diff <= 0) {
      const stopper = secondRoles.defender || pickRole(defenders, p => fieldValue(p, 'defense', defend.tactic), rng);
      stat.get(stopper.id).defensiveStops++; ratings[stopper.id] += .18;
      events.push(logEvent(phase, 'DEFENSIVE STOP', stopper, `${type} 第2阻止 / ${roleDescription(type, 2, secondRoles)}`, sideKey(defend, home)));
      if (type === 'COUNTER' || type === 'SHORT_COUNTER') defenseDebuff.set(attack.id, -4);
      nextRestart = { club: defend, kind: 'defense' };
      activeAttack = null;
      recordPlayedPhase(homeState); recordPlayedPhase(awayState);
      continue;
    }

    const chance = finalDefenseChance(stageChance(diff), secondRoles.defender);
    const contributor = secondRoles.contributor || attackers[0];
    stat.get(contributor.id).attackContributions++; ratings[contributor.id] += .08;
    const shooter = pickShooterFromRoles(type, secondRoles, attackers, attack.tactic, rng);
    stat.get(shooter.id).shots++; ratings[shooter.id] += .05;
    const attackSide = sideKey(attack, home), defendSide = sideKey(defend, home);
    const counterShotBonus = type === 'COUNTER' ? 5 : type === 'SHORT_COUNTER' ? 8 : 0;
    const abilityShotBonus = shotBonusForAbility(shooter, type, chance, phase, score, attackSide, defendSide, secondRoles);
    const shooterScore = fieldValue(shooter, 'shoot', attack.tactic) + CONFIG.chanceBonus[chance.toLowerCase()] + counterShotBonus + abilityShotBonus + luck(rng, CONFIG.shotLuck);
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
      let assist = null; const rate = type === 'PASS' ? .8 : isCounterType(type) ? .6 : .35;
      if (contributor !== shooter && rng.next() < rate) { assist = contributor; stat.get(assist.id).assists++; ratings[assist.id] += .7; }
      events.push(logEvent(phase, 'GOAL', shooter, `${type} / ${chance} / ${roleDescription(type, 2, secondRoles)}${assist ? ` / Assist ${assist.name}` : ''}`, attackSide));
      nextRestart = { club: defend, kind: 'normal' };
      activeAttack = null;
    } else {
      const margin = goalieScore - shooterScore;
      if (margin >= 12) {
        stat.get(gk.id).saves++; ratings[gk.id] += .12;
        events.push(logEvent(phase, 'GK CATCH', gk, `${type} / ${chance} / ${shooter.name} shot`, defendSide));
        nextRestart = { club: defend, kind: 'normal' };
        activeAttack = null;
      } else if (margin >= 4) {
        const saved = rng.next() < .55;
        if (saved) { stat.get(gk.id).saves++; ratings[gk.id] += .10; }
        events.push(logEvent(phase, saved ? 'SAVE' : 'MISS', saved ? gk : shooter, `${type} / ${chance} / ${shooter.name} shot`, saved ? defendSide : attackSide));
        nextRestart = { club: defend, kind: 'normal' };
        activeAttack = null;
      } else {
        stat.get(gk.id).saves++; ratings[gk.id] += .08;
        const recovered = rng.next() < reboundRecoveryRate(chance, gk);
        events.push(logEvent(phase, 'REBOUND', recovered ? shooter : gk, `${type} / ${chance} / ${recovered ? 'attack recovers' : 'cleared'}`, recovered ? attackSide : defendSide));
        if (recovered) {
          const reboundType = pickWeightedType({ PASS: 50, DRIBBLE: 50 }, rng);
          activeAttack = { attack, defend, firstType: 'REBOUND', type: reboundType, stage: 2, roles: null, rebound: true };
          nextRestart = { club: null, kind: 'normal' };
        } else {
          nextRestart = { club: defend, kind: 'normal' };
          activeAttack = null;
        }
      }
    }
    recordPlayedPhase(homeState); recordPlayedPhase(awayState);
  }
  const played = new Map([...homeState.playerState.values(), ...awayState.playerState.values()].filter(state => state.playedPhases > 0).map(state => [state.player.id, state.playedPhases]));
  const keeperIds = [homeState.keeper?.id, awayState.keeper?.id].filter(Boolean);
  for (const id of keeperIds) played.set(id, CONFIG.phaseCount);
  const playerResults = all.filter(player => played.has(player.id)).map(player => ({ player, rating: Math.max(4, Math.min(10, Math.round(ratings[player.id] * 10) / 10)), playedPhases: played.get(player.id), ...stat.get(player.id) }));
  all.forEach(player => { player.stats = originalStats.get(player.id); });
  return { score, events, playerResults, phases: CONFIG.phaseCount, forms };
}
