// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Editor Submit API v2.0
//
// Receives URL + section from /submit form, fetches the article page,
// scrapes headline/image/text, generates AI summary, saves to Supabase.
//
// Auth: Supabase JWT token (from editor Google sign-in session)
//
// v2.0 changes:
// - Supabase token auth (replaces password auth)
// - Multi-proxy fallback for sites like NDTV that block direct fetches
// - URL slug fallback when all fetch methods fail
// ═══════════════════════════════════════════════════════════════════════════
 
const OPENAI_KEY      = process.env.OPENAI_API_KEY;
const SUPABASE_URL    = process.env.SUPABASE_URL;
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY;   // service_role

// Teaser model is configurable (defaults to gpt-4o for quality). Same env var
// name as rss-fetch.js so both pipelines write in a consistent voice.
const SUMMARY_MODEL   = process.env.OPENAI_SUMMARY_MODEL || 'gpt-4o';
 
// Section display-name → database section id
const SECTION_ID = {
  'Headlines':     'headlines',
  'Finance':       'finance',
  'Wellness':      'wellness',
  'Politics':      'politics',
  'IPL':           'ipl',
  'GRIDD Loves':   'griddloves',
  'City News':     'citynews',
  'World News':    'worldnews',
  'Entertainment': 'entertainment',
  'Tech':          'tech',
  'Opinions':      'opinions',
  'Long Reads':    'longreads',
  'This & That':   'thisandthat',
  'Lifestyle':     'lifestyle',
};
 
// ─── HELPERS ──────────────────────────────────────────────────────────────
 
function stripTags(s) {
  return s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ').trim();
}
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—');
}
 
function extractMetaContent(html, names) {
  for (const name of names) {
    let m = html.match(new RegExp(`<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'));
    if (m) return decodeEntities(m[1]);
    m = html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${name}["']`, 'i'));
    if (m) return decodeEntities(m[1]);
    m = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'));
    if (m) return decodeEntities(m[1]);
    m = html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'));
    if (m) return decodeEntities(m[1]);
  }
  return '';
}
 
function extractHeadline(html) {
  let h = extractMetaContent(html, ['og:title', 'twitter:title', 'title']);
  if (h) return h;
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return decodeEntities(stripTags(m[1]));
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return decodeEntities(stripTags(h1[1]));
  return '';
}
 
function extractImage(html, articleUrl) {
  const img = extractMetaContent(html, ['og:image', 'twitter:image', 'twitter:image:src']);
  if (img) {
    try { return new URL(img, articleUrl).toString(); } catch (e) { return img; }
  }
  return '';
}
 
// JSON-LD article body — cleanest source of real text on most Indian publishers
// (TOI/HT/IE/Hindu/Mint/NDTV embed a NewsArticle block). Tried first so the
// summariser gets actual facts, not nav/caption noise from the <article> regex.
function extractJsonLdBody(html) {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const inner = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    let json;
    try { json = JSON.parse(inner); }
    catch (e) { continue; }
    const items = Array.isArray(json) ? json : (json['@graph'] || [json]);
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const type = Array.isArray(item['@type']) ? item['@type'].join(' ') : (item['@type'] || '');
      if (/Article/i.test(type) && (item.articleBody || item.description)) {
        const txt = ((item.articleBody || '') + ' ' + (item.description || '')).trim();
        if (txt.length > 80) return decodeEntities(stripTags(txt));
      }
    }
  }
  return '';
}

function extractArticleText(html) {
  // 1. Best source: JSON-LD articleBody.
  const ld = extractJsonLdBody(html);
  if (ld.length > 200) return ld.slice(0, 4000);

  // 2. Fallback: og:description + <article>/<main>/<p>.
  const desc = extractMetaContent(html, ['og:description', 'twitter:description', 'description']);
  let body = '';
  const articleMatch = html.match(/<article[^>]*>([\s\S]{200,8000}?)<\/article>/i);
  if (articleMatch) body = stripTags(articleMatch[1]);
  if (!body) {
    const mainMatch = html.match(/<main[^>]*>([\s\S]{200,8000}?)<\/main>/i);
    if (mainMatch) body = stripTags(mainMatch[1]);
  }
  if (!body) {
    const ps = html.match(/<p[^>]*>[\s\S]{50,1000}?<\/p>/gi) || [];
    body = ps.slice(0, 8).map(p => stripTags(p)).join(' ');
  }
  return ((ld || desc) + ' ' + body).slice(0, 4000);
}
 
