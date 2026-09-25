import { createMultiplayerLeagueFromRoom } from './multiplayer-league.js?v=0.18.0';
import { finalizeSeason, simulateRemainingSeason, standings } from './league.js?v=0.17.27';
import { createDraftPool } from './market.js?v=0.17.2';
import { createLineupPlacement, validateLineup } from './rules.js?v=0.17.2';
import { renderLineupEditor } from './ui.js?v=0.17.29';

const app = document.querySelector('#app');
const SESSION_KEY = 'football-league:multiplayer-session';
const SETUP_DRAFT_KEY = 'football-league:multiplayer-setup-draft';
const TACTICS = [
  ['BALANCED', 'バランス'],
  ['POSSESSION', 'ポゼッション'],
  ['DRIBBLE', 'ドリブル'],
  ['COUNTER', 'カウンター']
];
const SLOT_NAMES = ['GK', 'DF', 'MF 1', 'MF 2', 'FW'];
let currentRoom = null;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}[char]));

function injectMultiplayerStyles() {
  if (document.querySelector('[data-mp-style]')) return;
  document.head.insertAdjacentHTML('beforeend', `<style data-mp-style>
    .multiplayer-modal-backdrop{position:fixed;inset:0;background:#020617cc;backdrop-filter:blur(3px);z-index:80}
    .multiplayer-modal{position:fixed;z-index:81;left:50%;top:50%;transform:translate(-50%,-50%);width:min(460px,92vw);max-height:88vh;overflow:auto;background:#111827;border:1px solid #64748b;border-radius:18px;padding:1.2rem;box-shadow:0 24px 80px #000c}
    .multiplayer-actions{display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin:1rem 0}.multiplayer-actions button{width:100%;margin:0}
    .multiplayer-join-box{background:#0f172a;border:1px solid var(--line);border-radius:12px;padding:.85rem;margin-top:.8rem}.multiplayer-join-box button{width:100%;margin:.3rem 0 0}
    .multiplayer-room h1{font-size:clamp(2.4rem,9vw,5rem);line-height:.9;letter-spacing:-.06em;margin:.2rem 0 1rem}.room-id{font-size:clamp(2rem,9vw,4.2rem);letter-spacing:.12em;color:var(--accent);word-break:break-all}.multiplayer-room .hero{text-align:center}
    .mp-player-list{display:grid;gap:.55rem;margin:1rem 0}.mp-player-row{display:flex;align-items:center;justify-content:space-between;gap:.8rem;background:#0f172a;border:1px solid var(--line);border-radius:10px;padding:.65rem .8rem}.mp-player-row b{font-size:1rem}.mp-ready{color:#86efac;font-weight:900}.mp-not-ready{color:#fca5a5;font-weight:900}.mp-host-badge{display:inline-flex;margin-left:.4rem;padding:.1rem .4rem;border:1px solid #facc15;border-radius:999px;color:#facc15;font-size:.65rem;font-weight:900}
    .mp-assigned-club{display:grid;gap:.35rem;text-align:center}.mp-assigned-club b{font-size:clamp(1.7rem,7vw,3rem);color:var(--accent)}.mp-club-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.6rem;margin-top:1rem}.mp-club-card{background:#0f172a;border:1px solid var(--line);border-radius:10px;padding:.7rem}.mp-club-card.human{border-color:var(--accent)}.mp-club-card small{display:block;margin-top:.25rem}
    .mp-work-summary{background:#0f172a;border:1px solid var(--line);border-radius:12px;padding:.85rem;margin:1rem 0}.mp-work-summary b{color:#fff}.mp-incomplete{margin:.35rem 0 0;padding-left:1.2rem}.mp-incomplete li{margin:.15rem 0;color:#fca5a5;font-weight:800}
    .mp-result-table{width:100%;border-collapse:collapse}.mp-result-table th,.mp-result-table td{padding:.55rem;border-bottom:1px solid var(--line);text-align:left}.mp-result-table tr.you{background:#17255466}
    .mp-setup-editor{display:grid;gap:1rem}.mp-setup-editor .lineup-editor{margin-top:.5rem}.mp-tactic-panel{background:#0f172a;border:1px solid var(--line);border-radius:12px;padding:.85rem}.mp-tactic-panel label{max-width:360px}
    @media(max-width:560px){.multiplayer-actions{grid-template-columns:1fr}.multiplayer-modal{padding:.9rem}.multiplayer-room .season-result-actions button{width:100%;margin:.3rem 0}.mp-player-row{align-items:flex-start;flex-direction:column}.mp-result-table{font-size:.8rem}}
  </style>`);
}

