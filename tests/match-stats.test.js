import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague, simulateRemainingSeason } from '../js/league.js';
import { aggregateSeasonStats, blankMatchStats, renderMatchTeamStats, renderSeasonTeamStats } from '../js/match-stats.js';
import { escapeHtml } from '../js/ui.js';

test('recorded phases and shots agree with actual simulated play and survive saves', () => {
  const league = createLeague({ name: '統計テスト', color: '#fff', seed: 'team-stats' });
  simulateRemainingSeason(league);
  assert.equal(league.seasonResults.length, 10);
  for (const match of JSON.parse(JSON.stringify(league)).seasonResults) {
    const { teamStats, phases, events, playerResults } = match.result;
    assert.equal(teamStats.home.possessionPhases + teamStats.away.possessionPhases, phases);
    for (const side of ['home', 'away']) {
      const stats = teamStats[side];
      const teamId = match.fixture[`${side}Id`];
      assert.equal(stats.shots, playerResults.filter(row => row.teamId === teamId).reduce((sum, row) => sum + row.shots, 0));
      const misses = events.filter(event => event.kind === 'MISS' && event.side === side).length;
      assert.equal(stats.shotsOnTarget, stats.shots - misses);
      assert.equal(stats.dribbleSuccesses, playerResults.filter(row => row.teamId === teamId).reduce((sum, row) => sum + row.breakthroughs, 0));
      assert.ok(stats.passSuccesses <= stats.passAttempts);
      assert.ok(stats.dribbleSuccesses <= stats.dribbleAttempts);
      assert.ok(stats.shotsOnTarget <= stats.shots);
    }
  }
});

test('season rates use summed attempts, handle away matches and skip legacy data', () => {
  const a = { ...blankMatchStats(), possessionPhases: 60, passSuccesses: 1, passAttempts: 1, shots: 2, shotsOnTarget: 1 };
  const b = { ...blankMatchStats(), possessionPhases: 20, passSuccesses: 1, passAttempts: 9, shots: 4, shotsOnTarget: 3 };
  const other = { ...blankMatchStats(), possessionPhases: 20 };
  const matches = [
    { fixture: { homeId: 1, awayId: 2 }, result: { teamStats: { home: a, away: other } } },
    { fixture: { homeId: 2, awayId: 1 }, result: { teamStats: { home: { ...other, possessionPhases: 60 }, away: b } } },
    { fixture: { homeId: 1, awayId: 2 }, result: {} },
    { fixture: { homeId: 3, awayId: 4 }, result: { teamStats: { home: a, away: b } } }
  ];
  const total = aggregateSeasonStats(matches, 1);
  assert.equal(total.recordedMatches, 2);
  assert.equal(total.possessionPercent, 50);
  assert.equal(total.shots, 6);
  assert.equal(total.shotsOnTarget, 4);
  assert.match(renderSeasonTeamStats(matches, 1), /20% <small>\(2\/10\)/);
  assert.match(renderSeasonTeamStats([], 1), /未記録/);
  const legacy = { fixture: { home: { name: '<自分>' }, away: { name: '相手' } }, result: {} };
  assert.match(renderMatchTeamStats(legacy, escapeHtml), /&lt;自分&gt;/);
  assert.match(renderMatchTeamStats(legacy, escapeHtml), /未記録/);
});
