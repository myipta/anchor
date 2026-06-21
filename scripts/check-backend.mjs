import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const files = [
  'worker.js',
  ...readdirSync('functions/api')
    .filter(file => file.endsWith('.js'))
    .map(file => join('functions/api', file)),
];

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
if (failed) process.exit(1);
console.log(`backend syntax ok (${files.length} files)`);
