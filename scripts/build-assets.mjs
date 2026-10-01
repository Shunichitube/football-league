import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
if (relative(root, output) !== 'dist') throw new Error('Invalid asset output directory');
// Rebuild the generated directory so removed source assets cannot remain shipped.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of ['index.html', 'css', 'js', 'assets']) await cp(resolve(root, path), resolve(output, path), { recursive: true });
