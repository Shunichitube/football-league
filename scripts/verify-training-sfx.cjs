const assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require('C:/Users/tube5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const root = path.resolve(__dirname, '..', 'dist');
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webp':'image/webp', '.mp3':'audio/mpeg'};
const server = http.createServer((req, res) => {
  if (req.url === '/_training-sfx-check') {
    res.writeHead(200, {'Content-Type':'text/html'}).end('<!doctype html><script type="importmap">{"imports":{"three":"/js/vendor/three/build/three.module.js","three/addons/":"/js/vendor/three/addons/"}}</script><button id="begin">開始</button><div id="app"><main class="growth-modal"></main></div>');
    return;
  }
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
    res.end(error ? 'Missing' : data);
  });
});
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await playwright.chromium.launch({headless:true, channel:'msedge'});
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/_training-sfx-check`);
    await page.evaluate(async () => {
      const {createSfxController, SFX_FILES} = await import('/js/sfx.js');
      const {playTrainingCinematic} = await import('/js/training-cinematic.js');
      const {createLeague} = await import('/js/league.js');
      window.completions = 0; window.trainingPlays = 0; window.lastVolume = null;
      document.addEventListener('football-league:training-completed', () => window.completions++);
      const audio = new Audio(SFX_FILES.training);
      await new Promise((resolve, reject) => { audio.onloadedmetadata = resolve; audio.onerror = () => reject(Error('Training MP3 could not decode')); audio.preload = 'metadata'; audio.load(); });
      if (!(audio.duration > 0)) throw Error('Training sound is empty');
      const storage = {getItem:() => '{"se":35}'};
      window.sfx = createSfxController({storage, createAudio:src => {
        const sound = new Audio(src), originalPlay = sound.play.bind(sound);
        sound.play = () => { if (src === SFX_FILES.training) { window.trainingPlays++; window.lastVolume = sound.volume; } return originalPlay(); };
        return sound;
      }});
      const club = createLeague({name:'効果音確認', color:'#ffffff', seed:'training-sound'}).clubs[0];
      window.train = () => playTrainingCinematic(club, document.createElement('div'));
      document.querySelector('#begin').addEventListener('click', () => { window.trainingDone = window.train(); });
    });
    await page.locator('#begin').click();
    assert.equal(await page.evaluate(() => window.trainingPlays), 0, 'No completion sound at training start');
    await page.evaluate(() => window.trainingDone);
    assert.deepEqual(await page.evaluate(() => [window.completions, window.trainingPlays, window.lastVolume]), [1, 1, .35]);
    await page.evaluate(() => {
      document.querySelector('#app').innerHTML = '';
      document.dispatchEvent(new CustomEvent('football-league:view-rendered'));
      document.querySelector('#app').innerHTML = '<main class="growth-modal"></main>';
    });
    await page.locator('#begin').click();
    await page.evaluate(() => { document.querySelector('#app').innerHTML = ''; document.dispatchEvent(new CustomEvent('football-league:view-rendered')); });
    await page.evaluate(() => window.trainingDone);
    assert.deepEqual(await page.evaluate(() => [window.completions, window.trainingPlays]), [1, 1], 'Cancelled training stays silent');
    await page.evaluate(() => { document.dispatchEvent(new CustomEvent('football-league:audio-settings', {detail:{se:0}})); document.dispatchEvent(new CustomEvent('football-league:training-completed')); window.sfx.dispose(); });
    assert.equal(await page.evaluate(() => window.trainingPlays), 1, 'Muted effects stay silent');
    assert.deepEqual(errors, []);
    console.log('PASS: supplied MP3 decodes; completion plays once at configured volume; start, cancellation and mute stay silent');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
