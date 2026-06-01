// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — RSS + Webpage Fetcher v7.0
//
// CHANGES from v6:
// 0a. Feed list loaded from rss_feeds table (dashboard-controlled), fallback to
//     hardcoded FEEDS (RSS only) if the table read fails.
// 0b. WEBPAGE feeds (is_webpage=true) are now scraped: fetch the listing page,
//     extract same-domain article links under the section path, scrape up to
//     10 articles each (headline/image/text via OG tags + article/main/p),
//     then run them through the same dedup + AI summarise + publish pipeline.
//     Scraping logic ported from api/submit.js (direct → proxy fallback).
//
// (v5 changes retained: pubDate timestamps, OG image fallback, 60-75 word
//  summaries, reweighted City News, GRIDD Loves never auto-publishes,
//  cross-source auto-publish for Headlines/Finance, 72h draft auto-archive.)
// ═══════════════════════════════════════════════════════════════════════════
 
const OPENAI_KEY    = process.env.OPENAI_API_KEY;
const CRON_SECRET   = process.env.CRON_SECRET;
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
 
const SECTION_ID = {
  'Headlines': 'headlines', 'Finance': 'finance', 'Wellness': 'wellness',
  'Politics': 'politics', 'IPL': 'ipl', 'GRIDD Loves': 'griddloves',
  'City News': 'citynews', 'World News': 'worldnews', 'Entertainment': 'entertainment',
  'Tech': 'tech', 'Opinions': 'opinions', 'Long Reads': 'longreads',
  'This & That': 'thisandthat', 'Lifestyle': 'lifestyle',
};
 
// ─── SCORING CONFIG ───────────────────────────────────────────────────────
// Stories scoring BELOW this are written with status 'REJECTED' (kept, not
// discarded) so they show up in the Rejected tab of the editor dashboard.
// Stories whose AI scoring failed keep a neutral 6 and are never auto-rejected.
const REJECT_BELOW = 5;
const AUTO_LIVE_SCORE = 8;
 
const TRUSTED_SOURCES = new Set([
  'The Wire', 'Scroll', 'The Print', 'Mint', 'The Ken', 'Finshots',
  'Capitalmind', 'Morning Context', 'Inc42', 'MediaNama', 'Entrackr',
  'Film Companion', 'The Caravan', 'Frontline', 'Fifty Two',
  'Newslaundry', 'The Swaddle', 'Homegrown', 'Foreign Policy',
  'Foreign Affairs', 'Al Jazeera', 'BBC', 'Founding Fuel',
  'The India Forum', 'Himal Southasian', 'Article 14',
]);
 
// ─── CROSS-SOURCE AUTO-PUBLISH CONFIG (issues #10, #11) ──────────────────
// Headlines: if 3+ of these sources carry same story → auto LIVE
const HEADLINES_AUTO_SOURCES = new Set(['NDTV', 'Indian Express', 'Hindustan Times', 'The Hindu']);
const HEADLINES_AUTO_THRESHOLD = 3;
 
// Finance: if BOTH Mint AND Economic Times carry same story → auto LIVE
const FINANCE_AUTO_SOURCES = new Set(['Mint', 'Economic Times']);
const FINANCE_AUTO_THRESHOLD = 2;
 
