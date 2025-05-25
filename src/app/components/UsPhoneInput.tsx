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
    // 1. clean -> digits only, strip leading 1, max‑10
    const normalise = (raw: string) => {
      let d = raw.replace(/\D/g, '');
      if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
      return d.slice(0, 10);
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
