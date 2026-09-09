#!/usr/bin/env node
/**
 * Publishes the RNNoise AudioWorklet and its WASM binaries as static assets.
 *
 * An AudioWorklet processor is fetched by URL at runtime (`addModule`), and the
 * WASM is fetched the same way, so neither can be bundled - they have to sit
 * under public/. Copying from node_modules on every build keeps them pinned to
 * whatever version of the package is installed.
 */

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'node_modules', '@sapphi-red', 'web-noise-suppressor', 'dist');
const DEST = join(ROOT, 'public', 'audio-worklets');

const FILES = [
  ['rnnoise/workletProcessor.js', 'rnnoise-worklet.js'],
  ['rnnoise.wasm', 'rnnoise.wasm'],
  ['rnnoise_simd.wasm', 'rnnoise_simd.wasm'],
];

if (!existsSync(SRC)) {
  console.warn('[noise-suppressor] Package not installed; skipping asset copy.');
  process.exit(0);
}

mkdirSync(DEST, { recursive: true });

let copied = 0;
for (const [from, to] of FILES) {
  const source = join(SRC, from);
  if (!existsSync(source)) {
    console.warn(`[noise-suppressor] Missing ${from}; neural mode will fall back to the DSP chain.`);
    continue;
  }
  copyFileSync(source, join(DEST, to));
  copied += 1;
}

console.log(`[noise-suppressor] Published ${copied}/${FILES.length} asset(s) to public/audio-worklets.`);