injectMultiplayerStyles();

function readSession(roomId = null) {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!session) return null;
    if (roomId && session.roomId !== roomId) return null;
    return session;
  } catch {
    return null;
  }
}

function saveSession(roomId, playerId, teamName, playerToken) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, playerId, playerToken, playerName: teamName, teamName }));
}

function draftKey(roomId, playerId) {
  return `${SETUP_DRAFT_KEY}:${roomId}:${playerId}`;
}

function readSetupDraft(roomId, playerId) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(roomId, playerId)) || 'null') || {};
  } catch {
    return {};
  }
}

function saveSetupDraft(roomId, playerId, draft) {
  localStorage.setItem(draftKey(roomId, playerId), JSON.stringify(draft));
}

function clearSetupDraft(roomId, playerId) {
  localStorage.removeItem(draftKey(roomId, playerId));
}

const requestJson = async (url, options = {}) => {
  const auth = readSession();
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(auth?.playerToken ? { 'x-player-token': auth.playerToken } : {}), ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { throw new Error('APIからJSON以外の応答が返りました。Cloudflare Workerが未接続の可能性があります。'); }
  if (!response.ok) throw new Error(data?.error || data?.message || `通信エラー ${response.status}`);
  return data;
};

function removeModal() {
  document.querySelectorAll('.multiplayer-modal-backdrop,.multiplayer-modal').forEach(node => node.remove());
}

function normalizeTeamName() {
  const name = document.querySelector('[data-mp-team-name]')?.value.trim();
  if (!name) return { error: 'クラブチーム名を入力してください。' };
  if (name.length > 12) return { error: 'クラブチーム名は12文字以内にしてください。' };
  return { name };
}

function showModeModal() {
  removeModal();
  document.body.insertAdjacentHTML('beforeend', `<div class="multiplayer-modal-backdrop" data-mp-close></div>
    <section class="multiplayer-modal" role="dialog" aria-modal="true" aria-label="マルチプレイ">
      <div class="overlay-heading"><div><p class="eyebrow">MULTIPLAYER</p><h2>マルチプレイ</h2></div><button type="button" data-mp-close class="subtle">閉じる</button></div>
      <p class="hint">クラブチーム名を入力して、ルームを作成するか参加します。</p>
      <label>クラブチーム名<input data-mp-team-name maxlength="12" placeholder="例：ヨコハマFC"></label>
      <div class="multiplayer-actions">
        <button type="button" data-mp-create>ルームを作成</button>
        <button type="button" data-mp-join-open class="subtle">ルームに参加</button>
      </div>
      <section class="multiplayer-join-box" hidden>
        <label>ルームID<input data-mp-room-id placeholder="例：ABC123"></label>
        <button type="button" data-mp-join>参加</button>
      </section>
      <p class="lineup-error" data-mp-error hidden></p>
    </section>`);
  const session = readSession();
  if (session?.teamName || session?.playerName) document.querySelector('[data-mp-team-name]').value = session.teamName || session.playerName;
}

function roomIdOf(data) {
  return data?.roomId || data?.room?.id || data?.room?.roomId || data?.id;
}

function phaseLabel(phase) {
  return ({ lobby: '待機中', 'team-setup': 'チーム準備', 'season-ready': 'シーズン開始待ち', 'season-result': 'シーズン結果', 'game-complete': '10シーズン完了', 'offseason-events': '契約・要求・特別特訓', 'offseason-events-ready': 'イベント確定待ち', development: '育成', 'development-ready': '育成確定待ち', 'growth-result': '成長結果', release: '選手整理', 'release-ready': '選手整理確定待ち', draft: 'ドラフト', 'draft-ready': 'ドラフト確定待ち', auction: '競売', 'auction-ready': '開札待ち' }[phase] || phase || 'ROOM');
}

function teamNameById(players, playerId) {
  const player = players.find(candidate => candidate.id === playerId);
  return player?.teamName || player?.name || null;
}

