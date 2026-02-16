import { describe, it, expect } from 'vitest';
import { formatPhoneNumber } from './phone-formatter';

describe('formatPhoneNumber', () => {
  it('formats a US 10-digit national number', () => {
    const result = formatPhoneNumber('2125551234');
    expect(result.isValid).toBe(true);
    expect(result.internationalPhone).toBe('+12125551234');
    expect(result.nationalPhone).toBe('2125551234');
  });

  it('formats a US number with formatting characters', () => {
    const result = formatPhoneNumber('(212) 555-1234');
    expect(result.isValid).toBe(true);
    expect(result.internationalPhone).toBe('+12125551234');
  });

  it('formats an international number with + prefix', () => {
    const result = formatPhoneNumber('+442071234567');
    expect(result.isValid).toBe(true);
    expect(result.internationalPhone).toBe('+442071234567');
  });

  it('formats a number with dashes', () => {
    const result = formatPhoneNumber('212-555-1234');
    expect(result.isValid).toBe(true);
    expect(result.internationalPhone).toBe('+12125551234');
  });

  it('returns isValid false for empty input', () => {
    const result = formatPhoneNumber('');
    expect(result.isValid).toBe(false);
    expect(result.internationalPhone).toBe('');
    expect(result.nationalPhone).toBe('');
  });

  it('returns isValid false for non-digit input', () => {
    const result = formatPhoneNumber('abc');
    expect(result.isValid).toBe(false);
  });

  it('returns isValid false for too-short number', () => {
    const result = formatPhoneNumber('123');
    expect(result.isValid).toBe(false);
  });

  it('returns E.164 format for valid numbers', () => {
    const result = formatPhoneNumber('5551234567');
    expect(result.internationalPhone).toMatch(/^\+1\d{10}$/);
  });

  it('handles country code parameter for non-US numbers', () => {
    const result = formatPhoneNumber('7911123456', 'GB');
    expect(result.isValid).toBe(true);
    expect(result.internationalPhone).toBe('+447911123456');
  });

  it('preserves + for international format detection', () => {
    const result = formatPhoneNumber('+1 (212) 555-1234');
    expect(result.isValid).toBe(true);
    expect(result.internationalPhone).toBe('+12125551234');
  });

  it('returns nationalNumber without country code', () => {
    const result = formatPhoneNumber('+12125551234');
    expect(result.nationalPhone).toBe('2125551234');
  });

  it('handles spaces-only input', () => {
    const result = formatPhoneNumber('   ');
    expect(result.isValid).toBe(false);
  });
});
