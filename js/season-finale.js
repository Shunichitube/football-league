import {footballTexture} from './arena-scene.js?v=shared-ball-v1';
import {loadMotionAtlas,drawMotion} from './player-motion.js?v=redrawn-run-v1';
import {playerAppearance} from './avatar-profile.js?v=appearance-v29';
import {drawAvatar} from './player-avatar.js?v=season-finale-v1';
import {celebrationTexture,drawCelebration} from './avatar-celebration.js?v=modular-motion-v2';

export const finaleKind=rank=>rank===1?'goal':rank<=3?'parry':'catch';
export const CONVEYOR_MATCH_SECONDS=4.5;
export const CONVEYOR_LAYOUT=Object.freeze({centerX:480,centerY:360,reserveX:79,reserveY:505,entryX:-65,ballDX:25,ballDY:-12,shotX:745,shotY:350});
// Read snapshots only. Multiplayer stores other clubs' fixtures here as well.
export function conveyorMatches(matches,clubId){
 const seen=new Set();
 return (matches||[]).filter(match=>{
  const f=match.fixture,key=`${match.round}:${f?.homeId}:${f?.awayId}`;
  if(!f||!match.result?.score||(f.homeId!==clubId&&f.awayId!==clubId)||seen.has(key))return false;
  seen.add(key);return true;
 }).sort((a,b)=>a.round-b.round).slice(0,10).map(match=>{
  const home=match.fixture.homeId===clubId,score=match.result.score;
  const goals=home?score.home:score.away,against=home?score.away:score.home;
  return {round:match.round,opponent:home?match.fixture.away:match.fixture.home,goals,against,outcome:goals>against?'win':goals<against?'loss':'draw'};
 });
}
export function conveyorFrame(matches,time){
 const duration=matches.length*CONVEYOR_MATCH_SECONDS;
 if(!matches.length||time>=duration)return {done:true,duration};
 const index=Math.min(matches.length-1,Math.floor(Math.max(0,time)/CONVEYOR_MATCH_SECONDS));
 return {done:false,duration,index,match:matches[index],local:Math.max(0,time)-index*CONVEYOR_MATCH_SECONDS};
}
export function conveyorCast(club){
 const byId=id=>club.roster.find(p=>p.id===id),lineup=club.lineup||[];
 const midfielders=club.roster.filter(p=>p.primaryPosition==='MF');
 const candidates=[byId(lineup[4])||club.roster.find(p=>p.primaryPosition==='FW'),byId(lineup[2])||midfielders[0],byId(lineup[3])||midfielders[1],...club.roster.filter(p=>p.primaryPosition!=='GK')];
 return candidates.filter((p,i)=>p&&candidates.findIndex(q=>q?.id===p.id)===i).slice(0,3);
}
const smooth=q=>{q=Math.max(0,Math.min(1,q));return q*q*(3-2*q);};
const mix=(a,b,q)=>a+(b-a)*q;
export function conveyorBlocking(matches,time){
 const frame=conveyorFrame(matches,time);if(frame.done)return frame;
 const {index,match,local:t}=frame,L=CONVEYOR_LAYOUT;
 const losses=matches.slice(0,index).filter(m=>m.outcome==='loss').length;
 const actionStart=1.8;
 const central={role:losses,x:L.centerX,y:L.centerY,motion:t<actionStart?'idle':'run',seconds:t<actionStart?time:t-actionStart,direction:'right'};
 const reserve={role:losses+1,x:L.reserveX,y:L.reserveY,motion:'idle',seconds:time,direction:'right'};
 const approach=smooth(t/1.35);
 const rival={x:mix(1040,L.centerX+65,approach),y:mix(210,L.centerY,approach),scale:mix(.55,1,approach),motion:t<1.35?'run':t<actionStart?'idle':'run',seconds:t<1.35?t:t<actionStart?t-1.35:t-actionStart,direction:'left'};
 let ball={x:central.x+L.ballDX,y:central.y+L.ballDY},departed=null,replacement=null;
 if(match.outcome==='win'&&t>=actionStart){
  central.x=L.centerX+45*smooth((t-actionStart)/.65)-45*smooth((t-3)/.9);
  central.y=L.centerY-50*smooth((t-actionStart)/.65)+50*smooth((t-3)/.9);
  central.motion='dribble';
  rival.x=t>2.45?L.centerX+65-(t-2.45)*175:rival.x;
  ball={x:central.x+L.ballDX+Math.sin((t-actionStart)*8)*3,y:central.y+L.ballDY};
 }else if(match.outcome==='loss'&&t>=2.2){
  departed={...central,x:L.centerX-(t-2.2)*90,motion:'idle',seconds:time};
  rival.x=t<2.5?mix(L.centerX+65,560,smooth((t-2.2)/.3)):560;
  rival.motion=t<2.5?'dribble':t<3.5?'shoot':'run';
  rival.seconds=t<2.5?t-2.2:t<3.5?t-2.5:t-3.5;rival.direction='right';
  if(t>=3.5)rival.x=560+(t-3.5)*200;
  const roll=smooth((t-3)/.35);
  ball=t<3?{x:rival.x+L.ballDX,y:L.centerY+L.ballDY}:
   {x:mix(560+L.ballDX,L.reserveX+L.ballDX,roll),y:mix(L.centerY+L.ballDY,L.reserveY+L.ballDY,roll)};
  central.role=reserve.role;central.x=reserve.x;central.y=reserve.y;
  central.motion='idle';central.seconds=time;
  if(t>=3.35){
   const pickup=smooth((t-3.35)/.6);
   central.x=mix(L.reserveX,L.centerX,pickup);central.y=mix(L.reserveY,L.centerY,pickup);
   central.motion='dribble';central.seconds=t-3.35;
   ball={x:central.x+L.ballDX,y:central.y+L.ballDY};
   const incoming=smooth((t-3.35)/.65);
   replacement={...reserve,role:losses+2,x:mix(L.entryX,L.reserveX,incoming),motion:t<4?'run':'idle',seconds:t-3.35,direction:'right'};
  }
 }else if(match.outcome==='draw'&&t>=actionStart){
  central.motion=t<2.8?'shoot':'run';central.seconds=t<2.8?t-actionStart:t-2.8;
  rival.x=t>2.45?L.centerX+65-(t-2.45)*175:rival.x;
  const outward=smooth((t-2.35)/.5),back=smooth((t-3)/.8),q=outward*(1-back);
  ball={x:mix(L.centerX+L.ballDX,L.reserveX+L.ballDX,q),y:mix(L.centerY+L.ballDY,L.reserveY+L.ballDY,q)};
 }
 let pastRole=0;
 const waiting=matches.slice(0,index).flatMap((m,i)=>{
  if(m.outcome!=='loss')return [];
  const role=pastRole++,x=L.centerX-(time-(i*CONVEYOR_MATCH_SECONDS+2.2))*90;
  return x>-140?[{role,x,y:L.centerY,motion:'idle',seconds:time,direction:'right'}]:[];
 });
 return {...frame,central,reserve,rival,ball,departed,replacement,waiting,losses,resultReady:t>=4};
}
export function podiumPositions(count){
 const n=Math.min(12,Math.max(0,count)),gap=105;
 return Array.from({length:n},(_,i)=>({x:836+(i-(n-1)/2)*gap,y:700}));
}
export function finaleFrame(rank,time){
 const kind=finaleKind(rank),t=Math.max(0,time);
 if(t<1.15)return {scene:'shoot',white:0,ready:false};
 let white=t<1.85?0:t<2.12?(t-1.85)/.27:t<2.7?1:t<3.08?1-(t-2.7)/.38:0;
 if(kind==='goal'){
  if(t>=4.05)white=t<4.35?(t-4.05)/.3:t<4.65?1:t<5.05?1-(t-4.65)/.4:0;
  return {scene:t<2.7?'flight':t<4.65?'impact':'celebrate',white,ready:t>=5.05};
 }
 if(t>=4)white=Math.min(1,(t-4)/.35);
 return {scene:t<2.7?'flight':t<4.35?kind:'white',white,ready:t>=4.35};
}

