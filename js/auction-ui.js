import { pixelTexture } from './arena-characters.js';
import { minimumAuctionBid } from './live-auction.js';
const avatars=new Map();
const venueSprites=new Map();
function venueSprite(color,index,appearance='man'){
  const key=`${color}:${index}:${appearance}`;
  if(!venueSprites.has(key))venueSprites.set(key,pixelTexture(color,index,appearance).toDataURL());
  return venueSprites.get(key);
}
function auctionVenueCharacters(clubs){
  const colors=['#60a5fa','#fbbf24','#4ade80','#f472b6','#a78bfa','#e2e8f0'];
  const audience=Array.from({length:200},(_,i)=>{
    const side=Math.floor(i/100),row=Math.floor(i%100/20),col=i%20;
    const tiers=[23.1,25.9,35.1,38.1,41.1];
    return `<img class="auction-spectator" src="${venueSprite(colors[i%6],i,i%4?'man':'woman')}" alt="" style="left:${side?85.2+col*.68:1.2+col*.68}%;top:${tiers[row]+(side?19-col:col)*.32+(row%2)*.12}%">`;
  }).join('');
  const seats=[19,27,35,59,67,75];
  const staff=clubs.slice(0,6).map((club,i)=>[0,1].map(role=>`<img class="auction-staff" src="${venueSprite(role?'#334155':club.color||'#60a5fa',i*2+role+24)}" alt="" style="left:${seats[i]+(role?3.6:1)}%">`).join('')).join('');
  const consoles=[[5,80.5],[15,80.4],[25,80.5],[75,80.5],[85,80.4],[95,80.5]].map(([x,y],i)=>`<span class="auction-console-screen" style="left:${x}%;top:${y}%;--pulse-delay:${i*.43}s"></span>`).join('');
  const operators=[10,29,71,90].map((x,i)=>`<span class="auction-operator" style="left:${x}%;--coat:${i%2?'#0c1829':'#101b2c'}"></span>`).join('');
  return `<div class="auction-crowd" aria-hidden="true">${audience}${['upper-left','upper-right','lower-left','lower-right'].map(part=>`<span class="auction-railing rail-${part}"></span>`).join('')}</div><div class="auction-light-beam beam-left" aria-hidden="true"></div><div class="auction-light-beam beam-right" aria-hidden="true"></div><img class="auction-host" src="${venueSprite('#172e50',71)}" alt="" aria-hidden="true"><span class="auction-podium-front" aria-hidden="true"></span>${staff}<div class="auction-foreground" aria-hidden="true">${consoles}${operators}</div>`;
}
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
  const winner=closed?s.league.clubs.find(c=>c.id===a.history.at(-1)?.winnerClubId):null;
  const award=closed?`<div class="auction-award" role="status" style="--winner:${escape(winner?.color||'#8ab2ce')}"><div class="auction-confetti" aria-hidden="true">${winner?Array.from({length:28},(_,i)=>`<i style="--i:${i};--x:${(i*37)%100}%;--delay:${(i*7)%12/10}s;--drift:${(i-14)*5}px"></i>`).join(''):''}</div><strong>${winner?`${escape(winner.name)}が獲得しました！`:'落札なし・見送り'}</strong><span>${winner?`${lot.high}ptで落札`:'次の選手へ進みます'}</span></div>`:'';
  return `${header}<main class="auction-room"><div class="auction-scene">${auctionVenueCharacters(s.league.clubs)}${winner?'<div class="auction-award-light" aria-hidden="true"></div>':''}<div class="auction-topline"><span>PLAYER AUCTION · ${a.i+1} / ${a.pool.length}</span><div><button data-a="toggleAuctionHistory" class="subtle">落札結果</button><button data-stage10="roster" class="subtle">所属選手</button></div></div><section class="auction-monitor" aria-label="競売選手モニター"><div class="auction-avatar"><span>${escape(p.primaryPosition)}</span><img src="${auctionAvatar(p)}" alt="${escape(p.name)}のアバター"><small>FOOTBALL LEAGUE</small></div><div class="auction-player">${card(p)}<p class="scout-comment">${escape(p.scoutComment||'')}</p></div><aside class="auction-live"><span>残り時間</span><strong class="auction-timer" data-auction-time>0:30</strong><span>${closed?'落札額':opening?'最低落札額':'現在最高額'}</span><strong class="auction-price">${opening?minimum:lot.high}<small> pt</small></strong><div class="auction-leader" style="--club:${escape(leader?.color||'#64748b')}">${leader?escape(leader.name):'入札待ち'}</div><p>${closed?(leader?'落札しました':'入札なし・見送り'):'残り5秒以内の入札で5秒に延長'}</p></aside>${award}</section><section class="auction-controls" aria-label="入札操作"><div><b>資金 ${club.funds}pt</b><span>登録 ${club.roster.length} / 12人</span></div><div class="auction-bid-buttons">${(opening?[0,5,10]:[1,5,10]).map(step=>`<button data-live-bid="${base+step}" ${disabled||club.funds<base+step?'disabled':''}>${base+step}ptで入札 <small>${opening&&step===0?'最低額':`＋${step}`}</small></button>`).join('')}<button data-live-pass class="subtle" ${disabled?'disabled':''}>この選手を辞退</button></div><p role="status">${closed?'4秒後に次の選手へ進みます':lot?.leader===club.id?'あなたのクラブが最高入札中です':lot?.passed.includes(club.id)?'この選手の入札を辞退しました':club.roster.length>=12?'登録人数が上限に達しています':'最高額を超える金額で何度でも入札できます'}</p></section><section class="auction-desks" aria-label="各クラブの入札">${s.league.clubs.map(c=>`<article style="--club:${escape(c.color)}" class="${c.id===lot?.leader?'leading':''}"><b>${escape(c.name)}</b><strong>${lot?.passed.includes(c.id)?'辞退':lot?.bids[c.id]?`${lot.bids[c.id]} pt`:'—'}</strong></article>`).join('')}</section></div></main>`;
}
