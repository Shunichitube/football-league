export function draftTurnState(draft, clubs, ownClubId, submitted = false, sending = false) {
  const pending = draft.pendingClubIds || [];
  const simultaneous = draft.mode === 'SIMULTANEOUS';
  const canPick = pending.includes(ownClubId) && !submitted && !sending;
  const currentId = simultaneous ? null : pending[0];
  const current = clubs.find(club => club.id === currentId);
  let message;
  if (sending) message = '指名を送信しています';
  else if (simultaneous) message = canPick ? 'あなたの番です' : '他のクラブが指名中';
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
  const hint = sending ? '送信結果を確認しています。' : canPick ? '選手を選んで「決定」を押してください。' : simultaneous ? '他のクラブの指名を待っています。' : 'あなたの指名順までお待ちください。';
  return { round: draft.round, simultaneous, canPick, message, order, hint, currentNumber: simultaneous ? null : order.find(row => row.id === currentId)?.number };
}

export function renderDraftTurn(turn, escape) {
  return `<section class="draft-turn-current ${turn.canPick ? 'is-your-turn' : 'is-waiting'}" role="dialog" aria-modal="false" aria-label="ドラフトの手番"><strong role="status" aria-live="polite">${escape(turn.message)}</strong><p>${escape(turn.hint)}</p></section><section class="draft-turn-reception" aria-label="指名受付状況"><span class="draft-turn-caption">第${turn.round} / 4巡 · ${turn.simultaneous ? '同時指名' : `指名順 ${turn.currentNumber || '—'} / ${turn.order.length}`}</span><ol class="draft-reception-list">${turn.order.map(row => `<li${row.state === 'active' && !turn.simultaneous ? ' aria-current="step"' : ''}><b>${escape(row.name)}${row.self ? '（自分）' : ''}</b><span>${row.label}</span></li>`).join('')}</ol></section>`;
}
