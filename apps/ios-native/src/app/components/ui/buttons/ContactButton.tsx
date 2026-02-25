/**
 * ContactButton for iOS
 * Adapted from: apps/web/src/app/components/ui/buttons/ContactButton.tsx
 *
 * Changes from web:
 * - Replaced div with View
 * - Uses iOS Button and LoadingSpinner components
 */

import React from 'react';
import { fontStyles, textSizes } from '../Typography';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { LoadingSpinner } from '../elements/LoadingSpinner';

interface ContactButtonProps {
  isSuccess: boolean;
  isSaving: boolean;
  onPress: () => void;
}

export function ContactButton({
  isSuccess,
  isSaving,
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
        {isSuccess ? "I'm good" : 'Save Contact'}
      </Text>
    );
  };

  const isDisabled = isSaving;

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
  // Typography matching web's xl button: text-xl font-bold (20px, 700)
  buttonText: {
    ...fontStyles.semibold,
    ...textSizes.xl,
    letterSpacing: 0.2,
    color: '#374151',
  },
});

export default ContactButton;
