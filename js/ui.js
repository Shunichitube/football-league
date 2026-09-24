import { displayPlayer, STAT_LABELS } from './data.js?v=0.16.2';
import { SPECIAL_ABILITY_DESCRIPTIONS } from './market.js?v=0.16.2';
import { LINEUP_SLOTS, validateLineup } from './rules.js?v=0.16.2';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

const publicAbilities = player => {
  const display = displayPlayer(player);
  const keys = player.primaryPosition === 'GK' ? ['shoot', 'speed', 'defense', 'dribble', 'pass', 'gk'] : ['shoot', 'speed', 'defense', 'dribble', 'pass', 'stamina'];
  return keys.filter(key => display.ranks[key]).map(key => ({ key, label: STAT_LABELS[key], rank: display.ranks[key] }));
};

export function renderPlayerCard(player, options = {}) {
  const display = displayPlayer(player);
  const details = options.details !== false ? `<button type="button" data-detail="${escapeHtml(player.id)}" class="detail-button subtle">選手詳細</button>` : '';
  return `<article class="player-card">
    <div class="player-title"><b>${escapeHtml(display.name)}</b><strong class="overall-rank">総合 ${display.overallRank}</strong></div>
    <span>${display.primaryPosition}・${display.age}歳・契約${display.contractYears}年</span>
    <dl class="ability-grid">${publicAbilities(player).map(ability => `<div><dt>${ability.label}</dt><dd><span>${ability.rank}</span><i class="rank-bar rank-${ability.rank}"><b></b></i></dd></div>`).join('')}</dl>
    <p class="special-ability">${display.specialAbility ? `★ ${escapeHtml(display.specialAbility)}` : '特殊能力なし'}</p>
    ${details}
  </article>`;
}

export function positionCounts(roster) {
  return ['GK', 'FIXO', 'ALA', 'PIVO'].map(position => ({ position, count: roster.filter(player => player.primaryPosition === position).length }));
}

export function renderRosterPanel(club) {
  return `<section class="overlay-panel roster-panel" role="dialog" aria-modal="true" aria-label="所属選手">
    <div class="overlay-heading"><div><p class="eyebrow">${escapeHtml(club.name)}</p><h2>所属選手</h2></div><button type="button" data-stage10="close" class="subtle">閉じる</button></div>
    <div class="position-counts">${positionCounts(club.roster).map(row => `<span>${row.position} <b>${row.count}</b></span>`).join('')}</div>
    <div class="candidate-grid">${club.roster.map(player => renderPlayerCard(player)).join('')}</div>
  </section>`;
}

export function renderPlayerDetail(player, options = {}) {
  const display = displayPlayer(player);
  const season = player.season || {};
  const description = display.specialAbility ? SPECIAL_ABILITY_DESCRIPTIONS[display.specialAbility] : '現在、確認されている特殊能力はありません。';
  return `<section class="overlay-panel detail-panel" role="dialog" aria-modal="true" aria-label="選手詳細">
    <div class="overlay-heading"><div><p class="eyebrow">選手詳細</p><h2>${escapeHtml(display.name)}</h2></div><button type="button" data-stage10="close" class="subtle">閉じる</button></div>
    ${renderPlayerCard(player, { details: false })}
    <section class="detail-section"><h3>${display.specialAbility ? `★ ${escapeHtml(display.specialAbility)}` : '特殊能力なし'}</h3><p>${escapeHtml(description)}</p></section>
    <section class="detail-section"><h3>今季成績</h3><p>出場 ${season.appearances || 0}・得点 ${season.goals || 0}・アシスト ${season.assists || 0}・シュート ${season.shots || 0}・守備成功 ${season.defensiveStops || 0}・セーブ ${season.saves || 0}</p></section>
    ${options.releaseMessage ? `<p class="lineup-error">${escapeHtml(options.releaseMessage)}</p>` : ''}
    ${options.allowRelease ? `<button type="button" data-stage10="release" data-release-player="${escapeHtml(player.id)}" class="subtle">この選手を放出</button>` : ''}
  </section>`;
}

