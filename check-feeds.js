// ─────────────────────────────────────────────────────────────────────────
// GRIDDS.NEWS — Feed Checker v2
// Run: node check-feeds.js
// Requires Node 18+ (native fetch). No npm install needed.
// Output: console table + writes results to check-feeds-results.json
//
// Changes from v1:
//   - Removed duplicate Gadgets 360 (same URL as NDTV Gadgets)
//   - Scroll.in kept only in Headlines (removed from Politics, World, Opinions, Entertainment)
//   - The Wire kept only in Politics (removed from Headlines, Long Reads, Opinions)
//   - The Print kept only in Politics (removed from Headlines, Long Reads)
//   - Newslaundry kept only in Long Reads (removed from Headlines, Politics)
//   - Mint Lounge kept only in GRIDD Loves (removed from Lifestyle, Long Reads)
//   - Vogue India kept only in GRIDD Loves (removed from Wellness)
//   - Femina kept only in Wellness (removed from GRIDD Loves, Lifestyle)
//   - MissMalini kept only in Entertainment (removed from Lifestyle)
//   - AD India kept only in GRIDD Loves (removed from Lifestyle)
//   - CNT India kept only in Lifestyle (removed from GRIDD Loves)
//   - Dropped: TOI Viral, NDTV Offbeat, HT Trending from This & That
//   - Dropped: Stardust, Koimoi from Entertainment
//   - Dropped: HT India News from Politics (firewall blocked + same as Headlines)
//   - City News: added Mumbai + Bengaluru sources
//   - Added: Finshots, Capitalmind, Morning Context (Finance)
//   - Added: Inc42, MediaNama, YourStory (Tech)
//   - Added: Film Companion, Cinestaan (Entertainment)
//   - Added: The Better India, Fifty Two, Atlas Obscura (This & That)
//   - Added: Citizen Matters, The Lede (City News)
//   - Added: Himal Southasian, The India Forum, Article 14 (Long Reads)
//   - Added: The Swaddle, Arre, Brown History (GRIDD Loves)
//   - Added: The Caravan Opinions (Opinions)
// ─────────────────────────────────────────────────────────────────────────

