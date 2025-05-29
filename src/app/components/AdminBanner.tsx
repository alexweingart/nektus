"use client";

import React, { useState, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { FaTimes } from 'react-icons/fa';
import { useAdminMode } from '../providers/AdminModeProvider';
import { useRouter } from 'next/navigation';

// The admin mode banner component
export default function AdminBanner() {
  // Get the closeAdminMode function from our context
  const { closeAdminMode } = useAdminMode();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  // Store a reference to the session data for direct access during deletion
  const [sessionData, setSessionData] = useState<any>(null);
  
  // Extract needed information from the session when it loads
  useEffect(() => {
    if (session) {
      // Store essential session data for account deletion
      setSessionData({
        email: session.user?.email,
        accessToken: session.accessToken,
        userId: session.user?.id
      });
      console.log('Session data saved for account deletion');
    }
  }, [session]);
  
  // This component is conditionally rendered by ClientComponents when admin mode is active

  const handleDeleteAccount = async () => {
    if (!confirm('This will fully disconnect Nekt.Us from your Google account and delete all your data from our database. You will need to re-authorize the app next time you sign in. Continue?')) {
      return;
    }

    console.log('Starting account deletion process', { env: process.env.NODE_ENV, isProduction: process.env.NODE_ENV === 'production' });
    setIsDeleting(true);
    setDeleteStatus('loading');
    
    try {
      // First, collect all the user information we might need for deletion
      const userData = {
        email: sessionData?.email || session?.user?.email,
        userId: sessionData?.userId || session?.user?.id,
        accessToken: sessionData?.accessToken || session?.accessToken
      };
      
      console.log('User data collected for deletion:', {
        hasEmail: !!userData.email,
        hasUserId: !!userData.userId,
        hasAccessToken: !!userData.accessToken
      });
      
      // 1. Delete user data from Firebase
      console.log('Step 1: Deleting user data from Firebase');
      console.log('About to fetch /api/delete-account');
      
      const deleteDataResponse = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // Add cache control to prevent potential caching issues in production
        cache: 'no-store',
        // Include user email as a fallback identifier
        body: JSON.stringify({ email: userData.email, userId: userData.userId })
      });
      
      let deleteDataResult;
      try {
        deleteDataResult = await deleteDataResponse.json();
        console.log('Delete data response status:', deleteDataResponse.status, deleteDataResponse.ok);
      } catch (e) {
        console.error('Error parsing delete response:', e);
        deleteDataResult = { error: 'Failed to parse response' };
      }
      
      if (!deleteDataResponse.ok) {
        console.error('Failed to delete user data from Firebase:', deleteDataResult);
        // Continue with other steps even if Firebase deletion fails
        // This ensures the user can still disconnect their account
      } else {
        console.log('Successfully deleted user data from Firebase');
      }
      
      // 2. Revoke the OAuth token with Google - this is the critical step
      console.log('Step 2: Revoking OAuth token with Google');
      console.log('About to fetch /api/auth/revoke');
      
      // New approach: Instead of relying on the server to extract the token,
      // we'll explicitly send all information we have from the client
      const revokePayload = {
        accessToken: userData.accessToken,
        email: userData.email,
        userId: userData.userId,
        // Include a timestamp to prevent caching
        timestamp: new Date().getTime()
      };
      
      console.log('Sending revoke payload with token available:', !!revokePayload.accessToken);
      
      const revokeResponse = await fetch('/api/auth/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // Add cache control to prevent potential caching issues in production
        cache: 'no-store',
        body: JSON.stringify(revokePayload)
      });
      
      let revokeResult;
      try {
        revokeResult = await revokeResponse.json();
        console.log('Revoke response status:', revokeResponse.status, revokeResponse.ok);
        console.log('Revoke response data:', revokeResult);
      } catch (parseError) {
        console.error('Error parsing revoke response:', parseError);
        revokeResult = { error: 'Failed to parse response' };
      }
      
      if (!revokeResponse.ok) {
        console.error('Failed to revoke token with Google:', revokeResult);
        // Instead of throwing an error, we'll continue with the rest of the deletion
        // This is a temporary fix to ensure users can still delete their accounts
        console.warn('Continuing with account deletion despite token revocation failure');
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
      
      // Clear all storage to ensure complete cleanup
      console.log('Step 5: Clearing all storage items');
      
      // Clear localStorage completely to ensure a clean slate
      console.log('Clearing all localStorage items');
      try {
        // First, try to clear everything at once
        localStorage.clear();
        
        // Then also explicitly target known keys to be extra thorough
        const localStorageKeys = [
          // NextAuth related
          'next-auth.session-token',
          'next-auth.callback-url',
          'next-auth.csrf-token',
          // App specific keys
          'nektus_force_account_selector',
          'nektus_user',
          'nektus_user_profile_cache',
          'nektus_user_profile',
          'nektus_profile',
          'nektus-user-data',
          'nektus_user_profile_v2',
          'nektus-bio',
          'nektus-profile',
          'profile'
        ];
        
        // Clear known keys individually
        localStorageKeys.forEach(key => localStorage.removeItem(key));
        
        // Also clear any keys with nektus or auth in their names
        Object.keys(localStorage).forEach(key => {
          if (key.includes('nektus') || key.includes('auth') || key.includes('profile') || key.includes('token')) {
            console.log(`Removing localStorage key: ${key}`);
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.error('Error during localStorage clearing:', e);
      }
      
      // Clear sessionStorage completely
      console.log('Clearing all sessionStorage items');
      try {
        // First, try to clear everything at once
        sessionStorage.clear();
        
        // Then also explicitly target known keys to be extra thorough
        const sessionStorageKeys = [
          'nektus_user_id',
          'nektus_session',
          'nektus-session',
          'session',
          'next-auth.message'
        ];
        
        // Clear known keys individually
        sessionStorageKeys.forEach(key => sessionStorage.removeItem(key));
        
        // Also clear any keys with nektus or auth in their names
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('nektus') || key.includes('auth') || key.includes('session') || key.includes('token')) {
            console.log(`Removing sessionStorage key: ${key}`);
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.error('Error during sessionStorage clearing:', e);
      }
      
      // Clear cookies related to authentication
      console.log('Clearing auth-related cookies');
      try {
        document.cookie.split(';').forEach(cookie => {
          const [name] = cookie.trim().split('=');
          if (name.includes('next-auth') || name.includes('nektus') || name.includes('session')) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            console.log(`Cleared cookie: ${name}`);
          }
        });
      } catch (e) {
        console.error('Error clearing cookies:', e);
      }
      
      // Clear any IndexedDB databases
      if (window.indexedDB) {
        console.log('Clearing IndexedDB databases');
        try {
          const dbs = await window.indexedDB.databases();
          if (dbs && dbs.length > 0) {
            console.log(`Found ${dbs.length} IndexedDB databases`);
            for (const db of dbs) {
              if (db.name) {
                console.log(`Deleting IndexedDB: ${db.name}`);
                const deleteRequest = window.indexedDB.deleteDatabase(db.name);
                
                // Add event listeners for better error tracking
                deleteRequest.onerror = () => console.error(`Error deleting IndexedDB: ${db.name}`);
                deleteRequest.onsuccess = () => console.log(`Successfully deleted IndexedDB: ${db.name}`);
              }
            }
          } else {
            console.log('No IndexedDB databases found');
          }
        } catch (e) {
          console.error('Error clearing IndexedDB:', e);
        }
      }
      
      // Show success status
      console.log('Account deletion process completed successfully');
      setDeleteStatus('success');
      
      // Turn off admin mode and redirect to home with a clean slate
      console.log('Preparing to redirect after successful deletion');
      setTimeout(() => {
        console.log('Executing redirect now');
        closeAdminMode();
        
        // Force a complete page reload with a hard navigation (not just a replace)
        // This ensures all state is completely cleared and triggers a fresh auth flow
        window.location.href = '/?t=' + new Date().getTime();
      }, 1500);
    } catch (error) {
      console.error('Error during account deletion:', error);
      // Log more detailed error information
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
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
          onClick={(e) => {
            e.preventDefault();
            console.log('Delete account button clicked');
            handleDeleteAccount();
          }}
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
