import { getOpenAIClient } from '@/lib/openai/client';
import { UserProfile, BioAndSocialGenerationResponse, AIBioAndSocialResult } from '@/types/profile';
import { generateSocialUrl } from '@/lib/utils/profileTransforms';

// AI-discoverable social platforms (excludes phone-based platforms handled by PhoneBasedSocialService)
const AI_DISCOVERABLE_PLATFORMS = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat'] as const;
type Platform = typeof AI_DISCOVERABLE_PLATFORMS[number];

export class BioAndSocialGenerationService {
  // Verification strategy for each platform
  private static readonly VERIFICATION_STRATEGY: Record<string, 'skip' | 'error-check' | 'status-check'> = {
    instagram: 'skip',
    linkedin: 'skip', // LinkedIn has anti-scraping (999 errors), skip verification
    facebook: 'status-check',
    x: 'status-check',
    snapchat: 'status-check'
  };

  // HTTP headers for profile verification
  private static readonly USER_AGENT = 'Mozilla/5.0 (compatible; ProfileBot/1.0)';

  /**
   * Main entry point for discovering bio and social media usernames
   * Returns simple username objects - caller handles ContactEntry creation
   */
  static async generateBioAndSocialLinks(profile: UserProfile): Promise<BioAndSocialGenerationResponse> {
    try {
      const userName = profile.contactEntries?.find(e => e.fieldType === 'name')?.value || '';
      const emailEntry = profile.contactEntries?.find(e => e.fieldType === 'email');
      const emailUsername = this.extractUsernameFromEmail(emailEntry?.value || '');

      // AI discovery
      let aiResult: AIBioAndSocialResult;
      try {
        aiResult = await this.discoverSocialProfilesAndBio(userName, emailEntry?.value || '');
      } catch (error) {
        console.error(`[BioAndSocialGeneration] AI discovery failed for ${userName}:`, error);
        aiResult = { bio: `No profile returned :(`, socialProfiles: {} };
      }

      // Clean and prepare usernames for verification
      const usernames: Record<string, string | null> = {};
      for (const platform of AI_DISCOVERABLE_PLATFORMS) {
        let username = aiResult.socialProfiles[platform];

        // Use AI username if valid, otherwise fall back to email username
        if (!this.isValidUsername(username)) {
          username = emailUsername;
        }

        // Clean LinkedIn "in/" prefix
        if (platform === 'linkedin') {
          username = this.cleanLinkedInUsername(username);
        }

        usernames[platform] = username || null;
      }

      // Verify usernames in parallel
      const verified = await this.verifyUsernames(usernames);

      // Count discoveries
      const socialProfilesDiscovered = Object.values(aiResult.socialProfiles).filter(p => p !== null && p !== undefined).length;
      const socialProfilesVerified = Object.values(verified).filter(v => v === true).length;

      return {
        bio: aiResult.bio,
        socialProfiles: usernames,
        verified,
        success: true,
        socialProfilesDiscovered,
        socialProfilesVerified
      };
    } catch (error) {
      console.error(`[BioAndSocialGeneration] Error:`, error);

      // Simple fallback
      const emailEntry = profile.contactEntries?.find(e => e.fieldType === 'email');
      const emailUsername = this.extractUsernameFromEmail(emailEntry?.value || '');

      const fallbackUsernames: Record<string, string | null> = {};
      for (const platform of AI_DISCOVERABLE_PLATFORMS) {
        fallbackUsernames[platform] = emailUsername || null;
      }

      return {
        bio: `No bio returned.`,
        socialProfiles: fallbackUsernames,
        verified: {},
        success: false,
        socialProfilesDiscovered: 0,
        socialProfilesVerified: 0
      };
    }
  }
  
