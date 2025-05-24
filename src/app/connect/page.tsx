"use client";

import React from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useProfile } from '../context/ProfileContext';
import ContactExchange from '../components/ContactExchange';

export default function ConnectPage() {
  const { status } = useSession();
  const { profile, isLoading } = useProfile();
  
  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    redirect('/');
  }
  
  // Show loading state while checking authentication or profile
  if (status === 'loading' || isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '100vh',
        padding: '20px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(76, 175, 80, 0.3)',
          borderTop: '4px solid var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }
  
  // Redirect to profile setup if profile is incomplete
  if (!profile || !profile.phone) {
    redirect('/setup');
  }
  
  return (
    <div>
      <ContactExchange />
      
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        :root {
          --primary: #4caf50;
          --primary-light: #81c784;
          --primary-dark: #388e3c;
          --secondary: #666666;
          --danger: #e53935;
        }
      `}</style>
    </div>
  );
}
