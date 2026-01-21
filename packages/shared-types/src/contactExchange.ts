import { UserProfile } from './profile';

export interface ContactExchangeRequest {
  ts?: number;       // client timestamp in ms (optional, for logging only)
  mag: number;       // acceleration magnitude
  vector?: string;   // SHA-256 hash of acceleration vector
  session: string;   // Session ID
  tSent?: number;    // Performance timing when request was sent (for diagnostics)
  sharingCategory?: 'All' | 'Personal' | 'Work'; // Selected sharing category
  hitNumber?: number; // Sequential hit number during matching window
}

export interface ContactExchangeMatch {
  token: string;
  youAre: 'A' | 'B';
  profile?: UserProfile;
}

export interface ContactExchangeAccept {
  token: string;
  accept: boolean;
}

export interface ContactExchangeResult {
  profile: UserProfile;
  matchedAt: number;
}

export interface ContactExchangeResponse {
  success: boolean;
  token?: string;
  message?: string;
  profile?: UserProfile;
  matched?: boolean;
  youAre?: 'A' | 'B';
  matchedWith?: string;
}

export interface SavedContact extends UserProfile {
  addedAt: number;
  matchToken: string;
  contactType: 'personal' | 'work';  // Type of contact relationship (personal or work)
}

// WebSocket message types
export type ContactExchangeMessage = 
  | { type: 'connected'; sessionId: string; timestamp: number }
  | { type: 'match'; token: string; youAre: 'A' | 'B' }
  | { type: 'accept'; profile: UserProfile }
  | { type: 'reject' }
  | { type: 'timeout' }
  | { type: 'error'; message: string };

// Motion detection types
export interface MotionDetectionResult {
  hasMotion: boolean;
  acceleration?: {
    x: number;
    y: number; 
    z: number;
  };
  magnitude: number;
  timestamp?: number; // Timestamp when motion was detected
}

// Exchange flow state management
export type ExchangeStatus =
  | 'idle'
  | 'requesting-permission'
  | 'waiting-for-bump'
  | 'processing'
  | 'matched'
  | 'qr-scan-pending'   // QR scanned, User B signing in
  | 'qr-scan-matched'   // QR scan completed, ready to view
  | 'accepted'
  | 'rejected'
  | 'timeout'
  | 'error'
  // BLE-specific status values
  | 'ble-scanning'      // Scanning for nearby BLE devices
  | 'ble-discovered'    // Found a peer device
  | 'ble-connecting'    // Establishing GATT connection
  | 'ble-exchanging'    // Exchanging profile data via GATT
  | 'ble-matched'       // BLE exchange completed successfully
  | 'ble-unavailable';  // BLE not available (permission denied, hardware unavailable)

// BLE advertisement data (fits in ~29 bytes for BLE advertising)
export interface BLEAdvertisementData {
  userId: string;              // First 8 chars of userId
  sharingCategory: 'P' | 'W';  // 1 char: Personal or Work
  buttonPressTimestamp: number; // Seconds since midnight UTC (for role determination)
}

// BLE profile payload for GATT exchange
export interface BLEProfilePayload {
  userId: string;
  profileImage: string;        // URL only (not embedded image)
  backgroundColors?: string[];
  contactEntries: import('./profile').ContactEntry[]; // Filtered by sharing category
}

// BLE exchange state for tracking progress
export type BLEExchangeState =
  | 'idle'
  | 'starting'
  | 'advertising'
  | 'scanning'
  | 'discovered'
  | 'connecting'
  | 'exchanging'
  | 'completed'
  | 'failed';

// BLE match result (extends server match format)
export interface BLEMatchResult {
  token: string;       // "ble-{timestamp}-{randomId}"
  youAre: 'A' | 'B';   // A = initiator (earlier timestamp), B = responder
  profile: UserProfile;
  matchType: 'ble';
}

export interface ContactExchangeState {
  status: ExchangeStatus;
  sessionId?: string;
  match?: ContactExchangeMatch & { profile: UserProfile };
  qrToken?: string;  // Token from QR scan match
  error?: string;
}

// Contact saving results
export interface ContactSaveResult {
  success: boolean;
  firebase: {
    success: boolean;
    error?: string;
  };
  google: {
    success: boolean;
    error?: string;
    contactId?: string;
  };
  contact?: UserProfile;
}

export interface GoogleContactsResult {
  success: boolean;
  contactId?: string;
  error?: string;
}
