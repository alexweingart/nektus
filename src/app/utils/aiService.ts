import { OpenAI } from 'openai';
import { UserProfile } from '../context/ProfileContext';

// Initialize OpenAI client with API key from environment variables
let openai: OpenAI | null = null;
if (process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  });
}

/**
 * Generate a personalized bio based on user profile
 * @param profile User profile data
 * @returns Generated bio text (10 words or less)
 */
export async function generateBio(profile: UserProfile): Promise<string> {
  try {
    if (!openai) {
      return "Connecting people through technology";
    }
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates short, engaging personal bios."
        },
        {
          role: "user",
          content: `Generate a creative, engaging bio for a person named ${profile.name}. 
          The bio should be no more than 10 words and should be personal and uplifting.
          Only return the bio text, nothing else.`
        }
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    // Extract the generated bio from the response
    const bio = response.choices[0]?.message?.content?.trim() || 
      "Connecting people through technology";
    
    return bio;
  } catch (error) {
    console.error("Error generating bio:", error);
    // Fallback bio in case of API error
    return "Connecting people through technology";
  }
}

/**
 * Generate a profile background image based on user profile
 * @param profile User profile data
 * @returns URL of the generated image
 */
export async function generateProfileBackground(profile: UserProfile): Promise<string> {
  try {
    if (!openai) {
      return '/gradient-bg.jpg';
    }
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create an abstract, gradient background image that represents the essence of ${profile.name}. 
      The image should be subtle, elegant, and suitable as a profile page background. 
      Use soft colors that create a professional appearance. No text or people should be visible.`,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    // Return the URL of the generated image
    return (response.data && response.data[0] && response.data[0].url) ? response.data[0].url : '/gradient-bg.jpg';
  } catch (error) {
    console.error("Error generating background image:", error);
    // Return default background if image generation fails
    return '/gradient-bg.jpg';
  }
}

/**
 * Generate a stylized avatar based on user profile and existing photo
 * @param profile User profile data
 * @returns URL of the generated avatar
 */
export async function generateStylizedAvatar(profile: UserProfile): Promise<string> {
  // Only generate if there's an existing profile picture to base it on
  if (!profile.picture) {
    return '/default-avatar.png';
  }

  try {
    if (!openai) {
      return profile.picture || '/default-avatar.png';
    }
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a stylized, artistic profile picture based on the essence of a person named ${profile.name}. 
      The image should be a professional, friendly avatar suitable for a social network. 
      It should be a portrait-style image with a clean background. 
      Ensure the design is simple, recognizable, and approachable.`,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    // Return the URL of the generated image
    return (response.data && response.data[0] && response.data[0].url) ? response.data[0].url : (profile.picture || '/default-avatar.png');
  } catch (error) {
    console.error("Error generating avatar:", error);
    // Return original profile picture if avatar generation fails
    return profile.picture || '/default-avatar.png';
  }
}

/**
 * Validate social media links by checking if they exist
 * @param platform The social media platform
 * @param username The username to check
 * @returns Boolean indicating if the profile exists
 */
export async function validateSocialLink(platform: string, username: string): Promise<boolean> {
  // In a real implementation, this would check if the social media profile exists
  // For now, we'll mock this with a simple check
  try {
    // For demo purposes, randomly return true or false
    // In a real implementation, you would make API calls to verify the existence
    return Math.random() > 0.3; // 70% chance of returning true
  } catch (error) {
    console.error(`Error validating ${platform} link:`, error);
    return false;
  }
}
