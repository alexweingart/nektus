import { getOpenAIClient } from '@/lib/openai/client';
import { UserProfile, BioAndSocialGenerationResponse, AIBioAndSocialResult, ContactEntry } from '@/types/profile';
import { getFieldValue } from '@/lib/utils/profileTransforms';

// Internal interface for social profile verification - used within this service only
interface SocialProfile {
  username: string;
  url: string;
  userConfirmed: boolean;
  automatedVerification: boolean;
  discoveryMethod: 'ai' | 'email-guess' | 'phone-guess' | 'manual';
  fieldSection: {
    section: 'personal' | 'work' | 'hidden';
    order: number;
  };
}

export class BioAndSocialGenerationService {
  /**
   * Main entry point for generating both bio and social media links in a unified call
   */
  static async generateBioAndSocialLinks(profile: UserProfile): Promise<BioAndSocialGenerationResponse> {
    try {
      const userName = getFieldValue(profile.contactEntries, 'name');
      console.log(`[BioAndSocialGeneration] [DEBUG] Starting unified generation for "${userName}"`);
      
      // Extract email username and phone for fallbacks
      const emailEntry = profile.contactEntries?.find(e => e.fieldType === 'email');
      const emailUsername = this.extractUsernameFromEmail(emailEntry?.value || '');
      
      console.log(`[BioAndSocialGeneration] [DEBUG] Profile data extracted:`, {
        name: userName,
        email: emailEntry?.value || 'none',
        emailUsername,
        hasPhone: false
      });
      
      // Single AI call for both bio and social discovery
      let aiResult: AIBioAndSocialResult;
      try {
        console.log(`[BioAndSocialGeneration] [DEBUG] About to call discoverSocialProfilesAndBio...`);
        aiResult = await this.discoverSocialProfilesAndBio(
          userName, 
          emailEntry?.value || ''
        );
        console.log(`[BioAndSocialGeneration] [DEBUG] AI discovery successful for ${userName}`);
      } catch (error) {
        console.error(`[BioAndSocialGeneration] [DEBUG] AI discovery failed for ${userName}:`, error);
        console.log(`[BioAndSocialGeneration] AI discovery failed for ${userName}, using fallbacks`);
        aiResult = {
          bio: `No profile returned :(`,
          socialProfiles: {}
        };
      }
      
      // Generate social profiles with AI results + fallbacks
      const socialProfiles = await this.generateAllProfiles(aiResult.socialProfiles, emailUsername);
      
      // Verify all social profiles in parallel
      const verifiedProfiles = await this.verifyProfilesBatch(socialProfiles);
      
      // Count successful discoveries and verifications
      const socialProfilesDiscovered = Object.values(aiResult.socialProfiles).filter(p => p !== null && p !== undefined).length;
      const socialProfilesVerified = Object.values(verifiedProfiles).filter(p => p?.automatedVerification === true).length;
      
      // Build contact entries with verified social profiles ONLY
      // Don't copy existing entries to avoid overwriting concurrent saves
      const newEntries: ContactEntry[] = [];
      
      // Add or update verified AI-discoverable social profiles
      const socialPlatforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat'] as const;
      socialPlatforms.forEach(platform => {
        const verifiedProfile = verifiedProfiles[platform];
        if (verifiedProfile && verifiedProfile.username) {
          const entry: ContactEntry = {
            fieldType: platform,
            value: verifiedProfile.username,
            section: platform === 'linkedin' ? 'work' as const : 'personal' as const,
            order: this.getDefaultOrder(platform),
            isVisible: true,
            confirmed: false, // AI-generated profiles are unconfirmed
            automatedVerification: verifiedProfile.automatedVerification,
            discoveryMethod: verifiedProfile.discoveryMethod
          };

          newEntries.push(entry);
        }
      });
      
      const contactEntries = newEntries;
      
      console.log(`[BioAndSocialGeneration] Generation completed for ${getFieldValue(profile.contactEntries, 'name')}`, {
        bioLength: aiResult.bio.length,
        socialProfilesDiscovered,
        socialProfilesVerified
      });
      
      return {
        bio: aiResult.bio,
        contactEntries,
        success: true,
        socialProfilesDiscovered,
        socialProfilesVerified
      };
    } catch (error) {
      console.error(`[BioAndSocialGeneration] Error generating content for ${getFieldValue(profile.contactEntries, 'name')}:`, error);
      
      // Return basic email-based fallback
      const emailEntry = profile.contactEntries?.find(e => e.fieldType === 'email');
      const emailUsername = this.extractUsernameFromEmail(emailEntry?.value || '');
      const fallbackProfiles = this.generateHeuristicProfiles(emailUsername);
      
      // Build fallback entries array with existing entries plus fallback social profiles
      const existingEntries = profile.contactEntries || [];
      const fallbackEntries = [...existingEntries];
      
      // Add fallback social profiles
      const socialPlatforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat'] as const;
      socialPlatforms.forEach(platform => {
        const fallbackProfile = fallbackProfiles[platform];
        if (fallbackProfile && fallbackProfile.username) {
          const existingIndex = fallbackEntries.findIndex(e => e.fieldType === platform);
          const entry: ContactEntry = {
            fieldType: platform,
            value: fallbackProfile.username,
            section: platform === 'linkedin' ? 'work' as const : 'personal' as const,
            order: this.getDefaultOrder(platform),
            isVisible: true,
            confirmed: false,
            automatedVerification: fallbackProfile.automatedVerification,
            discoveryMethod: fallbackProfile.discoveryMethod
          };
          
          if (existingIndex >= 0) {
            fallbackEntries[existingIndex] = entry;
          } else {
            fallbackEntries.push(entry);
          }
        }
      });
      
      return {
        bio: `No bio returned.`,
        contactEntries: fallbackEntries,
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
    console.log(`[BioAndSocialGeneration] [DEBUG] Starting discoverSocialProfilesAndBio for name="${name}", email="${email}"`);
    
    const openai = getOpenAIClient();
    console.log(`[BioAndSocialGeneration] [DEBUG] OpenAI client initialized successfully`);
    
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
      console.log(`[BioAndSocialGeneration] [DEBUG] About to call OpenAI Responses API with prompt length: ${prompt.length}`);
      console.log(`[BioAndSocialGeneration] [DEBUG] API call parameters:`, {
        model: 'gpt-5-mini',
        promptLength: prompt.length,
        tools: ['web_search'],
        max_output_tokens: 8000,
        max_tool_calls: 6
      });
      
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
      
      console.log(`[BioAndSocialGeneration] [DEBUG] OpenAI API call completed successfully`);
      console.log(`[BioAndSocialGeneration] GPT-5 discovery response:`, JSON.stringify(response, null, 2));

      // Check if response is incomplete due to token limits
      const anyResponse: { status?: string; incomplete_details?: { reason?: string }; output?: unknown; generated_text?: string } = response;
      if (anyResponse.status === 'incomplete') {
        console.error(`[BioAndSocialGeneration] [DEBUG] Response incomplete. Reason:`, anyResponse.incomplete_details?.reason);
        throw new Error(`GPT-5 response incomplete: ${anyResponse.incomplete_details?.reason || 'unknown reason'}`);
      }

      // Extract JSON from 2025 Responses API - response structure is output[1].content[0].text
      let result: AIBioAndSocialResult;

      console.log(`[BioAndSocialGeneration] [DEBUG] Starting response parsing...`);
      console.log(`[BioAndSocialGeneration] [DEBUG] Response structure check:`, {
        hasOutput: !!anyResponse.output,
        outputType: Array.isArray(anyResponse.output) ? 'array' : typeof anyResponse.output,
        outputLength: Array.isArray(anyResponse.output) ? anyResponse.output.length : 'n/a',
        status: anyResponse.status
      });

      // 2025 Responses API: Text content is in output array -> message -> content -> text
      if (anyResponse.output && Array.isArray(anyResponse.output)) {
        console.log(`[BioAndSocialGeneration] [DEBUG] Found output array with ${anyResponse.output.length} items`);
        
        // Look for message type output (usually index 1 after reasoning)
        const messageOutput = anyResponse.output.find((item: { type?: string; content?: Array<{ text?: string }> }) => item.type === 'message');
        console.log(`[BioAndSocialGeneration] [DEBUG] Message output found:`, !!messageOutput);
        
        if (messageOutput?.content?.[0]?.text) {
          console.log(`[BioAndSocialGeneration] [DEBUG] Raw response text:`, messageOutput.content[0].text);
          try {
            result = JSON.parse(messageOutput.content[0].text.trim());
            console.log(`[BioAndSocialGeneration] [DEBUG] Successfully parsed JSON result:`, result);
          } catch (parseError) {
            console.error('[BioAndSocialGeneration] [DEBUG] Failed to parse JSON from message content:', parseError);
            console.error('[BioAndSocialGeneration] [DEBUG] Raw text that failed to parse:', messageOutput.content[0].text);
            throw new Error('Invalid JSON response from GPT-5');
          }
        } else {
          console.error('[BioAndSocialGeneration] [DEBUG] No message content found. Message output structure:', messageOutput);
          throw new Error('No message content found in GPT-5 response');
        }
      }
      // Fallback: Direct JSON in output field (for schema-validated responses)
      else if (anyResponse.output && typeof anyResponse.output === 'object' && !Array.isArray(anyResponse.output)) {
        console.log(`[BioAndSocialGeneration] [DEBUG] Using direct output object`);
        result = anyResponse.output as unknown as AIBioAndSocialResult;
      }
      // Legacy fallback for older API responses
      else if (anyResponse.generated_text) {
        console.log(`[BioAndSocialGeneration] [DEBUG] Using legacy generated_text fallback`);
        try {
          result = JSON.parse(anyResponse.generated_text.trim());
        } catch (parseError) {
          console.error('[BioAndSocialGeneration] Failed to parse JSON from generated_text:', parseError);
          throw new Error('Invalid JSON response from GPT-5');
        }
      }
      else {
        console.error('[BioAndSocialGeneration] [DEBUG] No valid output format found in response');
        throw new Error('No valid output from GPT-5 response');
      }
      
      console.log(`[BioAndSocialGeneration] Parsed result:`, result);
      
      // Validate the response structure
      if (!result.bio || !result.socialProfiles) {
        throw new Error('Invalid response structure from AI');
      }
      
      console.log(`[BioAndSocialGeneration] AI discovery completed for ${name}`, {
        bioLength: result.bio.length,
        socialProfilesFound: result.socialProfiles ? Object.values(result.socialProfiles).filter(p => p !== null).length : 0
      });
      
      return result as AIBioAndSocialResult;
          } catch (error) {
        console.error('[BioAndSocialGeneration] [DEBUG] AI Bio & Links failed with error:', error);
        console.error('[BioAndSocialGeneration] [DEBUG] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace',
          type: typeof error,
          errorObject: error
        });
        throw error;
      }
  }
  
