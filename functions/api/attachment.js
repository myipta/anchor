import { json, preflight, requireMethod } from './_lib.js';
import { requireDB, getUser, unauthorized } from './_auth.js';

export async function onRequest({ request, env }) {
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'GET'); if (bad) return bad;
  const noDb = requireDB(env); if (noDb) return noDb;
  const user = await getUser(request, env);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const docId = (url.searchParams.get('doc') || '').trim();
  const index = Math.max(0, Number(url.searchParams.get('i')) || 0);
  if (!docId) return json({ error: 'missing_doc' }, 400);

  const row = await env.DB.prepare('SELECT data FROM trips WHERE user_id=?').bind(user.id).first();
  let stored = null;
  if (row?.data) { try { stored = JSON.parse(row.data); } catch { stored = null; } }
  const found = findAttachment(stored, docId, index);
  if (!found) return json({ error: 'not_found' }, 404);
  if (!found.dataUrl) return json({ error: 'not_available' }, 404);

  const m = String(found.dataUrl).match(/^data:application\/pdf;base64,(.+)$/i);
  if (!m) return json({ error: 'bad_attachment' }, 400);
  let bytes;
  try {
    const bin = atob(m[1].replace(/\s+/g, ''));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return json({ error: 'bad_attachment' }, 400);
  }

  const filename = String(found.name || 'attachment.pdf').replace(/[\r\n"]/g, '').slice(0, 140) || 'attachment.pdf';
  return new Response(bytes, {
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(bytes.length),
      'content-disposition': `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function findAttachment(data, docId, index) {
  const trips = Array.isArray(data?.trips) ? data.trips : (data && typeof data === 'object' ? [data] : []);
  for (const trip of trips) {
    const deleted = new Set(Array.isArray(trip?.deletedDocumentIds) ? trip.deletedDocumentIds.map(String) : []);
    const docs = Array.isArray(trip?.documents) ? trip.documents : [];
    const doc = docs.find(d => String(d?.id || '') === docId && !deleted.has(String(d?.id || '')));
    const attachment = doc && Array.isArray(doc.attachments) ? doc.attachments[index] : null;
    if (attachment) return attachment;
  }
  return null;
}
