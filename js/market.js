import { calculateOverall, createPlayer, displayPlayer, FIELD_STAT_KEYS, STAT_LABELS } from './data.js?v=0.16.3';
import { createRandom, weightedPick } from './random.js';
import { ACTION_TYPES } from './rules.js?v=0.16.3';

const DRAFT_DISTRIBUTION = [['G', 35], ['F', 35], ['E', 20], ['D', 8], ['C', 2]];
// 新規に生成する競売選手だけに適用する分布。放出選手は能力を保持したまま戻る。
const AUCTION_DISTRIBUTION = [['F', 15], ['E', 30], ['D', 30], ['C', 20], ['B', 4], ['A', 1]];
const RANGE = { G: [50,55], F: [56,60], E: [61,65], D: [66,70], C: [71,75], B: [76,80], A: [81,85], S: [86,90] };
const POSITIONS = ['GK', 'FIXO', 'ALA', 'ALA', 'PIVO'];
const BASE_VALUE = { G: 3, F: 6, E: 9, D: 14, C: 19, B: 26, A: 35, S: 48, SS: 62 };
const REQUIRED_POSITIONS = { GK: 1, FIXO: 1, ALA: 2, PIVO: 1 };
const POSITION_PROFILES = {
  GK: [
    { shoot: -14, speed: -5, defense: -6, dribble: -12, pass: -9, gk: 12 },
    { shoot: -12, speed: 2, defense: -2, dribble: -4, pass: 1, gk: 7 },
    { shoot: -10, speed: -1, defense: -4, dribble: -3, pass: 4, gk: 7 }
  ],
  FIXO: [
    { shoot: -12, speed: 1, defense: 12, dribble: -6, pass: 3 },
    { shoot: -10, speed: 0, defense: 5, dribble: -2, pass: 10 },
    { shoot: -9, speed: 9, defense: 7, dribble: -3, pass: 2 }
  ],
  ALA: [
    { shoot: 2, speed: 11, defense: -12, dribble: 4, pass: 0 },
    { shoot: 0, speed: 2, defense: -10, dribble: 6, pass: 9 },
    { shoot: 9, speed: 2, defense: -12, dribble: 7, pass: -1 }
  ],
  PIVO: [
    { shoot: 13, speed: -1, defense: -13, dribble: 4, pass: -2 },
    { shoot: 8, speed: -5, defense: -7, dribble: -2, pass: 6 },
    { shoot: 6, speed: 0, defense: -12, dribble: 11, pass: 3 }
  ]
};
const ADJUSTMENT_ORDER = {
  GK: ['gk', 'defense', 'speed', 'pass', 'dribble'],
  FIXO: ['defense', 'pass', 'speed', 'dribble', 'shoot'],
  ALA: ['speed', 'dribble', 'pass', 'shoot', 'defense'],
  PIVO: ['shoot', 'dribble', 'pass', 'speed', 'defense']
};

export const SPECIAL_ABILITIES = {
  GK: ['ショットストッパー', 'ビッグセーバー', 'ロングレンジキラー', '反応型', '安定感', '守護神'],
  FIXO: ['ボールハンター', 'カバーリング', 'パスカット', 'カウンター起点', 'ビルドアップ', '最終防衛線', '回復力'],
  ALA: ['スピードスター', 'ドリブラー', 'チャンスメイカー', 'カットイン', 'ハードワーカー', '万能型', '回復力'],
  PIVO: ['フィニッシャー', 'ミドルシューター', 'ポストプレーヤー', '個人技', '勝負強さ', 'エース', '回復力']
};

