'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';
import ConnectionScreen from '../components/ConnectionScreen';

export default function ConnectPage() {
  const router = useRouter();
  const { isProfileComplete } = useUser();
  
  // Check if user has completed profile setup
  useEffect(() => {
    if (!isProfileComplete) {
      router.push('/setup');
    }
  }, [isProfileComplete, router]);
  
  if (!isProfileComplete) {
    return null; // Will redirect to setup
  }
  
  return <ConnectionScreen />;
}
