/**
 * iOS client helper to call scrape-bio API endpoint.
 * Uses Firebase ID token for authentication.
 */
import { getApiBaseUrl, getIdToken } from '../auth/firebase';

export async function scrapeBio(
  platform: 'instagram' | 'linkedin',
  username: string
): Promise<{ bio: string | null; success: boolean }> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const idToken = await getIdToken();
    if (!idToken) {
      console.error('[scrapeBio] No Firebase ID token available');
      return { bio: null, success: false };
    }

    const response = await fetch(`${apiBaseUrl}/api/profile/scrape-bio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ platform, username }),
    });

    if (!response.ok) {
      console.error('[scrapeBio] API error:', response.status);
      return { bio: null, success: false };
    }

    const result = await response.json();
    console.log(`[scrapeBio] ${platform}/${username} → success=${result.success}, bio=${result.bio ? `"${result.bio.substring(0, 50)}..."` : 'null'}`);
    return result;
  } catch (error) {
    console.error('[scrapeBio] Failed:', error);
    return { bio: null, success: false };
  }
}
