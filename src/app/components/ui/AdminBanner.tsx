"use client";

import React, { useState, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { FaTimes } from 'react-icons/fa';
import { Button } from '@/components/ui/Button';
import { useAdminMode } from '../../providers/AdminModeProvider';

// The admin mode banner component
export default function AdminBanner() {
  const { closeAdminMode } = useAdminMode();
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  const handleDeleteAccount = useCallback(async () => {
    if (!confirm('This will fully disconnect Nekt.Us from your Google account and delete all your data from our database. You will need to re-authorize the app next time you sign in. Continue?')) {
      return;
    }

    setDeleteStatus('loading');
    
    try {
      // First, try to revoke the OAuth token
      try {
        const response = await fetch('/api/auth/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timestamp: new Date().getTime() // Prevent caching
          })
        });
        
        if (!response.ok) {
          console.error('Failed to revoke OAuth token');
        }
      } catch (err) {
        console.error('Error revoking OAuth token:', err);
        // Continue with deletion even if token revocation fails
      }
      
      // Sign out the user
      await signOut({ redirect: false });
      
      // Clear all auth-related data
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear all cookies
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.trim().split('=');
        // Clear for all paths and subdomains
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
        // Also clear for the root domain
        if (window.location.hostname.split('.').length > 1) {
          const domain = window.location.hostname.split('.').slice(-2).join('.');
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain};`;
        }
      });
      
      // Clear service worker caches
      if ('caches' in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(key => caches.delete(key)));
        } catch (err) {
          console.error('Error clearing caches:', err);
        }
      }
      
      setDeleteStatus('success');
      closeAdminMode();
      
      // Force a full page reload to clear all React state
      window.location.href = '/';
      
    } catch (err) {
      console.error('Error deleting account:', err);
      setDeleteStatus('error');
    }
  }, [closeAdminMode]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-yellow-100 border-t border-yellow-200 p-4 z-50">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <div className="flex-1">
          <h3 className="font-medium text-yellow-800">Admin Mode Active</h3>
          <p className="text-yellow-700 text-sm">You are in admin mode. This gives you access to additional controls.</p>
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
