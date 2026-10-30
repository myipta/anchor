# Reviewed quest planning

`POST /spywords/v1/quests/plan` accepts the parent's text, today (YYYY-MM-DD), timezone and a ledger of relevant routines/assignments. It uses the existing bearer-token check, request-size/rate limits and configured Claude/DeepSeek/OpenAI provider. It returns a structured proposal or clarification; the endpoint never writes tasks, D1 or CloudKit. The iOS app validates and requires confirmation before committing changes.

Deploy the existing Worker normally with `functions/quest-planner.mjs` included. No new secrets, database migration, binding changes or frontend changes are required. Older iOS generation and backup endpoints remain unchanged. A POST without valid credentials returns 401 rather than 404 when the new route is live; that smoke test does not incur an AI request.

Tests mock the provider and run through the real Worker entry. Live provider results and iPhone/iPad round-trip sync still require end-to-end verification. Roll back by redeploying the previous Worker version if necessary; the new endpoint itself changes no stored data.
