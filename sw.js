/* The Canon — service worker
 *
 * Copyright (c) 2026 Gabe EV. All Rights Reserved.
 * Proprietary. Public visibility is not a grant of license — see LICENSE.
 *
 * Single-file PWA on GitHub Pages (scope /TheCanon/). No build step: this file
 * is hand-maintained and deployed by drag-and-drop alongside index.html.
 *
 * Strategy
 *  - Navigation / HTML  : network-first, fall back to cached shell (offline).
 *                         Keeps the inline data fresh on every online load;
 *                         GitHub Pages honours ETag so unchanged loads are 304s.
 *  - Same-origin static : stale-while-revalidate (icons, manifest) — instant
 *                         and self-updating.
 *  - Cross-origin       : bypassed entirely (Firebase Auth/Firestore, App Check
 *                         reCAPTCHA, Cloud Functions, Wikipedia, pwnedpasswords).
 *                         Never cache authed or third-party API traffic.
 *
 * Bump CACHE when you want to force every client to drop its cached shell.
 */
'use strict';

const CACHE = 'canon-v1';

// App shell precached on install. Kept small; other same-origin assets
// (apple-touch icons, etc.) are picked up on demand by the static handler.
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Don't let one missing asset abort the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: try the network, cache a fresh copy, fall back to cache.
async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = (await cache.match(request)) || (fallbackUrl && await cache.match(fallbackUrl));
    if (cached) return cached;
    throw err;
  }
}

// Stale-while-revalidate: serve cache immediately, refresh in the background.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((resp) => {
      if (resp && resp.ok) cache.put(request, resp.clone());
      return resp;
    })
    .catch(() => undefined);
  return cached || networkFetch || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GET is cacheable; let everything else hit the network untouched.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Bypass all cross-origin traffic (Firebase, Google/App Check, Cloud
  // Functions, Wikipedia, pwnedpasswords, …). Never cache authed/API responses.
  if (url.origin !== self.location.origin) return;

  // App navigations -> network-first with the shell as offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, './index.html'));
    return;
  }

  // Same-origin static assets -> stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(req));
});
