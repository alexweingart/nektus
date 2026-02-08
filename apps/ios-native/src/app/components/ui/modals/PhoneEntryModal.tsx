/**
 * PhoneEntryModal for iOS App Clip
 * Collects phone number (and optional social) after Apple Sign-in.
 * Non-dismissible — user must save before proceeding.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { DropdownPhoneInput } from '../inputs/DropdownPhoneInput';
import { CustomSocialInputAdd } from '../inputs/CustomSocialInputAdd';
import { Button } from '../buttons/Button';
import { SecondaryButton } from '../buttons/SecondaryButton';
import { Heading, BodyText } from '../Typography';
import type { ContactEntry } from '@nektus/shared-types';

interface PhoneEntryModalProps {
  isOpen: boolean;
  userName: string;
  isSaving: boolean;
  onSave: (phone: string, socials: ContactEntry[]) => Promise<void>;
  /** Which profile was scanned - determines default social platform */
  scannedSection?: 'personal' | 'work';
}

export const PhoneEntryModal: React.FC<PhoneEntryModalProps> = ({
  isOpen,
  userName,
  isSaving,
  onSave,
  scannedSection = 'personal',
}) => {
  const [digits, setDigits] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);
  const [socialPlatform, setSocialPlatform] = useState(
    scannedSection === 'work' ? 'linkedin' : 'instagram'
  );
  const [socialUsername, setSocialUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Animation
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const backdropOpacityAnim = useRef(new Animated.Value(0)).current;

  // Update default platform when scannedSection changes
  useEffect(() => {
    setSocialPlatform(scannedSection === 'work' ? 'linkedin' : 'instagram');
  }, [scannedSection]);

  // Animate in on open
  useEffect(() => {
    if (isOpen) {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      backdropOpacityAnim.setValue(0);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.02,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, scaleAnim, opacityAnim, backdropOpacityAnim]);

  // Check if phone is valid (10+ digits)
  const isPhoneValid = digits.replace(/\D/g, '').length >= 10;

  const firstName = userName?.split(' ')[0] || 'there';

  const handleSave = useCallback(async () => {
    if (!isPhoneValid || isSaving) return;
    setError(null);

    // Build social entries if username provided
    const socialEntries: ContactEntry[] = [];
    if (socialUsername.trim()) {
      const baseEntry = {
        fieldType: socialPlatform,
        value: socialUsername.trim(),
        order: 1,
        isVisible: true,
        confirmed: true,
        linkType: 'default' as const,
        icon: `/icons/default/${socialPlatform}.svg`,
      };
      socialEntries.push({ ...baseEntry, section: 'personal' as const });
      socialEntries.push({ ...baseEntry, section: 'work' as const });
    }

    try {
      await onSave(digits, socialEntries);
    } catch (err) {
      console.error('[PhoneEntryModal] Save failed:', err);
      setError('Failed to save. Please try again.');
    }
  }, [digits, socialPlatform, socialUsername, isPhoneValid, isSaving, onSave]);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <Animated.View style={[styles.overlay, { opacity: backdropOpacityAnim }]}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Backdrop blur */}
            <BlurView
              style={StyleSheet.absoluteFillObject}
              tint="dark"
              intensity={60}
            />

            <View style={styles.contentWrapper}>
              {/* Title */}
              <View style={styles.textContainer}>
                <Heading style={styles.title}>Welcome, {firstName}!</Heading>
                <BodyText style={styles.subtitle}>
                  Your new friends will want your number
                </BodyText>
              </View>

              {/* Phone Input */}
              <View style={styles.inputContainer}>
                <DropdownPhoneInput
                  value={digits}
                  onChange={setDigits}
                  placeholder="Phone number"
                  isDisabled={isSaving}
                  autoFocus
                />

                {/* Social Input - appears when "Add Socials" is tapped */}
                {showAddLink && (
                  <CustomSocialInputAdd
                    platform={socialPlatform}
                    username={socialUsername}
                    onPlatformChange={setSocialPlatform}
                    onUsernameChange={setSocialUsername}
                    autoFocus
                  />
                )}
              </View>

              {/* Error */}
              {error && (
                <Text style={styles.error}>{error}</Text>
              )}

              {/* Save Button */}
              <View style={styles.saveButtonContainer}>
                <Button
                  variant="white"
                  size="xl"
                  onPress={handleSave}
                  disabled={isSaving || !isPhoneValid}
                  style={styles.fullWidth}
                  loading={isSaving}
                  loadingText="Saving..."
                >
                  Save
                </Button>
              </View>

              {/* Add Socials Button */}
              {!showAddLink && (
                <View style={styles.secondaryButtonContainer}>
                  <SecondaryButton
                    variant="subtle"
                    onPress={() => setShowAddLink(true)}
                  >
                    Add Socials
                  </SecondaryButton>
                </View>
              )}
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 448,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  contentWrapper: {
    padding: 32,
    gap: 24,
  },
  textContainer: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    textAlign: 'center',
    color: '#ffffff',
  },
  subtitle: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 22,
  },
  inputContainer: {
    width: '100%',
    gap: 16,
  },
  error: {
    color: '#F87171',
    fontSize: 14,
    textAlign: 'center',
  },
  saveButtonContainer: {
    width: '100%',
  },
  fullWidth: {
    width: '100%',
  },
  secondaryButtonContainer: {
    alignItems: 'center',
  },
});

export default PhoneEntryModal;
