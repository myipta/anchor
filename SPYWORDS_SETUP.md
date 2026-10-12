# Spy Words AI Bridge on Anchor

This integration uses the **existing** Cloudflare Worker named `anchor` and does not replace Anchor's travel API, email, D1, or static assets.

## What is included

- `functions/spywords-handler.mjs` implements `/spywords/*` and reuses an encrypted `OPENAI_API_KEY` binding **on the Anchor Worker**.
- `worker.js` delegates `/spywords/*` to the handler before the existing Anchor API and assets router.
- All generation routes require an independent `SPYWORDS_BRIDGE_TOKEN`; no OpenAI key is stored in iOS or GitHub.
- Both the 48-word offline game and manual non-AI vocabulary imports continue to work without this setup.

## One-time Cloudflare secret setup

In **Cloudflare Dashboard → Workers & Pages → anchor → Settings → Variables and Secrets**:

1. Confirm an encrypted secret named **`OPENAI_API_KEY`** is attached to **anchor**. A key on a different Worker is *not* automatically available here. The code expects this exact binding name. **Do not paste its value into GitHub, the app, or chat.**
2. Create a separate, random access token on your Mac:
   ```sh
   openssl rand -hex 24
   ```
3. Add a new **Secret** called **`SPYWORDS_BRIDGE_TOKEN`** on the Anchor Worker. Paste that generated access token as the value. Save it securely so you can enter the same token in Spy Words.
4. Optionally set `OPENAI_MODEL` (otherwise `gpt-4.1-mini`). For a browser preview only, `SPYWORDS_ALLOWED_ORIGIN` must be the exact preview origin; never use `*`. Leave it unset for the native iPhone app.

**Important:** Adding/changing a Worker secret can cause a deployment; follow Cloudflare's review prompt. Do not overwrite existing secrets or unrelated config.

## Deploy

This branch is a proposed source change, **not a live Worker deployment**. After reviewing and merging it, use Anchor's normal deployment process or the existing GitHub integration:

```sh
npm ci
npm run check
npm run deploy
```

Cloudflare deployment retains existing encrypted Worker secrets. If Anchor's production secret is not named `OPENAI_API_KEY`, adapt the handler's secret reference to its actual name without revealing the value.

## Verify and connect the iPhone

Anchor's existing setup documents `anchor.mattyip.dev`. If that's still the active hostname:

1. Open `https://anchor.mattyip.dev/spywords/health` in Safari. A deployed handler returns `{"status":"ok"}`. This verifies routing **only**, not OpenAI credentials.
2. In **Spy Words → HQ → Settings → AI Bridge**, enter:
   - **AI Bridge HTTPS URL:** `https://anchor.mattyip.dev/spywords`
   - **Bridge access token:** the value you generated for `SPYWORDS_BRIDGE_TOKEN` — **not** the OpenAI API key
3. Tap **Save AI connection**, then **HQ → Add Your Own Words → Paste details → Use AI for missing exercises**. The request creates a draft that you must review and approve. Existing definitions and synonyms remain authoritative.

If the hostname has changed, use your current Anchor Worker HTTPS hostname with the same `/spywords` suffix.

### API routes

| Method | Path | Authentication |
| --- | --- | --- |
| GET | `/spywords/health` | None; reveals no key |
| POST | `/spywords/v1/packs/generate` | Bearer bridge token |
| POST | `/spywords/v1/clues/remix` | Bearer bridge token |

### Safety / operational notes

- Token is a simple shared secret intended for a family/private pilot. Never hardcode it in client source or GitHub.
- The included rate limiter is per Worker isolate, **not** a strict account-level spending cap. Set an OpenAI project budget and alerts.
- The Worker does not send a child's name, results, or history; it sends vocabulary words and practice content.
- Any generated content needs parent review before approval. AI can still produce inaccurate or ambiguous exercises.
- This integration does not access Anchor's D1 trip data or modify its authentication/email routes.
- Run tests locally: `node --test scripts/check-spywords.mjs`. All model calls in tests are mocked.
