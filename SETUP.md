# Anchor — API setup

The app is a Vite-built React app (`src/main.jsx` → `dist/`). The `/functions` directory adds
a small serverless API that runs on **Cloudflare Pages Functions** — same domain
as the app, no separate server. Your API keys live as **encrypted environment
variables in Cloudflare**, never in the code or the git repo.

## Endpoints

| Route          | Method | Purpose                                                        | Key needed             |
| -------------- | ------ | -------------------------------------------------------------- | ---------------------- |
| `/api/health`  | GET    | Reports which keys are configured (never returns the values)  | none                   |
| `/api/chat`    | POST   | Conversational onboarding (Sonnet) — extracts trip fields     | `ANTHROPIC_API_KEY`    |
| `/api/suggest` | POST   | DeepSeek ranks candidate places for a traveler + writes reasons | `DEEPSEEK_API_KEY`    |
| `/api/parse-place` | POST | DeepSeek cleans a messy note / Google-Yelp link into a lookup | `DEEPSEEK_API_KEY`    |
| `/api/optimize` | POST  | DeepSeek orders a day's stops around hotel, hours & daypart   | `DEEPSEEK_API_KEY`    |
| `/api/places`  | POST   | Google Places fetches real Tokyo venue data (rating, hours…)  | `GOOGLE_PLACES_API_KEY`|

If a key is missing the endpoint returns `503 { error: "missing_key" }` with a
clear message — the app keeps working on its built-in data.

## Production — add keys in Cloudflare (one time)

1. Cloudflare dashboard → **Workers & Pages → anchor → Settings → Environment variables**.
2. Add, as **encrypted** (Secret) variables for Production (and Preview):
   - `DEEPSEEK_API_KEY` — your DeepSeek API key (`sk-…`)
   - `GOOGLE_PLACES_API_KEY` — your Google Places API key (`AIza…`)
   - *(optional)* `DEEPSEEK_MODEL` (default `deepseek-v4-flash`; try `deepseek-v4-pro`)

   The Google key must have the **Places API (New)** enabled in Google Cloud
   (APIs & Services → Library). Restrict it to that API; an HTTP-referrer
   restriction won't work since the call is made server-side, so prefer leaving
   it unrestricted-by-referrer but **API-restricted** to Places.
3. **Redeploy** (any push, or "Retry deployment") so the new vars take effect.
4. Verify: open `https://anchor.mattyip.dev/api/health` → `keys` should read `true`.

The keys never appear in the browser, the repo, or build logs — Functions read
them server-side at request time.

## Local development

```bash
cp .dev.vars.example .dev.vars   # then paste your real keys (.dev.vars is gitignored)
npm run dev                  # Vite frontend dev server
npx wrangler dev              # Worker/API dev server
```

Test the endpoints:

```bash
curl http://localhost:8788/api/health

curl -X POST http://localhost:8788/api/suggest \
  -H 'content-type: application/json' \
  -d '{"prefs":["coffee","izakaya"],"places":[
        {"id":"blue","name":"Blue Bottle Kiyosumi","area":"Kiyosumi","cat":"coffee","digest":"Quiet flagship, single-origin pour-over."},
        {"id":"omoide","name":"Omoide Yokocho","area":"Shinjuku","cat":"food","digest":"Six-stool yakitori alley, charcoal smoke."}
      ]}'
# → { model:"deepseek-v4-flash", ranked:[{id,score,reason}] }

curl -X POST http://localhost:8788/api/places \
  -H 'content-type: application/json' \
  -d '{"query":"ramen","area":"Shibuya","limit":5}'
# → { source, query, count, places:[{name,rating,reviews,openNow,budget,hours,coords,...}] }
```

## Calling from the app (next step)

The frontend still runs on built-in data. To wire it up, fetch from the app:

```js
const res = await fetch('/api/suggest', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prefs, places: candidates }),
});
const { ranked } = await res.json(); // [{ id, score, reason }]
```

In production the API is same-origin. In local dev, use the built app or proxy setup if you need same-origin behavior.

## Accounts & saved trips (Cloudflare D1)

Trips, anchors, scratchpad and taste are stored **server-side per user** in a
Cloudflare D1 (SQLite) database, so data survives across devices, browsers and
deploy URLs. Sign-in is passwordless: email → 6-digit code → httpOnly session
cookie. Schema lives in `schema.sql`; tables: `users`, `login_codes`,
`sessions`, `trips` (one JSON blob per user; schema already allows multi-trip).

**The app fails open:** if `DB` isn't bound, it runs exactly as before —
offline, saving only to `localStorage`. So you can deploy this safely and turn
on cloud sync when ready.

### One-time setup

1. **Create the database** and copy the returned `database_id`:
   ```bash
   npx wrangler d1 create anchor
   ```
   Paste it into `wrangler.jsonc` → `d1_databases[0].database_id` (replacing
   `REPLACE_WITH_REAL_ID`).

2. **Create the tables** (run on both local and remote):
   ```bash
   npx wrangler d1 execute anchor --local  --file=./schema.sql
   npx wrangler d1 execute anchor --remote --file=./schema.sql
   ```

3. **Email delivery (Resend)** — add as encrypted vars in Cloudflare
   (Settings → Environment variables, Production + Preview):
   - `RESEND_API_KEY` — from resend.com
   - `EMAIL_FROM` — e.g. `Anchor <login@anchor.mattyip.dev>`

   For real delivery to *anyone*, verify a sending domain in Resend (add the DNS
   records). Until then Resend only delivers to your own account email.

4. **Deploy.** Cloudflare provisions the D1 binding from `wrangler.jsonc` on the
   next push.

### Endpoints

| Route                    | Method   | Purpose                                         |
| ------------------------ | -------- | ----------------------------------------------- |
| `/api/auth/request-code` | POST     | Email a 6-digit sign-in code                    |
| `/api/auth/verify`       | POST     | Verify code → open session cookie               |
| `/api/auth/me`           | GET      | Current user, or 401 / 503 (no DB)              |
| `/api/auth/logout`       | POST     | Clear session                                   |
| `/api/trip`              | GET/PUT  | Load / save the signed-in user's trip           |

### Local development with the database

```bash
npx wrangler d1 execute anchor --local --file=./schema.sql   # once
npx wrangler dev --port 8788 --local --var DEV_AUTH:1        # serves app + API + local D1
```

`DEV_AUTH=1` returns the login code in the API response (and the UI shows it),
so you can sign in locally without email. **Never set `DEV_AUTH` in production.**
