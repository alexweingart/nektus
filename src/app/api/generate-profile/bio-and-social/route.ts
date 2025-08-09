import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/lib/firebase/adminProfileService';
import { BioAndSocialGenerationService } from '@/lib/services/server/bioAndSocialGenerationService';
import { UserProfile } from '@/types/profile';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    
    console.log(`[API/BIO-AND-SOCIAL] Starting unified generation for user ${userId}`);
    
    // Get current profile from Firebase
    let userProfile = await AdminProfileService.getProfile(userId);
    
    // If profile doesn't exist, create minimal profile from session
    if (!userProfile) {
      userProfile = {
        userId: userId,
        name: session.user.name || '',
        bio: '',
        profileImage: session.user.image || '',
        backgroundImage: '',
        lastUpdated: Date.now(),
        aiGeneration: {
          bioGenerated: false,
          backgroundImageGenerated: false,
          avatarGenerated: false
        },
        contactChannels: {
          entries: [
            {
              platform: 'email',
              section: 'universal',
              userConfirmed: !!session.user.email,
              email: session.user.email || ''
            }
          ]
        }
      };
    }

    // Get email from new array format
    const emailEntry = userProfile.contactChannels?.entries?.find(e => e.platform === 'email');
    const phoneEntry = userProfile.contactChannels?.entries?.find(e => e.platform === 'phone');
    
    console.log(`[API/BIO-AND-SOCIAL] Profile info for user ${userId}:`, {
      name: userProfile.name,
      email: emailEntry?.email || 'none',
      hasPhone: !!phoneEntry?.internationalPhone,
      hasBio: !!userProfile.bio
    });
    
    // Generate both bio and social links using the unified service
    const result = await BioAndSocialGenerationService.generateBioAndSocialLinks(userProfile);
    
    console.log(`[API/BIO-AND-SOCIAL] Generation completed for user ${userId}:`, {
      success: result.success,
      bioLength: result.bio.length,
      socialProfilesDiscovered: result.socialProfilesDiscovered,
      socialProfilesVerified: result.socialProfilesVerified
    });
    
    // CRITICAL: Get fresh profile data before saving to prevent overwrites
    // This ensures we have the latest phone-based socials if they were generated in parallel
    const freshProfile = await AdminProfileService.getProfile(userId);
    if (!freshProfile) {
      console.error(`[API/BIO-AND-SOCIAL] Fresh profile not found for user ${userId}`);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // CRITICAL: Merge generated social profiles with existing contact channels to preserve phone data
    const generatedContactChannels = (result as any).contactChannels;
    const existingEntries = freshProfile.contactChannels?.entries || [];
    const generatedEntries = generatedContactChannels?.entries || [];
    
    // Start with existing entries (preserves phone, WhatsApp, etc.)
    const mergedEntries = [...existingEntries];
    
    // Add or update entries from generated social profiles
    generatedEntries.forEach((generatedEntry: any) => {
      const existingIndex = mergedEntries.findIndex(e => e.platform === generatedEntry.platform);
      if (existingIndex >= 0) {
        // Update existing entry (like email with new data)
        mergedEntries[existingIndex] = { ...mergedEntries[existingIndex], ...generatedEntry };
      } else {
        // Add new entry (social profiles)
        mergedEntries.push(generatedEntry);
      }
    });
    
    const mergedContactChannels = { entries: mergedEntries };

    // TODO: Update logging to work with new array format
    
    // Update profile in Firebase with merged data
    try {
      await AdminProfileService.updateProfile(userId, {
        bio: result.bio,
        contactChannels: mergedContactChannels,
        aiGeneration: {
          bioGenerated: true,
          avatarGenerated: freshProfile.aiGeneration?.avatarGenerated || false,
          backgroundImageGenerated: freshProfile.aiGeneration?.backgroundImageGenerated || false
        },
        lastUpdated: Date.now()
      });
      
      console.log(`[API/BIO-AND-SOCIAL] Profile updated in Firebase for user ${userId} with merged data`);
    } catch (saveError) {
      console.error(`[API/BIO-AND-SOCIAL] FAILED to save to Firebase for user ${userId}:`, saveError);
      // Still return the generated content even if save fails
      console.error('[API/BIO-AND-SOCIAL] Continuing to return generated content despite save failure');
    }
    
    return NextResponse.json({ 
      bio: result.bio,
      contactChannels: mergedContactChannels,
      success: result.success,
      socialProfilesDiscovered: result.socialProfilesDiscovered,
      socialProfilesVerified: result.socialProfilesVerified
    });
    
  } catch (error) {
    console.error('[API/BIO-AND-SOCIAL] Error in unified generation:', error);
    
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json(
      { error: 'Failed to generate bio and social links', details: message }, 
      { status: 500 }
    );
  }
} 