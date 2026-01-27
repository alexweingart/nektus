"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { ClientProfileService as ProfileService } from '@/client/profile/firebase-save';
import { ProfileSaveService, generateWhatsAppFromPhone, syncProfileToSession } from '@/client/profile/save';
import { UserProfile } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import { firebaseAuth } from '@/client/auth/firebase';
import { isAndroidPlatform } from '@/client/platform-detection';
import { syncTimezone, type SessionPhoneEntry } from '@/client/profile/utils';
import { generateProfileAssets } from '@/client/profile/asset-generation';
import { hexToRgb } from '@/client/cn';

// Types
interface SessionProfile {
  contactChannels?: {
    entries?: SessionPhoneEntry[];
  };
}

type ProfileContextType = {
  profile: UserProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  isNavigatingFromSetup: boolean;
  saveProfile: (data: Partial<UserProfile>, options?: { directUpdate?: boolean; skipUIUpdate?: boolean }) => Promise<UserProfile | null>;
  getLatestProfile: () => UserProfile | null;
  setNavigatingFromSetup: (navigating: boolean) => void;
  refreshProfile: () => Promise<UserProfile | null>;  // Force refresh profile from Firestore
  // Streaming states for immediate UI feedback during generation
  streamingSocialContacts: UserProfile['contactEntries'] | null;
  streamingProfileImage: string | null;
  // Flag to indicate if current profile image is Google auto-generated initials
  isGoogleInitials: boolean;
  isCheckingGoogleImage: boolean;
  // Contacts cache management
  contacts: SavedContact[] | null;
  contactsLoadedAt: number | null;
  loadContacts: (userId: string, force?: boolean) => Promise<SavedContact[]>;
  getContact: (contactUserId: string) => SavedContact | null;
  getContacts: () => SavedContact[];
  invalidateContactsCache: () => void;
};

