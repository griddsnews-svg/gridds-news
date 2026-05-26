// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Image Proxy  /api/img?url=<encoded-image-url>
//
// v3: Firewall-blocked domains (HT, TOI etc) return 204 No Content so the
// app shows its own placeholder rather than a repeated stock fallback image.
// ═══════════════════════════════════════════════════════════════════════════

const BLOCKED_HOSTS   = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
const MAX_BYTES       = 4 * 1024 * 1024;
const CACHE_SECONDS   = 60 * 60 * 6;

// Domains that block all external server IPs at firewall level.
// Returning 204 immediately avoids a wasted timeout + stops broken-image icon.
const FIREWALL_BLOCKED = [
  'hindustantimes.com', 'htmedia.in',
  'timesofindia.com',   'toi.in',       'indiatimes.com',
  'ndtv.com',           'ndtvimg.com',
  'indiatoday.in',      'aajtak.in',
  'livehindustan.com',  'jagran.com',
  'bhaskar.com',        'amarujala.com',
  'abplive.com',        'abplivemedia.com',
  'zeenews.india.com',  'zeemedia.in',
  'news18.com',         'cnbctv18.com',
];

function isFirewallBlocked(hostname) {
  return FIREWALL_BLOCKED.some(d => hostname === d || hostname.endsWith('.' + d));
}

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: 'Missing url param' });

  let parsed;
  try { parsed = new URL(decodeURIComponent(url)); }
  catch (e) { return res.status(400).json({ error: 'Invalid URL' }); }

  if (!['http:', 'https:'].includes(parsed.protocol))
    return res.status(400).json({ error: 'Protocol not allowed' });

  if (BLOCKED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h)))
    return res.status(403).json({ error: 'Blocked host' });

  // ── Known firewall-blocked domain — return 204 immediately ───────────────
  // The app treats a non-image response as "no image" and shows its own
  // section-colour placeholder. Far better than a repeated stock photo.
  if (isFirewallBlocked(parsed.hostname)) {
    res.setHeader('Cache-Control', `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`);
    return res.status(204).end();
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────
  let upstream;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':         'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language':'en-IN,en;q=0.9',
        'Referer':        parsed.origin + '/',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    return res.status(204).end();   // timeout/network — silent no-image
  }

  if (!upstream.ok) return res.status(204).end();

  const contentType = upstream.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) return res.status(204).end();

  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return res.status(204).end();

  // ── Success ───────────────────────────────────────────────────────────────
  res.setHeader('Content-Type',  contentType);
  res.setHeader('Cache-Control', `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Length', buf.byteLength);
  res.status(200).send(Buffer.from(buf));
}

export const config = { maxDuration: 15 };
