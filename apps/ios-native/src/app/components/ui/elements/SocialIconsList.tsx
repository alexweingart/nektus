import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import SocialIcon from '../elements/SocialIcon';
import type { ContactEntry } from '../../../../app/context/ProfileContext';

type FieldSection = 'universal' | 'personal' | 'work';

interface SocialIconsListProps {
  contactEntries: ContactEntry[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'white';
  showAddButton?: boolean;
  onAddPress?: () => void;
}

// Define the platforms and their default sections and orders
const PLATFORM_CONFIG = {
  // Universal section
  phone: { section: 'universal', defaultOrder: 0 },
  email: { section: 'universal', defaultOrder: 1 },

  // Personal section
  facebook: { section: 'personal', defaultOrder: 2 },
  instagram: { section: 'personal', defaultOrder: 3 },
  x: { section: 'personal', defaultOrder: 4 },
  snapchat: { section: 'personal', defaultOrder: 5 },
  whatsapp: { section: 'personal', defaultOrder: 6 },
  telegram: { section: 'personal', defaultOrder: 7 },
  wechat: { section: 'personal', defaultOrder: 8 },

  // Work section
  linkedin: { section: 'work', defaultOrder: 9 },
} as const;

// Define platform types
type PlatformType = keyof typeof PLATFORM_CONFIG | 'text';

interface SocialItem {
  platform: PlatformType;
  username: string;
  url: string;
  section: FieldSection;
  order: number;
  customIcon?: string;  // For custom links with favicons
  linkType?: 'default' | 'custom';
}

export const SocialIconsList: React.FC<SocialIconsListProps> = ({
  contactEntries,
  size = 'md',
  variant = 'default',
  showAddButton = false,
  onAddPress,
}) => {
  // Helper function to get URL for platform
  const getUrlForPlatform = (platform: PlatformType, username: string): string => {
    switch (platform) {
      case 'phone':
        return `sms:${username}`;
      case 'email':
        return `mailto:${username}`;
      case 'facebook':
        return `https://facebook.com/${username}`;
      case 'instagram':
        return `https://instagram.com/${username}`;
      case 'x':
        return `https://x.com/${username}`;
      case 'linkedin':
        return `https://www.linkedin.com/in/${username}`;
      case 'snapchat':
        return `https://www.snapchat.com/add/${username}`;
      case 'whatsapp':
        return `https://wa.me/${username}`;
      case 'telegram':
        return `https://t.me/${username}`;
      case 'wechat':
        return `weixin://dl/chat?${username}`;
      default:
        return '';
    }
  };

  // Transform contact entries into social items
  const socialItems: SocialItem[] = [];

  if (contactEntries?.length) {
    contactEntries.forEach((entry, index) => {
      // Skip name and bio - these are not social icons
      if (entry.fieldType === 'name' || entry.fieldType === 'bio') {
        return;
      }

      // Only include if has content and is visible
      const hasContent = entry.fieldType === 'phone' ? !!entry.value :
                         entry.fieldType === 'email' ? !!entry.value :
                         !!entry.value?.trim();

      const isVisible = entry.isVisible !== false;

      if (hasContent && isVisible) {
        const username = entry.value;
        const config = PLATFORM_CONFIG[entry.fieldType as keyof typeof PLATFORM_CONFIG];
        const baseOrder = entry.order ?? config?.defaultOrder ?? index;

        // Phone produces two icons: phone (dialer) + text (sms)
        if (entry.fieldType === 'phone') {
          socialItems.push({
            platform: 'phone' as PlatformType,
            username,
            url: `tel:${entry.value}`,
            section: entry.section as FieldSection,
            order: baseOrder,
            linkType: entry.linkType
          });
          socialItems.push({
            platform: 'text' as PlatformType,
            username,
            url: `sms:${entry.value}`,
            section: entry.section as FieldSection,
            order: baseOrder + 0.1,
            linkType: entry.linkType
          });
        } else {
          // For custom links, the value IS the URL
          const url = entry.linkType === 'custom' ? entry.value :
                      entry.fieldType === 'email' ? `mailto:${entry.value}` :
                      getUrlForPlatform(entry.fieldType as PlatformType, entry.value);

          socialItems.push({
            platform: entry.fieldType as PlatformType,
            username,
            url,
            section: entry.section as FieldSection,
            order: baseOrder,
            customIcon: entry.icon,
            linkType: entry.linkType
          });
        }
      }
    });
  }

  // Sort items by section order, then by order within section
  const sectionOrder: Record<FieldSection, number> = {
    universal: 0,
    personal: 1,
    work: 2
  };

  socialItems.sort((a, b) => {
    const sectionDiff = sectionOrder[a.section] - sectionOrder[b.section];
    if (sectionDiff !== 0) return sectionDiff;

    return a.order - b.order;
  });

  if (socialItems.length === 0) {
    return null;
  }

  const handlePress = async (item: SocialItem) => {
    console.log(`[SocialIconsList] Attempting to open:`, {
      platform: item.platform,
      url: item.url,
      username: item.username
    });

    // For standard schemes (tel, mailto, http, https), skip canOpenURL check
    // and don't show error alerts - the app opens fine but Linking.openURL
    // can reject when returning from the opened app (e.g. Instagram Universal Links)
    const isStandardScheme = item.url.startsWith('tel:') ||
                             item.url.startsWith('mailto:') ||
                             item.url.startsWith('http:') ||
                             item.url.startsWith('https:') ||
                             item.url.startsWith('sms:');

    if (isStandardScheme) {
      console.log(`[SocialIconsList] Opening standard scheme directly:`, item.url);
      Linking.openURL(item.url).catch((error) => {
        // Don't show alert for standard URLs - the target app likely opened
        // successfully via Universal Links, and the promise rejection happens
        // when the user returns to this app
        console.warn(`[SocialIconsList] openURL resolved with error for ${item.platform}:`, error);
      });
    } else {
      try {
        const canOpen = await Linking.canOpenURL(item.url);
        console.log(`[SocialIconsList] canOpenURL result:`, canOpen);
        if (canOpen) {
          await Linking.openURL(item.url);
        } else {
          console.error(`[SocialIconsList] Cannot open URL:`, item.url);
          Alert.alert('Error', `Cannot open ${item.platform}`);
        }
      } catch (error) {
        console.error(`[SocialIconsList] Failed to open ${item.platform}:`, error);
        Alert.alert('Error', `Failed to open ${item.platform}`);
      }
    }
  };

  return (
    <View style={styles.container}>
      {socialItems.map((item, index) => (
        <TouchableOpacity
          key={`${item.platform}-${item.section}-${index}`}
          onPress={() => handlePress(item)}
          activeOpacity={0.7}
        >
          <SocialIcon
            platform={item.platform}
            username={item.username}
            size={size}
            variant={variant}
            customIcon={item.customIcon}
            linkType={item.linkType}
          />
        </TouchableOpacity>
      ))}
      {showAddButton && onAddPress && (
        <TouchableOpacity
          onPress={onAddPress}
          style={styles.addButton}
          activeOpacity={0.7}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </Svg>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SocialIconsList;
