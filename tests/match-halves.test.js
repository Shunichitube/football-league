import test from 'node:test';
import assert from 'node:assert/strict';
import { createClub, createPlayer } from '../js/data.js';
import { createRandom } from '../js/random.js';
import { simulateMatch } from '../js/sim.js';
import { formatMatchEvents } from '../js/match-log.js';
import { renderMatchDetail } from '../js/ui.js';
import { createLeague, simulateRemainingSeason } from '../js/league.js';
import { exportSave, importSave } from '../js/storage.js';

function makeClub(id, bench = false) {
  const club = createClub({ id, name: `クラブ${id}`, color: '#fff', seed: createRandom(`bench${id}`) });
  for (const player of club.roster) {
    Object.assign(player.stats, { shoot: 70, pass: 70, speed: 70, defense: 70, dribble: 70, gk: 70, stamina: 50 });
    player.specialAbility = null;
  }
  if (bench) for (const role of ['DF', 'MF', 'MF', 'FW']) {
    const player = createPlayer(`bench${id}${club.roster.length}`, role, createRandom(`bench${id}${club.roster.length}`));
    Object.assign(player.stats, { shoot: 90, pass: 90, speed: 90, defense: 90, dribble: 90, stamina: 50 });
    player.specialAbility = null;
    club.roster.push(player);
  }
  return club;
}

// Script an uninterrupted series of saved shots and recovered rebounds.
// Zero recovery rolls retain possession; a large save margin ends it on demand.
function reboundMatch(stopAt = null) {
  const home = makeClub(1), away = makeClub(2);
  for (const player of [...home.roster, ...away.roster]) Object.assign(player.stats, { shoot: 50, stamina: 99 });
  let nextCalls = 0, attackCalls = 0, shotCalls = 0, phase = 0;
  const firstHalfLength = stopAt || 44;
  const rng = {
    next: () => nextCalls++ < 10 ? .5 : 0,
    int: (min, max) => {
      if (max === 10) {
        if (attackCalls++ % 2 === 0) { phase++; return 100; }
        return -100;
      }
      if (shotCalls++ % 2 === 0) return 0;
      const localPhase = phase <= firstHalfLength ? phase : phase - firstHalfLength;
      const active = localPhase - 1;
      const fatigue = active < 20 ? 1 : active < 30 ? .9 : active < 40 ? .8 : .7;
      return 50 * fatigue + 20 - 85 + (localPhase === stopAt ? 20 : 2);
    }
  };
  return simulateMatch(home, away, rng);
}

test('rebounds continue through added time, capped at four phases per half', () => {
  const result = reboundMatch();
  assert.equal(result.phases, 88);
  assert.deepEqual(result.halves.map(half => half.addedPhases), [4, 4]);
  for (const half of [1, 2]) {
    const extra = result.events.filter(event => event.half === half && event.halfPhase > 40 && event.kind === 'REBOUND');
    assert.equal(extra.length, 4);
    assert.ok(extra.every(event => event.display.rebound === 'attack'));
    assert.equal(extra.at(-1).time, `${half * 20}:00+02:00`);
  }
  assert.ok(result.playerResults.every(row => row.playedPhases === 88));
  assert.equal(result.teamStats.home.possessionPhases + result.teamStats.away.possessionPhases, 88);
  const rows = formatMatchEvents(result.events, { home: { name: 'H' }, away: { name: 'A' } });
  assert.equal(rows.filter(row => row.text.startsWith('試合終了')).length, 1);
  assert.equal(rows.at(-1).time, '40:00+02:00');
});

test('a cleared attack ends added time without starting an opposing possession', () => {
  const result = reboundMatch(42);
  assert.equal(result.phases, 84);
  assert.deepEqual(result.halves.map(half => half.addedPhases), [2, 2]);
  for (const half of [1, 2]) {
    const end = result.events.filter(event => event.half === half);
    assert.equal(end.at(-2).kind, 'GK CATCH');
    assert.equal(end.at(-1).kind, half === 1 ? 'HALF TIME' : 'FULL TIME');
    assert.equal(end.at(-1).halfPhase, 42);
  }
});

test('halftime restores starters and fatigue; substitution logs reconcile playing time', () => {
  const home = makeClub(1, true), away = makeClub(2, true);
  const before = JSON.stringify([home, away]);
  const result = simulateMatch(home, away, createRandom('subs'));
  assert.equal(JSON.stringify([home, away]), before);
  assert.deepEqual(result, simulateMatch(home, away, createRandom('subs')));
  const halftime = result.events.find(event => event.kind === 'HALF TIME');
  assert.ok(halftime);
  const changes = result.events.filter(event => event.kind === 'SUBSTITUTION');
  assert.ok(changes.some(event => event.phase === halftime.phase));
  const secondHalfChanges = changes.filter(event => event.half === 2);
  assert.ok(secondHalfChanges.length);
  assert.ok(secondHalfChanges.every(event => event.halfPhase >= 12));
  for (const club of [home, away]) {
    const starts = new Map(club.lineup.map(id => [id, 0]));
    const minutes = new Map();
    const add = (id, phases) => minutes.set(id, (minutes.get(id) || 0) + phases);
    for (const change of changes.filter(event => event.side === (club === home ? 'home' : 'away'))) {
      const { outgoingId, incomingId } = change.display;
      assert.ok(starts.has(outgoingId));
      assert.ok(!starts.has(incomingId));
      add(outgoingId, change.phase - starts.get(outgoingId));
      starts.delete(outgoingId);
      starts.set(incomingId, change.phase);
    }
    for (const [id, start] of starts) add(id, result.phases - start);
    const rows = result.playerResults.filter(row => row.teamId === club.id);
    assert.equal(rows.reduce((sum, row) => sum + row.playedPhases, 0), result.phases * 5);
    for (const row of rows) assert.equal(row.playedPhases, minutes.get(row.player.id));
  }
  const formatted = formatMatchEvents(result.events, { home, away }, name => `表示:${name}`);
  assert.ok(formatted.some(row => row.text.includes('OUT → 表示:')));
  const html = renderMatchDetail({ round: 1, fixture: { homeId: 1, awayId: 2, home, away }, result });
  const keeperTime = `${Math.floor(result.phases / 2)}分${result.phases % 2 ? '30秒' : ''}`;
  assert.ok(html.includes(`出場時間 ${keeperTime}`));
  const legacy = structuredClone(result);
  delete legacy.phaseSeconds;
  delete legacy.playerResults[0].playedPhases;
  assert.match(renderMatchDetail({ round: 1, fixture: { homeId: 1, awayId: 2, home, away }, result: legacy }), /出場時間 未記録/);
});

test('saved season matches retain halves, added time and actual playing time', () => {
  const league = createLeague({ name: '保存', color: '#fff', seed: 'halves-save' });
  simulateRemainingSeason(league);
  const saved = importSave(exportSave({ league })).league;
  for (const match of saved.seasonResults) {
    assert.equal(match.result.phaseSeconds, 30);
    assert.equal(match.result.halves.length, 2);
    assert.equal(match.result.phases, match.result.halves.reduce((sum, half) => sum + half.phases, 0));
    assert.ok(match.result.halves.every(half => half.phases >= 40 && half.phases <= 44));
  }
});
