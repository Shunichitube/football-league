import { renewalFee } from './development.js?v=0.16.5';

export const ACTION_TYPES = Object.freeze({
  DRAFT_PICK: 'DRAFT_PICK',
  AUCTION_BID: 'AUCTION_BID',
  SET_LINEUP: 'SET_LINEUP',
  SET_TACTIC: 'SET_TACTIC',
  SELECT_DEVELOPMENT: 'SELECT_DEVELOPMENT',
  RENEW_CONTRACT: 'RENEW_CONTRACT',
  RELEASE_PLAYER: 'RELEASE_PLAYER'
});

export const LINEUP_SLOTS = Object.freeze(['GK', 'DF', 'MF', 'MF', 'FW']);
const ADJACENT_POSITIONS = Object.freeze({ DF: ['MF'], MF: ['DF', 'FW'], FW: ['MF'] });

const TACTICS = new Set(['BALANCED', 'POSSESSION', 'DRIBBLE', 'COUNTER']);
const POSITION_LABELS = { GK: 'GK', DF: 'DF', MF: 'MF', FW: 'FW' };
const positionLabel = position => POSITION_LABELS[position] || position;

export function positionSuitability(player, slotPosition) {
  if (!player) return 0;
  if (slotPosition === 'GK') return player.primaryPosition === 'GK' ? 1 : .5;
  if (player.primaryPosition === 'GK') return 0;
  if (player.primaryPosition === slotPosition) return 1;
  return ADJACENT_POSITIONS[player.primaryPosition]?.includes(slotPosition) ? .95 : .85;
}

export function validateLineup(club, lineup = club?.lineup) {
  if (!club || !Array.isArray(lineup) || lineup.length !== LINEUP_SLOTS.length) return { ok: false, error: 'スタメン5枠をすべて設定してください。', warnings: [] };
  if (new Set(lineup).size !== LINEUP_SLOTS.length) return { ok: false, error: '同一選手を重複配置できません。', warnings: [] };
  const players = lineup.map(id => club.roster.find(player => player.id === id));
  if (players.some(player => !player)) return { ok: false, error: '所属していない選手は配置できません。', warnings: [] };
  const invalidKeeper = players.find((player, index) => LINEUP_SLOTS[index] !== 'GK' && player.primaryPosition === 'GK');
  if (invalidKeeper) return { ok: false, error: 'GKはフィールド枠へ配置できません。', warnings: [] };
  const warnings = players.flatMap((player, index) => {
    const slot = LINEUP_SLOTS[index];
    if (player.primaryPosition === slot) return [];
    return [`${player.name}：本職${positionLabel(player.primaryPosition)}から${positionLabel(slot)}への適性外配置`];
  });
  return { ok: true, warnings };
}

export function createLineupPlacement(lineup, playerId, slotIndex) {
  if (!Array.isArray(lineup) || slotIndex < 0 || slotIndex >= LINEUP_SLOTS.length) return null;
  const next = [...lineup];
  const previousIndex = next.indexOf(playerId);
  const displacedId = next[slotIndex];
  next[slotIndex] = playerId;
  if (previousIndex >= 0 && previousIndex !== slotIndex) next[previousIndex] = displacedId;
  return next;
}

export function applyClubAction(club, action, league = null) {
  if (!club || action.clubId !== club.id) return { ok: false, error: 'クラブが一致しません。' };
  if (action.type === ACTION_TYPES.SET_LINEUP) {
    const lineup = Array.isArray(action.lineup) ? action.lineup : [];
    const validation = validateLineup(club, lineup);
    if (!validation.ok) return validation;
    club.lineup = [...lineup];
    return { ok: true, lineup: [...club.lineup], warnings: validation.warnings };
  }
  if (action.type === ACTION_TYPES.SET_TACTIC) {
    if (!TACTICS.has(action.tactic)) return { ok: false, error: '戦術が不正です。' };
    club.tactic = action.tactic;
    return { ok: true, tactic: club.tactic };
  }
  if (action.type === ACTION_TYPES.SELECT_DEVELOPMENT) {
    const selections = action.selections instanceof Map ? action.selections : new Map(action.selections || []);
    if (selections.size > 2 || [...selections.keys()].some(id => !club.roster.some(player => player.id === id))) return { ok: false, error: '育成対象が不正です。' };
    return { ok: true, selections };
  }
  if (action.type === ACTION_TYPES.RENEW_CONTRACT) {
    const player = club.roster.find(candidate => candidate.id === action.playerId);
    if (!player || player.contractYears > 0) return { ok: false, error: '契約更新対象ではありません。' };
    const fee = renewalFee(player);
    const protectedMinimum = action.protectMinimum && (club.roster.length <= 5 || (player.primaryPosition === 'GK' && club.roster.filter(candidate => candidate.primaryPosition === 'GK').length <= 1));
    if (club.funds < fee && !protectedMinimum) return { ok: false, error: '資金が不足しています。' };
    club.funds = Math.max(0, club.funds - fee);
    player.contractYears = 3;
    return { ok: true, player, fee };
  }
  if (action.type === ACTION_TYPES.RELEASE_PLAYER) {
    const player = club.roster.find(candidate => candidate.id === action.playerId);
    if (!player) return { ok: false, error: '所属選手が見つかりません。' };
    if (league && !league.releasePhaseOpen && !action.contractDecision) return { ok: false, error: '選手の放出はオフシーズンの選手整理フェイズでのみ行えます。' };
    if (club.roster.length <= 5) return { ok: false, error: '登録選手は最低5人必要です。' };
    if (player.primaryPosition === 'GK' && club.roster.filter(candidate => candidate.primaryPosition === 'GK').length <= 1) return { ok: false, error: 'GKを0人にはできません。' };
    club.roster = club.roster.filter(candidate => candidate.id !== player.id);
    club.lineup = club.lineup.filter(id => id !== player.id);
    if (!player.isInitial && league) {
      league.releasedPlayers ||= [];
      if (!league.releasedPlayers.some(candidate => candidate.id === player.id)) league.releasedPlayers.push(player);
    }
    return { ok: true, player };
  }
  return { ok: false, error: '未対応のActionです。' };
}
