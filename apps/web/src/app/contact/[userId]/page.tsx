'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ContactView } from '../../components/views/ContactView';
import { Button } from '../../components/ui/buttons/Button';
import { PullToRefresh } from '../../components/ui/layout/PullToRefresh';
import type { SavedContact } from '@/types/contactExchange';
import { useProfile } from '@/app/context/ProfileContext';
import { getFieldValue } from '@/lib/client/profile/transforms';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function ContactPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const { getContact } = useProfile();
  const [contactProfile, setContactProfile] = useState<SavedContact | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = params.userId as string;

  useEffect(() => {
    const mountTime = performance.now();
    const clickTime = sessionStorage.getItem('contact-click-time');
    if (clickTime) {
      const navDuration = mountTime - parseFloat(clickTime);
      console.log(`⏱️ [ContactPage] Mounted ${navDuration.toFixed(2)}ms after contact click`);
      sessionStorage.removeItem('contact-click-time');
    }

    async function fetchContact() {
      if (status === 'loading') return; // Still loading auth

      if (!session) {
        console.log('No session, redirecting to home');
        router.push('/');
        return;
      }

      if (!userId) {
        console.log('No user ID provided, redirecting to history');
        router.push('/history');
        return;
      }

      try {
        console.log('🔍 [ContactPage] Looking for contact:', userId);

        // Get contact from cache (ContactLayout loads it)
        const contact = getContact(userId);

        if (contact) {
          const contactName = getFieldValue(contact.contactEntries, 'name');
          console.log('✅ [ContactPage] Using contact:', contactName);
          setContactProfile(contact);
        } else {
          // Contact not loaded yet, wait for ContactLayout to load it
          console.log('📦 [ContactPage] Waiting for ContactLayout to load contact...');
        }

      } catch (error) {
        console.error('Failed to load contact:', error);
        setError('Failed to load contact. This contact may no longer be available.');
      }
    }

    fetchContact();
  }, [session, status, router, userId, getContact]);

  const handleGoBack = () => {
    const pushTime = performance.now();
    console.log('📍 ContactPage: router.push("/history") called at', pushTime.toFixed(2), 'ms');
    router.push('/history');
    // This won't execute until after push completes
    const afterPushTime = performance.now();
    console.log('📍 ContactPage: router.push returned at', afterPushTime.toFixed(2), 'ms (sync operation took', (afterPushTime - pushTime).toFixed(2), 'ms)');
  };

  // Show loading only while checking auth
  if (status === 'loading') {
    return null; // No visual loading state
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

  const handleRefresh = async () => {
    window.location.reload();
  };

  // Show contact view if authenticated and contact is loaded
  if (session && contactProfile) {
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <ContactView
          profile={contactProfile}
          onReject={handleGoBack}
          isLoading={false}
          token={contactProfile.matchToken}
          isHistoricalContact={true}
        />
      </PullToRefresh>
    );
  }

  // Wait for contact to load - no visual fallback
  return null;
}

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactPageContent />
    </Suspense>
  );
}