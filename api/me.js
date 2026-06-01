// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Reader endpoint   /api/me   (issues #4 + #8)
//
//   POST { action:'profile', device_id, name, dob, sex, location, contact }
//        → upserts the reader's profile into `app_users` (keyed by device_id).
//   POST { action:'token', device_id, token, platform }
//        → upserts the device's push token into `push_tokens`.
//
// Writes happen here on the SERVER with the service key, so the public anon key
// shipped in the app never needs write access to reader PII. Age is intentionally
// NOT stored — it's derived from dob at read time so it can't go stale.
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function upsert(table, row, onConflict) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(8000),
    }
  );
  return resp;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase env not set' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const deviceId = String(body.device_id || '').slice(0, 100).trim();
  if (!deviceId) return res.status(400).json({ error: 'Missing device_id' });

  try {
    if (body.action === 'profile') {
      const row = {
        device_id: deviceId,
        name:      String(body.name || '').slice(0, 120),
        dob:       body.dob || null,
        sex:       String(body.sex || '').slice(0, 30),
        location:  String(body.location || '').slice(0, 120),
        contact:   String(body.contact || '').slice(0, 200),
        updated_at: new Date().toISOString(),
      };
      const resp = await upsert('app_users', row, 'device_id');
      if (!resp.ok) return res.status(502).json({ error: 'profile save failed', detail: (await resp.text()).slice(0, 200) });
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'token') {
      const token = String(body.token || '').trim();
      if (!token) return res.status(400).json({ error: 'Missing token' });
      const row = {
        token:     token,
        device_id: deviceId,
        platform:  String(body.platform || 'unknown').slice(0, 20),
        active:    true,
        updated_at: new Date().toISOString(),
      };
      const resp = await upsert('push_tokens', row, 'token');
      if (!resp.ok) return res.status(502).json({ error: 'token save failed', detail: (await resp.text()).slice(0, 200) });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: 'Save failed', detail: err.message });
  }
}

export const config = { maxDuration: 10 };
