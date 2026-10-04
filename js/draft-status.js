export function draftTurnState(draft, clubs, ownClubId, submitted = false, sending = false) {
  const pending = draft.pendingClubIds || [];
  const simultaneous = draft.mode === 'SIMULTANEOUS';
  const canPick = pending.includes(ownClubId) && !submitted;
  const currentId = simultaneous ? null : pending[0];
  const current = clubs.find(club => club.id === currentId);
  let message;
  if (sending) message = '指名を送信しています';
  else if (simultaneous) message = submitted || !canPick ? '他のクラブの指名を待っています' : '選手を指名してください';
  else if (canPick) message = 'あなたの番です';
  else message = current ? `${current.name}${current.name.endsWith('クラブ') ? '' : 'クラブ'}が指名中` : '次の指名を準備しています';
  const ids = simultaneous ? clubs.map(club => club.id) : draft.order || pending;
  const order = ids.map((id, index) => {
    const club = clubs.find(club => club.id === id);
    if (!club) return null;
    const acquired = draft.history?.some(row => row.round === draft.round && row.clubId === id);
    const declined = draft.declined?.includes(id) || draft.humanDeclined && id === ownClubId;
    const completed = acquired || id === ownClubId && submitted || !simultaneous && index < (draft.orderIndex || 0);
    const unavailable = declined || club.funds < 5 || club.roster.length >= 12;
    const active = pending.includes(id) && !completed && !unavailable;
    return { id, name: club.name, number: index + 1, self: id === ownClubId, state: completed ? 'done' : unavailable ? 'skipped' : active ? 'active' : 'waiting', label: completed ? '指名済み' : unavailable ? '辞退・対象外' : active ? simultaneous ? '指名受付中' : '指名中' : '順番待ち' };
  }).filter(Boolean);
  return { round: draft.round, simultaneous, canPick, message, order };
}

export function renderDraftTurn(turn, escape) {
  return `<section class="draft-turn-panel ${turn.canPick ? 'is-your-turn' : 'is-waiting'}" aria-label="ドラフトの手番"><div class="draft-turn-heading"><span class="draft-round-label">第${turn.round} / 4巡</span><strong role="status" aria-live="polite">${escape(turn.message)}</strong><span>${turn.simultaneous ? '同時指名' : '指名順'}</span></div><ol class="draft-pick-order" aria-label="${turn.simultaneous ? '各クラブの指名状況' : '現在の巡目の指名順'}">${turn.order.map(row => `<li class="is-${row.state}${row.self ? ' is-self' : ''}"${row.state === 'active' && !turn.simultaneous ? ' aria-current="step"' : ''}><span class="draft-order-number">${turn.simultaneous ? '●' : row.number}</span><b>${escape(row.name)}${row.self ? '（自分）' : ''}</b><small>${row.label}</small></li>`).join('')}</ol></section>`;
}
