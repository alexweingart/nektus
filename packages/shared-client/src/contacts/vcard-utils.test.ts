import { describe, it, expect } from 'vitest';
import {
  escapeVCardValue,
  getSocialMediaUrl,
  getPlatformTypeForIOS,
  formatPhotoLine,
  detectImageTypeFromBytes,
  generateVCardLines,
  generateVCardFilename,
} from './vcard-utils';
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
  lastUpdated: 1700000000000,
  contactEntries: [
    entry({ fieldType: 'name', value: 'John Doe', order: -2 }),
    entry({ fieldType: 'phone', value: '+15551234567', order: 0 }),
    entry({ fieldType: 'email', value: 'john@example.com', order: 1 }),
    entry({ fieldType: 'bio', value: 'Hello world', order: -1 }),
    entry({ fieldType: 'instagram', value: 'johndoe', section: 'personal', order: 2 }),
  ],
};

describe('escapeVCardValue', () => {
  it('escapes semicolons', () => {
    expect(escapeVCardValue('hello;world')).toBe('hello\\;world');
  });

  it('escapes commas', () => {
    expect(escapeVCardValue('hello,world')).toBe('hello\\,world');
  });

  it('escapes backslashes', () => {
    expect(escapeVCardValue('hello\\world')).toBe('hello\\\\world');
  });

  it('escapes newlines', () => {
    expect(escapeVCardValue('hello\nworld')).toBe('hello\\nworld');
  });

  it('returns empty string for empty input', () => {
    expect(escapeVCardValue('')).toBe('');
  });
});

describe('getSocialMediaUrl', () => {
  it('returns URL for known platform', () => {
    expect(getSocialMediaUrl('instagram', 'johndoe')).toBe('https://instagram.com/johndoe');
  });

  it('returns URL for x platform', () => {
    expect(getSocialMediaUrl('x', 'johndoe')).toBe('https://x.com/johndoe');
  });

  it('returns null for unknown platform', () => {
    expect(getSocialMediaUrl('tiktok', 'user')).toBeNull();
  });

  it('is case-insensitive for platform name', () => {
    expect(getSocialMediaUrl('Instagram', 'johndoe')).toBe('https://instagram.com/johndoe');
  });
});

describe('getPlatformTypeForIOS', () => {
  it('maps x to Twitter', () => {
    expect(getPlatformTypeForIOS('x')).toBe('Twitter');
  });

  it('maps instagram to Instagram', () => {
    expect(getPlatformTypeForIOS('instagram')).toBe('Instagram');
  });

  it('maps linkedin to LinkedIn', () => {
    expect(getPlatformTypeForIOS('linkedin')).toBe('LinkedIn');
  });

  it('returns platform name if not in mapping', () => {
    expect(getPlatformTypeForIOS('tiktok')).toBe('tiktok');
  });
});

describe('formatPhotoLine', () => {
  it('produces correct prefix', () => {
    const result = formatPhotoLine('AAAA', 'JPEG');
    expect(result.startsWith('PHOTO;ENCODING=BASE64;TYPE=JPEG:')).toBe(true);
  });

  it('folds long lines at 75 chars', () => {
    const longData = 'A'.repeat(200);
    const result = formatPhotoLine(longData);
    const lines = result.split('\r\n');
    // First line should be at most 75 chars
    expect(lines[0].length).toBeLessThanOrEqual(75);
    // Continuation lines start with space
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].startsWith(' ')).toBe(true);
    }
  });
});

describe('detectImageTypeFromBytes', () => {
  it('detects JPEG', () => {
    expect(detectImageTypeFromBytes(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]))).toBe('JPEG');
  });

  it('detects PNG', () => {
    expect(detectImageTypeFromBytes(new Uint8Array([0x89, 0x50, 0x4E, 0x47]))).toBe('PNG');
  });

  it('detects GIF', () => {
    expect(detectImageTypeFromBytes(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBe('GIF');
  });

  it('detects WebP', () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(detectImageTypeFromBytes(webp)).toBe('WEBP');
  });

  it('defaults to JPEG for unknown bytes', () => {
    expect(detectImageTypeFromBytes(new Uint8Array([0x00, 0x00, 0x00]))).toBe('JPEG');
  });
});

describe('generateVCardLines', () => {
  it('generates BEGIN and END markers', () => {
    const lines = generateVCardLines(baseProfile);
    expect(lines[0]).toBe('BEGIN:VCARD');
    expect(lines[lines.length - 1]).toBe('END:VCARD');
  });

  it('includes FN and N fields from name', () => {
    const lines = generateVCardLines(baseProfile);
    expect(lines).toContain('FN:John Doe');
    expect(lines.some(l => l.startsWith('N:'))).toBe(true);
  });

  it('includes phone number', () => {
    const lines = generateVCardLines(baseProfile);
    expect(lines).toContain('TEL;TYPE=CELL:+15551234567');
  });

  it('includes email', () => {
    const lines = generateVCardLines(baseProfile);
    expect(lines.some(l => l.startsWith('EMAIL:'))).toBe(true);
  });

  it('includes social profiles', () => {
    const lines = generateVCardLines(baseProfile);
    expect(lines.some(l => l.includes('SOCIALPROFILE') && l.includes('INSTAGRAM'))).toBe(true);
  });

  it('includes bio as NOTE', () => {
    const lines = generateVCardLines(baseProfile);
    expect(lines).toContain('NOTE:Hello world');
  });

  it('includes contact URL when provided', () => {
    const lines = generateVCardLines(baseProfile, { contactUrl: 'https://nekt.us/c/abc' });
    expect(lines).toContain('URL:https://nekt.us/c/abc');
  });

  it('excludes social profiles when disabled', () => {
    const lines = generateVCardLines(baseProfile, { includeSocialMedia: false });
    expect(lines.some(l => l.includes('SOCIALPROFILE'))).toBe(false);
  });

  it('excludes notes when disabled', () => {
    const lines = generateVCardLines(baseProfile, { includeNotes: false });
    expect(lines.some(l => l.startsWith('NOTE:'))).toBe(false);
  });
});

describe('generateVCardFilename', () => {
  it('generates filename from name', () => {
    expect(generateVCardFilename(baseProfile)).toBe('John_Doe_contact.vcf');
  });

  it('handles special characters in name', () => {
    const profile = { ...baseProfile, contactEntries: [entry({ fieldType: 'name', value: 'José O\'Brien' })] };
    const filename = generateVCardFilename(profile);
    expect(filename).toBe('Jos_OBrien_contact.vcf');
  });

  it('defaults to contact when no name', () => {
    const profile = { ...baseProfile, contactEntries: [] };
    expect(generateVCardFilename(profile)).toBe('contact_contact.vcf');
  });
});
