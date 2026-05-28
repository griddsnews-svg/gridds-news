// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Edition API   /api/edition  (v2)
// Added: source_published_at in story output (issue #2)
// ═══════════════════════════════════════════════════════════════════════════
 
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
 
const DB_TO_APP_KEY = {
  'headlines':     'headlines',
  'finance':       'finance',
  'wellness':      'wellness',
  'politics':      'politics',
  'ipl':           'ipl',
  'griddloves':    'loves',
  'citynews':      'cityNews',
  'worldnews':     'worldNews',
  'entertainment': 'entertainment',
  'tech':          'tech',
  'opinions':      'opinions',
  'longreads':     'longreads',
  'thisandthat':   'thisAndThat',
  'lifestyle':     'lifestyle',
};
 
const SECTION_META = {
  headlines:     { label: 'Headlines',     color: '#E8520A' },
  finance:       { label: 'Finance',       color: '#1B5E20' },
  wellness:      { label: 'Wellness',      color: '#6A1B9A' },
  politics:      { label: 'Politics',      color: '#8B1538' },
  ipl:           { label: 'IPL 2026',      color: '#FFA000' },
  loves:         { label: '✶ GRIDD Loves', color: '#7B5EA7' },
  cityNews:      { label: 'City News',     color: '#37474F' },
  worldNews:     { label: 'World News',    color: '#1565C0' },
  entertainment: { label: 'Entertainment', color: '#C2185B' },
  tech:          { label: 'Tech',          color: '#1976D2' },
  longreads:     { label: 'Long Reads',    color: '#5D4037' },
  opinions:      { label: 'Opinions',      color: '#455A64' },
  thisAndThat:   { label: 'This & That',   color: '#00695C' },
  lifestyle:     { label: 'Lifestyle',     color: '#006064' },
};
 
export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return res.status(500).json({ error: 'Supabase env vars not set' });
  }
 
  const url = `${SUPABASE_URL}/rest/v1/stories`
    + `?status=eq.LIVE`
    + `&select=section_id,headline,summary,source,url,image,sort_order,source_published_at`
    + `&order=section_id.asc,sort_order.asc`;
 
  try {
    const resp = await fetch(url, {
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
      },
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(502).json({ error: 'Supabase read failed', detail: txt.slice(0, 200) });
    }
    const rows = await resp.json();
 
    const sections = {};
    Object.keys(SECTION_META).forEach(appKey => {
      sections[appKey] = {
        label:   SECTION_META[appKey].label,
        color:   SECTION_META[appKey].color,
        stories: [],
      };
    });
 
    for (const r of rows) {
      const appKey = DB_TO_APP_KEY[r.section_id];
      if (!appKey || !sections[appKey]) continue;
      sections[appKey].stories.push({
        h:       r.headline,
        summary: r.summary || '',
        source:  r.source || '',
        url:     r.url || '',
        image:   r.image || '',
        section: appKey,
        publishedAt: r.source_published_at || '',   // NEW (issue #2)
      });
    }
 
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      meta:     { editionDate: new Date().toISOString() },
      sections: sections,
    });
 
  } catch (err) {
    return res.status(500).json({ error: 'Edition fetch failed', detail: err.message });
  }
}
 
export const config = { maxDuration: 10 };
 
