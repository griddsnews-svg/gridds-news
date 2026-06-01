// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Push sender   /api/notify   (issue #8)
//
//   POST { title, body, url? }  (Authorization: Bearer <editor Supabase JWT>)
//   → sends a push to every active token in `push_tokens` via FCM HTTP v1.
//
// Only a logged-in editor can call this (same JWT check as the console). The
// app itself (web) cannot, because it never holds an editor session.
//
// ENV required:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY
//   FCM_PROJECT_ID            — your Firebase project id
//   FCM_CLIENT_EMAIL          — service-account client_email
//   FCM_PRIVATE_KEY           — service-account private_key (with \n escaped)
//
// NOTE: sends token-by-token. Fine for launch volumes; move to topic-based
// fan-out (subscribe devices to an "all" topic) once the audience is large.
// ═══════════════════════════════════════════════════════════════════════════

import { createSign } from 'node:crypto';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;

const FCM_PROJECT_ID   = process.env.FCM_PROJECT_ID;
const FCM_CLIENT_EMAIL = process.env.FCM_CLIENT_EMAIL;
const FCM_PRIVATE_KEY  = (process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Mint a short-lived Google OAuth access token for the FCM scope.
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim   = b64url(JSON.stringify({
    iss:   FCM_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = signer.sign(FCM_PRIVATE_KEY, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const assertion = `${header}.${claim}.${sig}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  });
  if (!resp.ok) throw new Error('OAuth token failed: ' + (await resp.text()).slice(0, 200));
  return (await resp.json()).access_token;
}

async function verifyEditor(token) {
  if (!token || !SUPABASE_URL) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON || SUPABASE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  const editor = await verifyEditor((req.headers['authorization'] || '').replace('Bearer ', '').trim());
  if (!editor) return res.status(401).json({ error: 'Editor session required' });

  if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
    return res.status(500).json({ error: 'FCM env not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const title = String(body.title || '').slice(0, 120).trim();
  const text  = String(body.body  || '').slice(0, 240).trim();
  const url   = String(body.url   || '').slice(0, 400).trim();
  if (!title) return res.status(400).json({ error: 'Missing title' });

  try {
    // 1. Active tokens
    const tResp = await fetch(
      `${SUPABASE_URL}/rest/v1/push_tokens?active=eq.true&select=token`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    const tokens = tResp.ok ? (await tResp.json()).map(r => r.token).filter(Boolean) : [];
    if (!tokens.length) return res.status(200).json({ ok: true, sent: 0, note: 'No registered devices' });

    // 2. OAuth + send
    const accessToken = await getAccessToken();
    const endpoint = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
    let sent = 0, failed = 0;
    const dead = [];

    await Promise.all(tokens.map(async (tok) => {
      const msg = {
        message: {
          token: tok,
          notification: { title, body: text },
          data: url ? { url } : {},
        },
      };
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
        });
        if (r.ok) sent++;
        else { failed++; if (r.status === 404 || r.status === 400) dead.push(tok); }
      } catch { failed++; }
    }));

    // 3. Deactivate dead tokens (best-effort)
    if (dead.length) {
      const inList = dead.map(encodeURIComponent).join(',');
      fetch(`${SUPABASE_URL}/rest/v1/push_tokens?token=in.(${inList})`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ active: false }),
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true, sent, failed });
  } catch (err) {
    return res.status(500).json({ error: 'Send failed', detail: err.message });
  }
}

export const config = { maxDuration: 30 };
