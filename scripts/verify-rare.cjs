const {chromium}=require('C:/Users/tube5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.css':'text/css'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/assets/avatars/rare-preview.html?v=rare-fit-v5`);
 await page.waitForFunction(()=>document.querySelectorAll('#preview canvas').length===10);
 const result=await page.evaluate(async()=>{
  const {loadMotionAtlas,drawMotion}=await import('/js/player-motion.js?v=motion-ui-v24');
  const {drawRareMotion,drawRarePortrait}=await import('/js/rare-avatar.js?v=rare-fit-v5');
  const {RARE_CHARACTERS}=await import('/js/rare-characters.js');
  const atlas=await loadMotionAtlas();let checked=0;
  for(const kind of Object.keys(RARE_CHARACTERS))for(const [motion,fps,frames] of [['idle',2,2],['run',6,2],['dribble',6,2],['shoot',8,4],['celebrate',3,2]])for(const [width,height] of [[480,480],[300,470],[420,550],[160,90]])for(const direction of ['left','right'])for(let frame=0;frame<(kind==='black_hole'?8:['king_kong','robot'].includes(kind)&&['run','dribble'].includes(motion)?4:frames);frame++){
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
   drawRareMotion(ctx,atlas.avatar.rare,{rareCharacter:kind},motion,(frame+.01)/(kind==='black_hole'?8:['king_kong','robot'].includes(kind)&&['run','dribble'].includes(motion)?8:fps),{direction,ball:motion==='dribble',loop:true});
   const data=ctx.getImageData(0,0,width,height).data;let visible=0;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>16){visible++;if(x===0||y===0||x===width-1||y===height-1)throw Error(`${kind}/${motion}/${frame} touches edge ${width}x${height}`);}
   if(!visible)throw Error('Empty rare frame');checked++;
  }
  for(const kind of ['king_kong','robot']){if(!atlas.avatar.rare[kind].motions.src.endsWith(kind+'-motions-approved-v1.png'))throw Error('Old asset loaded');const frames=[];for(let frame=0;frame<4;frame++){const c=document.createElement('canvas');c.width=c.height=480;drawMotion(c.getContext('2d'),atlas,'run',(frame+.01)/8,{appearance:{rareCharacter:kind}});const run=c.toDataURL();drawMotion(c.getContext('2d'),atlas,'dribble',(frame+.01)/8,{appearance:{rareCharacter:kind},ball:false});if(c.toDataURL()!==run)throw Error('Run/dribble mismatch');frames.push(run);}if(new Set(frames).size!==4)throw Error('Movement does not contain four unique frames');}
  const main=document.querySelector('main');main.innerHTML='<h1>反映後のモーション確認</h1><p>左：通常選手　中央：レア待機　右：レア移動</p>';const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(3,240px);gap:12px';main.append(grid);
  for(const kind of Object.keys(RARE_CHARACTERS))for(let version=0;version<3;version++){
   const card=document.createElement('div');card.textContent=version===0?'通常選手':RARE_CHARACTERS[kind].name+(version===1?'・待機':'・移動');
   const canvas=document.createElement('canvas');canvas.width=480;canvas.height=480;canvas.style.cssText='display:block;width:240px;height:240px;background:#18362e';card.append(canvas);grid.append(card);const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
   if(version===0)drawMotion(ctx,atlas,'idle',0,{appearance:{hairStyle:0}});
   else if(version===1)drawRareMotion(ctx,atlas.avatar.rare,{rareCharacter:kind},'idle',0);
   else drawRareMotion(ctx,atlas.avatar.rare,{rareCharacter:kind},'run',0);
  }
  return {checked};
 });
 await page.screenshot({path:path.join(root,'rare-motion-integrated-review.png'),fullPage:true});if(errors.length)throw Error(errors.join('\n'));console.log(`PASS: ${result.checked} rare motion frames checked in four canvas sizes and both directions; no empty frames or edge clipping.`);
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
