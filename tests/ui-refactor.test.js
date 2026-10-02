import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createInitialState } from '../js/app-state.js';
import { createAuctionClock } from '../js/auction-clock.js';
import { AUCTION_SEATS } from '../js/stage-layout.js';

test('auction clock has one timer during rerenders and stops on exit/completion', () => {
  const callbacks = new Map(), cancelled = [];
  let next = 0, ticks = 0;
  const clock = createAuctionClock(() => ticks++, {
    setInterval(callback, delay) { assert.equal(delay, 200); callbacks.set(++next, callback); return next; },
    clearInterval(id) { cancelled.push(id); callbacks.delete(id); }
  });
  clock.sync(false);
  assert.equal(callbacks.size, 0);
  clock.sync(true); clock.sync(true);
  assert.equal(callbacks.size, 1);
  callbacks.get(1)();
  assert.equal(ticks, 1);
  clock.sync(false); clock.sync(false);
  assert.deepEqual(cancelled, [1]);
  clock.sync(true); clock.dispose();
  assert.equal(callbacks.size, 0);
  assert.deepEqual(cancelled, [1, 2]);
});

test('new UI state clears transient game/dialog flags without sharing mutable state', () => {
  const previous = createInitialState();
  Object.assign(previous, { view: 'auction', league: {}, rosterOpen: true, auctionHistoryOpen: true, rosterSort: 'age' });
  const fresh = createInitialState();
  assert.equal(fresh.view, 'title');
  assert.equal(fresh.league, null);
  assert.equal(fresh.rosterOpen, false);
  assert.equal(fresh.auctionHistoryOpen, false);
  assert.equal(fresh.rosterSort, 'position');
  assert.notEqual(fresh, previous);
});

test('six auction desk anchors stay ordered inside the venue', () => {
  assert.equal(AUCTION_SEATS.length, 6);
  assert.ok(AUCTION_SEATS.every((x,i) => x>0 && x<100 && (!i || x>AUCTION_SEATS[i-1])));
});

// Evaluate the real app's screen functions without publishing test hooks or
// requiring a browser. Only bitmap drawing is substituted; DOM writes fail.
async function screenHarness() {
  const url = new URL('../js/app.js', import.meta.url);
  let source = readFileSync(url, 'utf8');
  const bindings = {};
  for (const match of source.matchAll(/^import\s*\{\s*([^}]+)\s*\}\s*from '([^']+)';$/gm)) {
    const module = await import(new URL(match[2], url));
    for (const name of match[1].split(',')) {
      const [exported, local = exported] = name.trim().split(/\s+as\s+/);
      bindings[local] = module[exported];
    }
  }
  const auctionUrl = new URL('../js/auction-ui.js', import.meta.url);
  const auctionSource = readFileSync(auctionUrl, 'utf8');
  const auctionBindings = {};
  for (const match of auctionSource.matchAll(/^import\s*\{\s*([^}]+)\s*\}\s*from '([^']+)';$/gm)) {
    const module = await import(new URL(match[2], auctionUrl));
    for (const name of match[1].split(',')) auctionBindings[name.trim()] = module[name.trim()];
  }
  const canvas = () => ({ getContext: () => ({ fillRect() {} }), toDataURL: () => 'data:image/png;base64,' });
  Object.assign(bindings, runInNewContext(
    auctionSource.replace(/^import .+;\r?\n/gm, '').replace(/^export /gm, '') + '\n({ auctionAvatar, renderLiveAuction })',
    { ...auctionBindings, pixelTexture: canvas, document: { createElement: canvas } }
  ));
  const app = { dataset: {}, contains: () => false, addEventListener() {} };
  Object.defineProperty(app, 'innerHTML', { set() { throw new Error('Screen function wrote to DOM'); } });
  const document = { querySelector: () => app, addEventListener() {}, querySelectorAll: () => [] };
  source = source.replace(/^import .+;\r?\n/gm, '').replace(/render\(\);\s*$/, '');
  return runInNewContext(source + '\n({ screens, setState: value => s=value, getState: () => s, setRoom: room => roomAdapter.client.room=room, startAuction, returnToTitle })', {
    ...bindings, createBgmController: () => ({sync() {},dispose() {}}), createGameExperience: () => ({reset() {}, syncGrowth() {}}), document, addEventListener() {}, configureRename() {}, dialogs: null
  });
}

test('all screen routes render real fixtures without mutating league or auction', async () => {
  const harness = await screenHarness();
  const { createLeague, simulateRemainingSeason } = await import('../js/league.js?v=0.17.29');
  const { createDraftPool, createAuctionPool } = await import('../js/market.js?v=0.22.0');
  const { openLot } = await import('../js/live-auction.js');
  const league = createLeague({ name: '表示確認', color: '#4ade80', seed: 'ui-refactor' });
  const club = league.clubs.find(c => c.controllerType === 'HUMAN');
  const auction = { pool: createAuctionPool(league.seed), i: 0, history: [], completed: false };
  openLot(auction, league.clubs, league.seed, 1000);
  const state = {
    ...createInitialState(), league, auction,
    draft: { pool: createDraftPool(league.seed), round: 1, mode: 'SIMULTANEOUS', pendingClubIds: [club.id], history: [] },
    retentionEvents: [], specialOffers: [],
    training: new Map(club.roster.slice(0, 2).map(p => [p.id, null])),
    growth: club.roster.map(player => ({ player, changes: [] })),
    match: simulateRemainingSeason(structuredClone(league)).humanMatches[0]
  };
  globalThis.localStorage = { getItem: () => null };
  try {
    harness.setRoom({ roomId: 'LOCAL', players: [], phase: 'lobby' });
    harness.setState(state);
    const expected = ['title','setup','draft','auction','table','stats','squad','seasonResults','matchDetail','home','offseasonEvents','development','focus','growth','release','history','grandFinal','loadTitle','savePanel','roomEntry','roomLobby'];
    assert.deepEqual(Object.keys(harness.screens).sort(), expected.sort());
    for (const view of expected) {
      state.view = view;
      const before = JSON.stringify({ league, auction, draft: state.draft });
      const markup = harness.screens[view]();
      assert.equal(typeof markup, 'string', view);
      assert.match(markup, /<main/, view);
      assert.doesNotMatch(markup, /undefined|NaN/, view);
      assert.equal(JSON.stringify({ league, auction, draft: state.draft }), before, `${view} mutated game state`);
    }
    // A missing lot must no longer be opened as a side effect of drawing.
    delete auction.live;
    state.view = 'auction';
    harness.screens.auction();
    assert.equal(auction.live, undefined);
    state.view = 'home'; league.completed = true; league.season = 10;
    const completed = harness.screens.home();
    assert.equal((completed.match(/data-stage6="history"/g) || []).length, 1);
    harness.returnToTitle();
    assert.equal(harness.getState().league, null);
    assert.equal(harness.getState().rosterOpen, false);
    harness.setState({ ...state, league });
    harness.startAuction();
    assert.ok(harness.getState().auction.live, 'transition opens the first lot');
  } finally {
    delete globalThis.localStorage;
  }
});
