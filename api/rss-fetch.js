// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — RSS Fetcher v4.0
// Added: AI pre-scoring, headline dedup, auto-LIVE for trusted sources,
//        updated feed list (v2 — duplicates removed, new sources added)
// ═══════════════════════════════════════════════════════════════════════════

const OPENAI_KEY    = process.env.OPENAI_API_KEY;
const CRON_SECRET   = process.env.CRON_SECRET;
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;   // service_role — bypasses RLS

// Section display-name → section id used in the database
const SECTION_ID = {
  'Headlines': 'headlines', 'Finance': 'finance', 'Wellness': 'wellness',
  'Politics': 'politics', 'IPL': 'ipl', 'GRIDD Loves': 'griddloves',
  'City News': 'citynews', 'World News': 'worldnews', 'Entertainment': 'entertainment',
  'Tech': 'tech', 'Opinions': 'opinions', 'Long Reads': 'longreads',
  'This & That': 'thisandthat', 'Lifestyle': 'lifestyle',
};

// ─── SCORING CONFIG ───────────────────────────────────────────────────────

// Stories below this score are silently discarded (never reach the sheet)
const MIN_SCORE = 6;

// Stories AT OR ABOVE this score from a TRUSTED_SOURCE go LIVE automatically
const AUTO_LIVE_SCORE = 8;

// Sources trusted enough to auto-publish when score is high.
// Add/remove based on your experience with each.
const TRUSTED_SOURCES = new Set([
  'The Wire', 'Scroll', 'The Print', 'Mint', 'The Ken', 'Finshots',
  'Capitalmind', 'Morning Context', 'Inc42', 'MediaNama', 'Entrackr',
  'Film Companion', 'The Caravan', 'Frontline', 'Fifty Two',
  'Newslaundry', 'The Swaddle', 'Homegrown', 'Foreign Policy',
  'Foreign Affairs', 'Al Jazeera', 'BBC', 'Founding Fuel',
  'The India Forum', 'Himal Southasian', 'Article 14',
]);

// ─── FEED LIST (v2 — deduplicated, quality sources added) ─────────────────
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
  ],

  Wellness: [
    'https://indianexpress.com/section/health-wellness/feed/',
    'https://www.thehindu.com/sci-tech/health/feeder/default.rss',
    'https://www.healthshots.com/feed/',
    'https://www.livemint.com/rss/mint-lounge/health',
    'https://food.ndtv.com/feeds/rss/all/stories',
    'https://www.onlymyhealth.com/rss',
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
    'https://rss.app/r/feed/1dh3dHc5Z4Q2qhU9',
  ],

  'GRIDD Loves': [
    'https://vogue.in/feed/rss',
    'https://www.gqindia.com/feed/rss',
    'https://www.architecturaldigest.in/feed/rss',
    'https://www.livemint.com/rss/mint-lounge',
    'https://homegrown.co.in/rss',
    'https://www.thehindu.com/magazine/feeder/default.rss',
    'https://www.outlookindia.com/feed',
    'https://the-ken.com/feed/',
  ],

  'City News': [
    'https://indianexpress.com/section/cities/delhi/feed/',
    'https://www.thehindu.com/news/cities/Delhi/feeder/default.rss',
    'https://www.thehindu.com/news/cities/mumbai/feeder/default.rss',
    'https://indianexpress.com/section/cities/mumbai/feed/',
    'https://www.thehindu.com/news/cities/bangalore/feeder/default.rss',
    'https://indianexpress.com/section/cities/bangalore/feed/',
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
    'https://rss.app/feeds/nHyHlnWbZQy8Hfdu.xml',
    'https://rss.app/feeds/xa2LLXGin1Gy9x7F.xml',
  ],

};

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
      'harpersbazaar.in':              "Harper's Bazaar",
      'homegrown.co.in':               'Homegrown',
      'grazia.co.in':                  'Grazia India',
      'outlookindia.com':              'Outlook',
      'the-ken.com':                   'The Ken',
      'theswaddle.com':                'The Swaddle',
      'arre.co.in':                    'Arré',
      'feeds.bbci.co.uk':              'BBC',
      'aljazeera.com':                 'Al Jazeera',
      'foreignpolicy.com':             'Foreign Policy',
      'pinkvilla.com':                 'Pinkvilla',
      'bollywoodhungama.com':          'Bollywood Hungama',
      'filmfare.com':                  'Filmfare',
      'filmcompanion.in':              'Film Companion',
      'cinestaan.com':                 'Cinestaan',
      'galatta.com':                   'Galatta',
      'variety.com':                   'Variety',
      'theverge.com':                  'The Verge',
      'techcrunch.com':                'TechCrunch',
      'wired.com':                     'Wired',
      'feeds.arstechnica.com':         'Ars Technica',
      'gadgets.ndtv.com':              'NDTV Gadgets',
      '91mobiles.com':                 '91mobiles',
      '9to5mac.com':                   '9to5Mac',
      'technologyreview.com':          'MIT Tech Review',
      'entrackr.com':                  'Entrackr',
      'inc42.com':                     'Inc42',
      'medianama.com':                 'MediaNama',
      'yourstory.com':                 'YourStory',
      'frontline.thehindu.com':        'Frontline',
      'caravanmagazine.in':            'The Caravan',
      'foundingfuel.com':              'Founding Fuel',
      'foreignaffairs.com':            'Foreign Affairs',
      'himalmag.com':                  'Himal Southasian',
      'theindiaforum.in':              'The India Forum',
      'fiftytwo.in':                   'Fifty Two',
      'scroll.in':                     'Scroll',
      'thequint.com':                  'The Quint',
      'article-14.com':                'Article 14',
      'finshots.in':                   'Finshots',
      'capitalmind.in':                'Capitalmind',
      'themorningcontext.com':         'Morning Context',
      'healthshots.com':               'HealthShots',
      'femina.in':                     'Femina',
      'food.ndtv.com':                 'NDTV Food',
      'idiva.com':                     'iDiva',
      'onlymyhealth.com':              'OnlyMyHealth',
      'citizenmatters.in':             'Citizen Matters',
      'thelede.in':                    'The Lede',
      'curlytales.com':                'Curly Tales',
      'whatshot.in':                   'WhatsHot',
      'lbb.in':                        'LBB',
      'fountainink.in':                'Fountain Ink',
      'thebetterindia.com':            'The Better India',
      'atlasobscura.com':              'Atlas Obscura',
      'mausam.imd.gov.in':             'IMD Weather',
      'outlooktraveller.com':          'Outlook Traveller',
      'nationalgeographic.com':        'National Geographic',
      'missmalini.com':                'MissMalini',
      'thehindumagazine.com':          'The Hindu Magazine',
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

    const pubDate = extractTag(itemXml, 'pubDate')
      || extractTag(itemXml, 'published')
      || extractTag(itemXml, 'updated') || '';
    const image = extractImage(itemXml);

    stories.push({
      headline:   title.slice(0, 300),
      rawSummary,
      summary:    '',
      source:     sourceName,
      section:    sectionName,
      url,
      image,
      published:  pubDate,
    });
  }
  return stories;
}

