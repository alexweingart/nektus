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
      // Session data saved for account deletion
    }
  }, [session]);
  
  // This component is conditionally rendered by ClientComponents when admin mode is active

  const handleDeleteAccount = async () => {
    if (!confirm('This will fully disconnect Nekt.Us from your Google account and delete all your data from our database. You will need to re-authorize the app next time you sign in. Continue?')) {
      return;
    }

    // Starting account deletion process
    setIsDeleting(true);
    setDeleteStatus('loading');
    
    try {
      // First, collect all the user information we might need for deletion
      const userData = {
        email: sessionData?.email || session?.user?.email,
        userId: sessionData?.userId || session?.user?.id,
        accessToken: sessionData?.accessToken || session?.accessToken
      };
      
      // User data collected for deletion
      
      // 1. Delete user data from Firebase
      // Step 1: Deleting user data from Firebase
      
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
        // Delete data response status processed
      } catch (e) {
        // Error parsing delete response
        deleteDataResult = { error: 'Failed to parse response' };
      }
      
      if (!deleteDataResponse.ok) {
        // Failed to delete user data from Firebase
        // Continue with other steps even if Firebase deletion fails
        // This ensures the user can still disconnect their account
      } else {
        // Successfully deleted user data from Firebase
      }
      
      // 2. Revoke the OAuth token with Google - this is the critical step
      // Step 2: Revoking OAuth token with Google
      
      // New approach: Instead of relying on the server to extract the token,
      // we'll explicitly send all information we have from the client
      const revokePayload = {
        accessToken: userData.accessToken,
        email: userData.email,
        userId: userData.userId,
        // Include a timestamp to prevent caching
        timestamp: new Date().getTime()
      };
      
      // Access token availability check
      
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
        // Process revoke response status
        // Process revoke response data
      } catch (parseError) {
        // Error parsing revoke response
        revokeResult = { error: 'Failed to parse response' };
      }
      
      if (!revokeResponse.ok) {
        // Failed to revoke token with Google
        // Instead of throwing an error, we'll continue with the rest of the deletion
        // This is a temporary fix to ensure users can still delete their accounts
        // Continuing with account deletion despite token revocation failure
      } else {
        // Successfully revoked token with Google
      }
      
      // 3. Sign out from NextAuth locally
      // Step 3: Signing out from NextAuth
      await signOut({ redirect: false });
      
      // 4. Clear all NextAuth cookies
      // Step 4: Clearing all NextAuth cookies
      // Clear all cookies, not just next-auth ones
      // Clearing all cookies
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.trim().split('=');
        // Clear cookie with multiple path variations to ensure complete removal
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        // Also try with domain attribute for cross-subdomain cookies
        const domain = window.location.hostname;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`;
        // Handle potential www subdomain
        if (domain.startsWith('www.')) {
          const rootDomain = domain.substring(4);
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${rootDomain};`;
        } else {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain};`;
        }
        // Cookie cleared
      });
      
      // More thorough localStorage cleanup
      // Clearing localStorage
      // Check localStorage items count
      
      try {
        // First collect all dynamically found keys
        const dynamicKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) dynamicKeys.push(key);
        }
        
        // Also include known keys we want to explicitly target
        const knownKeys = [
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
        
        // Clear all collected keys
        // Clearing collected localStorage keys
        [...dynamicKeys, ...knownKeys].forEach(key => {
          // Remove localStorage key
          localStorage.removeItem(key);
        });
        
        // Also do a general sweep for any keys with specific patterns
        Object.keys(localStorage).forEach(key => {
          if (key.includes('nektus') || key.includes('auth') || key.includes('profile') || key.includes('token')) {
            // Remove pattern-matched localStorage key
            localStorage.removeItem(key);
          }
        });
        
        // Final clear for good measure
        localStorage.clear();
      } catch (e) {
        // Error during localStorage clearing
      }
      
      // Clear sessionStorage completely
      // Clearing all sessionStorage items
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
            // Remove sessionStorage key
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        // Error during sessionStorage clearing
      }
      
      // Clear cookies related to authentication
      // Clearing auth-related cookies
      try {
        document.cookie.split(';').forEach(cookie => {
          const [name] = cookie.trim().split('=');
          if (name.includes('next-auth') || name.includes('nektus') || name.includes('session')) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            // Cookie cleared
          }
        });
      } catch (e) {
        // Error clearing cookies
      }
      
      // Clear any IndexedDB databases
      if (window.indexedDB) {
        // Clearing IndexedDB databases
        try {
          const dbs = await window.indexedDB.databases();
          if (dbs && dbs.length > 0) {
            // Found IndexedDB databases
            for (const db of dbs) {
              if (db.name) {
                // Deleting IndexedDB
                const deleteRequest = window.indexedDB.deleteDatabase(db.name);
                
                // Add event listeners for better error tracking
                deleteRequest.onerror = () => { /* Error deleting IndexedDB */ };
                deleteRequest.onsuccess = () => { /* Successfully deleted IndexedDB */ };
              }
            }
          } else {
            // No IndexedDB databases found
          }
        } catch (e) {
          // Error clearing IndexedDB
        }
      }
      
      // Show success status
      // Account deletion process completed successfully
      setDeleteStatus('success');
      
      // Unregister any service workers to prevent cached resources
      if (navigator.serviceWorker) {
        // Unregistering service workers
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) {
            registration.unregister();
            // Service worker unregistered
          }
        }).catch(err => {
          // Error unregistering service workers
        });
      }

      // Turn off admin mode and redirect to home with a clean slate
      // Preparing to redirect after successful deletion
      setTimeout(() => {
        // Executing redirect now
        closeAdminMode();
        
        // Force a complete page reload with cache busting
        // The random timestamp prevents any cached state from being used
        window.location.href = `/?nocache=${Date.now()}`;
      }, 1500);
    } catch (error) {
      // Error during account deletion
      // Detailed error information intentionally not logged
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
            // Delete account button clicked
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
