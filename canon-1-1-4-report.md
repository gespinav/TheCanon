# Canon Step 1.1.4 — Defense-in-Depth Report

Generated: 2026-05-02T15:11Z
Project: `canon-ede82`
Production domains: `canon-ede82.web.app`, `canon-ede82.firebaseapp.com`
Browser API key UID: `ddbdb639-6e8f-4b5d-8ef0-733417fbb9a5`
Firestore ruleset: `projects/canon-ede82/rulesets/04e1e704-a5a6-4c19-a5cc-dff9f1170b03`

## Automated (verified by this run)

| Control | Status | Evidence |
|---|---|---|
| Firestore rules deployed | ✅ | Ruleset `04e1e704-a5a6-4c19-a5cc-dff9f1170b03` returned by Rules REST API for release `cloud.firestore` |
| Firestore rules content matches canonical | ✅ | sha256 of `firestore.rules` = `91ffd1a68e530618fdec1001e39245f841ff869442a6d06c74698e0dea69fea8`; deployed source contains `request.auth.uid == userId` |
| Browser API key allowed-referrers set | ✅ | `gcloud services api-keys describe` returns 6 referrers: `https://canon-ede82.web.app/*`, `https://canon-ede82.web.app`, `https://canon-ede82.firebaseapp.com/*`, `https://canon-ede82.firebaseapp.com`, `https://gespinav.github.io/*`, `https://gespinav.github.io` (last 2 added 2026-05-02 — production is GitHub Pages at gespinav.github.io, not Firebase Hosting) |
| Browser API key api-target restricted | ✅ | 5 services exactly: `identitytoolkit`, `securetoken`, `firestore`, `firebaseappcheck`, `firebaseinstallations` (down from 27) |
| `originSelfCheck` in `index.html` | ✅ | grep matches at line 1747 |
| `FIREBASE_EXPECTED_ORIGINS` includes prod domains | ✅ | Array contains `https://canon-ede82.web.app`, `https://canon-ede82.firebaseapp.com` |
| App Check `getToken` self-check in `index.html` | ✅ | grep matches at line 1806 |
| Defense-in-depth checklist in source comments | ✅ | grep matches at line 1702 |
| Inline scripts parse | ✅ | 2 inline scripts, 0 failures (validated via Node `vm.Script`) |

## Manual (requires browser console — verify each)

| Control | Verification URL |
|---|---|
| App Check Enforce mode (Firestore + Auth) | https://console.firebase.google.com/project/canon-ede82/appcheck |
| Authorized Domains (Firebase Auth) | https://console.firebase.google.com/project/canon-ede82/authentication/settings |
| reCAPTCHA domain allowlist (key `6LfF8qssAAAAABacmMzhrWUFtofUNWcjB3N0JqjV`) | https://www.google.com/recaptcha/admin |
| API key restrictions (sanity check UI) | https://console.cloud.google.com/apis/credentials?project=canon-ede82 |
| Billing budget alert | https://console.cloud.google.com/billing/budgets?project=canon-ede82 |

## Files written

- `firestore.rules` (canonical text, deployed)
- `firebase.json` (wires `firestore.rules` and `firestore.indexes.json`)
- `firestore.indexes.json` (empty stub)
- `index.html` (4 inline-script defenses added; backup at `index.html.bak.1-1-4`)

## Re-applied to 2MB build (2026-05-02)

A new 2MB `index.html` was dropped into the repo (originally `index (1).html`,
size 2,091,326 bytes, mtime Apr 27). The same 4 defenses were re-applied
to it:

- Reconnaissance confirmed firebaseConfig still points to `canon-ede82`
  with the same apiKey, so cloud-side controls (Firestore rules, API key
  restrictions) still cover it.
- Both anchor strings (`// Without a valid config...` + `appCheck.activate(`)
  matched byte-for-byte; same Edit operations applied cleanly.
- Inline scripts parse: 2 of 2, 0 failures.

| File | Size | sha256 | Role |
|---|---|---|---|
| `index.html` | 2,095,275 | `7140c0b27d5060e18b371d5c8ced3c9099f42d71869bf28dee7639d23e67312c` | Active build, with 1.1.4 defenses |
| `index.html.bak.1-1-4-2mb` | 2,091,326 | `eb06e070d8ac0bf82624fc899c0a207397b7787facbd9a896c6d02ffe35ef824` | Pre-edit snapshot of the 2MB drop |
| `index.html.pre-2mb-update` | 989,718 | — | Previous edited 989KB file (kept for reference) |
| `index.html.bak.1-1-4` | 985,769 | — | Original pre-1.1.4 snapshot of the 989KB file |

## Step 1.1.5 — Email verification before cloud sync (2026-05-02)

Policy: **Hard block, sign out unverified.** A user is never both
signed in AND unverified. signUp creates the account, sends the
verification email, and immediately signs out. signIn detects
unverified accounts, re-sends the email, and signs out — so cloud sync
only ever runs for verified sessions.

### Automated controls (verified by this run)

