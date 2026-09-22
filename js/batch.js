import { createLeague, playCurrentRound, standings } from './league.js';

export function runBatch(count = 100) {
  const summary = { leagues: count, goals: 0, matches: 0, champions: new Map(), draws: 0 };
  for (let i = 0; i < count; i++) {
    const league = createLeague({ name: 'CPU A', color: '#fff', seed: `batch:${i}` });
    while (!league.completed) { const round = playCurrentRound(league); for (const match of round.results) { summary.matches++; summary.goals += match.result.score.home + match.result.score.away; if (match.result.score.home === match.result.score.away) summary.draws++; } }
    const winner = standings(league)[0].club.name; summary.champions.set(winner, (summary.champions.get(winner) || 0) + 1);
  }
  return { ...summary, averageGoals: summary.goals / summary.matches, drawRate: summary.draws / summary.matches, championCounts: Object.fromEntries(summary.champions) };
}
