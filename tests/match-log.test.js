import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMatchEvents } from '../js/match-log.js';
const clubs = { home: { name: 'ホーム' }, away: { name: 'アウェー' } };
const event = (kind, display = {}, extra = '', side = 'home', player = '鈴木') => ({ time: '01:00', kind, player, extra, side, display });
const goals = sides => formatMatchEvents(sides.map(side => event('GOAL', { assist: '中村' }, '', side)), clubs);

test('goals show the score first, equalizer, comeback and renewed lead', () => {
  assert.equal(goals(['home'])[0].text, '1－0　鈴木がゴール　アシスト：中村');
  assert.equal(goals(['home', 'away'])[1].text, '1－1　鈴木がゴール　アウェーが同点に追いついた　アシスト：中村');
  assert.equal(goals(['home', 'away', 'away'])[2].text, '1－2　鈴木がゴール　アウェーが逆転　アシスト：中村');
  assert.equal(goals(['home', 'away', 'home'])[2].text, '2－1　鈴木がゴール　ホームがリード　アシスト：中村');
  assert.equal(goals(['away', 'home', 'home'])[2].text, '2－1　鈴木がゴール　ホームが逆転　アシスト：中村');
  assert.equal(goals(['home', 'home'])[1].text, '2－0　鈴木がゴール　アシスト：中村');
  assert.equal(formatMatchEvents([event('GOAL')], clubs)[0].text, '1－0　鈴木がゴール');
});

test('pass, corner, shot and save use the recorded participants', () => {
  const rows = formatMatchEvents([
    event('STAGE 1 SUCCESS', { type: 'PASS', passer: '中村', receiver: '鈴木', stage: 1 }),
    event('SAVE', { type: 'PASS', passer: '中村', receiver: '佐藤', shooter: '鈴木', stage: 2, corner: true }, '', 'away', '田中'),
    event('CORNER')
  ], clubs);
  assert.deepEqual(rows.map(row => row.text), [
    '中村から鈴木へパスが通る', '中村のコーナーキック',
    '中村のコーナーキックが佐藤につながる', '鈴木がコーナーキックからシュート',
    '田中が鈴木のシュートを弾き出し、コーナーキック'
  ]);
  assert.ok(rows.every(row => !row.goal && !row.text.includes('！')));
});

test('all remaining kinds are plain Japanese and only goals are highlighted', () => {
  const kinds = ['DEFENSIVE STOP', 'SHORT COUNTER', 'LONG FEED', 'LONG FEED FAIL', 'POWER PLAY',
    'POWER PLAY RISK', 'POWER PLAY RISK TRIGGERED', 'POWER PLAY RISK CLEARED', 'GK CATCH', 'MISS', 'REBOUND', 'GOAL'];
  const input = kinds.map(kind => event(kind, { type: 'DRIBBLE', dribbler: '中村', passer: '田中', shooter: '佐藤' }));
  const snapshot = structuredClone(input);
  const rows = formatMatchEvents(input, clubs);
  assert.deepEqual(input, snapshot);
  assert.equal(rows.filter(row => row.goal).length, 1);
  assert.ok(rows.every(row => !/[A-Z！!]/.test(row.text.replaceAll('GK', ''))));
  assert.ok(rows.some(row => row.text === '鈴木が中村のドリブルを止める'));
});

test('legacy saves and renamed participants remain readable', () => {
  const rows = formatMatchEvents([
    { time: '01:00', kind: 'STAGE 1 SUCCESS', player: '中村', extra: 'PASS → PASS / 中村→鈴木', side: 'home' },
    { time: '02:00', kind: 'GOAL', player: '鈴木', extra: 'PASS / CLEAR / 中村→鈴木 / Assist 中村', side: 'home' }
  ], clubs, name => name === '中村' ? '高橋' : name);
  assert.equal(rows[0].text, '高橋から鈴木へパスが通る');
  assert.equal(rows[1].text, '1－0　鈴木がゴール　アシスト：高橋');
});
