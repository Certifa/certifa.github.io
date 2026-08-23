import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * CanvasKit and the site's two faces, initialised once and reused by every
 * image route. Extracted from the OG card route when the profile banner
 * needed the same setup: loading the wasm and the fonts twice per build is
 * both slow and a second place for the font paths to drift.
 */
let _ck: any;
let _fontMgr: any;

export async function getCanvas() {
  if (_ck) return { CanvasKit: _ck, fontMgr: _fontMgr };
  const require = createRequire(import.meta.url);
  const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');
  const ckDir = path.dirname(require.resolve('canvaskit-wasm/bin/canvaskit.js'));
  _ck = await CanvasKitInit({ locateFile: (f: string) => path.join(ckDir, f) });
  const [display, jetbrains] = await Promise.all([
    readFile(path.resolve('src/assets/og-fonts/anton.ttf')),
    readFile(path.resolve('src/assets/og-fonts/jetbrains-400.ttf')),
  ]);
  _fontMgr = _ck.FontMgr.FromData(display, jetbrains);
  return { CanvasKit: _ck, fontMgr: _fontMgr };
}

/** Site palette, the same values global.css defines. */
export const PALETTE = {
  blood: [193, 31, 31] as [number, number, number],
  bone: [232, 230, 226] as [number, number, number],
  read: [165, 161, 154] as [number, number, number],
  dim: [125, 122, 117] as [number, number, number],
  line: [27, 25, 32] as [number, number, number],
  panel: [11, 10, 13] as [number, number, number],
  void: [5, 4, 6] as [number, number, number],
};
