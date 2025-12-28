'use client';

import React, { Suspense } from 'react';
import dynamicImport from 'next/dynamic';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

// Dynamically import HistoryView to prevent hydration issues
const HistoryView = dynamicImport(() => import('../components/views/HistoryView').then(mod => ({ default: mod.HistoryView })), {
  ssr: false,
  loading: () => <div className="min-h-dvh" />,
});

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryView />
    </Suspense>
  );
}
