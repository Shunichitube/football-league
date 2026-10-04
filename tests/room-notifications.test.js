import test from 'node:test';
import assert from 'node:assert/strict';
import { roomPatch, applyRoomPatch } from '../js/room-patch.js';
import { RoomObject } from '../worker/room.js';
import { RoomClient } from '../js/room-client.js';

test('notification patches restore nested additions, removals and changed arrays without mutating local state', () => {
  const before = { revision: 1, game: { clubs: [{ id: 'a', funds: 20 }], input: { old: true } } };
  const after = { revision: 2, game: { clubs: [{ id: 'a', funds: 19 }, { id: 'b' }], input: { done: true } } };
  assert.deepEqual(applyRoomPatch(before, roomPatch(before, after)), after);
  assert.equal(before.game.clubs[0].funds, 20);
  assert.throws(() => applyRoomPatch(before, [{ path: ['__proto__', 'polluted'], value: true }]));
});

test('hibernated notification sockets receive personalized completion deltas without tokens or other private inputs', () => {
  const players = [{ id: 'a', clubId: 'club-a', accessToken: 'secret-a' }, { id: 'b', clubId: 'club-b', accessToken: 'secret-b' }];
  const before = { roomId: 'ROOM', revision: 1, phase: 'team-setup', phaseRevision: 1, hostPlayerId: 'a', players, inputs: {}, game: null };
  const after = structuredClone(before);
  after.revision = 2; after.inputs['club-a'] = { tactic: 'COUNTER', lineup: ['private-player'] };
  const packets = [];
  const socket = { deserializeAttachment: () => ({ playerId: 'b' }), send: value => packets.push(JSON.parse(value)) };
  const object = new RoomObject({ getWebSockets: () => [socket] }, {});
  object.notify(before, after);
  const packet = packets[0];
  assert.equal(packet.baseRevision, 1);
  assert.ok(packet.changes.some(c => c.path.join('.') === 'players.0.completed' && c.value === true));
  assert.ok(packet.changes.some(c => c.path.join('.') === 'serverNow'));
  assert.doesNotMatch(JSON.stringify(packet), /secret-|private-player|COUNTER/);
  assert.ok(JSON.stringify(packet).length < 600);
});

test('idle clients never poll; notifications update state and missing revisions recover once', async t => {
  const originals = Object.fromEntries(['localStorage', 'location', 'WebSocket', 'setTimeout', 'clearTimeout'].map(key => [key, globalThis[key]]));
  const timers = new Map(); let nextId = 0;
  globalThis.setTimeout = (fn, delay) => { const id = ++nextId; timers.set(id, { fn, delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.localStorage = { getItem: () => null };
  globalThis.location = { href: 'https://game.example/' };
  const sockets = [];
  globalThis.WebSocket = class {
    constructor(url, protocols) { this.url = url; this.protocols = protocols; this.readyState = 0; sockets.push(this); }
    close() { this.readyState = 3; this.onclose?.({ code: 1000 }); }
  };
  t.after(() => { for (const [key, value] of Object.entries(originals)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value; });
  const states = []; const client = new RoomClient(room => states.push(room), () => {});
  t.after(() => client.stop());
  client.session = { roomId: 'ROOM', playerId: 'person', playerToken: 'token' };
  let refreshes = 0;
  client.refresh = async () => { refreshes++; client.accept({ roomId: 'ROOM', revision: 5 }); };
  client.startNotifications();
  const socket = sockets[0]; socket.readyState = 1;
  assert.equal(socket.url.searchParams.has('token'), false);
  await socket.onmessage({ data: JSON.stringify({ type: 'snapshot', room: { roomId: 'ROOM', revision: 1, value: 10 } }) });
  assert.equal(timers.size, 0, 'No recurring state requests after connection');
  await socket.onmessage({ data: JSON.stringify({ type: 'patch', roomId: 'ROOM', baseRevision: 1, revision: 2, changes: [{ path: ['revision'], value: 2 }, { path: ['value'], value: 11 }] }) });
  assert.equal(client.room.value, 11); assert.equal(refreshes, 0);
  await socket.onmessage({ data: JSON.stringify({ type: 'patch', roomId: 'ROOM', baseRevision: 4, revision: 5, changes: [] }) });
  assert.equal(refreshes, 1);
  await socket.onmessage({ data: JSON.stringify({ type: 'patch', roomId: 'ROOM', baseRevision: 4, revision: 5, changes: [] }) });
  assert.equal(refreshes, 1, 'Delayed duplicate patches do not refetch');
  socket.close(); assert.equal(timers.size, 1, 'Only reconnect attempts are scheduled after disconnect');
  const reconnect = [...timers.values()][0]; reconnect.fn();
  await sockets[1].onmessage({ data: JSON.stringify({ type: 'snapshot', room: { roomId: 'ROOM', revision: 6 } }) });
  assert.equal(client.room.revision, 6);
  client.stop(); assert.equal(timers.size, 0);
});
