/**
 * DropdownSelector for iOS
 * Adapted from: apps/web/src/app/components/ui/inputs/DropdownSelector.tsx
 *
 * Changes from web:
 * - Replaced DOM elements with React Native components
 * - Uses positioned dropdown below the button (like web portal)
 * - Uses react-native-svg for chevron icons
 * - Doesn't dismiss keyboard when opening
 */

import React, { useState, useRef, ReactNode, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';

export interface DropdownOption {
  label: string;
  value: string;
  icon?: string | ReactNode;
  metadata?: unknown;
}

interface DropdownSelectorProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onAfterChange?: () => void;
  /** Called before dropdown opens - use to mark internal interaction */
  onBeforeOpen?: () => void;
}

const ITEM_HEIGHT = 44;
const MAX_VISIBLE_ITEMS = 5;
const DROPDOWN_MAX_HEIGHT = ITEM_HEIGHT * MAX_VISIBLE_ITEMS + 16; // 5 items + padding

export function DropdownSelector({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  onAfterChange,
  onBeforeOpen,
}: DropdownSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPositionReady, setIsPositionReady] = useState(false);
  const [buttonLayout, setButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const buttonRef = useRef<View>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  // Measure position after modal opens
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      setIsPositionReady(false);
      // Small delay to ensure layout is stable
      const measureTimer = setTimeout(() => {
        buttonRef.current?.measureInWindow((x, y, width, height) => {
          if (x !== undefined && y !== undefined) {
            setButtonLayout({ x, y, width, height });
            setIsPositionReady(true);
          }
        });
      }, 50);
      return () => clearTimeout(measureTimer);
    } else {
      setIsPositionReady(false);
    }
  }, [isOpen]);

  const renderIcon = (icon: string | ReactNode) => {
    if (typeof icon === 'string') {
      return <Text style={styles.iconText}>{icon}</Text>;
    }
    return <View style={styles.iconContainer}>{icon}</View>;
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    onAfterChange?.();
  };

  const handleButtonPress = useCallback(() => {
    if (disabled) return;

    // Notify parent that dropdown is about to open (for internal interaction tracking)
    onBeforeOpen?.();

    // Don't dismiss keyboard - user expects to continue typing after selection
    // Open modal immediately - the useEffect will handle position measurement
    setIsOpen(true);
  }, [disabled, onBeforeOpen]);

  const handleOverlayPress = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <View style={styles.container} ref={buttonRef}>
      {/* Selector Button */}
      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={handleButtonPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {selectedOption?.icon ? (
          <View style={styles.selectedIcon}>{renderIcon(selectedOption.icon)}</View>
        ) : (
          <Text style={styles.placeholder}>{placeholder}</Text>
        )}
        <View style={styles.chevrons}>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ffffff">
            <Path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </Svg>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ffffff">
            <Path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </Svg>
        </View>
      </TouchableOpacity>

      {/* Dropdown rendered in Modal to escape overflow:hidden clipping */}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={handleOverlayPress}
      >
        {/* Invisible overlay to capture taps outside */}
        <Pressable
          style={styles.modalOverlay}
          onPress={handleOverlayPress}
        >
          {/* Dropdown menu positioned below button - only show when position is measured */}
          {isPositionReady && (
            <View
              style={[
                styles.dropdownContainer,
                {
                  position: 'absolute',
                  top: buttonLayout.y + buttonLayout.height + 8,
                  left: buttonLayout.x,
                }
              ]}
            >
              <BlurView
                style={StyleSheet.absoluteFillObject}
                tint="dark"
                intensity={50}
              />
              <ScrollView
                style={styles.optionsList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled
              >
                {options.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      option.value === value && styles.optionSelected,
                    ]}
                    onPress={() => handleSelect(option.value)}
                    activeOpacity={0.7}
                  >
                    {option.icon && (
                      <View style={styles.optionIcon}>{renderIcon(option.icon)}</View>
                    )}
                    <Text style={styles.optionLabel}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    height: 56,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  selectedIcon: {
    marginRight: 4,
  },
  iconText: {
    fontSize: 24,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    color: '#9CA3AF',
    fontSize: 16,
    marginRight: 8,
  },
  chevrons: {
    flexDirection: 'column',
  },
  modalOverlay: {
    flex: 1,
  },
  dropdownContainer: {
    width: 240, // w-60 on web
    maxHeight: DROPDOWN_MAX_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  optionsList: {
    padding: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: ITEM_HEIGHT,
  },
  optionSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionIcon: {
    marginRight: 12,
  },
  optionLabel: {
    color: '#ffffff',
    fontSize: 16,
  },
});

export default DropdownSelector;
