// Room owns the phase and private inputs. All game rules come from main's modules.
import { createLeague, standings, simulateRemainingSeason, finalizeSeason, applySeasonFinances, startNextSeason } from '../js/league.js?v=0.17.27';
import { createDraftPool, createAuctionPool, resolveDraftActions, resolveAuctionActions } from '../js/market.js?v=0.17.31';
import { decideCpuDraftAction, decideCpuAuctionAction, prepareCpuClubs, manageCpuContracts, prepareCpuMarketSpace, processLeagueOffseason, selectBestLineup } from '../js/cpu.js?v=0.17.30';
import { createContractEvents, createSpecialTrainingOffers } from '../js/development.js?v=0.17.30';
import { ACTION_TYPES } from '../js/rules.js?v=0.17.2';
import { createRandom } from '../js/random.js';
import { clone, requireValue, applyWork, validateSetup, validateTraining } from '../js/phase-work.js';


export function enterPhase(room, phase) {
  room.phase = phase;
  room.phaseRevision++;
  room.inputs = {};
}
function humanIds(room) { return room.players.map(player => player.clubId); }
function pendingIds(room) { return room.phase === 'draft' ? room.game.draft.pendingClubIds.filter(id => humanIds(room).includes(id)) : humanIds(room); }
function eligible(game) { return game.league.clubs.filter(club => club.funds >= 5 && club.roster.length < 12 && !game.draft.declined.includes(club.id)).map(club => club.id); }
function prepareRound(game) {
  const d = game.draft;
  d.mode = game.league.season === 1 || d.round === 1 ? 'SIMULTANEOUS' : 'ORDERED';
  if (d.mode === 'SIMULTANEOUS') d.pendingClubIds = eligible(game);
  else {
    const ranks = game.league.previousStandings || standings(game.league).map(row => ({ clubId: row.club.id, rank: row.rank }));
    d.order = [...ranks].sort((a, b) => d.round === 3 ? a.rank - b.rank : b.rank - a.rank).map(row => row.clubId).filter(id => eligible(game).includes(id));
    d.orderIndex = 0;
    d.pendingClubIds = d.order.slice(0, 1);
  }
}
function nextOrdered(game) {
  const d = game.draft;
  do { d.orderIndex++; } while (d.orderIndex < d.order.length && !eligible(game).includes(d.order[d.orderIndex]));
  d.pendingClubIds = d.order.slice(d.orderIndex, d.orderIndex + 1);
}
function beginDraft(room) {
  const game = room.game, league = game.league;
  league.releasePhaseOpen = false;
  league.clubs.forEach(club => { club.reserveAuctionSlot = club.controllerType === 'CPU' && 12 - club.roster.length >= 2; });
  game.draft = { pool: createDraftPool(league.seed, league.season), round: 1, history: [], declined: [], pendingClubIds: [], completed: false, rngState: null };
  game.auction = null;
  game.growth = [];
  prepareRound(game);
  enterPhase(room, 'draft');
  progressDraft(room);
}
export function startGame(room) {
  requireValue(room.phase === 'lobby' && room.players.length > 0, '開始できません。');
  const first = room.players[0];
  const league = createLeague({ name: first.teamName, color: first.color, seed: crypto.randomUUID() });
  room.players.forEach((player, index) => {
    const club = league.clubs[index];
    player.clubId = club.id;
    Object.assign(club, { name: player.teamName, color: player.color, controllerType: 'HUMAN' });
  });
  room.game = { league, draft: null, auction: null, events: {}, special: {}, financeSummary: [], growth: [] };
  beginDraft(room);
}
function resolveDraft(room) {
  const game = room.game, d = game.draft, league = game.league;
  const rng = createRandom(`${league.seed}:season:${league.season}:draft`, d.rngState);
  const actions = d.pendingClubIds.map(id => {
    const club = league.clubs.find(row => row.id === id);
    if (club.controllerType === 'CPU') return decideCpuDraftAction(club, d.pool, rng);
    const input = room.inputs[id];
    return input?.pass ? null : { type: ACTION_TYPES.DRAFT_PICK, clubId: id, playerId: input?.playerId };
  }).filter(Boolean);
  for (const id of d.pendingClubIds) if (room.inputs[id]?.pass && !d.declined.includes(id)) d.declined.push(id);
  const result = resolveDraftActions({ clubs: league.clubs, candidates: d.pool, pendingClubIds: d.pendingClubIds, actions, rng });
  d.rngState = rng.snapshot();
  d.pool = result.candidates;
  d.history.push(...result.acquired.map(row => ({ ...row, round: d.round })));
  if (d.mode === 'ORDERED') nextOrdered(game);
  else d.pendingClubIds = result.pendingClubIds;
  enterPhase(room, 'draft');
}
function progressDraft(room) {
  for (let guard = 0; guard < 200; guard++) {
    const d = room.game.draft;
    if (!d.pendingClubIds.length) {
      if (d.round >= 4) { d.completed = true; enterPhase(room, 'draft-complete'); return; }
      d.round++;
      prepareRound(room.game);
      enterPhase(room, 'draft');
      continue;
    }
    if (pendingIds(room).some(id => !Object.hasOwn(room.inputs, id))) return;
    resolveDraft(room);
  }
  throw new Error('ドラフトの進行上限を超えました。');
}
function beginAuction(room) {
  const { league } = room.game;
  league.clubs.forEach(club => delete club.reserveAuctionSlot);
  room.game.auction = { pool: createAuctionPool(league.seed, league.season, league.releasedPlayers), i: 0, history: [], completed: false, rngState: null };
  enterPhase(room, 'auction');
}
function resolveAuction(room) {
  const { league, auction: a } = room.game, player = a.pool[a.i];
  const rng = createRandom(`${league.seed}:season:${league.season}:auction`, a.rngState);
  const actions = league.clubs.map(club => club.controllerType === 'CPU' ? decideCpuAuctionAction(club, player, rng) : { type: ACTION_TYPES.AUCTION_BID, clubId: club.id, playerId: player.id, bid: club.roster.length < 12 ? room.inputs[club.id].bid : 0 });
  const result = resolveAuctionActions({ clubs: league.clubs, player, actions, rng });
  a.rngState = rng.snapshot();
  a.history.push({ player, winnerClubId: result.winner?.id || null, bid: result.bid || 0 });
  if (result.winner) league.releasedPlayers = league.releasedPlayers.filter(row => row.id !== player.id);
  a.i++;
  if (a.i >= a.pool.length) {
    a.completed = true;
    league.releasedPlayers = [];
    prepareCpuClubs(league);
    enterPhase(room, 'auction-complete');
  } else enterPhase(room, 'auction');
}
function beginOffseason(room) {
  const game = room.game, league = game.league;
  game.financeSummary = applySeasonFinances(league);
  game.events = {};
  game.special = {};
  for (const club of league.clubs) {
    club.roster.forEach(player => player.contractYears--);
    game.events[club.id] = {
      retention: createContractEvents(club, createRandom(`${league.seed}:season:${league.season}:club:${club.id}:retention`)),
      special: createSpecialTrainingOffers(club, createRandom(`${league.seed}:season:${league.season}:club:${club.id}:special-training`))
    };
  }
  enterPhase(room, 'offseason-events');
}
function resolveOffseason(room) {
  const { league, events, special } = room.game;
  for (const club of league.clubs) {
    if (club.controllerType === 'HUMAN') {
      special[club.id] = applyWork(league, club.id, events[club.id], room.inputs[club.id].actions).accepted;
      continue;
    }
    manageCpuContracts(club, league);
    const rank = { SS: 9, S: 8, A: 7, B: 6, C: 5, D: 4, E: 3, F: 2, G: 1 };
    for (const row of [...events[club.id].retention].sort((a,b) => rank[b.rank] - rank[a.rank] || Number(b.starter) - Number(a.starter))) {
      const player = club.roster.find(player => player.id === row.playerId);
      if (!player) continue;
      const mustKeep = club.roster.length <= 5 || (player.primaryPosition === 'GK' && club.roster.filter(p => p.primaryPosition === 'GK').length <= 1);
      if (club.funds - row.cost >= 50 || mustKeep) club.funds = Math.max(0, club.funds - row.cost);
      else {
        club.roster = club.roster.filter(p => p.id !== player.id);
        club.lineup = club.lineup.filter(id => id !== player.id);
        if (!player.isInitial && !league.releasedPlayers.some(p => p.id === player.id)) league.releasedPlayers.push(player);
      }
    }
    special[club.id] = [];
    for (const offer of events[club.id].special) if (club.roster.some(p => p.id === offer.playerId) && club.funds - offer.cost >= 50) { club.funds -= offer.cost; special[club.id].push(offer.playerId); }
    selectBestLineup(club);
  }
  enterPhase(room, 'development');
}
function resolveAll(room) {
  const { league } = room.game;
  switch (room.phase) {
    case 'draft-complete': return beginAuction(room);
    case 'auction': return resolveAuction(room);
    case 'auction-complete': return enterPhase(room, 'team-setup');
    case 'team-setup':
      for (const club of league.clubs.filter(club => club.controllerType === 'HUMAN')) Object.assign(club, { lineup: [...room.inputs[club.id].lineup], tactic: room.inputs[club.id].tactic });
      return enterPhase(room, 'season-ready');
    case 'season-result':
      if (league.season >= 10) return enterPhase(room, 'game-complete');
      return beginOffseason(room);
    case 'offseason-events': return resolveOffseason(room);
    case 'development': {
      const training = new Map(humanIds(room).map(id => [id, new Map(room.inputs[id].selections.map(row => [row.playerId, row.focus]))]));
      const special = new Map(league.clubs.map(club => [club.id, new Set(room.game.special[club.id] || [])]));
      room.game.growth = processLeagueOffseason(league, training, special);
      return enterPhase(room, 'growth-result');
    }
    case 'growth-result':
      league.releasePhaseOpen = true;
      prepareCpuMarketSpace(league);
      return enterPhase(room, 'release');
    case 'release':
      for (const id of humanIds(room)) applyWork(league, id, null, room.inputs[id].actions);
      requireValue(startNextSeason(league), '最終シーズンは終了しています。');
      return beginDraft(room);
    default: throw new Error('このフェーズは確定できません。');
  }
}
export function submitInput(room, player, input) {
  const club = room.game?.league.clubs.find(club => club.id === player.clubId);
  requireValue(club && pendingIds(room).includes(club.id), '現在は入力対象ではありません。');
  requireValue(!Object.hasOwn(room.inputs, club.id), '入力は完了済みです。');
  requireValue(input && typeof input === 'object' && !Array.isArray(input), '入力が不正です。');
  let accepted;
  switch (room.phase) {
    case 'draft':
      requireValue(input.pass === true || (club.funds >= 5 && club.roster.length < 12 && room.game.draft.pool.some(p => p.id === input.playerId)), '指名対象または資金が不正です。');
      accepted = { pass: input.pass === true, playerId: input.pass === true ? null : input.playerId }; break;
    case 'auction':
      requireValue(Number.isInteger(input.bid) && input.bid >= 0 && input.bid <= club.funds, '入札額が不正です。');
      accepted = { bid: club.roster.length >= 12 ? 0 : input.bid }; break;
    case 'team-setup': validateSetup(club, input); accepted = { lineup: [...input.lineup], tactic: input.tactic }; break;
    case 'development': validateTraining(club, input.selections); accepted = { selections: input.selections.map(row => ({ playerId: row.playerId, focus: row.focus })) }; break;
    case 'offseason-events':
    case 'release': {
      requireValue(Array.isArray(input.actions) && input.actions.every(row => row && (room.phase === 'release' ? row.type === 'release' : ['renew','contractRelease','retentionPay','retentionRelease','specialPay','specialSkip'].includes(row.type))), 'フェーズに合わない入力です。');
      const result = applyWork(clone(room.game.league), club.id, room.game.events[club.id], input.actions);
      if (room.phase === 'offseason-events') requireValue(!result.club.roster.some(p => p.contractYears <= 0) && !result.pending.retention.length && !result.pending.special.length, '未処理の判断が残っています。');
      accepted = { actions: input.actions.map(row => ({ type: row.type, playerId: row.playerId })) }; break;
    }
    case 'draft-complete': case 'auction-complete': case 'season-result': case 'growth-result': accepted = {}; break;
    default: throw new Error('このフェーズでは入力できません。');
  }
  room.inputs[club.id] = accepted;
  if (room.phase === 'draft') progressDraft(room);
  else if (pendingIds(room).every(id => Object.hasOwn(room.inputs, id))) resolveAll(room);
}
export function runSeason(room) {
  requireValue(room.phase === 'season-ready', '全員の編成完了を待っています。');
  simulateRemainingSeason(room.game.league);
  if (room.game.league.season === 10) finalizeSeason(room.game.league);
  enterPhase(room, 'season-result');
}
export function renamePlayer(room, owner, input) {
  requireValue(room.phase === 'release' && !Object.hasOwn(room.inputs, owner.clubId), '名前変更は選手整理の完了前に行ってください。');
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim();
  requireValue(name.length > 0 && name.length <= 10 && !/[\r\n]/.test(String(input.name)), '名前は改行なしの1〜10文字です。');
  const player = room.game.league.clubs.find(club => club.id === owner.clubId)?.roster.find(row => row.id === input.playerId);
  requireValue(player, '所属選手が見つかりません。');
  player.name = name;
}

export function publicRoom(room, owner = null) {
  // Whitelist the root; recursively strip internals from EVERY nested result.
  const game = room.game && clone(room.game);
  if (game) {
    game.standings = standings(room.game.league).map(row => ({ clubId: row.club.id, rank: row.rank }));
    game.events = owner ? { [owner.clubId]: game.events[owner.clubId] } : {};
    game.special = {};
  }
  const result = { roomId: room.roomId, phase: room.phase, phaseRevision: room.phaseRevision, revision: room.revision, hostPlayerId: room.hostPlayerId, game, players: room.players.map(player => ({ id: player.id, teamName: player.teamName, color: player.color, clubId: player.clubId, completed: Object.hasOwn(room.inputs, player.clubId) })), ownInput: owner ? room.inputs[owner.clubId] || null : null };
  return JSON.parse(JSON.stringify(result, (key, value) => ['hiddenGrowth','rngState','seed','accessToken'].includes(key) ? undefined : value));
}
