"use client";

import React, { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { FaTimes } from 'react-icons/fa';
import { useAdminMode } from '../providers/AdminModeProvider';

// The admin mode banner component
export default function AdminBanner() {
  // Get the closeAdminMode function from our context
  const { closeAdminMode } = useAdminMode();
  const { data: session, status } = useSession();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // This component is conditionally rendered by ClientComponents when admin mode is active

  const handleDeleteAccount = async () => {
    // For testing purposes, we'll reset the NextAuth session without signing out of Google entirely
    if (!confirm('This will disconnect Nekt.Us from your Google account but keep you signed in to your browser. Continue?')) {
      return;
    }

    setIsDeleting(true);
    setDeleteStatus('loading');
    
    try {
      // 1. Sign out from NextAuth locally with the correct parameter
      await signOut({ redirect: false });
      
      // 2. Clear only the NextAuth cookies (not all Google cookies)
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.trim().split('=');
        if (name.includes('next-auth')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });
      
      // 3. Set a localStorage flag to force account selector on next sign-in
      localStorage.setItem('nektus_force_account_selector', 'true');
      
      // Show success status
      setDeleteStatus('success');
      
      // Turn off admin mode and reload page
      setTimeout(() => {
        closeAdminMode();
        window.location.href = '/';
      }, 1000);
    } catch (error) {
      console.error('Error during account deletion:', error);
      setDeleteStatus('error');
      setIsDeleting(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FF0000', // Red banner as requested
        color: 'white',
        padding: '12px 16px',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}
    >
      <div>
        <strong>ADMIN MODE</strong>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          style={{
            backgroundColor: 'white',
            color: '#FF0000',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            marginRight: '12px',
            fontWeight: 'bold',
            cursor: isDeleting ? 'not-allowed' : 'pointer',
            opacity: isDeleting ? 0.7 : 1
          }}
        >
          {deleteStatus === 'loading' ? 'Deleting...' : 
           deleteStatus === 'success' ? 'Deleted!' : 
           deleteStatus === 'error' ? 'Failed!' : 
           'Delete Account'}
        </button>
        
        <button
          onClick={closeAdminMode}
          style={{
            backgroundColor: 'transparent',
            color: 'white',
            border: 'none',
            padding: '8px',
            cursor: 'pointer'
          }}
        >
          <FaTimes />
        </button>
      </div>
    </div>
  );
}

// Hook to enable admin mode on a component (like the main Nekt.Us text)
export function useAdminModeActivator() {
  const { toggleAdminMode } = useAdminMode();
  
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleAdminMode();
  };
  
  return { onDoubleClick: handleDoubleClick };
}
