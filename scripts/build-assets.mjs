import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
rmSync(fileURLToPath(output), { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const path of ['index.html', 'css', 'js']) {
  cpSync(new URL(path, root), new URL(path, output), { recursive: true });
}
