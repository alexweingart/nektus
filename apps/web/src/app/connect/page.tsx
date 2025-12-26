'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ContactView } from '../components/views/ContactView';
import { Button } from '../components/ui/buttons/Button';
import { PullToRefresh } from '../components/ui/layout/PullToRefresh';
import type { UserProfile } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import { ClientProfileService } from '@/lib/client/profile/firebase-save';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function ConnectPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get the exchange token from URL parameters
  const token = searchParams.get('token');
  const mode = searchParams.get('mode');
  const isHistoricalMode = mode === 'historical';

  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatchedProfile() {
      if (status === 'loading') return; // Still loading auth

      if (!session) {
        router.push('/');
        return;
      }

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
          profileImage: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjUwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImdyYWQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRkI2QzE7c3RvcC1vcGFjaXR5OjEiIC8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojRkY2RjYxO3N0b3Atb3BhY2l0eToxIiAvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIiBmaWxsPSJ1cmwoI2dyYWQpIi8+PHJlY3QgeD0iMTAwIiB5PSIxMDAiIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiByeD0iNTAiIGZpbGw9IiMwMDRENDAiLz48cmVjdCB4PSIyMDAiIHk9IjIwMCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIyMCIgZmlsbD0iI0ZGQjZDMSIvPjwvc3ZnPg==',
          backgroundImage: '',
          backgroundColors: ['#FF6F61', '#FFB6C1', '#FF1493'], // Vibrant coral/pink colors
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

      // Check if we already have this profile cached to avoid re-fetch on back navigation
      if (contactProfile && contactProfile.userId) {
        return;
      }

      try {

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

          if (!response.ok) {
            throw new Error('Failed to fetch matched profile');
          }

          const result = await response.json();

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

      } catch (error) {
        console.error('Failed to load matched profile:', error);
        setError(isHistoricalMode ? 'Failed to load historical contact' : 'Failed to load contact profile');
      }
    }

    fetchMatchedProfile();
  }, [session, status, router, token, isHistoricalMode, contactProfile]);


  // Show loading only while checking auth
  if (status === 'loading') {
    return null; // No visual loading state
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button
            onClick={() => router.push('/')}
            variant="white"
            size="xl"
            className="w-full"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Show contact view if authenticated and profile is loaded
  if (session && contactProfile && token) {
    return (
      <PullToRefresh disabled={true} onRefresh={() => {}}>
        <ContactView
          profile={contactProfile}
          onReject={() => router.push('/')}
          isLoading={false}
          token={token}
        />
      </PullToRefresh>
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
