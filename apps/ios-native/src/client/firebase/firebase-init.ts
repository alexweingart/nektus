/**
 * Firebase JS SDK Initialization for iOS
 * Replaces @react-native-firebase with firebase JS SDK to avoid useFrameworks requirement
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
// @ts-ignore: getReactNativePersistence exists in the RN bundle but is missing from TypeScript definitions
import { getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration for JS SDK
// Using iOS API key with "None" application restrictions (configured in Google Cloud Console)
// The JS SDK can't satisfy bundle ID or referer restrictions, so the key must be unrestricted
const firebaseConfig = {
  apiKey: 'AIzaSyDRiHhiaBHGwrZIqBaxacTfVURXAg3fHZs', // iOS API key (unrestricted)
  authDomain: 'indigo-idea-400116.firebaseapp.com',
  projectId: 'indigo-idea-400116',
  storageBucket: 'indigo-idea-400116.firebasestorage.app',
  messagingSenderId: '597818194511',
  appId: '1:597818194511:ios:b6a3f7096749344113883a',
};

// Initialize Firebase only once
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

function initializeFirebase(): FirebaseApp {
  if (getApps().length === 0) {
    console.log('[firebase-init] Initializing Firebase JS SDK');
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  return app;
}

// Initialize on module load
app = initializeFirebase();

// Initialize auth with AsyncStorage persistence for React Native
// This ensures auth state survives app restarts and force closes
// Note: initializeAuth can only be called once per app, so we check if already initialized
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  // Auth already initialized, get the existing instance
  auth = getAuth(app);
}

// Use memory-only cache for React Native to avoid IndexedDB/bundle loading errors
// The Firebase JS SDK's default persistence doesn't work properly in RN
try {
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  });
} catch (e) {
  // Firestore already initialized, get the existing instance
  db = getFirestore(app);
}
storage = getStorage(app);

export { app, auth, db, storage };
export default app;
