import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/lib/firebase/adminProfileService';
import { getColorPalette, pickAccentColors } from '@/lib/utils/colorService';
import { uploadImageBuffer } from '@/lib/firebase/adminConfig';
import { UserProfile } from '@/types/profile';
import { getOpenAIClient } from '@/lib/openai/client';
import { NextRequest } from 'next/server';

/**
 * Converts a base64 string to a buffer
 * @param base64 Base64 encoded string (without the data:image prefix)
 * @returns Buffer containing the image data
 */
function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * This is a server-side function.
 * @param profile The user profile object.
 * @param palette An array of hex color strings from the user's profile image.
 * @returns A buffer containing the image data
 */
async function generateBackgroundImageForProfile(profile: UserProfile, palette: string[]): Promise<Buffer> {
  console.log(`[API/BACKGROUND] Starting background image generation for: ${profile.name}`);
  
  try {
    /**
     * Build a colour-focussed prompt.
     * We treat the first palette entry as the dominant "hero" colour and allow up to two accents.
     */
    const dominantColor = palette[0];
    const accentColors = pickAccentColors(palette.slice(1)); // choose 2 colourful accents

    let colorPrompt: string;
    if (accentColors.length > 0) {
      // e.g. "Use exactly these colours: #AA77FF (dominant, ~70% coverage), #FFEEDD (accent), #332244 (accent)."
      const accentsText = accentColors.map((c) => `, ${c} (accent)`).join('');
      colorPrompt = `Use exactly these colours: ${dominantColor} (dominant, ~70% coverage)${accentsText}. No other colours.`;
    } else {
      colorPrompt = `Use only the colour ${dominantColor}. Avoid any other colours.`;
    }

    const prompt = `Generate a calm, minimal, dark, modern abstract background for a profile page.\n` +
      `Optional context: ${profile.bio || 'no bio available'}.\n` +
      `${colorPrompt}\n` +
      `No text, people, objects, or recognisable symbols. Design must be dark enough so that white text is readable. ` +
      `Limit to 2-3 large, soft-edge shapes or blobs.`;
    
    console.log(`[API/BACKGROUND] Using prompt:`, prompt);
    
    const client = getOpenAIClient();
    
    console.log(`[API/BACKGROUND] Calling OpenAI API with model: gpt-image-1, size: 1024x1024`);
    
    // Add timeout wrapper for OpenAI API call
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OpenAI API timeout after 30 seconds')), 30000)
    );
    
    // Generate the image with base64 response format to eliminate extra hop
    const imageGenerationPromise = client.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024', // Square size for faster generation
      quality: 'low',
    });
    
    console.log('[API/BACKGROUND] Waiting for OpenAI response...');
    const response = await Promise.race([imageGenerationPromise, timeoutPromise]) as any;
    
    console.log('[API/BACKGROUND] Response received from OpenAI API');
    
    if (!response || !response.data || !Array.isArray(response.data) || response.data.length === 0) {
      throw new Error('Invalid response from OpenAI');
    }
    
    // Check what we got in response
    const imageData = response.data[0];
    
    // We should always get base64 data with our request format
    if (imageData?.b64_json) {
      console.log('[API/BACKGROUND] Converting base64 image data to buffer');
      return base64ToBuffer(imageData.b64_json);
    }

    throw new Error('No base64 image data found in the response');
  } catch (error) {
    console.error('[API/BACKGROUND] Background image generation failed:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const { streamingBio } = await req.json();
    
    // Always get the most recent profile to ensure we have any newly generated bio
    const profile = await AdminProfileService.getProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (!profile.profileImage) {
      return NextResponse.json({ error: 'Profile image is required to generate a background' }, { status: 400 });
    }
    
    // Use streaming bio if available, otherwise fall back to profile bio
    const bioForGeneration = streamingBio || profile.bio;
    
    // Log background generation start with request
    console.log('[API/BACKGROUND] Background generation starts', { 
      userId, 
      profileImage: profile.profileImage,
      usingStreamingBio: !!streamingBio,
      bioSource: streamingBio ? 'streaming' : 'profile',
      bioLength: bioForGeneration?.length || 0
    });

    // Create a modified profile object with the streaming bio for generation
    const profileForGeneration = { ...profile, bio: bioForGeneration };

    // 2. Get color palette from profile image
    const imageResponse = await fetch(profile.profileImage);
    if (!imageResponse.ok) {
        throw new Error('Failed to download profile image for color analysis');
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const palette = await getColorPalette(imageBuffer, 5);
    console.log('[API/BACKGROUND] Generated color palette:', palette);

    // 3. Generate background image from AI service using the profile with streaming bio
    const aiImageBuffer = await generateBackgroundImageForProfile(profileForGeneration, palette);

    // 4. Upload it to our own storage
    console.log('[API/BACKGROUND] Uploading image to Firebase Storage');
    const uploadTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firebase upload timeout after 20 seconds')), 20000)
    );
    
    const uploadPromise = uploadImageBuffer(aiImageBuffer, userId, 'background');
    console.log('[API/BACKGROUND] Waiting for Firebase upload...');
    const permanentImageUrl = await Promise.race([uploadPromise, uploadTimeoutPromise]) as string;

    // 5. Save the new URL to the user's profile
    console.log('[API/BACKGROUND] Updating profile in Firestore...');
    const firestoreTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore update timeout after 10 seconds')), 10000)
    );
    
    const updatePromise = AdminProfileService.updateProfile(userId, { 
      backgroundImage: permanentImageUrl,
      aiGeneration: {
        bioGenerated: profile.aiGeneration?.bioGenerated || false,
        avatarGenerated: profile.aiGeneration?.avatarGenerated || false,
        backgroundImageGenerated: true
      }
    });
    
    await Promise.race([updatePromise, firestoreTimeoutPromise]);
    
    // Log background generation complete and saved to Firestore with response
    console.log('[API/BACKGROUND] Background generation complete & saved to Firestore', { 
      userId, 
      imageUrl: permanentImageUrl,
      isProduction: process.env.NODE_ENV === 'production',
      urlLength: permanentImageUrl?.length || 0,
      urlStartsWith: permanentImageUrl?.substring(0, 50) || 'N/A'
    });

    // Test if the URL is accessible
    try {
      const testResponse = await fetch(permanentImageUrl, { method: 'HEAD' });
      console.log('[API/BACKGROUND] URL accessibility test:', {
        url: permanentImageUrl,
        status: testResponse.status,
        accessible: testResponse.ok
      });
    } catch (error) {
      console.error('[API/BACKGROUND] URL accessibility test failed:', error);
    }

    // 6. Return the permanent URL
    return NextResponse.json({ imageUrl: permanentImageUrl });

  } catch (error) {
    console.error(`[API/BACKGROUND] Error generating background for user ${userId}:`, error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: 'Failed to generate background image.', details: message }, { status: 500 });
  }
}