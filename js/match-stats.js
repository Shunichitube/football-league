// Possession is measured in attacking simulation phases, not wall-clock time.
export const blankMatchStats = () => ({ possessionPhases: 0, passAttempts: 0, passSuccesses: 0, dribbleAttempts: 0, dribbleSuccesses: 0, shots: 0, shotsOnTarget: 0 });

export function aggregateSeasonStats(matches, clubId) {
  const total = blankMatchStats();
  let recordedMatches = 0, possessionTotal = 0;
  for (const match of matches) {
    const side = match.fixture.homeId === clubId ? 'home' : match.fixture.awayId === clubId ? 'away' : null;
    const stats = side && match.result.teamStats;
    if (!stats?.[side]) continue;
    const own = stats[side];
    const phases = stats.home.possessionPhases + stats.away.possessionPhases;
    if (!phases) continue;
    recordedMatches++;
    possessionTotal += own.possessionPhases / phases * 100;
    for (const key of Object.keys(total)) total[key] += own[key];
  }
  return { ...total, recordedMatches, possessionPercent: recordedMatches ? possessionTotal / recordedMatches : null };
}

const percent = value => value == null ? '未記録' : `${Math.round(value)}%`;
const rate = (successes, attempts) => attempts ? `${Math.round(successes / attempts * 100)}% <small>(${successes}/${attempts})</small>` : '— <small>(0/0)</small>';
const metrics = (stats, possession) => stats ? [percent(possession), rate(stats.passSuccesses, stats.passAttempts), rate(stats.dribbleSuccesses, stats.dribbleAttempts), String(stats.shots), String(stats.shotsOnTarget)] : Array(5).fill('未記録');
const labels = ['ボール支配率', 'パス成功率', 'ドリブル成功率', 'シュート数', '枠内シュート数'];

export function renderSeasonTeamStats(matches, clubId) {
  const stats = aggregateSeasonStats(matches, clubId);
  const values = metrics(stats.recordedMatches ? stats : null, stats.possessionPercent);
  return `<section class="season-team-stats" aria-label="シーズン全体の試合成績"><div class="team-stats-heading"><b>シーズン全体</b><small>${stats.recordedMatches}試合集計 · 支配率は平均／シュートは合計</small></div><dl>${labels.map((label, i) => `<div><dt>${label}</dt><dd>${values[i]}</dd></div>`).join('')}</dl></section>`;
}

export function renderMatchTeamStats(match, escapeHtml) {
  const stats = match.result.teamStats;
  const phases = stats ? stats.home.possessionPhases + stats.away.possessionPhases : 0;
  const homePercent = phases ? Math.round(stats.home.possessionPhases / phases * 100) : null;
  const home = metrics(stats?.home, homePercent);
  const away = metrics(stats?.away, homePercent == null ? null : 100 - homePercent);
  return `<section class="match-team-stats" aria-label="両チームの試合成績"><table><thead><tr><th scope="col">${escapeHtml(match.fixture.home.name)}</th><th scope="col">試合成績</th><th scope="col">${escapeHtml(match.fixture.away.name)}</th></tr></thead><tbody>${labels.map((label, i) => `<tr><td>${home[i]}</td><th scope="row">${label}</th><td>${away[i]}</td></tr>`).join('')}</tbody></table><p>支配率：攻撃フェーズの割合 · 成功率：成功数／試行数（パス・ドリブル判定）</p></section>`;
}
