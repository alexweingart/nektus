'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { FaPhone, FaEnvelope, FaFacebook, FaInstagram, FaLinkedin, FaSnapchatGhost, FaWhatsapp, FaTelegram, FaWeixin } from 'react-icons/fa';
import { openMessagingApp } from '@/lib/client/contacts/messaging';

// Custom X logo component (formerly Twitter)
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface SocialIconProps {
  platform: string;
  username?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'white';
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  customIcon?: string;
  linkType?: 'default' | 'custom';
}

const SocialIcon: React.FC<SocialIconProps> = ({
  platform,
  username,
  size = 'md',
  variant = 'default',
  onClick,
  className = '',
  disabled = false,
  customIcon,
  linkType
}) => {
  const [isActive, setIsActive] = useState(false);
  
  const getIconClass = () => {
    const baseSize = (() => {
      switch (size) {
        case 'sm': return 'w-6 h-6';
        case 'lg': return 'w-16 h-16 p-3';
        case 'md':
        default: return 'w-10 h-10 p-2';
      }
    })();
    
    const variantStyles = variant === 'white'
      ? 'text-white hover:bg-white/20'
      : 'text-white hover:bg-white/10';
    
    return `${baseSize} transition-colors duration-200 rounded-full ${
      disabled ? 'opacity-50 cursor-not-allowed' : `cursor-pointer hover:opacity-100 active:opacity-90 ${variantStyles}`
    }`;
  };

  // Generate platform URL based on username
  const getPlatformUrl = useCallback((platform: string, username: string): string | null => {
    if (!username) return null;
    
    const usernameFormatted = username.startsWith('@') ? username.substring(1) : username;
    
    switch (platform) {
      case 'facebook':
        return `https://facebook.com/${usernameFormatted}`;
      case 'instagram':
        return `https://instagram.com/${usernameFormatted}`;
      case 'x':
        return `https://x.com/${usernameFormatted}`;
      case 'linkedin':
        return `https://www.linkedin.com/in/${usernameFormatted}`;
      case 'snapchat':
        return `https://snapchat.com/add/${usernameFormatted}`;
      case 'whatsapp':
        return `https://wa.me/${usernameFormatted.replace(/[^0-9]/g, '')}`;
      case 'telegram':
        return `https://t.me/${usernameFormatted}`;
      case 'wechat':
        return `weixin://dl/chat?${usernameFormatted}`;
      case 'email':
        return `mailto:${usernameFormatted}`;
      case 'phone':
        return `sms:${usernameFormatted}`;
      default:
        return null;
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    setIsActive(true);

    // Blur the element to remove focus state on mobile
    (e.currentTarget as HTMLElement).blur();

    // If there's a custom click handler, use that
    if (onClick) {
      onClick();
      return;
    }

    // Handle custom links - username contains the full URL
    if (linkType === 'custom' && username) {
      window.open(username, '_blank', 'noopener,noreferrer');
      return;
    }

    // Handle phone platform with messaging service
    if (platform === 'phone' && username) {
      openMessagingApp('', username);
      return;
    }

    // Handle email platform with direct navigation (no new tab)
    if (platform === 'email' && username) {
      const url = getPlatformUrl(platform, username);
      if (url) {
        window.location.href = url; // Direct navigation for mailto links
      }
      return;
    }

    // Otherwise, handle default platform behavior with new tab
    if (username) {
      const url = getPlatformUrl(platform, username);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  }, [disabled, onClick, platform, username, getPlatformUrl, customIcon]);

  const iconElement = (() => {
    // Only show custom icon (favicon) for custom link types
    if (linkType === 'custom' && customIcon) {
      const containerSize = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-16 h-16 p-3' : 'w-10 h-10 p-2';
      const imageSize = size === 'sm' ? 24 : size === 'lg' ? 64 : 40;
      const variantStyles = variant === 'white' ? 'hover:bg-white/20' : 'hover:bg-white/10';
      return (
        <div className={`${containerSize} rounded-full transition-colors duration-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : `cursor-pointer hover:opacity-100 active:opacity-90 ${variantStyles}`
        }`}>
          <Image
            src={customIcon}
            alt={platform}
            width={imageSize}
            height={imageSize}
            className="w-full h-full object-contain rounded-full"
            unoptimized
          />
        </div>
      );
    }

    switch (platform) {
      case 'phone':
        return <FaPhone className={getIconClass()} style={{ position: 'relative', top: '1px' }} />;
      case 'email':
        return <FaEnvelope className={getIconClass()} />;
      case 'facebook':
        return <FaFacebook className={getIconClass()} />;
      case 'instagram':
        return <FaInstagram className={getIconClass()} />;
      case 'x':
        return <XIcon className={getIconClass()} />;
      case 'linkedin':
        return <FaLinkedin className={getIconClass()} />;
      case 'snapchat':
        return <FaSnapchatGhost className={getIconClass()} />;
      case 'whatsapp':
        return <FaWhatsapp className={getIconClass()} />;
      case 'telegram':
        return <FaTelegram className={getIconClass()} />;
      case 'wechat':
        return <FaWeixin className={getIconClass()} />;
      default:
        return null;
    }
  })();

  return (
    <div 
      className={`inline-block focus:outline-none ${className} ${disabled ? 'opacity-50' : ''}`}
      onClick={handleClick}
      onMouseEnter={() => {/* hover handled by CSS */}}
      onMouseLeave={() => {/* hover handled by CSS */}}
      onMouseDown={() => !disabled && setIsActive(true)}
      onMouseUp={() => !disabled && setIsActive(false)}
      onMouseOut={() => !disabled && setIsActive(false)}
      onTouchStart={() => !disabled && setIsActive(true)}
      onTouchEnd={(e) => {
        if (!disabled) {
          setIsActive(false);
          // Ensure focus is removed on touch devices
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      title={username ? `${platform}: ${username}` : platform}
      aria-label={`${platform} ${username ? `(${username})` : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      style={{
        transform: isActive ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.1s ease-in-out',
      }}
    >
      <div className="flex items-center justify-center w-full h-full">
        <div className="relative">
          {iconElement}
        </div>
      </div>
    </div>
  );
};

export default SocialIcon;
