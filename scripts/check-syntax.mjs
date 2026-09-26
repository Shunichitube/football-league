// Parse and link only. No game module is evaluated and no browser/server is started.
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SourceTextModule } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function files(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...await files(path));
    else if (/\.(?:mjs|js)$/.test(path)) found.push(path);
  }
  return found;
}
const paths = (await Promise.all(['js','worker','scripts','tests'].map(dir => files(resolve(root,dir))))).flat();
for (const path of paths) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${relative(root,path)}\n${result.stderr}`);
}
const cache = new Map();
async function moduleFor(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const path = fileURLToPath(url);
  if (!path.startsWith(root + sep)) throw new Error(`Import outside repository: ${path}`);
  const module = new SourceTextModule(await readFile(path,'utf8'), { identifier: url.href });
  cache.set(url.href,module);
  return module;
}
for (const entry of ['js/app.js','worker/index.js']) {
  const module = await moduleFor(pathToFileURL(resolve(root,entry)));
  if (module.status === 'unlinked') await module.link((specifier, parent) => {
    if (!specifier.startsWith('.')) throw new Error(`Unexpected external import: ${specifier}`);
    return moduleFor(new URL(specifier,parent.identifier));
  });
}
for (const path of paths.filter(path => path.includes(`${sep}js${sep}`) || path.includes(`${sep}worker${sep}`))) {
  const source = await readFile(path,'utf8');
  if (/new\s+MutationObserver\s*\(/.test(source)) throw new Error(`DOM observer remains: ${relative(root,path)}`);
  if (/room-(?:client|adapter)\.js$/.test(path) && /\b(?:document|innerHTML|querySelector)\b/.test(source)) throw new Error(`DOM dependency in Room layer: ${relative(root,path)}`);
}
console.log(`PASS: ${paths.length} JavaScript files parsed; ${cache.size} module instances linked; Room/DOM boundaries checked.`);
console.log('No gameplay, browser, network, or Cloudflare runtime tests were run.');
