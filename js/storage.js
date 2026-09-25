const KEY = 'football-league:slot:';
const SAVE_VERSION = 2;

function parseSave(raw) {
  if (!raw) return null;
  const data = JSON.parse(raw);
  if (data?.version !== SAVE_VERSION || !data?.state?.league) throw new Error('このセーブデータは現在のバージョンでは読み込めません。');
  return data;
}

export function saveSlot(slot, state) {
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) throw new Error('Invalid save slot');
  localStorage.setItem(`${KEY}${slot}`, JSON.stringify({ version: SAVE_VERSION, savedAt: new Date().toISOString(), state }));
}

export function slotInfo(slot) {
  const raw = localStorage.getItem(`${KEY}${slot}`);
  if (!raw) return null;
  try {
    const data = parseSave(raw);
    const league = data.state.league;
    const club = league.clubs?.find(candidate => candidate.id === league.humanClubId) || league.clubs?.find(candidate => candidate.controllerType === 'HUMAN');
    return { savedAt: data.savedAt, clubName: club?.name || 'クラブ', season: league.season, completed: Boolean(league.completed), incompatible: false };
  } catch {
    const data = JSON.parse(raw);
    return { savedAt: data?.savedAt || null, clubName: '旧セーブデータ', season: null, completed: false, incompatible: true };
  }
}

export function loadSlot(slot) {
  const raw = localStorage.getItem(`${KEY}${slot}`);
  if (!raw) return null;
  return parseSave(raw).state;
}

export function exportSave(state) {
  return JSON.stringify({ version: SAVE_VERSION, exportedAt: new Date().toISOString(), state }, null, 2);
}

export function importSave(text) {
  return parseSave(text).state;
}
