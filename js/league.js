import { createClub } from './data.js';
import { simulateMatch } from './sim.js';
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
  const clubs = [createClub({ id: 1, name, color, seed: rng }), ...CPU_CLUBS.map(([cpuName, cpuColor], index) => createClub({ id: index + 2, name: cpuName, color: cpuColor, seed: rng }))];
  return { seed, season: 1, history: [], humanClubId: 1, clubs, schedule: createSchedule(clubs.map(c => c.id)), currentRound: 1, records: Object.fromEntries(clubs.map(c => [c.id, blankRecord()])), completed: false };
}

export function standings(league) {
  return league.clubs.map(club => ({ club, ...league.records[club.id], goalDifference: league.records[club.id].goalsFor - league.records[club.id].goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.club.id - b.club.id)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function applyResult(league, fixture, result) {
  const home = league.records[fixture.homeId]; const away = league.records[fixture.awayId]; const { home: homeGoals, away: awayGoals } = result.score;
  home.played++; away.played++; home.goalsFor += homeGoals; home.goalsAgainst += awayGoals; away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
  if (homeGoals > awayGoals) { home.wins++; home.points += 3; away.losses++; }
  else if (homeGoals < awayGoals) { away.wins++; away.points += 3; home.losses++; }
  else { home.draws++; away.draws++; home.points++; away.points++; }
  for (const row of result.playerResults) { const p = row.player; p.season.appearances++; p.season.goals += row.goals; p.season.assists += row.assists; p.season.shots += row.shots; p.season.attackContributions += row.attackContributions; p.season.defensiveStops += row.defensiveStops; p.season.saves += row.saves; p.season.conceded += row.conceded; p.season.ratingTotal += row.rating; }
}

export function playCurrentRound(league) {
  if (league.completed) throw new Error('Season is complete');
  const round = league.schedule[league.currentRound - 1];
  const results = round.fixtures.map((fixture, index) => {
    const home = league.clubs.find(c => c.id === fixture.homeId); const away = league.clubs.find(c => c.id === fixture.awayId);
    const result = simulateMatch(home, away, createRandom(`${league.seed}:round:${round.round}:match:${index}`));
    applyResult(league, fixture, result);
    return { fixture: { ...fixture, home: cloneSide(home), away: cloneSide(away) }, result };
  });
  const userMatch = results.find(x => x.fixture.homeId === league.humanClubId || x.fixture.awayId === league.humanClubId);
  league.currentRound++;
  league.completed = league.currentRound > league.schedule.length;
  return { round: round.round, results, userMatch };
}

export function awards(league) { const players=league.clubs.flatMap(c=>c.roster.map(p=>({p,c,r:p.season.appearances?p.season.ratingTotal/p.season.appearances:0}))).filter(x=>x.p.season.appearances>=5); const byPos=pos=>players.filter(x=>x.p.primaryPosition===pos).sort((a,b)=>b.r-a.r)[0]; const best5=['GK','FIXO','ALA','ALA','PIVO'].map(byPos).filter(Boolean); const mvp=[...players].sort((a,b)=>b.r-a.r)[0]||null; return {best5,mvp}; }
export function startNextSeason(league) { const table=standings(league), trophy=awards(league); league.history.push({season:league.season, table:table.map(x=>({club:x.club.name,rank:x.rank,points:x.points,goals:x.goalsFor,against:x.goalsAgainst})), champion:table[0].club.name, mvp:trophy.mvp?.p.name||null, best5:trophy.best5.map(x=>x.p.name)}); if(league.season>=10) return false; league.season++; league.schedule=createSchedule(league.clubs.map(c=>c.id)); league.currentRound=1; league.records=Object.fromEntries(league.clubs.map(c=>[c.id,blankRecord()])); league.completed=false; league.clubs.flatMap(c=>c.roster).forEach(p=>{p.season={appearances:0,goals:0,assists:0,shots:0,attackContributions:0,defensiveStops:0,saves:0,conceded:0,ratingTotal:0};}); return true; }
