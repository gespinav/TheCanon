# The Canon — Status as of 2026-05-07

Comprehensive snapshot of what's done from the strategic plan, what's
left, and what's worth doing next. Generated after closing 1.1.1 + 1.1.6
in the same session.

## Section 1.1 — Critical Security Issues (Strategic Plan §1.1)

These eight issues are the "must fix before public launch" gate. Status:

| # | Issue | Severity | Status | Date |
|---|---|---|---|---|
| 1.1.1 | Stored XSS in user-generated reviews | **CRITICAL** | ✅ DONE | 2026-05-07 |
| 1.1.2 | No Content Security Policy | HIGH | ❌ TODO | — |
| 1.1.3 | TMDB API key in localStorage / URL | HIGH | ❌ TODO | — |
| 1.1.4 | Firebase config defense-in-depth | MEDIUM | ✅ DONE | 2026-05-02 |
| 1.1.5 | No email verification before sync | MEDIUM | ✅ DONE | 2026-05-02 |
| 1.1.6 | Password policy too permissive | MEDIUM | ✅ DONE | 2026-05-07 |
| 1.1.7 | No account deletion path | **HIGH (legal)** | ❌ TODO | — |
| 1.1.8 | No data-export path | MEDIUM (legal) | ❌ TODO | — |

**4 of 8 done. 4 remaining.** The remaining four are all blockers for
public/App Store launch.

### Recommended next-step priority

The remaining items aren't equal. Two framings:

**By legal blocker (recommended for App Store path):**
1. **1.1.7 — Account deletion** (HIGH, App Store Guideline 5.1.1(v) — Apple will reject without it)
2. **1.1.2 — CSP** (HIGH, biggest XSS mitigation now that escapeHtml is the only line of defense)
3. **1.1.3 — TMDB API key proxy** (HIGH, but requires Phase 2 backend work — see below)
4. **1.1.8 — Data export** (MEDIUM, GDPR Article 20 / CCPA — required before EU/CA/UK launch)

**By raw severity:**
1. **1.1.2 — CSP**
2. **1.1.3 — TMDB key**
3. **1.1.7 — Account deletion**
4. **1.1.8 — Data export**

Both 1.1.7 and 1.1.8 are quick (≤1 day each per the plan). 1.1.2 is a
larger refactor (inline scripts need hashing or extracting). 1.1.3
short-term is a header-swap (~half day) but long-term needs a server
proxy (Phase 2 of the roadmap).

### What's been built up around the security work

Beyond the listed fixes, we've also added supporting infrastructure
that any future security work can build on:

- `firestore.rules` deployed with `request.auth.token.email_verified` gate
- `firebase.json` with `hosting` block + comprehensive ignore list
- `gespinav.github.io` confirmed as production URL; allowlists widened
  in API key + reCAPTCHA + Firebase Auth authorized domains
- `firebase deploy --only hosting` + `firebase deploy --only firestore:rules`
  both wired up locally (gcloud + firebase-tools installed)
- `escapeHtml` helper + `sanitizeCloudReviews` + cap-on-storage pattern
  established — easy to extend for new fields
- Drift-check agent runs 2026-05-16 09:00 CDT; verifies all 1.1.1 / 1.1.4
  / 1.1.5 / 1.1.6 source-level controls and surfaces a punch list as a
  GitHub issue. Manage at https://claude.ai/code/routines/trig_01NNQbxQws77nQZNPP4Gh7f1
- 7 memory entries saved for future sessions (production URL, deploy
  method, ChromeOS env, sync write pattern, sanitizer pattern)

## Section 1.2 — Data Validation Gaps (Strategic Plan §1.2)

| Surface | Status |
|---|---|
| Review notes (`raw`) — 8KB cap + control char strip | **partial**: 8KB cap done in 1.1.1; control-char strip not yet |
| Edited newspaper (`prose`) — same + never re-render via innerHTML | **partial**: 40-paragraph cap done; renderer still uses innerHTML but escapes via `escapeHtml(p)` |
| Reviewer byline — escape on render + 40-char cap | **partial**: render escaped via 1.1.1; length cap NOT yet enforced (sanitizer caps at 200) |
| TMDB API responses — validate provider_id allowlist | ❌ TODO (couples with 1.1.3) |
| `localStorage` quota — try/catch wrapping | ❌ TODO |
| URL query params — manifest shortcut allowlist | ❌ TODO |

## Section 1.3 — User Experience Refinements (Strategic Plan §1.3)

