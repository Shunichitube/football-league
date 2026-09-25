export { RoomObject } from './room.js';

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 6;

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...corsHeaders,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }
});

const notFound = () => json({ ok: false, error: 'APIが見つかりません。' }, 404);

function randomRoomId() {
  const values = new Uint8Array(ROOM_ID_LENGTH);
  crypto.getRandomValues(values);
  return [...values].map(value => ROOM_ID_CHARS[value % ROOM_ID_CHARS.length]).join('');
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function roomStub(env, roomId) {
  const id = env.ROOMS.idFromName(roomId.toUpperCase());
  return env.ROOMS.get(id);
}

function roomRequest(path, method, body = null) {
  return new Request(`https://room.internal/${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : null
  });
}

async function createRoom(request, env) {
  const body = await readJson(request);
  const roomId = randomRoomId();
  const stub = roomStub(env, roomId);
  return stub.fetch(roomRequest('init', 'POST', { roomId, hostName: body.hostName || body.teamName || body.playerName || 'ホスト' }));
}

async function forwardRoomAction(request, env, roomId, action, method) {
  const stub = roomStub(env, roomId);
  const body = method === 'GET' ? null : await readJson(request);
  return stub.fetch(roomRequest(action, method, body));
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    if (parts[0] !== 'api') return notFound();

    if (parts[1] === 'health' && request.method === 'GET') {
      return json({ ok: true, service: 'football-league-multiplayer' });
    }

    if (parts[1] === 'rooms' && parts.length === 2 && request.method === 'POST') {
      return createRoom(request, env);
    }

    if (parts[1] === 'rooms' && parts.length >= 3) {
      const roomId = parts[2];
      const action = parts[3] || 'state';
      const method = request.method;

      if (parts.length === 3 && method === 'GET') return forwardRoomAction(request, env, roomId, 'state', 'GET');
      if (action === 'join' && method === 'POST') return forwardRoomAction(request, env, roomId, 'join', 'POST');
      if (action === 'select-club' && method === 'POST') return forwardRoomAction(request, env, roomId, 'select-club', 'POST');
      if (action === 'submit' && method === 'POST') return forwardRoomAction(request, env, roomId, 'submit', 'POST');
      if (action === 'ready' && method === 'POST') return forwardRoomAction(request, env, roomId, 'ready', 'POST');
      if (action === 'run-season' && method === 'POST') return forwardRoomAction(request, env, roomId, 'run-season', 'POST');
      if (action === 'complete-season' && method === 'POST') return forwardRoomAction(request, env, roomId, 'complete-season', 'POST');
      if (action === 'confirm-phase' && method === 'POST') return forwardRoomAction(request, env, roomId, 'confirm-phase', 'POST');
      if (action === 'submit-offseason-events' && method === 'POST') return forwardRoomAction(request, env, roomId, 'submit-offseason-events', 'POST');
      if (action === 'advance-offseason-events' && method === 'POST') return forwardRoomAction(request, env, roomId, 'advance-offseason-events', 'POST');
      if (action === 'submit-development' && method === 'POST') return forwardRoomAction(request, env, roomId, 'submit-development', 'POST');
      if (action === 'advance-development' && method === 'POST') return forwardRoomAction(request, env, roomId, 'advance-development', 'POST');
      if (action === 'submit-release' && method === 'POST') return forwardRoomAction(request, env, roomId, 'submit-release', 'POST');
      if (action === 'advance-release' && method === 'POST') return forwardRoomAction(request, env, roomId, 'advance-release', 'POST');
    }

    return notFound();
  }
};