function clubName(clubs, clubId) {
  return clubs.find(club => club.id === clubId)?.name || clubId || '開始前';
}

function stableSeasonSeed(room) {
  const source = room?.room || room;
  return `${roomIdOf(source)}:season:${source?.leagueState?.season || 1}`;
}

function cloneLeague(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function createPreviewLeague(room) {
  const source = room?.room || room;
  return source?.leagueState?.clubs?.length ? cloneLeague(source.leagueState) : createMultiplayerLeagueFromRoom(source, stableSeasonSeed(source));
}

function clubForPlayer(room, player) {
  if (!player) return null;
  return createPreviewLeague(room).clubs.find(club => club.multiplayerPlayerId === player.id) || null;
}

function validTactic(value) {
  return TACTICS.some(([key]) => key === value) ? value : 'BALANCED';
}

function validLineupForClub(club, lineup) {
  const ids = new Set(club.roster.map(player => player.id));
  const next = Array.isArray(lineup) ? lineup.filter(id => ids.has(id)) : [];
  return next.length === 5 && new Set(next).size === 5 ? next : [...club.lineup];
}

function getSetupDraft(room, player, club) {
  const roomId = roomIdOf(room);
  const stored = readSetupDraft(roomId, player.id);
  const submitted = Array.isArray(player.submitted?.lineup) && player.submitted.lineup.length ? player.submitted.lineup : null;
  const lineup = validLineupForClub(club, stored.lineup || submitted || club.lineup);
  const selectedExists = club.roster.some(candidate => candidate.id === stored.selectedPlayerId);
  return {
    lineup,
    tactic: validTactic(stored.tactic || player.submitted?.tactic || club.tactic),
    selectedPlayerId: selectedExists ? stored.selectedPlayerId : null,
    benchSort: ['position', 'overall'].includes(stored.benchSort) ? stored.benchSort : 'position',
    message: stored.message || '',
    messageIsError: Boolean(stored.messageIsError)
  };
}

function applyDraftToClub(club, draft) {
  club.lineup = [...draft.lineup];
  club.tactic = draft.tactic;
  return club;
}

function setupContext() {
  if (!currentRoom) return null;
  const roomId = roomIdOf(currentRoom);
  const session = readSession(roomId);
  if (!session?.playerId) return null;
  const players = currentRoom?.players || currentRoom?.room?.players || [];
  const player = players.find(candidate => candidate.id === session.playerId);
  if (!player || player.phaseComplete) return null;
  const club = clubForPlayer(currentRoom, player);
  if (!club) return null;
  const draft = getSetupDraft(currentRoom, player, club);
  applyDraftToClub(club, draft);
  return { room: currentRoom, roomId, session, player, club, draft };
}

function saveAndRenderSetup(context, draft) {
  saveSetupDraft(context.roomId, context.player.id, draft);
  renderRoomScreen(context.room, context.player.id);
}

function applySubmittedSetups(league, room) {
  const players = room?.players || room?.room?.players || [];
  for (const player of players) {
    const club = league.clubs.find(candidate => candidate.multiplayerPlayerId === player.id);
    if (!club) continue;
    const lineup = validLineupForClub(club, player.submitted?.lineup);
    club.lineup = lineup;
    club.tactic = validTactic(player.submitted?.tactic || club.tactic);
  }
}

function playerStatus(player, phase) {
  if (phase === 'lobby') return player.ready ? ['準備完了', 'mp-ready'] : ['未準備', 'mp-not-ready'];
  if (phase === 'team-setup') return player.phaseComplete ? ['作業完了', 'mp-ready'] : ['作業中', 'mp-not-ready'];
  if (phase === 'season-ready') return ['完了', 'mp-ready'];
  if (phase === 'season-result') return player.phaseComplete ? ['確認完了', 'mp-ready'] : ['未確認', 'mp-not-ready'];
  if (phase === 'offseason-events') return player.phaseComplete ? ['作業完了', 'mp-ready'] : ['作業中', 'mp-not-ready'];
  if (phase === 'offseason-events-ready') return ['完了', 'mp-ready'];
  if (phase === 'development') return player.phaseComplete ? ['育成入力完了', 'mp-ready'] : ['育成入力中', 'mp-not-ready'];
  if (phase === 'development-ready') return ['完了', 'mp-ready'];
  if (phase === 'growth-result') return player.phaseComplete ? ['確認完了', 'mp-ready'] : ['未確認', 'mp-not-ready'];
  if (phase === 'release') return player.phaseComplete ? ['選手整理完了', 'mp-ready'] : ['選手整理中', 'mp-not-ready'];
  if (phase === 'release-ready') return ['完了', 'mp-ready'];
  if (phase === 'draft') return player.phaseComplete ? ['指名済み', 'mp-ready'] : ['未指名', 'mp-not-ready'];
  if (phase === 'draft-ready') return ['入力完了', 'mp-ready'];
  if (phase === 'auction') return player.phaseComplete ? ['入札済み', 'mp-ready'] : ['未入力', 'mp-not-ready'];
  if (phase === 'auction-ready') return ['入札済み', 'mp-ready'];
  if (phase === 'game-complete') return ['完了', 'mp-ready'];
  return [player.ready ? '完了' : '未完了', player.ready ? 'mp-ready' : 'mp-not-ready'];
}

function renderAssignedClub(room, localPlayer) {
  const phase = room?.phase || room?.room?.phase;
  const clubs = room?.clubs || room?.room?.clubs || [];
  const players = room?.players || room?.room?.players || [];
  if (!['team-setup', 'season-ready', 'season-result', 'game-complete', 'offseason-events', 'offseason-events-ready', 'development', 'development-ready', 'growth-result', 'release', 'release-ready', 'draft', 'draft-ready', 'auction', 'auction-ready'].includes(phase)) return '';
  const assignedClub = clubs.find(club => club.playerId === localPlayer?.id) || clubs.find(club => club.id === localPlayer?.clubId);
  const yourClub = assignedClub ? assignedClub.name : '未割り当て';
  return `<section class="hero mp-assigned-club">
    <p class="eyebrow">YOUR CLUB</p>
    <p>あなたのクラブチーム</p>
    <b>${escapeHtml(yourClub)}</b>
    <p class="hint">入力したクラブチーム名で参加します。枠は参加順で割り当てられます。</p>
  </section>
  <section class="match-card">
    <h2>クラブチーム一覧</h2>
    <div class="mp-club-grid">${clubs.map(club => `<div class="mp-club-card ${club.controller === 'HUMAN' ? 'human' : ''}"><b>${escapeHtml(club.name)}</b><small>${club.controller === 'HUMAN' ? escapeHtml(teamNameById(players, club.playerId) || '参加者') : 'CPU'}</small></div>`).join('')}</div>
  </section>`;
}

function renderWorkSummary(players, phase) {
  if (phase === 'lobby') return '';
  if (phase === 'season-ready') return `<section class="mp-work-summary"><b>全員完了</b><p class="hint">参加クラブ全員の作業が完了したので、シーズン開始待ちです。</p></section>`;
  if (phase === 'season-result') return `<section class="mp-work-summary"><b>シーズン完了</b><p class="hint">ホストがシーズン結果を共有しました。</p></section>`;
  if (phase !== 'team-setup') return '';
  const done = players.filter(player => player.phaseComplete).length;
  const incomplete = players.filter(player => !player.phaseComplete);
  return `<section class="mp-work-summary"><b>作業状況：${done}/${players.length} 完了</b>${incomplete.length ? `<p class="hint">まだ完了していないクラブ：</p><ul class="mp-incomplete">${incomplete.map(player => `<li>${escapeHtml(player.teamName || player.name || 'クラブ')}</li>`).join('')}</ul>` : '<p class="hint">全員完了しました。次フェーズへ進みます。</p>'}</section>`;
}

function renderSetupEditor(room, localPlayer) {
  const phase = room?.phase || room?.room?.phase;
  if (phase !== 'team-setup' || !localPlayer || localPlayer.phaseComplete) return '';
  const club = clubForPlayer(room, localPlayer);
  if (!club) return `<section class="match-card"><h2>編成・戦術</h2><p class="lineup-error">担当クラブを取得できませんでした。更新してください。</p></section>`;
  const draft = getSetupDraft(room, localPlayer, club);
  applyDraftToClub(club, draft);
  return `<section class="match-card mp-setup-editor">
    <div>
      <h2>編成・戦術</h2>
      <p class="hint">シングルプレイと同じ編成画面です。選手を選び、配置したい枠を押してください。</p>
    </div>
    <section class="mp-tactic-panel">
      <label>戦術
        <select data-mp-tactic>${TACTICS.map(([key, label]) => `<option value="${key}" ${key === draft.tactic ? 'selected' : ''}>${label}</option>`).join('')}</select>
      </label>
    </section>
    ${renderLineupEditor(club, draft.selectedPlayerId, draft.message, draft.messageIsError, draft.benchSort)}
  </section>`;
}

function buildSeasonResult(room) {
  const seed = stableSeasonSeed(room);
  const source = room?.room || room;
  const league = source?.leagueState?.clubs?.length ? cloneLeague(source.leagueState) : createMultiplayerLeagueFromRoom(source, seed);
  applySubmittedSetups(league, room);
  const simulation = simulateRemainingSeason(league);
  finalizeSeason(league);
  const table = standings(league).map(row => ({
    rank: row.rank,
    clubId: row.club.id,
    clubName: row.club.name,
    color: row.club.color,
    controllerType: row.club.controllerType,
    points: row.points,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference
  }));
  return {
    seed,
    season: league.season,
    matchesProcessed: simulation.matchesProcessed,
    table,
    completedAt: new Date().toISOString(),
    leagueState: league
  };
}

function renderSeasonResult(room, localPlayer) {
  const result = room?.seasonResult || room?.room?.seasonResult;
  const phase = room?.phase || room?.room?.phase;
  if (!['season-result', 'game-complete'].includes(phase) || !result) return '';
  const localClubId = clubForPlayer(room, localPlayer)?.id;
  const rows = result.table || [];
  return `<section class="match-card">
    <h2>シーズン結果</h2>
    <p class="hint">処理試合数：${escapeHtml(result.matchesProcessed ?? '-')}試合</p>
    ${phase === 'game-complete' ? '<p><b>10シーズン完了</b></p><p class="hint">このルームの全シーズンが終了しました。</p>' : ''}
    <div class="table-wrap"><table class="mp-result-table"><thead><tr><th>順位</th><th>クラブ</th><th>勝点</th><th>勝</th><th>分</th><th>敗</th><th>得</th><th>失</th><th>差</th></tr></thead><tbody>${rows.map(row => `<tr class="${row.clubId === localClubId ? 'you' : ''}"><td>${row.rank}</td><td>${escapeHtml(row.clubName)}</td><td>${row.points}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.losses}</td><td>${row.goalsFor}</td><td>${row.goalsAgainst}</td><td>${row.goalDifference}</td></tr>`).join('')}</tbody></table></div>
  </section>`;
}

