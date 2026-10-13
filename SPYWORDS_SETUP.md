# Spy Words AI Bridge on the existing Anchor Cloudflare Worker

The **same Anchor Worker** hosts Spy Words at `/spywords/`. Anchor's travel endpoints, session authentication, email intake, D1 trip records, and static assets remain separate.

## AI provider: reuse your existing Claude or DeepSeek secret

Spy Words **does not require an OpenAI API key**.

The Worker uses existing encrypted environment bindings:
- `ANTHROPIC_API_KEY` — **preferred when present**, using `ANTHROPIC_MODEL` or `claude-sonnet-4-6`.
- `DEEPSEEK_API_KEY` — **automatic fallback when Claude is not configured**, using `DEEPSEEK_MODEL` or `deepseek-v4-pro`.

Optional non-secret Worker variable: `SPYWORDS_AI_PROVIDER=deepseek` (or `claude`) to explicitly select a provider. If explicitly selected but that key is missing, the Worker returns 503; it does **not** silently substitute another vendor. The default uses Claude when present, otherwise DeepSeek. If a chosen provider returns an API error, the Worker returns 502 rather than making a potentially billable second request to the other provider.

Existing encrypted secrets must be attached to the **anchor** Worker. A secret on a different Worker is not shared. Keep key values in Cloudflare, never GitHub or the iPhone app.

The separate **`SPYWORDS_BRIDGE_TOKEN`** is required for the two AI POST endpoints **and** Cloudflare D1 backup. It must be the same random token you already entered on the iPhone. Do not share or replace it unnecessarily.

## Deploy and verify

Use Anchor's existing GitHub deployment workflow. You do not need to install new npm packages or rebuild the iPhone app for the provider change. The Worker-only change takes effect when deployed.

1. Confirm Cloudflare Workers → anchor → Settings → Variables and Secrets has **ANTHROPIC_API_KEY** or **DEEPSEEK_API_KEY**, plus **SPYWORDS_BRIDGE_TOKEN**. No actual values should be copied out of Cloudflare.
2. After deployment, visit `https://anchor.mattyip.dev/spywords/health`. Expected: `{"status":"ok"}` (routing only).
3. In **Spy Words → HQ → Settings → AI Bridge**, retain `https://anchor.mattyip.dev/spywords` and your existing bridge token.
4. Test with **HQ → Add Your Own Words → Paste details → Use AI for missing exercises**. Parent-authored definitions, synonyms and mnemonic notes take precedence over AI output, and no vocabulary is saved until parent approval.
5. Separately tap **Cloudflare backup & sync → Sync now** to verify Cloudflare D1 backup. A 503 from sync indicates missing `DB` binding, **not** missing AI credentials.

### API routes

| Method | Path | Auth |
|---|---|---|
| GET | `/spywords/health` | none (no secrets disclosed) |
| POST | `/spywords/v1/packs/generate` | `Authorization: Bearer <SPYWORDS_BRIDGE_TOKEN>` |
| POST | `/spywords/v1/clues/remix` | same |
| GET/POST | `/spywords/v1/sync` | same; requires Anchor's `DB` binding |

### Testing and safeguards

`npm run check` includes mocked Claude and DeepSeek endpoint tests and sync checks. No paid model calls occur during these tests.

- The client sends vocabulary prompts, not the child's name or answer history, to AI providers. Sync **does** store approved words and learning progress in Anchor D1 (see `SPYWORDS_SYNC.md`).
- Parent review is mandatory because generated questions may still be semantically wrong despite validation.
- Shared-token access is suitable only for a private family pilot. Rate limiting in the Worker is per isolate, not a guaranteed global spending cap. Use provider-side spending alerts.
- Never put provider keys or Bridge tokens in source code.
