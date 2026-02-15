'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ContactView } from '../../components/views/ContactView';
import { AnonContactView } from '../../components/views/AnonContactView';
import { Button } from '../../components/ui/buttons/Button';
import { PhoneEntryModal } from '../../components/ui/modals/PhoneEntryModal';
import { useProfile } from '../../context/ProfileContext';
import type { UserProfile, ContactEntry } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import { ClientProfileService } from '@/client/profile/firebase-save';
import { formatPhoneNumber } from '@/client/profile/phone-formatter';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function ConnectPageContent() {
  const { data: session, status, update } = useSession();
  const { saveProfile } = useProfile(); // Uses ProfileProvider from root layout
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Get the exchange token from URL path parameter
  const token = params.token as string;
  const mode = searchParams.get('mode');
  const isHistoricalMode = mode === 'historical';

  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [previewProfile, setPreviewProfile] = useState<UserProfile | null>(null);
  const [socialIconTypes, setSocialIconTypes] = useState<string[]>([]);
  const [sharingCategory, setSharingCategory] = useState<'Personal' | 'Work'>('Personal');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Phone entry modal state for new users
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [isModalSaving, setIsModalSaving] = useState(false);
  const [phoneEntryComplete, setPhoneEntryComplete] = useState(false);

  // Handler for phone modal save
  const handlePhoneSave = useCallback(async (phone: string, socials: ContactEntry[]) => {
    setIsModalSaving(true);
    try {
      // Format phone number
      const phoneResult = formatPhoneNumber(phone);
      const internationalPhone = phoneResult.internationalPhone;

      // Build contact entries array with phone in both sections + any added socials
      const phoneEntries: ContactEntry[] = [
        { fieldType: 'phone', section: 'personal', value: internationalPhone, order: 0, isVisible: true, confirmed: true },
        { fieldType: 'phone', section: 'work', value: internationalPhone, order: 0, isVisible: true, confirmed: true },
        ...socials
      ];

      // Save phone via ProfileContext (same pattern as ProfileSetupView)
      await saveProfile({ contactEntries: phoneEntries });

      // Update session (prevents /setup redirect, user goes directly home after exchange)
      if (update) {
        await update({ isNewUser: false, redirectTo: '/' });
      }

      // Close modal → useEffect will proceed with exchange
      setPhoneEntryComplete(true);
      setShowPhoneModal(false);
    } catch (err) {
      console.error('[ConnectPage] Failed to save phone:', err);
      // Re-throw so modal can display error to user
      throw err;
    } finally {
      setIsModalSaving(false);
    }
  }, [saveProfile, update]);

  useEffect(() => {
    async function fetchMatchedProfile() {
      if (status === 'loading') return; // Still loading auth

      if (!token) {
        router.push('/');
        return;
      }

      // Special handling for test mode - check before cache check
      if (token === 'test-animation-token') {
        // Check if we already have the mock profile loaded
        if (contactProfile && contactProfile.userId === 'mock-user-123') {
          return;
        }

        // Create mock profile for testing with robot avatar and vibrant colors
        const mockProfile: UserProfile = {
          userId: 'mock-user-123',
          shortCode: 'mocktest',
          profileImage: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjUwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdyYWQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRkI2QzE7c3RvcC1vcGFjaXR5OjEiIC8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojRkY2RjYxO3N0b3Atb3BhY2l0eToxIiAvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIiBmaWxsPSJ1cmwoI2dyYWQpIi8+PHJlY3QgeD0iMTAwIiB5PSIxMDAiIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiByeD0iNTAiIGZpbGw9IiMwMDRENDAiLz48cmVjdCB4PSIyMDAiIHk9IjIwMCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIyMCIgZmlsbD0iI0ZGQjZDMSIvPjwvc3ZnPg==',
          backgroundImage: '',
          backgroundColors: ['#FF6F61', '#FFB6C1', '#FF1493'],
          lastUpdated: Date.now(),
          contactEntries: [
            { fieldType: 'name', value: 'Demo Contact', section: 'personal', order: 0, isVisible: true, confirmed: true },
            { fieldType: 'bio', value: 'This is a test contact for animation preview. In real usage, this would show the contact\'s actual profile information.', section: 'personal', order: 1, isVisible: true, confirmed: true },
            { fieldType: 'phone', value: '+1234567890', section: 'personal', order: 2, isVisible: true, confirmed: true },
            { fieldType: 'email', value: 'demo@example.com', section: 'personal', order: 3, isVisible: true, confirmed: true },
            { fieldType: 'instagram', value: 'democontact', section: 'personal', order: 4, isVisible: true, confirmed: true },
            { fieldType: 'x', value: 'democontact', section: 'personal', order: 5, isVisible: true, confirmed: true }
          ],
          calendars: []
        };

        // Always dispatch match-found event to signal loading complete
        window.dispatchEvent(new CustomEvent('match-found', {
          detail: mockProfile.backgroundColors ? { backgroundColors: mockProfile.backgroundColors } : {}
        }));

        setContactProfile(mockProfile);
        return;
      }

      // Check if we already have profile cached to avoid re-fetch on back navigation
      if (session && contactProfile && contactProfile.userId) {
        return;
      }
      if (!session && previewProfile && previewProfile.userId) {
        return;
      }

      try {
        if (session) {
          // Check if this is a new user who needs to enter their phone first
          if (session.isNewUser && !phoneEntryComplete && !isHistoricalMode) {
            // Fetch preview to show contact behind modal + get sharingCategory
            try {
              const previewResponse = await fetch(`/api/exchange/preview/${token}`);
              const previewResult = await previewResponse.json();
              if (previewResult.success) {
                if (previewResult.sharingCategory) {
                  setSharingCategory(previewResult.sharingCategory);
                }
                if (previewResult.profile) {
                  setPreviewProfile(previewResult.profile);
                  setSocialIconTypes(previewResult.socialIconTypes || []);
                  // Dispatch match-found so LayoutBackground uses contact colors
                  window.dispatchEvent(new CustomEvent('match-found', {
                    detail: {
                      backgroundColors: previewResult.profile.backgroundColors,
                      loaded: true
                    }
                  }));
                }
              }
            } catch (err) {
              console.log('[ConnectPage] Could not fetch preview for new user:', err);
            }
            setShowPhoneModal(true);
            return; // Don't call exchange API yet - wait for modal
          }

          // Authenticated user - fetch full profile
          if (isHistoricalMode) {
            // For historical mode, fetch from saved contacts
            const contacts = await ClientProfileService.getContacts(session.user.id);

            // Find the contact with matching token
            const contact = contacts.find((c: SavedContact) => c.matchToken === token);

            if (contact) {
              // Always dispatch match-found event to signal loading complete
              window.dispatchEvent(new CustomEvent('match-found', {
                detail: contact.backgroundColors ? { backgroundColors: contact.backgroundColors } : {}
              }));

              setContactProfile(contact);
            } else {
              throw new Error('Historical contact not found');
            }
          } else {
            // For active exchanges, use the exchange API
            const response = await fetch(`/api/exchange/pair/${token}`);
            const result = await response.json();

            if (!response.ok) {
              // Check for specific error codes
              if (result.code === 'ALREADY_SCANNED') {
                setErrorCode('ALREADY_SCANNED');
                setError('This QR code was already scanned by someone else');
                return;
              }
              throw new Error(result.message || 'Failed to fetch matched profile');
            }

            if (result.success && result.profile) {
              // Always dispatch match-found event to signal loading complete
              window.dispatchEvent(new CustomEvent('match-found', {
                detail: result.profile.backgroundColors ? { backgroundColors: result.profile.backgroundColors } : {}
              }));

              setContactProfile(result.profile);
            } else {
              throw new Error('Invalid profile response');
            }
          }
        } else {
          // Unauthenticated user - fetch preview
          const response = await fetch(`/api/exchange/preview/${token}`);
          const result = await response.json();

          if (!response.ok) {
            // Check for specific error codes
            if (result.code === 'ALREADY_SCANNED') {
              setErrorCode('ALREADY_SCANNED');
              setError('This QR code was already scanned by someone else');
              return;
            }
            throw new Error(result.message || 'Failed to fetch profile preview');
          }

          if (result.success && result.profile) {
            setPreviewProfile(result.profile);
            setSocialIconTypes(result.socialIconTypes || []);
            if (result.sharingCategory) {
              setSharingCategory(result.sharingCategory);
            }

            // Dispatch match-found event so LayoutBackground uses contact colors
            window.dispatchEvent(new CustomEvent('match-found', {
              detail: {
                backgroundColors: result.profile.backgroundColors,
                loaded: true
              }
            }));
          } else {
            throw new Error('Invalid preview response');
          }
        }

      } catch (error) {
        console.error('Failed to load profile:', error);
        setError(session
          ? (isHistoricalMode ? 'Failed to load historical contact' : 'Failed to load contact profile')
          : 'Failed to load profile preview'
        );
      }
    }

    fetchMatchedProfile();
  }, [session, status, router, token, isHistoricalMode, contactProfile, previewProfile, phoneEntryComplete]);


  // Show loading only for initial auth check — if we already have a
  // contactProfile rendered, don't tear down the UI on session refresh
  // (which briefly sets status to 'loading' and would unmount ContactView,
  // causing modals to re-animate).
  if (status === 'loading' && !contactProfile) {
    return null;
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-gray-900 to-black px-6">
        <div className="text-center max-w-sm">
          {errorCode === 'ALREADY_SCANNED' ? (
            <>
              <p className="text-white text-xl font-semibold mb-2">Already Scanned</p>
              <p className="text-gray-400 mb-6">
                Someone else already scanned this QR code. Ask your new friend to show you a new one.
              </p>
            </>
          ) : (
            <p className="text-red-400 mb-6">{error}</p>
          )}
          <Button
            onClick={() => router.push('/')}
            variant="white"
            size="xl"
            className="w-full"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Show unauthenticated preview view
  if (!session && previewProfile && token) {
    return (
      <AnonContactView
        profile={previewProfile}
        socialIconTypes={socialIconTypes}
        token={token}
      />
    );
  }

  // Show contact view if authenticated and profile is loaded
  if (session && contactProfile && token) {
    return (
      <>
        <PhoneEntryModal
          isOpen={showPhoneModal}
          userName={session.user?.name || ''}
          isSaving={isModalSaving}
          onSave={handlePhoneSave}
          scannedSection={sharingCategory.toLowerCase() as 'personal' | 'work'}
        />
        <ContactView
          profile={contactProfile}
          onReject={() => router.push('/')}
          isLoading={false}
          token={token}
          skipEnterAnimation={phoneEntryComplete}
          scannedSection={sharingCategory.toLowerCase() as 'personal' | 'work'}
        />
      </>
    );
  }

  // Show phone modal for new users before exchange is created
  // Render preview profile behind the modal so user sees the contact's profile + colors
  if (session && showPhoneModal) {
    return (
      <>
        <PhoneEntryModal
          isOpen={showPhoneModal}
          userName={session.user?.name || ''}
          isSaving={isModalSaving}
          onSave={handlePhoneSave}
          scannedSection={sharingCategory.toLowerCase() as 'personal' | 'work'}
        />
        {previewProfile && (
          <AnonContactView
            profile={previewProfile}
            socialIconTypes={socialIconTypes}
            token={token}
          />
        )}
      </>
    );
  }

  // Keep showing preview (no buttons) while exchange API loads after phone modal
  if (session && phoneEntryComplete && !contactProfile && previewProfile) {
    return (
      <AnonContactView
        profile={previewProfile}
        socialIconTypes={socialIconTypes}
        token={token}
        hideActions
      />
    );
  }

  // Wait for profile to load - no visual fallback
  return null;
}

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectPageContent />
    </Suspense>
  );
}