// ─── FEED LIST v3 — FALLBACK ONLY ─────────────────────────────────────────
// NOTE: As of v6 the live feed list is read from the rss_feeds table so it can
// be managed from the editorial dashboard. This hardcoded object is now only a
// safety fallback used if the table read fails or returns nothing.
const FEEDS = {
 
  Headlines: [
    'https://feeds.feedburner.com/ndtvnews-top-stories',
    'https://www.thehindu.com/news/national/feeder/default.rss',
    'https://indianexpress.com/section/india/feed/',
    'https://scroll.in/feed.rss',
    'https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml',
    'https://www.business-standard.com/rss/latest.rss',
    'https://www.livemint.com/rss/news',
    'https://www.thequint.com/feed.rss',
    'https://article-14.com/feed',
    'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml',
  ],
 
  Finance: [
    'https://www.livemint.com/rss/economy',
    'https://www.livemint.com/rss/money',
    'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms',
    'https://www.thehindubusinessline.com/economy/feeder/default.rss',
    'https://www.business-standard.com/rss/economy-policy-106.rss',
    'https://www.moneycontrol.com/rss/business.xml',
    'https://www.financialexpress.com/economy/feed/',
    'https://feeds.feedburner.com/ndtv/BusinessNews',
    'https://finshots.in/feed/',
    'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
  ],
 
  Wellness: [
    'https://indianexpress.com/section/health-wellness/feed/',
    'https://www.thehindu.com/sci-tech/health/feeder/default.rss',
    'https://www.healthshots.com/feed/',
    'https://www.livemint.com/rss/mint-lounge/health',
    'https://food.ndtv.com/feeds/rss/all/stories',
    'https://www.onlymyhealth.com/rss',
    'https://indianexpress.com/section/lifestyle/health/feed/',
    'https://www.femina.in/wellness/feed',
    'https://timesofindia.indiatimes.com/rssfeeds/3908999.cms',
    'https://www.thehindubusinessline.com/blink/know/feeder/default.rss',
  ],
 
  Politics: [
    'https://www.thehindu.com/news/national/feeder/default.rss',
    'https://indianexpress.com/section/political-pulse/feed/',
    'https://thewire.in/feed/',
    'https://theprint.in/category/politics/feed/',
    'https://www.newslaundry.com/feed',
    'https://feeds.feedburner.com/ndtvnews-india-news',
    'https://economictimes.indiatimes.com/news/politics-and-nation/rssfeeds/1052732854.cms',
    'https://caravanmagazine.in/rss/all.xml',
  ],
 
  IPL: [
    'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
    'https://feeds.feedburner.com/ndtvsports-cricket',
    'https://www.sportskeeda.com/feed/cricket',
    'https://www.crictracker.com/feed/',
    'https://indianexpress.com/section/sports/ipl/feed/',
    'https://www.thehindu.com/sport/cricket/feeder/default.rss',
  ],
 
  'GRIDD Loves': [
    'https://vogue.in/feed/rss',
    'https://www.gqindia.com/feed/rss',
    'https://www.architecturaldigest.in/feed/rss',
    'https://www.livemint.com/rss/mint-lounge',
    'https://homegrown.co.in/rss',
    'https://www.thehindu.com/magazine/feeder/default.rss',
    'https://the-ken.com/feed/',
  ],
 
  // REWEIGHTED: Gurgaon > Delhi > Noida first, then 1 each for Mumbai/Bangalore
  'City News': [
    'https://indianexpress.com/section/cities/delhi/feed/',
    'https://www.thehindu.com/news/cities/Delhi/feeder/default.rss',
    'https://www.hindustantimes.com/feeds/rss/cities/delhi/rssfeed.xml',
    'https://timesofindia.indiatimes.com/rssfeeds/2128936835.cms',       // TOI Delhi
    'https://timesofindia.indiatimes.com/rssfeeds/-2128816011.cms',      // TOI Gurgaon
    'https://timesofindia.indiatimes.com/rssfeeds/2128932452.cms',       // TOI Noida
    'https://www.hindustantimes.com/feeds/rss/cities/noida/rssfeed.xml',
    'https://indianexpress.com/section/cities/mumbai/feed/',
    'https://www.thehindu.com/news/cities/bangalore/feeder/default.rss',
  ],
 
  'World News': [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.thehindu.com/news/international/feeder/default.rss',
    'https://indianexpress.com/section/world/feed/',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://theprint.in/category/world/feed/',
    'https://foreignpolicy.com/feed/',
    'https://thewire.in/category/world/feed',
  ],
 
  Entertainment: [
    'https://www.pinkvilla.com/rss.xml',
    'https://indianexpress.com/section/entertainment/feed/',
    'https://variety.com/v/film/feed/',
    'https://www.thehindu.com/entertainment/feeder/default.rss',
    'https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms',      // TOI Entertainment
    'https://www.firstpost.com/commonfeeds/v1/mfp/rss/entertainment.xml',
    'https://scroll.in/reel/feed',
    'https://www.filmcompanion.in/feed/',
  ],
 
  Tech: [
    'https://www.theverge.com/rss/index.xml',
    'https://techcrunch.com/feed/',
    'https://www.wired.com/feed/rss',
    'https://feeds.arstechnica.com/arstechnica/index',
    'https://indianexpress.com/section/technology/feed/',
    'https://www.thehindu.com/sci-tech/technology/feeder/default.rss',
    'https://gadgets.ndtv.com/feeds/rss/all/stories',
    'https://www.91mobiles.com/rss.xml',
    'https://9to5mac.com/feed/',
    'https://www.technologyreview.com/feed/',
    'https://inc42.com/feed/',
  ],
 
  'Long Reads': [
    'https://caravanmagazine.in/rss/all.xml',
    'https://frontline.thehindu.com/feeder/default.rss',
    'https://the-ken.com/feed/',
    'https://www.thehindu.com/features/magazine/feeder/default.rss',
    'https://www.foreignaffairs.com/rss.xml',
    'https://scroll.in/feed.rss',
  ],
 
  Opinions: [
    'https://www.thehindu.com/opinion/feeder/default.rss',
    'https://indianexpress.com/section/opinion/feed/',
    'https://www.livemint.com/rss/opinion',
    'https://www.business-standard.com/rss/opinion-specials-110.rss',
    'https://theprint.in/category/opinion/feed/',
    'https://timesofindia.indiatimes.com/rssfeeds/784865811.cms',
    'https://economictimes.indiatimes.com/opinion/rssfeeds/897228639.cms',
  ],
 
  'This & That': [
    'https://www.thehindu.com/sci-tech/feeder/default.rss',
    'https://indianexpress.com/section/trending/feed/',
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    'https://thewire.in/category/science/feed',
  ],
 
  Lifestyle: [
    'https://www.cntraveller.in/feed/rss',
    'https://www.nationalgeographic.com/latest-stories/_jcr_content/content/featuredstories.rss',
    'https://food.ndtv.com/feeds/rss/all/stories',
    'https://homegrown.co.in/rss',
    'https://indianexpress.com/section/lifestyle/feed/',
    'https://www.livemint.com/rss/mint-lounge/food',
    'https://timesofindia.indiatimes.com/rssfeeds/2886704.cms',        // TOI Lifestyle
    'https://www.thehindu.com/life-and-style/feeder/default.rss',
    'https://www.femina.in/life/feed',
  ],
 
};
 
// ─── DB → display-name reverse map (for feeds loaded from rss_feeds table) ──
const DBID_TO_SECTION = Object.fromEntries(
  Object.entries(SECTION_ID).map(([name, id]) => [id, name])
);
 
