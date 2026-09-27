import { mountArena } from './arena-scene.js?v=1.3.0';

// A screen lifetime owns every animation/listener. Navigation destroys it.
const app=document.querySelector('#app');
let current=null,dispose=null,generation=0;
function sync(){
  const title=app.querySelector(':scope > .arena-title');
  if(title===current)return;
  current=title;generation++;const token=generation;
  dispose?.();dispose=null;
  document.querySelector('#arena-background')?.remove();
  document.body.classList.toggle('arena-active',!!title);
  if(!title)return;
  const canvas=document.createElement('canvas');canvas.id='arena-background';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
  mountArena(canvas).then(cleanup=>{if(token!==generation)cleanup();else dispose=cleanup;}).catch(error=>{
    if(token!==generation)return;
    canvas.remove();document.body.classList.add('arena-fallback');
    console.error('Arena art could not load; game controls remain available.',error);
  });
}
new MutationObserver(sync).observe(app,{childList:true});sync();
