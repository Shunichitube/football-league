import test from 'node:test';
import assert from 'node:assert/strict';
import {bgmTrack,createBgmController,BGM_FILES} from '../js/bgm.js';

test('season simulation uses the home track and results keep their own track',()=>{
 assert.equal(bgmTrack('seasonResults',true),'home');
 assert.equal(bgmTrack('seasonResults',false),'result');
 assert.equal(bgmTrack('title'),'home');
});
test('entering the season reel continues the home track, then switches after it ends',async()=>{
 const sounds=[],doc={hidden:false,addEventListener(){},removeEventListener(){}};
 const controller=createBgmController({doc,storage:null,createAudio(src){const audio={src,paused:true,currentTime:0,plays:0,play(){this.paused=false;this.plays++;return Promise.resolve();},pause(){this.paused=true;}};sounds.push(audio);return audio;}});
 controller.sync({view:'title'});await Promise.resolve();
 controller.sync({view:'seasonResults',simulating:true});
 assert.equal(sounds.length,1);assert.equal(sounds[0].src,BGM_FILES.home);assert.equal(sounds[0].plays,1);
 controller.sync({view:'seasonResults',simulating:false});
 assert.equal(sounds[0].paused,true);assert.equal(sounds[1].src,BGM_FILES.result);
 controller.dispose();
});
