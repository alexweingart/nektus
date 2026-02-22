/**
 * PostSignUpModal for iOS App Clip
 * Collects phone number (and optional social) after Apple Sign-in.
 * Non-dismissible — user must save before proceeding.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ANIMATION } from '@nektus/shared-client';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { DropdownPhoneInput } from '../inputs/DropdownPhoneInput';
import { CustomSocialInputAdd } from '../inputs/CustomSocialInputAdd';
import { Button } from '../buttons/Button';
import { SecondaryButton } from '../buttons/SecondaryButton';
import { Heading, BodyText, textSizes, fontStyles } from '../Typography';
import { ToggleSetting } from '../controls/ToggleSetting';
import { scrapeBio } from '../../../../client/profile/scrape-bio';
import type { ContactEntry } from '@nektus/shared-types';

interface PostSignUpModalProps {
  isOpen: boolean;
  userName: string;
  isSaving: boolean;
  onSave: (phone: string, socials: ContactEntry[]) => Promise<void>;
  /** Which profile was scanned - determines default social platform */
  scannedSection?: 'personal' | 'work';
}

export const PostSignUpModal: React.FC<PostSignUpModalProps> = ({
  isOpen,
  userName,
  isSaving,
  onSave,
  scannedSection = 'personal',
}) => {
  const [digits, setDigits] = useState('');
  const [socialInputs, setSocialInputs] = useState<Array<{platform: string, username: string}>>([]);
  const [error, setError] = useState<string | null>(null);
  const [useForBio, setUseForBio] = useState(true);

  // Animation
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const backdropOpacityAnim = useRef(new Animated.Value(0)).current;

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
            duration: ANIMATION.UI_MS,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: ANIMATION.MICRO_MS,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: ANIMATION.UI_MS,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacityAnim, {
          toValue: 1,
          duration: ANIMATION.UI_MS,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, scaleAnim, opacityAnim, backdropOpacityAnim]);

  // Check if phone is valid (10+ digits)
  const isPhoneValid = digits.replace(/\D/g, '').length >= 10;

  const firstName = userName?.split(' ')[0] || 'They-who-must-not-be-named';

  const handleSave = useCallback(async () => {
    if (!isPhoneValid || isSaving) return;
    setError(null);

    // Collect all social inputs with non-empty usernames
    const socialEntries: ContactEntry[] = socialInputs
      .filter(input => input.username.trim())
      .flatMap((input, idx) => {
        const baseEntry = {
          fieldType: input.platform,
          value: input.username.trim(),
          order: idx + 1,
          isVisible: true,
          confirmed: true,
          linkType: 'default' as const,
          icon: `/icons/default/${input.platform}.svg`,
        };
        return [
          { ...baseEntry, section: 'personal' as const },
          { ...baseEntry, section: 'work' as const },
        ];
      });

    try {
      await onSave(digits, socialEntries);

      // Fire-and-forget bio scrape if toggle is on
      if (useForBio && socialInputs[0]?.username.trim() &&
          ['instagram', 'linkedin'].includes(socialInputs[0].platform)) {
        scrapeBio(
          socialInputs[0].platform as 'instagram' | 'linkedin',
          socialInputs[0].username.trim()
        ).catch(console.error);
      }
    } catch (err) {
      console.error('[PostSignUpModal] Save failed:', err);
      setError('Failed to save. Please try again.');
    }
  }, [digits, socialInputs, isPhoneValid, isSaving, onSave, useForBio]);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      {/* Full-screen backdrop — stays fixed behind keyboard */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacityAnim }]} />

      {/* Modal content — shifts up with keyboard */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.overlay}>
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

                {/* Social Inputs - each button tap adds a new persistent row */}
                {socialInputs.map((input, index) => (
                  <CustomSocialInputAdd
                    key={index}
                    platform={input.platform}
                    username={input.username}
                    onPlatformChange={(platform) =>
                      setSocialInputs(prev => prev.map((s, i) => i === index ? { ...s, platform } : s))
                    }
                    onUsernameChange={(username) =>
                      setSocialInputs(prev => prev.map((s, i) => i === index ? { ...s, username } : s))
                    }
                    autoFocus={index === socialInputs.length - 1}
                  />
                ))}

                {/* Use for bio toggle */}
                {socialInputs.length > 0 && ['instagram', 'linkedin'].includes(socialInputs[0].platform) && (
                  <ToggleSetting
                    label={`Use ${socialInputs[0].platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} for bio`}
                    enabled={useForBio}
                    onChange={setUseForBio}
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

              {/* Add Socials Button - always visible */}
              <View style={styles.secondaryButtonContainer}>
                <SecondaryButton
                  variant="subtle"
                  onPress={() => {
                    setSocialInputs(prev => [
                      ...prev,
                      { platform: prev.length === 0 ? (scannedSection === 'work' ? 'linkedin' : 'instagram') : 'facebook', username: '' }
                    ]);
                  }}
                >
                  {socialInputs.length > 0 ? 'Add Socials' : (scannedSection === 'work' ? 'Add LinkedIn' : 'Add Instagram')}
                </SecondaryButton>
              </View>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
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
    ...textSizes.sm,
  },
  inputContainer: {
    width: '100%',
    gap: 16,
  },
  error: {
    color: '#F87171',
    ...textSizes.sm,
    ...fontStyles.regular,
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

export default PostSignUpModal;