// ─── Load active feeds from the rss_feeds table (dashboard-controlled) ──────
// Returns { rss: { 'Section': [url,...] }, webpage: [{ url, section }] }.
// RSS feeds are grouped by section name (the shape fetchFeed expects).
// Webpage feeds are a flat list (each scraped via scrapeWebpageFeed).
// Returns null on any failure or empty result so the caller can fall back to
// the hardcoded FEEDS object (RSS only).
async function loadFeedsFromDB() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/rss_feeds?is_active=eq.true&select=*`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (!resp.ok) { console.warn('rss_feeds read failed:', resp.status); return null; }
    const rows = await resp.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
 
    const rss = {};
    const webpage = [];
    for (const r of rows) {
      const sectionName = DBID_TO_SECTION[r.section_id];
      if (!sectionName) { console.warn('Unknown section_id in rss_feeds:', r.section_id); continue; }
      // Optional per-feed display name override (column may not exist yet → undefined)
      const srcName = (r.source_name && String(r.source_name).trim()) ? String(r.source_name).trim() : null;
      if (r.is_webpage) {
        webpage.push({ url: r.feed_url, section: sectionName, sourceName: srcName });
      } else {
        (rss[sectionName] = rss[sectionName] || []).push({ url: r.feed_url, sourceName: srcName });
      }
    }
    const rssCount = Object.values(rss).reduce((a, b) => a + b.length, 0);
    if (rssCount === 0 && webpage.length === 0) return null;
    console.log(`Loaded ${rssCount} RSS + ${webpage.length} webpage feeds from rss_feeds table`);
    return { rss, webpage };
  } catch (e) {
    console.error('loadFeedsFromDB error:', e.message);
    return null;
  }
}
 
// ─── SOURCE NAME MAP ──────────────────────────────────────────────────────
function deriveSourceName(feedUrl) {
  try {
    const customMap = {
      'https://rss.app/feeds/nHyHlnWbZQy8Hfdu.xml': 'Mint Lounge',
      'https://rss.app/feeds/xa2LLXGin1Gy9x7F.xml': 'NYT',
      'https://rss.app/r/feed/1dh3dHc5Z4Q2qhU9':    'BBC Cricket',
    };
    if (customMap[feedUrl]) return customMap[feedUrl];
 
    const host = new URL(feedUrl).hostname.replace(/^www\./, '');
    const map = {
      'feeds.feedburner.com':          'NDTV',
      'thehindu.com':                  'The Hindu',
      'indianexpress.com':             'Indian Express',
      'indiatoday.in':                 'India Today',
      'firstpost.com':                 'Firstpost',
      'news18.com':                    'News18',
      'timesofindia.indiatimes.com':   'Times of India',
      'business-standard.com':         'Business Standard',
      'livemint.com':                  'Mint',
      'newslaundry.com':               'Newslaundry',
      'economictimes.indiatimes.com':  'Economic Times',
      'thehindubusinessline.com':      'Business Line',
      'moneycontrol.com':              'Moneycontrol',
      'financialexpress.com':          'Financial Express',
      'vogue.in':                      'Vogue India',
      'hindustantimes.com':            'Hindustan Times',
      'theprint.in':                   'The Print',
      'thewire.in':                    'The Wire',
      'espncricinfo.com':              'ESPN Cricinfo',
      'sportskeeda.com':               'Sportskeeda',
      'crictracker.com':               'CricTracker',
      'gqindia.com':                   'GQ India',
      'architecturaldigest.in':        'AD India',
      'cntraveller.in':                'CN Traveller India',
      'homegrown.co.in':               'Homegrown',
      'the-ken.com':                   'The Ken',
      'feeds.bbci.co.uk':              'BBC',
      'aljazeera.com':                 'Al Jazeera',
      'foreignpolicy.com':             'Foreign Policy',
      'pinkvilla.com':                 'Pinkvilla',
      'variety.com':                   'Variety',
      'theverge.com':                  'The Verge',
      'techcrunch.com':                'TechCrunch',
      'wired.com':                     'Wired',
      'feeds.arstechnica.com':         'Ars Technica',
      'gadgets.ndtv.com':              'NDTV Gadgets',
      '91mobiles.com':                 '91mobiles',
      '9to5mac.com':                   '9to5Mac',
      'technologyreview.com':          'MIT Tech Review',
      'inc42.com':                     'Inc42',
      'medianama.com':                 'MediaNama',
      'frontline.thehindu.com':        'Frontline',
      'caravanmagazine.in':            'The Caravan',
      'foreignaffairs.com':            'Foreign Affairs',
      'scroll.in':                     'Scroll',
      'thequint.com':                  'The Quint',
      'article-14.com':                'Article 14',
      'finshots.in':                   'Finshots',
      'healthshots.com':               'HealthShots',
      'femina.in':                     'Femina',
      'food.ndtv.com':                 'NDTV Food',
      'onlymyhealth.com':              'OnlyMyHealth',
      'nationalgeographic.com':        'National Geographic',
      'filmcompanion.in':              'Film Companion',
    };
    return map[host] || host;
  } catch (e) {
    return 'Unknown';
  }
}
 
// ─── RSS PARSING HELPERS ──────────────────────────────────────────────────
 
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
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—');
}
 
function extractImage(itemXml) {
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
  const desc = (itemXml.match(/<description>([\s\S]*?)<\/description>/i) || ['', ''])[1];
  const cont = (itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i) || ['', ''])[1];
  const haystack = stripCDATA(desc + ' ' + cont);
  m = haystack.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return m[1];
  return '';
}
 
// ─── OG:IMAGE FALLBACK (issue #3) ─────────────────────────────────────────
// For stories with no image from RSS, fetch the article page and grab og:image
async function fetchOgImage(articleUrl) {
  try {
    const res = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GRIDDSNewsBot/2.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    // Only read first 20KB for speed
    const head = html.slice(0, 20000);
    let m = head.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (m) return m[1];
    m = head.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (m) return m[1];
    m = head.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    if (m) return m[1];
    return '';
  } catch (e) {
    return '';
  }
}
 
function parseRSS(xml, sourceName, sectionName) {
  const stories = [];
  const itemPattern = /<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi;
  const items = xml.match(itemPattern) || [];
 
  for (const itemXml of items) {
    const title = decodeEntities(stripTags(extractTag(itemXml, 'title')));
    if (!title) continue;
 
    let url = '';
    const linkMatch = itemXml.match(/<link[^>]*href=["']([^"']+)["']/i);
    if (linkMatch) { url = linkMatch[1]; }
    else { url = extractTag(itemXml, 'link'); }
    if (!url) url = extractTag(itemXml, 'guid');
    url = decodeEntities(url.trim());
    if (!url || !url.startsWith('http')) continue;
 
    let description = extractTag(itemXml, 'description')
      || extractTag(itemXml, 'content:encoded')
      || extractTag(itemXml, 'summary');
    description = decodeEntities(stripTags(description));
    const rawSummary = description.split(/\s+/).slice(0, 200).join(' ');
 
    // Parse pubDate for timestamp storage (issue #2)
    const pubDateStr = extractTag(itemXml, 'pubDate')
      || extractTag(itemXml, 'published')
      || extractTag(itemXml, 'updated') || '';
 
    let sourcePubAt = null;
    if (pubDateStr) {
      const d = new Date(pubDateStr);
      if (!isNaN(d.getTime())) sourcePubAt = d.toISOString();
    }
 
    const image = extractImage(itemXml);
 
    stories.push({
      headline:       title.slice(0, 300),
      rawSummary,
      summary:        '',
      source:         sourceName,
      section:        sectionName,
      url,
      image,
      sourcePubAt,    // NEW: parsed ISO timestamp from source
    });
  }
  return stories;
}
 
async function fetchFeed(feedUrl, sectionName, sourceOverride = null) {
  try {
    const res = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GRIDDSNewsBot/2.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.warn(`Feed ${feedUrl} → ${res.status}`); return []; }
    const xml = await res.text();
    return parseRSS(xml, sourceOverride || deriveSourceName(feedUrl), sectionName);
  } catch (err) {
    console.error(`Error fetching ${feedUrl}:`, err.message);
    return [];
  }
}
 
// ═══════════════════════════════════════════════════════════════════════════
// WEBPAGE SCRAPING (for is_webpage feeds) — ported from api/submit.js
// A webpage feed is a listing/section page (e.g. indianexpress.com/.../lifestyle-desk/).
// We fetch it, extract same-domain article links under the section path, then
// scrape each article for headline/image/text (reusing the same extractors).
// ═══════════════════════════════════════════════════════════════════════════
 
const WEBPAGE_MAX_ARTICLES = 10;   // cap per webpage feed per run
 
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
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, type: 'json', field: 'contents' },
    { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, type: 'text' },
    { url: `https://corsproxy.io/?${encodeURIComponent(url)}`, type: 'text' },
  ];
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (GRIDDS.NEWS Bot)' },
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
 
