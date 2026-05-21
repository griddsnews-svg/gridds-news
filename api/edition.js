// ─────────────────────────────────────────────────────────────────────────
// GRIDDS.NEWS — Edition API v2
// Fetches all section tabs from the Editorial Master sheet,
// filters LIVE stories, returns clean JSON for the GRIDDS app.
// Cache: 30 seconds
// ─────────────────────────────────────────────────────────────────────────

const SHEET_ID = '1c91ctKwDGJUkWnicAycilNyg_B0-lCqj1zrSYNhe2Zo';

// Section key → Sheet tab name → display label & colour
// Tab names must match exactly what's in your Google Sheet
const SECTIONS = [
  { key: 'headlines',     tab: 'Headlines',     label: 'Headlines',      color: '#E8520A' },
  { key: 'finance',       tab: 'Finance',       label: 'Finance',        color: '#1B5E20' },
  { key: 'wellness',      tab: 'Wellness',      label: 'Wellness',       color: '#6A1B9A' },
  { key: 'politics',      tab: 'Politics',      label: 'Politics',       color: '#8B1538' },
  { key: 'ipl',           tab: 'IPL',           label: 'IPL 2026',       color: '#FFA000' },
  { key: 'loves',         tab: 'GRIDD Loves',   label: '✶ GRIDD Loves',  color: '#7B5EA7' },
  { key: 'cityNews',      tab: 'City News',     label: 'City News',      color: '#37474F' },
  { key: 'worldNews',     tab: 'World News',    label: 'World News',     color: '#1565C0' },
  { key: 'entertainment', tab: 'Entertainment', label: 'Entertainment',  color: '#C2185B' },
  { key: 'tech',          tab: 'Tech',          label: 'Tech',           color: '#1976D2' },
  { key: 'longreads',     tab: 'Long Reads',    label: 'Long Reads',     color: '#5D4037' },
  { key: 'opinions',      tab: 'Opinions',      label: 'Opinions',       color: '#455A64' },
  { key: 'thisAndThat',   tab: 'This & That',   label: 'This & That',    color: '#00695C' },
  { key: 'lifestyle',     tab: 'Lifestyle',     label: 'Lifestyle',      color: '#006064' },
];

const COL = { ID: 0, HEADLINE: 1, SUMMARY: 2, SOURCE: 3, URL: 4, IMAGE: 5, ORDER: 6, STATUS: 7, PUBLISHED_AT: 8 };

function wrapImageForProxy(rawUrl) {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/img') || trimmed.startsWith('data:')) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  return '/api/img?url=' + encodeURIComponent(trimmed);
}

async function fetchTab(tabName) {
  // &t= busts Google's server-side cache so edits show up immediately
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}&t=${Date.now()}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (GRIDDS.NEWS)' },
    });
    if (!res.ok) {
      console.warn(`Tab "${tabName}" returned status ${res.status}`);
      return [];
    }
    const text = await res.text();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return [];

    const data = JSON.parse(text.slice(start, end + 1));
    if (!data.table || !data.table.rows) return [];

    const stories = [];
    data.table.rows.forEach((row) => {
      if (!row.c) return;
      const cells = row.c.map(c => (c && c.v !== null && c.v !== undefined) ? String(c.v).trim() : '');

      const headline = cells[COL.HEADLINE];
      const status   = (cells[COL.STATUS] || '').toUpperCase();

      if (!headline) return;
      if (status !== 'LIVE') return;
      if (headline.startsWith('[')) return;

      stories.push({
        id:      cells[COL.ID]      || '',
        h:       headline,
        summary: cells[COL.SUMMARY] || '',
        source:  cells[COL.SOURCE]  || '',
        url:     cells[COL.URL]     || '',
        image:   wrapImageForProxy(cells[COL.IMAGE] || ''),
        order:   parseInt(cells[COL.ORDER]) || 999,
      });
    });

    stories.sort((a, b) => a.order - b.order);
    return stories;
  } catch (err) {
    console.error(`Error fetching tab "${tabName}":`, err.message);
    return [];
  }
}

async function fetchControl() {
  // &t= busts Google's server-side cache
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('Edition Control')}&t=${Date.now()}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (GRIDDS.NEWS)' } });
    if (!res.ok) return null;
    const text = await res.text();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const data = JSON.parse(text.slice(start, end + 1));
    if (!data.table || !data.table.rows) return null;

    const ctrl = {};
    data.table.rows.forEach(row => {
      if (!row.c || row.c.length < 2) return;
      const label = row.c[0] && row.c[0].v ? String(row.c[0].v).trim() : '';
      const value = row.c[1] && row.c[1].v !== null && row.c[1].v !== undefined ? row.c[1].v : '';
      if (label) ctrl[label] = value;
    });
    return ctrl;
  } catch (err) {
    return null;
  }
}

export default async function handler(req, res) {
  // 30s CDN cache, no stale serving
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  try {
    const [sectionsData, control] = await Promise.all([
      Promise.all(SECTIONS.map(s => fetchTab(s.tab))),
      fetchControl(),
    ]);

    const edition = {
      meta: {
        editionNumber: control ? (control['Edition Number'] || 1) : 1,
        editionDate:   control ? (control['Edition Date'] || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
        editionTitle:  control ? (control['Edition Title (optional)'] || '') : '',
        editor:        control ? (control['Editor'] || 'GRIDDS Editor') : 'GRIDDS Editor',
        published:     control ? (String(control['PUBLISHED'] || 'YES').toUpperCase() === 'YES') : true,
        generatedAt:   new Date().toISOString(),
      },
      sections: {},
    };

    SECTIONS.forEach((s, i) => {
      edition.sections[s.key] = {
        label:   s.label,
        color:   s.color,
        stories: sectionsData[i],
      };
    });

    if (!edition.meta.published) {
      return res.status(200).json({
        meta: edition.meta,
        sections: {},
        message: "Today's edition is being prepared.",
      });
    }

    return res.status(200).json(edition);
  } catch (err) {
    console.error('Edition API error:', err);
    return res.status(500).json({ error: 'Failed to build edition', detail: err.message });
  }
}
