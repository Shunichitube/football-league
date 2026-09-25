import { formatMatchEvents } from './match-log.js?v=0.17.27';
import { displayPlayer, POSITION_LABELS, STAT_LABELS } from './data.js?v=0.17.2';
import { SPECIAL_ABILITY_DESCRIPTIONS } from './market.js?v=0.17.2';
import { LINEUP_SLOTS, validateLineup } from './rules.js?v=0.17.2';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

const RENAME_LIMIT = 10;
const playerRefs = new Map();
const renamedNameMap = new Map();
const publicAbilities = player => {
  const display = displayPlayer(player);
  const keys = player.primaryPosition === 'GK' ? ['speed', 'pass', 'dribble', 'shoot', 'defense', 'gk'] : ['speed', 'pass', 'dribble', 'shoot', 'defense', 'stamina'];
  return keys.filter(key => display.ranks[key]).map(key => ({ key, label: key === 'gk' ? 'GK能力' : STAT_LABELS[key], rank: display.ranks[key] }));
};
const positionLabel = position => POSITION_LABELS[position] || position;
const slotLabel = (slot, index) => `${positionLabel(slot)}${slot === 'MF' ? ` ${index === 2 ? '1' : '2'}` : ''}`;
const fitPositions = position => ({ GK: 'GK', DF: 'DF / MF', MF: 'DF / MF / FW', FW: 'MF / FW' }[position] || positionLabel(position));
const growthHint = player => {
  if (!player.hiddenGrowth || typeof player.hiddenGrowth !== 'object') return '―';
  const keys = player.primaryPosition === 'GK' ? ['gk', 'defense', 'speed', 'pass'] : ['speed', 'pass', 'dribble', 'shoot', 'defense', 'stamina'];
  const key = keys.filter(name => typeof player.hiddenGrowth[name] === 'number').sort((a, b) => player.hiddenGrowth[b] - player.hiddenGrowth[a])[0];
  return key ? (key === 'gk' ? 'GK能力' : STAT_LABELS[key]) : '―';
};
const renameAllowed = options => Boolean(options.allowRename || options.allowRelease);
const renameButton = (player, options) => renameAllowed(options) ? `<button type="button" data-rename-player="${escapeHtml(player.id)}" class="subtle rename-button" style="display:block;margin:.35rem 0 0;padding:.42rem .58rem;font-size:.7rem">名前変更</button>` : '';
const nameMarkup = display => `<b class="player-name" data-player-name="${escapeHtml(display.id)}" title="${escapeHtml(display.name)}" style="display:block;max-width:8.5em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(display.name)}</b>`;
const displayedEventName = name => renamedNameMap.get(name) || name;

