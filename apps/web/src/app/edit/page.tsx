'use client';

import React, { Suspense } from 'react';
import dynamicImport from 'next/dynamic';

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic';

// Use dynamic import to ensure component is loaded correctly
const EditProfileView = dynamicImport(() => import('../components/views/EditProfileView'), {
  ssr: false,
  loading: () => <div className="min-h-dvh" />,
});

export default function EditPage() {
  return (
    <Suspense fallback={null}>
      <EditProfileView />
    </Suspense>
  );
}
