// Pure, repeatable scoring. Total Pt is separate from club funds.
export const RANK_POINTS = [10, 7, 5, 3, 1, 0];
export const CAREER_AWARDS = [
  ['得点王', 'goals', '得点'], ['セーブ王', 'saves', 'セーブ'],
  ['アシスト王', 'assists', 'アシスト'], ['守備王', 'defensiveStops', '守備成功'],
  ['突破王', 'breakthroughs', '突破成功']
];
const n = value => Number(value) || 0;
const equalScore = (a, b) => Math.abs(a.total - b.total) < 1e-8 && a.championships === b.championships && a.matchPoints === b.matchPoints;
export function grandResults(league) {
  const history = [...(league.history || [])].sort((a,b) => a.season-b.season);
  const rows = league.clubs.map(club => ({club, leaguePt:0, mvpPt:0, top5Pt:0, bonusPt:0, championships:0, matchPoints:0, maxStreak:0, seasons:[]}));
  const byClub = new Map(rows.map(row => [String(row.club.id), row]));
  for (const entry of history) for (const table of entry.table || []) {
    const row = byClub.get(String(table.clubId)); if (!row) continue;
    const leaguePt = RANK_POINTS[table.rank-1] || 0;
    const mvpPt = entry.mvpClubId === table.clubId ? 3 : 0;
    const top5Pt = (entry.best5 || []).filter(p => p.clubId === table.clubId).length;
    row.leaguePt += leaguePt; row.mvpPt += mvpPt; row.top5Pt += top5Pt;
    row.championships += table.rank === 1 ? 1 : 0; row.matchPoints += n(table.points);
    row.seasons.push({season:entry.season,rank:table.rank,leaguePt,mvpPt,top5Pt,total:leaguePt+mvpPt+top5Pt});
  }
  const records = new Map((league.careerRecords || []).map(p => [p.id, p]));
  for (const club of league.clubs) for (const p of club.roster) records.set(p.id, {...records.get(p.id), ...p});
  const awards = CAREER_AWARDS.map(([title,key,unit]) => {
    const max = Math.max(0,...[...records.values()].map(p => n(p.career?.[key])));
    const winners = max > 0 ? [...records.values()].filter(p => n(p.career?.[key]) === max).map(player => {
      const contributions = Object.entries(player.clubCareer || {}).map(([id,stats]) => ({id,value:n(stats[key])})).filter(c => c.value > 0 && byClub.has(c.id));
      let tracked = contributions.reduce((sum,c) => sum+c.value,0);
      // A career entirely tracked at one club has unambiguous ownership, even in old saves.
      const owned = Object.entries(player.clubCareer || {}).filter(([,stats]) => n(stats.appearances)>0);
      if (!tracked && owned.length===1 && n(owned[0][1].appearances)===n(player.career?.appearances) && byClub.has(owned[0][0])) {
        contributions.push({id:owned[0][0],value:max}); tracked=max;
      }
      // Older saves did not track saves/defensive stops per club. Do not invent ownership.
      const complete = Math.abs(tracked-max) < 1e-8;
      const shares = complete ? contributions.map(c => ({club:byClub.get(c.id).club,pt:5*c.value/max})) : [];
      for (const share of shares) byClub.get(String(share.club.id)).bonusPt += share.pt;
      return {player,value:max,shares,incomplete:!complete};
    }) : [];
    return {title,key,unit,winners};
  });
  for (const row of rows) {
    let streak = 0;
    for (const entry of history) {
      if (!entry.fixtures) { row.maxStreak=Math.max(row.maxStreak,n(entry.table?.find(t=>t.clubId===row.club.id)?.maxWinStreak)); streak=0; continue; }
      for (const match of entry.fixtures) {
        if (match.homeId!==row.club.id && match.awayId!==row.club.id) continue;
        const won = match.homeId===row.club.id ? match.homeGoals>match.awayGoals : match.awayGoals>match.homeGoals;
        streak=won ? streak+1 : 0; row.maxStreak=Math.max(row.maxStreak,streak);
      }
    }
  }
  const maxStreak=Math.max(0,...rows.map(row=>row.maxStreak));
  const streakWinners=maxStreak>0 ? rows.filter(row=>row.maxStreak===maxStreak) : [];
  for (const row of streakWinners) row.bonusPt+=5;
  awards.push({title:'最大連勝',unit:'連勝',winners:streakWinners.map(row=>({club:row.club,value:maxStreak,shares:[{club:row.club,pt:5}]}))});
  for (const row of rows) row.total=row.leaguePt+row.mvpPt+row.top5Pt+row.bonusPt;
  rows.sort((a,b)=> Math.abs(b.total-a.total)>1e-8 ? b.total-a.total : b.championships-a.championships || b.matchPoints-a.matchPoints);
  rows.forEach((row,i)=>row.rank=i>0&&equalScore(row,rows[i-1]) ? rows[i-1].rank : i+1);
  return {rows,awards,winners:rows.filter(row=>row.rank===1),history};
}
export const formatPt = value => Number(value.toFixed(2)).toLocaleString('ja-JP', {maximumFractionDigits:2});
