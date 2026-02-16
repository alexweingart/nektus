import { describe, it, expect } from 'vitest';
import {
  getFieldValue,
  generateSocialUrl,
  sortContactEntries,
  hasContactEntryContent,
  getPhoneNumber,
  getFirstName,
} from './transforms';
import type { ContactEntry } from '@nektus/shared-types';

const entry = (overrides: Partial<ContactEntry>): ContactEntry => ({
  fieldType: 'phone',
  value: '',
  section: 'universal',
  order: 0,
  isVisible: true,
  confirmed: false,
  ...overrides,
});

describe('getFieldValue', () => {
  it('returns value when field exists', () => {
    const entries = [entry({ fieldType: 'phone', value: '+1234' })];
    expect(getFieldValue(entries, 'phone')).toBe('+1234');
  });

  it('returns empty string when field not found', () => {
    const entries = [entry({ fieldType: 'email', value: 'a@b.com' })];
    expect(getFieldValue(entries, 'phone')).toBe('');
  });

  it('returns empty string for undefined entries', () => {
    expect(getFieldValue(undefined, 'phone')).toBe('');
  });

  it('returns empty string when value is empty', () => {
    const entries = [entry({ fieldType: 'phone', value: '' })];
    expect(getFieldValue(entries, 'phone')).toBe('');
  });
});

describe('generateSocialUrl', () => {
  it('generates Instagram URL without protocol', () => {
    expect(generateSocialUrl('instagram', 'johndoe')).toBe('instagram.com/johndoe');
  });

  it('generates Instagram URL with protocol', () => {
    expect(generateSocialUrl('instagram', 'johndoe', true)).toBe('https://instagram.com/johndoe');
  });

  it('generates X URL', () => {
    expect(generateSocialUrl('x', 'johndoe')).toBe('x.com/johndoe');
  });

  it('generates LinkedIn URL', () => {
    expect(generateSocialUrl('linkedin', 'johndoe')).toBe('linkedin.com/in/johndoe');
  });

  it('generates Snapchat URL', () => {
    expect(generateSocialUrl('snapchat', 'johndoe')).toBe('snapchat.com/add/johndoe');
  });

  it('generates Telegram URL', () => {
    expect(generateSocialUrl('telegram', 'johndoe')).toBe('t.me/johndoe');
  });

  it('returns phone-prefixed string for WhatsApp', () => {
    expect(generateSocialUrl('whatsapp', '1234567890')).toBe('+1234567890');
  });

  it('returns empty string for WeChat', () => {
    expect(generateSocialUrl('wechat', 'userid')).toBe('');
  });

  it('returns empty string for email fieldType', () => {
    expect(generateSocialUrl('email', 'a@b.com')).toBe('');
  });

  it('returns empty string for phone fieldType', () => {
    expect(generateSocialUrl('phone', '+1234')).toBe('');
  });

  it('returns empty string for empty username', () => {
    expect(generateSocialUrl('instagram', '')).toBe('');
  });

  it('returns empty string for unknown platform', () => {
    expect(generateSocialUrl('tiktok', 'user')).toBe('');
  });
});

describe('sortContactEntries', () => {
  it('sorts by order ascending', () => {
    const entries = [
      entry({ fieldType: 'email', order: 2 }),
      entry({ fieldType: 'phone', order: 0 }),
      entry({ fieldType: 'name', order: -2 }),
    ];
    const sorted = sortContactEntries(entries);
    expect(sorted.map(e => e.fieldType)).toEqual(['name', 'phone', 'email']);
  });

  it('treats missing order as 999', () => {
    const entries = [
      entry({ fieldType: 'a', order: undefined as unknown as number }),
      entry({ fieldType: 'b', order: 1 }),
    ];
    const sorted = sortContactEntries(entries);
    expect(sorted.map(e => e.fieldType)).toEqual(['b', 'a']);
  });

  it('does not mutate original array', () => {
    const entries = [entry({ order: 2 }), entry({ order: 1 })];
    sortContactEntries(entries);
    expect(entries[0].order).toBe(2);
  });
});

describe('hasContactEntryContent', () => {
  it('returns true for non-empty value', () => {
    expect(hasContactEntryContent(entry({ value: 'hello' }))).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(hasContactEntryContent(entry({ value: '' }))).toBe(false);
  });

  it('returns false for whitespace-only value', () => {
    expect(hasContactEntryContent(entry({ value: '   ' }))).toBe(false);
  });
});

describe('getPhoneNumber', () => {
  it('extracts phone from entries', () => {
    const entries = [
      entry({ fieldType: 'email', value: 'a@b.com' }),
      entry({ fieldType: 'phone', value: '+15551234567' }),
    ];
    expect(getPhoneNumber(entries)).toBe('+15551234567');
  });

  it('returns empty string when no phone entry', () => {
    const entries = [entry({ fieldType: 'email', value: 'a@b.com' })];
    expect(getPhoneNumber(entries)).toBe('');
  });

  it('returns empty string for undefined entries', () => {
    expect(getPhoneNumber(undefined)).toBe('');
  });
});

describe('getFirstName', () => {
  it('returns first word of multi-word name', () => {
    expect(getFirstName('John Doe')).toBe('John');
  });

  it('returns full name if single word', () => {
    expect(getFirstName('John')).toBe('John');
  });

  it('handles empty string', () => {
    expect(getFirstName('')).toBe('');
  });
});
