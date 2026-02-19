"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { ClientProfileService as ProfileService } from '@/client/profile/firebase-save';
import { ProfileSaveService, syncProfileToSession } from '@/client/profile/save';
import { UserProfile } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import { firebaseAuth } from '@/client/auth/firebase';
import { isAndroidPlatform } from '@/client/platform-detection';
import { syncTimezone, type SessionPhoneEntry } from '@/client/profile/utils';
import { generateProfileAssets } from '@/client/profile/asset-generation';
import { hexToRgb } from '@/client/cn';
import { generateProfileColors } from '@/shared/colors';
import { profileNeedsSetup } from '@nektus/shared-client';

// Types
interface SessionProfile {
  contactChannels?: {
    entries?: SessionPhoneEntry[];
  };
}

export type SharingCategory = 'Personal' | 'Work';

type ProfileContextType = {
  profile: UserProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  needsSetup: boolean;
  isNavigatingFromSetup: boolean;
  saveProfile: (data: Partial<UserProfile>, options?: { directUpdate?: boolean; skipUIUpdate?: boolean }) => Promise<UserProfile | null>;
  getLatestProfile: () => UserProfile | null;
  setNavigatingFromSetup: (navigating: boolean) => void;
  // Streaming states for immediate UI feedback during generation
  streamingSocialContacts: UserProfile['contactEntries'] | null;
  streamingProfileImage: string | null;
  // Flag to indicate if current profile image is Google auto-generated initials
  isGoogleInitials: boolean;
  isCheckingGoogleImage: boolean;
  // Contacts (live via onSnapshot)
  contacts: SavedContact[] | null;
  contactsLoading: boolean;
  getContact: (contactUserId: string) => SavedContact | null;
  getContacts: () => SavedContact[];
  // Bio scraping state (persists across navigation)
  isBioLoading: boolean;
  setIsBioLoading: (loading: boolean) => void;
  // Sharing category (Personal/Work toggle)
  sharingCategory: SharingCategory;
  setSharingCategory: (category: SharingCategory) => void;
};