| Control | Status | Evidence |
|---|---|---|
| Firestore rule requires `email_verified == true` | ✅ | Ruleset `085233a2-9a00-4b5f-bafe-86e879fd852b`; deployed source contains `request.auth.token.email_verified == true` |
| `_canonAuthFns.signUp` sends verification + signs out | ✅ | grep at line 1888 of `index.html`; markers `sendEmailVerification`, `auth.signOut()` inside signUp helper |
| `_canonAuthFns.signIn` rejects unverified (resends + signs out + throws `canon/email-not-verified`) | ✅ | grep at line 1875+; explicit error code |
| `onAuthStateChanged` defense in depth: forces sign-out of unverified sessions | ✅ | "Forcing sign-out of unverified session" warning at line 1906 |
| `pushToCloud` gates on `emailVerified` | ✅ | line 1853 |
| `doSignIn` shows verification error correctly | ✅ | line 8788, error code `canon/email-not-verified` handled |
| `doSignUp` switches to sign-in tab + shows verification message | ✅ | line ~8800, `AUTH_TAB = 'signin'` after success |
| Inline scripts parse | ✅ | 2 inline scripts, 0 failures |
| Manual UI test (signup → email → sign-in flow) | ✅ | User confirmed all 7 steps passed |

### Hosting deploy infrastructure (also added 2026-05-02)

`firebase.json` now includes a `hosting` block pointing at the repo root
with an explicit ignore list. `firebase deploy --only hosting` is the
new deploy path. After Phase E, only `index.html` (1 file) is deployed.

⚠ Initial deploy uploaded `.git/` and `.claude/` because the original
`**/.*` ignore pattern didn't recurse into dot-prefixed directories.
Fixed within ~3 minutes by adding `**/.*/**`, `.git/**`, `.claude/**`,
`.firebase/**`. Probe URLs (`.git/HEAD`, `.git/config`, `.claude/settings.local.json`)
return 404. No secrets were in any of those files (only public-equivalent
data like the GitHub remote URL and the session permission allowlist).

### Files updated

| File | Size | sha256 | Change |
|---|---|---|---|
| `index.html` | 2,097,574 | `33cded412f8c3558d12170af9e0e05f90cbe893318e6e9edf2a27e888f9a7191` | 1.1.5 client edits applied |
| `firestore.rules` | 757 | `c680ea80f7fe59f3eace8c4ff4950adcb44950a4f77f0d480dc694110deeea63` | `email_verified == true` added |
| `firebase.json` | — | — | `hosting` block + comprehensive ignore list |

### Manual settings still required (verify in browser console)

Phase 5 of 1.1.4 still applies — App Check Enforce mode (already on
since 2026-04-08, confirmed by REST API), Auth authorized domains,
reCAPTCHA domain allowlist, API key restrictions, billing budget.
The reCAPTCHA secret-key mismatch surfaced and was fixed during
Phase D testing of 1.1.5.

## Step 1.1.1 — Stored XSS in user-generated reviews (2026-05-07)

**Severity: CRITICAL.** Active exploitability was created on 2026-05-02
when we added written `reviews` to the Firestore sync as part of fixing
the cross-device sync bug. Without escaping, a poisoned cloud doc could
execute arbitrary script on any device that pulled it. Discovered by
reading the strategic plan after-the-fact; closed same day.

### Automated controls (verified by this run)

| Control | Status | Evidence |
|---|---|---|
| `escapeHtml(s)` helper added | ✅ | line ~6467 |
| `escapeHtml` applied at 8 review-rendering sites | ✅ | textarea (renderReviewForm), date/byline/firstChar/restText (renderMyReviewsCarousel), 3 paragraph sites + date + byline (renderNewspaperPage) |
| `sanitizeCloudReviews` cap tightened from 50000 → 8000 chars | ✅ | line ~6494 area |
| Storage cap on raw input (8000 chars) | ✅ | `submitReview`, `<textarea maxlength="8000">` |
| Paragraph cap on prose (40 paragraphs) | ✅ | `submitReview` after `generateNewspaperReview` |
| `saveEditedNewspaper` reads via `.textContent` (auto-decodes) | ✅ | already safe by design |
| Inline scripts parse | ✅ | 2/0 |
| Manual XSS payload test (`<img src=x onerror=...>` rendered as text on fresh + after-cloud-pull) | ✅ | User confirmed |

## Step 1.1.6 — Password policy too permissive (2026-05-07)

**Severity: MEDIUM.** Server-side enforcement via Firebase Auth Identity
Platform admin config. Client-side strength meter + HIBP k-anonymity
breach check.

### Automated controls (verified by this run)

