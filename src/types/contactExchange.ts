import { UserProfile } from './profile';

export interface ContactExchangeRequest {
  ts: number;        // client timestamp in ms (synchronized with server)
  rtt?: number;      // round trip time from NTP sync
  mag: number;       // acceleration magnitude 
  vector?: string;   // SHA-256 hash of acceleration vector
  session: string;   // WebSocket session ID
  tSent?: number;    // Performance timing when request was sent (for diagnostics)
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
  | 'accepted'
  | 'rejected'
  | 'timeout'
  | 'error';

export interface ContactExchangeState {
  status: ExchangeStatus;
  sessionId?: string;
  match?: ContactExchangeMatch & { profile: UserProfile };
  error?: string;
}
