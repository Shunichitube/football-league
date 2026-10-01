import {playerAppearance,kitColor} from './avatar-profile.js?v=appearance-v20';
import { pixelTexture } from './arena-characters.js?v=appearance-v20';
import { minimumAuctionBid } from './live-auction.js';
import { STAGE, AUCTION_SEATS } from './stage-layout.js';
const avatars=new Map();
const venueSprites=new Map();
function venueSprite(color,index,appearance='man'){
  const key=`${color}:${index}:${appearance}`;
  if(!venueSprites.has(key))venueSprites.set(key,pixelTexture(color,index,appearance).toDataURL());
  return venueSprites.get(key);
}
const backSprites=new Map();
function auctionBackSprite(index){
  if(backSprites.has(index))return backSprites.get(index);
  const c=document.createElement('canvas');c.width=24;c.height=32;
  const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
  const block=(color,x,y,w,h)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h)};
  block('#090f19',7,2,10,11);block('#172335',8,3,8,9);
  block(index%2?'#14273a':'#1b2a3a',5,12,14,18);
  block('#273b4c',6,13,2,14);block('#111b2b',16,13,3,14);
  block('#0b1422',3,17,3,13);block('#0b1422',18,17,3,13);
  block('#0a1321',7,29,10,3);
  const url=c.toDataURL();backSprites.set(index,url);return url;
}
function auctionVenueCharacters(clubs){
  const colors=['#60a5fa','#fbbf24','#4ade80','#f472b6','#a78bfa','#e2e8f0'];
  // Use the draft hall's photographed seating envelopes and chair coordinates.
  const audience=[0,1].flatMap(side=>[0,1].map(tier=>{
    const chars=Array.from({length:110},(_,i)=>{
      const row=Math.floor(i/22),col=i%22,n=i+side*17+tier*7;
      const x=col*11,y=(tier?368:228)+row*12+col*1.7;
      const seed=(i*73+side*101+tier*47)%127;
      return `<img class="auction-spectator motion-${seed%4}" src="${venueSprite(colors[n%6],n%36,n%2?'woman':'man')}" alt="" style="left:${(side?STAGE.width-x-12:x)/STAGE.width*100}%;top:${y/STAGE.height*100}%;--motion-delay:${-(seed*0.29).toFixed(2)}s;--motion-duration:${(3.2+(seed%19)*.31).toFixed(2)}s">`;
    }).join('');
    return `<div class="auction-audience-bank ${side?'right':'left'} ${tier?'lower':'upper'}">${chars}</div>`;
  })).join('');
  const seats=AUCTION_SEATS;
  const staff=clubs.slice(0,6).map((club,i)=>[0,1].map(role=>`<img class="auction-staff motion-${(i*3+role)%3}" src="${venueSprite(role?'#334155':club.color||'#60a5fa',i*2+role+24)}" alt="" style="left:${seats[i]+(role?3.6:1)}%;--motion-delay:${-((i*7+role*11)*.83).toFixed(2)}s;--motion-duration:${(4.9+((i*5+role*3)%7)*.67).toFixed(2)}s">`).join('')).join('');
  const flags=['LIVE AUCTION','PLAYER BID','SOLD!','FINAL CALL'].map((label,i)=>`<span class="auction-banner-label banner-${i+1}">${label}</span>`).join('');
  const marquee='FOOTBALL LEAGUE　◆　LIVE PLAYER AUCTION　◆　入札受付中　◆　FOOTBALL LEAGUE　◆　';
  const ribbon=`<div class="auction-ring-ticker" aria-hidden="true"><div class="auction-ring-track"><span>${marquee}</span><span>${marquee}</span></div></div>`;
  const consoles=[[53,755],[245,755],[372,755],[1243,755],[1377,755],[1558,755]].map(([x,y],i)=>`<span class="auction-console-screen" style="left:${x/STAGE.width*100}%;top:${y/STAGE.height*100}%;--pulse-delay:${i*.43}s"></span>`).join('');
  const operators=[160,445,1227,1510].map((x,i)=>`<img class="auction-operator" src="${auctionBackSprite(i)}" alt="" style="left:${x/STAGE.width*100}%">`).join('');
  return `<div class="auction-crowd" aria-hidden="true">${audience}</div>${ribbon}${flags}<div class="auction-light-beam beam-left" aria-hidden="true"></div><div class="auction-light-beam beam-right" aria-hidden="true"></div><img class="auction-host" src="${venueSprite('#172e50',71)}" alt="" aria-hidden="true">${staff}<span class="auction-furniture-front" aria-hidden="true"></span><div class="auction-foreground" aria-hidden="true">${consoles}${operators}</div>`;
}
export function auctionAvatar(player,clubColor){
  const appearance=playerAppearance(player),goalkeeper=player.primaryPosition==='GK',color=kitColor(clubColor,goalkeeper);
  const key=JSON.stringify([appearance,color,goalkeeper]);
  if(!avatars.has(key))avatars.set(key,pixelTexture(color,appearance,'player',{goalkeeper}).toDataURL());
  return avatars.get(key);
}
export function renderLiveAuction(s,club,card,escape,header){
  const a=s.auction,p=a.pool[a.i],lot=a.live;
  if(a.completed||!p)return `${header}<main class="auction-room"><section class="auction-monitor auction-complete"><h2>オークション完了</h2><p>全選手の競売が終了しました。</p><button data-a="toggleAuctionHistory" class="subtle">結果を見る</button><button data-a="squad">編成画面へ</button></section></main>`;
  const leader=s.league.clubs.find(c=>c.id===lot?.leader),closed=lot?.closed;
  const passDisabled=closed||lot?.passed.includes(club.id)||lot?.leader===club.id;
  const bidDisabled=passDisabled||club.roster.length>=12;
  const minimum=lot?.minimum??minimumAuctionBid(p),opening=!lot?.leader,base=opening?minimum:lot.high;
  const winner=closed?s.league.clubs.find(c=>c.id===a.history.at(-1)?.winnerClubId):null;
  const award=closed?`<div class="auction-award" role="status" style="--winner:${escape(winner?.color||'#8ab2ce')}"><div class="auction-confetti" aria-hidden="true">${winner?Array.from({length:28},(_,i)=>`<i style="--i:${i};--x:${(i*37)%100}%;--delay:${(i*7)%12/10}s;--drift:${(i-14)*5}px"></i>`).join(''):''}</div><strong>${winner?`${escape(winner.name)}が獲得しました！`:'落札なし・見送り'}</strong><span>${winner?`${lot.high}ptで落札`:'次の選手へ進みます'}</span></div>`:'';
  return `${header}<main class="auction-room"><div class="auction-scene">${auctionVenueCharacters(s.league.clubs)}${winner?'<div class="auction-award-light" aria-hidden="true"></div>':''}<div class="auction-topline"><span>PLAYER AUCTION · ${a.i+1} / ${a.pool.length}</span><div><button data-a="toggleAuctionHistory" class="subtle">落札結果</button><button data-stage10="roster" class="subtle">所属選手</button></div></div><section class="auction-monitor" aria-label="競売選手モニター"><div class="auction-avatar"><span>${escape(p.primaryPosition)}</span><img src="${auctionAvatar(p,winner?.color)}" alt="${escape(p.name)}のアバター"><small>FOOTBALL LEAGUE</small></div><div class="auction-player">${card(p)}<p class="scout-comment">${escape(p.scoutComment||'')}</p></div><aside class="auction-live"><span>残り時間</span><strong class="auction-timer" data-auction-time>0:30</strong><span>${closed?'落札額':opening?'最低落札額':'現在最高額'}</span><strong class="auction-price">${opening?minimum:lot.high}<small> pt</small></strong><div class="auction-leader" style="--club:${escape(leader?.color||'#64748b')}">${leader?escape(leader.name):'入札待ち'}</div><p>${closed?(leader?'落札しました':'入札なし・見送り'):'残り5秒以内の入札で5秒に延長'}</p></aside>${award}</section><section class="auction-controls" aria-label="入札操作"><div><b>資金 ${club.funds}pt</b><span>登録 ${club.roster.length} / 12人</span></div><div class="auction-bid-buttons">${(opening?[0,5,10]:[1,5,10]).map(step=>`<button data-live-bid="${base+step}" ${bidDisabled||club.funds<base+step?'disabled':''}>${base+step}ptで入札 <small>${opening&&step===0?'最低額':`＋${step}`}</small></button>`).join('')}<button data-live-pass class="subtle" ${passDisabled?'disabled':''}>この選手を辞退</button></div><p role="status">${closed?'4秒後に次の選手へ進みます':lot?.leader===club.id?'あなたのクラブが最高入札中です':lot?.passed.includes(club.id)?'この選手の入札を辞退しました':club.roster.length>=12?'登録人数が上限に達しています':'最高額を超える金額で何度でも入札できます'}</p></section><section class="auction-desks" aria-label="各クラブの入札">${s.league.clubs.map((c,i)=>`<article style="--club:${escape(c.color)};--auction-seat:${AUCTION_SEATS[i]}%" class="${c.id===lot?.leader?'leading':''}"><b>${escape(c.name)}</b><strong>${lot?.passed.includes(c.id)?'辞退':lot?.bids[c.id]?`${lot.bids[c.id]} pt`:'—'}</strong></article>`).join('')}</section></div></main>`;
}
