/**
 * Client helper to call scrape-bio API endpoint.
 * On web, NextAuth session cookie handles auth automatically.
 */
export async function scrapeBio(
  platform: 'instagram' | 'linkedin',
  username: string
): Promise<{ bio: string | null; success: boolean }> {
  try {
    const response = await fetch('/api/profile/scrape-bio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, username }),
    });

    if (!response.ok) {
      console.error('[scrapeBio] API error:', response.status);
      return { bio: null, success: false };
    }

    return await response.json();
  } catch (error) {
    console.error('[scrapeBio] Failed:', error);
    return { bio: null, success: false };
  }
}