function detectSource(html, articleUrl) {
  if (html) {
    const name = extractMetaContent(html, ['og:site_name', 'application-name']);
    if (name) return name;
  }
  try {
    const host = new URL(articleUrl).hostname.replace(/^www\./, '');
    // Known source map for fallback detection
    const map = {
      'sports.ndtv.com': 'NDTV Sports', 'ndtv.com': 'NDTV',
      'feeds.feedburner.com': 'NDTV', 'gadgets.ndtv.com': 'NDTV Gadgets',
      'food.ndtv.com': 'NDTV Food',
      'thehindu.com': 'The Hindu', 'indianexpress.com': 'Indian Express',
      'hindustantimes.com': 'Hindustan Times', 'livemint.com': 'Mint',
      'economictimes.indiatimes.com': 'Economic Times',
      'timesofindia.indiatimes.com': 'Times of India',
      'business-standard.com': 'Business Standard',
      'thehindubusinessline.com': 'Business Line',
      'moneycontrol.com': 'Moneycontrol', 'financialexpress.com': 'Financial Express',
      'firstpost.com': 'Firstpost', 'thequint.com': 'The Quint',
      'scroll.in': 'Scroll', 'thewire.in': 'The Wire',
      'theprint.in': 'The Print', 'newslaundry.com': 'Newslaundry',
      'caravanmagazine.in': 'The Caravan', 'the-ken.com': 'The Ken',
      'inc42.com': 'Inc42', 'techcrunch.com': 'TechCrunch',
      'theverge.com': 'The Verge', 'wired.com': 'Wired',
      'feeds.bbci.co.uk': 'BBC', 'bbc.com': 'BBC', 'bbc.co.uk': 'BBC',
      'aljazeera.com': 'Al Jazeera', 'foreignpolicy.com': 'Foreign Policy',
      'espncricinfo.com': 'ESPN Cricinfo', 'sportskeeda.com': 'Sportskeeda',
      'crictracker.com': 'CricTracker', 'pinkvilla.com': 'Pinkvilla',
      'variety.com': 'Variety', 'vogue.in': 'Vogue India',
      'gqindia.com': 'GQ India', 'cntraveller.in': 'CN Traveller India',
      'homegrown.co.in': 'Homegrown', 'filmcompanion.in': 'Film Companion',
    };
    if (map[host]) return map[host];
    // Check partial matches (subdomains)
    for (const [key, val] of Object.entries(map)) {
      if (host.endsWith(key)) return val;
    }
    const parts = host.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch (e) { return 'Unknown'; }
}
 
// ─── AUTH: VERIFY SUPABASE JWT ────────────────────────────────────────────
 
async function verifySupabaseToken(token) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_KEY,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user || !user.id) return null;
 
    // Check profile role — only admin and editor allowed
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!profileRes.ok) return null;
    const profiles = await profileRes.json();
    const role = profiles?.[0]?.role;
    if (role !== 'admin' && role !== 'editor') return null;
 
    return { id: user.id, email: user.email, role };
  } catch (e) {
    console.error('Token verification failed:', e.message);
    return null;
  }
}
 
// ─── FETCH WITH MULTI-PROXY FALLBACK ──────────────────────────────────────
 
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
};
 
async function fetchDirect(url) {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}
 
