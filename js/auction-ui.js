import { pixelTexture } from './arena-characters.js';
import { minimumAuctionBid } from './live-auction.js';
const avatars=new Map();
export function auctionAvatar(player){
  const key=player.avatarIndex??String(player.id).split('').reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7);
  if(!avatars.has(key))avatars.set(key,pixelTexture('#60a5fa',key%80).toDataURL());
  return avatars.get(key);
}
export function renderLiveAuction(s,club,card,escape,header){
  const a=s.auction,p=a.pool[a.i],lot=a.live;
  if(a.completed||!p)return `${header}<main class="auction-room"><section class="auction-monitor auction-complete"><h2>オークション完了</h2><p>全選手の競売が終了しました。</p><button data-a="toggleAuctionHistory" class="subtle">結果を見る</button><button data-a="squad">編成画面へ</button></section></main>`;
  const leader=s.league.clubs.find(c=>c.id===lot?.leader),closed=lot?.closed;
  const disabled=closed||club.roster.length>=12||lot?.passed.includes(club.id)||lot?.leader===club.id;
  const minimum=lot?.minimum??minimumAuctionBid(p),opening=!lot?.leader,base=opening?minimum:lot.high;
  return `${header}<main class="auction-room"><div class="auction-scene"><div class="auction-topline"><span>PLAYER AUCTION · ${a.i+1} / ${a.pool.length}</span><div><button data-a="toggleAuctionHistory" class="subtle">落札結果</button><button data-stage10="roster" class="subtle">所属選手</button></div></div><section class="auction-monitor" aria-label="競売選手モニター"><div class="auction-avatar"><span>${escape(p.primaryPosition)}</span><img src="${auctionAvatar(p)}" alt="${escape(p.name)}のアバター"><small>FOOTBALL LEAGUE</small></div><div class="auction-player">${card(p)}<p class="scout-comment">${escape(p.scoutComment||'')}</p></div><aside class="auction-live"><span>残り時間</span><strong class="auction-timer" data-auction-time>0:30</strong><span>${closed?'落札額':opening?'最低落札額':'現在最高額'}</span><strong class="auction-price">${opening?minimum:lot.high}<small> pt</small></strong><div class="auction-leader" style="--club:${escape(leader?.color||'#64748b')}">${leader?escape(leader.name):'入札待ち'}</div><p>${closed?(leader?'落札しました':'入札なし・見送り'):'残り5秒以内の入札で5秒に延長'}</p></aside></section><section class="auction-controls" aria-label="入札操作"><div><b>資金 ${club.funds}pt</b><span>登録 ${club.roster.length} / 12人</span></div><div class="auction-bid-buttons">${(opening?[0,5,10]:[1,5,10]).map(step=>`<button data-live-bid="${base+step}" ${disabled||club.funds<base+step?'disabled':''}>${base+step}ptで入札 <small>${opening&&step===0?'最低額':`＋${step}`}</small></button>`).join('')}<button data-live-pass class="subtle" ${disabled?'disabled':''}>この選手を辞退</button></div><p role="status">${closed?'4秒後に次の選手へ進みます':lot?.leader===club.id?'あなたのクラブが最高入札中です':lot?.passed.includes(club.id)?'この選手の入札を辞退しました':club.roster.length>=12?'登録人数が上限に達しています':'最高額を超える金額で何度でも入札できます'}</p></section><section class="auction-desks" aria-label="各クラブの入札">${s.league.clubs.map(c=>`<article style="--club:${escape(c.color)}" class="${c.id===lot?.leader?'leading':''}"><b>${escape(c.name)}</b><strong>${lot?.passed.includes(c.id)?'辞退':lot?.bids[c.id]?`${lot.bids[c.id]} pt`:'—'}</strong></article>`).join('')}</section></div></main>`;
}
