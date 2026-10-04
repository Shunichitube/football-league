// Slot order is serialized with the lineup. Missing formation means legacy 121.
export const FORMATIONS = Object.freeze({
  '121': { slots: ['GK','DF','MF','MF','FW'], labels: ['GK','DF1','MF1','MF2','FW1'], points: [[52,85],[32,67],[27,38],[75,60],[56,16]], labelSides: ['right','left','right','left','right'], attackSupport: .05, defenseSupport: .10 },
  '211': { slots: ['GK','DF','DF','MF','FW'], labels: ['GK','DF1','DF2','MF1','FW1'], points: [[52,85],[32,66],[76,62],[44,40],[58,17]], labelSides: ['right','left','left','right','right'], attackSupport: 0, defenseSupport: .15 },
  '112': { slots: ['GK','DF','MF','FW','FW'], labels: ['GK','DF1','MF1','FW2','FW1'], points: [[52,85],[32,67],[45,45],[31,21],[75,18]], labelSides: ['right','left','right','left','left'], attackSupport: .10, defenseSupport: .05 }
});
export const formationId = club => typeof club?.formation === 'string' && Object.hasOwn(FORMATIONS, club.formation) ? club.formation : '121';
export const formationSpec = club => FORMATIONS[formationId(club)];
export const lineupSlots = club => formationSpec(club).slots;
export const lineupSlotLabel = (club, index) => formationSpec(club).labels[index];
// Canonical identities: GK, DF1, original MF1, original MF2, FW1.
const CANONICAL_ORDER = { '121': [0,1,2,3,4], '211': [0,1,3,2,4], '112': [0,1,3,2,4] };
export function remapFormation(lineup, from, to) {
  const source = CANONICAL_ORDER[from] || CANONICAL_ORDER['121'];
  const target = CANONICAL_ORDER[to];
  if (!target || !Array.isArray(lineup)) return null;
  return target.map(identity => lineup[source.indexOf(identity)]);
}
