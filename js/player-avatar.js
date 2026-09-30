// One shared body; hair and face are composited without regenerating the player.
export const HAIR_STYLES = ['ショート', 'サイドパート', 'スパイキー'];
export const FACE_STYLES = ['ノーマル', 'きりっと', 'やさしい'];
export const AVATAR_SIZE = { width: 300, height: 470 };
const variant = value => Number.isFinite(Number(value)) ? ((Math.trunc(Number(value)) % 3) + 3) % 3 : 0;
export function avatarProfile(value = 0) {
  const profile = value && typeof value === 'object' ? value : null;
  const seed = Number(profile?.seed ?? value) || 0;
  return { version: 2, body: 0, hairStyle: variant(profile?.hairStyle ?? seed), face: variant(profile?.face ?? Math.floor(seed / 3)), hairColor: 0, skinTone: 0 };
}

// Source regions are measured independently: generated parts need not be on a grid.
// Destination coordinates register every part to the same head and feet.
const HEAD = [104, 121, 256, 220];
const BODY = [104, 341, 256, 210];
const HEAD_WIDTH_SCALE = .88;
const headX = x => 150 + (x - 150) * HEAD_WIDTH_SCALE;
const HAIR = [[541,121,260,192], [973,119,272,201], [1414,94,280,213]];
const EYES = [[174,703,26,46], [264,703,25,46]];
const BROWS = [null, [[595,670,46,27], [702,670,46,26]], [[1023,662,49,23], [1151,662,50,23]]];
export function drawAvatar(ctx, atlas, value = 0) {
  const profile = avatarProfile(value);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, AVATAR_SIZE.width, AVATAR_SIZE.height);
  ctx.drawImage(atlas, ...BODY, 22, 250, 256, 210);
  ctx.drawImage(atlas, ...HEAD, headX(22), 30, 256 * HEAD_WIDTH_SCALE, 220);
  // Draw only the eyes and optional eyebrows: mouth pixels are never sampled.
  // Smaller eyes, closer together; identical eye positions across all faces.
  for (let side = 0; side < 2; side++) {
    ctx.drawImage(atlas, ...EYES[side], headX(112 + side * 60), 176, 16 * HEAD_WIDTH_SCALE, 35);
    const brow = BROWS[profile.face]?.[side];
    if (brow) ctx.drawImage(atlas, ...brow, headX(105 + side * 60), 155, 30 * HEAD_WIDTH_SCALE, 16);
  }
  const hair = HAIR[profile.hairStyle];
  ctx.drawImage(atlas, ...hair, (300-hair[2]*HEAD_WIDTH_SCALE)/2, [26,24,0][profile.hairStyle], hair[2]*HEAD_WIDTH_SCALE, hair[3]);
}

let atlas;
if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
  atlas = new Image();
  atlas.src = new URL('../assets/avatars/player-parts-v1.png', import.meta.url).href;
  await atlas.decode();
}
export function playerAvatarTexture(value) {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE.width;
  canvas.height = AVATAR_SIZE.height;
  drawAvatar(canvas.getContext('2d'), atlas, value);
  return canvas;
}
