/**
 * AddLinkModal - Modal for adding social or custom links
 * Part of Phase 5: Links
 */

'use client';

import React, { useState } from 'react';
import { StandardModal } from '../StandardModal';
import { Text } from '../Typography';
import { ToggleSetting } from '../ToggleSetting';
import { CustomSocialInputAdd } from '../inputs/CustomSocialInputAdd';
import CustomExpandingInput from '../inputs/CustomExpandingInput';
import type { ContactEntry, FieldSection } from '@/types/profile';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: 'personal' | 'work';
  onLinkAdded: (entries: ContactEntry[]) => void;
  nextOrder: number;
}

export const AddLinkModal: React.FC<AddLinkModalProps> = ({
  isOpen,
  onClose,
  section,
  onLinkAdded,
  nextOrder
}) => {
  // Social link state
  const [socialPlatform, setSocialPlatform] = useState('facebook');
  const [socialUsername, setSocialUsername] = useState('');

  // Custom link state
  const [customLinkUrl, setCustomLinkUrl] = useState('');

  // Duplicate to other section
  const [duplicateToOther, setDuplicateToOther] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const otherSection = section === 'personal' ? 'work' : 'personal';

  // Utility function to extract domain for fieldType
  const extractDomainForFieldType = (url: string): string => {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;

      // Remove 'www.' prefix
      domain = domain.replace(/^www\./, '');

      // Extract main domain (e.g., "username.medium.com" → "medium")
      const parts = domain.split('.');
      if (parts.length > 2) {
        // For subdomains, use the second-to-last part
        return parts[parts.length - 2];
      }

      // For regular domains, use first part
      return parts[0];
    } catch (error) {
      return 'link'; // Fallback for invalid URLs
    }
  };

  const resetForm = () => {
    setSocialPlatform('facebook');
    setSocialUsername('');
    setCustomLinkUrl('');
    setDuplicateToOther(false);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isValid = socialUsername.trim() || customLinkUrl.trim();

  const handleSave = async () => {
    if (!isValid) {
      setError('Please enter either a social username or a custom link');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const entries: ContactEntry[] = [];
      let baseEntry: Omit<ContactEntry, 'section'>;

      // Determine if it's social or custom link
      if (socialUsername.trim()) {
        // Social link
        baseEntry = {
          fieldType: socialPlatform,
          value: socialUsername.trim(),
          order: nextOrder,
          isVisible: true,
          confirmed: true,
          linkType: 'default',
          icon: `/icons/default/${socialPlatform}.svg`
        };
      } else {
        // Custom link
        const url = customLinkUrl.trim();
        const fieldType = extractDomainForFieldType(url);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;

        baseEntry = {
          fieldType,
          value: url,
          order: nextOrder,
          isVisible: true,
          confirmed: true,
          linkType: 'custom',
          icon: faviconUrl
        };
      }

      // Add entry for current section
      entries.push({
        ...baseEntry,
        section: section as FieldSection
      });

      // Add entry for other section if duplicate is enabled
      if (duplicateToOther) {
        entries.push({
          ...baseEntry,
          section: otherSection as FieldSection
        });
      }

      onLinkAdded(entries);
      handleClose();
    } catch (error) {
      console.error('[AddLinkModal] Save error:', error);
      setError('Failed to save link. Please check the URL and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Link"
      subtitle="Add a social link or custom URL to your profile"
      showPrimaryButton={true}
      primaryButtonText={isSaving ? 'Saving...' : 'Save'}
      onPrimaryButtonClick={handleSave}
      primaryButtonDisabled={isSaving || !isValid}
      showSecondaryButton={true}
      secondaryButtonText="Cancel"
      showCloseButton={false}
    >
      <div className="space-y-4">
            {/* Social Link */}
            <div className="border border-red-500">
              <CustomSocialInputAdd
                platform={socialPlatform}
                username={socialUsername}
                onPlatformChange={setSocialPlatform}
                onUsernameChange={setSocialUsername}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 border border-blue-500">
              <div className="flex-1 h-px bg-white/20" />
              <Text variant="small" className="text-white/60">
                or
              </Text>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            {/* Custom Link */}
            <div className="border border-green-500">
              <CustomExpandingInput
                value={customLinkUrl}
                onChange={(e) => setCustomLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            {/* Error Message */}
            {error && (
              <Text variant="small" className="text-red-400">
                {error}
              </Text>
            )}

            {/* Duplicate to Other Profile Toggle */}
            <div className="border border-yellow-500">
              <ToggleSetting
                label={`Add to ${otherSection} too`}
                enabled={duplicateToOther}
                onChange={setDuplicateToOther}
              />
            </div>
          </div>
    </StandardModal>
  );
};
