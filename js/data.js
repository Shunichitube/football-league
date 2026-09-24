import { rankOf } from './config.js';

export const FIELD_STAT_KEYS = ['shoot', 'speed', 'defense', 'dribble', 'pass'];
export const FIELD_PLAYER_STAT_KEYS = [...FIELD_STAT_KEYS, 'stamina'];
export const STAT_LABELS = { shoot: 'シュート', speed: '走力', defense: '守備', dribble: 'ドリブル', pass: 'パス', stamina: 'スタミナ', gk: 'GK' };
export const POSITION_LABELS = { GK: 'GK', DF: 'DF', MF: 'MF', FW: 'FW' };
const LEGACY_POSITIONS = { FIXO: 'DF', ALA: 'MF', PIVO: 'FW' };
const STAMINA_DISTRIBUTION = [['G', 12], ['F', 18], ['E', 22], ['D', 20], ['C', 14], ['B', 8], ['A', 4], ['S', 1], ['SS', 1]];
const RANK_RANGE = { G: [50,55], F: [56,60], E: [61,65], D: [66,70], C: [71,75], B: [76,80], A: [81,85], S: [86,90], SS: [91,99] };

// The seeded RNG draws first and last names independently. These broad pools
// keep duplicate full names uncommon without deriving names from player IDs.
export const LAST_NAMES = `佐藤 鈴木 高橋 田中 伊藤 渡辺 山本 中村 小林 加藤 吉田 山田 佐々木 山口 松本 井上 木村 林 斎藤 清水 山崎 森 池田 橋本 阿部 石川 山下 中島 石井 小川 前田 岡田 長谷川 藤田 後藤 近藤 村上 遠藤 青木 坂本 斉藤 福田 太田 西村 藤井 金子 岡本 藤原 三浦 中野 中川 原田 松田 竹内 小野 田村 中山 和田 石田 上田 森田 原 内田 柴田 酒井 宮崎 横山 高木 安藤 宮本 大野 小島 谷口 今井 工藤 高田 増田 丸山 杉山 村田 大塚 新井 小山 平野 藤本 河野 上野 野口 武田 松井 千葉 岩崎 菅原 木下 久保 佐野 野村 松尾 市川 杉本 古川 島田 水野 桜井 高野 吉川 渡部 山内 西田 菊地 飯田 西川 小松 北村 安田 五十嵐 川口 平田 関口 服部 辻 東 中田 樋口 秋山 永井 田口 山中 森本 川崎 土屋 吉村 堀 望月 松岡 荒木 大西 星野 須藤 大橋 岩田 野田 本間 矢野 川上 松浦 黒田 浅野 浜田 栗原 石原 尾崎`.split(' ');
export const FIRST_NAMES = `蒼 蓮 湊 樹 陸 翔 悠真 大和 陽斗 朝陽 颯太 海斗 結翔 悠人 奏太 陽向 晴翔 伊織 蒼空 颯 真翔 陽翔 仁 律 凪 暖 新 碧 岳 旭 玲 翼 亮 大輝 拓海 遼太 健太 直樹 和真 雄大 達也 翔太 俊介 優斗 航平 祐樹 智也 慎太郎 健人 誠 拓也 隼人 圭太 直人 雅人 康介 大樹 一真 颯介 春樹 颯真 悠生 蒼太 晴 琉生 朔 悠斗 結人 湊斗 瑛太 晴人 奏 翔馬 悠翔 大翔 凌 大地 拓真 光 希望 修平 浩太 竜也 駿 哲也 佳祐 信也 将太 裕太 友樹 洋平 剛 忍 学 宏樹 正人 貴大 雄太 智樹 淳 章太 康平 遼 佑真 奏汰 瑛斗 颯汰 瑠偉 結斗 蒼生 壮真 陽大 煌 桐矢`.split(' ');

const POSITIONS = ['GK', 'DF', 'MF', 'MF', 'FW'];
const OVERALL_WEIGHTS = {
  DF: { defense: .35, pass: .25, speed: .20, dribble: .10, shoot: .10 },
  MF: { speed: .25, dribble: .25, pass: .20, shoot: .20, defense: .10 },
  FW: { shoot: .35, dribble: .25, pass: .15, speed: .15, defense: .10 },
  GK: { gk: .70, defense: .10, speed: .10, pass: .05, dribble: .05 }
};

