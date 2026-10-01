// Appearance is deterministic and never consumes the match/league RNG.
export const HAIR_STYLES = ['ショート', 'サイドパート', 'スパイキー', 'クルーカット', '坊主', 'モヒカン', 'センター分け', 'カーリー', 'フレンチクロップ', 'クイッフ', 'オールバック', 'ポンパドール', 'ボブ', 'ウェーブ', 'アフロ', 'コーンロウ', 'ポニーテール', 'お団子', 'アンダーカット', 'ロング'];
export const FACE_STYLES = ['ノーマル', 'きりっと', 'やさしい'];
export const SKIN_TONES = [{ label: '明るめ', color: '#ffbe89' }, { label: '中間', color: '#c68b62' }, { label: '濃いめ', color: '#8a543b' }];
export const DEFAULT_KIT = '#1655e8';
export const KEEPER_KIT = '#777b80';
const variant = (value, count) => Number.isFinite(Number(value)) ? ((Math.trunc(Number(value)) % count) + count) % count : 0;
export const appearanceSeed = value => String(value).split('').reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
export function avatarProfile(value = 0) {
  const profile = value && typeof value === 'object' ? value : null;
  const seed = Number(profile?.seed ?? value) || 0;
  return { version: 3, body: 0, hairStyle: variant(profile?.hairStyle ?? seed, 20), face: variant(profile?.face ?? Math.floor(seed / 20), 3), hairColor: 0, skinTone: variant(profile?.skinTone ?? Math.floor(seed / 60), 3), glasses: profile?.glasses === true || profile?.glasses === 1 };
}
export function createPlayerAppearance(id, position) {
  const seed = appearanceSeed(`${id}:${position}`);
  return avatarProfile({ seed, glasses: Math.floor(seed / 180) % 5 === 0 });
}
export function playerAppearance(player) {
  if (player.avatar?.version >= 3) return avatarProfile(player.avatar);
  // Old saves get stable expanded appearances without editing their saved roster.
  const generated = createPlayerAppearance(String(player.id).replace(/^p-/, ''), player.primaryPosition);
  if (player.avatar?.face !== undefined) generated.face = variant(player.avatar.face, 3);
  return generated;
}
export function kitColor(color, goalkeeper = false) {
  if (goalkeeper) return KEEPER_KIT;
  if (/^#[\da-f]{6}$/i.test(color || '')) return color.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(color || '')) return '#' + color.slice(1).split('').map(c => c + c).join('').toLowerCase();
  return DEFAULT_KIT;
}