  /**
   * Single AI call to discover both bio and social media profiles
   */
  private static async discoverSocialProfilesAndBio(name: string, email: string): Promise<AIBioAndSocialResult> {
    const openai = getOpenAIClient();

    // Optimized prompt for GPT-5-mini with limited web searches for speed
    const prompt = `Research "${name}" (email: ${email}) using web search to find their real social media profiles and create a personalized bio.

SEARCH STRATEGY (EXACTLY 6 SEARCHES):
1. ONE search for "${name} ${email}" to understand who they are
2. ONE search for "${email.split('@')[0]} social media" to find profiles
3. ONE search for "${name} Instagram" to find Instagram profile
4. ONE search for "${name} X Twitter" to find X/Twitter profile
5. ONE search for "${name} Facebook" to find Facebook profile
6. ONE search for "${name} LinkedIn" to find LinkedIn profile

CRITICAL USERNAME RULES:
❌ NEVER invent, guess, or create usernames that don't appear in your search results
❌ NEVER add numbers or hyphens to names unless they appeared in an actual URL
❌ If you cannot find a real profile URL in your search results, return null

✅ ONLY return usernames that you found in actual URLs from web search
✅ *IMPORTANT* If you find multiple profiles for the same person, ALWAYS prioritize the one where the username is "${email.split('@')[0]}" (the email prefix) over any other usernames
✅ Names must match reasonably (nicknames acceptable, but be cautious)

MANDATORY VERIFICATION STEP:
Before returning ANY username, you MUST verify each URL actually works by checking it with web search.
For each platform where you found a username:
1. Search for the exact URL (e.g., "site:instagram.com/username" or direct URL check)
2. If the URL returns a 404, doesn't exist, shows "user not found", or shows "Sorry, this page isn't available", set that platform to null
3. Only return usernames for URLs that actually exist and belong to the right person; 
it's better to return null than a fake/non-existent username

PLATFORM EXTRACTION RULES:
- LinkedIn: extract slug after "linkedin.com/in/" (e.g., "cool_username" from "linkedin.com/in/cool_username")
- Facebook: extract username after "facebook.com/" 
- Instagram: extract handle without @ symbol
- X/Twitter: extract handle without @ symbol

Bio Creation:
- Generate a hyper-personalized bio (max 14 words, exclude their first/last name)
- Use information from your limited searches efficiently
- Maximum one semicolon (;) in the bio
- PRIORITIZE ACTIVE PROFILES: If user has made a post recently, that profile bio is much more important
- PRIORITIZE SPEED: Don't over-research, use the first good results you find

Return your findings as JSON with this exact structure:
{
  "bio": "personalized bio text here",
  "socialProfiles": {
    "facebook": "username_or_null",
    "instagram": "username_or_null", 
    "linkedin": "username_or_null",
    "x": "username_or_null"
  }
}`;

    try {
      // Use GPT-5-mini with Responses API (GPT-5-nano has privacy restrictions, GPT-5-mini works perfectly)
      const response = await openai.responses.create({
        model: 'gpt-5-mini',
        input: prompt,
        tools: [
          {
            type: 'web_search'
          }
        ],
        max_output_tokens: 8000,
        max_tool_calls: 6, // Limit to exactly 6 web searches for speed and cost control
        store: true
      });

      // Check if response is incomplete due to token limits
      const anyResponse: { status?: string; incomplete_details?: { reason?: string }; output?: unknown; generated_text?: string } = response;
      if (anyResponse.status === 'incomplete') {
        throw new Error(`GPT-5 response incomplete: ${anyResponse.incomplete_details?.reason || 'unknown reason'}`);
      }

      // Extract JSON from 2025 Responses API - response structure is output[1].content[0].text
      let result: AIBioAndSocialResult;

      // 2025 Responses API: Text content is in output array -> message -> content -> text
      if (anyResponse.output && Array.isArray(anyResponse.output)) {
        // Look for message type output (usually index 1 after reasoning)
        const messageOutput = anyResponse.output.find((item: { type?: string; content?: Array<{ text?: string }> }) => item.type === 'message');

        if (messageOutput?.content?.[0]?.text) {
          try {
            result = JSON.parse(messageOutput.content[0].text.trim());
          } catch (parseError) {
            console.error('[BioAndSocialGeneration] Failed to parse JSON from message content:', parseError);
            throw new Error('Invalid JSON response from GPT-5');
          }
        } else {
          throw new Error('No message content found in GPT-5 response');
        }
      }
      // Fallback: Direct JSON in output field (for schema-validated responses)
      else if (anyResponse.output && typeof anyResponse.output === 'object' && !Array.isArray(anyResponse.output)) {
        result = anyResponse.output as unknown as AIBioAndSocialResult;
      }
      else {
        throw new Error('No valid output from GPT-5 response');
      }

      // Validate the response structure
      if (!result.bio || !result.socialProfiles) {
        throw new Error('Invalid response structure from AI');
      }

      return result as AIBioAndSocialResult;
    } catch (error) {
      console.error('[BioAndSocialGeneration] AI Bio & Links failed:', error);
      throw error;
    }
  }
  
