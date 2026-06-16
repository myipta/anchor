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
import { onRequest as chat } from './functions/api/chat.js';
import { onRequest as parsePlace } from './functions/api/parse-place.js';
import { onRequest as optimize } from './functions/api/optimize.js';
import { onRequest as near } from './functions/api/near.js';
import { onRequest as refine } from './functions/api/refine.js';
import { onRequest as photo } from './functions/api/photo.js';
import { onRequest as search } from './functions/api/search.js';
import { onRequest as authRequestCode } from './functions/api/auth-request-code.js';
import { onRequest as authVerify } from './functions/api/auth-verify.js';
import { onRequest as authMe } from './functions/api/auth-me.js';
import { onRequest as authLogout } from './functions/api/auth-logout.js';
import { onRequest as trip } from './functions/api/trip.js';

const ROUTES = {
  '/api/health': health,
  '/api/suggest': suggest,
  '/api/places': places,
  '/api/chat': chat,
  '/api/parse-place': parsePlace,
  '/api/optimize': optimize,
  '/api/near': near,
  '/api/refine': refine,
  '/api/photo': photo,
  '/api/search': search,
  '/api/auth/request-code': authRequestCode,
  '/api/auth/verify': authVerify,
  '/api/auth/me': authMe,
  '/api/auth/logout': authLogout,
  '/api/trip': trip,
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
