'use client';

import { useSession } from 'next-auth/react';
import dynamicImport from 'next/dynamic';
import { Suspense } from 'react';
import { PullToRefresh } from './components/ui/layout/PullToRefresh';

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

  // Middleware now handles all redirects reliably - no client-side redirect needed

  // Server-side redirects now handle routing - simplified client logic


  const handleRefresh = async () => {
    // Reload the page to refresh all data
    window.location.reload();
  };
  
  // The background is now handled automatically by the root layout and context.

  // Show loading state while checking auth status
  if (status === 'loading') {
    return null;
  }


  // Show profile view if authenticated, otherwise show welcome screen
  if (session) {
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <Suspense fallback={<div className="min-h-dvh" />}>
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
