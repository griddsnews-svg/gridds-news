// ─────────────────────────────────────────────────────────────────────────
// GRIDDS.NEWS — Feed Checker
// Run: node check-feeds.js
// Requires Node 18+ (native fetch). No npm install needed.
// Output: console table + writes results to check-feeds-results.json
// ─────────────────────────────────────────────────────────────────────────
 
const FEEDS = [
  // HEADLINES
  { section: 'Headlines', name: 'NDTV', url: 'https://feeds.feedburner.com/ndtvnews-top-stories' },
  { section: 'Headlines', name: 'The Hindu', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { section: 'Headlines', name: 'Indian Express', url: 'https://indianexpress.com/section/india/feed/' },
  { section: 'Headlines', name: 'Hindustan Times', url: 'https://www.hindustantimes.com/feeds/rss/india-news/index.xml' },
  { section: 'Headlines', name: 'India Today', url: 'https://www.indiatoday.in/rss/1206578' },
  { section: 'Headlines', name: 'The Wire', url: 'https://thewire.in/feed/' },
  { section: 'Headlines', name: 'Scroll.in', url: 'https://scroll.in/feed.rss' },
  { section: 'Headlines', name: 'The Print', url: 'https://theprint.in/feed/' },
  { section: 'Headlines', name: 'Firstpost', url: 'https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml' },
  { section: 'Headlines', name: 'News18', url: 'https://www.news18.com/rss/india.xml' },
  { section: 'Headlines', name: 'Times of India', url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms' },
  { section: 'Headlines', name: 'Business Standard', url: 'https://www.business-standard.com/rss/latest.rss' },
  { section: 'Headlines', name: 'Mint', url: 'https://www.livemint.com/rss/news' },
  { section: 'Headlines', name: 'The Quint', url: 'https://www.thequint.com/feed.rss' },
  { section: 'Headlines', name: 'Newslaundry', url: 'https://www.newslaundry.com/feed' },
 
  // FINANCE
  { section: 'Finance', name: 'Mint Economy', url: 'https://www.livemint.com/rss/economy' },
  { section: 'Finance', name: 'Mint Money', url: 'https://www.livemint.com/rss/money' },
  { section: 'Finance', name: 'Economic Times', url: 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms' },
  { section: 'Finance', name: 'The Hindu BusinessLine', url: 'https://www.thehindubusinessline.com/economy/feeder/default.rss' },
  { section: 'Finance', name: 'Business Standard', url: 'https://www.business-standard.com/rss/economy-policy-106.rss' },
  { section: 'Finance', name: 'Moneycontrol', url: 'https://www.moneycontrol.com/rss/business.xml' },
  { section: 'Finance', name: 'Financial Express', url: 'https://www.financialexpress.com/economy/feed/' },
  { section: 'Finance', name: 'NDTV Profit', url: 'https://feeds.feedburner.com/ndtv/BusinessNews' },
 
  // WELLNESS
  { section: 'Wellness', name: 'Indian Express Health', url: 'https://indianexpress.com/section/health-wellness/feed/' },
  { section: 'Wellness', name: 'The Hindu Health', url: 'https://www.thehindu.com/sci-tech/health/feeder/default.rss' },
  { section: 'Wellness', name: 'Health Shots', url: 'https://www.healthshots.com/feed/' },
  { section: 'Wellness', name: 'Mint Lounge Health', url: 'https://www.livemint.com/rss/mint-lounge/health' },
  { section: 'Wellness', name: 'Vogue India', url: 'https://vogue.in/feed/rss' },
  { section: 'Wellness', name: 'Hindustan Times Health', url: 'https://www.hindustantimes.com/feeds/rss/lifestyle/health/rssfeed.xml' },
  { section: 'Wellness', name: 'NDTV Food', url: 'https://food.ndtv.com/feeds/rss/all/stories' },
  { section: 'Wellness', name: 'Femina', url: 'https://www.femina.in/rss.cms' },
  { section: 'Wellness', name: 'iDiva', url: 'https://www.idiva.com/rss/all' },
 
  // POLITICS
  { section: 'Politics', name: 'The Hindu Politics', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { section: 'Politics', name: 'Indian Express Political Pulse', url: 'https://indianexpress.com/section/political-pulse/feed/' },
  { section: 'Politics', name: 'The Wire', url: 'https://thewire.in/feed/' },
  { section: 'Politics', name: 'The Print Politics', url: 'https://theprint.in/category/politics/feed/' },
  { section: 'Politics', name: 'Hindustan Times Politics', url: 'https://www.hindustantimes.com/feeds/rss/india-news/index.xml' },
  { section: 'Politics', name: 'Scroll', url: 'https://scroll.in/feed.rss' },
  { section: 'Politics', name: 'NDTV India', url: 'https://feeds.feedburner.com/ndtvnews-india-news' },
  { section: 'Politics', name: 'Newslaundry', url: 'https://www.newslaundry.com/feed' },
  { section: 'Politics', name: 'The Quint', url: 'https://www.thequint.com/feed.rss' },
  { section: 'Politics', name: 'Economic Times Politics', url: 'https://economictimes.indiatimes.com/news/politics-and-nation/rssfeeds/1052732854.cms' },
 
  // IPL
  { section: 'IPL', name: 'Cricbuzz', url: 'https://www.cricbuzz.com/cbz-news.xml' },
  { section: 'IPL', name: 'ESPN Cricinfo', url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml' },
  { section: 'IPL', name: 'Hindustan Times Cricket', url: 'https://www.hindustantimes.com/feeds/rss/sports/cricket/index.xml' },
  { section: 'IPL', name: 'Indian Express Cricket', url: 'https://indianexpress.com/section/sports/ipl/feed/' },
  { section: 'IPL', name: 'The Hindu Cricket', url: 'https://www.thehindu.com/sport/cricket/feeder/default.rss' },
  { section: 'IPL', name: 'NDTV Sports Cricket', url: 'https://feeds.feedburner.com/ndtvsports-cricket' },
  { section: 'IPL', name: 'Times of India Cricket', url: 'https://timesofindia.indiatimes.com/rssfeeds/4719161.cms' },
  { section: 'IPL', name: 'Sportskeeda Cricket', url: 'https://www.sportskeeda.com/feed/cricket' },
  { section: 'IPL', name: 'CricTracker', url: 'https://www.crictracker.com/feed/' },
 
  // GRIDD LOVES
  { section: 'GRIDD Loves', name: 'Vogue India', url: 'https://vogue.in/feed/rss' },
  { section: 'GRIDD Loves', name: 'GQ India', url: 'https://www.gqindia.com/feed/rss' },
  { section: 'GRIDD Loves', name: 'Architectural Digest India', url: 'https://www.architecturaldigest.in/feed/rss' },
  { section: 'GRIDD Loves', name: 'Condé Nast Traveller India', url: 'https://www.cntraveller.in/feed/rss' },
  { section: 'GRIDD Loves', name: 'Elle India', url: 'https://www.elle.in/feed/' },
  { section: 'GRIDD Loves', name: "Harper's Bazaar India", url: 'https://www.harpersbazaar.in/feed' },
  { section: 'GRIDD Loves', name: 'Mint Lounge', url: 'https://www.livemint.com/rss/mint-lounge' },
  { section: 'GRIDD Loves', name: 'Homegrown', url: 'https://homegrown.co.in/rss' },
  { section: 'GRIDD Loves', name: 'The Hindu Magazine', url: 'https://www.thehindu.com/magazine/feeder/default.rss' },
  { section: 'GRIDD Loves', name: 'Grazia India', url: 'https://www.grazia.co.in/feed/' },
  { section: 'GRIDD Loves', name: 'Femina', url: 'https://www.femina.in/rss.cms' },
  { section: 'GRIDD Loves', name: 'HT Brunch', url: 'https://www.hindustantimes.com/feeds/rss/htbrunch/rssfeed.xml' },
  { section: 'GRIDD Loves', name: 'Outlook Magazine', url: 'https://www.outlookindia.com/feed' },
  { section: 'GRIDD Loves', name: 'The Ken', url: 'https://the-ken.com/feed/' },
 
  // CITY NEWS
  { section: 'City News', name: 'Hindustan Times Delhi', url: 'https://www.hindustantimes.com/feeds/rss/cities/delhi-news/rssfeed.xml' },
  { section: 'City News', name: 'Indian Express Delhi', url: 'https://indianexpress.com/section/cities/delhi/feed/' },
  { section: 'City News', name: 'Times of India Delhi', url: 'https://timesofindia.indiatimes.com/rssfeeds/-2128839596.cms' },
  { section: 'City News', name: 'The Hindu Delhi', url: 'https://www.thehindu.com/news/cities/Delhi/feeder/default.rss' },
  { section: 'City News', name: 'Curly Tales Delhi', url: 'https://www.curlytales.com/feed/' },
  { section: 'City News', name: 'WhatsHot Delhi', url: 'https://www.whatshot.in/rss' },
  { section: 'City News', name: 'LBB Delhi', url: 'https://lbb.in/feed/' },
  { section: 'City News', name: 'NDTV Delhi', url: 'https://feeds.feedburner.com/ndtvnews-delhi-news' },
 
  // WORLD NEWS
  { section: 'World News', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { section: 'World News', name: 'The Hindu World', url: 'https://www.thehindu.com/news/international/feeder/default.rss' },
  { section: 'World News', name: 'Indian Express World', url: 'https://indianexpress.com/section/world/feed/' },
  { section: 'World News', name: 'NDTV World', url: 'https://feeds.feedburner.com/ndtvnews-world-news' },
  { section: 'World News', name: 'Hindustan Times World', url: 'https://www.hindustantimes.com/feeds/rss/world-news/index.xml' },
  { section: 'World News', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { section: 'World News', name: 'The Print World', url: 'https://theprint.in/category/world/feed/' },
  { section: 'World News', name: 'Scroll World', url: 'https://scroll.in/feed.rss' },
  { section: 'World News', name: 'Foreign Policy', url: 'https://foreignpolicy.com/feed/' },
 
  // ENTERTAINMENT
  { section: 'Entertainment', name: 'Pinkvilla', url: 'https://www.pinkvilla.com/rss.xml' },
  { section: 'Entertainment', name: 'Bollywood Hungama', url: 'https://www.bollywoodhungama.com/rss/news/type/news/' },
  { section: 'Entertainment', name: 'Filmfare', url: 'https://www.filmfare.com/rss/news.xml' },
  { section: 'Entertainment', name: 'Indian Express Entertainment', url: 'https://indianexpress.com/section/entertainment/feed/' },
  { section: 'Entertainment', name: 'Hindustan Times Entertainment', url: 'https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml' },
  { section: 'Entertainment', name: 'NDTV Movies', url: 'https://feeds.feedburner.com/ndtv/entertainment' },
  { section: 'Entertainment', name: 'Stardust', url: 'https://www.stardust.com/feed/' },
  { section: 'Entertainment', name: 'Variety', url: 'https://variety.com/v/film/feed/' },
  { section: 'Entertainment', name: 'Scroll Culture', url: 'https://scroll.in/feed.rss' },
  { section: 'Entertainment', name: 'The Hindu Arts', url: 'https://www.thehindu.com/entertainment/feeder/default.rss' },
  { section: 'Entertainment', name: 'MissMalini', url: 'https://www.missmalini.com/feed' },
  { section: 'Entertainment', name: 'Koimoi', url: 'https://www.koimoi.com/feed/' },
 
  // TECH
  { section: 'Tech', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { section: 'Tech', name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { section: 'Tech', name: 'Wired', url: 'https://www.wired.com/feed/rss' },
  { section: 'Tech', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { section: 'Tech', name: 'Indian Express Tech', url: 'https://indianexpress.com/section/technology/feed/' },
  { section: 'Tech', name: 'The Hindu Tech', url: 'https://www.thehindu.com/sci-tech/technology/feeder/default.rss' },
  { section: 'Tech', name: 'NDTV Gadgets', url: 'https://gadgets.ndtv.com/feeds/rss/all/stories' },
  { section: 'Tech', name: '91mobiles', url: 'https://www.91mobiles.com/rss.xml' },
  { section: 'Tech', name: 'Gadgets 360', url: 'https://gadgets.ndtv.com/feeds/rss/all/stories' },
  { section: 'Tech', name: '9to5Mac', url: 'https://9to5mac.com/feed/' },
  { section: 'Tech', name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
  { section: 'Tech', name: 'Entrackr', url: 'https://entrackr.com/feed/' },
 
  // LONG READS
  { section: 'Long Reads', name: 'The Caravan', url: 'https://caravanmagazine.in/rss/all.xml' },
  { section: 'Long Reads', name: 'Scroll', url: 'https://scroll.in/feed.rss' },
  { section: 'Long Reads', name: 'The Wire', url: 'https://thewire.in/feed/' },
  { section: 'Long Reads', name: 'The Hindu Literary Review', url: 'https://www.thehindu.com/features/magazine/feeder/default.rss' },
  { section: 'Long Reads', name: 'Frontline', url: 'https://frontline.thehindu.com/feeder/default.rss' },
  { section: 'Long Reads', name: 'The Ken', url: 'https://the-ken.com/feed/' },
  { section: 'Long Reads', name: 'Founding Fuel', url: 'https://www.foundingfuel.com/feed/' },
  { section: 'Long Reads', name: 'Newslaundry', url: 'https://www.newslaundry.com/feed' },
  { section: 'Long Reads', name: 'The Print', url: 'https://theprint.in/feed/' },
  { section: 'Long Reads', name: 'Foreign Affairs', url: 'https://www.foreignaffairs.com/rss.xml' },
  { section: 'Long Reads', name: 'Mint Lounge Weekend', url: 'https://www.livemint.com/rss/mint-lounge' },
 
  // OPINIONS
  { section: 'Opinions', name: 'The Hindu Opinions', url: 'https://www.thehindu.com/opinion/feeder/default.rss' },
  { section: 'Opinions', name: 'Indian Express Opinions', url: 'https://indianexpress.com/section/opinion/feed/' },
  { section: 'Opinions', name: 'Hindustan Times Opinions', url: 'https://www.hindustantimes.com/feeds/rss/opinion/rssfeed.xml' },
  { section: 'Opinions', name: 'Mint Opinions', url: 'https://www.livemint.com/rss/opinion' },
  { section: 'Opinions', name: 'Business Standard Opinions', url: 'https://www.business-standard.com/rss/opinion-specials-110.rss' },
  { section: 'Opinions', name: 'The Wire Opinions', url: 'https://thewire.in/feed/' },
  { section: 'Opinions', name: 'Scroll Opinions', url: 'https://scroll.in/feed.rss' },
  { section: 'Opinions', name: 'The Print Opinions', url: 'https://theprint.in/category/opinion/feed/' },
  { section: 'Opinions', name: 'Times of India Edit', url: 'https://timesofindia.indiatimes.com/rssfeeds/784865811.cms' },
  { section: 'Opinions', name: 'Economic Times Edit', url: 'https://economictimes.indiatimes.com/opinion/rssfeeds/897228639.cms' },
  { section: 'Opinions', name: 'Hindustan Times Analysis', url: 'https://www.hindustantimes.com/feeds/rss/analysis/rssfeed.xml' },
 
  // THIS & THAT
  { section: 'This & That', name: 'The Hindu Sci-Tech', url: 'https://www.thehindu.com/sci-tech/feeder/default.rss' },
  { section: 'This & That', name: 'Indian Express Trending', url: 'https://indianexpress.com/section/trending/feed/' },
  { section: 'This & That', name: 'NDTV Offbeat', url: 'https://feeds.feedburner.com/ndtvnews-offbeat' },
  { section: 'This & That', name: 'Times of India Viral', url: 'https://timesofindia.indiatimes.com/rssfeeds/7098549.cms' },
  { section: 'This & That', name: 'Hindustan Times Trending', url: 'https://www.hindustantimes.com/feeds/rss/trending/rssfeed.xml' },
  { section: 'This & That', name: 'Scroll', url: 'https://scroll.in/feed.rss' },
  { section: 'This & That', name: 'The Quint', url: 'https://www.thequint.com/feed.rss' },
  { section: 'This & That', name: 'India Today Viral', url: 'https://www.indiatoday.in/rss/1206602' },
  { section: 'This & That', name: 'IMD Weather', url: 'https://mausam.imd.gov.in/responsive/rss/weather.xml' },
  { section: 'This & That', name: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { section: 'This & That', name: 'Mashable India', url: 'https://in.mashable.com/feed' },
 
  // LIFESTYLE
  { section: 'Lifestyle', name: 'Condé Nast Traveller India', url: 'https://www.cntraveller.in/feed/rss' },
  { section: 'Lifestyle', name: 'Outlook Traveller', url: 'https://www.outlooktraveller.com/rssfeeds/55' },
  { section: 'Lifestyle', name: 'National Geographic India', url: 'https://www.nationalgeographic.com/latest-stories/_jcr_content/content/featuredstories.rss' },
  { section: 'Lifestyle', name: 'Mint Lounge', url: 'https://www.livemint.com/rss/mint-lounge' },
  { section: 'Lifestyle', name: 'Curly Tales', url: 'https://www.curlytales.com/feed/' },
  { section: 'Lifestyle', name: 'WhatsHot', url: 'https://www.whatshot.in/rss' },
  { section: 'Lifestyle', name: 'LBB', url: 'https://lbb.in/feed/' },
  { section: 'Lifestyle', name: 'Femina', url: 'https://www.femina.in/rss.cms' },
  { section: 'Lifestyle', name: 'iDiva', url: 'https://www.idiva.com/rss/all' },
  { section: 'Lifestyle', name: 'MissMalini', url: 'https://www.missmalini.com/feed' },
  { section: 'Lifestyle', name: 'Architectural Digest India', url: 'https://www.architecturaldigest.in/feed/rss' },
  { section: 'Lifestyle', name: 'NDTV Food', url: 'https://food.ndtv.com/feeds/rss/all/stories' },
  { section: 'Lifestyle', name: 'Times Food', url: 'https://timesofindia.indiatimes.com/rssfeeds/2269336.cms' },
  { section: 'Lifestyle', name: 'Homegrown', url: 'https://homegrown.co.in/rss' },
  { section: 'Lifestyle', name: 'HT Brunch', url: 'https://www.hindustantimes.com/feeds/rss/htbrunch/rssfeed.xml' },
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
      status: isTimeout ? 'TIMEOUT' : 'ERROR',
      code: 0,
      detail: isTimeout ? `Timed out after ${TIMEOUT_MS}ms` : err.message.slice(0, 80),
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
  console.log(`\nGRIDDS Feed Checker — ${FEEDS.length} feeds\n${'─'.repeat(70)}`);
 
  const results = await runWithConcurrency(FEEDS, CONCURRENCY);
 
  const ok      = results.filter(r => r.status === 'OK');
  const broken  = results.filter(r => r.status !== 'OK');
 
  // ── Summary ──
  console.log(`\n✅  WORKING : ${ok.length}`);
  console.log(`❌  BROKEN  : ${broken.length}`);
  console.log(`\n${'─'.repeat(70)}`);
 
  // ── Broken detail ──
  if (broken.length) {
    console.log('\nBROKEN / SUSPECT FEEDS:\n');
    const colW = [18, 32, 12, 8, 40];
    const hdr = ['Section', 'Source', 'Status', 'Code', 'Detail'];
    console.log(hdr.map((h, i) => h.padEnd(colW[i])).join(''));
    console.log('─'.repeat(colW.reduce((a, b) => a + b, 0)));
    for (const r of broken.sort((a, b) => a.section.localeCompare(b.section))) {
      const row = [r.section, r.name, r.status, String(r.code), r.detail];
      console.log(row.map((v, i) => v.padEnd(colW[i])).join(''));
    }
  }
 
  // ── Working list ──
  console.log('\n\nWORKING FEEDS:\n');
  const colW2 = [18, 32, 8, 8];
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
    total: results.length,
    working: ok.length,
    broken: broken.length,
    results: results.map(r => ({
      section: r.section,
      name: r.name,
      url: r.url,
      status: r.status,
      code: r.code,
      detail: r.detail,
      ms: r.ms,
    })),
  };
  fs.writeFileSync('check-feeds-results.json', JSON.stringify(out, null, 2));
  console.log(`\n\nResults also saved to check-feeds-results.json\n`);
})();
 
