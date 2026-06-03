/* ──────────────────────────────────────────────────
   GRIDDS.NEWS — Live edition fetcher
   Fetches /api/edition (5 min cached) and replaces hardcoded SECS
   ────────────────────────────────────────────────── */
var GRIDDS_API_URL = '/api/edition';

/* Story-expand state — declared at the very top so functions defined early
   (e.g. renderCardAd) can reference expandKey without a ReferenceError. */
var expandKey = null, expandIdx = 0;

/* ── ANALYTICS: fire-and-forget event tracking to /api/track ── */
function gtrack(eventType, story, sectionKey){
  try {
    var sid = (story && (story.section || sectionKey)) || sectionKey || null;
    var payload = {
      event_type: eventType,
      story_id:   (story && story.id) ? story.id : null,
      section_id: sid
    };
    var body = JSON.stringify(payload);
    /* sendBeacon is best for fire-and-forget (survives page unload); fall back to fetch */
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], {type:'application/json'}));
    } else {
      fetch('/api/track', {method:'POST', headers:{'Content-Type':'application/json'}, body:body, keepalive:true}).catch(function(){});
    }
  } catch(e) { /* never let tracking break the app */ }
}
window.gtrack = gtrack;

/* ══ ADS — self-served ads pulled from /api/ads, rendered in 3 slots ══ */
var GRIDDS_ADS_URL = '/api/ads';
var AD_FEED = { interstitial: [], banner: [], card: [] };
var _adRot  = { interstitial: 0, banner: 0, card: 0 };
/* appKey → DB section_id (inverse of edition.js DB_TO_APP_KEY) */
var APP_TO_DB = {
  headlines:'headlines', finance:'finance', wellness:'wellness', politics:'politics',
  ipl:'ipl', loves:'griddloves', cityNews:'citynews', worldNews:'worldnews',
  entertainment:'entertainment', tech:'tech', opinions:'opinions',
  longreads:'longreads', thisAndThat:'thisandthat', lifestyle:'lifestyle'
};
function gtrackAd(adId, type){
  if(!adId) return;
  try {
    var body = JSON.stringify({ event_type: 'ad_'+type, ad_id: adId });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body],{type:'application/json'}));
    else fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true}).catch(function(){});
  } catch(e){}
}
window.gtrackAd = gtrackAd;
function adsForSlot(format, appKey){
  var db = appKey ? (APP_TO_DB[appKey] || null) : null;
  return (AD_FEED[format]||[]).filter(function(a){ return !a.section || a.section === db; });
}
function nextAd(format, appKey){
  var pool = adsForSlot(format, appKey);
  if(!pool.length) return null;
  var ad = pool[_adRot[format] % pool.length];
  _adRot[format]++;
  return ad;
}
function renderCardAd(){
  var slot = document.getElementById('se-card-ad'); if(!slot) return;
  var link = document.getElementById('se-card-ad-link');
  var img  = document.getElementById('se-card-ad-img');
  var cs   = document.getElementById('se-card-ad-cs');
  var ad = nextAd('card', expandKey);
  slot.style.display = 'block';
  if(!ad || !ad.image){
    /* No ad inventory yet → show the "Coming soon" placeholder so the
       banner slot's position is visible in the card. */
    if(img){ img.style.display='none'; img.src=''; }
    if(link){ link.removeAttribute('href'); link.style.pointerEvents='none'; }
    if(cs) cs.style.display='flex';
    return;
  }
  if(cs) cs.style.display='none';
  if(img){ img.style.display='block'; img.src = ad.image; img.alt = ad.brand || 'Advertisement'; }
  link.href = ad.url || '#'; link.style.pointerEvents='';
  link.onclick = function(){ gtrackAd(ad.id, 'click'); };
  gtrackAd(ad.id, 'impression');
}
function renderBottomBanner(){
  var bar = document.getElementById('bottom-ad-banner'); if(!bar) return;
  var ad = nextAd('banner', null);   /* banners are global */
  if(!ad || !ad.image){ bar.style.display='none'; return; }
  var link = document.getElementById('bottom-ad-link');
  var img  = document.getElementById('bottom-ad-img');
  img.src = ad.image; img.alt = ad.brand || 'Advertisement';
  link.href = ad.url || '#';
  link.onclick = function(){ gtrackAd(ad.id, 'click'); };
  bar.style.display = 'flex';
  gtrackAd(ad.id, 'impression');
}
(function fetchAds(){
  fetch(GRIDDS_ADS_URL, { cache:'no-store' })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!d || !d.ads) return;
      AD_FEED = { interstitial:[], banner:[], card:[] };
      d.ads.forEach(function(a){ if(AD_FEED[a.format]) AD_FEED[a.format].push(a); });
      renderBottomBanner();
    })
    .catch(function(){});
})();
/* bottom-banner close */
document.addEventListener('DOMContentLoaded', function(){
  var x = document.getElementById('bottom-ad-close');
  if (x) x.addEventListener('click', function(){
    var bar = document.getElementById('bottom-ad-banner'); if(bar) bar.style.display='none';
  });
});

function applyLiveEdition(edition) {
  // Update browser tab title with live edition date
  if (edition.meta && edition.meta.editionDate) {
    var d = new Date(edition.meta.editionDate);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    document.title = 'GRIDDS.NEWS — ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  if (!edition || !edition.sections) return false;
  var hasData = false;
  Object.keys(edition.sections).forEach(function(key) {
    var live = edition.sections[key];
    if (!live) return;
    if (!window.SECS[key]) {
      window.SECS[key] = { label: live.label, color: live.color, stories: [] };
    }
    if (Array.isArray(live.stories) && live.stories.length > 0) {
      /* Section has LIVE stories from sheet — use them, drop hardcoded */
      window.SECS[key].stories = live.stories;
      hasData = true;
    } else {
      /* Section has zero LIVE stories — clear it so empty sections stay empty */
      window.SECS[key].stories = [];
    }
    if (live.label) window.SECS[key].label = live.label;
    if (live.color) window.SECS[key].color = live.color;
  });
  return hasData;
}

function rerenderTilesIfReady() {
  /* Trigger a re-paint of all tile faces with new data */
  if (typeof window.KEYS === 'undefined' || typeof window.paintFace !== 'function') {
    /* Not ready yet — defer */
    setTimeout(rerenderTilesIfReady, 200);
    return;
  }
  window.KEYS.forEach(function(key) {
    if (!window.SECS[key] || !window.SECS[key].stories || !window.SECS[key].stories.length) return;
    /* Paint front and back faces */
    if (typeof window.ST !== 'undefined' && window.ST[key]) {
      try {
        window.paintFace(key, 'f', 0);
        window.paintFace(key, 'b', 1);
        window.ST[key].front = 0;
        window.ST[key].back = 1;
        window.ST[key].isFrontVisible = true;
      } catch(e) {}
    }
  });
}

(function fetchLiveEdition(){
  fetch(GRIDDS_API_URL, { cache: 'no-store' })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(edition){
      if (!edition) return;
      if (applyLiveEdition(edition)) {
        rerenderTilesIfReady();
      }
    })
    .catch(function(){ /* fall back to hardcoded SECS silently */ });
})();


/* ── OPEN ORIGINAL SOURCE (issue #3) ──────────────────────────────────────
   Reader mode has been removed to avoid reproducing publishers' article text
   (copyright). Tapping "Full Story" now opens the original article directly.
   The first time, we remind the reader that their browser has a Reader Mode
   for a clean view — we point them to it instead of rebuilding it ourselves. */
function _griddsReaderTip() {
  try { if (localStorage.getItem('gridds_reader_tip') === '1') return; } catch (e) {}
  var t = document.getElementById('gridds-tip');
  if (!t) {
    t = document.createElement('div');
    t.id = 'gridds-tip';
    t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;'
      + 'max-width:88%;background:#1a1a1a;color:#f5f0e8;border:1px solid rgba(255,255,255,0.15);'
      + 'border-radius:12px;padding:14px 18px;font-family:"DM Sans",sans-serif;font-size:13px;'
      + 'line-height:1.5;box-shadow:0 10px 40px rgba(0,0,0,0.5);opacity:0;transition:opacity .3s ease';
    t.innerHTML = 'Opening the original article. <strong style="color:#E8520A">Tip:</strong> '
      + 'your browser\u2019s Reader Mode gives a clean, distraction-free view.';
    document.body.appendChild(t);
  }
  requestAnimationFrame(function(){ t.style.opacity = '1'; });
  setTimeout(function(){ t.style.opacity = '0'; }, 4200);
  try { localStorage.setItem('gridds_reader_tip', '1'); } catch (e) {}
}

function openReader(url /*, title, source, summary, imgSrc */) {
  if (!url) return;
  _griddsReaderTip();
  // Open the source. In the Capacitor app this surfaces the system/in-app
  // browser; on web it opens a new tab.
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
      window.Capacitor.Plugins.Browser.open({ url: url });
    } else {
      window.open(url, '_blank', 'noopener');
    }
  } catch (e) { window.open(url, '_blank', 'noopener'); }
}
function closeReader() {
  var ov = document.getElementById('rdr-overlay');
  if (ov) ov.classList.remove('show');
}
window.openReader = openReader;
window.closeReader = closeReader;



