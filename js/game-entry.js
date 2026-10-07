import {mountDisplayFrame,mobileDisplayEnabled,gameEntryMode} from './display-settings.js?v=mobile-native-v6';

// Phones run one game directly in the real viewport. No scaled QHD iframe.
if(gameEntryMode()==='game'){
 if(mobileDisplayEnabled()||new URLSearchParams(location.search).get('mobile-layout')==='1'){
  document.documentElement.classList.add('mobile-layout');
 }
 const entry=document.querySelector('[data-game-entry]');
 await import(new URL(entry.dataset.app,document.baseURI).href);
 await import(new URL(entry.dataset.arena,document.baseURI).href);
}else{
 mountDisplayFrame();
}
