const KEY = 'football-league:slot:';
function normalizeControllers(state) {
  const league=state?.league;
  if(!league?.clubs) return state;
  const legacyHumanId=league.humanClubId ?? league.clubs[0]?.id;
  for(const club of league.clubs) if(!club.controllerType) club.controllerType=club.id===legacyHumanId?'HUMAN':'CPU';
  if(!Array.isArray(league.seasonResults)) league.seasonResults=[];
  return state;
}
export function saveSlot(slot, state) { if (!Number.isInteger(slot) || slot < 1 || slot > 3) throw new Error('Invalid save slot'); localStorage.setItem(`${KEY}${slot}`, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state })); }
export function slotInfo(slot) { const raw=localStorage.getItem(`${KEY}${slot}`); if(!raw) return null; const data=JSON.parse(raw); const league=data?.state?.league; if(!league) return null; const club=league.clubs?.find(candidate=>candidate.id===league.humanClubId)||league.clubs?.find(candidate=>candidate.controllerType==='HUMAN'); return { savedAt:data.savedAt, clubName:club?.name||'クラブ', season:league.season, completed:Boolean(league.completed) }; }
export function loadSlot(slot) { const raw=localStorage.getItem(`${KEY}${slot}`); if(!raw) return null; const data=JSON.parse(raw); if(!data?.state?.league) throw new Error('Invalid save data'); return normalizeControllers(data.state); }
export function exportSave(state) { return JSON.stringify({ version:1, exportedAt:new Date().toISOString(), state }, null, 2); }
export function importSave(text) { const data=JSON.parse(text); if(!data?.state?.league || data.version!==1) throw new Error('このセーブデータは読み込めません。'); return normalizeControllers(data.state); }
