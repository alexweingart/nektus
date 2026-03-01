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
 * Instagram requires Googlebot UA to get server-rendered meta tags (browser UA gets JS-only shell).
 * Falls back to DuckDuckGo search results if direct scraping fails (e.g. cloud IP blocked).
 */
async function scrapeBioFromUrl(platform: 'instagram' | 'linkedin', username: string): Promise<string | null> {
  // Try direct scraping first
  const directResult = await scrapeBioDirect(platform, username);
  if (directResult) return directResult;

  // Fallback: search engine snippet (Instagram blocks cloud IPs like Vercel)
  if (platform === 'instagram') {
    console.log(`[API/SCRAPE-BIO] Direct scrape failed, trying search fallback for ${username}`);
    return scrapeInstagramBioViaSearch(username);
  }

  return null;
}

async function scrapeBioDirect(platform: 'instagram' | 'linkedin', username: string): Promise<string | null> {
  const url = platform === 'instagram'
    ? `https://www.instagram.com/${username}/`
    : `https://www.linkedin.com/in/${username}/`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // Instagram serves JS-only shell to browser UAs — must use Googlebot to get SSR meta tags
    const userAgent = platform === 'instagram'
      ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[API/SCRAPE-BIO] ${platform} returned ${response.status} for ${username}`);
      return null;
    }

    // Detect if we were redirected to a login page (common with cloud IPs)
    const finalUrl = response.url;
    if (finalUrl && !finalUrl.includes(username)) {
      console.log(`[API/SCRAPE-BIO] Redirected away from profile: ${url} → ${finalUrl}`);
    }

    const html = await response.text();
    console.log(`[API/SCRAPE-BIO] Got ${html.length} chars from ${platform}/${username}`);

    if (platform === 'instagram') {
      return extractInstagramBio(html);
    }

    // LinkedIn: extract About section from meta description (headline isn't in server-rendered HTML)
    return extractLinkedInBio(html);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[API/SCRAPE-BIO] Timeout scraping ${platform} for ${username}`);
    } else {
      console.error(`[API/SCRAPE-BIO] Error scraping ${platform}:`, error);
    }
    return null;
  }
}

/**
 * Fallback: fetch Instagram bio from DuckDuckGo search snippet.
 * DDG caches Instagram's meta description which contains the bio in the format:
 *   "X Followers, Y Following, Z Posts - Name (@user) on Instagram: "Bio text""
 */
async function scrapeInstagramBioViaSearch(username: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const searchUrl = `https://html.duckduckgo.com/html/?q=site:instagram.com/${encodeURIComponent(username)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[API/SCRAPE-BIO] DDG search returned ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Check for bot detection
    if (html.includes('anomaly') || html.includes('botnet')) {
      console.log(`[API/SCRAPE-BIO] DDG bot detection triggered`);
      return null;
    }

    // DDG snippets contain the Instagram meta description with HTML entities
    const decoded = decodeHtmlEntities(html);

    // Look for the Instagram description pattern anywhere in the DDG results
    // Format: "X Followers, Y Following, Z Posts - Name (@user) on Instagram: "Bio text""
    const snippetMatch = decoded.match(/on Instagram:\s*"(.+?)"/);
    if (snippetMatch?.[1]) {
      const bio = snippetMatch[1].trim();
      if (bio.length > 0) {
        console.log(`[API/SCRAPE-BIO] Found Instagram bio via DDG search: "${bio.substring(0, 50)}..."`);
        return bio;
      }
    }

    console.log(`[API/SCRAPE-BIO] DDG search returned no bio for ${username}`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[API/SCRAPE-BIO] DDG search timeout for ${username}`);
    } else {
      console.error(`[API/SCRAPE-BIO] DDG search error:`, error);
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

function decodeJsonString(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .trim();
}

function extractInstagramBio(html: string): string | null {
  // 1. Try "biography" field in embedded JSON data (most reliable, if present)
  const bioPatterns = [
    /"biography"\s*:\s*"((?:[^"\\]|\\.)*)"/,
    /"bio"\s*:\s*"((?:[^"\\]|\\.)*)"/,
    /biography['"]\s*:\s*['"]((?:[^'"\\]|\\.)*)['"]/,
  ];

  for (const pattern of bioPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const bio = decodeJsonString(match[1]);
      if (bio.length > 0) {
        console.log(`[API/SCRAPE-BIO] Found Instagram bio via JSON pattern: "${bio.substring(0, 50)}..."`);
        return bio;
      }
    }
  }

  // 2. Try JSON-LD structured data
  const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch?.[1]) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd.description && jsonLd.description.length > 5) {
        console.log(`[API/SCRAPE-BIO] Found Instagram bio via JSON-LD`);
        return jsonLd.description.trim();
      }
    } catch {
      // Fall through
    }
  }

  // 3. Extract bio from meta description (Googlebot UA)
  // Instagram meta description format with bio:
  //   "177 Followers, 34 Following, 0 Posts - Name (@user) on Instagram: "Bio text here.""
  // Without bio:
  //   "177 Followers, 34 Following, 0 Posts - See Instagram photos and videos from Name (@user)"
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*?)"/i)
    || html.match(/<meta\s+content="([^"]*?)"\s+name="description"/i);
  if (descMatch?.[1]) {
    const desc = decodeHtmlEntities(descMatch[1]);
    const bio = extractBioFromInstagramDescription(desc);
    if (bio) {
      console.log(`[API/SCRAPE-BIO] Found Instagram bio from meta description: "${bio.substring(0, 50)}..."`);
      return bio;
    }
  }

  // 4. Same extraction from og:description
  const ogDescMatch = html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]*?)"/i)
    || html.match(/<meta\s+content="([^"]*?)"\s+(?:property|name)="og:description"/i);
  if (ogDescMatch?.[1]) {
    const desc = decodeHtmlEntities(ogDescMatch[1]);
    const bio = extractBioFromInstagramDescription(desc);
    if (bio) {
      console.log(`[API/SCRAPE-BIO] Found Instagram bio from og:description: "${bio.substring(0, 50)}..."`);
      return bio;
    }
  }

  console.log(`[API/SCRAPE-BIO] Could not extract Instagram bio from HTML`);
  return null;
}

/**
 * Extract bio text from Instagram's meta description format.
 * Format: "X Followers, Y Following, Z Posts - Name (@user) on Instagram: "Bio text""
 * The bio is quoted at the end after "on Instagram: "
 */
function extractBioFromInstagramDescription(desc: string): string | null {
  // Look for quoted bio after "on Instagram:" pattern
  // The bio is wrapped in &quot; (decoded to ") at the end of the description
  const bioMatch = desc.match(/on Instagram:\s*"(.+)"$/);
  if (bioMatch?.[1]) {
    const bio = bioMatch[1].trim();
    if (bio.length > 0) return bio;
  }

  // Also try with escaped quotes that might not have been fully decoded
  const bioMatch2 = desc.match(/on Instagram:\s*(?:&quot;|"|")(.+?)(?:&quot;|"|")$/);
  if (bioMatch2?.[1]) {
    const bio = bioMatch2[1].trim();
    if (bio.length > 0) return bio;
  }

  return null;
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
