import {grandResults,formatPt} from './grand-results.js';
import {loadMotionAtlas} from './player-motion.js?v=motion-cleanup-v2';
import {playerAppearance} from './avatar-profile.js?v=appearance-v29';
import {celebrationTexture,drawCelebration} from './avatar-celebration.js?v=joy-arms-front-v5';
import {drawAvatar} from './player-avatar.js?v=season-finale-v1';

export function renderGrandResults(league, humanId, e) {
  const result=grandResults(league);
  const clubName=club=>`<span class="grand-club" style="--club:${e(club.color)}"><i></i>${e(club.name)}</span>`;
  return `<main class="grand-results"><div class="grand-results-scroll"><p class="eyebrow">10 SEASONS COMPLETE</p><h1>10シーズンの総合結果</h1><section class="grand-champions"><p>${result.winners.length>1?'同率総合優勝':'総合優勝'}</p><h2>${result.winners.map(row=>clubName(row.club)).join(' ／ ')}</h2><strong>${formatPt(result.winners[0]?.total||0)} <small>総合Pt</small></strong></section><div class="table-wrap"><table><thead><tr><th>順位</th><th>クラブ</th><th>順位Pt</th><th>MVP</th><th>TOP5</th><th>通算表彰</th><th>総合Pt</th></tr></thead><tbody>${result.rows.map(row=>`<tr class="${row.club.id===humanId?'you':''}"><td>${row.rank}</td><td>${clubName(row.club)}</td><td>${row.leaguePt}</td><td>${row.mvpPt}</td><td>${row.top5Pt}</td><td>${formatPt(row.bonusPt)}</td><td><b>${formatPt(row.total)}</b></td></tr>`).join('')}</tbody></table></div><p class="grand-rule">同点時：リーグ優勝回数 → 通算勝点 → 同率総合優勝</p><section class="grand-award-list">${result.awards.map(award=>`<article><h3>通算${e(award.title)}</h3>${award.winners.length?award.winners.map(w=>`<p><b>${e(w.player?.name||w.club.name)}</b>　${w.value}${e(award.unit)}</p><small>${w.shares.map(share=>`${e(share.club.name)} ＋${formatPt(share.pt)}Pt`).join(' ／ ')||'旧データ：所属別実績が未記録のため加点なし'}</small>`).join(''):'<p>記録なし</p>'}</article>`).join('')}</section><details class="grand-season-detail"><summary>クラブ別のシーズンPt内訳</summary>${result.rows.map(row=>`<h3>${clubName(row.club)}</h3><div class="table-wrap"><table><thead><tr><th>シーズン</th><th>順位</th><th>順位Pt</th><th>MVP</th><th>TOP5</th><th>合計</th></tr></thead><tbody>${row.seasons.map(season=>`<tr><td>${season.season}</td><td>${season.rank}</td><td>${season.leaguePt}</td><td>${season.mvpPt}</td><td>${season.top5Pt}</td><td>${season.total}</td></tr>`).join('')}</tbody></table></div>`).join('')}</details></div><nav class="grand-actions"><button data-ending="details">シーズン詳細</button><button data-ending="replay" class="subtle">エンドロールをもう一度</button><button data-a="title" class="subtle">ホーム画面に戻る</button></nav></main>`;
}

