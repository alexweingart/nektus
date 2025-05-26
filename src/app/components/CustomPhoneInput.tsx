import React, { useState, useRef, useEffect } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

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

interface CustomPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  isDisabled?: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

const CustomPhoneInput = React.forwardRef<HTMLInputElement, CustomPhoneInputProps>((
  {
    value,
    onChange,
    className = '',
    placeholder = 'Enter phone number',
    isDisabled = false,
    inputProps = {},
  },
  ref
) => {
  const [phoneInput, setPhoneInput] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countries[0]); // Default to US
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  // Create refs
  const inputRef = useRef<HTMLInputElement | null>(null);
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
        // Special handling for US/Canada (both have dial code 1)
        if (countryCode === '1') {
          // If US is already selected, keep it as US
          if (selectedCountry.code !== 'US') {
            // Only change if not already US
            const usCountry = countries.find(c => c.code === 'US');
            if (usCountry) setSelectedCountry(usCountry);
          }
        } else {
          // For other countries, use the first match
          setSelectedCountry(dialCodeMap[countryCode][0]);
        }
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

  // Add global document click handler to detect clicks outside both inputs
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      // Check if click is outside both phone input and country selector
      const isOutsideComponent = (
        !inputRef.current?.contains(event.target as Node) && 
        !dropdownRef.current?.contains(event.target as Node)
      );
      
      if (isOutsideComponent) {
        setIsInputFocused(false);
      }
    };
    
    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, []);
  
  // Handle blur only for autofill case, focus state is managed by document click handler
  const handleInputBlur = () => {
    // For autofill and browser suggestions, we don't want to remove focus state
    // since user will likely tap back in - managed by document click instead
  };

  return (
    <div className={`flex ${className}`} style={{ backgroundColor: 'white' }}>
      {/* Country selector */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          className={`flex items-center justify-between px-3 py-2 border ${isInputFocused ? 'border-primary ring-2 ring-primary' : 'border-gray-300'} rounded-l-md bg-white text-gray-700 h-full`}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          aria-label="Select country"
          style={{ zIndex: 1, backgroundColor: 'white' }}
        >
          <span className="mr-2">{selectedCountry.flag}</span>
          <div className="flex flex-col">
            <FaChevronUp className="h-3 w-3 text-primary" />
            <FaChevronDown className="h-3 w-3 text-primary" />
          </div>
        </button>
        
        {/* Country dropdown */}
        {isDropdownOpen && (
          <div className="absolute z-10 mt-1 w-60 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto" style={{ backgroundColor: 'white' }}>
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
        ref={(element) => {
          // Forward ref to parent component
          if (typeof ref === 'function') {
            ref(element);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLInputElement | null>).current = element;
          }
          // Also store in internal ref
          if (element !== null) {
            inputRef.current = element;
          }
        }}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md rounded-l-none bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        placeholder={placeholder}
        value={phoneInput}
        onChange={handlePhoneChange}
        onFocus={() => setIsInputFocused(true)}
        onBlur={handleInputBlur}
        maxLength={14} // (XXX) XXX-XXXX format has 14 characters
        style={{ backgroundColor: 'white' }}
        disabled={isDisabled}
        {...inputProps}
      />
    </div>
  );
});

// Add display name for React DevTools
CustomPhoneInput.displayName = 'CustomPhoneInput';

export default CustomPhoneInput;
