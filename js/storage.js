const KEY = 'football-league:slot:';
export function saveSlot(slot, state) { if (!Number.isInteger(slot) || slot < 1 || slot > 3) throw new Error('Invalid save slot'); localStorage.setItem(`${KEY}${slot}`, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state })); }
export function loadSlot(slot) { const raw=localStorage.getItem(`${KEY}${slot}`); if(!raw) return null; const data=JSON.parse(raw); if(!data?.state?.league) throw new Error('Invalid save data'); return data.state; }
export function exportSave(state) { return JSON.stringify({ version:1, exportedAt:new Date().toISOString(), state }, null, 2); }
export function importSave(text) { const data=JSON.parse(text); if(!data?.state?.league || data.version!==1) throw new Error('このセーブデータは読み込めません。'); return data.state; }
