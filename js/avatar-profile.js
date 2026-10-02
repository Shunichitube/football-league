import { rareKind } from './rare-characters.js';
// Appearance is deterministic and never consumes the match/league RNG.
export const HAIR_STYLES = ['ショート', 'サイドパート', 'スパイキー', 'クルーカット', '坊主', 'モヒカン', 'センター分け', 'カーリー', 'フレンチクロップ', 'クイッフ', 'オールバック', 'ポンパドール', 'ボブ', 'ウェーブ', 'アフロ', 'ベリーショート', 'ポニーテール', 'お団子', 'アンダーカット', 'ロング'];
export const FACE_STYLES = ['ノーマル', 'きりっと', 'やさしい'];
export const HAIR_COLORS = [{label:'茶',color:'#955326'},{label:'黒',color:'#26252b'},{label:'こげ茶',color:'#503425'},{label:'明るい茶',color:'#c1874c'},{label:'金',color:'#e4c268'},{label:'赤茶',color:'#a45232'},{label:'赤',color:'#bd3546'},{label:'青',color:'#3e65bb'},{label:'グレー',color:'#92949c'},{label:'白',color:'#e5e4df'}];
export const SKIN_TONES = [{ label: '明るめ', color: '#ffbe89' }, { label: '中間', color: '#c68b62' }, { label: '濃いめ', color: '#8a543b' }];
export const DEFAULT_KIT = '#1655e8';
export const KEEPER_KIT = '#777b80';
const variant = (value, count) => Number.isFinite(Number(value)) ? ((Math.trunc(Number(value)) % count) + count) % count : 0;
export const appearanceSeed = value => String(value).split('').reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
export function avatarProfile(value = 0) {
  const profile = value && typeof value === 'object' ? value : null;
  const seed = Number(profile?.seed ?? value) || 0;
  return { ...(rareKind(profile) ? {rareCharacter:profile.rareCharacter} : {}), version: 4, body: 0, hairStyle: variant(profile?.hairStyle ?? seed, 20), face: variant(profile?.face ?? Math.floor(seed / 20), 3), hairColor: variant(profile?.hairColor ?? Math.floor(seed / 900),10), skinTone: variant(profile?.skinTone ?? Math.floor(seed / 60), 3), glasses: profile?.glasses === true || profile?.glasses === 1 };
}
export function createPlayerAppearance(id, position) {
  const seed = appearanceSeed(`${id}:${position}`);
  return avatarProfile({ seed, glasses: Math.floor(seed / 180) % 20 === 0 });
}
export function playerAppearance(player) {
  if (rareKind(player)) return {version:4,rareCharacter:player.rareCharacter};
  if (player.avatar?.version >= 3) return avatarProfile({...player.avatar,hairColor:player.avatar.version>=4?player.avatar.hairColor:Math.floor(appearanceSeed(`${player.id}:${player.primaryPosition}`)/900)%10});
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
