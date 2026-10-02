import test from 'node:test';
import assert from 'node:assert/strict';
import {createRandom} from '../js/random.js';
import {createPlayer,createClub} from '../js/data.js';
import {createLeague} from '../js/league.js';
import {processOffseason,createSpecialTrainingOffers} from '../js/development.js';
import {createAuctionPool,createScoutComment,SPECIAL_ABILITY_DESCRIPTIONS} from '../js/market.js';
import {ACTION_TYPES,applyClubAction} from '../js/rules.js';
import {simulateMatch} from '../js/sim.js';
import {exportSave,importSave} from '../js/storage.js';
import {playerAppearance,avatarProfile} from '../js/avatar-profile.js';
import {renderPlayerCard,renderLineupEditor} from '../js/ui.js';
import {formatMatchEvents} from '../js/match-log.js';
import {rareMotionFrame} from '../js/rare-avatar.js';
import {RARE_CHARACTERS,applyRareCharacter,rollRareCharacter,hatchEgg,rankMaximum,rareDuelResult,rareShotResult,blackHoleResult,emperorBonus,effectiveRareStats} from '../js/rare-characters.js';
const fixed = value => ({next:()=>value});
const rare = (kind, roll=.5) => applyRareCharacter(createPlayer(`rare-${kind}`,'MF',createRandom(kind)),kind,fixed(roll));

