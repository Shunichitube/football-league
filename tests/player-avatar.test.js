import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarProfile,drawAvatar,HAIR_STYLES,SKIN_TONES} from '../js/player-avatar.js';
import {createPlayerAppearance,playerAppearance,kitColor} from '../js/avatar-profile.js';
import {recolorPixels} from '../js/avatar-rendering.js';
test('20 hair identities, three skin tones and glasses survive profile normalization',()=>{
 assert.equal(HAIR_STYLES.length,20);assert.equal(SKIN_TONES.length,3);
 for(let hairStyle=0;hairStyle<20;hairStyle++)for(let skinTone=0;skinTone<3;skinTone++){
  const p=avatarProfile({hairStyle,skinTone,glasses:true});assert.equal(p.hairStyle,hairStyle);assert.equal(p.skinTone,skinTone);assert.equal(p.glasses,true);assert.equal(p.body,0);
 }
 for(const value of [{hairStyle:Infinity,skinTone:NaN},{hairStyle:-1,face:-1},NaN]){const p=avatarProfile(value);assert.ok(p.hairStyle>=0&&p.hairStyle<20);assert.ok(p.face>=0&&p.face<3);}
});
test('saved and generated appearances are stable without changing legacy player data',()=>{
 const player={id:'p-example',primaryPosition:'FW',avatar:{version:2,hairStyle:1,face:2,skinTone:0}};
 const before=structuredClone(player);assert.deepEqual(playerAppearance(player),playerAppearance(player));assert.deepEqual(player,before);
 const expanded=new Set();for(let i=0;i<300;i++){const p=createPlayerAppearance(i,'MF');expanded.add(p.hairStyle);assert.deepEqual(p,createPlayerAppearance(i,'MF'));}
 assert.equal(expanded.size,20);
 const fixed={version:4,hairColor:7,hairStyle:19,face:2,skinTone:2,glasses:true};assert.deepEqual(playerAppearance({...player,avatar:fixed}),avatarProfile(fixed));
});
test('both complete eyes keep integer positions and the common body is unchanged by hair',()=>{
 const render=hairStyle=>{const calls=[];drawAvatar({clearRect(){},drawImage(...v){calls.push(v)}},{parts:{},hair:{}},{hairStyle,face:0});return calls;};
 const normal=render(0),long=render(19);assert.deepEqual(normal[0].slice(1),long[0].slice(1));assert.deepEqual(normal[1].slice(1),long[1].slice(1));assert.notDeepEqual(normal[2].slice(1,5),long[2].slice(1,5));
 const [left,right]=normal.slice(-2);assert.deepEqual(left.slice(1,5),right.slice(1,5));assert.deepEqual(left.slice(7),right.slice(7));assert.ok(left.slice(5).every(Number.isInteger));assert.ok(right.slice(5).every(Number.isInteger));
});
test('palette changes affect uniform and skin, preserve white details and alpha, and keep GK gray',()=>{
 const source=new Uint8ClampedArray([0,40,240,255,255,190,137,255,250,250,250,255,0,40,240,0]);
 const red=recolorPixels(source.slice(),{kit:'#cf293b',skinTone:0}),green=recolorPixels(source.slice(),{kit:'#16935b',skinTone:2});
 assert.ok(red[0]>red[1]);assert.ok(green[1]>green[0]);assert.ok(green[4]<red[4]);assert.deepEqual(red.slice(8),source.slice(8));
 assert.deepEqual(recolorPixels(source.slice(),{kit:'#ff0000',goalkeeper:true}),recolorPixels(source.slice(),{kit:'#00ff00',goalkeeper:true}));
 assert.equal(kitColor('#f00'),'#ff0000');assert.equal(kitColor('bad'),'#1655e8');assert.equal(kitColor('#f00',true),'#777b80');
});

test('dark skin recolors the orange shadow pixels as well as highlights',()=>{
 const source=new Uint8ClampedArray([95,42,16,255,180,95,48,255,255,190,137,255,20,12,8,255]);
 const tinted=recolorPixels(source.slice(),{skinTone:2,recolorKit:false});
 for(const offset of [0,4,8]){assert.ok(tinted[offset]<source[offset]);assert.ok(tinted[offset+1]<source[offset+1]);}
 assert.deepEqual(tinted.slice(12),source.slice(12));
});
test('keeper standing portrait uses the same front body source as field players',()=>{
 const draw=goalkeeper=>{const calls=[];drawAvatar({clearRect(){},drawImage(...v){calls.push(v)}},{parts:{},keeper:{}},{hairStyle:0},{goalkeeper});return calls[0];};
 assert.deepEqual(draw(true),draw(false));
});

test('near-red ear and neck shadows from the source atlas follow dark skin',()=>{
 const source=new Uint8ClampedArray([43,3,1,252,54,7,3,252,48,2,0,252]);
 const dark=recolorPixels(source.slice(),{skinTone:2,recolorKit:false});
 for(let i=0;i<source.length;i+=4){assert.ok(dark[i]<source[i]);assert.equal(dark[i+3],source[i+3]);}
});
