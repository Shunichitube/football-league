import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayer,displayPlayer} from '../js/data.js';
import {createRandom} from '../js/random.js';
import {overallGrowthDirection,renderContractPlayerCard} from '../js/ui.js';
function player(position,value){const p=createPlayer('rating',position,createRandom('rating'));for(const key in p.stats)p.stats[key]=value;return p;}
for(const position of ['GK','DF','MF','FW'])test(`${position}: overall changes use the weighted rating and render a colored direction`,()=>{
 const p=player(position,72),club={lineup:[],color:'#ffffff',formation:'121'};
 const up=Object.keys(p.stats).map(key=>({key,fromValue:71,toValue:72}));
 assert.equal(overallGrowthDirection(p,up),1);
 const html=renderContractPlayerCard(p,club,up);
 assert.match(html,/<strong class="overall-rating">総合 C<strong class="ability-direction up" aria-label="総合力上昇">▲<\/strong><\/strong>/);
 const down=up.map(change=>({...change,fromValue:74}));
 assert.equal(overallGrowthDirection(p,down),-1);
 assert.match(renderContractPlayerCard(p,club,down),/overall-rating">総合 C<strong class="ability-direction down" aria-label="総合力下降">▼/);
 assert.equal(overallGrowthDirection(p,[]),0);
 assert.match(renderContractPlayerCard(p,club,[]),/overall-rating">総合 C<\/strong>/);
 // The marker also shows growth inside the same displayed rank, like skills.
 assert.equal(displayPlayer(player(position,71)).overallRank,'C');
});
test('an unweighted attribute change does not falsely increase GK overall',()=>{
 const p=player('GK',72);
 assert.equal(overallGrowthDirection(p,[{key:'stamina',fromValue:50,toValue:72}]),0);
});
