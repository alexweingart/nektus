import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getFirebaseAdmin } from '@/server/config/firebase';

/**
 * Get user ID from either NextAuth session or Firebase ID token
 */
async function getUserId(req: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return session.user.id;
  }

  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const idToken = authHeader.replace('Bearer ', '');
      const { auth } = await getFirebaseAdmin();
      const decodedToken = await auth.verifyIdToken(idToken);
      if (decodedToken.uid) {
        return decodedToken.uid;
      }
    } catch (error) {
      console.error('[API/SCRAPE-BIO] Failed to verify Firebase ID token:', error);
    }
  }

  return null;
}

/**
 * Scrape bio from Instagram or LinkedIn public profile page.
 * Instagram: Cloudflare Worker proxy (Instagram blocks all Vercel/AWS/GCP IPs).
 * LinkedIn: direct scrape (cloud IPs aren't blocked).
 */
async function scrapeBioFromUrl(platform: 'instagram' | 'linkedin', username: string): Promise<string | null> {
  if (platform === 'instagram') {
    return scrapeInstagramBioViaWorker(username);
  }

  return scrapeLinkedInBio(username);
}

/**
 * Scrape Instagram bio via Cloudflare Worker proxy.
 * Instagram blocks ALL cloud provider IPs (Vercel, AWS, GCP) regardless of User-Agent.
 * Cloudflare Workers run on CF's edge network which uses different IPs that aren't blocked.
 */
async function scrapeInstagramBioViaWorker(username: string): Promise<string | null> {
  const workerUrl = process.env.CF_INSTAGRAM_WORKER_URL;
  const workerKey = process.env.CF_INSTAGRAM_WORKER_KEY;

  if (!workerUrl || !workerKey) {
    console.error('[API/SCRAPE-BIO] Missing CF_INSTAGRAM_WORKER_URL or CF_INSTAGRAM_WORKER_KEY env vars');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': workerKey,
      },
      body: JSON.stringify({ username }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[API/SCRAPE-BIO] CF Worker returned ${response.status} for ${username}`);
      return null;
    }

    const result = await response.json() as { bio: string | null; success: boolean };
    if (result.bio) {
      console.log(`[API/SCRAPE-BIO] Got Instagram bio via CF Worker: "${result.bio.substring(0, 50)}..."`);
    } else {
      console.log(`[API/SCRAPE-BIO] CF Worker: no bio found for ${username}`);
    }
    return result.bio || null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[API/SCRAPE-BIO] CF Worker timeout for ${username}`);
    } else {
      console.error(`[API/SCRAPE-BIO] CF Worker error:`, error);
    }
    return null;
  }
}

/**
 * Direct scrape for LinkedIn — cloud IPs aren't blocked.
 * Extracts About section from meta description, stripping boilerplate.
 */
async function scrapeLinkedInBio(username: string): Promise<string | null> {
  const url = `https://www.linkedin.com/in/${username}/`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[API/SCRAPE-BIO] LinkedIn returned ${response.status} for ${username}`);
      return null;
    }

    const html = await response.text();
    console.log(`[API/SCRAPE-BIO] Got ${html.length} chars from linkedin/${username}`);

    return extractLinkedInBio(html);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[API/SCRAPE-BIO] Timeout scraping LinkedIn for ${username}`);
    } else {
      console.error(`[API/SCRAPE-BIO] Error scraping LinkedIn:`, error);
    }
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function extractLinkedInBio(html: string): string | null {
  // Try JSON-LD Person.description first
  const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch?.[1]) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const person = jsonLd['@graph']?.find((x: Record<string, unknown>) => x['@type'] === 'Person');
      if (person?.description && person.description.length > 5) {
        console.log(`[API/SCRAPE-BIO] Found LinkedIn bio via JSON-LD Person.description`);
        return person.description.trim();
      }
    } catch {
      // Fall through
    }
  }

  // Extract from og:description / meta description
  // LinkedIn format: "About text… · Experience: Company · Education: School · Location: City · N connections..."
  // Strip the structured boilerplate to get just the About section
  const ogMatch = html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]*?)"/i)
    || html.match(/<meta\s+content="([^"]*?)"\s+(?:property|name)="og:description"/i);
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*?)"/i)
    || html.match(/<meta\s+content="([^"]*?)"\s+name="description"/i);

  const rawDesc = ogMatch?.[1] || descMatch?.[1];
  if (rawDesc) {
    const decoded = decodeHtmlEntities(rawDesc).trim();
    // Extract the About section before "· Experience:" boilerplate
    const aboutMatch = decoded.match(/^([\s\S]+?)\s*·\s*Experience:/);
    if (aboutMatch?.[1]) {
      const about = aboutMatch[1].trim();
      if (about.length > 5) {
        console.log(`[API/SCRAPE-BIO] Found LinkedIn bio from About section: "${about.substring(0, 50)}..."`);
        return about;
      }
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { platform, username } = body as { platform: string; username: string };

    if (!platform || !username) {
      return NextResponse.json({ error: 'Missing platform or username' }, { status: 400 });
    }

    if (platform !== 'instagram' && platform !== 'linkedin') {
      return NextResponse.json({ error: 'Platform must be instagram or linkedin' }, { status: 400 });
    }

    // Clean username: strip URL prefixes, @, and trailing slashes
    let cleanUsername = username.replace(/^@/, '').trim();
    cleanUsername = cleanUsername.replace(/^https?:\/\/(www\.)?(instagram\.com|linkedin\.com(\/in)?)\/?/i, '');
    cleanUsername = cleanUsername.replace(/\/+$/, '');

    console.log(`[API/SCRAPE-BIO] Scraping ${platform} bio for user ${userId}, handle: ${username} → clean: ${cleanUsername}`);

    const bio = await scrapeBioFromUrl(platform, cleanUsername);

    // Return scraped bio to client — client handles saving to avoid race conditions
    return NextResponse.json({ bio: bio || null, success: !!bio });
  } catch (error) {
    console.error(`[API/SCRAPE-BIO] Error:`, error);
    return NextResponse.json({ error: 'Failed to scrape bio' }, { status: 500 });
  }
}
