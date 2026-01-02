/**
 * Profile Context for iOS
 *
 * Manages user profile state and Firestore operations.
 * This is a simplified version of the web ProfileContext,
 * focused on core profile loading and saving.
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
} from "../../client/firebase";
import {
  generateProfileAssets,
  createAssetGenerationState,
  type AssetGenerationState,
} from "../../client/profile/asset-generation";

// Re-export types for convenience
export type { UserProfile, ContactEntry, UserLocation };

export interface SavedContact {
  odtId: string;
  odtName: string;
  userId: string;
  addedAt: number;
  profileImage?: string;
  phone?: string;
  email?: string;
  contactType?: 'personal' | 'work';
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
  refreshProfile: () => Promise<void>;
  // Contacts
  contacts: SavedContact[] | null;
  loadContacts: (force?: boolean) => Promise<SavedContact[]>;
  getContact: (contactUserId: string) => SavedContact | null;
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

  // Contacts cache
  const [contacts, setContacts] = useState<SavedContact[] | null>(null);
  const [contactsLoadedAt, setContactsLoadedAt] = useState<number | null>(null);

  // Asset generation state
  const [assetGeneration, setAssetGeneration] = useState<AssetGenerationState>(
    createAssetGenerationState()
  );

  const loadingRef = useRef(false);
  const profileRef = useRef<UserProfile | null>(null);
  const initializedRef = useRef(false);
  const assetGenerationTriggeredRef = useRef(false);

  const CONTACTS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Initialize Firebase services once
  useEffect(() => {
    if (!initializedRef.current) {
      initializeFirebaseServices();
      initializedRef.current = true;
    }
  }, []);

  // Load profile when authenticated
  useEffect(() => {
    const loadProfile = async () => {
      if (
        authStatus === "authenticated" &&
        session?.user?.id &&
        !profile &&
        !loadingRef.current
      ) {
        loadingRef.current = true;
        setIsLoading(true);

        try {
          // Use Firebase SDK to load profile
          const profileData = await ClientProfileService.getProfile(
            session.user.id
          );

          if (profileData) {
            setProfile(profileData);
            profileRef.current = profileData;
            console.log(
              "[ProfileContext] Profile loaded for user:",
              session.user.id
            );
          } else {
            // Profile should have been created by the backend during auth
            console.warn(
              "[ProfileContext] Profile not found for user:",
              session.user.id
            );
            setProfile(null);
          }
        } catch (error) {
          console.error("[ProfileContext] Failed to load profile:", error);
        } finally {
          setIsLoading(false);
          loadingRef.current = false;
        }
      } else if (authStatus === "unauthenticated") {
        setProfile(null);
        profileRef.current = null;
        setContacts(null);
        setContactsLoadedAt(null);
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [authStatus, session?.user?.id, profile]);

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
        onProfileUpdate: (updatedProfile) => {
          setProfile(updatedProfile);
          profileRef.current = updatedProfile;
        },
      }).catch((error) => {
        console.error("[ProfileContext] Asset generation failed:", error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          profileRef.current = saveResult.profile;
          if (!options.directUpdate) {
            setProfile(saveResult.profile);
          }

          console.log("[ProfileContext] Profile saved");
          return saveResult.profile;
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

  // Refresh profile using Firebase SDK
  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const profileData = await ClientProfileService.getProfile(
        session.user.id
      );

      if (profileData) {
        setProfile(profileData);
        profileRef.current = profileData;
      }
    } catch (error) {
      console.error("[ProfileContext] Failed to refresh profile:", error);
    }
  }, [session?.user?.id]);

  // Load contacts using Firebase SDK
  const loadContacts = useCallback(
    async (force: boolean = false): Promise<SavedContact[]> => {
      if (!session?.user?.id) return [];

      // Check cache validity
      if (!force && contacts && contactsLoadedAt) {
        const age = Date.now() - contactsLoadedAt;
        if (age < CONTACTS_CACHE_DURATION) {
          return contacts;
        }
      }

      try {
        const sharedContacts: SharedSavedContact[] = await ClientProfileService.getContacts(
          session.user.id
        );

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
        }));

        // Sort by addedAt (newest first)
        loadedContacts.sort((a, b) => b.addedAt - a.addedAt);

        setContacts(loadedContacts);
        setContactsLoadedAt(Date.now());

        return loadedContacts;
      } catch (error) {
        console.error("[ProfileContext] Failed to load contacts:", error);
        return [];
      }
    },
    [session?.user?.id, contacts, contactsLoadedAt, CONTACTS_CACHE_DURATION]
  );

  // Get single contact
  const getContact = useCallback(
    (contactUserId: string): SavedContact | null => {
      if (!contacts) return null;
      return contacts.find((c) => c.userId === contactUserId) || null;
    },
    [contacts]
  );

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
        refreshProfile,
        contacts,
        loadContacts,
        getContact,
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
export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}

// profileHasPhone is now imported from @nektus/shared-client
export { profileHasPhone };
