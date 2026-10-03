const {chromium}=require('C:/Users/tube5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.css':'text/css'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/assets/avatars/motion-preview.html?v=motion-ui-v16`);
 await page.waitForFunction(()=>document.querySelectorAll('main canvas').length>=6);
 const count=await page.evaluate(async()=>{
  const {loadMotionAtlas,drawMotion}=await import('/js/player-motion.js?v=motion-ui-v16');const atlas=await loadMotionAtlas();
  const {celebrationTexture}=await import('/js/avatar-celebration.js?v=motion-ui-v16');
  const main=document.querySelector('main');main.innerHTML='';main.style.display='grid';main.style.gridTemplateColumns='repeat(8, 1fr)';main.style.gap='0';
  let count=0;
  for(let hairStyle=0;hairStyle<20;hairStyle++)for(const motion of ['dribble','shoot'])for(let frame=0;frame<4;frame++){
   const canvas=document.createElement('canvas');canvas.width=200;canvas.height=200;canvas.style.width='130px';canvas.style.height='130px';
   drawMotion(canvas.getContext('2d'),atlas,motion,(frame+.01)/8,{goalkeeper:true,appearance:{hairStyle},kit:'#ff0000',ball:false});
   if(!canvas.getContext('2d').getImageData(0,0,200,200).data.some((v,i)=>i%4===3&&v>0))throw Error('Empty goalkeeper frame');
   main.append(canvas);count++;
  }
  for(let hairStyle=0;hairStyle<20;hairStyle++)for(let frame=0;frame<4;frame++)celebrationTexture(atlas,{hairStyle},{goalkeeper:true,pose:frame});
  return count;
 });
 await page.screenshot({path:path.join(root,'keeper-motion-review.png'),fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));console.log(`PASS: ${count} goalkeeper dribble/kick frames and 80 celebration frames rendered without browser errors.`);
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