async function fetchPage(url) {
  try {
    return await fetchDirect(url);
  } catch (directErr) {
    console.warn(`Direct fetch failed (${directErr.message}), trying proxies: ${url}`);
  }
  return await fetchViaProxy(url);   // throws if all fail
}
 
// Meta/OG extractors (same approach as submit.js)
function wpExtractMeta(html, names) {
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
function wpHeadline(html) {
  let h = wpExtractMeta(html, ['og:title', 'twitter:title']);
  if (h) return h;
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return decodeEntities(stripTags(m[1]));
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return decodeEntities(stripTags(h1[1]));
  return '';
}
function wpImage(html, articleUrl) {
  const img = wpExtractMeta(html, ['og:image', 'twitter:image', 'twitter:image:src']);
  if (img) { try { return new URL(img, articleUrl).toString(); } catch (e) { return img; } }
  return '';
}
function wpText(html) {
  const desc = wpExtractMeta(html, ['og:description', 'twitter:description', 'description']);
  let body = '';
  const a = html.match(/<article[^>]*>([\s\S]{200,8000}?)<\/article>/i);
  if (a) body = stripTags(a[1]);
  if (!body) { const mm = html.match(/<main[^>]*>([\s\S]{200,8000}?)<\/main>/i); if (mm) body = stripTags(mm[1]); }
  if (!body) {
    const ps = html.match(/<p[^>]*>[\s\S]{50,1000}?<\/p>/gi) || [];
    body = ps.slice(0, 8).map(p => stripTags(p)).join(' ');
  }
  return (desc + ' ' + body).slice(0, 4000);
}
function wpPubDate(html) {
  const d = wpExtractMeta(html, ['article:published_time', 'og:updated_time']);
  if (d) { const dt = new Date(d); if (!isNaN(dt.getTime())) return dt.toISOString(); }
  return null;
}
 
// Pull same-domain links that look like articles. Listing pages often live at a
// different path than the articles they link to (e.g. IE lists at /agency/...
// but articles sit at /article/...), so we keep same-domain links with an
// article-like slug and skip obvious navigation/section/asset links.
function extractArticleLinks(listingHtml, listingUrl) {
  const out = [];
  const seen = new Set();
  let base;
  try { base = new URL(listingUrl).origin; }
  catch (e) { return out; }
 
  // path segments that signal navigation/section pages rather than articles
  const SKIP_SEGMENTS = new Set([
    'about-us','about','contact','contact-us','privacy','terms','subscribe',
    'subscription','newsletter','author','authors','agency','tag','tags','topic',
    'topics','section','category','page','login','signin','sitemap','rss','feed',
  ]);
 
  const hrefs = listingHtml.match(/<a[^>]+href=["']([^"']+)["']/gi) || [];
  for (const tag of hrefs) {
    const m = tag.match(/href=["']([^"']+)["']/i);
    if (!m) continue;
    let href = m[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
    let abs, path;
    try { abs = new URL(href, listingUrl).toString(); path = new URL(abs).pathname; }
    catch (e) { continue; }
 
    if (!abs.startsWith(base)) continue;                          // same domain only
    if (abs.replace(/\/+$/, '') === listingUrl.replace(/\/+$/, '')) continue;  // not the listing itself
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|css|js)(\?|$)/i.test(abs)) continue; // not an asset
 
    const segs = path.split('/').filter(Boolean);
    if (segs.length === 0) continue;                              // homepage
    if (SKIP_SEGMENTS.has(segs[0])) continue;                     // nav/section/author/agency pages
    if (/^\d+$/.test(segs[segs.length - 1])) continue;            // pure-number pagination
 
    // article-like: a reasonably long, word-bearing final slug
    const lastSeg = segs[segs.length - 1];
    if (lastSeg.length < 12) continue;                            // too short to be a headline slug
    if (!lastSeg.includes('-')) continue;                         // article slugs are hyphenated
 
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}
 
async function scrapeWebpageFeed(feed) {
  const { url: listingUrl, section, sourceName } = feed;
  const stories = [];
  let listingHtml;
  try {
    listingHtml = await fetchPage(listingUrl);
  } catch (e) {
    console.warn(`Webpage feed unreachable: ${listingUrl} (${e.message})`);
    return stories;
  }
  const links = extractArticleLinks(listingHtml, listingUrl).slice(0, WEBPAGE_MAX_ARTICLES);
  console.log(`Webpage feed ${listingUrl}: ${links.length} article links`);
 
  const source = sourceName || detectSourceFromUrl(listingUrl);
  await Promise.allSettled(links.map(async (articleUrl) => {
    try {
      const html = await fetchPage(articleUrl);
      const headline = wpHeadline(html);
      if (!headline) return;
      const image = wpImage(html, articleUrl);
      const text  = wpText(html);
      stories.push({
        headline:  headline.slice(0, 300),
        rawSummary: text.split(/\s+/).slice(0, 200).join(' '),
        summary:   '',
        source,
        section,
        url:       articleUrl,
        image,
        sourcePubAt: wpPubDate(html),
      });
    } catch (e) {
      // skip individual article failures
    }
  }));
  return stories;
}
 
// Source name from URL only (listing/article pages)
function detectSourceFromUrl(u) {
  try {
    const host = new URL(u).hostname.replace(/^www\./, '');
    // reuse deriveSourceName's host map by faking a feed URL
    const name = deriveSourceName(u);
    if (name && name !== host) return name;
    const parts = host.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch (e) { return 'Unknown'; }
}
 
// ─── HEADLINE DEDUP ───────────────────────────────────────────────────────
function normalizeHeadline(h) {
  return h.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}
 
function dedupByHeadline(stories) {
  const kept = [];
  for (const story of stories) {
    const words = normalizeHeadline(story.headline).split(' ');
    const isDup = kept.some(k => {
      if (k.section !== story.section) return false;
      const kWords = normalizeHeadline(k.headline).split(' ');
      for (let i = 0; i <= words.length - 5; i++) {
        const phrase = words.slice(i, i + 5).join(' ');
        if (kWords.join(' ').includes(phrase)) return true;
      }
      return false;
    });
    if (!isDup) kept.push(story);
  }
  return kept;
}
 
// ─── CROSS-SOURCE AUTO-PUBLISH (issues #10, #11) ──────────────────────────
// Returns a Set of story URLs that should auto-publish based on multi-source coverage
function findCrossSourceAutoPublish(stories) {
  const autoUrls = new Set();
 
  // Group headlines stories by normalized headline (first 8 words)
  function headlineKey(h) {
    return normalizeHeadline(h).split(' ').slice(0, 8).join(' ');
  }
 
  // Headlines: same story from 3+ of NDTV/IE/HT/Hindu
  const headlineGroups = {};
  stories
    .filter(s => s.section === 'Headlines')
    .forEach(s => {
      const key = headlineKey(s.headline);
      if (!headlineGroups[key]) headlineGroups[key] = new Set();
      headlineGroups[key].add(s.source);
    });
 
  for (const [key, sources] of Object.entries(headlineGroups)) {
    const matchCount = [...sources].filter(s => HEADLINES_AUTO_SOURCES.has(s)).length;
    if (matchCount >= HEADLINES_AUTO_THRESHOLD) {
      // Mark all stories in this group for auto-publish
      stories
        .filter(s => s.section === 'Headlines' && headlineKey(s.headline) === key)
        .forEach(s => autoUrls.add(s.url));
    }
  }
 
  // Finance: same story from both Mint AND Economic Times
  const financeGroups = {};
  stories
    .filter(s => s.section === 'Finance')
    .forEach(s => {
      const key = headlineKey(s.headline);
      if (!financeGroups[key]) financeGroups[key] = new Set();
      financeGroups[key].add(s.source);
    });
 
  for (const [key, sources] of Object.entries(financeGroups)) {
    const matchCount = [...sources].filter(s => FINANCE_AUTO_SOURCES.has(s)).length;
    if (matchCount >= FINANCE_AUTO_THRESHOLD) {
      stories
        .filter(s => s.section === 'Finance' && headlineKey(s.headline) === key)
        .forEach(s => autoUrls.add(s.url));
    }
  }
 
  return autoUrls;
}
 
// ─── AI SCORE + SUMMARISE ─────────────────────────────────────────────────
const SHORT_SOURCES = new Set(['NYT', 'BBC', 'BBC Cricket']);
const SCORE_BATCH   = 8;
const MAX_PARALLEL  = 6;
 
function rawExcerpt(story) {
  const wl = SHORT_SOURCES.has(story.source) ? 30 : 75;
  const words = (story.rawSummary || '').split(/\s+/).slice(0, wl);
  return words.join(' ') + (words.length >= wl ? '...' : '');
}
 
async function scoreAndSummariseBatch(batch) {
  if (!OPENAI_KEY) {
    return batch.map(s => ({ ...s, _score: 6, _reason: 'unscored', summary: rawExcerpt(s) }));
  }
 
  const input = batch.map((s, idx) => ({
    i:   idx,
    sec: s.section,
    src: s.source,
    h:   s.headline,
    sum: (s.rawSummary || '').slice(0, 300),
    short: SHORT_SOURCES.has(s.source),
  }));
 
  // UPDATED PROMPT (issues #4-5): enforces 60-75 word summaries
  const prompt = `You are the editorial filter AND summary writer for GRIDDS.NEWS, a curated Indian news aggregator.
 
For EACH story do TWO things:
1. SCORE it 1-10:
   HIGH (8-10): original reporting, strong analysis, genuinely newsworthy, credible non-tabloid source, unique today.
   LOW (1-5): wire rewrite covered by 10 outlets, press release, clickbait, match scores with no narrative, astrology, stock ticks, filler.
   MEDIUM (6-7): borderline.
2. WRITE a crisp factual summary:
   - If "short" is true: write exactly 25-30 words.
   - Otherwise: write exactly 60-75 words. NOT shorter. NOT just an introduction. Cover the key facts: who, what, why, outcome/impact.
   - Style: Inshorts. Indian English. No opinion, no hype, no clickbait, no bullet points.
   - Do NOT repeat the headline verbatim.
   - If the article excerpt is too short to write 60 words, expand with context from the headline.
 
Respond with ONLY a JSON object of this exact shape (no markdown, no other text):
{"results":[{"i":0,"score":8,"reason":"original analysis","summary":"the 60-75 word summary text here"}]}
The "results" array MUST be in the same order as the input and MUST include the "i" field for every story.
 
Stories:
${JSON.stringify(input)}`;
 
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  2000,   // increased from 1400 to allow longer summaries
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    });
 
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    let raw = (data.choices?.[0]?.message?.content || '').trim();
 
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      raw = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(raw);
    }
 
    // Robustly locate the results array regardless of how json_object wrapped it:
    //  • a bare array
    //  • { results: [...] } / { stories: [...] } / any property whose value is an array
    //  • an index-keyed object like { "0": {...}, "1": {...} }
    let arr = null;
    if (Array.isArray(parsed)) {
      arr = parsed;
    } else if (parsed && typeof parsed === 'object') {
      arr = parsed.results || parsed.stories || parsed.data
            || Object.values(parsed).find(v => Array.isArray(v))
            || null;
      if (!arr) {
        const vals = Object.values(parsed);
        if (vals.length && vals.every(v => v && typeof v === 'object' && ('score' in v || 'summary' in v))) {
          arr = vals;   // index-keyed object → treat its values as the list
        }
      }
    }
 
    if (!Array.isArray(arr)) {
      // Couldn't find the list — surface what the model actually returned so this
      // is diagnosable from the logs instead of silently defaulting to 6/10.
      console.error('Score parse: no array found. Raw head:', raw.slice(0, 300));
      return batch.map(s => ({ ...s, _score: 6, _reason: 'parse-no-array', summary: rawExcerpt(s) }));
    }
 
    return batch.map((s, idx) => {
      // Prefer matching by the echoed "i" field; fall back to positional order
      // when the model returns the array in order without repeating "i".
      const r = arr.find(x => x && x.i === idx) || arr[idx]
                || { score: 6, reason: 'unscored', summary: rawExcerpt(s) };
      return {
        ...s,
        _score:  r.score || 6,
        _reason: r.reason || 'unscored',
        summary: (r.summary && String(r.summary).trim()) ? String(r.summary).trim() : rawExcerpt(s),
      };
    });
 
  } catch (err) {
    console.error('Score+summarise batch failed:', err.message);
    return batch.map(s => ({ ...s, _score: 6, _reason: 'scoring-failed', summary: rawExcerpt(s) }));
  }
}
 