All 7 items still open. Not security; affect retention. Notable for
launch quality:

- Newspaper "Set the Presses" — currently just splits paragraphs; rename or actually transform via LLM (Phase 2 backend)
- Empty-state onboarding (3-step welcome)
- Search typeahead
- Streak/progress visualizations
- **Share sheet ("Canon Card" PNGs)** — flagged in plan as "highest-leverage growth feature"
- Accessibility pass (font sizes, ARIA, contrast)
- iOS dark mode (`prefers-color-scheme: dark`)

## Beyond Part I — what the rest of the plan covers

| Part | Focus | Status |
|---|---|---|
| **Part II — Competitive Landscape** | Players, gaps, must-add features (Trakt sync, Letterboxd CSV import, share cards, etc.) | ❌ Not started |
| **Part III — Roadmap (Phases 1–5)** | Phase 1 hardening (= Section 1.1 work), Phase 2 backend, Phase 3 native shell (Capacitor), Phase 4 App Store prep, Phase 5 launch | Phase 1 ~50% done; rest not started |
| **Part IV — Monetization Model** | Tiered plan, pricing, IAP compliance | ❌ Not started |
| **Part V — Ongoing Management** | Release cadence, support ops, content ops, metrics | ❌ Not started |
| **Part VI — Go-To-Market** | Audience segments, ad buys (Reddit / Apple Search / Google / podcast) | ❌ Not started |

## Cross-cutting standing reminders

These came up during the security work and apply to anything new:

1. **Production URL is `gespinav.github.io`** — `canon-ede82.web.app` is a Firebase artifact, not user-facing. Any new domain restriction (API key, reCAPTCHA, Firebase Auth) must include both.
2. **Deploy is drag-and-drop into the GitHub repo web UI.** GitHub Pages auto-publishes. `firebase deploy --only hosting` works for the canon-ede82.web.app surface but is not the user-facing path.
3. **Cloud-sync write pattern**: every `MY_*` mutator calls `pushToCloud`; payload includes every synced field. New fields = update sanitizer + sign-in pull + onSnapshot listener + first-time push (`else` branch). Missed any one = silent cross-device drift.
4. **Cloud-data sanitizer pattern**: every cloud-synced field needs `sanitizeCloud<Field>` with `Object.create(null)`, key validation against `getValidIdSet()`, value type/shape check, and clamp/truncate. Used at every read site (initial pull AND onSnapshot).
5. **HTML escape pattern**: any new render site that interpolates user-controlled data into innerHTML must use `escapeHtml(...)`. The plan's longer-term direction is to move to `textContent`/DOM API entirely.
6. **No untyped commits.** Local index.html stays in sync with origin/main because the user uploads via GitHub web UI; CLI commits should be config/docs only (per the existing `.gitignore`).

## Manual cloud-side checklist (always required)

The drift-check agent can't reach these. Re-verify in browser after any
config change or surprise:

| Control | URL |
|---|---|
| App Check Enforce mode (Firestore + Auth) | https://console.firebase.google.com/project/canon-ede82/appcheck |
| Auth authorized domains (incl. gespinav.github.io) | https://console.firebase.google.com/project/canon-ede82/authentication/settings |
| Firebase Auth password policy (ENFORCE, min 10, lower+upper+digit) | same page, Password policy tab |
| reCAPTCHA site key domain allowlist | https://www.google.com/recaptcha/admin |
| Browser API key restrictions (6 referrers, 5 api-targets) | https://console.cloud.google.com/apis/credentials?project=canon-ede82 |
| Billing budget alert | https://console.cloud.google.com/billing/budgets?project=canon-ede82 |

## Files in this directory

| File | Source-controlled? | Purpose |
|---|---|---|
| `index.html` | ✅ on GitHub via web UI uploads | The whole app |
| `firebase.json`, `firestore.rules`, `firestore.indexes.json` | ✅ on GitHub via 5d1b8ec commit | Firebase config |
| `canon-1-1-4-report.md` | ✅ on GitHub | Detailed per-step report |
| `canon-status-2026-05-07.md` | ❌ local-only (this file) | This guide |
| `canon-app-strategic-plan (1).md` | ❌ local-only | The strategic plan reference doc |
| `index.html.bak.1-1-4*`, `index.html.pre-2mb-update` | ❌ gitignored | Pre-edit snapshots |
| `.gitignore` | ✅ on GitHub | Excludes backups, screenshots, .firebase/, .claude/ |
