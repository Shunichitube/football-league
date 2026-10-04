import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOverall, displayPlayer } from '../js/data.js';
import { chooseBestLineup } from '../js/cpu.js';
import { positionSuitability } from '../js/rules.js';
import { simulateMatch } from '../js/sim.js';
import { createRandom } from '../js/random.js';

const player = (id, position, stats = {}) => ({
  id, name: id, primaryPosition: position, specialAbility: null,
  stats: { shoot: 99, speed: 99, defense: 99, dribble: 99, pass: 99, gk: 99, stamina: 99, ...stats }
});
const attackingMf = () => player('attacking-mf', 'MF', { shoot: 99, dribble: 99, speed: 80, pass: 80, defense: 50 });
const defendingMf = () => player('defending-mf', 'MF', { shoot: 50, dribble: 50, speed: 80, pass: 80, defense: 99 });
const club = (id, formation = '121') => {
  const slots = { '121': ['GK', 'DF', 'MF', 'MF', 'FW'], '211': ['GK', 'DF', 'DF', 'MF', 'FW'], '112': ['GK', 'DF', 'MF', 'FW', 'FW'] }[formation];
  const roster = slots.map((position, i) => player(`${id}-${i}`, position));
  return { id, name: id, formation, tactic: 'BALANCED', roster, lineup: roster.map(p => p.id), controllerType: 'HUMAN' };
};

test('slot evaluation changes the ranking of MF candidates without changing their native displayed overall', () => {
  const attack = attackingMf(), defense = defendingMf();
  const before = structuredClone([attack, defense]);
  assert.equal(calculateOverall(attack), 86);
  assert.equal(calculateOverall(defense), 68);
  assert.equal(calculateOverall(attack, 'DF'), 73);
  assert.equal(calculateOverall(defense, 'DF'), 81);
  assert.ok(calculateOverall(defense, 'DF') * positionSuitability(defense, 'DF') > calculateOverall(attack, 'DF') * positionSuitability(attack, 'DF'));
  assert.equal(displayPlayer(attack).overallRank, 'S');
  assert.equal(displayPlayer(defense).overallRank, 'D');
  assert.deepEqual([attack, defense], before);
});

test('automatic lineup puts a defensive MF into a vacant DF slot ahead of a higher-native-overall attacking MF', () => {
  const ours = club('ours');
  for (const p of ours.roster.filter(p => p.primaryPosition === 'MF')) p.stats.defense = 50;
  ours.roster = ours.roster.filter(p => p.primaryPosition !== 'DF').concat(attackingMf(), defendingMf());
  const before = structuredClone(ours);
  assert.equal(chooseBestLineup(ours)[1], 'defending-mf');
  assert.deepEqual(ours, before);
});

test('automatic lineup evaluates both DF slots and both FW slots by their assigned position', () => {
  const defensive = club('defensive', '211');
  defensive.roster = defensive.roster.filter(p => p.primaryPosition !== 'DF').concat(attackingMf(), defendingMf());
  const dfIds = chooseBestLineup(defensive).slice(1, 3);
  assert.ok(dfIds.includes('defending-mf'));
  const attacking = club('attacking', '112');
  attacking.roster = attacking.roster.filter(p => p.primaryPosition !== 'FW').concat(attackingMf(), defendingMf());
  const fwIds = chooseBestLineup(attacking).slice(3);
  assert.ok(fwIds.includes('attacking-mf'));
});

test('fatigued DF substitution uses defensive slot strength rather than native MF overall', () => {
  const home = club('home'), away = club('away');
  home.roster[1].stats.stamina = 50;
  // Only this DF needs an early replacement; other starters outlast both reserves.
  home.roster.push(attackingMf(), defendingMf());
  const result = simulateMatch(home, away, createRandom('slot-substitution'));
  const played = Object.fromEntries(result.playerResults.map(r => [r.player.id, r.playedPhases]));
  assert.ok((played['defending-mf'] || 0) > (played['attacking-mf'] || 0));
});
