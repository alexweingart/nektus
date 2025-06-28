import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/lib/firebase/admin/profileService';
import { UserProfile, ContactChannels, SocialProfile } from '@/types/profile';
import { getOpenAIClient } from '@/lib/openai/client';

/**
 * Extracts valid social media profile URLs from a user profile
 */
function getSocialProfileUrls(profile: UserProfile): string[] {
  const urls: string[] = [];
  
  if (!profile.contactChannels) return urls;
  
  // Check each social media platform for a valid URL
  const socialChannels = ['facebook', 'instagram', 'linkedin', 'x', 'snapchat', 'telegram', 'whatsapp', 'wechat'] as const;
  
  for (const channel of socialChannels) {
    const socialProfile = profile.contactChannels[channel] as SocialProfile;
    if (socialProfile && socialProfile.url && socialProfile.url.trim()) {
      urls.push(socialProfile.url);
    }
  }
  
  return urls;
}

/**
 * Extracts social media usernames from a user profile
 */
function extractSocialLinks(profile: UserProfile): Record<string, string> {
  const links: Record<string, string> = {};
  
  if (!profile.contactChannels) return links;
  
  // Check each social media platform for a username
  const socialChannels = ['facebook', 'instagram', 'linkedin', 'x', 'snapchat', 'telegram', 'whatsapp', 'wechat'] as const;
  
  for (const channel of socialChannels) {
    const socialProfile = profile.contactChannels[channel] as SocialProfile;
    if (socialProfile && socialProfile.username && socialProfile.username.trim()) {
      links[channel] = socialProfile.username;
    }
  }
  
  return links;
}

/**
 * Creates a text prompt to generate a bio based on user profile data.
 */
function generateBioPrompt(profile: UserProfile, socialProfileUrls: string[], socialLinks: Record<string, string>): string {
  // Create a prompt that includes available user information
  let prompt = `Generate a hyper-personalized bio for a person named ${profile.name}. 
  The bio should be no more than 14 words. Only return the bio text, nothing else. 
  Do not mention their name in the bio.`;

  // Add social profile URLs to the prompt if available
  if (socialProfileUrls.length > 0) {
    const socialLinksText = socialProfileUrls.join(', ');
    prompt += ` Please follow these web links, which may belong to${profile.name}: ${socialLinksText}. 
    Particularly look at the bio sections of the webpages to generate your bio summary. 
    The more recent the webpage was updated, the more important it is. 
    If the name on the webpage does not match the name of the person, do not use that webpage.
    You can always do a web search to look up more about ${profile.name} if needed. Their email is ${profile.contactChannels?.email?.email}.`;
  }
  
  return prompt;
}

/**
 * This is a server-side function.
 * Generates a short bio for a user profile using OpenAI.
 * 
 * @param profile The user profile containing name and other details
 * @returns A string containing the generated bio
 */
async function generateBioForProfile(profile: UserProfile): Promise<string> {
  try {
    // Extract social profile URLs and links
    const socialProfileUrls = getSocialProfileUrls(profile);
    
    // Also check extractSocialLinks
    const socialLinks = extractSocialLinks(profile);
    
    // Generate the prompt
    const prompt = generateBioPrompt(profile, socialProfileUrls, socialLinks);
    
    // Log the start of bio generation with prompt
    console.log(`[API/BIO] Bio generation starts for ${profile.name}`, { prompt });
    
    // Get OpenAI client
    const openai = getOpenAIClient();
    
    // Create the system and user messages
    const systemMessage = "You are an amazing copywriter that generates short, personalized, and specific personal bios.";
    const userMessage = `${prompt}`;
    
    // Configure request parameters for web search-enhanced generation
    const requestParams = {
      model: 'gpt-4.1',
      input: [
        { role: "system" as const, content: systemMessage },
        { role: "user" as const, content: userMessage }
      ],
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
      temperature: 0.8,
      max_output_tokens: 150,
      top_p: 1,
      store: true
    } as any;
    
    const response = await openai.responses.create(requestParams);
    
    // Extract the generated text with multiple fallbacks because response schema can vary
    const anyResponse: any = response;
    let generatedBio: string = '';

    // Common field
    if (anyResponse.generated_text) {
      generatedBio = (anyResponse.generated_text as string).trim();
    }

    // Our custom type path
    if (!generatedBio && anyResponse.output?.text) {
      generatedBio = (anyResponse.output.text as string).trim();
    }

    // Fallback: responses API may return an array under output
    if (!generatedBio && Array.isArray(anyResponse.output)) {
      const assistantItem = anyResponse.output.find((item: any) => item.role === 'assistant');
      if (assistantItem && Array.isArray(assistantItem.content) && assistantItem.content.length > 0) {
        const firstContent = assistantItem.content[0];
        if (firstContent.text) {
          generatedBio = (firstContent.text as string).trim();
        }
      }
    }
    
    // Log completion of bio generation
    console.log(`[API/BIO] Bio generation completed for ${profile.name}`, { bio: generatedBio });
    
    return generatedBio;
  } catch (error) {
    console.error('[API/BIO] Error generating bio:', error);
    throw error;
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    let userProfile = await AdminProfileService.getProfile(userId);

    // If profile doesn't exist yet, use the session data to create a minimal profile
    if (!userProfile) {
      userProfile = {
        userId: userId,
        name: session.user.name || '',
        profileImage: session.user.image || '',
        bio: '',
        backgroundImage: '',
        lastUpdated: Date.now(),
        aiGeneration: {
          bioGenerated: false,
          backgroundImageGenerated: false,
          avatarGenerated: false
        },
        contactChannels: {
          phoneInfo: {
            internationalPhone: '',
            nationalPhone: '',
            userConfirmed: false
          },
          email: { email: session.user.email || '', userConfirmed: !!session.user.email },
          facebook: { username: '', url: '', userConfirmed: false },
          instagram: { username: '', url: '', userConfirmed: false },
          x: { username: '', url: '', userConfirmed: false },
          linkedin: { username: '', url: '', userConfirmed: false },
          snapchat: { username: '', url: '', userConfirmed: false },
          whatsapp: { username: '', url: '', userConfirmed: false },
          telegram: { username: '', url: '', userConfirmed: false },
          wechat: { username: '', url: '', userConfirmed: false }
        }
      };
    }

    console.log(`[API/BIO] Starting bio generation flow for user ${userId}`);

    // Generate bio
    try {
      const bio = await generateBioForProfile(userProfile);
      
      console.log(`[API/BIO] Bio generated successfully: "${bio}"`);
      console.log(`[API/BIO] About to save bio to Firebase for user ${userId}`);
      
      // Update profile in Firebase
      try {
        await AdminProfileService.updateProfile(userId, { 
          bio,
          aiGeneration: {
            bioGenerated: true,
            avatarGenerated: userProfile.aiGeneration?.avatarGenerated || false,
            backgroundImageGenerated: userProfile.aiGeneration?.backgroundImageGenerated || false
          }
        });
        
        console.log(`[API/BIO] Bio saved to Firestore for user ${userId}`);
      } catch (saveError) {
        console.error(`[API/BIO] FAILED to save bio to Firestore for user ${userId}:`, saveError);
        // Still return the bio even if save fails, but log the error
        console.error('[API/BIO] Continuing to return bio despite save failure');
      }
      
      return NextResponse.json({ bio });
    } catch (error) {
      console.error('Error generating bio:', error);
      return NextResponse.json({ error: 'Failed to generate bio' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error generating bio:', error);
    return NextResponse.json({ error: 'Failed to generate bio' }, { status: 500 });
  }
} 