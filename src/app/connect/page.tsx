'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ContactView } from '../components/views/ContactView';
import { generateMessageText, openMessagingApp } from '@/lib/services/client/messagingService';
import { Button } from '../components/ui/buttons/Button';
import type { UserProfile } from '@/types/profile';
import type { ContactSaveResult, SavedContact } from '@/types/contactExchange';
import { ClientProfileService } from '@/lib/firebase/clientProfileService';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function ConnectPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Get the exchange token from URL parameters
  const token = searchParams.get('token');
  const mode = searchParams.get('mode');
  const isHistoricalMode = mode === 'historical';

  useEffect(() => {
    async function fetchMatchedProfile() {
      if (status === 'loading') return; // Still loading auth
      
      if (!session) {
        console.log('No session, redirecting to home');
        router.push('/');
        return;
      }

      if (!token) {
        console.log('No exchange token provided, redirecting to home');
        router.push('/');
        return;
      }

      // Check if we already have this profile cached to avoid re-fetch on back navigation
      if (contactProfile && contactProfile.userId) {
        console.log('✅ Profile already loaded, skipping fetch');
        return;
      }

      try {
        console.log('🔍 Fetching matched profile for token:', token, isHistoricalMode ? '(historical)' : '(active)');
        
        if (isHistoricalMode) {
          // For historical mode, fetch from saved contacts
          const contacts = await ClientProfileService.getContacts(session.user.id);
          
          // Find the contact with matching token
          const contact = contacts.find((c: SavedContact) => c.matchToken === token);
          
          if (contact) {
            console.log('✅ Loaded historical contact:', contact.name);
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
            console.log('✅ Loaded matched profile:', result.profile.name);
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

  const handleMessageContact = (profile: UserProfile) => {
    if (!session?.user?.name || !profile.name) {
      console.warn('Missing user names for message generation');
      return;
    }

    const senderFirstName = session.user.name.split(' ')[0];
    const contactFirstName = profile.name.split(' ')[0];
    const messageText = generateMessageText(contactFirstName, senderFirstName);
    
    // Try to use phone number if available
    const phoneNumber = profile.contactChannels?.phoneInfo?.internationalPhone;
    
    console.log('📱 Opening messaging app with:', { messageText, phoneNumber });
    openMessagingApp(messageText, phoneNumber);
  };

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
            variant="theme"
            size="lg"
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
      <ContactView
        profile={contactProfile}
        onReject={() => router.push('/')}
        isLoading={false}
        token={token}
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
