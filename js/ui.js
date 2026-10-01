import { dialogs } from './dialogs.js';
import {playerAppearance,kitColor} from './avatar-profile.js?v=appearance-v23';
import { formatMatchEvents } from './match-log.js?v=0.17.31';
import { displayPlayer, POSITION_LABELS, STAT_LABELS } from './data.js?v=0.22.0';
import { SPECIAL_ABILITY_DESCRIPTIONS } from './market.js?v=0.17.2';
import { LINEUP_SLOTS, validateLineup } from './rules.js?v=0.17.2';
import { pixelTexture } from './arena-characters.js?v=appearance-v23';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

let renameHandler = null;
export function configureRename(handler) { renameHandler = handler; }
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
function removeRenameModal() {
  dialogs.beforeRender();
  document.querySelectorAll('.rename-modal-backdrop,.rename-modal-panel').forEach(node => node.remove());
  dialogs.sync();
}
function showRenameModal(player) {
  removeRenameModal();
  dialogs.beforeRender();
  document.body.insertAdjacentHTML('beforeend', `<div class="rename-modal-backdrop overlay-backdrop" data-rename-cancel></div><section data-ui-dialog="rename" class="rename-modal-panel overlay-panel detail-panel" role="dialog" aria-modal="true" aria-label="名前変更">
    <div class="overlay-heading"><div><p class="eyebrow">選手名変更</p><h2>${escapeHtml(player.name)}</h2></div><button type="button" data-dialog-close data-rename-cancel class="subtle">閉じる</button></div>
    <label>新しい名前<input data-rename-input maxlength="${RENAME_LIMIT}" value="${escapeHtml(player.name)}" placeholder="10文字以内"></label>
    <p class="hint">1〜${RENAME_LIMIT}文字。空白だけ・改行は使えません。カードに入りきらない場合は「…」で省略表示します。</p>
    <p class="lineup-error" data-rename-error style="display:none"></p>
    <div class="season-result-actions"><button type="button" data-rename-submit="${escapeHtml(player.id)}">変更する</button><button type="button" data-rename-cancel class="subtle">キャンセル</button></div>
  </section>`);
  dialogs.sync();
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
  document.addEventListener('click', async event => {
    const renameId = event.target.closest('[data-rename-player]')?.dataset.renamePlayer;
    const submitId = event.target.closest('[data-rename-submit]')?.dataset.renameSubmit;
    if (renameId) { const player = playerRefs.get(renameId); if (player) showRenameModal(player); return; }
    if (event.target.closest('[data-rename-cancel]')) { removeRenameModal(); return; }
    if (!submitId) return;
    const player = playerRefs.get(submitId), input = document.querySelector('[data-rename-input]'), error = document.querySelector('[data-rename-error]');
    const result = normalizePlayerName(input?.value);
    if (result.error) { if (error) { error.textContent = result.error; error.style.display = 'block'; } return; }
    if (!player) return;
    const button = event.target.closest('[data-rename-submit]');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    try {
      const handled = renameHandler ? await renameHandler(player.id, result.name) : false;
      if (handled === false) applyRename(player, result.name);
      removeRenameModal();
    } catch (failure) {
      if (error) { error.textContent = failure.message; error.style.display = 'block'; }
    } finally { if (button) button.disabled = false; }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('.rename-modal-panel')) removeRenameModal();
    if (event.key === 'Enter' && event.target.matches('[data-rename-input]')) document.querySelector('[data-rename-submit]')?.click();
  });
}


const rankWidths = { G:18, F:28, E:38, D:48, C:58, B:68, A:78, S:88, SS:100 };
function growthBar(ability, changes = []) {
  const change = changes.find(c => c.key === ability.key);
  const before = rankWidths[change?.from], after = rankWidths[ability.rank];
  return after > before ? `<em class="growth-bar-gain" style="left:${before}%;width:${after-before}%" aria-hidden="true"></em>` : '';
}

