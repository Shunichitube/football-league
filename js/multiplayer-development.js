import { processLeagueOffseason, prepareCpuMarketSpace, selectBestLineup } from './cpu.js?v=0.17.27';
import { trainingSkills } from './development.js?v=0.17.3';
import { STAT_LABELS } from './data.js?v=0.17.2';
import { startNextSeason } from './league.js?v=0.17.27';
import { createDraftPool } from './market.js?v=0.17.2';
import { ACTION_TYPES, applyClubAction } from './rules.js?v=0.17.2';
import { renderPlayerCard } from './ui.js?v=0.17.29';

const SESSION_KEY = 'football-league:multiplayer-session';
const DEVELOPMENT_KEY = 'football-league:multiplayer-development';
const RELEASE_KEY = 'football-league:multiplayer-release';
const app = document.querySelector('#app');

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

function roomId() {
  return document.querySelector('.multiplayer-room .room-id')?.textContent?.trim() || null;
}
function session(id) {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return value && (!id || value.roomId === id) ? value : null;
  } catch { return null; }
}
async function requestJson(url, options = {}) {
  const auth = session();
  const response = await fetch(url, { headers:{ 'Content-Type':'application/json', ...(auth?.playerToken ? { 'x-player-token':auth.playerToken } : {}), ...(options.headers||{}) }, ...options });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; }
  catch { throw new Error('APIからJSON以外の応答が返りました。'); }
  if (!response.ok) throw new Error(data?.error || data?.message || ('通信エラー ' + response.status));
  return data;
}
function storageKey(prefix, id, playerId) { return prefix + ':' + id + ':' + playerId; }
function readDevelopment(id, playerId) {
  try { return JSON.parse(localStorage.getItem(storageKey(DEVELOPMENT_KEY,id,playerId)) || 'null') || { selected:[], focus:{} }; }
  catch { return { selected:[], focus:{} }; }
}
function saveDevelopment(id, playerId, value) { localStorage.setItem(storageKey(DEVELOPMENT_KEY,id,playerId), JSON.stringify(value)); }
function clearDevelopment(id, playerId) { localStorage.removeItem(storageKey(DEVELOPMENT_KEY,id,playerId)); }
function readRelease(id, playerId) {
  try { return JSON.parse(localStorage.getItem(storageKey(RELEASE_KEY,id,playerId)) || 'null') || { releasePlayerIds:[] }; }
  catch { return { releasePlayerIds:[] }; }
}
function saveRelease(id, playerId, value) { localStorage.setItem(storageKey(RELEASE_KEY,id,playerId), JSON.stringify(value)); }
function clearRelease(id, playerId) { localStorage.removeItem(storageKey(RELEASE_KEY,id,playerId)); }

function localClub(room, player) {
  return room?.leagueState?.clubs?.find(club => club.multiplayerPlayerId === player?.id) || null;
}
function playerStatus(room, player) {
  if (room.phase === 'development') return player.phaseComplete ? '育成入力完了' : '育成入力中';
  if (room.phase === 'development-ready') return '育成入力完了';
  if (room.phase === 'growth-result') return player.phaseComplete ? '成長結果確認済み' : '成長結果未確認';
  if (room.phase === 'release') return player.phaseComplete ? '選手整理完了' : '選手整理中';
  if (room.phase === 'release-ready') return '選手整理完了';
  return '';
}
function syncSummary(room) {
  const rows = room.players || [];
  const done = rows.filter(player => player.phaseComplete).length;
  const waiting = rows.filter(player => !player.phaseComplete);
  return '<section class="mp-work-summary"><b>作業状況：' + done + '/' + rows.length + ' 完了</b>' +
    (waiting.length ? '<p class="hint">未完了クラブ：</p><ul class="mp-incomplete">' + waiting.map(player => '<li>' + esc(player.teamName || player.name || 'クラブ') + '</li>').join('') + '</ul>' : '<p class="hint">全員完了しています。</p>') +
    '</section>';
}

