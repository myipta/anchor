// Anchor Worker entry point.
//
// Static files in ./public are served automatically by the assets binding
// (configured in wrangler.jsonc). This script only runs for requests that
// DON'T match a static asset — so we route /api/* here and let everything
// else fall through to the assets handler.
//
// The /api handlers live in ./functions/api and use a Pages-style signature
// ({ request, env }); they only touch request and env, so they work as-is.

import { onRequest as health } from './functions/api/health.js';
import { onRequest as suggest } from './functions/api/suggest.js';
import { onRequest as places } from './functions/api/places.js';

const ROUTES = {
  '/api/health': health,
  '/api/suggest': suggest,
  '/api/places': places,
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const handler = ROUTES[pathname];
    if (handler) return handler({ request, env });
    // Not an API route → serve a static asset (index.html, /vendor/*, …).
    return env.ASSETS.fetch(request);
  },
};
