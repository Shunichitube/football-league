const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require('C:/Users/tube5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }

const root = path.resolve(__dirname, '..', 'dist');
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webp':'image/webp', '.json':'application/json'};
const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.resolve(root, '.' + (requestPath === '/' ? '/index.html' : requestPath));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
    res.end(error ? 'Missing' : data);
  });
});

(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = process.argv[2] || `http://127.0.0.1:${server.address().port}/`;
    browser = await playwright.chromium.launch({headless:true, channel:'msedge'});
    for (const viewport of [{width:1280, height:900}, {width:390, height:844}]) {
      const page = await browser.newPage({viewport});
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => { errors.push(dialog.message()); void dialog.dismiss(); });
      await page.goto(url);
      await page.locator('[data-a="setup"]').click();
      const panel = page.locator('[data-ui-dialog="entry"]');
      assert.equal(await panel.locator('[data-a="start"]').evaluate(button => getComputedStyle(button).pointerEvents), 'auto', 'Setup buttons must accept pointer input');
      await panel.locator('#name').click();
      await panel.locator('#name').fill('動作確認クラブ');
      await panel.getByRole('button', {name:'戻る', exact:true}).click();
      await page.locator('[data-room="open"]').click();
      await panel.locator('#room-name').click();
      await panel.locator('#room-name').fill('動作確認クラブ');
      await panel.locator('[data-dialog-close]').click();
      await page.locator('[data-a="setup"]').click();
      await panel.locator('#name').click();
      await panel.locator('#name').fill('動作確認クラブ');
      await panel.locator('[data-a="start"]').click();
      await page.locator('main.screen-draft').waitFor();
      assert.equal(await panel.count(), 0, 'Entry popup closes after starting');
      assert.deepEqual(errors, [], 'Entry flow has no script errors or alerts');
      console.log(`PASS ${viewport.width}px: setup input, back, multiplayer input, close, and start to draft`);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
