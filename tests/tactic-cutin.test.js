import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMatch } from '../js/sim.js';
import { LINEUP_SLOTS } from '../js/rules.js';
import { exportSave, importSave } from '../js/storage.js';

function club(id, tactic = 'DRIBBLE') {
  const roster = LINEUP_SLOTS.map((position, i) => ({
    id: `${id}-${i}`, name: `${id}-${i}`, primaryPosition: position,
    stats: { shoot: 90, speed: 70, defense: 70, dribble: 70, pass: 70, gk: 70, stamina: 99 }
  }));
  return { id, tactic, roster, lineup: roster.map(player => player.id) };
}

// Neutral form and zero luck isolate a carried MF's HARD dribble shot.
function rng() {
  let calls = 0;
  return { next: () => calls++ < 10 ? .5 : .21, int: () => 0 };
}
const firstShot = result => result.events.find(event => event.display?.shooter);

test('cut-in rewards the same MF across attack phases and after save restoration', () => {
  const home = club('home'), away = club('away');
  const before = firstShot(simulateMatch(home, away, rng()));
  assert.equal(before.kind, 'SAVE');
  assert.equal(before.display.shooter, 'home-2');
  home.roster[2].specialAbility = 'カットイン';
  const existingResult = { score: { home: 2, away: 1 }, events: [{ kind: 'GOAL' }] };
  const state = { league: { clubs: [home, away], seasonResults: [existingResult] } };
  const restored = importSave(exportSave(state));
  assert.deepEqual(restored, state);
  const [loadedHome, loadedAway] = restored.league.clubs;
  const original = simulateMatch(home, away, rng());
  const replay = simulateMatch(loadedHome, loadedAway, rng());
  assert.deepEqual(replay, original);
  const shot = firstShot(replay);
  assert.equal(shot.kind, 'GOAL');
  assert.equal(shot.display.type, 'DRIBBLE');
  assert.equal(shot.display.dribbler, shot.display.shooter);
  assert.equal(shot.display.shooter, 'home-2');
  assert.deepEqual(restored.league.seasonResults, [existingResult]);
});

test('counter defense no longer blocks a shot that balanced defense permits', () => {
  const home = club('home');
  const balanced = firstShot(simulateMatch(home, club('away', 'BALANCED'), rng()));
  const counter = firstShot(simulateMatch(home, club('away', 'COUNTER'), rng()));
  assert.equal(balanced.time, '01:00');
  assert.deepEqual(counter, balanced);
});
