# Reviewed quest planning

Malformed proposals get one regeneration attempt with strict schema guidance, at most two provider calls of 35 seconds each. Repeated invalid responses return actionable HTTP 422; provider transport/auth failures are not retried. Logs contain only validation categories, never the parent's request or model response. Clarification must be a question with no actions; complete proposals use an empty clarification. Explicit consolidation stops each old rule before creating one replacement. iOS build 10 is needed to stop a future routine before its first occurrence.

`POST /spywords/v1/quests/plan` accepts the parent's text, today (YYYY-MM-DD), timezone and a ledger of relevant routines/assignments. It uses the existing bearer-token check, request-size/rate limits and configured Claude/DeepSeek/OpenAI provider. It returns a structured proposal or clarification; the endpoint never writes tasks, D1 or CloudKit. The iOS app validates and requires confirmation before committing changes.

Deploy the existing Worker normally with `functions/quest-planner.mjs` included. No new secrets, database migration, binding changes or frontend changes are required. Older iOS generation and backup endpoints remain unchanged. A POST without valid credentials returns 401 rather than 404 when the new route is live; that smoke test does not incur an AI request.

Tests mock the provider and run through the real Worker entry. Live provider results and iPhone/iPad round-trip sync still require end-to-end verification. Roll back by redeploying the previous Worker version if necessary; the new endpoint itself changes no stored data.
