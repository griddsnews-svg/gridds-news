// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Editor Submit API
//
// Receives URL + section from /submit form, fetches the article page,
// scrapes headline/image/text, generates AI summary, sends to Google Sheet.
//
// Password-protected via EDITOR_PASSWORD env var.
// ═══════════════════════════════════════════════════════════════════════════
 
const WEBHOOK_URL     = process.env.INBOX_WEBHOOK_URL;
const WEBHOOK_TOKEN   = process.env.INBOX_TOKEN;
const OPENAI_KEY      = process.env.OPENAI_API_KEY;
const EDITOR_PASSWORD = process.env.EDITOR_PASSWORD;
 
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
 
function extractArticleText(html) {
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
  return (desc + ' ' + body).slice(0, 4000);
}
 
function detectSource(html, articleUrl) {
  const name = extractMetaContent(html, ['og:site_name', 'application-name']);
  if (name) return name;
  try {
    const host = new URL(articleUrl).hostname.replace(/^www\./, '');
    const parts = host.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch (e) { return 'Unknown'; }
}
 
// ─── FETCH WITH PROXY FALLBACK ────────────────────────────────────────────
// Tries direct fetch first. If blocked (403/401/429 or network error),
// retries via allorigins.win which proxies through their server.
 
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
  // allorigins returns { contents: "<html>..." }
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (GRIDDS.NEWS Editor)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
  const data = await res.json();
  if (!data.contents) throw new Error('Proxy returned empty content');
  return data.contents;
}
 
async function fetchArticlePage(url) {
  // 1. Try direct
  try {
    const html = await fetchDirect(url);
    console.log(`Direct fetch OK: ${url}`);
    return html;
  } catch (directErr) {
    console.warn(`Direct fetch failed (${directErr.message}), trying proxy: ${url}`);
  }
 
  // 2. Fallback to proxy
  try {
    const html = await fetchViaProxy(url);
    console.log(`Proxy fetch OK: ${url}`);
    return html;
  } catch (proxyErr) {
    throw new Error(`Both direct and proxy fetch failed. Proxy error: ${proxyErr.message}`);
  }
}
 
// ─── OPENAI SUMMARY ───────────────────────────────────────────────────────
 
async function summariseWithOpenAI(headline, articleText) {
  if (!OPENAI_KEY) return null;
  const userPrompt = `Headline: ${headline}\n\nArticle excerpt: ${articleText.slice(0, 3000)}\n\nWrite a tight, factual summary in 60-90 words in the style of Inshorts. No opinion, no hype, no clickbait. Plain prose, no bullet points. Do not repeat the headline verbatim. Just the summary, nothing else.`;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an editor writing crisp, factual 60-90 word news summaries in the style of Inshorts. Indian English. No opinion, no hype, no padding.' },
          { role: 'user',   content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(20000),
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Editor-Password');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST only' });
 
  // ─── Auth ───────────────────────────────────────────────────────────
  const providedPwd = req.headers['x-editor-password'] || (req.body && req.body.password) || '';
  if (!EDITOR_PASSWORD) return res.status(500).json({ error: 'EDITOR_PASSWORD env var not set' });
  if (providedPwd !== EDITOR_PASSWORD) {
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
    return res.status(401).json({ error: 'Unauthorized' });
  }
 
  // ─── Input ──────────────────────────────────────────────────────────
  const body    = req.body || {};
  const url     = (body.url     || '').trim();
  const section = (body.section || '').trim();
  const action  = (body.action  || 'preview').trim();
 
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Invalid URL' });
  if (!section) return res.status(400).json({ error: 'Section required' });
 
  // ─── Fetch + scrape ─────────────────────────────────────────────────
  let html;
  try {
    html = await fetchArticlePage(url);
  } catch (err) {
    return res.status(502).json({ error: 'Could not fetch article', detail: err.message });
  }
 
  const headline = extractHeadline(html);
  const image    = extractImage(html, url);
  const text     = extractArticleText(html);
  const source   = detectSource(html, url);
 
  if (!headline) return res.status(422).json({ error: 'Could not extract headline from page' });
 
  // ─── Summarise ──────────────────────────────────────────────────────
  let summary = await summariseWithOpenAI(headline, text);
  if (!summary) {
    const words = text.split(/\s+/).slice(0, 80);
    summary = words.join(' ') + (words.length === 80 ? '…' : '');
  }
 
  // ─── Preview ────────────────────────────────────────────────────────
  if (action === 'preview') {
    return res.status(200).json({ ok: true, headline, summary, source, image, url, section });
  }
 
  // ─── Publish ────────────────────────────────────────────────────────
  if (action === 'publish') {
    const finalHeadline = (body.editedHeadline || headline).trim();
    const finalSummary  = (body.editedSummary  || summary).trim();
    const finalImage    = (body.editedImage    || image).trim();
 
    try {
      const webhookRes = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
  token:  WEBHOOK_TOKEN,
  source: 'SUBMIT',
  stories: [{
    headline:  finalHeadline,
    summary:   finalSummary,
    source:    source,
    section:   section,
    url:       url,
    image:     finalImage,
    published: new Date().toISOString(),
  }],
}),
        redirect: 'follow',
      });
      const data = await webhookRes.text();
      let parsed;
      try { parsed = JSON.parse(data); } catch (e) { parsed = { raw: data.slice(0, 300) }; }
      return res.status(200).json({ ok: true, webhook: parsed });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to send to sheet', detail: err.message });
    }
  }
 
  return res.status(400).json({ error: 'Unknown action' });
}
 
export const config = { maxDuration: 60 };
 