function developmentPanel(room, localPlayer) {
  if (room.phase === 'development-ready') {
    return '<section class="match-card" data-mp-development-panel><p class="eyebrow">OFFSEASON</p><h2>育成</h2><p class="hint">全クラブの入力が完了しました。' +
      (localPlayer?.id === room.hostPlayerId ? '成長処理を確定してください。' : 'ホストの確定を待っています。') + '</p>' +
      syncSummary(room) +
      (localPlayer?.id === room.hostPlayerId ? '<button type="button" data-mp-resolve-development="' + esc(room.roomId) + '">成長処理を実行</button>' : '') +
      '</section>';
  }
  if (room.phase !== 'development') return '';
  if (!localPlayer) return '';
  if (localPlayer.phaseComplete) return '<section class="match-card" data-mp-development-panel><p class="eyebrow">OFFSEASON</p><h2>育成</h2><p class="hint">入力済みです。他クラブを待っています。</p>' + syncSummary(room) + '</section>';
  const club = localClub(room, localPlayer);
  if (!club) return '<section class="match-card" data-mp-development-panel><h2>育成</h2><p class="lineup-error">クラブ情報を取得できません。</p></section>';
  const draft = readDevelopment(room.roomId, localPlayer.id);
  draft.selected = (draft.selected || []).filter(id => club.roster.some(player => player.id === id)).slice(0,2);
  const cards = club.roster.map(player => {
    const selected = draft.selected.includes(player.id);
    return '<article class="candidate">' + renderPlayerCard(player) +
      '<button type="button" data-mp-development-player="' + esc(player.id) + '" class="' + (selected ? '' : 'subtle') + '">' + (selected ? '選択済み' : '育成対象にする') + '</button></article>';
  }).join('');
  let focus = '';
  if (draft.selected.length === 2) {
    focus = '<h3>重点能力</h3>' + draft.selected.map(id => {
      const player = club.roster.find(candidate => candidate.id === id);
      return '<article class="candidate">' + renderPlayerCard(player) +
        '<label>重点育成<select data-mp-development-focus="' + esc(id) + '">' +
        '<option value="">選択してください</option>' +
        trainingSkills(player).map(skill => '<option value="' + skill + '" ' + (draft.focus?.[id] === skill ? 'selected' : '') + '>' + esc(STAT_LABELS[skill] || skill) + '</option>').join('') +
        '</select></label></article>';
    }).join('');
  }
  const complete = draft.selected.length === 2 && draft.selected.every(id => draft.focus?.[id]);
  return '<section class="match-card" data-mp-development-panel><p class="eyebrow">OFFSEASON</p><h2>育成する2選手を選択</h2><p class="hint">' + draft.selected.length + '/2 選択中</p>' +
    '<section class="candidate-grid">' + cards + '</section>' + focus +
    '<button type="button" data-mp-submit-development="' + esc(room.roomId) + '" ' + (complete ? '' : 'disabled') + '>育成内容を確定</button></section>';
}

function growthPanel(room, localPlayer) {
  if (room.phase !== 'growth-result' || !localPlayer) return '';
  const club = localClub(room, localPlayer);
  const summary = (room.growthResult || []).find(row => String(row.clubId) === String(club?.id));
  if (!summary) return '<section class="match-card" data-mp-development-panel><h2>成長結果</h2><p class="lineup-error">成長結果を取得できません。</p></section>';
  const rows = (summary.growth || []).map(row => {
    const changes = (row.changes || []).map(change => (STAT_LABELS[change.key] || change.key) + ' ' +
      (change.from === change.to && change.increased ? change.from + ' ↑' : change.from + ' → ' + change.to)).join('<br>') || 'ランク変化なし';
    return '<article class="candidate">' + renderPlayerCard(row.player) +
      '<p>年齢 ' + (row.player.age - 1) + ' → ' + row.player.age + '</p>' +
      (row.awakeningKeys?.length ? '<p><b>覚醒！</b></p>' : '') +
      (row.specialTrainingResult ? '<p><b>特別特訓：</b>' + esc(row.specialTrainingResult.label) + '</p>' : '') +
      '<p>' + (row.retired ? '35歳で引退' : changes) + '</p>' +
      (row.learnedAbility ? '<p><b>特殊能力を習得！</b><br>★ ' + esc(row.learnedAbility) + '</p>' : '') +
      '</article>';
  }).join('');
  return '<section class="match-card" data-mp-development-panel><p class="eyebrow">OFFSEASON</p><h2>成長結果</h2>' +
    '<section class="candidate-grid">' + rows + '</section>' + syncSummary(room) +
    '<button type="button" data-mp-confirm-growth="' + esc(room.roomId) + '" ' + (localPlayer.phaseComplete ? 'disabled' : '') + '>' +
    (localPlayer.phaseComplete ? '確認済み' : '成長結果を確認') + '</button></section>';
}

