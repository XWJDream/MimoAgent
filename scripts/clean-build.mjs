import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const outputDirs = ['dist', 'engine/dist'];

for (const dir of outputDirs) {
  rmSync(resolve(dir), { force: true, recursive: true });
}
