import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const preloadDir = resolve('dist/preload');

mkdirSync(preloadDir, { recursive: true });
writeFileSync(resolve(preloadDir, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
