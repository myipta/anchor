# Anchor — API setup

The app (`index.html`) is a static React page. The `/functions` directory adds
a small serverless API that runs on **Cloudflare Pages Functions** — same domain
as the app, no separate server. Your API keys live as **encrypted environment
variables in Cloudflare**, never in the code or the git repo.

## Endpoints

| Route          | Method | Purpose                                                        | Key needed         |
| -------------- | ------ | -------------------------------------------------------------- | ------------------ |
| `/api/health`  | GET    | Reports which keys are configured (never returns the values)  | none               |
| `/api/suggest` | POST   | Claude ranks candidate places for a traveler + writes reasons | `ANTHROPIC_API_KEY`|
| `/api/places`  | POST   | Apify fetches real Tokyo venue data (ratings, hours, coords)  | `APIFY_TOKEN`      |

If a key is missing the endpoint returns `503 { error: "missing_key" }` with a
clear message — the app keeps working on its built-in data.

## Production — add keys in Cloudflare (one time)

1. Cloudflare dashboard → **Workers & Pages → anchor → Settings → Environment variables**.
2. Add, as **encrypted** (Secret) variables for Production (and Preview):
   - `ANTHROPIC_API_KEY` — your Claude API key (`sk-ant-…`)
   - `APIFY_TOKEN` — your Apify token (`apify_api_…`)
   - *(optional)* `ANTHROPIC_MODEL` (default `claude-haiku-4-5-20251001`; try `claude-sonnet-4-6`)
   - *(optional)* `APIFY_ACTOR` (default `compass~crawler-google-places`)
3. **Redeploy** (any push, or "Retry deployment") so the new vars take effect.
4. Verify: open `https://anchor.mattyip.dev/api/health` → `keys` should read `true`.

The keys never appear in the browser, the repo, or build logs — Functions read
them server-side at request time.

## Local development

```bash
cp .dev.vars.example .dev.vars   # then paste your real keys (.dev.vars is gitignored)
npx wrangler pages dev .         # serves index.html + /functions at http://localhost:8788
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

curl -X POST http://localhost:8788/api/places \
  -H 'content-type: application/json' \
  -d '{"query":"ramen","area":"Shibuya","limit":5}'
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

Because the API is same-origin, there are no CORS or key-exposure concerns.
