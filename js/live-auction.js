import { cpuBid, addPlayer } from './market.js?v=rare-v2';
import { createRandom } from './random.js';
import { displayPlayer } from './data.js?v=formations-v1';
const MINIMUM_BID={G:1,F:5,E:10,D:15,C:20,B:25,A:30,S:35,SS:40};
export function minimumAuctionBid(player){return MINIMUM_BID[displayPlayer(player).overallRank]??1;}
export function openLot(auction,clubs,seed,now=Date.now()){
  const player=auction.pool[auction.i];if(!player)return;
  const rng=createRandom(`${seed}:live:${player.id}`);
  auction.live={playerId:player.id,endAt:now+30000,minimum:minimumAuctionBid(player),high:0,leader:null,bids:{},passed:[],closed:false,cpuAt:now,cpuLimits:Object.fromEntries(clubs.filter(c=>c.controllerType==='CPU').map(c=>[c.id,cpuBid(c,player,rng)]))};
}
export function raiseBid(auction,clubs,clubId,amount,now=Date.now()){
  const lot=auction.live,club=clubs.find(c=>c.id===clubId);
  if(!lot||lot.closed||now>=lot.endAt)throw new Error('入札時間が終了しました。');
  if(!club||club.roster.length>=12)throw new Error('登録人数が上限です。');
  if(lot.passed.includes(clubId))throw new Error('この選手の入札は辞退済みです。');
  if(lot.leader===clubId)throw new Error('現在の最高入札クラブです。');
  if(!Number.isSafeInteger(amount)||amount<Math.max(lot.high+1,lot.minimum??minimumAuctionBid(auction.pool[auction.i]))||amount>club.funds)throw new Error('最低落札額と最高額を超え、資金以内の整数で入札してください。');
  lot.high=amount;lot.leader=clubId;lot.bids[clubId]=amount;
  if(lot.endAt-now<=5000)lot.endAt=now+5000;
}
export function passLot(auction,clubId){
  const lot=auction.live;if(!lot||lot.closed)throw new Error('入札時間が終了しました。');
  if(lot.leader===clubId)throw new Error('最高入札は取り消せません。');
  if(!lot.passed.includes(clubId))lot.passed.push(clubId);
}
export function tickLot(auction,league,now=Date.now()){
  const lot=auction.live;if(!lot||lot.closed)return false;
  function settle(){
    const player=auction.pool[auction.i],winner=league.clubs.find(c=>c.id===lot.leader);
    const sold=winner&&winner.funds>=lot.high&&addPlayer(winner,player,lot.high);
    if(sold)league.releasedPlayers=(league.releasedPlayers||[]).filter(p=>p.id!==player.id);
    auction.history.push({player,winnerClubId:sold?winner.id:null,bid:sold?lot.high:0});
    lot.closed=true;lot.nextAt=now+4000;return true;
  }
  if(now>=lot.endAt)return settle();
  const previousPasses=lot.passed.length;
  let bidPlaced=false;
  if(now>=lot.cpuAt){
    // Resolve the CPU bidding ladder in one update instead of waiting two seconds
    // between each club. Every offer still passes through raiseBid and its limits.
    lot.cpuAt=now+250;
    for(let round=0;round<256;round++){
      const required=Math.max(lot.high+1,lot.minimum??minimumAuctionBid(auction.pool[auction.i]));
      for(const club of league.clubs){
        if(club.controllerType==='CPU'&&club.id!==lot.leader&&!lot.passed.includes(club.id)&&Math.min(club.funds,lot.cpuLimits?.[club.id]||0)<required)passLot(auction,club.id);
      }
      const next=league.clubs.find(c=>c.controllerType==='CPU'&&c.id!==lot.leader&&c.roster.length<12&&!lot.passed.includes(c.id)&&Math.min(c.funds,lot.cpuLimits?.[c.id]||0)>=required);
      if(!next)break;
      raiseBid(auction,league.clubs,next.id,required,now);
      bidPlaced=true;
    }
  }
  const nextRequired=Math.max(lot.high+1,lot.minimum??minimumAuctionBid(auction.pool[auction.i]));
  const challenger=league.clubs.some(c=>c.id!==lot.leader&&!lot.passed.includes(c.id)&&c.roster.length<12&&c.funds>=nextRequired&&(c.controllerType!=='CPU'||(lot.cpuLimits?.[c.id]||0)>=nextRequired));
  if(!challenger)return settle();
  return bidPlaced||lot.passed.length!==previousPasses;
}