  /**
   * Generate profiles combining AI results with heuristic fallbacks
   * Only handles AI-discoverable platforms (facebook, instagram, x, linkedin, snapchat)
   */
  private static async generateAllProfiles(
    aiResults: Record<string, string | null>, 
    emailUsername: string
  ): Promise<Record<string, SocialProfile | null>> {
    
    const profiles: Record<string, SocialProfile | null> = {};
    
    // AI platforms with fallbacks
    profiles.facebook = this.createProfile(
      this.isValidUsername(aiResults.facebook) ? aiResults.facebook! : emailUsername,
      'facebook',
      this.isValidUsername(aiResults.facebook) ? 'ai' : 'email-guess'
    );
    
    profiles.instagram = this.createProfile(
      this.isValidUsername(aiResults.instagram) ? aiResults.instagram! : emailUsername,
      'instagram', 
      this.isValidUsername(aiResults.instagram) ? 'ai' : 'email-guess'
    );
    
    // LinkedIn - clean "in/" prefix if present
    const cleanedLinkedin = this.cleanLinkedInUsername(aiResults.linkedin);
    profiles.linkedin = this.createProfile(
      cleanedLinkedin || emailUsername,
      'linkedin',
      cleanedLinkedin ? 'ai' : 'email-guess'
    );
    
    profiles.x = this.createProfile(
      this.isValidUsername(aiResults.x) ? aiResults.x! : emailUsername,
      'x',
      this.isValidUsername(aiResults.x) ? 'ai' : 'email-guess'
    );
    
    // Heuristic-based platforms
    profiles.snapchat = this.createProfile(emailUsername, 'snapchat', 'email-guess');
    
    // Phone-based platforms (WhatsApp, Telegram, WeChat) are now handled 
    // by PhoneBasedSocialService after phone number is saved
    // This service only handles AI-discoverable platforms
    
    return profiles;
  }
  