| Control | Status | Evidence |
|---|---|---|
| Server-side password policy ENFORCE (min 10, lower+upper+digit) | ✅ | PATCH `https://identitytoolkit.googleapis.com/admin/v2/projects/canon-ede82/config` returned policy in ENFORCE state, `lastUpdateTime: 2026-05-07T17:12:42.304237Z` |
| `forceUpgradeOnSignin: false` (existing users not locked out) | ✅ | default; existing weak-password users can still sign in |
| Client minlength bumped 8 → 10 on signup tab | ✅ | `minlength="${tab==='signin'?8:10}"` |
| Strength meter UI (bar + 4 checks) | ✅ | `auth-pw-meter` block with `pwCheck-len/lower/upper/digit` |
| `passwordStrength()` helper + common-password blacklist | ✅ | `CANON_COMMON_PASSWORDS` Set; 5-tier score 0-4 |
| `hibpCheck()` k-anonymity SHA-1 prefix lookup | ✅ | calls `https://api.pwnedpasswords.com/range/{prefix}`, fail-open on errors |
| `doSignUp` gates on score ≥ 2 AND not breached | ✅ | strength + hibp checks before `_canonAuthFns.signUp` |
| `auth/password-does-not-meet-requirements` error code handled | ✅ | server-side rejection mapped to user-readable message |
| Manual UI test (weak rejected, common rejected, strong accepted, breached rejected) | ✅ | User confirmed |

### Notes

- HIBP fail-open: if `api.pwnedpasswords.com` is unreachable, sign-up proceeds. Strength check still applies.
- Going with inline strength meter (not zxcvbn library): zxcvbn is 821KB uncompressed — adds ~140KB gzipped to every page load. Inline meter is ~80 lines, covers the same UX surface, and HIBP is the actual breach-DB check.

## Step 1.1.2 — Content Security Policy (2026-05-07)

**Severity: HIGH.** XSS mitigation layer behind `escapeHtml`. Even if
escaping is bypassed somewhere in the future, CSP would block the
exfiltration / script-loading paths an attacker needs.

### Automated controls (verified by this run)

| Control | Status | Evidence |
|---|---|---|
| `Content-Security-Policy` meta tag in `<head>` | ✅ | line 5 |
| `default-src 'self'` (restrictive fallback) | ✅ | meta content |
| `connect-src` allowlist covers: `*.googleapis.com`, `*.firebaseio.com`, `*.firebaseapp.com`, `www.google.com`, `api.themoviedb.org`, `api.pwnedpasswords.com` | ✅ | meta content |
| `img-src` allowlist: `'self' data: blob: image.tmdb.org` | ✅ | meta content |
| `frame-src` allowlist: `www.google.com` (reCAPTCHA challenge), `canon-ede82.firebaseapp.com` (Firebase auth popup if used) | ✅ | meta content |
| `script-src` allowlist external: `gstatic.com` (Firebase SDK), `www.google.com` (reCAPTCHA api.js) | ✅ | meta content |
| `object-src 'none'` (block plugins) | ✅ | meta content |
| `base-uri 'self'` (prevent base-tag injection) | ✅ | meta content |
| `form-action 'self'` (forms can only post same-origin) | ✅ | meta content |
| `upgrade-insecure-requests` | ✅ | meta content |
| Inline scripts parse | ✅ | 2/0 |
| Manual test: 8 user flows (sign-in, sign-up + HIBP, score update, review submit, full sync round-trip) all clean, no CSP violations in console | ✅ | User confirmed |

### Pragmatic compromises (with follow-up tracked)

- **`script-src 'unsafe-inline'`** is allowed because the app has ~91 inline
  event handlers (`onclick`, `oninput`, `onsubmit`) embedded in dynamic
  HTML templates. Refactoring all 91 to `addEventListener` is a multi-day
  refactor — tracked as **1.1.2 Phase 2 follow-up**. Once done, drop
  `'unsafe-inline'` and add SHA-256 hashes for the 2 inline `<script>`
  blocks to fully close the inline-injection vector.
- **`style-src 'unsafe-inline'`** is needed for dynamic styles in templates
  and the password meter UI. Plan accepts this.
- **`frame-ancestors`** is intentionally omitted — meta-tag CSP can't
  enforce it. To enable clickjacking protection, would need an HTTP
  response header, which GitHub Pages doesn't support. Cloudflare
  Workers in front (Phase 2 backend) would unlock this.

## Files updated (cumulative through 2026-05-07)

| File | Size | sha256 | Latest change |
|---|---|---|---|
| `index.html` | 2,110,659 | `eedbeb2ccbaa3cd389195ce91c60007ed9974a6148622fcba7e0e357bc8397bd` | 1.1.2 CSP meta tag added |
| `firestore.rules` | 757 | `c680ea80f7fe59f3eace8c4ff4950adcb44950a4f77f0d480dc694110deeea63` | unchanged since 1.1.5 |

## Next step

See `canon-status-2026-05-07.md` for the comprehensive what's-done /
what's-left guide. With 1.1.2 closed, the remaining §1.1 items by
pure security severity are: **1.1.3** (TMDB API key, HIGH), **1.1.7**
(account deletion, HIGH legal blocker), **1.1.8** (data export,
MEDIUM legal). 1.1.2 Phase 2 (refactor inline handlers, drop
`'unsafe-inline'` for scripts) tracked as a follow-up.
