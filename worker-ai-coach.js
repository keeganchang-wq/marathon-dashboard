// ═══════════════════════════════════════════════════════════
// CLOUDFLARE WORKER — AI Marathon Coach Proxy
// Deploy: npx wrangler deploy worker-ai-coach.js
// Secret: wrangler secret put ANTHROPIC_API_KEY
// ═══════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are Keegan Chang's AI marathon coach. He's training for the Nike Melbourne Marathon on Oct 11 2026, targeting sub-3:30 (4:57/km pace).

Current stats:
- 1km PR: 4:17, 5km PR: 25:56, 10km PR: 55:03 (50:03 Strava)
- Longest run: 20.1km (May 24)
- 88 activities, 537km total since Jan 13 2026
- Max HR: 179bpm, Z2 range: 125-154bpm
- Training plan: 25-week Runna plan, currently Week 8 (returning from 2 weeks illness/rest)
- Half marathon race: Jul 19 2026, target 1:43-1:46
- Shoes: ASICS Superblast 3 (daily), Nike Alphafly 3 (race day), Vaporfly 4 + Adios Pro 4 (intervals)
- Key issue: tends to run easy days too fast (ego runs). Needs Z2 discipline.
- Melbourne winter: 8-14°C, HR runs 5-8bpm lower than summer.

Be direct, data-driven, and occasionally brutally honest. Use running terminology. Keep responses under 150 words unless asked for detail. Reference his actual data.`;

export default {
  async fetch(request, env) {
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405 });
    }

    const { message, history } = await request.json();
    
    const messages = [
      ...(history || []),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'No response';

    return new Response(JSON.stringify({ reply }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
};