  /**
   * Verify usernames in parallel
   * Returns object mapping platform -> boolean (true if verified)
   */
  private static async verifyUsernames(
    usernames: Record<string, string | null>
  ): Promise<Record<string, boolean>> {
    const verificationPromises: Promise<[string, boolean]>[] = [];

    for (const [platform, username] of Object.entries(usernames)) {
      if (!username) {
        verificationPromises.push(Promise.resolve([platform, false]));
        continue;
      }

      const strategy = this.VERIFICATION_STRATEGY[platform];
      if (strategy === 'skip') {
        verificationPromises.push(Promise.resolve([platform, true]));
      } else if (strategy === 'status-check') {
        verificationPromises.push(
          this.httpVerifyWithStatusCheck(platform, username).then(valid => [platform, valid])
        );
      } else {
        verificationPromises.push(Promise.resolve([platform, false]));
      }
    }

    try {
      const results = await Promise.allSettled(verificationPromises);
      const verified: Record<string, boolean> = {};

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const [platform, isValid] = result.value;
          verified[platform] = isValid;
        } else {
          console.error('[BioAndSocialGeneration] Verification failed:', result.reason);
        }
      }

      return verified;
    } catch (error) {
      console.error('[BioAndSocialGeneration] Batch verification error:', error);
      return {};
    }
  }
  
  /**
   * Fetch URL with timeout
   */
  private static async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = 5000
  ): Promise<Response> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    });

    const requestPromise = fetch(url, options);

    return Promise.race([requestPromise, timeoutPromise]);
  }

  /**
   * HTTP verification for platforms that only need status code checking
   */
  private static async httpVerifyWithStatusCheck(platform: string, username: string): Promise<boolean> {
    try {
      const url = generateSocialUrl(platform, username, true);

      const response = await this.fetchWithTimeout(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ProfileBot/1.0)',
        },
      });

      // Accept 2xx and 3xx status codes
      return response.status >= 200 && response.status < 400;
    } catch (error) {
      console.error(`[BioAndSocialGeneration] Status check verification failed for ${platform}/${username}:`, error);
      return false;
    }
  }

  
  /**
   * Clean LinkedIn username by removing "in/" prefix if present
   */
  private static cleanLinkedInUsername(username: string | null | undefined): string | null {
    if (!username || username === 'null' || username.trim() === '') {
      return null;
    }
    
    const cleaned = username.trim().replace(/^in\//, '');
    return cleaned !== '' ? cleaned : null;
  }
  
  /**
   * Check if a username value from AI is valid (not null, undefined, or string "null")
   */
  private static isValidUsername(username: string | null | undefined): username is string {
    return username !== null && username !== undefined && username !== 'null' && username.trim() !== '';
  }
  
  /**
   * Extract username from email address
   */
  private static extractUsernameFromEmail(email: string): string {
    if (!email || !email.includes('@')) return '';
    return email.split('@')[0];
  }
  
} 