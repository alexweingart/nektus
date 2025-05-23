'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';
import ProfileCard from '../components/ProfileCard';

export default function ProfilePage() {
  const router = useRouter();
  const { userData, isProfileComplete, loadUserData } = useUser();
  
  // Check if user has completed profile setup
  useEffect(() => {
    loadUserData();
    if (!isProfileComplete) {
      router.push('/setup');
    }
  }, [isProfileComplete, loadUserData, router]);
  
  const handleStartConnection = () => {
    router.push('/connect');
  };
  
  if (!isProfileComplete) {
    return null; // Will redirect to setup
  }
  
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      <div className="container mx-auto max-w-md p-4">
        <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-4">
          Your Profile
        </h1>
        
        <div className="mb-6">
          <ProfileCard 
            userData={userData}
            isCurrentUser={true}
            onNektClick={handleStartConnection}
          />
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Ready to connect with someone new?
          </p>
          <button 
            onClick={handleStartConnection}
            className="btn-primary w-full py-3"
          >
            Bump to Connect
          </button>
        </div>
        
        <div className="mt-6 text-center">
          <button 
            onClick={() => router.push('/setup')}
            className="text-sm text-gray-600 dark:text-gray-400 underline"
          >
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  );
}
