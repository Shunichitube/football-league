import {sequenceAt} from './season-three/timeline.js';

export function seasonReelMatches(fixtures){
 const counts={win:0,loss:0,draw:0};let streak=0;
 return fixtures.map(m=>{const type=counts[m.outcome]++%2?'pass':'dribble';streak=m.outcome==='win'?streak+1:0;return {...m,type,streak,label:({win:'勝利',loss:'敗戦',draw:'引き分け'})[m.outcome],score:`${m.goals} — ${m.against}`};});
}
export function seasonReelFrame(fixtures,time){
 const duration=fixtures.reduce((sum,m)=>sum+(m.outcome==='loss'?5:7),0);
 if(!fixtures.length||time>=duration)return {done:true,duration};
 const frame=sequenceAt(Math.max(0,time),fixtures);
 const reveal=frame.match.outcome==='win'?(frame.match.type==='pass'?5.3:4.8):frame.match.outcome==='loss'?(frame.match.type==='pass'?3.5:3.65):5.8;
 return {...frame,done:false,duration,local:frame.t,resultReady:frame.t>=reveal};
}
export function startingFive(club){
 const slots=['GK','DF','MF','MF','FW'],used=new Set();
 return slots.map((position,i)=>{
  const chosen=club?.roster?.find(p=>p.id===club.lineup?.[i]&&!used.has(p.id))||club?.roster?.find(p=>p.primaryPosition===position&&!used.has(p.id))||club?.roster?.find(p=>!used.has(p.id));
  if(chosen)used.add(chosen.id);return chosen;
 });
}