export function renderLineupEditor(club, selectedPlayerId = null, message = '', messageIsError = false, benchSort = 'position') {
  const validation = validateLineup(club);
  const starterIds = new Set(club.lineup || []);
  const positionOrder = { GK: 0, FIXO: 1, ALA: 2, PIVO: 3 };
  const rankOrder = { SS: 0, S: 1, A: 2, B: 3, C: 4, D: 5, E: 6, F: 7, G: 8 };
  const bench = club.roster.map((player, index) => ({ player, index })).filter(row => !starterIds.has(row.player.id)).sort((a, b) => benchSort === 'overall' ? rankOrder[displayPlayer(a.player).overallRank] - rankOrder[displayPlayer(b.player).overallRank] || a.index - b.index : positionOrder[a.player.primaryPosition] - positionOrder[b.player.primaryPosition] || a.index - b.index).map(row => row.player);
  const selected = club.roster.find(player => player.id === selectedPlayerId);
  const warnings = validation.ok ? validation.warnings : [];
  const status = message || validation.error || (warnings.length ? '適性外配置があります。警告内容を確認してください。' : 'スタメン5人を設定済みです。');
  return `<section class="lineup-editor" aria-label="スタメン編成">
    <div class="lineup-status ${messageIsError || !validation.ok ? 'error' : warnings.length ? 'warning' : 'valid'}" role="status">
      <b>${escapeHtml(status)}</b>
      ${selected ? `<span>選択中：${escapeHtml(selected.name)}（${selected.primaryPosition}）</span>` : '<span>選手を選択し、配置したい枠を押してください。</span>'}
      ${warnings.length ? `<ul>${warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>` : ''}
    </div>
    <h3>スタメン</h3>
    <div class="lineup-slots">${LINEUP_SLOTS.map((slot, index) => {
      const player = club.roster.find(candidate => candidate.id === club.lineup?.[index]);
      return `<section class="lineup-slot ${player && player.primaryPosition !== slot ? 'out-of-position' : ''}" data-slot-position="${slot}">
        <div class="slot-heading"><b>${slot}${slot === 'ALA' ? ` ${index === 2 ? '1' : '2'}` : ''}</b>${player ? `<span>本職 ${player.primaryPosition}</span>` : '<span>未配置</span>'}</div>
        ${player ? renderPlayerCard(player) : '<p class="hint">選手が配置されていません。</p>'}
        ${player ? `<button type="button" data-lineup-player="${escapeHtml(player.id)}" class="${selectedPlayerId === player.id ? '' : 'subtle'}">${selectedPlayerId === player.id ? '選択中' : 'この選手を選択'}</button>` : ''}
        <button type="button" data-lineup-slot="${index}" ${selected ? '' : 'disabled'}>この枠に配置</button>
      </section>`;
    }).join('')}</div>
    <div class="bench-heading"><h3>控え</h3><label>並び順<select data-bench-sort><option value="position" ${benchSort === 'position' ? 'selected' : ''}>ポジション順</option><option value="overall" ${benchSort === 'overall' ? 'selected' : ''}>総合ランク順</option></select></label></div>
    <div class="candidate-grid bench-grid">${bench.length ? bench.map(player => `<article class="candidate bench-player ${selectedPlayerId === player.id ? 'selected-player' : ''}">${renderPlayerCard(player)}<button type="button" data-lineup-player="${escapeHtml(player.id)}" class="${selectedPlayerId === player.id ? '' : 'subtle'}">${selectedPlayerId === player.id ? '選択中' : 'この選手を選択'}</button></article>`).join('') : '<p class="hint">控え選手はいません。</p>'}</div>
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
  const rows = [...match.result.playerResults].sort((a, b) => b.rating - a.rating);
  const mvp = rows[0];
  const scorers = rows.filter(row => row.goals > 0).map(row => `${escapeHtml(row.player.name)}${row.goals > 1 ? ` ×${row.goals}` : ''}`).join('、') || 'なし';
  const assists = rows.filter(row => row.assists > 0).map(row => `${escapeHtml(row.player.name)}${row.assists > 1 ? ` ×${row.assists}` : ''}`).join('、') || 'なし';
  return `<main class="match-detail"><p class="eyebrow">第${match.round}節 試合詳細</p>
    <div class="scoreboard"><span><i class="club-color-dot" style="--club:${escapeHtml(match.fixture.home.color)}"></i>${escapeHtml(match.fixture.home.name)}</span><b>${match.result.score.home} - ${match.result.score.away}</b><span><i class="club-color-dot" style="--club:${escapeHtml(match.fixture.away.color)}"></i>${escapeHtml(match.fixture.away.name)}</span></div>
    <section class="match-summary"><p><b>得点者：</b>${scorers}</p><p><b>アシスト：</b>${assists}</p><p><b>試合MVP：</b>${escapeHtml(mvp.player.name)}（評価 ${mvp.rating.toFixed(1)}）</p></section>
    <h2>各選手の成績</h2><section class="candidate-grid">${rows.map(row => `<article class="candidate match-player-result">${renderPlayerCard(row.player)}<p><b>調子 ${match.result.forms[row.player.id] || '−'}</b>・評価 ${row.rating.toFixed(1)}</p><p>得点 ${row.goals}・アシスト ${row.assists}・シュート ${row.shots}</p><p>攻撃貢献 ${row.attackContributions}・守備成功 ${row.defensiveStops}・セーブ ${row.saves}</p></article>`).join('')}</section>
    <h2>試合イベント</h2><div class="log static">${match.result.events.map(event => `<p>${event.time} <b>${escapeHtml(event.kind)}</b> ${escapeHtml(event.player)}${event.extra ? `・${escapeHtml(event.extra)}` : ''}</p>`).join('')}</div>
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
