import { renewalFee } from './development.js';

export const ACTION_TYPES = Object.freeze({
  DRAFT_PICK: 'DRAFT_PICK',
  AUCTION_BID: 'AUCTION_BID',
  SET_LINEUP: 'SET_LINEUP',
  SET_TACTIC: 'SET_TACTIC',
  SELECT_DEVELOPMENT: 'SELECT_DEVELOPMENT',
  RENEW_CONTRACT: 'RENEW_CONTRACT',
  RELEASE_PLAYER: 'RELEASE_PLAYER'
});

const TACTICS = new Set(['BALANCED', 'POSSESSION', 'DRIBBLE', 'COUNTER']);

export function applyClubAction(club, action) {
  if (!club || action.clubId !== club.id) return { ok: false, error: 'クラブが一致しません。' };
  if (action.type === ACTION_TYPES.SET_LINEUP) {
    const lineup = Array.isArray(action.lineup) ? action.lineup : [];
    const unique = new Set(lineup);
    if (lineup.length !== 5 || unique.size !== 5) return { ok: false, error: 'スタメンは重複なしの5人で指定してください。' };
    if (lineup.some(id => !club.roster.some(player => player.id === id))) return { ok: false, error: '所属していない選手は配置できません。' };
    club.lineup = [...lineup];
    return { ok: true, lineup: [...club.lineup] };
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
    club.roster = club.roster.filter(candidate => candidate.id !== player.id);
    club.lineup = club.lineup.filter(id => id !== player.id);
    return { ok: true, player };
  }
  return { ok: false, error: '未対応のActionです。' };
}