(function(__ready){ if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', __ready); } else { __ready(); } })(function() {




var IMGS={"image11.png": "assets/img_792bb703.png", "image15.jpeg": "assets/img_38ec1de2.jpeg", "image16.jpeg": "assets/img_be66ec85.jpeg", "image2.jpeg": "assets/img_38ec1de2.jpeg", "image17.jpeg": "assets/img_2fdf8f8e.jpeg", "image24.jpeg": "assets/img_422ce488.jpeg", "image8.jpeg": "assets/img_4dc6aeb7.jpeg", "image9.jpeg": "assets/img_485a7b78.jpeg", "image4.jpeg": "assets/img_354a5239.jpeg", "image25.jpeg": "assets/img_87f1e594.jpeg", "image13.jpeg": "assets/img_38ec1de2.jpeg", "image26.jpeg": "assets/img_87f1e594.jpeg", "image18.jpeg": "assets/img_76efa1b9.jpeg", "image1.jpeg": "assets/img_38ec1de2.jpeg", "image20.jpeg": "assets/img_7df334c5.jpeg", "image14.jpeg": "assets/img_75b3219c.jpeg", "image3.jpeg": "assets/img_fbc91a89.jpeg", "image10.png": "assets/img_de8a4a05.png", "image5.jpeg": "assets/img_354a5239.jpeg", "image23.jpeg": "assets/img_a9695616.jpeg", "image19.jpeg": "assets/img_38ec1de2.jpeg", "image22.jpeg": "assets/img_05dfbcc0.jpeg", "image21.jpeg": "assets/img_38ec1de2.jpeg", "image7.png": "assets/img_96ab4164.png", "image6.png": "assets/img_a34245ea.png", "image12.jpeg": "assets/img_38ec1de2.jpeg"};
var SECS={"headlines":{"label":"Headlines","color":"#E8520A","stories":[]},"finance":{"label":"Finance","color":"#1B5E20","stories":[]},"wellness":{"label":"Wellness","color":"#6A1B9A","stories":[]},"politics":{"label":"Nation","color":"#8B1538","stories":[]},"ipl":{"label":"Sports","color":"#FFA000","stories":[]},"loves":{"label":"✶ GRIDD Loves","color":"#7B5EA7","stories":[]},"cityNews":{"label":"City News","color":"#37474F","stories":[]},"worldNews":{"label":"World News","color":"#1565C0","stories":[]},"entertainment":{"label":"Entertainment","color":"#C2185B","stories":[]},"tech":{"label":"Tech","color":"#1976D2","stories":[]},"longreads":{"label":"Long Reads","color":"#5D4037","stories":[]},"opinions":{"label":"Opinions","color":"#455A64","stories":[]},"thisAndThat":{"label":"This & That","color":"#00695C","stories":[]},"lifestyle":{"label":"Lifestyle","color":"#006064","stories":[]}};
var KEYS=["headlines","finance","wellness","politics","ipl","loves","cityNews","worldNews","entertainment","tech","longreads","opinions","thisAndThat","lifestyle"];
window.SECS = SECS; window.KEYS = KEYS;

var ST={};
window.ST = ST;
;
KEYS.forEach(function(k){ST[k]={front:0,back:1,isFrontVisible:true,busy:false};});

function tick(){
  var n=new Date(),h=n.getHours(),m=n.getMinutes(),ap=h>=12?'PM':'AM';
  h=h%12||12;
  var clk=document.getElementById('clock'); if(clk) clk.textContent=h+':'+(m<10?'0':'')+m+' '+ap;
  var D=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var Mo=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var dt=document.getElementById('date'); if(dt) dt.textContent=D[n.getDay()]+', '+n.getDate()+' '+Mo[n.getMonth()]+' '+n.getFullYear();
}
tick();setInterval(tick,1000);

/* ── IMAGE PROXY — routes all images through /api/img to fix iOS Safari hotlink blocks ── */
function proxyImg(url, section) {
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('data:')) return url;
  var s = section ? '&section=' + encodeURIComponent(section) : '';
  return '/api/img?url=' + encodeURIComponent(url) + s;
}

/* imgWithFallback: sets src via proxy; if proxy fails, tries original URL */
function imgWithFallback(imgEl, url, proxiedUrl, onBothFail) {
  /* Support old 3-arg call: imgWithFallback(el, url, callback) */
  if (typeof proxiedUrl === 'function') { onBothFail = proxiedUrl; proxiedUrl = null; }
  if (!url) { if(onBothFail) onBothFail(); return; }
  var pUrl = proxiedUrl || proxyImg(url);
  imgEl.onerror = function() {
    /* Proxy failed — try original URL directly as last resort */
    imgEl.onerror = function() {
      imgEl.onerror = null;
      imgEl.style.display = 'none';
      imgEl.classList.add('img-error');
      if(onBothFail) onBothFail();
    };
    imgEl.src = url;
  };
  imgEl.src = pUrl;
}

/* Attach onerror handler to an <img> element.
   On first error: hides the broken icon, adds img-error class.
   For .se-hero: also shows the placeholder div instead. */
function attachImgFallback(imgEl, placeholderId) {
  imgEl.onerror = function() {
    this.onerror = null;           /* prevent infinite loop */
    this.classList.add('img-error');
    this.style.display = 'none';
    if (placeholderId) {
      var ph = document.getElementById(placeholderId);
      if (ph) ph.classList.add('show');
    }
  };
}

function paintFace(key,sfx,idx){
  var sec=SECS[key];
  if(!sec||!sec.stories||!sec.stories.length) return;
  var st=sec.stories[idx%sec.stories.length];
  var photo=document.getElementById('photo-'+key+'-'+sfx);
  var col=document.getElementById('color-'+key+'-'+sfx);
  if(st.image){
    (function(photoEl, imgUrl) {
    var proxied = proxyImg(imgUrl, key);
    var tester = new Image();
    tester.onload = function() {
      photoEl.style.backgroundImage = 'url(' + proxied + ')';
      photoEl.classList.remove('no-image');
    };
    tester.onerror = function() {
      photoEl.style.backgroundImage = 'none';
      photoEl.classList.add('no-image');
    };
    tester.src = proxied;
  }(photo, st.image));
    photo.style.backgroundSize='cover';
    photo.style.backgroundPosition='center';
    photo.style.display='block';
    col.style.display='none';
  } else if(st.img&&IMGS[st.img]){
    (function(photoEl, imgUrl) {
    var proxied = proxyImg(imgUrl, key);
    var tester = new Image();
    tester.onload = function() {
      photoEl.style.backgroundImage = 'url(' + proxied + ')';
      photoEl.classList.remove('no-image');
    };
    tester.onerror = function() {
      photoEl.style.backgroundImage = 'none';
      photoEl.classList.add('no-image');
    };
    tester.src = proxied;
  }(photo, IMGS[st.img]));
    photo.style.display='block';
    col.style.display='none';
  } else {
    photo.style.backgroundImage='none';
    photo.style.display='none';
    col.style.background=sec.color;
    col.style.display='block';
    col.style.opacity='0.45';
  }
  var lbl=document.getElementById('lbl-'+key+'-'+sfx);
  if(lbl){ lbl.style.background=sec.color; lbl.style.opacity='1'; }
  document.getElementById('hl-'+key+'-'+sfx).textContent=st.h;
  document.getElementById('src-'+key+'-'+sfx).textContent=st.source||'';
  document.getElementById('ctr-'+key+'-'+sfx).textContent=(idx%sec.stories.length+1)+' / '+sec.stories.length;
}
window.paintFace = paintFace;

/* Attach broken-image fallbacks to all <img> elements used in the app */
(function attachAllImgFallbacks() {
  attachImgFallback(document.getElementById('se-hero'), 'se-hero-placeholder');
  attachImgFallback(document.getElementById('c-img'), null);
  /* se-hero src changes dynamically — re-attach onerror each time src is set */
  var _hero = document.getElementById('se-hero');
  var _heroPh = document.getElementById('se-hero-placeholder');
  var _origSet = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set;
  /* Use a MutationObserver instead — safer than overriding src setter */
  var heroObs = new MutationObserver(function() {
    _hero.classList.remove('img-error');
    if (_heroPh) _heroPh.classList.remove('show');
    attachImgFallback(_hero, 'se-hero-placeholder');
  });
  heroObs.observe(_hero, { attributes: true, attributeFilter: ['src'] });
})();


KEYS.forEach(function(key){
  if(!SECS[key]||!SECS[key].stories||!SECS[key].stories.length) return;
  paintFace(key,'f',0);
  if(SECS[key].stories.length>1){paintFace(key,'b',1%SECS[key].stories.length);}
});

function flip(key){
  var s=ST[key];
  if(s.busy)return;
  if(!SECS[key]||!SECS[key].stories||!SECS[key].stories.length) return;
  s.busy=true;
  var n=SECS[key].stories.length;
  var card=document.getElementById('TC-'+key);
  if(s.isFrontVisible){
    var ni=(s.front+1)%n; paintFace(key,'b',ni); s.back=ni;
  } else {
    var ni=(s.back+1)%n; paintFace(key,'f',ni); s.front=ni;
  }
  s.isFrontVisible=!s.isFrontVisible;
  card.classList.toggle('flipped',!s.isFrontVisible);
  setTimeout(function(){s.busy=false;},1700);
}

/* ── AUTO-FLIP RHYTHM ──────────────────────────────────────────────────────
   Rules:
   1. One tile from the "first 3" group flips, then one from the "next 3", alternating.
   2. Within each group the order rotates so no tile repeats back-to-back.
   3. No two adjacent tiles (side-by-side in the same row, or sharing a row boundary)
      flip at the same time or directly one after another within a ~2.5s window.

   Layout adjacency (tiles that touch):
     headlines        — row 1 (full width)
     politics/wellness — row 2 (side by side)
     opinions/ipl      — row 3 (side by side)
     loves             — row 4 (full width)
     worldNews/thisAndThat — row 5
     finance/tech          — row 6
     cityNews/longreads    — row 7
     lifestyle/entertainment — row 8

   Group A (first 3, visible on load): headlines, politics, wellness
   Group B (next 3):                   opinions, ipl, loves
   Group C (next 3):                   worldNews, thisAndThat, finance
   Group D (next 3):                   tech, cityNews, longreads
   Group E (last 2):                   lifestyle, entertainment

   The scheduler picks one tile at a time from each group in round-robin,
   rotating through [0,1,2] order within each group, skipping if the
   previous flip was an adjacent tile.
   ────────────────────────────────────────────────────────────────────── */
(function(){
  /* Groups — each is an ordered list of keys; the scheduler cycles through them */
  /* NEW LAYOUT (top → bottom):
       headlines                 (r1 full)
       finance | wellness        (r2)
       opinions | worldNews      (r3)
       loves                     (r1 full)
       politics(Nation) | thisAndThat   (r5)
       tech | ipl(Sports)        (r6)
       longreads | cityNews      (r7)
       lifestyle | entertainment (r8)
  */
  var GROUPS = [
    ['headlines', 'finance',  'wellness'],        // A
    ['opinions',  'worldNews','loves'],           // B
    ['politics',  'thisAndThat','tech'],          // C
    ['ipl',       'longreads','cityNews'],        // D
    ['lifestyle', 'entertainment', null]          // E (only 2)
  ];

  /* Adjacency: tiles that must not flip back-to-back (touch in the new layout) */
  var ADJ = {
    'headlines':   ['finance','wellness'],
    'finance':     ['headlines','wellness','opinions'],
    'wellness':    ['headlines','finance','worldNews'],
    'opinions':    ['finance','worldNews','loves'],
    'worldNews':   ['wellness','opinions','loves'],
    'loves':       ['opinions','worldNews','politics','thisAndThat'],
    'politics':    ['loves','thisAndThat','tech'],
    'thisAndThat': ['loves','politics','ipl'],
    'tech':        ['politics','ipl','longreads'],
    'ipl':         ['thisAndThat','tech','cityNews'],
    'longreads':   ['tech','cityNews','lifestyle'],
    'cityNews':    ['ipl','longreads','entertainment'],
    'lifestyle':   ['longreads','entertainment'],
    'entertainment':['cityNews','lifestyle']
  };

  var groupIdx   = 0;          /* which group fires next */
  var groupPtrs  = [0,0,0,0,0];/* rotation pointer within each group */
  var lastFlipped = null;      /* key of the most-recently-flipped tile */

  /* Beat interval — how long between each individual tile flip */
  var BEAT = 2000; /* ms */

  function nextFlip() {
    /* Find which group fires this beat */
    var g     = groupIdx % GROUPS.length;
    var group = GROUPS[g];
    var tries = 0;
    var key   = null;

    /* Rotate within the group, skip if adjacent to lastFlipped */
    while (tries < group.length) {
      var candidate = group[groupPtrs[g] % group.length];
      groupPtrs[g]++;
      if (!candidate) { tries++; continue; } /* null slot (group E) */
      var isAdj = lastFlipped && (ADJ[lastFlipped]||[]).indexOf(candidate) !== -1;
      if (!isAdj) { key = candidate; break; }
      tries++;
    }

    /* Fallback: if all candidates are adjacent (shouldn't happen), just use the pointer */
    if (!key) {
      var fb = group[groupPtrs[g] % group.length];
      if (fb) { key = fb; groupPtrs[g]++; }
    }

    if (key) {
      flip(key);
      lastFlipped = key;
    }

    /* Advance to next group */
    groupIdx++;
    setTimeout(nextFlip, BEAT);
  }

  /* Stagger the first beat slightly so initial paint settles */
  setTimeout(nextFlip, 2200);
})();

var card=document.getElementById('card'),activeKey=null,activeUrl=null;

/* Fly directions per tile */
var FLY={
  'headlines':'fly-up',
  'politics':'fly-left','wellness':'fly-right',
  'opinions':'fly-left','ipl':'fly-right',
  'loves':'fly-down',
  'worldNews':'fly-left','thisAndThat':'fly-right',
  'finance':'fly-left','tech':'fly-right',
  'cityNews':'fly-left','longreads':'fly-right',
  'lifestyle':'fly-left','entertainment':'fly-right'
};

/* ── AD STATE — declared early so openExpand can reference them ── */
var _adSwipeCount = 0;
var _adCardIdx    = 0;
var AD_EVERY      = 3;

/* ── SNAKE break: pop the game every N swipes, or at the end of a section ── */
var _snakeSwipeCount = 0;
var SNAKE_EVERY       = 8;

/* Decide what happens on a swipe-up: next story, an ad, or the game.
   At the end of a section (no more stories) we always pop the game. */
function advanceStory(){
  _adSwipeCount++; _snakeSwipeCount++;
  var sec = SECS[expandKey];
  var atEnd = !sec || !sec.stories || expandIdx >= (sec.stories.length - 1);
  if (atEnd){ showSnakeBreak(); }
  else if (_snakeSwipeCount >= SNAKE_EVERY){ showSnakeBreak(); }
  else if (_adSwipeCount >= AD_EVERY){ showAdInterstitial(); }
  else { expandGoTo(expandIdx + 1); }
}
window.advanceStory = advanceStory;

function hideAdInterstitial() {
  var p = document.getElementById('se-ad-interstitial');
  if(p) p.classList.remove('show');
}

function openExpand(key,st,sec){
  /* ANALYTICS: story opened */
  gtrack('open', st, key);
  /* Reset ad counter each time a new section is opened */
  _adSwipeCount = 0;
  _snakeSwipeCount = 0;
  hideAdInterstitial();
  expandKey=key; expandIdx=SECS[key].stories.indexOf(st);
  if(expandIdx<0) expandIdx=0;
  KEYS.forEach(function(k){
    if(k!==key) document.getElementById('TW-'+k).classList.add(FLY[k]||'fly-left');
  });
  setTimeout(function(){
    var expand=document.getElementById('story-expand');
    var hero=document.getElementById('se-hero');
    document.getElementById('se-section').textContent=sec.label; document.getElementById('se-section').style.background=sec.color;
    document.getElementById('se-section').style.background=sec.color;
    document.getElementById('se-headline').textContent=st.h;
    document.getElementById('se-summary').textContent=(function(t){var w=(t||'').split(/\s+/);return w.length>65?w.slice(0,65).join(' ')+'…':t;})(st.summary||st.s);
    document.getElementById('se-source').textContent=st.source||'';
    if(st.image){
    var _ph=document.getElementById('se-hero-placeholder');
    if(_ph) _ph.classList.remove('show');
    hero.classList.remove('img-error');
    hero.alt=st.h; hero.style.display='block';
    imgWithFallback(hero, st.image, proxyImg(st.image, expandKey), function(){
      hero.style.display='none';
      if(_ph) _ph.classList.add('show');
    });
  }
    
    else if(st.img&&IMGS[st.img]){hero.src=proxyImg(IMGS[st.img]);hero.alt=st.h;hero.style.display='block';}
    else{hero.style.display='none';}
    document.getElementById('se-btn-read')._url=st.url||null;
    var _sb=document.getElementById('se-btn-share'); _sb._storyId=st.id||null; _sb._image=st.image||null;
    if(window._griddsPrefetchCard) window._griddsPrefetchCard(_sb);
    document.getElementById('se-close').style.display='flex';
    expand.classList.add('open');
    requestAnimationFrame(function(){requestAnimationFrame(function(){expand.classList.add('visible');});});
    renderCardAd();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ if (window.fitStoryCard) window.fitStoryCard(); }); });
  },320);
}

