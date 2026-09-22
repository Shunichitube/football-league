import { createPlayer, displayPlayer } from './data.js';
import { createRandom, weightedPick } from './random.js';

const DRAFT_DISTRIBUTION = [['G', 35], ['F', 35], ['E', 20], ['D', 8], ['C', 2]];
const AUCTION_DISTRIBUTION = [['F', 15], ['E', 25], ['D', 25], ['C', 20], ['B', 10], ['A', 4], ['S', 1]];
const RANGE = { G: [50,55], F: [56,60], E: [61,65], D: [66,70], C: [71,75], B: [76,80], A: [81,85], S: [86,90] };
const POSITIONS = ['GK', 'FIXO', 'ALA', 'ALA', 'PIVO'];
const BASE_VALUE = { G: 3, F: 6, E: 9, D: 14, C: 19, B: 26, A: 35, S: 48, SS: 62 };

function tier(distribution, rng) { return weightedPick(distribution, ([, weight]) => weight, rng)[0]; }
function playerForTier(id, position, tierName, age, rng) {
  const p = createPlayer(id, position, rng, { initial: false }); const [min, max] = RANGE[tierName];
  for (const key of Object.keys(p.stats)) p.stats[key] = position === 'GK' && key !== 'gk' ? rng.int(50, 58) : rng.int(min, max);
  p.age = age; p.isInitial = false; p.contractYears = 3; p.specialAbility = rng.next() < .4 ? abilityFor(position, rng) : null; p.scoutComment = scoutComment(p, tierName, rng); return p;
}
function abilityFor(position, rng) { const list = position === 'GK' ? ['ショットストッパー','ビッグセーバー','安定感'] : position === 'FIXO' ? ['ボールハンター','パスカット','ビルドアップ'] : position === 'PIVO' ? ['フィニッシャー','ミドルシューター','エース'] : ['スピードスター','ドリブラー','チャンスメイカー']; return rng.pick(list); }
function scoutComment(player, tierName, rng) {
  const lead = player.primaryPosition === 'GK' ? 'ゴール前で落ち着きがある' : player.primaryPosition === 'FIXO' ? '守備で計算できる' : player.primaryPosition === 'PIVO' ? 'ゴール前で勝負できる' : rng.pick(['スピードが武器', 'ボールを持たせると面白い', 'パスセンスがある']);
  return tierName === 'C' || tierName === 'B' ? `${lead}。即戦力として期待できる。` : `${lead}。まだ粗いが、伸びしろを感じる。`;
}
export function createDraftPool(seed) { const rng = createRandom(`${seed}:draft-pool`); return Array.from({ length: 24 }, (_, i) => playerForTier(1000 + i, POSITIONS[i % POSITIONS.length], tier(DRAFT_DISTRIBUTION, rng), rng.int(18,22), rng)); }
export function createAuctionPool(seed) { const rng = createRandom(`${seed}:auction-pool`); return Array.from({ length: 18 }, (_, i) => playerForTier(2000 + i, POSITIONS[i % POSITIONS.length], tier(AUCTION_DISTRIBUTION, rng), rng.int(22,31), rng)); }
export function publicValue(player) { return BASE_VALUE[displayPlayer(player).overallRank]; }
export function cpuCandidatePick(club, candidates, rng) {
  const positions = new Set(club.roster.map(p => p.primaryPosition));
  return [...candidates].sort((a,b) => cpuDraftScore(club, b, positions, rng) - cpuDraftScore(club, a, positions, rng))[0];
}
function cpuDraftScore(club, player, positions, rng) { return publicValue(player) * 3 + (23 - player.age) * 1.5 + (!positions.has(player.primaryPosition) ? 8 : 0) + rng.next() * 3; }
export function cpuBid(club, player, rng) {
  if (club.roster.length >= 12 || club.funds < 6) return 0;
  const shortage = club.roster.filter(p => p.primaryPosition === player.primaryPosition).length < 1 ? rng.int(5,10) : 0;
  const age = player.age <= 23 ? 3 : player.age >= 30 ? -3 : 0;
  const value = Math.max(0, Math.round((publicValue(player) + shortage + age) * (.75 + rng.next() * .3)));
  return Math.min(value, Math.max(0, club.funds - 5));
}
export function addPlayer(club, player, cost) { if (club.roster.length >= 12) return false; club.roster.push(player); club.funds -= cost; return true; }
