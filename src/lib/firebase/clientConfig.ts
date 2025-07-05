import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager,
  FirestoreSettings
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
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
      
      // Initialize Auth (needed for custom token authentication)
      auth = getAuth(app);
      
      // Initialize Firestore with persistence
      try {
        const firestoreSettings: FirestoreSettings = {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          }),
        };
        
        db = initializeFirestore(app, firestoreSettings);
      } catch (firestoreError) {
        console.warn('Failed to initialize Firestore with persistence, falling back to default:', firestoreError);
        db = getFirestore(app);
      }
      
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
    // Don't let Firebase initialization errors break the entire app
    app = undefined;
    db = undefined;
    auth = undefined;
    storage = undefined;
  }
}

// Initialize Firebase app and services
export const initializeFirebaseApp = async (): Promise<FirebaseServices | undefined> => {
  if (!isClient) return undefined;

  try {
    if (!app) {
      console.log('Initializing Firebase...');
      app = initializeApp(firebaseConfig);
      
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
export { app, db, storage };
