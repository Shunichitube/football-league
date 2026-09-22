import { createPlayer, displayPlayer, FIELD_STAT_KEYS, STAT_LABELS } from './data.js';
import { createRandom, weightedPick } from './random.js';

const DRAFT_DISTRIBUTION = [['G', 35], ['F', 35], ['E', 20], ['D', 8], ['C', 2]];
const AUCTION_DISTRIBUTION = [['F', 15], ['E', 25], ['D', 25], ['C', 20], ['B', 10], ['A', 4], ['S', 1]];
const RANGE = { G: [50,55], F: [56,60], E: [61,65], D: [66,70], C: [71,75], B: [76,80], A: [81,85], S: [86,90] };
const POSITIONS = ['GK', 'FIXO', 'ALA', 'ALA', 'PIVO'];
const BASE_VALUE = { G: 3, F: 6, E: 9, D: 14, C: 19, B: 26, A: 35, S: 48, SS: 62 };

export const SPECIAL_ABILITIES = {
  GK: ['ショットストッパー', 'ビッグセーバー', 'ロングレンジキラー', '反応型', '安定感', '守護神'],
  FIXO: ['ボールハンター', 'カバーリング', 'パスカット', 'カウンター起点', 'ビルドアップ', '最終防衛線'],
  ALA: ['スピードスター', 'ドリブラー', 'チャンスメイカー', 'カットイン', 'ハードワーカー', '万能型'],
  PIVO: ['フィニッシャー', 'ミドルシューター', 'ポストプレーヤー', '個人技', '勝負強さ', 'エース']
};

export const SPECIAL_ABILITY_DESCRIPTIONS = {
  ショットストッパー: '通常のシュートへの対応に優れる。', ビッグセーバー: '決定機で高いセーブ力を発揮する。', ロングレンジキラー: '遠距離からのシュートに強い。', 反応型: '近距離で素早く反応する。', 安定感: '試合ごとの波が小さい。', 守護神: 'ゴール前で総合的に力を発揮する。',
  ボールハンター: '対人守備でボールを奪いやすい。', カバーリング: '味方の背後を補う守備に優れる。', パスカット: '相手の配球を読んで遮断する。', カウンター起点: '奪取後の速攻を始めやすい。', ビルドアップ: '後方から安定して攻撃を組み立てる。', 最終防衛線: '危険な局面で守備力を発揮する。',
  スピードスター: '走力を生かした攻撃を得意とする。', ドリブラー: 'ボールを運ぶ局面で力を発揮する。', チャンスメイカー: '味方の好機を作りやすい。', カットイン: '中央へ入り込む攻撃を得意とする。', ハードワーカー: '攻守に広く関与する。', 万能型: '複数の局面で安定して貢献する。',
  フィニッシャー: '決定機で得点力を発揮する。', ミドルシューター: '難しい距離からも得点を狙える。', ポストプレーヤー: '前線でボールを収めて攻撃をつなぐ。', 個人技: '単独で局面を動かしやすい。', 勝負強さ: '重要な好機で力を発揮する。', エース: '攻撃の中心として総合的に貢献する。'
};

const GROWTH_COMMENTS = {
  shoot: ['得点感覚にはまだ伸びしろがありそうだ', 'シュート技術は今後さらに伸びそうだ'],
  speed: ['身体能力はこれからさらに伸びそうだ', 'スピード面には成長の余地を感じる'],
  defense: ['守備面は経験とともに伸びていきそうだ', '対人守備には将来性を感じる'],
  dribble: ['ボールを持った時の伸びしろを感じる', 'ドリブル技術はまだ伸びそうだ'],
  pass: ['配球面にはまだ成長の余地がある', 'パスセンスは今後さらに磨かれそうだ'],
  gk: ['GKとしてまだ伸びる余地がありそうだ', '反応やセービングはさらに良くなりそうだ']
};

function tier(distribution, rng) { return weightedPick(distribution, ([, weight]) => weight, rng)[0]; }
function playerForTier(id, position, tierName, age, rng) {
  const p = createPlayer(id, position, rng, { initial: false }); const [min, max] = RANGE[tierName];
  for (const key of Object.keys(p.stats)) p.stats[key] = position === 'GK' && key !== 'gk' ? rng.int(50, 58) : rng.int(min, max);
  p.age = age; p.isInitial = false; p.contractYears = 3; p.specialAbility = rng.next() < .4 ? abilityFor(position, rng) : null; p.scoutComment = createScoutComment(p, rng); return p;
}
function abilityFor(position, rng) { return rng.pick(SPECIAL_ABILITIES[position]); }

export function createScoutComment(player, rng) {
  const keys = player.primaryPosition === 'GK' ? [...FIELD_STAT_KEYS, 'gk'] : FIELD_STAT_KEYS;
  const currentKey = [...keys].sort((a, b) => player.stats[b] - player.stats[a])[0];
  const growthKey = [...keys].sort((a, b) => player.hiddenGrowth[b] - player.hiddenGrowth[a])[0];
  const ageHint = player.age <= 20 ? '若く、今後を見ながら育てたい' : player.age <= 24 ? '伸び盛りの年代にいる' : player.age >= 29 ? '経験を生かせる年齢だ' : '完成度と成長余地の両方を見極めたい';
  const currentHint = `現在は${STAT_LABELS[currentKey]} ${displayPlayer(player).ranks[currentKey]}が目を引く`;
  const growthHint = rng.pick(GROWTH_COMMENTS[growthKey]);
  const abilityHint = player.specialAbility ? `「${player.specialAbility}」という明確な持ち味もある` : '際立った特能はまだ見えていない';
  const values = keys.map(key => player.hiddenGrowth[key]);
  const high = values.filter(value => value >= 1.15).length;
  const veryHigh = values.filter(value => value >= 1.22).length;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  let rare = '';
  if (veryHigh >= 3 && rng.next() < .08) rare = '天才肌かもしれない';
  else if (high >= 3 && rng.next() < .12) rare = '粗削りだが、大きく化ける可能性がある';
  else if (average >= 1.12 && rng.next() < .18) rare = '非常に高い成長性を感じる';
  return [currentHint, ageHint, growthHint, abilityHint, rare].filter(Boolean).join('。') + '。';
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
