export const MATCH_SECONDS=7;
export const DEMO_MATCHES=[
{opponent:'CITY BLUE',outcome:'win',type:'dribble',score:'3 – 1',label:'勝ち · ドリブル突破'},
{opponent:'CITY BLUE',outcome:'win',type:'pass',score:'3 – 1',label:'勝ち · パス突破'},
{opponent:'SUNSET UNITED',outcome:'loss',type:'dribble',score:'1 – 2',label:'負け · ドリブル奪取'},
{opponent:'SUNSET UNITED',outcome:'loss',type:'pass',score:'1 – 2',label:'負け · パスカット'},
{opponent:'FOREST FC',outcome:'draw',type:'dribble',score:'2 – 2',label:'引き分け · 抜けずに対面'},
{opponent:'FOREST FC',outcome:'draw',type:'pass',score:'2 – 2',label:'引き分け · パスをカバー'}];
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*smooth(t);
export function sequenceAt(seconds, fixtures=DEMO_MATCHES){
const DEMO_MATCHES=fixtures;
const lengths=DEMO_MATCHES.map(m=>m.outcome==='loss'?5:MATCH_SECONDS),duration=lengths.reduce((a,b)=>a+b,0);
let t=((seconds%duration)+duration)%duration,index=0;while(t>=lengths[index]){t-=lengths[index];index++;}const match=DEMO_MATCHES[index],sceneDuration=lengths[index];
const runner={x:-3,z:0,motion:'idle',heading:1},support={x:-6+t*1.45,z:-3.7,motion:'run',heading:1},rival={x:-.7,z:0,motion:'idle',heading:-1};
let ball={x:-2.4,z:.05},action='WAIT · 対面して、突破かパスを選ぶ',replacement=false;
const q=smooth((t-2.2)/2.6);
if(t>=2.2&&match.type==='dribble'){
runner.x=-3+7*q;runner.z=-Math.sin(q*Math.PI)*1.4;runner.motion=t<4.8?'dribble':'idle';ball={x:runner.x+.58+Math.sin(t*16)*.06,z:runner.z+.05};
if(match.outcome==='win'){rival.x=mix(-.7,-2,(t-2.2)/1.3);rival.z=mix(0,1,(t-2.2)/1.3);rival.motion=t<3.5?'run':'idle';action=t<4.8?'DRIBBLE · 相手をかわして抜き去る':'WIN · 守備の向こうへ突破';}
else if(match.outcome==='loss'){runner.x=mix(-3,-1.8,(t-2.2)/.8);runner.z=-.3;runner.motion=t<3?'dribble':'idle';rival.x=mix(-.7,-1,(t-2.2)/.8);rival.z=-.3;if(t>=3){rival.x=-1-(t-3)*1.9;rival.heading=-1;rival.motion='dribble';ball={x:rival.x-.6,z:-.25};runner.x=-1.8-(t-3)*.6;replacement=t>=4;}action=t<3?'DUEL · ドリブルで仕掛ける':t<4?'STEAL · 相手がボールを奪う':'LOSS · 奪われ、次の選手へ';}
else{
 const second=t>=4.2,local=t-(second?4.2:2.2),attempt=Math.min(local/1.05,1),active=local<1.05;
 const base=second?-1.85:-3;
 runner.x=base+1.15*smooth(attempt);runner.z=(second?1:-1)*Math.sin(attempt*Math.PI)*1.05;
 runner.motion=active?'dribble':'idle';
 rival.x=runner.x+1.25;rival.z=runner.z;rival.motion=active?'run':'idle';
 ball={x:runner.x+.55,z:runner.z+.05};
 action=active?(second?'TRY 2 · 逆側へ仕掛けてもついてくる':'TRY 1 · 仕掛けても相手がついてくる'):(second?'DRAW · 2回とも抜けず、再び対面':'WAIT · 一度止まって、もう一度仕掛ける');
 }}else if(t>=2.2){
runner.motion=t<2.7?'shoot':'idle';const start={x:-2.4,z:.05},target={x:-6+3.2*1.45+.45,z:-3.7},pass=smooth((t-2.4)/.8);ball={x:start.x+(target.x-start.x)*pass,z:start.z+(target.z-start.z)*pass};
if(match.outcome==='win'){rival.x=-.7;rival.z=mix(0,-1,(t-2.4)/1.2);rival.motion=t<3.6?'run':'idle';if(t>=3.2)ball={x:support.x+.55,z:support.z+.05};action=t<3.2?'PASS · 奥の味方へ通す':'WIN · 味方が受けて前方へ突破';}
else if(match.outcome==='loss'){const cut={x:(start.x+target.x)/2,z:(start.z+target.z)/2};rival.x=mix(-.7,cut.x,(t-2.2)/.65);rival.z=mix(0,cut.z,(t-2.2)/.65);rival.motion='run';if(t>=2.85){rival.x=cut.x-(t-2.85)*2;rival.z=cut.z;rival.heading=-1;rival.motion='dribble';ball={x:rival.x-.55,z:rival.z+.05};replacement=t>=4;}action=t<2.85?'PASS · 相手がパスコースへ':'CUT · カットされて相手ボール';}
else{
 const receiveX=-6+3.2*1.45;
 if(t>=3.2){support.x=receiveX;support.motion='idle';}
 rival.x=mix(-.7,receiveX+1.25,(t-2.2)/1);rival.z=mix(0,-3.7,(t-2.2)/1);rival.heading=-1;rival.motion=t<3.2?'run':'idle';
 if(t>=3.2)ball={x:receiveX+.45,z:-3.65};
 if(t>=4.4){const back=smooth((t-4.4)/1.1);ball={x:(receiveX+.45)*(1-back)+start.x*back,z:-3.65*(1-back)+start.z*back};support.motion=t<4.9?'shoot':'idle';rival.x=mix(receiveX+1.25,runner.x+1.25,(t-4.4)/1.4);rival.z=mix(-3.7,0,(t-4.4)/1.4);rival.motion=t<5.8?'run':'idle';}
 action=t<3.2?'COVER · 受け手をカバー':t<4.4?'WAIT · パス先で対面して待機':t<5.8?'RETURN · 返球を追って中央へ':'DRAW · 中央で再び対面';}}
// Continue the same actors after possession changes; never replace their positions.
replacement=false;
if(match.outcome==='win'&&match.type==='dribble'&&t>=4.8){runner.x=4+(t-4.8)*2.3;runner.z=0;runner.motion='dribble';ball={x:runner.x+.58,z:.05};}
if(match.outcome==='win'&&match.type==='dribble'&&t>=3.5){rival.x=-2;rival.z=1;rival.motion='idle';}
if(match.outcome==='win'&&match.type==='pass'&&t>=2.7){runner.x=-3+(t-2.7)*2.2;runner.z=-Math.sin(Math.min((t-2.7)/2,1)*Math.PI)*.7;runner.motion='run';}
if(match.outcome==='win'&&match.type==='pass'&&t>=4.3){
 const returnStart=4.3,returnEnd=5.3;
 const sourceX=-6+returnStart*1.45+.55,sourceZ=-3.65;
 const targetX=-3+(returnEnd-2.7)*2.2+.55;
 const back=smooth((t-returnStart)/(returnEnd-returnStart));
 support.motion=t<4.8?'shoot':'run';
 if(t<returnEnd){ball={x:sourceX+(targetX-sourceX)*back,z:sourceZ*(1-back)};action='RETURN · 走り込む中央の選手へ';}
 else{runner.motion='dribble';ball={x:runner.x+.55,z:runner.z+.05};action='WIN · 中央が受けてパス突破';}
}
// A beaten defender pauses, turns, then pursues the ball without teleporting.
if(match.outcome==='win'){
 const dribble=match.type==='dribble',react=dribble?4.1:4.2;
 if(t>=react){
  const chase=(t-react)/1.8;
  rival.x=mix(dribble?-2:-.7,ball.x-1.4,chase);
  rival.z=mix(dribble?1:-1,ball.z+.35,chase);
  rival.heading=1;rival.motion='run';
 }
}
if(match.outcome==='loss'){
 const steal=match.type==='dribble'?3:2.85,react=steal+.65;
 if(t>=steal){
  const cutX=match.type==='dribble'?-1:(-2.4+(-6+3.2*1.45+.45))/2;
  const cutZ=match.type==='dribble'?-.3:(.05-3.7)/2;
  rival.x=cutX-(t-steal)*2.6;rival.z=cutZ;rival.heading=-1;rival.motion='dribble';ball={x:rival.x-.55,z:cutZ+.05};
  runner.x=match.type==='dribble'?-1.8:-3;runner.z=match.type==='dribble'?-.3:0;runner.motion='idle';runner.heading=-1;
  support.x=-6+steal*1.45;support.motion='idle';support.heading=-1;
  if(t>=react){const chase=t-react;runner.x-=chase*2.05;runner.z=mix(runner.z,cutZ,chase/1.5);runner.motion='run';support.x-=chase*2.3;support.z=mix(-3.7,cutZ-.8,chase/1.4);support.motion='run';}
  action=t<react?'STEAL · 一呼吸おいて反応':'CHASE · 味方2人が奪った相手を追走';
 }
}
// Delayed cover: approach at a constant gentle speed, then follow the teammate.
const coverStart=7,coverSpeed=.85;
const approachX=coverStart-coverSpeed*t,coverX=support.x+1.4;
const farRival={x:Math.max(approachX,coverX),z:support.z-.75,motion:'run',heading:approachX>coverX?-1:support.heading,animationRate:.65};
return {index,t,sceneDuration,match,runner,support,rival,farRival,ball,action,replacement,fade:t>sceneDuration-.65?smooth((t-sceneDuration+.65)/.65):t<.4?1-smooth(t/.4):0};
}
