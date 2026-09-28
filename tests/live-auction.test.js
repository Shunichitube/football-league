import test from 'node:test';
import assert from 'node:assert/strict';
import {openLot,raiseBid,passLot,tickLot} from '../js/live-auction.js';
import {submitInput,advanceAuction,publicRoom} from '../worker/room-game.js';
import {createLeague} from '../js/league.js?v=0.17.29';
import {createAuctionPool} from '../js/market.js?v=0.17.31';
function fixture(){const league=createLeague({name:'test',color:'#4ade80',seed:'live-test'});league.clubs.forEach(c=>c.controllerType='HUMAN');const a={pool:createAuctionPool('live-test'),i:0,history:[],completed:false};openLot(a,league.clubs,'live-test',1000);return {league,a};}
test('30 seconds, anti-sniping, strict raises and funds',()=>{const {league,a}=fixture(),[one,two]=league.clubs;assert.equal(a.live.endAt,31000);raiseBid(a,league.clubs,one.id,5,2000);assert.equal(a.live.endAt,31000);assert.throws(()=>raiseBid(a,league.clubs,two.id,5,3000));assert.throws(()=>raiseBid(a,league.clubs,two.id,101,3000));raiseBid(a,league.clubs,two.id,6,28000);assert.equal(a.live.endAt,33000);raiseBid(a,league.clubs,one.id,7,32000);assert.equal(a.live.endAt,37000);assert.throws(()=>raiseBid(a,league.clubs,two.id,8,37000));});
test('settlement charges once and pass cannot retract highest bid',()=>{const {league,a}=fixture(),[one,two]=league.clubs;raiseBid(a,league.clubs,one.id,5,2000);assert.throws(()=>passLot(a,one.id));passLot(a,two.id);assert.throws(()=>raiseBid(a,league.clubs,two.id,6,3000));const count=one.roster.length,funds=one.funds;tickLot(a,league,31000);tickLot(a,league,32000);assert.equal(one.funds,funds-5);assert.equal(one.roster.length,count+1);assert.equal(a.history.length,1);});
test('full roster rejected; no bids means unsold',()=>{const {league,a}=fixture(),one=league.clubs[0];one.roster=Array(12).fill(one.roster[0]);assert.throws(()=>raiseBid(a,league.clubs,one.id,1,2000));tickLot(a,league,31000);assert.equal(a.history[0].winnerClubId,null);});
test('room permits repeated public bids and advances by time',()=>{const {league,a}=fixture(),[one,two]=league.clubs;openLot(a,league.clubs,'live-test');const room={roomId:'test',phase:'auction',phaseRevision:1,revision:1,inputs:{},players:[{id:'a',clubId:one.id},{id:'b',clubId:two.id}],game:{league,auction:a,events:{}}};const input=bid=>({playerId:a.pool[a.i].id,bid});submitInput(room,room.players[0],input(1));submitInput(room,room.players[1],input(2));submitInput(room,room.players[0],input(3));assert.equal(room.inputs[one.id],undefined);assert.equal(publicRoom(room,room.players[0]).game.auction.live.high,3);assert.equal(publicRoom(room).game.auction.live.cpuLimits,undefined);const end=a.live.endAt;advanceAuction(room,end);assert.equal(a.history.length,1);advanceAuction(room,end+4000);assert.equal(a.i,1);assert.equal(room.phaseRevision,2);assert.throws(()=>submitInput(room,room.players[0],{playerId:a.pool[0].id,bid:4}));});

import {RoomObject} from '../worker/room.js';
test('durable room alarm persists deadline and settles without a client',async()=>{
  const {league,a}=fixture(),one=league.clubs[0];
  raiseBid(a,league.clubs,one.id,4,2000);a.live.endAt=Date.now()-1;a.live.cpuAt=Date.now()+2000;
  const room={roomId:'ABCDEF123456',phase:'auction',phaseRevision:1,revision:1,inputs:{},players:[],receipts:{},game:{league,auction:a}};
  const data=new Map();let alarmAt;
  const storage={async get(k){return Array.isArray(k)?new Map(k.map(key=>[key,data.get(key)])):data.get(k)},async put(k,v){data.set(k,v)},async delete(k){data.delete(k)},async setAlarm(t){alarmAt=t},async deleteAlarm(){alarmAt=null},async transaction(fn){return fn(this)}};
  const object=new RoomObject({storage},{});await object.save(room);assert.equal(alarmAt,a.live.endAt);
  await object.alarm();const saved=await object.load();assert.equal(saved.game.auction.history.length,1);assert.equal(saved.game.league.clubs[0].funds,one.funds-4);assert.equal(alarmAt,saved.game.auction.live.nextAt);
  await object.alarm();assert.equal((await object.load()).game.auction.history.length,1);
});

