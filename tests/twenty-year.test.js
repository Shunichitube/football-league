import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague, startNextSeason, simulateRemainingSeason, finalizeSeason } from '../js/league.js';
import { seasonLimit, yearsPerSeason } from '../js/season-mode.js';
import { displayPlayer } from '../js/data.js';
import { retireBeforeContractEvents, processLeagueOffseason } from '../js/cpu.js';
import { applyRareCharacter } from '../js/rare-characters.js';
import { runSeason, submitInput } from '../worker/room-game.js';
import { exportSave, importSave } from '../js/storage.js';

const league = mode => createLeague({name:'20年',color:'#fff',seed:'twenty-year',seasonMode:mode});
test('twenty-year mode preserves short mode and uses four-year contracts',()=>{
 const l=league('TWENTY');
 assert.equal(seasonLimit(l),10);assert.equal(yearsPerSeason(l),2);
 assert.equal(seasonLimit(league('SHORT')),5);
 for(const club of l.clubs)for(const p of club.roster)assert.equal(displayPlayer(p).contractYears,4);
 assert.equal(importSave(exportSave({league:l})).league.seasonMode,'TWENTY');
});
test('retirement precedes contracts at 34 normally and 33/34 with two-year aging',()=>{
 for(const [mode,cutoff] of [['NORMAL',34],['SHORT',33],['TWENTY',33]]){
  const l=league(mode),c=l.clubs[0];
  c.roster[0].age=cutoff-1;c.roster[1].age=cutoff;c.roster[2].age=34;
  const ids=[c.roster[1].id,c.roster[2].id];
  const rare=applyRareCharacter(c.roster[3],'dragon',{});rare.age=120;
  const rows=retireBeforeContractEvents(l).filter(r=>r.clubId===c.id);
  assert.deepEqual(rows.map(r=>r.player.id),ids);
  assert.ok(c.roster.includes(rare));assert.ok(c.roster.some(p=>p.age===cutoff-1));
  assert.ok(ids.every(id=>!c.lineup.includes(id)&&!l.releasedPlayers.some(p=>p.id===id)));
  assert.ok(c.roster.length>=5);
 }
});
test('room retires before creating any contract or paid training decisions',()=>{
 const l=league('TWENTY'),c=l.clubs[0],p=c.roster[1];p.age=33;p.contractYears=1;
 const host={id:'host',clubId:1,teamName:'20年'};
 const room={roomId:'test',seasonMode:'TWENTY',hostPlayerId:'host',players:[host],phase:'season-ready',phaseRevision:1,revision:1,inputs:{1:{lineup:c.lineup,tactic:c.tactic}},game:{league:l,events:{},special:{},growth:[]}};
 runSeason(room);submitInput(room,host,{});
 assert.equal(room.phase,'offseason-events');assert.ok(!c.roster.some(row=>row.id===p.id));
 assert.ok(!room.game.events[1].retention.some(row=>row.playerId===p.id));
 assert.ok(l.retirements.some(row=>row.player.id===p.id));
});
test('twenty-year mode ends after ten seasons and twenty annual updates',()=>{
 const l=league('TWENTY'),keeper=applyRareCharacter(l.clubs[0].roster[0],'black_hole',{}),age=keeper.age;
 for(let i=1;i<=10;i++){
  simulateRemainingSeason(l);finalizeSeason(l);retireBeforeContractEvents(l);processLeagueOffseason(l);
  assert.equal(startNextSeason(l),i<10);
 }
 assert.equal(keeper.age,age+20);assert.equal(l.history.length,10);assert.equal(l.season,10);
});
