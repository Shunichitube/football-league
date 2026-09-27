import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA, arenaTransform, exhibitionAt } from '../js/arena-scene.js';
import { readFileSync } from 'node:fs';

test('all scene points share one aspect-preserving transform across desktop and phone',()=>{
  for(const [w,h] of [[1920,1080],[1600,900],[390,844],[844,390],[2560,1080]]){
    const {scale,x,y}=arenaTransform(w,h);
    assert.ok(scale>0);
    assert.ok(Math.abs(x+ARENA.width*scale/2-w/2)<1e-8);
    assert.ok(Math.abs(y+ARENA.height*scale/2-h/2)<1e-8);
    assert.ok(ARENA.width*scale>=w-1e-8&&ARENA.height*scale>=h-1e-8);
  }
});

test('exhibition has pass, shot, save and continuous loop, independent of game state',()=>{
  const phases=new Set();
  for(let t=0;t<36;t+=.025){
    const state=exhibitionAt(t);phases.add(state.phase);
    assert.ok(state.ball.every(Number.isFinite));
    assert.ok(state.ball[0]>=100&&state.ball[0]<=1560);
    const next=exhibitionAt(t+.025);
    assert.ok(Math.hypot(next.ball[0]-state.ball[0],next.ball[1]-state.ball[1])<20);
  }
  for(const phase of ['idle','move','pass','shoot','save','reset'])assert.ok(phases.has(phase));
  assert.deepEqual(exhibitionAt(0),exhibitionAt(18));
  const source=readFileSync(new URL('../js/arena-scene.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/localStorage|sessionStorage|Math\.random\(|from ['"].*(league|sim|storage|random)/);
});
