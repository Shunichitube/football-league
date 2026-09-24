import { rankOf } from './config.js';
import { calculateOverall, FIELD_STAT_KEYS, FIELD_PLAYER_STAT_KEYS } from './data.js?v=0.17.1';
import { SPECIAL_ABILITIES } from './market.js?v=0.17.1';
import { weightedPick } from './random.js';

const RANKS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'];
const RANK_MIN = { G: 50, F: 56, E: 61, D: 66, C: 71, B: 76, A: 81, S: 86, SS: 91 };
const CONTRACT_EVENTS = {
  SS: { rate: .70, min: 12, max: 18 }, S: { rate: .60, min: 12, max: 18 },
  A: { rate: .50, min: 8, max: 12 }, B: { rate: .30, min: 5, max: 8 },
  C: { rate: .20, min: 3, max: 5 }, D: { rate: .10, min: 3, max: 5 }
};
const SPECIAL_TRAINING_COST = { E: 8, F: 5, G: 2 };
const ageBase = age => age <= 19 ? 2.4 : age <= 21 ? 2 : age <= 23 ? 1.6 : age <= 25 ? 1 : age <= 28 ? .4 : 0;
const highModifier = value => value <= 75 ? 1 : value <= 80 ? .8 : value <= 85 ? .65 : value <= 90 ? .45 : .25;
const appearanceModifier = player => player.season.appearances >= 7 ? 1 : player.season.appearances >= 3 ? .85 : .7;
const skills = player => player.primaryPosition === 'GK' ? [...FIELD_STAT_KEYS, 'gk'] : FIELD_PLAYER_STAT_KEYS;
const growthFor = (player, key) => typeof player.hiddenGrowth === 'number' ? player.hiddenGrowth : player.hiddenGrowth?.[key] ?? 1;
const rankUpValue = (value, steps) => RANK_MIN[RANKS[Math.min(RANKS.length - 1, RANKS.indexOf(rankOf(value)) + steps)]];

const weightedDistinctSkills = (player, rng) => {
  const remaining = [...skills(player)].filter(key => player.stats[key] < 99);
  const selected = [];
  while (remaining.length && selected.length < 2) {
    const key = weightedPick(remaining, item => growthFor(player, item), rng);
    selected.push(key);
    remaining.splice(remaining.indexOf(key), 1);
  }
  return selected;
};

function learnedAbilityFor(player, gainedKeys, rng) {
  const choices = SPECIAL_ABILITIES[player.primaryPosition];
  const season = player.season || {};
  const grew = key => gainedKeys.includes(key);
  const weight = ability => {
    let value = 1;
    if (player.primaryPosition === 'GK') {
      if (season.saves) value += season.saves / 3;
      if (player.stats.gk >= 75) value += 1;
    } else if (player.primaryPosition === 'DF') {
      if (grew('defense') || season.defensiveStops) value += ['ボールハンター', 'カバーリング', 'パスカット', '最終防衛線'].includes(ability) ? 3 : 0;
      if (grew('pass') || player.stats.pass >= 75) value += ability === 'ビルドアップ' ? 3 : 0;
      if (grew('speed')) value += ability === 'カウンター起点' ? 2 : 0;
      if (grew('stamina')) value += ability === '回復力' ? 2 : 0;
    } else if (player.primaryPosition === 'MF') {
      if (grew('speed')) value += ['スピードスター', 'ハードワーカー'].includes(ability) ? 3 : 0;
      if (grew('dribble')) value += ['ドリブラー', 'カットイン'].includes(ability) ? 3 : 0;
      if (grew('pass') || season.assists) value += ability === 'チャンスメイカー' ? 3 : 0;
      const values = FIELD_STAT_KEYS.map(key => player.stats[key]);
      if (Math.max(...values) - Math.min(...values) <= 8) value += ability === '万能型' ? 2 : 0;
      if (grew('stamina')) value += ability === '回復力' ? 2 : 0;
    } else if (player.primaryPosition === 'FW') {
      if (grew('shoot') || season.goals) value += ['フィニッシャー', 'ミドルシューター', '勝負強さ', 'エース'].includes(ability) ? 3 : 0;
      if (grew('pass') || season.assists) value += ability === 'ポストプレーヤー' ? 3 : 0;
      if (grew('dribble')) value += ability === '個人技' ? 3 : 0;
      if (grew('stamina')) value += ability === '回復力' ? 2 : 0;
    }
    return value;
  };
  return weightedPick(choices, weight, rng);
}

