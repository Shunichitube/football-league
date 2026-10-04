import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeague} from '../js/league.js';
import {createPlayer} from '../js/data.js';
import {createRandom} from '../js/random.js';
import {processLeagueOffseason} from '../js/cpu.js';
import {processOffseason} from '../js/development.js';
import {applyWork} from '../js/phase-work.js';
import {ACTION_TYPES,applyClubAction} from '../js/rules.js';
import {createAuctionPool} from '../js/market.js';

for(const [mode,years] of [['NORMAL',1],['SHORT',2]]){
 test(`${mode}: contract and retention departures receive annual growth without training`,()=>{
  const league=createLeague({name:'Release',seed:'released-growth',seasonMode:mode}),club=league.clubs[0];
  const contract=createPlayer('contract-departure','FW',createRandom('contract'));
  const retention=createPlayer('retention-departure','DF',createRandom('retention'));
  contract.age=22;contract.contractYears=0;retention.age=31;
  club.roster.push(contract,retention);
  applyWork(league,club.id,{retention:[{playerId:retention.id,cost:20}],special:[]},[
   {type:'contractRelease',playerId:contract.id},{type:'retentionRelease',playerId:retention.id}
  ]);
  const expected={roster:structuredClone(league.releasedPlayers)};
  processOffseason(expected,new Map(),createRandom(`${league.seed}:offseason:${league.season}:released`),new Set(),years);
  const formerAges=new Map(club.roster.map(p=>[p.id,p.age]));
  const summaries=processLeagueOffseason(league,new Map([[contract.id,'shoot']]));
  assert.deepEqual(league.releasedPlayers,expected.roster);
  assert.equal(contract.age,22+years);assert.equal(retention.age,31+years);
  assert.ok(!summaries.some(row=>row.growth.some(g=>g.player.id===contract.id)));
  for(const p of club.roster)if(formerAges.has(p.id))assert.equal(p.age,formerAges.get(p.id)+years);
 });
 test(`${mode}: retirement removes released players before the auction; later departures do not age twice`,()=>{
  const league=createLeague({name:'Release',seed:'released-retirement',seasonMode:mode}),club=league.clubs[0];
  const old=createPlayer('retiring-departure','FW',createRandom('old')),later=createPlayer('later-departure','MF',createRandom('later'));
  old.age=34;old.contractYears=0;later.age=24;
  club.roster.push(old,later);
  applyWork(league,club.id,{retention:[],special:[]},[{type:'contractRelease',playerId:old.id}]);
  processLeagueOffseason(league);
  assert.equal(old.age,35);assert.ok(!league.releasedPlayers.some(p=>p.id===old.id));
  league.releasePhaseOpen=true;
  assert.equal(applyClubAction(club,{type:ACTION_TYPES.RELEASE_PLAYER,clubId:club.id,playerId:later.id},league).ok,true);
  createAuctionPool(league.seed,2,league.releasedPlayers,mode);
  assert.equal(later.age,24+years);
 });
}
