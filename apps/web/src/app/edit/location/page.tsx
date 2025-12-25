/**
 * Edit Location Page - Edit or delete a location
 * Part of Phase 4: Location Management
 */

'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LocationView from '@/app/components/views/LocationView';
import { PullToRefresh } from '@/app/components/ui/layout/PullToRefresh';

function EditLocationContent() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get('id');

  if (!locationId) {
    return null;
  }

  return (
    <PullToRefresh disabled={true} onRefresh={() => {}}>
      <LocationView locationId={locationId} />
    </PullToRefresh>
  );
}

export default function EditLocationPage() {
  return (
    <Suspense fallback={null}>
      <EditLocationContent />
    </Suspense>
  );
}