function remainingRoster(club, releaseIds) {
  return club.roster.filter(player => !releaseIds.includes(player.id));
}
function releaseIsValid(club, releaseIds) {
  const remaining = remainingRoster(club, releaseIds);
  return remaining.length >= 5 && remaining.some(player => player.primaryPosition === 'GK');
}
function releasePanel(room, localPlayer) {
  if (room.phase === 'release-ready') {
    return '<section class="match-card" data-mp-development-panel><p class="eyebrow">OFFSEASON</p><h2>選手整理</h2><p class="hint">全クラブの入力が完了しました。' +
      (localPlayer?.id === room.hostPlayerId ? '放出を確定してドラフトへ進んでください。' : 'ホストの確定を待っています。') + '</p>' +
      syncSummary(room) +
      (localPlayer?.id === room.hostPlayerId ? '<button type="button" data-mp-resolve-release="' + esc(room.roomId) + '">選手整理を確定</button>' : '') +
      '</section>';
  }
  if (room.phase !== 'release' || !localPlayer) return '';
  if (localPlayer.phaseComplete) return '<section class="match-card" data-mp-development-panel><p class="eyebrow">OFFSEASON</p><h2>選手整理</h2><p class="hint">入力済みです。他クラブを待っています。</p>' + syncSummary(room) + '</section>';
  const club = localClub(room, localPlayer);
  if (!club) return '<section class="match-card" data-mp-development-panel><h2>選手整理</h2><p class="lineup-error">クラブ情報を取得できません。</p></section>';
  const draft = readRelease(room.roomId, localPlayer.id);
  draft.releasePlayerIds = (draft.releasePlayerIds || []).filter(id => club.roster.some(player => player.id === id));
  const cards = club.roster.map(player => {
    const selected = draft.releasePlayerIds.includes(player.id);
    const candidate = selected ? draft.releasePlayerIds.filter(id => id !== player.id) : [...draft.releasePlayerIds, player.id];
    const canToggle = selected || releaseIsValid(club, candidate);
    return '<article class="candidate">' + renderPlayerCard(player) +
      '<button type="button" data-mp-release-player="' + esc(player.id) + '" class="' + (selected ? '' : 'subtle') + '" ' + (canToggle ? '' : 'disabled') + '>' +
      (selected ? '放出予定' : '放出する') + '</button></article>';
  }).join('');
  return '<section class="match-card" data-mp-development-panel><p class="eyebrow">OFFSEASON</p><h2>選手整理</h2><p class="hint">登録選手は最低5人、GKは最低1人必要です。</p>' +
    '<p>放出予定：<b>' + draft.releasePlayerIds.length + '人</b></p><section class="candidate-grid">' + cards + '</section>' +
    '<button type="button" data-mp-submit-release="' + esc(room.roomId) + '">選手整理を完了</button></section>';
}

async function renderPanel() {
  const id = roomId();
  if (!id) return;
  let data;
  try { data = await requestJson('/api/rooms/' + encodeURIComponent(id)); }
  catch { return; }
  const room = data?.room || data;
  document.querySelector('[data-mp-development-panel]')?.remove();
  if (!['development','development-ready','growth-result','release','release-ready'].includes(room.phase)) return;
  const s = session(id);
  const localPlayer = room.players?.find(player => player.id === s?.playerId) || null;
  const html = developmentPanel(room, localPlayer) || growthPanel(room, localPlayer) || releasePanel(room, localPlayer);
  if (!html) return;
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const panel = holder.firstElementChild;
  const anchor = document.querySelector('.multiplayer-room .season-result-actions');
  anchor?.insertAdjacentElement('beforebegin', panel);
}

