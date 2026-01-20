/**
 * InlineAddLink for iOS
 * Adapted from: apps/web/src/app/components/ui/modules/InlineAddLink.tsx
 *
 * Changes from web:
 * - Uses React Native components
 * - Uses iOS input components (CustomSocialInputAdd, ExpandingInput)
 */

import React, { useState, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
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
  /** Tint color for the selector (from profile.backgroundColors[2]) */
  tintColor?: string;
}

export const InlineAddLink = forwardRef<InlineAddLinkRef, InlineAddLinkProps>(function InlineAddLink({
  section,
  onLinkAdded,
  nextOrder,
  onCancel,
  showDuplicateToggle = true,
  tintColor,
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

  // Track if an internal interaction is in progress (dropdown open, toggle tapped, etc.)
  // This prevents blur from triggering cancel when user is interacting with controls
  const internalInteractionRef = useRef(false);

  const otherSection = section === 'personal' ? 'work' : 'personal';

  // Mark as internal interaction - prevents blur from triggering save/cancel
  const markInternalInteraction = useCallback(() => {
    internalInteractionRef.current = true;
    // Reset after a delay longer than the blur handler's delay
    setTimeout(() => {
      internalInteractionRef.current = false;
    }, 500);
  }, []);

  // Handle mode switch - mark as internal interaction to prevent blur-cancel
  const handleModeChange = useCallback((newType: LinkType) => {
    if (newType === linkType) return;
    markInternalInteraction();
    setLinkType(newType);
  }, [linkType, markInternalInteraction]);

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

  // Internal save logic - builds entries without calling onLinkAdded
  const buildEntries = useCallback((): ContactEntry[] | null => {
    if (!isValid) {
      return null;
    }

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

      return entries;
    } catch (err) {
      console.error('[InlineAddLink] Build entries error:', err);
      setError('Failed to save link. Please check the URL and try again.');
      return null;
    }
  }, [isValid, linkType, socialPlatform, socialUsername, customLinkUrl, nextOrder, section, duplicateToOther, otherSection]);

  // Handle submit (Enter key) - save the link
  const handleSubmit = useCallback(() => {
    if (!isValid) return;

    setError('');
    Keyboard.dismiss();

    const entries = buildEntries();
    if (entries) {
      onLinkAdded(entries);
    }
  }, [isValid, buildEntries, onLinkAdded]);

  // Handle blur - save if valid, cancel if empty
  // Check internalInteractionRef to avoid triggering when tapping internal controls
  const handleBlur = useCallback(() => {
    // Delay to allow for tapping internal elements (dropdown, toggle, etc.)
    setTimeout(() => {
      // If an internal interaction is in progress, don't do anything
      if (internalInteractionRef.current) {
        return;
      }

      // Check if current input has value
      const currentValue = linkType === 'Social' ? socialUsername.trim() : customLinkUrl.trim();

      if (currentValue) {
        // Has value - auto-save
        setError('');
        const entries = buildEntries();
        if (entries) {
          onLinkAdded(entries);
        }
      } else {
        // Empty - cancel
        onCancel();
      }
    }, 300);
  }, [socialUsername, customLinkUrl, linkType, buildEntries, onLinkAdded, onCancel]);

  // Save method exposed via ref
  const handleSave = useCallback((): ContactEntry[] | null => {
    if (!isValid) {
      return null;
    }

    setError('');
    Keyboard.dismiss();

    const entries = buildEntries();
    if (entries) {
      onLinkAdded(entries);
    }
    return entries;
  }, [isValid, buildEntries, onLinkAdded]);

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
          tintColor={tintColor}
        />

        {/* Conditionally render input based on mode (matches web) */}
        {linkType === 'Social' ? (
          <CustomSocialInputAdd
            platform={socialPlatform}
            username={socialUsername}
            onPlatformChange={setSocialPlatform}
            onUsernameChange={setSocialUsername}
            onSubmit={handleSubmit}
            onBlur={handleBlur}
            onDropdownOpen={markInternalInteraction}
            autoFocus
          />
        ) : (
          <ExpandingInput
            value={customLinkUrl}
            onChange={setCustomLinkUrl}
            placeholder="https://example.com"
            onSubmit={handleSubmit}
            onInputBlur={handleBlur}
            singleLine
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
              onChange={(value) => {
                markInternalInteraction();
                setDuplicateToOther(value);
              }}
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // bg-black/30 so input backgrounds (bg-black/40) are visible
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
