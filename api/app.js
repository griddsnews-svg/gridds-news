JS
// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Smart app link   /app  →  /api/app
//
// Detects the visitor's device from the User-Agent and 302-redirects:
//   • iPhone / iPad / iPod  → App Store
//   • Android               → Google Play
//   • everything else       → web landing (gridds.news)
//
// Store URLs are read from env vars so you can drop in the real listing URLs
// the moment they exist — no code change or redeploy of the app needed.
// Until then they fall back to the site, so the link is safe to share today.
//
//   APP_STORE_URL   – iOS App Store listing
//   PLAY_STORE_URL  – Google Play listing
//   APP_LANDING_URL – desktop / fallback page (defaults to gridds.news)
// ═══════════════════════════════════════════════════════════════════════════
 
const APP_STORE_URL   = process.env.APP_STORE_URL   || 'https://gridds.news/?from=app-link&os=ios';
const PLAY_STORE_URL  = process.env.PLAY_STORE_URL  || 'https://gridds.news/?from=app-link&os=android';
const APP_LANDING_URL = process.env.APP_LANDING_URL || 'https://gridds.news/?from=app-link';
 
export default function handler(req, res) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
 
  let target = APP_LANDING_URL;
  if (/iphone|ipad|ipod/.test(ua)) {
    target = APP_STORE_URL;
  } else if (/android/.test(ua)) {
    target = PLAY_STORE_URL;
  }
 
  // UA-dependent, so never let a CDN cache one device's answer for another.
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.statusCode = 302;
  res.setHeader('Location', target);
  res.end();
}
 
export const config = { maxDuration: 5 };
 
