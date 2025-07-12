import { getOpenAIClient } from '@/lib/openai/client';
import { UserProfile, ContactChannels, SocialProfile, BioAndSocialGenerationResponse, AIBioAndSocialResult } from '@/types/profile';

export class BioAndSocialGenerationService {
  /**
   * Main entry point for generating both bio and social media links in a unified call
   */
  static async generateBioAndSocialLinks(profile: UserProfile): Promise<BioAndSocialGenerationResponse> {
    try {
      console.log(`[BioAndSocialGeneration] Starting unified generation for ${profile.name}`);
      
      // Extract email username and phone for fallbacks
      const emailUsername = this.extractUsernameFromEmail(profile.contactChannels?.email?.email || '');
      const phoneNumber = profile.contactChannels?.phoneInfo?.internationalPhone;
      
      // Single AI call for both bio and social discovery
      let aiResult: AIBioAndSocialResult;
      try {
        aiResult = await this.discoverSocialProfilesAndBio(
          profile.name, 
          profile.contactChannels?.email?.email || ''
        );
        console.log(`[BioAndSocialGeneration] AI discovery successful for ${profile.name}`);
      } catch (error) {
        console.log(`[BioAndSocialGeneration] AI discovery failed for ${profile.name}, using fallbacks`);
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
      
      // Build contact channels with verified social profiles
      const contactChannels: ContactChannels = {
        // Preserve existing phone and email
        phoneInfo: profile.contactChannels?.phoneInfo || {
          internationalPhone: '',
          nationalPhone: '',
          userConfirmed: false
        },
        email: profile.contactChannels?.email || {
          email: '',
          userConfirmed: false
        },
        // Add verified AI-discoverable social profiles (null becomes empty profile)
        facebook: verifiedProfiles.facebook || this.createEmptyProfile('facebook'),
        instagram: verifiedProfiles.instagram || this.createEmptyProfile('instagram'),
        x: verifiedProfiles.x || this.createEmptyProfile('x'),
        linkedin: verifiedProfiles.linkedin || this.createEmptyProfile('linkedin'),
        snapchat: verifiedProfiles.snapchat || this.createEmptyProfile('snapchat'),
        // Preserve existing phone-based social profiles (handled by PhoneBasedSocialService)
        whatsapp: profile.contactChannels?.whatsapp || this.createEmptyProfile('whatsapp'),
        telegram: profile.contactChannels?.telegram || this.createEmptyProfile('telegram'),
        wechat: profile.contactChannels?.wechat || this.createEmptyProfile('wechat')
      };
      
      console.log(`[BioAndSocialGeneration] Generation completed for ${profile.name}`, {
        bioLength: aiResult.bio.length,
        socialProfilesDiscovered,
        socialProfilesVerified
      });
      
      return {
        bio: aiResult.bio,
        contactChannels,
        success: true,
        socialProfilesDiscovered,
        socialProfilesVerified
      };
    } catch (error) {
      console.error(`[BioAndSocialGeneration] Error generating content for ${profile.name}:`, error);
      
      // Return basic email-based fallback
      const emailUsername = this.extractUsernameFromEmail(profile.contactChannels?.email?.email || '');
      const fallbackProfiles = this.generateHeuristicProfiles(emailUsername);
      
      return {
        bio: `No bio returned.`,
        contactChannels: {
          phoneInfo: profile.contactChannels?.phoneInfo || { internationalPhone: '', nationalPhone: '', userConfirmed: false },
          email: profile.contactChannels?.email || { email: '', userConfirmed: false },
          facebook: fallbackProfiles.facebook,
          instagram: fallbackProfiles.instagram,
          x: fallbackProfiles.x,
          linkedin: fallbackProfiles.linkedin,
          snapchat: fallbackProfiles.snapchat,
          // Preserve existing phone-based social profiles (handled by PhoneBasedSocialService)
          whatsapp: profile.contactChannels?.whatsapp || this.createEmptyProfile('whatsapp'),
          telegram: profile.contactChannels?.telegram || this.createEmptyProfile('telegram'),
          wechat: profile.contactChannels?.wechat || this.createEmptyProfile('wechat')
        },
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
    
    // Create enhanced prompt with web search instructions (based on old bio generation)
    const systemMessage = `You are a research assistant and excellent copywriter that finds social profiles and writes personalized bios. 
    You have access to web search. Use it to find current, accurate information. Return only valid JSON objects.`;
    
    const userPrompt = `For "${name}" (email: ${email}), find their real social media profiles and create a personalized bio.

SEARCH STRATEGY:
1. Start with a web search for "${name} ${email}" to get a sense of who they are
2. Search for each platform specifically: "${name} ${email} LinkedIn", "${name} ${email} Instagram", etc.
3. Try direct URL checks:
   - facebook.com/${email.split('@')[0]}
   - instagram.com/${email.split('@')[0]}
   - linkedin.com/in/${email.split('@')[0]}
   - x.com/${email.split('@')[0]}

CRITICAL USERNAME RULES:
❌ NEVER invent, guess, or create usernames that don't appear in your search results
❌ NEVER add numbers or hyphens to names unless they appeared in an actual URL
❌ If you cannot find a real profile URL in your search results, return null

✅ ONLY return usernames that you found in actual URLs from web search
✅ *IMPORTANT* If you find multiple profiles for the same person, ALWAYS prioritize the one where the username is "${email.split('@')[0]}" (the email prefix) over any other email usernames
✅ Names must match reasonably (nicknames acceptable, but be cautious)

PLATFORM EXTRACTION RULES:
- LinkedIn: extract slug after "linkedin.com/in/" (e.g., "cool_username" from "linkedin.com/in/cool_username")
- Facebook: extract username after "facebook.com/" 
- Instagram: extract handle without @ symbol
- X/Twitter: extract handle without @ symbol

Bio Creation:
- Generate a hyper-personalized bio (max 14 words, exclude their first/last name)
- Research their background, interests, and professional info online
- Prioritize recently updated information / websites, specifically from the 4 social networks; only incorporate other sources if you feel you don't have enough information.`;

    try {
      // Use the responses API with web search and structured text format
      const response = await openai.responses.create({
        model: 'gpt-4o',
        input: [
          { role: "system" as const, content: systemMessage },
          { role: "user" as const, content: userPrompt }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "bio_and_social_response",
            strict: true,
            schema: {
              type: "object",
              properties: {
                bio: {
                  type: "string",
                  description: "Personalized bio (max 14 words, no name mentioned)"
                },
                socialProfiles: {
                  type: "object",
                  properties: {
                    facebook: {
                      type: ["string", "null"],
                      description: "Facebook username or null"
                    },
                    instagram: {
                      type: ["string", "null"], 
                      description: "Instagram handle or null"
                    },
                    linkedin: {
                      type: ["string", "null"],
                      description: "LinkedIn slug or null"
                    },
                    x: {
                      type: ["string", "null"],
                      description: "X/Twitter handle or null"
                    }
                  },
                  required: ["facebook", "instagram", "linkedin", "x"],
                  additionalProperties: false
                }
              },
              required: ["bio", "socialProfiles"],
              additionalProperties: false
            }
          }
        },
        tools: [
          {
            type: 'web_search_preview' as const,
            user_location: {
              type: 'approximate',
              country: 'US',
            },
            search_context_size: 'medium'
          }
        ],
        temperature: 0.5,
        max_output_tokens: 500,
        top_p: 1,
        store: true
      } as any);
      
      console.log(`[BioAndSocialGeneration] AI discovery response:`, response);

      // Extract the generated text with multiple fallbacks (from old bio generation)
      const anyResponse: any = response;
      let generatedContent: string = '';

      // Common field
      if (anyResponse.generated_text) {
        generatedContent = (anyResponse.generated_text as string).trim();
      }

      // Our custom type path
      if (!generatedContent && anyResponse.output?.text) {
        generatedContent = (anyResponse.output.text as string).trim();
      }

      // Fallback: responses API may return an array under output
      if (!generatedContent && Array.isArray(anyResponse.output)) {
        const assistantItem = anyResponse.output.find((item: any) => item.role === 'assistant');
        if (assistantItem && Array.isArray(assistantItem.content) && assistantItem.content.length > 0) {
          const firstContent = assistantItem.content[0];
          if (firstContent.text) {
            generatedContent = (firstContent.text as string).trim();
          }
        }
      }
      

      if (!generatedContent) throw new Error('No content from AI response');
      
      console.log(`[BioAndSocialGeneration] Generated content to parse:`, generatedContent);
      
      // Parse JSON response (should be clean JSON now with structured format)
      const result = JSON.parse(generatedContent);
      
      // Validate the response structure
      if (!result.bio || !result.socialProfiles) {
        throw new Error('Invalid response structure from AI');
      }
      
      console.log(`[BioAndSocialGeneration] AI discovery completed for ${name}`, {
        bioLength: result.bio.length,
        socialProfilesFound: Object.values(result.socialProfiles).filter(p => p !== null).length
      });
      
      return result;
          } catch (error) {
        console.error('[BioAndSocialGeneration] AI Bio & Links failed:', error);
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
    
    const urlPatterns: Record<string, string> = {
      facebook: `https://facebook.com/${username}`,
      instagram: `https://instagram.com/${username}`,
      linkedin: `https://linkedin.com/in/${username}`,
      x: `https://x.com/${username}`,
      snapchat: `https://snapchat.com/add/${username}`,
      whatsapp: `https://wa.me/${username}`,
      telegram: `https://t.me/${username}`,
      wechat: `weixin://dl/chat?${username}`
    };
    
    const url = urlPatterns[platform] || '';
    
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
      const isValid = await this.performVerification(platform, profile.username);
      
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
   * Perform HTTP verification for a specific platform and username
   */
  private static async performVerification(platform: string, username: string): Promise<boolean> {
    const timeoutMs = 5000; // 5 second timeout
    
    try {
      let url = '';
      let method: 'HEAD' | 'GET' = 'HEAD';
      
      switch (platform) {
        case 'facebook':
          url = `https://facebook.com/${username}`;
          break;
        case 'instagram':
          url = `https://instagram.com/${username}`;
          break;
        case 'linkedin':
          // LinkedIn has aggressive bot detection, so we'll be more permissive
          // Only verify if it looks like a reasonable username format
          const linkedinUsernameRegex = /^[a-zA-Z0-9\-]{3,50}$/;
          if (!linkedinUsernameRegex.test(username)) {
            return false;
          }
          // For LinkedIn, assume valid if username format is reasonable
          // since they block most automated verification attempts
          return true;
        case 'x':
          url = `https://x.com/${username}`;
          break;
        case 'snapchat':
          url = `https://snapchat.com/add/${username}`;
          break;
        case 'whatsapp':
        case 'telegram':
        case 'wechat':
          // Phone-based platforms are now handled by PhoneBasedSocialService
          // This service should not be verifying these platforms
          console.warn(`[BioAndSocialGeneration] Unexpected verification request for phone-based platform: ${platform}`);
          return false;
        default:
          return false;
      }
      
      if (!url) return false;
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeoutMs);
      });
      
      // Make the request
      const requestPromise = fetch(url, {
        method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ProfileBot/1.0)',
        },
      });
      
      const response = await Promise.race([requestPromise, timeoutPromise]);
      
      // Accept 2xx and 3xx status codes (redirects are common for social media)
      return response.status >= 200 && response.status < 400;
    } catch (error) {
      console.error(`[BioAndSocialGeneration] Verification failed for ${platform}/${username}:`, error);
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
      facebook: 1,
      instagram: 2,
      x: 3,
      linkedin: 4,
      snapchat: 5,
      whatsapp: 6,
      telegram: 7,
      wechat: 8
    };
    
    return orderMap[platform] || 99;
  }
  
  /**
   * Create an empty profile for platforms with no data (failed verification or null values)
   */
  private static createEmptyProfile(platform: string): SocialProfile {
    return {
      username: '',
      url: '',
      userConfirmed: false,
      automatedVerification: false,
      discoveryMethod: 'manual' as const,
      fieldSection: {
        section: 'hidden' as const,  // Null/empty profiles are automatically hidden
        order: this.getDefaultOrder(platform)
      }
    };
  }
} 