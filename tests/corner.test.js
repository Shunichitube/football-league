import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateMatch } from '../js/sim.js';
import { LINEUP_SLOTS } from '../js/rules.js';

// Equal skills and zero luck isolate the first shot and its restart.
function scenario({ shoot = 89, outcome = 0, corner = 0, tactic = 'BALANCED', firstShotLuck = 0 } = {}) {
  const club = id => {
    const roster = LINEUP_SLOTS.map((position, i) => ({
      id: `${id}-${i}`, name: `${id}-${i}`, primaryPosition: position,
      stats: { shoot, speed: 70, defense: 70, dribble: 70, pass: 70, gk: 70, stamina: 99 }
    }));
    return { id, tactic, roster, lineup: roster.map(p => p.id) };
  };
  const home = club('home'), away = club('away');
  away.tactic = 'BALANCED';
  let calls = 0, luckCalls = 0;
  const rolls = [...Array(10).fill(.5), ...Array(11).fill(0), outcome, corner];
  const result = simulateMatch(home, away, { next: () => rolls[calls++] ?? .99, int: () => ++luckCalls === 5 ? firstShotLuck : 0 });
  return result;
}

test('SAVE corner threshold is 20%; MISS and GK CATCH do not award corners', () => {
  for (const [roll, expected] of [[.199999, true], [.20, false]]) {
    const events = scenario({ corner: roll }).events;
    assert.equal(events[1].kind, 'SAVE');
    assert.equal(events[2].kind === 'CORNER', expected);
    assert.equal(events[2].side, expected ? 'home' : 'away');
    assert.equal(events[2].time, expected ? '01:00' : '01:30');
  }
  assert.equal(scenario({ outcome: .55 }).events[1].kind, 'MISS');
  assert.equal(scenario({ outcome: .55 }).events[2].side, 'away');
  assert.equal(scenario({ shoot: 80 }).events[1].kind, 'GK CATCH');
  assert.equal(scenario({ shoot: 80 }).events[2].side, 'away');
});

test('REBOUND preserves recovery priority and applies 15% only after failed recovery', () => {
  const recovered = scenario({ shoot: 93, outcome: .079999 }).events;
  assert.equal(recovered[1].kind, 'REBOUND');
  assert.match(recovered[1].extra, /attack recovers/);
  assert.notEqual(recovered[2].kind, 'CORNER');
  for (const [roll, expected] of [[.149999, true], [.15, false]]) {
    const events = scenario({ shoot: 93, outcome: .08, corner: roll }).events;
    assert.equal(events[1].kind, 'REBOUND');
    assert.match(events[1].extra, /cleared/);
    assert.equal(events[2].kind === 'CORNER', expected);
    assert.equal(events[2].side, expected ? 'home' : 'away');
  }
});

test('corner skips stage one and keeps PASS tactics and fixed +2', () => {
  // PASS offense is 72.7; BALANCED +2 and corner +2 give diff 6.7 (HARD).
  // POSSESSION +4 and corner +2 give diff 8.7 (NORMAL); without +2 it is HARD.
  for (const [tactic, chance] of [['BALANCED', 'HARD'], ['POSSESSION', 'NORMAL']]) {
    const events = scenario({ shoot: 97, tactic, firstShotLuck: -8 }).events;
    assert.equal(events[1].kind, 'SAVE');
    assert.equal(events[2].kind, 'CORNER');
    assert.equal(events[3].kind, 'GOAL');
    assert.equal(events[3].time, '01:30');
    assert.equal(events[3].side, 'home');
    assert.match(events[3].extra, new RegExp(`^PASS / ${chance} /`));
  }
});