async function fetchViaProxy(url) {
  const proxies = [
    {
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      type: 'json',
      field: 'contents',
    },
    {
      url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      type: 'text',
    },
    {
      url: `https://corsproxy.io/?${encodeURIComponent(url)}`,
      type: 'text',
    },
  ];
 
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (GRIDDS.NEWS Editor)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
 
      if (proxy.type === 'json') {
        const data = await res.json();
        const html = data[proxy.field];
        if (html && html.length > 500) return html;
      } else {
        const html = await res.text();
        if (html && html.length > 500) return html;
      }
    } catch (e) {
      console.warn(`Proxy ${proxy.url.split('?')[0]} failed:`, e.message);
      continue;
    }
  }
  throw new Error('All proxies failed');
}
 
async function fetchArticlePage(url) {
  // Try direct fetch first
  try {
    const html = await fetchDirect(url);
    console.log(`Direct fetch OK: ${url}`);
    return html;
  } catch (directErr) {
    console.warn(`Direct fetch failed (${directErr.message}), trying proxies: ${url}`);
  }
  // Try proxy cascade
  try {
    const html = await fetchViaProxy(url);
    console.log(`Proxy fetch OK: ${url}`);
    return html;
  } catch (proxyErr) {
    throw new Error(`All fetch methods failed for this site. ${proxyErr.message}`);
  }
}
 
// ─── URL SLUG FALLBACK ────────────────────────────────────────────────────
// When a site (like NDTV) blocks all automated fetches, extract a usable
// headline from the URL slug as a last resort.
 
function headlineFromSlug(url) {
  try {
    const pathname = new URL(url).pathname;
    // Get the last meaningful segment
    const segments = pathname.split('/').filter(Boolean);
    let slug = segments[segments.length - 1] || '';
    // Remove trailing article IDs (e.g. -11559398, -7654321)
    slug = slug.replace(/-\d{5,}$/, '');
    // Remove file extensions
    slug = slug.replace(/\.\w+$/, '');
    // Convert dashes to spaces, title-case
    const words = slug.replace(/-/g, ' ').replace(/_/g, ' ').trim();
    if (words.length < 10) return null;
    // Title case: capitalize first letter of each word, but keep short words lowercase
    const lowerWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'by', 'is', 'it', 'vs']);
    const titled = words.split(' ').map((w, i) => {
      if (i === 0 || !lowerWords.has(w.toLowerCase())) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
      return w.toLowerCase();
    }).join(' ');
    return titled;
  } catch (e) {
    return null;
  }
}
 
// ─── OPENAI SUMMARY ───────────────────────────────────────────────────────
 
