/**
 * TODO: Replace with shared-lib version
 * - This file is identical to @nektus/shared-lib/src/client/profile/phone-formatter.ts
 * - Delete this file and import from @nektus/shared-lib instead
 */

import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export interface PhoneFormatResult {
  internationalPhone: string;
  nationalPhone: string;
  isValid: boolean;
  error?: string;
}

/**
 * Formats a phone number using libphonenumber-js
 * Handles both national and international formats
 * @param digits - The phone number input (can include formatting characters)
 * @param countryCode - Default country code for national numbers (default: 'US')
 * @returns Formatted phone number result with validation status
 */
export function formatPhoneNumber(
  digits: string, 
  countryCode: CountryCode = 'US'
): PhoneFormatResult {
  if (!digits) {
    return { 
      internationalPhone: '', 
      nationalPhone: '', 
      isValid: false 
    };
  }
  
  // Clean the input - preserve + for international format detection
  const cleanedDigits = digits.replace(/[^0-9+]/g, '');
  
  if (!cleanedDigits) {
    return { 
      internationalPhone: '', 
      nationalPhone: '', 
      isValid: false 
    };
  }
  
  try {
    let parsed;
    
    if (cleanedDigits.startsWith('+')) {
      // Already in international format
      parsed = parsePhoneNumberFromString(cleanedDigits);
    } else {
      // National format, use provided country code
      parsed = parsePhoneNumberFromString(cleanedDigits, countryCode);
    }
    
    if (!parsed) {
      return { 
        internationalPhone: '', 
        nationalPhone: '', 
        isValid: false,
        error: 'Unable to parse phone number'
      };
    }
    
    return {
      internationalPhone: parsed.format('E.164') || '',
      nationalPhone: parsed.nationalNumber || '',
      isValid: parsed.isValid() || false
    };
    
  } catch (error) {
    return { 
      internationalPhone: '', 
      nationalPhone: '', 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}
