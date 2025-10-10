/**
 * Edit Location Page - Edit or delete a location
 * Part of Phase 4: Location Management
 */

'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import LocationView from '@/app/components/views/LocationView';

export default function EditLocationPage() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get('id');

  if (!locationId) {
    return null;
  }

  return <LocationView locationId={locationId} />;
}