function normalizePlayerName(value) {
  const raw = String(value ?? '');
  if (/\r|\n/.test(raw)) return { error: '改行は使えません。' };
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) return { error: '名前を入力してください。' };
  if (name.length > RENAME_LIMIT) return { error: `${RENAME_LIMIT}文字以内で入力してください。` };
  return { name };
}
function removeRenameModal() { document.querySelectorAll('.rename-modal-backdrop,.rename-modal-panel').forEach(node => node.remove()); }
function showRenameModal(player) {
  removeRenameModal();
  document.body.insertAdjacentHTML('beforeend', `<div class="rename-modal-backdrop overlay-backdrop" data-rename-cancel></div><section class="rename-modal-panel overlay-panel detail-panel" role="dialog" aria-modal="true" aria-label="名前変更">
    <div class="overlay-heading"><div><p class="eyebrow">選手名変更</p><h2>${escapeHtml(player.name)}</h2></div><button type="button" data-rename-cancel class="subtle">閉じる</button></div>
    <label>新しい名前<input data-rename-input maxlength="${RENAME_LIMIT}" value="${escapeHtml(player.name)}" placeholder="10文字以内"></label>
    <p class="hint">1〜${RENAME_LIMIT}文字。空白だけ・改行は使えません。カードに入りきらない場合は「…」で省略表示します。</p>
    <p class="lineup-error" data-rename-error style="display:none"></p>
    <div class="season-result-actions"><button type="button" data-rename-submit="${escapeHtml(player.id)}">変更する</button><button type="button" data-rename-cancel class="subtle">キャンセル</button></div>
  </section>`);
  const input = document.querySelector('[data-rename-input]');
  input?.focus();
  input?.select();
}
function applyRename(player, name) {
  const oldName = player.name;
  player.name = name;
  if (oldName !== name) renamedNameMap.set(oldName, name);
  document.querySelectorAll('[data-player-name]').forEach(node => {
    if (node.dataset.playerName === player.id) { node.textContent = name; node.title = name; }
  });
  if (typeof CustomEvent !== 'undefined') document.dispatchEvent(new CustomEvent('football-league:player-renamed', { detail: { playerId: player.id, oldName, name } }));
}
if (typeof document !== 'undefined' && !globalThis.__footballLeagueRenameHook) {
  globalThis.__footballLeagueRenameHook = true;
  document.addEventListener('click', event => {
    const renameId = event.target.closest('[data-rename-player]')?.dataset.renamePlayer;
    const submitId = event.target.closest('[data-rename-submit]')?.dataset.renameSubmit;
    if (renameId) { const player = playerRefs.get(renameId); if (player) showRenameModal(player); return; }
    if (event.target.closest('[data-rename-cancel]')) { removeRenameModal(); return; }
    if (!submitId) return;
    const player = playerRefs.get(submitId), input = document.querySelector('[data-rename-input]'), error = document.querySelector('[data-rename-error]');
    const result = normalizePlayerName(input?.value);
    if (result.error) { if (error) { error.textContent = result.error; error.style.display = 'block'; } return; }
    if (player) applyRename(player, result.name);
    removeRenameModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('.rename-modal-panel')) removeRenameModal();
    if (event.key === 'Enter' && event.target.matches('[data-rename-input]')) document.querySelector('[data-rename-submit]')?.click();
  });
}

export function renderPlayerCard(player, options = {}) {
  playerRefs.set(player.id, player);
  const display = displayPlayer(player);
  const description = display.specialAbility ? SPECIAL_ABILITY_DESCRIPTIONS[display.specialAbility] : '';
  const specialAbility = display.specialAbility
    ? `<details class="special-ability-detail"><summary>★ ${escapeHtml(display.specialAbility)} <span>詳細</span></summary><p>${escapeHtml(description)}</p></details>`
    : '<p class="special-ability none">―</p>';
  const release = options.allowRelease ? `<button type="button" data-stage10="release" data-release-player="${escapeHtml(player.id)}" class="subtle release-button">この選手を放出</button>` : '';
  const honors = player.honors || {};
  const honorBadges = honors.mvp || honors.best5
    ? `<div class="player-honors">${honors.mvp ? '<span class="honor-badge honor-mvp">MVP</span>' : ''}${honors.best5 ? '<span class="honor-badge honor-best5">BEST 5</span>' : ''}</div>`
    : '';
  return `<article class="player-card">
    <div class="player-profile">
      <div class="player-title"><span class="player-name-box" style="min-width:0">${nameMarkup(display)}${renameButton(player, options)}</span><strong class="overall-rank">総合 ${display.overallRank}</strong></div>
      <span class="position-badge">${positionLabel(display.primaryPosition)}</span>
      <p class="player-meta">年齢 <b>${display.age}歳</b></p>
      <p class="player-meta">契約 <b>${display.contractYears}年</b></p>
      <p class="growth-expectation">成長期待：<b>${growthHint(player)}</b></p>
      ${honorBadges}
      ${release}
    </div>
    <div class="player-abilities">
      <dl class="ability-grid">${publicAbilities(player).map(ability => `<div><dt>${ability.label}</dt><dd><span>${ability.rank}</span><i class="rank-bar rank-${ability.rank}"><b></b></i></dd></div>`).join('')}</dl>
    </div>
    <div class="player-special-row">${specialAbility}</div>
  </article>`;
}

