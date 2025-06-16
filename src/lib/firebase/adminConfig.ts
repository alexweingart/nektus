// Firebase Admin SDK setup - isolated to avoid jose.js conflicts
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

interface FirebaseAdminConfig {
  type: string;
  projectId: string;
  privateKeyId: string;
  privateKey: string;
  clientEmail: string;
  clientId: string;
  authUri: string;
  tokenUri: string;
  authProviderX509CertUrl: string;
  clientX509CertUrl: string;
  universeDomain: string;
}

interface AdminServices {
  auth: admin.auth.Auth;
  db: admin.firestore.Firestore;
  storage: admin.storage.Storage;
  adminApp: admin.app.App;
}

let adminServices: AdminServices | null = null;

export async function getFirebaseAdmin(): Promise<AdminServices> {
  if (adminServices) {
    return adminServices;
  }

  try {
    // Check if app already exists
    let adminApp: admin.app.App;
    if (admin.apps.length > 0) {
      adminApp = admin.apps[0] as admin.app.App;
    } else {
      // Initialize new app
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

      if (!projectId) {
        throw new Error('Missing FIREBASE_PROJECT_ID environment variable');
      }
      if (!privateKey) {
        throw new Error('Missing FIREBASE_PRIVATE_KEY environment variable');
      }
      if (!clientEmail) {
        throw new Error('Missing FIREBASE_CLIENT_EMAIL environment variable');
      }

      const serviceAccount: FirebaseAdminConfig = {
        type: 'service_account',
        projectId: projectId,
        privateKeyId: '',
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail: clientEmail,
        clientId: '',
        authUri: '',
        tokenUri: '',
        authProviderX509CertUrl: '',
        clientX509CertUrl: '',
        universeDomain: '',
      };

      const initConfig: admin.AppOptions = {
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      };

      // Only add storage bucket if available
      if (storageBucket) {
        initConfig.storageBucket = storageBucket;
      }

      adminApp = admin.initializeApp(initConfig);
    }

    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp);
    const storage = getStorage(adminApp);

    adminServices = {
      auth,
      db,
      storage,
      adminApp,
    };

    return adminServices;
  } catch (error) {
    console.error('[Firebase Admin] Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

export async function getProfile(userId: string): Promise<any | null> {
  try {
    const { db } = await getFirebaseAdmin();
    const profileRef = db.collection('profiles').doc(userId);
    const doc = await profileRef.get();
    
    if (!doc.exists) {
      return null;
    }
    
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error(`[getProfile] Error getting profile for user ${userId}:`, error);
    return null;
  }
}

export async function deleteUserProfile(userId: string): Promise<void> {
  try {
    const { db, storage } = await getFirebaseAdmin();
    const profileRef = db.collection('profiles').doc(userId);

    // First check if the document exists
    const doc = await profileRef.get();
    if (!doc.exists) {
      return;
    }

    // Delete Firebase Storage files for this user
    try {
      const userStoragePrefix = `users/${userId}/`;

      // List all files in the user's storage folder
      const [files] = await storage.bucket().getFiles({ prefix: userStoragePrefix });

      if (files.length > 0) {
        // Delete all files in parallel
        const deletePromises = files.map(async (file) => {
          try {
            await file.delete();
          } catch (error) {
            console.warn(`[deleteUserProfile] Failed to delete storage file ${file.name}:`, error);
          }
        });

        await Promise.allSettled(deletePromises);
      } else {
        // No storage files to delete
      }
    } catch (storageError) {
      console.error(`[deleteUserProfile] Error cleaning up storage for user ${userId}:`, storageError);
      // Don't fail the entire deletion if storage cleanup fails
    }

    // Delete the profile document from Firestore
    await profileRef.delete();

    // Verify deletion by checking if document still exists
    const verifyDoc = await profileRef.get();
    if (verifyDoc.exists) {
      throw new Error(`[deleteUserProfile] Profile ${userId} still exists after deletion attempt`);
    }
  } catch (error) {
    console.error(`[deleteUserProfile] Error deleting profile for user ${userId}:`, error);
    throw error; // Re-throw to be handled by the API route
  }
}

export async function getUserBackgroundImage(userId: string): Promise<string | null> {
  try {
    const profile = await getProfile(userId);
    
    if (!profile || !profile.backgroundImage) {
      return null;
    }

    // Return the background image URL
    return profile.backgroundImage;
  } catch (error) {
    console.error(`[getUserBackgroundImage] Error getting background image for user ${userId}:`, error);
    return null;
  }
}
