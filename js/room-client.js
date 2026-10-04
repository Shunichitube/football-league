import { applyRoomPatch } from './room-patch.js';
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
    this.socket = null;
    this.reconnectAttempt = 0;
    this.recovering = false;
    this.reconnectOnOnline = () => { if (this.session) this.startNotifications(true); };
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
      this.startNotifications();
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
    await this.refresh();
    this.startNotifications(true);
  }
  async refresh() {
    if (!this.session) return;
    const generation = this.generation, session = this.session;
    const data = await this.request(`/${session.roomId}?playerId=${encodeURIComponent(session.playerId)}`);
    if (generation !== this.generation) return;
    this.accept(data.room);
    this.onStatus({ error: '', busy: this.busy });
  }
  startNotifications(force = false) {
    if (!this.session) return;
    if (!force && this.socket && this.socket.readyState < 2) return;
    clearTimeout(this.timer);
    const old = this.socket;
    this.socket = null;
    old?.close();
    // Node tests have no browser URL or WebSocket. Browsers always use notifications.
    if (!globalThis.location || typeof globalThis.WebSocket !== 'function') return;
    globalThis.addEventListener?.('online', this.reconnectOnOnline);
    const url = new URL(`/api/rooms/${this.session.roomId}/events`, location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('playerId', this.session.playerId);
    const socket = this.socket = new WebSocket(url, ['room-v1', `token.${this.session.playerToken}`]);
    // A stalled handshake must not leave the UI indefinitely without notifications.
    this.timer = setTimeout(() => { if (this.socket === socket) socket.close(); }, 15000);
    socket.onmessage = async event => {
      if (this.socket !== socket) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'snapshot') {
          clearTimeout(this.timer);
          this.reconnectAttempt = 0;
          this.accept(message.room);
          this.onStatus({ error: '', busy: this.busy });
        } else if (message.type === 'patch' && message.roomId === this.room?.roomId) {
          if (message.revision <= this.room.revision) return;
          if (message.baseRevision === this.room.revision) this.accept(applyRoomPatch(this.room, message.changes));
          else if (!this.recovering) {
            this.recovering = true;
            try { await this.refresh(); } finally { this.recovering = false; }
          }
        }
      } catch { this.onStatus({ error: '通知を再接続しています。', busy: this.busy }); socket.close(); }
    };
    socket.onerror = () => { if (this.socket === socket) socket.close(); };
    socket.onclose = event => {
      if (this.socket !== socket) return;
      this.socket = null;
      clearTimeout(this.timer);
      this.onStatus({ error: event.code === 1008 ? '参加認証を確認してください。' : '通知を再接続しています。', busy: this.busy });
      if (event.code !== 1008) {
        const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempt++) + Math.random() * 500;
        this.timer = setTimeout(() => this.startNotifications(), delay);
      }
    };
  }
  stop() {
    this.generation++;
    clearTimeout(this.timer); this.timer = null;
    const socket = this.socket; this.socket = null; socket?.close();
    globalThis.removeEventListener?.('online', this.reconnectOnOnline);
  }
  async resume() { if(this.pending)await this.retry(); await this.refresh(); this.startNotifications(); }
}