export function positionCounts(roster) {
  return ['GK', 'DF', 'MF', 'FW'].map(position => ({ position, label: positionLabel(position), count: roster.filter(player => player.primaryPosition === position).length }));
}

export function renderRosterPanel(club, options = {}) {
  return `<section class="overlay-panel roster-panel" role="dialog" aria-modal="true" aria-label="所属選手">
    <div class="overlay-heading"><div><p class="eyebrow">${escapeHtml(club.name)}</p><h2>所属選手</h2></div><button type="button" data-stage10="close" class="subtle">閉じる</button></div>
    <div class="position-counts">${positionCounts(club.roster).map(row => `<span>${row.label} <b>${row.count}</b></span>`).join('')}</div>
    <div class="candidate-grid">${club.roster.map(player => renderPlayerCard(player, { allowRelease: Boolean(options.allowRelease), allowRename: Boolean(options.allowRename || options.allowRelease) })).join('')}</div>
  </section>`;
}

export function renderLineupEditor(club, selectedPlayerId = null, message = '', messageIsError = false, benchSort = 'position') {
  const validation = validateLineup(club);
  const starterIds = new Set(club.lineup || []);
  const positionOrder = { GK: 0, DF: 1, MF: 2, FW: 3 };
  const rankOrder = { SS: 0, S: 1, A: 2, B: 3, C: 4, D: 5, E: 6, F: 7, G: 8 };
  const bench = club.roster.map((player, index) => ({ player, index })).filter(row => !starterIds.has(row.player.id)).sort((a, b) => {
    const pa=a.player,pb=b.player;
    const pos=(positionOrder[pa.primaryPosition]??99)-(positionOrder[pb.primaryPosition]??99);
    const rank=rankOrder[displayPlayer(pa).overallRank]-rankOrder[displayPlayer(pb).overallRank];
    const age=pa.age-pb.age;
    const contract=pa.contractYears-pb.contractYears;
    const joined=a.index-b.index;
    if (benchSort === 'overall') return rank || pos || age || contract || joined;
    if (benchSort === 'age') return age || pos || rank || contract || joined;
    if (benchSort === 'contract') return contract || pos || rank || age || joined;
    return pos || rank || age || contract || joined;
  }).map(row => row.player);
  const selected = club.roster.find(player => player.id === selectedPlayerId);
  const warnings = validation.ok ? validation.warnings : [];
  const status = message || validation.error || (warnings.length ? '適性外配置があります。警告内容を確認してください。' : 'スタメン5人を設定済みです。');
  return `<section class="lineup-editor" aria-label="スタメン編成">
    <div class="lineup-status ${messageIsError || !validation.ok ? 'error' : warnings.length ? 'warning' : 'valid'}" role="status">
      <b>${escapeHtml(status)}</b>
      ${selected ? `<span>選択中：${escapeHtml(selected.name)}（${positionLabel(selected.primaryPosition)}）</span>` : '<span>選手を選択し、配置したい枠を押してください。</span>'}
      ${warnings.length ? `<ul>${warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>` : ''}
    </div>
    <h3>スタメン</h3>
    <div class="lineup-slots">${LINEUP_SLOTS.map((slot, index) => {
      const player = club.roster.find(candidate => candidate.id === club.lineup?.[index]);
      return `<section class="lineup-slot ${player && player.primaryPosition !== slot ? 'out-of-position' : ''}" data-slot-position="${slot}">
        <div class="slot-heading"><b>${slotLabel(slot, index)}</b>${player ? `<span>本職 ${positionLabel(player.primaryPosition)}</span>` : '<span>未配置</span>'}</div>
        ${player ? renderPlayerCard(player, { allowRename: true }) : '<p class="hint">選手が配置されていません。</p>'}
        ${player ? `<button type="button" data-lineup-player="${escapeHtml(player.id)}" class="${selectedPlayerId === player.id ? '' : 'subtle'}">${selectedPlayerId === player.id ? '選択中' : 'この選手を選択'}</button>` : ''}
        <button type="button" data-lineup-slot="${index}" ${selected ? '' : 'disabled'}>この枠に配置</button>
      </section>`;
    }).join('')}</div>
    <div class="bench-heading"><h3>控え</h3><label>並び順<select data-bench-sort><option value="position" ${benchSort === 'position' ? 'selected' : ''}>ポジション順</option><option value="overall" ${benchSort === 'overall' ? 'selected' : ''}>総合ランク順</option><option value="age" ${benchSort === 'age' ? 'selected' : ''}>年齢順</option><option value="contract" ${benchSort === 'contract' ? 'selected' : ''}>契約年数順</option></select></label></div>
    <div class="candidate-grid bench-grid">${bench.length ? bench.map(player => `<article class="candidate bench-player ${selectedPlayerId === player.id ? 'selected-player' : ''}">${renderPlayerCard(player, { allowRename: true })}<button type="button" data-lineup-player="${escapeHtml(player.id)}" class="${selectedPlayerId === player.id ? '' : 'subtle'}">${selectedPlayerId === player.id ? '選択中' : 'この選手を選択'}</button></article>`).join('') : '<p class="hint">控え選手はいません。</p>'}</div>
  </section>`;
}

export function matchOutcomeForClub(match, clubId) {
  const isHome = match.fixture.homeId === clubId;
  const goalsFor = isHome ? match.result.score.home : match.result.score.away;
  const goalsAgainst = isHome ? match.result.score.away : match.result.score.home;
  const opponent = isHome ? match.fixture.away : match.fixture.home;
  return { isHome, goalsFor, goalsAgainst, opponent, mark: goalsFor > goalsAgainst ? '○' : goalsFor < goalsAgainst ? '●' : '△', label: goalsFor > goalsAgainst ? '勝利' : goalsFor < goalsAgainst ? '敗戦' : '引分' };
}

export function renderSeasonMatchList(matches, clubId) {
  return `<section class="season-match-list">${matches.map((match, index) => {
    const outcome = matchOutcomeForClub(match, clubId);
    return `<button type="button" class="season-match-row" data-season-match="${index}">
      <span><b>第${match.round}節</b><small>${outcome.isHome ? 'ホーム' : 'アウェー'}</small></span>
      <strong class="result-mark">${outcome.mark} ${outcome.goalsFor} - ${outcome.goalsAgainst}</strong>
      <span><i class="club-color-dot" style="--club:${escapeHtml(outcome.opponent.color)}"></i>${escapeHtml(outcome.opponent.name)}<small>${outcome.label}</small></span>
    </button>`;
  }).join('')}</section>`;
}

export function renderMatchDetail(match) {
  const rows = [...match.result.playerResults];
  const positionOrder = { GK: 0, DF: 1, MF: 2, FW: 3 };
  const compareMatchRows = (a, b) =>
    b.rating - a.rating ||
    (positionOrder[a.player.primaryPosition] ?? 99) - (positionOrder[b.player.primaryPosition] ?? 99) ||
    b.goals - a.goals ||
    b.assists - a.assists ||
    b.shots - a.shots ||
    b.attackContributions - a.attackContributions ||
    b.defensiveStops - a.defensiveStops ||
    b.saves - a.saves ||
    String(a.player.name).localeCompare(String(b.player.name), 'ja');
  const sortedRows = [...rows].sort(compareMatchRows);
  const mvp = sortedRows[0];
  const scorers = sortedRows.filter(row => row.goals > 0).map(row => `${escapeHtml(row.player.name)}${row.goals > 1 ? ` ×${row.goals}` : ''}`).join('、') || 'なし';
  const assists = sortedRows.filter(row => row.assists > 0).map(row => `${escapeHtml(row.player.name)}${row.assists > 1 ? ` ×${row.assists}` : ''}`).join('、') || 'なし';
  const homeId = match.fixture.homeId ?? match.fixture.home.id;
  const awayId = match.fixture.awayId ?? match.fixture.away.id;
  const hasTeamIds = rows.some(row => row.teamId != null);
  const midpoint = Math.ceil(rows.length / 2);
  const homeRows = (hasTeamIds ? rows.filter(row => row.teamId === homeId) : rows.slice(0, midpoint)).sort(compareMatchRows);
  const awayRows = (hasTeamIds ? rows.filter(row => row.teamId === awayId) : rows.slice(midpoint)).sort(compareMatchRows);
  const resultCard = row => `<article class="candidate match-player-result">${renderPlayerCard(row.player)}<p><b>調子 ${match.result.forms[row.player.id] || '−'}</b>・評価 ${row.rating.toFixed(1)}</p><p>得点 ${row.goals}・アシスト ${row.assists}・シュート ${row.shots}</p><p>攻撃貢献 ${row.attackContributions}・守備成功 ${row.defensiveStops}・セーブ ${row.saves}</p></article>`;
  return `<main class="match-detail"><p class="eyebrow">第${match.round}節 試合詳細</p>
    <div class="scoreboard"><span><i class="club-color-dot" style="--club:${escapeHtml(match.fixture.home.color)}"></i>${escapeHtml(match.fixture.home.name)}</span><b>${match.result.score.home} - ${match.result.score.away}</b><span><i class="club-color-dot" style="--club:${escapeHtml(match.fixture.away.color)}"></i>${escapeHtml(match.fixture.away.name)}</span></div>
    <section class="match-summary"><p><b>得点者：</b>${scorers}</p><p><b>アシスト：</b>${assists}</p><p><b>試合MVP：</b>${escapeHtml(mvp.player.name)}（評価 ${mvp.rating.toFixed(1)}）</p></section>
    <section class="match-team-results"><h2><i class="club-color-dot" style="--club:${escapeHtml(match.fixture.home.color)}"></i>${escapeHtml(match.fixture.home.name)}（ホーム）</h2><div class="candidate-grid">${homeRows.map(resultCard).join('')}</div></section>
    <section class="match-team-results"><h2><i class="club-color-dot" style="--club:${escapeHtml(match.fixture.away.color)}"></i>${escapeHtml(match.fixture.away.name)}（アウェー）</h2><div class="candidate-grid">${awayRows.map(resultCard).join('')}</div></section>
    <h2>試合イベント</h2><div class="log static">${formatMatchEvents(match.result.events, match.fixture, displayedEventName).map(event => `<p${event.goal ? ' class="goal"' : ''}>${event.goal ? `<strong>${escapeHtml(event.text)}</strong> <span class="event-time">${escapeHtml(event.time)}</span>` : `<time>${escapeHtml(event.time)}</time>${escapeHtml(event.text)}`}</p>`).join('')}</div>
    <button type="button" data-nav="seasonResults" class="subtle">シーズン結果へ戻る</button>
  </main>`;
}

export function renderSeasonPlayerStats(club) {
  const rows = [...club.roster].sort((a, b) => b.season.goals - a.season.goals || b.season.assists - a.season.assists || b.season.appearances - a.season.appearances);
  return `<section class="candidate-grid season-player-stats">${rows.map(player => {
    const average = player.season.appearances ? (player.season.ratingTotal / player.season.appearances).toFixed(1) : '—';
    return `<article class="candidate">${renderPlayerCard(player)}<p>出場 ${player.season.appearances}・得点 ${player.season.goals}・アシスト ${player.season.assists}</p><p>平均評価 ${average}・シュート ${player.season.shots}・攻撃貢献 ${player.season.attackContributions}</p><p>守備成功 ${player.season.defensiveStops}・セーブ ${player.season.saves}</p></article>`;
  }).join('')}</section>`;
}
