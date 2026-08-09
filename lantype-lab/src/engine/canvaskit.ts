/**
 * Chargement de CanvasKit (Skia compile en WebAssembly).
 *
 * IMPORTANT : on charge le build `bin/full/` (meme que @shopify/react-native-skia),
 * qui inclut RuntimeEffect. Le build standard ne le contient pas.
 */
import CanvasKitInit from 'canvaskit-wasm/bin/full/canvaskit.js';
import type { CanvasKit } from 'canvaskit-wasm';

let pending: Promise<CanvasKit> | null = null;

export function loadCanvasKit(): Promise<CanvasKit> {
  if (!pending) {
    pending = CanvasKitInit({ locateFile: () => '/canvaskit.wasm' });
  }
  return pending;
}

export type { CanvasKit };