/* Navigate to adjacent story in expand view */
function expandGoTo(idx){
  var sec=SECS[expandKey];
  var n=sec.stories.length;
  expandIdx=((idx%n)+n)%n;
  var st=sec.stories[expandIdx];
  var hero=document.getElementById('se-hero');
  /* Animate: slide current content out, new content in */
  var body=document.querySelector('.story-expand .se-body');
  body.style.transition='opacity 0.2s ease';
  body.style.opacity='0';
  setTimeout(function(){
    document.getElementById('se-section').textContent=sec.label; document.getElementById('se-section').style.background=sec.color;
    document.getElementById('se-section').style.background=sec.color;
    document.getElementById('se-headline').textContent=st.h;
    document.getElementById('se-summary').textContent=(function(t){var w=(t||'').split(/\s+/);return w.length>65?w.slice(0,65).join(' ')+'…':t;})(st.summary||st.s);
    document.getElementById('se-source').textContent=st.source||'';
    if(st.image){
    var _ph=document.getElementById('se-hero-placeholder');
    if(_ph) _ph.classList.remove('show');
    hero.classList.remove('img-error');
    hero.alt=st.h; hero.style.display='block';
    imgWithFallback(hero, st.image, proxyImg(st.image, expandKey), function(){
      hero.style.display='none';
      if(_ph) _ph.classList.add('show');
    });
  }
    else if(st.img&&IMGS[st.img]){hero.src=proxyImg(IMGS[st.img]);hero.alt=st.h;hero.style.display='block';}
    else{hero.style.display='none';}
    document.getElementById('se-btn-read')._url=st.url||null;
    var _sb2=document.getElementById('se-btn-share'); _sb2._storyId=st.id||null; _sb2._image=st.image||null;
    if(window._griddsPrefetchCard) window._griddsPrefetchCard(_sb2);
    body.style.opacity='1';
    /* scroll back to top */
    document.getElementById('story-expand').scrollTop=0;
    renderCardAd();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ if (window.fitStoryCard) window.fitStoryCard(); }); });
  },200);
}

