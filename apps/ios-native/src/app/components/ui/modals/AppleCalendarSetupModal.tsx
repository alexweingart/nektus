/**
 * AppleCalendarSetupModal for iOS
 * Adapted from: apps/web/src/app/components/ui/modals/AppleCalendarSetupModal.tsx
 *
 * Changes from web:
 * - Replaced div with View
 * - Uses iOS Input component
 * - Replaced Tailwind with StyleSheet
 * - Uses Linking for external URL
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { StandardModal } from './StandardModal';
import { Input } from '../inputs/Input';

interface AppleCalendarSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (appleId: string, appPassword: string) => Promise<void>;
}

export function AppleCalendarSetupModal({
  isOpen,
  onClose,
  onConnect,
}: AppleCalendarSetupModalProps) {
  const [appleId, setAppleId] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!appleId || !appPassword) {
      setError('Please enter both Apple ID and app-specific password');
      return;
    }

    if (appPassword.length !== 16) {
      setError('App-specific password should be 16 characters');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      await onConnect(appleId, appPassword);
      resetModal();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsConnecting(false);
    }
  };

  const resetModal = () => {
    setAppleId('');
    setAppPassword('');
    setError('');
    setIsConnecting(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const openAppleSecurityPage = () => {
    Linking.openURL('https://appleid.apple.com/account/security');
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Connect Apple Calendar"
      primaryButtonText={isConnecting ? 'Connecting...' : 'Connect Calendar'}
      onPrimaryButtonClick={handleConnect}
      primaryButtonDisabled={!appleId || !appPassword || isConnecting}
      showSecondaryButton={true}
      secondaryButtonText="Cancel"
      showCloseButton={false}
    >
      <View style={styles.content}>
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            <TouchableOpacity onPress={openAppleSecurityPage}>
              <Text style={styles.link}>Generate an app-specific password</Text>
            </TouchableOpacity>
            {' '}for your Apple ID and enter it below
          </Text>
        </View>

        <View style={styles.inputsContainer}>
          <Input
            value={appleId}
            onChangeText={setAppleId}
            placeholder="Apple ID (iCloud Email)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            value={appPassword}
            onChangeText={(text) => setAppPassword(text.replace(/[\s-]/g, ''))}
            placeholder="16-character app-specific password"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={false}
          />
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
    </StandardModal>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
  },
  instructionsContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  instructionsText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
  },
  link: {
    color: '#10B981',
    textDecorationLine: 'underline',
  },
  inputsContainer: {
    gap: 16,
  },
  errorContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
});

export default AppleCalendarSetupModal;
