import { AsYouType } from 'libphonenumber-js';

/** Strip everything except digits, then *always* return ≤10 US digits. */
export function cleanUSDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');

  // Drop a leading "1" if it's 11 digits (Chrome bubble paste)
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);

  return digits.slice(0, 10);
}

/** Format US digits live — "(123) 456‑7890". */
export function formatUSPhone(digits: string): string {
  return new AsYouType('US').input(digits);
}
