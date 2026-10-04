import test from 'node:test';
import assert from 'node:assert/strict';
import { createClub } from '../js/data.js';
import { createRandom } from '../js/random.js';
import { applyClubAction, ACTION_TYPES, validateLineup, positionSuitability, positionSuitabilityLabel } from '../js/rules.js';
import { secondStageScores } from '../js/sim.js';
import { renderLineupEditor, renderSquadComparison } from '../js/ui.js';
import { selectBestLineup } from '../js/cpu.js';
import { lineupSlots } from '../js/formations.js';
import { validateSetup } from '../js/phase-work.js';
import { exportSave, importSave } from '../js/storage.js';

const make = () => createClub({id:1,name:'Box',color:'#fff',seed:createRandom('box'),controllerType:'HUMAN'});
const box = club => applyClubAction(club,{type:ACTION_TYPES.SET_FORMATION,clubId:club.id,formation:'BOX'});
const player = value => ({stats:{shoot:value,speed:value,dribble:value,pass:value,defense:value,gk:value}});
const roles = value => Object.fromEntries(['passer','receiver','dribbler','origin','runner','support','defender','defenseSupport'].map(key=>[key,player(value)]));

test('box preserves starters, MF gets both placements without a warning, other formations retain warnings',()=>{
  const club=make(), before=[...club.lineup];
  assert.equal(box(club).ok,true);
  assert.deepEqual(club.lineup,[before[0],before[1],before[3],before[2],before[4]]);
  assert.deepEqual(lineupSlots(club),['GK','DF','DF','FW','FW']);
  assert.deepEqual(validateLineup(club).warnings,[]);
  assert.doesNotThrow(()=>validateSetup(club,{lineup:club.lineup,tactic:club.tactic,formation:'BOX'}));
  const restored=importSave(exportSave({league:{clubs:[club]}})).league.clubs[0];
  assert.equal(restored.formation,'BOX');
  assert.deepEqual(restored.lineup,club.lineup);
  for(const slot of ['DF','FW']) {
    assert.equal(positionSuitability({primaryPosition:'MF'},slot),.95);
    assert.equal(positionSuitabilityLabel({primaryPosition:'MF'},slot),'○');
  }
  assert.equal(positionSuitabilityLabel({primaryPosition:'FW'},'FW'),'◎');
  assert.equal(positionSuitabilityLabel({primaryPosition:'FW'},'DF'),'△');
  assert.equal(positionSuitabilityLabel({primaryPosition:'GK'},'FW'),'×');
  const result=applyClubAction(club,{type:ACTION_TYPES.SET_FORMATION,clubId:club.id,formation:'211'});
  assert.equal(result.warnings.length,1);
});

test('box totals equal 100%, only short counter defense gets the 96% penalty',()=>{
  for(const type of ['PASS','DRIBBLE','COUNTER','SHORT_COUNTER']) {
    const score=secondStageScores(type,roles(80),'BALANCED','BALANCED',player(80),'BOX','BOX');
    assert.ok(Math.abs(score.offense-80)<1e-9);
    assert.ok(Math.abs(score.defense-(type==='SHORT_COUNTER'?76.8:80))<1e-9);
  }
});

test('box uses 95% main dribbling and 5% cover, with 40/50/10 passing contributions',()=>{
  const base=roles(80), weak=player(40);
  const score=r=>secondStageScores('DRIBBLE',r,'BALANCED','BALANCED',null,'BOX','BOX');
  assert.ok(Math.abs(score({...base,support:weak}).offense-78)<1e-9);
  assert.ok(Math.abs(score({...base,dribbler:weak}).offense-42)<1e-9);
  assert.ok(Math.abs(score({...base,defenseSupport:weak}).defense-78)<1e-9);
  const pass=r=>secondStageScores('PASS',r,'BALANCED','BALANCED',null,'BOX','BOX').offense;
  assert.ok(Math.abs(pass({...base,passer:weak})-64)<1e-9);
  assert.ok(Math.abs(pass({...base,receiver:weak})-60)<1e-9);
  assert.ok(Math.abs(pass({...base,support:weak})-76)<1e-9);
});

test('box editor and comparison expose symbols without numerical suitability',()=>{
  const club=make();box(club);
  const html=renderLineupEditor(club);
  assert.ok(html.includes('2-0-2'));
  assert.ok(html.includes('DF2 ○'));
  assert.ok(html.includes('FW2 ○'));
  assert.ok(!html.includes('out-of-position'));
  const compare=renderSquadComparison(club,club.lineup[3]);
  assert.ok(compare.includes('配置適性：DF ○'));
  assert.ok(!compare.includes('95%'));
});

test('box automatic lineup evaluates both forward and back slots and retains the human formation',()=>{
  const club=make();box(club);selectBestLineup(club);
  assert.equal(club.formation,'BOX');
  assert.equal(new Set(club.lineup).size,5);
  assert.equal(validateLineup(club).ok,true);
});
