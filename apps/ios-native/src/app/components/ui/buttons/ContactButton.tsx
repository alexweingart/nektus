/**
 * ContactButton for iOS
 * Adapted from: apps/web/src/app/components/ui/buttons/ContactButton.tsx
 *
 * Changes from web:
 * - Replaced div with View
 * - Uses iOS Button and LoadingSpinner components
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { LoadingSpinner } from '../elements/LoadingSpinner';

interface ContactButtonProps {
  isSuccess: boolean;
  isSaving: boolean;
  isLoading?: boolean;
  onPress: () => void;
}

export function ContactButton({
  isSuccess,
  isSaving,
  isLoading = false,
  onPress,
}: ContactButtonProps) {
  const getButtonContent = () => {
    if (isSaving) {
      return (
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="sm" color="#374151" />
          <Text style={styles.buttonText}>Saving...</Text>
        </View>
      );
    }

    return (
      <Text style={styles.buttonText}>
        {isSuccess ? 'Done' : 'Save Contact'}
      </Text>
    );
  };

  const isDisabled = isSaving || isLoading;

  return (
    <Button
      variant="white"
      size="xl"
      onPress={onPress}
      disabled={isDisabled}
      style={styles.button}
    >
      {getButtonContent()}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // Typography matching web's xl button: text-xl font-semibold (20px, 600)
  buttonText: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: '#374151',
  },
});

export default ContactButton;
