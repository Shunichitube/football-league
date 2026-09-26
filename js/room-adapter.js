import { RoomClient } from './room-client.js';
import { clone, applyWork } from './phase-work.js';

const VIEW = { lobby: 'roomLobby', draft: 'draft', 'draft-complete': 'draft', auction: 'auction', 'auction-complete': 'auction', 'team-setup': 'squad', 'season-ready': 'squad', 'season-result': 'seasonResults', 'offseason-events': 'offseasonEvents', development: 'development', 'growth-result': 'growth', release: 'release', 'game-complete': 'history' };
const WORK_KEY = 'football-league:v3:work:';
export class RoomAdapter {
  constructor(getState, setState, render, statusChanged) {
    this.getState = getState;
    this.setState = setState;
    this.render = render;
    this.statusChanged = statusChanged;
    this.active = false;
    this.status = { busy: false, error: '' };
    this.actions = [];
    this.client = new RoomClient(room => this.receive(room), status => { Object.assign(this.status, status); this.statusChanged(); });
  }
  get room() { return this.client.room; }
  get player() { return this.room?.players.find(row => row.id === this.client.session?.playerId); }
  get isHost() { return this.player?.id === this.room?.hostPlayerId; }
  get locked() { return this.status.busy || !!this.client.pending || !!this.player?.completed; }
  workKey() { return `${WORK_KEY}${this.client.session.roomId}:${this.client.session.playerId}:${this.room.phaseRevision}`; }
  remember() {
    if (!this.room?.game || this.getState().mode !== 'room' || !this.getState().league) return;
    const s = this.getState(), club = s.league.clubs.find(row => row.id === this.player.clubId);
    sessionStorage.setItem(this.workKey(), JSON.stringify({ actions: this.actions, lineup: club.lineup, tactic: club.tactic, training: [...(s.training || new Map())] }));
  }
  receive(room) {
    if (!this.active) return;
    const previous = this.getState();
    const changed = previous.roomPhaseRevision !== room.phaseRevision || previous.roomId !== room.roomId;
    if (!changed && previous.roomRevision === room.revision) { this.statusChanged(); return; }
    if (!room.game) {
      this.setState({ ...previous, mode: 'room', view: 'roomLobby', league: null, roomId: room.roomId, roomPhaseRevision: room.phaseRevision, roomRevision: room.revision });
      this.render(); return;
    }
    const owner = room.players.find(row => row.id === this.client.session.playerId);
    if (!owner) throw new Error('クラブ割当が見つかりません。');
    if (changed) {
      if (previous.roomId && previous.roomPhaseRevision) sessionStorage.removeItem(`${WORK_KEY}${previous.roomId}:${this.client.session.playerId}:${previous.roomPhaseRevision}`);
      let work = null;
      try { work = JSON.parse(sessionStorage.getItem(this.workKey()) || 'null'); } catch { /* malformed local draft */ }
      this.actions = room.ownInput?.actions || work?.actions || [];
      const game = clone(room.game), league = game.league;
      league.humanClubId = owner.clubId;
      league.seasonResults = league.seasonResults.filter(match => match.fixture.homeId === owner.clubId || match.fixture.awayId === owner.clubId);
      const state = { ...previous, mode: 'room', roomId: room.roomId, roomPhaseRevision: room.phaseRevision, roomRevision: room.revision, league, draft: game.draft, auction: game.auction, view: VIEW[room.phase], note: '', selectedLineupPlayerId: null, lineupMessage: '', lineupError: false, rosterOpen: false, draftHistoryOpen: false, auctionHistoryOpen: false, match: null, training: new Map(work?.training || []), financeSummary: game.financeSummary, growth: game.growth.find(row => row.clubId === owner.clubId)?.growth || [], retentionEvents: game.events[owner.clubId]?.retention || [], specialOffers: game.events[owner.clubId]?.special || [], specialTrainingAccepted: new Set(), offseasonComplete: false };
      const club = league.clubs.find(row => row.id === owner.clubId);
      if (room.phase === 'team-setup' && (room.ownInput || work)) {
        const setup = room.ownInput || work;
        if (setup.lineup) club.lineup = setup.lineup;
        if (setup.tactic) club.tactic = setup.tactic;
      }
      if (room.phase === 'development' && room.ownInput) state.training = new Map(room.ownInput.selections.map(row => [row.playerId, row.focus]));
      this.setState(state);
      if (this.actions.length && ['release','offseason-events'].includes(room.phase)) {
        try { this.applyPreview(); }
        catch { this.actions = []; state.note = '保存された入力を復元できませんでした。入力を確認してください。'; sessionStorage.removeItem(this.workKey()); }
      }
      this.render();
    } else {
      previous.roomRevision = room.revision;
      // Completion-only polls never replace an in-progress editor or modal.
      // Renames are public, independent of uncommitted phase work.
      const names = new Map(room.game.league.clubs.flatMap(club => club.roster.map(p => [p.id, p.name])));
      let renamed = false;
      for (const club of previous.league.clubs) for (const p of club.roster) if (names.has(p.id) && names.get(p.id) !== p.name) { p.name = names.get(p.id); renamed = true; }
      if (renamed) this.render(); else this.statusChanged();
    }
  }
  applyPreview() {
    const game = this.room.game, league = clone(game.league);
    league.humanClubId = this.player.clubId;
    league.seasonResults = league.seasonResults.filter(match => match.fixture.homeId === this.player.clubId || match.fixture.awayId === this.player.clubId);
    const result = applyWork(league, this.player.clubId, game.events[this.player.clubId], this.actions);
    Object.assign(this.getState(), { league, retentionEvents: result.pending.retention, specialOffers: result.pending.special, specialTrainingAccepted: new Set(result.accepted) });
  }
  work(type, playerId) {
    if (this.locked) throw new Error('入力は送信済みか、送信結果の確認待ちです。');
    const allowed = this.room.phase === 'release' ? ['release'] : this.room.phase === 'offseason-events' ? ['renew','contractRelease','retentionPay','retentionRelease','specialPay','specialSkip'] : [];
    if (!allowed.includes(type)) throw new Error('現在のフェーズでは操作できません。');
    this.actions.push({ type, playerId });
    try { this.applyPreview(); } catch (error) { this.actions.pop(); throw error; }
    this.remember(); this.render();
  }
  async enter(kind, name, color, id) { this.active = true; return this.client.enter(kind, name, color, id); }
  async resume() { this.active = true; await this.client.resume(); }
  leave() { this.remember(); this.active = false; this.client.stop(); }
  async submit(input = {}) { this.remember(); return this.client.mutate('submit', input); }
  async rename(playerId, name) { return this.client.mutate('rename', { playerId, name }); }
  standings(league, fallback) {
    if (!this.active || !this.room?.game) return fallback(league);
    return this.room.game.standings.map(({ clubId, rank }) => { const club = league.clubs.find(row => row.id === clubId), record = league.records[clubId]; return { club, rank, ...record, goalDifference: record.goalsFor - record.goalsAgainst }; });
  }
  draftResultText() {
    const room = this.room, clubId = this.player?.clubId;
    if (!room || !['draft', 'draft-complete'].includes(room.phase) || clubId == null) return '';
    const draft = room.game.draft;
    const result = [...draft.history].reverse().find(row => row.clubId === clubId || row.contenderIds?.includes(clubId));
    if (!result) return '';
    const prefix = `直近の指名（第${result.round}巡）：`;
    if (result.clubId === clubId) return `${prefix}${result.contested ? '当選' : '獲得（競合なし）'} — ${result.player.name}`;
    const winner = room.game.league.clubs.find(club => club.id === result.clubId);
    const retry = room.phase === 'draft' && draft.round === result.round && draft.pendingClubIds.includes(clubId) && !this.player.completed;
    return `${prefix}落選 — ${result.player.name}は${winner?.name || '他クラブ'}が獲得。${retry ? '再指名してください。' : ''}`;
  }
  participantStatuses() {
    const room = this.room;
    if (!room) return [];
    return room.players.map(player => {
      let label = player.completed ? '完了' : '未完了';
      let state = player.completed ? 'done' : 'pending';
      if (room.phase === 'lobby') { label = '参加済み'; state = 'neutral'; }
      else if (room.phase === 'season-ready') { label = '完了'; state = 'done'; }
      else if (room.phase === 'game-complete') { label = '終了'; state = 'done'; }
      else if (room.phase === 'draft' && !room.game.draft.pendingClubIds.includes(player.clubId)) {
        const draft = room.game.draft;
        const club = room.game.league.clubs.find(club => club.id === player.clubId);
        state = 'neutral';
        if (draft.declined.includes(player.clubId)) label = '辞退';
        else if (draft.history.some(row => row.round === draft.round && row.clubId === player.clubId)) { label = '指名済み'; state = 'done'; }
        else if (!club || club.funds < 5 || club.roster.length >= 12) label = '対象外';
        else label = '順番待ち';
      }
      return { name: player.teamName, label, state, self: player.id === this.player?.id };
    });
  }
  statusText() {
    if (this.status.error) return this.status.error;
    if (this.status.busy) return '送信中…';
    if (this.client.pending) return '前回の送信結果を確認してください。';
    const room = this.room;
    if (!room) return '';
    if (room.phase === 'game-complete') return '全10シーズンが終了しました。';
    if (room.phase === 'season-ready') return this.isHost ? '全員の編成が完了しました。シーズンを実行できます。' : 'ホストのシーズン実行を待っています。';
    const players = room.phase === 'draft' ? room.players.filter(p => room.game.draft.pendingClubIds.includes(p.clubId)) : room.players;
    return `${players.filter(p => p.completed).length}/${players.length} 完了${this.player?.completed ? '・他のクラブを待っています' : ''}`;
  }
}
