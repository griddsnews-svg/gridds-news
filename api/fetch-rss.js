// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — RSS Fetcher v4.0
// Added: AI pre-scoring, headline dedup, auto-LIVE for trusted sources,
//        updated feed list (v2 — duplicates removed, new sources added)
// ═══════════════════════════════════════════════════════════════════════════

const WEBHOOK_URL = process.env.INBOX_WEBHOOK_URL;
const TOKEN       = process.env.INBOX_TOKEN;
const OPENAI_KEY  = process.env.OPENAI_API_KEY;

// ─── SCORING CONFIG ───────────────────────────────────────────────────────

// Stories below this score are silently discarded (never reach the sheet)
const MIN_SCORE = 6;

// Stories AT OR ABOVE this score from a TRUSTED_SOURCE go LIVE automatically
const AUTO_LIVE_SCORE = 9;

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
    'https://capitalmind.in/feed/',
    'https://themorningcontext.com/feed',
  ],

  Wellness: [
    'https://indianexpress.com/section/health-wellness/feed/',
    'https://www.thehindu.com/sci-tech/health/feeder/default.rss',
    'https://www.healthshots.com/feed/',
    'https://www.livemint.com/rss/mint-lounge/health',
    'https://www.femina.in/rss.cms',
    'https://food.ndtv.com/feeds/rss/all/stories',
    'https://www.idiva.com/rss/all',
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
    'https://www.elle.in/feed/',
    'https://www.harpersbazaar.in/feed',
    'https://www.livemint.com/rss/mint-lounge',
    'https://homegrown.co.in/rss',
    'https://www.thehindu.com/magazine/feeder/default.rss',
    'https://www.grazia.co.in/feed/',
    'https://www.outlookindia.com/feed',
    'https://the-ken.com/feed/',
    'https://theswaddle.com/feed/',
    'https://www.arre.co.in/feed/',
  ],

  'City News': [
    'https://indianexpress.com/section/cities/delhi/feed/',
    'https://www.thehindu.com/news/cities/Delhi/feeder/default.rss',
    'https://www.thehindu.com/news/cities/mumbai/feeder/default.rss',
    'https://indianexpress.com/section/cities/mumbai/feed/',
    'https://www.thehindu.com/news/cities/bangalore/feeder/default.rss',
    'https://indianexpress.com/section/cities/bangalore/feed/',
    'https://citizenmatters.in/feed/',
    'https://thelede.in/feed',
    'https://www.curlytales.com/feed/',
    'https://www.whatshot.in/rss',
    'https://lbb.in/feed/',
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
    'https://www.filmcompanion.in/feed/',
    'https://www.pinkvilla.com/rss.xml',
    'https://www.bollywoodhungama.com/rss/news/type/news/',
    'https://www.filmfare.com/rss/news.xml',
    'https://indianexpress.com/section/entertainment/feed/',
    'https://variety.com/v/film/feed/',
    'https://www.thehindu.com/entertainment/feeder/default.rss',
    'https://www.cinestaan.com/articles/rss',
    'https://www.galatta.com/feed/',
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
    'https://entrackr.com/feed/',
    'https://inc42.com/feed/',
    'https://medianama.com/feed/',
    'https://yourstory.com/feed',
  ],

  'Long Reads': [
    'https://caravanmagazine.in/rss/all.xml',
    'https://frontline.thehindu.com/feeder/default.rss',
    'https://the-ken.com/feed/',
    'https://www.foundingfuel.com/feed/',
    'https://www.thehindu.com/features/magazine/feeder/default.rss',
    'https://www.foreignaffairs.com/rss.xml',
    'https://www.himalmag.com/feed/',
    'https://www.theindiaforum.in/rss.xml',
    'https://fiftytwo.in/feed/',
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
    'https://fountainink.in/feed',
  ],

  'This & That': [
    'https://www.thehindu.com/sci-tech/feeder/default.rss',
    'https://indianexpress.com/section/trending/feed/',
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    'https://in.mashable.com/feed',
    'https://mausam.imd.gov.in/responsive/rss/weather.xml',
    'https://www.thebetterindia.com/feed/',
    'https://www.atlasobscura.com/feeds/latest',
    'https://thewire.in/category/science/feed',
  ],

  Lifestyle: [
    'https://www.cntraveller.in/feed/rss',
    'https://www.outlooktraveller.com/rssfeeds/55',
    'https://www.nationalgeographic.com/latest-stories/_jcr_content/content/featuredstories.rss',
    'https://www.curlytales.com/feed/',
    'https://www.whatshot.in/rss',
    'https://lbb.in/feed/',
    'https://www.idiva.com/rss/all',
    'https://www.missmalini.com/feed',
    'https://food.ndtv.com/feeds/rss/all/stories',
    'https://timesofindia.indiatimes.com/rssfeeds/2269336.cms',
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
      'elle.in':                       'Elle India',
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

// ─── AI SCORING ───────────────────────────────────────────────────────────
// Scores stories 1–10. Below MIN_SCORE → discarded.
// Returns stories with _score and _reason added.

async function scoreStories(stories) {
  if (!OPENAI_KEY || !stories.length) {
    // No API key — pass everything through as DRAFT with neutral score
    return stories.map(s => ({ ...s, _score: 6, _reason: 'unscored' }));
  }

  const BATCH = 10;
  const scored = [];

  for (let i = 0; i < stories.length; i += BATCH) {
    const batch = stories.slice(i, i + BATCH);
    const input = batch.map((s, idx) => ({
      i:   idx,
      sec: s.section,
      src: s.source,
      h:   s.headline,
      sum: (s.rawSummary || '').slice(0, 120),
    }));

    const prompt = `You are the editorial filter for GRIDDS.NEWS, a curated Indian news aggregator.
Score each story 1–10.

SCORE HIGH (8–10): original reporting, strong analysis, genuinely newsworthy, credible non-tabloid source, adds something unique today.
SCORE LOW (1–5): wire rewrite covered by 10 outlets, press release dressed as news, clickbait, match scores with no narrative, astrology, stock ticks, vague lifestyle filler.
SCORE MEDIUM (6–7): borderline, worth a human glance.

Respond ONLY with a JSON array, same order as input:
[{"i":0,"score":8,"reason":"original analysis"},{"i":1,"score":4,"reason":"wire rewrite"}]
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
          max_tokens:  400,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const data   = await res.json();
      const raw    = (data.choices?.[0]?.message?.content || '').trim();
      const scores = JSON.parse(raw);

      batch.forEach((s, idx) => {
        const sc = scores.find(x => x.i === idx) || { score: 6, reason: 'unscored' };
        scored.push({ ...s, _score: sc.score, _reason: sc.reason });
      });

    } catch (err) {
      console.error('Scoring batch failed:', err.message);
      // On failure pass batch through as DRAFT
      batch.forEach(s => scored.push({ ...s, _score: 6, _reason: 'scoring-failed' }));
    }
  }

  return scored;
}

// ─── AI SUMMARIES ─────────────────────────────────────────────────────────

async function summariseWithOpenAI(story, wordLimit = 75) {
  if (!OPENAI_KEY) return null;
  const prompt = `Headline: ${story.headline}\n\nArticle excerpt: ${story.rawSummary}\n\nWrite a tight, factual summary in ${wordLimit} words MAXIMUM in the style of Inshorts. No opinion, no hype, no clickbait. Plain prose, no bullet points. Do not repeat the headline verbatim. Just the summary, nothing else.`;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are an editor writing crisp, factual news summaries in ${wordLimit} words MAXIMUM. Style of Inshorts. Indian English. No opinion, no hype, no padding.` },
          { role: 'user',   content: prompt },
        ],
        max_tokens:  150,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out  = data.choices?.[0]?.message?.content;
    return out ? out.trim() : null;
  } catch (err) {
    console.error('OpenAI summarise failed:', err.message);
    return null;
  }
}

