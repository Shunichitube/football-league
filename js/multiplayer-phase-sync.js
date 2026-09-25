const SESSION_KEY = 'football-league:multiplayer-session';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}[char]));

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

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { throw new Error('APIからJSON以外の応答が返りました。'); }
  if (!response.ok) throw new Error(data?.error || data?.message || `通信エラー ${response.status}`);
  return data;
}

function roomIdFromScreen() {
  return document.querySelector('.multiplayer-room .room-id')?.textContent?.trim() || null;
}

function statusForPhase(phase, player) {
  if (phase === 'season-result') return player.phaseComplete ? '確認完了' : '未確認';
  if (phase === 'offseason-ready') return '確認完了';
  return player.phaseComplete || player.ready ? '完了' : '未完了';
}

function statusClass(phase, player) {
  return phase === 'offseason-ready' || player.phaseComplete || player.ready ? 'mp-ready' : 'mp-not-ready';
}

function renderConfirmPanel(room, localPlayer) {
  if (!['season-result', 'offseason-ready'].includes(room.phase)) return '';
  const done = room.phase === 'offseason-ready'
    ? room.players.length
    : room.players.filter(player => player.phaseComplete).length;
  const incomplete = room.phase === 'offseason-ready' ? [] : room.players.filter(player => !player.phaseComplete);
  const localDone = room.phase === 'offseason-ready' || Boolean(localPlayer?.phaseComplete);
  return `<section class="match-card" data-mp-phase-sync-panel>
    <h2>次フェーズ確認</h2>
    <p class="hint">全員が確認完了するまで次フェーズへ進みません。</p>
    <div class="mp-work-summary">
      <b>確認状況：${done}/${room.players.length} 完了</b>
      ${incomplete.length ? `<p class="hint">まだ確認していないクラブ：</p><ul class="mp-incomplete">${incomplete.map(player => `<li>${escapeHtml(player.teamName || player.name || 'クラブ')}</li>`).join('')}</ul>` : '<p class="hint">全員確認完了です。次フェーズへ進みました。</p>'}
    </div>
    <div class="mp-player-list">${room.players.map(player => `<div class="mp-player-row" style="--accent:${escapeHtml(player.color || '#4ade80')}"><span><b>${escapeHtml(player.teamName || player.name || 'クラブ')}</b>${player.id === room.hostPlayerId ? '<span class="mp-host-badge">HOST</span>' : ''}</span><span class="${statusClass(room.phase, player)}">${escapeHtml(statusForPhase(room.phase, player))}</span></div>`).join('')}</div>
    ${room.phase === 'season-result' && localPlayer ? `<button type="button" data-mp-confirm-phase="${escapeHtml(room.roomId)}" ${localDone ? 'disabled' : ''}>${localDone ? '確認完了済み' : '結果確認完了'}</button>` : ''}
    ${room.phase === 'offseason-ready' ? '<p class="hint">次はオフシーズン同期レイヤーを接続します。</p>' : ''}
  </section>`;
}

async function loadRoom(roomId) {
  const data = await requestJson(`/api/rooms/${encodeURIComponent(roomId)}`);
  return data?.room || data;
}

async function renderPhaseSyncPanel() {
  const roomScreen = document.querySelector('.multiplayer-room');
  if (!roomScreen) return;
  const roomId = roomIdFromScreen();
  if (!roomId) return;
  let room;
  try { room = await loadRoom(roomId); }
  catch { return; }
  document.querySelector('[data-mp-phase-sync-panel]')?.remove();
  const session = readSession(roomId);
  const localPlayer = room.players?.find(player => player.id === session?.playerId) || null;
  const html = renderConfirmPanel(room, localPlayer);
  if (!html) return;
  const anchor = document.querySelector('.multiplayer-room .season-result-actions') || document.querySelector('.multiplayer-room .match-card:last-of-type');
  anchor?.insertAdjacentHTML('beforebegin', html);
}

async function confirmPhase(roomId) {
  const session = readSession(roomId);
  if (!session?.playerId) {
    alert('この端末の参加情報が見つかりません。入り直してください。');
    return;
  }
  try {
    await requestJson(`/api/rooms/${encodeURIComponent(roomId)}/confirm-phase`, {
      method: 'POST',
      body: JSON.stringify({ playerId: session.playerId })
    });
    await renderPhaseSyncPanel();
    document.querySelector(`[data-mp-refresh="${CSS.escape(roomId)}"]`)?.click();
  } catch (error) {
    alert(error.message);
  }
}

const observer = new MutationObserver(() => { renderPhaseSyncPanel(); });
observer.observe(document.querySelector('#app'), { childList: true, subtree: true });
renderPhaseSyncPanel();

document.addEventListener('click', event => {
  const roomId = event.target.closest('[data-mp-confirm-phase]')?.dataset.mpConfirmPhase;
  if (!roomId) return;
  confirmPhase(roomId);
});