export function renderPlayerCard(player, options = {}) {
  playerRefs.set(player.id, player);
  const display = displayPlayer(player);
  const description = display.specialAbility ? SPECIAL_ABILITY_DESCRIPTIONS[display.specialAbility] : '';
  const specialAbility = display.specialAbility
    ? options.specialHover
      ? `<div class="special-ability-detail special-ability-hover"><span>★ ${escapeHtml(display.specialAbility)} <em>詳細</em></span><p>${escapeHtml(description)}</p></div>`
      : `<details class="special-ability-detail"><summary>★ ${escapeHtml(display.specialAbility)} <span>詳細</span></summary><p>${escapeHtml(description)}</p></details>`
    : '<p class="special-ability none">―</p>';
  const release = options.allowRelease ? `<button type="button" data-stage10="release" data-release-player="${escapeHtml(player.id)}" class="subtle release-button">この選手を放出</button>` : '';
  const honors = player.honors || {};
  const honorBadges = honors.mvp || honors.best5
    ? `<div class="player-honors">${honors.mvp ? '<span class="honor-badge honor-mvp">MVP</span>' : ''}${honors.best5 ? '<span class="honor-badge honor-best5">BEST 5</span>' : ''}</div>`
    : '';
  return `<article class="player-card">
    <div class="player-profile">
      <div class="player-title"><span class="player-name-box" style="min-width:0">${options.clubColor ? `<i class="club-color-dot player-club-dot" style="--club:${escapeHtml(options.clubColor)}"></i>` : ''}${nameMarkup(display)}${renameButton(player, options)}</span><strong class="overall-rank">総合 ${display.overallRank}</strong></div>
      <span class="position-badge">${positionLabel(display.primaryPosition)}</span>
      <p class="player-meta">年齢 <b>${display.age}歳</b></p>
      <p class="player-meta">契約 <b>${display.contractYears}年</b></p>
      <p class="growth-expectation">成長期待：<b>${growthHint(player)}</b></p>
      ${honorBadges}
      ${release}
    </div>
    <div class="player-abilities">
      <dl class="ability-grid">${publicAbilities(player).map(ability => `<div><dt>${ability.label}</dt><dd><span>${ability.rank}</span><i class="rank-bar rank-${ability.rank}"><b></b>${growthBar(ability, options.growthChanges)}</i></dd></div>`).join('')}</dl>
    </div>
    <div class="player-special-row">${specialAbility}</div>
  </article>`;
}

export function positionCounts(roster) {
  return ['GK', 'DF', 'MF', 'FW'].map(position => ({ position, label: positionLabel(position), count: roster.filter(player => player.primaryPosition === position).length }));
}

export function renderRosterPanel(club, options = {}) {
  const rosterSort = options.rosterSort || 'position';
  return `<section data-app-overlay data-ui-dialog="roster" class="overlay-panel roster-panel" role="dialog" aria-modal="true" aria-label="所属選手">
    <div class="overlay-heading"><div><p class="eyebrow">${escapeHtml(club.name)}</p><h2>所属選手</h2></div><button type="button" data-dialog-close data-stage10="close" class="subtle">閉じる</button></div>
    <div class="bench-heading roster-sort-heading"><div class="position-counts">${positionCounts(club.roster).map(row => `<span>${row.label} <b>${row.count}</b></span>`).join('')}</div><label>並び順<select data-player-sort="roster"><option value="position" ${rosterSort === 'position' ? 'selected' : ''}>ポジション順</option><option value="overall" ${rosterSort === 'overall' ? 'selected' : ''}>総合ランク順</option><option value="age" ${rosterSort === 'age' ? 'selected' : ''}>年齢順</option><option value="contract" ${rosterSort === 'contract' ? 'selected' : ''}>契約年数順</option></select></label></div>
    <div class="candidate-grid">${club.roster.map(player => renderPlayerCard(player, { allowRelease: Boolean(options.allowRelease), allowRename: Boolean(options.allowRename || options.allowRelease) })).join('')}</div>
  </section>`;
}

const squadAvatars = new Map();
function squadAvatar(player, clubColor) {
  const appearance = playerAppearance(player), goalkeeper = player.primaryPosition === 'GK';
  const color = kitColor(clubColor, goalkeeper), key = JSON.stringify([appearance, color, goalkeeper]);
  if (typeof document === 'undefined') return '';
  if (!squadAvatars.has(key)) squadAvatars.set(key, pixelTexture(color, appearance, 'player', {goalkeeper}).toDataURL());
  return squadAvatars.get(key);
}

