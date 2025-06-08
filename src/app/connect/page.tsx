'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

export default function ConnectPage() {
  console.log('CLIENT CONNECT PAGE LOADING');
  
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    console.log('Connect page session status:', status);
    
    if (status === 'loading') return; // Still loading
    
    if (!session) {
      console.log('No session, redirecting to home');
      router.push('/');
      return;
    }

    // For now, redirect to setup to test
    console.log('Redirecting to setup');
    router.push('/setup');
  }, [session, status, router]);

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500">Connecting...</p>
      </div>
    </div>
  );
}
