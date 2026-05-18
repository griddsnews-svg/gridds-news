// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — RSS Fetcher
// Runs every 30 minutes via Vercel Cron.
// Fetches RSS feeds, extracts stories, sends to Google Sheet Inbox.
// ═══════════════════════════════════════════════════════════════════════════
 
// Set these as Environment Variables on Vercel:
//   INBOX_WEBHOOK_URL — the Apps Script /exec URL (from Deploy → Manage)
//   INBOX_TOKEN       — must match SECRET in Apps Script
 
const WEBHOOK_URL = process.env.INBOX_WEBHOOK_URL;
const TOKEN       = process.env.INBOX_TOKEN;
 
// ─── FEED LIST: section → array of RSS URLs ──────────────────────────────
const FEEDS = {
  Headlines: [
    'https://feeds.feedburner.com/ndtvnews-top-stories',
    'https://www.hindustantimes.com/feeds/rss/india-news/index.xml',
    'https://indianexpress.com/section/india/feed/',
  ],
  Finance: [
    'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    'https://www.livemint.com/rss/markets',
    'https://www.business-standard.com/rss/markets-106.rss',
  ],
  Health: [
    'https://www.hindustantimes.com/feeds/rss/lifestyle/rssfeed.xml',
    'https://timesofindia.indiatimes.com/rssfeeds/3908999.cms',
  ],
  Politics: [
    'https://www.hindustantimes.com/feeds/rss/india-news/index.xml',
    'https://www.thehindu.com/news/national/feeder/default.rss',
  ],
  IPL: [
    'https://www.cricbuzz.com/cbz-news.xml',
    'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
  ],
  'GRIDD Loves': [
    'https://vogue.in/feed/rss',
    'https://www.livemint.com/rss/mint-lounge',
    'https://www.cntraveller.in/feed/rss',
  ],
  'City News': [
    'https://timesofindia.indiatimes.com/rssfeeds/-2128839596.cms',  // TOI Delhi
    'https://www.hindustantimes.com/feeds/rss/cities/delhi-news/rssfeed.xml',
  ],
  Science: [
    'https://www.thehindu.com/sci-tech/science/feeder/default.rss',
    'https://indianexpress.com/section/technology/science/feed/',
  ],
  Entertainment: [
    'https://variety.com/v/film/feed/',
    'https://www.pinkvilla.com/rss.xml',
  ],
  Tech: [
    'https://9to5mac.com/feed/',
    'https://techcrunch.com/feed/',
    'https://www.theverge.com/rss/index.xml',
  ],
  Auto: [
    'https://www.autocarindia.com/rss',
    'https://www.carandbike.com/rss/news',
  ],
  'Long Reads': [
    'https://caravanmagazine.in/rss/all.xml',
    'https://scroll.in/feed.rss',
  ],
  Education: [
    'https://indianexpress.com/section/education/feed/',
    'https://www.hindustantimes.com/feeds/rss/education/rssfeed.xml',
  ],
  Weather: [
    'https://mausam.imd.gov.in/responsive/rss/weather.xml',
  ],
};
 
// ─── HELPERS ─────────────────────────────────────────────────────────────
 
function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  return stripCDATA(m[1]).trim();
}
 
function stripCDATA(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}
 
function stripTags(s) {
  return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
 
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}
 
function extractImage(itemXml) {
  // Try media:content, enclosure, image tag, or first <img> in description
  let m = itemXml.match(/<media:content[^>]*url=["']([^"']+)["']/i);
  if (m) return m[1];
  m = itemXml.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
  if (m) return m[1];
  m = itemXml.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i);
  if (m) return m[1];
  m = itemXml.match(/<enclosure[^>]*type=["']image[^"']*["'][^>]*url=["']([^"']+)["']/i);
  if (m) return m[1];
  m = itemXml.match(/<image>[\s\S]*?<url>([^<]+)<\/url>/i);
  if (m) return m[1].trim();
  // Try first <img> in description/content
  const desc = (itemXml.match(/<description>([\s\S]*?)<\/description>/i) || ['',''])[1];
  const cont = (itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i) || ['',''])[1];
  const haystack = stripCDATA(desc + ' ' + cont);
  m = haystack.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return m[1];
  return '';
}
 
