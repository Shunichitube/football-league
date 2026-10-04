import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague, applySeasonFinances, startNextSeason, simulateRemainingSeason, finalizeSeason } from '../js/league.js';
import { processOffseason } from '../js/development.js';
import { createRandom } from '../js/random.js';
import { createPlayer, displayPlayer } from '../js/data.js';
import { createDraftPool, createAuctionPool, addPlayer } from '../js/market.js';
import { processLeagueOffseason } from '../js/cpu.js';
import { ACTION_TYPES, applyClubAction } from '../js/rules.js';
import { applyRareCharacter } from '../js/rare-characters.js';
import { seasonLimit, yearsPerSeason } from '../js/season-mode.js';
import { exportSave, importSave } from '../js/storage.js';
import { renderGrandResults } from '../js/grand-finale-ui.js';
import { runSeason, submitInput, publicRoom } from '../worker/room-game.js';

const league = mode => createLeague({name:'Test',color:'#fff',seed:'short',seasonMode:mode});
test('short mode starts with four-year contracts and persists, legacy modes retain normal rules',()=>{
 const l=league('SHORT');assert.equal(seasonLimit(l),5);assert.equal(yearsPerSeason(l),2);
 for(const c of l.clubs) for(const p of c.roster){assert.equal(p.contractYears,2);assert.equal(displayPlayer(p).contractYears,4);}
 const restored=importSave(exportSave({league:l})).league;assert.equal(restored.seasonMode,'SHORT');assert.equal(displayPlayer(restored.clubs[0].roster[0]).contractYears,4);
 assert.equal(seasonLimit({}),10);assert.equal(yearsPerSeason({}),1);assert.equal(league().clubs[0].roster[0].contractYears,3);
});
test('market, acquisition and renewal all use two-season / four-year contracts',()=>{
 const c=league('SHORT').clubs[0];
 const candidates=[...createDraftPool('short',1,'SHORT'),...createAuctionPool('short',1,[],'SHORT')];
 assert.ok(candidates.every(p=>displayPlayer(p).contractYears===4));
 const p=candidates[0];assert.equal(addPlayer(c,p,1),true);p.contractYears--;
 assert.equal(displayPlayer(p).contractYears,2);p.contractYears--;
 assert.equal(applyClubAction(c,{type:ACTION_TYPES.RENEW_CONTRACT,clubId:c.id,playerId:p.id}).ok,true);
 assert.equal(displayPlayer(p).contractYears,4);
});
test('two-year growth matches two annual sequential runs and produces one combined row per player',()=>{
 const c=league('SHORT').clubs[0];for(const p of c.roster){p.age=20;p.isInitial=false;}
 const copy=structuredClone(c),focus=new Map([[c.roster[1].id,'pass']]),special=new Set([c.roster[1].id]);
 const before=new Map(c.roster.map(p=>[p.id,{...p.stats}]));
 const actual=processOffseason(c,focus,createRandom('annual'),special,2),rng=createRandom('annual');
 processOffseason(copy,focus,rng,special);processOffseason(copy,focus,rng,special);
 assert.deepEqual(c,copy);assert.equal(actual.length,5);assert.equal(new Set(actual.map(r=>r.player.id)).size,5);
 for(const row of actual) for(const change of row.changes){assert.equal(change.fromValue,before.get(row.player.id)[change.key]);assert.equal(change.toValue,row.player.stats[change.key]);}
 assert.equal(actual.find(r=>r.player.id===c.roster[1].id).focus,'pass');
});
test('intermediate retirement stops annual processing and eggs hatch while crossing 23',()=>{
 const c=league('SHORT').clubs[0],old=c.roster[1];old.age=34;
 const egg=applyRareCharacter(createPlayer('egg','MF',createRandom('egg')),'golden_egg',createRandom('egg'));egg.age=22;c.roster.push(egg);
 const rows=processOffseason(c,new Map(),createRandom('intermediate'),new Set(),2);
 assert.equal(old.age,35);assert.ok(!c.roster.includes(old));assert.equal(rows.find(r=>r.player.id===old.id).retired,true);
 assert.equal(egg.age,24);assert.notEqual(egg.rareCharacter,'golden_egg');assert.ok(rows.find(r=>r.player.id===egg.id).hatched);
});
test('finance runs once and league offseason does not consume two contracts or charge twice',()=>{
 const l=league('SHORT');for(const c of l.clubs)c.funds=0;
 const income=applySeasonFinances(l);assert.ok(income.every(r=>r.base===100));
 const before=l.clubs.map(c=>({ages:c.roster.map(p=>p.age),funds:c.funds,contracts:c.roster.map(p=>p.contractYears)}));
 const rows=processLeagueOffseason(l);
 assert.equal(rows.length,6);
 for(const [i,c] of l.clubs.entries()){assert.equal(c.funds,before[i].funds);c.roster.forEach((p,j)=>{assert.equal(p.age,before[i].ages[j]+2);assert.equal(p.contractYears,before[i].contracts[j]);});}
});
test('five completed seasons end with five history entries and no sixth season',()=>{
 const l=league('SHORT'), originalKeeper=l.clubs[0].roster[0], initialAge=originalKeeper.age;
 for(let i=1;i<=5;i++){simulateRemainingSeason(l);finalizeSeason(l);processLeagueOffseason(l);assert.equal(startNextSeason(l),i<5);}
 assert.equal(originalKeeper.age,initialAge+10);
 assert.equal(l.season,5);assert.equal(l.history.length,5);
 const html=renderGrandResults(l,1,s=>s);assert.ok(html.includes('5シーズンの総合結果'));assert.ok(!html.includes('10シーズン'));
});
test('room result barrier finishes at season five and exposes the persisted mode',()=>{
 const l=league('SHORT');l.season=5;
 const player={id:'host',clubId:1,teamName:'Test'},room={roomId:'test',seasonMode:'SHORT',hostPlayerId:'host',players:[player],phase:'season-ready',phaseRevision:1,revision:1,inputs:{1:{lineup:l.clubs[0].lineup,tactic:l.clubs[0].tactic}},game:{league:l,events:{},special:{},growth:[]}};
 runSeason(room);assert.equal(l.history.length,1);assert.equal(room.phase,'season-result');submitInput(room,player,{});assert.equal(room.phase,'offseason-events');
 room.phase='growth-result';room.inputs={};submitInput(room,player,{});assert.equal(room.phase,'game-complete');
 assert.equal(publicRoom(room,player).seasonMode,'SHORT');
});