/* Swipe up/down on expand panel — also dismisses ad interstitial */
(function(){
  var el  = document.getElementById('story-expand');
  var adPanel = document.getElementById('se-ad-interstitial');
  var sy=null, didVSwipe=false;

  el.addEventListener('touchstart', function(e){
    sy = e.touches[0].clientY;
    didVSwipe = false;
  }, {passive:true});

  el.addEventListener('touchmove', function(e){
    if(sy===null) return;
    if(Math.abs(e.touches[0].clientY - sy) > 15) didVSwipe = true;
  }, {passive:true});

  el.addEventListener('touchend', function(e){
    if(sy===null) return;
    var dy = e.changedTouches[0].clientY - sy;
    sy = null;
    if(Math.abs(dy) > 50 && didVSwipe){
      /* If ad is showing, ANY swipe dismisses it and continues navigation */
      if(adPanel.classList.contains('show')){
        hideAdInterstitial();
        if(dy < 0) expandGoTo(expandIdx+1);
        /* swipe down while ad showing just dismisses ad, stays on same story */
        didVSwipe = false;
        return;
      }
      if(dy < 0){ advanceStory(); }
      else { expandGoTo(expandIdx-1); }
    }
    didVSwipe = false;
  }, {passive:true});

  /* Desktop mouse wheel */
  el.addEventListener('wheel', function(e){
    if(Math.abs(e.deltaY) > 30){
      if(adPanel.classList.contains('show')){
        hideAdInterstitial();
        if(e.deltaY > 0) expandGoTo(expandIdx+1);
        return;
      }
      if(e.deltaY > 0){ advanceStory(); }
      else { expandGoTo(expandIdx-1); }
    }
  }, {passive:true});
})();

/* ── AD INTERSTITIAL — every 7 swipes up in story expand ────────────────
   AD_CARDS: add your real ad objects here. Each has:
     brand    — advertiser name (uppercase, small caps label)
     headline — main ad headline (Playfair, large)
     copy     — one-line body copy
     cta      — button label
     url      — click-through URL
     image    — image URL (optional; placeholder shown if omitted)
   ─────────────────────────────────────────────────────────────────────── */
var AD_CARDS = [
  {
    brand:    'Corporate Potter',
    headline: 'Shape yourself. Lead better.',
    copy:     'Life skills coaching for CXOs. Strictly by invitation.',
    cta:      'Apply online',
    url:      'mailto:screen@corporatepotter.com',
    image:    '',  /* drop hosted image URL here when available */
    theme: {
      bg:       '#F5F0E8',  /* warm cream — matches their brand panel */
      hl:       '#1C1A14',
      copy:     '#5C5448',
      brand:    '#B8952A',  /* their gold */
      ctaBg:    '#1C1A14',
      ctaColor: '#F5F0E8'
    }
  }
  /* add more ad objects here as they come in */
];

/* ad vars declared earlier */

function showAdInterstitial() {
  var ad = nextAd('interstitial', expandKey);
  if (!ad) { _adSwipeCount = 0; expandGoTo(expandIdx + 1); return; }  /* no ad → just advance */

  var panel = document.getElementById('se-ad-interstitial');
  var body  = panel.querySelector('.se-ad-body');
  var img   = document.getElementById('se-ad-img');
  var ph    = document.getElementById('se-ad-placeholder');

  document.getElementById('se-ad-brand').textContent    = ad.brand    || 'Sponsored';
  document.getElementById('se-ad-headline').textContent = ad.headline || '';
  document.getElementById('se-ad-copy').textContent     = ad.copy     || '';
  var cta = document.getElementById('se-ad-cta');
  cta.textContent = ad.cta || 'Learn More';
  cta.href        = ad.url || '#';
  cta.onclick     = function(){ gtrackAd(ad.id, 'click'); };

  /* Per-ad theming via optional `theme` object on each AD_CARD entry
     e.g. theme: { bg:'#F5F0E8', hl:'#1a1a2a', copy:'#555', brand:'#B8A070', ctaBg:'#1a1a2a', ctaColor:'#fff' } */
  var t = ad.theme || {};
  body.style.setProperty('--se-ad-bg',         t.bg       || '#0d0d12');
  body.style.setProperty('--se-ad-hl-color',   t.hl       || '#fff');
  body.style.setProperty('--se-ad-copy-color', t.copy     || 'rgba(255,255,255,0.6)');
  body.style.setProperty('--se-ad-brand-color',t.brand    || 'rgba(255,255,255,0.35)');
  body.style.setProperty('--se-ad-cta-bg',     t.ctaBg    || '#E8520A');
  body.style.setProperty('--se-ad-cta-color',  t.ctaColor || '#fff');

  /* Skip button colour adapts to bg */
  var skip = document.getElementById('se-ad-skip');
  skip.style.color = t.bg && t.bg !== '#0d0d12' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)';

  if (ad.image && ad.image.trim()) {
    img.src = ad.image;
    img.style.display = 'block';
    ph.style.display  = 'none';
  } else {
    img.style.display = 'none';
    ph.style.display  = 'flex';
    /* Show brand name large in placeholder */
    ph.innerHTML = "<div style='font-family:serif;font-size:26px;font-weight:700;color:rgba(255,255,255,0.12);text-align:center;padding:0 24px;line-height:1.3'>" + (ad.brand||"") + "</div><div style='font-family:sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.07)'>" + (ad.copy ? ad.copy.split(".")[0] : "") + "</div>";
  }

  panel.classList.add('show');
  gtrackAd(ad.id, 'impression');
  _adSwipeCount = 0;
}

/* hideAdInterstitial moved earlier */

document.getElementById('se-ad-skip').addEventListener('click', function(e) {
  e.stopPropagation();
  hideAdInterstitial();
});

