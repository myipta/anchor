// Anchor Worker entry point.
//
// Static files in ./dist are served automatically by the assets binding
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
import { onRequest as searchchat } from './functions/api/searchchat.js';
import { onRequest as concierge } from './functions/api/concierge.js';
import { onRequest as tabelog } from './functions/api/tabelog.js';
import { onRequest as authRequestCode } from './functions/api/auth-request-code.js';
import { onRequest as authVerify } from './functions/api/auth-verify.js';
import { onRequest as authMe } from './functions/api/auth-me.js';
import { onRequest as authLogout } from './functions/api/auth-logout.js';
import { onRequest as trip } from './functions/api/trip.js';
import { onRequest as intakeEmail } from './functions/api/intake-email.js';
import { onRequest as attachment } from './functions/api/attachment.js';
import { getUser, unauthorized } from './functions/api/_auth.js';
import { ingestTravelEmail, readEmailMessage, userForInboundEmail } from './functions/api/_intake.js';

// Costly, model/scraper-backed endpoints: require a logged-in (approved) session
// so account-less callers can't run up the API bill. Auth + health stay open.
const PROTECTED = new Set([
  '/api/concierge', '/api/tabelog', '/api/suggest', '/api/search', '/api/searchchat', '/api/near',
  '/api/optimize', '/api/chat', '/api/refine', '/api/parse-place', '/api/places', '/api/photo',
  '/api/intake/email', '/api/intake-email', '/api/attachment',
]);

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
  '/api/searchchat': searchchat,
  '/api/concierge': concierge,
  '/api/tabelog': tabelog,
  '/api/auth/request-code': authRequestCode,
  '/api/auth/verify': authVerify,
  '/api/auth/me': authMe,
  '/api/auth/logout': authLogout,
  '/api/trip': trip,
  '/api/intake/email': intakeEmail,
  '/api/intake-email': intakeEmail,
  '/api/attachment': attachment,
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const handler = ROUTES[pathname];
    if (handler) {
      // Gate the costly endpoints behind an approved session (only when D1 is on).
      if (env.DB && PROTECTED.has(pathname) && request.method !== 'OPTIONS') {
        const user = await getUser(request, env);
        if (!user) return unauthorized();
      }
      return handler({ request, env });
    }
    // Not an API route → serve a static asset (index.html, hashed Vite assets, icons, …).
    return env.ASSETS.fetch(request);
  },

  async email(message, env, ctx) {
    if (!env.DB) { message.setReject('Anchor cloud sync is not configured.'); return; }
    try {
      const parsed = await readEmailMessage(message);
      const mapped = await userForInboundEmail(env, parsed.from);
      if (!mapped.user) { message.setReject('Sender is not approved for Anchor.'); return; }
      const result = await ingestTravelEmail(env, mapped.user, {
        subject: parsed.subject,
        text: parsed.text,
        attachments: parsed.attachments,
        from: parsed.from,
        receivedAt: Date.now(),
      });
      if (result.error) message.setReject(result.error);
    } catch (e) {
      message.setReject('Anchor could not import this travel email.');
    }
  },
};
