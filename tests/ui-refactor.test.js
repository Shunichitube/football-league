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

test('multiplayer rename is enabled during setup and release, then locked after confirmation',async()=>{
 const rename={dataset:{},disabled:false},release={dataset:{},disabled:false};
 const harness=await screenHarness({queryAll:selector=>selector==='[data-rename-player]'?[rename]:selector==='[data-release-player]'?[release]:[]});
 const {createLeague}=await import('../js/league.js');
 const league=createLeague({name:'改名確認',seed:'rename-ui'});
 const adapter={room:{roomId:'RENAME',phase:'team-setup',players:[],game:{league}},client:{pending:null},status:{busy:false},locked:false,player:null,statusText:()=>'',draftResultText:()=>'',participantStatuses:()=>[]};
 harness.setState({...createInitialState(),mode:'room',league});harness.setAdapter(adapter);
 harness.updateRoomStatus();assert.equal(rename.disabled,false);assert.equal(release.disabled,true);
 adapter.locked=true;harness.updateRoomStatus();assert.equal(rename.disabled,true);
 adapter.locked=false;adapter.room.phase='release';harness.updateRoomStatus();assert.equal(rename.disabled,false);assert.equal(release.disabled,false);
 adapter.room.phase='season-result';harness.updateRoomStatus();assert.equal(rename.disabled,true);
});

