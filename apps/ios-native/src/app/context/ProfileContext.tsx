/**
 * Profile Context for iOS
 *
 * Manages user profile state and Firestore operations.
 * Uses onSnapshot subscriptions for real-time profile and contacts updates.
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { useSession } from "../providers/SessionProvider";
import { isFullApp } from "../../client/auth/session-handoff";
import {
  profileHasPhone,
  profileNeedsSetup,
  UserProfile,
  ContactEntry,
  UserLocation,
  ProfileSaveService,
  getFieldValue,
} from "@nektus/shared-client";
import type { SavedContact as SharedSavedContact } from "@nektus/shared-types";
import {
  ClientProfileService,
  initializeFirebaseServices,
  syncTimezone,
} from "../../client/firebase";
import {
  generateProfileAssets,
  createAssetGenerationState,
  extractBackgroundColors,
  type AssetGenerationState,
} from "../../client/profile/asset-generation";

// Re-export types for convenience
export type { UserProfile, ContactEntry, UserLocation };

export type SharingCategory = 'Personal' | 'Work';

export interface SavedContact {
  odtId: string;
  odtName: string;
  userId: string;
  addedAt: number;
  profileImage?: string;
  phone?: string;
  email?: string;
  contactType?: 'personal' | 'work';
  backgroundColors?: string[];
}

interface ProfileContextType {
  profile: UserProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  needsSetup: boolean;
  saveProfile: (
    data: Partial<UserProfile>,
    options?: { directUpdate?: boolean }
  ) => Promise<UserProfile | null>;
  getLatestProfile: () => UserProfile | null;
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
  // Asset generation state
  assetGeneration: AssetGenerationState;
  // Streaming states for immediate UI feedback (extracted from assetGeneration for convenience)
  streamingProfileImage: string | null;
  isGoogleInitials: boolean;
  isCheckingGoogleImage: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

interface ProfileProviderProps {
  children: ReactNode;
}

export function ProfileProvider({ children }: ProfileProviderProps) {
  const { data: session, status: authStatus } = useSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Contacts state (live via onSnapshot)
  const [contacts, setContacts] = useState<SavedContact[] | null>(null);
  const [contactsLoading, setContactsLoading] = useState(true);

  // Bio scraping loading state (persists across navigation)
  const [isBioLoading, setIsBioLoading] = useState(false);

  // Sharing category state (replaces AsyncStorage 'nekt-sharing-category')
  const [sharingCategory, setSharingCategory] = useState<SharingCategory>('Personal');

  // Asset generation state
  const [assetGeneration, setAssetGeneration] = useState<AssetGenerationState>(
    createAssetGenerationState()
  );

  const loadingRef = useRef(false);
  const profileRef = useRef<UserProfile | null>(null);
  const initializedRef = useRef(false);
  const assetGenerationTriggeredRef = useRef(false);

  // Subscription unsubscribe refs
  const profileUnsubRef = useRef<(() => void) | null>(null);
  const contactsUnsubRef = useRef<(() => void) | null>(null);
  const isFirstProfileCallbackRef = useRef(true);

  // Initialize Firebase services once
  useEffect(() => {
    if (!initializedRef.current) {
      initializeFirebaseServices();
      initializedRef.current = true;
    }
  }, []);

  // Load profile when authenticated (using onSnapshot subscriptions)
  useEffect(() => {
    const setupSubscriptions = () => {
      if (
        authStatus === "authenticated" &&
        session?.user?.id &&
        !profile &&
        !loadingRef.current
      ) {
        loadingRef.current = true;
        setIsLoading(true);
        isFirstProfileCallbackRef.current = true;

        // Subscribe to profile updates
        profileUnsubRef.current = ClientProfileService.subscribeToProfile(
          session.user.id,
          (profileData) => {
            if (profileData) {
              if (isFirstProfileCallbackRef.current) {
                isFirstProfileCallbackRef.current = false;
                console.log(
                  "[ProfileContext] Profile loaded for user:",
                  session.user.id
                );
              }
              setProfile(profileData);
              profileRef.current = profileData;
              setIsLoading(false);
              loadingRef.current = false;
            } else {
              if (isFirstProfileCallbackRef.current) {
                isFirstProfileCallbackRef.current = false;
                // Profile should have been created by the backend during auth
                console.warn(
                  "[ProfileContext] Profile not found for user:",
                  session.user.id
                );
                setProfile(null);
                setIsLoading(false);
                loadingRef.current = false;
              }
            }
          }
        );

        // Subscribe to contacts updates
        setContactsLoading(true);
        contactsUnsubRef.current = ClientProfileService.subscribeToContacts(
          session.user.id,
          (sharedContacts: SharedSavedContact[]) => {
            // Transform shared-types SavedContact to local SavedContact format
            const loadedContacts: SavedContact[] = sharedContacts.map((contact) => ({
              odtId: contact.userId,
              odtName: getFieldValue(contact.contactEntries, 'name') || '',
              userId: contact.userId,
              addedAt: contact.addedAt,
              profileImage: contact.profileImage,
              phone: getFieldValue(contact.contactEntries, 'phone'),
              email: getFieldValue(contact.contactEntries, 'email'),
              contactType: contact.contactType,
              backgroundColors: contact.backgroundColors,
            }));

            // Sort by addedAt (newest first)
            loadedContacts.sort((a, b) => b.addedAt - a.addedAt);

            setContacts(loadedContacts);
            setContactsLoading(false);
          }
        );
      } else if (authStatus === "unauthenticated") {
        // Clean up subscriptions
        if (profileUnsubRef.current) {
          profileUnsubRef.current();
          profileUnsubRef.current = null;
        }
        if (contactsUnsubRef.current) {
          contactsUnsubRef.current();
          contactsUnsubRef.current = null;
        }

        setProfile(null);
        profileRef.current = null;
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
  }, [authStatus, session?.user?.id]);

  // Update ref when profile changes
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Trigger asset generation after profile loads
  useEffect(() => {
    if (
      profile &&
      session?.user?.id &&
      !assetGenerationTriggeredRef.current &&
      !isLoading
    ) {
      assetGenerationTriggeredRef.current = true;

      console.log("[ProfileContext] Triggering asset generation");

      generateProfileAssets({
        userId: session.user.id,
        profile,
        session,
        currentState: assetGeneration,
        onStateChange: (updates) =>
          setAssetGeneration((prev) => ({ ...prev, ...updates })),
      }).catch((error) => {
        console.error("[ProfileContext] Asset generation failed:", error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.userId, session?.user?.id, isLoading]);

  // Sync device timezone to Firestore (once per session, after profile loads)
  const timezoneSyncedRef = useRef(false);
  useEffect(() => {
    if (profile && session?.user?.id && !isLoading && !timezoneSyncedRef.current) {
      timezoneSyncedRef.current = true;
      syncTimezone(session.user.id, profile.timezone);
    }
  }, [profile?.userId, session?.user?.id, isLoading]);

  // Save profile using ProfileSaveService
  const saveProfile = useCallback(
    async (
      data: Partial<UserProfile>,
      options: { directUpdate?: boolean } = {}
    ): Promise<UserProfile | null> => {
      if (!session?.user?.id) {
        console.error("[ProfileContext] No authenticated user");
        return null;
      }

      if (!profileRef.current) {
        console.error("[ProfileContext] Profile not loaded");
        return null;
      }

      setIsSaving(true);

      try {
        // Use ProfileSaveService for consistent business logic
        const saveResult = await ProfileSaveService.saveProfile(
          session.user.id,
          profileRef.current,
          data,
          { directUpdate: options.directUpdate }
        );

        if (saveResult.success && saveResult.profile) {
          const savedProfile = saveResult.profile;

          // Capture previous profile image BEFORE updating the ref
          const previousProfileImage = profileRef.current?.profileImage;

          // Optimistic update: set immediately, onSnapshot confirms ms later
          profileRef.current = savedProfile;
          if (!options.directUpdate) {
            setProfile(savedProfile);
          }

          console.log("[ProfileContext] Profile saved");

          // Check if a new profile image was saved (different from previous)
          // and it's not an AI-generated avatar - trigger background color extraction
          // Skip if backgroundColors were already provided (e.g. from the upload API response)
          const newProfileImage = data.profileImage;
          const isNewImage = newProfileImage && newProfileImage !== previousProfileImage;
          const isUserUploadedImage = !savedProfile.aiGeneration?.avatarGenerated;
          const colorsAlreadyProvided = !!(data as any).backgroundColors;

          if (isNewImage && isUserUploadedImage && !colorsAlreadyProvided) {
            console.log("[ProfileContext] New profile image detected, extracting background colors...");
            // Run color extraction async (don't block the save)
            // onSnapshot will pick up the new colors automatically
            extractBackgroundColors(session.user.id)
              .catch((error) => {
                console.error("[ProfileContext] Background color extraction failed:", error);
              });
          }

          return savedProfile;
        } else {
          console.error("[ProfileContext] Save failed:", saveResult.error);
          return null;
        }
      } catch (error) {
        console.error("[ProfileContext] Failed to save profile:", error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [session?.user?.id]
  );

  // Get latest profile
  const getLatestProfile = useCallback((): UserProfile | null => {
    return profileRef.current;
  }, []);

  // Get single contact
  const getContact = useCallback(
    (contactUserId: string): SavedContact | null => {
      if (!contacts) return null;
      return contacts.find((c) => c.userId === contactUserId) || null;
    },
    [contacts]
  );

  // Get all contacts (convenience helper matching web)
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
        saveProfile,
        getLatestProfile,
        contacts,
        contactsLoading,
        getContact,
        getContacts,
        isBioLoading,
        setIsBioLoading,
        sharingCategory,
        setSharingCategory,
        assetGeneration,
        // Expose streaming states for convenience (matching web API)
        streamingProfileImage: assetGeneration.streamingProfileImage,
        isGoogleInitials: assetGeneration.isGoogleInitials,
        isCheckingGoogleImage: assetGeneration.isCheckingGoogleImage,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

// Hook for using the profile context
export function useProfile(): ProfileContextType {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    // In App Clip mode, return default values instead of throwing
    // This allows ContactView to be used without ProfileProvider
    if (isFullApp()) {
      throw new Error("useProfile must be used within a ProfileProvider");
    }
    // App Clip fallback - return minimal profile interface
    return {
      profile: null,
      isLoading: false,
      isSaving: false,
      needsSetup: false,
      saveProfile: async () => null,
      getLatestProfile: () => null,
      contacts: null,
      contactsLoading: false,
      getContact: () => null,
      getContacts: () => [],
      isBioLoading: false,
      setIsBioLoading: () => {},
      sharingCategory: 'Personal',
      setSharingCategory: () => {},
      assetGeneration: {
        isCheckingGoogleImage: false,
        isGoogleInitials: false,
        streamingProfileImage: null,
        profileImageGenerationTriggered: false,
        backgroundGenerationTriggered: false,
      },
      streamingProfileImage: null,
      isGoogleInitials: false,
      isCheckingGoogleImage: false,
    };
  }
  return context;
}

// profileHasPhone is now imported from @nektus/shared-client
export { profileHasPhone };
