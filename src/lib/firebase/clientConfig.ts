import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  FirestoreSettings
} from 'firebase/firestore';
import { getAuth, Auth, signInWithCustomToken } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if we're in a browser environment
const isClient = typeof window !== 'undefined';

type FirebaseServices = {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
};

// Initialize Firebase
let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;

// Automatically initialize Firebase when this module is imported in a browser environment
if (isClient) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      
      // Initialize Auth
      auth = getAuth(app);
      
      // Initialize Firestore with persistence
      const firestoreSettings: FirestoreSettings = {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        }),
      };
      
      db = initializeFirestore(app, firestoreSettings);
      
      // Initialize Storage
      storage = getStorage(app);
    } else {
      // Use existing app instance
      app = getApps()[0];
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app);
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

/**
 * Authenticate Firebase client with NextAuth session token
 */
export const authenticateFirebaseClient = async (customToken: string): Promise<void> => {
  if (!auth) {
    throw new Error('Firebase Auth not initialized');
  }
  
  try {
    await signInWithCustomToken(auth, customToken);
    console.log('Firebase client authenticated successfully');
  } catch (error) {
    console.error('Failed to authenticate Firebase client:', error);
    throw error;
  }
};

// Initialize Firebase app and services
export const initializeFirebaseApp = async (): Promise<FirebaseServices | undefined> => {
  if (!isClient) return undefined;

  try {
    if (!app) {
      console.log('Initializing Firebase...');
      app = initializeApp(firebaseConfig);
      
      // Initialize Auth
      auth = getAuth(app);
      
      // Initialize Firestore with persistence
      const firestoreSettings: FirestoreSettings = {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        }),
      };
      
      db = initializeFirestore(app, firestoreSettings);
      
      // Initialize Storage
      storage = getStorage(app);
      
      console.log('Firebase initialized successfully');
    }

    if (!app || !db || !auth || !storage) {
      throw new Error('Failed to initialize Firebase services');
    }

    return { app, db, auth, storage };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
};

// Export initialized instances
export { app, db, auth, storage };