// Evaluate the real app's screen functions without publishing test hooks or
// requiring a browser. Only bitmap drawing is substituted; DOM writes fail.
async function screenHarness(controls = {}) {
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
  const document = { querySelector: selector => controls[selector] || (selector === '#app' ? app : null), addEventListener() {}, querySelectorAll: selector => controls.queryAll?.(selector)||[] };
  source = source.replace(/^import .+;\r?\n/gm, '').replace(/render\(\);\s*$/, '');
  return runInNewContext(source + `\n({ screens, setState: value => s=value, getState: () => s, setRoom: room => roomAdapter.client.room=room, setAdapter: value=>roomAdapter=value, updateRoomStatus, startAuction, returnToTitle,
    click: (key,value) => {render=()=>{};const event={target:{matches:()=>false,closest:selector=>selector==='[data-'+key+']'?{dataset:{[key.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]:value}}:null}};for(const {scope,handler} of clickHandlers)if(scope==='app')handler(event);},
    tick: now => {const previous=Date.now;Date.now=()=>now;try{updateAuction();}finally{Date.now=previous;}}
  })`, {
    ...bindings, Date: class extends Date { static now(){return controls.now??super.now();} }, createBgmController: () => ({sync() {},dispose() {}}), createGameExperience: () => ({reset() {}, syncGrowth() {}}), document, addEventListener() {}, configureRename() {}, dialogs: null
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


for(const [mode,limit,control] of [['SHORT',5,'#short-season'],['TWENTY',10,'#twenty-season']]) test(`${mode} final training leads to the ${limit}-season ending`, async()=>{
 const controls={'#name':{value:'短縮クラブ'},'#seed':{value:'short-ui'},[control]:{checked:true}};
 const harness=await screenHarness(controls);
 assert.match(harness.screens.setup(),/1シーズンで2年経過し、契約の残り年数も2年減ります/);
 harness.click('a','start');const state=harness.getState();
 assert.equal(state.league.seasonMode,mode);
 state.league.season=limit;
 harness.click('a','skipDraft');harness.click('a','toAuction');let now=Date.now();
 for(let guard=0;!state.auction.completed&&guard<100;guard++){now+=60000;harness.tick(now);}
 harness.click('a','season');
 assert.match(harness.screens.seasonResults(),/最後の育成・最終表彰へ/);
 harness.click('stage4','offseason');
 for(const p of state.league.clubs[0].roster.filter(p=>p.contractYears<=0))harness.click('renew',p.id);
 for(const event of [...state.retentionEvents])harness.click('retention-pay',event.playerId);
 for(const offer of [...state.specialOffers])harness.click('special-skip',offer.playerId);
 harness.click('stage4','eventsDone');
 const players=state.league.clubs[0].roster.slice(0,2),age=players[0].age;
 for(const p of players){harness.click('train',p.id);controls[`[data-focus="${p.id}"]`]={value:p.primaryPosition==='GK'?'gk':'pass'};}
 harness.click('stage4','confirm');harness.click('stage4','grow');
 assert.equal(players[0].age,age+2);assert.equal(state.finalYearProcessed,true);
 const html=harness.screens.growth();assert.match(html,/data-ending="start"/);
 state.mode='room';assert.doesNotMatch(harness.screens.growth(),/data-ending="start"/);state.mode=undefined;
 harness.click('ending','start');assert.equal(state.view,'grandFinal');
 assert.match(harness.screens.grandFinal(),new RegExp(`${limit}シーズンの総合結果`));
});

test('single player real actions complete a white-club season and proceed to year two', async()=>{
 const controls={'#name':{value:'白いクラブ'},'#seed':{value:'single-ui-flow'}};
 const harness=await screenHarness(controls);
 assert.doesNotMatch(harness.screens.setup(),/チームカラー|id="color"/);
 harness.click('a','start');let state=harness.getState();
 assert.equal(state.view,'draft');assert.equal(state.league.clubs[0].color,'#ffffff');
 harness.click('a','skipDraft');assert.equal(state.draft.completed,true);
 harness.click('a','toAuction');let now=Date.now();
 for(let guard=0;!state.auction.completed&&guard<100;guard++){now+=60000;harness.tick(now);}
 assert.equal(state.auction.completed,true);
 harness.click('a','squad');assert.equal(state.view,'squad');
 harness.click('a','season');assert.equal(state.view,'seasonResults');
 assert.equal(state.league.fixtureResults.length,30);assert.equal(state.league.seasonResults.length,10);
 harness.click('a','season');assert.equal(state.league.fixtureResults.length,30);
 harness.click('stage4','offseason');assert.equal(state.view,'offseasonEvents');
 for(const p of state.league.clubs[0].roster.filter(p=>p.contractYears<=0))harness.click('renew',p.id);
 for(const event of [...state.retentionEvents])harness.click('retention-pay',event.playerId);
 for(const offer of [...state.specialOffers])harness.click('special-skip',offer.playerId);
 harness.click('stage4','eventsDone');assert.equal(state.view,'development');
 for(const p of state.league.clubs[0].roster.slice(0,2)){harness.click('train',p.id);controls[`[data-focus="${p.id}"]`]={value:p.primaryPosition==='GK'?'gk':'pass'};}
 harness.click('stage4','confirm');assert.equal(state.view,'focus');
 harness.click('stage4','grow');assert.equal(state.view,'growth');
 assert.equal(state.growth.length,state.league.clubs[0].roster.length);
 const {exportSave,importSave}=await import('../js/storage.js');
 assert.equal(importSave(exportSave({league:state.league})).league.season,1);
 harness.click('stage4','releasePhase');assert.equal(state.view,'release');
 harness.click('stage4','releaseDone');assert.equal(state.view,'draft');assert.equal(state.league.season,2);
 assert.equal(state.league.clubs[0].color,'#ffffff');
});

test('auction markup starts at the real remaining time on each rerender, including server offset',async()=>{
 const controls={now:1000},harness=await screenHarness(controls);
 const {createLeague}=await import('../js/league.js');
 const {createAuctionPool}=await import('../js/market.js');
 const {openLot}=await import('../js/live-auction.js');
 const league=createLeague({name:'時計確認',seed:'clock-render'}),auction={pool:createAuctionPool('clock-render'),i:0,history:[],completed:false};
 openLot(auction,league.clubs,league.seed,1000);
 const state={...createInitialState(),league,auction,view:'auction'};harness.setState(state);
 harness.setAdapter({clockOffset:2000,statusText:()=>'',draftResultText:()=>'',participantStatuses:()=>[],status:{},client:{pending:null},room:{players:[]}});
 const clock=()=>harness.screens.auction().match(/data-auction-time>([^<]+)/)[1];
 controls.now=22000;assert.equal(clock(),'0:09');assert.equal(clock(),'0:09');
 state.mode='room';assert.equal(clock(),'0:07');
 controls.now=24000;assert.equal(clock(),'0:05');assert.match(harness.screens.auction(),/auction-timer urgent/);
 controls.now=28000;assert.equal(clock(),'0:01');
 auction.live.endAt=controls.now+2000+5000;assert.equal(clock(),'0:05');
 auction.live.closed=true;assert.equal(clock(),'0:00');
});
