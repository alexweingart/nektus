// Firebase Admin SDK setup
import { initializeApp, getApps, cert, ServiceAccount, applicationDefault, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

interface AdminServices {
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
  storage: ReturnType<typeof getStorage>;
  adminApp: App;
}

let adminServices: AdminServices | null = null;
let lastInitTime: number = 0;
const REINIT_INTERVAL = 30 * 60 * 1000; // Reinitialize every 30 minutes to avoid token expiry

function validateEnvironmentVariables() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  // Check if we should use Application Default Credentials
  const useADC = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_USE_ADC === 'true';
  if (useADC) {
    return { projectId, useADC: true };
  }

  if (!projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID environment variable');
  }
  if (!privateKey) {
    throw new Error('Missing FIREBASE_PRIVATE_KEY environment variable');
  }
  if (!clientEmail) {
    throw new Error('Missing FIREBASE_CLIENT_EMAIL environment variable');
  }

  return { projectId, privateKey, clientEmail, useADC: false };
}

function formatPrivateKey(privateKey: string): string {
  // Handle different private key formats
  let formattedKey = privateKey;
  
  // Remove quotes if present
  if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
    formattedKey = formattedKey.slice(1, -1);
  }
  
  // Replace escaped newlines with actual newlines
  formattedKey = formattedKey.replace(/\\n/g, '\n');
  
  // Ensure proper BEGIN/END format
  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Invalid private key format - missing BEGIN header');
  }
  
  if (!formattedKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('Invalid private key format - missing END footer');
  }
  
  return formattedKey;
}

function createServiceAccountCredential() {
  const env = validateEnvironmentVariables();
  
  if (env.useADC) {
    return applicationDefault();
  }
  
  const { projectId, privateKey, clientEmail } = env as { projectId: string; privateKey: string; clientEmail: string; useADC: false };
  
  try {
    // Check if we have a service account JSON file
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
      return cert(serviceAccountPath);
    }
    
    const formattedPrivateKey = formatPrivateKey(privateKey);
    
    // Create the full service account object as Firebase expects it
    const serviceAccount = {
      type: "service_account",
      project_id: projectId,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "default",
      private_key: formattedPrivateKey,
      client_email: clientEmail,
      client_id: process.env.FIREBASE_CLIENT_ID || "default",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`,
      universe_domain: "googleapis.com"
    };
    
    return cert(serviceAccount as ServiceAccount);
  } catch (error) {
    console.error('[Firebase Admin] Failed to create service account credential:', error);
    throw new Error(`Service account credential creation failed: ${error}`);
  }
}

function shouldReinitialize(): boolean {
  const now = Date.now();
  const timeSinceLastInit = now - lastInitTime;
  
  // Force reinitialization if it's been more than 30 minutes
  return timeSinceLastInit > REINIT_INTERVAL;
}

function initializeFirebaseAdmin(forceNew: boolean = false): App {
  try {
    const existingApps = getApps();
    
    // If we have an existing app and we're not forcing new initialization
    if (existingApps.length > 0 && !forceNew && !shouldReinitialize()) {
      return existingApps[0];
    }
    
    // If we have an existing app but need to reinitialize
    if (existingApps.length > 0 && (forceNew || shouldReinitialize())) {
      // Clear the cached services to force re-creation
      adminServices = null;
      lastInitTime = Date.now();
      return existingApps[0];
    }

    const env = validateEnvironmentVariables();
    const credential = createServiceAccountCredential();
    
    // Get the storage bucket from environment or construct it
    const rawStorageBucket = process.env.FIREBASE_STORAGE_BUCKET || 
                            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 
                            `${env.projectId}.appspot.com`;
    
    // Clean the storage bucket name to ensure no whitespace or newlines
    const storageBucket = rawStorageBucket.replace(/[\n\r\t]/g, '').trim();
    
    const app = initializeApp({
      credential: credential,
      projectId: env.projectId,
      storageBucket: storageBucket,
      // Add service account ID if available
      serviceAccountId: env.useADC ? undefined : (env as { clientEmail?: string }).clientEmail,
    });

    lastInitTime = Date.now();
    
    return app;
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error);
    throw error;
  }
}

// Helper function to handle Firestore operations with retry logic
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error = new Error('No attempts made');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error as Error;
      
      // Check if it's an authentication error that might be resolved by retry
      const errorObj = error as { code?: number; message?: string };
      const isAuthError = errorObj?.code === 16 || // UNAUTHENTICATED
                         errorObj?.message?.includes('UNAUTHENTICATED') ||
                         errorObj?.message?.includes('ACCESS_TOKEN_EXPIRED') ||
                         errorObj?.message?.includes('invalid authentication credentials');
      
      if (isAuthError && attempt < maxRetries) {
        // Force re-initialization on auth errors
        if (attempt >= 2) {
          try {
            initializeFirebaseAdmin(true);
            adminServices = null; // Clear cached services
          } catch (reinitError) {
            console.error(`[${operationName}] Re-initialization failed:`, reinitError);
          }
        }
        
        // Wait with exponential backoff
        const waitTime = Math.min(Math.pow(2, attempt) * 1000, 10000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // If not an auth error or max retries reached, throw the error
      throw error;
    }
  }
  
  throw lastError;
}

export async function getFirebaseAdmin(): Promise<AdminServices> {
  // Check if we need to reinitialize due to time
  if (adminServices && shouldReinitialize()) {
    adminServices = null;
  }
  
  if (adminServices) {
    return adminServices;
  }

  try {
    const adminApp = initializeFirebaseAdmin();
    
    adminServices = {
      auth: getAuth(adminApp),
      db: getFirestore(adminApp),
      storage: getStorage(adminApp),
      adminApp,
    };

    return adminServices;
  } catch (error) {
    console.error('[Firebase Admin] Failed to get services:', error);
    throw error;
  }
}

// Export Firestore instance directly
export async function getFirestoreDB() {
  const { db } = await getFirebaseAdmin();
  return db;
}

export async function getProfile(userId: string): Promise<Record<string, unknown> | null> {
  return withRetry(
    async () => {
      const { db } = await getFirebaseAdmin();
      const profileRef = db.collection('profiles').doc(userId);
      const doc = await profileRef.get();
      
      if (!doc.exists) {
        return null;
      }
      
      return { id: doc.id, ...doc.data() };
    },
    `getProfile(${userId})`,
    3
  );
}

export async function deleteUserProfile(userId: string): Promise<void> {
  return withRetry(
    async () => {
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

        // Get the bucket name from environment or construct it
        const rawBucketName = process.env.FIREBASE_STORAGE_BUCKET || 
                             process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 
                             `${process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;
        
        // Clean the bucket name to ensure no whitespace or newlines
        const bucketName = rawBucketName.replace(/[\n\r\t]/g, '').trim();

        // List all files in the user's storage folder
        const [files] = await storage.bucket(bucketName).getFiles({ prefix: userStoragePrefix });

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
        }
      } catch (storageError) {
        console.error(`[deleteUserProfile] Error cleaning up storage for user ${userId}:`, storageError);
        // Don't fail the entire deletion if storage cleanup fails
      }

      // Delete contacts subcollection before deleting the main profile document
      try {
        const contactsRef = profileRef.collection('contacts');
        const contactsSnapshot = await contactsRef.get();
        
        if (!contactsSnapshot.empty) {
          // Use batched writes for efficient deletion of multiple contacts
          const batchSize = 500; // Firestore batch limit
          const contacts = contactsSnapshot.docs;
          
          for (let i = 0; i < contacts.length; i += batchSize) {
            const batch = db.batch();
            const batchContacts = contacts.slice(i, i + batchSize);
            
            batchContacts.forEach(contactDoc => {
              batch.delete(contactDoc.ref);
            });
            
            await batch.commit();
          }
        }
      } catch (contactsError) {
        console.error(`[deleteUserProfile] Error deleting contacts subcollection for user ${userId}:`, contactsError);
        // Don't fail the entire deletion if contacts cleanup fails
      }

      // Delete the profile document from Firestore
      await profileRef.delete();

      // Verify deletion by checking if document still exists
      const verifyDoc = await profileRef.get();
      if (verifyDoc.exists) {
        throw new Error(`[deleteUserProfile] Profile ${userId} still exists after deletion attempt`);
      }
    },
    `deleteUserProfile(${userId})`,
    3
  );
}

