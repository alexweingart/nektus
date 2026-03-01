/**
 * Cloudflare Worker proxy for Instagram bio scraping.
 *
 * Instagram blocks all major cloud provider IPs (AWS, GCP, Vercel).
 * Cloudflare Workers run on CF's edge network which isn't blocked.
 *
 * Accepts: POST { username: string }
 * Returns: { bio: string | null, success: boolean }
 * Auth: X-API-Key header must match the API_KEY secret.
 */

interface Env {
  API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Auth check
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.API_KEY) {
      return json({ error: 'Unauthorized' }, 401);
    }

    try {
      const body = (await request.json()) as { username?: string };
      const username = body.username?.trim();
      if (!username) {
        return json({ error: 'Missing username' }, 400);
      }

      const bio = await scrapeInstagramBio(username);
      return json({ bio, success: !!bio });
    } catch (err) {
      return json({ error: 'Internal error', detail: String(err) }, 500);
    }
  },
};

async function scrapeInstagramBio(username: string): Promise<string | null> {
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      Accept: 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  if (html.includes('/accounts/login')) {
    return null;
  }

  // Extract bio from meta description
  // Format: "Name (@user) · Original audio · Followers, Following, Posts - ..."
  // Or: "Name (@user) on Instagram: \"Bio text\""
  const descMatch =
    html.match(/<meta\s+content="([^"]*?)"\s+name="description"/i) ||
    html.match(/<meta\s+name="description"\s+content="([^"]*?)"/i);

  if (!descMatch?.[1]) {
    return null;
  }

  const desc = descMatch[1]
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const bioMatch = desc.match(/on Instagram:\s*"(.+)"$/);
  return bioMatch?.[1]?.trim() || null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  };
}
