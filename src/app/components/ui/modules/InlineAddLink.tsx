/**
 * InlineAddLink - Inline component for adding social or custom links
 * Part of Phase 5: Links
 */

'use client';

import React, { useState } from 'react';
import { Text } from '../Typography';
import { ToggleSetting } from '../controls/ToggleSetting';
import { DualStateSelector } from '../controls/DualStateSelector';
import { CustomSocialInputAdd } from '../inputs/CustomSocialInputAdd';
import { ExpandingInput } from '../inputs/ExpandingInput';
import type { ContactEntry, FieldSection } from '@/types/profile';

type LinkType = 'Social' | 'Custom';

interface InlineAddLinkProps {
  section: 'personal' | 'work';
  onLinkAdded: (entries: ContactEntry[]) => void;
  nextOrder: number;
  onCancel: () => void;
}

export const InlineAddLink: React.FC<InlineAddLinkProps> = ({
  section,
  onLinkAdded,
  nextOrder,
  onCancel
}) => {
  // Link type toggle
  const [linkType, setLinkType] = useState<LinkType>('Social');

  // Social link state
  const [socialPlatform, setSocialPlatform] = useState('facebook');
  const [socialUsername, setSocialUsername] = useState('');

  // Custom link state
  const [customLinkUrl, setCustomLinkUrl] = useState('');

  // Duplicate to other section
  const [duplicateToOther, setDuplicateToOther] = useState(false);

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
    } catch {
      return 'link'; // Fallback for invalid URLs
    }
  };

  const isValid = linkType === 'Social' ? socialUsername.trim() : customLinkUrl.trim();

  const handleSave = () => {
    console.log('[InlineAddLink] Save clicked', { linkType, socialUsername, customLinkUrl, isValid });

    if (!isValid) {
      setError('Please enter a link');
      return;
    }

    setError('');

    try {
      const entries: ContactEntry[] = [];
      let baseEntry: Omit<ContactEntry, 'section'>;

      if (linkType === 'Social') {
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

      console.log('[InlineAddLink] Calling onLinkAdded with entries:', entries);
      onLinkAdded(entries);
      console.log('[InlineAddLink] onLinkAdded completed');
    } catch (error: unknown) {
      console.error('[InlineAddLink] Save error:', error);
      setError('Failed to save link. Please check the URL and try again.');
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if focus is leaving the entire component
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (isValid) {
        handleSave();
      } else {
        onCancel();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      className="w-full max-w-md mx-auto bg-black/60 backdrop-blur-lg rounded-2xl p-6 space-y-4 relative z-50"
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      tabIndex={-1}
    >
      {/* Toggle: Social | Custom */}
      <div className="flex justify-center">
        <DualStateSelector
          options={['Social', 'Custom']}
          selectedOption={linkType}
          onOptionChange={setLinkType}
          minWidth="100px"
        />
      </div>

      {/* Input field based on link type */}
      {linkType === 'Social' ? (
        <CustomSocialInputAdd
          platform={socialPlatform}
          username={socialUsername}
          onPlatformChange={setSocialPlatform}
          onUsernameChange={setSocialUsername}
          autoFocus
        />
      ) : (
        <ExpandingInput
          value={customLinkUrl}
          onChange={(value: string) => setCustomLinkUrl(value)}
          placeholder="https://example.com"
        />
      )}

      {/* Error Message */}
      {error && (
        <Text variant="small" className="text-red-400 text-center">
          {error}
        </Text>
      )}

      {/* Duplicate to Other Profile Toggle */}
      <ToggleSetting
        label={`Add to ${otherSection} too`}
        enabled={duplicateToOther}
        onChange={setDuplicateToOther}
      />
    </div>
  );
};
