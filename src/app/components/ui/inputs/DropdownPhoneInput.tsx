import React, { useState, useRef, useEffect } from 'react';
import { DropdownSelector, DropdownOption } from './DropdownSelector';

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

// Map dial codes to countries with special handling for US/Canada
const dialCodeMap: Record<string, Country[]> = {};
countries.forEach(country => {
  if (!dialCodeMap[country.dialCode]) {
    dialCodeMap[country.dialCode] = [];
  }
  dialCodeMap[country.dialCode].push(country);
});

// Convert countries to DropdownOptions for DropdownSelector
const countryOptions: DropdownOption[] = countries.map(country => ({
  label: country.name,
  value: country.code,
  icon: country.flag,
  metadata: { dialCode: country.dialCode }
}));

interface DropdownPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  isDisabled?: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  autoFocus?: boolean;
  dropdownDragHandleProps?: { ref: (element: HTMLElement | null) => void };
  onDropdownTouchMove?: (event: React.TouchEvent) => void;
  isDraggable?: boolean;
  fieldType?: string;
  section?: string;
}

export const DropdownPhoneInput = React.forwardRef<HTMLInputElement, DropdownPhoneInputProps>((
  {
    value,
    onChange,
    className = '',
    placeholder = 'Enter phone number',
    isDisabled = false,
    inputProps = {},
    autoFocus = true,
    dropdownDragHandleProps,
    onDropdownTouchMove,
    isDraggable = false,
    fieldType,
    section
  },
  ref
) => {
  const [phoneInput, setPhoneInput] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('US');
  const [isFocused, setIsFocused] = useState(false);

  // Create refs
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Initialize component with value if provided
  // Remove phoneInput from dependencies to prevent the loop
  useEffect(() => {
    const cleanedValue = value ? value.replace(/\D/g, '') : '';
    const currentCleaned = phoneInput.replace(/\D/g, '');

    if (cleanedValue !== currentCleaned) {
      const formattedValue = formatPhoneNumber(cleanedValue);
      setPhoneInput(formattedValue);

      // If the value is a US number, ensure US is selected
      if (cleanedValue.length === 10 || (cleanedValue.length === 11 && cleanedValue.startsWith('1'))) {
        setSelectedCountryCode('US');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]); // Only depend on value prop, not phoneInput

  // Format phone number with parentheses and dash
  const formatPhoneNumber = (digits: string): string => {
    if (!digits) return '';

    // Clean the input
    const cleaned = digits.replace(/\D/g, '');

    // Format based on length
    if (cleaned.length === 0) return '';
    if (cleaned.length === 1) return `(${cleaned}`;
    if (cleaned.length === 2) return `(${cleaned}`;
    if (cleaned.length === 3) return `(${cleaned}) `;
    if (cleaned.length === 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}-`;
    if (cleaned.length < 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  // Parse international phone number and return national number and country code
  const parseInternationalNumber = (digits: string): { nationalNumber: string, countryCode: string | null } => {
    // If it's a US number (10 digits or 11 digits starting with 1), return as is
    if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
      const nationalNumber = digits.length === 11 ? digits.slice(1) : digits;
      return { nationalNumber, countryCode: 'US' };
    }

    // Check if the number starts with a known country code
    for (let i = 4; i >= 1; i--) {
      const potentialDialCode = digits.substring(0, i);
      const matchingCountries = dialCodeMap[potentialDialCode];

      if (matchingCountries && matchingCountries.length > 0) {
        // Found a matching country code
        const nationalNumber = digits.substring(i);
        // If we have a national number that's at least 4 digits, use it
        if (nationalNumber.length >= 4) {
          return {
            nationalNumber: nationalNumber,
            countryCode: matchingCountries[0].code // Default to first matching country
          };
        }
      }
    }

    // If no country code found, return the original digits
    return { nationalNumber: digits, countryCode: null };
  };

  // Handle phone input change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Get all digits from input
    const digits = input.replace(/\D/g, '');
    const previousDigits = phoneInput.replace(/\D/g, '');

    // Detect if this was a backspace/delete operation by comparing input lengths
    const isDeleting = input.length < phoneInput.length;

    // Special case: Handle backspace when cursor is after a formatting character
    // If the input got shorter but digit count stayed the same, user deleted a formatting char
    if (isDeleting && digits.length === previousDigits.length) {
      // This means user tried to delete a formatting character
      // We should delete the actual last digit instead
      const newDigits = previousDigits.slice(0, -1);
      const newFormattedPhone = newDigits ? formatPhoneNumber(newDigits) : '';

      setPhoneInput(newFormattedPhone);
      onChange(newDigits);

      // Position cursor appropriately for the new digit count
      requestAnimationFrame(() => {
        if (inputRef.current) {
          let newCursorPosition;
          if (newDigits.length === 0) {
            newCursorPosition = 0;
          } else if (newDigits.length === 3) {
            newCursorPosition = 6; // After ") "
          } else if (newDigits.length === 6) {
            newCursorPosition = 10; // After "-"
          } else {
            const lastDigitIndex = newFormattedPhone.lastIndexOf(newDigits[newDigits.length - 1]);
            newCursorPosition = lastDigitIndex + 1;
          }
          newCursorPosition = Math.max(0, Math.min(newCursorPosition, newFormattedPhone.length));
          inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        }
      });
      return;
    }

    // Check if this looks like an international number (more than 10 digits)
    if (digits.length > 10) {
      const { nationalNumber, countryCode } = parseInternationalNumber(digits);

      if (countryCode && nationalNumber) {
        // Update the selected country if we detected a country code
        if (countryCode !== selectedCountryCode) {
          setSelectedCountryCode(countryCode);
        }

        // Use the national number for formatting
        const formattedPhone = formatPhoneNumber(nationalNumber);
        setPhoneInput(formattedPhone);
        onChange(nationalNumber);
        return;
      }
    }

    // Default handling for regular phone numbers
    const formattedPhone = digits ? formatPhoneNumber(digits) : '';
    const previousFormatted = phoneInput;

    // Update local state
    setPhoneInput(formattedPhone);
    onChange(digits);

    // Handle cursor positioning
    requestAnimationFrame(() => {
      if (inputRef.current && formattedPhone !== previousFormatted) {
        let newCursorPosition;

        // Simple rule-based positioning:
        // 1. Cursor always after last digit
        // 2. Exception: 3 digits -> after ") " (position 6)
        // 3. Exception: 6 digits -> after "-" (position 10)

        if (digits.length === 0) {
          newCursorPosition = 0;
        } else if (digits.length === 3) {
          // "(818) " - cursor after ") " at position 6
          newCursorPosition = 6;
        } else if (digits.length === 6) {
          // "(818) 292-" - cursor after "-" at position 10
          newCursorPosition = 10;
        } else {
          // For all other cases, position cursor after the last digit
          // Count characters to find where last digit is
          const lastDigitIndex = formattedPhone.lastIndexOf(digits[digits.length - 1]);
          newCursorPosition = lastDigitIndex + 1;
        }

        // Ensure cursor stays within bounds
        newCursorPosition = Math.max(0, Math.min(newCursorPosition, formattedPhone.length));

        inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    });
  };

  // Handle country selection
  const handleCountrySelect = (countryCode: string) => {
    setSelectedCountryCode(countryCode);

    // Focus on the input after country selection
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Auto-focus on the input when component mounts (if enabled)
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: '100%',
        height: '3.5rem',
        minHeight: '3.5rem',
      }}
    >
      <div
        className={`absolute inset-0 rounded-full border transition-all ${
          isFocused ? 'bg-black/50 border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.15)]' : 'bg-black/40 border-white/20'
        }`}
        style={{
          transition: 'all 0.2s ease-in-out',
          pointerEvents: 'none'
        }}
      />
      <div
        className="relative z-10 flex items-center h-full w-full"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
      {/* Country selector using DropdownSelector */}
      <div className="relative" style={{ zIndex: 9999 }}>
        <DropdownSelector
          options={countryOptions}
          value={selectedCountryCode}
          onChange={handleCountrySelect}
          disabled={isDisabled}
          {...(dropdownDragHandleProps || {})}
          onTouchMove={onDropdownTouchMove}
          isDraggable={isDraggable}
          fieldType={fieldType}
          section={section}
        />
      </div>

      {/* Phone number input */}
      <input
        ref={(element) => {
          if (typeof ref === 'function') {
            ref(element);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLInputElement | null>).current = element;
          }
          if (element) inputRef.current = element;
        }}
        type="tel"
        inputMode="tel"
        name="phone"
        style={{
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          borderTopRightRadius: '9999px',
          borderBottomRightRadius: '9999px',
          backgroundColor: 'transparent',
          color: 'white'
        }}
        className="flex-1 pr-3 pl-0 h-full focus:outline-none text-white font-medium text-base rounded-r-full placeholder-white/40"
        placeholder={placeholder}
        value={phoneInput}
        onChange={handlePhoneChange}
        maxLength={14}
        disabled={isDisabled}
        {...inputProps}
        autoComplete={inputProps?.autoComplete || "tel"}
      />
    </div>
    </div>
  );
});

// Add display name for React DevTools
DropdownPhoneInput.displayName = 'DropdownPhoneInput';
