# Anchor

A personal AI travel concierge. Forward it your booking confirmations and it turns
them into a structured trip: flights, hotels, and documents become live context that
a Claude-powered concierge plans around.

Built solo, with Claude Code and Claude Design, as a working answer to a simple
annoyance: every trip I take lives in ten confirmation emails, three apps, and a
notes file. Anchor makes the trip itself the object.

## What it does

**Email intake.** Forward a flight or hotel confirmation to a dedicated intake
address and it lands in the right trip as structured data: airline, record locator,
terminal, gate, seat, boarding time, check-in link. No forms. The parser ignores
junk and refuses to let a date-only stub or a test email mutate a real trip.

**A concierge with real context.** The chat isn't a generic travel bot. It knows
your arrival time, airport, hotel neighborhood, and saved places, and plans around
them: what to do near the hotel on landing day, where to eat that isn't another
hotel restaurant. Recommendation filtering is deterministic first, taste-ranked
second.

**Today view.** The day's plan as a timeline: arrival flights render as stops,
imported documents surface when relevant, and the layout comes in three deliberate
modes (map-first, sheet-over-map, compact list).

**Multi-trip.** Trips are scoped: chat history, anchors, itinerary, flights, and
documents belong to one trip. New trips inherit only your preferences and taste,
never another trip's data.

## Stack

- Cloudflare Workers + D1, with Cloudflare Email Routing feeding the intake parser
- Claude API for the concierge, with trip state passed as context
- Web app via Vite; iOS build via Capacitor
- Google Places and Tabelog-flavored search for Japan trips

## Why it's built this way

The interesting problem isn't the UI, it's the pipeline: messy personal inputs
(emails, forwards, scraps) becoming structured context that makes a personalized
product possible. That pattern generalizes well beyond travel.

## Product invariants

These are the rules the codebase holds, written as instructions to the coding
agents that help build it:

- Restaurant cards must exclude lodging. The API filters hotel/ryokan-style
  categories and the current stay deterministically; LLM taste-ranking is never
  the only exclusion mechanism.
- Intake must not corrupt trips. Sender addresses are allowlisted, date-only
  hotels and flight-number stubs are ignored, and document-only emails don't
  create import rows.
- Trip normalization must never coerce a missing destination to a default city.
  Fallback copy can say Tokyo; persisted data cannot.
- Non-Japan trips are first-class: no Tabelog links, no refusals, no backfilling
  a Denver trip with curated Tokyo places.
- Imported flights are context, not storage. Landing time changes what Day 1
  shows and what the concierge suggests.
- The three Today layouts stay distinct. If they collapse into three copies of
  the same timeline, that's a regression.

## Status

Personal project, actively used on real trips. PDF/image OCR for attachments and
live flight-status refresh are the known next pieces.

## Bundle contents

- `README.md` — this file
- `chats/` — conversation transcripts (read these!)
- `project/` — the `Anchor` project files (HTML prototypes, assets, components)

## Current Engineering Notes

- Restaurant recommendation cards must exclude lodging results. `/api/tabelog` filters hotel/lodging/hostel/ryokan-style categories and the current stay before returning cards, and the Search UI removes existing lodging cards when the traveler says things like “no hotels.” Keep this deterministic; do not rely only on LLM taste-ranking for exclusion.

- Email intake imports forwarded itinerary and hotel confirmations into the active trip. Route `trips@mattyip.dev` to the Worker with Cloudflare Email Routing; sender email must be allowlisted. If the stored data is a multi-trip library, intake updates only `activeTripId`. The parser ignores emails without useful travel facts: date-only hotels, flight-number-only stubs, and dummy/random notes should not mutate the trip. The Today header shows an email/import button, a document button, a refresh button, and recent banners when `travelInbox` or `documents` has entries.

- Multi-trip support is implemented inside the existing `anchor_v1` / `/api/trip` blob as `{ version: 2, activeTripId, trips }`. The Today tab has the trip selector and create-trip action. Anchors, scratchpad, itinerary, flights, inbox, and hotel details stay scoped to the selected trip. New trips copy only training data (`prefs` and `taste`) from the current trip. Trip normalization must never coerce a missing or non-Japan destination to Tokyo; Tokyo can be UI fallback copy, not persisted trip data.

- Document emails: if the email body includes “save this for the trip on July 10” or “save this for the trip in Paris,” intake saves a cleaned readable document to the matching trip by date/city while still parsing any flight/hotel facts. Tiny dummy/test documents are ignored, and document-only emails do not create travel import inbox rows. First pass stores extracted email body/HTML text; PDF/image attachment OCR is still future work. Saved documents can be removed from the Documents list by swiping left.

- Imported flights are active trip context, not just stored data. Today shows matching arrival flights as timeline stops and an arrival-context action card; Search shows a landing strip, can be opened from Today with an arrival prompt, and sends flights/arrivalFlight into `/api/concierge` so Claude can plan around landing time, airport, luggage, and the hotel area. Day views also render flight events on matching departure/arrival dates, so Day 1 visibly changes when an arrival lands that day. Intake stores richer flight fields when available: confirmation/record locator, terminal, gate, seat, boarding time, status, check-in/manage-booking URL, and airline URL. True automatic last-minute gate refresh still needs a flight-status provider; the current UI gives a Live status action using the imported URL or a flight-status search fallback.

- Multi-city foundation: Search/concierge now reads the active trip destination, keeps chat history scoped per trip, and sends destination-aware Google Places queries. Japan trips can still use Tabelog-flavored behavior; non-Japan trips such as Denver should not be refused, shown Tabelog links, or routed through `/api/tabelog`; use `/api/search` directly. Today must not backfill non-Tokyo trips with curated Tokyo places; until live local Today suggestions are implemented, non-Tokyo Today uses flights, hotels, anchors, saved places, documents, and a Search prompt. Remaining work: generalize Discover built-in content beyond Tokyo.

- Today layout modes are intentionally distinct: Map is map-first, Sheet is a draggable-style card over the map, and List is a compact no-map list. Do not let these collapse back into three copies of the same timeline.

## Spy Words (shared Worker)

This Worker also serves the opt-in Spy Words vocabulary AI Bridge under `/spywords/*`, without modifying Anchor trip, account, or email routes. See [SPYWORDS_SETUP.md](SPYWORDS_SETUP.md) for one-time encrypted secret setup, deployment, and iPhone configuration. The changes are not live until deployed.
