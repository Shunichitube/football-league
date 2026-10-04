import {mountDisplayFrame} from './display-settings.js?v=fixed-display-v1';

if(new URLSearchParams(location.search).get('game-frame')==='1'){
 const entry=document.querySelector('[data-game-entry]');
 // Both modules run in the same viewport; changing its size never reloads the game.
 await import(new URL(entry.dataset.app,document.baseURI).href);
 await import(new URL(entry.dataset.arena,document.baseURI).href);
}else{
 mountDisplayFrame();
}
