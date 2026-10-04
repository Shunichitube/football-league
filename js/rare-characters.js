import { CONFIG } from './config.js';

export const RARE_CHARACTERS = Object.freeze({
  golden_egg: { name:'金の卵', position:'MF', rank:'F', ability:'孵化', description:'23歳で孵化。何が生まれるかは秘密', scout:'光り輝く金色の卵。将来性は計り知れないが、今のところ卵である。' },
  chick: { name:'ひよこ', position:'MF', rank:'F', ability:null, description:'特殊能力なし。', scout:'大きな期待を背負って生まれた、小さなひよこ。本人は元気いっぱいなので、責めないであげてほしい。' },
  emperor_penguin: { name:'皇帝ペンギン', position:'DF', rank:'B', stamina:'A', ability:'皇帝', description:'出場中、味方全員の守備力を上げる', scout:'皇帝の風格で味方の守備を引き締める。本人は何も指示していないが、周りが勝手に姿勢を正す。' },
  phoenix: { name:'フェニックス', position:'MF', rank:'A', stamina:'SS', ability:'不死鳥', description:'対戦相手を大きく消耗させる', scout:'尽きることのない体力を持つ伝説の鳥。相手だけが疲れていくので、対戦後はだいたい嫌われる。' },
  dragon: { name:'ドラゴン', position:'FW', rank:'S', stamina:'G', ability:'ドラゴンシュート', description:'シュート後試合終了まで相手GK能力を下げる', scout:'圧倒的な力を秘めた龍。そのシュートはキーパーの自信まで吹き飛ばす。ただし、長く働くつもりはない。' },
  king_kong: { name:'キングコング', position:'FW', rank:'D', shoot:'SS', age:120, ability:'獣の王', description:'強力シュート。時々オウンゴールする', scout:'豪快なシュートでゴールを粉砕する獣の王。どちらのゴールを狙っているかは、本人にも分からない。' },
  sage: { name:'仙人', position:'DF', rank:'C', ageLabel:'????歳', ability:'千里眼', description:'攻撃を高確率で阻止。時々オウンゴールする', scout:'何千年と生きてきて、未来を見通す力がある。と言われているが、そろそろボケてきた。' },
  robot: { name:'ロボット', position:'MF', rank:'C', ageLabel:'不詳', ability:'精密パス', description:'3種のプレーから1種だけ必ず成功。他2種は失敗。', scout:'超精密な機械。精密すぎてメモリー不足だった。' },
  black_hole: { name:'ブラックホール', position:'GK', rank:'G', gk:'A', ageLabel:'不詳', ability:'ブラックホール', description:'ボールをどちらかのゴールに転送', scout:'止められないボールも吸い込む、宇宙の神秘。止めたボールまで自分のゴールに吐き出すのは、仕様らしい。' }
});
export const rareKind = player => RARE_CHARACTERS[player?.rareCharacter] ? player.rareCharacter : null;
export function rankMaximum(rank) {
  const index = CONFIG.ranks.findIndex(([, label]) => label === rank);
  if (index < 0) throw new Error('Unknown rank');
  return index === 0 ? 99 : CONFIG.ranks[index - 1][0] - 1;
}
export function applyRareCharacter(player, kind, rng) {
  const def = RARE_CHARACTERS[kind];
  if (!def) throw new Error('Unknown rare character');
  player.rareCharacter = kind; player.name = def.name; player.primaryPosition = def.position;
  player.stats = Object.fromEntries(['shoot','speed','defense','dribble','pass','gk','stamina'].map(key => [key, rankMaximum(def[key] || def.rank)]));
  player.hiddenGrowth = Object.fromEntries(Object.keys(player.stats).map(key => [key, 0]));
  player.specialAbility = kind === 'robot' ? ['精密パス','精密ドリブル','精密シュート'][Math.floor(rng.next() * 3)] : def.ability;
  if (def.age !== undefined) player.age = def.age;
  player.scoutComment = def.scout; player.isInitial = false;
  return player;
}
export function rollRareCharacter(source, rng) {
  const roll = rng.next();
  if (source === 'draft') return roll < .005 ? 'golden_egg' : null;
  if (source === 'auction') return ['king_kong','sage','robot','black_hole'][Math.floor(roll / .003)] || null;
  return null;
}
export function hatchEgg(player, rng) {
  if (rareKind(player) !== 'golden_egg' || player.age < 23) return null;
  const roll = rng.next(), kind = roll < .4 ? 'chick' : roll < .8 ? 'emperor_penguin' : roll < .95 ? 'phoenix' : 'dragon';
  const name = player.name;
  applyRareCharacter(player, kind, rng);
  if (name !== RARE_CHARACTERS.golden_egg.name) player.name = name;
  return kind;
}
export function robotActionResult(player, action) {
  if (rareKind(player) !== 'robot') return null;
  return player.specialAbility === {pass:'精密パス',dribble:'精密ドリブル',shoot:'精密シュート'}[action];
}
export function rareShotResult(player, rng) {
  if (rareKind(player) === 'king_kong') return rng.next() < .8 ? 'goal' : 'own_goal';
  const robot = robotActionResult(player, 'shoot');
  return robot === null ? null : robot ? 'goal' : 'miss';
}
export function blackHoleResult(keeper, result, rng) {
  if (rareKind(keeper) !== 'black_hole') return result;
  if (result === 'goal' && rng.next() < .2) return 'transfer';
  if (result === 'save' && rng.next() < .05) return 'goal';
  return result;
}
export function emperorBonus(players) { return players.filter(p => rareKind(p) === 'emperor_penguin').length * 5; }
export function effectiveRareStats(player, bonus = 0, gkDebuff = 0) {
  if (!bonus && !gkDebuff) return player;
  return {...player, stats:{...player.stats,
    defense:Math.min(99, player.stats.defense + bonus),
    gk:Math.max(50, Math.min(99, player.stats.gk + bonus) - gkDebuff)
  }};
}
export function rareDuelResult(actor, defender, action, rng) {
  if (rareKind(defender) === 'sage') return rng.next() < .8 ? 'stop' : 'own_goal';
  const robot = robotActionResult(actor, action);
  return robot === null ? null : robot ? 'success' : 'stop';
}
export function rareAgeLabel(player) { return RARE_CHARACTERS[rareKind(player)]?.ageLabel || `${player.age}歳`; }
export function rarePortraitUrl(player) {
  const kind = rareKind(player);
  return kind ? new URL(`../assets/avatars/rare/${kind}-portrait.webp`, import.meta.url).href : null;
}
