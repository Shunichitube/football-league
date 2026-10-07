import {mountDisplayFrame,reportDisplayView} from './display-settings.js?v=mobile-zoom-v5';

if(new URLSearchParams(location.search).get('game-frame')==='1'){
 if(new URLSearchParams(location.search).get('mobile-layout')==='1'){
  document.documentElement.classList.add('mobile-layout');
  document.addEventListener('football-league:view-rendered',()=>reportDisplayView());
 }
 const entry=document.querySelector('[data-game-entry]');
 // Both modules run in the same viewport; changing its size never reloads the game.
 await import(new URL(entry.dataset.app,document.baseURI).href);
 if(document.documentElement.classList.contains('mobile-layout'))reportDisplayView();
 await import(new URL(entry.dataset.arena,document.baseURI).href);
}else{
 mountDisplayFrame();
}
