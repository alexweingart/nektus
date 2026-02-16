import { describe, it, expect } from 'vitest';
import { ensureReadableColor, profileNeedsSetup, profileHasPhone } from './utils';
import type { UserProfile, ContactEntry } from '@nektus/shared-types';

const entry = (overrides: Partial<ContactEntry>): ContactEntry => ({
  fieldType: 'phone',
  value: '',
  section: 'universal',
  order: 0,
  isVisible: true,
  confirmed: false,
  ...overrides,
});

const baseProfile: UserProfile = {
  userId: 'user-1',
  shortCode: 'abc12345',
  profileImage: '',
  backgroundImage: '',
  lastUpdated: 1000,
  contactEntries: [
    entry({ fieldType: 'phone', value: '+15551234567' }),
  ],
};

describe('ensureReadableColor', () => {
  it('lightens a dark color', () => {
    const result = ensureReadableColor('#1a1a1a');
    // Should be lighter than the input
    const clean = result.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    // Original is very dark (26, 26, 26); output should be much brighter
    expect(r + g + b).toBeGreaterThan(78); // 26*3
  });

  it('keeps already-light color unchanged or similar', () => {
    const result = ensureReadableColor('#cccccc');
    // #cccccc has lightness ~80%, which is >= 60 default
    expect(result).toBe('#cccccc');
  });

  it('respects custom minLightness parameter', () => {
    // Very dark color with high minLightness
    const result = ensureReadableColor('#000000', 80);
    const clean = result.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    // Should be quite bright
    expect(Math.max(r, g, b)).toBeGreaterThan(150);
  });

  it('returns valid hex color', () => {
    const result = ensureReadableColor('#ff5733');
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('profileNeedsSetup', () => {
  it('returns true for null profile', () => {
    expect(profileNeedsSetup(null)).toBe(true);
  });

  it('returns true for profile without phone', () => {
    const profile = { ...baseProfile, contactEntries: [] };
    expect(profileNeedsSetup(profile)).toBe(true);
  });

  it('returns false for profile with phone', () => {
    expect(profileNeedsSetup(baseProfile)).toBe(false);
  });

  it('returns true when phone value is whitespace', () => {
    const profile = {
      ...baseProfile,
      contactEntries: [entry({ fieldType: 'phone', value: '  ' })],
    };
    expect(profileNeedsSetup(profile)).toBe(true);
  });
});

describe('profileHasPhone', () => {
  it('returns false for null profile', () => {
    expect(profileHasPhone(null)).toBe(false);
  });

  it('returns false when no contactEntries', () => {
    const profile = { ...baseProfile, contactEntries: undefined as unknown as ContactEntry[] };
    expect(profileHasPhone(profile)).toBe(false);
  });

  it('returns false when phone value is empty', () => {
    const profile = {
      ...baseProfile,
      contactEntries: [entry({ fieldType: 'phone', value: '' })],
    };
    expect(profileHasPhone(profile)).toBe(false);
  });

  it('returns true when phone has value', () => {
    expect(profileHasPhone(baseProfile)).toBe(true);
  });

  it('returns false when phone value is whitespace', () => {
    const profile = {
      ...baseProfile,
      contactEntries: [entry({ fieldType: 'phone', value: '   ' })],
    };
    expect(profileHasPhone(profile)).toBe(false);
  });
});
