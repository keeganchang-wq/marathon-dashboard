// ═══════════════════════════════════════════════════════════
// CLOUDFLARE WORKER — Strava Sync Proxy
// Deploy: npx wrangler deploy worker-strava-sync.js
// Secrets:
//   wrangler secret put STRAVA_CLIENT_ID
//   wrangler secret put STRAVA_CLIENT_SECRET
//   wrangler secret put STRAVA_REFRESH_TOKEN
//
// GET YOUR REFRESH TOKEN:
// 1. Go to https://www.strava.com/settings/api → create an app
// 2. Authorize: https://www.strava.com/oauth/authorize?client_id=YOUR_ID&response_type=code&redirect_uri=http://localhost&scope=read,activity:read_all
// 3. Copy the ?code= from the redirect URL
// 4. Exchange: curl -X POST https://www.strava.com/oauth/token -d client_id=YOUR_ID -d client_secret=YOUR_SECRET -d code=THE_CODE -d grant_type=authorization_code
// 5. Save the refresh_token from the response
// ═══════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    try {
      // Step 1: Refresh the access token
      const tokenRes = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.STRAVA_CLIENT_ID,
          client_secret: env.STRAVA_CLIENT_SECRET,
          refresh_token: env.STRAVA_REFRESH_TOKEN,
          grant_type: 'refresh_token',
        }),
      });
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Step 2: Fetch recent activities (last 30)
      const activitiesRes = await fetch(
        'https://www.strava.com/api/v3/athlete/activities?per_page=30',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const activities = await activitiesRes.json();

      // Step 3: Fetch athlete stats
      const athleteRes = await fetch(
        'https://www.strava.com/api/v3/athlete',
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const athlete = await athleteRes.json();

      const statsRes = await fetch(
        `https://www.strava.com/api/v3/athletes/${athlete.id}/stats`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const stats = await statsRes.json();

      // Step 4: Return combined data
      return new Response(JSON.stringify({
        athlete: {
          name: `${athlete.firstname} ${athlete.lastname}`,
          weight: athlete.weight,
        },
        stats: {
          totalRuns: stats.all_run_totals?.count || 0,
          totalKm: Math.round((stats.all_run_totals?.distance || 0) / 1000),
          ytdKm: Math.round((stats.ytd_run_totals?.distance || 0) / 1000),
        },
        activities: activities
          .filter(a => a.sport_type === 'Run')
          .slice(0, 20)
          .map(a => ({
            id: a.id,
            name: a.name,
            date: a.start_date_local?.split('T')[0],
            dist: Math.round(a.distance) / 1000,
            time: a.moving_time,
            pace: a.moving_time > 0 ? ((a.moving_time / 60) / (a.distance / 1000)).toFixed(2) : null,
            avgHR: a.average_heartrate || null,
            maxHR: a.max_heartrate || null,
            calories: a.calories || 0,
            gear: a.gear_id,
            prs: a.pr_count || 0,
          })),
        synced: new Date().toISOString(),
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'max-age=300', // 5 min cache
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
