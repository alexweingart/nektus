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
  showDuplicateToggle?: boolean;
}

export const InlineAddLink: React.FC<InlineAddLinkProps> = ({
  section,
  onLinkAdded,
  nextOrder,
  onCancel,
  showDuplicateToggle = true
}) => {
  // Link type toggle
  const [linkType, setLinkType] = useState<LinkType>('Social');

  // Social link state
  const [socialPlatform, setSocialPlatform] = useState('instagram');
  const [socialUsername, setSocialUsername] = useState('');

  // Custom link state
  const [customLinkUrl, setCustomLinkUrl] = useState('');

  // Duplicate to other section
  const [duplicateToOther, setDuplicateToOther] = useState(true);

  const [error, setError] = useState('');

  const otherSection = section === 'personal' ? 'work' : 'personal';

  const stripProtocol = (url: string) => url.replace(/^https?:\/\//i, '');

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
        let url = customLinkUrl.trim();
        if (url && !/^https?:\/\//i.test(url)) {
          url = `https://${url}`;
        }
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
    const relatedTarget = e.relatedTarget as Node;

    // If clicking within the component (like toggle buttons), don't trigger blur
    if (e.currentTarget.contains(relatedTarget)) {
      return;
    }

    // Focus has left the component
    if (isValid) {
      handleSave();
    } else {
      onCancel();
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
      {/* Toggle: Social | Custom with X and ✓ buttons */}
      <div className="flex items-center justify-between">
        {/* Cancel button */}
        <button
          type="button"
          onClick={onCancel}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Cancel"
        >
          <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <DualStateSelector
          options={['Social', 'Custom']}
          selectedOption={linkType}
          onOptionChange={setLinkType}
          minWidth="100px"
        />

        {/* Confirm button */}
        <button
          type="button"
          onClick={handleSave}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Confirm"
        >
          <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>

      {/* Input field based on link type */}
      {linkType === 'Social' ? (
        <CustomSocialInputAdd
          key="social-input"
          platform={socialPlatform}
          username={socialUsername}
          onPlatformChange={setSocialPlatform}
          onUsernameChange={setSocialUsername}
          autoFocus
        />
      ) : (
        <ExpandingInput
          key="custom-input"
          value={customLinkUrl}
          onChange={(value: string) => setCustomLinkUrl(stripProtocol(value))}
          placeholder="example.com/username"
          autoCapitalize="none"
          autoFocus
        />
      )}

      {/* Error Message */}
      {error && (
        <Text variant="small" className="text-red-400 text-center">
          {error}
        </Text>
      )}

      {/* Duplicate to Other Profile Toggle - only show if prop is true */}
      {showDuplicateToggle && (
        <ToggleSetting
          label={`Add to ${otherSection} too`}
          enabled={duplicateToOther}
          onChange={setDuplicateToOther}
        />
      )}
    </div>
  );
};
