'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ContactView } from '../components/ContactView';
import type { UserProfile } from '@/types/profile';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

export default function ConnectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    
    if (!session) {
      console.log('No session, redirecting to home');
      router.push('/');
      return;
    }

    // For now, set a mock profile
    // In the real implementation, this would come from the matched exchange
    const mockProfile: UserProfile = {
      userId: 'mock-user-123',
      name: 'John Doe',
      bio: 'Software Engineer passionate about technology and innovation. Love building amazing apps!',
      profileImage: '',
      backgroundImage: '',
      lastUpdated: Date.now(),
      contactChannels: {
        phoneInfo: {
          internationalPhone: '+1234567890',
          nationalPhone: '(123) 456-7890',
          userConfirmed: true
        },
        email: {
          email: 'john.doe@example.com',
          userConfirmed: true
        },
        facebook: { username: '', url: '', userConfirmed: false },
        instagram: { username: 'johndoe', url: 'https://instagram.com/johndoe', userConfirmed: true },
        x: { username: 'john_doe', url: 'https://x.com/john_doe', userConfirmed: true },
        linkedin: { username: 'johndoe', url: 'https://linkedin.com/in/johndoe', userConfirmed: true },
        snapchat: { username: '', url: '', userConfirmed: false },
        whatsapp: { username: '', url: '', userConfirmed: false },
        telegram: { username: '', url: '', userConfirmed: false },
        wechat: { username: '', url: '', userConfirmed: false }
      }
    };

    setContactProfile(mockProfile);
  }, [session, status, router]);

  const handleSaveContact = async () => {
    console.log('Saving contact...');
    
    // TODO: Implement actual contact saving through service
    // For now, just show success and navigate back
    setTimeout(() => {
      router.push('/');
    }, 1000);
  };

  const handleReject = () => {
    // Navigate back to profile
    router.push('/');
  };

  // Show loading while checking auth
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
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
        isLoading={false}
      />
    );
  }

  // Fallback loading state
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500">Loading contact...</p>
      </div>
    </div>
  );
}
