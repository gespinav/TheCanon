#!/usr/bin/env node
// CI validation gate for The Canon (§3.7). Pure Node (no extra deps) so it runs
// identically in GitHub Actions and locally. Exits non-zero on the first
// category that fails; prints a summary.
//
//   1. Inline <script> blocks in index.html parse (the two big inline scripts).
//   2. JSON config files are valid (manifest, firebase.json, indexes, rc).
//   3. sw.js parses.
//   4. Every icon/sw asset referenced by index.html + manifest.json exists.
//   5. HTTP smoke: serve the repo, fetch the shell + key assets, assert 200s
//      and that the critical boot markers are present in index.html.
import { readFileSync, existsSync, writeFileSync, mkdtempSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.log(`  ✗ ${m}`); fail.push(m); };

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

// ── 1. Inline scripts parse ──────────────────────────────────────────
console.log('\n[1] Inline <script> syntax');
{
  const tmp = mkdtempSync(join(tmpdir(), 'canon-ci-'));
  const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((m) => !/\bsrc=/i.test(m[1]) && !/type\s*=\s*["']?(application\/(ld\+)?json|importmap)/i.test(m[1]));
  if (blocks.length === 0) bad('no inline scripts found (extraction broke?)');
  blocks.forEach((m, i) => {
    const f = join(tmp, `inline-${i}.js`);
    writeFileSync(f, m[2]);
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
      ok(`inline script #${i} parses (${m[2].length} bytes)`);
    } catch (e) {
      bad(`inline script #${i} SYNTAX ERROR: ${(e.stderr || e.message).toString().split('\n').slice(0, 4).join(' ')}`);
    }
  });
}

// ── 2. JSON config validity ──────────────────────────────────────────
console.log('\n[2] JSON config validity');
for (const f of ['manifest.json', 'firebase.json', 'firestore.indexes.json', '.firebaserc']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) { bad(`${f} missing`); continue; }
  try { JSON.parse(readFileSync(p, 'utf8')); ok(`${f} valid JSON`); }
  catch (e) { bad(`${f} INVALID JSON: ${e.message}`); }
}

// ── 3. sw.js parses ──────────────────────────────────────────────────
console.log('\n[3] Service worker syntax');
{
  const p = join(ROOT, 'sw.js');
  if (!existsSync(p)) bad('sw.js missing (index.html registers ./sw.js)');
  else {
    try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); ok('sw.js parses'); }
    catch (e) { bad(`sw.js SYNTAX ERROR: ${(e.stderr || e.message).toString().split('\n')[0]}`); }
  }
}

// ── 4. Referenced assets exist ───────────────────────────────────────
console.log('\n[4] Referenced assets exist');
{
  const refs = new Set();
  for (const m of html.matchAll(/(?:href|src)=["']\.?\/?(icon-\d+\.png)["']/gi)) refs.add(m[1]);
  try {
    const man = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
    (man.icons || []).forEach((i) => i.src && refs.add(i.src.replace(/^\.?\//, '')));
  } catch { /* covered in step 2 */ }
  if (refs.size === 0) bad('found no icon references to check');
  for (const r of [...refs].sort()) {
    existsSync(join(ROOT, r)) ? ok(`${r} present`) : bad(`${r} REFERENCED BUT MISSING`);
  }
}

// ── 5. HTTP smoke ────────────────────────────────────────────────────
console.log('\n[5] HTTP smoke');
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png' };
const server = createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const p = join(ROOT, rel);
  if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) { res.statusCode = 404; res.end(); return; }
  res.setHeader('Content-Type', MIME[extname(p)] || 'application/octet-stream');
  res.end(readFileSync(p));
});

const smoke = async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const shell = await fetch(`${base}/index.html`);
    shell.status === 200 ? ok('GET /index.html -> 200') : bad(`GET /index.html -> ${shell.status}`);
    const body = await shell.text();
    const markers = [
      ['<title', '<title>'],
      ['manifest link', /rel=["']manifest["']/],
      ['service-worker registration', "serviceWorker.register('./sw.js')"],
      ['error reporting (§3.6)', 'initErrorReporting'],
      ['perf monitoring (§3.6)', 'firebase-performance-compat'],
    ];
    for (const [name, m] of markers) {
      (typeof m === 'string' ? body.includes(m) : m.test(body))
        ? ok(`shell contains ${name}`) : bad(`shell MISSING ${name}`);
    }
    for (const a of ['/manifest.json', '/sw.js', '/icon-192.png', '/icon-512.png']) {
      const r = await fetch(`${base}${a}`);
      r.status === 200 ? ok(`GET ${a} -> 200`) : bad(`GET ${a} -> ${r.status}`);
    }
  } finally {
    server.close();
  }
};

await smoke();

console.log(`\n${fail.length ? `✗ FAIL — ${fail.length} problem(s)` : '✓ ALL CHECKS PASSED'}`);
process.exit(fail.length ? 1 : 0);
