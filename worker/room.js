const ROOM_STORAGE_KEY = 'room-state';
const MAX_PLAYERS = 6;
const CLUBS = [
  { id: 'club-1', name: 'COM1' },
  { id: 'club-2', name: 'COM2' },
  { id: 'club-3', name: 'COM3' },
  { id: 'club-4', name: 'COM4' },
  { id: 'club-5', name: 'COM5' },
  { id: 'club-6', name: 'COM6' }
];
const PLAYER_COLORS = ['#4ade80', '#60a5fa', '#facc15', '#fb7185', '#a78bfa', '#f97316'];

const now = () => new Date().toISOString();
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  }
});

const error = (message, status = 400) => json({ ok: false, error: message }, status);

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function publicRoom(state) {
  return {
    roomId: state.roomId,
    phase: state.phase,
    currentWork: state.currentWork || null,
    hostPlayerId: state.hostPlayerId,
    players: state.players,
    clubs: state.clubs,
    seasonResult: state.seasonResult || null,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  };
}

function normalizeTeamName(value, fallback = 'クラブ') {
  return String(value || fallback).trim().slice(0, 12) || fallback;
}

function createPlayer(teamName, role = 'guest', colorIndex = 0) {
  const name = normalizeTeamName(teamName, role === 'host' ? 'ホストクラブ' : 'クラブ');
  return {
    id: crypto.randomUUID(),
    name,
    teamName: name,
    role,
    color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length],
    clubId: null,
    ready: false,
    phaseComplete: false,
    submitted: {
      lineup: null,
      tactic: null,
      completed: false
    },
    joinedAt: now()
  };
}

function createInitialState(roomId, hostName) {
  const host = createPlayer(hostName || 'ホストクラブ', 'host', 0);
  return {
    version: 1,
    roomId,
    phase: 'lobby',
    currentWork: 'lobby-ready',
    hostPlayerId: host.id,
    players: [host],
    clubs: CLUBS.map(club => ({ ...club, controller: 'CPU', playerId: null })),
    seasonResult: null,
    createdAt: now(),
    updatedAt: now()
  };
}

function resetPlayerForSetup(player) {
  player.ready = false;
  player.phaseComplete = false;
  player.submitted = {
    lineup: null,
    tactic: null,
    completed: false
  };
}

function resetPhaseCompletion(room) {
  room.players.forEach(player => {
    player.ready = false;
    player.phaseComplete = false;
  });
}

function markPhaseComplete(room, player) {
  player.ready = true;
  player.phaseComplete = true;
  return room.players.length > 0 && room.players.every(candidate => candidate.phaseComplete);
}

function assignClubsByJoinOrder(room) {
  room.clubs = CLUBS.map(club => ({ ...club, controller: 'CPU', playerId: null }));
  room.players.forEach((player, index) => {
    const club = room.clubs[index];
    if (!club) return;
    club.name = player.teamName || player.name;
    club.controller = 'HUMAN';
    club.playerId = player.id;
    player.clubId = club.id;
    resetPlayerForSetup(player);
  });
  for (let index = room.players.length; index < room.clubs.length; index += 1) {
    room.clubs[index].name = `COM${index - room.players.length + 1}`;
  }
  room.phase = 'team-setup';
  room.currentWork = 'lineup-and-tactic';
  room.seasonResult = null;
  return room;
}

function completeSetupWork(room, player, body) {
  player.submitted = {
    lineup: Array.isArray(body.lineup) ? body.lineup.slice(0, 5) : player.submitted.lineup,
    tactic: typeof body.tactic === 'string' ? body.tactic : player.submitted.tactic,
    completed: true,
    completedAt: now()
  };
  if (markPhaseComplete(room, player)) {
    room.phase = 'season-ready';
    room.currentWork = 'season-simulation-ready';
  }
}

function completeSeason(room, seasonResult) {
  room.phase = 'season-result';
  room.currentWork = 'season-result-review';
  room.seasonResult = {
    ...seasonResult,
    storedAt: now()
  };
  resetPhaseCompletion(room);
  return room;
}

function confirmCurrentPhase(room, player) {
  if (room.phase === 'season-result') {
    if (markPhaseComplete(room, player)) {
      room.phase = 'offseason-ready';
      room.currentWork = 'offseason-sync-ready';
    }
    return room;
  }
  return null;
}

