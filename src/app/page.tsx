'use client';

import { useSession } from 'next-auth/react';
import dynamicImport from 'next/dynamic';
import { Suspense } from 'react';
import { useProfile } from './context/ProfileContext';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { PullToRefresh } from './components/ui/PullToRefresh';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

// Dynamically import components to prevent hydration issues
const HomePage = dynamicImport(() => import('./components/views/HomePage'), { 
  ssr: false,
  loading: () => <div className="min-h-dvh" />
});

const ProfileView = dynamicImport(() => import('./components/views/ProfileView'), { 
  ssr: false,
  loading: () => <div className="min-h-dvh" />
});

export default function Home() {
  const { data: session, status } = useSession();
  const { profile } = useProfile();

  // Middleware now handles all redirects reliably - no client-side redirect needed

  // Server-side redirects now handle routing - simplified client logic
  const isLoading = status === 'loading' || (status === 'authenticated' && !profile);


  const handleRefresh = async () => {
    // Reload the page to refresh all data
    window.location.reload();
  };
  
  // The background is now handled automatically by the root layout and context.

  // Show loading state while checking auth status
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full min-h-dvh">
        <LoadingSpinner size="sm" />
      </div>
    );
  }


  // Show profile view if authenticated, otherwise show welcome screen
  if (session) {
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <Suspense fallback={<div className="flex h-full items-center justify-center">
          <LoadingSpinner size="sm" />
        </div>}>
          <ProfileView />
        </Suspense>
      </PullToRefresh>
    );
  }
  
  // Unauthenticated home page with pull-to-refresh
  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <HomePage />
    </PullToRefresh>
  );
}
