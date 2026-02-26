/**
 * ValidatedInput - Text input with validation states
 * Shows success/error states with icons and messages
 */

import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ValidationResult } from '@nektus/shared-types';
import { BaseTextInput } from './BaseTextInput';
import { textSizes, fontStyles } from '../Typography';

interface ValidatedInputProps extends Omit<TextInputProps, 'style'> {
  validation?: ValidationResult;
  showValidation?: boolean;
  isRequired?: boolean;
  saveAttempted?: boolean;
}

// Error icon component
const ErrorIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth={2}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </Svg>
);

// Success icon component
const SuccessIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth={2}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </Svg>
);

export function ValidatedInput({
  validation,
  showValidation = true,
  isRequired = false,
  saveAttempted = false,
  value,
  ...props
}: ValidatedInputProps) {
  const stringValue = value ? String(value).trim() : '';
  const isEmpty = stringValue.length === 0;
  const isRequiredEmpty = isRequired && isEmpty && saveAttempted;

  const hasError = showValidation && ((validation && !validation.isValid) || isRequiredEmpty);
  const hasSuccess = showValidation && validation && validation.isValid && !isEmpty;

  const getBorderColor = () => {
    if (hasError) return 'rgba(239, 68, 68, 0.4)';
    if (hasSuccess) return 'rgba(34, 197, 94, 0.4)';
    return 'rgba(255, 255, 255, 0.2)';
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputWrapper,
          { borderColor: getBorderColor() },
        ]}
      >
        <BaseTextInput
          style={styles.input}
          placeholderTextColor="rgba(255, 255, 255, 0.4)"
          value={value as string}
          {...props}
        />

        {/* Validation Icon */}
        {showValidation && (hasError || hasSuccess) && (
          <View style={styles.iconContainer}>
            {hasError ? <ErrorIcon /> : hasSuccess ? <SuccessIcon /> : null}
          </View>
        )}
      </View>

      {/* Validation Message */}
      {showValidation && hasError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {isRequiredEmpty ? 'Can\'t be blank' : validation?.message}
          </Text>
          {validation?.suggestion && !isRequiredEmpty && (
            <Text style={styles.suggestionText}>
              {validation.suggestion}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderRadius: 9999,
    height: 56,
    minHeight: 56,
  },
  input: {
    flex: 1,
    paddingHorizontal: 24,
    height: '100%',
    color: '#ffffff',
    ...fontStyles.regular,
    fontSize: 16,
  },
  iconContainer: {
    paddingRight: 16,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    marginTop: 4,
  },
  errorText: {
    ...textSizes.sm,
    ...fontStyles.regular,
    color: '#F87171',
  },
  suggestionText: {
    marginTop: 4,
    ...textSizes.xs,
    ...fontStyles.regular,
    color: '#FCA5A5',
  },
});

export default ValidatedInput;