function renderRoomScreen(room, playerId = null) {
  currentRoom = room?.room || room;
  const rawId = roomIdOf(room) || room?.roomId || '未取得';
  const session = readSession(rawId);
  const localPlayerId = playerId || session?.playerId || null;
  const id = escapeHtml(rawId);
  const phase = room?.phase || room?.room?.phase || 'ROOM';
  const players = room?.players || room?.room?.players || [];
  const clubs = room?.clubs || room?.room?.clubs || [];
  const localPlayer = players.find(player => player.id === localPlayerId);
  const isHost = localPlayerId && localPlayerId === (room?.hostPlayerId || room?.room?.hostPlayerId);
  const allReady = players.length > 0 && players.every(player => player.ready);
  const isLobby = phase === 'lobby';
  const isTeamSetup = phase === 'team-setup';
  app.innerHTML = `<main class="multiplayer-room">
    <p class="eyebrow">MULTIPLAYER ROOM</p>
    <h1>ルーム</h1>
    <section class="hero">
      <p>ルームID</p>
      <h2 class="room-id">${id}</h2>
      <p class="hint">このIDを参加者に共有してください。</p>
    </section>
    ${renderAssignedClub(room, localPlayer)}
    ${renderSetupEditor(room, localPlayer)}
    ${renderSeasonResult(room, localPlayer)}
    <section class="match-card">
      <h2>現在の状態</h2>
      <p>フェーズ：<b>${escapeHtml(phaseLabel(phase))}</b></p>
      <p>参加クラブ：<b>${players.length}</b>チーム</p>
      ${renderWorkSummary(players, phase)}
      ${players.length ? `<div class="mp-player-list">${players.map(player => { const [label, klass] = playerStatus(player, phase); return `<div class="mp-player-row" style="--accent:${escapeHtml(player.color || '#4ade80')}"><span><b>${escapeHtml(player.teamName || player.name || 'クラブ')}</b>${player.id === (room?.hostPlayerId || room?.room?.hostPlayerId) ? '<span class="mp-host-badge">HOST</span>' : ''}<br><small>${escapeHtml(isLobby ? '開始前' : clubName(clubs, player.clubId))}</small></span><span class="${klass}">${label}</span></div>`; }).join('')}</div>` : '<p class="hint">まだ参加クラブはありません。</p>'}
    </section>
    <div class="season-result-actions">
      ${localPlayer && isLobby ? `<button type="button" data-mp-ready="${id}" data-mp-ready-value="${localPlayer.ready ? 'false' : 'true'}">${localPlayer.ready ? '準備完了解除' : '準備完了'}</button>` : ''}
      ${isHost && isLobby ? `<button type="button" data-mp-start="${id}" ${allReady ? '' : 'disabled'}>ゲーム開始</button>` : ''}
      ${localPlayer && isTeamSetup ? `<button type="button" data-mp-submit-setup="${id}" ${localPlayer.phaseComplete ? 'disabled' : ''}>${localPlayer.phaseComplete ? '作業完了済み' : '編成・戦術を送信'}</button>` : ''}
      ${phase === 'season-ready' && isHost ? `<button type="button" data-mp-simulate-season="${id}">シーズンをシミュレート</button>` : ''}
      <button type="button" data-mp-refresh="${id}" class="subtle">更新</button>
      <button type="button" data-mp-back-title class="subtle">タイトルへ戻る</button>
    </div>
    ${isHost && isLobby && !allReady ? '<p class="hint">ゲーム開始は、参加クラブ全員が準備完了になると押せます。</p>' : ''}
    ${isTeamSetup ? '<p class="hint">選んだ編成・戦術はシーズン一括シミュレーションに反映されます。</p>' : ''}
    ${phase === 'season-ready' && isHost ? '<p class="hint">各クラブが送信した編成・戦術でシーズンを一括シミュレートします。</p>' : ''}
  </main>`;
}

