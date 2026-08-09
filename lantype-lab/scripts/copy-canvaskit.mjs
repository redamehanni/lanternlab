/**
 * Copie le binaire CanvasKit dans public/ pour qu'il soit servi par Vite.
 *
 * La version est volontairement celle embarquee par @shopify/react-native-skia
 * cote mobile : c'est ce qui garantit que le meme SkSL est compile par le meme
 * Skia dans le labo et dans l'application.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const source = resolve(root, 'node_modules/canvaskit-wasm/bin/full/canvaskit.wasm');
const targetDir = resolve(root, 'public');
const target = resolve(targetDir, 'canvaskit.wasm');

if (!existsSync(source)) {
  console.error(`[lantype-lab] canvaskit.wasm introuvable : ${source}`);
  console.error('[lantype-lab] Lance `npm install` dans lantype-lab/ avant `npm run dev`.');
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log('[lantype-lab] canvaskit.wasm copie dans public/');
