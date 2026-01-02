/**
 * NumberInput - Small numeric input for hours and minutes
 * Used within TimePicker component
 */

import React, { useState, useEffect, useRef } from 'react';
import { TextInput, StyleSheet } from 'react-native';

interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  variant: 'hours' | 'minutes';
  placeholder?: string;
}

export function NumberInput({
  value,
  onChange,
  variant,
  placeholder = '00',
}: NumberInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [originalValue, setOriginalValue] = useState(value);

  // Update original value when prop changes
  useEffect(() => {
    setOriginalValue(value);
    if (!isFocused) {
      setInputValue('');
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setOriginalValue(value);
    setInputValue('');
  };

  const handleBlur = () => {
    setIsFocused(false);

    if (inputValue === '') {
      return;
    }

    let finalValue = inputValue;
    if (finalValue.length === 1) {
      finalValue = '0' + finalValue;
    }

    onChange(finalValue);
  };

  const handleChange = (newValue: string) => {
    const digitsOnly = newValue.replace(/\D/g, '');

    let validatedValue = '';

    if (digitsOnly.length === 0) {
      validatedValue = '';
    } else if (digitsOnly.length === 1) {
      validatedValue = digitsOnly;
    } else {
      const firstDigit = digitsOnly[0];
      const secondDigit = digitsOnly[1];

      if (variant === 'hours') {
        if (firstDigit === '0') {
          if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(secondDigit)) {
            validatedValue = firstDigit + secondDigit;
          } else {
            validatedValue = firstDigit;
          }
        } else if (firstDigit === '1') {
          if (['0', '1', '2'].includes(secondDigit)) {
            validatedValue = firstDigit + secondDigit;
          } else {
            validatedValue = firstDigit;
          }
        } else {
          validatedValue = firstDigit;
        }
      } else {
        // Minutes: 00-59
        if (['0', '1', '2', '3', '4', '5'].includes(firstDigit)) {
          validatedValue = firstDigit + secondDigit;
        } else {
          validatedValue = firstDigit;
        }
      }
    }

    setInputValue(validatedValue);
  };

  const displayValue = isFocused ? inputValue : originalValue;

  return (
    <TextInput
      ref={inputRef}
      value={displayValue}
      onChangeText={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={isFocused && inputValue === '' ? placeholder : ''}
      placeholderTextColor="rgba(255, 255, 255, 0.4)"
      maxLength={2}
      keyboardType="number-pad"
      style={styles.input}
      selectTextOnFocus
    />
  );
}

const styles = StyleSheet.create({
  input: {
    width: 28,
    textAlign: 'center',
    fontSize: 14,
    color: '#ffffff',
    padding: 0,
  },
});

export default NumberInput;
