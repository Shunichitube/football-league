import { addPlayer, cpuBid } from './market.js';

export const MINIMUM_BID = 5;

export function nextBid(lot) { return lot.highBid ? lot.highBid + 1 : lot.minimum; }

export function createLot(clubs, player, rng, now = performance.now()) {
  const limits = Object.fromEntries(clubs.filter(club => club.controllerType === 'CPU').map(club => [club.id, Math.max(0, cpuBid(club, player, rng))]));
  return { minimum: MINIMUM_BID, highBid: 0, leaderId: null, offers: {}, passed: [], limits, deadline: now + 30000, lastCpuAction: now, closed: false };
}

export function placeBid(lot, club, now = performance.now()) {
  const price = nextBid(lot);
  if (lot.closed || now >= lot.deadline || lot.passed.includes(club.id) || lot.leaderId === club.id || club.roster.length >= 12 || price > club.funds) return false;
  lot.highBid = price;
  lot.leaderId = club.id;
  lot.offers[club.id] = price;
  if (lot.deadline - now <= 5000) lot.deadline = now + 5000;
  return true;
}

export function passLot(lot, clubId) {
  if (lot.closed || lot.leaderId === clubId || lot.passed.includes(clubId)) return false;
  lot.passed.push(clubId);
  return true;
}

export function settleLot(lot, clubs, player) {
  if (lot.closed) return null;
  lot.closed = true;
  const winner = clubs.find(club => club.id === lot.leaderId);
  return winner && addPlayer(winner, player, lot.highBid) ? winner : null;
}
