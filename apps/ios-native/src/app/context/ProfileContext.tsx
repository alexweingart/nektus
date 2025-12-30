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
import {
  getDocument,
  setDocument,
  getCollection,
} from "../../lib/client/firestore/rest";
import { useSession } from "../providers/SessionProvider";
import {
  profileHasPhone,
  profileNeedsSetup,
  UserProfile,
  ContactEntry,
  UserLocation,
} from "@nektus/shared-lib";

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

  const loadingRef = useRef(false);
  const profileRef = useRef<UserProfile | null>(null);

  const CONTACTS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
          // Use REST API to load profile
          const profileData = await getDocument<UserProfile>(
            `profiles/${session.user.id}`
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

  // Save profile using REST API
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
        const merged: UserProfile = {
          ...profileRef.current,
          ...data,
          lastUpdated: Date.now(),
        };

        // Handle contactEntries merge
        if (data.contactEntries && profileRef.current.contactEntries) {
          merged.contactEntries = data.contactEntries;
        }

        await setDocument(`profiles/${session.user.id}`, merged);

        profileRef.current = merged;
        if (!options.directUpdate) {
          setProfile(merged);
        }

        console.log("[ProfileContext] Profile saved");
        return merged;
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

  // Refresh profile using REST API
  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const profileData = await getDocument<UserProfile>(
        `profiles/${session.user.id}`
      );

      if (profileData) {
        setProfile(profileData);
        profileRef.current = profileData;
      }
    } catch (error) {
      console.error("[ProfileContext] Failed to refresh profile:", error);
    }
  }, [session?.user?.id]);

  // Load contacts using REST API
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
        const docs = await getCollection<{
          odtName?: string;
          userId?: string;
          addedAt?: number;
          profileImage?: string;
          phone?: string;
          email?: string;
        }>(`profiles/${session.user.id}/contacts`);

        const loadedContacts: SavedContact[] = docs.map((doc) => ({
          odtId: doc._id,
          odtName: doc.odtName || "",
          userId: doc.userId || "",
          addedAt: doc.addedAt || Date.now(),
          profileImage: doc.profileImage,
          phone: doc.phone,
          email: doc.email,
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

// profileHasPhone is now imported from @nektus/shared-lib
export { profileHasPhone };
