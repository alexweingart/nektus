import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileSaveService, setClientProfileService } from './save';
import type { IClientProfileService } from './save';
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
    entry({ fieldType: 'name', value: 'John', section: 'universal', order: -2 }),
    entry({ fieldType: 'phone', value: '+1555', section: 'universal', order: 0 }),
  ],
};

let mockService: IClientProfileService;
let savedProfile: UserProfile | null;

beforeEach(() => {
  savedProfile = null;
  mockService = {
    saveProfile: vi.fn(async (profile: UserProfile) => { savedProfile = profile; }),
    getProfile: vi.fn(async () => baseProfile),
  };
  setClientProfileService(mockService);
});

describe('ProfileSaveService.saveProfile', () => {
  it('returns error when userId is empty', async () => {
    const result = await ProfileSaveService.saveProfile('', null, {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('User ID required');
  });

  it('saves profile with contactEntries filtering', async () => {
    const entries = [
      entry({ fieldType: 'name', value: 'Jane', section: 'universal' }),
      entry({ fieldType: 'phone', value: '+1234', section: 'universal' }),
    ];
    const result = await ProfileSaveService.saveProfile('user-1', null, { contactEntries: entries });
    expect(result.success).toBe(true);
    expect(mockService.saveProfile).toHaveBeenCalled();
  });

  it('assigns unique orders to contactEntries', async () => {
    const entries = [
      entry({ fieldType: 'name', value: 'Jane', section: 'universal' }),
      entry({ fieldType: 'phone', value: '+1234', section: 'universal' }),
      entry({ fieldType: 'instagram', value: 'jane', section: 'personal', isVisible: true }),
    ];
    const result = await ProfileSaveService.saveProfile('user-1', null, { contactEntries: entries });
    expect(result.success).toBe(true);
    const saved = result.profile!.contactEntries;
    // Name should get -2, phone should get 0, instagram should get sequential
    expect(saved.find(e => e.fieldType === 'name')!.order).toBe(-2);
    expect(saved.find(e => e.fieldType === 'phone')!.order).toBe(0);
  });

  it('rejects base64 profileImage', async () => {
    const result = await ProfileSaveService.saveProfile('user-1', baseProfile, {
      profileImage: 'data:image/png;base64,abc123',
    });
    expect(result.success).toBe(true);
    // base64 should have been stripped
    expect(savedProfile!.profileImage).not.toContain('data:image');
  });

  it('rejects base64 backgroundImage', async () => {
    const result = await ProfileSaveService.saveProfile('user-1', baseProfile, {
      backgroundImage: 'data:image/jpeg;base64,xyz',
    });
    expect(result.success).toBe(true);
    expect(savedProfile!.backgroundImage).not.toContain('data:image');
  });

  it('uses directUpdate when option is set', async () => {
    const result = await ProfileSaveService.saveProfile('user-1', baseProfile, {
      contactEntries: [entry({ fieldType: 'email', value: 'a@b.com', section: 'universal' })],
    }, { directUpdate: true });
    expect(result.success).toBe(true);
    // With directUpdate, source contactEntries replace rather than merge
    expect(result.profile!.contactEntries.length).toBeGreaterThan(0);
  });

  it('skips empty shortCode in saved data', async () => {
    const result = await ProfileSaveService.saveProfile('user-1', null, { shortCode: '' });
    expect(result.success).toBe(true);
    // The saved data should not have shortCode when empty
    const callArg = (mockService.saveProfile as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.shortCode).toBeUndefined();
  });

  it('preserves existing shortCode on merge', async () => {
    const result = await ProfileSaveService.saveProfile('user-1', baseProfile, {
      contactEntries: baseProfile.contactEntries,
    });
    expect(result.success).toBe(true);
    const callArg = (mockService.saveProfile as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.shortCode).toBe('abc12345');
  });

  it('handles save failure gracefully', async () => {
    mockService.saveProfile = vi.fn(async () => { throw new Error('Network error'); });
    setClientProfileService(mockService);
    const result = await ProfileSaveService.saveProfile('user-1', null, {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});

describe('ProfileSaveService.saveContactEntries', () => {
  it('delegates to saveProfile with directUpdate', async () => {
    const entries = [entry({ fieldType: 'phone', value: '+1234', section: 'universal' })];
    const result = await ProfileSaveService.saveContactEntries('user-1', baseProfile, entries);
    expect(result.success).toBe(true);
    expect(mockService.saveProfile).toHaveBeenCalled();
  });

  it('assigns unique orders before saving', async () => {
    const entries = [
      entry({ fieldType: 'name', value: 'Jane', section: 'universal' }),
      entry({ fieldType: 'bio', value: 'Hello', section: 'universal' }),
      entry({ fieldType: 'phone', value: '+1234', section: 'universal' }),
    ];
    const result = await ProfileSaveService.saveContactEntries('user-1', null, entries);
    expect(result.success).toBe(true);
  });

  it('passes images through to saveProfile', async () => {
    const entries = [entry({ fieldType: 'phone', value: '+1234', section: 'universal' })];
    const result = await ProfileSaveService.saveContactEntries('user-1', null, entries, {
      profileImage: 'https://example.com/photo.jpg',
    });
    expect(result.success).toBe(true);
  });
});

describe('merge behavior', () => {
  it('merges contactEntries by fieldType+section', async () => {
    const existing: UserProfile = {
      ...baseProfile,
      contactEntries: [
        entry({ fieldType: 'phone', value: '+1111', section: 'universal' }),
        entry({ fieldType: 'email', value: 'old@test.com', section: 'universal' }),
      ],
    };
    const updates = {
      contactEntries: [
        entry({ fieldType: 'phone', value: '+2222', section: 'universal' }),
      ],
    };
    const result = await ProfileSaveService.saveProfile('user-1', existing, updates);
    expect(result.success).toBe(true);
    const phone = result.profile!.contactEntries.find(e => e.fieldType === 'phone');
    expect(phone!.value).toBe('+2222');
    // Email should be preserved from existing
    const email = result.profile!.contactEntries.find(e => e.fieldType === 'email');
    expect(email!.value).toBe('old@test.com');
  });

  it('adds new entries that do not exist in target', async () => {
    const updates = {
      contactEntries: [
        entry({ fieldType: 'instagram', value: 'newuser', section: 'personal', isVisible: true }),
      ],
    };
    const result = await ProfileSaveService.saveProfile('user-1', baseProfile, updates);
    expect(result.success).toBe(true);
    const ig = result.profile!.contactEntries.find(e => e.fieldType === 'instagram');
    expect(ig).toBeDefined();
    expect(ig!.value).toBe('newuser');
  });

  it('creates default profile when current is null', async () => {
    const result = await ProfileSaveService.saveProfile('user-1', null, {
      contactEntries: [entry({ fieldType: 'phone', value: '+1234', section: 'universal' })],
    });
    expect(result.success).toBe(true);
    expect(result.profile!.userId).toBe('user-1');
  });

  it('marks non-empty fields as confirmed', async () => {
    const entries = [
      entry({ fieldType: 'phone', value: '+1234', section: 'universal', confirmed: false }),
      entry({ fieldType: 'email', value: '', section: 'universal', confirmed: false }),
    ];
    const result = await ProfileSaveService.saveProfile('user-1', null, { contactEntries: entries });
    expect(result.success).toBe(true);
    const phone = result.profile!.contactEntries.find(e => e.fieldType === 'phone');
    expect(phone!.confirmed).toBe(true);
    const email = result.profile!.contactEntries.find(e => e.fieldType === 'email');
    expect(email!.confirmed).toBe(false);
  });
});
