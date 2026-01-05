/**
 * StandardModal component for iOS
 * A reusable modal with title, subtitle, and action buttons
 * Features bounce-in animation (scale 0.9 → 1.02 → 1) matching web
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { Heading, BodyText } from '../Typography';
import { Button } from '../buttons/Button';
import { SecondaryButton } from '../buttons/SecondaryButton';

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  primaryButtonText?: string;
  primaryButtonIcon?: React.ReactNode;
  onPrimaryButtonClick?: () => void;
  primaryButtonDisabled?: boolean;
  secondaryButtonText?: string;
  onSecondaryButtonClick?: () => void;
  showSecondaryButton?: boolean;
  showPrimaryButton?: boolean;
  showCloseButton?: boolean;
  children?: React.ReactNode;
}

export const StandardModal: React.FC<StandardModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  primaryButtonText,
  primaryButtonIcon,
  onPrimaryButtonClick,
  primaryButtonDisabled = false,
  secondaryButtonText = 'Maybe later',
  showSecondaryButton = true,
  showPrimaryButton = true,
  showCloseButton = true,
  onSecondaryButtonClick,
  children,
}) => {
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const backdropOpacityAnim = useRef(new Animated.Value(0)).current;

  // Run enter animation when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset to initial values
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      backdropOpacityAnim.setValue(0);

      // Animate in with bounce effect (0.9 → 1.02 → 1)
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

  const handlePrimaryClick = () => {
    console.log(`[iOS] Standard modal primary button clicked: ${primaryButtonText}`);
    onPrimaryButtonClick?.();
  };

  const handleSecondaryClick = () => {
    if (onSecondaryButtonClick) {
      onSecondaryButtonClick();
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: backdropOpacityAnim }]}>
          <TouchableWithoutFeedback>
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

              {/* Content wrapper */}
              <View style={styles.contentWrapper}>
                {/* Close button */}
                {showCloseButton && (
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  >
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white">
                      <Path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </Svg>
                  </TouchableOpacity>
                )}

                {/* Title and Subtitle */}
                <View style={styles.textContainer}>
                  <Heading style={styles.title}>{title}</Heading>
                  {subtitle && (
                    <BodyText style={styles.subtitle}>{subtitle}</BodyText>
                  )}
                </View>

                {/* Custom Content */}
                {children}

                {/* Primary Button */}
                {showPrimaryButton && primaryButtonText && onPrimaryButtonClick && (
                  <View style={styles.primaryButtonContainer}>
                    <Button
                      variant="white"
                      size="xl"
                      onPress={handlePrimaryClick}
                      disabled={primaryButtonDisabled}
                      style={styles.fullWidthButton}
                    >
                      {primaryButtonIcon}
                      {primaryButtonText}
                    </Button>
                  </View>
                )}

                {/* Secondary Button */}
                {showSecondaryButton && (
                  <View style={styles.secondaryButtonContainer}>
                    <SecondaryButton variant="subtle" onPress={handleSecondaryClick}>
                      {secondaryButtonText}
                    </SecondaryButton>
                  </View>
                )}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 10,
    opacity: 0.7,
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
  primaryButtonContainer: {
    width: '100%',
  },
  fullWidthButton: {
    width: '100%',
  },
  secondaryButtonContainer: {
    alignItems: 'center',
  },
});

export default StandardModal;
