'use client';
import React, { forwardRef } from 'react';
import { AsYouType } from 'libphonenumber-js';

type Props = {
  value: string;
  onChange: (digits: string) => void;
  id?: string;
  placeholder?: string;
};

export const UsPhoneInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, id, placeholder }, ref) => {
    // 1. clean -> handle international numbers, strip country codes, and normalize to US format
    const normalise = (raw: string) => {
      // Remove all non-digit characters
      let digits = raw.replace(/\D/g, '');
      
      // Handle international numbers (starting with + or 00, or longer than 10 digits)
      if (digits.startsWith('1') && digits.length === 11) {
        // US/Canada number with country code 1
        return digits.slice(1, 11); // Remove leading 1, keep next 10 digits
      } else if (digits.length > 10) {
        // For other international numbers, take last 10 digits
        return digits.slice(-10);
      }
      
      // For regular US numbers, ensure max 10 digits
      return digits.slice(0, 10);
    };

    // 2. formatter ("(123) 456‑7890")
    const pretty = new AsYouType('US').input(value);

    return (
      <input
        ref={ref}
        type="tel"
        id={id}
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={placeholder ?? 'Phone number'}
        className="w-full rounded-md border p-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        value={pretty}
        onChange={(e) => onChange(normalise(e.target.value))}
        // Allow "Paste" from iOS/Android bubble without extra click
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text');
          onChange(normalise(text));
        }}
      />
    );
  }
);

UsPhoneInput.displayName = 'UsPhoneInput';
