# Anchor — iOS app (Capacitor wrapper)

This wraps the existing web app (`./public`, served live at `anchor.mattyip.dev`)
in a native iOS shell so you can run it in the **Simulator** and on your
**iPhone** — for **free**, no Apple Developer Program needed until you want to
ship to the App Store.

## What this is
- `capacitor.config.json` loads the **live site** (`server.url`), so the native
  app behaves exactly like Safari: same-origin cookies, working login, live
  APIs, Tabelog/Google links. Nothing to re-implement.
- The app icon + splash come from `./assets/icon.png` and `./assets/splash.png`.

## Prerequisites (one-time, on a Mac)
- **Xcode** (free, Mac App Store — large download). Open it once to install components.
- **CocoaPods**: `sudo gem install cocoapods` (or `brew install cocoapods`).
- **Node 18+**.

## Build & run (free, no Apple account for Simulator)
```bash
npm install                 # installs Capacitor CLI + libs
npx cap add ios             # generates the native ios/ project (Mac only)
npm run ios:assets          # generates iOS app icon + splash from ./assets
npx cap sync ios            # copies config + runs pod install
npx cap open ios            # opens the project in Xcode
```
In Xcode: pick a Simulator (e.g. iPhone 15) and hit ▶ — Anchor launches as a
native app. **No Apple account required for the Simulator.**

## Run on your own iPhone (free, 7-day builds)
1. Plug in your iPhone, select it as the run target in Xcode.
2. Xcode → project → **Signing & Capabilities** → check *Automatically manage
   signing* → select your personal **Team** (a free Apple ID works).
3. Hit ▶. (Free-account builds expire after 7 days — just re-run to refresh.)
4. The `tabelog://` deep-link only works on a real device with the Tabelog app
   installed.

## Shipping to the App Store (later — the $99/yr step)
- Apple Developer Program ($99/yr) → Xcode **Product → Archive** → upload to App
  Store Connect → TestFlight → submit.
- **Before submitting**, switch from live-URL to **bundled assets** for offline
  support and to satisfy App Store Guideline 4.2:
  1. Remove the `"server"` block from `capacitor.config.json` (so it bundles
     `./public` instead of loading the URL).
  2. Handle cross-origin auth: the bundled app runs on `capacitor://localhost`
     while the API is `https://anchor.mattyip.dev` — set the session cookie to
     `SameSite=None; Secure`, add CORS (`Access-Control-Allow-Credentials`) on
     the API, and use `credentials: 'include'` on fetches. (Ask and I'll wire
     this.)

## Updating the app
Web changes deploy to `anchor.mattyip.dev` as usual; since this wrapper loads the
live URL, the app picks them up automatically — no rebuild needed (until you
switch to bundled mode for the App Store).
