'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ContactView } from '../components/views/ContactView';
import { generateMessageText, openMessagingApp } from '@/lib/services/messagingService';
import type { UserProfile } from '@/types/profile';
import type { ContactSaveResult } from '@/types/contactExchange';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

function ConnectPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get the exchange token from URL parameters
  const token = searchParams.get('token');

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

      try {
        setIsLoading(true);
        console.log('🔍 Fetching matched profile for token:', token);
        
        // Fetch the matched user's profile using the exchange token
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
        
      } catch (error) {
        console.error('Failed to load matched profile:', error);
        setError('Failed to load contact profile');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMatchedProfile();
  }, [session, status, router, token]);

  const handleSaveContact = async () => {
    if (!token) {
      throw new Error('No exchange token available');
    }
    
    console.log('💾 Starting contact save process for token:', token);
    
    try {
      // First accept the exchange
      const acceptResponse = await fetch(`/api/exchange/pair/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept: true })
      });

      if (!acceptResponse.ok) {
        throw new Error('Failed to accept exchange');
      }

      console.log('✅ Exchange accepted, now saving contact...');

      // Then save the contact
      const saveResponse = await fetch('/api/save-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const saveResult: ContactSaveResult = await saveResponse.json();

      if (!saveResult.success) {
        throw new Error(saveResult.firebase.error || 'Failed to save contact');
      }

      console.log('✅ Contact save completed:', {
        firebase: saveResult.firebase.success,
        google: saveResult.google.success
      });

      // Log any Google Contacts issues (but don't fail)
      if (!saveResult.google.success && saveResult.google.error) {
        console.warn('⚠️ Google Contacts save failed:', saveResult.google.error);
      }

      // Success! The modal will be shown by ContactView
      
    } catch (error) {
      console.error('❌ Contact save failed:', error);
      throw error; // Re-throw to be handled by ContactView
    }
  };

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

  const handleReject = async () => {
    if (!token) {
      router.push('/');
      return;
    }
    
    try {
      // Reject the contact exchange
      const response = await fetch(`/api/exchange/pair/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept: false })
      });

      const data = await response.json();
      console.log('Reject response:', { ok: response.ok, status: response.status, data });

      if (response.ok) {
        console.log('Contact rejected successfully');
      } else {
        console.error('Failed to reject contact - Server error:', data);
      }
    } catch (error) {
      console.error('Error rejecting contact:', error);
    }
    
    // Navigate back to profile regardless
    router.push('/');
  };

  // Show loading while checking auth or fetching profile
  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black">
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Show contact view if authenticated and profile is loaded
  if (session && contactProfile) {
    return (
      <ContactView
        profile={contactProfile}
        onSaveContact={handleSaveContact}
        onReject={handleReject}
        onMessageContact={handleMessageContact}
        isLoading={false}
      />
    );
  }

  // Fallback - should not reach here
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black">
      <div className="text-center">
        <p className="text-gray-400">Something went wrong</p>
        <button 
          onClick={() => router.push('/')}
          className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/80"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center">
          <LoadingSpinner size="sm" className="mx-auto" />
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <ConnectPageContent />
    </Suspense>
  );
}
