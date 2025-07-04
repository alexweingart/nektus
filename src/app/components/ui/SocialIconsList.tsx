'use client';

import React from 'react';
import SocialIcon from './SocialIcon';
import type { ContactChannels } from '@/types/profile';
import type { FieldSection } from '@/types/forms';

interface SocialIconsListProps {
  contactChannels: ContactChannels;
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
  facebook: { section: 'personal', defaultOrder: 0 },
  instagram: { section: 'personal', defaultOrder: 1 },
  x: { section: 'personal', defaultOrder: 2 },
  snapchat: { section: 'personal', defaultOrder: 3 },
  whatsapp: { section: 'personal', defaultOrder: 4 },
  telegram: { section: 'personal', defaultOrder: 5 },
  wechat: { section: 'personal', defaultOrder: 6 },
  
  // Work section
  linkedin: { section: 'work', defaultOrder: 0 },
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
  contactChannels,
  size = 'md',
  variant = 'default',
  className = ''
}) => {
  // Transform contact channels into social items
  const socialItems: SocialItem[] = [];
  
  // Add phone if available
  if (contactChannels?.phoneInfo?.internationalPhone) {
    socialItems.push({
      platform: 'phone',
      username: contactChannels.phoneInfo.internationalPhone,
      url: `sms:${contactChannels.phoneInfo.internationalPhone}`,
      section: 'universal',
      order: 0
    });
  }
  
  // Add email if available
  if (contactChannels?.email?.email) {
    socialItems.push({
      platform: 'email',
      username: contactChannels.email.email,
      url: `mailto:${contactChannels.email.email}`,
      section: 'universal',
      order: 1
    });
  }
  
  // Add social platforms
  const socialPlatforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'] as const;
  
  socialPlatforms.forEach(platform => {
    const channel = contactChannels[platform];
    if (channel && channel.username) {
      const config = PLATFORM_CONFIG[platform];
      const fieldSection = channel.fieldSection;
      
      // Use the saved section if available, otherwise use default
      const section = fieldSection?.section || config.section;
      const order = fieldSection?.order !== undefined ? fieldSection.order : config.defaultOrder;
      
      // Only include if not hidden and has content
      if (section !== 'hidden' && channel.username.trim()) {
        socialItems.push({
          platform,
          username: channel.username,
          url: channel.url || '',
          section,
          order
        });
      }
    }
  });
  
  // Sort items by section order, then by order within section
  const sectionOrder: Record<FieldSection, number> = {
    universal: 0,
    personal: 1,
    work: 2,
    hidden: 3
  };
  
  socialItems.sort((a, b) => {
    const sectionDiff = sectionOrder[a.section] - sectionOrder[b.section];
    if (sectionDiff !== 0) return sectionDiff;
    return a.order - b.order;
  });
  
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
          key={item.platform}
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