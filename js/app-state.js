export function createInitialState() {
  return {
    view: 'title', league: null, draft: null, auction: null, match: null,
    round: 0, note: '', rosterOpen: false, selectedLineupPlayerId: null,
    comparisonSourcePlayerId: null, selectedDraftPlayerId: null,
    lineupMessage: '', lineupError: false, seasonSimulation: null,
    benchSort: 'position', rosterSort: 'position', draftSort: 'position',
    draftHistoryOpen: false, auctionHistoryOpen: false,
    developmentSort: 'position', releaseSort: 'position'
  };
}