// Each screen owns its animation and controls. Disposal also invalidates asset loading.
export function mountGrandFinale(host, league, e, onDone) {
  const result=grandResults(league), reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const overlay=document.createElement('section');overlay.className='grand-ending';overlay.setAttribute('aria-label','10シーズンのエンドロール');
  overlay.innerHTML='<div class="ending-stage"><div class="ending-copy" aria-live="polite"></div><canvas class="ending-cast" width="1600" height="900" aria-hidden="true"></canvas><div class="ending-confetti" aria-hidden="true"></div></div><nav class="ending-controls"><button data-ending-next>次へ</button><button data-ending-skip class="subtle">結果へスキップ</button></nav>';
  host.append(overlay);
  const copy=overlay.querySelector('.ending-copy'),canvas=overlay.querySelector('canvas'),ctx=canvas.getContext('2d');
  const allPlayers=league.clubs.flatMap(club=>club.roster.map(player=>({player,club})));
  const clubFor=winner=>winner.shares[0]?.club || allPlayers.find(row=>row.player.id===winner.player?.id)?.club || league.clubs[0];
  const awardScenes=result.awards.flatMap(award=>award.winners.map(winner=>({kind:'award',award,winner})));
  const groups=result.winners.length<=3?[result.winners]:result.winners.map(winner=>[winner]);
  const scenes=[{kind:'intro'},...awardScenes,...groups.map((winners,i)=>({kind:'champion',winners,last:i===groups.length-1}))];
  let index=0,elapsed=0,lastTime=0,frame=0,alive=true,atlas=null;
  const portraits=new Map();
  const close=()=>{dispose();onDone();};
  function show() {
    elapsed=0;copy.classList.remove('is-champion');copy.classList.remove('is-arriving');void copy.offsetWidth;copy.classList.add('is-arriving');
    const scene=scenes[index], next=overlay.querySelector('[data-ending-next]');
    overlay.classList.toggle('celebrating',scene.kind==='champion');
    if(scene.kind==='intro')copy.innerHTML='<p>FOOTBALL LEAGUE</p><h1>10シーズンの軌跡</h1><p>クラブと選手たちの歩み</p>';
    else if(scene.kind==='award') {
      const {award,winner}=scene;
      copy.innerHTML=`<p>10シーズン通算${e(award.title)}</p><h1>${e(winner.player?.name||winner.club.name)}</h1><strong>${winner.value}<small>${e(award.unit)}</small></strong><p class="ending-shares">${winner.shares.map(share=>`${e(share.club.name)} ＋${formatPt(share.pt)}Pt`).join(' ／ ')||'所属別実績が未記録のため加点なし'}</p>`;
    } else {
      copy.classList.add('is-champion');
      copy.innerHTML=`<p>${result.winners.length>1?'同率総合優勝':'総合優勝'}</p><h1>${scene.winners.map(row=>e(row.club.name)).join(' ／ ')}</h1><strong>${formatPt(scene.winners[0].total)}<small>総合Pt</small></strong>${result.winners.length>3?`<p>${index-awardScenes.length} / ${result.winners.length}クラブ</p>`:''}<div class="ending-club-labels">${scene.winners.map(row=>`<span style="--club:${e(row.club.color)}">${e(row.club.name)}</span>`).join('')}</div>`;
    }
    next.textContent=scene.kind==='champion'&&scene.last?'結果を見る':'次へ';
  }
  function advance(){if(index===scenes.length-1)return close();index++;show();}
  function click(event){if(event.target.closest('[data-ending-next]'))advance();else if(event.target.closest('[data-ending-skip]'))close();}
  overlay.addEventListener('click',click);
  for(let i=0;i<65;i++){const piece=document.createElement('i');piece.style.cssText=`--x:${(i*47)%100}%;--delay:${-(i%13)*.3}s;--duration:${3+i%5*.4}s;--hue:${i%3===0?45:i%3===1?160:340}`;overlay.querySelector('.ending-confetti').append(piece);}
  function actor(player,club,x,y,height,t,joy) {
    if(!atlas)return;
    const key=player.id+':'+club.id;
    const surface=joy?celebrationTexture(atlas,playerAppearance(player),{kit:club.color,goalkeeper:player.primaryPosition==='GK',pose:reduced?1:Math.floor(t*3)%4}):portraits.get(key)||document.createElement('canvas');
    if(!joy&&!portraits.has(key)){surface.width=300;surface.height=470;drawAvatar(surface.getContext('2d'),atlas.avatar,playerAppearance({...player,primaryPosition:player.primaryPosition||player.position}),{kit:club.color,goalkeeper:(player.primaryPosition||player.position)==='GK'});portraits.set(key,surface);}
    if(joy)drawCelebration(ctx,surface,x,y,height);
    else {ctx.imageSmoothingEnabled=false;ctx.drawImage(surface,x-height*300/470/2,y-height,height*300/470,height);}
  }
  function paint(timestamp){
    if(!alive)return;
    const dt=lastTime?Math.min(.1,(timestamp-lastTime)/1000):0;lastTime=timestamp;elapsed+=dt;
    const scene=scenes[index];ctx.clearRect(0,0,1600,900);
    const arrival=reduced?1:Math.min(1,elapsed/1.3),offset=-650*(1-arrival)**3;
    if(scene.kind==='award'&&scene.winner.player)actor(scene.winner.player,clubFor(scene.winner),800,650+offset,260,elapsed,false);
    if(scene.kind==='champion'){
      const count=scene.winners.length,width=1300/count;
      scene.winners.forEach((row,group)=>{
        const members=row.club.roster.slice(0,12),start=150+group*width;
        const height=count===1?175:count===2?145:125;
        const columns=count===1?12:6;
        members.forEach((player,i)=>{
          const x=start+width/columns*(i%columns+.5),back=count===1?0:Math.floor(i/columns);
          actor(player,row.club,x,(count===1?690:back?710:650)+offset,height,elapsed+i*.19,true);
        });
      });
    }
    if(scene.kind!=='champion'&&elapsed>=5)advance();
    else if(scene.kind==='champion'&&!scene.last&&elapsed>=7)advance();
    if(alive)frame=requestAnimationFrame(paint);
  }
  function dispose(){alive=false;cancelAnimationFrame(frame);overlay.removeEventListener('click',click);overlay.remove();}
  loadMotionAtlas().then(value=>{if(alive)atlas=value;}).catch(error=>console.error('Ending avatars unavailable',error));
  show();frame=requestAnimationFrame(paint);return dispose;
}
