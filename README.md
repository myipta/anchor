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

- Email intake imports forwarded itinerary and hotel confirmations into the active trip. Route `trips@mattyip.dev` to the Worker with Cloudflare Email Routing; sender email must be allowlisted. If the stored data is a multi-trip library, intake updates only `activeTripId`. The parser ignores emails without useful travel facts: date-only hotels, flight-number-only stubs, and dummy/random notes should not mutate the trip. The Today header shows an email/import button, a document button, a refresh button, and recent banners when `travelInbox` or `documents` has entries.

- Multi-trip support is implemented inside the existing `anchor_v1` / `/api/trip` blob as `{ version: 2, activeTripId, trips }`. The Today tab has the trip selector and create-trip action. Anchors, scratchpad, itinerary, flights, inbox, and hotel details stay scoped to the selected trip. New trips copy only training data (`prefs` and `taste`) from the current trip.

- Document emails: if the email body includes “save this for the trip on July 10” or “save this for the trip in Paris,” intake saves a cleaned readable document to the matching trip by date/city while still parsing any flight/hotel facts. Tiny dummy/test documents are ignored, and document-only emails do not create travel import inbox rows. First pass stores extracted email body/HTML text; PDF/image attachment OCR is still future work. Saved documents can be removed from the Documents list by swiping left.

- Imported flights are active trip context, not just stored data. Today shows matching arrival flights as timeline stops and an arrival-context action card; Search shows a landing strip, can be opened from Today with an arrival prompt, and sends flights/arrivalFlight into `/api/concierge` so Claude can plan around landing time, airport, luggage, and the hotel area. Day views also render flight events on matching departure/arrival dates, so Day 1 visibly changes when an arrival lands that day. Intake stores richer flight fields when available: confirmation/record locator, terminal, gate, seat, boarding time, status, check-in/manage-booking URL, and airline URL. True automatic last-minute gate refresh still needs a flight-status provider; the current UI gives a Live status action using the imported URL or a flight-status search fallback.

- Multi-city foundation: Search/concierge now reads the active trip destination, keeps chat history scoped per trip, and sends destination-aware Google Places queries. Japan trips can still use Tabelog-flavored behavior; non-Japan trips such as Denver should not be refused or shown Tabelog links. Remaining work: generalize Discover/Today built-in content beyond Tokyo.
