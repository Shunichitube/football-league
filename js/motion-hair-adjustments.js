import {DEFAULT_RUN_HAIR_ADJUSTMENTS,DEFAULT_IDLE_HAIR_ADJUSTMENTS} from './motion-hair-defaults.js?v=idle-approved-v5';
// Offsets are in the 627px source frame; scaling is uniform about the hair center.
export const HAIR_ADJUSTMENT_KEY='football-league:run-hair-adjustments:v1';
const LEGACY_IDLE_KEY='football-league:idle-hair-adjustments:v1';
const storageKey=mode=>{
 if(mode==='idle'){
  // Discard pre-approval idle overrides; preserve run settings and new idle edits.
  try{globalThis.localStorage?.removeItem(LEGACY_IDLE_KEY);}catch{}
  return 'football-league:idle-hair-adjustments:v2';
 }
 return HAIR_ADJUSTMENT_KEY;
};
const frameCount=mode=>mode==='idle'?2:4;
const identity=()=>({x:0,y:0,scale:1});
export function normalizeAdjustment(value){
 const n=(key,fallback,min,max)=>Number.isFinite(value?.[key])?Math.max(min,Math.min(max,value[key])):fallback;
 return {x:n('x',0,-627,627),y:n('y',0,-627,627),scale:n('scale',1,.25,3)};
}
export function defaultHairAdjustment(style,mode='run'){
 const entry=mode==='run'?DEFAULT_RUN_HAIR_ADJUSTMENTS[style]:DEFAULT_IDLE_HAIR_ADJUSTMENTS[style];
 return {shared:normalizeAdjustment(entry?.shared),frames:Array.from({length:frameCount(mode)},(_,f)=>normalizeAdjustment(entry?.frames?.[f]))};
}
export function readHairAdjustments(mode='run'){
 let raw={};
 try{raw=JSON.parse(globalThis.localStorage?.getItem(storageKey(mode))||'{}')||{};}catch{}
 const result={};
 for(let i=0;i<20;i++)result[i]=raw[i]?{shared:normalizeAdjustment(raw[i].shared),frames:Array.from({length:frameCount(mode)},(_,f)=>normalizeAdjustment(raw[i].frames?.[f]))}:defaultHairAdjustment(i,mode);
 return result;
}
export function effectiveHairAdjustment(entry,frame){
 const a=normalizeAdjustment(entry?.shared),b=normalizeAdjustment(entry?.frames?.[frame]);
 return {x:a.x+b.x,y:a.y+b.y,scale:a.scale*b.scale};
}
export function hairAdjustmentRevision(mode='run'){
 try{return globalThis.localStorage?.getItem(storageKey(mode))||'';}catch{return '';}
}
export function saveHairAdjustments(entries,mode='run'){
 const clean={};
 for(let i=0;i<20;i++)if(entries[i])clean[i]={shared:normalizeAdjustment(entries[i].shared),frames:Array.from({length:frameCount(mode)},(_,f)=>normalizeAdjustment(entries[i].frames?.[f]))};
 if(!globalThis.localStorage)throw new Error('保存機能を利用できません');
 globalThis.localStorage.setItem(storageKey(mode),JSON.stringify(clean));
 return clean;
}
export function emptyHairAdjustment(){return {shared:identity(),frames:Array.from({length:4},identity)};}
