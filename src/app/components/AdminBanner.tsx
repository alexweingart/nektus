"use client";

import React, { useState, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { FaTimes } from 'react-icons/fa';
import { useAdminMode } from '../providers/AdminModeProvider';
import { useRouter } from 'next/navigation';
import { useProfile } from '../context/ProfileContext';

// The admin mode banner component
export default function AdminBanner() {
  // Get the closeAdminMode function from our context
  const { closeAdminMode } = useAdminMode();
  const { data: session, status } = useSession();
  const router = useRouter();
  const { clearProfile } = useProfile(); // Get the clearProfile function from ProfileContext
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
      
      // Send all possible identifying information to ensure the token gets revoked
      const revokePayload = {
        accessToken: userData.accessToken,
        email: userData.email,
        userId: userData.userId,
      };
      
      console.log('Sending revoke payload:', {
        hasAccessToken: !!revokePayload.accessToken,
        hasEmail: !!revokePayload.email,
        hasUserId: !!revokePayload.userId
      });
      
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
        console.log('Revoke response status:', revokeResponse.status, revokeResponse.ok, revokeResult);
      } catch (e) {
        console.error('Error parsing revoke response:', e);
        revokeResult = { error: 'Failed to parse response' };
      }
      
      if (!revokeResponse.ok) {
        console.error('Failed to revoke Google token:', revokeResult);
        // Continue with signout even if revocation fails
        // This ensures the user can still disconnect their account locally
      } else {
        console.log('Successfully revoked Google token');
      }
      
      // 3. Explicitly sign out from NextAuth.js
      console.log('Step 3: Signing out from NextAuth.js');
      try {
        // Force the signout with explicit options to ensure it works in production
        await signOut({ 
          redirect: false, 
          callbackUrl: '/',
        });
        console.log('Successfully signed out from NextAuth.js');
      } catch (e) {
        console.error('Error during signOut:', e);
        // Continue with cleanup even if signout fails
      }
      
      // 4. Clear all client-side storage - localStorage, sessionStorage, cookies, indexedDB
      console.log('Step 4: Clearing all client-side storage');
      
      // Clear localStorage - be extremely thorough
      console.log('Clearing localStorage...');
      try {
        // First try to clear everything completely
        localStorage.clear();
        console.log('Cleared all localStorage');
        
        // Then also specifically target any keys that might not have been cleared
        const localStorageKeys = [
          // Next-auth keys
          'next-auth.session-token',
          'next-auth.callback-url',
          'next-auth.csrf-token',
          'next-auth.pkce-code-verifier',
          // Our app keys
          'nektus_profile',
          'nektus_connections',
          'nektus_theme',
          'nektus_preferences',
          'nektus_user',
        ];
        
        // Clear known keys
        localStorageKeys.forEach(key => localStorage.removeItem(key));
        
        // Also clear any keys with partial matches
        Object.keys(localStorage).forEach(key => {
          if (key.includes('next-auth') || key.includes('nektus') || key.includes('session') || key.includes('token')) {
            console.log(`Removing localStorage key: ${key}`);
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.error('Error clearing localStorage:', e);
      }
      
      // Clear sessionStorage - be extremely thorough
      console.log('Clearing sessionStorage...');
      try {
        // First try to clear everything completely
        sessionStorage.clear();
        console.log('Cleared all sessionStorage');
        
        // Then also specifically target any keys that might not have been cleared
        const sessionStorageKeys = [
          // Next-auth keys
          'next-auth.message',
          // Our app keys
          'nektus_user_id',
          'nektus_session',
          'nektus-session',
          'session'
        ];
        
        // Clear known keys
        sessionStorageKeys.forEach(key => sessionStorage.removeItem(key));
        
        // Also clear any keys with partial matches
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('next-auth') || key.includes('nektus') || key.includes('session') || key.includes('token')) {
            console.log(`Removing sessionStorage key: ${key}`);
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.error('Error clearing sessionStorage:', e);
      }
      
      // Clear cookies via document.cookie
      console.log('Clearing cookies...');
      try {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
          // Set expiration to the past to remove the cookie
          document.cookie = `${name}=;max-age=0;path=/;domain=${window.location.hostname}`;
          console.log(`Removed cookie: ${name}`);
        }
      } catch (e) {
        console.error('Error clearing cookies:', e);
      }
      
      // Clear IndexedDB
      console.log('Clearing IndexedDB...');
      if (window.indexedDB) {
        try {
          // Try to get all database names
          const dbs = await window.indexedDB.databases();
          console.log('Found IndexedDB databases:', dbs.length);
          
          // Delete each database
          const deletePromises = dbs.map(db => {
            if (db.name) {
              console.log(`Deleting IndexedDB: ${db.name}`);
              return new Promise<void>((resolve) => {
                const deleteRequest = window.indexedDB.deleteDatabase(db.name!);
                deleteRequest.onsuccess = () => {
                  console.log(`Successfully deleted IndexedDB: ${db.name}`);
                  resolve();
                };
                deleteRequest.onerror = () => {
                  console.error(`Error deleting IndexedDB: ${db.name}`);
                  resolve(); // Still resolve to continue with other operations
                };
              });
            }
            return Promise.resolve();
          });
          
          // Wait for all deletions to complete
          await Promise.all(deletePromises);
        } catch (e) {
          console.error('Error clearing IndexedDB:', e);
        }
      }
      
      // Use the ProfileContext's clearProfile function to properly clear the profile
      // This will set the deleted flag to prevent automatic recreation
      await clearProfile();
      console.log('Profile cleared via ProfileContext');
      
      // Show success status
      console.log('Account deletion process completed successfully');
      setDeleteStatus('success');
      
      // Turn off admin mode and redirect to home with a clean slate
      console.log('Preparing to redirect after successful deletion');
      setTimeout(() => {
        console.log('Executing redirect now');
        closeAdminMode();
        
        // Force a complete page reload instead of just a client-side navigation
        // This ensures all state is completely cleared and triggers a new auth flow
        window.location.href = '/?reload=' + new Date().getTime();
      }, 1000);
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
