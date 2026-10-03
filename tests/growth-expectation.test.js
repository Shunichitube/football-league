import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeague } from '../js/league.js';
import { createPlayer, growthExpectationKey } from '../js/data.js';
import { createRandom } from '../js/random.js';
import { applyRareCharacter } from '../js/rare-characters.js';
import { renderPlayerCard, renderContractPlayerCard, renderSquadComparison } from '../js/ui.js';
import { publicRoom } from '../worker/room-game.js';

test('online cards keep the same growth expectation in rosters, market and nested results', () => {
  const league = createLeague({name:'成長期待',color:'#ffffff',seed:'public-growth'});
  const player = league.clubs[0].roster.find(p => p.primaryPosition === 'MF');
  player.hiddenGrowth = {speed:.7, pass:.8, dribble:.9, shoot:1.3, defense:1, stamina:1.1};
  const room = {roomId:'GROWTH', phase:'draft', players:[], inputs:{}, game:{league, events:{},
    draft:{pool:[player],history:[{player}]}, auction:{pool:[player],history:[{player}]}, growth:[{growth:[{player}]}]}};
  const before = JSON.stringify(room);
  const shared = publicRoom(room);
  const players = [shared.game.league.clubs[0].roster.find(p => p.id === player.id),
    shared.game.draft.pool[0], shared.game.draft.history[0].player, shared.game.auction.pool[0],
    shared.game.auction.history[0].player, shared.game.growth[0].growth[0].player];
  for (const candidate of players) {
    assert.equal(candidate.hiddenGrowth, undefined);
    assert.equal(candidate.growthExpectationKey, 'shoot');
    assert.match(renderPlayerCard(candidate), /成長期待：<b>シュート<\/b>/);
  }
  const club = shared.game.league.clubs[0];
  assert.match(renderContractPlayerCard(players[0],club), /成長期待：<b>シュート<\/b>/);
  assert.match(renderSquadComparison(club,players[0].id,null), /成長期待：<b>シュート<\/b>/);
  assert.equal(JSON.stringify(room), before, 'Sharing must not alter authoritative growth data');
  assert.doesNotMatch(JSON.stringify(shared), /"(?:hiddenGrowth|rngState|seed|accessToken|cpuLimits|cpuAt)":/);
});

test('GK hints exclude frozen shooting and dribbling, and a public hint matches the private profile', () => {
  const player = createPlayer(99,'GK',createRandom('gk-expectation'));
  player.hiddenGrowth = {shoot:99,dribble:99,gk:.8,defense:.9,speed:1.3,pass:1};
  const shared = {...player,growthExpectationKey:growthExpectationKey(player)};
  delete shared.hiddenGrowth;
  assert.equal(shared.growthExpectationKey, 'speed');
  assert.match(renderPlayerCard(player), /成長期待：<b>走力<\/b>/);
  assert.match(renderPlayerCard(shared), /成長期待：<b>走力<\/b>/);
  player.hiddenGrowth.gk = 1.4;
  assert.match(renderPlayerCard({...shared,growthExpectationKey:growthExpectationKey(player)}), /成長期待：<b>GK能力<\/b>/);
  assert.equal(growthExpectationKey({...shared,growthExpectationKey:'shoot'}), null);
});

test('fixed rare abilities stay fixed and missing profiles do not invent a growth expectation', () => {
  const player = applyRareCharacter(createPlayer(100,'FW',createRandom('fixed-growth')), 'dragon', createRandom('dragon-growth'));
  assert.equal(growthExpectationKey(player), null);
  delete player.hiddenGrowth;
  assert.match(renderPlayerCard(player), /成長期待：<b>能力固定<\/b>/);
  delete player.rareCharacter;
  assert.equal(growthExpectationKey(player), null);
  assert.match(renderPlayerCard(player), /成長期待：<b>―<\/b>/);
});
