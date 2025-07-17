'use client';

import React, { Suspense } from 'react';
import dynamicImport from 'next/dynamic';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { PullToRefresh } from '../components/ui/PullToRefresh';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

// Dynamically import HistoryView to prevent hydration issues
const HistoryView = dynamicImport(() => import('../components/views/HistoryView').then(mod => ({ default: mod.HistoryView })), {
  ssr: false,
  loading: () => (
    <div className="min-h-dvh flex items-center justify-center">
      <LoadingSpinner size="sm" />
    </div>
  ),
});

export default function HistoryPage() {
  const handleRefresh = async () => {
    // Reload the page to refresh all data
    window.location.reload();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center">
          <LoadingSpinner size="sm" />
        </div>
      }>
        <HistoryView />
      </Suspense>
    </PullToRefresh>
  );
} 