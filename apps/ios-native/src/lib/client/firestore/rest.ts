/**
 * Firestore REST API client for React Native
 *
 * Uses REST API with ID token auth to bypass SDK auth issues
 * with iOS bundle ID API key restrictions.
 */

import { getRestAuthTokens } from "../auth/firebase";

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`;

interface FirestoreDocument {
  name: string;
  fields: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

/**
 * Convert a JavaScript value to Firestore format
 */
function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "object") {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

/**
 * Convert a Firestore value to JavaScript
 */
function fromFirestoreValue(value: FirestoreValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return parseInt(value.integerValue, 10);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return new Date(value.timestampValue).getTime();
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ("mapValue" in value) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      result[k] = fromFirestoreValue(v);
    }
    return result;
  }
  return null;
}

/**
 * Convert Firestore document to plain object
 */
function documentToObject<T>(doc: FirestoreDocument): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc.fields || {})) {
    result[key] = fromFirestoreValue(value);
  }
  return result as T;
}

/**
 * Convert plain object to Firestore fields
 */
function objectToFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

/**
 * Get auth headers for Firestore requests
 */
function getAuthHeaders(): Record<string, string> {
  const tokens = getRestAuthTokens();
  if (!tokens?.idToken) {
    throw new Error("Not authenticated - no ID token available");
  }
  return {
    "Authorization": `Bearer ${tokens.idToken}`,
    "Content-Type": "application/json",
    "X-Ios-Bundle-Identifier": "com.nektus.app",
  };
}

/**
 * Get a document from Firestore
 */
export async function getDocument<T>(path: string): Promise<T | null> {
  const url = `${FIRESTORE_BASE_URL}/${path}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json();
    console.error("[firestore-rest] Get failed:", error);
    throw new Error(error.error?.message || `Get failed: ${response.status}`);
  }

  const doc = await response.json() as FirestoreDocument;
  return documentToObject<T>(doc);
}

/**
 * Set (create or overwrite) a document in Firestore
 */
export async function setDocument(
  path: string,
  data: object
): Promise<void> {
  const url = `${FIRESTORE_BASE_URL}/${path}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      fields: objectToFields(data as Record<string, unknown>),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("[firestore-rest] Set failed:", error);
    throw new Error(error.error?.message || `Set failed: ${response.status}`);
  }
}

/**
 * Get all documents in a collection
 */
export async function getCollection<T>(path: string): Promise<Array<T & { _id: string }>> {
  const url = `${FIRESTORE_BASE_URL}/${path}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("[firestore-rest] Collection get failed:", error);
    throw new Error(error.error?.message || `Collection get failed: ${response.status}`);
  }

  const result = await response.json();
  const documents = result.documents || [];

  return documents.map((doc: FirestoreDocument) => {
    // Extract document ID from the name
    const nameParts = doc.name.split("/");
    const docId = nameParts[nameParts.length - 1];

    return {
      ...documentToObject<T>(doc),
      _id: docId,
    };
  });
}