/* View All from expand panel */
document.getElementById('se-btn-all').addEventListener('click',function(e){
  e.stopPropagation();
  if(!expandKey)return;
  var sec=SECS[expandKey];
  var panel=document.getElementById('va-panel');
  var list=document.getElementById('va-list');
  var title=document.getElementById('va-title');
  title.textContent=sec.label+' — All Stories';
  list.innerHTML='';
  sec.stories.forEach(function(st,i){
    var item=document.createElement('div');
    item.className='va-item';
    item.innerHTML='<div class="va-source">'+(st.source||'')+'</div>'
      +'<div class="va-hl">'+st.h+'</div>'
      +'<div class="va-sub">'+st.s+'</div>';
    item.addEventListener('click',function(e){
      e.stopPropagation();
      var mc=document.getElementById('va-card');
      document.getElementById('va-c-hl').textContent=st.h;
      document.getElementById('va-c-sum').textContent=(function(t){var w=(t||'').split(/\s+/);return w.length>65?w.slice(0,65).join(' ')+'…':t;})(st.summary||st.s);
      document.getElementById('va-c-src').textContent=st.source||'';
      document.getElementById('va-c-hint').textContent=st.url?'Click to open full story ↗':'';
      var vimg=document.getElementById('va-c-img');
      if(st.img&&IMGS[st.img]){vimg.src=proxyImg(IMGS[st.img]);vimg.style.display='block';}
      else{vimg.style.display='none';}
      mc._url=st.url||null;
      mc.style.display='block';
      mc.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
    list.appendChild(item);
  });
  /* Close expand first, then show panel */
  closeExpand();
  setTimeout(function(){ panel.classList.add('open'); },450);
});

function closeExpand(){
  var expand=document.getElementById('story-expand');
  expand.classList.remove('visible');
  KEYS.forEach(function(k){
    var tw=document.getElementById('TW-'+k);
    tw.style.transition='transform 0.4s cubic-bezier(0,0,0.2,1),opacity 0.4s ease';
    tw.classList.remove('fly-left','fly-right','fly-up','fly-down');
  });
  setTimeout(function(){
    expand.classList.remove('open');
    document.getElementById('se-close').style.display='none';
    KEYS.forEach(function(k){document.getElementById('TW-'+k).style.transition='';});
  },420);
}

document.getElementById('se-close').addEventListener('click',function(e){e.stopPropagation();closeExpand();});
document.getElementById('se-btn-read').addEventListener('click',function(e){
  e.stopPropagation();
  /* ANALYTICS: outbound full-story click */
  try {
    var _sec = SECS[expandKey];
    var _st  = _sec && _sec.stories ? _sec.stories[expandIdx] : null;
    gtrack('fullstory_click', _st, expandKey);
  } catch(_e){}
  if(this._url) openReader(this._url,'',document.getElementById('se-source').textContent,'',null);
});
document.getElementById('se-close').style.display='none';

KEYS.forEach(function(key){
  document.getElementById('TW-'+key).addEventListener('click',function(){
    var s=ST[key],sec=SECS[key];
    if(!sec||!sec.stories||sec.stories.length===0) return;
    var idx=s.isFrontVisible?s.front:s.back;
    if(typeof idx!=='number'||isNaN(idx)) idx=0;
    var st=sec.stories[((idx%sec.stories.length)+sec.stories.length)%sec.stories.length];
    if(!st) return;
    openExpand(key,st,sec);
  });
});;

card.addEventListener('click',function(e){
  if(e.target.id==='c-close'||(e.target.closest&&e.target.closest('#c-close')))return;
  if(e.target.id==='btn-viewall'||(e.target.closest&&e.target.closest('#btn-viewall')))return;
  if(activeUrl) openReader(activeUrl,'',document.getElementById('c-src').textContent,'',null);
});
document.getElementById('c-close').addEventListener('click',function(e){
  e.stopPropagation();card.classList.remove('open');activeKey=null;activeUrl=null;
});

/* ── VIEW ALL panel ── */
document.getElementById('btn-viewall').addEventListener('click',function(e){
  e.stopPropagation();
  if(!activeKey)return;
  var sec=SECS[activeKey];
  var panel=document.getElementById('va-panel');
  var list=document.getElementById('va-list');
  var title=document.getElementById('va-title');
  title.textContent=sec.label+' — All Stories';
  list.innerHTML='';
  sec.stories.forEach(function(st,i){
    var item=document.createElement('div');
    item.className='va-item';
    item.innerHTML='<div class="va-source">'+( st.source||'' )+'</div>'
      +'<div class="va-hl">'+st.h+'</div>'
      +'<div class="va-sub">'+st.s+'</div>';
    item.addEventListener('click',function(e){ e.stopPropagation();
      /* show mini-card inside view-all */
      var mc=document.getElementById('va-card');
      document.getElementById('va-c-hl').textContent=st.h;
      document.getElementById('va-c-sum').textContent=(function(t){var w=(t||'').split(/\s+/);return w.length>65?w.slice(0,65).join(' ')+'…':t;})(st.summary||st.s);
      document.getElementById('va-c-src').textContent=st.source||'';
      document.getElementById('va-c-hint').textContent=st.url?'Click to open full story ↗':'';
      var vimg=document.getElementById('va-c-img');
      if(st.img&&IMGS[st.img]){vimg.src=proxyImg(IMGS[st.img]);vimg.style.display='block';}
      else{vimg.style.display='none';}
      mc._url=st.url||null;
      mc.style.display='block';
      mc.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
    list.appendChild(item);
  });
  card.classList.remove('open');
  panel.classList.add('open');
});

document.getElementById('va-back').addEventListener('click',function(e){
  e.stopPropagation();
  document.getElementById('va-panel').classList.remove('open');
  document.getElementById('va-card').style.display='none';
});

document.getElementById('va-card').addEventListener('click',function(e){
  e.stopPropagation();
  if(e.target.id==='va-c-close'||(e.target.closest&&e.target.closest('#va-c-close'))){
    e.stopPropagation();
    document.getElementById('va-card').style.display='none'; return;
  }
  if(this._url) openReader(this._url,'','','',null);
});

/* ── SWIPE to flip tiles ── */
KEYS.forEach(function(key){
  var el=document.getElementById('TW-'+key);
  var tx=null, ty=null, swiped=false;

  el.addEventListener('touchstart',function(e){
    tx=e.touches[0].clientX;
    ty=e.touches[0].clientY;
    swiped=false;
  },{passive:true});

  el.addEventListener('touchmove',function(e){
    if(tx===null) return;
    var dx=e.touches[0].clientX-tx;
    var dy=e.touches[0].clientY-ty;
    if(Math.abs(dx)>10 && Math.abs(dx)>Math.abs(dy)*0.8){ swiped=true; }
  },{passive:true});

  el.addEventListener('touchend',function(e){
    if(tx===null) return;
    var dx=e.changedTouches[0].clientX-tx;
    var dy=e.changedTouches[0].clientY-ty;
    tx=null; ty=null;
    if(swiped && Math.abs(dx)>30 && Math.abs(dx)>Math.abs(dy)*0.8){
      dx<0 ? flip(key) : flipBack(key);
    } else {
      swiped=false;
    }
  },{passive:true});

  el.addEventListener('click',function(e){
    if(swiped){ swiped=false; e.stopImmediatePropagation(); return; }
  },true);

  var mx=null, mdrag=false;
  el.addEventListener('mousedown',function(e){ mx=e.clientX; mdrag=false; });
  el.addEventListener('mousemove',function(e){ if(mx!==null&&Math.abs(e.clientX-mx)>10) mdrag=true; });
  el.addEventListener('mouseup',function(e){
    if(mx===null) return;
    var dx=e.clientX-mx; mx=null;
    if(Math.abs(dx)>30 && mdrag){ dx<0 ? flip(key) : flipBack(key); mdrag=false; }
  });
});

/* ── FLIP BACK/* ── FLIP BACK (previous story) ── */
function flipBack(key){
  var s=ST[key];
  if(s.busy)return;
  if(!SECS[key]||!SECS[key].stories||!SECS[key].stories.length) return;
  s.busy=true;
  var n=SECS[key].stories.length;
  var card=document.getElementById('TC-'+key);
  if(s.isFrontVisible){
    var ni=(s.front-1+n)%n; paintFace(key,'b',ni); s.back=ni;
  } else {
    var ni=(s.back-1+n)%n; paintFace(key,'f',ni); s.front=ni;
  }
  s.isFrontVisible=!s.isFrontVisible;
  card.classList.toggle('flipped',!s.isFrontVisible);
  setTimeout(function(){s.busy=false;},1700);
}




  /* ─── WELCOME + PROFILE + SEARCH + SAVED ─── */
  var GRIDDS_PROFILE = null;
  var GRIDDS_SAVED   = [];

  function loadProfile() {
    try {
      var p = localStorage.getItem('gridds_profile');
      if (p) GRIDDS_PROFILE = JSON.parse(p);
      var s = localStorage.getItem('gridds_saved');
      if (s) GRIDDS_SAVED = JSON.parse(s);
    } catch(e){}
  }

  function saveProfile() {
    try { localStorage.setItem('gridds_profile', JSON.stringify(GRIDDS_PROFILE)); } catch(e){}
  }
  function saveStories() {
    try { localStorage.setItem('gridds_saved', JSON.stringify(GRIDDS_SAVED)); } catch(e){}
  }

  function ageFromDOB(dob) {
    if (!dob) return '—';
    var d = new Date(dob);
    if (isNaN(d)) return '—';
    var now = new Date();
    var age = now.getFullYear() - d.getFullYear();
    var m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age >= 0 && age < 150 ? age : '—';
  }

  function showWelcome() {
    document.getElementById('welcome-overlay').classList.add('show');
  }
  function hideWelcome() {
    document.getElementById('welcome-overlay').classList.remove('show');
  }

  /* Show welcome on first launch */
  loadProfile();
  if (!GRIDDS_PROFILE) showWelcome();

  /* issue #4 — a stable per-device id so the server row can be matched on
     re-open / edit without requiring a login. */
  function griddsDeviceId() {
    var k = 'gridds_device_id';
    try {
      var v = localStorage.getItem(k);
      if (!v) {
        v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
            : 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) { return 'dev-anon'; }
  }
  /* Best-effort: push the profile to Supabase via /api/me. Never blocks the UI;
     localStorage stays the source of truth on-device. */
  function griddsSyncProfile() {
    if (!GRIDDS_PROFILE) return;
    var p = GRIDDS_PROFILE;
    try {
      fetch('/api/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'profile',
          device_id: griddsDeviceId(),
          name: p.name || '', dob: p.dob || '', sex: p.sex || '',
          location: p.location || '', contact: p.contact || ''
        })
      }).catch(function(){});
    } catch (e) {}
  }

  /* issue #8 — push registration. Only runs inside the native Capacitor app
     (web has no token). Requests permission, then POSTs the device token to
     /api/me so the editorial console can target it. */
  function griddsRegisterPush() {
    try {
      var Cap = window.Capacitor;
      if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;   // web → skip
      var Push = Cap.Plugins && Cap.Plugins.PushNotifications;
      if (!Push) return;
      Push.requestPermissions().then(function(res){
        if (res && res.receive === 'granted') Push.register();
      });
      Push.addListener('registration', function(token){
        fetch('/api/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'token',
            device_id: griddsDeviceId(),
            token: token && token.value,
            platform: (Cap.getPlatform && Cap.getPlatform()) || 'unknown'
          })
        }).catch(function(){});
      });
    } catch (e) {}
  }
  griddsRegisterPush();

  document.getElementById('w-submit').addEventListener('click', function(){
    var name = document.getElementById('w-name').value.trim();
    if (!name) { document.getElementById('w-name').focus(); return; }
    GRIDDS_PROFILE = {
      name: name,
      contact: document.getElementById('w-contact').value.trim(),
      dob: document.getElementById('w-dob').value,
      sex: document.getElementById('w-sex').value,
      location: document.getElementById('w-location').value.trim(),
      device_id: griddsDeviceId(),
      joined: new Date().toISOString()
    };
    saveProfile();
    griddsSyncProfile();
    hideWelcome();
  });
  document.getElementById('w-skip').addEventListener('click', function(){
    GRIDDS_PROFILE = { name: 'Reader', joined: new Date().toISOString() };
    saveProfile();
    hideWelcome();
  });

  /* ─── PROFILE PANEL ─── */
  function openProfile() {
    loadProfile();
    var p = GRIDDS_PROFILE || { name: 'Reader' };
    document.getElementById('profile-name').textContent = p.name || 'Reader';
    document.getElementById('profile-avatar').textContent = (p.name||'R').charAt(0).toUpperCase();
    document.getElementById('pd-dob').textContent = p.dob || '—';
    document.getElementById('pd-age').textContent = ageFromDOB(p.dob);
    document.getElementById('pd-sex').textContent = p.sex || '—';
    document.getElementById('pd-loc').textContent = p.location || '—';
    renderSavedList();
    document.getElementById('profile-panel').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeProfile() {
    document.getElementById('profile-panel').classList.remove('show');
    document.body.style.overflow = '';
  }
  document.getElementById('profile-back').addEventListener('click', closeProfile);
  document.getElementById('profile-edit').addEventListener('click', function(){
    /* Pre-fill welcome form with current values and reopen */
    var p = GRIDDS_PROFILE || {};
    document.getElementById('w-name').value = p.name || '';
    document.getElementById('w-contact').value = p.contact || '';
    document.getElementById('w-dob').value = p.dob || '';
    document.getElementById('w-sex').value = p.sex || '';
    document.getElementById('w-location').value = p.location || '';
    closeProfile();
    showWelcome();
  });

  function renderSavedList() {
    var list = document.getElementById('saved-list');
    if (!GRIDDS_SAVED.length) {
      list.innerHTML = '<div class="saved-empty">No saved stories yet. Tap the bookmark icon on any story to save it for later.</div>';
      return;
    }
    list.innerHTML = '';
    GRIDDS_SAVED.forEach(function(s, idx) {
      var item = document.createElement('div');
      item.className = 'saved-story-item';
      var color = (SECS[s.section] && SECS[s.section].color) || '#37474F';
      var label = (SECS[s.section] && SECS[s.section].label) || s.section;
      item.innerHTML =
        '<div class="saved-story-section" style="background:'+color+'">'+label+'</div>'+
        '<div class="saved-story-hl">'+s.headline+'</div>'+
        '<div class="saved-story-meta">'+s.source+' · Saved '+new Date(s.savedAt).toLocaleDateString()+'</div>';
      item.addEventListener('click', function(){
        if (SECS[s.section]) {
          closeProfile();
          var section = SECS[s.section];
          var story = section.stories.find(function(st){ return st.h === s.headline; }) || s;
          if (typeof openExpand === 'function') openExpand(s.section, story, section);
        }
      });
      list.appendChild(item);
    });
  }

  /* ─── SAVE STORY ─── */
  document.getElementById('se-btn-save').addEventListener('click', function(e){
    e.stopPropagation();
    var btn = this;
    var headline = document.getElementById('se-headline').textContent;
    var summary = document.getElementById('se-summary').textContent;
    var source = document.getElementById('se-source').textContent;
    var section = btn._section || 'headlines';
    var url = document.getElementById('se-btn-read')._url || '';

    var existingIdx = GRIDDS_SAVED.findIndex(function(s){ return s.headline === headline; });
    if (existingIdx >= 0) {
      GRIDDS_SAVED.splice(existingIdx, 1);
      btn.classList.remove('saved');
    } else {
      GRIDDS_SAVED.unshift({
        headline: headline,
        summary: summary,
        source: source,
        section: section,
        url: url,
        savedAt: new Date().toISOString()
      });
      btn.classList.add('saved');
    }
    saveStories();
  });

  /* ─── SEARCH ─── */
  function openSearch() {
    document.getElementById('search-panel').classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(function(){ document.getElementById('search-input').focus(); }, 100);
  }
  function closeSearch() {
    document.getElementById('search-panel').classList.remove('show');
    document.body.style.overflow = '';
  }
  document.getElementById('search-back').addEventListener('click', closeSearch);

  document.getElementById('search-input').addEventListener('input', function(){
    var q = this.value.toLowerCase().trim();
    var list = document.getElementById('search-list');
    var countEl = document.getElementById('search-count');

    if (!q) {
      list.innerHTML = '';
      countEl.textContent = 'Type to start searching';
      return;
    }

    var matches = [];
    KEYS.forEach(function(key) {
      var sec = SECS[key];
      if (!sec) return;
      sec.stories.forEach(function(story) {
        var hay = (story.h + ' ' + (story.summary||story.s||'')).toLowerCase();
        if (hay.indexOf(q) !== -1) {
          matches.push({ key: key, story: story, section: sec });
        }
      });
    });

    countEl.textContent = matches.length + ' RESULT' + (matches.length===1?'':'S');
    list.innerHTML = '';
    matches.forEach(function(m) {
      var item = document.createElement('div');
      item.className = 'saved-story-item';
      item.innerHTML =
        '<div class="saved-story-section" style="background:'+m.section.color+'">'+m.section.label+'</div>'+
        '<div class="saved-story-hl">'+m.story.h+'</div>'+
        '<div class="saved-story-meta">'+(m.story.source||'')+'</div>';
      item.addEventListener('click', function(){
        closeSearch();
        if (typeof openExpand === 'function') openExpand(m.key, m.story, m.section);
      });
      list.appendChild(item);
    });
  });

  /* ─── BOTTOM NAV ─── */
  document.getElementById('nav-home').addEventListener('click', function(){
    if (typeof closeExpand === 'function') closeExpand();
    closeProfile(); closeSearch();
    window.scrollTo({top:0, behavior:'smooth'});
  });
  document.getElementById('nav-search').addEventListener('click', openSearch);

  document.getElementById('nav-profile').addEventListener('click', openProfile);


  /* ─── READING TIME ─── */
  function estimateReadTime(text) {
    if (!text) return '1 min read';
    var words = text.trim().split(/\s+/).length;
    var mins = Math.max(1, Math.round(words / 200));
    return mins + ' min read';
  }


  /* ─── APPEARANCE: System / Light / Dark ─── */
  var _mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function getThemePref() {
    var t = localStorage.getItem('gridds_theme');
    return (t === 'light' || t === 'dark' || t === 'system') ? t : 'system';  // default: follow OS
  }
  function effectiveIsLight() {
    var pref = getThemePref();
    if (pref === 'light') return true;
    if (pref === 'dark')  return false;
    return _mql ? !_mql.matches : false;   // system → OS preference (fall back to dark)
  }
  function updateThemeSegUI() {
    var seg = document.getElementById('theme-seg');
    if (!seg) return;
    var pref = getThemePref();
    seg.querySelectorAll('[data-theme]').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-theme') === pref);
    });
  }
  function applyTheme() {
    if (effectiveIsLight()) document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');
    updateThemeSegUI();
  }
  applyTheme();
  (function(){
    var seg = document.getElementById('theme-seg');
    if (seg) seg.addEventListener('click', function(e){
      var btn = e.target.closest('[data-theme]');
      if (!btn) return;
      localStorage.setItem('gridds_theme', btn.getAttribute('data-theme'));
      applyTheme();
    });
    if (_mql) {                                  // live-update when set to System and OS flips
      var onOSChange = function(){ if (getThemePref() === 'system') applyTheme(); };
      if (_mql.addEventListener) _mql.addEventListener('change', onOSChange);
      else if (_mql.addListener) _mql.addListener(onOSChange);   // older Safari
    }
  })();


  /* ─── PULL TO REFRESH ─── */
  (function(){
    var startY = 0, currentY = 0, pulling = false;
    var indicator = document.getElementById('pull-indicator');
    var THRESHOLD = 80;

    /* Pull-to-refresh must ONLY work on the home grid — never when any
       overlay/screen is open (story card, section list, profile, search,
       reader, snake game, onboarding) or while customising tiles. Every
       overlay is position:fixed over an unscrolled page, so scrollY alone
       can't tell them apart from home. */
    function overlayOpen() {
      return !!document.querySelector(
        '.story-expand.open, .story-expand.visible, .va-panel.open, ' +
        '.welcome-overlay.show, .profile-panel.show, .search-panel.show, ' +
        '#snake-overlay.show, #rdr-overlay.show'
      ) || document.body.classList.contains('editing-tiles');
    }

    function start(e) {
      if (window.scrollY > 0) return;
      if (overlayOpen()) { pulling = false; return; }   // not on home → no refresh
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      pulling = true;
    }
    function move(e) {
      if (!pulling) return;
      currentY = e.touches ? e.touches[0].clientY : e.clientY;
      var diff = currentY - startY;
      if (diff > 20 && window.scrollY === 0) {
        indicator.classList.add('show');
      }
    }
    function end() {
      if (!pulling) return;
      var diff = currentY - startY;
      if (diff > THRESHOLD && window.scrollY === 0) {
        /* Refresh */
        setTimeout(function() {
          window.location.reload();
        }, 800);
      } else {
        indicator.classList.remove('show');
      }
      pulling = false;
      startY = currentY = 0;
    }
    document.addEventListener('touchstart', start, {passive:true});
    document.addEventListener('touchmove', move, {passive:true});
    document.addEventListener('touchend', end, {passive:true});
  })();


  /* ─── SUMMARY CARD AUTO-FIT ───
     Shrinks the card's --se-scale until the summary stops clipping, so the
     image + headline + summary + footer + banner ad + swipe hint all fit in
     one frame on any phone size. Never produces a scroll. */
  window.fitStoryCard = function fitStoryCard(){
    var el = document.getElementById('story-expand');
    if (!el || !el.classList.contains('open')) return;
    var sum = document.getElementById('se-summary');
    if (!sum) return;
    var scale = 1, guard = 0;
    el.style.setProperty('--se-scale', '1');
    while (sum.scrollHeight > sum.clientHeight + 1 && scale > 0.55 && guard < 24) {
      scale -= 0.03;
      el.style.setProperty('--se-scale', scale.toFixed(3));
      guard++;
    }
  };
  (function(){
    var refit = function(){ if (window.fitStoryCard) window.fitStoryCard(); };
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', function(){ setTimeout(refit, 250); });
    var adImg = document.getElementById('se-card-ad-img');
    if (adImg) adImg.addEventListener('load', refit);   // banner loads async → re-fit
  })();


  /* ─── OFFLINE FALLBACK ─── */
  /* Save current edition data to localStorage every time it loads successfully */
  try {
    localStorage.setItem('gridds_last_edition', JSON.stringify({
      cachedAt: new Date().toISOString(),
      secsKeys: KEYS
    }));
  } catch(e) {}

  /* If offline detected, show a banner */
  window.addEventListener('offline', function() {
    var banner = document.getElementById('offline-banner');
    if (banner) banner.style.display = 'block';
  });
  window.addEventListener('online', function() {
    var banner = document.getElementById('offline-banner');
    if (banner) banner.style.display = 'none';
  });
  /* On load, if offline */
  if (!navigator.onLine) {
    var banner = document.getElementById('offline-banner');
    if (banner) banner.style.display = 'block';
  }


  /* ─── ALL TILES MANDATORY (no delete for now) ─── */
  var MANDATORY_TILES = ['headlines','finance','wellness','opinions','worldNews','loves','politics','thisAndThat','tech','ipl','longreads','cityNews','lifestyle','entertainment'];
  var HIDDEN_TILES = [];

  /* Load hidden tiles from localStorage */
  try {
    var hidden = localStorage.getItem('gridds_hidden_tiles');
    if (hidden) HIDDEN_TILES = JSON.parse(hidden);
  } catch(e) {}

  function applyHiddenTiles() {
    /* All tiles mandatory — always show every tile, ignore any stored hides */
    KEYS.forEach(function(key) {
      var wrap = document.getElementById('TW-' + key);
      if (!wrap) return;
      wrap.setAttribute('data-locked', 'true');
      wrap.style.display = '';
    });
  }

  function addDeleteButtons() {
    KEYS.forEach(function(key) {
      var wrap = document.getElementById('TW-' + key);
      if (!wrap || MANDATORY_TILES.indexOf(key) !== -1) return;
      if (wrap.querySelector('.tile-delete-btn')) return;
      var btn = document.createElement('button');
      btn.className = 'tile-delete-btn';
      btn.innerHTML = '✕';
      btn.title = 'Hide this tile';
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (HIDDEN_TILES.indexOf(key) === -1) HIDDEN_TILES.push(key);
        try { localStorage.setItem('gridds_hidden_tiles', JSON.stringify(HIDDEN_TILES)); } catch(err) {}
        applyHiddenTiles();
      });
      wrap.appendChild(btn);
    });
  }

  addDeleteButtons();
  applyHiddenTiles();

  function enterEditMode() {
    document.body.classList.add('editing-tiles');
  }
  function exitEditMode() {
    document.body.classList.remove('editing-tiles');
  }


  /* ─── NEW WELCOME FLOW (3 steps) ─── */
  function showWelcomeStep(n) {
    ['welcome-step-1','welcome-step-2','welcome-step-3'].forEach(function(id, idx) {
      var el = document.getElementById(id);
      if (el) el.style.display = (idx+1 === n) ? '' : 'none';
    });
  }
  showWelcomeStep(1);

  // Build tile-toggle list (step 2)
  (function buildTileToggles(){
    var box = document.getElementById('welcome-tile-toggles');
    if (!box) return;
    // All tiles mandatory for now — no user-hideable tiles
    var SHOWABLE = (typeof KEYS !== 'undefined' ? KEYS : []).filter(function(k){
      return MANDATORY_TILES.indexOf(k) === -1;
    });
    SHOWABLE.forEach(function(key) {
      var sec = (typeof SECS !== 'undefined' ? SECS[key] : null);
      if (!sec) return;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:10px 14px';
      var leftDiv = document.createElement('div');
      leftDiv.style.cssText = 'display:flex;align-items:center;gap:10px';
      var dot = document.createElement('span');
      dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:'+sec.color;
      var labelEl = document.createElement('span');
      labelEl.textContent = sec.label;
      labelEl.style.cssText = 'font-size:14px;color:#F5F0E8';
      leftDiv.appendChild(dot); leftDiv.appendChild(labelEl);

      // Toggle switch
      var toggle = document.createElement('div');
      toggle.className = 'theme-switch';
      toggle.setAttribute('data-key', key);
      toggle.classList.add('on');
      toggle.style.cssText = 'position:relative;width:44px;height:24px;background:#E8520A;border-radius:24px;cursor:pointer;transition:background 0.2s';
      var knob = document.createElement('span');
      knob.style.cssText = 'position:absolute;top:2px;left:22px;width:20px;height:20px;background:#fff;border-radius:50%;transition:left 0.2s';
      toggle.appendChild(knob);
      toggle.addEventListener('click', function(){
        var isOn = this.classList.contains('on');
        if (isOn) {
          this.classList.remove('on');
          this.style.background = 'rgba(255,255,255,0.15)';
          knob.style.left = '2px';
        } else {
          this.classList.add('on');
          this.style.background = '#E8520A';
          knob.style.left = '22px';
        }
      });

      row.appendChild(leftDiv);
      row.appendChild(toggle);
      box.appendChild(row);
    });
  })();

  // Step 1 → 3 (issue #3: optional-tiles window removed — all tiles mandatory)
  var s1Next = document.getElementById('w-next-1');
  if (s1Next) s1Next.addEventListener('click', function(){ showWelcomeStep(3); });

  // Step 2 → 3 (and save chosen tile hides)
  var s2Next = document.getElementById('w-next-2');
  if (s2Next) s2Next.addEventListener('click', function(){
    var hidden = [];
    document.querySelectorAll('#welcome-tile-toggles .theme-switch').forEach(function(toggle){
      var key = toggle.getAttribute('data-key');
      if (!toggle.classList.contains('on')) hidden.push(key);
    });
    try { localStorage.setItem('gridds_hidden_tiles', JSON.stringify(hidden)); } catch(e){}
    if (typeof HIDDEN_TILES !== 'undefined') HIDDEN_TILES = hidden;
    if (typeof applyHiddenTiles === 'function') applyHiddenTiles();
    showWelcomeStep(3);
  });

  document.getElementById('customise-tiles').addEventListener('click', function() {
    closeProfile();
    enterEditMode();
  });

  document.getElementById('edit-mode-banner').addEventListener('click', exitEditMode);

  /* Reset button removed — all tiles are mandatory, nothing to reset */

  /* Position masthead DS bar */
  (function(){
    function placeMastBar(){
      var el=document.getElementById('mast-gridds');
      var bar=document.getElementById('mast-bar');
      if(!el||!bar)return;
      var canvas=document.createElement('canvas');
      var ctx=canvas.getContext('2d');
      var styles=window.getComputedStyle(el);
      ctx.font=styles.fontWeight+' '+styles.fontSize+' '+styles.fontFamily;
      var ls=1.5;
      var wGRID=ctx.measureText('GRID').width+ls*4;
      var wFull=ctx.measureText('GRIDDS').width+ls*5;
      bar.style.left=Math.round(wGRID+3)+'px';
      bar.style.width=Math.round(wFull-wGRID-6)+'px';
    }
    if(document.fonts){document.fonts.ready.then(function(){setTimeout(placeMastBar,150);});}
    else{setTimeout(placeMastBar,700);}

/* ── SHARE BUTTON — shares the rendered card image, Inshorts-style ──
   issue #2 fixes:
   • The card image is PREFETCHED when the story opens (_griddsPrefetchCard),
     so the click handler can call navigator.share() SYNCHRONOUSLY. iOS Safari
     rejects share() if you await a fetch first ("must handle a user gesture"),
     which is why the savorworks card silently fell back to text-only.
   • The shared caption is now just HEADLINE + get-the-app line. No summary,
     no "all the world, distilled" tagline. The card carries the visual; the
     /s/<id> link still unfurls the card via og:image everywhere. */
window._griddsPrefetchCard = function(btn){
  if (!btn || !btn._storyId) return;
  var id = btn._storyId;
  var theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
  var key = id + ':' + theme;
  if (btn._cardForId === key && btn._cardFile) return;   // already have this theme's card
  btn._cardFile = null; btn._cardForId = key;
  fetch('/api/share-card?id=' + encodeURIComponent(id) + '&theme=' + theme)
    .then(function(r){ if (!r.ok) throw new Error('card'); return r.blob(); })
    .then(function(blob){
      if (btn._cardForId !== key) return;   // user moved on / theme changed; ignore stale result
      btn._cardFile = new File([blob], 'gridds-' + id + '.png', { type: 'image/png' });
    })
    .catch(function(){ /* leave _cardFile null → URL share fallback */ });
};

document.getElementById('se-btn-share').addEventListener('click', function(e) {
  e.stopPropagation();
  var btn      = this;
  var headline = document.getElementById('se-headline').textContent;
  var storyId  = btn._storyId || null;

  var origin   = location.origin || 'https://gridds.news';
  var shareUrl = storyId ? (origin + '/s/' + storyId) : (document.getElementById('se-btn-read')._url || origin);
  var caption  = headline + '\n\nGet the app → ' + origin + '/app';

  function flash(msg) {
    var old = btn.innerHTML;
    btn.innerHTML = msg; btn.classList.add('copied');
    setTimeout(function(){ btn.innerHTML = old; btn.classList.remove('copied'); }, 2000);
  }

  /* Best path: share the prefetched card image FILE, synchronously (works on
     iOS Safari / Android Chrome / Capacitor WebView). */
  if (btn._cardFile && navigator.canShare && navigator.canShare({ files: [btn._cardFile] })) {
    navigator.share({ files: [btn._cardFile], text: caption, title: headline }).catch(function(){});
    return;
  }
  /* Fallback 1: share the link — its og:image unfurls the same card. */
  if (navigator.share) {
    navigator.share({ title: headline, text: caption, url: shareUrl }).catch(function(){});
    return;
  }
  /* Fallback 2: copy to clipboard. */
  if (navigator.clipboard) {
    navigator.clipboard.writeText(caption + '\n' + shareUrl).then(function(){ flash('&#10003; Copied'); });
  }
});

  })();