function parseRSS(xml, sourceName, sectionName) {
  const stories = [];
  // RSS 2.0 uses <item>, Atom uses <entry>
  const itemPattern = /<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi;
  const items = xml.match(itemPattern) || [];
 
  for (const itemXml of items) {
    const title = decodeEntities(stripTags(extractTag(itemXml, 'title')));
    if (!title) continue;
 
    // URL — try <link>href="..."</link> (atom), <link>...</link> (rss), or <guid>
    let url = '';
    let linkMatch = itemXml.match(/<link[^>]*href=["']([^"']+)["']/i);
    if (linkMatch) {
      url = linkMatch[1];
    } else {
      url = extractTag(itemXml, 'link');
    }
    if (!url) url = extractTag(itemXml, 'guid');
    url = decodeEntities(url.trim());
    if (!url || !url.startsWith('http')) continue;
 
    // Summary — description or content:encoded, stripped of HTML
    let description = extractTag(itemXml, 'description') || extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'summary');
    description = decodeEntities(stripTags(description));
    // Trim to ~90 words
    const words = description.split(/\s+/).slice(0, 90);
    const summary = words.join(' ') + (words.length === 90 ? '...' : '');
 
    // Date
    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'published') || extractTag(itemXml, 'updated') || '';
 
    // Image
    const image = extractImage(itemXml);
 
    stories.push({
      headline:  title.slice(0, 300),
      summary:   summary,
      source:    sourceName,
      section:   sectionName,
      url:       url,
      image:     image,
      published: pubDate,
    });
  }
 
  return stories;
}
 
function deriveSourceName(feedUrl) {
  try {
    const host = new URL(feedUrl).hostname.replace(/^www\./, '');
    const map = {
      'feeds.feedburner.com': 'NDTV',
      'ndtv.com':             'NDTV',
      'hindustantimes.com':   'Hindustan Times',
      'indianexpress.com':    'Indian Express',
      'economictimes.indiatimes.com': 'Economic Times',
      'livemint.com':         'Mint',
      'business-standard.com':'Business Standard',
      'thehindu.com':         'The Hindu',
      'timesofindia.indiatimes.com': 'Times of India',
      'cricbuzz.com':         'Cricbuzz',
      'espncricinfo.com':     'ESPN Cricinfo',
      'vogue.in':             'Vogue India',
      'cntraveller.in':       'Conde Nast Traveller',
      'autocarindia.com':     'Autocar India',
      'carandbike.com':       'Car and Bike',
      'variety.com':          'Variety',
      'pinkvilla.com':        'Pinkvilla',
      '9to5mac.com':          '9to5Mac',
      'techcrunch.com':       'TechCrunch',
      'theverge.com':         'The Verge',
      'caravanmagazine.in':   'The Caravan',
      'scroll.in':            'Scroll',
      'mausam.imd.gov.in':    'IMD India',
    };
    return map[host] || host;
  } catch (e) {
    return 'Unknown';
  }
}
 
async function fetchFeed(feedUrl, sectionName) {
  try {
    const res = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GRIDDSNewsBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`Feed ${feedUrl} returned ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const sourceName = deriveSourceName(feedUrl);
    return parseRSS(xml, sourceName, sectionName);
  } catch (err) {
    console.error(`Error fetching ${feedUrl}:`, err.message);
    return [];
  }
}
 
// ─── MAIN CRON HANDLER ────────────────────────────────────────────────────
 
export default async function handler(req, res) {
  if (!WEBHOOK_URL || !TOKEN) {
    return res.status(500).json({ error: 'INBOX_WEBHOOK_URL or INBOX_TOKEN not set' });
  }
 
  const startedAt = Date.now();
  const allStories = [];
  const fetchPromises = [];
 
  // Build promise list for every (feed, section) pair
  for (const [section, feeds] of Object.entries(FEEDS)) {
    for (const feedUrl of feeds) {
      fetchPromises.push(
        fetchFeed(feedUrl, section).then(stories => {
          // Limit to most recent 5 stories per feed to avoid spam
          allStories.push(...stories.slice(0, 5));
        })
      );
    }
  }
 
  await Promise.allSettled(fetchPromises);
 
  if (allStories.length === 0) {
    return res.status(200).json({ ok: true, fetched: 0, sent: 0, message: 'No stories found' });
  }
 
  // POST to Apps Script webhook
  try {
    const webhookRes = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, stories: allStories }),
      redirect: 'follow',
    });
    const data = await webhookRes.text();
    let parsed;
    try { parsed = JSON.parse(data); } catch (e) { parsed = { raw: data.slice(0, 300) }; }
 
    return res.status(200).json({
      ok: true,
      fetched: allStories.length,
      webhook: parsed,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Webhook POST failed', detail: err.message });
  }
}
 
export const config = {
  maxDuration: 60,  // Allow up to 60 seconds for all feeds
};
