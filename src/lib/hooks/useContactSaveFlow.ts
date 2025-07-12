/**
 * Simplified hook for managing contact save flow modal states and button text
 */

import { useState, useCallback } from 'react';
import { UserProfile } from '@/types/profile';
import { saveContactFlow, retryGoogleContactsPermission } from '@/lib/services/contactSaveService';

export interface ContactSaveState {
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
  showSuccessModal: boolean;
  showUpsellModal: boolean;
  platform: 'android' | 'ios' | 'web' | null;
}

/**
 * Check if contact is already saved (persisted state)
 */
const checkSavedContactState = (profileId: string, token: string): boolean => {
  try {
    const savedStateKey = `contact_saved_${profileId}_${token}`;
    const savedState = localStorage.getItem(savedStateKey);
    if (savedState) {
      const { timestamp } = JSON.parse(savedState);
      // Only consider saved if it's recent (within last 5 minutes)
      const timeDiff = Date.now() - timestamp;
      if (timeDiff < 300000) { // 5 minutes
        return true;
      } else {
        localStorage.removeItem(savedStateKey);
      }
    }
  } catch (error) {
    console.error('Error checking saved contact state:', error);
  }
  return false;
};

export const useContactSaveFlow = () => {
  const [state, setState] = useState<ContactSaveState>({
    isLoading: false,
    isSuccess: false,
    error: null,
    showSuccessModal: false,
    showUpsellModal: false,
    platform: null
  });

  const saveContact = useCallback(async (profile: UserProfile, token: string) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      console.log('🔄 Starting saveContactFlow for:', profile.name);
      const result = await saveContactFlow(profile, token);
      
      console.log('✅ saveContactFlow completed with result:', {
        success: result.success,
        showSuccessModal: result.showSuccessModal,
        showUpsellModal: result.showUpsellModal,
        platform: result.platform
      });
      
      setState({
        isLoading: false,
        isSuccess: result.success,
        error: result.success ? null : 'Failed to save contact',
        showSuccessModal: result.showSuccessModal || false,
        showUpsellModal: result.showUpsellModal || false,
        platform: result.platform
      });

    } catch (error) {
      console.error('❌ saveContactFlow failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      setState({
        isLoading: false,
        isSuccess: false,
        error: errorMessage,
        showSuccessModal: false,
        showUpsellModal: false,
        platform: null
      });
    }
  }, []);

  const retryPermission = useCallback(async (profile: UserProfile, token: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const result = await retryGoogleContactsPermission(profile, token);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        showUpsellModal: false,
        showSuccessModal: result.showSuccessModal || false
      }));
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        showUpsellModal: false
      }));
    }
  }, []);

  const dismissSuccessModal = useCallback(() => {
    setState(prev => ({ ...prev, showSuccessModal: false }));
  }, []);

  const dismissUpsellModal = useCallback(() => {
    setState(prev => ({ ...prev, showUpsellModal: false }));
  }, []);

  const resetState = useCallback(() => {
    setState({
      isLoading: false,
      isSuccess: false,
      error: null,
      showSuccessModal: false,
      showUpsellModal: false,
      platform: null
    });
  }, []);

  const restoreSuccessState = useCallback((profileId: string, token: string) => {
    const isSaved = checkSavedContactState(profileId, token);
    if (isSaved) {
      console.log('🔄 Restoring success state for saved contact');
      setState(prev => ({
        ...prev,
        isSuccess: true,
        error: null,
        // Don't set showSuccessModal here - let the fresh save flow handle it
      }));
    }
  }, []);

  const getButtonText = useCallback(() => {
    if (state.isLoading) {
      return 'Saving...';
    }
    
    if (state.isSuccess) {
      return "I'm Done";
    }
    
    return 'Save Contact';
  }, [state.isLoading, state.isSuccess]);

  const getSuccessMessage = useCallback(() => {
    if (!state.isSuccess) {
      return '';
    }
    
    // This will be handled by the SuccessModal component
    return 'Contact saved successfully!';
  }, [state.isSuccess]);

  return {
    ...state,
    saveContact,
    retryPermission,
    dismissSuccessModal,
    dismissUpsellModal,
    resetState,
    restoreSuccessState,
    getButtonText,
    getSuccessMessage
  };
};
