export { RoomObject } from './room.js';
const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/health') return json({ ok: true, service: 'football-league-v3' }, 200);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'api' || parts[1] !== 'rooms' || parts.length > 4) return json({ error: 'APIが見つかりません。' }, 404);
    // Same-origin API; never enable wildcard credentialed access.
    if (request.method === 'POST' && request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({ error: 'Originが一致しません。' }, 403);
    if (request.method === 'POST' && parts.length === 2) {
      const raw = await request.text();
      if (raw.length > 32768) return json({ error: '入力が大きすぎます。' }, 413);
      let body;
      try { body = JSON.parse(raw); } catch { return json({ error: 'JSONが不正です。' }, 400); }
      if (!body || !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId || '')) return json({ error: 'リクエストIDが不正です。' }, 400);
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.requestId)));
      const roomId = [...digest.slice(0, 6)].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(roomId));
      return stub.fetch(new Request('https://room.internal/init', { method: 'POST', body: JSON.stringify({ ...body, roomId }) }));
    }
    const roomId = (parts[2] || '').toUpperCase();
    if (!/^[A-F0-9]{12}$/.test(roomId)) return json({ error: 'ルームIDは12桁の英数字です。' }, 400);
    const action = parts[3] || 'state';
    if (!(request.method === 'GET' && action === 'state') && !(request.method === 'POST' && ['join','start','submit','run-season','rename'].includes(action))) return json({ error: 'APIが見つかりません。' }, 404);
    const headers = new Headers({ 'content-type': 'application/json' });
    if (request.headers.has('x-player-token')) headers.set('x-player-token', request.headers.get('x-player-token'));
    const stub = env.ROOMS.get(env.ROOMS.idFromName(roomId));
    return stub.fetch(new Request(`https://room.internal/${action}${url.search}`, { method: request.method, headers, body: request.method === 'POST' ? request.body : undefined }));
  }
};
