// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Public Stories API   /api/stories
//
// Returns LIVE stories grouped by section, for the public app (index.html).
// Read-only, uses the anon key, only ever returns status = LIVE.
//
// Optional query params:
//   ?section=finance   → only that section
//   ?limit=10          → max stories per section (default 12)
//
// Cached at the edge for 60s so it survives traffic spikes.
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return res.status(500).json({ error: 'Supabase env vars not set' });
  }

  const section = req.query.section || null;
  const limit   = Math.min(parseInt(req.query.limit) || 12, 50);

  // Build PostgREST query — only LIVE stories, ordered by sort_order
  let url = `${SUPABASE_URL}/rest/v1/stories`
    + `?status=eq.LIVE`
    + `&select=id,section_id,headline,summary,source,url,image,published_at,sort_order`
    + `&order=section_id.asc,sort_order.asc`;

  if (section) url += `&section_id=eq.${encodeURIComponent(section)}`;

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

    // Group by section, cap each section to `limit`
    const bySection = {};
    for (const r of rows) {
      const arr = bySection[r.section_id] = bySection[r.section_id] || [];
      if (arr.length < limit) arr.push(r);
    }

    // Edge cache 60s + stale-while-revalidate
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ ok: true, sections: bySection, count: rows.length });

  } catch (err) {
    return res.status(500).json({ error: 'Fetch failed', detail: err.message });
  }
}

export const config = { maxDuration: 10 };
