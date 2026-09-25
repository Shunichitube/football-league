const app = document.querySelector('#app');
const SESSION_KEY = 'football-league:multiplayer-session';

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
    @media(max-width:560px){.multiplayer-actions{grid-template-columns:1fr}.multiplayer-modal{padding:.9rem}.multiplayer-room .season-result-actions button{width:100%;margin:.3rem 0}.mp-player-row{align-items:flex-start;flex-direction:column}}
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

function saveSession(roomId, playerId, teamName) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, playerId, playerName: teamName, teamName }));
}

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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
  return ({ lobby: '待機中', 'team-setup': 'チーム準備' }[phase] || phase || 'ROOM');
}

function teamNameById(players, playerId) {
  const player = players.find(candidate => candidate.id === playerId);
  return player?.teamName || player?.name || null;
}

function clubName(clubs, clubId) {
  return clubs.find(club => club.id === clubId)?.name || clubId || '開始前';
}

function renderAssignedClub(room, localPlayer) {
  const clubs = room?.clubs || room?.room?.clubs || [];
  const players = room?.players || room?.room?.players || [];
  if ((room?.phase || room?.room?.phase) !== 'team-setup') return '';
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

function renderRoomScreen(room, playerId = null) {
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
  app.innerHTML = `<main class="multiplayer-room">
    <p class="eyebrow">MULTIPLAYER ROOM</p>
    <h1>ルーム</h1>
    <section class="hero">
      <p>ルームID</p>
      <h2 class="room-id">${id}</h2>
      <p class="hint">このIDを参加者に共有してください。</p>
    </section>
    ${renderAssignedClub(room, localPlayer)}
    <section class="match-card">
      <h2>現在の状態</h2>
      <p>フェーズ：<b>${escapeHtml(phaseLabel(phase))}</b></p>
      <p>参加クラブ：<b>${players.length}</b>チーム</p>
      ${players.length ? `<div class="mp-player-list">${players.map(player => `<div class="mp-player-row" style="--accent:${escapeHtml(player.color || '#4ade80')}"><span><b>${escapeHtml(player.teamName || player.name || 'クラブ')}</b>${player.id === (room?.hostPlayerId || room?.room?.hostPlayerId) ? '<span class="mp-host-badge">HOST</span>' : ''}<br><small>${escapeHtml(isLobby ? '開始前' : clubName(clubs, player.clubId))}</small></span><span class="${player.ready ? 'mp-ready' : 'mp-not-ready'}">${player.ready ? '準備完了' : '未準備'}</span></div>`).join('')}</div>` : '<p class="hint">まだ参加クラブはありません。</p>'}
    </section>
    <div class="season-result-actions">
      ${localPlayer && isLobby ? `<button type="button" data-mp-ready="${id}" data-mp-ready-value="${localPlayer.ready ? 'false' : 'true'}">${localPlayer.ready ? '準備完了解除' : '準備完了'}</button>` : ''}
      ${isHost && isLobby ? `<button type="button" data-mp-start="${id}" ${allReady ? '' : 'disabled'}>ゲーム開始</button>` : ''}
      ${phase === 'team-setup' ? '<button type="button" disabled>編成画面へ（未実装）</button>' : ''}
      <button type="button" data-mp-refresh="${id}" class="subtle">更新</button>
      <button type="button" data-mp-back-title class="subtle">タイトルへ戻る</button>
    </div>
    ${isHost && isLobby && !allReady ? '<p class="hint">ゲーム開始は、参加クラブ全員が準備完了になると押せます。</p>' : ''}
    ${phase === 'team-setup' ? '<p class="hint">次は、このクラブチームで各自の編成・戦術画面へ進む処理を接続します。</p>' : ''}
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
    if (roomId && data?.playerId) saveSession(roomId, data.playerId, result.name);
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
    if (resolvedRoomId && data?.playerId) saveSession(resolvedRoomId, data.playerId, result.name);
    removeModal();
    renderRoomScreen(room, data?.playerId);
  } catch (err) {
    if (error) { error.textContent = err.message; error.hidden = false; }
  }
}

async function refreshRoom(roomId) {
  try {
    const data = await requestJson(`/api/rooms/${encodeURIComponent(roomId)}`);
    renderRoomScreen(data?.room || data);
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
    renderRoomScreen(data?.room || data, session.playerId);
  } catch (err) {
    alert(err.message);
  }
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
  loadButton?.insertAdjacentElement('afterend', button);
}

const observer = new MutationObserver(attachTitleButton);
observer.observe(app, { childList: true, subtree: true });
attachTitleButton();

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
  const start = event.target.closest('[data-mp-start]')?.dataset.mpStart;
  if (start) startGame(start);
  const refresh = event.target.closest('[data-mp-refresh]')?.dataset.mpRefresh;
  if (refresh) refreshRoom(refresh);
  if (event.target.closest('[data-mp-back-title]')) location.reload();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') removeModal();
  if (event.key === 'Enter' && event.target.matches('[data-mp-room-id]')) joinRoom();
});
