import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../js/data.js';
import { createRandom } from '../js/random.js';
import { processOffseason } from '../js/development.js';
import { applyRareCharacter } from '../js/rare-characters.js';
import { publicRoom } from '../worker/room-game.js';
import { createLeague } from '../js/league.js';

const fixedRandom = () => ({ next: () => .5, int: min => min, pick: values => values[0] });
function player(age, start, position = 'MF') {
  const p = createPlayer(`growth-${age}`, position, createRandom(`growth-${age}`));
  p.age = age;
  p.regrowthStartAge = start;
  p.specialAbility = '万能型';
  p.season.appearances = 7;
  for (const key of Object.keys(p.stats)) p.stats[key] = 70;
  p.hiddenGrowth = Object.fromEntries(Object.keys(p.stats).map(key => [key, 1]));
  return p;
}
const advance = (p, years = 1, rng = fixedRandom()) => processOffseason({roster:[p]}, new Map(), rng, new Set(), years);

test('generation uses one five-percent roll and a fixed start age from 25 through 30', () => {
  const rng = roll => ({...fixedRandom(), next: () => roll, int: (min, max) => min === 25 && max === 30 ? 30 : min});
  assert.equal(createPlayer('yes','MF',rng(.049)).regrowthStartAge,30);
  assert.equal(createPlayer('no','MF',rng(.05)).regrowthStartAge,null);
  let selected = 0;
  const starts = new Set();
  const seeded = createRandom('regrowth-frequency');
  for (let i=0;i<5000;i++) {
    const p=createPlayer(i,'MF',seeded);
    if (p.regrowthStartAge !== null) {selected++;starts.add(p.regrowthStartAge);}
  }
  assert.ok(selected > 200 && selected < 300);
  assert.deepEqual([...starts].sort((a,b)=>a-b),[25,26,27,28,29,30]);
});

test('young growth is identical and saves without the new field retain normal growth', () => {
  for (const age of [18,20,22,24]) {
    const normal=player(age,null), hidden=player(age,30);
    delete normal.regrowthStartAge;
    advance(normal);advance(hidden);
    assert.deepEqual(normal.stats,hidden.stats);
  }
});

test('each possible start activates exactly three years, then normal aging resumes', () => {
  for (let start=25;start<=30;start++) {
    const p=player(start-1,start);
    for (let year=0;year<3;year++) {
      const before=p.stats.speed;
      const [result]=advance(p);
      assert.equal(p.stats.speed,before+2);
      assert.ok(!Object.hasOwn(result,'regrowthStartAge'));
      assert.equal(result.awakeningKeys.length,0);
    }
    const normal=structuredClone(p);delete normal.regrowthStartAge;
    advance(p);advance(normal);
    assert.deepEqual(p.stats,normal.stats);
  }
});

test('late growth pauses goalkeeper rank decline without unlocking frozen skills', () => {
  const p=player(31,30,'GK');
  advance(p);
  assert.equal(p.stats.gk,72);
  assert.equal(p.stats.shoot,70);assert.equal(p.stats.dribble,70);
  advance(p);
  assert.equal(p.stats.gk,70);
});

test('growth keeps high-ability limits and the three-point annual cap', () => {
  const p=player(28,29);p.hiddenGrowth.pass=10;
  p.stats.shoot=99;
  advance(p);
  assert.equal(p.stats.pass,73);assert.equal(p.stats.shoot,99);
});

test('two-year processing crosses the start and end identically to annual processing', () => {
  for (const age of [24,25,28,29,31]) {
    const a=player(age,26),b=structuredClone(a);
    advance(a,2,createRandom(`two-${age}`));
    const rng=createRandom(`two-${age}`);advance(b,1,rng);advance(b,1,rng);
    assert.deepEqual(a,b);
  }
});

test('hidden start survives serialization, is removed from public rooms and excluded from rares', () => {
  const p=player(25,28);
  assert.equal(JSON.parse(JSON.stringify(p)).regrowthStartAge,28);
  const league=createLeague({name:'再成長',color:'#fff',seed:'regrowth-save'});
  league.clubs[0].roster.push(p);
  const room={roomId:'GROWTH',phase:'draft',players:[],inputs:{},game:{league}};
  const shared=publicRoom(room);
  assert.doesNotMatch(JSON.stringify(shared),/regrowthStartAge/);
  assert.equal(p.regrowthStartAge,28);
  applyRareCharacter(p,'dragon',createRandom('rare-growth'));
  assert.equal(p.regrowthStartAge,undefined);
});
