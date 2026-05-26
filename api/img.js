// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Image Proxy  /api/img?url=<encoded-image-url>
//
// v2: Handles firewall-blocked domains (HT, TOI, NDTV etc) by redirecting
// to a Unsplash fallback image keyed to the section name passed as ?section=
// ═══════════════════════════════════════════════════════════════════════════

const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
const MAX_BYTES     = 4 * 1024 * 1024;
const CACHE_SECONDS = 60 * 60 * 6;

// ── Domains known to block all external proxies at firewall level ──────────
// When these are detected we skip straight to fallback rather than wasting
// a timeout waiting for a 403.
const FIREWALL_BLOCKED = [
  'hindustantimes.com',
  'htmedia.in',
  'timesofindia.com',
  'toi.in',
  'indiatimes.com',
  'ndtv.com',
  'ndtvimg.com',
  'indiatoday.in',
  'aajtak.in',
  'livehindustan.com',
  'jagran.com',
  'bhaskar.com',
  'amarujala.com',
  'abplive.com',
  'abplivemedia.com',
  'zeenews.india.com',
  'zeemedia.in',
  'news18.com',
  'cnbctv18.com',
];

// ── Section → Unsplash fallback image (tall, editorial, no faces) ─────────
// These are stable Unsplash source URLs that always return an image.
const SECTION_FALLBACKS = {
  'wellness':      'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80',
  'tech':          'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
  'thisandthat':   'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80',
  'entertainment': 'https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=800&q=80',
  'headlines':     'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80',
  'finance':       'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
  'politics':      'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80',
  'ipl':           'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
  'citynews':      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
  'worldnews':     'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
  'opinions':      'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80',
  'longreads':     'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&q=80',
  'lifestyle':     'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=800&q=80',
  'griddloves':    'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=800&q=80',
  'default':       'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80',
};

function isFirewallBlocked(hostname) {
  return FIREWALL_BLOCKED.some(d =>
    hostname === d || hostname.endsWith('.' + d)
  );
}

function getFallbackUrl(section) {
  if (!section) return SECTION_FALLBACKS.default;
  const key = section.toLowerCase().replace(/[^a-z]/g, '');
  return SECTION_FALLBACKS[key] || SECTION_FALLBACKS.default;
}

async function fetchImage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':          'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Referer':         new URL(url).origin + '/',
      'sec-fetch-dest':  'image',
      'sec-fetch-mode':  'no-cors',
      'sec-fetch-site':  'cross-site',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
  });
  return res;
}

export default async function handler(req, res) {
  const { url, section } = req.query;

  if (!url) return res.status(400).json({ error: 'Missing url param' });

  let parsed;
  try {
    parsed = new URL(decodeURIComponent(url));
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Protocol not allowed' });
  }

  if (BLOCKED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
    return res.status(403).json({ error: 'Blocked host' });
  }

  // ── If domain is firewall-blocked, redirect straight to fallback ─────────
  if (isFirewallBlocked(parsed.hostname)) {
    const fallback = getFallbackUrl(section);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`);
    return res.redirect(302, fallback);
  }

  // ── Try fetching the image ───────────────────────────────────────────────
  let upstream;
  try {
    upstream = await fetchImage(parsed.toString());
  } catch (err) {
    // Timeout or network error — redirect to fallback
    const fallback = getFallbackUrl(section);
    res.setHeader('Cache-Control', `public, max-age=300`);
    return res.redirect(302, fallback);
  }

  // ── Non-200 or not an image — redirect to fallback ───────────────────────
  if (!upstream.ok) {
    const fallback = getFallbackUrl(section);
    res.setHeader('Cache-Control', `public, max-age=300`);
    return res.redirect(302, fallback);
  }

  const contentType = upstream.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    const fallback = getFallbackUrl(section);
    res.setHeader('Cache-Control', `public, max-age=300`);
    return res.redirect(302, fallback);
  }

  // ── Size guard ───────────────────────────────────────────────────────────
  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    const fallback = getFallbackUrl(section);
    return res.redirect(302, fallback);
  }

  // ── Success — stream image back with long cache ──────────────────────────
  res.setHeader('Content-Type',  contentType);
  res.setHeader('Cache-Control', `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Length', buf.byteLength);
  res.status(200).send(Buffer.from(buf));
}

export const config = { maxDuration: 15 };
