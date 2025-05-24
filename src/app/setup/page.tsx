'use client';

import React from 'react';
import ProfileSetup from '../components/ProfileSetup';
import { useSearchParams } from 'next/navigation';

export default function SetupPage() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {error && (
        <div className="fixed top-0 left-0 right-0 p-4 bg-destructive text-destructive-foreground z-50 text-center font-bold">
          There was a problem with Google sign-in. Please try again.
        </div>
      )}
      
      <div className="max-w-md mx-auto mt-4 animate-fade-in">
        <h1 className="text-2xl font-bold text-center mb-6 text-foreground">Set Up Your Profile</h1>
        <div className="bg-card rounded-xl shadow-md p-5 border border-border">
          <ProfileSetup />
        </div>
      </div>
    </div>
  );
}