async function addSummaries(stories) {
  const SHORT_SOURCES = new Set(['NYT', 'BBC', 'BBC Cricket']);
  if (!OPENAI_KEY) {
    stories.forEach(s => {
      const wl    = SHORT_SOURCES.has(s.source) ? 30 : 75;
      const words = s.rawSummary.split(/\s+/).slice(0, wl);
      s.summary   = words.join(' ') + (words.length >= wl ? '...' : '');
    });
    return;
  }
  const CONCURRENCY = 5;
  let idx = 0;
  async function worker() {
    while (idx < stories.length) {
      const i  = idx++;
      const s  = stories[i];
      const wl = SHORT_SOURCES.has(s.source) ? 30 : 75;
      const ai = await summariseWithOpenAI(s, wl);
      if (ai) {
        s.summary = ai;
      } else {
        const words = s.rawSummary.split(/\s+/).slice(0, wl);
        s.summary   = words.join(' ') + (words.length >= wl ? '...' : '');
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

  // 3. AI scoring — filter and assign status
  const scored = await scoreStories(deduped);

  const autoLiveCount = { count: 0 };
  const draftCount    = { count: 0 };
  const discardCount  = { count: 0 };

  const toSend = scored
    .filter(s => {
      if (s._score < MIN_SCORE) { discardCount.count++; return false; }
      return true;
    })
    .map(s => {
      const isTrusted = TRUSTED_SOURCES.has(s.source);
      const autoLive  = isTrusted && s._score >= AUTO_LIVE_SCORE;
      if (autoLive) autoLiveCount.count++;
      else draftCount.count++;

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

  console.log(`Scoring: kept ${toSend.length}, discarded ${discardCount.count}`);
  console.log(`Auto-LIVE: ${autoLiveCount.count}, DRAFT queue: ${draftCount.count}`);

  // 4. Generate AI summaries for kept stories
  const aiStart = Date.now();
  await addSummaries(toSend);
  const aiDuration = Date.now() - aiStart;

  // 5. POST to Google Sheet
  try {
    const webhookRes = await fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: TOKEN, source: 'RSS', stories: toSend }),
      redirect: 'follow',
    });
    const data = await webhookRes.text();
    let parsed;
    try { parsed = JSON.parse(data); } catch (e) { parsed = { raw: data.slice(0, 300) }; }

    return res.status(200).json({
      ok:           true,
      raw:          allStories.length,
      afterDedup:   deduped.length,
      discarded:    discardCount.count,
      sent:         toSend.length,
      autoLive:     autoLiveCount.count,
      draft:        draftCount.count,
      aiSummaries:  !!OPENAI_KEY,
      aiDurationMs: aiDuration,
      webhook:      parsed,
      durationMs:   Date.now() - startedAt,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Webhook POST failed', detail: err.message });
  }
}

export const config = { maxDuration: 300 };