async function summariseWithOpenAI(headline, articleText) {
  if (!OPENAI_KEY) return null;
  const hasContent = articleText && articleText.length > 100;

  const examples = `EXAMPLES of the bar:
GOOD: "Sebi's new F&O rules cut retail derivatives volumes nearly 30% in week one; Zerodha and Groww expect a direct revenue hit."
GOOD: "The Supreme Court gave the Centre four weeks to explain why electoral-bond donor data stays sealed, setting up a pre-poll showdown."
BAD (vague): "The regulator has introduced new rules that could have significant implications for the market."
BAD (restates headline): "Sebi announces new rules for F&O trading in India."`;

  const userPrompt = hasContent
    ? `Headline: ${headline}

Article text: ${articleText.slice(0, 3500)}

Write a teaser of AT MOST 25 words (aim 15-22) whose only job is to make a reader tap the story. Lead with the single most surprising or consequential fact — names, numbers, outcomes. Indian English, plain prose, one or two short sentences. No hype words, no opinion, no questions, no clickbait, no bullets. Do NOT repeat the headline verbatim — add something it doesn't already say. NEVER exceed 25 words. Output ONLY the teaser.

${examples}`
    : `Headline: ${headline}

Write a teaser of AT MOST 20 words based on this headline alone. Add something the headline doesn't already say. Indian English, factual, no hype, no questions. NEVER exceed 20 words. Output ONLY the teaser.

${examples}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        messages: [
          { role: 'system', content: 'You write tight, factual news teasers (max 25 words) that make readers want to tap the story. Indian English. No opinion, no hype, no padding. You never just restate the headline.' },
          { role: 'user',   content: userPrompt },
        ],
        max_tokens: 80,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  } catch (err) {
    console.error('OpenAI failed:', err.message);
    return null;
  }
}
 
// ─── MAIN HANDLER ─────────────────────────────────────────────────────────
 
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST only' });
 
  // ─── Auth: verify Supabase session token ────────────────────────────
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ error: 'No auth token provided' });
  }
 
  const user = await verifySupabaseToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
 
  // ─── Input ──────────────────────────────────────────────────────────
  const body    = req.body || {};
  const url     = (body.url     || '').trim();
  const section = (body.section || '').trim();
  const action  = (body.action  || 'preview').trim();
 
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Invalid URL' });
  if (!section) return res.status(400).json({ error: 'Section required' });
 
  // ─── Fetch + scrape (with fallback) ─────────────────────────────────
  let html = null;
  let fetchFailed = false;
 
  try {
    html = await fetchArticlePage(url);
  } catch (err) {
    console.warn(`All fetch methods failed for ${url}: ${err.message}`);
    fetchFailed = true;
  }
 
  let headline = '';
  let image    = '';
  let text     = '';
  let source   = '';
  let note     = '';
 
  if (!fetchFailed && html) {
    // Normal path: extract from HTML
    headline = extractHeadline(html);
    image    = extractImage(html, url);
    text     = extractArticleText(html);
    source   = detectSource(html, url);
  }
 
  if (!headline) {
    // Fallback: extract headline from URL slug
    const slugHeadline = headlineFromSlug(url);
    if (!slugHeadline) {
      return res.status(502).json({
        error: 'Could not fetch article or extract headline',
        detail: 'This site blocks automated access and the URL doesn\'t contain a readable headline.',
      });
    }
    headline = slugHeadline;
    source   = detectSource('', url);
    note     = 'This site blocked automated access. Headline was extracted from the URL — please review and edit. Add an image manually.';
    console.log(`URL slug fallback used for ${url}: "${headline}"`);
  }
 
  // ─── Summarise ──────────────────────────────────────────────────────
  let summary = await summariseWithOpenAI(headline, text || headline);
  if (!summary) {
    if (text) {
      const words = text.split(/\s+/).slice(0, 80);
      summary = words.join(' ') + (words.length === 80 ? '…' : '');
    } else {
      summary = '';
    }
  }
 
  // ─── Preview ────────────────────────────────────────────────────────
  if (action === 'preview') {
    return res.status(200).json({ ok: true, headline, summary, source, image, url, section, note });
  }
 
  // ─── Publish — writes directly to Supabase as LIVE ──────────────────
  if (action === 'publish') {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Supabase env vars not set' });
    }
 
    const finalHeadline = (body.editedHeadline || headline).trim();
    const finalSummary  = (body.editedSummary  || summary).trim();
    const finalImage    = (body.editedImage    || image).trim();
    const sectionId     = SECTION_ID[section] || 'headlines';
 
    const row = {
      section_id:   sectionId,
      headline:     finalHeadline,
      summary:      finalSummary,
      source:       source,
      url:          url,
      image:        finalImage,
      status:       'LIVE',
      source_type:  'SUBMIT',
      sort_order:   0,
      published_at: new Date().toISOString(),
      submitted_by: user.id,            // issue #7 — who submitted this story
    };
 
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/stories?on_conflict=section_id,url`,
        {
          method: 'POST',
          headers: {
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type':  'application/json',
            'Prefer':        'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(row),
          signal: AbortSignal.timeout(10000),
        }
      );
 
      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(500).json({ error: 'Supabase insert failed', detail: txt.slice(0, 300) });
      }
 
      const inserted = await resp.json();
      return res.status(200).json({ ok: true, story: inserted[0] || row });
 
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save story', detail: err.message });
    }
  }
 
  return res.status(400).json({ error: 'Unknown action' });
}
 
export const config = { maxDuration: 60 };
