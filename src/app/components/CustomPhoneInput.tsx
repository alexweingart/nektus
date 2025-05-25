import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

// Define country type
type Country = {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
};

// List of countries with their info
const countries: Country[] = [
  { name: 'United States', code: 'US', flag: '🇺🇸', dialCode: '1' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦', dialCode: '1' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', dialCode: '44' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺', dialCode: '61' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪', dialCode: '49' },
  { name: 'France', code: 'FR', flag: '🇫🇷', dialCode: '33' },
  { name: 'India', code: 'IN', flag: '🇮🇳', dialCode: '91' },
  { name: 'China', code: 'CN', flag: '🇨🇳', dialCode: '86' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵', dialCode: '81' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷', dialCode: '55' },
  // More countries can be added as needed
];

// Map dial codes to countries
const dialCodeMap: Record<string, Country> = {};
countries.forEach(country => {
  dialCodeMap[country.dialCode] = country;
});

interface CustomPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const CustomPhoneInput: React.FC<CustomPhoneInputProps> = ({
  value,
  onChange,
  className = '',
}) => {
  // State for tracking the phone number, selected country, and dropdown state
  const [phoneInput, setPhoneInput] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(countries[0]); // US by default
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Refs for input and dropdown
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize component with value if provided
  useEffect(() => {
    if (value) {
      // Just set the formatted value without changing the actual value
      setPhoneInput(formatPhoneNumber(value.replace(/\D/g, '').slice(-10)));
    }
  }, []);

  // Format phone number with parentheses and dash
  const formatPhoneNumber = (digits: string): string => {
    if (digits.length === 0) return '';
    if (digits.length === 1) return `(${digits}`;
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  // Handle phone input change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, '');
    
    // Check if it's an international number (more than 10 digits)
    if (digits.length > 10) {
      const countryCode = digits.slice(0, digits.length - 10);
      const phoneDigits = digits.slice(-10);
      
      // Try to find a matching country by dial code
      if (dialCodeMap[countryCode]) {
        setSelectedCountry(dialCodeMap[countryCode]);
      }
      
      // Update with only the last 10 digits
      const formattedPhone = formatPhoneNumber(phoneDigits);
      setPhoneInput(formattedPhone);
      onChange(phoneDigits);
    } else {
      // Normal case with 10 or fewer digits
      const formattedPhone = formatPhoneNumber(digits);
      setPhoneInput(formattedPhone);
      onChange(digits);
    }
  };

  // Handle country selection
  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    
    // Focus on the input after country selection
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-focus on the input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className={`flex ${className}`}>
      {/* Country selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          className="flex items-center justify-between px-3 py-2 border border-r-0 border-gray-300 rounded-l-md bg-white text-gray-700 h-full"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          aria-label="Select country"
        >
          <span className="mr-2">{selectedCountry.flag}</span>
          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
        </button>
        
        {/* Country dropdown */}
        {isDropdownOpen && (
          <div className="absolute z-10 mt-1 w-60 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {countries.map((country) => (
              <div
                key={country.code}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                onClick={() => handleCountrySelect(country)}
              >
                <span className="mr-2">{country.flag}</span>
                <span>{country.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Phone number input */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter phone number"
        value={phoneInput}
        onChange={handlePhoneChange}
        maxLength={14} // (XXX) XXX-XXXX format has 14 characters
      />
    </div>
  );
};

export default CustomPhoneInput;
