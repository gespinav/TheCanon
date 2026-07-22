/*
 * The Canon — Cloud Functions backend
 *
 * Copyright (c) 2026 Gabe EV. All Rights Reserved.
 * Proprietary. Public visibility is not a grant of license — see LICENSE at
 * the repository root. No copying, redistribution, or derivative works.
 */
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import * as fs from "fs";
import * as path from "path";

// Initialise the Admin SDK exactly once. All server-side Firestore writes
// (Trakt tokens, etc.) go through this; it bypasses security rules.
if (!admin.apps.length) admin.initializeApp();

// Public on purpose — sanity-checks the deploy pipeline. Add
// { enforceAppCheck: true } before any endpoint that touches Firestore.
export const helloCanon = onRequest(
  { region: "us-central1", cors: true, invoker: "public" },
  (_req, res) => {
    logger.info("helloCanon invoked");
    res.json({
      ok: true,
      ts: Date.now(),
      msg: "The Canon — Cloud Functions live.",
    });
  }
);

// ── shareCard ──────────────────────────────────────────────────────
// Renders a 1200×630 PNG of a Canon title for social sharing.
// Module-level state (fonts, titles) is cached across warm invocations.

const FONT_DIR = path.join(__dirname, "..", "data", "fonts");
const FONT_REGULAR = fs.readFileSync(
  path.join(FONT_DIR, "PlayfairDisplay-Regular.woff")
);
const FONT_BLACK = fs.readFileSync(
  path.join(FONT_DIR, "PlayfairDisplay-Black.woff")
);
const FONT_ITALIC = fs.readFileSync(
  path.join(FONT_DIR, "PlayfairDisplay-Italic.woff")
);

type Title = {
  id: number;
  type: "film" | "tv";
  title: string;
  year: number;
  dir: string;
  country: string;
  era: string;
  g: string; // grade letter
  s: number; // composite score
  synopsis: string;
};

// Load all 500 titles from JSON at module init; cached across warm invocations.
const TITLES_RAW: Title[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "canon-titles.json"), "utf8")
);
const TITLES: Record<number, Title> = Object.fromEntries(
  TITLES_RAW.map((t) => [t.id, t])
);

function buildCard(t: Title, myGrade?: string, myScore?: number): any {
  const accentGold = "#8B6B00";
  const ink = "#1A1917";
  const text2 = "#3A3530";
  const text3 = "#5A5550";
  const paper = "#FAF8F3";
  const hasPersonal = !!(myGrade && typeof myScore === "number" && !isNaN(myScore));

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: paper,
        color: ink,
        fontFamily: "Playfair",
        padding: "44px 60px",
      },
      children: [
        // MASTHEAD
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingBottom: "18px",
              borderBottomWidth: 4,
              borderBottomStyle: "double",
              borderBottomColor: ink,
            },
            children: [
              {
                type: "div",
                props: {
                  style: { fontSize: "36px", fontWeight: 900 },
                  children: "THE CANON",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "16px",
                    fontStyle: "italic",
                    color: text3,
                  },
                  children: "Top 500 · Film & Television",
                },
              },
            ],
          },
        },
        // BODY
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              paddingTop: "24px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "16px",
                    color: accentGold,
                    letterSpacing: "4px",
                    textTransform: "uppercase",
                    marginBottom: "18px",
                  },
                  children: `${t.type === "film" ? "Film" : "Television"} · ${t.era} · ${t.country}`,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "78px",
                    fontWeight: 900,
                    lineHeight: 1.0,
                    marginBottom: "22px",
                  },
                  children: t.title,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "22px",
                    fontStyle: "italic",
                    color: text2,
                    marginBottom: "32px",
                  },
                  children: `${t.year} · Directed by ${t.dir}`,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "20px",
                    lineHeight: 1.45,
                    color: text2,
                    maxHeight: "120px",
                    overflow: "hidden",
                  },
                  children: t.synopsis,
                },
              },
            ],
          },
        },
        // FOOTER
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              borderTopWidth: 2,
              borderTopStyle: "solid",
              borderTopColor: ink,
              paddingTop: "18px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", gap: "56px", alignItems: "flex-end" },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", flexDirection: "column" },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                fontSize: "13px",
                                color: accentGold,
                                letterSpacing: "3px",
                                textTransform: "uppercase",
                                marginBottom: "4px",
                              },
                              children: "Composite Score",
                            },
                          },
                          {
                            type: "div",
                            props: {
                              style: { fontSize: "48px", fontWeight: 900, lineHeight: 1.0 },
                              children: `${t.s}/100`,
                            },
                          },
                        ],
                      },
                    },
                    ...(hasPersonal
                      ? [
                          {
                            type: "div",
                            props: {
                              style: { display: "flex", flexDirection: "column" },
                              children: [
                                {
                                  type: "div",
                                  props: {
                                    style: {
                                      fontSize: "13px",
                                      color: accentGold,
                                      letterSpacing: "3px",
                                      textTransform: "uppercase",
                                      marginBottom: "4px",
                                      fontStyle: "italic",
                                    },
                                    children: "My Grade",
                                  },
                                },
                                {
                                  type: "div",
                                  props: {
                                    style: {
                                      display: "flex",
                                      alignItems: "baseline",
                                      gap: "10px",
                                    },
                                    children: [
                                      {
                                        type: "div",
                                        props: {
                                          style: {
                                            fontSize: "48px",
                                            fontWeight: 900,
                                            lineHeight: 1.0,
                                          },
                                          children: `${myScore}/100`,
                                        },
                                      },
                                      {
                                        type: "div",
                                        props: {
                                          style: {
                                            fontSize: "36px",
                                            fontWeight: 900,
                                            color: accentGold,
                                            lineHeight: 1.0,
                                          },
                                          children: myGrade,
                                        },
                                      },
                                    ],
                                  },
                                },
                              ],
                            },
                          },
                        ]
                      : []),
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "120px",
                    fontWeight: 900,
                    color: accentGold,
                    lineHeight: 1,
                  },
                  children: t.g,
                },
              },
            ],
          },
        },
      ],
    },
  };
}

