// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Share-card image   /api/share-card?id=<storyId>
//
// Renders the branded, Inshorts-style share card as a 1080×1440 PNG.
// Used two ways:
//   1. The in-app share button shares this image file to WhatsApp/Instagram.
//   2. The /s/<id> page points og:image here, so any shared link previews it.
//
// Self-contained: fonts + logo live in api/_assets/ and are bundled with the
// function. Story data is read from Supabase with the public anon key.
// ═══════════════════════════════════════════════════════════════════════════
 
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
 
// ── Assets (literal URLs so Vercel's file tracer bundles them) ──
const FONT_PLAYFAIR = readFileSync(fileURLToPath(new URL('./_assets/PlayfairDisplay-ExtraBold.ttf', import.meta.url)));
const FONT_DM_400   = readFileSync(fileURLToPath(new URL('./_assets/DMSans-Regular.ttf', import.meta.url)));
const FONT_DM_700   = readFileSync(fileURLToPath(new URL('./_assets/DMSans-Bold.ttf', import.meta.url)));
const LOGO_PNG      = readFileSync(fileURLToPath(new URL('./_assets/gridds-logo.png', import.meta.url)));
const LOGO_DATA_URI = 'data:image/png;base64,' + LOGO_PNG.toString('base64');
 
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
 
// ── section_id → { label, colour }. Keyed by the DB's section_id values
//    (see edition.js), with camelCase aliases so it resolves either way. ──
const SECTIONS = {
  headlines:{label:'Headlines',color:'#E8520A'}, finance:{label:'Finance',color:'#1B5E20'},
  wellness:{label:'Wellness',color:'#6A1B9A'},    politics:{label:'Nation',color:'#8B1538'},
  ipl:{label:'Sports',color:'#FFA000'},
  griddloves:{label:'GRIDD Loves',color:'#7B5EA7'}, loves:{label:'GRIDD Loves',color:'#7B5EA7'},
  citynews:{label:'City News',color:'#37474F'},   cityNews:{label:'City News',color:'#37474F'},
  worldnews:{label:'World News',color:'#1565C0'}, worldNews:{label:'World News',color:'#1565C0'},
  entertainment:{label:'Entertainment',color:'#C2185B'}, tech:{label:'Tech',color:'#1976D2'},
  opinions:{label:'Opinions',color:'#455A64'},    longreads:{label:'Long Reads',color:'#5D4037'},
  thisandthat:{label:'This & That',color:'#00695C'}, thisAndThat:{label:'This & That',color:'#00695C'},
  lifestyle:{label:'Lifestyle',color:'#006064'},
};
 
const LOGO_W = Math.round(457 / 103 * 50); // keep logo aspect ratio at 50px tall
 
// Pick black/white text for a coloured pill based on perceived brightness
function pillTextColor(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 165 ? '#111111' : '#ffffff';
}
 
function clampWords(text, max) {
  const w = (text || '').trim().split(/\s+/);
  return w.length > max ? w.slice(0, max).join(' ') + '…' : (text || '');
}
 
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}
 
const h = (type, props, ...children) => {
  const style = (props && props.style) ? { ...props.style } : {};
  if (type === 'div' && !style.display) style.display = 'flex';
  return { type, props: { ...props, style, children: children.flat() } };
};
 
