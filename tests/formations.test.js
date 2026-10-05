import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATIONS, formationId, lineupSlots, remapFormation } from '../js/formations.js';
import { ACTION_TYPES, applyClubAction, validateLineup } from '../js/rules.js';
import { createClub, createPlayer } from '../js/data.js';
import { createRandom } from '../js/random.js';
import { chooseCpuSetup, selectBestLineup } from '../js/cpu.js';
import { renderLineupEditor } from '../js/ui.js';
import { simulateMatch, secondStageScores } from '../js/sim.js';
import { validateSetup } from '../js/phase-work.js';
import { exportSave, importSave } from '../js/storage.js';

const make = (id = 1) => createClub({id,name:`club${id}`,color:'#fff',seed:createRandom(`formation:${id}`),controllerType:'HUMAN'});
const change = (club, formation) => applyClubAction(club,{type:ACTION_TYPES.SET_FORMATION,clubId:club.id,formation});

test('all six directed switches preserve players and the specified role moves, including round trips',()=>{
 const ids=['gk','df','mf1','mf2','fw'];
 assert.deepEqual(remapFormation(ids,'121','211'),['gk','df','mf2','mf1','fw']);
 assert.deepEqual(remapFormation(ids,'121','112'),['gk','df','mf2','mf1','fw']);
 assert.deepEqual(remapFormation(['gk','df1','df2','mf','fw'],'211','112'),['gk','df1','df2','mf','fw']);
 for(const from of Object.keys(FORMATIONS)) for(const to of Object.keys(FORMATIONS)) {
  const club=make();change(club,from);const before=[...club.lineup],positions=club.roster.map(p=>p.primaryPosition);
  assert.equal(change(club,to).ok,true);assert.equal(new Set(club.lineup).size,5);
  assert.equal(club.lineup[0],before[0]);assert.equal(club.lineup[1],before[1]);assert.equal(club.lineup[4],before[4]);
  change(club,from);assert.deepEqual(club.lineup,before);assert.deepEqual(club.roster.map(p=>p.primaryPosition),positions);
 }
});
test('legacy saves default to 121, new saves retain formation, invalid changes are atomic',()=>{
 const club=make();delete club.formation;assert.equal(formationId(club),'121');assert.deepEqual(lineupSlots(club),['GK','DF','MF','MF','FW']);
 change(club,'112');const restored=importSave(exportSave({league:{clubs:[club]}})).league.clubs[0];
 assert.equal(restored.formation,'112');assert.deepEqual(restored.lineup,club.lineup);
 const before=structuredClone(club);assert.equal(change(club,'999').ok,false);assert.deepEqual(club,before);
 assert.throws(()=>validateSetup(club,{lineup:club.lineup,tactic:club.tactic,formation:'999'}));
 assert.doesNotThrow(()=>validateSetup(club,{lineup:club.lineup,tactic:club.tactic}));
 const keeperOnField=[...club.lineup];[keeperOnField[0],keeperOnField[3]]=[keeperOnField[3],keeperOnField[0]];
 assert.equal(validateLineup(club,keeperOnField).ok,false);
});
test('every formation renders five current role labels and shared-size avatars with position coordinates',()=>{
 for(const formation of Object.keys(FORMATIONS)) {
  const club=make();change(club,formation);const html=renderLineupEditor(club);
  assert.equal((html.match(/class="lineup-slot formation-token /g)||[]).length,5);
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
  for(const label of FORMATIONS[formation].labels)assert.ok(html.includes(`先発 ${label}`));
  assert.equal((html.match(/--slot-x:/g)||[]).length,5);
 }
});
test('support quality affects stage-two output, with attack/defense tradeoff in all four paths',()=>{
 const player={stats:{pass:80,dribble:80,speed:80,shoot:80,defense:80,gk:80}};
 const roles=Object.fromEntries(['passer','receiver','dribbler','runner','origin','support','defender','defenseSupport'].map(k=>[k,player]));
 for(const type of ['PASS','DRIBBLE','COUNTER','SHORT_COUNTER']) {
  const base=secondStageScores(type,roles,'BALANCED','BALANCED',player,'121','121');
  assert.ok(Math.abs(base.offense-80)<1e-9);assert.ok(Math.abs(base.defense-80)<1e-9);
  const attack=secondStageScores(type,roles,'BALANCED','BALANCED',player,'112','112');
  const defend=secondStageScores(type,roles,'BALANCED','BALANCED',player,'211','211');
  assert.ok(Math.abs(attack.offense-84)<1e-9);assert.ok(Math.abs(attack.defense-76)<1e-9);
  assert.ok(Math.abs(defend.offense-76)<1e-9);assert.ok(Math.abs(defend.defense-84)<1e-9);
  const weak=secondStageScores(type,{...roles,defenseSupport:{stats:{defense:40}}},'BALANCED','BALANCED',player);
  assert.ok(weak.defense<base.defense);
 }
});
test('CPU finds natural roles for two FW or two DF, humans retain their chosen formation',()=>{
 for(const formation of ['112','211']) {
  const club=make();club.controllerType='CPU';
  club.roster=FORMATIONS[formation].slots.map((role,i)=>{
   const p=createPlayer(`cpu-${formation}-${i}`,role,createRandom(`cpu-${i}`));
   Object.assign(p.stats,{pass:70,dribble:70,speed:70,shoot:role==='FW'?95:50,defense:role==='DF'?95:50,gk:role==='GK'?90:50,stamina:70});return p;
  });
  const setup=chooseCpuSetup(club);assert.equal(setup.formation,formation);
  selectBestLineup(club);assert.equal(club.formation,formation);assert.equal(validateLineup(club).warnings.length,0);
 }
 const human=make();change(human,'211');selectBestLineup(human);assert.equal(human.formation,'211');
});
test('all formation matchups finish deterministically without mutating lineup or primary positions',()=>{
 for(const homeFormation of Object.keys(FORMATIONS))for(const awayFormation of Object.keys(FORMATIONS)) {
  const home=make(),away=make(2);change(home,homeFormation);change(away,awayFormation);
  const before=JSON.stringify([home,away]);const seed=`${homeFormation}:${awayFormation}`;
  const result=simulateMatch(home,away,createRandom(seed));assert.ok(result.phases >= 80 && result.phases <= 88);
  assert.deepEqual(result,simulateMatch(home,away,createRandom(seed)));assert.equal(JSON.stringify([home,away]),before);
 }
});
test('long feed skips stage one and follows the ordinary counter path',()=>{
 const home=make(),away=make(2);home.roster[0].specialAbility='ロングフィード';home.roster[0].stats.gk=99;
 change(home,'112');let seen=0;
 for(let i=0;i<80;i++) {
  const events=simulateMatch(home,away,createRandom(`feed:${i}`)).events;
  for(let j=0;j<events.length;j++)if(events[j].kind==='LONG FEED') {
   seen++;assert.equal(events[j].display.type,'COUNTER');
   const next=events.slice(j+1).find(e=>e.half===events[j].half&&e.kind!=='LONG FEED'&&e.display?.longFeed);
   if (!next) {
    const end=events.slice(j+1).find(e=>e.half===events[j].half&&['HALF TIME','FULL TIME'].includes(e.kind));
    assert.ok(end);assert.equal(end.phase,events[j].phase);continue;
   }
   assert.equal(next.display.type,'COUNTER');assert.notEqual(next.kind,'STAGE 1 SUCCESS');
  }
 }
 assert.ok(seen>0);
});