let resources;
async function loadResources(){
 const load=async name=>{
  const im=new Image();im.src=new URL('../assets/'+name,import.meta.url).href;
  let timer;try{await Promise.race([im.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Finale image timed out')),15000);})]);}finally{clearTimeout(timer);}return im;
 };
 resources??=Promise.all([loadMotionAtlas(),load('arena/arena-base.webp'),load('arena/home-arena-v2.webp'),load('arena/goal-cutin-background-v1.webp'),load('arena/goal-net-bulge-no-ball-v3.webp')]).then(([atlas,ground,home,goal,bulge])=>({atlas,ground,home,goal,bulge}));
 try{return await resources;}catch(error){resources=null;throw error;}
}
let sharedBall;
function football(ctx,x,y,r,spin=0){
 sharedBall??=footballTexture();
 ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(x,y);ctx.rotate(spin);
 ctx.drawImage(sharedBall,-r,-r,r*2,r*2);ctx.restore();
}
export function createFinalePainter(data,club,rank,keeper,clubs=[],fixtures=[]){
 const {atlas,ground,home,goal,bulge}=data;
 const roster=club.roster.slice(0,12),cast=conveyorCast(club);
 let scorer=cast[fixtures.filter(m=>m.outcome==='loss').length%cast.length]||roster[0];
 const sprite=document.createElement('canvas');sprite.width=480;sprite.height=480;
 const actor=(ctx,motion,t,x,y,height,p=scorer,gk=false,kit=club.color,direction='right')=>{
  drawMotion(sprite.getContext('2d'),atlas,motion,t*.5,{appearance:playerAppearance(p||{id:'finale-keeper',primaryPosition:'GK'}),kit,goalkeeper:gk,loop:['idle','run','dribble'].includes(motion),direction});
  ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,x-height/2,y-height,height,height);
 };
 const joy=(ctx,p,x,y,height,t,gk=false,sad=false)=>{
  const pose=Math.floor(t*1.5)%4,im=celebrationTexture(atlas,playerAppearance(p||{id:'finale-keeper',primaryPosition:'GK'}),{kit:club.color,goalkeeper:gk,pose,dejected:sad});
  drawCelebration(ctx,im,x,y,height);
 };
 const portraits=roster.map(p=>{const im=document.createElement('canvas');im.width=300;im.height=470;drawAvatar(im.getContext('2d'),atlas.avatar,playerAppearance(p),{kit:club.color,goalkeeper:p.primaryPosition==='GK'});return im;});
 return {
  conveyor(ctx,time,matches){
   const frame=conveyorBlocking(matches,time),{match,local:t,index,duration}=frame;
   if(frame.done)return frame;
   // Use the home ground at the same crop/scale as the existing shot.
   // Whole tiles slide left; the last tile eases to the original crop exactly.
   const ease=q=>q*q*(3-2*q),handoff=index===matches.length-1?Math.max(0,(t-4)/.5):0;
   const remaining=duration-time;
   const distance=remaining<.5?75*.5*(1-ease(1-remaining/.5)):remaining*75;
   const offset=((distance%1920)+1920)%1920;
   ctx.imageSmoothingEnabled=true;
   // Alternating mirror tiles join at identical edges rather than jumping cuts.
   // Crop out the roof and benches, retaining one strip of the home crowd.
   for(let tile=-2;tile<=1;tile++){
    ctx.save();ctx.translate(tile*960+offset,0);
    if(Math.abs(tile)%2){ctx.translate(960,0);ctx.scale(-1,1);}
    ctx.drawImage(home,500,410,672,315,0,0,960,540);ctx.restore();
   }
   const opponent=clubs.find(c=>c.id===match.opponent?.id),rival=opponent?.roster.find(p=>p.primaryPosition!=='GK')||opponent?.roster[0];
   const member=role=>cast[role%cast.length]||scorer;
   scorer=member(matches.filter(m=>m.outcome==='loss').length);
   const drawRole=(pose,height=80)=>actor(ctx,pose.motion,pose.seconds,pose.x,pose.y,height,member(pose.role),member(pose.role)?.primaryPosition==='GK',club.color,pose.direction);
   const enemy=frame.rival;
   const blend=ease(handoff),lead={...frame.central,x:mix(frame.central.x,CONVEYOR_LAYOUT.shotX,blend),y:mix(frame.central.y,CONVEYOR_LAYOUT.shotY,blend)};
   const people=[...frame.waiting.map(pose=>({pose})),...(frame.departed?[{pose:frame.departed}]:[]),{pose:enemy,enemy:true},{pose:lead,lead:true},...(!frame.departed?[{pose:frame.reserve,height:84}]:frame.replacement?[{pose:frame.replacement,height:84}]:[])];
   // Draw the upper lane first, leaving the reserve in the foreground.
   people.sort((a,b)=>a.pose.y-b.pose.y).forEach(row=>{
    ctx.save();ctx.globalAlpha=row.lead?1:1-blend;
    if(row.enemy)actor(ctx,enemy.motion,enemy.seconds,enemy.x,enemy.y,80*enemy.scale,rival,rival?.primaryPosition==='GK',opponent?.color||match.opponent?.color||'#b64c64',enemy.direction);
    else drawRole(row.pose,row.lead?mix(80,96,blend):row.height||80);
    ctx.restore();
   });
   let ballX=mix(frame.ball.x,CONVEYOR_LAYOUT.shotX+40,blend),ballY=mix(frame.ball.y,CONVEYOR_LAYOUT.shotY-12,blend);
   football(ctx,ballX,ballY,6,time*12);
   // The final running pose dissolves into the first existing kick pose.
   if(handoff){ctx.save();ctx.globalAlpha=ease(handoff);this.cinematic(ctx,0);ctx.restore();}
   return frame;
  },
  cinematic(ctx,time){
   const t=time,frame=finaleFrame(rank,t),kind=finaleKind(rank);
   ctx.imageSmoothingEnabled=true;
   if(frame.scene==='shoot'){
    ctx.drawImage(home,500,410,672,315,0,0,960,540);
    actor(ctx,'shoot',t,CONVEYOR_LAYOUT.shotX,CONVEYOR_LAYOUT.shotY,96);
    const q=Math.max(0,Math.min(1,(t-.35)/.8));football(ctx,CONVEYOR_LAYOUT.shotX+40+q*160,CONVEYOR_LAYOUT.shotY-12-q*55,6-q*2,t*12);
   }else if(frame.scene!=='white'){
    ctx.drawImage(goal,0,0,960,540);
    if(frame.scene==='flight'){
     const q=t-1.15,d=Math.max(0,Math.min(1,(q-.55)/.8)),p=Math.max(0,Math.min(1,q/1.55));
     if(kind==='catch')actor(ctx,'catch',q<.55?0:.18,355,385,127.5,keeper,true);
     else actor(ctx,d?'dive':'catch',d*.375,355+d*130,385-d*100,127.5,keeper,true);
     football(ctx,mix(950,kind==='catch'?371:500,p),mix(325,kind==='catch'?333:229,p),17-p*9,t*15);
    }else if(frame.scene==='impact'){
     ctx.save();ctx.translate(960*.55,540*.42);ctx.scale(1.85,1.85);ctx.translate(-490,-154);
     ctx.drawImage(bulge,0,0,960,540);football(ctx,490+Math.sin(t*30)*1.5,154,14,t*15);ctx.restore();
    }else if(frame.scene==='celebrate'){
     football(ctx,478,321,14,0);joy(ctx,keeper,355,395,120,t,true,true);joy(ctx,scorer,783,407,135,t);
    }else if(frame.scene==='parry'){
     actor(ctx,'dive',.25,485,285,127.5,keeper,true);
     const p=Math.min(1,(t-2.7)/1.15);football(ctx,500+p*540,229-p*125+p*p*35,8,t*18);
    }else if(frame.scene==='catch'){
     actor(ctx,'catch',.6,355,385,127.5,keeper,true);football(ctx,371,333,8,0);
    }
   }
   if(frame.white){ctx.fillStyle=`rgba(255,255,255,${frame.white})`;ctx.fillRect(0,0,960,540);}
   return frame;
  },
  ceremony(ctx,t){
   ctx.imageSmoothingEnabled=true;ctx.drawImage(home,0,0,1672,941);
   // The home court is empty already. Replace just the occupied dugouts below
   // the podium, retaining the home spectators, goals and court lighting.
   ctx.drawImage(ground,0,745,1672,196,0,745,1672,196);
   if(rank<=3){
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<4;i++){
     const x=260+i*380,wave=Math.sin(t*.5+i)*90;
     const light=ctx.createLinearGradient(x,240,x+wave,750);light.addColorStop(0,'#fff9d080');light.addColorStop(1,'#fff3b208');ctx.fillStyle=light;
     ctx.beginPath();ctx.moveTo(x,240);ctx.lineTo(x+wave-160,770);ctx.lineTo(x+wave+160,770);ctx.closePath();ctx.fill();
    }ctx.restore();
   }
   const medal=['','#dbb95f','#b9c9d7','#b98659'][rank]||'#647e95';
   ctx.fillStyle='#081d29aa';ctx.beginPath();ctx.ellipse(836,766,690,28,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle=medal;ctx.fillRect(150,700,1372,66);ctx.fillStyle='#f2f8ff';ctx.fillRect(150,700,1372,8);
   ctx.fillStyle='#182c3b';ctx.fillRect(166,723,1340,29);ctx.fillStyle=medal;ctx.textAlign='center';ctx.font='bold 20px sans-serif';ctx.fillText(rank===1?'CHAMPIONS':`${rank} PLACE`,836,745);
   podiumPositions(roster.length).forEach(({x,y},i)=>{
    const p=roster[i],height=175;
    if(rank<=3)joy(ctx,p,x,y,height,t+i*.19,p.primaryPosition==='GK');
    else {ctx.imageSmoothingEnabled=false;ctx.drawImage(portraits[i],x-height*300/470/2,y-height,height*300/470,height);}
   });
   if(rank<=3){
    const colors=['#fff2a4','#f4a5ce','#6be5dd','#a9b6ff','#ffffff'];
    for(let i=0;i<130;i++){const x=(i*173.7+Math.sin(t+i)*22)%1672,y=((i*97+t*(55+i%35))%750)+110;ctx.save();ctx.translate(x,y);ctx.rotate(t+i);ctx.fillStyle=colors[i%5];ctx.fillRect(-3,-5,6,10);ctx.restore();}
   }
  }
 };
}

export function playSeasonFinale({app,club,rank,keeper,matches=[],clubs=[],onDone=()=>{}}){
 const fixtures=conveyorMatches(matches,club.id),conveyorDuration=fixtures.length*CONVEYOR_MATCH_SECONDS;
 const root=document.createElement('section');root.className='season-finale';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','シーズン最終演出');
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
 const heading=document.createElement('div');heading.className='finale-heading';heading.hidden=true;
 const team=document.createElement('h1');team.textContent=club.name;
 const placing=document.createElement('p');placing.textContent=rank===1?'優勝':rank===2?'準優勝':`第${rank}位`;heading.append(team,placing);
 const status=document.createElement('p');status.className='finale-loading';status.textContent='シーズン最終演出を準備しています…';status.setAttribute('role','status');
 const button=document.createElement('button');button.className='finale-next';button.textContent='次へ';button.hidden=true;
 const scoreboard=document.createElement('div');scoreboard.className='finale-scoreboard';scoreboard.hidden=true;
 const roundLabel=document.createElement('p'),teams=document.createElement('div'),ownName=document.createElement('span'),score=document.createElement('strong'),opponentName=document.createElement('span'),outcome=document.createElement('p');
 ownName.textContent=club.name;teams.append(ownName,score,opponentName);scoreboard.append(roundLabel,teams,outcome);
 root.append(canvas,heading,status,scoreboard,button);document.body.append(root);app.inert=true;
 let dead=false,raf=0,painter,stage=fixtures.length?'conveyor':'cinematic',clock=0,previous=0,lastPaint=0,loadTimer,shownMatch=-1;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function dispose(){if(dead)return;dead=true;clearTimeout(loadTimer);cancelAnimationFrame(raf);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);root.remove();app.inert=false;}
 function finish(){dispose();onDone();}
 function paint(){
  if(!painter||dead)return;
  const ctx=canvas.getContext('2d'),w=stage==='ceremony'?1672:960,h=stage==='ceremony'?941:540;
  const scale=Math.min(canvas.width/w,canvas.height/h),x=(canvas.width-w*scale)/2,y=(canvas.height-h*scale)/2;
  if(stage==='conveyor'&&clock>=conveyorDuration){stage='cinematic';clock-=conveyorDuration;scoreboard.hidden=true;}
  const frame=finaleFrame(rank,clock),white=stage==='cinematic'&&frame.scene==='white';
  root.classList.toggle('finale-white',white);ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=white?'#fff':'#07121d';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(scale,0,0,scale,x,y);
  if(stage==='ceremony')painter.ceremony(ctx,clock);
  else if(stage==='conveyor'){
   const current=painter.conveyor(ctx,clock,fixtures);
   scoreboard.hidden=!current.resultReady;scoreboard.style.opacity=String(Math.min(1,(conveyorDuration-clock)/.5));
   if(shownMatch!==current.index){shownMatch=current.index;const m=current.match;
    roundLabel.textContent=`SEASON ${current.index+1} / ${fixtures.length}　·　第${m.round}節`;
    score.textContent=`${m.goals} — ${m.against}`;opponentName.textContent=m.opponent?.name||'対戦相手';
    outcome.textContent=({win:'WIN · ドリブル突破',draw:'DRAW · パスをつなぐ',loss:'LOSE · 奪われてリスタート'})[m.outcome];scoreboard.dataset.outcome=m.outcome;
   }
  }else painter.cinematic(ctx,clock);
  root.dataset.scene=stage==='ceremony'?'ceremony':stage==='conveyor'?'conveyor':frame.scene;
  if(stage==='cinematic'&&frame.ready&&button.hidden){button.hidden=false;button.focus({preventScroll:true});}
 }
 function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);paint();}
 function tick(now){
  if(dead)return;
  if(!document.hidden){if(previous)clock+=Math.min(.1,(now-previous)/1000);previous=now;if(now-lastPaint>1000/30){paint();lastPaint=now;}}
  else previous=0;
  raf=requestAnimationFrame(tick);
 }
 function visibility(){previous=0;}
 button.addEventListener('click',()=>{
  if(stage==='ceremony'||stage==='error')return finish();
  stage='ceremony';clock=0;previous=0;root.classList.remove('finale-white');heading.hidden=false;button.textContent='シーズン結果へ';paint();button.focus({preventScroll:true});
 });
 addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',visibility);resize();
 Promise.race([loadResources(),new Promise((_,reject)=>{loadTimer=setTimeout(()=>reject(new Error('Finale assets timed out')),20000);})]).then(data=>{
  if(dead)return;painter=createFinalePainter(data,club,rank,keeper,clubs,fixtures);status.remove();
  if(reduced){stage='cinematic';clock=finaleKind(rank)==='goal'?5.1:4.4;}
  paint();if(!reduced)raf=requestAnimationFrame(tick);
 }).catch(error=>{
  if(dead)return;console.error('Season finale assets failed to load',error);stage='error';status.textContent='演出を読み込めませんでした。シーズン結果へ進めます。';button.textContent='シーズン結果へ';button.hidden=false;button.focus();
 }).finally(()=>clearTimeout(loadTimer));
 return dispose;
}

