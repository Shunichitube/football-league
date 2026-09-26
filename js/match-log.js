// Presentation only: preserve the stored event kinds, order and simulation results.
export function formatMatchEvents(events, clubs, nameOf = name => name) {
  const rows = [], score = { home: 0, away: 0 };
  let lastLeader = null;
  const name = value => nameOf(value || '選手');
  const add = (event, text, goal = false, sideOverride = null) => rows.push({ time: event.time, text, goal, side: sideOverride || event.side || null });
  const attackText = (d, stage) => {
    if (d.longFeed) return `${name(d.passer)}から${name(d.receiver)}へロングフィードが通る`;
    if (d.corner) return `${name(d.passer)}のコーナーキックが${name(d.receiver)}につながる`;
    if (d.type === 'PASS' && d.receiver) return `${name(d.passer)}から${name(d.receiver)}へパスが${stage === 1 ? '通る' : 'つながる'}`;
    if (d.type === 'DRIBBLE') return `${name(d.dribbler)}がドリブルで${stage === 1 ? '持ち上がる' : '守備を突破'}`;
    if (d.passer && d.receiver) return `${name(d.passer)}から${name(d.receiver)}へ。カウンターで前線につなぐ`;
    return '';
  };
  events.forEach((event, index) => {
    const { kind, side } = event, p = name(event.player);
    const d = event.display || {};
    const next = events[index + 1], previous = events[index - 1];
    const toCorner = next?.kind === 'CORNER' && next.time === event.time;
    if (d.stage === 2 && d.shooter) {
      const opposite = value => value === 'home' ? 'away' : value === 'away' ? 'home' : null;
      const attackSide = ['SAVE', 'GK CATCH'].includes(kind)
        ? opposite(side)
        : kind === 'REBOUND' && d.rebound === 'cleared'
          ? opposite(side)
          : side;
      if (d.corner) add(event, `${name(d.passer)}のコーナーキック`, false, attackSide);
      const attack = attackText(d, 2);
      if (attack) add(event, attack, false, attackSide);
      if (d.keeper) add(event, `${name(d.keeper)}も加わり、攻撃を組み立てる`, false, attackSide);
      add(event, `${name(d.shooter)}が${d.corner ? 'コーナーキックから' : ''}シュート`, false, attackSide);
    }
    switch (kind) {
      case 'STAGE 1 SUCCESS':
        add(event, attackText(d, 1) || `${p}が攻撃をつなぐ`);
        if (d.keeper) add(event, `${name(d.keeper)}も加わり、攻撃を組み立てる`);
        break;
      case 'DEFENSIVE STOP':
        if (next?.kind === 'LONG FEED FAIL' && next.time === event.time) break;
        if (d.corner) add(event, `${name(d.passer)}のコーナーキック`);
        add(event, d.type === 'PASS' && d.receiver
          ? `${p}が${name(d.passer)}から${name(d.receiver)}へのパスをカット`
          : d.type === 'DRIBBLE' ? `${p}が${name(d.dribbler)}のドリブルを止める`
          : d.type?.includes('COUNTER') ? `${p}がカウンターを止める`
          : `${p}が攻撃を止める`);
        break;
      case 'SHORT COUNTER': add(event, `${p}がボールを奪い、そのままカウンター`); break;
      case 'LONG FEED': add(event, `${p}が前線へロングフィード`); break;
      case 'LONG FEED FAIL': add(event, `${name(d.passer)}のロングフィードを${p}が止める`); break;
      case 'POWER PLAY': add(event, `GK${p}が攻撃参加。パワープレー`); break;
      case 'POWER PLAY RISK': add(event, 'パワープレーを止められる。GKの戻りが遅れている'); break;
      case 'POWER PLAY RISK TRIGGERED': add(event, `GK${p}が戻り切れず、守備が不安定になる`); break;
      case 'POWER PLAY RISK CLEARED': add(event, `${p}がゴールへ戻り、守備体勢が整う`); break;
      case 'GOAL': {
        const other = side === 'home' ? 'away' : 'home';
        const before = score[side] - score[other];
        if (side === 'home' || side === 'away') score[side]++;
        const after = score[side] - score[other], club = clubs[side]?.name || '';
        let situation = '';
        if (after === 0) situation = `${club}が同点に追いついた`;
        else if (before <= 0 && after > 0 && score.home + score.away > 1)
          situation = `${club}が${lastLeader === other ? '逆転' : 'リード'}`;
        if (after !== 0 && (side === 'home' || side === 'away')) lastLeader = after > 0 ? side : other;
        const assist = d.assist;
        add(event, `${score.home}－${score.away}　${p}がゴール${situation ? '　' + situation : ''}${assist ? '　アシスト：' + name(assist) : ''}`, true);
        break;
      }
      case 'GK CATCH':
      case 'SAVE': {
        const shooter = name(d.shooter);
        add(event, kind === 'GK CATCH' ? `${p}が${shooter}のシュートをキャッチ`
          : toCorner ? `${p}が${shooter}のシュートを弾き出し、コーナーキック`
          : `${p}が${shooter}のシュートをセーブ`);
        break;
      }
      case 'MISS': add(event, `${p}のシュートは枠を外れる`); break;
      case 'REBOUND':
        add(event, toCorner ? 'こぼれ球がゴールラインを割り、コーナーキック'
          : d.rebound === 'attack' ? `こぼれ球を${p}が拾う` : `${p}がこぼれ球を処理`);
        break;
      case 'CORNER':
        if (!previous || previous.time !== event.time || !['SAVE', 'REBOUND'].includes(previous.kind)) add(event, 'コーナーキック');
        break;
      default: add(event, `${p}がプレーに関わる`);
    }
  });
  rows.push({
    time: events.at(-1)?.time || '40:00',
    text: `試合終了　${clubs.home?.name || 'HOME'}　${score.home}－${score.away}　${clubs.away?.name || 'AWAY'}`,
    goal: false,
    side: null
  });
  return rows;
}