export const shareCard = onRequest(
  { region: "us-central1", invoker: "public", memory: "1GiB", cors: true },
  async (req, res) => {
    const id = parseInt((req.query.id as string) || "1", 10);
    const t = TITLES[id];
    if (!t) {
      res.status(404).json({ error: "Title not found", id });
      return;
    }

    // Default response is an Open-Graph landing page: social crawlers read the
    // card PNG (served at ?format=png) as the link preview, while a human who
    // clicks the link is redirected to that title's expanded card on the Canon
    // dashboard (more useful than a standalone image page). ?format=png returns
    // the raw card image (the preview source / legacy behaviour).
    const fmt = (req.query.format as string) || "";
    if (fmt !== "png") {
      const mgKeep = /^[A-F][+−\-]?$/.test((req.query.mg as string) || "")
        ? `&mg=${encodeURIComponent(req.query.mg as string)}` : "";
      const msKeep = /^\d{1,3}$/.test((req.query.ms as string) || "")
        ? `&ms=${encodeURIComponent(req.query.ms as string)}` : "";
      const host = req.get("host");
      const imgUrl = `https://${host}/?id=${id}&format=png${mgKeep}${msKeep}`;
      const dest = `https://gespinav.github.io/TheCanon/?title=${id}`;
      const esc = (s: any) => String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const titleEsc = esc((t as any).title);
      const descEsc = esc((t as any).synopsis
        ? String((t as any).synopsis).slice(0, 200)
        : `Canon composite score ${(t as any).s}/100 — Top 500 Film & Television.`);
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
      res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titleEsc} · The Canon</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Canon">
<meta property="og:title" content="${titleEsc} · The Canon">
<meta property="og:description" content="${descEsc}">
<meta property="og:image" content="${imgUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${dest}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titleEsc} · The Canon">
<meta name="twitter:description" content="${descEsc}">
<meta name="twitter:image" content="${imgUrl}">
<link rel="canonical" href="${dest}">
<meta http-equiv="refresh" content="0;url=${dest}">
<script>location.replace(${JSON.stringify(dest)});</script>
</head><body style="font-family:system-ui,-apple-system,sans-serif;background:#0F0F0E;color:#fff;text-align:center;padding:40px 24px">
<p>Opening <strong>${titleEsc}</strong> on The Canon…</p>
<p><a style="color:#B8860B" href="${dest}">Continue to The Canon &rarr;</a></p>
</body></html>`);
      return;
    }

    // Personal grade overlay (opt-in via URL params from the web app).
    const mgRaw = (req.query.mg as string) || "";
    const msRaw = (req.query.ms as string) || "";
    const myGrade = /^[A-F][+−\-]?$/.test(mgRaw) ? mgRaw : undefined;
    const msNum = parseInt(msRaw, 10);
    const myScore = !isNaN(msNum) && msNum >= 0 && msNum <= 100 ? msNum : undefined;

    try {
      const svg = await satori(buildCard(t, myGrade, myScore), {
        width: 1200,
        height: 630,
        fonts: [
          { name: "Playfair", data: FONT_REGULAR, weight: 400, style: "normal" },
          { name: "Playfair", data: FONT_BLACK, weight: 900, style: "normal" },
          { name: "Playfair", data: FONT_ITALIC, weight: 400, style: "italic" },
        ],
      });
      const png = new Resvg(svg).render().asPng();
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
      res.send(png);
    } catch (e: any) {
      logger.error("shareCard error", { id, error: e?.message });
      res.status(500).json({ error: "Render failed", detail: e?.message });
    }
  }
);

// ── Trakt OAuth ────────────────────────────────────────────────────
// Callable functions: traktConnect exchanges the OAuth code for tokens
// and writes them to a server-only Firestore subcollection. traktDisconnect
// removes them. App Check enforced; auth + verified email required.

const TRAKT_CLIENT_ID = defineSecret("TRAKT_CLIENT_ID");
const TRAKT_CLIENT_SECRET = defineSecret("TRAKT_CLIENT_SECRET");
const TRAKT_REDIRECT_URI = defineSecret("TRAKT_REDIRECT_URI");

// Trakt's API is fronted by Cloudflare, which returns a 403 HTML challenge
// page to any request without a User-Agent. Every fetch to api.trakt.tv must
// send a descriptive UA or the call is blocked before Trakt ever sees it.
const TRAKT_USER_AGENT = "TheCanon/1.0 (+https://gespinav.github.io/TheCanon/)";

type TraktTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  created_at: number;
  token_type: string;
};

function assertVerifiedUser(req: { auth?: any }): { uid: string } {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
  if (!req.auth.token?.email_verified) {
    throw new HttpsError("permission-denied", "Verify your email first");
  }
  return { uid: req.auth.uid as string };
}

export const traktConnect = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    secrets: [TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, TRAKT_REDIRECT_URI],
  },
  async (req) => {
    const { uid } = assertVerifiedUser(req);
    const code = String((req.data as any)?.code || "").trim();
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(code)) {
      throw new HttpsError("invalid-argument", "Bad code");
    }

    const clientId = TRAKT_CLIENT_ID.value();
    const clientSecret = TRAKT_CLIENT_SECRET.value();
    const redirectUri = TRAKT_REDIRECT_URI.value();

    // Exchange code → tokens.
    // NOTE: Trakt's API sits behind Cloudflare, which 403-blocks requests that
    // lack a User-Agent (returns a Cloudflare HTML challenge page, not JSON).
    // Node/undici fetch sends no UA by default, so we MUST set one explicitly.
    const tokenRes = await fetch("https://api.trakt.tv/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": TRAKT_USER_AGENT,
        "trakt-api-version": "2",
        "trakt-api-key": clientId,
      },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => "");
      logger.warn("trakt token exchange failed", { uid, status: tokenRes.status, detail: detail.slice(0, 200) });
      throw new HttpsError("aborted", `Trakt rejected the code (${tokenRes.status})`);
    }
    const tokens = (await tokenRes.json()) as TraktTokenResponse;

    // Fetch username
    const meRes = await fetch("https://api.trakt.tv/users/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "trakt-api-version": "2",
        "trakt-api-key": clientId,
        "User-Agent": TRAKT_USER_AGENT,
      },
    });
    if (!meRes.ok) {
      logger.warn("trakt /users/me failed", { uid, status: meRes.status });
      throw new HttpsError("aborted", "Could not read Trakt profile");
    }
    const me = (await meRes.json()) as { username?: string };
    const username = String(me?.username || "").slice(0, 64) || "unknown";

    // Persist
    const db = admin.firestore();
    const now = Date.now();
    await db
      .collection("users")
      .doc(uid)
      .collection("secrets")
      .doc("trakt")
      .set({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.created_at + tokens.expires_in,
        scope: tokens.scope,
        token_type: tokens.token_type,
        created_at: tokens.created_at,
        stored_at: now,
      });

    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          trakt: {
            connected: true,
            username,
            connectedAt: now,
            scope: tokens.scope,
          },
        },
        { merge: true }
      );

    logger.info("trakt connected", { uid, username });
    return { ok: true, username };
  }
);

export const traktDisconnect = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    secrets: [TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET],
  },
  async (req) => {
    const { uid } = assertVerifiedUser(req);
    const db = admin.firestore();

    // Best-effort token revocation on Trakt's side, then local cleanup.
    try {
      const secretSnap = await db
        .collection("users")
        .doc(uid)
        .collection("secrets")
        .doc("trakt")
        .get();
      const access = secretSnap.exists ? (secretSnap.data() as any)?.access_token : null;
      if (access) {
        await fetch("https://api.trakt.tv/oauth/revoke", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": TRAKT_USER_AGENT,
            "trakt-api-version": "2",
            "trakt-api-key": TRAKT_CLIENT_ID.value(),
          },
          body: JSON.stringify({
            token: access,
            client_id: TRAKT_CLIENT_ID.value(),
            client_secret: TRAKT_CLIENT_SECRET.value(),
          }),
        });
      }
    } catch (e: any) {
      logger.warn("trakt revoke failed (ignored)", { uid, err: e?.message });
    }

    await db
      .collection("users")
      .doc(uid)
      .collection("secrets")
      .doc("trakt")
      .delete();
    await db
      .collection("users")
      .doc(uid)
      .set({ trakt: admin.firestore.FieldValue.delete() }, { merge: true });

    logger.info("trakt disconnected", { uid });
    return { ok: true };
  }
);

// ── logError ───────────────────────────────────────────────────────
// First-party crash/error sink (§3.6 observability — chosen over Sentry to
// stay in-stack with no third-party script, no CSP change, and nothing that
// counts as "tracking"). The web app's global error + unhandledrejection
// handlers POST here.
//
//   Primary sink : Cloud Logging (always) — free-tier, log-based alerts.
//   Queryable mirror: the 'diagnostics' Firestore collection, written ONLY
//     when a valid App Check token is presented, so anonymous spam can't run
//     up Firestore writes. Clients can never touch 'diagnostics' directly —
//     the default-deny rule blocks them and this function writes via Admin.

// ── traktSync ─────────────────────────────────────────────────────
// Write-sync the user's Canon data TO their connected Trakt account:
//   Seen  → /sync/history   (marks watched)
//   Score → /sync/ratings   (0–100 mapped to Trakt 1–10)
//   Watch → /sync/watchlist
// The catalog carries no external ids, so each title is resolved to a
// Trakt id via /search (public — api-key only) and cached globally in
// traktIdCache/{canonId} so later syncs skip the lookup. The user's data
// is read from their own users/{uid} doc (written by the client's
// pushToCloud), so the client never constructs the Trakt payload.

// Load a valid access token for uid, refreshing via the refresh_token
// grant when the stored one is within 60s of expiry.
async function loadTraktAccessToken(uid: string): Promise<string> {
  const db = admin.firestore();
  const ref = db.collection("users").doc(uid).collection("secrets").doc("trakt");
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("failed-precondition", "Trakt is not connected");
  const t = snap.data() as any;
  const nowSec = Math.floor(Date.now() / 1000);
  if (t.access_token && typeof t.expires_at === "number" && t.expires_at - 60 > nowSec) {
    return t.access_token as string;
  }
  if (!t.refresh_token) throw new HttpsError("failed-precondition", "Trakt session expired — reconnect Trakt");
  const clientId = TRAKT_CLIENT_ID.value();
  const res = await fetch("https://api.trakt.tv/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": TRAKT_USER_AGENT,
      "trakt-api-version": "2",
      "trakt-api-key": clientId,
    },
    body: JSON.stringify({
      refresh_token: t.refresh_token,
      client_id: clientId,
      client_secret: TRAKT_CLIENT_SECRET.value(),
      redirect_uri: TRAKT_REDIRECT_URI.value(),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    logger.warn("trakt token refresh failed", { uid, status: res.status });
    throw new HttpsError("aborted", "Trakt token refresh failed — please reconnect Trakt");
  }
  const nt = (await res.json()) as TraktTokenResponse;
  await ref.set(
    {
      access_token: nt.access_token,
      refresh_token: nt.refresh_token,
      expires_at: nt.created_at + nt.expires_in,
      scope: nt.scope,
      token_type: nt.token_type,
      created_at: nt.created_at,
      stored_at: Date.now(),
    },
    { merge: true }
  );
  return nt.access_token;
}

type TraktRef = { traktId: number; kind: "movies" | "shows" };

// Resolve a Canon title to a Trakt id via search, cached globally so the
// (rate-limited) lookup runs at most once per canon title across all users.
async function resolveTraktId(t: Title, clientId: string): Promise<TraktRef | null> {
  const db = admin.firestore();
  const cacheRef = db.collection("traktIdCache").doc(String(t.id));
  const cached = await cacheRef.get();
  if (cached.exists) {
    const c = cached.data() as any;
    if (c.notFound) return null;
    if (typeof c.traktId === "number") return { traktId: c.traktId, kind: c.kind };
  }
  const kind: "movies" | "shows" = t.type === "film" ? "movies" : "shows";
  const searchType = t.type === "film" ? "movie" : "show";
  const url =
    `https://api.trakt.tv/search/${searchType}` +
    `?query=${encodeURIComponent(t.title)}&years=${t.year}&limit=1`;
  const res = await fetch(url, {
    headers: { "trakt-api-version": "2", "trakt-api-key": clientId, "User-Agent": TRAKT_USER_AGENT },
  });
  if (!res.ok) return null; // transient (e.g. rate limit) — don't cache a miss
  const arr = (await res.json()) as any[];
  const hit = arr && arr[0] && (arr[0].movie || arr[0].show);
  const traktId = hit && hit.ids && hit.ids.trakt;
  if (typeof traktId !== "number") {
    await cacheRef.set({ notFound: true, title: t.title, year: t.year, at: Date.now() });
    return null;
  }
  await cacheRef.set({ traktId, kind, title: t.title, year: t.year, at: Date.now() });
  return { traktId, kind };
}

export const traktSync = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    secrets: [TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, TRAKT_REDIRECT_URI],
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async (req) => {
    const { uid } = assertVerifiedUser(req);
    const clientId = TRAKT_CLIENT_ID.value();
    const accessToken = await loadTraktAccessToken(uid);

    const db = admin.firestore();
    const userSnap = await db.collection("users").doc(uid).get();
    const u = (userSnap.exists ? userSnap.data() : {}) as any;
    const seen: number[] = Array.isArray(u.seen) ? u.seen.map(Number) : [];
    const watchlist: number[] = Array.isArray(u.watchlist) ? u.watchlist.map(Number) : [];
    const scores: Record<string, number> =
      u.scores && typeof u.scores === "object" && !Array.isArray(u.scores) ? u.scores : {};

    // Union of Canon ids referenced by the user's data (real DB ids only), capped.
    const wanted = new Set<number>();
    [...seen, ...watchlist, ...Object.keys(scores).map(Number)].forEach((i) => {
      if (Number.isInteger(i) && TITLES[i]) wanted.add(i);
    });
    const idList = [...wanted].slice(0, 600);

    const resolved = new Map<number, TraktRef>();
    let notFound = 0;
    for (const cid of idList) {
      const r = await resolveTraktId(TITLES[cid], clientId);
      if (r) resolved.set(cid, r);
      else notFound++;
    }

    const history = { movies: [] as any[], shows: [] as any[] };
    const ratings = { movies: [] as any[], shows: [] as any[] };
    const wl = { movies: [] as any[], shows: [] as any[] };
    for (const cid of seen) {
      const r = resolved.get(cid);
      if (r) history[r.kind].push({ ids: { trakt: r.traktId } });
    }
    for (const cid of watchlist) {
      const r = resolved.get(cid);
      if (r) wl[r.kind].push({ ids: { trakt: r.traktId } });
    }
    for (const key of Object.keys(scores)) {
      const r = resolved.get(Number(key));
      if (!r) continue;
      const rating = Math.max(1, Math.min(10, Math.round(Number(scores[key]) / 10)));
      ratings[r.kind].push({ ids: { trakt: r.traktId }, rating });
    }

    async function postSync(endpoint: string, body: { movies: any[]; shows: any[] }): Promise<any> {
      if (!body.movies.length && !body.shows.length) return null;
      const res = await fetch(`https://api.trakt.tv/sync/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "trakt-api-version": "2",
          "trakt-api-key": clientId,
          "User-Agent": TRAKT_USER_AGENT,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        logger.warn(`trakt sync/${endpoint} failed`, { uid, status: res.status, detail: detail.slice(0, 200) });
        throw new HttpsError("aborted", `Trakt ${endpoint} sync failed (${res.status})`);
      }
      return res.json();
    }

    const historyRes = await postSync("history", history);
    const ratingsRes = await postSync("ratings", ratings);
    const watchlistRes = await postSync("watchlist", wl);

    await db.collection("users").doc(uid).set({ trakt: { lastSyncAt: Date.now() } }, { merge: true });

    const added = (r: any): number =>
      r ? (r.added?.movies || 0) + (r.added?.shows || 0) + (r.added?.episodes || 0) : 0;
    const result = {
      ok: true,
      resolved: resolved.size,
      notFound,
      history: added(historyRes),
      ratings: added(ratingsRes),
      watchlist: added(watchlistRes),
    };
    logger.info("trakt sync done", { uid, ...result });
    return result;
  }
);

// ── traktPull (Trakt → Canon read-sync) ───────────────────────────
// The reverse of traktSync: reads the user's Trakt watched / ratings /
// watchlist and reflects them into their Canon data (Seen, Scores,
// Watchlist). Writes the merged result to users/{uid}, so the client's
// onSnapshot listener applies it live — the client only triggers.

// Server-side title normaliser (mirrors the client's lbNormTitle) +
// reverse index Canon title/year → id, built once at module load.
function normTitle(s: string): string {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim().replace(/\s+/g, " ");
}
const REVERSE_TY: Record<string, number> = {}; // "nt|year|type" → canonId
const REVERSE_T: Record<string, number[]> = {}; // "nt|type" → canonId[]
for (const t of TITLES_RAW) {
  const nt = normTitle(t.title);
  REVERSE_TY[`${nt}|${t.year}|${t.type}`] = t.id;
  const k = `${nt}|${t.type}`;
  (REVERSE_T[k] = REVERSE_T[k] || []).push(t.id);
}
function matchCanonId(title: string, year: number, kind: "movie" | "show"): number | null {
  const nt = normTitle(title);
  const ct = kind === "movie" ? "film" : "tv";
  for (const yy of [year, year + 1, year - 1]) {
    const id = REVERSE_TY[`${nt}|${yy}|${ct}`];
    if (id != null) return id;
  }
  const cands = REVERSE_T[`${nt}|${ct}`] || [];
  return cands.length === 1 ? cands[0] : null;
}

async function traktGet(pathname: string, token: string, clientId: string): Promise<any[]> {
  const res = await fetch(`https://api.trakt.tv${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "trakt-api-version": "2",
      "trakt-api-key": clientId,
      "User-Agent": TRAKT_USER_AGENT,
    },
  });
  if (!res.ok) {
    logger.warn(`trakt GET ${pathname} failed`, { status: res.status });
    throw new HttpsError("aborted", `Trakt read failed on ${pathname} (${res.status})`);
  }
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

export const traktPull = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    secrets: [TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, TRAKT_REDIRECT_URI],
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async (req) => {
    const { uid } = assertVerifiedUser(req);
    const clientId = TRAKT_CLIENT_ID.value();
    const token = await loadTraktAccessToken(uid);

    const [wMovies, wShows, rMovies, rShows, lMovies, lShows] = await Promise.all([
      traktGet("/sync/watched/movies", token, clientId),
      traktGet("/sync/watched/shows", token, clientId),
      traktGet("/sync/ratings/movies", token, clientId),
      traktGet("/sync/ratings/shows", token, clientId),
      traktGet("/sync/watchlist/movies", token, clientId),
      traktGet("/sync/watchlist/shows", token, clientId),
    ]);

    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const u = (snap.exists ? snap.data() : {}) as any;
    const seenSet = new Set<number>(
      (Array.isArray(u.seen) ? u.seen : []).map(Number).filter((n: number) => Number.isInteger(n) && TITLES[n])
    );
    const wlSet = new Set<number>(
      (Array.isArray(u.watchlist) ? u.watchlist : []).map(Number).filter((n: number) => Number.isInteger(n) && TITLES[n])
    );
    const scores: Record<string, number> =
      u.scores && typeof u.scores === "object" && !Array.isArray(u.scores) ? { ...u.scores } : {};

    let addedSeen = 0, addedScores = 0, addedWatch = 0;
    const notInCanon = new Set<string>();
    const toCanon = (entry: any, kind: "movie" | "show"): number | null => {
      const o = entry[kind];
      if (!o || !o.title) return null;
      const id = matchCanonId(String(o.title), Number(o.year), kind);
      if (id == null) notInCanon.add(`${normTitle(String(o.title))}|${o.year}`);
      return id;
    };

    // Watched → Seen (and clear from Watchlist — watched implies not-to-watch)
    for (const e of [...wMovies.map((x) => ["movie", x] as const), ...wShows.map((x) => ["show", x] as const)]) {
      const id = toCanon(e[1], e[0]);
      if (id != null) {
        if (!seenSet.has(id)) { seenSet.add(id); addedSeen++; }
        wlSet.delete(id);
      }
    }
    // Ratings → Scores (fill gaps only; Trakt 1–10 → Canon 10–100)
    for (const e of [...rMovies.map((x) => ["movie", x] as const), ...rShows.map((x) => ["show", x] as const)]) {
      const id = toCanon(e[1], e[0]);
      if (id != null && scores[id] == null) {
        scores[id] = Math.min(100, Math.max(0, Math.round(Number(e[1].rating) * 10)));
        addedScores++;
      }
    }
    // Watchlist → Watchlist (skip anything already Seen)
    for (const e of [...lMovies.map((x) => ["movie", x] as const), ...lShows.map((x) => ["show", x] as const)]) {
      const id = toCanon(e[1], e[0]);
      if (id != null && !seenSet.has(id) && !wlSet.has(id)) { wlSet.add(id); addedWatch++; }
    }

    await userRef.set(
      { seen: [...seenSet], watchlist: [...wlSet], scores, trakt: { lastPullAt: Date.now() } },
      { merge: true }
    );

    const result = { ok: true, addedSeen, addedScores, addedWatch, notInCanon: notInCanon.size };
    logger.info("trakt pull done", { uid, ...result });
    return result;
  }
);

