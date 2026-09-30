import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarProfile,drawAvatar} from '../js/player-avatar.js';
test('legacy avatars and all nine variants use one fixed body',()=>{
 const variants=new Set();
 for(let seed=0;seed<9;seed++){
  const profile=avatarProfile(seed);
  variants.add(`${profile.hairStyle}:${profile.face}`);
  assert.equal(profile.body,0);
 }
 assert.equal(variants.size,9);
 for(const value of [{hairStyle:19,face:6,hairColor:11,skinTone:2},{hairStyle:-1,face:Infinity},NaN]){
  const p=avatarProfile(value);assert.ok(p.hairStyle>=0&&p.hairStyle<3);assert.ok(p.face>=0&&p.face<3);
  assert.equal(p.hairColor,0);assert.equal(p.skinTone,0);
 }
});
test('changing hair and face only changes their own layers',()=>{
 const render=p=>{const calls=[];drawAvatar({clearRect(){},drawImage(...args){calls.push(args)}},{},p);return calls.map(c=>c.slice(1));};
 const normal=render({hairStyle:0,face:0});
 const hair=render({hairStyle:2,face:0});
 const face=render({hairStyle:0,face:2});
 assert.deepEqual(normal[0],hair[0]);assert.deepEqual(normal[0],face[0]);
 assert.deepEqual(normal.slice(1,-1),hair.slice(1,-1));assert.deepEqual(normal.at(-1),face.at(-1));
 assert.notDeepEqual(normal.at(-1),hair.at(-1));assert.notDeepEqual(normal.slice(1,-1),face.slice(1,-1));
});