export const SPECIAL_ABILITY_DESCRIPTIONS = {
  ショットストッパー: '通常シュートに対してGK能力 +8%。', ビッグセーバー: '決定機・大決定機に対してGK能力 +10%。', ロングレンジキラー: '難しいシュートに対してGK能力 +12%。', 反応型: '相手のシュート判定が基礎GK判定を上回る時、GK能力 +6%。', 安定感: 'GK判定の乱数幅を -7〜+7 にする。', 守護神: '残り10分以内かつ同点または1点差で、GK能力 +8%。',
  ボールハンター: '守備判定時、自身の守備寄与 +10%。', カバーリング: '相手のドリブル攻撃に対して、自身の守備寄与 +8%。', パスカット: '相手のパス攻撃に対して、自身の守備寄与 +8%。', カウンター起点: '自身の守備成功後、次の自チームのカウンター攻撃 +8%。', ビルドアップ: 'パス攻撃時、自身のパス寄与 +10%。', 最終防衛線: '決定機・大決定機に対する最終守備判定 +5%。',
  スピードスター: 'カウンター攻撃時、自身の走力寄与 +10%。', ドリブラー: 'ドリブル攻撃時、自身のドリブル寄与 +10%。', チャンスメイカー: 'パス攻撃時、自身のパス寄与 +8%。', カットイン: 'ドリブル攻撃で自身がシューターなら、シュート判定 +8%。', ハードワーカー: '攻撃・守備で自身の走力寄与 +6%。', 万能型: 'バランス戦術時、自身のフィールド能力寄与 +4%。',
  フィニッシャー: '決定機・大決定機で自身がシューターなら、シュート判定 +10%。', ミドルシューター: '難しいシュートで自身がシューターなら、シュート判定 +10%。', ポストプレーヤー: 'パス攻撃値 +6%。', 個人技: 'ドリブル攻撃時、自身のドリブル寄与 +10%。', 勝負強さ: '残り10分以内の同点・1点ビハインドで自身がシューターなら、シュート判定 +8%。', エース: 'シューター選択時、自身の選択重み +20%。', 回復力: 'ベンチで完全回復するまでの休養を10フェイズから7フェイズへ短縮。'
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
const clampAbility = value => Math.max(50, Math.min(99, Math.round(value)));

function createVariedStats(player, tierName, rng) {
  const [min, max] = RANGE[tierName];
  const targetOverall = rng.int(min, max);
  const profile = rng.pick(POSITION_PROFILES[player.primaryPosition]);
  const keys = player.primaryPosition === 'GK' ? [...FIELD_STAT_KEYS, 'gk'] : FIELD_STAT_KEYS;
  for (const key of keys) player.stats[key] = clampAbility(targetOverall + profile[key] + rng.int(-4, 4));
  if (player.primaryPosition !== 'GK') player.stats.gk = 50;

  const initialDifference = targetOverall - calculateOverall(player);
  for (const key of keys) player.stats[key] = clampAbility(player.stats[key] + initialDifference);

  for (let attempts = 0; calculateOverall(player) !== targetOverall && attempts < 300; attempts++) {
    const direction = calculateOverall(player) < targetOverall ? 1 : -1;
    const key = ADJUSTMENT_ORDER[player.primaryPosition].find(name => direction > 0 ? player.stats[name] < 99 : player.stats[name] > 50);
    if (!key) break;
    player.stats[key] += direction;
  }
  player.marketTier = tierName;
}

function playerForTier(id, position, tierName, age, rng) {
  const p = createPlayer(id, position, rng, { initial: false });
  createVariedStats(p, tierName, rng);
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
export function createDraftPool(seed, season = 1) { const rng = createRandom(`${seed}:season:${season}:draft-pool`); return Array.from({ length: 24 }, (_, i) => playerForTier(season * 10000 + 1000 + i, POSITIONS[i % POSITIONS.length], tier(DRAFT_DISTRIBUTION, rng), rng.int(18,22), rng)); }
export function createAuctionPool(seed, season = 1, releasedPlayers = []) {
  const rng = createRandom(`${seed}:season:${season}:auction-pool`);
  const returning = [...releasedPlayers].sort(() => rng.next() - .5).slice(0, 18);
  const generated = Array.from({ length: 18 - returning.length }, (_, i) => playerForTier(season * 10000 + 2000 + i, POSITIONS[i % POSITIONS.length], tier(AUCTION_DISTRIBUTION, rng), rng.int(22,31), rng));
  return [...returning, ...generated];
}
export function publicValue(player) { return BASE_VALUE[displayPlayer(player).overallRank]; }
export function cpuCandidatePick(club, candidates, rng) {
  // 複数の空き枠を持って市場へ入ったCPUは、競売用に1枠を残す。
  if (club.reserveAuctionSlot && club.roster.length >= 11) return null;
  const futureCounts = Object.fromEntries(Object.keys(REQUIRED_POSITIONS).map(position => [position, club.roster.filter(player => player.primaryPosition === position && player.age < 34).length]));
  return [...candidates].sort((a,b) => cpuDraftScore(club, b, futureCounts, rng) - cpuDraftScore(club, a, futureCounts, rng))[0];
}
function cpuDraftScore(club, player, futureCounts, rng) { const need=futureCounts[player.primaryPosition] < REQUIRED_POSITIONS[player.primaryPosition]; return publicValue(player) * 3 + (23 - player.age) * 1.5 + (need ? 100 : 0) + rng.next() * 3; }
export function cpuBid(club, player, rng) {
  if (club.roster.length >= 12 || club.funds < 6) return 0;
  const futureCount = club.roster.filter(p => p.primaryPosition === player.primaryPosition && p.age < 34).length;
  const shortage = futureCount < REQUIRED_POSITIONS[player.primaryPosition] ? rng.int(15,25) : 0;
  const samePosition = club.roster.filter(p => p.primaryPosition === player.primaryPosition);
  const bestCurrent = samePosition.length ? Math.max(...samePosition.map(publicValue)) : null;
  // 表示総合ランクだけを比較し、明確な上位ランクなら補強候補にする。
  const upgrade = bestCurrent !== null && publicValue(player) > bestCurrent ? rng.int(8,16) : 0;
  const age = player.age <= 23 ? 3 : player.age >= 30 ? -3 : 0;
  const value = Math.max(0, Math.round((publicValue(player) + shortage + upgrade + age) * (.75 + rng.next() * .3)));
  return Math.min(value, Math.max(0, club.funds - 5));
}
export function addPlayer(club, player, cost) { if (club.roster.length >= 12) return false; club.roster.push(player); club.funds -= cost; return true; }

export function resolveDraftActions({ clubs, candidates, pendingClubIds, actions, rng }) {
  const eligible = pendingClubIds.filter(id => {
    const club = clubs.find(candidate => candidate.id === id);
    return club && club.funds >= 1 && club.roster.length < 12;
  });
  const actionByClub = new Map((actions || []).filter(action => action.type === ACTION_TYPES.DRAFT_PICK).map(action => [action.clubId, action]));
  const selections = eligible.map(clubId => {
    const club = clubs.find(candidate => candidate.id === clubId);
    const action = actionByClub.get(clubId);
    const player = candidates.find(candidate => candidate.id === action?.playerId);
    return player ? { club, player } : null;
  }).filter(Boolean);
  const selectedClubIds = new Set(selections.map(selection => selection.club.id));
  const groups = new Map();
  for (const selection of selections) {
    const group = groups.get(selection.player.id) || [];
    group.push(selection);
    groups.set(selection.player.id, group);
  }
  const acquired = [];
  const winnerIds = new Set();
  const acquiredPlayerIds = new Set();
  for (const group of groups.values()) {
    const winner = group[rng.int(0, group.length - 1)];
    if (addPlayer(winner.club, winner.player, 1)) {
      acquired.push({ clubId: winner.club.id, player: winner.player, contested: group.length > 1, contenderIds: group.map(row => row.club.id) });
      winnerIds.add(winner.club.id);
      acquiredPlayerIds.add(winner.player.id);
    }
  }
  const declinedIds = pendingClubIds.filter(id => !eligible.includes(id) || !selectedClubIds.has(id));
  return {
    candidates: candidates.filter(player => !acquiredPlayerIds.has(player.id)),
    pendingClubIds: pendingClubIds.filter(id => !winnerIds.has(id) && !declinedIds.includes(id)),
    acquired,
    declinedIds
  };
}

export function resolveAuctionActions({ clubs, player, actions, rng }) {
  const bids = (actions || []).filter(action => action.type === ACTION_TYPES.AUCTION_BID && action.playerId === player.id).map(action => {
    const club = clubs.find(candidate => candidate.id === action.clubId);
    const bid = Number(action.bid);
    const valid = club && club.roster.length < 12 && Number.isFinite(bid) && bid >= 0 && bid <= club.funds;
    return valid ? { club, bid } : null;
  }).filter(Boolean);
  const high = Math.max(0, ...bids.map(row => row.bid));
  if (high <= 0) return { winner: null, bid: 0 };
  const top = bids.filter(row => row.bid === high);
  const winner = top[rng.int(0, top.length - 1)];
  if (!addPlayer(winner.club, player, high)) return { winner: null, bid: 0 };
  return { winner: winner.club, bid: high };
}
