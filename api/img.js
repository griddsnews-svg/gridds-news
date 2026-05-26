// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Image Proxy  /api/img?url=<encoded-image-url>
//
// Fetches images server-side (bypassing iOS Safari hotlink blocks & CORS)
// and streams them back with correct headers.
//
// Add this file at:  pages/api/img.js  (or  app/api/img/route.js  for App Router)
// ═══════════════════════════════════════════════════════════════════════════

// Domains we refuse to proxy (security: block SSRF to internal/private IPs)
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];

// Max image size we'll proxy — 4 MB
const MAX_BYTES = 4 * 1024 * 1024;

// Cache for 6 hours on Vercel CDN edge
const CACHE_SECONDS = 60 * 60 * 6;

export default async function handler(req, res) {
  const { url } = req.query;

  // ── Validate ────────────────────────────────────────────────────────────
  if (!url) {
    return res.status(400).json({ error: 'Missing url param' });
  }

  let parsed;
  try {
    parsed = new URL(decodeURIComponent(url));
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Protocol not allowed' });
  }

  // Block internal hosts
  if (BLOCKED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
    return res.status(403).json({ error: 'Blocked host' });
  }

  // ── Fetch ───────────────────────────────────────────────────────────────
  let upstream;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        // Appear as a regular browser to avoid hotlink blocks
        'User-Agent':      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept':          'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Referer':         parsed.origin + '/',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }

  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
  }

  // ── Content-type check ──────────────────────────────────────────────────
  const contentType = upstream.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    return res.status(415).json({ error: 'Not an image' });
  }

  // ── Size guard ──────────────────────────────────────────────────────────
  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return res.status(413).json({ error: 'Image too large' });
  }

  // ── Stream back with caching headers ────────────────────────────────────
  res.setHeader('Content-Type',  contentType);
  res.setHeader('Cache-Control', `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Length', buf.byteLength);
  res.status(200).send(Buffer.from(buf));
}

export const config = { maxDuration: 15 };