test('all nine identities use specified rank maxima and approved scout descriptions',()=>{
  assert.deepEqual(['G','F','E','D','C','B','A','S','SS'].map(rankMaximum),[55,60,65,70,75,80,85,90,99]);
  for(const [kind,def] of Object.entries(RARE_CHARACTERS)){
    const p=rare(kind);
    for(const key of Object.keys(p.stats))assert.equal(p.stats[key],rankMaximum(def[key]||def.rank));
    assert.equal(createScoutComment(p,fixed(.99)),def.scout);
    assert.equal(p.specialAbility===null,kind==='chick');
    if(p.specialAbility)assert.ok(SPECIAL_ABILITY_DESCRIPTIONS[p.specialAbility]);
  }
});
test('generation probability boundaries are per player and allow repeated identities',()=>{
  assert.equal(rollRareCharacter('draft',fixed(.004999)),'golden_egg');
  assert.equal(rollRareCharacter('draft',fixed(.005)),null);
  for(const [i,kind] of ['king_kong','sage','robot','black_hole'].entries()){
    assert.equal(rollRareCharacter('auction',fixed(i*.001+.0005)),kind);
    assert.equal(rollRareCharacter('auction',fixed(i*.001+.0005)),kind);
  }
  assert.equal(rollRareCharacter('auction',fixed(.004)),null);
});
test('hatching happens once at 23, preserves identity/contracts and uses 40/40/15/5',()=>{
  for(const [roll,kind] of [[0,'chick'],[.4,'emperor_penguin'],[.8,'phoenix'],[.95,'dragon']]){
    const p=rare('golden_egg');p.age=22;p.contractYears=2;p.name='my egg';
    const id=p.id;assert.equal(hatchEgg(p,fixed(roll)),null);
    p.age=23;assert.equal(hatchEgg(p,fixed(roll)),kind);
    assert.equal(p.id,id);assert.equal(p.name,'my egg');assert.equal(p.contractYears,2);
    assert.equal(hatchEgg(p,{next:()=>{throw Error('must not reroll');}}),null);
  }
});
test('rares never grow, awaken, train specially, decline or retire',()=>{
  const club=createClub({id:1,name:'test',color:'#fff',seed:createRandom('fixed')});
  club.roster=Object.keys(RARE_CHARACTERS).filter(k=>k!=='golden_egg').map(kind=>rare(kind));
  const before=club.roster.map(p=>({...p.stats}));club.roster.forEach(p=>p.age=120);
  assert.equal(createSpecialTrainingOffers(club,fixed(0)).length,0);
  const rows=processOffseason(club,new Map(),createRandom('growth'),new Set(club.roster.map(p=>p.id)));
  assert.equal(rows.length,8);assert.equal(club.roster.length,8);
  rows.forEach((r,i)=>{assert.deepEqual(r.player.stats,before[i]);assert.equal(r.retired,false);assert.deepEqual(r.awakeningKeys,[]);assert.equal(r.specialTrainingResult,null);});
});
test('robot action is deterministic; sage terminates even a perfect robotic pass',()=>{
  for(const [i,action] of ['pass','dribble','shoot'].entries()){
    const p=rare('robot',(i+.1)/3);
    for(const a of ['pass','dribble'])assert.equal(rareDuelResult(p,{},a,fixed(0)),action===a?'success':'stop');
    assert.equal(rareShotResult(p,fixed(0)),action==='shoot'?'goal':'miss');
  }
  const p=rare('robot',0);
  assert.equal(rareDuelResult(p,rare('sage'),'pass',fixed(.7999)),'stop');
  assert.equal(rareDuelResult(p,rare('sage'),'pass',fixed(.8)),'own_goal');
});
test('kong and black hole branches change the result once with exact probability boundaries',()=>{
  assert.equal(rareShotResult(rare('king_kong'),fixed(.7999)),'goal');
  assert.equal(rareShotResult(rare('king_kong'),fixed(.8)),'own_goal');
  const p=rare('black_hole');
  assert.equal(blackHoleResult(p,'goal',fixed(.1999)),'transfer');
  assert.equal(blackHoleResult(p,'goal',fixed(.2)),'goal');
  assert.equal(blackHoleResult(p,'save',fixed(.0499)),'goal');
  assert.equal(blackHoleResult(p,'save',fixed(.05)),'save');
  assert.equal(blackHoleResult(p,'miss',fixed(0)),'miss');
});
test('emperor stacking and dragon debuff operate on copies, not permanent stats',()=>{
  const p=rare('emperor_penguin'),gk=rare('black_hole'),original={...gk.stats};
  assert.equal(emperorBonus([p,p,gk]),10);
  const boosted=effectiveRareStats(gk,10,10);
  assert.equal(boosted.stats.defense,65);assert.equal(boosted.stats.gk,85);
  assert.equal(effectiveRareStats(gk,100).stats.defense,99);
  assert.equal(effectiveRareStats(gk,0,100).stats.gk,50);
  assert.deepEqual(gk.stats,original);
  assert.equal(effectiveRareStats(gk),gk);
});
test('released egg disappears; hatched low-rank and old rare players can return to auction',()=>{
  const league=createLeague({name:'test',color:'#fff',seed:'release'}),club=league.clubs[0];
  league.releasePhaseOpen=true;
  const egg=rare('golden_egg'),chick=rare('chick');chick.age=120;
  club.roster.push(egg,chick);
  assert.equal(applyClubAction(club,{type:ACTION_TYPES.RELEASE_PLAYER,clubId:club.id,playerId:egg.id},league).ok,true);
  assert.equal(league.releasedPlayers.some(p=>p.id===egg.id),false);
  assert.equal(applyClubAction(club,{type:ACTION_TYPES.RELEASE_PLAYER,clubId:club.id,playerId:chick.id},league).ok,true);
  const pool=createAuctionPool('released',2,league.releasedPlayers);
  assert.ok(pool.some(p=>p.id===chick.id));assert.ok(!pool.some(p=>p.id===egg.id));
});
test('save/load, avatar normalization, cards and frame selection preserve rare identities',()=>{
  const league=createLeague({name:'test',color:'#fff',seed:'save'}),p=rare('robot',.9);league.clubs[0].roster.push(p);
  const restored=importSave(exportSave({league})).league.clubs[0].roster.at(-1);
  assert.equal(restored.rareCharacter,'robot');assert.equal(restored.specialAbility,'精密シュート');
  assert.equal(avatarProfile(playerAppearance(restored)).rareCharacter,'robot');
  assert.match(renderPlayerCard(restored),/robot-portrait.webp/);assert.match(renderPlayerCard(restored),/不詳/);
  assert.match(renderLineupEditor(league.clubs[0]),/robot-portrait.webp/);
  assert.equal(rareMotionFrame('dragon','shoot',10,false),9);
  assert.equal(rareMotionFrame('dragon','celebrate',0),10);
  assert.equal(rareMotionFrame('black_hole','catch',.875),7);
});
test('fixed rare matches terminate, preserve base stats, repeat exactly and never double count goals',()=>{
  const rng=createRandom('rare-clubs'),home=createClub({id:1,name:'H',color:'#fff',seed:rng}),away=createClub({id:2,name:'A',color:'#000',seed:rng});
  for(const club of [home,away])club.tactic='DRIBBLE';
  applyRareCharacter(home.roster[0],'black_hole',rng);applyRareCharacter(away.roster[0],'black_hole',rng);
  for(const p of home.roster.slice(1))applyRareCharacter(p,'phoenix',rng);
  for(const p of away.roster.slice(1))applyRareCharacter(p,'sage',rng);
  const before=[...home.roster,...away.roster].map(p=>({...p.stats}));
  const result=simulateMatch(home,away,createRandom('rare-fixed'));
  assert.deepEqual(result,simulateMatch(home,away,createRandom('rare-fixed')));
  assert.equal(result.phases,80);assert.equal(result.events.filter(e=>e.kind==='GOAL').length,result.score.home+result.score.away);
  assert.ok(result.events.some(e=>e.kind==='RARE ABILITY'&&e.extra.includes('追加4フェーズ')));
  assert.ok(result.events.some(e=>e.kind==='RARE ABILITY'&&e.extra.includes('千里眼')));
  assert.ok(formatMatchEvents(result.events,{home,away}).length);
  assert.deepEqual([...home.roster,...away.roster].map(p=>p.stats),before);
});
test('dragon shoots once per individual per match and resets next match',()=>{
  const rng=createRandom('dragon-clubs'),home=createClub({id:1,name:'H',color:'#fff',seed:rng}),away=createClub({id:2,name:'A',color:'#000',seed:rng});
  home.tactic='DRIBBLE';for(const p of home.roster.slice(1))applyRareCharacter(p,'dragon',rng);
  const result=simulateMatch(home,away,createRandom('dragon-match'));
  const activations=result.events.filter(e=>e.kind==='RARE ABILITY'&&e.extra.includes('ドラゴンシュート'));
  assert.ok(activations.length>0);assert.ok(activations.length<=4);
  assert.deepEqual(result,simulateMatch(home,away,createRandom('dragon-match')));
});