async function createRoom() {
  const error = document.querySelector('[data-mp-error]');
  const result = normalizeTeamName();
  if (result.error) {
    if (error) { error.textContent = result.error; error.hidden = false; }
    return;
  }
  try {
    if (error) error.hidden = true;
    const data = await requestJson('/api/rooms', { method: 'POST', body: JSON.stringify({ hostName: result.name, teamName: result.name }) });
    const room = data?.room || data;
    const roomId = roomIdOf(room);
    if (roomId && data?.playerId) saveSession(roomId, data.playerId, result.name, data.playerToken);
    removeModal();
    renderRoomScreen(room, data?.playerId);
  } catch (err) {
    if (error) { error.textContent = err.message; error.hidden = false; }
  }
}

async function joinRoom() {
  const error = document.querySelector('[data-mp-error]');
  const result = normalizeTeamName();
  const roomId = document.querySelector('[data-mp-room-id]')?.value.trim();
  if (result.error) {
    if (error) { error.textContent = result.error; error.hidden = false; }
    return;
  }
  if (!roomId) {
    if (error) { error.textContent = 'ルームIDを入力してください。'; error.hidden = false; }
    return;
  }
  try {
    if (error) error.hidden = true;
    const data = await requestJson(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      body: JSON.stringify({ playerName: result.name, teamName: result.name })
    });
    const room = data?.room || data;
    const resolvedRoomId = roomIdOf(room) || roomId;
    if (resolvedRoomId && data?.playerId) saveSession(resolvedRoomId, data.playerId, result.name, data.playerToken);
    removeModal();
    renderRoomScreen(room, data?.playerId);
  } catch (err) {
    if (error) { error.textContent = err.message; error.hidden = false; }
  }
}