const clampStr = (v: unknown, max: number): string =>
  String(v == null ? "" : v).slice(0, max);

export const logError = onRequest(
  { region: "us-central1", cors: true, invoker: "public", memory: "256MiB" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).end();
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const lineNum = Number(body.line);
    const colNum = Number(body.col);
    const entry = {
      msg: clampStr(body.msg, 500),
      stack: clampStr(body.stack, 4000),
      src: clampStr(body.src, 500),
      line: Number.isFinite(lineNum) ? lineNum : null,
      col: Number.isFinite(colNum) ? colNum : null,
      url: clampStr(body.url, 500),
      ua: clampStr(body.ua, 300),
      kind: clampStr(body.kind, 40),
      appVersion: clampStr(body.appVersion, 40),
      uid: clampStr(body.uid, 64) || null,
    };

    // Ignore empty payloads.
    if (!entry.msg && !entry.stack) {
      res.status(204).end();
      return;
    }

    // Best-effort App Check: a valid token gates the Firestore mirror; a
    // present-but-invalid token is a forgery attempt and is rejected outright.
    let verifiedApp = false;
    const tok = req.get("X-Firebase-AppCheck");
    if (tok) {
      try {
        await admin.appCheck().verifyToken(tok);
        verifiedApp = true;
      } catch {
        res.status(401).json({ error: "Invalid App Check token" });
        return;
      }
    }

    // Always log to Cloud Logging.
    logger.error("client-error", { ...entry, verifiedApp });

    // App-verified traffic also gets a queryable Firestore row.
    if (verifiedApp) {
      try {
        await admin
          .firestore()
          .collection("diagnostics")
          .add({ ...entry, ts: admin.firestore.FieldValue.serverTimestamp() });
      } catch (e: any) {
        logger.warn("diagnostics write failed", { err: e?.message });
      }
    }

    res.status(204).end();
  }
);
