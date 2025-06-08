// Firebase Admin SDK setup - isolated to avoid jose.js conflicts
import type { ServiceAccount } from 'firebase-admin';

let adminApp: any = null;
let adminDb: any = null;

export async function getFirebaseAdmin() {
  if (adminApp && adminDb) {
    return { app: adminApp, db: adminDb };
  }

  try {
    // Check if all required environment variables are present
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    console.log('[Firebase Admin] Checking environment variables...');
    console.log('[Firebase Admin] Project ID:', projectId ? `✓ ${projectId}` : '✗ Missing');
    console.log('[Firebase Admin] Private Key:', privateKey ? '✓ Set' : '✗ Missing');
    console.log('[Firebase Admin] Client Email:', clientEmail ? `✓ ${clientEmail}` : '✗ Missing');
    console.log('[Firebase Admin] Storage Bucket:', storageBucket ? `✓ ${storageBucket}` : '✗ Missing');

    if (!projectId) {
      throw new Error('Missing FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable');
    }

    if (!privateKey) {
      console.error('[Firebase Admin] Missing FIREBASE_PRIVATE_KEY. You need to add Firebase Admin SDK credentials to your .env.local file.');
      console.error('[Firebase Admin] To get these credentials:');
      console.error('[Firebase Admin] 1. Go to Firebase Console -> Project Settings -> Service Accounts');
      console.error('[Firebase Admin] 2. Click "Generate new private key"');
      console.error('[Firebase Admin] 3. Add the credentials to your .env.local file');
      throw new Error('Missing FIREBASE_PRIVATE_KEY environment variable');
    }

    if (!clientEmail) {
      throw new Error('Missing FIREBASE_CLIENT_EMAIL environment variable');
    }

    // Dynamic import to avoid conflicts during build
    const admin = await import('firebase-admin');
    
    if (!admin.default.apps.length) {
      const serviceAccount: ServiceAccount = {
        projectId: projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail: clientEmail,
      };

      console.log('[Firebase Admin] Initializing Firebase Admin with project:', serviceAccount.projectId);

      const adminConfig: any = {
        credential: admin.default.credential.cert(serviceAccount),
        projectId: projectId,
      };

      // Only add storageBucket if it's defined in environment variables
      if (storageBucket) {
        adminConfig.storageBucket = storageBucket;
        console.log('[Firebase Admin] Storage bucket configured:', storageBucket);
      } else {
        console.warn('[Firebase Admin] No storage bucket configured - storage operations may fail');
        console.warn('[Firebase Admin] Please set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in your environment');
      }

      adminApp = admin.default.initializeApp(adminConfig);
      
      console.log('[Firebase Admin] Firebase Admin initialized successfully');
      console.log('[Firebase Admin] Admin app options:', adminApp.options);
    } else {
      adminApp = admin.default.apps[0];
      console.log('[Firebase Admin] Using existing Firebase Admin app');
    }

    adminDb = admin.default.firestore();
    console.log('[Firebase Admin] Firestore instance created');
    
    return { app: adminApp, db: adminDb };
  } catch (error) {
    console.error('[Firebase Admin] Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

// Export adminApp for use in other modules
export { adminApp };

export async function deleteUserProfile(userId: string): Promise<void> {
  try {
    const { app, db } = await getFirebaseAdmin();
    const profileRef = db.collection('profiles').doc(userId);
    
    // First check if the document exists
    const doc = await profileRef.get();
    if (!doc.exists) {
      console.log(`[deleteUserProfile] Profile ${userId} does not exist, nothing to delete`);
      return;
    }
    
    // Log the profile data before deletion for debugging
    const profileData = doc.data();
    console.log(`[deleteUserProfile] Found profile for user ${userId}, deleting...`);
    console.log(`[deleteUserProfile] Profile data contains phone: ${!!profileData?.contactChannels?.phoneInfo?.internationalPhone}`);
    
    // Delete Firebase Storage files for this user
    try {
      const { getStorage } = await import('firebase-admin/storage');
      const bucket = getStorage(app).bucket();
      const userStoragePrefix = `users/${userId}/`;
      
      console.log(`[deleteUserProfile] Deleting storage files with prefix: ${userStoragePrefix}`);
      
      // List all files in the user's storage folder
      const [files] = await bucket.getFiles({ prefix: userStoragePrefix });
      
      if (files.length > 0) {
        console.log(`[deleteUserProfile] Found ${files.length} storage files to delete`);
        
        // Delete all files in parallel
        const deletePromises = files.map(async (file) => {
          try {
            await file.delete();
            console.log(`[deleteUserProfile] Deleted storage file: ${file.name}`);
          } catch (error) {
            console.warn(`[deleteUserProfile] Failed to delete storage file ${file.name}:`, error);
          }
        });
        
        await Promise.allSettled(deletePromises);
        console.log(`[deleteUserProfile] Completed storage cleanup for user ${userId}`);
      } else {
        console.log(`[deleteUserProfile] No storage files found for user ${userId}`);
      }
    } catch (storageError) {
      console.error(`[deleteUserProfile] Error cleaning up storage for user ${userId}:`, storageError);
      // Don't fail the entire deletion if storage cleanup fails
    }
    
    // Delete the profile document from Firestore
    await profileRef.delete();
    console.log(`[deleteUserProfile] Successfully deleted profile for user: ${userId}`);
    
    // Verify deletion by checking if document still exists
    const verifyDoc = await profileRef.get();
    if (verifyDoc.exists) {
      throw new Error(`Profile ${userId} still exists after deletion attempt`);
    } else {
      console.log(`[deleteUserProfile] Deletion verified - profile ${userId} no longer exists`);
    }
    
  } catch (error) {
    console.error(`[deleteUserProfile] Error deleting profile for user ${userId}:`, error);
    throw error; // Re-throw to be handled by the API route
  }
}
