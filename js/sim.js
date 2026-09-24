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
    enterSlot(need.slot, need.candidate);
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
function posMul(player, values) { return values[player.primaryPosition] ?? 1; }
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
      offense: fieldValue(roles.passer, 'pass', attackTactic) * .45
        + fieldValue(roles.receiver, 'dribble', attackTactic) * .20
        + speedValue(roles.receiver, type, attackTactic) * .15
        + fieldValue(roles.receiver, 'pass', attackTactic) * .10
        + fieldValue(roles.support, 'pass', attackTactic) * .10,
      defense: fieldValue(roles.defender, 'defense', defendTactic) * .65 + speedValue(roles.defender, type, defendTactic, true) * .35
    };
  }
  if (type === 'DRIBBLE') {
    return {
      offense: fieldValue(roles.dribbler, 'dribble', attackTactic) * .55
        + speedValue(roles.dribbler, type, attackTactic) * .25
        + fieldValue(roles.dribbler, 'pass', attackTactic) * .10
        + fieldValue(roles.support, 'pass', attackTactic) * .10,
      defense: fieldValue(roles.defender, 'defense', defendTactic) * .60 + speedValue(roles.defender, type, defendTactic, true) * .40
    };
  }
  return {
    offense: fieldValue(roles.origin, 'pass', attackTactic) * .40
      + fieldValue(roles.origin, 'defense', attackTactic) * .15
      + speedValue(roles.runner, type, attackTactic) * .30
      + fieldValue(roles.runner, 'dribble', attackTactic) * .15,
    defense: speedValue(roles.defender, type, defendTactic, true) * .55 + fieldValue(roles.defender, 'defense', defendTactic) * .45
  };
}
function buildSecondStageRoles(type, firstAttack, attackers, defenders, attackTactic, defendTactic, rng) {
  const firstRoles = firstAttack.roles || {};
  if (type === 'PASS') {
    if (firstAttack.firstType === 'PASS') {
      const passer = firstRoles.receiver;
      const receiver = pickRole(attackers, p => ROLE_WEIGHTS.passSecondReceiver(p, attackTactic), rng, [passer, firstRoles.passer]);
      const support = pickRole(attackers, p => ROLE_WEIGHTS.passSupport(p, attackTactic), rng, [passer, receiver, firstRoles.passer]);
      const defender = pickRole(defenders, p => ROLE_WEIGHTS.passFinalDefender(p, defendTactic), rng);
      return { passer, receiver, support, defender, contributor: passer, primaryShooter: receiver };
    }
    const passer = firstRoles.dribbler;
    const receiver = firstRoles.support || pickRole(attackers, p => ROLE_WEIGHTS.passSecondReceiver(p, attackTactic), rng, [passer]);
    const support = pickRole(attackers, p => ROLE_WEIGHTS.passSupport(p, attackTactic), rng, [passer, receiver]);
    const defender = pickRole(defenders, p => ROLE_WEIGHTS.passFinalDefender(p, defendTactic), rng);
    return { passer, receiver, support, defender, contributor: passer, primaryShooter: receiver };
  }
  if (type === 'DRIBBLE') {
    const dribbler = firstAttack.firstType === 'PASS' ? firstRoles.receiver : firstRoles.dribbler;
    const support = firstAttack.firstType === 'DRIBBLE'
      ? firstRoles.support
      : pickRole(attackers, p => ROLE_WEIGHTS.dribbleSupport(p, attackTactic), rng, [dribbler, firstRoles.passer]);
    const defender = pickRole(defenders, p => ROLE_WEIGHTS.dribbleCover(p, defendTactic), rng);
    return { dribbler, support, defender, contributor: dribbler, primaryShooter: dribbler };
  }
  const runner = firstRoles.runner;
  const support = pickRole(attackers, p => ROLE_WEIGHTS.counterSupport(p, attackTactic), rng, [runner, firstRoles.origin]);
  const defender = pickRole(defenders, p => ROLE_WEIGHTS.counterFinalDefender(p, defendTactic), rng);
  return { origin: firstRoles.origin, runner, support, defender, contributor: runner, primaryShooter: runner };
}
function secondStageScores(type, roles, attackTactic, defendTactic) {
  if (type === 'PASS') {
    return {
      offense: fieldValue(roles.passer, 'pass', attackTactic) * .45
        + speedValue(roles.receiver, type, attackTactic) * .20
        + fieldValue(roles.receiver, 'dribble', attackTactic) * .15
        + fieldValue(roles.receiver, 'shoot', attackTactic) * .10
        + fieldValue(roles.support, 'pass', attackTactic) * .10,
      defense: fieldValue(roles.defender, 'defense', defendTactic) * .70 + speedValue(roles.defender, type, defendTactic, true) * .30
    };
  }
  if (type === 'DRIBBLE') {
    return {
      offense: fieldValue(roles.dribbler, 'dribble', attackTactic) * .45
        + speedValue(roles.dribbler, type, attackTactic) * .20
        + fieldValue(roles.dribbler, 'shoot', attackTactic) * .10
        + fieldValue(roles.dribbler, 'pass', attackTactic) * .10
        + speedValue(roles.support, type, attackTactic) * .10
        + fieldValue(roles.support, 'shoot', attackTactic) * .05,
      defense: fieldValue(roles.defender, 'defense', defendTactic) * .70 + speedValue(roles.defender, type, defendTactic, true) * .30
    };
  }
  return {
    offense: speedValue(roles.runner, type, attackTactic) * .35
      + fieldValue(roles.runner, 'dribble', attackTactic) * .20
      + fieldValue(roles.runner, 'shoot', attackTactic) * .15
      + speedValue(roles.support, type, attackTactic) * .20
      + fieldValue(roles.support, 'pass', attackTactic) * .10,
    defense: fieldValue(roles.defender, 'defense', defendTactic) * .50 + speedValue(roles.defender, type, defendTactic, true) * .50
  };
}
function roleDescription(type, stage, roles) {
  if (type === 'PASS') return stage === 1 ? `${roles.passer.name}→${roles.receiver.name}` : `${roles.passer.name}→${roles.receiver.name}`;
  if (type === 'DRIBBLE') return `${roles.dribbler.name}+${roles.support.name}`;
  if (stage === 1) return `${roles.origin.name}→${roles.runner.name}`;
  return `${roles.runner.name}+${roles.support.name}`;
}
function pickShooterFromRoles(type, roles, attackers, tactic, rng) {
  const primary = roles.primaryShooter || roles.receiver || roles.dribbler || roles.runner;
  const support = roles.support;
  return weightedPick(attackers, player => {
    let multiplier = player === primary ? 1 : player === support ? .12 : player.primaryPosition === 'FW' ? .25 : player.primaryPosition === 'MF' ? .12 : .05;
    if (player.specialAbility === 'エース') multiplier *= 1.20;
    return Math.max(.01, fieldValue(player, 'shoot', tactic) * multiplier);
  }, rng);
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
      const defense = scores.defense + tacticDefenseBonus(defend.tactic) + luck(rng, CONFIG.attackLuck);
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
        nextRestart = { club: defend, kind: 'defense' };
        activeAttack = null;
      }
      recordPlayedPhase(homeState); recordPlayedPhase(awayState);
      continue;
    }

    const secondRoles = buildSecondStageRoles(type, activeAttack, attackers, defenders, attack.tactic, defend.tactic, rng);
    const scores = secondStageScores(type, secondRoles, attack.tactic, defend.tactic);
    const offense = scores.offense + tacticAttackBonus(type, attack.tactic) + luck(rng, CONFIG.attackLuck);
    const defense = scores.defense + tacticDefenseBonus(defend.tactic) + luck(rng, CONFIG.attackLuck);
    const diff = offense - defense;

    if (diff <= 0) {
      const stopper = secondRoles.defender || pickRole(defenders, p => fieldValue(p, 'defense', defend.tactic), rng);
      stat.get(stopper.id).defensiveStops++; ratings[stopper.id] += .18;
      events.push(logEvent(phase, 'DEFENSIVE STOP', stopper, `${type} 第2阻止 / ${roleDescription(type, 2, secondRoles)}`, sideKey(defend, home)));
      nextRestart = { club: defend, kind: 'defense' };
      activeAttack = null;
      recordPlayedPhase(homeState); recordPlayedPhase(awayState);
      continue;
    }

    const chance = stageChance(diff);
    const contributor = secondRoles.contributor || attackers[0];
    stat.get(contributor.id).attackContributions++; ratings[contributor.id] += .08;
    const shooter = pickShooterFromRoles(type, secondRoles, attackers, attack.tactic, rng);
    stat.get(shooter.id).shots++; ratings[shooter.id] += .05;
    let shooterMultiplier = 1;
    if (shooter.specialAbility === 'カットイン' && type === 'DRIBBLE' && shooter === secondRoles.dribbler) shooterMultiplier *= 1.08;
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
      events.push(logEvent(phase, 'GOAL', shooter, `${type} / ${chance} / ${roleDescription(type, 2, secondRoles)}${assist ? ` / Assist ${assist.name}` : ''}`, attackSide));
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