// ── Build + rasterise the card. Exported so it can be tested locally. ──
export async function renderCard({ headline, summary, source, dateLabel, sectionId, imageDataUri }) {
  const sec    = SECTIONS[sectionId] || SECTIONS.headlines;
  const accent = sec.color;
 
  const imageBlock = imageDataUri
    ? h('img', { src: imageDataUri, width: 1080, height: 620, style: { objectFit: 'cover' } })
    : h('div', { style: { width: '1080px', height: '620px', display: 'flex',
        backgroundImage: `linear-gradient(135deg, ${accent}, #111111)` } });
 
  const card = h('div', { style: { width: '1080px', height: '1440px', display: 'flex', flexDirection: 'column', backgroundColor: '#111111', fontFamily: 'DM Sans' } },
    h('div', { style: { display: 'flex', width: '1080px', height: '620px' } }, imageBlock),
    h('div', { style: { display: 'flex', flexDirection: 'column', padding: '44px 56px 0 56px', flexGrow: 1 } },
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        h('span', { style: { backgroundColor: accent, color: pillTextColor(accent), fontFamily: 'DM Sans', fontWeight: 700, fontSize: '22px', letterSpacing: '2.5px', padding: '9px 18px', borderRadius: '6px' } }, (sec.label || '').toUpperCase()),
        h('img', { src: LOGO_DATA_URI, width: LOGO_W, height: 50 }),
      ),
      h('div', { style: { fontFamily: 'Playfair Display', fontWeight: 800, fontSize: '58px', color: '#ffffff', lineHeight: 1.16, marginTop: '30px', letterSpacing: '-0.5px' } }, headline),
      h('div', { style: { fontFamily: 'DM Sans', fontWeight: 400, fontSize: '33px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, marginTop: '30px' } }, clampWords(summary, 52)),
    ),
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 56px', padding: '32px 0 46px 0', borderTop: '1px solid rgba(255,255,255,0.12)' } },
      h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('span', { style: { fontFamily: 'DM Sans', fontWeight: 700, fontSize: '26px', color: '#ffffff', letterSpacing: '1.5px' } }, (source || '').toUpperCase()),
        h('span', { style: { fontFamily: 'DM Sans', fontWeight: 400, fontSize: '22px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', marginTop: '6px' } }, dateLabel || ''),
      ),
      h('span', { style: { fontFamily: 'DM Sans', fontWeight: 700, fontSize: '23px', color: accent, letterSpacing: '0.5px' } }, 'Read full story →'),
    ),
  );
 
  const svg = await satori(card, {
    width: 1080, height: 1440,
    fonts: [
      { name: 'Playfair Display', data: FONT_PLAYFAIR, weight: 800, style: 'normal' },
      { name: 'DM Sans', data: FONT_DM_400, weight: 400, style: 'normal' },
      { name: 'DM Sans', data: FONT_DM_700, weight: 700, style: 'normal' },
    ],
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } }).render().asPng();
}
 
// Fetch the article image and inline it as a data URI (graceful: null on failure)
async function fetchImageDataUri(imageUrl) {
  if (!imageUrl) return null;
  try {
    const r = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GRIDDSNewsBot/2.0)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const type = (r.headers.get('content-type') || '').split(';')[0];
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 5_000_000) return null; // guard against huge files
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
 
export default async function handler(req, res) {
  let id = req.query?.id;
  if (Array.isArray(id)) id = id[0];
  id = (id || '').trim().replace(/^["']+|["']+$/g, '');   // tolerate copied quotes
  if (!id) return res.status(400).json({ error: 'Missing ?id' });
  if (!SUPABASE_URL || !SUPABASE_ANON) return res.status(500).json({ error: 'Supabase env not set' });
 
  try {
    const url = `${SUPABASE_URL}/rest/v1/stories?id=eq.${encodeURIComponent(id)}`
      + `&select=id,headline,summary,source,image,section_id,source_published_at,published_at&limit=1`;
    const resp = await fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
    if (!resp.ok) return res.status(502).json({ error: 'Supabase read failed' });
    const rows = await resp.json();
    const story = Array.isArray(rows) ? rows[0] : null;
    if (!story) return res.status(404).json({ error: 'Story not found' });
 
    const imageDataUri = await fetchImageDataUri(story.image);
    const png = await renderCard({
      headline:     story.headline || '',
      summary:      story.summary || '',
      source:       story.source || '',
      dateLabel:    formatDate(story.source_published_at || story.published_at),
      sectionId:    story.section_id,
      imageDataUri,
    });
 
    res.setHeader('Content-Type', 'image/png');
    // Cache hard at the edge — a story's card never changes once published.
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(Buffer.from(png));
  } catch (err) {
    return res.status(500).json({ error: 'Render failed', detail: err.message });
  }
}
 
export const config = { maxDuration: 15 };
 
