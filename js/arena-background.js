import { mountDraftHall } from './draft-hall.js?v=1.1.1-refactor';
const mountArena=host=>import('./season-three/home.js?v=home-stadium-v2').then(module=>module.mountHomeStadium(host));

// A screen lifetime owns every animation/listener. Navigation destroys it.
const app=document.querySelector('#app');
let current=null,dispose=null,generation=0;
// Match the fixed CSS background's cover transform (source image: 1672 x 941).
export function draftVenueAnchors(width,height){
 const scale=Math.max(width/1672,height/941),offsetY=(height-941*scale)/2;
 return {podiumY:offsetY+239*scale,cardsY:offsetY+304*scale};
}
function alignDraftVenue(){
 const grid=app.querySelector(':scope > main.screen-draft .draft-card-grid');
 if(!grid)return;
 const {podiumY,cardsY}=draftVenueAnchors(innerWidth,innerHeight);
 document.body.style.setProperty('--draft-podium-y',`${podiumY}px`);
 // Measure normal flow without the existing margin so repeated renders do not drift.
 const flowY=grid.getBoundingClientRect().top+scrollY-(parseFloat(getComputedStyle(grid).marginTop)||0);
 document.body.style.setProperty('--draft-grid-gap',`${Math.max(16,cardsY-flowY)}px`);
 // Use the free space below the cards, keeping the fixed action dock clear.
 if(innerWidth>=761){
  const gridTop=flowY+Math.max(16,cardsY-flowY);
  const dock=app.querySelector(':scope > main.screen-draft .draft-action-dock');
  // The marked floor boundary is about 87% down the visible venue.
  const gridBottom=Math.min(dock?.getBoundingClientRect().top??innerHeight-110,innerHeight*.87);
  document.body.style.setProperty('--draft-grid-height',`${Math.max(180,gridBottom-gridTop-14)}px`);
 }else{
  document.body.style.removeProperty('--draft-grid-height');
 }
}
function sync(){
  const title=app.querySelector(':scope > .arena-title')?'title':app.querySelector(':scope > main.screen-draft')?'draft':app.querySelector(':scope > main.auction-room')?'auction':app.querySelector(':scope > main.screen-season-results')?'season-results':app.querySelector(':scope > main.contract-room, :scope > main.release-office')?'contract':app.querySelector(':scope > main.development-room')?'development':null;
  if(title==='auction')document.body.style.setProperty('--auction-header-bottom',`${Math.max(0,app.querySelector(':scope > header')?.getBoundingClientRect().bottom||0)}px`);
  if(title==='season-results')document.body.style.setProperty('--results-header-bottom',`${Math.max(0,app.querySelector(':scope > header')?.getBoundingClientRect().bottom||0)}px`);
  if(title==='draft')alignDraftVenue();
  if(title===current)return;
  current=title;generation++;const token=generation;
  dispose?.();dispose=null;
  document.body.classList.remove('arena-fallback');
  document.querySelector('#arena-background')?.remove();
  document.body.classList.toggle('arena-active',title==='title');
  document.body.classList.toggle('draft-hall-active',title==='draft');
  document.body.classList.toggle('auction-hall-active',title==='auction');
  document.body.classList.toggle('season-results-hall-active',title==='season-results');
  document.body.classList.toggle('contract-office-active',title==='contract');
  document.body.classList.toggle('development-room-active',title==='development');
  if(!title)return;
  // The auction has its own full-viewport venue image; the draft canvas belongs to the draft screen.
  if(title==='auction'||title==='season-results'||title==='contract'||title==='development')return;
  const canvas=document.createElement(title==='title'?'div':'canvas');canvas.id='arena-background';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
  (title!=='title'?mountDraftHall(canvas):mountArena(canvas)).then(cleanup=>{if(token!==generation)cleanup();else dispose=cleanup;}).catch(error=>{
    if(token!==generation)return;
    canvas.remove();document.body.classList.add('arena-fallback');
    console.error('Arena art could not load; game controls remain available.',error);
  });
}
document.addEventListener('football-league:view-rendered',sync);sync();
addEventListener('resize',sync);
