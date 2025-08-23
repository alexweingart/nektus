'use client';

import React from 'react';
import SocialIcon from './SocialIcon';
import type { ContactEntry, FieldSection } from '@/types/profile';

interface SocialIconsListProps {
  contactEntries: ContactEntry[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'white';
  className?: string;
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
type PlatformType = keyof typeof PLATFORM_CONFIG;

interface SocialItem {
  platform: PlatformType;
  username: string;
  url: string;
  section: FieldSection;
  order: number;
}

const SocialIconsList: React.FC<SocialIconsListProps> = ({
  contactEntries,
  size = 'md',
  variant = 'default',
  className = ''
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
        return `https://linkedin.com/in/${username}`;
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
      // Only include if has content and is visible (not explicitly hidden)
      const hasContent = entry.fieldType === 'phone' ? !!entry.value :
                         entry.fieldType === 'email' ? !!entry.value :
                         !!entry.value?.trim();
      
      const isVisible = entry.isVisible !== false; // Default to visible if not specified
      
      // Only show entries that have content AND are visible
      if (hasContent && isVisible) {
        const username = entry.value;
        
        const url = entry.fieldType === 'phone' ? `sms:${entry.value}` :
                    entry.fieldType === 'email' ? `mailto:${entry.value}` :
                    getUrlForPlatform(entry.fieldType as PlatformType, entry.value);
        
        const config = PLATFORM_CONFIG[entry.fieldType as keyof typeof PLATFORM_CONFIG];
        
        socialItems.push({
          platform: entry.fieldType as PlatformType,
          username,
          url,
          section: entry.section,
          order: entry.order ?? config?.defaultOrder ?? index // Use saved order first, then defaultOrder, then index
        });
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
    <div className={`flex flex-wrap justify-center gap-4 ${className}`}>
      {socialItems.map((item) => (
        <a
          key={`${item.platform}-${item.section}`}
          href={getUrlForPlatform(item.platform, item.username)}
          target={item.platform === 'phone' || item.platform === 'email' ? undefined : '_blank'}
          rel={item.platform === 'phone' || item.platform === 'email' ? undefined : 'noopener noreferrer'}
          className={`text-white transition-colors ${getHoverColorClass(item.platform)}`}
        >
          <SocialIcon
            platform={item.platform}
            username={item.username}
            size={size}
            variant={variant}
          />
        </a>
      ))}
    </div>
  );
};

export default SocialIconsList; 