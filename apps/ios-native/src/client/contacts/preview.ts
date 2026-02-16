/**
 * Preview API client for iOS
 * Fetches limited profile data for unauthenticated users
 */

import type { UserProfile } from '@nektus/shared-types';
import { getApiBaseUrl } from '../auth/firebase';

export interface PreviewResult {
  success: boolean;
  profile?: UserProfile;
  socialIconTypes?: string[];
  error?: string;
}

/**
 * Fetch profile preview for unauthenticated users
 * Returns limited data: name, bio, profile image, social icon types (no values)
 */
export async function fetchProfilePreview(token: string): Promise<PreviewResult> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/exchange/preview/${token}`);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || `Failed to fetch preview: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.profile) {
      return {
        success: true,
        profile: result.profile,
        socialIconTypes: result.socialIconTypes || [],
      };
    }

    return {
      success: false,
      error: 'Invalid preview response',
    };
  } catch (error) {
    console.error('[preview] Failed to fetch profile preview:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
