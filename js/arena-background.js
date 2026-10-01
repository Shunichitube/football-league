import { mountDraftHall } from './draft-hall.js?v=1.1.1-refactor';
import { mountArena } from './arena-scene.js?v=appearance-v20';

// A screen lifetime owns every animation/listener. Navigation destroys it.
const app=document.querySelector('#app');
let current=null,dispose=null,generation=0;
function sync(){
  const title=app.querySelector(':scope > .arena-title')?'title':app.querySelector(':scope > main.screen-draft')?'draft':app.querySelector(':scope > main.auction-room')?'auction':null;
  if(title==='auction')document.body.style.setProperty('--auction-header-bottom',`${Math.max(0,app.querySelector(':scope > header')?.getBoundingClientRect().bottom||0)}px`);
  if(title===current)return;
  current=title;generation++;const token=generation;
  dispose?.();dispose=null;
  document.body.classList.remove('arena-fallback');
  document.querySelector('#arena-background')?.remove();
  document.body.classList.toggle('arena-active',title==='title');
  document.body.classList.toggle('draft-hall-active',title==='draft');
  document.body.classList.toggle('auction-hall-active',title==='auction');
  if(!title)return;
  // The auction has its own full-viewport venue image; the draft canvas belongs to the draft screen.
  if(title==='auction')return;
  const canvas=document.createElement('canvas');canvas.id='arena-background';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
  (title!=='title'?mountDraftHall(canvas):mountArena(canvas)).then(cleanup=>{if(token!==generation)cleanup();else dispose=cleanup;}).catch(error=>{
    if(token!==generation)return;
    canvas.remove();document.body.classList.add('arena-fallback');
    console.error('Arena art could not load; game controls remain available.',error);
  });
}
document.addEventListener('football-league:view-rendered',sync);sync();
addEventListener('resize',sync);
