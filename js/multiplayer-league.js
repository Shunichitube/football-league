import { createClub } from './data.js?v=0.17.2';
import { createSchedule } from './league.js?v=0.17.2';
import { createRandom } from './random.js';

const DEFAULT_COLORS = ['#4ade80', '#60a5fa', '#facc15', '#fb7185', '#a78bfa', '#f97316'];
const blankRecord = () => ({ played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });

function normalizeRoom(room) {
  return room?.room || room;
}

function orderedClubSlots(room) {
  const source = normalizeRoom(room);
  const clubs = Array.isArray(source?.clubs) ? source.clubs : [];
  return clubs.slice(0, 6).map((club, index) => ({
    id: index + 1,
    name: String(club.name || `COM${index + 1}`).trim() || `COM${index + 1}`,
    color: club.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    controllerType: club.controller === 'HUMAN' || club.playerId ? 'HUMAN' : 'CPU',
    playerId: club.playerId || null
  }));
}

function fillToSix(slots) {
  const result = [...slots];
  let comNumber = 1;
  while (result.length < 6) {
    result.push({
      id: result.length + 1,
      name: `COM${comNumber++}`,
      color: DEFAULT_COLORS[result.length % DEFAULT_COLORS.length],
      controllerType: 'CPU',
      playerId: null
    });
  }
  return result;
}

export function createMultiplayerLeagueFromRoom(room, seed = `multiplayer-${Date.now()}`) {
  const source = normalizeRoom(room);
  const rng = createRandom(`${seed}:multiplayer:clubs`);
  const slots = fillToSix(orderedClubSlots(source));
  const clubs = slots.map(slot => {
    const club = createClub({
      id: slot.id,
      name: slot.name,
      color: slot.color,
      seed: rng,
      controllerType: slot.controllerType
    });
    club.multiplayerPlayerId = slot.playerId;
    return club;
  });
  const humanClubId = clubs.find(club => club.controllerType === 'HUMAN')?.id || 1;
  return {
    seed,
    season: 1,
    mode: 'multiplayer',
    roomId: source?.roomId || null,
    history: [],
    careerRecords: [],
    humanClubId,
    clubs,
    schedule: createSchedule(clubs.map(club => club.id)),
    currentRound: 1,
    records: Object.fromEntries(clubs.map(club => [club.id, blankRecord()])),
    seasonResults: [],
    fixtureResults: [],
    releasedPlayers: [],
    completed: false
  };
}
