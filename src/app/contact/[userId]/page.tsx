'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ContactView } from '../../components/views/ContactView';
import { Button } from '../../components/ui/buttons/Button';
import type { SavedContact } from '@/types/contactExchange';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ClientProfileService } from '@/lib/firebase/clientProfileService';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function ContactPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [contactProfile, setContactProfile] = useState<SavedContact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const userId = params.userId as string;

  useEffect(() => {
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
        setIsLoading(true);
        console.log('🔍 Fetching contact for userId:', userId);
        
        // Fetch all contacts for the current user
        const contacts = await ClientProfileService.getContacts(session.user.id);
        
        // Find the contact with matching userId
        const contact = contacts.find((c: SavedContact) => c.userId === userId);
        
        if (contact) {
          console.log('✅ Loaded contact:', contact.name);
          setContactProfile(contact);
        } else {
          throw new Error('Contact not found in your saved contacts');
        }
        
      } catch (error) {
        console.error('Failed to load contact:', error);
        setError('Failed to load contact. This contact may no longer be available.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchContact();
  }, [session, status, router, userId]);

  const handleGoBack = () => {
    router.push('/history');
  };

  // Show loading while checking auth or fetching contact
  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center">
          <LoadingSpinner size="sm" className="mx-auto" />
          <p className="mt-2 text-sm text-gray-500">
            {status === 'loading' ? 'Loading...' : 'Loading contact...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center max-w-sm px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <Button 
            onClick={handleGoBack}
            variant="theme"
            size="lg"
            className="w-full"
          >
            Back to History
          </Button>
        </div>
      </div>
    );
  }

  // Show contact view if authenticated and contact is loaded
  if (session && contactProfile) {
    return (
      <ContactView
        profile={contactProfile}
        onReject={handleGoBack}
        isLoading={false}
        token={contactProfile.matchToken}
        isHistoricalContact={true}
      />
    );
  }

  // Fallback - should not reach here
  return (
    <div className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-gray-900 to-black">
      <div className="text-center">
        <p className="text-gray-400">Something went wrong</p>
        <Button 
          onClick={handleGoBack}
          variant="theme"
          size="lg"
          className="mt-4 w-full"
        >
          Back to History
        </Button>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-dvh bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center">
          <LoadingSpinner size="sm" className="mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <ContactPageContent />
    </Suspense>
  );
}