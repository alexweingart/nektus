'use client';

import React, { Suspense, useState } from 'react';
import dynamicImport from 'next/dynamic';
import { useProfile } from '../context/ProfileContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { PullToRefresh } from '../components/ui/PullToRefresh';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

// Use dynamic import to ensure component is loaded correctly
const EditProfileView = dynamicImport(() => import('../components/views/EditProfileView'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="sm" />
    </div>
  ),
});

export default function EditPage() {
  const { profile } = useProfile();
  const [isDragMode, setIsDragMode] = useState(false);
  
  const handleRefresh = async () => {
    // Reload the page to refresh all data
    window.location.reload();
  };
  
  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={isDragMode}>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center">
          <LoadingSpinner size="sm" />
        </div>
      }>
        <EditProfileView onDragStateChange={setIsDragMode} />
      </Suspense>
    </PullToRefresh>
  );
}