// Create context
const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// Provider component
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: authStatus, update } = useSession();

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

  // Bio scraping loading state (persists across navigation)
  const [isBioLoading, setIsBioLoading] = useState(false);

  // Contacts state (live via onSnapshot)
  const [contacts, setContacts] = useState<SavedContact[] | null>(null);
  const [contactsLoading, setContactsLoading] = useState(true);

  // Sharing category state (replaces localStorage 'nekt-sharing-category')
  const [sharingCategory, setSharingCategory] = useState<SharingCategory>('Personal');

  const loadingRef = useRef(false);
  const savingRef = useRef(false);
  const backgroundGenerationTriggeredRef = useRef(false);
  const profileImageGenerationTriggeredRef = useRef(false);

  // Subscription unsubscribe refs
  const profileUnsubRef = useRef<(() => void) | null>(null);
  const contactsUnsubRef = useRef<(() => void) | null>(null);

  const profileRef = useRef<UserProfile | null>(null);
  const isFirstProfileCallbackRef = useRef(true);

  // Profile creation/loading effect
  useEffect(() => {
    const setupSubscriptions = async () => {
      if (authStatus === 'authenticated' && session?.user?.id && !profile && !loadingRef.current) {
        loadingRef.current = true;
        setIsLoading(true);
        isFirstProfileCallbackRef.current = true;

        // Set immediate profile so saves work while real profile loads
        const profileName = session.user.name || '';
        const immediateProfile: UserProfile = {
          userId: session.user.id,
          shortCode: '',
          profileImage: session.user.image || '',
          backgroundImage: '',
          // Don't set backgroundColors here — let LayoutBackground use default dark colors
          // until the real Firestore profile loads with the actual colors (photo-extracted or generated)
          lastUpdated: Date.now(),
          contactEntries: [
            { fieldType: 'name', value: profileName, section: 'universal', order: -2, isVisible: true, confirmed: true },
            { fieldType: 'bio', value: '', section: 'universal', order: -1, isVisible: true, confirmed: true },
            { fieldType: 'phone', value: '', section: 'personal', order: 0, isVisible: true, confirmed: true },
            { fieldType: 'email', value: session.user.email || '', section: 'personal', order: 1, isVisible: true, confirmed: true },
          ]
        };
        setProfile(immediateProfile);
        profileRef.current = immediateProfile;

        const isAndroid = isAndroidPlatform();

        try {
          // Sign in to Firebase with the session's custom token.
          // Must handle stale auth state from deleted/re-created accounts
          // (IndexedDB caches the old user, which causes permission errors on save).
          if (session?.firebaseToken) {
            // Proactively clear stale user if cached UID doesn't match session
            const cachedUser = firebaseAuth.getCurrentUser();
            if (cachedUser && cachedUser.uid !== session.user.id) {
              console.warn('[ProfileContext] Stale Firebase user detected (cached:', cachedUser.uid, 'session:', session.user.id, '), signing out first');
              try {
                await firebaseAuth.signOut();
              } catch {
                firebaseAuth.cleanup();
              }
            }

            // signInWithCustomToken returns null on failure (doesn't throw),
            // so check the return value to trigger retry logic
            let authUser = await firebaseAuth.signInWithCustomToken(session.firebaseToken);
            if (!authUser) {
              console.warn('[ProfileContext] Firebase Auth failed, clearing state and retrying');
              try {
                await firebaseAuth.signOut();
              } catch {
                firebaseAuth.cleanup();
              }
              authUser = await firebaseAuth.signInWithCustomToken(session.firebaseToken);
              if (!authUser) {
                console.warn('[ProfileContext] Firebase Auth retry failed, continuing without auth');
              }
            }
          }

          // Subscribe to profile updates (replaces one-time getProfile)
          profileUnsubRef.current = ProfileService.subscribeToProfile(
            session.user.id,
            async (profileData) => {
              if (profileData) {
                if (isFirstProfileCallbackRef.current) {
                  isFirstProfileCallbackRef.current = false;

                  // One-time setup on first callback
                  const synced = await syncTimezone(profileData, session.user.id);
                  setProfile(synced);
                  profileRef.current = synced;

                  // Trigger asset generation for new users
                  const avatarAlreadyGenerated = synced.aiGeneration?.avatarGenerated;
                  if (!avatarAlreadyGenerated) {
                    generateProfileAssets({
                      userId: session.user.id,
                      profile: synced,
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
                  }

                  // Android-specific: Ensure session is synced with loaded profile
                  if (isAndroid && synced.contactEntries && !isNavigatingFromSetup) {
                    const phoneEntry = synced.contactEntries.find(e => e.fieldType === 'phone');
                    const sessionPhoneEntry = (session?.profile as SessionProfile)?.contactChannels?.entries?.find((e: SessionPhoneEntry) => e.platform === 'phone');

                    if (phoneEntry?.value && sessionPhoneEntry?.internationalPhone !== phoneEntry.value) {
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

                  setIsLoading(false);
                  loadingRef.current = false;
                } else {
                  // Subsequent callbacks: just update profile state
                  setProfile(profileData);
                  profileRef.current = profileData;
                }
              } else {
                // Profile doesn't exist — create fallback
                if (isFirstProfileCallbackRef.current) {
                  isFirstProfileCallbackRef.current = false;
                  console.warn('[ProfileContext] Profile not found, creating fallback');
                  const fallbackName = session.user.name || '';
                  const defaultProfile: UserProfile = {
                    userId: session.user.id,
                    shortCode: '',
                    profileImage: session.user.image || '',
                    backgroundImage: '',
                    backgroundColors: generateProfileColors(fallbackName),
                    lastUpdated: Date.now(),
                    contactEntries: [
                      { fieldType: 'name', value: fallbackName, section: 'universal', order: -2, isVisible: true, confirmed: true },
                      { fieldType: 'bio', value: '', section: 'universal', order: -1, isVisible: true, confirmed: true },
                      { fieldType: 'phone', value: '', section: 'personal', order: 0, isVisible: true, confirmed: true },
                      { fieldType: 'email', value: session.user.email || '', section: 'personal', order: 1, isVisible: true, confirmed: true },
                      { fieldType: 'phone', value: '', section: 'work', order: 0, isVisible: true, confirmed: true },
                      { fieldType: 'email', value: session.user.email || '', section: 'work', order: 1, isVisible: true, confirmed: true }
                    ]
                  };

                  try {
                    await ProfileService.saveProfile(defaultProfile);
                  } catch (saveError) {
                    console.error('[ProfileContext] Failed to save fallback profile:', saveError);
                  }
                  setProfile(defaultProfile);
                  profileRef.current = defaultProfile;
                  setIsLoading(false);
                  loadingRef.current = false;
                }
              }
            }
          );

          // Subscribe to contacts updates (replaces one-time getContacts)
          setContactsLoading(true);
          contactsUnsubRef.current = ProfileService.subscribeToContacts(
            session.user.id,
            (contactsData) => {
              // Sort contacts by addedAt timestamp (newest first)
              const sortedContacts = [...contactsData].sort((a, b) => b.addedAt - a.addedAt);
              setContacts(sortedContacts);
              setContactsLoading(false);
            }
          );
        } catch (error) {
          console.error('[ProfileContext] Profile subscription setup failed:', error);
          // Keep the immediate profile set earlier - UI can still function
          setIsLoading(false);
          loadingRef.current = false;
        }
      } else if (authStatus === 'unauthenticated') {
        // Clean up subscriptions
        if (profileUnsubRef.current) {
          profileUnsubRef.current();
          profileUnsubRef.current = null;
        }
        if (contactsUnsubRef.current) {
          contactsUnsubRef.current();
          contactsUnsubRef.current = null;
        }

        if (firebaseAuth.getCurrentUser()) {
          try {
            await firebaseAuth.signOut();
          } catch {
            // Ignore signout errors
          }
        }
        setProfile(null);
        setContacts(null);
        setContactsLoading(true);
        setIsLoading(false);
        isFirstProfileCallbackRef.current = true;
        loadingRef.current = false;
      }
    };
    setupSubscriptions();

    // Cleanup subscriptions on unmount
    return () => {
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
      if (contactsUnsubRef.current) {
        contactsUnsubRef.current();
        contactsUnsubRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, session?.user?.id, update]);

  // Update profileRef whenever profile changes
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Liquid Glass: Set global color tint from user's profile
  // Note: background-color and --safe-area-bg are managed by LayoutBackground, not here
  useEffect(() => {
    if (profile?.backgroundColors && profile.backgroundColors.length >= 3) {
      const [, accent1, accent2] = profile.backgroundColors;

      // Use accent2 for glass tint (the bright, vivid color)
      const profileColor = accent2 || accent1;
      if (profileColor) {
        const rgb = hexToRgb(profileColor);
        const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        document.documentElement.style.setProperty('--glass-tint-color', rgbString);
      }
    } else {
      // No profile colors - remove inline override so CSS default (brand green) applies
      document.documentElement.style.removeProperty('--glass-tint-color');
    }
  }, [profile]);

  // Save profile to Firestore
  const saveProfile = useCallback(async (data: Partial<UserProfile>, options: { directUpdate?: boolean; skipUIUpdate?: boolean } = {}): Promise<UserProfile | null> => {
    if (!session?.user?.id) {
      console.error('[ProfileContext] No authenticated user');
      return null;
    }

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
      if (!profileRef.current) {
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

      // Optimistic update: set profile immediately, onSnapshot confirms ms later
      profileRef.current = merged;

      if (!options.skipUIUpdate) {
        setProfile(merged);
      }

      // Sync profile data to session
      await syncProfileToSession(merged, session, wasFormSubmission || false, update);
    } catch (error) {
      console.error('[ProfileContext] Error saving profile:', error);
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

  const getContact = useCallback((contactUserId: string): SavedContact | null => {
    if (!contacts) return null;
    return contacts.find(c => c.userId === contactUserId) || null;
  }, [contacts]);

  const getContacts = useCallback((): SavedContact[] => {
    return contacts || [];
  }, [contacts]);

  // Check if profile needs setup (no phone number configured)
  const needsSetup = useMemo(() => profileNeedsSetup(profile), [profile]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        isSaving,
        needsSetup,
        isNavigatingFromSetup,
        saveProfile,
        getLatestProfile,
        setNavigatingFromSetup,
        streamingSocialContacts,
        streamingProfileImage,
        isGoogleInitials,
        isCheckingGoogleImage,
        contacts,
        contactsLoading,
        getContact,
        getContacts,
        isBioLoading,
        setIsBioLoading,
        sharingCategory,
        setSharingCategory,
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
