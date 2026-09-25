const app = document.querySelector('#app');

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}[char]));

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.error || data?.message || `通信エラー ${response.status}`);
  return data;
};

function removeModal() {
  document.querySelectorAll('.multiplayer-modal-backdrop,.multiplayer-modal').forEach(node => node.remove());
}

function showModeModal() {
  removeModal();
  document.body.insertAdjacentHTML('beforeend', `<div class="multiplayer-modal-backdrop" data-mp-close></div>
    <section class="multiplayer-modal" role="dialog" aria-modal="true" aria-label="マルチプレイ">
      <div class="overlay-heading"><div><p class="eyebrow">MULTIPLAYER</p><h2>マルチプレイ</h2></div><button type="button" data-mp-close class="subtle">閉じる</button></div>
      <p class="hint">ルームを作成するか、ルームIDを入力して参加します。</p>
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
}

function roomIdOf(data) {
  return data?.roomId || data?.room?.id || data?.room?.roomId || data?.id;
}

function renderRoomScreen(room) {
  const id = escapeHtml(roomIdOf(room) || room?.roomId || '未取得');
  const phase = escapeHtml(room?.phase || room?.room?.phase || 'ROOM');
  const players = room?.players || room?.room?.players || [];
  app.innerHTML = `<main class="multiplayer-room">
    <p class="eyebrow">MULTIPLAYER ROOM</p>
    <h1>ルーム</h1>
    <section class="hero">
      <p>ルームID</p>
      <h2 class="room-id">${id}</h2>
      <p class="hint">このIDを参加者に共有してください。</p>
    </section>
    <section class="match-card">
      <h2>現在の状態</h2>
      <p>フェーズ：<b>${phase}</b></p>
      <p>参加者：<b>${players.length}</b>人</p>
      ${players.length ? `<div class="position-counts">${players.map(player => `<span>${escapeHtml(player.name || player.playerName || 'プレイヤー')}<b>${escapeHtml(player.clubId || '未選択')}</b></span>`).join('')}</div>` : '<p class="hint">まだ参加者はいません。</p>'}
    </section>
    <div class="season-result-actions">
      <button type="button" data-mp-refresh="${id}" class="subtle">更新</button>
      <button type="button" data-mp-back-title class="subtle">タイトルへ戻る</button>
    </div>
  </main>`;
}

async function createRoom() {
  const error = document.querySelector('[data-mp-error]');
  try {
    if (error) error.hidden = true;
    const data = await requestJson('/api/rooms', { method: 'POST', body: JSON.stringify({}) });
    removeModal();
    renderRoomScreen(data?.room || data);
  } catch (err) {
    if (error) { error.textContent = err.message; error.hidden = false; }
  }
}

async function joinRoom() {
  const error = document.querySelector('[data-mp-error]');
  const roomId = document.querySelector('[data-mp-room-id]')?.value.trim();
  if (!roomId) {
    if (error) { error.textContent = 'ルームIDを入力してください。'; error.hidden = false; }
    return;
  }
  try {
    if (error) error.hidden = true;
    const data = await requestJson(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      body: JSON.stringify({ playerName: 'プレイヤー' })
    });
    removeModal();
    renderRoomScreen(data?.room || data);
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
  const refresh = event.target.closest('[data-mp-refresh]')?.dataset.mpRefresh;
  if (refresh) refreshRoom(refresh);
  if (event.target.closest('[data-mp-back-title]')) location.reload();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') removeModal();
  if (event.key === 'Enter' && event.target.matches('[data-mp-room-id]')) joinRoom();
});
