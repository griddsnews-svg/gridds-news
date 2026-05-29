
// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Ads API   /api/ads
// Returns active, in-window ads for the public app. Read-only, anon key.
// RLS (ads_public_read) already restricts anon to active ads inside their
// date window, so this endpoint just shapes + caches the result.
// ═══════════════════════════════════════════════════════════════════════════
 
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
 
export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return res.status(500).json({ error: 'Supabase env vars not set' });
  }
 
  const url = `${SUPABASE_URL}/rest/v1/ads`
    + `?select=id,brand,headline,copy,cta_label,click_url,image_url,image_path,format,section_id,weight,theme`
    + `&order=weight.desc,created_at.desc`;
 
  try {
    const resp = await fetch(url, {
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(502).json({ error: 'Supabase read failed', detail: txt.slice(0, 200) });
    }
    const rows = await resp.json();
 
    const ads = rows.map(function (a) {
      // Prefer an advertiser-hosted URL; otherwise build the public Storage URL.
      let img = a.image_url || '';
      if (!img && a.image_path) {
        img = `${SUPABASE_URL}/storage/v1/object/public/ad-creatives/${a.image_path}`;
      }
      return {
        id:      a.id,
        brand:   a.brand   || '',
        headline:a.headline|| '',
        copy:    a.copy    || '',
        cta:     a.cta_label || 'Learn More',
        url:     a.click_url || '#',
        image:   img,
        format:  a.format  || 'interstitial',
        section: a.section_id || null,   // null = all sections
        weight:  a.weight  || 1,
        theme:   a.theme   || null,
      };
    });
 
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ ok: true, ads });
 
  } catch (err) {
    return res.status(500).json({ error: 'Ads fetch failed', detail: err.message });
  }
}
 
export const config = { maxDuration: 10 };
