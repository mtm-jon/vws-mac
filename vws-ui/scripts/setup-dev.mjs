// Dev setup without a system Python: creates vws-backend/venv from the Python that
// fetch-python.mjs downloaded into build-resources/python, installs the backend's
// packages (pinned by constraints.txt) and the crawler's Chromium.
//   npm run setup:dev
// macOS ships Python 3.9, which is too old for the backend (3.10+), so this avoids
// needing Homebrew or a python.org install. Models download on the first start.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, '..', 'vws-backend');
const win = process.platform === 'win32';
const basePython = join(root, 'build-resources', 'python', win ? 'python.exe' : 'bin/python3');
const venvPython = join(backend, 'venv', win ? 'Scripts/python.exe' : 'bin/python');
const run = (cmd, args) => { console.log(`\n$ ${cmd} ${args.join(' ')}`); execFileSync(cmd, args, { stdio: 'inherit', cwd: backend }); };

if (!existsSync(basePython)) throw new Error(`${basePython} is missing. Run: node scripts/fetch-python.mjs`);
if (!existsSync(venvPython)) run(basePython, ['-m', 'venv', 'venv']);
run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip']);
run(venvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt', '-c', 'constraints.txt']);
run(venvPython, ['-m', 'playwright', 'install', 'chromium']);
console.log('\nBackend ready. Start the app with: npm run dev');