async function scoreAndSummariseAll(stories) {
  if (!stories.length) return [];
  const batches = [];
  for (let i = 0; i < stories.length; i += SCORE_BATCH) {
    batches.push(stories.slice(i, i + SCORE_BATCH));
  }
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < batches.length) {
      const b = batches[idx++];
      const done = await scoreAndSummariseBatch(b);
      results.push(...done);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, batches.length) }, worker));
  return results;
}
 
// ─── AUTO-ARCHIVE (issues #5 + #6) ─────────────────────────────────────────
//  Two passes:
//   1. Stale DRAFTs (unpublished fetch candidates) older than 72h → ARCHIVED.
//   2. LIVE stories older than their section's age limit → ARCHIVED, BUT never
//      below a floor of MIN_LIVE_PER_SECTION live stories in any section. The
//      floor always wins: a thin section keeps even old stories until fresh
//      ones arrive.
//
//  CONFIG — adjust these two to taste. EVERGREEN sections live longer.
const MIN_LIVE_PER_SECTION = 10;            // issue #6 floor (per section)
const EVERGREEN_MAX_AGE_H  = 48;            // issue #5 evergreen tiles
const OTHER_MAX_AGE_H      = 24;            // issue #5 all other tiles
//  Which section_ids count as "evergreen". Everything else uses OTHER_MAX_AGE_H.
//  ⚠️ Confirm this split — these are the timeless/feature desks; the news desks
//  (headlines, finance, politics, ipl, citynews, worldnews, entertainment, tech)
//  fall through to the 24h rule.
const EVERGREEN_SECTIONS = new Set([
  'wellness', 'lifestyle', 'longreads', 'opinions', 'thisandthat', 'griddloves',
]);

