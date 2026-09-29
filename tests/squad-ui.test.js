import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague } from '../js/league.js';
import { createPlayer } from '../js/data.js';
import { createRandom } from '../js/random.js';
import { renderLineupEditor, renderSquadComparison } from '../js/ui.js';
import { ACTION_TYPES, applyClubAction, createLineupPlacement } from '../js/rules.js';
import { saveSlot, loadSlot } from '../js/storage.js';

test('控えとの交代とスタメン位置交換を選手IDで保存・復元する', () => {
  const league=createLeague({name:'YOU',color:'#4ade80',seed:'squad-editor'});
  const club=league.clubs.find(c=>c.id===league.humanClubId);
  const reserve=createPlayer('reserve-mf','MF',createRandom('squad-reserve'));
  club.roster.push(reserve);
  const oldStarter=club.lineup[2];
  const swapped=createLineupPlacement(club.lineup,reserve.id,2);
  assert.equal(applyClubAction(club,{type:ACTION_TYPES.SET_LINEUP,clubId:club.id,lineup:swapped}).ok,true);
  assert.equal(club.lineup[2],reserve.id);
  assert.ok(!club.lineup.includes(oldStarter));
  const before=club.lineup[1];
  const moved=createLineupPlacement(club.lineup,club.lineup[4],1);
  assert.equal(applyClubAction(club,{type:ACTION_TYPES.SET_LINEUP,clubId:club.id,lineup:moved}).ok,true);
  assert.equal(club.lineup[4],before);
  assert.equal(new Set(club.lineup).size,5);
  const html=renderLineupEditor(club,reserve.id);
  assert.match(html,/formation-pitch/);
  assert.match(html,/data-lineup-slot="2"/);
  assert.ok(html.includes(`data-lineup-drag="${reserve.id}"`));
  assert.match(html,/選手比較/);
  assert.equal((html.match(/class="squad-player /g) || []).length,club.roster.length);
  assert.match(html,/squad-role-badge starter">先発 MF1/);
  assert.match(html,/class="squad-special"/);
  assert.match(html,/アバター|squad-avatar/);
  assert.match(renderSquadComparison(club,club.lineup[2],reserve.id),/→/);
  const memory=new Map();globalThis.localStorage={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)};
  try{
    saveSlot(1,{league,view:'squad'});
    const restored=loadSlot(1).league.clubs.find(c=>c.id===club.id);
    assert.deepEqual(restored.lineup,club.lineup);
    assert.ok(restored.roster.some(p=>p.id===reserve.id));
  }finally{delete globalThis.localStorage;}
});

test('12人の所属選手を先発を含めて一覧表示し、既存能力で比較する', () => {
  const league=createLeague({name:'YOU',color:'#4ade80',seed:'squad-roster-12'});
  const club=league.clubs.find(c=>c.id===league.humanClubId);
  while(club.roster.length<12) club.roster.push(createPlayer(`extra-${club.roster.length}`,'MF',createRandom(`roster-${club.roster.length}`)));
  const html=renderLineupEditor(club,club.lineup[0]);
  assert.equal((html.match(/class="squad-player /g)||[]).length,12);
  assert.equal((html.match(/class="squad-special"/g)||[]).length,12);
  assert.equal((html.match(/class="squad-role-badge /g)||[]).length,12);
  assert.equal((html.match(/class="lineup-slot formation-token /g)||[]).length,5);
  assert.match(html,/所属選手 <small>12\/12<\/small>/);
  assert.match(html,/squad-role-badge starter">先発 GK/);
  assert.match(html,/控え/);
  assert.match(renderSquadComparison(club,club.lineup[0],club.roster[6].id),/compare-stats/);
});
