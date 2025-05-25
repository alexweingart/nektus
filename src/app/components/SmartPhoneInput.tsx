'use client';
import React, { useMemo, useState, forwardRef } from 'react';
import { getCountryCallingCode, AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js';
import * as flags from 'country-flag-icons/react/3x2';      // tiny SVG flag set ("US", "CA", …)

// --- small list or full ISO list – up to you -----------------
const COUNTRIES = ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IN'] as const;
type Country = typeof COUNTRIES[number];

type Props = {
  value: string;                 // national digits
  country: Country;
  onChange: (digits: string, country: Country) => void;
  id?: string;
  placeholder?: string;
};

// ---------- helper ----------------------------------------------------------
const normalise = (raw: string, country: Country): string => {
  let d = raw.replace(/\D/g, '');

  // If it looks like +<code>nn… without "+", add it so parser works
  if (d.length > 10 && !raw.startsWith('+')) {
    const maybe = parsePhoneNumberFromString('+' + d);
    if (maybe?.isValid()) {
      d = maybe.nationalNumber;          // strip dial code
    }
  }

  // US/CA special: drop leading 1 if 11 digits
  if ((country === 'US' || country === 'CA') && d.length === 11 && d.startsWith('1')) {
    d = d.slice(1);
  }

  return d;
};

export const SmartPhoneInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, country, id, placeholder }, ref) => {
    // keep a local copy so the dropdown can change it
    const [iso, setIso] = useState<Country>(country);

    // Format as‑you‑type according to current flag
    const pretty = new AsYouType(iso).input(value);

    // build dropdown options only once
    const options = useMemo(
      () =>
        COUNTRIES.map((c) => {
          const Code = (flags as any)[c];
          return (
            <option key={c} value={c}>
              {Code ? ` ${c}` : c}
            </option>
          );
        }),
      []
    );

    const handleInput = (raw: string) => {
      // 1️⃣ normalise & maybe auto‑detect country
      let digits = normalise(raw, iso);
      if (raw.startsWith('+') || raw.length > 10) {
        const parsed = parsePhoneNumberFromString(raw, iso);
        if (parsed?.isValid() && parsed.country && parsed.country !== iso) {
          setIso(parsed.country as Country);
          digits = parsed.nationalNumber.toString();
        }
      }
      // 2️⃣ hard‑cap digits based on country
      const maxDigits = iso === 'US' || iso === 'CA' ? 10 : 15; // Most countries use 10-15 digits
      digits = digits.slice(0, maxDigits);

      onChange(digits, iso);
    };

    return (
      <div className="flex items-center gap-2">
        {/* flag dropdown */}
        <select
          value={iso}
          onChange={(e) => setIso(e.target.value as Country)}
          className="border rounded p-1 bg-white"
        >
          {options}
        </select>

        {/* tel input */}
        <input
          ref={ref}
          type="tel"
          id={id}
          inputMode="tel"
          autoComplete="tel"
          placeholder={placeholder ?? 'Phone number'}
          value={pretty}
          onChange={(e) => handleInput(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            handleInput(e.clipboardData.getData('text'));
          }}
          className="flex-1 border rounded px-3 py-2"
        />
      </div>
    );
  }
);
SmartPhoneInput.displayName = 'SmartPhoneInput';
