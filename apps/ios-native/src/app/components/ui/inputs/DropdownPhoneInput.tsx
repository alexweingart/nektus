/**
 * DropdownPhoneInput for iOS
 * Adapted from: apps/web/src/app/components/ui/inputs/DropdownPhoneInput.tsx
 *
 * Changes from web:
 * - Uses React Native TextInput instead of HTML input
 * - Uses iOS DropdownSelector component
 * - Simplified phone formatting (same logic)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { DropdownSelector, DropdownOption } from './DropdownSelector';
import { BaseTextInput } from './BaseTextInput';
import { fontStyles } from '../Typography';

// Country type for phone input components
export interface Country {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
}

// List of countries with their info
const countries: Country[] = [
  { name: 'United States', code: 'US', flag: '🇺🇸', dialCode: '1' },
  { name: 'Afghanistan', code: 'AF', flag: '🇦🇫', dialCode: '93' },
  { name: 'Albania', code: 'AL', flag: '🇦🇱', dialCode: '355' },
  { name: 'Algeria', code: 'DZ', flag: '🇩🇿', dialCode: '213' },
  { name: 'Argentina', code: 'AR', flag: '🇦🇷', dialCode: '54' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺', dialCode: '61' },
  { name: 'Austria', code: 'AT', flag: '🇦🇹', dialCode: '43' },
  { name: 'Belgium', code: 'BE', flag: '🇧🇪', dialCode: '32' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷', dialCode: '55' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦', dialCode: '1' },
  { name: 'Chile', code: 'CL', flag: '🇨🇱', dialCode: '56' },
  { name: 'China', code: 'CN', flag: '🇨🇳', dialCode: '86' },
  { name: 'Colombia', code: 'CO', flag: '🇨🇴', dialCode: '57' },
  { name: 'Denmark', code: 'DK', flag: '🇩🇰', dialCode: '45' },
  { name: 'Egypt', code: 'EG', flag: '🇪🇬', dialCode: '20' },
  { name: 'Finland', code: 'FI', flag: '🇫🇮', dialCode: '358' },
  { name: 'France', code: 'FR', flag: '🇫🇷', dialCode: '33' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪', dialCode: '49' },
  { name: 'Greece', code: 'GR', flag: '🇬🇷', dialCode: '30' },
  { name: 'Hong Kong', code: 'HK', flag: '🇭🇰', dialCode: '852' },
  { name: 'Hungary', code: 'HU', flag: '🇭🇺', dialCode: '36' },
  { name: 'Iceland', code: 'IS', flag: '🇮🇸', dialCode: '354' },
  { name: 'India', code: 'IN', flag: '🇮🇳', dialCode: '91' },
  { name: 'Indonesia', code: 'ID', flag: '🇮🇩', dialCode: '62' },
  { name: 'Ireland', code: 'IE', flag: '🇮🇪', dialCode: '353' },
  { name: 'Israel', code: 'IL', flag: '🇮🇱', dialCode: '972' },
  { name: 'Italy', code: 'IT', flag: '🇮🇹', dialCode: '39' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵', dialCode: '81' },
  { name: 'Luxembourg', code: 'LU', flag: '🇱🇺', dialCode: '352' },
  { name: 'Malaysia', code: 'MY', flag: '🇲🇾', dialCode: '60' },
  { name: 'Mexico', code: 'MX', flag: '🇲🇽', dialCode: '52' },
  { name: 'Netherlands', code: 'NL', flag: '🇳🇱', dialCode: '31' },
  { name: 'New Zealand', code: 'NZ', flag: '🇳🇿', dialCode: '64' },
  { name: 'Norway', code: 'NO', flag: '🇳🇴', dialCode: '47' },
  { name: 'Philippines', code: 'PH', flag: '🇵🇭', dialCode: '63' },
  { name: 'Poland', code: 'PL', flag: '🇵🇱', dialCode: '48' },
  { name: 'Portugal', code: 'PT', flag: '🇵🇹', dialCode: '351' },
  { name: 'Russia', code: 'RU', flag: '🇷🇺', dialCode: '7' },
  { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦', dialCode: '966' },
  { name: 'Singapore', code: 'SG', flag: '🇸🇬', dialCode: '65' },
  { name: 'South Africa', code: 'ZA', flag: '🇿🇦', dialCode: '27' },
  { name: 'South Korea', code: 'KR', flag: '🇰🇷', dialCode: '82' },
  { name: 'Spain', code: 'ES', flag: '🇪🇸', dialCode: '34' },
  { name: 'Sweden', code: 'SE', flag: '🇸🇪', dialCode: '46' },
  { name: 'Switzerland', code: 'CH', flag: '🇨🇭', dialCode: '41' },
  { name: 'Taiwan', code: 'TW', flag: '🇹🇼', dialCode: '886' },
  { name: 'Thailand', code: 'TH', flag: '🇹🇭', dialCode: '66' },
  { name: 'Turkey', code: 'TR', flag: '🇹🇷', dialCode: '90' },
  { name: 'Ukraine', code: 'UA', flag: '🇺🇦', dialCode: '380' },
  { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪', dialCode: '971' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', dialCode: '44' },
  { name: 'Vietnam', code: 'VN', flag: '🇻🇳', dialCode: '84' },
];

// Convert countries to DropdownOptions
const countryOptions: DropdownOption[] = countries.map((country) => ({
  label: country.name,
  value: country.code,
  icon: country.flag,
  metadata: { dialCode: country.dialCode },
}));

interface DropdownPhoneInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'onChange' | 'autoFocus'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  autoFocus?: boolean;
}

export function DropdownPhoneInput({
  value,
  onChange,
  placeholder = 'Phone number',
  isDisabled = false,
  autoFocus = false,
  ...props
}: DropdownPhoneInputProps) {
  const [phoneInput, setPhoneInput] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('US');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Handle autoFocus with slight delay for reliable keyboard appearance
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // Format phone number with parentheses and dash
  const formatPhoneNumber = (digits: string): string => {
    if (!digits) return '';

    const cleaned = digits.replace(/\D/g, '');

    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return `(${cleaned}`;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  // Initialize with value
  useEffect(() => {
    const cleanedValue = value ? value.replace(/\D/g, '') : '';
    const currentCleaned = phoneInput.replace(/\D/g, '');

    if (cleanedValue !== currentCleaned) {
      let digitsToFormat = cleanedValue;
      if (cleanedValue.length === 11 && cleanedValue.startsWith('1')) {
        digitsToFormat = cleanedValue.slice(1);
        setSelectedCountryCode('US');
      } else if (cleanedValue.length === 10) {
        setSelectedCountryCode('US');
      }

      const formattedValue = formatPhoneNumber(digitsToFormat);
      setPhoneInput(formattedValue);
    }
  }, [value]);

  const handlePhoneChange = (input: string) => {
    const digits = input.replace(/\D/g, '');
    const formattedPhone = digits ? formatPhoneNumber(digits) : '';

    setPhoneInput(formattedPhone);
    onChange(digits);
  };

  const handleCountrySelect = (countryCode: string) => {
    setSelectedCountryCode(countryCode);
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.glowWrapper, isFocused && styles.glowWrapperFocused]}>
      <View style={styles.container}>
        {/* Base bg-black/40 overlay to match web */}
        <View style={styles.baseOverlay} />

        {/* Focus darkening overlay - adds 10% to reach bg-black/50 */}
        {isFocused && <View style={styles.focusOverlay} />}

        {/* Border overlay */}
        <View
          style={[
            styles.borderOverlay,
            isFocused && styles.borderOverlayFocused,
          ]}
        />

        <View style={styles.content}>
          {/* Country selector */}
          <DropdownSelector
            options={countryOptions}
            value={selectedCountryCode}
            onChange={handleCountrySelect}
            disabled={isDisabled}
          />

          {/* Phone input */}
          <BaseTextInput
            ref={inputRef}
            style={styles.input}
            value={phoneInput}
            onChangeText={handlePhoneChange}
            placeholder={placeholder}
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            keyboardType="number-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            maxLength={14}
            editable={!isDisabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glowWrapper: {
    borderRadius: 28,
    // Shadow always defined but invisible when not focused
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 20,
  },
  glowWrapperFocused: {
    // Make shadow visible on focus
    shadowOpacity: 0.15,
  },
  container: {
    height: 56,
    minHeight: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  baseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // bg-black/40
  },
  focusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // +10% to reach bg-black/50 on focus
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  borderOverlayFocused: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    paddingRight: 16,
    color: '#ffffff',
    fontSize: 16,
    ...fontStyles.regular,
  },
});

export default DropdownPhoneInput;
