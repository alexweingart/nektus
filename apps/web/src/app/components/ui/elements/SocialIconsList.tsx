'use client';

import React from 'react';
import SocialIcon from './SocialIcon';
import type { ContactEntry, FieldSection } from '@/types/profile';

interface SocialIconsListProps {
  contactEntries: ContactEntry[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'white';
  className?: string;
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

const SocialIconsList: React.FC<SocialIconsListProps> = ({
  contactEntries,
  size = 'md',
  variant = 'default',
  className = '',
  showAddButton = false,
  onAddPress
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

  // Transform contact channels into social items - NEW ARRAY FORMAT
  const socialItems: SocialItem[] = [];
  
  // Process entries directly from the ContactEntry array
  if (contactEntries?.length) {
    contactEntries.forEach((entry, index) => {
      // Skip name and bio - these are not social icons
      if (entry.fieldType === 'name' || entry.fieldType === 'bio') {
        return;
      }
      
      // Only include if has content and is visible (not explicitly hidden)
      const hasContent = entry.fieldType === 'phone' ? !!entry.value :
                         entry.fieldType === 'email' ? !!entry.value :
                         !!entry.value?.trim();
      
      const isVisible = entry.isVisible !== false; // Default to visible if not specified
      
      // Only show entries that have content AND are visible
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
            section: entry.section,
            order: baseOrder,
            linkType: entry.linkType
          });
          socialItems.push({
            platform: 'text' as PlatformType,
            username,
            url: `sms:${entry.value}`,
            section: entry.section,
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
            section: entry.section,
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
    
    // Within the same section, use the order field (which includes custom user ordering)
    return a.order - b.order;
  });

  
  // Helper function to get hover color class
  const getHoverColorClass = (platform: PlatformType): string => {
    switch (platform) {
      case 'phone':
      case 'text':
      case 'whatsapp':
        return 'hover:text-green-300';
      case 'email':
      case 'linkedin':
      case 'telegram':
        return 'hover:text-blue-300';
      case 'facebook':
        return 'hover:text-blue-400';
      case 'instagram':
        return 'hover:text-pink-400';
      case 'snapchat':
        return 'hover:text-yellow-300';
      case 'x':
      case 'wechat':
        return 'hover:text-[hsl(var(--background))]';
      default:
        return 'hover:text-gray-300';
    }
  };
  
  if (socialItems.length === 0) {
    return null;
  }
  
  return (
    <div className={`inline-flex flex-wrap gap-4 justify-center ${className}`}>
      {socialItems.map((item, index) => (
        <a
          key={`${item.platform}-${item.section}-${index}`}
          href={item.url}
          target={item.platform === 'phone' || item.platform === 'text' || item.platform === 'email' ? undefined : '_blank'}
          rel={item.platform === 'phone' || item.platform === 'text' || item.platform === 'email' ? undefined : 'noopener noreferrer'}
          className={`inline-block text-white transition-colors ${getHoverColorClass(item.platform)}`}
        >
          <SocialIcon
            platform={item.platform}
            username={item.username}
            size={size}
            variant={variant}
            customIcon={item.customIcon}
            linkType={item.linkType}
          />
        </a>
      ))}
      {showAddButton && onAddPress && (
        <button
          onClick={onAddPress}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors p-2"
          aria-label="Add link"
        >
          <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SocialIconsList; 