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
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'partial-success'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  // This component is conditionally rendered by ClientComponents when admin mode is active

  const handleDeleteAccount = async () => {
    if (!confirm('This will fully disconnect Nekt.Us from your Google account and delete all your data from our database. You will need to re-authorize the app next time you sign in. Continue?')) {
      return;
    }

    console.log('Starting account deletion process');
    setIsDeleting(true);
    setDeleteStatus('loading');
    setStatusMessage('');
    
    try {
      // 1. Delete user data from Firebase
      console.log('Step 1: Deleting user data from Firebase');
      const deleteDataResponse = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const deleteDataResult = await deleteDataResponse.json();
      console.log('Delete data response status:', deleteDataResponse.status, deleteDataResponse.ok);
      
      if (!deleteDataResponse.ok) {
        console.error('Failed to delete user data from Firebase:', deleteDataResult);
        // If we can't delete the data, we should stop the process
        throw new Error('Failed to delete user data from our database');
      } else {
        console.log('Successfully deleted user data from Firebase');
      }
      
      // 2. Revoke the OAuth token with Google - this is the critical step
      console.log('Step 2: Revoking OAuth token with Google');
      const revokeResponse = await fetch('/api/auth/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      let revokeResult;
      let tokenRevocationSuccessful = false;
      try {
        revokeResult = await revokeResponse.json();
        console.log('Revoke response status:', revokeResponse.status, revokeResponse.ok);
        console.log('Revoke response data:', revokeResult);
        tokenRevocationSuccessful = revokeResponse.ok;
      } catch (parseError) {
        console.error('Error parsing revoke response:', parseError);
        revokeResult = { error: 'Failed to parse response' };
      }
      
      if (!tokenRevocationSuccessful) {
        console.error('Failed to revoke token with Google:', revokeResult);
        // We'll continue but let the user know they need to revoke access manually
        setStatusMessage('Your data was deleted but token revocation failed. Please revoke Nekt.Us access in your Google account settings.');
      } else {
        console.log('Successfully revoked token with Google');
      }
      
      // 3. Sign out from NextAuth locally
      console.log('Step 3: Signing out from NextAuth');
      await signOut({ redirect: false });
      
      // 4. Clear all NextAuth cookies
      console.log('Step 4: Clearing all NextAuth cookies');
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.trim().split('=');
        if (name.includes('next-auth')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          console.log(`Cleared cookie: ${name}`);
        }
      });
      
      // 5. Clear any Google OAuth related localStorage items to force new authorization
      console.log('Step 5: Clearing localStorage items');
      localStorage.removeItem('nektus_force_account_selector'); // Remove old approach
      localStorage.removeItem('nektus_user');
      localStorage.removeItem('nektus_user_profile_cache'); // Clear profile cache
      localStorage.removeItem('nektus_profile');
      
      // Show appropriate success/partial success status
      console.log('Account deletion process completed');
      if (tokenRevocationSuccessful) {
        setDeleteStatus('success');
      } else {
        setDeleteStatus('partial-success');
      }
      
      // Turn off admin mode and reload page
      setTimeout(() => {
        closeAdminMode();
        window.location.href = '/';
      }, 3000); // Give users more time to read the message
    } catch (error) {
      console.error('Error during account deletion:', error);
      setDeleteStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Unknown error occurred');
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
      
      {statusMessage && (
        <div style={{
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          marginTop: '10px',
          fontSize: '14px',
          maxWidth: '300px'
        }}>
          {statusMessage}
        </div>
      )}
      
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
           deleteStatus === 'partial-success' ? 'Partial Success' :
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
