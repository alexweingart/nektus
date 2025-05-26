'use client';

import React from 'react';
import { EditProfile } from '../components/EditProfile';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function EditPage() {
  const { data: session, status } = useSession();
  
  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    redirect('/');
  }
  
  return <EditProfile />;
}