export function trainingSkills(player) { return skills(player); }
export function createContractEvents(club, rng) {
  return club.roster.map(player => {
    if (player.contractYears <= 1) return null;
    const rank = rankOf(calculateOverall(player));
    const rule = CONTRACT_EVENTS[rank];
    if (!rule || rng.next() >= rule.rate) return null;
    return { playerId: player.id, cost: rng.int(rule.min, rule.max), rank, starter: club.lineup.includes(player.id) };
  }).filter(Boolean);
}
export function createSpecialTrainingOffers(club, rng) {
  return club.roster.map(player => {
    const rank = rankOf(calculateOverall(player));
    if (player.isInitial || !SPECIAL_TRAINING_COST[rank] || rng.next() >= .01) return null;
    return { playerId: player.id, cost: SPECIAL_TRAINING_COST[rank], rank };
  }).filter(Boolean);
}
function applySpecialTraining(player, rng) {
  const roll = rng.next();
  const result = roll < .10 ? { label: '才能が開花した！', steps: 3 } : roll < .50 ? { label: '才能の片鱗を見せた！', steps: 2 } : roll < .90 ? { label: '成長を遂げた！', steps: 1 } : { label: '何も変わらなかった…', steps: 0 };
  const before = Object.fromEntries(skills(player).map(key => [key, rankOf(player.stats[key])]));
  for (const key of skills(player)) if (result.steps) player.stats[key] = Math.max(player.stats[key], rankUpValue(player.stats[key], result.steps));
  return { ...result, before, after: Object.fromEntries(skills(player).map(key => [key, rankOf(player.stats[key])])) };
}
export function processOffseason(club, training, rng, specialTraining = new Set()) {
  const results = [];
  for (const player of [...club.roster]) {
    const before = Object.fromEntries(Object.entries(player.stats).map(([key, value]) => [key, rankOf(value)]));
    const gkBefore = player.stats.gk;
    const ageBefore = player.age;
    player.age++;
    const focus = training.get(player.id);
    const grew = [];
    for (const key of skills(player)) {
      const value = player.stats[key]; let delta = 0;
      if (player.age < 30) delta = Math.min(3, Math.round(ageBase(player.age) * growthFor(player, key) * appearanceModifier(player) * (focus === key ? 1.4 : 1) * highModifier(value) * (.75 + rng.next() * .5)));
      if (player.age === 29 && key === 'speed' && rng.next() < .3) delta = -1;
      if (player.age === 30) {
        if (key === 'speed') delta = -rng.int(1, 2);
        else if (key !== 'gk' && rng.next() < .2) delta = -1;
      }
      if (player.age >= 31 && player.age <= 32) {
        if (key === 'speed') delta = -rng.int(1, 2);
        else if (key === 'gk' ? rng.next() < .2 : rng.next() < .35) delta = -1;
      }
      if (player.age >= 33 && player.age <= 34) {
        if (key === 'speed') delta = -rng.int(2, 3);
        else if (key === 'gk' ? rng.next() < .4 : rng.next() < .5) delta = -1;
      }
      player.stats[key] = Math.max(50, Math.min(99, value + delta));
      if (player.stats[key] > value) grew.push(key);
    }
    // 32〜34歳のGKは、GK能力だけを毎年ちょうど1表示ランク下げる。
    if (player.primaryPosition === 'GK' && player.age >= 32 && player.age <= 34) {
      const nextRankCap = { SS: 90, S: 85, A: 80, B: 75, C: 70, D: 65, E: 60, F: 55, G: 50 };
      player.stats.gk = nextRankCap[rankOf(gkBefore)];
    }
    const awakeningRate = Math.min(.06, (.03 + (focus ? .02 : 0) + (player.season.appearances >= 7 ? .01 : 0)) * ((player.awakeningCount || 0) ? .25 : 1));
    const awakeningKeys = ageBefore >= 18 && ageBefore <= 23 && rng.next() < awakeningRate ? weightedDistinctSkills(player, rng) : [];
    for (const key of awakeningKeys) {
      const value = player.stats[key];
      player.stats[key] = Math.min(99, value + rng.int(3, 5));
      if (player.stats[key] > value && !grew.includes(key)) grew.push(key);
    }
    if (awakeningKeys.length) player.awakeningCount = (player.awakeningCount || 0) + 1;
    const abilityRate = Math.min(.05, .02 + (focus ? .01 : 0) + (awakeningKeys.length ? .02 : 0));
    const learnedAbility = player.specialAbility === null && rng.next() < abilityRate ? learnedAbilityFor(player, grew, rng) : null;
    if (learnedAbility) player.specialAbility = learnedAbility;
    const specialTrainingResult = specialTraining.has(player.id) ? applySpecialTraining(player, rng) : null;
    player.contractYears--;
    const changes = skills(player).filter(key => before[key] !== rankOf(player.stats[key]) || grew.includes(key)).map(key => ({ key, from: before[key], to: rankOf(player.stats[key]), increased: grew.includes(key), awakened: awakeningKeys.includes(key) }));
    results.push({ player, changes, retired: player.age >= 35, focus, awakeningKeys, learnedAbility, specialTrainingResult });
  }
  club.roster = club.roster.filter(p => p.age < 35);
  return results;
}

export function renewalFee(player) {
  const overall = calculateOverall(player);
  const rating = player.season.appearances ? player.season.ratingTotal / player.season.appearances : 6;
  return Math.max(1, Math.min(20, Math.round((overall - 50) / 2.5) + 1 + (rating >= 7.5 ? 2 : rating >= 7 ? 1 : rating < 6 ? -1 : 0) + (player.age >= 31 ? -2 : 0)));
}
