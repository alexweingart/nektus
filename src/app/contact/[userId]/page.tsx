'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ContactView } from '../../components/views/ContactView';
import { Button } from '../../components/ui/buttons/Button';
import type { SavedContact } from '@/types/contactExchange';
import { ClientProfileService } from '@/lib/firebase/clientProfileService';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function ContactPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [contactProfile, setContactProfile] = useState<SavedContact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
        // No loading state needed
      }
    }

    fetchContact();
  }, [session, status, router, userId]);

  const handleGoBack = () => {
    router.push('/history');
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