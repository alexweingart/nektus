// Test: does Vercel Edge Runtime have different outbound IPs than serverless?
// Edge runs on Vercel's CDN (different infra from AWS Lambda serverless functions)
export const runtime = 'edge';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const username = url.searchParams.get('u') || 'ajweingart';
  const igUrl = `https://www.instagram.com/${username}/`;

  try {
    const response = await fetch(igUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    const html = await response.text();
    const descMatch = html.match(/<meta\s+content="([^"]*?)"\s+name="description"/i)
      || html.match(/<meta\s+name="description"\s+content="([^"]*?)"/i);
    const desc = descMatch?.[1]
      ?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") || null;
    const bioMatch = desc?.match(/on Instagram:\s*"(.+)"$/);

    return Response.json({
      runtime: 'edge',
      httpStatus: response.status,
      finalUrl: response.url,
      htmlLength: html.length,
      hasLogin: html.includes('/accounts/login'),
      metaDescription: desc?.substring(0, 300) || null,
      extractedBio: bioMatch?.[1]?.trim() || null,
    });
  } catch (error) {
    return Response.json({ runtime: 'edge', error: String(error) });
  }
}