// Create context
const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// Provider component
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: authStatus, update } = useSession();
  const pathname = usePathname();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isNavigatingFromSetup, setIsNavigatingFromSetup] = useState(false);

  // Separate streaming state for immediate updates during generation
  const [streamingSocialContacts, setStreamingSocialContacts] = useState<UserProfile['contactEntries'] | null>(null);
  const [streamingProfileImage, setStreamingProfileImage] = useState<string | null>(null);

  // Track if current profile image is Google auto-generated initials
  const [isGoogleInitials, setIsGoogleInitials] = useState(false);
  const [isCheckingGoogleImage, setIsCheckingGoogleImage] = useState(false);

  // Contacts cache state
  const [contacts, setContacts] = useState<SavedContact[] | null>(null);
  const [contactsLoadedAt, setContactsLoadedAt] = useState<number | null>(null);

  const loadingRef = useRef(false);
  const savingRef = useRef(false);
  const backgroundGenerationTriggeredRef = useRef(false);
  const profileImageGenerationTriggeredRef = useRef(false);
  const contactsLoadingPromiseRef = useRef<Promise<SavedContact[]> | null>(null);


  const profileRef = useRef<UserProfile | null>(null);

  // Contacts cache duration - 5 minutes (matches auth state expiry pattern)
  const CONTACTS_CACHE_DURATION = 5 * 60 * 1000;


  // Profile creation/loading effect
  useEffect(() => {
    const loadProfile = async () => {
      if (authStatus === 'authenticated' && session?.user?.id && !profile && !loadingRef.current) {
        // Allow ProfileContext to run normally for all users
        // This ensures proper asset generation (bio, profile image, etc.) happens

        loadingRef.current = true;
        setIsLoading(true);

        // Detect Android for enhanced session sync
        const isAndroid = isAndroidPlatform();

        try {

          // Sign in to Firebase if we have a token and aren't signed in
          if (session?.firebaseToken && !firebaseAuth.getCurrentUser()) {
            // Await Firebase Auth to ensure we're authenticated before fetching profile
            // This prevents profile regeneration in new browsers
            try {
              await firebaseAuth.signInWithCustomToken(session.firebaseToken);
            } catch (authError) {
              console.error('[ProfileContext] Firebase Auth failed, continuing without auth:', authError);
              // Continue without Firebase Auth - the app should still work with limited functionality
            }
          }

          // Check for existing profile
          let existingProfile = await ProfileService.getProfile(session.user.id);
          if (existingProfile) {
            // Auto-detect and update timezone if different from browser timezone
            existingProfile = await syncTimezone(existingProfile, session.user.id);

            setProfile(existingProfile);

            // Trigger asset generation for new users (those without generated assets)
            // Check if either avatar OR background colors are already generated/extracted
            // Note: AI-generated avatars get background colors extracted from the avatar
            const avatarAlreadyGenerated = existingProfile.aiGeneration?.avatarGenerated;
            const backgroundAlreadyGenerated = existingProfile.aiGeneration?.backgroundImageGenerated;
            const hasBackgroundColors = !!existingProfile.backgroundColors;
            const profileImage = existingProfile.profileImage || session?.user?.image;
            const isGoogleImage = profileImage?.includes('googleusercontent.com');

            console.log('[ProfileContext] Profile loaded - checking asset generation:', {
              avatarAlreadyGenerated,
              backgroundAlreadyGenerated,
              hasBackgroundColors,
              backgroundColors: existingProfile.backgroundColors,
              profileImage: profileImage?.substring(0, 50) + '...',
              isGoogleImage
            });

            if (!avatarAlreadyGenerated && !backgroundAlreadyGenerated && !hasBackgroundColors) {
              console.log('[ProfileContext] New user detected - triggering asset generation');
              generateProfileAssets({
                userId: session.user.id,
                profile: existingProfile,
                profileRef,
                session,
                profileImageGenerationTriggeredRef,
                backgroundGenerationTriggeredRef,
                setIsGoogleInitials,
                setIsCheckingGoogleImage,
                setStreamingProfileImage,
                setStreamingSocialContacts,
                setProfile
              }).catch(error => {
                console.error('[ProfileContext] Asset generation error:', error);
              });
            } else if (!hasBackgroundColors && profileImage && !avatarAlreadyGenerated) {
              // Existing user with a profile image but no background colors
              // This handles users with real Google photos who need color extraction
              console.log('[ProfileContext] Existing user needs background color extraction');
              generateProfileAssets({
                userId: session.user.id,
                profile: existingProfile,
                profileRef,
                session,
                profileImageGenerationTriggeredRef,
                backgroundGenerationTriggeredRef,
                setIsGoogleInitials,
                setIsCheckingGoogleImage,
                setStreamingProfileImage,
                setStreamingSocialContacts,
                setProfile
              }).catch(error => {
                console.error('[ProfileContext] Background color extraction error:', error);
              });
            }

            // Android-specific: Ensure session is synced with loaded profile
            // Run async (don't await) to avoid blocking the loading screen
            // Skip during setup navigation to prevent redirect loops
            if (isAndroid && existingProfile.contactEntries && !isNavigatingFromSetup) {
              const phoneEntry = existingProfile.contactEntries.find(e => e.fieldType === 'phone');
              const sessionPhoneEntry = (session?.profile as SessionProfile)?.contactChannels?.entries?.find((e: SessionPhoneEntry) => e.platform === 'phone');

              if (phoneEntry?.value && sessionPhoneEntry?.internationalPhone !== phoneEntry.value) {
                // Force session update to sync with Firebase data (async, don't block)
                if (update) {
                  update({
                    profile: {
                      contactChannels: {
                        entries: [
                          {
                            platform: 'phone',
                            section: phoneEntry.section,
                            userConfirmed: phoneEntry.confirmed,
                            internationalPhone: phoneEntry.value,
                            nationalPhone: phoneEntry.value || ''
                          }
                        ]
                      }
                    }
                  }).catch(error => {
                    console.error('[ProfileContext] Failed to update session:', error);
                  });
                }
              }
            }
            
            // Note: Per CALCONNECT_MERGE_SPEC, we no longer auto-trigger asset generation on profile refresh
            // Assets are only generated when explicitly requested by the user
          } else {
            // Profile should exist due to server-side creation in NextAuth JWT callback
            // If it doesn't exist, ServerProfileService.getOrCreateProfile() failed silently
            console.warn(`[ProfileContext] Profile missing for user ${session.user.id} - creating fallback profile`);

            // Create a default profile as fallback (recovery mechanism)
            const defaultProfile: UserProfile = {
              userId: session.user.id,
              profileImage: session.user.image || '',
              backgroundImage: '',
              lastUpdated: Date.now(),
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

            // Save the fallback profile to Firestore
            try {
              await ProfileService.saveProfile(defaultProfile);
              console.log('[ProfileContext] Fallback profile created successfully');
              setProfile(defaultProfile);
            } catch (saveError) {
              console.error('[ProfileContext] Failed to create fallback profile:', saveError);
              // Still set the profile in memory so the UI can function
              setProfile(defaultProfile);
            }
          }
        } catch (error) {
          console.error('[ProfileContext] Failed to load or create profile:', error);
          // Optionally handle fallback to a default profile without saving
        } finally {
          setIsLoading(false);
          loadingRef.current = false;
        }
      } else if (authStatus === 'unauthenticated') {
        // Sign out of Firebase Auth when NextAuth session ends
        if (firebaseAuth.getCurrentUser()) {
          console.log('[ProfileContext] Signing out of Firebase Auth...');
          try {
            await firebaseAuth.signOut();
          } catch (error) {
            console.error('[ProfileContext] Error signing out of Firebase Auth:', error);
          }
        }
        setProfile(null);
        setIsLoading(false);
      }
    };
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, session?.user?.id, update]);

  // Update profileRef whenever profile changes
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Liquid Glass: Set global color tint from user's profile
  useEffect(() => {
    // Muted theme green RGB values - matches LayoutBackground COLORS.themeGreen
    const MUTED_GREEN_RGB = '20, 88, 53';

    if (profile?.backgroundColors) {
      const [dominant, accent1, accent2] = profile.backgroundColors;
      const hasCustomColors = !(dominant === accent1 && accent1 === accent2);

      if (hasCustomColors) {
        // Custom extracted colors - use accent2 for glass tint
        const profileColor = accent2 || accent1 || dominant;
        if (profileColor) {
          const rgb = hexToRgb(profileColor);
          const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
          document.documentElement.style.setProperty('--glass-tint-color', rgbString);
        }

        // Set safe area color for profile pages
        const isOnContactPage = pathname?.startsWith('/x/') || pathname?.startsWith('/c/');
        if (!isOnContactPage) {
          document.documentElement.style.backgroundColor = dominant;
          document.documentElement.style.setProperty('--safe-area-color', dominant);
        }
      } else {
        // Uniform colors (AI-generated) - use muted green
        document.documentElement.style.setProperty('--glass-tint-color', MUTED_GREEN_RGB);
        // Let LayoutBackground handle background colors for uniform colors
      }
    } else {
      // No colors - use muted green
      document.documentElement.style.setProperty('--glass-tint-color', MUTED_GREEN_RGB);
      // LayoutBackground handles all background colors
    }
  }, [profile, pathname]);

  // Save profile to Firestore
  const saveProfile = useCallback(async (data: Partial<UserProfile>, options: { directUpdate?: boolean; skipUIUpdate?: boolean } = {}): Promise<UserProfile | null> => {
    if (!session?.user?.id) {
      console.error('[ProfileContext] No authenticated user');
      return null;
    }

    // Detect Android for enhanced session sync
    const isAndroid = isAndroidPlatform();

    // Wait for any ongoing save operations to complete, with timeout
    const maxWaitTime = 30000; // 30 seconds max wait
    const waitStartTime = Date.now();
    while (savingRef.current) {
      if (Date.now() - waitStartTime > maxWaitTime) {
        console.warn('[ProfileContext] Timeout waiting for ongoing save operation, proceeding anyway');
        savingRef.current = false; // Reset the lock
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Set saving lock
    savingRef.current = true;

    // Set saving state to prevent setup effects from running during form submission
    // Detect form submission by checking if we have contact entries (any field, not just phone)
    const wasFormSubmission = !options.directUpdate && 
      data.contactEntries && 
      data.contactEntries.length > 0;
    
    // Save operation starting
    if (wasFormSubmission) {
      setIsSaving(true);
    }

    let merged: UserProfile;

    try {
      // Profile must be loaded before saving - fail explicitly if missing
      if (!profileRef.current) {
        const errorMessage = `[ProfileContext] Cannot save profile - profile not loaded for user ${session.user.id}. Profile must be loaded before save operations.`;
        console.error(errorMessage);
        throw new Error('Profile not loaded - cannot save');
      }
      
      const current = profileRef.current;
      
      // Use ProfileSaveService for core saving logic
      const saveResult = await ProfileSaveService.saveProfile(
        session.user.id,
        current,
        data,
        options
      );

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Save failed');
      }

      merged = saveResult.profile!;

      // Phone-based social media generation is now handled by verify-phone-socials API
      // after the profile is successfully saved (see phone save trigger below)

      // Always update the ref so subsequent operations can access updated data
      profileRef.current = merged;
      
      // Skip React state updates for:
      // 1. Background operations (directUpdate - bio generation, social media generation)
      // 2. Explicit skipUIUpdate requests
      // Note: Removed form submission skip - we want UI to reflect saved changes immediately
      const skipReactUpdate = options.skipUIUpdate;

      if (!skipReactUpdate) {
        setProfile(merged);
      } else {
        // However, if this is a background operation and the current profile state is stale (empty userId),
        // we should update it to prevent UI showing empty data during streaming
        if (options.directUpdate && (!profileRef.current || !profileRef.current.userId) && merged.userId) {
          setProfile(merged);
        }
      }

      // Only trigger phone-based social generation if phone number was saved AND WhatsApp is blank
      const mergedPhoneEntry = merged.contactEntries?.find(e => e.fieldType === 'phone');
      const existingWhatsApp = merged.contactEntries?.find(e =>
        e.fieldType === 'whatsapp' && e.value && e.value.trim() !== ''
      );

      if (wasFormSubmission && mergedPhoneEntry?.value && !existingWhatsApp) {
        // Generate WhatsApp from phone number (async, non-blocking)
        generateWhatsAppFromPhone(
          mergedPhoneEntry.value,
          profileRef,
          session,
          setProfile,
          setStreamingSocialContacts
        );
      }

      // Sync profile data to session
      await syncProfileToSession(merged, session, wasFormSubmission || false, update);
    } catch (error) {
      console.error('[ProfileContext] Error saving profile:', error);
      if (isAndroid) {
        console.error('[ProfileContext] 🤖 Android - Firebase save failed:', error);
      }
      throw error;
    } finally {
      // Always release the saving lock and reset saving state
      savingRef.current = false;
      if (wasFormSubmission) {
        setIsSaving(false);
      }
    }
    
    return merged;
  }, [session, update]);

  // Get the latest profile (for external use)
  const getLatestProfile = useCallback((): UserProfile | null => {
    return profileRef.current;
  }, []);

  const setNavigatingFromSetup = useCallback((navigating: boolean) => {
    setIsNavigatingFromSetup(navigating);
  }, []);

  // Refresh profile from Firestore (forces a re-fetch)
  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!session?.user?.id) {
      console.warn('[ProfileContext] Cannot refresh profile: no user session');
      return null;
    }

    try {
      console.log('[ProfileContext] Refreshing profile from Firestore');
      const freshProfile = await ProfileService.getProfile(session.user.id);

      if (freshProfile) {
        setProfile(freshProfile);
        profileRef.current = freshProfile;
        console.log('[ProfileContext] Profile refreshed successfully');
        return freshProfile;
      }

      return null;
    } catch (error) {
      console.error('[ProfileContext] Failed to refresh profile:', error);
      return null;
    }
  }, [session?.user?.id]);

  // Contacts cache methods
  const loadContacts = useCallback(async (userId: string, force: boolean = false): Promise<SavedContact[]> => {
    // Check if cache is still valid (unless forced refresh)
    if (!force && contacts && contactsLoadedAt) {
      const age = Date.now() - contactsLoadedAt;
      if (age < CONTACTS_CACHE_DURATION) {
        return contacts;
      }
    }

    // If already loading, return the existing promise to prevent duplicate requests
    if (contactsLoadingPromiseRef.current) {
      return contactsLoadingPromiseRef.current;
    }

    // Create and store the loading promise
    const loadingPromise = (async () => {
      try {
        const userContacts = await ProfileService.getContacts(userId);

        // Sort contacts by addedAt timestamp (newest first)
        const sortedContacts = userContacts.sort((a, b) => b.addedAt - a.addedAt);

        setContacts(sortedContacts);
        setContactsLoadedAt(Date.now());

        return sortedContacts;
      } catch (error) {
        console.error('[ProfileContext] Failed to load contacts:', error);
        throw error;
      } finally {
        // Clear the loading promise ref when done
        contactsLoadingPromiseRef.current = null;
      }
    })();

    contactsLoadingPromiseRef.current = loadingPromise;
    return loadingPromise;
  }, [contacts, contactsLoadedAt, CONTACTS_CACHE_DURATION]);

  const getContact = useCallback((contactUserId: string): SavedContact | null => {
    if (!contacts) return null;
    return contacts.find(c => c.userId === contactUserId) || null;
  }, [contacts]);

  const getContacts = useCallback((): SavedContact[] => {
    return contacts || [];
  }, [contacts]);

  const invalidateContactsCache = useCallback(() => {
    setContacts(null);
    setContactsLoadedAt(null);
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        isSaving,
        isNavigatingFromSetup,
        saveProfile,
        getLatestProfile,
        setNavigatingFromSetup,
        refreshProfile,
        streamingSocialContacts,
        streamingProfileImage,
        isGoogleInitials,
        isCheckingGoogleImage,
        contacts,
        contactsLoadedAt,
        loadContacts,
        getContact,
        getContacts,
        invalidateContactsCache
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

// Custom hook for using the profile context
export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}

// Re-export utility function for backwards compatibility
export { profileHasPhone } from '@/client/profile/utils';

