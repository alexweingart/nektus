/**
 * Cloudflare Worker proxy for Instagram bio scraping.
 *
 * Instagram blocks all major cloud provider IPs (AWS, GCP, Vercel, and even CF direct fetches).
 * This worker uses DuckDuckGo search from CF's edge network to extract cached Instagram bios.
 * DDG caches Instagram meta descriptions, and doesn't block CF Worker IPs.
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
      return new Response(null, { headers: corsHeaders() });
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

/**
 * Scrape Instagram bio via DuckDuckGo HTML lite search.
 * DDG caches Instagram's meta description which contains the bio.
 * Format: "Name (@user) on Instagram: "Bio text""
 */
async function scrapeInstagramBio(username: string): Promise<string | null> {
  const searchUrl = `https://html.duckduckgo.com/html/?q=site:instagram.com/${encodeURIComponent(username)}`;

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) return null;

  const html = await response.text();
  if (html.includes('anomaly') || html.includes('botnet')) return null;

  // Decode HTML entities and strip tags to get plain text
  const plainText = html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ');

  const bioMatch = plainText.match(/on Instagram:\s*"(.+?)"/);
  return bioMatch?.[1]?.trim() || null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  };
}
