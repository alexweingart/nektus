import { countries } from 'countries-list';
import { ValidationResult, AddressValidation } from '@/types';

// Get list of supported countries (USA, Canada, Australia only)
const supportedCountryCodes = ['US', 'CA', 'AU'];
const countryList = Object.entries(countries)
  .filter(([code]) => supportedCountryCodes.includes(code))
  .map(([code, country]) => ({
    code,
    name: country.name,
  }));

/**
 * Validate country name or code
 */
export const validateCountry = (countryInput: string): ValidationResult => {
  if (!countryInput || countryInput.trim().length === 0) {
    return { isValid: true, wasValidated: false }; // Don't show validation errors for empty fields
  }

  const input = countryInput.trim();

  // Check if it's a valid country name or code
  const matchByName = countryList.find(c =>
    c.name.toLowerCase() === input.toLowerCase()
  );

  const matchByCode = countryList.find(c =>
    c.code.toLowerCase() === input.toLowerCase()
  );

  // Special handling for common aliases
  const isUSAAlias = input.toLowerCase() === 'usa' || input.toLowerCase() === 'us';
  const isCanadaAlias = input.toLowerCase() === 'canada';
  const isAustraliaAlias = input.toLowerCase() === 'australia';

  if (matchByName || matchByCode || isUSAAlias || isCanadaAlias || isAustraliaAlias) {
    return { isValid: true, wasValidated: true };
  }

  return {
    isValid: false,
    message: 'USA, Canada, and Australia only',
    wasValidated: true
  };
};

/**
 * Validate postal/ZIP code based on country
 */
export const validatePostalCodeForCountry = (postalCode: string, countryCode: string): ValidationResult => {
  if (!postalCode || postalCode.trim().length === 0) {
    return { isValid: true, wasValidated: false }; // Don't show validation errors for empty fields
  }

  const trimmed = postalCode.trim();

  // If no country code provided, try to validate against all supported patterns
  if (!countryCode) {
    const result = validatePostalCodeAnyCountry(trimmed);
    return { ...result, wasValidated: true };
  }

  // Use specific country validation
  const result = validatePostalCodeFallback(trimmed, countryCode);
  return { ...result, wasValidated: true };
};

/**
 * Validate postal code against all supported country patterns
 */
const validatePostalCodeAnyCountry = (postalCode: string): ValidationResult => {
  const patterns: Record<string, { regex: RegExp; example: string }> = {
    'US': { regex: /^\d{5}(-\d{4})?$/, example: '12345 or 12345-6789' },
    'CA': { regex: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i, example: 'K1A 0A6' },
    'AU': { regex: /^\d{4}$/, example: '2000' },
  };

  // Try each pattern to see if the postal code matches any supported format
  for (const [, pattern] of Object.entries(patterns)) {
    if (pattern.regex.test(postalCode)) {
      return { isValid: true, wasValidated: true };
    }
  }

  return {
    isValid: false,
    message: 'Enter a valid postal code for USA, Canada, or Australia',
    wasValidated: true
  };
};

/**
 * Fallback postal code validation for unsupported countries
 */
const validatePostalCodeFallback = (postalCode: string, countryCode: string): ValidationResult => {
  const code = countryCode.toUpperCase();

  // Postal code patterns for supported countries
  const patterns: Record<string, { regex: RegExp; example: string }> = {
    'US': { regex: /^\d{5}(-\d{4})?$/, example: '12345 or 12345-6789' },
    'CA': { regex: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i, example: 'K1A 0A6' },
    'AU': { regex: /^\d{4}$/, example: '2000' },
  };


  const pattern = patterns[code];
  if (pattern && pattern.regex.test(postalCode)) {
    return { isValid: true, wasValidated: true };
  }

  if (!pattern) {
    return {
      isValid: false,
      message: 'USA, Canada, and Australia only',
      wasValidated: true
    };
  }

  return {
    isValid: false,
    message: 'Invalid postal code',
    wasValidated: true
  };
};


/**
 * Validate street address
 */
export const validateAddress = (address: string): ValidationResult => {
  if (!address || address.trim().length === 0) {
    return { isValid: true, wasValidated: false }; // Don't show validation errors for empty fields
  }

  const trimmed = address.trim();

  // Check if address contains at least one number (most street addresses do)
  if (!/\d/.test(trimmed)) {
    return {
      isValid: false,
      message: 'Street address should typically include a number',
      wasValidated: true
    };
  }

  // Basic checks for street address
  if (trimmed.length < 3) {
    return { isValid: false, message: 'Address is too short', wasValidated: true };
  }

  return { isValid: true, wasValidated: true };
};

/**
 * Validate city name
 */
export const validateCity = (city: string): ValidationResult => {
  if (!city || city.trim().length === 0) {
    return { isValid: true, wasValidated: false }; // Don't show validation errors for empty fields
  }

  const trimmed = city.trim();

  // Check if city contains only letters, spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z\s\-']+$/.test(trimmed)) {
    return {
      isValid: false,
      message: 'City name should only contain letters, spaces, hyphens, and apostrophes',
      wasValidated: true
    };
  }

  if (trimmed.length < 2) {
    return { isValid: false, message: 'City name is too short', wasValidated: true };
  }

  return { isValid: true, wasValidated: true };
};

/**
 * Validate state/region
 */
export const validateRegion = (region: string): ValidationResult => {
  if (!region || region.trim().length === 0) {
    return { isValid: true, wasValidated: false }; // Don't show validation errors for empty fields
  }

  const trimmed = region.trim();

  // Allow letters, spaces, hyphens, and common abbreviations
  if (!/^[a-zA-Z\s\-'.]+$/.test(trimmed)) {
    return {
      isValid: false,
      message: 'State/region should only contain letters and spaces',
      wasValidated: true
    };
  }

  if (trimmed.length < 2) {
    return { isValid: false, message: 'State/region name is too short', wasValidated: true };
  }

  return { isValid: true, wasValidated: true };
};

/**
 * Validate complete address
 */
export const validateCompleteAddress = (addressData: {
  address: string;
  city: string;
  region: string;
  country: string;
  zip: string;
}): AddressValidation => {
  const countryCode = getCountryCode(addressData.country);

  const validation: AddressValidation = {
    address: validateAddress(addressData.address),
    city: validateCity(addressData.city),
    region: validateRegion(addressData.region),
    country: validateCountry(addressData.country),
    zip: validatePostalCodeForCountry(addressData.zip, countryCode || 'US'),
    overall: false
  };

  validation.overall = Object.values(validation)
    .filter(result => typeof result === 'object' && 'isValid' in result)
    .every(result => result.isValid);

  return validation;
};

/**
 * Get country code from country name
 */
export const getCountryCode = (countryName: string): string | null => {
  const name = countryName.toLowerCase();

  // Handle common aliases
  if (name === 'usa' || name === 'us') return 'US';
  if (name === 'canada') return 'CA';
  if (name === 'australia') return 'AU';

  const country = countryList.find(c =>
    c.name.toLowerCase() === name
  );
  return country?.code || null;
};

/**
 * Get list of all countries for autocomplete
 */
export const getAllCountries = () => countryList;

/**
 * Search countries by partial name
 */
export const searchCountries = (query: string, limit = 10) => {
  if (!query || query.trim().length === 0) return [];

  const searchTerm = query.toLowerCase().trim();

  return countryList
    .filter(country =>
      country.name.toLowerCase().includes(searchTerm)
    )
    .slice(0, limit);
};