'use client';

import { useSession } from 'next-auth/react';
import dynamicImport from 'next/dynamic';
import { Suspense } from 'react';
import { HomeFooter } from './components/views/HomePage';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

// Dynamically import components to prevent hydration issues
const HomePage = dynamicImport(() => import('./components/views/HomePage'), {
  ssr: false,
  loading: () => null
});

const ProfileView = dynamicImport(() => import('./components/views/ProfileView'), {
  ssr: false,
  loading: () => null
});

export default function Home() {
  const { data: session, status } = useSession();

  // Show loading state while checking auth status
  if (status === 'loading') {
    return null;
  }

  // Show profile view if authenticated, otherwise show welcome screen
  if (session) {
    return (
      <Suspense fallback={null}>
        <ProfileView />
      </Suspense>
    );
  }

  // Unauthenticated home page
  return (
    <>
      <HomePage />
      <HomeFooter />
    </>
  );
}
