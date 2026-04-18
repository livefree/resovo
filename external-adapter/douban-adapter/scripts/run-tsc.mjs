import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findTscBin(startDir) {
  let currentDir = startDir;

  while (true) {
    const candidate = path.join(
      currentDir,
      'node_modules',
      'typescript',
      'bin',
      'tsc',
    );

    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

const tscBin = findTscBin(path.resolve(__dirname, '..'));

if (!tscBin) {
  console.error(
    'Unable to find TypeScript. Run `npm install` in this package before building.',
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [tscBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
