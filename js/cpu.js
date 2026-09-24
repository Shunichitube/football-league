import { calculateOverall } from './data.js?v=0.16.2';
import { processOffseason, renewalFee } from './development.js?v=0.16.2';
import { createRandom } from './random.js';
import { cpuBid, cpuCandidatePick } from './market.js?v=0.16.2';
import { ACTION_TYPES, applyClubAction, positionSuitability } from './rules.js?v=0.16.2';

const LINEUP_ROLES = ['FIXO', 'ALA', 'ALA', 'PIVO'];
const REQUIRED = { GK: 1, FIXO: 1, ALA: 2, PIVO: 1 };
const FOCUS_KEYS = {
  GK: ['gk'],
  FIXO: ['defense', 'pass', 'speed', 'stamina'],
  ALA: ['speed', 'dribble', 'pass', 'shoot', 'stamina'],
  PIVO: ['shoot', 'dribble', 'pass', 'stamina']
};
const TACTIC_ABILITIES = {
  POSSESSION: ['チャンスメイカー', 'ビルドアップ', 'ポストプレーヤー'],
  DRIBBLE: ['ドリブラー', '個人技', 'カットイン'],
  COUNTER: ['スピードスター', 'カウンター起点', 'ハードワーカー']
};

function bestFieldAssignment(players) {
  let best = null;
  function assign(roleIndex, available, chosen, score) {
    if (roleIndex === LINEUP_ROLES.length) {
      if (!best || score > best.score) best = { players: [...chosen], score };
      return;
    }
    const role = LINEUP_ROLES[roleIndex];
    for (const player of available) {
      const fit = positionSuitability(player, role);
      if (!fit) continue;
      assign(roleIndex + 1, available.filter(candidate => candidate.id !== player.id), [...chosen, player], score + calculateOverall(player) * fit);
    }
  }
  assign(0, players, [], 0);
  return best?.players || [];
}

export function chooseBestLineup(club) {
  const keeper = club.roster.filter(player => player.primaryPosition === 'GK').sort((a, b) => calculateOverall(b) - calculateOverall(a))[0];
  const field = bestFieldAssignment(club.roster.filter(player => player.primaryPosition !== 'GK'));
  if (!keeper || field.length < 4) return club.lineup.filter(id => club.roster.some(player => player.id === id)).slice(0, 5);
  return [keeper.id, ...field.map(player => player.id)];
}

export function selectBestLineup(club) {
  const lineup = chooseBestLineup(club);
  applyClubAction(club, { type: ACTION_TYPES.SET_LINEUP, clubId: club.id, lineup });
  return club.lineup;
}