  /**
   * Create a social profile with appropriate URL
   */
  private static createProfile(
    username: string, 
    platform: string, 
    discoveryMethod: 'ai' | 'email-guess' | 'phone-guess'
  ): SocialProfile | null {
    if (!username) return null;
    
    const url = this.generateUrl(platform, username);
    
    // Determine default section
    const defaultSection = platform === 'linkedin' ? 'work' : 'personal';
    
    return {
      username,
      url,
      userConfirmed: false,
      automatedVerification: false, // Will be set during verification
      discoveryMethod,
      fieldSection: {
        section: defaultSection,
        order: this.getDefaultOrder(platform)
      }
    };
  }
  
  /**
   * Verify all profiles in parallel
   */
  private static async verifyProfilesBatch(
    profiles: Record<string, SocialProfile | null>
  ): Promise<Record<string, SocialProfile | null>> {
    const verificationPromises: Promise<[string, SocialProfile | null]>[] = [];
    
    for (const [platform, profile] of Object.entries(profiles)) {
      if (profile) {
        verificationPromises.push(
          this.verifyIndividualProfile(platform, profile).then(verified => [platform, verified])
        );
      } else {
        verificationPromises.push(Promise.resolve([platform, null]));
      }
    }
    
    try {
      const results = await Promise.allSettled(verificationPromises);
      const verifiedProfiles: Record<string, SocialProfile | null> = {};
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const [platform, profile] = result.value;
          verifiedProfiles[platform] = profile;
        } else {
          console.error('[BioAndSocialGeneration] Verification failed:', result.reason);
        }
      }
      
