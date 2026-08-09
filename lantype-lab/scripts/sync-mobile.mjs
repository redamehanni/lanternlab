/**
 * Copie un preset labo + le runtime SkSL partage vers mobile/.
 *
 * Usage :
 *   npm run sync:mobile -- glass-v1
 *   npm run sync:mobile -- ./chemin/export.json
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '..');
const outDir = resolve(repo, 'mobile/src/theme/materials/glass');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: npm run sync:mobile -- <preset-id|chemin.json>');
  process.exit(1);
}

let presetPath;
if (arg.endsWith('.json') || arg.includes('/') || arg.includes('\\')) {
  presetPath = resolve(process.cwd(), arg);
} else {
  presetPath = resolve(root, 'presets/glass', `${arg}.json`);
}

if (!existsSync(presetPath)) {
  console.error(`Preset introuvable : ${presetPath}`);
  process.exit(1);
}

const preset = JSON.parse(readFileSync(presetPath, 'utf-8'));
mkdirSync(outDir, { recursive: true });

// 1. Runtime partage (shader + planFromPreset + backgroundUniforms)
const runtimeEntry = resolve(root, 'src/materials/glass/runtimeForMobile.ts');
const runtimeOut = resolve(outDir, 'runtime.js');
const build = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    '--yes',
    'esbuild',
    runtimeEntry,
    '--bundle',
    '--format=esm',
    '--platform=neutral',
    `--outfile=${runtimeOut}`,
    '--target=es2019',
  ],
  { cwd: root, encoding: 'utf-8' },
);

if (build.status !== 0) {
  console.error(build.stderr || build.stdout);
  process.exit(build.status || 1);
}

// 2. Preset actif
copyFileSync(presetPath, resolve(outDir, 'active.json'));
writeFileSync(
  resolve(outDir, 'meta.json'),
  `${JSON.stringify(
    {
      syncedAt: new Date().toISOString(),
      presetId: preset.id || basename(presetPath, '.json'),
      name: preset.name || 'untitled',
      source: 'lantype-lab',
      from: presetPath,
    },
    null,
    2,
  )}\n`,
  'utf-8',
);

// 3. Re-export Metro-friendly
writeFileSync(
  resolve(outDir, 'index.js'),
  `/**
 * Materiau verre LANTYP — genere depuis le Material Lab.
 * Ne pas editer a la main : cd lantype-lab && npm run sync:mobile -- <preset>
 */
export {
  buildGlassShader,
  samplesForQuality,
  planFromPreset,
  backgroundUniforms,
} from './runtime.js';
export { default as activePreset } from './active.json';
`,
  'utf-8',
);

console.log(`[sync:mobile] preset → ${resolve(outDir, 'active.json')}`);
console.log(`[sync:mobile] runtime → ${runtimeOut}`);
console.log(`[sync:mobile] id=${preset.id || '?'} name=${preset.name || '?'}`);
