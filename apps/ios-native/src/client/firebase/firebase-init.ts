/**
 * Firebase JS SDK Initialization for iOS
 * Replaces @react-native-firebase with firebase JS SDK to avoid useFrameworks requirement
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Firebase configuration from GoogleService-Info.plist
const firebaseConfig = {
  apiKey: 'AIzaSyDRiHhiaBHGwrZIqBaxacTfVURXAg3fHZs',
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
auth = getAuth(app);
db = getFirestore(app);
storage = getStorage(app);

export { app, auth, db, storage };
export default app;
