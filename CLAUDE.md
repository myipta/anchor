# Anchor — project context (read me first)

Anchor is a **Tokyo trip concierge**: a chat-first web app (Claude/DeepSeek "Tokyo
local" that recommends real places, learns taste, plans days) wrapped as an
**iOS app** via Capacitor. Live at **https://anchor.mattyip.dev**.

## How it deploys (no build step)
- `git push` to **main** → Cloudflare auto-runs `npx wrangler deploy` → live in ~1–2 min.
- Static site is `./public` (uploaded as-is). Worker is `worker.js` + `./functions/api/*`.
- After pushing, verify with `https://anchor.mattyip.dev/api/health`. (This sandbox
  can't reach the live site — egress is allowlisted — so the user pastes results.)

## Architecture
- **Frontend**: a single file `public/index.html` — React via **in-browser Babel**
  (no bundler). ~3k lines, ~35 components. Inline-style CSS. State in `localStorage`
  (`anchor_v1` = trip, `anchor_chat` = concierge convo). Validate edits by extracting
  the `text/babel` block and running it through `@babel/standalone` (a helper script
  was used as `/tmp/checkbabel.js`).
- **Backend**: `worker.js` hand-routes `/api/*` to `functions/api/*.js` via a `ROUTES`
  map. **Any new endpoint MUST be added to `worker.js` ROUTES** (this bit us twice).
  `functions/api/_*.js` are import-only (not routed): `_lib.js` (json/callDeepSeek/
  extractJson), `_auth.js`, `_email.js`, `_search.js` (Google Places + Apify),
  `_tabelog.js`.
- **DB**: Cloudflare D1 (`wrangler.jsonc` → `database_id`). Tables auto-create via
  `ensureSchema()` in `_auth.js` (no manual migration). Schema also in `schema.sql`.

## Env vars & secrets — IMPORTANT gotcha
- **Plaintext dashboard vars get WIPED on every `wrangler deploy`.** Only **secrets**
  and vars **in `wrangler.jsonc`** survive. (This silently broke auth repeatedly.)
- **Secrets** (Cloudflare dashboard, encrypted): `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`,
  `GOOGLE_PLACES_API_KEY`, `APIFY_TOKEN`, `RESEND_API_KEY`.
- **Non-secret config** lives in `wrangler.jsonc` `"vars"`: `EMAIL_FROM`
  (`Anchor <login@mattyip.dev>`), `AUTH_ALLOWLIST` (comma-separated approved emails).
  To add a user, add their email here and push.

## Auth (passwordless email code)
- Flow: email → 6-digit code (Resend) → session cookie (`sid`, 60d, httpOnly).
  First verify auto-creates the account. `LoginScreen` + `/api/auth/*` + `_auth.js`.
- **Allowlist-gated**: only `AUTH_ALLOWLIST` emails can request a code.
- **Sign-in required up front** when D1 is bound (Root init in `index.html`).
- **API cost protection**: `worker.js` requires a logged-in session for the costly
  endpoints (concierge/tabelog/suggest/search/near/optimize/chat/refine/parse-place/
  places/photo). Auth + health stay open.
- Resend: domain `mattyip.dev` is verified; send FROM `@mattyip.dev` (the `send.`
  subdomain in the DNS is just the return-path, not the from-domain).

## Concierge & recommendations
- `Search` tab = the concierge (`SearchScreen` in `index.html`). Model toggle
  Claude/DeepSeek (`callDeepSeek` uses `thinking:{type:'disabled'}` — the v4 model
  is a thinker that otherwise returns empty `content`). Reply streams first, cards
  stream in. Learns taste (deduped via `mergeTags`), gathers trip setup inline.
- Recommendation source = **Google Places** (`/api/tabelog` is Google-first; it
  respects the query and deep-links to the Maps app reliably).
- **Tabelog is effectively read-only search by name**: Tabelog 403s our server
  scrape, and the `parseforge~tabelog-scraper` Apify actor has **no search field**
  (only city/areaCode/maxItems — see `/api/health?actor=1`). So we can't get a
  Tabelog Store ID → can't app-deep-link a specific restaurant. The Tabelog link
  searches the **Japanese name** (fetched from Google via `languageCode:ja`), scoped
  to `tabelog.com/tokyo/`. A search-capable actor (e.g. cloud9_ai) would unlock real
  Tabelog IDs + the `tabelog://rstdtl/{id}` deep-link (helpers already in `index.html`).

## iOS app (Capacitor)
- Config: `capacitor.config.json` (`appId dev.mattyip.anchor`, `server.url` = live
  site → same-origin auth, auto-updates). Icons/splash source in `./assets`.
- Build: `npm install && npx cap add ios && npm run ios:assets && npx cap sync ios &&
  npx cap open ios`, then ⌘R in Xcode. Needs Mac + Xcode + CocoaPods. See `IOS_SETUP.md`.
- **`server.url` means web changes need NO native rebuild** — but the WebView caches,
  so to see changes: Simulator → delete app → ⌘R (or we bust cache). Native config
  changes (`capacitor.config.json`) need `git pull && npx cap sync ios` + ⌘R.
- A visible **`BUILD` stamp** (const near top of `index.html`, shown on login +
  concierge header) confirms which page loaded. **Bump it each notable change.**
- WebView is not a real Safari tab → the `--safari-inset` (for Safari's floating URL
  bar) is zeroed when UA lacks `Version/`.

## Diagnostics (user opens these, pastes back)
- `/api/health` — keys/db/email/allowlist counts.
- `/api/health?probe=1` — live DeepSeek/Places/Tabelog probes.
- `/api/health?actor=1` — Apify actor input schema (uses the token; never returns it).
- `/api/health?email=addr` — test a Resend send, shows the exact error.

## Current state / open items
- ✅ Web app, auth (allowlist + Resend verified), API gating, iOS app running in sim.
- 🔭 **Bottom nav**: just redesigned as a floating pill (BUILD 5) — may need spacing
  tuning; user may want it to *truly overlay* content (bigger change; each screen
  needs bottom room, concierge input must clear it).
- 🔭 Tabelog precise app-links blocked (see above) unless a search-capable actor.
- 🔭 The `BUILD` stamp is a debug artifact — remove when done iterating.
- 🔭 App Store later: switch off `server.url` → bundle `./public`, handle cross-origin
  cookies (`SameSite=None`+CORS+`credentials:'include'`). See `IOS_SETUP.md`.

## Conventions
- Match the surrounding terse, inline-style code. Keep endpoints fail-soft.
- Always `node --check` backend files and run the babel check on `index.html` before
  committing. Commit + push only when the user asks (they usually say "push").
