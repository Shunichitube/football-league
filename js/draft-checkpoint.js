import {createRandom} from './random.js';
const KEY='football-league:mobile-draft-checkpoint';
// This tab's crash recovery is separate from the three manual save slots.
export function saveDraftCheckpoint(state,storage=globalThis.sessionStorage){
 try{
  if(state.mode==='room'||state.view!=='draft'||!state.league){storage?.removeItem(KEY);return;}
  const raw=JSON.stringify(state,(_,value)=>{
   if(value instanceof Map)return {checkpointType:'Map',values:[...value]};
   if(value instanceof Set)return {checkpointType:'Set',values:[...value]};
   if(typeof value?.snapshot==='function'&&typeof value?.next==='function')return {checkpointType:'Random',state:value.snapshot()};
   return value;
  });
  storage?.setItem(KEY,JSON.stringify({version:1,state:JSON.parse(raw)}));
 }catch{/* Storage denial must never prevent the game from advancing. */}
}
export function restoreDraftCheckpoint(storage=globalThis.sessionStorage){
 try{
  const saved=JSON.parse(storage?.getItem(KEY)||'null',(_,value)=>{
   if(value?.checkpointType==='Map')return new Map(value.values);
   if(value?.checkpointType==='Set')return new Set(value.values);
   if(value?.checkpointType==='Random')return createRandom('',value.state);
   return value;
  });
  const state=saved?.state;
  if(saved?.version!==1||state?.mode==='room'||state?.view!=='draft'||!state?.league?.clubs?.length||!Array.isArray(state?.draft?.pool)||typeof state.draft.rng?.next!=='function')return null;
  return {...state,rosterOpen:false,draftHistoryOpen:false,auctionHistoryOpen:false};
 }catch{return null;}
}
