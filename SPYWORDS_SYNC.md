# Spy Words backup in Anchor D1

This adds a private family sync endpoint to the existing Spy Words API in the Anchor Cloudflare Worker. It uses the **existing** D1 binding (`DB`) and the **existing** secret `SPYWORDS_BRIDGE_TOKEN`. Do not place this token in GitHub or source files.

Endpoints (require `Authorization: Bearer <SPYWORDS_BRIDGE_TOKEN>`):

- `GET /spywords/v1/sync`: returns an append-only set of custom approved word packs and the learning snapshots for up to 20 devices.
- `POST /spywords/v1/sync`: appends newly approved packs by immutable ID, writes the calling device's progress snapshot, and returns the union.

Tables `spywords_cloud_packs` and `spywords_cloud_profiles` are created by the handler on first request. No new Cloudflare secrets, project, database, or migrations are required. The endpoints operate independently of Anchor's trip data, sign-in and email logic. Do not put Claude, DeepSeek, or Bridge credentials into iOS source code or GitHub.

Important: **Privacy changes:** unlike the AI exercise generation feature, cloud sync intentionally saves the child's agent name, scores, progress, practice-session summaries, and parent-authored vocabulary in Anchor's D1 database. Only use the Bridge token on trusted devices. Data are not end-to-end encrypted. The backup does not automatically recover words that were lost before syncing was installed. Updates are union-merged; there is no DELETE endpoint.

Tests: `node --test scripts/check-spywords-sync.mjs` (uses in-memory SQLite and mocks all paid API calls); the existing test suite covers Anchor's routes separately.
