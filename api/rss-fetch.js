// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — RSS Fetcher v3.1
// Rebuilt from verified working feeds (May 2026).
// Runs daily via Vercel Cron, or anytime via manual URL trigger.
// ═══════════════════════════════════════════════════════════════════════════

const WEBHOOK_URL = process.env.INBOX_WEBHOOK_URL;
const TOKEN       = process.env.INBOX_TOKEN;
const OPENAI_KEY  = process.env.OPENAI_API_KEY;

// ─── FEED LIST ────────────────────────────────────────────────────────────
const FEEDS = {

  Headlines: [
    'https://feeds.feedburner.com/ndtvnews-top-stories',
    'https://www.thehindu.com/news/national/feeder/default.rss',
    'https://indianexpress.com/section/india/feed/',
    'https://www.indiatoday.in/rss/1206578',
    'https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml',
    'https://www.news18.com/rss/india.xml',
    'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms',
    'https://www.business-standard.com/rss/latest.rss',
    'https://www.livemint.com/rss/news',
    'https://www.newslaundry.com/feed',
  ],

  Finance: [
    'https://www.livemint.com/rss/economy',
    'https://www.livemint.com/rss/money',
    'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms',
    'https://www.thehindubusinessline.com/economy/feeder/default.rss',
    'https://www.business-standard.com/rss/economy-policy-106.rss',
    'https://www.moneycontrol.com/rss/business.xml',
  ],

  Wellness: [
    'https://indianexpress.com/section/health-wellness/feed/',
    'https://www.thehindu.com/sci-tech/health/feeder/default.rss',
    'https://vogue.in/feed/rss',
    'https://www.hindustantimes.com/feeds/rss/lifestyle/health/rssfeed.xml',
  ],

  Politics: [
    'https://www.thehindu.com/news/national/feeder/default.rss',
    'https://indianexpress.com/section/political-pulse/feed/',
    'https://theprint.in/category/politics/feed/',
    'https://feeds.feedburner.com/ndtvnews-india-news',
    'https://economictimes.indiatimes.com/news/politics-and-nation/rssfeeds/1052732854.cms',
  ],

  IPL: [
    'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
    'https://feeds.feedburner.com/ndtvsports-cricket',
    'https://www.sportskeeda.com/feed/cricket',
    'https://rss.app/r/feed/1dh3dHc5Z4Q2qhU9',              // BBC Cricket (custom)
  ],

  'GRIDD Loves': [
    'https://vogue.in/feed/rss',
    'https://www.gqindia.com/feed/rss',
    'https://www.cntraveller.in/feed/rss',
    'https://www.hindustantimes.com/feeds/rss/htbrunch/rssfeed.xml',
    'https://the-ken.com/feed/',
  ],

  'City News': [
    'https://www.hindustantimes.com/feeds/rss/cities/delhi-news/rssfeed.xml',
    'https://indianexpress.com/section/cities/delhi/feed/',
    'https://timesofindia.indiatimes.com/rssfeeds/-2128839596.cms',
    'https://www.thehindu.com/news/cities/Delhi/feeder/default.rss',
    'https://www.livemint.com/rss/news',
  ],

  'World News': [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.thehindu.com/news/international/feeder/default.rss',
    'https://indianexpress.com/section/world/feed/',
    'https://feeds.feedburner.com/ndtvnews-world-news',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://theprint.in/category/world/feed/',
    'https://foreignpolicy.com/feed/',
  ],

  Entertainment: [
    'https://www.pinkvilla.com/rss.xml',
    'https://indianexpress.com/section/entertainment/feed/',
    'https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml',
    'https://variety.com/v/film/feed/',
    'https://www.thehindu.com/entertainment/feeder/default.rss',
    'https://www.koimoi.com/feed/',
  ],

  Tech: [
    'https://www.theverge.com/rss/index.xml',
    'https://techcrunch.com/feed/',
    'https://www.wired.com/feed/rss',
    'https://feeds.arstechnica.com/arstechnica/index',
    'https://indianexpress.com/section/technology/feed/',
    'https://www.thehindu.com/sci-tech/technology/feeder/default.rss',
    'https://gadgets.ndtv.com/feeds/rss/all/stories',
    'https://9to5mac.com/feed/',
    'https://www.technologyreview.com/feed/',
  ],

  'Long Reads': [
    'https://www.thehindu.com/features/magazine/feeder/default.rss',
    'https://frontline.thehindu.com/feeder/default.rss',
    'https://the-ken.com/feed/',
    'https://www.newslaundry.com/feed',
    'https://www.foreignaffairs.com/rss.xml',
  ],

  Opinions: [
    'https://www.thehindu.com/opinion/feeder/default.rss',
    'https://indianexpress.com/section/opinion/feed/',
    'https://www.hindustantimes.com/feeds/rss/opinion/rssfeed.xml',
    'https://www.livemint.com/rss/opinion',
    'https://www.business-standard.com/rss/opinion-specials-110.rss',
    'https://theprint.in/category/opinion/feed/',
    'https://timesofindia.indiatimes.com/rssfeeds/784865811.cms',
    'https://economictimes.indiatimes.com/opinion/rssfeeds/897228639.cms',
    'https://www.hindustantimes.com/feeds/rss/analysis/rssfeed.xml',
  ],

  'This & That': [
    'https://www.thehindu.com/sci-tech/feeder/default.rss',
    'https://indianexpress.com/section/trending/feed/',
    'https://timesofindia.indiatimes.com/rssfeeds/7098549.cms',
    'https://www.hindustantimes.com/feeds/rss/trending/rssfeed.xml',
    'https://www.indiatoday.in/rss/1206602',
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
  ],

  Lifestyle: [
    'https://www.cntraveller.in/feed/rss',
    'https://timesofindia.indiatimes.com/rssfeeds/2269336.cms',
    'https://www.hindustantimes.com/feeds/rss/htbrunch/rssfeed.xml',
    'https://rss.app/feeds/nHyHlnWbZQy8Hfdu.xml',            // Mint Lounge (custom)
    'https://rss.app/feeds/xa2LLXGin1Gy9x7F.xml',            // NYT (custom)
  ],

};

