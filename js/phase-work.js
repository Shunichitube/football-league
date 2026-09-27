// Shared validation for a private work-in-progress copy and authoritative Room input.
import { applyClubAction, ACTION_TYPES, validateLineup } from './rules.js?v=0.17.2';
import { selectBestLineup } from './cpu.js?v=0.17.30';
import { trainingSkills } from './development.js?v=0.17.30';

export const clone = value => JSON.parse(JSON.stringify(value));
export function requireValue(condition, message) { if (!condition) throw new Error(message); }
export function applyWork(league, clubId, events, actions = []) {
  requireValue(Array.isArray(actions) && actions.length <= 100, '入力が不正です。');
  const club = league.clubs.find(row => row.id === clubId);
  requireValue(club, 'クラブが見つかりません。');
  const pending = clone(events || { retention: [], special: [] });
  const accepted = [];
  for (const action of actions) {
    const player = club.roster.find(row => row.id === action.playerId);
    requireValue(player, '所属選手が見つかりません。');
    if (action.type === 'renew' || action.type === 'contractRelease') {
      requireValue(player.contractYears <= 0, '契約判断は完了済みです。');
      const result = applyClubAction(club, { type: action.type === 'renew' ? ACTION_TYPES.RENEW_CONTRACT : ACTION_TYPES.RELEASE_PLAYER, clubId, playerId: player.id, contractDecision: true }, league);
      requireValue(result.ok, result.error);
    } else if (action.type === 'retentionPay' || action.type === 'retentionRelease') {
      const row = pending.retention.find(row => row.playerId === player.id);
      requireValue(row, '要求判断は完了済みです。');
      if (action.type === 'retentionPay') {
        requireValue(club.funds >= row.cost, '資金が不足しています。');
        club.funds -= row.cost;
      } else {
        // Same retention-decline semantics as the single-player app.
        club.roster = club.roster.filter(row => row.id !== player.id);
        club.lineup = club.lineup.filter(id => id !== player.id);
        if (!player.isInitial && !league.releasedPlayers.some(row => row.id === player.id)) league.releasedPlayers.push(player);
      }
      pending.retention = pending.retention.filter(row => row.playerId !== player.id);
    } else if (action.type === 'specialPay' || action.type === 'specialSkip') {
      const row = pending.special.find(row => row.playerId === player.id);
      requireValue(row, '特別特訓の判断は完了済みです。');
      if (action.type === 'specialPay') {
        requireValue(club.funds >= row.cost, '資金が不足しています。');
        club.funds -= row.cost;
        accepted.push(player.id);
      }
      pending.special = pending.special.filter(row => row.playerId !== player.id);
    } else if (action.type === 'release') {
      const result = applyClubAction(club, { type: ACTION_TYPES.RELEASE_PLAYER, clubId, playerId: player.id }, league);
      requireValue(result.ok, result.error);
    } else throw new Error('未対応の入力です。');
    pending.retention = pending.retention.filter(row => club.roster.some(player => player.id === row.playerId));
    pending.special = pending.special.filter(row => club.roster.some(player => player.id === row.playerId));
    if (!action.type.startsWith('special')) selectBestLineup(club);
  }
  return { club, pending, accepted };
}

export function validateSetup(club, input) {
  requireValue(input && Array.isArray(input.lineup), '編成を入力してください。');
  const result = validateLineup(club, input.lineup);
  requireValue(result.ok, result.error);
  requireValue(['BALANCED', 'POSSESSION', 'DRIBBLE', 'COUNTER'].includes(input.tactic), '戦術が不正です。');
}
export function validateTraining(club, selections) {
  requireValue(Array.isArray(selections) && selections.length === 2 && new Set(selections.map(row => row.playerId)).size === 2, '育成する2選手を選択してください。');
  for (const row of selections) {
    const player = club.roster.find(player => player.id === row.playerId);
    requireValue(player && trainingSkills(player).includes(row.focus), '育成対象または重点能力が不正です。');
  }
}