function abilityArrow(direction,label='',equal=false){
 if(!direction&&!equal)return '';
 return `<strong class="ability-direction ${direction>0?'up':direction<0?'down':'same'}" aria-label="${escapeHtml(label|| (direction>0?'上昇':direction<0?'下降':'同じ'))}">${direction>0?'▲':direction<0?'▼':'＝'}</strong>`;
}
function growthDirection(ability,changes){
 const change=changes?.find(c=>c.key===ability.key);
 if(!change)return 0;
 return Number.isFinite(change.fromValue)&&Number.isFinite(change.toValue)?Math.sign(change.toValue-change.fromValue):Math.sign((rankWidths[change.to]||0)-(rankWidths[change.from]||0))||(change.increased?1:0);
}
function squadGrowthBar(ability,changes){
 return `<i class="rank-bar rank-${escapeHtml(ability.rank)}"><b></b>${changes?growthBar(ability,changes):''}</i>`;
}
function renderSquadCard(player, lineup, selectedId, clubColor, growthChanges = null) {
  playerRefs.set(player.id, player);
  const display = displayPlayer(player);
  const slot = lineup.indexOf(player.id);
  const status = slot < 0 ? '控え' : `先発 ${slotLabel(LINEUP_SLOTS[slot], slot).replace(' ', '')}`;
  const abilities = publicAbilities(player);
  return `<article class="squad-player ${slot < 0 ? 'reserve' : 'starter'} ${selectedId === player.id ? 'selected-player' : ''}" data-compare-player="${escapeHtml(player.id)}" data-lineup-drag="${escapeHtml(player.id)}" draggable="true" tabindex="0" aria-label="${escapeHtml(player.name)}、${escapeHtml(status)}、総合${escapeHtml(display.overallRank)}">
    <div class="squad-avatar" draggable="true" data-lineup-drag="${escapeHtml(player.id)}" aria-hidden="true">${squadRoleBadge(player, lineup)}<img src="${squadAvatar(player, clubColor)}" alt="" draggable="false"></div>
    <div class="squad-identity"><b class="player-name" data-player-name="${escapeHtml(player.id)}" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</b><strong>総合 ${escapeHtml(display.overallRank)}</strong><span>${escapeHtml(positionLabel(player.primaryPosition))} ・ ${display.age}歳</span><span>契約 ${display.contractYears}年</span><div class="squad-card-actions"><button type="button" data-lineup-player="${escapeHtml(player.id)}" class="subtle">${selectedId === player.id ? '選択中' : '選択'}</button><button type="button" data-rename-player="${escapeHtml(player.id)}" class="subtle" aria-label="${escapeHtml(player.name)}の名前変更">改名</button></div></div>
    <dl class="squad-abilities">${abilities.map(ability => `<div><dt>${escapeHtml(ability.label)}</dt><dd><span>${escapeHtml(ability.rank)}${abilityArrow(growthDirection(ability,growthChanges))}</span>${squadGrowthBar(ability,growthChanges)}</dd></div>`).join('')}</dl>
    <div class="squad-special" title="${escapeHtml(display.specialAbility ? SPECIAL_ABILITY_DESCRIPTIONS[display.specialAbility] || '' : '')}"><span>特能</span><b>${escapeHtml(display.specialAbility || '―')}</b></div>
  </article>`;
}

function squadRoleBadge(player, lineup) {
  const slot = lineup.indexOf(player.id);
  const status = slot < 0 ? '控え' : `先発 ${slotLabel(LINEUP_SLOTS[slot], slot).replace(' ', '')}`;
  return `<em class="squad-role-badge ${slot < 0 ? 'reserve' : 'starter'}">${escapeHtml(status)}</em>`;
}

export function renderSquadComparison(club, selectedId, targetId = null) {
  const source = club.roster.find(player => player.id === selectedId);
  const target = club.roster.find(player => player.id === targetId);
  if (!source) return '<div class="compare-empty">ボード上の選手を選ぶと比較できます。</div>';
  const order = ['G','F','E','D','C','B','A','S','SS'];
  const left = displayPlayer(source), right = target ? displayPlayer(target) : null;
  const abilities = publicAbilities(source);
  const profile = player => player ? `<div class="compare-profile">${squadRoleBadge(player, club.lineup || [])}<img src="${squadAvatar(player, club.color)}" alt=""><div><strong>${escapeHtml(player.name)}</strong><span>総合 ${escapeHtml(displayPlayer(player).overallRank)} ・ ${escapeHtml(positionLabel(player.primaryPosition))}</span><small>${player.age}歳 ・ 契約${player.contractYears}年</small></div></div>` : '<div class="compare-profile compare-placeholder">所属選手にホバーまたは選択</div>';
  return `<div class="compare-duel"><section class="compare-person">${profile(source)}<div class="compare-ability-list">${abilities.map(ability => `<div><span>${escapeHtml(ability.label)}</span><b>${escapeHtml(ability.rank)}</b>${squadGrowthBar(ability,null)}</div>`).join('')}</div><p class="compare-special">特能 <b>${escapeHtml(left.specialAbility || '―')}</b></p></section><span class="compare-vs">VS</span><section class="compare-person">${profile(target)}<div class="compare-ability-list">${abilities.map(ability => {
    const rank = right?.ranks[ability.key];
    const change = rank ? Math.sign(order.indexOf(rank) - order.indexOf(ability.rank)) : 0;
    return `<div><span>${escapeHtml(ability.label)}</span><b>${escapeHtml(rank || '―')}</b><i class="rank-bar ${rank ? `rank-${escapeHtml(rank)}` : 'compare-no-rank'}"><b></b></i>${rank?abilityArrow(change,change>0?'比較対象が高い':change<0?'比較対象が低い':'同じ',true):''}</div>`;
  }).join('')}</div><p class="compare-special">特能 <b>${escapeHtml(right?.specialAbility || '―')}</b></p></section></div>`;
}