function specialTrainingMap(room, league) {
  const source = room.offseasonState?.specialTrainingByClub || {};
  return new Map(Object.entries(source).map(([rawId, ids]) => {
    const club = league.clubs.find(candidate => String(candidate.id) === String(rawId));
    return [club?.id ?? rawId, new Set(Array.isArray(ids) ? ids : [])];
  }));
}
function humanTrainingMap(room, league) {
  const map = new Map();
  for (const player of room.players || []) {
    const club = league.clubs.find(candidate => candidate.multiplayerPlayerId === player.id);
    if (!club) continue;
    const rows = player.phaseInput?.selections || [];
    map.set(club.id, new Map(rows.map(row => [row.playerId, row.focus])));
  }
  return map;
}
async function resolveDevelopment(id) {
  const s = session(id);
  if (!s?.playerId) return alert('参加情報が見つかりません。');
  try {
    const prepared = await requestJson('/api/rooms/' + encodeURIComponent(id) + '/prepare-development-resolution', {
      method:'POST',
      body:JSON.stringify({ playerId:s.playerId })
    });
    const room = { roomId:id, leagueState:prepared.leagueState, players:prepared.players, offseasonState:prepared.offseasonState };
    const league = clone(room.leagueState);
    const summaries = processLeagueOffseason(league, humanTrainingMap(room, league), specialTrainingMap(room, league));
    const response = await requestJson('/api/rooms/' + encodeURIComponent(id) + '/advance-development', {
      method:'POST',
      body:JSON.stringify({ playerId:s.playerId, leagueState:league, growthResult:summaries })
    });
    document.querySelector('[data-mp-refresh="' + CSS.escape(id) + '"]')?.click();
    setTimeout(renderPanel, 50);
    return response;
  } catch (error) { alert(error.message); }
}
async function submitDevelopment(id) {
  const s = session(id);
  if (!s?.playerId) return alert('参加情報が見つかりません。');
  const data = await requestJson('/api/rooms/' + encodeURIComponent(id));
  const room = data?.room || data;
  const player = room.players?.find(candidate => candidate.id === s.playerId);
  const club = localClub(room, player);
  const draft = readDevelopment(id, s.playerId);
  if (!club || draft.selected?.length !== 2 || !draft.selected.every(playerId => draft.focus?.[playerId])) return alert('育成対象2名と重点能力を確認してください。');
  try {
    await requestJson('/api/rooms/' + encodeURIComponent(id) + '/submit-development', {
      method:'POST',
      body:JSON.stringify({ playerId:s.playerId, input:{ selections:draft.selected.map(playerId => ({ playerId, focus:draft.focus[playerId] })) } })
    });
    clearDevelopment(id, s.playerId);
    document.querySelector('[data-mp-refresh="' + CSS.escape(id) + '"]')?.click();
    setTimeout(renderPanel, 50);
  } catch (error) { alert(error.message); }
}
async function confirmGrowth(id) {
  const s = session(id);
  if (!s?.playerId) return alert('参加情報が見つかりません。');
  try {
    await requestJson('/api/rooms/' + encodeURIComponent(id) + '/confirm-phase', { method:'POST', body:JSON.stringify({ playerId:s.playerId }) });
    document.querySelector('[data-mp-refresh="' + CSS.escape(id) + '"]')?.click();
    setTimeout(renderPanel, 50);
  } catch (error) { alert(error.message); }
}
async function submitRelease(id) {
  const s = session(id);
  if (!s?.playerId) return alert('参加情報が見つかりません。');
  const draft = readRelease(id, s.playerId);
  try {
    await requestJson('/api/rooms/' + encodeURIComponent(id) + '/submit-release', { method:'POST', body:JSON.stringify({ playerId:s.playerId, input:{ releasePlayerIds:draft.releasePlayerIds || [] } }) });
    clearRelease(id, s.playerId);
    document.querySelector('[data-mp-refresh="' + CSS.escape(id) + '"]')?.click();
    setTimeout(renderPanel, 50);
  } catch (error) { alert(error.message); }
}
function applyHumanReleases(league, room) {
  league.releasePhaseOpen = true;
  for (const player of room.players || []) {
    const club = league.clubs.find(candidate => candidate.multiplayerPlayerId === player.id);
    if (!club) continue;
    for (const playerId of player.phaseInput?.releasePlayerIds || []) {
      const result = applyClubAction(club, { type:ACTION_TYPES.RELEASE_PLAYER, clubId:club.id, playerId }, league);
      if (!result.ok) throw new Error(club.name + '：' + result.error);
    }
    selectBestLineup(club);
  }
  prepareCpuMarketSpace(league);
  league.releasePhaseOpen = false;
  return league;
}
function draftEligibleIds(league, declinedClubIds = []) {
  const declined = new Set(declinedClubIds);
  return league.clubs.filter(club => club.funds >= 1 && club.roster.length < 12 && !declined.has(club.id)).map(club => club.id);
}
function draftMode(league, round) {
  return league.season === 1 || round === 1 ? 'SIMULTANEOUS' : 'ORDERED';
}
function orderedDraftIds(league, round, declinedClubIds = []) {
  const eligible = new Set(draftEligibleIds(league, declinedClubIds));
  const ranks = league.previousStandings || [];
  const descending = round === 2 || round === 4;
  return [...ranks].sort((a,b) => descending ? b.rank - a.rank : a.rank - b.rank).map(row => row.clubId).filter(id => eligible.has(id));
}
function createInitialDraftState(league) {
  league.clubs.forEach(club => { club.reserveAuctionSlot = club.controllerType === 'CPU' && 12 - club.roster.length >= 2; });
  const round = 1;
  const mode = draftMode(league, round);
  const declinedClubIds = [];
  const pendingClubIds = mode === 'SIMULTANEOUS' ? draftEligibleIds(league, declinedClubIds) : orderedDraftIds(league, round, declinedClubIds).slice(0,1);
  return {
    round,
    mode,
    pool: createDraftPool(league.seed, league.season),
    pendingClubIds,
    order: mode === 'ORDERED' ? orderedDraftIds(league, round, declinedClubIds) : [],
    orderIndex: 0,
    declinedClubIds,
    resolveStep: 0,
    lastResult: null,
    completed: false
  };
}

