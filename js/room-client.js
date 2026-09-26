const SESSION_KEY = 'football-league:v3:session';
const PENDING_KEY = 'football-league:v3:pending';
const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };

export class RoomClient {
  constructor(onRoom, onStatus) {
    this.session = read(SESSION_KEY);
    this.onRoom = onRoom;
    this.onStatus = onStatus;
    this.timer = null;
    this.generation = 0;
    this.pollGeneration = 0;
    this.busy = false;
    this.room = null;
    this.pending = read(PENDING_KEY);
  }
  async request(path, body = null) {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 45000);
    try {
      const response = await fetch(`/api/rooms${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { 'content-type': 'application/json', ...(this.session ? { 'x-player-token': this.session.playerToken } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: abort.signal });
      let data;
      try { data = await response.json(); } catch { throw new Error('Room APIに接続できません。WorkerのURLで開いてください。'); }
      if (!response.ok) throw Object.assign(new Error(data.error || `通信エラー ${response.status}`), { status: response.status });
      return data;
    } finally { clearTimeout(timeout); }
  }
  accept(room) {
    if (this.room?.roomId === room.roomId && room.revision < this.room.revision) return;
    this.room = room;
    this.onRoom(room);
  }
  async enter(kind, teamName, roomId = '') {
    if (this.busy) return;
    if (this.pending) throw new Error('前回の送信結果を「再接続・送信確認」で確認してください。');
    this.stop();
    const normalized = roomId.trim().toUpperCase();
    const pending = { kind: 'entry', path: kind === 'create' ? '' : `/${encodeURIComponent(normalized)}/join`, body: { teamName, requestId: crypto.randomUUID() } };
    return this.send(pending);
  }
  async mutate(action, input = {}) {
    if (this.busy) return;
    if (this.pending) throw new Error('前回の送信結果を再確認してください。');
    if (!this.session || !this.room) throw new Error('参加情報がありません。');
    return this.send({ kind: 'mutation', roomId: this.session.roomId, path: `/${this.session.roomId}/${action}`, body: { playerId: this.session.playerId, phaseRevision: this.room.phaseRevision, requestId: crypto.randomUUID(), input } });
  }
  async send(pending) {
    this.busy = true;
    this.pending = pending;
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      this.onStatus({ busy: true, error: '' });
      const data = await this.request(pending.path, pending.body);
      if (pending.kind === 'entry') {
        this.session = { roomId: data.room.roomId, playerId: data.playerId, playerToken: data.playerToken };
        localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
      }
      this.pending = null;
      localStorage.removeItem(PENDING_KEY);
      this.accept(data.room);
      this.onStatus({ busy: false, error: '' });
      this.startPolling();
      return data.room;
    } catch (error) {
      // A network timeout is ambiguous: retain the exact request ID for retry.
      if (error.status && error.status < 500) { this.pending = null; localStorage.removeItem(PENDING_KEY); }
      this.onStatus({ busy: false, error: error.message });
      if (error.status === 409) await this.refresh().catch(() => {});
      throw error;
    } finally { this.busy = false; }
  }
  async retry() {
    if (this.busy) return;
    if (this.pending) return this.send(this.pending);
    return this.refresh();
  }
  async refresh() {
    if (!this.session) return;
    const generation = this.generation, session = this.session;
    const data = await this.request(`/${session.roomId}?playerId=${encodeURIComponent(session.playerId)}`);
    if (generation !== this.generation) return;
    this.accept(data.room);
    this.onStatus({ error: '', busy: this.busy });
  }
  startPolling() {
    clearTimeout(this.timer);
    const generation = ++this.pollGeneration;
    const poll = async () => {
      if (generation !== this.pollGeneration || !this.session) return;
      if (!this.busy) { try { await this.refresh(); } catch (error) { this.onStatus({ error: error.message }); } }
      if (generation === this.pollGeneration) this.timer = setTimeout(poll, 2500);
    };
    this.timer = setTimeout(poll, 2500);
  }
  stop() { this.generation++; this.pollGeneration++; clearTimeout(this.timer); this.timer = null; }
  async resume() { await this.refresh(); this.startPolling(); }
}
