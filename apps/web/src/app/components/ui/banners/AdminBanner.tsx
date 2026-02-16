"use client";

import React, { useState, useCallback } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { FaTimes } from 'react-icons/fa';
import { SecondaryButton } from '../buttons/SecondaryButton';
import { Text } from '../Typography';
import { useAdminMode } from '../../../providers/AdminModeProvider';
import { firebaseAuth } from '@/client/auth/firebase';

// The admin mode banner component
export default function AdminBanner() {
  const { isAdminMode, closeAdminMode } = useAdminMode();
  const { data: session } = useSession();
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSimulateNekt = useCallback(() => {
    console.log('🧪 Admin: Triggering Nekt simulation');
    window.dispatchEvent(new CustomEvent('admin-simulate-nekt'));
  }, []);
  
  const handleDeleteAccount = useCallback(async () => {
    setDeleteStatus('loading');

    try {
      // Capture session data before any cleanup
      const accessToken = session?.accessToken;
      const userId = session?.user?.id;
      const userEmail = session?.user?.email;

      console.log('[DELETE] Starting account deletion...', {
        hasAccessToken: !!accessToken,
        hasUserId: !!userId,
        hasUserEmail: !!userEmail
      });

      // ============================================================
      // STEP 1: Sign out Firebase FIRST — while the user still exists
      // server-side. This is critical: if we delete the server-side
      // user first, Firebase SDK can't properly clean up its IndexedDB
      // persistence (signOut talks to the server to revoke refresh tokens).
      // ============================================================
      try {
        console.log('[DELETE] Step 1: Signing out Firebase (before server deletion)...');
        await firebaseAuth.signOut();
        console.log('[DELETE] Firebase signed out successfully');
      } catch (err) {
        console.warn('[DELETE] Firebase signOut failed:', err);
        firebaseAuth.cleanup();
      }

      // ============================================================
      // STEP 2: Revoke OAuth access token
      // ============================================================
      if (accessToken) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const response = await fetch('/api/auth/google/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken, userId, email: userEmail }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          console.log('[DELETE] OAuth token revoke:', response.ok ? 'success' : `failed (${response.status})`);
        } catch (err) {
          console.warn('[DELETE] OAuth token revoke error:', err);
        }
      }

      // ============================================================
      // STEP 3: Delete account server-side
      // (Firebase Auth user, Firestore profile, storage files)
      // ============================================================
      try {
        const deleteResponse = await fetch('/api/delete-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timestamp: Date.now() })
        });
        if (deleteResponse.ok) {
          console.log('[DELETE] Server-side deletion successful');
        } else {
          console.error('[DELETE] Server-side deletion failed:', deleteResponse.status);
        }
      } catch (err) {
        console.error('[DELETE] Server-side deletion error:', err);
      }

      // ============================================================
      // STEP 4: Clear ALL client-side storage
      // ============================================================

      // 4a: Clear sessionStorage
      try {
        sessionStorage.clear();
        console.log('[DELETE] sessionStorage cleared');
      } catch (err) {
        console.warn('[DELETE] Storage clear error:', err);
      }

      // 4b: Clear ALL cookies for this domain (not just NextAuth)
      try {
        document.cookie.split(';').forEach((c) => {
          const name = c.split('=')[0].trim();
          if (name) {
            // Clear with multiple path/domain combinations to catch all cookies
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure; samesite=lax`;
          }
        });
        console.log('[DELETE] All cookies cleared');
      } catch (err) {
        console.warn('[DELETE] Cookie clear error:', err);
      }

      // 4c: Clear Service Worker cache and unregister
      try {
        if ('serviceWorker' in navigator) {
          // Unregister all service workers
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.allSettled(registrations.map(r => r.unregister()));
          console.log('[DELETE] Service workers unregistered:', registrations.length);
        }
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.allSettled(cacheNames.map(name => caches.delete(name)));
          console.log('[DELETE] Caches cleared:', cacheNames.length);
        }
      } catch (err) {
        console.warn('[DELETE] Service worker/cache clear error:', err);
      }

      // 4d: Clear ALL IndexedDB databases
      // Firebase already signed out (Step 1) so connections should be closed
      if ('indexedDB' in window && 'databases' in indexedDB) {
        try {
          const databases = await indexedDB.databases();
          console.log('[DELETE] IndexedDB databases found:', databases.map(db => db.name));

          await Promise.allSettled(databases.map(db => {
            if (!db.name) return Promise.resolve();
            return new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(db.name!);
              req.onsuccess = () => { console.log(`[DELETE] IndexedDB ${db.name} deleted`); resolve(); };
              req.onerror = () => { console.warn(`[DELETE] IndexedDB ${db.name} delete error`); resolve(); };
              req.onblocked = () => { console.warn(`[DELETE] IndexedDB ${db.name} blocked`); resolve(); };
              setTimeout(resolve, 3000);
            });
          }));
          console.log('[DELETE] IndexedDB cleanup done');
        } catch (err) {
          console.warn('[DELETE] IndexedDB cleanup error:', err);
        }
      }

      // ============================================================
      // STEP 5: Sign out NextAuth and redirect
      // ============================================================
      console.log('[DELETE] Complete. Signing out and redirecting...');
      try {
        await signOut({ callbackUrl: '/', redirect: true });
      } catch {
        // Fallback: force redirect
        window.location.href = window.location.origin;
      }

      setDeleteStatus('success');
      closeAdminMode();

    } catch (err) {
      console.error('[DELETE] Fatal error:', err);
      setDeleteStatus('error');
    }
  }, [session, closeAdminMode]);

  if (!isAdminMode) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 z-50 flex justify-center">
      <div className="w-full bg-red-500/90 border border-red-400 rounded-2xl p-4 backdrop-blur-lg relative" style={{ maxWidth: 'var(--max-content-width, 448px)' }}>
        {/* Close button */}
        <button
          onClick={closeAdminMode}
          className="absolute top-3 right-3 p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          aria-label="Close admin mode"
        >
          <FaTimes className="w-4 h-4" />
        </button>

        {/* Text */}
        <div className="pr-8 mb-3">
          <Text variant="base" className="text-white">
            Admin Mode
          </Text>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <SecondaryButton
            variant="light"
            onClick={handleSimulateNekt}
          >
            Simulate Nekt
          </SecondaryButton>
          <SecondaryButton
            variant="light"
            onClick={handleDeleteAccount}
            disabled={deleteStatus === 'loading'}
          >
            {deleteStatus === 'loading' ? 'Deleting...' : 'Delete Account'}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

// Hook to enable admin mode on a component (like the main Nekt text)
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
