import { createClub } from './data.js?v=0.17.2';
import { simulateMatch } from './sim.js?v=0.17.2';
import { createRandom } from './random.js';

const CPU_CLUBS = [
  ['RIVERA FIVE', '#60a5fa'], ['NORTH STARS', '#f59e0b'], ['KOBE ORBIT', '#f472b6'],
  ['GREEN RUSH', '#34d399'], ['OSAKA VIOLET', '#a78bfa']
];

const blankRecord = () => ({ played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
const cloneSide = club => ({ id: club.id, name: club.name, color: club.color });

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
  return { seed, season: 1, history: [], careerRecords: [], humanClubId: 1, clubs, schedule: createSchedule(clubs.map(c => c.id)), currentRound: 1, records: Object.fromEntries(clubs.map(c => [c.id, blankRecord()])), seasonResults: [], fixtureResults: [], releasedPlayers: [], completed: false };
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

function archiveCareer(league, player) {
  league.careerRecords ||= [];
  const record = { id: player.id, name: player.name, position: player.primaryPosition, career: { ...(player.career || {}) } };
  const index = league.careerRecords.findIndex(candidate => candidate.id === player.id);
  if (index >= 0) league.careerRecords[index] = record; else league.careerRecords.push(record);
}

function applyResult(league, fixture, result) {
  const home = league.records[fixture.homeId]; const away = league.records[fixture.awayId]; const { home: homeGoals, away: awayGoals } = result.score;
  home.played++; away.played++; home.goalsFor += homeGoals; home.goalsAgainst += awayGoals; away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
  if (homeGoals > awayGoals) { home.wins++; home.points += 3; away.losses++; }
  else if (homeGoals < awayGoals) { away.wins++; away.points += 3; home.losses++; }
  else { home.draws++; away.draws++; home.points++; away.points++; }
  for (const row of result.playerResults) { const p = row.player; p.season.appearances++; p.season.goals += row.goals; p.season.assists += row.assists; p.season.shots += row.shots; p.season.attackContributions += row.attackContributions; p.season.defensiveStops += row.defensiveStops; p.season.saves += row.saves; p.season.conceded += row.conceded; p.season.ratingTotal += row.rating; p.season.playedPhases = (p.season.playedPhases || 0) + (row.playedPhases || 0); p.career ||= { appearances: 0, goals: 0, assists: 0, shots: 0, attackContributions: 0, defensiveStops: 0, saves: 0, conceded: 0, ratingTotal: 0, playedPhases: 0 }; p.career.appearances++; p.career.goals += row.goals; p.career.assists += row.assists; p.career.shots += row.shots; p.career.attackContributions += row.attackContributions; p.career.defensiveStops += row.defensiveStops; p.career.saves += row.saves; p.career.conceded += row.conceded; p.career.ratingTotal += row.rating; p.career.playedPhases = (p.career.playedPhases || 0) + (row.playedPhases || 0); archiveCareer(league, p); }
}

function clonePlayer(player) {
  return { ...player, stats: { ...player.stats }, hiddenGrowth: typeof player.hiddenGrowth === 'object' ? { ...player.hiddenGrowth } : player.hiddenGrowth, season: { ...player.season }, career: { ...player.career } };
}

function snapshotMatch(round, match) {
  return {
    round,
    fixture: { ...match.fixture, home: { ...match.fixture.home }, away: { ...match.fixture.away } },
    result: {
      score: { ...match.result.score },
      phases: match.result.phases,
      forms: { ...match.result.forms },
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

function recordSeasonHistory(league) {
  if (league.history.some(entry => entry.season === league.season)) return;
  const table=standings(league), trophy=awards(league);
  for (const player of league.clubs.flatMap(club => club.roster)) archiveCareer(league, player);
  league.history.push({season:league.season, table:table.map(x=>({club:x.club.name,clubId:x.club.id,color:x.club.color,rank:x.rank,points:x.points,goals:x.goalsFor,against:x.goalsAgainst})), champion:table[0].club.name, championColor:table[0].club.color, mvp:trophy.mvp?.p.name||null, best5:trophy.best5.map(x=>({name:x.p.name,position:x.p.primaryPosition,clubId:x.c.id,color:x.c.color}))});
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
