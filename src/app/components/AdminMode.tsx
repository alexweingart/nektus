"use client";

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { FaTimes } from 'react-icons/fa';

// Create a context for admin mode
type AdminModeContextType = {
  isAdminMode: boolean;
  toggleAdminMode: () => void;
  closeAdminMode: () => void;
};

const AdminModeContext = createContext<AdminModeContextType>({
  isAdminMode: false,
  toggleAdminMode: () => {},
  closeAdminMode: () => {}
});

// Hook to use admin mode context
export const useAdminMode = () => useContext(AdminModeContext);

// The admin mode banner component
export default function AdminMode() {
  const { isAdminMode, closeAdminMode } = useAdminMode();
  const { data: session, status } = useSession();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // Only show when admin mode is active
  if (!isAdminMode) return null;

  const handleDeleteAccount = async () => {
    if (!session || !session.user) {
      alert('You must be signed in to delete your account');
      return;
    }
    
    if (!confirm('Are you sure you want to delete your account? This will disconnect Nekt.Us from your Google account.')) {
      return;
    }

    setIsDeleting(true);
    setDeleteStatus('loading');

    try {
      // Call the API to delete the account and revoke Google access
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      setDeleteStatus('success');
      
      // Sign out after successful deletion and turn off admin mode
      setTimeout(() => {
        closeAdminMode(); // Turn off admin mode
        signOut({ callbackUrl: '/' });
      }, 1000);
    } catch (error) {
      console.error('Error deleting account:', error);
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
            cursor: (isDeleting || status !== 'authenticated') ? 'not-allowed' : 'pointer',
            opacity: (isDeleting || status !== 'authenticated') ? 0.7 : 1
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

// Provider component that wraps the app and provides admin mode functionality
export function AdminModeProvider({ children }: { children: ReactNode }) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  const toggleAdminMode = () => {
    setIsAdminMode(prev => !prev);
    // Vibrate if supported (mobile devices)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(200);
    }
  };
  
  const closeAdminMode = () => {
    setIsAdminMode(false);
  };
  
  return (
    <AdminModeContext.Provider value={{ isAdminMode, toggleAdminMode, closeAdminMode }}>
      <AdminMode />
      {children}
    </AdminModeContext.Provider>
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