export class RoomObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async load() {
    return await this.state.storage.get(ROOM_STORAGE_KEY);
  }

  async save(room) {
    room.updatedAt = now();
    await this.state.storage.put(ROOM_STORAGE_KEY, room);
    return room;
  }

  async fetch(request) {
    if (request.method === 'OPTIONS') return json({ ok: true });

    const url = new URL(request.url);
    const action = url.pathname.split('/').filter(Boolean).pop();

    if (action === 'init' && request.method === 'POST') {
      const existing = await this.load();
      if (existing) return json({ ok: true, room: publicRoom(existing) });
      const body = await readJson(request);
      const room = await this.save(createInitialState(body.roomId, body.hostName || body.teamName || body.clubName));
      return json({ ok: true, room: publicRoom(room), playerId: room.hostPlayerId });
    }

    const room = await this.load();
    if (!room) return error('ルームが見つかりません。', 404);

    if (action === 'state' && request.method === 'GET') {
      return json({ ok: true, room: publicRoom(room) });
    }

    if (action === 'join' && request.method === 'POST') {
      if (room.phase !== 'lobby') return error('このルームはすでに開始しています。');
      if (room.players.length >= MAX_PLAYERS) return error('参加人数が上限です。');
      const body = await readJson(request);
      const player = createPlayer(body.playerName || body.teamName || body.clubName || body.name, 'guest', room.players.length);
      room.players.push(player);
      await this.save(room);
      return json({ ok: true, room: publicRoom(room), playerId: player.id });
    }

    if (action === 'submit' && request.method === 'POST') {
      if (room.phase !== 'team-setup') return error('現在は編成・戦術を送信できるフェーズではありません。');
      const body = await readJson(request);
      const player = room.players.find(row => row.id === body.playerId);
      if (!player) return error('プレイヤーが見つかりません。', 404);
      if (!player.clubId) return error('ゲーム開始後に編成を送信してください。');
      completeSetupWork(room, player, body);
      await this.save(room);
      return json({ ok: true, room: publicRoom(room) });
    }

    if (action === 'ready' && request.method === 'POST') {
      if (room.phase !== 'lobby') return error('このフェーズでは準備完了操作はできません。');
      const body = await readJson(request);
      const player = room.players.find(row => row.id === body.playerId);
      if (!player) return error('プレイヤーが見つかりません。', 404);
      player.ready = Boolean(body.ready);
      await this.save(room);
      return json({ ok: true, room: publicRoom(room) });
    }

    if (action === 'run-season' && request.method === 'POST') {
      const body = await readJson(request);
      if (body.playerId !== room.hostPlayerId) return error('ホストのみ実行できます。', 403);
      if (room.phase === 'lobby') {
        if (!room.players.length) return error('参加者がいません。');
        if (!room.players.every(player => player.ready)) return error('全員の準備完了が必要です。');
        await this.save(assignClubsByJoinOrder(room));
        return json({ ok: true, room: publicRoom(room), message: 'クラブチーム名を割り当てました。' });
      }
      if (room.phase === 'season-ready') {
        return error('シーズン一括シミュレーション結果の送信が必要です。', 400);
      }
      return error('まだ全員の作業が完了していません。');
    }

    if (action === 'complete-season' && request.method === 'POST') {
      const body = await readJson(request);
      if (body.playerId !== room.hostPlayerId) return error('ホストのみ実行できます。', 403);
      if (room.phase !== 'season-ready') return error('シーズン実行できるフェーズではありません。');
      if (!body.seasonResult?.table?.length) return error('シーズン結果が不足しています。');
      await this.save(completeSeason(room, body.seasonResult));
      return json({ ok: true, room: publicRoom(room), message: 'シーズン結果を保存しました。' });
    }

    if (action === 'confirm-phase' && request.method === 'POST') {
      const body = await readJson(request);
      const player = room.players.find(row => row.id === body.playerId);
      if (!player) return error('プレイヤーが見つかりません。', 404);
      const updated = confirmCurrentPhase(room, player);
      if (!updated) return error('現在のフェーズでは確認完了できません。');
      await this.save(updated);
      return json({ ok: true, room: publicRoom(updated), message: 'フェーズ確認を保存しました。' });
    }

    return error('未対応のルーム操作です。', 404);
  }
}
