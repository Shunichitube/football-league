import test from 'node:test';
import assert from 'node:assert/strict';
import {grandResults} from '../js/grand-results.js';
import {createLeague,simulateRemainingSeason,finalizeSeason,startNextSeason} from '../js/league.js';

const club=id=>({id,name:`Club ${id}`,color:'#4ade80',roster:[]});
const season=(season, ranks)=>({season,table:ranks.map((id,i)=>({clubId:id,rank:i+1,points:12-i})),best5:[]});
test('league, MVP and TOP5 stack without mutating the league or awarding twice',()=>{
 const league={clubs:[club(1),club(2)],history:[{...season(1,[1,2]),mvpClubId:2,best5:[{clubId:2},{clubId:2}]}],careerRecords:[]};
 const before=JSON.stringify(league), result=grandResults(league);
 assert.equal(result.rows.find(r=>r.club.id===2).total,12);
 assert.equal(result.winners[0].club.id,2);
 assert.deepEqual(grandResults(league),result);assert.equal(JSON.stringify(league),before);
});
test('tied individual awards each give full bonus, split across former clubs, including retired players',()=>{
 const record=(id,shares)=>({id,name:id,career:{goals:10},clubCareer:Object.fromEntries(shares.map(([id,goals])=>[id,{goals}]))});
 const result=grandResults({clubs:[club(1),club(2)],history:[],careerRecords:[record('retired',[[1,6],[2,4]]),record('second',[[1,10]])]});
 assert.equal(result.awards[0].winners.length,2);
 assert.equal(result.rows.find(r=>r.club.id===1).bonusPt,8);
 assert.equal(result.rows.find(r=>r.club.id===2).bonusPt,2);
});
test('fractional shares keep full precision and ties use titles then league match points',()=>{
 const league={clubs:[club(1),club(2),club(3)],history:[season(1,[1,2,3]),season(2,[3,2,1])],careerRecords:[]};
 let result=grandResults(league);assert.deepEqual(result.winners.map(r=>r.club.id),[1,3]);
 league.history[0].table[0].points++;
 result=grandResults(league);assert.equal(result.winners.length,1);assert.equal(result.winners[0].club.id,1);
});
test('streaks cross season boundaries and draws reset them',()=>{
 const league={clubs:[club(1),club(2)],careerRecords:[],history:[{...season(1,[1,2]),fixtures:[{homeId:1,awayId:2,homeGoals:2,awayGoals:0}]},{...season(2,[1,2]),fixtures:[{homeId:1,awayId:2,homeGoals:1,awayGoals:0},{homeId:1,awayId:2,homeGoals:1,awayGoals:1}]}]};
 const result=grandResults(league);assert.equal(result.rows[0].maxStreak,2);assert.equal(result.rows[0].bonusPt,5);
});
test('all six clubs can share overall victory and empty individual stats do not award points',()=>{
 const result=grandResults({clubs:[1,2,3,4,5,6].map(club),history:[],careerRecords:[]});
 assert.equal(result.winners.length,6);assert.ok(result.rows.every(row=>row.total===0));
});
test('10 seasons complete, career archive tracks actual breakthroughs and per-club defensive stats',()=>{
 const league=createLeague({name:'完走',color:'#4ade80',seed:'ending-full-career'});
 for(let season=1;season<=10;season++){
   simulateRemainingSeason(league);finalizeSeason(league);
   if(season<10)assert.equal(startNextSeason(league),true);
 }
 const result=grandResults(league), before=JSON.stringify(league);
 assert.equal(league.history.length,10);assert.equal(startNextSeason(league),false);
 assert.equal(JSON.stringify(league),before);assert.equal(result.rows.length,6);
 assert.ok(result.awards[4].winners.length>0);
 for(const record of league.careerRecords)for(const key of ['goals','assists','saves','defensiveStops','breakthroughs'])
   assert.equal(Object.values(record.clubCareer).reduce((sum,stats)=>sum+(stats[key]||0),0),record.career[key]||0);
});
