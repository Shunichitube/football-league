import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAudio,growthCelebrates} from '../js/game-experience.js';
import {RoomAdapter} from '../js/room-adapter.js';
import {RoomClient} from '../js/room-client.js';
import {createLeague} from '../js/league.js';
import {submitInput,runSeason,publicRoom} from '../worker/room-game.js';

test('volume settings clamp and event joy includes numerical growth within the same rank',()=>{
 assert.deepEqual(normalizeAudio({bgm:130,se:-2}),{bgm:100,se:0});
 assert.deepEqual(normalizeAudio({bgm:'broken'}),{bgm:70,se:70});
 for(const event of [{focus:'pass'},{awakeningKeys:['pass']},{specialTrainingResult:{steps:1}}]){
  assert.equal(growthCelebrates({...event,changes:[{from:'G',to:'G',fromValue:51,toValue:52,increased:true}]}),true);
  assert.equal(growthCelebrates({...event,changes:[{fromValue:52,toValue:51}]}),false);
 }
 assert.equal(growthCelebrates({changes:[{increased:true}]}),false);
});

const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),clear:()=>data.clear()};};
test('closing the tab preserves unsubmitted lineup and training; resume checks ambiguous sends first',async()=>{
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();
 const league=createLeague({name:'Resume',color:'#4ade80',seed:'resume-fixed'}),club=league.clubs[0];
 const session={roomId:'ROOM',playerId:'person',playerToken:'test'};
 localStorage.setItem('football-league:v3:session',JSON.stringify(session));
 const room={roomId:'ROOM',phase:'team-setup',phaseRevision:5,revision:7,players:[{id:'person',clubId:club.id,teamName:'Resume',completed:false}],game:{league,draft:null,auction:null,growth:[],events:{[club.id]:{retention:[],special:[]}},financeSummary:[]}};
 let state={mode:'room',roomId:'ROOM',roomPhaseRevision:5,league,training:new Map([[club.roster[1].id,'pass']]),selectedDraftPlayerId:'candidate'};
 const adapter=new RoomAdapter(()=>state,next=>state=next,()=>{},()=>{});adapter.client.room=room;
 const original=[...club.lineup];[club.lineup[2],club.lineup[3]]=[club.lineup[3],club.lineup[2]];adapter.remember();
 sessionStorage.clear();state={};
 const reopened=new RoomAdapter(()=>state,next=>state=next,()=>{},()=>{});reopened.active=true;reopened.client.room=room;
 // The saved local choice survives a server snapshot with the original lineup.
 room.game=structuredClone(room.game);room.game.league.clubs[0].lineup=original;
 reopened.receive(room);
 assert.deepEqual(state.league.clubs[0].lineup,[original[0],original[1],original[3],original[2],original[4]]);
 assert.equal(state.training.get(club.roster[1].id),'pass');assert.equal(state.selectedDraftPlayerId,'candidate');
 const client=new RoomClient(()=>{},()=>{}),calls=[];client.pending={kind:'mutation'};
 client.retry=async()=>{calls.push('retry');client.pending=null;};client.refresh=async()=>calls.push('refresh');client.startPolling=()=>calls.push('poll');
 await client.resume();assert.deepEqual(calls,['retry','refresh','poll']);
 delete globalThis.localStorage;delete globalThis.sessionStorage;
});

test('server waits for every human start button and forbids host bypass without simulating matches',()=>{
 const league=createLeague({name:'Barrier',color:'#4ade80',seed:'barrier-fixed'});
 // An already populated result fixture isolates the barrier from match simulation.
 league.completed=true;
 const players=[{id:'one',clubId:league.clubs[0].id},{id:'two',clubId:league.clubs[1].id}];
 const room={roomId:'BARRIER',phase:'season-ready',phaseRevision:2,revision:3,players,inputs:{},game:{league,events:{}}};
 assert.throws(()=>runSeason(room),/全員のリーグ開始/);
 submitInput(room,players[0],{});assert.equal(room.phase,'season-ready');
 assert.deepEqual(publicRoom(room,players[0]).players.map(p=>p.completed),[true,false]);
 assert.throws(()=>runSeason(room),/全員のリーグ開始/);
 submitInput(room,players[1],{});assert.equal(room.phase,'season-result');assert.equal(room.phaseRevision,3);
 assert.deepEqual(room.inputs,{});assert.equal(league.seasonResults.length,0);
});
