import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from '../js/random.js';
import { calculateOverall, createClub, createPlayer, displayPlayer, FIRST_NAMES, LAST_NAMES } from '../js/data.js';
import { simulateMatch } from '../js/sim.js';
import { applySeasonFinances, clubsForController, createLeague, createSchedule, playCurrentRound, simulateRemainingSeason, standings, startNextSeason } from '../js/league.js';
import { cpuBid, createAuctionPool, createDraftPool, createScoutComment, resolveAuctionActions, resolveDraftActions, SPECIAL_ABILITIES, SPECIAL_ABILITY_DESCRIPTIONS } from '../js/market.js';
import { processOffseason, renewalFee, trainingSkills } from '../js/development.js';
import { exportSave, importSave } from '../js/storage.js';
import { matchOutcomeForClub, positionCounts, renderLineupEditor, renderMatchDetail, renderPlayerCard, renderRosterPanel, renderSeasonMatchList, renderSeasonPlayerStats } from '../js/ui.js';
import { autoSetCpuTactic, decideCpuAuctionAction, decideCpuDraftAction, manageCpuContracts, prepareCpuClubs, prepareCpuMarketSpace, processLeagueOffseason, selectBestLineup, selectCpuTraining } from '../js/cpu.js';
import { ACTION_TYPES, applyClubAction, createLineupPlacement, LINEUP_SLOTS, positionSuitability, validateLineup } from '../js/rules.js';

function match(seed) {
  const source = createRandom(seed);
  const home = createClub({ id: 1, name: 'HOME', color: '#fff', seed: source });
  const away = createClub({ id: 2, name: 'AWAY', color: '#000', seed: source });
  return simulateMatch(home, away, createRandom(`${seed}:match:1`));
}

function draftActions(league, pending, pool, rng, humanPickId = pool[0]?.id) {
  return pending
    .map(id => league.clubs.find(club => club.id === id))
    .map(club => club.controllerType === 'CPU'
      ? decideCpuDraftAction(club, pool, rng)
      : { type: ACTION_TYPES.DRAFT_PICK, clubId: club.id, playerId: humanPickId })
    .filter(Boolean);
}

test('同じseedは同じ試合結果になる', () => {
  assert.deepEqual(match('repeatable'), match('repeatable'));
});
