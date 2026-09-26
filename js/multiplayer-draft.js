import { decideCpuDraftAction } from './cpu.js?v=0.17.30';
import { displayPlayer } from './data.js?v=0.17.2';
import { createAuctionPool, resolveDraftActions } from './market.js?v=0.17.30';
import { createRandom } from './random.js';
import { ACTION_TYPES } from './rules.js?v=0.17.2';
import { renderPlayerCard } from './ui.js?v=0.17.34';

const SESSION_KEY = 'football-league:multiplayer-session';
const SORT_KEY = 'football-league:multiplayer-draft-sort';
const app = document.querySelector('#app');
const POSITION_ORDER = { GK:0, DF:1, MF:2, FW:3 };
const RANK_ORDER = { SS:0, S:1, A:2, B:3, C:4, D:5, E:6, F:7, G:8 };

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
function currentSort() {
  return localStorage.getItem(SORT_KEY) || 'position';
}
function setSort(value) {
  localStorage.setItem(SORT_KEY, ['position','overall','age','contract'].includes(value) ? value : 'position');
}
function sortPlayers(players, mode) {
  return [...players].map((player,index)=>({player,index})).sort((a,b)=>{
    const pa=a.player,pb=b.player;
    const pos=(POSITION_ORDER[pa.primaryPosition]??99)-(POSITION_ORDER[pb.primaryPosition]??99);
    const rank=RANK_ORDER[displayPlayer(pa).overallRank]-RANK_ORDER[displayPlayer(pb).overallRank];
    const age=pa.age-pb.age;
    const contract=(pa.contractYears??99)-(pb.contractYears??99);
    const joined=a.index-b.index;
    if(mode==='overall') return rank||pos||age||contract||joined;
    if(mode==='age') return age||pos||rank||contract||joined;
    if(mode==='contract') return contract||pos||rank||age||joined;
    return pos||rank||age||contract||joined;
  }).map(row=>row.player);
}
function localClub(room, player) {
  return room?.leagueState?.clubs?.find(club => club.multiplayerPlayerId === player?.id) || null;
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
  return [...ranks].sort((a,b) => descending ? b.rank-a.rank : a.rank-b.rank).map(row=>row.clubId).filter(id=>eligible.has(id));
}
function prepareRound(league, state) {
  state.mode = draftMode(league, state.round);
  if (state.mode === 'SIMULTANEOUS') {
    state.order = [];
    state.orderIndex = 0;
    state.pendingClubIds = draftEligibleIds(league, state.declinedClubIds);
  } else {
    state.order = orderedDraftIds(league, state.round, state.declinedClubIds);
    state.orderIndex = 0;
    state.pendingClubIds = state.order.length ? [state.order[0]] : [];
  }
}
function nextOrderedPick(league, state) {
  state.orderIndex++;
  const eligible = new Set(draftEligibleIds(league, state.declinedClubIds));
  while (state.orderIndex < state.order.length && !eligible.has(state.order[state.orderIndex])) state.orderIndex++;
  state.pendingClubIds = state.orderIndex < state.order.length ? [state.order[state.orderIndex]] : [];
}
function advanceRoundIfNeeded(league, state) {
  while (!state.pendingClubIds.length) {
    if (state.round >= 4) {
      state.completed = true;
      return;
    }
    state.round++;
    prepareRound(league, state);
    if (state.pendingClubIds.length) return;
  }
}
function clubName(league, id) {
  return league.clubs.find(club => club.id === id)?.name || 'クラブ';
}
function statusSummary(room, localPlayer) {
  const state = room.draftState;
  const league = room.leagueState;
  const pending = new Set(state?.pendingClubIds || []);
  const humans = (room.players || []).map(player => ({ player, club:league.clubs.find(club=>club.multiplayerPlayerId===player.id) })).filter(row=>row.club);
  const rows = humans.map(({player,club}) => {
    const pendingNow = pending.has(club.id);
    const label = !pendingNow ? '指名終了' : player.phaseComplete ? '指名済み' : '未指名';
    const klass = !pendingNow || player.phaseComplete ? 'mp-ready' : 'mp-not-ready';
    return '<div class="mp-player-row"><span><b>'+esc(club.name)+'</b></span><span class="'+klass+'">'+label+'</span></div>';
  }).join('');
  return '<div class="mp-player-list">'+rows+'</div>';
}
function resultSummary(room) {
  const result = room.draftState?.lastResult;
  if (!result) return '';
  const acquired = result.acquired || [];
  if (!acquired.length && !(result.declinedClubIds || []).length) return '';
  return '<section class="mp-work-summary"><b>前回の指名結果</b>' +
    (acquired.length ? '<ul class="mp-incomplete">' + acquired.map(row => '<li>' + esc(row.clubName) + '：' + esc(row.playerName) + (row.contested ? '（競合抽選）' : '') + '</li>').join('') + '</ul>' : '') +
    ((result.declinedClubNames || []).length ? '<p class="hint">辞退：'+result.declinedClubNames.map(esc).join('、')+'</p>' : '') +
    '</section>';
}
function renderDraftPanel(room, localPlayer) {
  const phase = room?.phase;
  if (!['draft','draft-ready'].includes(phase) || !room.draftState || !room.leagueState) return '';
  const state = room.draftState;
  const league = room.leagueState;
  const club = localClub(room, localPlayer);
  const canPick = phase === 'draft' && club && state.pendingClubIds.includes(club.id) && !localPlayer.phaseComplete;
  const sort = currentSort();
  const pool = sortPlayers(state.pool || [], sort);
  const modeLabel = state.mode === 'SIMULTANEOUS' ? '完全同時指名' : '前年順位順指名';
  let hint = state.mode === 'SIMULTANEOUS'
    ? '対象クラブが同時に指名し、重複時だけ抽選します。外れたクラブは再指名します。'
    : '前年順位に基づき、1クラブずつ指名します。';
  if (!canPick && phase === 'draft') hint += ' 現在は他クラブの指名待ちです。';
  const cards = pool.map(player => '<article class="candidate">' + renderPlayerCard(player) +
    '<p class="scout-comment"><b>スカウト：</b>'+esc(player.scoutComment || '')+'</p>' +
    (canPick ? '<button type="button" data-mp-draft-pick="'+esc(player.id)+'">この選手を指名</button>' : '') +
    '</article>').join('');
  const hostReady = phase === 'draft-ready' && localPlayer?.id === room.hostPlayerId;
  return '<section class="match-card" data-mp-draft-panel>' +
    '<p class="eyebrow">シーズン'+esc(league.season)+' ドラフト・第'+esc(state.round)+'/4巡</p>' +
    '<h2>'+modeLabel+'</h2><p class="hint">'+hint+'</p>' +
    (club ? '<p>資金 <b>'+club.funds+'pt</b>・登録 <b>'+club.roster.length+'/12人</b></p>' : '') +
    resultSummary(room) + statusSummary(room, localPlayer) +
    '<div class="phase-sort-heading"><span></span><label>並び順<select data-mp-draft-sort>' +
    [['position','ポジション順'],['overall','総合ランク順'],['age','年齢順'],['contract','契約年数順']].map(([value,label])=>'<option value="'+value+'" '+(sort===value?'selected':'')+'>'+label+'</option>').join('') +
    '</select></label></div>' +
    '<section class="candidate-grid">'+cards+'</section>' +
    (canPick ? '<button type="button" data-mp-draft-pass="'+esc(room.roomId)+'" class="subtle">残りの指名を辞退</button>' : '') +
    (hostReady ? '<button type="button" data-mp-draft-resolve="'+esc(room.roomId)+'">指名結果を確定</button>' : '') +
    (phase === 'draft-ready' && !hostReady ? '<p class="hint">全員の入力が揃いました。ホストの確定を待っています。</p>' : '') +
    '</section>';
}
async function renderPanel() {
  const id = roomId();
  if (!id) return;
  let data;
  try { data = await requestJson('/api/rooms/' + encodeURIComponent(id)); }
  catch { return; }
  const room = data?.room || data;
  document.querySelector('[data-mp-draft-panel]')?.remove();
  if (!['draft','draft-ready'].includes(room.phase)) return;
  const s = readSession(id);
  const localPlayer = room.players?.find(player => player.id === s?.playerId) || null;
  const html = renderDraftPanel(room, localPlayer);
  if (!html) return;
  const holder = document.createElement('div');
  holder.innerHTML = html;
  document.querySelector('.multiplayer-room .season-result-actions')?.insertAdjacentElement('beforebegin', holder.firstElementChild);
}
async function submitPick(id, draftPlayerId = null, pass = false) {
  const s = readSession(id);
  if (!s?.playerId) return alert('参加情報が見つかりません。');
  try {
    await requestJson('/api/rooms/' + encodeURIComponent(id) + '/submit-draft', {
      method:'POST',
      body:JSON.stringify({ playerId:s.playerId, draftPlayerId, pass })
    });
    document.querySelector('[data-mp-refresh="'+CSS.escape(id)+'"]')?.click();
    setTimeout(renderPanel,50);
  } catch (error) { alert(error.message); }
}
async function resolveDraft(id) {
  const s = readSession(id);
  if (!s?.playerId) return alert('参加情報が見つかりません。');
  try {
    const prepared = await requestJson('/api/rooms/' + encodeURIComponent(id) + '/prepare-draft-resolution', {
      method:'POST',
      body:JSON.stringify({ playerId:s.playerId })
    });
    const league = clone(prepared.leagueState);
    const state = clone(prepared.draftState);
    state.declinedClubIds ||= [];
    state.resolveStep ||= 0;
    const inputs = prepared.draftInputs || {};
    for (const [rawClubId,input] of Object.entries(inputs)) {
      const clubId = league.clubs.find(club => String(club.id) === String(rawClubId))?.id;
      if (clubId !== undefined && input?.pass && !state.declinedClubIds.includes(clubId)) state.declinedClubIds.push(clubId);
    }
    const rng = createRandom(league.seed + ':season:' + league.season + ':draft:round:' + state.round + ':step:' + state.resolveStep);
    const actions = [];
    for (const clubId of state.pendingClubIds || []) {
      const club = league.clubs.find(candidate => candidate.id === clubId);
      if (!club) continue;
      if (club.controllerType === 'CPU') {
        const action = decideCpuDraftAction(club, state.pool, rng);
        if (action) actions.push(action);
      } else {
        const input = inputs[club.id] || inputs[String(club.id)];
        if (input?.playerId) actions.push({ type:ACTION_TYPES.DRAFT_PICK, clubId:club.id, playerId:input.playerId });
      }
    }
    const beforePending = [...(state.pendingClubIds || [])];
    const result = resolveDraftActions({ clubs:league.clubs, candidates:state.pool, pendingClubIds:beforePending, actions, rng });
    state.pool = result.candidates;
    state.resolveStep++;
    state.lastResult = {
      acquired: result.acquired.map(row => ({ clubId:row.clubId, clubName:clubName(league,row.clubId), playerId:row.player.id, playerName:row.player.name, contested:row.contested, contenderIds:row.contenderIds })),
      declinedClubIds: [...result.declinedIds],
      declinedClubNames: result.declinedIds.map(clubId => clubName(league,clubId))
    };
    if (state.mode === 'ORDERED') nextOrderedPick(league, state);
    else state.pendingClubIds = result.pendingClubIds;
    advanceRoundIfNeeded(league, state);
    const auctionState = state.completed ? {
      pool: createAuctionPool(league.seed, league.season, league.releasedPlayers || []),
      index: 0,
      resolveStep: 0,
      lastResult: null,
      completed: false
    } : null;
    const advanced = await requestJson('/api/rooms/' + encodeURIComponent(id) + '/advance-draft', {
      method:'POST',
      body:JSON.stringify({ playerId:s.playerId, leagueState:league, draftState:state, auctionState })
    });
    const nextRoom = advanced?.room || advanced;
    document.querySelector('[data-mp-refresh="'+CSS.escape(id)+'"]')?.click();
    setTimeout(renderPanel,50);
    if (nextRoom?.phase === 'draft-ready') {
      const pending = new Set(nextRoom.draftState?.pendingClubIds || []);
      const hasPendingHuman = nextRoom.leagueState?.clubs?.some(club => club.controllerType === 'HUMAN' && pending.has(club.id));
      if (!hasPendingHuman) setTimeout(() => resolveDraft(id), 80);
    }
  } catch (error) { alert(error.message); }
}

document.addEventListener('click', event => {
  const pick = event.target.closest('[data-mp-draft-pick]')?.dataset.mpDraftPick;
  if (pick) {
    const id = roomId();
    if (id) submitPick(id,pick,false);
    return;
  }
  const passId = event.target.closest('[data-mp-draft-pass]')?.dataset.mpDraftPass;
  if (passId) { submitPick(passId,null,true); return; }
  const resolveId = event.target.closest('[data-mp-draft-resolve]')?.dataset.mpDraftResolve;
  if (resolveId) resolveDraft(resolveId);
});
document.addEventListener('change', event => {
  if (!event.target.closest('[data-mp-draft-sort]')) return;
  setSort(event.target.value);
  renderPanel();
});
let timer = null;
const observer = new MutationObserver(mutations => {
  if (mutations.some(mutation => !mutation.target.closest?.('[data-mp-draft-panel]'))) {
    clearTimeout(timer);
    timer = setTimeout(renderPanel,40);
  }
});
observer.observe(app,{ childList:true, subtree:true });
renderPanel();
