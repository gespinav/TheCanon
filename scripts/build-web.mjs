#!/usr/bin/env node
// Assembles Capacitor's webDir (www/) from the canonical single-file PWA at the
// repo root. The root index.html stays the source of truth (also served by
// GitHub Pages); this just copies the runtime assets the native shell bundles.
import { rmSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WWW = join(ROOT, 'www');

// Fixed assets that must always be present.
const FILES = ['index.html', 'sw.js', 'manifest.json'];
// Plus every PWA icon at the root.
const ICONS = readdirSync(ROOT).filter((f) => /^icon-\d+\.png$/.test(f));

rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });

let n = 0;
for (const f of [...FILES, ...ICONS]) {
  const src = join(ROOT, f);
  if (!existsSync(src)) {
    console.error(`build:web — missing required asset: ${f}`);
    process.exit(1);
  }
  copyFileSync(src, join(WWW, f));
  n++;
}
console.log(`build:web — copied ${n} files into www/ (${ICONS.length} icons)`);
