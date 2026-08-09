/// <reference types="vite/client" />
/// <reference types="canvaskit-wasm" />

declare module 'canvaskit-wasm/bin/full/canvaskit.js' {
  import type { CanvasKit } from 'canvaskit-wasm';
  const CanvasKitInit: (opts?: {
    locateFile?: (file: string) => string;
  }) => Promise<CanvasKit>;
  export default CanvasKitInit;
}