async function patchArchive(ids) {
  if (!ids.length) return 0;
  // PostgREST caps URL length; chunk the id list to stay safe.
  let done = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const inList = chunk.map(encodeURIComponent).join(',');
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/stories?id=in.(${inList})`,
      {
        method: 'PATCH',
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      }
    );
    if (!resp.ok) { console.warn('Archive PATCH failed:', await resp.text()); }
    else done += chunk.length;
  }
  return done;
}

async function archiveStories() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { drafts: 0, live: 0 };
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const now = Date.now();
  let draftCount = 0, liveCount = 0;

  // ── Pass 1: stale DRAFTs > 72h ──
  try {
    const cutoff = new Date(now - 72 * 60 * 60 * 1000).toISOString();
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/stories?status=eq.DRAFT&created_at=lt.${cutoff}&select=id`,
      { headers },
    );
    if (resp.ok) {
      const rows = await resp.json();
      draftCount = await patchArchive(rows.map(r => r.id));
    }
  } catch (e) { console.error('draft archive error:', e.message); }

  // ── Pass 2: aged LIVE stories, respecting the per-section floor ──
  try {
    // Pull every LIVE story once; group + decide in memory. Oldest first so the
    // ids we trim are always the oldest eligible ones.
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/stories?status=eq.LIVE`
        + `&select=id,section_id,published_at,created_at,source_published_at`
        + `&order=published_at.asc.nullsfirst`,
      { headers },
    );
    if (resp.ok) {
      const rows = await resp.json();
      const bySection = {};
      for (const r of rows) (bySection[r.section_id] = bySection[r.section_id] || []).push(r);

      const toArchive = [];
      for (const [sectionId, list] of Object.entries(bySection)) {
        const maxAgeH = EVERGREEN_SECTIONS.has(sectionId) ? EVERGREEN_MAX_AGE_H : OTHER_MAX_AGE_H;
        const ageCutoff = now - maxAgeH * 60 * 60 * 1000;
        // How many we're allowed to remove without dropping below the floor.
        let budget = Math.max(0, list.length - MIN_LIVE_PER_SECTION);
        if (budget === 0) continue;                 // floor protects the whole section
        for (const r of list) {                     // already oldest → newest
          if (budget === 0) break;
          const ts = new Date(r.published_at || r.source_published_at || r.created_at).getTime();
          if (!isNaN(ts) && ts < ageCutoff) { toArchive.push(r.id); budget--; }
        }
      }
      liveCount = await patchArchive(toArchive);
    }
  } catch (e) { console.error('live archive error:', e.message); }

  console.log(`Auto-archive: ${draftCount} drafts, ${liveCount} aged LIVE stories.`);
  return { drafts: draftCount, live: liveCount };
}
 
// ─── MAIN HANDLER ─────────────────────────────────────────────────────────
 
export default async function handler(req, res) {
  // Auth: accept EITHER the cron secret (Vercel scheduled run) OR a valid
  // Supabase session from a logged-in editor (issue #9 — manual "Run fetcher"
  // button in the console). Verifying the JWT means the URL alone is useless to
  // an outsider, so the endpoint is no longer a guessable open trigger.
  if (CRON_SECRET) {
    const authHeader  = req.headers['authorization'] || '';
    const bearer      = authHeader.replace('Bearer ', '').trim();
    const querySecret = req.query?.secret || '';
    const isCron      = (bearer && bearer === CRON_SECRET) || querySecret === CRON_SECRET;
    let isEditor = false;
    if (!isCron && bearer && SUPABASE_URL) {
      try {
        const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: process.env.SUPABASE_ANON_KEY || SUPABASE_KEY, Authorization: `Bearer ${bearer}` },
        });
        if (who.ok) { const u = await who.json(); isEditor = !!(u && u.id); }
      } catch { /* fall through to 401 */ }
    }
    if (!isCron && !isEditor) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
 
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_KEY not set' });
  }
 
  const startedAt  = Date.now();
 
  // Archive stale drafts + aged LIVE stories first (issues #5 + #6)
  await archiveStories();
 
  const allStories = [];
 
  // 1. Load feed list from the rss_feeds table (dashboard-controlled).
  //    Shape: { rss: { Section: [url,...] }, webpage: [{url,section}] }.
  //    Fall back to hardcoded FEEDS (RSS only) if the table read fails.
  const dbFeeds = await loadFeedsFromDB();
  const usingDB = !!dbFeeds;
  const rssFeeds     = usingDB ? dbFeeds.rss     : FEEDS;
  const webpageFeeds = usingDB ? dbFeeds.webpage : [];
  console.log(`Feed source: ${usingDB ? 'rss_feeds table' : 'hardcoded fallback'} — ` +
              `${Object.values(rssFeeds).reduce((a,b)=>a+b.length,0)} RSS, ${webpageFeeds.length} webpage`);
 
  // 1a. RSS feeds in parallel
  const fetchPromises = [];
  for (const [section, feeds] of Object.entries(rssFeeds)) {
    for (const feed of feeds) {
      // DB feeds are { url, sourceName }; hardcoded fallback entries are plain strings.
      const feedUrl     = typeof feed === 'string' ? feed : feed.url;
      const srcOverride = typeof feed === 'string' ? null : feed.sourceName;
      fetchPromises.push(
        fetchFeed(feedUrl, section, srcOverride).then(stories => {
          allStories.push(...stories.slice(0, 5));
        })
      );
    }
  }
 
  // 1b. Webpage feeds in parallel (each scrapes its listing page + up to 10 articles)
  let webpageStoryCount = 0;
  for (const feed of webpageFeeds) {
    fetchPromises.push(
      scrapeWebpageFeed(feed).then(stories => {
        webpageStoryCount += stories.length;
        allStories.push(...stories);   // already capped at WEBPAGE_MAX_ARTICLES
      })
    );
  }
 
  await Promise.allSettled(fetchPromises);
  console.log(`Fetched ${allStories.length} raw stories (${webpageStoryCount} from webpage feeds)`);
 
  if (allStories.length === 0) {
    return res.status(200).json({ ok: true, fetched: 0, sent: 0, message: 'No stories found' });
  }
 
  // 2. Deduplicate
  const deduped = dedupByHeadline(allStories);
  console.log(`After dedup: ${deduped.length} stories`);
 
  // 3. OG:image fallback for stories without images (issue #3)
  // Do this for up to 30 stories to avoid timeout — prioritize NDTV, TheKen etc
  const noImageStories = deduped.filter(s => !s.image).slice(0, 30);
  if (noImageStories.length > 0) {
    const ogPromises = noImageStories.map(async (s) => {
      s.image = await fetchOgImage(s.url);
    });
    await Promise.allSettled(ogPromises);
    console.log(`Fetched og:image for ${noImageStories.length} stories`);
  }
 
  // 4. AI score + summarise
  const aiStart = Date.now();
  const scored = await scoreAndSummariseAll(deduped);
  const aiDuration = Date.now() - aiStart;
 
  // 5. Cross-source auto-publish detection (issues #10, #11)
  const crossSourceAutoUrls = findCrossSourceAutoPublish(scored);
  console.log(`Cross-source auto-publish candidates: ${crossSourceAutoUrls.size}`);
 
  let autoLiveN = 0, draftN = 0, rejectedN = 0;
 
  const toSend = scored
    .map(s => {
      const isTrusted     = TRUSTED_SOURCES.has(s.source);
      const scoringFailed = s._reason === 'scoring-failed' || s._reason === 'unscored';
      const isGriddLoves  = s.section === 'GRIDD Loves';
 
      // Genuinely low-quality → REJECTED (kept for the Rejected tab, not dropped).
      // Stories whose scoring FAILED keep their neutral 6 and are never rejected.
      if (!scoringFailed && s._score < REJECT_BELOW) {
        rejectedN++;
        return {
          headline:    s.headline,
          summary:     s.summary,
          source:      s.source,
          section:     s.section,
          url:         s.url,
          image:       s.image,
          sourcePubAt: s.sourcePubAt,
          statusHint:  'REJECTED',
          scoreNote:   `${s._score}/10 — ${s._reason}`,
        };
      }
 
      // GRIDD Loves NEVER auto-publishes (issue #7)
      let autoLive = false;
      if (!isGriddLoves) {
  // ONLY cross-source consensus triggers auto-LIVE
  if (crossSourceAutoUrls.has(s.url)) {
    autoLive = true;
  }
  // Trusted source + high score no longer auto-publishes
  // Everything else goes to DRAFT for admin review
}
 
      if (autoLive) autoLiveN++; else draftN++;
 
      return {
        headline:    s.headline,
        summary:     s.summary,
        source:      s.source,
        section:     s.section,
        url:         s.url,
        image:       s.image,
        sourcePubAt: s.sourcePubAt,
        statusHint:  autoLive ? 'LIVE' : 'DRAFT',
        scoreNote:   `${s._score}/10 — ${s._reason}`,
      };
    });
 
  console.log(`Scored+summarised in ${aiDuration}ms`);
  console.log(`Kept ${toSend.length} (auto-LIVE ${autoLiveN}, draft ${draftN}, rejected ${rejectedN})`);
 
  // 6. Write to Supabase
  const rows = toSend.map(s => ({
    section_id:        SECTION_ID[s.section] || 'headlines',
    headline:          s.headline,
    summary:           s.summary,
    source:            s.source,
    url:               s.url,
    image:             s.image,
    status:            s.statusHint,
    source_type:       'RSS',
    ai_score:          parseInt((s.scoreNote || '0').split('/')[0]) || null,
    ai_reason:         (s.scoreNote || '').split('— ')[1] || null,
    published_at:      s.statusHint === 'LIVE' ? new Date().toISOString() : null,
    source_published_at: s.sourcePubAt || null,   // NEW (issue #2)
  }));
 
  try {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/stories?on_conflict=section_id,url`,
        {
          method: 'POST',
          headers: {
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type':  'application/json',
            'Prefer':        'resolution=ignore-duplicates,return=minimal',
          },
          body: JSON.stringify(chunk),
        }
      );
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Supabase ${resp.status}: ${txt.slice(0, 200)}`);
      }
      inserted += chunk.length;
    }
 
    return res.status(200).json({
      ok:           true,
      feedSource:   usingDB ? 'rss_feeds-table' : 'hardcoded-fallback',
      webpageFeeds: webpageFeeds.length,
      fromWebpage:  webpageStoryCount,
      raw:          allStories.length,
      afterDedup:   deduped.length,
      rejected:     rejectedN,
      sent:         toSend.length,
      autoLive:     autoLiveN,
      draft:        draftN,
      crossSourceAuto: crossSourceAutoUrls.size,
      writtenToDB:  inserted,
      aiSummaries:  !!OPENAI_KEY,
      aiDurationMs: aiDuration,
      durationMs:   Date.now() - startedAt,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Supabase write failed', detail: err.message });
  }
}
 
export const config = { maxDuration: 300 };
 
