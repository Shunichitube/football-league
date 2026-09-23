import { CONFIG } from './config.js';
import { weightedPick } from './random.js';
import { LINEUP_SLOTS, positionSuitability } from './rules.js?v=0.9.0';

const avg = (players, key) => players.reduce((sum, p) => sum + p.stats[key], 0) / players.length;
function assignedPlayer(club, index) {
  const player = club.roster.find(candidate => candidate.id === club.lineup[index]);
  if (!player) return null;
  const role = LINEUP_SLOTS[index];
  const fit = positionSuitability(player, role);
  const stats = { ...player.stats };
  if (role === 'GK') stats.gk *= fit;
  else for (const key of ['shoot', 'speed', 'defense', 'dribble', 'pass']) stats[key] *= fit;
  return { ...player, primaryPosition: role, stats };
}
const fielders = club => LINEUP_SLOTS.slice(1).map((_, index) => assignedPlayer(club, index + 1)).filter(Boolean);
const keeper = club => assignedPlayer(club, 0);
const luck = (rng, range) => rng.int(-range, range);

function ratingBase(players) { return Object.fromEntries(players.map(p => [p.id, 6])); }
function chanceName(diff) { if (diff <= -10) return 'STOP'; if (diff <= 0) return 'HARD'; if (diff <= 10) return 'NORMAL'; if (diff <= 20) return 'CLEAR'; return 'BIG'; }
function attackKind(rng, tactic) { return weightedPick(['PASS', 'DRIBBLE', 'COUNTER'], type => CONFIG.tactics[tactic][type], rng); }
function attackScore(type, players, rng, tactic) {
  const pass = avg(players, 'pass'), dribble = avg(players, 'dribble'), speed = avg(players, 'speed');
  const value = type === 'PASS' ? pass * .5 + dribble * .2 + speed * .3 : type === 'DRIBBLE' ? dribble * .6 + speed * .25 + pass * .15 : speed * .5 + pass * .3 + dribble * .2;
  const abilityBonus = players.some(p => (type === 'PASS' && ['チャンスメイカー','ビルドアップ','ポストプレーヤー'].includes(p.specialAbility)) || (type === 'DRIBBLE' && ['ドリブラー','個人技'].includes(p.specialAbility)) || (type === 'COUNTER' && ['スピードスター','カウンター起点'].includes(p.specialAbility))) ? 1.08 : 1;
  const tacticBonus = tactic === 'BALANCED' || (tactic === 'POSSESSION' && type === 'PASS') || (tactic === 'DRIBBLE' && type === 'DRIBBLE') || (tactic === 'COUNTER' && type === 'COUNTER') ? CONFIG.tactics[tactic].bonus : 1;
  return value * abilityBonus * tacticBonus + luck(rng, CONFIG.attackLuck);
}
function formatTime(phase) { const seconds = phase * CONFIG.phaseSeconds; return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function logEvent(phase, kind, player, extra = '', side = null) { return { time: formatTime(phase), kind, player: player.name, extra, side }; }

export function simulateMatch(home, away, rng) {
  const starters = club => club.lineup.map(id => club.roster.find(player => player.id === id)).filter(Boolean);
  const all = [...starters(home), ...starters(away)];
  const originalStats = new Map(all.map(p => [p.id, { ...p.stats }]));
  const forms = Object.fromEntries(all.map(p => { const roll = rng.next(); const factor = roll < .2 ? 1.05 : roll < .8 ? 1 : .95; for (const key of Object.keys(p.stats)) p.stats[key] = Math.round(p.stats[key] * factor); return [p.id, factor > 1 ? '↑' : factor < 1 ? '↓' : '−']; }));
  const ratings = ratingBase(all); const stat = new Map(all.map(p => [p.id, { shots: 0, goals: 0, assists: 0, attackContributions: 0, defensiveStops: 0, saves: 0, conceded: 0 }]));
  const score = { home: 0, away: 0 }; const events = [];
  for (let phase = 1; phase <= CONFIG.phaseCount; phase++) {
    const hf = fielders(home), af = fielders(away); const homePoss = avg(hf, 'pass') * .6 + avg(hf, 'dribble') * .2 + avg(hf, 'speed') * .2; const awayPoss = avg(af, 'pass') * .6 + avg(af, 'dribble') * .2 + avg(af, 'speed') * .2;
    const homeChance = Math.max(.35, Math.min(.65, homePoss / (homePoss + awayPoss)));
    const attack = rng.next() < homeChance ? home : away; const defend = attack === home ? away : home; const attackers = attack === home ? hf : af; const defenders = defend === home ? hf : af; const type = attackKind(rng, attack.tactic);
    const offense = attackScore(type, attackers, rng, attack.tactic); const defenseAbility = defenders.some(p => ['ボールハンター','パスカット'].includes(p.specialAbility)) ? 1.08 : 1; const defense = (avg(defenders, 'defense') * .7 + avg(defenders, 'speed') * .3) * defenseAbility + luck(rng, CONFIG.attackLuck); const chance = chanceName(offense - defense);
    if (chance === 'STOP') { const stopper = weightedPick(defenders, p => p.stats.defense * .7 + p.stats.speed * .3, rng); stat.get(stopper.id).defensiveStops++; ratings[stopper.id] += .15; events.push(logEvent(phase, 'DEFENSIVE STOP', stopper)); continue; }
    const contributor = weightedPick(attackers, p => type === 'PASS' ? p.stats.pass : type === 'DRIBBLE' ? p.stats.dribble : p.stats.speed, rng); stat.get(contributor.id).attackContributions++; ratings[contributor.id] += .08;
    const shooter = weightedPick(attackers, p => p.stats.shoot * CONFIG.positionShotWeight[p.primaryPosition], rng); stat.get(shooter.id).shots++; ratings[shooter.id] += .05;
    const gk = keeper(defend); const shooterAbility = (shooter.specialAbility === 'フィニッシャー' && ['CLEAR','BIG'].includes(chance)) || (shooter.specialAbility === 'ミドルシューター' && chance === 'HARD') ? 1.1 : 1; const shooterScore = shooter.stats.shoot * shooterAbility + CONFIG.chanceBonus[chance.toLowerCase()] + luck(rng, CONFIG.shotLuck); const gkAbility = (gk.specialAbility === 'ショットストッパー' || (gk.specialAbility === 'ビッグセーバー' && ['CLEAR','BIG'].includes(chance))) ? 1.1 : 1; const goalieScore = gk.stats.gk * gkAbility + CONFIG.gkBaseAdvantage + luck(rng, CONFIG.shotLuck);
    if (shooterScore > goalieScore) { const side = attack === home ? 'home' : 'away'; score[side]++; stat.get(shooter.id).goals++; ratings[shooter.id] += 1.2; stat.get(gk.id).conceded++; ratings[gk.id] -= .15; let assist = null; const rate = type === 'PASS' ? .8 : type === 'COUNTER' ? .6 : .35; if (contributor !== shooter && rng.next() < rate) { assist = contributor; stat.get(assist.id).assists++; ratings[assist.id] += .7; } events.push(logEvent(phase, 'GOAL', shooter, assist ? `Assist ${assist.name}` : '', side)); }
    else if (shooterScore < goalieScore - 8) { stat.get(gk.id).saves++; ratings[gk.id] += .12; events.push(logEvent(phase, 'SAVE', gk, `${shooter.name} shot`)); }
    else events.push(logEvent(phase, 'MISS', shooter));
  }
  const playerResults = all.map(p => ({ player: p, rating: Math.max(4, Math.min(10, Math.round(ratings[p.id] * 10) / 10)), ...stat.get(p.id) }));
  all.forEach(p => { p.stats = originalStats.get(p.id); });
  return { score, events, playerResults, phases: CONFIG.phaseCount, forms };
}