export async function uploadImageBuffer(
  imageBuffer: Buffer,
  userId: string,
  imageType: 'profile' | 'background'
): Promise<string> {
  return withRetry(
    async () => {
      const { storage } = await getFirebaseAdmin();
      
      // Get the bucket name from environment or construct it
      const rawBucketName = process.env.FIREBASE_STORAGE_BUCKET || 
                           process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 
                           `${process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;
      
      // Clean the bucket name to ensure no whitespace or newlines
      const bucketName = rawBucketName.replace(/[\n\r\t]/g, '').trim();
      
      const bucket = storage.bucket(bucketName);
      
      const rawFileName = `users/${userId}/${imageType}.jpg`;
      const fileName = rawFileName.replace(/[\n\r\t]/g, '').trim();
      const file = bucket.file(fileName);
      
      await file.save(imageBuffer, {
        metadata: {
          contentType: 'image/jpeg',
        },
      });
      
      // Make the file publicly readable
      await file.makePublic();
      
      // Return the public URL instead of signed URL
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      
      // Clean the URL to ensure no whitespace or newlines
      const cleanedPublicUrl = publicUrl.replace(/[\n\r\t]/g, '').trim();
      

      
      return cleanedPublicUrl;
    },
    `uploadImageBuffer(${userId}, ${imageType})`,
    3
  );
}

export async function createCustomTokenWithCorrectSub(uid: string): Promise<string> {
  return withRetry(
    async () => {
      const { auth } = await getFirebaseAdmin();
      
      // Add a small delay to ensure proper timing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Use the standard Firebase Admin SDK method
      const customToken = await auth.createCustomToken(uid, {
        // Add additional claims if needed
      });
      
      return customToken;
    },
    `createCustomToken(${uid})`,
    3
  );
}

// Legacy exports for backward compatibility
const adminConfigExport = {
  async auth() {
    const { auth } = await getFirebaseAdmin();
    return auth;
  },
  async firestore() {
    const { db } = await getFirebaseAdmin();
    return db;
  },
  async storage() {
    const { storage } = await getFirebaseAdmin();
    return storage;
  },
};

export default adminConfigExport;