async function refreshRoom(roomId) {
  try {
    const data = await requestJson(`/api/rooms/${encodeURIComponent(roomId)}`);
    let room = data?.room || data;
    const session = readSession(roomId);
    if (room?.phase === 'team-setup' && !room?.leagueState && session?.playerId === room?.hostPlayerId) {
      room = await initializeFirstDraft(room, session.playerId);
    }
    renderRoomScreen(room);
  } catch (err) {
    alert(err.message);
  }
}

async function setReady(roomId, ready) {
  const session = readSession(roomId);
  if (!session?.playerId) {
    alert('この端末の参加情報が見つかりません。入り直してください。');
    return;
  }
  try {
    const data = await requestJson(`/api/rooms/${encodeURIComponent(roomId)}/ready`, {
      method: 'POST',
      body: JSON.stringify({ playerId: session.playerId, ready })
    });
    renderRoomScreen(data?.room || data, session.playerId);
  } catch (err) {
    alert(err.message);
  }
}

async function submitSetup(roomId) {
  const session = readSession(roomId);
  if (!session?.playerId) {
    alert('この端末の参加情報が見つかりません。入り直してください。');
    return;
  }
  const context = setupContext();
  if (!context) {
    alert('編成情報を取得できませんでした。更新してください。');
    return;
  }
  const validation = validateLineup(context.club, context.draft.lineup);
  if (!validation.ok) {
    saveAndRenderSetup(context, { ...context.draft, message: validation.error, messageIsError: true });
    return;
  }
  try {
    const data = await requestJson(`/api/rooms/${encodeURIComponent(roomId)}/submit`, {
      method: 'POST',
      body: JSON.stringify({ playerId: session.playerId, lineup: context.draft.lineup, tactic: context.draft.tactic, ready: true })
    });
    clearSetupDraft(roomId, session.playerId);
    renderRoomScreen(data?.room || data, session.playerId);
  } catch (err) {
    alert(err.message);
  }
}