      return verifiedProfiles;
    } catch (error) {
      console.error('[BioAndSocialGeneration] Batch verification error:', error);
      // Return unverified profiles as fallback
      return profiles;
    }
  }
  
  /**
   * Verify individual profile via HTTP request
   */
  private static async verifyIndividualProfile(
    platform: string, 
    profile: SocialProfile
  ): Promise<SocialProfile | null> {
    try {
      let isValid = false;
      
      // Platform-specific verification logic
      switch (platform) {
        case 'instagram':
          isValid = true; // Skip verification - trust AI discovery
          break;
        case 'linkedin':
          isValid = await this.httpVerifyWithErrorCheck(platform, profile.username);
          break;
        case 'facebook':
        case 'x':
        case 'snapchat':
          isValid = await this.httpVerifyWithStatusCheck(platform, profile.username);
          break;
        case 'whatsapp':
        case 'telegram':
        case 'wechat':
          // Phone-based platforms are now handled by PhoneBasedSocialService
          console.warn(`[BioAndSocialGeneration] Unexpected verification request for phone-based platform: ${platform}`);
          isValid = false;
          break;
        default:
          isValid = false;
      }
      
      if (isValid) {
        return {
          ...profile,
          automatedVerification: true
        };
      } else {
        console.log(`[BioAndSocialGeneration] Failed verification for ${platform}: ${profile.username}`);
        return null; // Failed verification becomes null (auto-hidden)
      }
    } catch (error) {
      console.error(`[BioAndSocialGeneration] Verification error for ${platform}:`, error);
      return null; // Error during verification becomes null
    }
  }
  
  /**
   * HTTP verification for platforms that need HTML error checking (LinkedIn)
   */
  private static async httpVerifyWithErrorCheck(platform: string, username: string): Promise<boolean> {
    const timeoutMs = 5000;
    
    try {
      // Check username format for LinkedIn
      if (platform === 'linkedin') {
        const linkedinUsernameRegex = /^[a-zA-Z0-9\-]{3,50}$/;
        if (!linkedinUsernameRegex.test(username)) {
          return false;
        }
      }

      const url = this.generateUrl(platform, username);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeoutMs);
      });
      
      const requestPromise = fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ProfileBot/1.0)',
        },
      });
      
      const response = await Promise.race([requestPromise, timeoutPromise]);
      
      if (response.status === 200) {
        const html = await response.text();
        
        // Check for error messages (LinkedIn specific)
        const errorMessages = [
          'profile not found',
          'This profile is not available',
          'User not found',
          'doesn\'t exist'
        ];
        
        const lowerHtml = html.toLowerCase();
        const hasErrorMessage = errorMessages.some(msg => lowerHtml.includes(msg));
        
        // If we find error messages, profile doesn't exist
        return !hasErrorMessage;
      }
      
      return false;
    } catch (error) {
      console.error(`[BioAndSocialGeneration] Error check verification failed for ${platform}/${username}:`, error);
      return false;
    }
  }

  /**
   * HTTP verification for platforms that only need status code checking
   */
  private static async httpVerifyWithStatusCheck(platform: string, username: string): Promise<boolean> {
    const timeoutMs = 5000;
    
    try {
      const url = this.generateUrl(platform, username);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeoutMs);
      });
      
      const requestPromise = fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ProfileBot/1.0)',
        },
      });
      
      const response = await Promise.race([requestPromise, timeoutPromise]);
      
      // Accept 2xx and 3xx status codes
      return response.status >= 200 && response.status < 400;
    } catch (error) {
      console.error(`[BioAndSocialGeneration] Status check verification failed for ${platform}/${username}:`, error);
      return false;
    }
  }

  
  /**
   * Generate heuristic profiles based on email username
   * Only handles AI-discoverable platforms (facebook, instagram, x, linkedin, snapchat)
   */
  private static generateHeuristicProfiles(emailUsername: string): Record<string, SocialProfile> {
    const profiles: Record<string, SocialProfile> = {};
    
    // Email-based profiles
    const emailPlatforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat'];
    for (const platform of emailPlatforms) {
      profiles[platform] = {
        username: emailUsername,
        url: this.generateUrl(platform, emailUsername),
        userConfirmed: false,
        automatedVerification: false,
        discoveryMethod: 'email-guess' as const,
        fieldSection: {
          section: platform === 'linkedin' ? 'work' as const : 'personal' as const,
          order: this.getDefaultOrder(platform)
        }
      };
    }
    
    // Phone-based profiles (WhatsApp, Telegram, WeChat) are now handled 
    // by PhoneBasedSocialService - fallback just returns empty profiles
    
    return profiles;
  }
  
  /**
   * Generate URL for a platform and username
   */
  private static generateUrl(platform: string, username: string): string {
    const patterns: Record<string, string> = {
      facebook: `https://facebook.com/${username}`,
      instagram: `https://instagram.com/${username}`,
      linkedin: `https://linkedin.com/in/${username}`,
      x: `https://x.com/${username}`,
      snapchat: `https://snapchat.com/add/${username}`,
      whatsapp: `https://wa.me/${username}`,
      telegram: `https://t.me/${username}`,
      wechat: `weixin://dl/chat?${username}`
    };
    
    return patterns[platform] || '';
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
  
  /**
   * Get default order for platform in UI
   */
  private static getDefaultOrder(platform: string): number {
    const orderMap: Record<string, number> = {
      phone: 0,
      email: 1,
      facebook: 2,
      instagram: 3,
      x: 4,
      snapchat: 5,
      whatsapp: 6,
      telegram: 7,
      wechat: 8,
      linkedin: 9
    };
    
    return orderMap[platform] || 99;
  }
  
} 