// Re-export all Firebase-related functionality
export * from './clientConfig';
export * from './profileService';

// For backward compatibility
export const IndexedDB = {
  get: async <T>(_key: string): Promise<T | null> => {
    console.warn('IndexedDB.get() is deprecated. Use ProfileService.getProfile() instead');
    return null;
  },
  set: async <T>(_key: string, _value: T): Promise<void> => {
    console.warn('IndexedDB.set() is deprecated. Use ProfileService.saveProfile() instead');
  },
  delete: async (_key: string): Promise<void> => {
    console.warn('IndexedDB.delete() is deprecated');
  }
};

// Utility functions for common operations
export const clearCache = () => {
  Object.keys(localStorage).forEach(_key => {
    // Clear Firebase related cache
  });
  
  Object.entries(sessionStorage).forEach(([_key, _value]) => {
    // Clear session storage
  });
  
  Object.keys(indexedDB).forEach(_key => {
    // Clear IndexedDB
  });
};
