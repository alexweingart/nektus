"use client";

import React, { useState, useCallback } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { FaTimes } from 'react-icons/fa';
import { Button } from './buttons/Button';
import { useAdminMode } from '../../providers/AdminModeProvider';
import { firebaseAuth } from '@/lib/firebase/auth';

// The admin mode banner component
export default function AdminBanner() {
  const { isAdminMode, closeAdminMode } = useAdminMode();
  const { data: session, update } = useSession();
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  const handleDeleteAccount = useCallback(async () => {
    setDeleteStatus('loading');
    
    try {
      // Get access token from session before doing anything
      const accessToken = session?.accessToken;
      const userId = session?.user?.id;
      const userEmail = session?.user?.email;
      
      console.log('Starting account deletion process...', {
        hasAccessToken: !!accessToken,
        hasUserId: !!userId,
        hasUserEmail: !!userEmail
      });
      
      // Step 1: Try to revoke the OAuth token FIRST (before clearing session)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const revokeBody: Record<string, string | number> = {
          timestamp: new Date().getTime() // Prevent caching
        };
        
        // Include access token and user info in request body
        if (accessToken) {
          revokeBody.accessToken = accessToken;
        }
        if (userId) {
          revokeBody.userId = userId;
        }
        if (userEmail) {
          revokeBody.email = userEmail;
        }
        
        const response = await fetch('/api/auth/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(revokeBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (response.ok) {
          console.log('OAuth token revoked successfully');
        } else {
          console.warn('OAuth token revocation failed, status:', response.status);
          const errorText = await response.text().catch(() => 'Unknown error');
          console.warn('Revoke error details:', errorText);
        }
      } catch (err) {
        console.error('Error revoking OAuth token:', err);
        // Continue with deletion even if token revocation fails
      }
      
      // Step 2: Call the delete account API (this will clear session cookies)
      let sessionInvalidated = false;
      try {
        const deleteResponse = await fetch('/api/delete-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timestamp: new Date().getTime()
          })
        });
        
        if (deleteResponse.ok) {
          const deleteData = await deleteResponse.json();
          sessionInvalidated = deleteData.sessionInvalidated;
          console.log('Account deletion successful, session invalidated:', sessionInvalidated);
        }
      } catch (err) {
        console.error('Error calling delete account API:', err);
        // Continue with cleanup even if API call fails
      }

      // Step 3: Force session refresh to clear client-side session data
      if (sessionInvalidated && update) {
        try {
          console.log('Forcing session refresh to clear client-side session data...');
          await update();
          console.log('Session refresh completed - session data should now be cleared');
          
          // Give a small delay to ensure ProfileContext reacts to the cleared session
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('Delay completed - ProfileContext should have reacted to cleared session');
        } catch (err) {
          console.error('Error refreshing session:', err);
          // Continue with cleanup even if session refresh fails
        }
      }
      
      // Simple storage cleanup - essentials first
      try {
        localStorage.clear();
        sessionStorage.clear();
        console.log('Storage cleared');
        
        // Note: Motion permissions cannot be programmatically revoked
        // If user needs to reset motion permissions, they must:
        // 1. Clear site data in browser settings, or
        // 2. Use incognito/private browsing mode
        console.log('⚠️ Note: Motion detection permissions cannot be automatically cleared. If needed, clear site data in browser settings.');
      } catch (err) {
        console.error('Error clearing storage:', err);
      }

      // Clear Service Worker cache
      try {
        if ('serviceWorker' in navigator && 'caches' in window) {
          console.log('Clearing service worker cache...');
          const cacheNames = await caches.keys();
          console.log('Found caches:', cacheNames);
          
          const deleteCachePromises = cacheNames.map(async (cacheName) => {
            try {
              const deleted = await caches.delete(cacheName);
              console.log(`Cache ${cacheName} deleted:`, deleted);
              return deleted;
            } catch (err) {
              console.warn(`Failed to delete cache ${cacheName}:`, err);
              return false;
            }
          });
          
          await Promise.allSettled(deleteCachePromises);
          console.log('Service worker cache clearing completed');
          
          // Also try to force service worker to update
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
          }
        }
      } catch (err) {
        console.error('Error clearing service worker cache:', err);
        // Continue with cleanup even if cache clearing fails
      }

      // Clear Firebase Auth state
      try {
        if (firebaseAuth.isAuthenticated()) {
          console.log('Clearing Firebase Auth state...');
          await firebaseAuth.signOut();
          console.log('Firebase Auth state cleared');
        } else {
          console.log('Firebase Auth not authenticated, clearing state anyway...');
          firebaseAuth.cleanup();
        }
      } catch (err) {
        console.error('Error clearing Firebase Auth state:', err);
        // Force clear the state even if sign out fails
        firebaseAuth.cleanup();
      }
      
      // Clear IndexedDB databases with timeout protection (non-blocking)
      if ('indexedDB' in window) {
        try {
          const clearIndexedDB = async () => {
            if ('databases' in indexedDB) {
              const databases = await indexedDB.databases();
              console.log('Found IndexedDB databases:', databases.map(db => db.name));
              
              const deletePromises = databases.map(async (db) => {
                if (db.name) {
                  return new Promise<void>((resolve) => {
                    const deleteReq = indexedDB.deleteDatabase(db.name!);
                    deleteReq.onsuccess = () => {
                      console.log(`IndexedDB ${db.name} deleted successfully`);
                      resolve();
                    };
                    deleteReq.onerror = () => {
                      console.warn(`Failed to delete IndexedDB ${db.name}:`, deleteReq.error);
                      resolve(); // Don't fail the entire process
                    };
                    deleteReq.onblocked = () => {
                      console.warn(`IndexedDB ${db.name} deletion blocked - continuing anyway`);
                      resolve(); // Don't fail the entire process
                    };
                    
                    // Timeout for individual databases (non-blocking)
                    setTimeout(() => {
                      console.warn(`IndexedDB ${db.name} cleanup timed out - continuing anyway`);
                      resolve();
                    }, 2000);
                  });
                }
              });
              
              // Use allSettled to not fail the entire process
              await Promise.allSettled(deletePromises);
            }
          };
          
          // Run IndexedDB cleanup with overall timeout (non-blocking)
          const timeoutPromise = new Promise<void>((resolve) => 
            setTimeout(() => {
              console.log('IndexedDB cleanup timeout reached - continuing...');
              resolve();
            }, 3000)
          );
          
          await Promise.race([clearIndexedDB(), timeoutPromise]);
          console.log('IndexedDB cleanup completed');
          
        } catch (err) {
          console.warn('IndexedDB cleanup failed, but continuing:', err);
        }
      }

      // Use NextAuth signOut with proper error handling
      console.log('Account deletion complete, signing out...');
      try {
        await signOut({ 
          callbackUrl: '/',
          redirect: true 
        });
      } catch (signOutError) {
        console.warn('NextAuth signOut failed, using fallback approach:', signOutError);
        
        // Fallback: Manual cleanup and redirect
        try {
          // Clear any remaining NextAuth cookies manually
          document.cookie.split(";").forEach((c) => {
            const eqPos = c.indexOf("=");
            const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
            if (name.includes('next-auth') || name.includes('__Secure-next-auth') || name.includes('__Host-next-auth')) {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;secure;samesite=lax`;
            }
          });
          
          // Force redirect to home page
          console.log('Forcing redirect to home page...');
          window.location.href = window.location.origin;
          
        } catch (fallbackError) {
          console.error('All signout methods failed:', fallbackError);
          // Last resort: reload the page
          window.location.reload();
        }
      }
      
      setDeleteStatus('success');
      closeAdminMode();
      
    } catch (err) {
      console.error('Error deleting account:', err);
      setDeleteStatus('error');
    }
  }, [session, closeAdminMode, update]);

  if (!isAdminMode) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-yellow-100 border-t border-yellow-200 p-4 z-50">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <div className="flex-1">
          <h3 className="font-medium text-yellow-800">Admin mode</h3>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleDeleteAccount}
            disabled={deleteStatus === 'loading'}
            variant="destructive"
            size="sm"
            className="text-red-700 bg-red-100 hover:bg-red-200"
          >
            {deleteStatus === 'loading' ? 'Deleting...' : 'Delete Account'}
          </Button>
          <button
            onClick={closeAdminMode}
            className="p-2 text-yellow-600 hover:text-yellow-800 rounded-full hover:bg-yellow-200 transition-colors"
            aria-label="Close admin mode"
          >
            <FaTimes />
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook to enable admin mode on a component (like the main Nekt.Us text)
export function useAdminModeActivator() {
  const { toggleAdminMode } = useAdminMode();
  
  // Enable admin mode on double click
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleAdminMode();
  }, [toggleAdminMode]);
  
  // Return the double click handler
  return {
    onDoubleClick: handleDoubleClick
  };
}
