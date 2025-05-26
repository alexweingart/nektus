'use client';

import EditProfile from '@/app/components/EditProfile';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function EditPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      // Redirect to home if not authenticated
      window.location.href = '/';
    },
  });
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!session && status !== 'loading') {
      router.push('/');
    }
  }, [session, status, router]);

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <EditProfile />;
}
