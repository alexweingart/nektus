'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ContactView } from '../../components/views/ContactView';
import { Button } from '../../components/ui/buttons/Button';
import { useProfile } from '@/app/context/ProfileContext';
import type { UserProfile } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function ContactPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const { loadContacts, invalidateContactsCache } = useProfile();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Require authentication
  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      // Redirect to home for authentication
      router.push('/');
      return;
    }
  }, [session, status, router]);

  // Load contact from saved contacts (supports both shortCode and userId)
  // Only shows data that was deliberately shared during the exchange
  useEffect(() => {
    async function fetchProfile() {
      if (status === 'loading') return;
      if (!session?.user?.id) return;
      if (!code) {
        router.push('/history');
        return;
      }

      try {
        // Load from saved contacts only - contacts only exist if they were deliberately shared
        const savedContacts = await loadContacts(session.user.id);

        // Look for a saved contact matching by shortCode or userId
        const savedContact = savedContacts.find((c: SavedContact) =>
          c.shortCode === code || c.userId === code
        );

        if (savedContact) {
          // Check if we're viewing via userId but contact doesn't have a shortCode yet
          const isViewingViaUserId = code === savedContact.userId && !savedContact.shortCode;

          if (isViewingViaUserId) {
            // Fetch/generate shortCode for the profile, update saved contact, then redirect
            try {
              const profileRes = await fetch(`/api/profile/shortcode/${savedContact.userId}`);
              if (profileRes.ok) {
                const profileData = await profileRes.json();
                if (profileData.profile?.shortCode) {
                  const shortCode = profileData.profile.shortCode;

                  // Update the saved contact with the shortCode
                  await fetch(`/api/contacts/${savedContact.userId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shortCode })
                  });

                  console.log(`📌 Updated saved contact with shortCode: ${shortCode}`);

                  // Invalidate contacts cache so the next page load fetches fresh data
                  invalidateContactsCache();

                  // Redirect to shortCode URL
                  setIsRedirecting(true);
                  router.replace(`/c/${shortCode}`);
                  return;
                }
              }
            } catch (err) {
              console.warn('Failed to migrate to shortCode, continuing with userId:', err);
            }
          }

          // Use the saved contact data (already filtered from when contact was saved)
          setProfile(savedContact as UserProfile);

          // Dispatch match-found event for background colors
          if (savedContact.backgroundColors) {
            window.dispatchEvent(new CustomEvent('match-found', {
              detail: { backgroundColors: savedContact.backgroundColors }
            }));
          }
        } else {
          // Contact not in saved contacts - user doesn't have permission to view
          setError('Contact not found. You may need to exchange contacts first.');
        }
      } catch (err) {
        console.error('Failed to fetch contact:', err);
        setError('Failed to load contact.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [code, session, status, router, loadContacts, invalidateContactsCache]);

  const handleGoBack = () => {
    router.push('/history');
  };

  // Show loading only while checking auth, fetching, or redirecting
  if (status === 'loading' || isLoading || isRedirecting) {
    return null;
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center max-w-sm px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <Button
            onClick={handleGoBack}
            variant="white"
            size="xl"
            className="w-full"
          >
            Back to History
          </Button>
        </div>
      </div>
    );
  }

  // Show contact view if authenticated and profile is loaded
  if (session && profile) {
    return (
      <ContactView
        profile={profile}
        onReject={handleGoBack}
        isLoading={false}
        token={code}
        isHistoricalContact={true}
      />
    );
  }

  // Fallback
  return null;
}

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactPageContent />
    </Suspense>
  );
}
