/**
 * NumberInput - Small numeric input for hours, minutes, and other numeric values
 * Adapted from CalConnect for Nekt styling
 */

'use client';

import React, { useRef, useState, useEffect } from 'react';

interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  variant: 'hours' | 'minutes';
  placeholder?: string;
  className?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  variant,
  className = ''
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
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
  const showPlaceholder = isFocused && inputValue === '';

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={showPlaceholder ? '00' : ''}
      maxLength={2}
      className={`
        w-7 text-center text-sm bg-transparent outline-none cursor-pointer text-white p-0 leading-none
        focus:outline-none focus:ring-0 focus:border-0
        ${showPlaceholder ? 'placeholder-white/40' : ''}
        ${className}
      `}
      style={{
        border: 'none',
        boxShadow: 'none'
      }}
    />
  );
};
