import { decideCpuAuctionAction, prepareCpuClubs } from './cpu.js?v=0.17.30';
import { resolveAuctionActions } from './market.js?v=0.17.30';
import { createRandom } from './random.js';
import { ACTION_TYPES } from './rules.js?v=0.17.2';
import { renderPlayerCard } from './ui.js?v=0.17.34';

const SESSION_KEY = 'football-league:multiplayer-session';
const app = document.querySelector('#app');

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

function roomId() {
  return document.querySelector('.multiplayer-room .room-id')?.textContent?.trim() || null;
}
function readSession(id) {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return value && (!id || value.roomId === id) ? value : null;
  } catch { return null; }
}
async function requestJson(url, options = {}) {
  const auth = readSession();
  const response = await fetch(url, { headers:{ 'Content-Type':'application/json', ...(auth?.playerToken ? { 'x-player-token':auth.playerToken } : {}), ...(options.headers||{}) }, ...options });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { throw new Error('APIからJSON以外の応答が返りました。'); }
  if (!response.ok) throw new Error(data?.error || data?.message || ('通信エラー ' + response.status));
  return data;
}
function localClub(room, player) {
  return room?.leagueState?.clubs?.find(club => club.multiplayerPlayerId === player?.id) || null;
}
function statusSummary(room) {
  const rows = (room.players || []).map(player => {
    const club = room.leagueState?.clubs?.find(candidate => candidate.multiplayerPlayerId === player.id);
    const done = Boolean(player.phaseComplete) || room.phase === 'auction-ready';
    return '<div class="mp-player-row"><span><b>'+esc(club?.name || player.teamName || player.name || 'クラブ')+'</b></span><span class="'+(done?'mp-ready':'mp-not-ready')+'">'+(done?'入札済み':'未入力')+'</span></div>';
  }).join('');
  return '<div class="mp-player-list">'+rows+'</div>';
}
function resultSummary(room) {
  const result = room.auctionState?.lastResult;
  if (!result) return '';
  return '<section class="mp-work-summary"><b>前回の開札結果</b><p>' +
    (result.winnerName ? esc(result.winnerName)+' が '+esc(result.bid)+'ptで '+esc(result.playerName)+' を獲得' : esc(result.playerName)+' は見送り') +
    '</p></section>';
}
function renderAuctionPanel(room, localPlayer) {
  if (!['auction','auction-ready'].includes(room.phase) || !room.auctionState || !room.leagueState) return '';
  const state = room.auctionState;
  const current = state.pool?.[state.index];
  if (!current) return '';
  const club = localClub(room, localPlayer);
  const canInput = room.phase === 'auction' && localPlayer && !localPlayer.phaseComplete;
  const hostReady = room.phase === 'auction-ready' && localPlayer?.id === room.hostPlayerId;
  const maxBid = club ? Math.max(0, club.funds) : 0;
  return '<section class="match-card" data-mp-auction-panel>' +
    '<p class="eyebrow">競売 '+(state.index+1)+'/'+state.pool.length+'</p><h2>秘密入札</h2>' +
    '<p class="hint">入札額は開札まで他クラブには公開されません。</p>' +
    resultSummary(room) +
    (club ? '<p>資金 <b>'+club.funds+'pt</b>・登録 <b>'+club.roster.length+'/12人</b></p>' : '') +
    statusSummary(room) +
    '<article class="candidate">'+renderPlayerCard(current)+'<p class="scout-comment"><b>スカウト：</b>'+esc(current.scoutComment || '')+'</p></article>' +
    (canInput ? (club?.roster.length >= 12
      ? '<p class="lineup-error">登録上限12人のため入札できません。</p><button type="button" data-mp-auction-pass="'+esc(room.roomId)+'" class="subtle">見送る</button>'
      : '<label>入札額<input data-mp-auction-bid type="number" min="0" max="'+maxBid+'" value="0"></label><button type="button" data-mp-auction-submit="'+esc(room.roomId)+'">入札する</button><button type="button" data-mp-auction-pass="'+esc(room.roomId)+'" class="subtle">見送る</button>') : '') +
    (hostReady ? '<button type="button" data-mp-auction-resolve="'+esc(room.roomId)+'">開札する</button>' : '') +
    (room.phase === 'auction-ready' && !hostReady ? '<p class="hint">全員の入力が揃いました。ホストの開札を待っています。</p>' : '') +
    '</section>';
}
async function renderPanel() {
  const id = roomId();
  if (!id) return;
  let data;
  try { data = await requestJson('/api/rooms/' + encodeURIComponent(id)); }
  catch { return; }
  const room = data?.room || data;
  document.querySelector('[data-mp-auction-panel]')?.remove();
  if (!['auction','auction-ready'].includes(room.phase)) return;
  const s = readSession(id);
  const localPlayer = room.players?.find(player => player.id === s?.playerId) || null;
  const html = renderAuctionPanel(room, localPlayer);
  if (!html) return;
  const holder = document.createElement('div');
  holder.innerHTML = html;
  document.querySelector('.multiplayer-room .season-result-actions')?.insertAdjacentElement('beforebegin', holder.firstElementChild);
}
async function submitBid(id, bid) {
  const s = readSession(id);
  if (!s?.playerId) return alert('参加情報が見つかりません。');
  try {
    await requestJson('/api/rooms/' + encodeURIComponent(id) + '/submit-auction', {
      method:'POST',
      body:JSON.stringify({ playerId:s.playerId, bid })
    });
    document.querySelector('[data-mp-refresh="'+CSS.escape(id)+'"]')?.click();
    setTimeout(renderPanel,50);
  } catch (error) { alert(error.message); }
}
async function resolveAuction(id) {
  const s = readSession(id);
  if (!s?.playerId) return alert('参加情報が見つかりません。');
  try {
    const prepared = await requestJson('/api/rooms/' + encodeURIComponent(id) + '/prepare-auction-resolution', {
      method:'POST',
      body:JSON.stringify({ playerId:s.playerId })
    });
    const league = clone(prepared.leagueState);
    const state = clone(prepared.auctionState);
    const current = state.pool?.[state.index];
    if (!current) throw new Error('競売対象選手が見つかりません。');
    const rng = createRandom(league.seed + ':season:' + league.season + ':auction:' + state.index + ':step:' + (state.resolveStep || 0));
    const actions = [];
    for (const club of league.clubs) {
      if (club.controllerType === 'CPU') {
        actions.push(decideCpuAuctionAction(club,current,rng));
      } else {
        const input = prepared.auctionInputs?.[club.id] || prepared.auctionInputs?.[String(club.id)];
        actions.push({ type:ACTION_TYPES.AUCTION_BID, clubId:club.id, playerId:current.id, bid:Number(input?.bid || 0) });
      }
    }
    const result = resolveAuctionActions({ clubs:league.clubs, player:current, actions, rng });
    if (result.winner) league.releasedPlayers = (league.releasedPlayers || []).filter(player => player.id !== current.id);
    state.lastResult = { playerId:current.id, playerName:current.name, winnerId:result.winner?.id || null, winnerName:result.winner?.name || null, bid:result.bid || 0 };
    state.index++;
    state.resolveStep = (state.resolveStep || 0) + 1;
    if (state.index >= state.pool.length) {
      state.completed = true;
      league.releasedPlayers = [];
      prepareCpuClubs(league);
    }
    await requestJson('/api/rooms/' + encodeURIComponent(id) + '/advance-auction', {
      method:'POST',
      body:JSON.stringify({ playerId:s.playerId, leagueState:league, auctionState:state })
    });
    document.querySelector('[data-mp-refresh="'+CSS.escape(id)+'"]')?.click();
    setTimeout(renderPanel,50);
  } catch (error) { alert(error.message); }
}

document.addEventListener('click', event => {
  const submitId = event.target.closest('[data-mp-auction-submit]')?.dataset.mpAuctionSubmit;
  if (submitId) {
    const input = document.querySelector('[data-mp-auction-bid]');
    const bid = Number(input?.value || 0);
    if (!Number.isFinite(bid) || bid < 0) return alert('入札額を確認してください。');
    submitBid(submitId,bid);
    return;
  }
  const passId = event.target.closest('[data-mp-auction-pass]')?.dataset.mpAuctionPass;
  if (passId) { submitBid(passId,0); return; }
  const resolveId = event.target.closest('[data-mp-auction-resolve]')?.dataset.mpAuctionResolve;
  if (resolveId) resolveAuction(resolveId);
});
let timer = null;
const observer = new MutationObserver(mutations => {
  if (mutations.some(mutation => !mutation.target.closest?.('[data-mp-auction-panel]'))) {
    clearTimeout(timer);
    timer = setTimeout(renderPanel,40);
  }
});
observer.observe(app,{ childList:true, subtree:true });
renderPanel();
