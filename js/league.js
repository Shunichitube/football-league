import { calculateOverall, createClub } from './data.js?v=0.17.2';
import { rankOf } from './config.js';
import { simulateMatch } from './sim.js?v=0.17.27';
import { createRandom } from './random.js';

const CPU_CLUBS = [
  ['RIVERA FIVE', '#60a5fa'], ['NORTH STARS', '#f59e0b'], ['KOBE ORBIT', '#f472b6'],
  ['GREEN RUSH', '#34d399'], ['OSAKA VIOLET', '#a78bfa']
];

const blankRecord = () => ({ played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
const cloneSide = club => ({ id: club.id, name: club.name, color: club.color });
const BLANK_ATTACK_TYPES = Object.freeze({ PASS: 0, DRIBBLE: 0, COUNTER: 0, SHORT_COUNTER: 0 });
const BLANK_CHANCES = Object.freeze({ HARD: 0, NORMAL: 0, CLEAR: 0, BIG: 0 });

function blankSummaryBuckets() {
  return {
    attackTypes: { ...BLANK_ATTACK_TYPES },
    goalsByType: { ...BLANK_ATTACK_TYPES },
    chances: { ...BLANK_CHANCES },
    goalsByChance: { ...BLANK_CHANCES },
    events: { goals: 0, saves: 0, gkCatches: 0, misses: 0, rebounds: 0, defensiveStops: 0, shortCounters: 0 }
  };
}

function eventMeta(event) {
  const type = event?.display?.type;
  const chanceValue = event?.display?.chance;
  const attackType = BLANK_ATTACK_TYPES.hasOwnProperty(type) ? type : null;
  const chance = BLANK_CHANCES.hasOwnProperty(chanceValue) ? chanceValue : null;
  return { attackType, chance };
}

function countEvent(summary, event) {
  const { attackType, chance } = eventMeta(event);
  if (attackType) summary.attackTypes[attackType]++;
  if (chance) summary.chances[chance]++;
  if (event.kind === 'GOAL') {
    summary.events.goals++;
    if (attackType) summary.goalsByType[attackType]++;
    if (chance) summary.goalsByChance[chance]++;
  } else if (event.kind === 'SAVE') summary.events.saves++;
  else if (event.kind === 'GK CATCH') summary.events.gkCatches++;
  else if (event.kind === 'MISS') summary.events.misses++;
  else if (event.kind === 'REBOUND') summary.events.rebounds++;
  else if (event.kind === 'DEFENSIVE STOP') summary.events.defensiveStops++;
  else if (event.kind === 'SHORT COUNTER') summary.events.shortCounters++;
}

export function summarizeMatchResult(result) {
  const summary = blankSummaryBuckets();
  for (const event of result.events || []) countEvent(summary, event);
  const shots = (result.playerResults || []).reduce((sum, row) => sum + (row.shots || 0), 0);
  const saves = (result.playerResults || []).reduce((sum, row) => sum + (row.saves || 0), 0);
  const defensiveStops = (result.playerResults || []).reduce((sum, row) => sum + (row.defensiveStops || 0), 0);
  summary.score = { ...(result.score || { home: 0, away: 0 }) };
  summary.totalGoals = (summary.score.home || 0) + (summary.score.away || 0);
  summary.shots = shots;
  summary.saves = saves;
  summary.defensiveStops = defensiveStops;
  summary.phases = result.phases || 0;
  return summary;
}

function cloneSummary(summary) {
  return {
    ...summary,
    score: { ...(summary?.score || {}) },
    attackTypes: { ...(summary?.attackTypes || {}) },
    goalsByType: { ...(summary?.goalsByType || {}) },
    chances: { ...(summary?.chances || {}) },
    goalsByChance: { ...(summary?.goalsByChance || {}) },
    events: { ...(summary?.events || {}) }
  };
}

export function createSchedule(clubIds) {
  const rotation = [...clubIds]; const firstHalf = [];
  for (let round = 0; round < clubIds.length - 1; round++) {
    const fixtures = [];
    for (let i = 0; i < clubIds.length / 2; i++) {
      const [a, b] = [rotation[i], rotation[rotation.length - 1 - i]];
      fixtures.push({ homeId: round % 2 === 0 ? a : b, awayId: round % 2 === 0 ? b : a });
    }
    firstHalf.push(fixtures);
    rotation.splice(1, 0, rotation.pop());
  }
  return [...firstHalf, ...firstHalf.map(fixtures => fixtures.map(f => ({ homeId: f.awayId, awayId: f.homeId })))]
    .map((fixtures, index) => ({ round: index + 1, fixtures }));
}

export function createLeague({ name, color, seed }) {
  const rng = createRandom(`${seed}:clubs`);
  const clubs = [createClub({ id: 1, name, color, seed: rng, controllerType: 'HUMAN' }), ...CPU_CLUBS.map(([cpuName, cpuColor], index) => createClub({ id: index + 2, name: cpuName, color: cpuColor, seed: rng, controllerType: 'CPU' }))];
  return { seed, season: 1, history: [], careerRecords: [], draftRecords: [], humanClubId: 1, clubs, schedule: createSchedule(clubs.map(c => c.id)), currentRound: 1, records: Object.fromEntries(clubs.map(c => [c.id, blankRecord()])), seasonResults: [], fixtureResults: [], releasedPlayers: [], completed: false };
}

export function clubsForController(league, controllerType) { return league.clubs.filter(club => club.controllerType === controllerType); }

export function standings(league) {
  const rows = league.clubs.map(club => ({ club, ...league.records[club.id], goalDifference: league.records[club.id].goalsFor - league.records[club.id].goalsAgainst }));
  const primary = (a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor;
  const ranked = [];
  for (let start = 0, ordered = [...rows].sort(primary); start < ordered.length;) {
    let end = start + 1; while (end < ordered.length && primary(ordered[start], ordered[end]) === 0) end++;
    const group = ordered.slice(start, end), ids = new Set(group.map(row => row.club.id)), direct = new Map(group.map(row => [row.club.id, { points: 0, difference: 0, goals: 0 }]));
    for (const match of league.fixtureResults || []) if (ids.has(match.homeId) && ids.has(match.awayId)) {
      const home = direct.get(match.homeId), away = direct.get(match.awayId), { homeGoals, awayGoals } = match;
      home.goals += homeGoals; away.goals += awayGoals; home.difference += homeGoals - awayGoals; away.difference += awayGoals - homeGoals;
      if (homeGoals > awayGoals) home.points += 3; else if (homeGoals < awayGoals) away.points += 3; else { home.points++; away.points++; }
    }
    const tieRng = createRandom(`${league.seed}:season:${league.season}:tiebreak:${group.map(row => row.club.id).sort((a,b)=>a-b).join('-')}`), random = new Map([...group].sort((a,b)=>a.club.id-b.club.id).map(row => [row.club.id, tieRng.next()]));
    ranked.push(...group.sort((a, b) => direct.get(b.club.id).points - direct.get(a.club.id).points || direct.get(b.club.id).difference - direct.get(a.club.id).difference || direct.get(b.club.id).goals - direct.get(a.club.id).goals || random.get(b.club.id) - random.get(a.club.id)));
    start = end;
  }
  return ranked.map((row, index) => ({ ...row, rank: index + 1 }));
}

function archiveCareer(league, player, clubId = null) {
  league.careerRecords ||= [];
  const currentOverall = calculateOverall(player);
  player.peakOverall = Math.max(player.peakOverall || currentOverall, currentOverall);
  player.peakOverallByClub ||= {};
  if (clubId != null) player.peakOverallByClub[clubId] = Math.max(player.peakOverallByClub[clubId] || currentOverall, currentOverall);
  const record = {
    id: player.id,
    name: player.name,
    position: player.primaryPosition,
    career: { ...(player.career || {}) },
    clubCareer: Object.fromEntries(Object.entries(player.clubCareer || {}).map(([id, stats]) => [id, { ...stats }])),
    clubSeasons: { ...(player.clubSeasons || {}) },
    peakOverall: player.peakOverall,
    peakOverallByClub: { ...(player.peakOverallByClub || {}) },
    honors: { ...(player.honors || {}) }
  };
  const index = league.careerRecords.findIndex(candidate => candidate.id === player.id);
  if (index >= 0) league.careerRecords[index] = record; else league.careerRecords.push(record);
}

function applyResult(league, fixture, result) {
  const home = league.records[fixture.homeId]; const away = league.records[fixture.awayId]; const { home: homeGoals, away: awayGoals } = result.score;
  home.played++; away.played++; home.goalsFor += homeGoals; home.goalsAgainst += awayGoals; away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
  if (homeGoals > awayGoals) { home.wins++; home.points += 3; away.losses++; }
  else if (homeGoals < awayGoals) { away.wins++; away.points += 3; home.losses++; }
  else { home.draws++; away.draws++; home.points++; away.points++; }
  for (const row of result.playerResults) {
    const p = row.player;
    p.season.appearances++; p.season.goals += row.goals; p.season.assists += row.assists; p.season.shots += row.shots; p.season.attackContributions += row.attackContributions; p.season.defensiveStops += row.defensiveStops; p.season.saves += row.saves; p.season.conceded += row.conceded; p.season.ratingTotal += row.rating; p.season.playedPhases = (p.season.playedPhases || 0) + (row.playedPhases || 0);
    p.career ||= { appearances: 0, goals: 0, assists: 0, shots: 0, attackContributions: 0, defensiveStops: 0, saves: 0, conceded: 0, ratingTotal: 0, playedPhases: 0 };
    p.career.appearances++; p.career.goals += row.goals; p.career.assists += row.assists; p.career.shots += row.shots; p.career.attackContributions += row.attackContributions; p.career.defensiveStops += row.defensiveStops; p.career.saves += row.saves; p.career.conceded += row.conceded; p.career.ratingTotal += row.rating; p.career.playedPhases = (p.career.playedPhases || 0) + (row.playedPhases || 0);
    const club = league.clubs.find(candidate => candidate.roster.some(member => member.id === p.id));
    if (club) {
      p.clubCareer ||= {};
      const stats = p.clubCareer[club.id] ||= { appearances: 0, goals: 0, assists: 0 };
      stats.appearances++; stats.goals += row.goals; stats.assists += row.assists;
      archiveCareer(league, p, club.id);
    } else archiveCareer(league, p);
  }
}

function clonePlayer(player) {
  return { ...player, stats: { ...player.stats }, hiddenGrowth: typeof player.hiddenGrowth === 'object' ? { ...player.hiddenGrowth } : player.hiddenGrowth, season: { ...player.season }, career: { ...player.career }, clubCareer: Object.fromEntries(Object.entries(player.clubCareer || {}).map(([id, stats]) => [id, { ...stats }])), clubSeasons: { ...(player.clubSeasons || {}) }, peakOverallByClub: { ...(player.peakOverallByClub || {}) } };
}

function snapshotMatch(round, match) {
  const summary = match.result.summary || summarizeMatchResult(match.result);
  return {
    round,
    fixture: { ...match.fixture, home: { ...match.fixture.home }, away: { ...match.fixture.away } },
    result: {
      score: { ...match.result.score },
      phases: match.result.phases,
      forms: { ...match.result.forms },
      summary: cloneSummary(summary),
      events: match.result.events.map(event => ({ ...event })),
      playerResults: match.result.playerResults.map(row => ({ ...row, player: clonePlayer(row.player) }))
    }
  };
}

export function playCurrentRound(league) {
  if (league.completed) throw new Error('Season is complete');
  const round = league.schedule[league.currentRound - 1];
  const results = round.fixtures.map((fixture, index) => {
    const home = league.clubs.find(c => c.id === fixture.homeId); const away = league.clubs.find(c => c.id === fixture.awayId);
    const result = simulateMatch(home, away, createRandom(`${league.seed}:round:${round.round}:match:${index}`));
    result.summary = summarizeMatchResult(result);
    applyResult(league, fixture, result);
    (league.fixtureResults ||= []).push({ homeId: fixture.homeId, awayId: fixture.awayId, homeGoals: result.score.home, awayGoals: result.score.away });
    return { fixture: { ...fixture, home: cloneSide(home), away: cloneSide(away) }, result };
  });
  const humanIds = new Set(clubsForController(league, 'HUMAN').map(club => club.id));
  const userMatch = results.find(x => humanIds.has(x.fixture.homeId) || humanIds.has(x.fixture.awayId));
  league.seasonResults ||= [];
  for (const match of results.filter(x => humanIds.has(x.fixture.homeId) || humanIds.has(x.fixture.awayId))) {
    const key = `${round.round}:${match.fixture.homeId}:${match.fixture.awayId}`;
    if (!league.seasonResults.some(saved => `${saved.round}:${saved.fixture.homeId}:${saved.fixture.awayId}` === key)) league.seasonResults.push(snapshotMatch(round.round, match));
  }
  league.currentRound++;
  league.completed = league.currentRound > league.schedule.length;
  return { round: round.round, results, userMatch };
}

export function simulateRemainingSeason(league) {
  const rounds = [];
  let matchesProcessed = 0;
  while (!league.completed) {
    const round = playCurrentRound(league);
    rounds.push(round);
    matchesProcessed += round.results.length;
  }
  return { rounds, matchesProcessed, humanMatches: [...(league.seasonResults || [])] };
}

export function awards(league) { const players=league.clubs.flatMap(c=>c.roster.map(p=>({p,c,r:p.season.appearances?p.season.ratingTotal/p.season.appearances:0}))).filter(x=>x.p.season.appearances>=5); const byPos=pos=>players.filter(x=>x.p.primaryPosition===pos).sort((a,b)=>b.r-a.r)[0]; const alas=players.filter(x=>x.p.primaryPosition==='MF').sort((a,b)=>b.r-a.r).slice(0,2); const best5=[byPos('GK'),byPos('DF'),...alas,byPos('FW')].filter(Boolean); const mvp=[...players].sort((a,b)=>b.r-a.r)[0]||null; return {best5,mvp}; }

function maxWinStreak(league, clubId) {
  let current = 0, best = 0;
  for (const match of league.fixtureResults || []) {
    if (match.homeId !== clubId && match.awayId !== clubId) continue;
    const won = match.homeId === clubId ? match.homeGoals > match.awayGoals : match.awayGoals > match.homeGoals;
    current = won ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

function recordSeasonHistory(league) {
  if (league.history.some(entry => entry.season === league.season)) return;
  const table = standings(league), trophy = awards(league);
  const allPlayers = league.clubs.flatMap(club => club.roster.map(player => ({ player, club })));
  const maxGoals = Math.max(0, ...allPlayers.map(row => row.player.season.goals || 0));
  const topScorers = maxGoals > 0 ? allPlayers.filter(row => (row.player.season.goals || 0) === maxGoals).map(row => ({ name: row.player.name, clubId: row.club.id, goals: maxGoals })) : [];
  if (trophy.mvp?.p) {
    trophy.mvp.p.honors ||= { mvp: 0, best5: 0 };
    trophy.mvp.p.honors.mvp = (trophy.mvp.p.honors.mvp || 0) + 1;
  }
  for (const row of trophy.best5) {
    row.p.honors ||= { mvp: 0, best5: 0 };
    row.p.honors.best5 = (row.p.honors.best5 || 0) + 1;
  }
  for (const club of league.clubs) {
    for (const player of club.roster) {
      player.clubSeasons ||= {};
      player.clubSeasons[club.id] = (player.clubSeasons[club.id] || 0) + 1;
      archiveCareer(league, player, club.id);
    }
  }
  league.history.push({
    season: league.season,
    table: table.map(x => ({ club: x.club.name, clubId: x.club.id, color: x.club.color, rank: x.rank, points: x.points, wins: x.wins, goals: x.goalsFor, against: x.goalsAgainst, maxWinStreak: maxWinStreak(league, x.club.id) })),
    champion: table[0].club.name,
    championClubId: table[0].club.id,
    championColor: table[0].club.color,
    mvp: trophy.mvp?.p.name || null,
    mvpClubId: trophy.mvp?.c.id || null,
    best5: trophy.best5.map(x => ({ name: x.p.name, position: x.p.primaryPosition, clubId: x.c.id, color: x.c.color })),
    topScorers
  });
}

export function recordDraftAcquisition(league, clubId, player) {
  league.draftRecords ||= [];
  if (league.draftRecords.some(row => row.playerId === player.id)) return;
  const initialOverall = calculateOverall(player);
  league.draftRecords.push({ playerId: player.id, name: player.name, clubId, season: league.season, age: player.age, initialOverall, initialRank: rankOf(initialOverall) });
}

export function clubAchievements(league, clubId) {
  const history = league.history || [];
  const clubRows = history.map(entry => ({ entry, row: entry.table?.find(row => row.clubId === clubId) })).filter(item => item.row);
  const records = league.careerRecords || [];
  const clubStat = (record, key) => record.clubCareer?.[clubId]?.[key] || 0;
  const leader = key => [...records].filter(record => clubStat(record, key) > 0).sort((a, b) => clubStat(b, key) - clubStat(a, key) || a.name.localeCompare(b.name, 'ja'))[0] || null;
  const tenure = [...records].filter(record => (record.clubSeasons?.[clubId] || 0) > 0).sort((a, b) => (b.clubSeasons?.[clubId] || 0) - (a.clubSeasons?.[clubId] || 0) || clubStat(b, 'appearances') - clubStat(a, 'appearances'))[0] || null;
  const peak = [...records].filter(record => record.peakOverallByClub?.[clubId] != null).sort((a, b) => b.peakOverallByClub[clubId] - a.peakOverallByClub[clubId])[0] || null;
  const draftCandidates = (league.draftRecords || []).filter(row => row.clubId === clubId).map(row => {
    const record = records.find(candidate => candidate.id === row.playerId);
    const current = league.clubs.flatMap(club => club.roster).find(player => player.id === row.playerId);
    const peakOverall = Math.max(row.initialOverall, record?.peakOverallByClub?.[clubId] || 0, current?.peakOverallByClub?.[clubId] || 0, current ? calculateOverall(current) : 0);
    return { ...row, peakOverall, peakRank: rankOf(peakOverall), gain: peakOverall - row.initialOverall, appearances: record?.clubCareer?.[clubId]?.appearances || 0 };
  }).sort((a, b) => b.gain - a.gain || b.peakOverall - a.peakOverall || b.appearances - a.appearances);
  const best5Names = new Set(history.flatMap(entry => (entry.best5 || []).filter(row => row.clubId === clubId).map(row => row.name)));
  return {
    championships: clubRows.filter(item => item.row.rank === 1).length,
    bestRank: clubRows.length ? Math.min(...clubRows.map(item => item.row.rank)) : null,
    totalWins: clubRows.reduce((sum, item) => sum + (item.row.wins || 0), 0),
    totalGoals: clubRows.reduce((sum, item) => sum + (item.row.goals || 0), 0),
    maxWinStreak: clubRows.reduce((best, item) => Math.max(best, item.row.maxWinStreak || 0), 0),
    mvpCount: history.filter(entry => entry.mvpClubId === clubId).length,
    best5Players: best5Names.size,
    topScorerCount: history.reduce((sum, entry) => sum + (entry.topScorers || []).filter(row => row.clubId === clubId).length, 0),
    mostAppearances: leader('appearances'),
    mostGoals: leader('goals'),
    mostAssists: leader('assists'),
    longestTenure: tenure,
    highestPeak: peak,
    draftMasterpiece: draftCandidates[0] || null,
    rankTrend: clubRows.map(item => ({ season: item.entry.season, rank: item.row.rank }))
  };
}

export function finalizeSeason(league) { recordSeasonHistory(league); return { history: league.history, awards: awards(league) }; }

export function applySeasonFinances(league) {
  if (league.financesAppliedSeason === league.season) return [];
  recordSeasonHistory(league);
  const ranks = new Map(standings(league).map(row => [row.club.id, row.rank]));
  const summary = league.clubs.map(club => {
    const rank = ranks.get(club.id);
    const prize = rank === 1 ? 10 : rank === 2 ? 5 : 0;
    const before = club.funds;
    club.funds = Math.min(150, club.funds + 100 + prize);
    return { clubId: club.id, rank, before, base: 100, prize, after: club.funds };
  });
  league.financesAppliedSeason = league.season;
  return summary;
}

export function startNextSeason(league) {
  recordSeasonHistory(league);
  if(league.season>=10) return false;
  league.previousStandings = standings(league).map(row => ({ clubId: row.club.id, rank: row.rank }));
  league.season++;
  league.schedule=createSchedule(league.clubs.map(c=>c.id));
  league.currentRound=1;
  league.records=Object.fromEntries(league.clubs.map(c=>[c.id,blankRecord()]));
  league.seasonResults=[];
  league.fixtureResults=[];
  league.completed=false;
  league.clubs.flatMap(c=>c.roster).forEach(p=>{p.season={appearances:0,goals:0,assists:0,shots:0,attackContributions:0,defensiveStops:0,saves:0,conceded:0,ratingTotal:0,playedPhases:0};});
  return true;
}
