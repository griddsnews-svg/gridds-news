// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Reader API   /api/reader?url=<article url>
// Fetches an article server-side and extracts a clean, readable version using
// Mozilla Readability, then sanitises the HTML. Powers the in-app "Reader" view.
// (The browser can't fetch cross-origin article HTML itself, hence this proxy.)
//
// Cached hard at the edge — extracted articles rarely change.
// ═══════════════════════════════════════════════════════════════════════════
 
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
 
// Block obviously-internal targets (basic SSRF guard). NOTE: this checks the
// literal host only; a domain that *resolves* to a private IP, or a redirect to
// one, is not caught — harden with DNS resolution + pinned-IP fetch if needed.
function isBlockedHost(host) {
  host = (host || '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;          // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;                         // multicast / reserved
  }
  return false;
}
 
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
 
  const raw = req.query.url;
  if (!raw) return res.status(400).json({ ok: false, error: 'Missing url' });
 
  let target;
  try { target = new URL(raw); } catch (e) { return res.status(400).json({ ok: false, error: 'Invalid url' }); }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return res.status(400).json({ ok: false, error: 'Unsupported scheme' });
  }
  if (isBlockedHost(target.hostname)) {
    return res.status(403).json({ ok: false, error: 'Blocked host' });
  }
 
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const resp = await fetch(target.href, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GRIDDSReader/1.0; +https://gridds.news)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);
 
    if (!resp.ok) return res.status(502).json({ ok: false, error: 'Upstream ' + resp.status });
    const ctype = resp.headers.get('content-type') || '';
    if (!ctype.includes('html')) return res.status(415).json({ ok: false, error: 'Not an HTML page' });
 
    // Re-check the final URL host after redirects.
    let finalUrl = resp.url || target.href;
    try { if (isBlockedHost(new URL(finalUrl).hostname)) return res.status(403).json({ ok: false, error: 'Blocked host' }); } catch (e) {}
 
    let html = await resp.text();
    if (html.length > 3000000) html = html.slice(0, 3000000);
 
    const dom = new JSDOM(html, { url: finalUrl });
    const doc = dom.window.document;
 
    // Pull metadata BEFORE Readability mutates the document.
    const metaContent = (sel) => { const el = doc.querySelector(sel); return el ? (el.getAttribute('content') || '') : ''; };
    let image = metaContent('meta[property="og:image"]') || metaContent('meta[name="twitter:image"]') || metaContent('meta[name="twitter:image:src"]');
    let siteName = metaContent('meta[property="og:site_name"]');
    if (image) { try { image = new URL(image, finalUrl).href; } catch (e) { image = ''; } }
 
    const article = new Readability(doc).parse();
    if (!article || !article.content) {
      return res.status(422).json({ ok: false, error: 'Could not extract article' });
    }
 
    const DOMPurify = createDOMPurify(dom.window);
    const clean = DOMPurify.sanitize(article.content, {
      FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'textarea', 'button', 'svg', 'video', 'audio', 'source', 'noscript', 'link', 'meta'],
      FORBID_ATTR: ['style', 'srcset', 'onerror', 'onload', 'onclick'],
    });
 
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      ok: true,
      title:    article.title || doc.title || '',
      byline:   article.byline || '',
      siteName: article.siteName || siteName || '',
      excerpt:  article.excerpt || '',
      length:   article.length || 0,
      image,
      content:  clean,
      url:      finalUrl,
    });
 
  } catch (err) {
    clearTimeout(timer);
    const msg = err && err.name === 'AbortError' ? 'Timed out' : (err && err.message) || 'Reader failed';
    return res.status(500).json({ ok: false, error: msg });
  }
}
 
export const config = { maxDuration: 15 };
 
