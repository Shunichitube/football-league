// Legacy saves without a mode retain the normal ten-season rules.
export const seasonMode = source => source?.seasonMode === 'SHORT' ? 'SHORT' : 'NORMAL';
export const seasonLimit = source => seasonMode(source) === 'SHORT' ? 5 : 10;
export const yearsPerSeason = source => seasonMode(source) === 'SHORT' ? 2 : 1;
export const contractSeasons = source => seasonMode(source) === 'SHORT' ? 2 : 3;
export function setClubSeasonMode(club, mode, reset = false) {
  club.seasonMode = mode;
  for (const player of club.roster) {
    player.contractYearSpan = yearsPerSeason(club);
    if (reset) player.contractYears = contractSeasons(club);
  }
}
export const displayedContractYears = player => player.contractYears * (player.contractYearSpan || 1);
