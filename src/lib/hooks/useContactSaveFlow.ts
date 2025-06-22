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
      const result = await saveContactFlow(profile, token);
      
      setState({
        isLoading: false,
        isSuccess: result.success,
        error: result.success ? null : 'Failed to save contact',
        showSuccessModal: result.showSuccessModal || false,
        showUpsellModal: result.showUpsellModal || false,
        platform: result.platform
      });

    } catch (error) {
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
    getButtonText,
    getSuccessMessage
  };
};
