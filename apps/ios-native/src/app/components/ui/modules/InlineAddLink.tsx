/**
 * InlineAddLink for iOS
 * Adapted from: apps/web/src/app/components/ui/modules/InlineAddLink.tsx
 *
 * Changes from web:
 * - Uses React Native components
 * - Uses iOS input components
 * - Replaced DOM events with React Native patterns
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { DualStateSelector } from '../controls/DualStateSelector';
import { ToggleSetting } from '../controls/ToggleSetting';
import { CustomSocialInputAdd } from '../inputs/CustomSocialInputAdd';
import { ExpandingInput } from '../inputs/ExpandingInput';
import type { ContactEntry, FieldSection } from '@nektus/shared-types';

type LinkType = 'Social' | 'Custom';

interface InlineAddLinkProps {
  section: 'personal' | 'work';
  onLinkAdded: (entries: ContactEntry[]) => void;
  nextOrder: number;
  onCancel: () => void;
  showDuplicateToggle?: boolean;
}

export function InlineAddLink({
  section,
  onLinkAdded,
  nextOrder,
  onCancel,
  showDuplicateToggle = true,
}: InlineAddLinkProps) {
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

  const handleSave = () => {
    if (!isValid) {
      setError('Please enter a link');
      return;
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
    } catch (err) {
      console.error('[InlineAddLink] Save error:', err);
      setError('Failed to save link. Please check the URL and try again.');
    }
  };

  return (
    <View style={styles.container}>
      <BlurView
        style={StyleSheet.absoluteFillObject}
        tint="dark"
        intensity={50}
      />

      <View style={styles.content}>
        {/* Toggle: Social | Custom */}
        <View style={styles.selectorContainer}>
          <DualStateSelector
            options={['Social', 'Custom']}
            selectedOption={linkType}
            onOptionChange={setLinkType}
          />
        </View>

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
            onChange={setCustomLinkUrl}
            placeholder="https://example.com"
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  content: {
    padding: 24,
    gap: 16,
  },
  selectorContainer: {
    alignItems: 'center',
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
