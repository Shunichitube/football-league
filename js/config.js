export const CONFIG = Object.freeze({
  phaseCount: 80,
  phaseSeconds: 30,
  gkBaseAdvantage: 15,
  attackLuck: 10,
  shotLuck: 12,
  ranks: [[91, 'SS'], [86, 'S'], [81, 'A'], [76, 'B'], [71, 'C'], [66, 'D'], [61, 'E'], [56, 'F'], [50, 'G']],
  chanceBonus: { hard: -10, normal: 0, clear: 10, big: 20 }
});

export function rankOf(value) {
  return CONFIG.ranks.find(([min]) => value >= min)?.[1] ?? 'G';
}
