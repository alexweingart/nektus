import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import type { ContactEntry } from '@/types/profile';
import { AdminProfileService } from '@/server/profile/firebase-admin';
import { BioAndSocialGenerationService } from '@/server/profile/bio-and-social-generation';

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
        profileImage: session.user.image || '',
        backgroundImage: '',
        lastUpdated: Date.now(),
        aiGeneration: {
          bioGenerated: false,
          backgroundImageGenerated: false,
          avatarGenerated: false
        },
        contactEntries: [
          {
            fieldType: 'name',
            value: session.user.name || '',
            section: 'universal',
            order: -2,
            isVisible: true,
            confirmed: true
          },
          {
            fieldType: 'bio',
            value: '',
            section: 'universal',
            order: -1,
            isVisible: true,
            confirmed: false
          },
          {
            fieldType: 'phone',
            value: '',
            section: 'personal',
            order: 0,
            isVisible: true,
            confirmed: false
          },
          {
            fieldType: 'email',
            value: session.user.email || '',
            section: 'personal',
            order: 1,
            isVisible: true,
            confirmed: !!session.user.email
          },
          {
            fieldType: 'phone',
            value: '',
            section: 'work',
            order: 0,
            isVisible: true,
            confirmed: false
          },
          {
            fieldType: 'email',
            value: session.user.email || '',
            section: 'work',
            order: 1,
            isVisible: true,
            confirmed: !!session.user.email
          }
        ]
      };
    }

    // Get email from new ContactEntry format
    const nameEntry = userProfile.contactEntries?.find(e => e.fieldType === 'name');
    const bioEntry = userProfile.contactEntries?.find(e => e.fieldType === 'bio');
    const emailEntry = userProfile.contactEntries?.find(e => e.fieldType === 'email');
    const phoneEntry = userProfile.contactEntries?.find(e => e.fieldType === 'phone');
    
    console.log(`[API/BIO-AND-SOCIAL] Profile info for user ${userId}:`, {
      name: nameEntry?.value || 'none',
      email: emailEntry?.value || 'none',
      hasPhone: !!phoneEntry?.value,
      hasBio: !!bioEntry?.value
    });
    
    // Generate both bio and social links using the unified service
    const result = await BioAndSocialGenerationService.generateBioAndSocialLinks(userProfile);
    
    console.log(`[API/BIO-AND-SOCIAL] Generation completed for user ${userId}:`, {
      success: result.success,
      bioLength: result.bio.length,
      socialProfilesDiscovered: result.socialProfilesDiscovered,
      socialProfilesVerified: result.socialProfilesVerified
    });
    
    // CRITICAL: Get fresh profile data just before saving to prevent overwrites
    // This ensures we have the latest phone and WhatsApp data from concurrent saves
    const freshProfile = await AdminProfileService.getProfile(userId);
    if (!freshProfile) {
      console.error(`[API/BIO-AND-SOCIAL] Fresh profile not found for user ${userId}`);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    console.log(`[API/BIO-AND-SOCIAL] Fresh profile before merge has ${freshProfile.contactEntries?.length || 0} entries`);

    // Convert socialProfiles to ContactEntry objects
    const generatedEntries: ContactEntry[] = [];
    const platforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat'] as const;

    for (const platform of platforms) {
      const username = result.socialProfiles[platform];
      const isVerified = result.verified[platform];

      if (username) {
        generatedEntries.push({
          fieldType: platform,
          value: username,
          section: platform === 'linkedin' ? 'work' : 'personal',
          order: 0, // Will be reassigned by ProfileSaveService
          isVisible: true,
          confirmed: false, // AI-generated profiles are unconfirmed
          automatedVerification: isVerified || false,
          discoveryMethod: 'ai' as const
        });
      }
    }

    // CRITICAL: Merge generated social profiles with existing contact channels to preserve phone data
    const existingEntries = freshProfile.contactEntries || [];

    // Start with existing entries (preserves phone, WhatsApp, etc.)
    const mergedEntries = [...existingEntries];

    console.log(`[API/BIO-AND-SOCIAL] Existing entries before merge:`, existingEntries.map((e: ContactEntry) => `${e.fieldType}-${e.section}:${e.order}`));
    console.log(`[API/BIO-AND-SOCIAL] Generated entries to merge:`, generatedEntries.map((e: ContactEntry) => `${e.fieldType}-${e.section}:${e.order}`));

    // Add or update entries from generated social profiles
    generatedEntries.forEach((generatedEntry: ContactEntry) => {
      const existingIndex = mergedEntries.findIndex(e => e.fieldType === generatedEntry.fieldType);
      if (existingIndex >= 0) {
        console.log(`[API/BIO-AND-SOCIAL] OVERWRITING ${generatedEntry.fieldType}:`, mergedEntries[existingIndex], ' → ', generatedEntry);
        // Update existing entry (like email with new data)
        mergedEntries[existingIndex] = { ...mergedEntries[existingIndex], ...generatedEntry };
      } else {
        console.log(`[API/BIO-AND-SOCIAL] ADDING ${generatedEntry.fieldType}`);
        // Add new entry (social profiles)
        mergedEntries.push(generatedEntry);
      }
    });

    console.log(`[API/BIO-AND-SOCIAL] Final merged entries:`, mergedEntries.map(e => `${e.fieldType}-${e.section}:${e.order}`));
    
    // TODO: Update logging to work with new array format
    
    // Update bio entry in the contactEntries array
    const updatedContactEntries = [...mergedEntries];
    const bioIndex = updatedContactEntries.findIndex(e => e.fieldType === 'bio');
    if (bioIndex >= 0) {
      updatedContactEntries[bioIndex] = { ...updatedContactEntries[bioIndex], value: result.bio, confirmed: true };
    } else {
      updatedContactEntries.push({
        fieldType: 'bio',
        value: result.bio,
        section: 'universal',
        order: -1,
        isVisible: true,
        confirmed: true
      });
    }

    // Update profile in Firebase with merged data using unified schema
    try {
      await AdminProfileService.updateProfile(userId, {
        contactEntries: updatedContactEntries,
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
      contactChannels: updatedContactEntries,
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