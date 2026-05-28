// ═══════════════════════════════════════════════════════════════════════════
// GRIDDS.NEWS — Analytics read API   /api/analytics
// Returns aggregated stats for the editorial dashboard:
//   - section leaderboard (opens + full-story clicks) for a time window
//   - top stories by opens (with click-through rate)
//   - totals (for the ad / CPM impression counter)
//
// Query params:
//   ?range=today | 7d | 30d   (default 7d)
//
// Uses SERVICE ROLE key (server-side only).
// Requires Vercel env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ═══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;

// Display labels (must match the app). politics=Nation, ipl=Sports.
const SECTION_LABEL = {
  headlines:'Headlines', finance:'Finance', wellness:'Wellness',
  politics:'Nation', ipl:'Sports', loves:'✶ GRIDD Loves',
  cityNews:'City News', worldNews:'World News', entertainment:'Entertainment',
  tech:'Tech', longreads:'Long Reads', opinions:'Opinions',
  thisAndThat:'This & That', lifestyle:'Lifestyle',
};

function sinceISO(range){
  const now = new Date();
  if (range === 'today') {
    const d = new Date(now); d.setHours(0,0,0,0); return d.toISOString();
  }
  const days = range === '30d' ? 30 : 7;
  return new Date(now.getTime() - days*24*60*60*1000).toISOString();
}

async function sb(path){
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':        SUPABASE_SERVICE,
      'Authorization': `Bearer ${SUPABASE_SERVICE}`,
    },
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    return res.status(500).json({ error: 'Supabase service env vars not set' });
  }

  const range = (req.query && req.query.range) || '7d';
  const since = sinceISO(range);

  try {
    // Pull all events in the window (created_at >= since).
    // For a launch-scale app this is fine; we aggregate in JS.
    const events = await sb(
      `story_events?created_at=gte.${encodeURIComponent(since)}` +
      `&select=story_id,section_id,event_type,created_at&order=created_at.desc&limit=100000`
    );

    // ── Section leaderboard ──
    const sectionStats = {};   // key -> {opens, clicks}
    const storyStats   = {};   // story_id -> {opens, clicks, section_id}
    let totalOpens = 0, totalClicks = 0;

    for (const e of events) {
      const sec = e.section_id || 'unknown';
      if (!sectionStats[sec]) sectionStats[sec] = { opens:0, clicks:0 };
      if (e.event_type === 'open') { sectionStats[sec].opens++; totalOpens++; }
      if (e.event_type === 'fullstory_click') { sectionStats[sec].clicks++; totalClicks++; }

      if (e.story_id) {
        if (!storyStats[e.story_id]) storyStats[e.story_id] = { opens:0, clicks:0, section_id: sec };
        if (e.event_type === 'open') storyStats[e.story_id].opens++;
        if (e.event_type === 'fullstory_click') storyStats[e.story_id].clicks++;
      }
    }

    const sections = Object.keys(sectionStats).map(function(k){
      const s = sectionStats[k];
      return {
        section_id: k,
        label: SECTION_LABEL[k] || k,
        opens: s.opens,
        clicks: s.clicks,
        ctr: s.opens ? Math.round((s.clicks / s.opens) * 1000)/10 : 0,
      };
    }).sort(function(a,b){ return b.opens - a.opens; });

    // ── Top stories (by opens) — fetch headlines for the top 25 ──
    const topIds = Object.keys(storyStats)
      .sort(function(a,b){ return storyStats[b].opens - storyStats[a].opens; })
      .slice(0, 25);

    let headlines = {};
    if (topIds.length) {
      const inList = topIds.map(function(id){ return '"'+id+'"'; }).join(',');
      const rows = await sb(`stories?id=in.(${inList})&select=id,headline,source`);
      rows.forEach(function(r){ headlines[r.id] = { headline: r.headline, source: r.source }; });
    }

    const topStories = topIds.map(function(id){
      const s = storyStats[id];
      const meta = headlines[id] || {};
      return {
        story_id: id,
        headline: meta.headline || '(unknown story)',
        source:   meta.source || '',
        section_id: s.section_id,
        section: SECTION_LABEL[s.section_id] || s.section_id,
        opens: s.opens,
        clicks: s.clicks,
        ctr: s.opens ? Math.round((s.clicks / s.opens) * 1000)/10 : 0,
      };
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      range: range,
      since: since,
      totals: {
        opens: totalOpens,
        clicks: totalClicks,
        impressions: totalOpens,   // "impression" = a story open, used for CPM
      },
      sections: sections,
      topStories: topStories,
    });

  } catch (err) {
    return res.status(500).json({ error: 'Analytics failed', detail: String(err).slice(0,300) });
  }
}

export const config = { maxDuration: 15 };
