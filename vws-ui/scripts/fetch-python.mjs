// Downloads a self-contained Python (python-build-standalone) into
// build-resources/python, which electron-builder ships as resources/python.
// The installer runs vws-backend/setup_runtime.py with it to build the real
// environment (PyTorch for the GPU or CPU, packages, models) on the user's machine.
//
//   node scripts/fetch-python.mjs                  # build for this machine (Windows x64 or macOS arm64/x64)
//   node scripts/fetch-python.mjs --platform=win   # Windows x64 (what the NSIS installer needs)
//   node scripts/fetch-python.mjs --platform=mac   # macOS, this machine's architecture (what the .dmg needs)
//   node scripts/fetch-python.mjs --force          # re-download
// Env: VWS_PYTHON_URL   exact .tar.gz to use instead of the latest release
//      VWS_PYTHON_MINOR Python minor version (default 3.13, matching the dev venv)
//      VWS_PYTHON_TARGET target triple (overrides --platform), e.g. aarch64-apple-darwin
import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'build-resources');
const pyDir = join(outDir, 'python');
const minor = process.env.VWS_PYTHON_MINOR || '3.13';
const platformArg = (process.argv.find(x => x.startsWith('--platform=')) || '').split('=')[1]
  || (process.platform === 'darwin' ? 'mac' : 'win');
const macTarget = process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
const target = process.env.VWS_PYTHON_TARGET || (platformArg === 'mac' ? macTarget : 'x86_64-pc-windows-msvc');
const force = process.argv.includes('--force');
const stamp = join(outDir, 'python.source.txt');

async function latestAssetUrl() {
  const headers = { 'User-Agent': 'vws-build', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch('https://api.github.com/repos/astral-sh/python-build-standalone/releases?per_page=5', { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const re = new RegExp(`^cpython-${minor.replace('.', '\\.')}\\.\\d+\\+\\d+-${target}-install_only\\.tar\\.gz$`);
  for (const rel of await res.json()) {
    const a = (rel.assets || []).find(x => re.test(x.name));
    if (a) return a.browser_download_url;
  }
  throw new Error(`No ${minor} ${target} install_only build in the latest python-build-standalone releases.`);
}

const exe = target.includes('windows') ? join(pyDir, 'python.exe') : join(pyDir, 'bin', 'python3');
const have = existsSync(exe) && existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : '';
let url = process.env.VWS_PYTHON_URL;
if (!url) {
  try {
    url = await latestAssetUrl();
  } catch (e) {
    // GitHub unreachable or rate-limited: keep the Python that's already here if it's the right build.
    if (force || !have.includes(`-${target}-`) || !have.includes(`cpython-${minor}.`)) throw e;
    console.warn(`Couldn't check for a newer Python (${e.message}); using the one in build-resources/python (${have.split('/').pop()})`);
    process.exit(0);
  }
}
if (!force && have === url) {
  console.log(`Python already in build-resources/python (${url.split('/').pop()})`);
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
rmSync(pyDir, { recursive: true, force: true });
const tgz = join(outDir, 'python.tar.gz');
console.log(`Downloading ${url}`);
const res = await fetch(url, { headers: { 'User-Agent': 'vws-build' } });
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
await pipeline(Readable.fromWeb(res.body), createWriteStream(tgz));
// The archive's top folder is python/. tar ships with Windows 10+ (bsdtar) and every Linux/macOS.
execFileSync('tar', ['-xzf', tgz, '-C', outDir], { stdio: 'inherit' });
rmSync(tgz, { force: true });
if (!existsSync(exe)) throw new Error(`Extracted, but ${exe} is missing.`);
writeFileSync(stamp, url + '\n');
console.log(`Python ready in ${pyDir}`);
