/**
 * Address validation functions for iOS
 * Port of apps/web/src/server/location/address-validation.ts
 * TODO: Consider moving to shared-lib for reuse across platforms
 */

import type { ValidationResult, AddressValidation } from '@nektus/shared-types';

// Supported countries (USA, Canada, Australia only)
const supportedCountries = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
];

/**
 * Validate country name or code
 */
export const validateCountry = (countryInput: string): ValidationResult => {
  if (!countryInput || countryInput.trim().length === 0) {
    return { isValid: true, wasValidated: false };
  }

  const input = countryInput.trim().toLowerCase();

  // Check common aliases
  const isUSAAlias = input === 'usa' || input === 'us' || input === 'united states';
  const isCanadaAlias = input === 'canada' || input === 'ca';
  const isAustraliaAlias = input === 'australia' || input === 'au';

  if (isUSAAlias || isCanadaAlias || isAustraliaAlias) {
    return { isValid: true, wasValidated: true };
  }

  // Check against country list
  const match = supportedCountries.find(
    (c) => c.name.toLowerCase() === input || c.code.toLowerCase() === input
  );

  if (match) {
    return { isValid: true, wasValidated: true };
  }

  return {
    isValid: false,
    message: 'USA, Canada, and Australia only',
    wasValidated: true,
  };
};

/**
 * Validate postal/ZIP code
 */
export const validatePostalCode = (postalCode: string): ValidationResult => {
  if (!postalCode || postalCode.trim().length === 0) {
    return { isValid: true, wasValidated: false };
  }

  const trimmed = postalCode.trim();

  // Postal code patterns for supported countries
  const patterns = [
    /^\d{5}(-\d{4})?$/, // US: 12345 or 12345-6789
    /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i, // CA: K1A 0A6
    /^\d{4}$/, // AU: 2000
  ];

  for (const pattern of patterns) {
    if (pattern.test(trimmed)) {
      return { isValid: true, wasValidated: true };
    }
  }

  return {
    isValid: false,
    message: 'Enter a valid postal code',
    wasValidated: true,
  };
};

/**
 * Validate street address
 */
export const validateAddress = (address: string): ValidationResult => {
  if (!address || address.trim().length === 0) {
    return { isValid: true, wasValidated: false };
  }

  const trimmed = address.trim();

  // Check if address contains at least one number
  if (!/\d/.test(trimmed)) {
    return {
      isValid: false,
      message: 'Street address must have a number',
      wasValidated: true,
    };
  }

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
    return { isValid: true, wasValidated: false };
  }

  const trimmed = city.trim();

  // Check if city contains only letters, spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z\s\-']+$/.test(trimmed)) {
    return {
      isValid: false,
      message: 'City should only contain letters',
      wasValidated: true,
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
    return { isValid: true, wasValidated: false };
  }

  const trimmed = region.trim();

  // Allow letters, spaces, hyphens, and periods (for abbreviations)
  if (!/^[a-zA-Z\s\-'.]+$/.test(trimmed)) {
    return {
      isValid: false,
      message: 'State/region should only contain letters',
      wasValidated: true,
    };
  }

  if (trimmed.length < 2) {
    return { isValid: false, message: 'State/region is too short', wasValidated: true };
  }

  return { isValid: true, wasValidated: true };
};

/**
 * Validate complete address - all fields
 */
export const validateCompleteAddress = (addressData: {
  address: string;
  city: string;
  region: string;
  country: string;
  zip: string;
}): AddressValidation => {
  const validation: AddressValidation = {
    address: validateAddress(addressData.address),
    city: validateCity(addressData.city),
    region: validateRegion(addressData.region),
    country: validateCountry(addressData.country),
    zip: validatePostalCode(addressData.zip),
    overall: false,
  };

  validation.overall = Object.values(validation)
    .filter((result): result is ValidationResult => typeof result === 'object' && 'isValid' in result)
    .every((result) => result.isValid);

  return validation;
};
