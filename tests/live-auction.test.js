import test from 'node:test';
import assert from 'node:assert/strict';
import { createLot, nextBid, passLot, placeBid, settleLot } from '../js/live-auction.js';

test('minimum, one point increments, repeated bids, and five second extension', () => {
  const clubs=[{id:1,funds:20,roster:[],controllerType:'HUMAN'},{id:2,funds:20,roster:[],controllerType:'HUMAN'}];
  const lot=createLot(clubs,{id:10},{next:()=>0},0);
  assert.equal(nextBid(lot),5);
  assert.equal(placeBid(lot,clubs[0],1000),true);
  assert.equal(nextBid(lot),6);
  assert.equal(placeBid(lot,clubs[0],2000),false);
  assert.equal(placeBid(lot,clubs[1],26000),true);
  assert.equal(lot.deadline,31000);
  assert.equal(placeBid(lot,clubs[0],29000),true);
  assert.equal(lot.deadline,34000);
  assert.equal(lot.offers[1],7);
  const winner=settleLot(lot,clubs,{id:10});
  assert.equal(winner.id,1);
  assert.equal(clubs[0].funds,13);
  assert.equal(settleLot(lot,clubs,{id:10}),null);
});

test('pass prevents reentry and funds limit prevents a bid', () => {
  const clubs=[{id:1,funds:4,roster:[],controllerType:'HUMAN'},{id:2,funds:5,roster:[],controllerType:'HUMAN'}];
  const lot=createLot(clubs,{id:20},{next:()=>0},0);
  assert.equal(placeBid(lot,clubs[0],100),false);
  assert.equal(placeBid(lot,clubs[1],100),true);
  assert.equal(passLot(lot,clubs[0].id),true);
  clubs[0].funds=10;
  assert.equal(placeBid(lot,clubs[0],200),false);
  assert.equal(placeBid(lot,clubs[1],30000),false);
});