export function chooseCpuTactic(club) {
  const starters = club.lineup.slice(1).map(id => club.roster.find(player => player.id === id)).filter(Boolean);
  if (!starters.length) return club.tactic;
  const average = key => starters.reduce((sum, player) => sum + player.stats[key], 0) / starters.length;
  const abilityBonus = tactic => starters.filter(player => TACTIC_ABILITIES[tactic].includes(player.specialAbility)).length * 1.5;
  const scores = {
    POSSESSION: average('pass') + abilityBonus('POSSESSION'),
    DRIBBLE: average('dribble') + abilityBonus('DRIBBLE'),
    COUNTER: average('speed') + abilityBonus('COUNTER')
  };
  const values = Object.values(scores);
  return Math.max(...values) - Math.min(...values) < 2 ? 'BALANCED' : Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

export function autoSetCpuTactic(club) {
  const tactic = chooseCpuTactic(club);
  applyClubAction(club, { type: ACTION_TYPES.SET_TACTIC, clubId: club.id, tactic });
  return club.tactic;
}

export function decideCpuDraftAction(club, candidates, rng) { const player=cpuCandidatePick(club,candidates,rng); return player ? { type:ACTION_TYPES.DRAFT_PICK,clubId:club.id,playerId:player.id } : null; }
export function decideCpuAuctionAction(club, player, rng) { return { type:ACTION_TYPES.AUCTION_BID,clubId:club.id,playerId:player.id,bid:cpuBid(club,player,rng) }; }

function publicDevelopmentScore(player, club) {
  const overall = calculateOverall(player);
  const isStarter = club.lineup.includes(player.id);
  return Math.max(0, 31 - player.age) * 2 + Math.max(0, 85 - overall) * .35 + (isStarter ? 8 : 0) + Math.min(10, player.season.appearances) * .4;
}

function trainingFocus(player) {
  return [...FOCUS_KEYS[player.primaryPosition]].sort((a, b) => player.stats[a] - player.stats[b])[0];
}

export function selectCpuTraining(club) {
  const selected = [...club.roster].sort((a, b) => publicDevelopmentScore(b, club) - publicDevelopmentScore(a, club) || calculateOverall(b) - calculateOverall(a)).slice(0, 2);
  return new Map(selected.map(player => [player.id, trainingFocus(player)]));
}

export function decideCpuContractActions(club) {
  const actions = [];
  const shadow = { ...club, roster: [...club.roster], lineup: [...club.lineup] };
  const due = shadow.roster.filter(player => player.contractYears <= 0).sort((a, b) => calculateOverall(b) - calculateOverall(a));
  for (const player of due) {
    const remaining = shadow.roster.filter(candidate => candidate.id !== player.id);
    const mustKeep = remaining.length < 5 || (player.primaryPosition === 'GK' && !remaining.some(candidate => candidate.primaryPosition === 'GK'));
    const samePosition = shadow.roster.filter(candidate => candidate.primaryPosition === player.primaryPosition).length;
    const positionExcess = samePosition > REQUIRED[player.primaryPosition];
    const teamAverage = shadow.roster.reduce((sum, candidate) => sum + calculateOverall(candidate), 0) / shadow.roster.length;
    const overall = calculateOverall(player);
    const fee = renewalFee(player);
    const important = shadow.lineup.includes(player.id) || player.season.appearances >= 5;
    const releaseForAge = player.age >= 33 && positionExcess && !important;
    const releaseForLevel = overall < teamAverage - 5 && positionExcess && !important;
    const canAfford = shadow.funds >= fee;
    const renew = mustKeep || (canAfford && !releaseForAge && !releaseForLevel);
    if (renew) {
      actions.push({ type:ACTION_TYPES.RENEW_CONTRACT,clubId:club.id,playerId:player.id,protectMinimum:mustKeep });
      shadow.funds=Math.max(0,shadow.funds-fee);
    } else {
      actions.push({ type:ACTION_TYPES.RELEASE_PLAYER,clubId:club.id,playerId:player.id,contractDecision:true });
      shadow.roster=remaining;
    }
  }
  return actions;
}

export function manageCpuContracts(club, league = null) {
  const decisions = [];
  for (const action of decideCpuContractActions(club)) {
    const result=applyClubAction(club,action,league);
    if(result.ok) decisions.push({player:result.player,action:action.type===ACTION_TYPES.RENEW_CONTRACT?'RENEW':'RELEASE',fee:result.fee||0});
  }
  return decisions;
}

export function prepareCpuClubs(league) {
  const cpuClubs = league.clubs.filter(club => club.controllerType === 'CPU');
  for (const club of cpuClubs) {
    selectBestLineup(club);
    autoSetCpuTactic(club);
  }
  return cpuClubs.map(club => ({ clubId: club.id, lineup: [...club.lineup], tactic: club.tactic }));
}

export function prepareCpuMarketSpace(league) {
  const released = [];
  for (const club of league.clubs.filter(candidate => candidate.controllerType === 'CPU')) {
    for (let releasedCount = 0; releasedCount < 3 && club.roster.length > 5;) {
      const average = club.roster.reduce((sum, player) => sum + calculateOverall(player), 0) / club.roster.length;
      const candidates = club.roster.filter(player => player.primaryPosition !== 'GK' || club.roster.filter(candidate => candidate.primaryPosition === 'GK').length > 1);
      const scored = candidates.map(player => {
        const positionPlayers = club.roster.filter(candidate => candidate.primaryPosition === player.primaryPosition);
        const positionRank = [...positionPlayers].sort((a,b) => calculateOverall(b) - calculateOverall(a)).findIndex(candidate => candidate.id === player.id);
        const weak = average - calculateOverall(player);
        const bench = club.lineup.includes(player.id) ? 0 : 3;
        const age = player.age >= 33 ? 4 : player.age >= 30 ? 2 : 0;
        const youngProtection = player.age <= 23 ? -6 : 0;
        const special = player.specialAbility ? -1 : 0;
        const excess = positionPlayers.length > REQUIRED[player.primaryPosition] ? 3 : 0;
        const shortage = positionPlayers.length < REQUIRED[player.primaryPosition] ? -4 : 0;
        return { player, score: weak + (positionRank > 0 ? 3 : 0) + bench + age + youngProtection + special + excess + shortage };
      }).sort((a,b) => b.score - a.score || a.player.age - b.player.age);
      const target = scored[0];
      const openSlots = 12 - club.roster.length;
      const threshold = openSlots >= 3 ? 9 : openSlots === 2 ? 8 : 7;
      if (!target || target.score < threshold) break;
      const result = applyClubAction(club, { type: ACTION_TYPES.RELEASE_PLAYER, clubId: club.id, playerId: target.player.id }, league);
      if (!result.ok) break;
      released.push({ clubId: club.id, player: result.player });
      releasedCount++;
    }
    selectBestLineup(club);
  }
  return released;
}

export function processLeagueOffseason(league, humanTraining = new Map()) {
  const summaries = [];
  const humanClubs=league.clubs.filter(club=>club.controllerType==='HUMAN');
  for (const club of league.clubs) {
    const isCpu = club.controllerType === 'CPU';
    const mappedTraining=humanTraining.get?.(club.id);
    const training = isCpu ? selectCpuTraining(club) : mappedTraining instanceof Map ? mappedTraining : club.id===humanClubs[0]?.id ? humanTraining : new Map();
    const growth = processOffseason(club, training, createRandom(`${league.seed}:offseason:${league.season}:club:${club.id}`));
    const contracts = isCpu ? manageCpuContracts(club, league) : [];
    selectBestLineup(club);
    if (isCpu) autoSetCpuTactic(club);
    summaries.push({ clubId: club.id, training: [...training.entries()], growth, contracts, lineup: [...club.lineup], tactic: club.tactic });
  }
  return summaries;
}
