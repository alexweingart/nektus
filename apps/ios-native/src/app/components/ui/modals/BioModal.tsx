/**
 * BioModal for iOS
 * Allows users to write a bio or import from Instagram/LinkedIn
 * Uses RN Modal + BlurView + bounce-in animation (StandardModal pattern)
 */

import React, { useState, useEffect, useRef } from 'react';
import { ANIMATION } from '@nektus/shared-client';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { Heading, BodyText, textSizes } from '../Typography';
import { Button } from '../buttons/Button';
import { SecondaryButton } from '../buttons/SecondaryButton';
import { ExpandingInput } from '../inputs/ExpandingInput';
import { CustomSocialInputAdd } from '../inputs/CustomSocialInputAdd';
import { scrapeBio } from '../../../../client/profile/scrape-bio';
import type { UserProfile } from '../../../../app/context/ProfileContext';

interface BioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSection: 'Personal' | 'Work';
  profile: UserProfile;
  onBioSaved: (bio: string) => void;
  onSocialEntrySaved?: (platform: string, username: string) => void;
  onScrapeStarted?: () => void;
  onScrapeFailed?: () => void;
}

export const BioModal: React.FC<BioModalProps> = ({
  isOpen,
  onClose,
  currentSection,
  profile,
  onBioSaved,
  onSocialEntrySaved,
  onScrapeStarted,
  onScrapeFailed,
}) => {
  const [mode, setMode] = useState<'input' | 'social-input'>('input');
  const [bioText, setBioText] = useState('');
  const [socialUsername, setSocialUsername] = useState('');
  const [socialPlatform, setSocialPlatform] = useState<'instagram' | 'linkedin'>(
    currentSection === 'Work' ? 'linkedin' : 'instagram'
  );
  const [isLoading, setIsLoading] = useState(false);

  const targetPlatform = currentSection === 'Work' ? 'linkedin' : 'instagram';
  const platformLabel = targetPlatform === 'instagram' ? 'Instagram' : 'LinkedIn';

  // Check if the platform already exists in profile
  const existingEntry = profile.contactEntries?.find(
    (e: any) => e.fieldType === targetPlatform && !!e.value?.trim()
  );

  // Animation
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const backdropOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      backdropOpacityAnim.setValue(0);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.02, duration: ANIMATION.UI_MS, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: ANIMATION.MICRO_MS, useNativeDriver: true }),
        ]),
        Animated.timing(opacityAnim, { toValue: 1, duration: ANIMATION.UI_MS, useNativeDriver: true }),
        Animated.timing(backdropOpacityAnim, { toValue: 1, duration: ANIMATION.UI_MS, useNativeDriver: true }),
      ]).start();
    }
  }, [isOpen, scaleAnim, opacityAnim, backdropOpacityAnim]);

  const resetState = () => {
    setMode('input');
    setBioText('');
    setSocialUsername('');
    setIsLoading(false);
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  const handleSaveBio = () => {
    if (bioText.trim()) {
      onBioSaved(bioText.trim());
      handleClose();
    }
  };

  const handleUseSocialBio = async () => {
    if (existingEntry) {
      handleClose();
      onScrapeStarted?.();
      scrapeBio(targetPlatform, existingEntry.value).then(result => {
        if (result.success && result.bio) onBioSaved(result.bio);
        else onScrapeFailed?.();
      }).catch(() => onScrapeFailed?.());
    } else {
      setMode('social-input');
      setSocialPlatform(targetPlatform);
    }
  };

  const handleSocialSubmit = async () => {
    if (!socialUsername.trim()) return;
    const username = socialUsername.trim();

    // Save the social handle to profile first
    onSocialEntrySaved?.(socialPlatform, username);

    handleClose();
    onScrapeStarted?.();

    // Scrape bio in background, use result to update directly
    scrapeBio(socialPlatform, username).then(result => {
      if (result.success && result.bio) onBioSaved(result.bio);
      else onScrapeFailed?.();
    }).catch(() => onScrapeFailed?.());
  };

  return (
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <Animated.View style={[styles.overlay, { opacity: backdropOpacityAnim }]}>
          <Animated.View
            style={[
              styles.modalContainer,
              { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <BlurView style={StyleSheet.absoluteFillObject} tint="dark" intensity={60} />

            <View style={styles.contentWrapper}>
              {/* Header */}
              <View style={styles.textContainer}>
                <Heading style={styles.title}>
                  {mode === 'social-input' ? `Add ${platformLabel}` : 'Add Bio'}
                </Heading>
                <BodyText style={styles.subtitle}>
                  {mode === 'social-input'
                    ? `Enter your ${platformLabel} username to import your bio`
                    : 'Write a short bio or import from social media'}
                </BodyText>
              </View>

              {mode === 'input' ? (
                <>
                  <ExpandingInput
                    value={bioText}
                    onChange={setBioText}
                    placeholder="Write something about yourself..."
                    maxLength={280}
                  />

                  <Button
                    variant="white"
                    size="xl"
                    onPress={handleSaveBio}
                    disabled={!bioText.trim()}
                  >
                    Save
                  </Button>

                  <View style={styles.secondaryButtonContainer}>
                    <SecondaryButton variant="subtle" onPress={handleUseSocialBio}>
                      Use {platformLabel} Bio
                    </SecondaryButton>
                  </View>
                </>
              ) : (
                <>
                  <CustomSocialInputAdd
                    platform={socialPlatform}
                    username={socialUsername}
                    onPlatformChange={(p) => setSocialPlatform(p as 'instagram' | 'linkedin')}
                    onUsernameChange={setSocialUsername}
                    autoFocus
                  />

                  <Button
                    variant="white"
                    size="xl"
                    onPress={handleSocialSubmit}
                    disabled={!socialUsername.trim() || isLoading}
                    loading={isLoading}
                    loadingText="Importing..."
                  >
                    Import {platformLabel} Bio
                  </Button>

                  <View style={styles.secondaryButtonContainer}>
                    <SecondaryButton variant="subtle" onPress={() => setMode('input')}>
                      Write my own instead
                    </SecondaryButton>
                  </View>
                </>
              )}

              {/* Close button */}
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
                  <Path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </Svg>
              </TouchableOpacity>
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
    gap: 8,
  },
  title: {
    textAlign: 'center',
    color: '#ffffff',
  },
  subtitle: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
    ...textSizes.sm,
  },
  secondaryButtonContainer: {
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    opacity: 0.7,
    padding: 4,
  },
});

export default BioModal;
