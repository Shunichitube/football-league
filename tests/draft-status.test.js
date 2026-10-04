import test from 'node:test';
import assert from 'node:assert/strict';
import { draftTurnState, renderDraftTurn } from '../js/draft-status.js';
import { escapeHtml } from '../js/ui.js';

const clubs = [
  { id: 'a', name: '東京', funds: 20, roster: [] },
  { id: 'b', name: '大阪クラブ', funds: 20, roster: [] },
  { id: 'c', name: '<札幌>', funds: 20, roster: [] }
];

test('simultaneous draft changes from nomination to waiting and back after a lost lottery in the same round', () => {
  const draft = { mode: 'SIMULTANEOUS', round: 1, pendingClubIds: ['a', 'b', 'c'], history: [], declined: [] };
  assert.equal(draftTurnState(draft, clubs, 'a').message, '選手を指名してください');
  const submitted = draftTurnState(draft, clubs, 'a', true);
  assert.equal(submitted.canPick, false);
  assert.equal(submitted.message, '他のクラブの指名を待っています');
  assert.equal(submitted.order[0].state, 'done');
  draft.history.push({ round: 1, clubId: 'b' }); draft.pendingClubIds = ['a', 'c'];
  const retry = draftTurnState(draft, clubs, 'a');
  assert.equal(retry.canPick, true); assert.equal(retry.order[1].state, 'done');
  assert.equal(retry.round, 1);
});

test('ordered draft identifies the active club and shows order, current round and completed picks', () => {
  const draft = { mode: 'ORDERED', round: 2, pendingClubIds: ['b'], order: ['c', 'b', 'a'], orderIndex: 1, history: [] };
  const waiting = draftTurnState(draft, clubs, 'a');
  assert.equal(waiting.message, '大阪クラブが指名中');
  assert.deepEqual(waiting.order.map(row => row.state), ['done', 'active', 'waiting']);
  assert.equal(draftTurnState(draft, clubs, 'b').message, 'あなたの番です');
  const html = renderDraftTurn(waiting, escapeHtml);
  assert.match(html, /第2 \/ 4巡/);
  assert.match(html, /aria-current="step"/);
  assert.match(html, /&lt;札幌&gt;/);
});