/* ═══════════════ SNAKE BREAK GAME ═══════════════ */
(function(){
  var overlay = document.getElementById('snake-overlay');
  if(!overlay) return;
  var canvas  = document.getElementById('snake-canvas');
  var ctx     = canvas.getContext('2d');
  var scoreEl = document.getElementById('snake-score');
  var bestEl  = document.getElementById('snake-best');
  var goPanel = document.getElementById('snake-gameover');
  var goScore = document.getElementById('snake-go-score');
  var startPanel = document.getElementById('snake-start');

  var GRID = 15;                 // 15x15 cells
  var CELL = canvas.width / GRID;
  var snake, dir, nextDir, food, score, best = 0, loop = null, running = false;

  try { best = parseInt(localStorage.getItem('gridds_snake_best')||'0',10) || 0; } catch(e){}
  bestEl.textContent = best;

  function reset(){
    snake = [{x:7,y:7},{x:6,y:7},{x:5,y:7}];
    dir = {x:1,y:0}; nextDir = {x:1,y:0};
    score = 0; scoreEl.textContent = '0';
    placeFood();
    draw();
  }
  function placeFood(){
    var ok=false;
    while(!ok){
      food = {x:Math.floor(Math.random()*GRID), y:Math.floor(Math.random()*GRID)};
      ok = !snake.some(function(s){return s.x===food.x && s.y===food.y;});
    }
  }
  function step(){
    dir = nextDir;
    var head = {x:snake[0].x+dir.x, y:snake[0].y+dir.y};
    // wall or self collision
    if(head.x<0||head.x>=GRID||head.y<0||head.y>=GRID ||
       snake.some(function(s){return s.x===head.x && s.y===head.y;})){
      gameOver(); return;
    }
    snake.unshift(head);
    if(head.x===food.x && head.y===food.y){
      score++; scoreEl.textContent = score;
      placeFood();
    } else {
      snake.pop();
    }
    draw();
  }
  function draw(){
    // bg
    var light = document.body.classList.contains('light-mode');
    ctx.fillStyle = light ? '#ffffff' : '#101018';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    // food — bright green target with ring so it stands out from the orange head
    var fcx = food.x*CELL + CELL/2, fcy = food.y*CELL + CELL/2;
    ctx.fillStyle = '#3DDB6B';
    ctx.beginPath(); ctx.arc(fcx, fcy, CELL*0.32, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(61,219,107,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fcx, fcy, CELL*0.46, 0, 7); ctx.stroke();
    // snake
    for(var i=0;i<snake.length;i++){
      var s = snake[i];
      if(i===0){
        /* head: brighter block + eyes facing travel direction */
        ctx.fillStyle = '#E8520A';
        roundRect(s.x*CELL+1, s.y*CELL+1, CELL-2, CELL-2, 4); ctx.fill();
        // eyes
        ctx.fillStyle = '#fff';
        var cx = s.x*CELL + CELL/2, cy = s.y*CELL + CELL/2;
        var off = CELL*0.18, er = Math.max(1.4, CELL*0.10);
        var ex = dir.x, ey = dir.y;
        // perpendicular offset for the two eyes
        var px = ey, py = ex;
        var fwd = CELL*0.12; // push eyes slightly forward
        ctx.beginPath();
        ctx.arc(cx + ex*fwd + px*off, cy + ey*fwd + py*off, er, 0, 7); ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + ex*fwd - px*off, cy + ey*fwd - py*off, er, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = light ? '#555' : 'rgba(245,240,232,0.7)';
        roundRect(s.x*CELL+1, s.y*CELL+1, CELL-2, CELL-2, 3); ctx.fill();
      }
    }
  }
  function roundRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }
  function start(){
    if(running) return;
    startPanel.style.display = 'none';
    goPanel.style.display = 'none';
    running = true;
    loop = setInterval(step, 190);
  }
  function stop(){
    running = false;
    if(loop){ clearInterval(loop); loop = null; }
  }
  function gameOver(){
    stop();
    if(score>best){ best=score; bestEl.textContent=best;
      try{ localStorage.setItem('gridds_snake_best', String(best)); }catch(e){} }
    goScore.textContent = 'Score ' + score + '  ·  Best ' + best;
    goPanel.style.display = 'flex';
  }
  function setDir(nx,ny){
    // prevent 180° reversal
    if(dir.x === -nx && dir.y === -ny) return;
    nextDir = {x:nx, y:ny};
    if(!running) start();
  }

  // ── swipe controls on the canvas ──
  var sx=null, sy=null;
  canvas.addEventListener('touchstart', function(e){
    var t=e.touches[0]; sx=t.clientX; sy=t.clientY;
  }, {passive:true});
  canvas.addEventListener('touchmove', function(e){
    if(sx===null) return;
    var t=e.touches[0];
    var dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)<18 && Math.abs(dy)<18) return;
    if(Math.abs(dx)>Math.abs(dy)) setDir(dx>0?1:-1, 0);
    else setDir(0, dy>0?1:-1);
    sx=t.clientX; sy=t.clientY;
  }, {passive:true});
  canvas.addEventListener('touchend', function(){ sx=null; sy=null; }, {passive:true});

  // tap to start
  startPanel.addEventListener('click', start);

  // ── keyboard (desktop) ──
  function onKey(e){
    if(!overlay.classList.contains('show')) return;
    var k=e.key;
    if(k==='ArrowUp'||k==='w'){ setDir(0,-1); e.preventDefault(); }
    else if(k==='ArrowDown'||k==='s'){ setDir(0,1); e.preventDefault(); }
    else if(k==='ArrowLeft'||k==='a'){ setDir(-1,0); e.preventDefault(); }
    else if(k==='ArrowRight'||k==='d'){ setDir(1,0); e.preventDefault(); }
    else if(k==='Escape'){ closeSnake(); }
  }
  document.addEventListener('keydown', onKey);

  // ── Joystick (primary mobile control) ──
  (function initJoystick(){
    var base  = document.getElementById('snake-joy-base');
    var thumb = document.getElementById('snake-joy-thumb');
    if(!base || !thumb) return;
    var active=false, cx=0, cy=0, R=64;
    function recenter(){
      var r = base.getBoundingClientRect();
      cx = r.left + r.width/2; cy = r.top + r.height/2; R = r.width/2 || 64;
    }
    function point(e){ var t = (e.touches && e.touches[0]) ? e.touches[0] : e; return {x:t.clientX, y:t.clientY}; }
    function place(dx,dy){
      var d = Math.hypot(dx,dy), max = R*0.55;
      if(d>max && d>0){ dx = dx/d*max; dy = dy/d*max; }
      thumb.style.transition = 'none';
      thumb.style.transform = 'translate(' + dx.toFixed(0) + 'px,' + dy.toFixed(0) + 'px)';
    }
    function steer(dx,dy){
      if(Math.hypot(dx,dy) < R*0.30) return;        // deadzone — ignore tiny nudges
      if(Math.abs(dx) > Math.abs(dy)) setDir(dx>0?1:-1, 0);
      else setDir(0, dy>0?1:-1);
    }
    function begin(e){ active=true; recenter(); if(!running) start(); move(e); }
    function move(e){ if(!active) return; if(e.cancelable) e.preventDefault(); var p=point(e); var dx=p.x-cx, dy=p.y-cy; place(dx,dy); steer(dx,dy); }
    function end(){ active=false; thumb.style.transition=''; thumb.style.transform='translate(0,0)'; }
    base.addEventListener('touchstart', function(e){ if(e.cancelable) e.preventDefault(); begin(e); }, {passive:false});
    base.addEventListener('touchmove',  move, {passive:false});
    base.addEventListener('touchend',   end,  {passive:true});
    base.addEventListener('mousedown', function(e){
      begin(e);
      function mm(ev){ move(ev); }
      function mu(){ end(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); }
      document.addEventListener('mousemove', mm);
      document.addEventListener('mouseup', mu);
    });
  })();

  // ── open / close ──
  window.showSnakeBreak = function(){
    _snakeSwipeCount = 0;
    stop();
    reset();
    startPanel.style.display = 'flex';
    goPanel.style.display = 'none';
    overlay.classList.add('show');
  };
  function closeSnake(){
    stop();
    overlay.classList.remove('show');
    if (expandKey != null && typeof expandGoTo === 'function') expandGoTo(0);
  }
  document.getElementById('snake-close').addEventListener('click', closeSnake);
  document.getElementById('snake-resume').addEventListener('click', closeSnake);
  document.getElementById('snake-restart').addEventListener('click', function(){
    reset(); start();
  });
})();
});
