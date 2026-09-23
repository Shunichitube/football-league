import { displayPlayer, STAT_LABELS } from './data.js';
import { SPECIAL_ABILITY_DESCRIPTIONS } from './market.js?v=0.8.0';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

const publicAbilities = player => {
  const display = displayPlayer(player);
  const keys = player.primaryPosition === 'GK' ? ['shoot', 'speed', 'defense', 'dribble', 'pass', 'gk'] : ['shoot', 'speed', 'defense', 'dribble', 'pass'];
  return keys.map(key => ({ key, label: STAT_LABELS[key], rank: display.ranks[key] }));
};

export function renderPlayerCard(player, options = {}) {
  const display = displayPlayer(player);
  const details = options.details !== false ? `<button type="button" data-detail="${escapeHtml(player.id)}" class="detail-button subtle">選手詳細</button>` : '';
  return `<article class="player-card">
    <div class="player-title"><b>${escapeHtml(display.name)}</b><strong class="overall-rank">総合 ${display.overallRank}</strong></div>
    <span>${display.primaryPosition}・${display.age}歳・${escapeHtml(display.nationality || '日本')}・契約${display.contractYears}年</span>
    <dl class="ability-grid">${publicAbilities(player).map(ability => `<div><dt>${ability.label}</dt><dd>${ability.rank}</dd></div>`).join('')}</dl>
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

export function renderPlayerDetail(player) {
  const display = displayPlayer(player);
  const season = player.season || {};
  const description = display.specialAbility ? SPECIAL_ABILITY_DESCRIPTIONS[display.specialAbility] : '現在、確認されている特殊能力はありません。';
  return `<section class="overlay-panel detail-panel" role="dialog" aria-modal="true" aria-label="選手詳細">
    <div class="overlay-heading"><div><p class="eyebrow">選手詳細</p><h2>${escapeHtml(display.name)}</h2></div><button type="button" data-stage10="close" class="subtle">閉じる</button></div>
    ${renderPlayerCard(player, { details: false })}
    <section class="detail-section"><h3>${display.specialAbility ? `★ ${escapeHtml(display.specialAbility)}` : '特殊能力なし'}</h3><p>${escapeHtml(description)}</p></section>
    <section class="detail-section"><h3>今季成績</h3><p>出場 ${season.appearances || 0}・得点 ${season.goals || 0}・アシスト ${season.assists || 0}・シュート ${season.shots || 0}・守備成功 ${season.defensiveStops || 0}・セーブ ${season.saves || 0}</p></section>
  </section>`;
}