function growthProfile(position, rng, initial) {
  const min = initial ? 55 : 70;
  const max = initial ? 75 : 130;
  const keys = position === 'GK' ? [...FIELD_STAT_KEYS, 'gk'] : FIELD_PLAYER_STAT_KEYS;
  return Object.fromEntries(keys.map(key => [key, rng.int(min, max) / 100]));
}

function weightedTier(distribution, rng) {
  const total = distribution.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [rank, weight] of distribution) {
    roll -= weight;
    if (roll <= 0) return rank;
  }
  return distribution.at(-1)[0];
}

function staminaValue(rng) {
  const [min, max] = RANK_RANGE[weightedTier(STAMINA_DISTRIBUTION, rng)];
  return rng.int(min, max);
}

export function createPlayer(id, position, rng, options = {}) {
  const first = rng.pick(FIRST_NAMES);
  const last = rng.pick(LAST_NAMES);
  const ability = () => options.initial ? rng.int(50, 55) : rng.int(50, 70);
  const stats = { shoot: ability(), speed: ability(), defense: ability(), dribble: ability(), pass: ability(), gk: position === 'GK' ? ability() : 50 };
  if (position === 'GK') stats.gk = options.initial ? rng.int(50, 55) : rng.int(55, 70);
  if (position !== 'GK') stats.stamina = staminaValue(rng);
  return { id: `p-${id}`, name: `${last} ${first}`, age: 25, nationality: '日本', primaryPosition: position, stats, isInitial: Boolean(options.initial), specialAbility: null, contractYears: 3, hiddenGrowth: growthProfile(position, rng, Boolean(options.initial)), season: blankSeason(), career: blankSeason() };
}

export function blankSeason() { return { appearances: 0, goals: 0, assists: 0, shots: 0, attackContributions: 0, defensiveStops: 0, saves: 0, conceded: 0, ratingTotal: 0, playedPhases: 0 }; }

export function createClub({ id, name, color, seed, initial = true, controllerType = 'CPU' }) {
  const players = POSITIONS.map((position, i) => createPlayer(id * 10 + i, position, seed, { initial }));
  return { id, name, color, controllerType, funds: 100, roster: players, lineup: players.map(p => p.id), tactic: 'BALANCED' };
}

export function calculateOverall(player) {
  const weights = OVERALL_WEIGHTS[player.primaryPosition] || OVERALL_WEIGHTS.MF;
  return Math.round(Object.entries(weights).reduce((total, [key, weight]) => total + player.stats[key] * weight, 0));
}

export function displayPlayer(player) {
  const s = player.stats;
  return { ...player, overallRank: rankOf(calculateOverall(player)), ranks: { shoot: rankOf(s.shoot), speed: rankOf(s.speed), defense: rankOf(s.defense), dribble: rankOf(s.dribble), pass: rankOf(s.pass), stamina: s.stamina ? rankOf(s.stamina) : null, gk: rankOf(s.gk) } };
}

export function playerById(club, id) { return club.roster.find(p => p.id === id); }

export function ensurePlayerCompatibility(player, rng) {
  if (!player?.stats) return player;
  player.primaryPosition = LEGACY_POSITIONS[player.primaryPosition] || player.primaryPosition;
  if (player.primaryPosition !== 'GK' && typeof player.stats.stamina !== 'number') player.stats.stamina = staminaValue(rng);
  if (player.primaryPosition === 'GK' && 'stamina' in player.stats) delete player.stats.stamina;
  if (!player.hiddenGrowth || typeof player.hiddenGrowth === 'number') {
    const base = typeof player.hiddenGrowth === 'number' ? player.hiddenGrowth : 1;
    player.hiddenGrowth = Object.fromEntries((player.primaryPosition === 'GK' ? [...FIELD_STAT_KEYS, 'gk'] : FIELD_PLAYER_STAT_KEYS).map(key => [key, base]));
  } else if (player.primaryPosition !== 'GK' && typeof player.hiddenGrowth.stamina !== 'number') {
    player.hiddenGrowth.stamina = rng.int(70, 130) / 100;
  }
  if (player.primaryPosition === 'GK' && player.hiddenGrowth && typeof player.hiddenGrowth === 'object') delete player.hiddenGrowth.stamina;
  for (const bucket of ['season', 'career']) if (player[bucket] && typeof player[bucket].playedPhases !== 'number') player[bucket].playedPhases = 0;
  return player;
}
