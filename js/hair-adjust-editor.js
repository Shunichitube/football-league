import {MOTION_HAIR_LAYOUTS} from './motion-hair-layout.js?v=motion-ui-v8';
import {loadMotionAtlas} from './player-motion.js?v=motion-ui-v8';
import {HAIR_STYLES} from './avatar-profile.js?v=appearance-v29';
import {drawMotionHair,drawQuarterFace,motionHairBox} from './avatar-rendering.js?v=hair-editor-v1';
import {readHairAdjustments,saveHairAdjustments,effectiveHairAdjustment,defaultHairAdjustment} from './motion-hair-adjustments.js?v=motion-ui-v8';
const $=id=>document.getElementById(id),status=$('status');
const requestedMode=new URLSearchParams(location.search).get('motion');
const mode=['idle','shoot'].includes(requestedMode)?requestedMode:'run',layout=MOTION_HAIR_LAYOUTS[mode];
const modeLabel={idle:'待機',run:'走り・ドリブル',shoot:'シュート'}[mode];
$('motion').value=mode;
$('title').textContent=modeLabel+'の髪位置調整';
$('together-label').textContent=layout.frames+'コマまとめて調整';
$('hint').textContent='1コマだけ調整する場合は、まとめて調整のチェックを外してください。保存すると、このブラウザの'+modeLabel+'に反映されます。';
let boxes,source,factor;
let drafts=readHairAdjustments(mode),style=0,selected=0,drag=null,dirty=false;
const history=[];
const clone=value=>JSON.parse(JSON.stringify(value));
const entry=()=>drafts[style]||(drafts[style]=defaultHairAdjustment(style,mode));
function snapshot(){history.push(clone(drafts));if(history.length>40)history.shift();}
function changed(){dirty=true;status.textContent='未保存の調整があります。位置が合ったら「保存」を押してください。';}
HAIR_STYLES.forEach((name,i)=>$('hair').add(new Option(`${String(i+1).padStart(2,'0')} · ${name}`,i)));
let atlas;
try{atlas=await loadMotionAtlas();}catch(error){status.textContent='素材を読み込めませんでした。最新のファイルを取得して再読み込みしてください。';throw error;}
source=mode==='idle'?atlas.base:mode==='shoot'?atlas.shoot:atlas.run;factor=627/(source.width/layout.columns);
boxes=layout.boxes.map(box=>box.map(n=>n*factor));
const views=Array.from({length:layout.frames},(_,frame)=>{
 const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');
 caption.textContent=`コマ ${frame+1}`;canvas.width=627;canvas.height=627;canvas.setAttribute('aria-label',`コマ${frame+1}の髪位置調整`);
 figure.append(caption,canvas);$('views').append(figure);
 return {frame,figure,canvas,ctx:canvas.getContext('2d')};
});
function assetsFor(frame){return {...atlas.avatar,motionHairAdjustment:effectiveHairAdjustment(entry(),frame)};}
function rectFor(frame){return motionHairBox(assetsFor(frame),{hairStyle:style},boxes[frame]);}
function draw(){
 for(const v of views){
  const {ctx,frame,canvas}=v;ctx.clearRect(0,0,627,627);ctx.imageSmoothingEnabled=false;
  const cw=source.width/layout.columns,ch=source.height/layout.rows;
  ctx.drawImage(source,frame%layout.columns*cw,Math.floor(frame/layout.columns)*ch,cw,ch,0,0,627,627);
  const [x,y,w,h]=boxes[frame];if($('face').checked)drawQuarterFace(ctx,atlas.avatar,[x+w*.13,y+h*.14,w*.78,h*.86]);
  drawMotionHair(ctx,assetsFor(frame),{hairStyle:style,hairColor:0},boxes[frame]);
  v.figure.classList.toggle('selected',selected===frame);
  if($('bounds').checked){
   const [a,b,c,d]=rectFor(frame),unit=627/canvas.getBoundingClientRect().width;
   ctx.strokeStyle='#158164';ctx.lineWidth=2*unit;ctx.setLineDash([7*unit,5*unit]);ctx.strokeRect(a,b,c,d);ctx.setLineDash([]);
   for(const [hx,hy]of [[a,b],[a+c,b],[a,b+d],[a+c,b+d]]){ctx.fillStyle='#f3fffa';ctx.fillRect(hx-6*unit,hy-6*unit,12*unit,12*unit);ctx.strokeRect(hx-6*unit,hy-6*unit,12*unit,12*unit);}
  }
 }
}
function point(event,canvas){const r=canvas.getBoundingClientRect();return [(event.clientX-r.left)*627/r.width,(event.clientY-r.top)*627/r.height];}
for(const view of views){
 view.canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||drag)return;
  const frame=view.frame,p=point(event,view.canvas),r=rectFor(frame),[x,y,w,h]=r;
  selected=frame;const corners=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]],radius=12*627/view.canvas.getBoundingClientRect().width;
  const corner=$('bounds').checked?corners.findIndex(c=>Math.hypot(p[0]-c[0],p[1]-c[1])<radius):-1;
  if(corner<0&&(p[0]<x||p[0]>x+w||p[1]<y||p[1]>y+h)){draw();return;}
  snapshot();drag={frame,start:p,rect:r,corner,before:clone(entry()),together:$('together').checked,pointer:event.pointerId};
  view.canvas.setPointerCapture(event.pointerId);event.preventDefault();draw();
 });
 view.canvas.addEventListener('pointermove',event=>{
  if(!drag||drag.frame!==view.frame||drag.pointer!==event.pointerId)return;
  const p=point(event,view.canvas),a=drag.before,shared=drag.together,key=shared?a.shared:a.frames[view.frame];
  let dx=p[0]-drag.start[0],dy=p[1]-drag.start[1],ratio=1;
  if(drag.corner>=0){
   const [x,y,w,h]=drag.rect,right=drag.corner%2===1,bottom=drag.corner>=2;
   const fixedX=right?x:x+w,fixedY=bottom?y:y+h;
   ratio=Math.max((right?p[0]-fixedX:fixedX-p[0])/w,(bottom?p[1]-fixedY:fixedY-p[1])/h);
   ratio=Math.max(.25/key.scale,Math.min(3/key.scale,ratio));
   dx=(right?1:-1)*w*(ratio-1)/2;dy=(bottom?1:-1)*h*(ratio-1)/2;
  }
  drafts[style]=clone(a);const target=shared?drafts[style].shared:drafts[style].frames[view.frame];
  target.x=Math.max(-627,Math.min(627,key.x+dx));target.y=Math.max(-627,Math.min(627,key.y+dy));target.scale=key.scale*ratio;
  changed();draw();
 });
 const finish=event=>{if(drag?.pointer===event.pointerId){drag=null;draw();}};
 view.canvas.addEventListener('pointerup',finish);view.canvas.addEventListener('pointercancel',finish);
}
$('motion').onchange=()=>{
 const next=$('motion').value;$('motion').value=mode;
 if(next===mode)return;
 const url=new URL(location.href);url.searchParams.set('motion',next);url.searchParams.set('v','motion-ui-v9');location.assign(url.href);
};
$('hair').onchange=()=>{style=Number($('hair').value);draw();};
$('together').onchange=draw;$('face').onchange=draw;$('bounds').onchange=draw;
$('zoom').oninput=()=>{document.documentElement.style.setProperty('--size',$('zoom').value+'px');$('zoom-label').textContent=Math.round(Number($('zoom').value)/340*100)+'%';draw();};
$('undo').onclick=()=>{if(history.length){drafts=history.pop();changed();draw();}};
$('reset').onclick=()=>{snapshot();drafts[style]=defaultHairAdjustment(style,mode);changed();draw();};
$('save').onclick=()=>{
 try{drafts=saveHairAdjustments(drafts,mode);dirty=false;status.textContent='保存しました。モーション確認ページを開くと、選んだモーションに反映されます。';}
 catch{status.textContent='保存できませんでした。「設定を書き出す」で調整を残してください。';}
};
$('export').onclick=()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,motion:mode,hairstyles:drafts},null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=mode+'-hair-adjustments.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('import-button').onclick=()=>$('import').click();
$('import').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  const data=JSON.parse(await file.text());if((data.motion||'run')!==mode||data.version!==1||!data.hairstyles||Array.isArray(data.hairstyles)||typeof data.hairstyles!=='object')throw Error();
  snapshot();drafts=saveHairAdjustments(data.hairstyles,mode);dirty=false;status.textContent='設定を読み込み、保存しました。';draw();
 }catch{status.textContent='設定を読み込めませんでした。書き出したJSONファイルを選んでください。';}
 event.target.value='';
};
addEventListener('pageshow',event=>{if(event.persisted&&!dirty){drafts=readHairAdjustments(mode);draw();}});
addEventListener('storage',event=>{
 const key=mode==='idle'?'football-league:idle-hair-adjustments:v2':mode==='shoot'?'football-league:shoot-hair-adjustments:v1':'football-league:run-hair-adjustments:v1';
 if(event.key!==key&&event.key!==null)return;
 if(dirty){status.textContent='別の画面で設定が更新されました。現在の調整を保存するか、再読み込みしてください。';return;}
 drafts=readHairAdjustments(mode);history.length=0;draw();status.textContent='保存済みの位置を読み込みました。';
});
addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
status.textContent='髪をドラッグして位置を合わせてください。四隅のハンドルで大きさを変えられます。';draw();
