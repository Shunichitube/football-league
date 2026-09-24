import { CONFIG } from './config.js';
import { weightedPick } from './random.js';
import { LINEUP_SLOTS, positionSuitability } from './rules.js?v=0.12.0';

const FIELD_KEYS = ['shoot', 'speed', 'defense', 'dribble', 'pass'];
const avg = (players, valueOf) => players.reduce((sum, player) => sum + valueOf(player), 0) / players.length;
const luck = (rng, range) => rng.int(-range, range);
const latePhase = phase => phase >= CONFIG.phaseCount - 19;
const oneGoalGame = score => Math.abs(score.home - score.away) <= 1;

function assignedPlayer(club, index) {
  const player = club.roster.find(candidate => candidate.id === club.lineup[index]);
  if (!player) return null;
  const role = LINEUP_SLOTS[index], fit = positionSuitability(player, role), stats = { ...player.stats };
  if (role === 'GK') stats.gk *= fit; else for (const key of FIELD_KEYS) stats[key] *= fit;
  return { ...player, primaryPosition: role, stats };
}
const fielders = club => LINEUP_SLOTS.slice(1).map((_, index) => assignedPlayer(club, index + 1)).filter(Boolean);
const keeper = club => assignedPlayer(club, 0);
const fieldValue = (player, key, tactic) => player.stats[key] * (player.specialAbility === '万能型' && tactic === 'BALANCED' ? 1.04 : 1);
function speedValue(player, attackType, tactic, defending = false) {
  let value = fieldValue(player, 'speed', tactic);
  if (!defending && attackType === 'COUNTER' && player.specialAbility === 'スピードスター') value *= 1.10;
  if (player.specialAbility === 'ハードワーカー') value *= 1.06;
  return value;
}
function attackKind(rng, tactic) { return weightedPick(['PASS', 'DRIBBLE', 'COUNTER'], type => CONFIG.tactics[tactic][type], rng); }
function attackScore(type, players, goalkeeper, rng, tactic) {
  let value = avg(players, player => {
    let pass = fieldValue(player, 'pass', tactic), dribble = fieldValue(player, 'dribble', tactic), speed = speedValue(player, type, tactic);
    if (type === 'PASS' && player.specialAbility === 'ビルドアップ') pass *= 1.10;
    if (type === 'PASS' && player.specialAbility === 'チャンスメイカー') pass *= 1.08;
    if (type === 'DRIBBLE' && ['ドリブラー', '個人技'].includes(player.specialAbility)) dribble *= 1.10;
    return type === 'PASS' ? pass * .5 + dribble * .2 + speed * .3 : type === 'DRIBBLE' ? dribble * .6 + speed * .25 + pass * .15 : speed * .5 + pass * .3 + dribble * .2;
  });
  if (type === 'PASS' && players.some(player => player.specialAbility === 'ポストプレーヤー')) value *= 1.06;
  const tacticBonus = tactic === 'BALANCED' || (tactic === 'POSSESSION' && type === 'PASS') || (tactic === 'DRIBBLE' && type === 'DRIBBLE') || (tactic === 'COUNTER' && type === 'COUNTER') ? CONFIG.tactics[tactic].bonus : 1;
  const goalkeeperBuildUp = type === 'PASS' && goalkeeper ? goalkeeper.stats.pass * .08 + goalkeeper.stats.dribble * .02 : 0;
  return value * tacticBonus + goalkeeperBuildUp + luck(rng, CONFIG.attackLuck);
}
function defenseScore(type, defenders, tactic) {
  return avg(defenders, player => {
    let defense = fieldValue(player, 'defense', tactic), speed = speedValue(player, type, tactic, true);
    if (player.specialAbility === 'ボールハンター') defense *= 1.10;
    if (type === 'DRIBBLE' && player.specialAbility === 'カバーリング') defense *= 1.08;
    if (type === 'PASS' && player.specialAbility === 'パスカット') defense *= 1.08;
    return defense * .7 + speed * .3;
  });
}
function chanceName(diff) { if (diff <= -10) return 'STOP'; if (diff <= 0) return 'HARD'; if (diff <= 10) return 'NORMAL'; if (diff <= 20) return 'CLEAR'; return 'BIG'; }
function formatTime(phase) { const seconds = phase * CONFIG.phaseSeconds; return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function logEvent(phase, kind, player, extra = '', side = null) { return { time: formatTime(phase), kind, player: player.name, extra, side }; }

export function simulateMatch(home, away, rng) {
  const starters = club => club.lineup.map(id => club.roster.find(player => player.id === id)).filter(Boolean), all = [...starters(home), ...starters(away)];
  const originalStats = new Map(all.map(player => [player.id, { ...player.stats }]));
  const forms = Object.fromEntries(all.map(player => { const roll = rng.next(), factor = roll < .2 ? 1.05 : roll < .8 ? 1 : .95; for (const key of Object.keys(player.stats)) player.stats[key] = Math.round(player.stats[key] * factor); return [player.id, factor > 1 ? '↑' : factor < 1 ? '↓' : '−']; }));
  const ratings = Object.fromEntries(all.map(player => [player.id, 6])), stat = new Map(all.map(player => [player.id, { shots: 0, goals: 0, assists: 0, attackContributions: 0, defensiveStops: 0, saves: 0, conceded: 0 }]));
  const score = { home: 0, away: 0 }, events = []; let counterBonusClubId = null;
  for (let phase = 1; phase <= CONFIG.phaseCount; phase++) {
    const hf = fielders(home), af = fielders(away);
    const homePoss = avg(hf, player => fieldValue(player, 'pass', home.tactic) * .6 + fieldValue(player, 'dribble', home.tactic) * .2 + speedValue(player, 'PASS', home.tactic) * .2), awayPoss = avg(af, player => fieldValue(player, 'pass', away.tactic) * .6 + fieldValue(player, 'dribble', away.tactic) * .2 + speedValue(player, 'PASS', away.tactic) * .2);
    const homeChance = Math.max(.35, Math.min(.65, homePoss / (homePoss + awayPoss))), attack = rng.next() < homeChance ? home : away, defend = attack === home ? away : home, attackers = attack === home ? hf : af, defenders = defend === home ? hf : af, type = attackKind(rng, attack.tactic);
    let offense = attackScore(type, attackers, keeper(attack), rng, attack.tactic);
    if (type === 'COUNTER' && counterBonusClubId === attack.id) { offense *= 1.08; counterBonusClubId = null; }
    let defense = defenseScore(type, defenders, defend.tactic) + luck(rng, CONFIG.attackLuck), chance = chanceName(offense - defense);
    if (['CLEAR', 'BIG'].includes(chance) && defenders.some(player => player.specialAbility === '最終防衛線')) { defense *= 1.05; chance = chanceName(offense - defense); }
    if (chance === 'STOP') {
      const stopper = weightedPick(defenders, player => fieldValue(player, 'defense', defend.tactic) * .7 + speedValue(player, type, defend.tactic, true) * .3, rng);
      stat.get(stopper.id).defensiveStops++; ratings[stopper.id] += .15; if (stopper.specialAbility === 'カウンター起点') counterBonusClubId = defend.id; events.push(logEvent(phase, 'DEFENSIVE STOP', stopper)); continue;
    }
    const contributor = weightedPick(attackers, player => type === 'PASS' ? fieldValue(player, 'pass', attack.tactic) * (player.specialAbility === 'ビルドアップ' ? 1.10 : 1) * (player.specialAbility === 'チャンスメイカー' ? 1.08 : 1) : type === 'DRIBBLE' ? fieldValue(player, 'dribble', attack.tactic) * (['ドリブラー', '個人技'].includes(player.specialAbility) ? 1.10 : 1) : speedValue(player, type, attack.tactic), rng);
    stat.get(contributor.id).attackContributions++; ratings[contributor.id] += .08;
    const shooter = weightedPick(attackers, player => fieldValue(player, 'shoot', attack.tactic) * CONFIG.positionShotWeight[player.primaryPosition] * (player.specialAbility === 'エース' ? 1.20 : 1), rng);
    stat.get(shooter.id).shots++; ratings[shooter.id] += .05;
    let shooterMultiplier = 1;
    if (shooter.specialAbility === 'カットイン' && type === 'DRIBBLE') shooterMultiplier *= 1.08;
    if (shooter.specialAbility === 'フィニッシャー' && ['CLEAR', 'BIG'].includes(chance)) shooterMultiplier *= 1.10;
    if (shooter.specialAbility === 'ミドルシューター' && chance === 'HARD') shooterMultiplier *= 1.10;
    const attackSide = attack === home ? 'home' : 'away', oneBehind = score[attackSide] + 1 === score[attackSide === 'home' ? 'away' : 'home'];
    if (shooter.specialAbility === '勝負強さ' && latePhase(phase) && (score.home === score.away || oneBehind)) shooterMultiplier *= 1.08;
    const shooterScore = (fieldValue(shooter, 'shoot', attack.tactic) + CONFIG.chanceBonus[chance.toLowerCase()] + luck(rng, CONFIG.shotLuck)) * shooterMultiplier, gk = keeper(defend), baseGoalieScore = gk.stats.gk * .80 + gk.stats.defense * .10 + gk.stats.speed * .10 + CONFIG.gkBaseAdvantage;
    let gkMultiplier = 1;
    if (gk.specialAbility === 'ショットストッパー' && chance === 'NORMAL') gkMultiplier *= 1.08;
    if (gk.specialAbility === 'ビッグセーバー' && ['CLEAR', 'BIG'].includes(chance)) gkMultiplier *= 1.10;
    if (gk.specialAbility === 'ロングレンジキラー' && chance === 'HARD') gkMultiplier *= 1.12;
    if (gk.specialAbility === '反応型' && shooterScore > baseGoalieScore) gkMultiplier *= 1.06;
    if (gk.specialAbility === '守護神' && latePhase(phase) && oneGoalGame(score)) gkMultiplier *= 1.08;
    const goalieScore = baseGoalieScore * gkMultiplier + luck(rng, gk.specialAbility === '安定感' ? 7 : CONFIG.shotLuck);
    if (shooterScore > goalieScore) { score[attackSide]++; stat.get(shooter.id).goals++; ratings[shooter.id] += 1.2; stat.get(gk.id).conceded++; ratings[gk.id] -= .15; let assist = null; const rate = type === 'PASS' ? .8 : type === 'COUNTER' ? .6 : .35; if (contributor !== shooter && rng.next() < rate) { assist = contributor; stat.get(assist.id).assists++; ratings[assist.id] += .7; } events.push(logEvent(phase, 'GOAL', shooter, assist ? `Assist ${assist.name}` : '', attackSide)); }
    else if (shooterScore < goalieScore - 8) { stat.get(gk.id).saves++; ratings[gk.id] += .12; events.push(logEvent(phase, 'SAVE', gk, `${shooter.name} shot`)); }
    else events.push(logEvent(phase, 'MISS', shooter));
  }
  const playerResults = all.map(player => ({ player, rating: Math.max(4, Math.min(10, Math.round(ratings[player.id] * 10) / 10)), ...stat.get(player.id) }));
  all.forEach(player => { player.stats = originalStats.get(player.id); });
  return { score, events, playerResults, phases: CONFIG.phaseCount, forms };
}
