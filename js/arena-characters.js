// Compatibility entry points for scene callers. All artwork lives in character-art.js.
import { drawCharacter } from './character-art.js?v=20260930-master-1';
export function pixelTexture(kit,index,appearance='player') {
  return drawCharacter(kit,index,{appearance});
}
export function pixelSideTexture(kit,index,pose='run1',direction='right') {
  return drawCharacter(kit,index,{pose:pose==='kick'?'kick2':pose,direction});
}
export function seatedBackTexture(kit,index) {
  return drawCharacter(kit,index,{pose:'back'});
}
export function coachTexture(index) {
  return drawCharacter('#26394d',index,{pose:'coach',appearance:'coach'});
}