// ─── SOURCE NAME MAP ──────────────────────────────────────────────────────
function deriveSourceName(feedUrl) {
  try {
    // Custom rss.app feeds — match by full URL
    const customMap = {
      'https://rss.app/feeds/nHyHlnWbZQy8Hfdu.xml': 'Mint Lounge',
      'https://rss.app/feeds/xa2LLXGin1Gy9x7F.xml': 'NYT',
      'https://rss.app/r/feed/1dh3dHc5Z4Q2qhU9':    'BBC Cricket',
    };
    if (customMap[feedUrl]) return customMap[feedUrl];

    const host = new URL(feedUrl).hostname.replace(/^www\./, '');
    const map = {
      'feeds.feedburner.com':              'NDTV',
      'thehindu.com':                      'The Hindu',
      'indianexpress.com':                 'Indian Express',
      'indiatoday.in':                     'India Today',
      'firstpost.com':                     'Firstpost',
      'news18.com':                        'News18',
      'timesofindia.indiatimes.com':       'Times of India',
      'business-standard.com':             'Business Standard',
      'livemint.com':                      'Mint',
      'newslaundry.com':                   'Newslaundry',
      'economictimes.indiatimes.com':      'Economic Times',
      'thehindubusinessline.com':          'Business Line',
      'moneycontrol.com':                  'Moneycontrol',
      'vogue.in':                          'Vogue India',
      'hindustantimes.com':                'Hindustan Times',
      'theprint.in':                       'The Print',
      'espncricinfo.com':                  'ESPN Cricinfo',
      'sportskeeda.com':                   'Sportskeeda',
      'gqindia.com':                       'GQ India',
      'cntraveller.in':                    'CN Traveller India',
      'the-ken.com':                       'The Ken',
      'feeds.bbci.co.uk':                  'BBC',
      'aljazeera.com':                     'Al Jazeera',
      'foreignpolicy.com':                 'Foreign Policy',
      'pinkvilla.com':                     'Pinkvilla',
      'variety.com':                       'Variety',
      'koimoi.com':                        'Koimoi',
      'theverge.com':                      'The Verge',
      'techcrunch.com':                    'TechCrunch',
      'wired.com':                         'Wired',
      'feeds.arstechnica.com':             'Ars Technica',
      'gadgets.ndtv.com':                  'Gadgets 360',
      '9to5mac.com':                       '9to5Mac',
      'technologyreview.com':              'MIT Tech Review',
      'frontline.thehindu.com':            'Frontline',
      'foreignaffairs.com':                'Foreign Affairs',
    };
    return map[host] || host;
  } catch (e) {
    return 'Unknown';
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

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
    if (linkMatch) {
      url = linkMatch[1];
    } else {
      url = extractTag(itemXml, 'link');
    }
    if (!url) url = extractTag(itemXml, 'guid');
    url = decodeEntities(url.trim());
    if (!url || !url.startsWith('http')) continue;

    let description = extractTag(itemXml, 'description') || extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'summary');
    description = decodeEntities(stripTags(description));
    const rawSummary = description.split(/\s+/).slice(0, 200).join(' ');

    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'published') || extractTag(itemXml, 'updated') || '';
    const image = extractImage(itemXml);

    stories.push({
      headline:   title.slice(0, 300),
      rawSummary: rawSummary,
      summary:    '',
      source:     sourceName,
      section:    sectionName,
      url:        url,
      image:      image,
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

// ─── OPENAI SUMMARIES ─────────────────────────────────────────────────────

async function summariseWithOpenAI(story, wordLimit = 75) {
  if (!OPENAI_KEY) return null;
  const userPrompt = `Headline: ${story.headline}\n\nArticle excerpt: ${story.rawSummary}\n\nWrite a tight, factual summary in ${wordLimit} words MAXIMUM (never exceed ${wordLimit} words) in the style of Inshorts. No opinion, no hype, no clickbait. Plain prose, no bullet points. Do not repeat the headline verbatim. Just the summary, nothing else.`;
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
          { role: 'system', content: `You are an editor writing crisp, factual news summaries in ${wordLimit} words MAXIMUM. Style of Inshorts. Indian English. No opinion, no hype, no padding.` },
          { role: 'user',   content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out = data.choices?.[0]?.message?.content;
    return out ? out.trim() : null;
  } catch (err) {
    console.error('OpenAI summarise failed:', err.message);
    return null;
  }
}

async function addSummaries(stories) {
  const SHORT_SUMMARY_SOURCES = new Set(['NYT', 'BBC', 'BBC Cricket', 'BBC World']);
  if (!OPENAI_KEY) {
    stories.forEach(s => {
      const wordLimit = SHORT_SUMMARY_SOURCES.has(s.source) ? 30 : 75;
      const words = s.rawSummary.split(/\s+/).slice(0, wordLimit);
      s.summary = words.join(' ') + (words.length >= wordLimit ? '...' : '');
    });
    return;
  }
  const SHORT_WORDS = 30;
  const LONG_WORDS  = 75;

  const CONCURRENCY = 5;
  let idx = 0;
  async function worker() {
    while (idx < stories.length) {
      const i = idx++;
      const s = stories[i];
      const isShort = SHORT_SUMMARY_SOURCES.has(s.source);
      const wordLimit = isShort ? SHORT_WORDS : LONG_WORDS;
      const ai = await summariseWithOpenAI(s, wordLimit);
      if (ai) {
        s.summary = ai;
      } else {
        const words = s.rawSummary.split(/\s+/).slice(0, wordLimit);
        s.summary = words.join(' ') + (words.length >= wordLimit ? '...' : '');
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (!WEBHOOK_URL || !TOKEN) {
    return res.status(500).json({ error: 'INBOX_WEBHOOK_URL or INBOX_TOKEN not set' });
  }

  const startedAt = Date.now();
  const allStories = [];
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

  if (allStories.length === 0) {
    return res.status(200).json({ ok: true, fetched: 0, sent: 0, message: 'No stories found' });
  }

  const aiStart = Date.now();
  await addSummaries(allStories);
  const aiDuration = Date.now() - aiStart;

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
      sections: Object.keys(FEEDS).length,
      feeds: Object.values(FEEDS).flat().length,
      withAISummaries: !!OPENAI_KEY,
      aiDurationMs: aiDuration,
      webhook: parsed,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Webhook POST failed', detail: err.message });
  }
}

export const config = {
  maxDuration: 300,
};