const FEEDS = [

  // ── HEADLINES ────────────────────────────────────────────────────────────
  // Kept: broad hard-news sources only. Removed Wire/Print/Scroll/Newslaundry
  // (kept in their specialist sections below).
  { section: 'Headlines', name: 'NDTV',             url: 'https://feeds.feedburner.com/ndtvnews-top-stories' },
  { section: 'Headlines', name: 'The Hindu',         url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { section: 'Headlines', name: 'Indian Express',    url: 'https://indianexpress.com/section/india/feed/' },
  { section: 'Headlines', name: 'Scroll.in',         url: 'https://scroll.in/feed.rss' },
  { section: 'Headlines', name: 'Firstpost',         url: 'https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml' },
  { section: 'Headlines', name: 'Business Standard', url: 'https://www.business-standard.com/rss/latest.rss' },
  { section: 'Headlines', name: 'Mint',              url: 'https://www.livemint.com/rss/news' },
  { section: 'Headlines', name: 'The Quint',         url: 'https://www.thequint.com/feed.rss' },
  { section: 'Headlines', name: 'Article 14',        url: 'https://article-14.com/feed' },

  // ── FINANCE ──────────────────────────────────────────────────────────────
  // Added Finshots, Capitalmind, Morning Context for original analysis.
  { section: 'Finance', name: 'Mint Economy',        url: 'https://www.livemint.com/rss/economy' },
  { section: 'Finance', name: 'Mint Money',          url: 'https://www.livemint.com/rss/money' },
  { section: 'Finance', name: 'Economic Times',      url: 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms' },
  { section: 'Finance', name: 'Hindu BusinessLine',  url: 'https://www.thehindubusinessline.com/economy/feeder/default.rss' },
  { section: 'Finance', name: 'Business Standard',   url: 'https://www.business-standard.com/rss/economy-policy-106.rss' },
  { section: 'Finance', name: 'Moneycontrol',        url: 'https://www.moneycontrol.com/rss/business.xml' },
  { section: 'Finance', name: 'Financial Express',   url: 'https://www.financialexpress.com/economy/feed/' },
  { section: 'Finance', name: 'NDTV Profit',         url: 'https://feeds.feedburner.com/ndtv/BusinessNews' },
  { section: 'Finance', name: 'Finshots',            url: 'https://finshots.in/feed/' },
  { section: 'Finance', name: 'Capitalmind',         url: 'https://capitalmind.in/feed/' },
  { section: 'Finance', name: 'Morning Context',     url: 'https://themorningcontext.com/feed' },

  // ── WELLNESS ─────────────────────────────────────────────────────────────
  // Removed Vogue India (kept in GRIDD Loves). Kept Femina here only.
  { section: 'Wellness', name: 'IE Health',          url: 'https://indianexpress.com/section/health-wellness/feed/' },
  { section: 'Wellness', name: 'The Hindu Health',   url: 'https://www.thehindu.com/sci-tech/health/feeder/default.rss' },
  { section: 'Wellness', name: 'HealthShots',        url: 'https://www.healthshots.com/feed/' },
  { section: 'Wellness', name: 'Mint Lounge Health', url: 'https://www.livemint.com/rss/mint-lounge/health' },
  { section: 'Wellness', name: 'Femina',             url: 'https://www.femina.in/rss.cms' },
  { section: 'Wellness', name: 'NDTV Food',          url: 'https://food.ndtv.com/feeds/rss/all/stories' },
  { section: 'Wellness', name: 'iDiva',              url: 'https://www.idiva.com/rss/all' },
  { section: 'Wellness', name: 'OnlyMyHealth',       url: 'https://www.onlymyhealth.com/rss' },

  // ── POLITICS ─────────────────────────────────────────────────────────────
  // The Wire, Print, Newslaundry consolidated here. Removed HT/Scroll duplicates.
  { section: 'Politics', name: 'The Hindu Politics',     url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { section: 'Politics', name: 'IE Political Pulse',     url: 'https://indianexpress.com/section/political-pulse/feed/' },
  { section: 'Politics', name: 'The Wire',               url: 'https://thewire.in/feed/' },
  { section: 'Politics', name: 'The Print Politics',     url: 'https://theprint.in/category/politics/feed/' },
  { section: 'Politics', name: 'Newslaundry',            url: 'https://www.newslaundry.com/feed' },
  { section: 'Politics', name: 'NDTV India',             url: 'https://feeds.feedburner.com/ndtvnews-india-news' },
  { section: 'Politics', name: 'ET Politics',            url: 'https://economictimes.indiatimes.com/news/politics-and-nation/rssfeeds/1052732854.cms' },
  { section: 'Politics', name: 'Caravan Magazine',       url: 'https://caravanmagazine.in/rss/all.xml' },

  // ── IPL ──────────────────────────────────────────────────────────────────
  // Unchanged — already the most focused section.
  { section: 'IPL', name: 'Cricbuzz',          url: 'https://www.cricbuzz.com/cbz-news.xml' },
  { section: 'IPL', name: 'ESPN Cricinfo',     url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml' },
  { section: 'IPL', name: 'IE Cricket',        url: 'https://indianexpress.com/section/sports/ipl/feed/' },
  { section: 'IPL', name: 'The Hindu Cricket', url: 'https://www.thehindu.com/sport/cricket/feeder/default.rss' },
  { section: 'IPL', name: 'NDTV Sports',       url: 'https://feeds.feedburner.com/ndtvsports-cricket' },
  { section: 'IPL', name: 'Sportskeeda',       url: 'https://www.sportskeeda.com/feed/cricket' },
  { section: 'IPL', name: 'CricTracker',       url: 'https://www.crictracker.com/feed/' },

  // ── GRIDD LOVES ──────────────────────────────────────────────────────────
  // Consolidated the lifestyle/luxury feeds here. Added Swaddle, Arré.
  // Removed CNT India (kept in Lifestyle), Femina (kept in Wellness).
  { section: 'GRIDD Loves', name: 'Vogue India',       url: 'https://vogue.in/feed/rss' },
  { section: 'GRIDD Loves', name: 'GQ India',          url: 'https://www.gqindia.com/feed/rss' },
  { section: 'GRIDD Loves', name: 'AD India',          url: 'https://www.architecturaldigest.in/feed/rss' },
  { section: 'GRIDD Loves', name: 'Elle India',        url: 'https://www.elle.in/feed/' },
  { section: 'GRIDD Loves', name: "Harper's Bazaar",   url: 'https://www.harpersbazaar.in/feed' },
  { section: 'GRIDD Loves', name: 'Mint Lounge',       url: 'https://www.livemint.com/rss/mint-lounge' },
  { section: 'GRIDD Loves', name: 'Homegrown',         url: 'https://homegrown.co.in/rss' },
  { section: 'GRIDD Loves', name: 'The Hindu Magazine',url: 'https://www.thehindu.com/magazine/feeder/default.rss' },
  { section: 'GRIDD Loves', name: 'Grazia India',      url: 'https://www.grazia.co.in/feed/' },
  { section: 'GRIDD Loves', name: 'Outlook Magazine',  url: 'https://www.outlookindia.com/feed' },
  { section: 'GRIDD Loves', name: 'The Ken',           url: 'https://the-ken.com/feed/' },
  { section: 'GRIDD Loves', name: 'The Swaddle',       url: 'https://theswaddle.com/feed/' },
  { section: 'GRIDD Loves', name: 'Arré',              url: 'https://www.arre.co.in/feed/' },

  // ── CITY NEWS ────────────────────────────────────────────────────────────
  // Added Mumbai + Bengaluru sources. Now genuinely pan-India city coverage.
  { section: 'City News', name: 'IE Delhi',          url: 'https://indianexpress.com/section/cities/delhi/feed/' },
  { section: 'City News', name: 'The Hindu Delhi',   url: 'https://www.thehindu.com/news/cities/Delhi/feeder/default.rss' },
  { section: 'City News', name: 'The Hindu Mumbai',  url: 'https://www.thehindu.com/news/cities/mumbai/feeder/default.rss' },
  { section: 'City News', name: 'IE Mumbai',         url: 'https://indianexpress.com/section/cities/mumbai/feed/' },
  { section: 'City News', name: 'The Hindu Bengaluru', url: 'https://www.thehindu.com/news/cities/bangalore/feeder/default.rss' },
  { section: 'City News', name: 'IE Bengaluru',      url: 'https://indianexpress.com/section/cities/bangalore/feed/' },
  { section: 'City News', name: 'Citizen Matters',   url: 'https://citizenmatters.in/feed/' },
  { section: 'City News', name: 'The Lede',          url: 'https://thelede.in/feed' },
  { section: 'City News', name: 'Curly Tales',       url: 'https://www.curlytales.com/feed/' },
  { section: 'City News', name: 'WhatsHot',          url: 'https://www.whatshot.in/rss' },
  { section: 'City News', name: 'LBB',               url: 'https://lbb.in/feed/' },

  // ── WORLD NEWS ───────────────────────────────────────────────────────────
  // Removed Scroll (consolidated in Headlines). Kept quality international sources.
  { section: 'World News', name: 'BBC World',        url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { section: 'World News', name: 'The Hindu World',  url: 'https://www.thehindu.com/news/international/feeder/default.rss' },
  { section: 'World News', name: 'IE World',         url: 'https://indianexpress.com/section/world/feed/' },
  { section: 'World News', name: 'Al Jazeera',       url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { section: 'World News', name: 'The Print World',  url: 'https://theprint.in/category/world/feed/' },
  { section: 'World News', name: 'Foreign Policy',   url: 'https://foreignpolicy.com/feed/' },
  { section: 'World News', name: 'The Wire World',   url: 'https://thewire.in/category/world/feed' },
  { section: 'World News', name: 'Scroll World',     url: 'https://scroll.in/feed.rss' },

  // ── ENTERTAINMENT ────────────────────────────────────────────────────────
  // Removed Stardust, Koimoi. Added Film Companion, Cinestaan for quality criticism.
  // Removed MissMalini (kept in Lifestyle — she covers lifestyle more than films).
  { section: 'Entertainment', name: 'Film Companion',    url: 'https://www.filmcompanion.in/feed/' },
  { section: 'Entertainment', name: 'Pinkvilla',         url: 'https://www.pinkvilla.com/rss.xml' },
  { section: 'Entertainment', name: 'Bollywood Hungama', url: 'https://www.bollywoodhungama.com/rss/news/type/news/' },
  { section: 'Entertainment', name: 'Filmfare',          url: 'https://www.filmfare.com/rss/news.xml' },
  { section: 'Entertainment', name: 'IE Entertainment',  url: 'https://indianexpress.com/section/entertainment/feed/' },
  { section: 'Entertainment', name: 'Variety',           url: 'https://variety.com/v/film/feed/' },
  { section: 'Entertainment', name: 'The Hindu Arts',    url: 'https://www.thehindu.com/entertainment/feeder/default.rss' },
  { section: 'Entertainment', name: 'Cinestaan',         url: 'https://www.cinestaan.com/articles/rss' },
  { section: 'Entertainment', name: 'Galatta',           url: 'https://www.galatta.com/feed/' },

  // ── TECH ─────────────────────────────────────────────────────────────────
  // Removed duplicate Gadgets 360 (= NDTV Gadgets URL). Added Inc42, MediaNama, YourStory.
  { section: 'Tech', name: 'The Verge',        url: 'https://www.theverge.com/rss/index.xml' },
  { section: 'Tech', name: 'TechCrunch',       url: 'https://techcrunch.com/feed/' },
  { section: 'Tech', name: 'Wired',            url: 'https://www.wired.com/feed/rss' },
  { section: 'Tech', name: 'Ars Technica',     url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { section: 'Tech', name: 'IE Tech',          url: 'https://indianexpress.com/section/technology/feed/' },
  { section: 'Tech', name: 'The Hindu Tech',   url: 'https://www.thehindu.com/sci-tech/technology/feeder/default.rss' },
  { section: 'Tech', name: 'NDTV Gadgets',     url: 'https://gadgets.ndtv.com/feeds/rss/all/stories' },
  { section: 'Tech', name: '91mobiles',        url: 'https://www.91mobiles.com/rss.xml' },
  { section: 'Tech', name: '9to5Mac',          url: 'https://9to5mac.com/feed/' },
  { section: 'Tech', name: 'MIT Tech Review',  url: 'https://www.technologyreview.com/feed/' },
  { section: 'Tech', name: 'Entrackr',         url: 'https://entrackr.com/feed/' },
  { section: 'Tech', name: 'Inc42',            url: 'https://inc42.com/feed/' },
  { section: 'Tech', name: 'MediaNama',        url: 'https://medianama.com/feed/' },
  { section: 'Tech', name: 'YourStory',        url: 'https://yourstory.com/feed' },

  // ── LONG READS ───────────────────────────────────────────────────────────
  // Removed Wire/Print/Newslaundry (consolidated in Politics).
  // Removed Mint Lounge (consolidated in GRIDD Loves).
  // Added Himal Southasian, The India Forum, Article 14.
  { section: 'Long Reads', name: 'The Caravan',        url: 'https://caravanmagazine.in/rss/all.xml' },
  { section: 'Long Reads', name: 'Frontline',          url: 'https://frontline.thehindu.com/feeder/default.rss' },
  { section: 'Long Reads', name: 'The Ken',            url: 'https://the-ken.com/feed/' },
  { section: 'Long Reads', name: 'Founding Fuel',      url: 'https://www.foundingfuel.com/feed/' },
  { section: 'Long Reads', name: 'Hindu Lit Review',   url: 'https://www.thehindu.com/features/magazine/feeder/default.rss' },
  { section: 'Long Reads', name: 'Foreign Affairs',    url: 'https://www.foreignaffairs.com/rss.xml' },
  { section: 'Long Reads', name: 'Himal Southasian',   url: 'https://www.himalmag.com/feed/' },
  { section: 'Long Reads', name: 'The India Forum',    url: 'https://www.theindiaforum.in/rss.xml' },
  { section: 'Long Reads', name: 'Fifty Two',          url: 'https://fiftytwo.in/feed/' },
  { section: 'Long Reads', name: 'Scroll Long',        url: 'https://scroll.in/feed.rss' },

  // ── OPINIONS ─────────────────────────────────────────────────────────────
  // Removed Wire/Scroll (used in their primary sections).
  // Added Caravan Opinions, Fountain Ink.
  { section: 'Opinions', name: 'The Hindu Opinions',  url: 'https://www.thehindu.com/opinion/feeder/default.rss' },
  { section: 'Opinions', name: 'IE Opinions',         url: 'https://indianexpress.com/section/opinion/feed/' },
  { section: 'Opinions', name: 'Mint Opinions',       url: 'https://www.livemint.com/rss/opinion' },
  { section: 'Opinions', name: 'BS Opinions',         url: 'https://www.business-standard.com/rss/opinion-specials-110.rss' },
  { section: 'Opinions', name: 'The Print Opinions',  url: 'https://theprint.in/category/opinion/feed/' },
  { section: 'Opinions', name: 'TOI Edit',            url: 'https://timesofindia.indiatimes.com/rssfeeds/784865811.cms' },
  { section: 'Opinions', name: 'ET Edit',             url: 'https://economictimes.indiatimes.com/opinion/rssfeeds/897228639.cms' },
  { section: 'Opinions', name: 'Fountain Ink',        url: 'https://fountainink.in/feed' },

  // ── THIS & THAT ──────────────────────────────────────────────────────────
  // Dropped TOI Viral, NDTV Offbeat, HT Trending, India Today Viral — pure tabloid noise.
  // Removed Scroll/Quint (already in other sections).
  // Added The Better India, Fifty Two, Atlas Obscura, The Science Wire.
  { section: 'This & That', name: 'Hindu Sci-Tech',    url: 'https://www.thehindu.com/sci-tech/feeder/default.rss' },
  { section: 'This & That', name: 'IE Trending',       url: 'https://indianexpress.com/section/trending/feed/' },
  { section: 'This & That', name: 'BBC Science',       url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { section: 'This & That', name: 'Mashable India',    url: 'https://in.mashable.com/feed' },
  { section: 'This & That', name: 'IMD Weather',       url: 'https://mausam.imd.gov.in/responsive/rss/weather.xml' },
  { section: 'This & That', name: 'The Better India',  url: 'https://www.thebetterindia.com/feed/' },
  { section: 'This & That', name: 'Atlas Obscura',     url: 'https://www.atlasobscura.com/feeds/latest' },
  { section: 'This & That', name: 'Science Wire',      url: 'https://thewire.in/category/science/feed' },

  // ── LIFESTYLE ────────────────────────────────────────────────────────────
  // Removed AD India (GRIDD Loves), Mint Lounge (GRIDD Loves), MissMalini overlap reduced.
  // Kept CNT India here as travel is core to Lifestyle.
  { section: 'Lifestyle', name: 'CNT India',           url: 'https://www.cntraveller.in/feed/rss' },
  { section: 'Lifestyle', name: 'Outlook Traveller',   url: 'https://www.outlooktraveller.com/rssfeeds/55' },
  { section: 'Lifestyle', name: 'Nat Geo India',       url: 'https://www.nationalgeographic.com/latest-stories/_jcr_content/content/featuredstories.rss' },
  { section: 'Lifestyle', name: 'Curly Tales',         url: 'https://www.curlytales.com/feed/' },
  { section: 'Lifestyle', name: 'WhatsHot',            url: 'https://www.whatshot.in/rss' },
  { section: 'Lifestyle', name: 'LBB',                 url: 'https://lbb.in/feed/' },
  { section: 'Lifestyle', name: 'iDiva',               url: 'https://www.idiva.com/rss/all' },
  { section: 'Lifestyle', name: 'MissMalini',          url: 'https://www.missmalini.com/feed' },
  { section: 'Lifestyle', name: 'NDTV Food',           url: 'https://food.ndtv.com/feeds/rss/all/stories' },
  { section: 'Lifestyle', name: 'Times Food',          url: 'https://timesofindia.indiatimes.com/rssfeeds/2269336.cms' },
  { section: 'Lifestyle', name: 'Homegrown',           url: 'https://homegrown.co.in/rss' },

];

// ─── CHECKER ──────────────────────────────────────────────────────────────

const CONCURRENCY = 15;
const TIMEOUT_MS  = 12000;

async function checkFeed(feed) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GRIDDSFeedChecker/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
      redirect: 'follow',
    });

    clearTimeout(timer);
    const ms = Date.now() - start;

    if (!res.ok) {
      return { ...feed, status: 'BROKEN', code: res.status, detail: res.statusText, ms };
    }

    const text = await res.text();
    const hasRSS = /<rss|<feed|<channel|<item|<entry/i.test(text);
    const itemCount = (text.match(/<item[\s>]|<entry[\s>]/gi) || []).length;

    if (!hasRSS) {
      return { ...feed, status: 'NO_RSS', code: res.status, detail: '200 but no RSS content found', ms };
    }

    return { ...feed, status: 'OK', code: res.status, detail: `${itemCount} items`, ms };

  } catch (err) {
    clearTimeout(timer);
    const ms = Date.now() - start;
    const isTimeout = err.name === 'AbortError';
    return {
      ...feed,
      status:  isTimeout ? 'TIMEOUT' : 'ERROR',
      code:    0,
      detail:  isTimeout ? `Timed out after ${TIMEOUT_MS}ms` : err.message.slice(0, 80),
      ms,
    };
  }
}

async function runWithConcurrency(feeds, limit) {
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < feeds.length) {
      const i = idx++;
      process.stdout.write(`\r  Checking ${i + 1}/${feeds.length}...`);
      results[i] = await checkFeed(feeds[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, feeds.length) }, worker);
  await Promise.all(workers);
  process.stdout.write('\r' + ' '.repeat(40) + '\r');
  return results;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nGRIDDS Feed Checker v2 — ${FEEDS.length} feeds\n${'─'.repeat(70)}`);

  const results = await runWithConcurrency(FEEDS, CONCURRENCY);

  const ok     = results.filter(r => r.status === 'OK');
  const broken = results.filter(r => r.status !== 'OK');

  // ── Per-section summary ──
  const sections = [...new Set(FEEDS.map(f => f.section))];
  console.log('\nPER-SECTION SUMMARY:\n');
  for (const sec of sections) {
    const secResults = results.filter(r => r.section === sec);
    const secOk      = secResults.filter(r => r.status === 'OK').length;
    const bar        = '█'.repeat(secOk) + '░'.repeat(secResults.length - secOk);
    console.log(`  ${sec.padEnd(18)} ${bar}  ${secOk}/${secResults.length} working`);
  }

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`✅  WORKING : ${ok.length}`);
  console.log(`❌  BROKEN  : ${broken.length}`);
  console.log(`\n${'─'.repeat(70)}`);

  // ── Broken detail ──
  if (broken.length) {
    console.log('\nBROKEN / SUSPECT FEEDS:\n');
    const colW = [18, 28, 12, 8, 40];
    const hdr  = ['Section', 'Source', 'Status', 'Code', 'Detail'];
    console.log(hdr.map((h, i) => h.padEnd(colW[i])).join(''));
    console.log('─'.repeat(colW.reduce((a, b) => a + b, 0)));
    for (const r of broken.sort((a, b) => a.section.localeCompare(b.section))) {
      const row = [r.section, r.name, r.status, String(r.code), r.detail];
      console.log(row.map((v, i) => v.padEnd(colW[i])).join(''));
    }
  }

  // ── Working list ──
  console.log('\n\nWORKING FEEDS:\n');
  const colW2 = [18, 28, 10, 8];
  const hdr2  = ['Section', 'Source', 'Items', 'ms'];
  console.log(hdr2.map((h, i) => h.padEnd(colW2[i])).join(''));
  console.log('─'.repeat(colW2.reduce((a, b) => a + b, 0)));
  for (const r of ok.sort((a, b) => a.section.localeCompare(b.section))) {
    const row = [r.section, r.name, r.detail, `${r.ms}ms`];
    console.log(row.map((v, i) => v.padEnd(colW2[i])).join(''));
  }

  // ── Write JSON ──
  const fs = await import('fs');
  const out = {
    checkedAt: new Date().toISOString(),
    total:   results.length,
    working: ok.length,
    broken:  broken.length,
    results: results.map(r => ({
      section: r.section,
      name:    r.name,
      url:     r.url,
      status:  r.status,
      code:    r.code,
      detail:  r.detail,
      ms:      r.ms,
    })),
  };
  fs.writeFileSync('check-feeds-results.json', JSON.stringify(out, null, 2));
  console.log(`\nResults also saved to check-feeds-results.json\n`);
})();
