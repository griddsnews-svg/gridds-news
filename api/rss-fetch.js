// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — RSS Fetcher v2
// Runs daily via Vercel Cron, or anytime via manual URL trigger.
//
// New in v2:
//   - Expanded RSS sources (lifestyle heavy: GQ India, Elle, HT Brunch, Homegrown,
//     LBB, Curly Tales, Outlook Traveller, MissMalini, iDiva, Architectural Digest,
//     plus more news: Moneycontrol, FirstPost, The Print, Scroll, etc.)
//   - OpenAI GPT-4o-mini integration for 60-90 word Inshorts-style summaries.
//     If OPENAI_API_KEY env var is set, each story gets a fresh summary.
//     If unset, falls back to RSS description.
// ═══════════════════════════════════════════════════════════════════════════
 
const WEBHOOK_URL = process.env.INBOX_WEBHOOK_URL;
const TOKEN       = process.env.INBOX_TOKEN;
const OPENAI_KEY  = process.env.OPENAI_API_KEY;
 
// ─── FEED LIST: section → array of RSS URLs ──────────────────────────────
const FEEDS = {
  Headlines: [
    'https://feeds.feedburner.com/ndtvnews-top-stories',
    'https://www.hindustantimes.com/feeds/rss/india-news/index.xml',
    'https://indianexpress.com/section/india/feed/',
    'https://www.thehindu.com/news/national/feeder/default.rss',
    'https://www.indiatoday.in/rss/1206578',
    'https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml',
    'https://theprint.in/feed/',
  ],
  Finance: [
    'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
    'https://www.livemint.com/rss/markets',
    'https://www.business-standard.com/rss/markets-106.rss',
    'https://www.financialexpress.com/market/feed/',
    'https://www.moneycontrol.com/rss/business.xml',
    'https://www.thehindubusinessline.com/markets/feeder/default.rss',
  ],
  Health: [
    'https://www.hindustantimes.com/feeds/rss/lifestyle/health/rssfeed.xml',
    'https://indianexpress.com/section/health-wellness/feed/',
    'https://www.thehindu.com/sci-tech/health/feeder/default.rss',
    'https://www.healthshots.com/feed/',
  ],
  Politics: [
    'https://www.hindustantimes.com/feeds/rss/india-news/index.xml',
    'https://www.thehindu.com/news/national/feeder/default.rss',
    'https://indianexpress.com/section/political-pulse/feed/',
    'https://thewire.in/feed/',
  ],
  IPL: [
    'https://www.cricbuzz.com/cbz-news.xml',
    'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
    'https://www.sportskeeda.com/feed/cricket',
    'https://timesofindia.indiatimes.com/rssfeeds/4719161.cms',
  ],
  'GRIDD Loves': [
    'https://vogue.in/feed/rss',
    'https://www.cntraveller.in/feed/rss',
    'https://www.gqindia.com/feed/rss',
    'https://www.architecturaldigest.in/feed/rss',
    'https://www.elle.in/feed/',
    'https://www.harpersbazaar.in/feed',
    'https://www.grazia.co.in/feed/',
    'https://www.femina.in/rss.cms',
    'https://homegrown.co.in/rss',
    'https://www.idiva.com/rss/all',
    'https://www.missmalini.com/feed',
    'https://www.hindustantimes.com/feeds/rss/htbrunch/rssfeed.xml',
    'https://www.thehindu.com/life-and-style/feeder/default.rss',
    'https://www.outlooktraveller.com/rssfeeds/55',
    'https://www.livemint.com/rss/lounge',
  ],
  'City News': [
    'https://timesofindia.indiatimes.com/rssfeeds/-2128839596.cms',
    'https://www.hindustantimes.com/feeds/rss/cities/delhi-news/rssfeed.xml',
    'https://indianexpress.com/section/cities/delhi/feed/',
    'https://www.curlytales.com/feed/',
    'https://www.whatshot.in/rss',
  ],
  Science: [
    'https://www.thehindu.com/sci-tech/science/feeder/default.rss',
    'https://indianexpress.com/section/technology/science/feed/',
    'https://www.livescience.com/feeds/all',
  ],
  Entertainment: [
    'https://variety.com/v/film/feed/',
    'https://www.pinkvilla.com/rss.xml',
    'https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml',
    'https://indianexpress.com/section/entertainment/feed/',
  ],
  Tech: [
    'https://9to5mac.com/feed/',
    'https://techcrunch.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    'https://indianexpress.com/section/technology/feed/',
    'https://www.thehindu.com/sci-tech/technology/feeder/default.rss',
  ],
  Auto: [
    'https://www.autocarindia.com/rss',
    'https://www.carandbike.com/rss/news',
    'https://www.hindustantimes.com/feeds/rss/autos/rssfeed.xml',
  ],
  'Long Reads': [
    'https://caravanmagazine.in/rss/all.xml',
    'https://scroll.in/feed.rss',
    'https://thewire.in/feed/',
    'https://theprint.in/feed/',
  ],
  Education: [
    'https://indianexpress.com/section/education/feed/',
    'https://www.hindustantimes.com/feeds/rss/education/rssfeed.xml',
    'https://www.thehindu.com/education/feeder/default.rss',
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
  const desc = (itemXml.match(/<description>([\s\S]*?)<\/description>/i) || ['',''])[1];
  const cont = (itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i) || ['',''])[1];
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
    let linkMatch = itemXml.match(/<link[^>]*href=["']([^"']+)["']/i);
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
      headline:    title.slice(0, 300),
      rawSummary:  rawSummary,
      summary:     '',
      source:      sourceName,
      section:     sectionName,
      url:         url,
      image:       image,
      published:   pubDate,
    });
  }
 
  return stories;
}
 
