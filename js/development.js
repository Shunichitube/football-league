import { rankOf } from './config.js';

const KEYS = ['shoot', 'speed', 'defense', 'dribble', 'pass'];
const ageBase = age => age <= 19 ? 2.4 : age <= 21 ? 2 : age <= 23 ? 1.6 : age <= 25 ? 1 : age <= 28 ? .4 : 0;
const highModifier = value => value <= 75 ? 1 : value <= 80 ? .8 : value <= 85 ? .65 : value <= 90 ? .45 : .25;
const appearanceModifier = player => player.season.appearances >= 7 ? 1 : player.season.appearances >= 3 ? .85 : .7;
const skills = player => player.primaryPosition === 'GK' ? [...KEYS, 'gk'] : KEYS;

export function trainingSkills(player) { return skills(player); }
export function processOffseason(club, training, rng) {
  const results = [];
  for (const player of [...club.roster]) {
    const before = Object.fromEntries(Object.entries(player.stats).map(([key, value]) => [key, rankOf(value)]));
    player.age++;
    const focus = training.get(player.id);
    for (const key of skills(player)) {
      const value = player.stats[key]; let delta = 0;
      if (player.age < 30) delta = Math.min(3, Math.round(ageBase(player.age) * player.hiddenGrowth * appearanceModifier(player) * (focus === key ? 1.4 : 1) * highModifier(value) * (.75 + rng.next() * .5)));
      if (player.age === 29 && key === 'speed' && rng.next() < .3) delta = -1;
      if (player.age === 30 && key === 'speed') delta = -rng.int(1, 2);
      if (player.age >= 30 && key !== 'speed' && rng.next() < (player.age <= 30 ? .2 : player.age <= 32 ? .35 : .5)) delta = -1;
      player.stats[key] = Math.max(50, Math.min(99, value + delta));
    }
    player.contractYears--;
    const changes = skills(player).filter(key => before[key] !== rankOf(player.stats[key])).map(key => ({ key, from: before[key], to: rankOf(player.stats[key]) }));
    results.push({ player, changes, retired: player.age >= 35, focus });
  }
  club.roster = club.roster.filter(p => p.age < 35);
  return results;
}

export function renewalFee(player) {
  const values = Object.values(player.stats); const overall = player.primaryPosition === 'GK' ? player.stats.gk : values.slice(0, 5).reduce((a,b) => a+b,0) / 5;
  const rating = player.season.appearances ? player.season.ratingTotal / player.season.appearances : 6;
  return Math.max(1, Math.min(20, Math.round((overall - 50) / 2.5) + 1 + (rating >= 7.5 ? 2 : rating >= 7 ? 1 : rating < 6 ? -1 : 0) + (player.age >= 31 ? -2 : 0)));
}
