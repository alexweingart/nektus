/**
 * US phone number formatter utility
 * Formats a string of digits as a US phone number: (xxx) xxx-xxxx
 */
import { AsYouType } from 'libphonenumber-js';

/**
 * Format a string of digits as a US phone number
 * @param digits National digits only (no country code)
 * @returns Formatted phone number string: (xxx) xxx-xxxx
 */
export function formatUSPhone(digits: string): string {
  return new AsYouType('US').input(digits);
}

/**
 * Clean raw input to get US-only national digits
 * Strips non-digits and handles 11-digit numbers that start with 1
 * @param input Raw input string
 * @returns Clean US national digits (max 10)
 */
export function cleanUSDigits(input: string): string {
  // Strip all non-digits
  let digits = input.replace(/\D/g, '');
  
  // If 11 digits and starts with 1, remove the 1
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  
  // Cap at 10 digits
  if (digits.length > 10) {
    digits = digits.slice(0, 10);
  }
  
  return digits;
}