async function resolveRelease(id) {
  const s = session(id);
  if (!s?.playerId) return alert('参加情報が見つかりません。');
  try {
    const prepared = await requestJson('/api/rooms/' + encodeURIComponent(id) + '/prepare-release-resolution', {
      method:'POST',
      body:JSON.stringify({ playerId:s.playerId })
    });
    const room = { roomId:id, leagueState:prepared.leagueState, players:prepared.players };
    const league = applyHumanReleases(clone(room.leagueState), room);
    const advanced = startNextSeason(league);
    if (!advanced) throw new Error('最終シーズン終了後はドラフトへ進みません。');
    const draftState = createInitialDraftState(league);
    await requestJson('/api/rooms/' + encodeURIComponent(id) + '/advance-release', { method:'POST', body:JSON.stringify({ playerId:s.playerId, leagueState:league, draftState }) });
    document.querySelector('[data-mp-refresh="' + CSS.escape(id) + '"]')?.click();
    setTimeout(renderPanel, 50);
  } catch (error) { alert(error.message); }
}

document.addEventListener('click', event => {
  const devPlayer = event.target.closest('[data-mp-development-player]')?.dataset.mpDevelopmentPlayer;
  if (devPlayer) {
    const id = roomId(), s = session(id); if (!id || !s?.playerId) return;
    const draft = readDevelopment(id,s.playerId);
    draft.selected ||= []; draft.focus ||= {};
    if (draft.selected.includes(devPlayer)) { draft.selected = draft.selected.filter(value => value !== devPlayer); delete draft.focus[devPlayer]; }
    else if (draft.selected.length < 2) draft.selected.push(devPlayer);
    saveDevelopment(id,s.playerId,draft); renderPanel(); return;
  }
  const submitDev = event.target.closest('[data-mp-submit-development]')?.dataset.mpSubmitDevelopment;
  if (submitDev) { submitDevelopment(submitDev); return; }
  const resolveDev = event.target.closest('[data-mp-resolve-development]')?.dataset.mpResolveDevelopment;
  if (resolveDev) { resolveDevelopment(resolveDev); return; }
  const growth = event.target.closest('[data-mp-confirm-growth]')?.dataset.mpConfirmGrowth;
  if (growth) { confirmGrowth(growth); return; }
  const releasePlayer = event.target.closest('[data-mp-release-player]')?.dataset.mpReleasePlayer;
  if (releasePlayer) {
    const id=roomId(), s=session(id); if(!id||!s?.playerId)return;
    const draft=readRelease(id,s.playerId); draft.releasePlayerIds ||= [];
    if(draft.releasePlayerIds.includes(releasePlayer)) draft.releasePlayerIds=draft.releasePlayerIds.filter(value=>value!==releasePlayer);
    else draft.releasePlayerIds.push(releasePlayer);
    saveRelease(id,s.playerId,draft); renderPanel(); return;
  }
  const submitRel = event.target.closest('[data-mp-submit-release]')?.dataset.mpSubmitRelease;
  if (submitRel) { submitRelease(submitRel); return; }
  const resolveRel = event.target.closest('[data-mp-resolve-release]')?.dataset.mpResolveRelease;
  if (resolveRel) { resolveRelease(resolveRel); }
});
document.addEventListener('change', event => {
  const playerId = event.target.closest('[data-mp-development-focus]')?.dataset.mpDevelopmentFocus;
  if (!playerId) return;
  const id=roomId(), s=session(id); if(!id||!s?.playerId)return;
  const draft=readDevelopment(id,s.playerId); draft.focus ||= {};
  if(event.target.value) draft.focus[playerId]=event.target.value; else delete draft.focus[playerId];
  saveDevelopment(id,s.playerId,draft); renderPanel();
});
let timer=null;
const observer=new MutationObserver(mutations=>{
  if(mutations.some(mutation=>!mutation.target.closest?.('[data-mp-development-panel]'))){
    clearTimeout(timer); timer=setTimeout(renderPanel,40);
  }
});
observer.observe(app,{childList:true,subtree:true});
renderPanel();
