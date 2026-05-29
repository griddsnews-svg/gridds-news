
// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Story share page   /s/<id>  →  /api/s?id=<id>
//
// Server-rendered HTML carrying Open Graph + Twitter tags so a shared link
// unfurls with the story's card image everywhere (WhatsApp, X, iMessage, …).
// For a human who taps through, it shows the card, headline, summary and two
// CTAs (read the original article, or get the app). This page is also the
// future home of reader mode.
// ═══════════════════════════════════════════════════════════════════════════
 
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
 
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
 
function page({ title, body, status = 200 }) {
  return { status, html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${title}</head><body style="margin:0;background:#111;color:#fff;font-family:'DM Sans',-apple-system,system-ui,sans-serif">${body}</body></html>` };
}
 
export default async function handler(req, res) {
  let id = req.query?.id;
  if (Array.isArray(id)) id = id[0];
  id = (id || '').trim().replace(/^["']+|["']+$/g, '');
 
  const host   = req.headers['x-forwarded-host'] || req.headers.host || 'gridds.news';
  const origin = 'https://' + host;
 
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
 
  if (!id || !SUPABASE_URL || !SUPABASE_ANON) {
    const p = page({ status: 400, title: '<title>GRIDDS.NEWS</title>', body: '<div style="padding:40px;text-align:center">Story not found.</div>' });
    return res.status(p.status).send(p.html);
  }
 
  let story = null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/stories?id=eq.${encodeURIComponent(id)}`
      + `&select=id,headline,summary,source,url,image,section_id&limit=1`;
    const resp = await fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
    if (resp.ok) { const rows = await resp.json(); story = Array.isArray(rows) ? rows[0] : null; }
  } catch { /* fall through to not-found */ }
 
  if (!story) {
    const p = page({ status: 404, title: '<title>Story not found — GRIDDS.NEWS</title>', body: '<div style="padding:40px;text-align:center">This story is no longer available. <a style="color:#E8520A" href="' + esc(origin) + '">Open GRIDDS.NEWS</a></div>' });
    return res.status(p.status).send(p.html);
  }
 
  const cardImg  = `${origin}/api/share-card?id=${encodeURIComponent(story.id)}`;
  const shareUrl = `${origin}/s/${encodeURIComponent(story.id)}`;
  const desc     = (story.summary || '').slice(0, 300);
 
  const head = `
    <title>${esc(story.headline)} — GRIDDS.NEWS</title>
    <meta name="description" content="${esc(desc)}">
    <link rel="canonical" href="${esc(shareUrl)}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="GRIDDS.NEWS">
    <meta property="og:title" content="${esc(story.headline)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${esc(shareUrl)}">
    <meta property="og:image" content="${esc(cardImg)}">
    <meta property="og:image:width" content="1080">
    <meta property="og:image:height" content="1440">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(story.headline)}">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="${esc(cardImg)}">`;
 
  const body = `
    <div style="max-width:520px;margin:0 auto;padding:24px 20px 48px">
      <a href="${esc(origin)}" style="display:inline-block;margin:8px 0 20px;color:rgba(255,255,255,.6);text-decoration:none;font-size:14px;letter-spacing:1px">← GRIDDS.NEWS</a>
      <img src="${esc(cardImg)}" alt="${esc(story.headline)}" style="width:100%;border-radius:14px;display:block;box-shadow:0 10px 40px rgba(0,0,0,.5)">
      <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:26px;line-height:1.25;margin:28px 0 14px">${esc(story.headline)}</h1>
      <p style="font-size:17px;line-height:1.6;color:rgba(255,255,255,.78);margin:0 0 28px">${esc(story.summary || '')}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${story.url ? `<a href="${esc(story.url)}" target="_blank" rel="noopener" style="flex:1;min-width:160px;text-align:center;background:#E8520A;color:#fff;text-decoration:none;padding:14px 18px;border-radius:10px;font-weight:600">Read full story ↗</a>` : ''}
        <a href="${esc(origin)}/app" style="flex:1;min-width:160px;text-align:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#fff;text-decoration:none;padding:14px 18px;border-radius:10px;font-weight:600">Get the GRIDDS app</a>
      </div>
      <p style="margin:24px 0 0;font-size:13px;color:rgba(255,255,255,.4)">${esc(story.source || '')}</p>
    </div>`;
 
  const p = page({ title: head, body });
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  return res.status(p.status).send(p.html);
}
 
export const config = { maxDuration: 10 };