async function fetchFeed(feedUrl, sectionName) {
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
    return parseRSS(xml, deriveSourceName(feedUrl), sectionName);
  } catch (err) {
    console.error(`Error fetching ${feedUrl}:`, err.message);
    return [];
  }
}

// ─── HEADLINE DEDUP ───────────────────────────────────────────────────────
// Drops stories whose headline shares 5+ consecutive words with an already-
// kept story in the same section. Catches wire rewrites across sources.

function dedupByHeadline(stories) {
  const kept = [];
  for (const story of stories) {
    const words = story.headline.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    const isDup = kept.some(k => {
      if (k.section !== story.section) return false;
      const kWords = k.headline.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
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

// ─── COMBINED AI SCORE + SUMMARISE (one call per batch, run in parallel) ────
// Each batch of stories is scored 1-10 AND summarised in a SINGLE OpenAI call.
// Batches run in parallel (up to MAX_PARALLEL at once) for speed.
// This roughly halves OpenAI time vs the old two-pass approach.

const SHORT_SOURCES = new Set(['NYT', 'BBC', 'BBC Cricket']);
const SCORE_BATCH   = 8;    // stories per OpenAI call
const MAX_PARALLEL  = 6;    // how many batches run at once

function rawExcerpt(story) {
  const wl = SHORT_SOURCES.has(story.source) ? 30 : 75;
  const words = (story.rawSummary || '').split(/\s+/).slice(0, wl);
  return words.join(' ') + (words.length >= wl ? '...' : '');
}

async function scoreAndSummariseBatch(batch) {
  // Fallback if no API key
  if (!OPENAI_KEY) {
    return batch.map(s => ({ ...s, _score: 6, _reason: 'unscored', summary: rawExcerpt(s) }));
  }

  const input = batch.map((s, idx) => ({
    i:   idx,
    sec: s.section,
    src: s.source,
    h:   s.headline,
    sum: (s.rawSummary || '').slice(0, 200),
    short: SHORT_SOURCES.has(s.source),   // tells model to write 30-word summary
  }));

  const prompt = `You are the editorial filter AND summary writer for GRIDDS.NEWS, a curated Indian news aggregator.

For EACH story do TWO things:
1. SCORE it 1-10:
   HIGH (8-10): original reporting, strong analysis, genuinely newsworthy, credible non-tabloid source, unique today.
   LOW (1-5): wire rewrite covered by 10 outlets, press release, clickbait, match scores with no narrative, astrology, stock ticks, filler.
   MEDIUM (6-7): borderline.
2. WRITE a tight factual summary in the style of Inshorts. Indian English. No opinion, no hype, no clickbait, no bullet points. Do not repeat the headline verbatim. If "short" is true write MAX 30 words, otherwise MAX 75 words.

Respond ONLY with a JSON array, same order as input, each object:
{"i":0,"score":8,"reason":"original analysis","summary":"the summary text"}
No other text. No markdown.

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
        max_tokens:  1400,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    let raw = (data.choices?.[0]?.message?.content || '').trim();

    // response_format json_object may wrap array in a key — handle both
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // strip markdown fences if any
      raw = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(raw);
    }
    // If wrapped in an object like {results:[...]} or {stories:[...]}, unwrap
    const arr = Array.isArray(parsed) ? parsed
              : (parsed.results || parsed.stories || parsed.data || Object.values(parsed)[0]);

    return batch.map((s, idx) => {
      const r = (Array.isArray(arr) ? arr.find(x => x.i === idx) : null)
                || { score: 6, reason: 'unscored', summary: rawExcerpt(s) };
      return {
        ...s,
        _score:  r.score || 6,
        _reason: r.reason || 'unscored',
        summary: (r.summary && r.summary.trim()) ? r.summary.trim() : rawExcerpt(s),
      };
    });

  } catch (err) {
    console.error('Score+summarise batch failed:', err.message);
    // Fallback: trusted sources still get benefit of doubt via _reason
    return batch.map(s => ({ ...s, _score: 6, _reason: 'scoring-failed', summary: rawExcerpt(s) }));
  }
}

// Process all stories in parallel batches
async function scoreAndSummariseAll(stories) {
  if (!stories.length) return [];

  // Build list of batches
  const batches = [];
  for (let i = 0; i < stories.length; i += SCORE_BATCH) {
    batches.push(stories.slice(i, i + SCORE_BATCH));
  }

  // Run batches with limited parallelism
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

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // ── Cron/manual auth — block unauthorised triggers ──────────────────────
  // Vercel cron sends Authorization: Bearer <CRON_SECRET> automatically.
  // For manual triggers: add ?secret=<CRON_SECRET> to the URL.
  if (CRON_SECRET) {
    const authHeader = req.headers['authorization'] || '';
    const querySecret = req.query?.secret || '';
    const provided = authHeader.replace('Bearer ', '').trim() || querySecret;
    if (provided !== CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_KEY not set' });
  }

  const startedAt  = Date.now();
  const allStories = [];

  // 1. Fetch all feeds in parallel
  const fetchPromises = [];
  for (const [section, feeds] of Object.entries(FEEDS)) {
    for (const feedUrl of feeds) {
      fetchPromises.push(
        fetchFeed(feedUrl, section).then(stories => {
          allStories.push(...stories.slice(0, 5));
        })
      );
    }
  }
  await Promise.allSettled(fetchPromises);
  console.log(`Fetched ${allStories.length} raw stories`);

  if (allStories.length === 0) {
    return res.status(200).json({ ok: true, fetched: 0, sent: 0, message: 'No stories found' });
  }

  // 2. Deduplicate by headline similarity
  const deduped = dedupByHeadline(allStories);
  console.log(`After dedup: ${deduped.length} stories`);

  // 3. AI score + summarise in ONE pass (parallel batches)
  const aiStart = Date.now();
  const scored = await scoreAndSummariseAll(deduped);
  const aiDuration = Date.now() - aiStart;

  let autoLiveN = 0, draftN = 0, discardN = 0;

  const toSend = scored
    .filter(s => {
      if (s._score < MIN_SCORE) { discardN++; return false; }
      return true;
    })
    .map(s => {
      const isTrusted     = TRUSTED_SOURCES.has(s.source);
      const scoringFailed = s._reason === 'scoring-failed' || s._reason === 'unscored';
      const autoLive      = isTrusted && (s._score >= AUTO_LIVE_SCORE || scoringFailed);
      if (autoLive) autoLiveN++; else draftN++;

      return {
        headline:   s.headline,
        summary:    s.summary,
        source:     s.source,
        section:    s.section,
        url:        s.url,
        image:      s.image,
        published:  s.published || new Date().toISOString(),
        statusHint: autoLive ? 'LIVE' : 'DRAFT',
        scoreNote:  `${s._score}/10 — ${s._reason}`,
      };
    });

  console.log(`Scored+summarised in ${aiDuration}ms`);
  console.log(`Kept ${toSend.length}, discarded ${discardN}, auto-LIVE ${autoLiveN}, draft ${draftN}`);

  // 5. Write to Supabase (upsert — dedup handled by unique(section_id, url))
  //    Uses the REST API directly with the service_role key (bypasses RLS).
  const rows = toSend.map(s => ({
    section_id:  SECTION_ID[s.section] || 'headlines',
    headline:    s.headline,
    summary:     s.summary,
    source:      s.source,
    url:         s.url,
    image:       s.image,
    status:      s.statusHint,                 // 'LIVE' or 'DRAFT'
    source_type: 'RSS',
    ai_score:    parseInt((s.scoreNote || '0').split('/')[0]) || null,
    ai_reason:   (s.scoreNote || '').split('— ')[1] || null,
    published_at: s.statusHint === 'LIVE' ? new Date().toISOString() : null,
  }));

  try {
    // Upsert in chunks of 100; on_conflict ignores duplicates by (section_id,url)
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
      raw:          allStories.length,
      afterDedup:   deduped.length,
      discarded:    discardN,
      sent:         toSend.length,
      autoLive:     autoLiveN,
      draft:        draftN,
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