async function initializeFirstDraft(room, playerId) {
  const league = createMultiplayerLeagueFromRoom(room, stableSeasonSeed(room));
  league.clubs.forEach(club => { club.reserveAuctionSlot = false; });
  const draftState = {
    round: 1,
    mode: 'SIMULTANEOUS',
    pool: createDraftPool(league.seed, 1),
    pendingClubIds: league.clubs.filter(club => club.funds >= 1 && club.roster.length < 12).map(club => club.id),
    order: [],
    orderIndex: 0,
    declinedClubIds: [],
    resolveStep: 0,
    lastResult: null,
    completed: false
  };
  const data = await requestJson(`/api/rooms/${encodeURIComponent(roomIdOf(room))}/initialize-draft`, {
    method: 'POST',
    body: JSON.stringify({ playerId, leagueState: league, draftState })
  });
  return data?.room || data;
}

async function startGame(roomId) {
  const session = readSession(roomId);
  if (!session?.playerId) {
    alert('この端末の参加情報が見つかりません。入り直してください。');
    return;
  }
  try {
    const data = await requestJson(`/api/rooms/${encodeURIComponent(roomId)}/run-season`, {
      method: 'POST',
      body: JSON.stringify({ playerId: session.playerId })
    });
    let nextRoom = data?.room || data;
    if (nextRoom?.phase === 'team-setup' && !nextRoom?.leagueState) {
      nextRoom = await initializeFirstDraft(nextRoom, session.playerId);
    }
    renderRoomScreen(nextRoom, session.playerId);
  } catch (err) {
    alert(err.message);
  }
}

async function simulateSeason(roomId) {
  const session = readSession(roomId);
  if (!session?.playerId) {
    alert('この端末の参加情報が見つかりません。入り直してください。');
    return;
  }
  try {
    const prepared = await requestJson(`/api/rooms/${encodeURIComponent(roomId)}/prepare-season-resolution`, {
      method: 'POST',
      body: JSON.stringify({ playerId: session.playerId })
    });
    const room = { roomId, leagueState: prepared.leagueState, players: prepared.players };
    const seasonResult = buildSeasonResult(room);
    const data = await requestJson(`/api/rooms/${encodeURIComponent(roomId)}/complete-season`, {
      method: 'POST',
      body: JSON.stringify({ playerId: session.playerId, seasonResult })
    });
    renderRoomScreen(data?.room || data, session.playerId);
  } catch (err) {
    alert(err.message);
  }
}

function handleLineupPlayer(playerId) {
  const context = setupContext();
  if (!context) return;
  saveAndRenderSetup(context, { ...context.draft, selectedPlayerId: playerId, message: '', messageIsError: false });
}

