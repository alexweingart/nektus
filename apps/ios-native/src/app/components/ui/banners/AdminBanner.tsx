import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { useAdminMode } from '../../../providers/AdminModeProvider';
import { useSession } from '../../../providers/SessionProvider';
import { SecondaryButton } from '../buttons/SecondaryButton';
import { getIdToken, signOut as firebaseSignOut } from '../../../../client/auth/firebase';
import { getApiBaseUrl } from '../../../../client/config';

// Event name for simulating a Nekt (bump)
export const ADMIN_SIMULATE_NEKT_EVENT = 'admin-simulate-nekt';

// The admin mode banner component
export default function AdminBanner() {
  const { isAdminMode, closeAdminMode } = useAdminMode();
  const { data: session, signOut } = useSession();
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSimulateNekt = useCallback(() => {
    console.log('[AdminBanner] Triggering Nekt simulation');
    DeviceEventEmitter.emit(ADMIN_SIMULATE_NEKT_EVENT);
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    // Confirm before deleting
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleteStatus('loading');

            try {
              const userId = session?.user?.id;
              const userEmail = session?.user?.email;

              console.log('[AdminBanner] Starting account deletion...', {
                hasUserId: !!userId,
                hasUserEmail: !!userEmail,
              });

              // Get Firebase ID token for authentication
              const idToken = await getIdToken();
              if (!idToken) {
                console.error('[AdminBanner] No Firebase ID token available');
                Alert.alert('Error', 'Not authenticated. Please sign in again.');
                setDeleteStatus('error');
                return;
              }

              // Call the delete account API with Firebase ID token
              try {
                const baseUrl = getApiBaseUrl();
                const response = await fetch(
                  `${baseUrl}/api/delete-account`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({
                      timestamp: new Date().getTime(),
                    }),
                  }
                );

                if (response.ok) {
                  console.log('[AdminBanner] Account deletion API call successful');
                } else {
                  const errorData = await response.json().catch(() => ({}));
                  console.warn('[AdminBanner] Account deletion API returned:', response.status, errorData);
                  // If unauthorized, the server couldn't verify our token
                  if (response.status === 401) {
                    Alert.alert('Error', 'Authentication failed. Please sign in again.');
                    setDeleteStatus('error');
                    return;
                  }
                }
              } catch (apiError) {
                console.error('[AdminBanner] Error calling delete account API:', apiError);
                // Continue with local cleanup even if API fails
              }

              // Sign out from Firebase
              await firebaseSignOut();

              // Also call the session signOut to clear local state
              await signOut();

              setDeleteStatus('success');
              closeAdminMode();

              console.log('[AdminBanner] Account deletion complete');
            } catch (err) {
              console.error('[AdminBanner] Error deleting account:', err);
              setDeleteStatus('error');
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          },
        },
      ]
    );
  }, [session, signOut, closeAdminMode]);

  if (!isAdminMode) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={closeAdminMode}
          accessibilityLabel="Close admin mode"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.title}>Admin Mode</Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <SecondaryButton variant="light" onPress={handleSimulateNekt}>
            Simulate Nekt
          </SecondaryButton>
          <SecondaryButton
            variant="light"
            onPress={handleDeleteAccount}
            disabled={deleteStatus === 'loading'}
          >
            {deleteStatus === 'loading' ? 'Deleting...' : 'Delete Account'}
          </SecondaryButton>
        </View>
      </View>
    </View>
  );
}

// Hook to enable admin mode on a component (like the avatar/name)
// Uses double-tap to match web's double-click behavior
export function useAdminModeActivator() {
  const { toggleAdminMode } = useAdminMode();
  const lastTapRef = React.useRef<number>(0);

  // Double-tap detection - matches web's double-click
  const handlePress = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // 300ms window for double-tap

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double-tap detected
      toggleAdminMode();
      lastTapRef.current = 0; // Reset
    } else {
      lastTapRef.current = now;
    }
  }, [toggleAdminMode]);

  return {
    onPress: handlePress,
  };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 50,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 448,
    backgroundColor: 'rgba(239, 68, 68, 0.9)', // red-500/90
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 1)', // red-400
    borderRadius: 16,
    padding: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 6,
    zIndex: 1,
  },
  closeButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingRight: 32,
    marginBottom: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