function deriveSourceName(feedUrl) {
  try {
    const host = new URL(feedUrl).hostname.replace(/^www\./, '');
    const map = {
      'feeds.feedburner.com': 'NDTV',
      'ndtv.com': 'NDTV',
      'hindustantimes.com': 'Hindustan Times',
      'indianexpress.com': 'Indian Express',
      'economictimes.indiatimes.com': 'Economic Times',
      'livemint.com': 'Mint',
      'business-standard.com': 'Business Standard',
      'thehindu.com': 'The Hindu',
      'thehindubusinessline.com': 'Business Line',
      'timesofindia.indiatimes.com': 'Times of India',
      'cricbuzz.com': 'Cricbuzz',
      'espncricinfo.com': 'ESPN Cricinfo',
      'sportskeeda.com': 'Sportskeeda',
      'vogue.in': 'Vogue India',
      'cntraveller.in': 'Conde Nast Traveller',
      'gqindia.com': 'GQ India',
      'elle.in': 'Elle India',
      'harpersbazaar.in': 'Harper\'s Bazaar India',
      'grazia.co.in': 'Grazia India',
      'femina.in': 'Femina',
      'idiva.com': 'iDiva',
      'missmalini.com': 'MissMalini',
      'homegrown.co.in': 'Homegrown',
      'curlytales.com': 'Curly Tales',
      'whatshot.in': 'WhatsHot',
      'outlooktraveller.com': 'Outlook Traveller',
      'architecturaldigest.in': 'Architectural Digest India',
      'autocarindia.com': 'Autocar India',
      'carandbike.com': 'Car and Bike',
      'variety.com': 'Variety',
      'pinkvilla.com': 'Pinkvilla',
      '9to5mac.com': '9to5Mac',
      'techcrunch.com': 'TechCrunch',
      'theverge.com': 'The Verge',
      'caravanmagazine.in': 'The Caravan',
      'scroll.in': 'Scroll',
      'thewire.in': 'The Wire',
      'theprint.in': 'The Print',
      'firstpost.com': 'Firstpost',
      'indiatoday.in': 'India Today',
      'financialexpress.com': 'Financial Express',
      'moneycontrol.com': 'Moneycontrol',
      'livescience.com': 'Live Science',
      'mausam.imd.gov.in': 'IMD India',
      'healthshots.com': 'Health Shots',
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
 
// ─── OPENAI SUMMARY GENERATION ────────────────────────────────────────────
 
async function summariseWithOpenAI(story) {
  if (!OPENAI_KEY) return null;
  const userPrompt = `Headline: ${story.headline}\n\nArticle excerpt: ${story.rawSummary}\n\nWrite a tight, factual summary in 60-90 words in the style of Inshorts. No opinion, no hype, no clickbait. Plain prose, no bullet points. Do not repeat the headline verbatim. Just the summary, nothing else.`;
 
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
    if (!res.ok) {
      const txt = await res.text();
      console.warn('OpenAI error', res.status, txt.slice(0, 200));
      return null;
    }
    const data = await res.json();
    const out = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return out ? out.trim() : null;
  } catch (err) {
    console.error('OpenAI summarise failed:', err.message);
    return null;
  }
}
 
async function addSummaries(stories) {
  if (!OPENAI_KEY) {
    stories.forEach(s => {
      const words = s.rawSummary.split(/\s+/).slice(0, 90);
      s.summary = words.join(' ') + (words.length >= 90 ? '...' : '');
    });
    return;
  }
 
  const CONCURRENCY = 5;
  let idx = 0;
  async function worker() {
    while (idx < stories.length) {
      const i = idx++;
      const s = stories[i];
      const ai = await summariseWithOpenAI(s);
      if (ai) {
        s.summary = ai;
      } else {
        const words = s.rawSummary.split(/\s+/).slice(0, 90);
        s.summary = words.join(' ') + (words.length >= 90 ? '...' : '');
      }
    }
  }
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
  await Promise.all(workers);
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