function handleLineupSlot(slotValue) {
  const context = setupContext();
  if (!context || !context.draft.selectedPlayerId) return;
  const slotIndex = Number(slotValue);
  const selected = context.club.roster.find(player => player.id === context.draft.selectedPlayerId);
  const nextLineup = createLineupPlacement(context.draft.lineup, context.draft.selectedPlayerId, slotIndex);
  if (!nextLineup) return;
  const validation = validateLineup(context.club, nextLineup);
  if (!validation.ok) {
    saveAndRenderSetup(context, { ...context.draft, message: validation.error, messageIsError: true });
    return;
  }
  const warningText = validation.warnings.length ? ' 適性外配置があります。' : '';
  saveAndRenderSetup(context, {
    ...context.draft,
    lineup: nextLineup,
    selectedPlayerId: null,
    message: `${selected?.name || '選手'}を${SLOT_NAMES[slotIndex] || '枠'}へ配置しました。${warningText}`,
    messageIsError: false
  });
}

function handleBenchSort(value) {
  const context = setupContext();
  if (!context) return;
  saveAndRenderSetup(context, { ...context.draft, benchSort: value === 'overall' ? 'overall' : 'position' });
}

function handleTactic(value) {
  const context = setupContext();
  if (!context) return;
  saveAndRenderSetup(context, { ...context.draft, tactic: validTactic(value) });
}

function attachTitleButton() {
  const title = document.querySelector('main.title');
  if (!title || title.querySelector('[data-mp-open]')) return;
  const loadButton = title.querySelector('[data-stage19="loadTitle"]');
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.mpOpen = 'true';
  button.className = 'subtle';
  button.textContent = 'マルチプレイ';
  if (loadButton) loadButton.insertAdjacentElement('afterend', button);
  else title.appendChild(button);
}

const observer = new MutationObserver(attachTitleButton);
observer.observe(app, { childList: true, subtree: true });
attachTitleButton();

document.addEventListener('click', event => {
  const playerId = event.target.closest('.multiplayer-room [data-lineup-player]')?.dataset.lineupPlayer;
  const slotValue = event.target.closest('.multiplayer-room [data-lineup-slot]')?.dataset.lineupSlot;
  if (playerId) {
    event.preventDefault();
    event.stopPropagation();
    handleLineupPlayer(playerId);
    return;
  }
  if (slotValue !== undefined) {
    event.preventDefault();
    event.stopPropagation();
    handleLineupSlot(slotValue);
  }
}, true);

document.addEventListener('change', event => {
  if (event.target.closest('.multiplayer-room [data-bench-sort]')) {
    event.preventDefault();
    event.stopPropagation();
    handleBenchSort(event.target.value);
    return;
  }
  if (event.target.closest('.multiplayer-room [data-mp-tactic]')) {
    handleTactic(event.target.value);
  }
}, true);

document.addEventListener('click', event => {
  if (event.target.closest('[data-mp-open]')) showModeModal();
  if (event.target.closest('[data-mp-close]')) removeModal();
  if (event.target.closest('[data-mp-join-open]')) {
    const box = document.querySelector('.multiplayer-join-box');
    if (box) box.hidden = false;
    document.querySelector('[data-mp-room-id]')?.focus();
  }
  if (event.target.closest('[data-mp-create]')) createRoom();
  if (event.target.closest('[data-mp-join]')) joinRoom();
  const readyButton = event.target.closest('[data-mp-ready]');
  if (readyButton) setReady(readyButton.dataset.mpReady, readyButton.dataset.mpReadyValue === 'true');
  const setup = event.target.closest('[data-mp-submit-setup]')?.dataset.mpSubmitSetup;
  if (setup) submitSetup(setup);
  const start = event.target.closest('[data-mp-start]')?.dataset.mpStart;
  if (start) startGame(start);
  const simulate = event.target.closest('[data-mp-simulate-season]')?.dataset.mpSimulateSeason;
  if (simulate) simulateSeason(simulate);
  const refresh = event.target.closest('[data-mp-refresh]')?.dataset.mpRefresh;
  if (refresh) refreshRoom(refresh);
  if (event.target.closest('[data-mp-back-title]')) location.reload();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') removeModal();
  if (event.key === 'Enter' && event.target.matches('[data-mp-room-id]')) joinRoom();
});