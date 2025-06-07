// Re-export all Firebase-related functionality
export * from './config';
export * from './profileService';
export * from './sync';

// For backward compatibility
export const IndexedDB = {
  get: async <T>(key: string): Promise<T | null> => {
    console.warn('IndexedDB.get() is deprecated. Use ProfileService.getProfile() instead');
    return null;
  },
  set: async <T>(key: string, value: T): Promise<void> => {
    console.warn('IndexedDB.set() is deprecated. Use ProfileService.saveProfile() instead');
  },
  delete: async (key: string): Promise<void> => {
    console.warn('IndexedDB.delete() is deprecated');
  }
};
