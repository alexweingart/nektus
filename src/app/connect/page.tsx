'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ContactView } from '../components/views/ContactView';
import { Button } from '../components/ui/buttons/Button';
import type { UserProfile } from '@/types/profile';
import type { SavedContact } from '@/types/contactExchange';
import { ClientProfileService } from '@/lib/firebase/clientProfileService';
import { getFieldValue } from '@/lib/utils/profileTransforms';

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
            const contactName = getFieldValue(contact.contactEntries, 'name');
            console.log('✅ Loaded historical contact:', contactName);
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
            console.log('✅ Loaded matched profile data:', result.profile);
            console.log('📋 Contact entries:', result.profile.contactEntries);
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
            variant="theme"
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
  console.log('🔍 Render check:', {
    hasSession: !!session,
    hasContactProfile: !!contactProfile,
    hasToken: !!token,
    shouldRender: !!(session && contactProfile && token)
  });

  if (session && contactProfile && token) {
    console.log('🎯 Rendering ContactView with profile:', contactProfile.userId);
    const contactView = (
      <ContactView
        profile={contactProfile}
        onReject={() => router.push('/')}
        isLoading={false}
        token={token}
      />
    );
    console.log('📱 ContactView JSX created:', !!contactView);
    return contactView;
  }

  // Wait for profile to load - no visual fallback
  console.log('⏳ ConnectPage: Waiting for data - returning null');
  return null;
}

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectPageContent />
    </Suspense>
  );
}
