/**
 * DropdownSelector for iOS
 * Adapted from: apps/web/src/app/components/ui/inputs/DropdownSelector.tsx
 *
 * Changes from web:
 * - Replaced DOM elements with React Native components
 * - Uses ActionSheet instead of dropdown portal
 * - Uses react-native-svg for chevron icons
 */

import React, { useState, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
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
}

export function DropdownSelector({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  onAfterChange,
}: DropdownSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value);

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

  return (
    <View style={styles.container}>
      {/* Selector Button */}
      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
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

      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsOpen(false)}>
          <View style={styles.modalContent}>
            <BlurView
              style={StyleSheet.absoluteFillObject}
              tint="dark"
              intensity={50}
            />
            <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    option.value === value && styles.optionSelected,
                  ]}
                  onPress={() => handleSelect(option.value)}
                >
                  {option.icon && (
                    <View style={styles.optionIcon}>{renderIcon(option.icon)}</View>
                  )}
                  <Text style={styles.optionLabel}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxHeight: '60%',
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
    padding: 12,
    borderRadius: 8,
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
