export const CONFIG = Object.freeze({
  phaseCount: 80,
  phaseSeconds: 30,
  gkBaseAdvantage: 15,
  attackLuck: 10,
  shotLuck: 12,
  ranks: [[91, 'SS'], [86, 'S'], [81, 'A'], [76, 'B'], [71, 'C'], [66, 'D'], [61, 'E'], [56, 'F'], [50, 'G']],
  chanceBonus: { hard: -10, normal: 0, clear: 10, big: 20 },
  positionShotWeight: { FW: 1.3, MF: 1, DF: 0.65 },
  tactics: { BALANCED: { PASS: 40, DRIBBLE: 30, COUNTER: 30, bonus: 1.03 }, POSSESSION: { PASS: 60, DRIBBLE: 20, COUNTER: 20, bonus: 1.08 }, DRIBBLE: { PASS: 25, DRIBBLE: 55, COUNTER: 20, bonus: 1.08 }, COUNTER: { PASS: 25, DRIBBLE: 20, COUNTER: 55, bonus: 1.08 } }
});

export function rankOf(value) {
  return CONFIG.ranks.find(([min]) => value >= min)?.[1] ?? 'G';
}
