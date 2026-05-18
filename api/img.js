// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Image proxy
// 
// Fetches images server-side (bypassing hotlink protection of publishers like
// Mint, NDTV, HT) and serves them to the GRIDDS app with proper caching.
//
// Usage: /api/img?url=<encoded-original-image-url>
// ═══════════════════════════════════════════════════════════════════════════
 
// Allowed hosts (security: don't let anyone proxy arbitrary URLs through us)
const ALLOWED_HOSTS = [
  'livemint.com', 'www.livemint.com', 'images.livemint.com',
  'ndtv.com', 'www.ndtv.com', 'c.ndtvimg.com', 'i.ndtvimg.com',
  'hindustantimes.com', 'www.hindustantimes.com', 'images.hindustantimes.com',
  'indianexpress.com', 'images.indianexpress.com',
  'economictimes.indiatimes.com', 'img.etimg.com',
  'business-standard.com', 'bsmedia.business-standard.com',
  'thehindu.com', 'www.thehindu.com', 'th-i.thgim.com',
  'timesofindia.indiatimes.com', 'static.toiimg.com',
  'cricbuzz.com', 'www.cricbuzz.com', 'static.cricbuzz.com',
  'espncricinfo.com', 'p.imgci.com', 'img1.hscicdn.com',
  'vogue.in', 'media.cntraveler.com', 'cntraveller.in',
  'autocarindia.com', 'www.autocarindia.com',
  'carandbike.com', 'www.carandbike.com', 'images.carandbike.com',
  'variety.com', 'pmcvariety.files.wordpress.com',
  'pinkvilla.com', 'www.pinkvilla.com', 'stat4.cdn.pinkvilla.com',
  '9to5mac.com', 'i0.wp.com', 'i1.wp.com', 'i2.wp.com', 'i3.wp.com',
  'techcrunch.com', 'tcrn.ch',
  'theverge.com', 'cdn.vox-cdn.com', 'platform.theverge.com',
  'caravanmagazine.in', 'images.caravanmagazine.in',
  'scroll.in', 'media.scroll.in',
  'mausam.imd.gov.in',
  'feeds.feedburner.com',
];
 
function isAllowed(hostname) {
  return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
}
 
export default async function handler(req, res) {
  const raw = req.query && req.query.url;
  if (!raw) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
 
  let target;
  try {
    target = new URL(decodeURIComponent(raw));
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }
 
  if (!['http:', 'https:'].includes(target.protocol)) {
    return res.status(400).json({ error: 'Only http/https allowed' });
  }
 
  if (!isAllowed(target.hostname)) {
    return res.status(403).json({ error: 'Host not allowed', host: target.hostname });
  }
 
  try {
    // Fetch with publisher-friendly headers (no Referer, modern browser UA)
    const upstream = await fetch(target.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
        // Some sites accept their own domain as referrer:
        'Referer': target.origin + '/',
      },
      redirect: 'follow',
    });
 
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: 'Upstream image fetch failed',
        status: upstream.status,
      });
    }
 
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return res.status(502).json({ error: 'Upstream returned non-image content', contentType });
    }
 
    const buf = Buffer.from(await upstream.arrayBuffer());
 
    // Cache hard at the CDN — images don't change
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(buf);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
}
 
export const config = {
  maxDuration: 15,
};
 
