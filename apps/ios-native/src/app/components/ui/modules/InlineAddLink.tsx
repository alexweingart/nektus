/**
 * InlineAddLink for iOS
 * Adapted from: apps/web/src/app/components/ui/modules/InlineAddLink.tsx
 *
 * Changes from web:
 * - Uses React Native components
 * - Uses iOS input components (CustomSocialInputAdd, ExpandingInput)
 */

import React, { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, Text, StyleSheet, Keyboard, ScrollView } from 'react-native';
import { DualStateSelector } from '../controls/DualStateSelector';
import { ToggleSetting } from '../controls/ToggleSetting';
import { CustomSocialInputAdd } from '../inputs/CustomSocialInputAdd';
import { ExpandingInput } from '../inputs/ExpandingInput';
import type { ContactEntry, FieldSection } from '@nektus/shared-types';

type LinkType = 'Social' | 'Custom';

export interface InlineAddLinkRef {
  /** Save current input if valid, returns the entries if saved or null if nothing to save */
  save: () => ContactEntry[] | null;
}

interface InlineAddLinkProps {
  section: 'personal' | 'work';
  onLinkAdded: (entries: ContactEntry[]) => void;
  nextOrder: number;
  onCancel: () => void;
  showDuplicateToggle?: boolean;
}

export const InlineAddLink = forwardRef<InlineAddLinkRef, InlineAddLinkProps>(function InlineAddLink({
  section,
  onLinkAdded,
  nextOrder,
  onCancel,
  showDuplicateToggle = true,
}, ref) {
  // Link type toggle
  const [linkType, setLinkType] = useState<LinkType>('Social');

  // Social link state
  const [socialPlatform, setSocialPlatform] = useState('instagram');
  const [socialUsername, setSocialUsername] = useState('');

  // Custom link state
  const [customLinkUrl, setCustomLinkUrl] = useState('');

  // Duplicate to other section
  const [duplicateToOther, setDuplicateToOther] = useState(false);

  const [error, setError] = useState('');

  const otherSection = section === 'personal' ? 'work' : 'personal';

  // Handle mode switch
  const handleModeChange = useCallback((newType: LinkType) => {
    if (newType === linkType) return;
    setLinkType(newType);
  }, [linkType]);

  // Utility function to extract domain for fieldType
  const extractDomainForFieldType = (url: string): string => {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;

      // Remove 'www.' prefix
      domain = domain.replace(/^www\./, '');

      // Extract main domain
      const parts = domain.split('.');
      if (parts.length > 2) {
        return parts[parts.length - 2];
      }

      return parts[0];
    } catch {
      return 'link';
    }
  };

  const isValid = linkType === 'Social' ? socialUsername.trim() : customLinkUrl.trim();

  // Save current input, returns entries if saved or null if nothing to save
  const handleSave = useCallback((): ContactEntry[] | null => {
    if (!isValid) {
      return null; // Nothing to save
    }

    setError('');
    Keyboard.dismiss();

    try {
      const entries: ContactEntry[] = [];
      let baseEntry: Omit<ContactEntry, 'section'>;

      if (linkType === 'Social') {
        baseEntry = {
          fieldType: socialPlatform,
          value: socialUsername.trim(),
          order: nextOrder,
          isVisible: true,
          confirmed: true,
          linkType: 'default',
          icon: `/icons/default/${socialPlatform}.svg`,
        };
      } else {
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
          icon: faviconUrl,
        };
      }

      // Add entry for current section
      entries.push({
        ...baseEntry,
        section: section as FieldSection,
      });

      // Add entry for other section if duplicate is enabled
      if (duplicateToOther) {
        entries.push({
          ...baseEntry,
          section: otherSection as FieldSection,
        });
      }

      onLinkAdded(entries);
      return entries;
    } catch (err) {
      console.error('[InlineAddLink] Save error:', err);
      setError('Failed to save link. Please check the URL and try again.');
      return null;
    }
  }, [isValid, linkType, socialPlatform, socialUsername, customLinkUrl, nextOrder, section, duplicateToOther, otherSection, onLinkAdded]);

  // Expose save method to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
  }), [handleSave]);

  return (
    <View style={styles.container}>
      {/* bg-black/60 to match web */}
      <View style={styles.containerOverlay} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        scrollEnabled={false}
      >
        {/* Toggle: Social | Custom - centered, not full width like web */}
        <DualStateSelector
          options={['Social', 'Custom']}
          selectedOption={linkType}
          onOptionChange={handleModeChange}
          minWidth={100}
        />

        {/* Conditionally render input based on mode (matches web) */}
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
            onChange={setCustomLinkUrl}
            placeholder="https://example.com"
            autoFocus
          />
        )}

        {/* Error Message */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Duplicate to Other Profile Toggle */}
        {showDuplicateToggle && (
          <View style={styles.toggleContainer}>
            <ToggleSetting
              label={`Add to ${otherSection} too`}
              enabled={duplicateToOther}
              onChange={setDuplicateToOther}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 50,
  },
  containerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // bg-black/60 to match web
  },
  scrollView: {
    flexGrow: 0,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  error: {
    fontSize: 14,
    color: '#F87171',
    textAlign: 'center',
  },
  toggleContainer: {
    marginTop: 8,
  },
});

export default InlineAddLink;