export function renderLineupEditor(club, selectedPlayerId = null, message = '', messageIsError = false, benchSort = 'position', tactics = '') {
  const validation = validateLineup(club);
  const positionOrder = { GK: 0, DF: 1, MF: 2, FW: 3 };
  const rankOrder = { SS: 0, S: 1, A: 2, B: 3, C: 4, D: 5, E: 6, F: 7, G: 8 };
  const roster = club.roster.map((player, index) => ({ player, index })).sort((a, b) => {
    const pa = a.player, pb = b.player;
    const pos = (positionOrder[pa.primaryPosition] ?? 99) - (positionOrder[pb.primaryPosition] ?? 99);
    const rank = rankOrder[displayPlayer(pa).overallRank] - rankOrder[displayPlayer(pb).overallRank];
    const age = pa.age - pb.age, contract = pa.contractYears - pb.contractYears, joined = a.index - b.index;
    if (benchSort === 'overall') return rank || pos || age || contract || joined;
    if (benchSort === 'age') return age || pos || rank || contract || joined;
    if (benchSort === 'contract') return contract || pos || rank || age || joined;
    return pos || rank || age || contract || joined;
  }).map(row => row.player);
  const status = message || validation.error || (validation.warnings.length ? '適性外配置があります。' : '');
  return `<section class="lineup-editor formation-editor" aria-label="スタメン編成">
    <div class="lineup-status ${messageIsError || !validation.ok ? 'error' : validation.warnings.length ? 'warning' : 'valid'}" role="status" ${status ? '' : 'hidden'}><b>${escapeHtml(status)}</b><span class="formation-drop-status" aria-live="polite"></span></div>
    <div class="formation-side"><div class="formation-board-title"><h3>フォーメーション</h3><span>5人のスタメン</span></div><div class="lineup-slots formation-pitch">${LINEUP_SLOTS.map((slot, index) => {
      const player = club.roster.find(candidate => candidate.id === club.lineup?.[index]);
      return `<button type="button" class="lineup-slot formation-token ${player && player.primaryPosition !== slot ? 'out-of-position' : ''} ${selectedPlayerId === player?.id ? 'selected-player' : ''}" data-lineup-slot="${index}" data-lineup-drag="${player ? escapeHtml(player.id) : ''}" ${player ? 'draggable="true"' : ''} aria-label="${slotLabel(slot,index)}：${player ? escapeHtml(player.name) : '空き枠'}">${player ? `${squadRoleBadge(player, club.lineup || [])}<img src="${squadAvatar(player, club.color)}" alt="" draggable="false"><strong>${escapeHtml(player.name)}</strong><span class="formation-details">総合 ${escapeHtml(displayPlayer(player).overallRank)} ・ ${escapeHtml(positionLabel(player.primaryPosition))}${player.primaryPosition !== slot ? ' ▼' : ''}</span>` : `<span class="formation-position">${slotLabel(slot,index)}</span><span class="formation-empty">＋ 配置</span>`}</button>`;
    }).join('')}</div><section class="squad-tablet" aria-label="戦術と選手比較"><div class="squad-tablet-tactics">${tactics}</div><div class="squad-compare"><h3>選手比較 <small>PLAYER COMPARE</small></h3><div class="squad-compare-content">${renderSquadComparison(club, selectedPlayerId)}</div></div></section></div>
    <div class="formation-cards"><div class="bench-heading"><h3>所属選手 <small>${club.roster.length}/12</small></h3><label>並び順<select data-bench-sort><option value="position" ${benchSort === 'position' ? 'selected' : ''}>ポジション順</option><option value="overall" ${benchSort === 'overall' ? 'selected' : ''}>総合ランク順</option><option value="age" ${benchSort === 'age' ? 'selected' : ''}>年齢順</option><option value="contract" ${benchSort === 'contract' ? 'selected' : ''}>契約年数順</option></select></label></div><div class="candidate-grid bench-grid">${roster.map(player => renderSquadCard(player, club.lineup || [], selectedPlayerId, club.color)).join('')}</div><div class="squad-season-action"><button data-a="season" ${validation.ok ? '' : 'disabled'}>シーズンをシミュレート ›</button></div></div>
  </section>`;
}

