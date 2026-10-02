// Offsets are in the 627px source frame; scaling is uniform about the hair center.
export const HAIR_ADJUSTMENT_KEY='football-league:run-hair-adjustments:v1';
const identity=()=>({x:0,y:0,scale:1});
export function normalizeAdjustment(value){
 const n=(key,fallback,min,max)=>Number.isFinite(value?.[key])?Math.max(min,Math.min(max,value[key])):fallback;
 return {x:n('x',0,-627,627),y:n('y',0,-627,627),scale:n('scale',1,.25,3)};
}
export function readHairAdjustments(){
 try{
  const raw=JSON.parse(globalThis.localStorage?.getItem(HAIR_ADJUSTMENT_KEY)||'{}'),result={};
  for(let i=0;i<20;i++)if(raw[i])result[i]={shared:normalizeAdjustment(raw[i].shared),frames:Array.from({length:4},(_,f)=>normalizeAdjustment(raw[i].frames?.[f]))};
  return result;
 }catch{return {};}
}
export function effectiveHairAdjustment(entry,frame){
 const a=normalizeAdjustment(entry?.shared),b=normalizeAdjustment(entry?.frames?.[frame]);
 return {x:a.x+b.x,y:a.y+b.y,scale:a.scale*b.scale};
}
export function hairAdjustmentRevision(){
 try{return globalThis.localStorage?.getItem(HAIR_ADJUSTMENT_KEY)||'';}catch{return '';}
}
export function saveHairAdjustments(entries){
 const clean={};
 for(let i=0;i<20;i++)if(entries[i])clean[i]={shared:normalizeAdjustment(entries[i].shared),frames:Array.from({length:4},(_,f)=>normalizeAdjustment(entries[i].frames?.[f]))};
 if(!globalThis.localStorage)throw new Error('保存機能を利用できません');
 globalThis.localStorage.setItem(HAIR_ADJUSTMENT_KEY,JSON.stringify(clean));
 return clean;
}
export function emptyHairAdjustment(){return {shared:identity(),frames:Array.from({length:4},identity)};}
