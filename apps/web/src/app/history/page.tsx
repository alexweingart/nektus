'use client';

import React, { Suspense } from 'react';
import dynamicImport from 'next/dynamic';
import { PullToRefresh } from '../components/ui/layout/PullToRefresh';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

// Dynamically import HistoryView to prevent hydration issues
const HistoryView = dynamicImport(() => import('../components/views/HistoryView').then(mod => ({ default: mod.HistoryView })), {
  ssr: false,
  loading: () => <div className="min-h-dvh" />,
});

export default function HistoryPage() {
  const handleRefresh = async () => {
    // Reload the page to refresh all data
    window.location.reload();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <Suspense fallback={null}>
        <HistoryView />
      </Suspense>
    </PullToRefresh>
  );
} 