export function matchOutcomeForClub(match, clubId) {
  const isHome = match.fixture.homeId === clubId;
  const goalsFor = isHome ? match.result.score.home : match.result.score.away;
  const goalsAgainst = isHome ? match.result.score.away : match.result.score.home;
  const opponent = isHome ? match.fixture.away : match.fixture.home;
  return { isHome, goalsFor, goalsAgainst, opponent, mark: goalsFor > goalsAgainst ? '●' : goalsFor < goalsAgainst ? '○' : '△', label: goalsFor > goalsAgainst ? '勝利' : goalsFor < goalsAgainst ? '敗戦' : '引分' };
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
  const resultCard = row => { const clubColor = row.teamId === awayId ? match.fixture.away.color : match.fixture.home.color; return `<article class="candidate match-player-result">${renderPlayerCard(row.player,{clubColor})}<div class="match-player-avatar"><img src="${squadAvatar(row.player,clubColor)}" alt="${escapeHtml(row.player.name)}"></div><p><b>調子 ${match.result.forms[row.player.id] || '−'}</b>・評価 ${row.rating.toFixed(1)}</p><p>得点 ${row.goals}・アシスト ${row.assists}・シュート ${row.shots}</p><p>攻撃貢献 ${row.attackContributions}・守備成功 ${row.defensiveStops}・セーブ ${row.saves}</p></article>`; };
  return `<main class="match-detail"><div class="match-detail-topbar"><p class="eyebrow">第${match.round}節 試合詳細</p><button type="button" data-nav="seasonResults" class="match-results-back">← シーズン結果に戻る</button></div>
    <div class="scoreboard"><span><i class="club-color-dot" style="--club:${escapeHtml(match.fixture.home.color)}"></i>${escapeHtml(match.fixture.home.name)}</span><b>${match.result.score.home} - ${match.result.score.away}</b><span><i class="club-color-dot" style="--club:${escapeHtml(match.fixture.away.color)}"></i>${escapeHtml(match.fixture.away.name)}</span></div>
    <section class="match-summary"><p><b>得点者：</b>${scorers}</p><p><b>アシスト：</b>${assists}</p><p><b>試合MVP：</b>${escapeHtml(mvp.player.name)}（評価 ${mvp.rating.toFixed(1)}）</p></section>
    <section class="match-team-results"><h2><i class="club-color-dot" style="--club:${escapeHtml(match.fixture.home.color)}"></i>${escapeHtml(match.fixture.home.name)}（ホーム）</h2><div class="candidate-grid">${homeRows.map(resultCard).join('')}</div></section>
    <section class="match-team-results"><h2><i class="club-color-dot" style="--club:${escapeHtml(match.fixture.away.color)}"></i>${escapeHtml(match.fixture.away.name)}（アウェー）</h2><div class="candidate-grid">${awayRows.map(resultCard).join('')}</div></section>
    <h2>試合イベント</h2><div class="log static">${formatMatchEvents(match.result.events, match.fixture, displayedEventName).map(event => { const eventColor=event.side==='home'?match.fixture.home.color:event.side==='away'?match.fixture.away.color:null; return `<p${event.goal ? ' class="goal"' : ''}>${eventColor?`<i class="club-color-dot match-event-club-dot" style="--club:${escapeHtml(eventColor)}"></i>`:''}${event.goal ? `<strong>${escapeHtml(event.text)}</strong> <span class="event-time">${escapeHtml(event.time)}</span>` : `<time>${escapeHtml(event.time)}</time>${escapeHtml(event.text)}`}</p>`; }).join('')}</div>
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

export function renderContractPlayerCard(player,club,growthChanges=null){
 return renderSquadCard(player,club.lineup||[],null,club.color,growthChanges)
  .replace(/<div class="squad-card-actions">[\s\S]*?<\/div>/,'')
  .replace(/ data-(?:compare-player|lineup-drag)="[^"]*"/g,'')
  .replace(/draggable="true"/g,'draggable="false"');
}
