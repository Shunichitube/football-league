import { rankOf } from './config.js';

const FIRST_NAMES = ['蒼', '蓮', '海斗', '湊', '陽向', '颯太', '大和', '悠真', '樹', '陸'];
const LAST_NAMES = ['伊藤', '山田', '佐藤', '高橋', '田中', '渡辺', '小林', '加藤', '吉田', '斎藤'];
const POSITIONS = ['GK', 'FIXO', 'ALA', 'ALA', 'PIVO'];

export function createPlayer(id, position, rng, options = {}) {
  const first = FIRST_NAMES[id % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(id / 10) % LAST_NAMES.length];
  const ability = () => options.initial ? rng.int(50, 55) : rng.int(50, 70);
  const stats = { shoot: ability(), speed: ability(), defense: ability(), dribble: ability(), pass: ability(), gk: position === 'GK' ? ability() : 50 };
  if (position === 'GK') stats.gk = options.initial ? rng.int(50, 55) : rng.int(55, 70);
  return { id: `p-${id}`, name: `${last} ${first}`, age: 25, nationality: '日本', primaryPosition: position, stats, isInitial: Boolean(options.initial), specialAbility: null, contractYears: 3, hiddenGrowth: options.initial ? rng.int(55, 75) / 100 : rng.int(70, 130) / 100, season: blankSeason(), career: blankSeason() };
}

function blankSeason() { return { appearances: 0, goals: 0, assists: 0, shots: 0, attackContributions: 0, defensiveStops: 0, saves: 0, conceded: 0, ratingTotal: 0 }; }

export function createClub({ id, name, color, seed, initial = true }) {
  const rng = seed;
  const players = POSITIONS.map((position, i) => createPlayer(id * 10 + i, position, rng, { initial }));
  return { id, name, color, funds: 100, roster: players, lineup: players.map(p => p.id), tactic: 'BALANCED' };
}

export function displayPlayer(player) {
  const s = player.stats;
  const overall = player.primaryPosition === 'GK' ? s.gk : Math.round((s.shoot + s.speed + s.defense + s.dribble + s.pass) / 5);
  return { ...player, overallRank: rankOf(overall), ranks: { shoot: rankOf(s.shoot), speed: rankOf(s.speed), defense: rankOf(s.defense), dribble: rankOf(s.dribble), pass: rankOf(s.pass), gk: rankOf(s.gk) } };
}

export function playerById(club, id) { return club.roster.find(p => p.id === id); }
