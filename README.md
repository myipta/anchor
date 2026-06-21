# CODING AGENTS: READ THIS FIRST

This is a **handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle so a coding agent can implement the designs for real.

## What you should do — IMPORTANT

**Read the chat transcripts first.** There are 1 chat transcript(s) in `chats/`. The transcripts show the full back-and-forth between the user and the design assistant — they tell you **what the user actually wants** and **where they landed** after iterating. Don't skip them. The final HTML files are the output, but the chat is where the intent lives.

**Read `project/Anchor.dc.html` in full.** The user had this file open when they triggered the handoff, so it's almost certainly the primary design they want built. Read it top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `README.md` — this file
- `chats/` — conversation transcripts (read these!)
- `project/` — the `Anchor` project files (HTML prototypes, assets, components)

## Current Engineering Notes

- Restaurant recommendation cards must exclude lodging results. `/api/tabelog` filters hotel/lodging/hostel/ryokan-style categories and the current stay before returning cards, and the Search UI removes existing lodging cards when the traveler says things like “no hotels.” Keep this deterministic; do not rely only on LLM taste-ranking for exclusion.

- Email intake imports forwarded itinerary and hotel confirmations into the saved trip. Route `trips@mattyip.dev` to the Worker with Cloudflare Email Routing; sender email must be allowlisted.

- Future roadmap: support multiple trips per user and destinations outside Tokyo. The data model should move from one active `anchor_v1` trip blob to selectable trip records. City support should keep the same concierge/planning pattern, but recommendation providers become destination-aware: Tabelog is Japan-only; non-Japan cities should use Google Places and/or other local sources instead of Tabelog.
