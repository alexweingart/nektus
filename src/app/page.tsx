'use client';

import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Dynamically import components to prevent hydration issues
const HomePage = dynamic(() => import('./components/HomePage'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" />
    </div>
  )
});

const ProfileView = dynamic(() => import('./components/ProfileView'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" />
    </div>
  )
});

export default function Home() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  // Handle scroll behavior based on authentication state
  useEffect(() => {
    if (isLoading) return;
    
    if (!session) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [session, isLoading]);

  // Show loading state while checking auth status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show profile view if authenticated, otherwise show welcome screen
  return session ? <ProfileView /> : <HomePage />;
}
