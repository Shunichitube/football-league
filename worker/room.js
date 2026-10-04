// v2's Room/token/private-input model, with serialized authoritative mutations.
import { advanceAuction, startGame, submitInput, runSeason, renamePlayer, publicRoom } from './room-game.js?v=short-season-v1';
import { roomPatch } from '../js/room-patch.js';

const META = 'v3-meta';
const COLORS = ['#ffffff','#60a5fa','#f59e0b','#f472b6','#34d399','#a78bfa'];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
function assert(condition, message, status = 400) { if (!condition) throw Object.assign(new Error(message), { status }); }
function teamName(value) { const name = String(value ?? '').trim(); assert(name.length > 0 && name.length <= 12, 'クラブ名を1〜12文字で入力してください。'); return name; }
function newPlayer(name, index) { return { id: crypto.randomUUID(), accessToken: crypto.randomUUID(), teamName: teamName(name), color: COLORS[index], clubId: null }; }
function authenticate(room, request, playerId) {
  const token = request.headers.get('x-player-token');
  const player = room.players.find(row => row.id === playerId && row.accessToken === token);
  assert(player && token, '参加認証に失敗しました。', 403);
  return player;
}

export class RoomObject {
  constructor(state, env) { this.state = state; this.env = env; this.queue = Promise.resolve(); }
  fetch(request) {
    const operation = this.queue.then(() => this.handle(request));
    this.queue = operation.catch(() => {});
    return operation;
  }
  alarm(){
    const operation=this.queue.then(async()=>{const room=await this.load();const before=structuredClone(room);if(room&&advanceAuction(room)){room.revision++;await this.save(room);this.notify(before,room);}});
    this.queue=operation.catch(()=>{});return operation;
  }
  notify(before, room) {
    for (const socket of this.state.getWebSockets?.() || []) {
      try {
        const player = room.players.find(p => p.id === socket.deserializeAttachment()?.playerId);
        if (!player) { socket.close(1008, 'Participant missing'); continue; }
        const previous = publicRoom(before, player);
        // The client needs a fresh time reference when an auction deadline changes.
        previous.serverNow = null;
        const changes = roomPatch(previous, publicRoom(room, player));
        socket.send(JSON.stringify({ type: 'patch', roomId: room.roomId, baseRevision: before.revision, revision: room.revision, changes }));
      } catch { try { socket.close(1011, 'Reconnect required'); } catch {} }
    }
  }
  webSocketClose(socket, code) { socket.close(code, ''); }
  webSocketError(socket) { socket.close(1011, 'Reconnect required'); }
  webSocketMessage(socket) { socket.close(1008, 'Use the action API'); }
  async load() {
    const meta = await this.state.storage.get(META);
    if (!meta) return null;
    const keys = Array.from({ length: meta.chunks }, (_, i) => `v3-chunk-${i}`);
    const chunks = new Map();
    for (let i = 0; i < keys.length; i += 100) {
      const batch = await this.state.storage.get(keys.slice(i, i + 100));
      for (const [key, value] of batch) chunks.set(key, value);
    }
    return JSON.parse(keys.map(key => chunks.get(key)).join(''));
  }
  async save(room) {
    // Persist a wake-up alongside state so auctions finish without connected clients.

    // Match logs can exceed one DO value's 128 KiB limit. Commit all chunks atomically.
    const text = JSON.stringify(room), chunks = [];
    for (let i = 0; i < text.length; i += 16000) chunks.push(text.slice(i, i + 16000));
    await this.state.storage.transaction(async txn => {
      const old = await txn.get(META);
      for (let i = 0; i < chunks.length; i++) await txn.put(`v3-chunk-${i}`, chunks[i]);
      for (let i = chunks.length; i < (old?.chunks || 0); i++) await txn.delete(`v3-chunk-${i}`);
      await txn.put(META, { chunks: chunks.length });
      if(room.phase==='auction'&&room.game.auction.live&&txn.setAlarm){const lot=room.game.auction.live;await txn.setAlarm(lot.closed?lot.nextAt:Math.min(lot.endAt,lot.cpuAt));}
      else if(txn.deleteAlarm)await txn.deleteAlarm();
    }).catch(() => { throw Object.assign(new Error('保存結果を確認できません。再送して確認してください。'), { status: 503 }); });
  }
  async handle(request) {
    try {
      const url = new URL(request.url), action = url.pathname.slice(1);
      let room = await this.load();
      let before = structuredClone(room);
      if (request.method === 'GET' && action === 'events') {
        assert(room, 'ルームが見つかりません。', 404);
        assert(request.headers.get('upgrade')?.toLowerCase() === 'websocket', 'WebSocket接続が必要です。', 426);
        const protocols = (request.headers.get('sec-websocket-protocol') || '').split(',').map(p => p.trim());
        assert(protocols.includes('room-v1'), '通知プロトコルが不正です。');
        const token = protocols.find(p => p.startsWith('token.'))?.slice(6);
        const player = authenticate(room, new Request(request.url, { headers: { 'x-player-token': token || '' } }), url.searchParams.get('playerId'));
        if (advanceAuction(room)) { room.revision++; await this.save(room); this.notify(before, room); }
        const [client, server] = Object.values(new WebSocketPair());
        // Allow multiple tabs; attachments survive hibernation without retaining room snapshots.
        assert(this.state.getWebSockets(player.id).length < 12, '接続数が多すぎます。', 429);
        this.state.acceptWebSocket(server, [player.id]);
        server.serializeAttachment({ playerId: player.id });
        server.send(JSON.stringify({ type: 'snapshot', room: publicRoom(room, player) }));
        return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': 'room-v1' } });
      }
      if (request.method === 'GET' && action === 'state') {
        assert(room, 'ルームが見つかりません。', 404);
        const player = authenticate(room, request, url.searchParams.get('playerId'));
        if(advanceAuction(room)){room.revision++;await this.save(room);this.notify(before,room);}
        return json({ room: publicRoom(room, player) });
      }
      assert(request.method === 'POST', '未対応のAPIです。', 404);
      const raw = await request.text();
      assert(new TextEncoder().encode(raw).length <= 32768, '入力が大きすぎます。', 413);
      let body;
      try { body = JSON.parse(raw); } catch { throw new Error('JSONが不正です。'); }
      assert(body && typeof body === 'object' && !Array.isArray(body), '入力が不正です。');
      assert(typeof body.requestId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(body.requestId), 'リクエストIDが不正です。');
      if (action === 'init') {
        // Same unguessable creation key maps retries to the same DO.
        if (room) {
          assert(room.creationKey === body.requestId, 'ルームIDが競合しました。', 409);
          const host = room.players[0];
          return json({ room: publicRoom(room, host), playerId: host.id, playerToken: host.accessToken });
        }
        const host = newPlayer(body.teamName, 0);
        room = { roomId: body.roomId, creationKey: body.requestId, hostPlayerId: host.id, players: [host], phase: 'lobby', seasonMode: 'NORMAL', revision: 1, phaseRevision: 1, inputs: {}, receipts: {}, joins: {}, game: null };
        await this.save(room);
        return json({ room: publicRoom(room, host), playerId: host.id, playerToken: host.accessToken });
      }
      assert(room, 'ルームが見つかりません。', 404);
      if (action === 'join') {
        const existing = room.joins[body.requestId];
        if (existing) {
          const player = room.players.find(row => row.id === existing);
          return json({ room: publicRoom(room, player), playerId: player.id, playerToken: player.accessToken });
        }
        assert(room.phase === 'lobby', 'このルームは開始済みです。', 409);
        assert(room.players.length < 6, '参加人数は6人までです。');
        const player = newPlayer(body.teamName, room.players.length);
        room.players.push(player);
        room.joins[body.requestId] = player.id;
        room.revision++;
        await this.save(room);
        this.notify(before, room);
        return json({ room: publicRoom(room, player), playerId: player.id, playerToken: player.accessToken });
      }
      const player = authenticate(room, request, body.playerId);
      const receipts = room.receipts[player.id] || [];
      const signature = JSON.stringify({ action, phaseRevision: body.phaseRevision, input: body.input });
      const receipt = receipts.find(row => row.id === body.requestId);
      if (receipt) {
        assert(receipt.signature === signature, '同じリクエストIDの内容が異なります。', 409);
        return json({ room: publicRoom(room, player), replayed: true });
      }
      if(advanceAuction(room)){room.revision++;await this.save(room);this.notify(before,room);before=structuredClone(room);}
      assert(body.phaseRevision === room.phaseRevision, 'フェーズが更新されています。最新状態を確認してください。', 409);
      if (action === 'start' || action === 'run-season' || action === 'configure') assert(player.id === room.hostPlayerId, 'ホストのみ実行できます。', 403);
      if (action === 'configure') {
        assert(room.phase === 'lobby', 'モードは開始前だけ変更できます。', 409);
        assert(['NORMAL','SHORT'].includes(body.input?.seasonMode), 'モードが不正です。');
        room.seasonMode = body.input.seasonMode;
      }
      else if (action === 'start') startGame(room);
      else if (action === 'submit') submitInput(room, player, body.input);
      else if (action === 'run-season') runSeason(room);
      else if (action === 'rename') renamePlayer(room, player, body.input || {});
      else throw Object.assign(new Error('未対応のAPIです。'), { status: 404 });
      room.revision++;
      room.receipts[player.id] = [...receipts, { id: body.requestId, signature }].slice(-32);
      await this.save(room);
      this.notify(before, room);
      return json({ room: publicRoom(room, player) });
    } catch (error) {
      return json({ error: error.message || 'Roomの処理に失敗しました。' }, error.status || 400);
    }
  }
}
