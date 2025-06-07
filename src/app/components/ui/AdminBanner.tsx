"use client";

import React, { useState, useCallback } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { FaTimes } from 'react-icons/fa';
import { useProfile } from '@/app/context/ProfileContext';
import { Button } from './Button';
import { useAdminMode } from '../../providers/AdminModeProvider';

// The admin mode banner component
export default function AdminBanner() {
  const { closeAdminMode } = useAdminMode();
  const { clearProfile } = useProfile();
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  const handleDeleteAccount = useCallback(async () => {
    setDeleteStatus('loading');
    
    try {
      // Call the profile context clearProfile function first to handle cleanup
      try {
        await clearProfile();
        console.log('Profile data cleared successfully');
      } catch (err) {
        console.error('Error clearing profile data:', err);
        // Continue with other cleanup even if profile deletion fails
      }

      // Call the delete account API
      try {
        await fetch('/api/delete-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timestamp: new Date().getTime()
          })
        });
      } catch (err) {
        console.error('Error calling delete account API:', err);
        // Continue with cleanup even if API call fails
      }
      
      // Try to revoke the OAuth token with timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const response = await fetch('/api/auth/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timestamp: new Date().getTime() // Prevent caching
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (response.ok) {
          console.log('OAuth token revoked successfully');
        } else {
          console.warn('OAuth token revocation failed');
        }
      } catch (err) {
        console.error('Error revoking OAuth token:', err);
        // Continue with deletion even if token revocation fails
      }
      
      // Simple storage cleanup - essentials first
      try {
        localStorage.clear();
        sessionStorage.clear();
        console.log('Storage cleared');
      } catch (err) {
        console.error('Error clearing storage:', err);
      }
      
      // Clear IndexedDB databases with timeout protection
      if ('indexedDB' in window) {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('IndexedDB cleanup timeout')), 5000) // Increased to 5 seconds
          );
          
          const clearIndexedDB = async () => {
            if ('databases' in indexedDB) {
              const databases = await indexedDB.databases();
              console.log('Found IndexedDB databases:', databases.map(db => db.name));
              
              const deletePromises = databases.map(async (db) => {
                if (db.name) {
                  return new Promise<void>((resolve, reject) => {
                    const deleteReq = indexedDB.deleteDatabase(db.name!);
                    deleteReq.onsuccess = () => {
                      console.log(`IndexedDB ${db.name} deleted`);
                      resolve();
                    };
                    deleteReq.onerror = () => {
                      console.warn(`Failed to delete IndexedDB ${db.name}:`, deleteReq.error);
                      reject(deleteReq.error);
                    };
                    deleteReq.onblocked = () => {
                      console.warn(`IndexedDB ${db.name} deletion blocked - may have open connections`);
                      // For blocked deletions, we'll still consider it a success after a delay
                      setTimeout(() => resolve(), 1000);
                    };
                    
                    // Longer timeout for individual databases, especially Firebase ones
                    const timeout = (db.name && db.name.includes('firebase')) ? 4000 : 2000;
                    setTimeout(() => {
                      console.warn(`Timeout deleting IndexedDB ${db.name} after ${timeout}ms`);
                      reject(new Error(`Timeout deleting ${db.name}`));
                    }, timeout);
                  });
                }
              });
              
              // Use allSettled to not fail the entire process if some databases can't be deleted
              const results = await Promise.allSettled(deletePromises);
              const failures = results.filter(r => r.status === 'rejected');
              if (failures.length > 0) {
                console.warn(`${failures.length} IndexedDB databases failed to delete, but continuing...`);
              }
            }
          };
          
          // Race between cleanup and timeout
          await Promise.race([clearIndexedDB(), timeoutPromise]);
          console.log('IndexedDB cleanup completed');
        } catch (err) {
          console.warn('IndexedDB cleanup failed or timed out:', err);
          // Don't let this stop the rest of the deletion process
        }
      }
      
      setDeleteStatus('success');
      closeAdminMode();
      
      // Use NextAuth signOut with redirect - this should work cleanly
      console.log('Account deletion complete, signing out...');
      signOut({ 
        callbackUrl: '/',
        redirect: true 
      });
      
    } catch (err) {
      console.error('Error deleting account:', err);
      setDeleteStatus('error');
    }
  }, [closeAdminMode, clearProfile]);

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
