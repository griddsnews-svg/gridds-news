// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Event tracking API   /api/track
// Receives an event from the app and writes it to public.story_events.
// Uses the SERVICE ROLE key (server-side only) so the browser never gets
// write access to the database.
//
// Requires Vercel env var:  SUPABASE_SERVICE_KEY  (the service_role secret)
// (SUPABASE_URL is already set from edition.js)
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_EVENTS = ['open', 'fullstory_click'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    return res.status(500).json({ error: 'Supabase service env vars not set' });
  }

  // Parse body (Vercel usually parses JSON automatically, but guard for strings)
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const eventType = String(body.event_type || '');
  if (ALLOWED_EVENTS.indexOf(eventType) === -1) {
    return res.status(400).json({ error: 'Invalid event_type' });
  }

  // Basic uuid shape check for story_id (allow null/empty)
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let storyId = body.story_id ? String(body.story_id) : null;
  if (storyId && !uuidRe.test(storyId)) storyId = null;

  const sectionId = body.section_id ? String(body.section_id).slice(0, 40) : null;

  const row = {
    story_id:   storyId,
    section_id: sectionId,
    event_type: eventType,
  };

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/story_events`, {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(row),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(502).json({ error: 'Insert failed', detail: txt.slice(0, 200) });
    }
    return res.status(204).end();

  } catch (err) {
    return res.status(500).json({ error: 'Track failed', detail: err.message });
  }
}

export const config = { maxDuration: 10 };
