import test from 'node:test';
import assert from 'node:assert/strict';
import {saveDraftCheckpoint,restoreDraftCheckpoint} from '../js/draft-checkpoint.js';
import {createRandom} from '../js/random.js';
const store=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
test('phone reload restores the draft and exact random sequence without replaying picks',()=>{
 const storage=store(),rng=createRandom('recovery');rng.next();rng.next();
 const state={view:'draft',league:{clubs:[{id:1,roster:[{id:'picked'}]}]},draft:{pool:[{id:'available'}],round:2,rng,history:[{player:{id:'picked'}}]},training:new Map([['picked','pass']]),specialTrainingAccepted:new Set(['picked']),rosterOpen:true};
 saveDraftCheckpoint(state,storage);const restored=restoreDraftCheckpoint(storage);
 assert.equal(restored.view,'draft');assert.equal(restored.draft.round,2);assert.equal(restored.draft.history.length,1);
 assert.deepEqual(restored.league,state.league);assert.deepEqual(restored.training,state.training);assert.deepEqual(restored.specialTrainingAccepted,state.specialTrainingAccepted);
 assert.equal(restored.rosterOpen,false);for(let i=0;i<10;i++)assert.equal(restored.draft.rng.next(),rng.next());
 saveDraftCheckpoint({...state,view:'title'},storage);assert.equal(restoreDraftCheckpoint(storage),null);
});
test('room state is never restored from a local draft and denied storage is harmless',()=>{
 const storage=store();saveDraftCheckpoint({view:'draft',mode:'room',league:{clubs:[{}]}},storage);assert.equal(restoreDraftCheckpoint(storage),null);
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');},removeItem(){throw Error('denied');}};
 assert.equal(restoreDraftCheckpoint(denied),null);assert.doesNotThrow(()=>saveDraftCheckpoint({view:'title'},denied));
});
