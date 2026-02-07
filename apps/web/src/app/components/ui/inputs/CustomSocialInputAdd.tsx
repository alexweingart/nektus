/**
 * CustomSocialInputAdd - Social media input with network selector and username field
 * Part of Phase 5: Links
 */

'use client';

import React from 'react';
import { FaFacebook, FaInstagram, FaLinkedin, FaSnapchatGhost, FaWhatsapp, FaTelegram, FaWeixin } from 'react-icons/fa';
import { DropdownSelector, DropdownOption } from './DropdownSelector';

// Custom X logo component (formerly Twitter)
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface CustomSocialInputAddProps {
  platform: string;
  username: string;
  onPlatformChange: (platform: string) => void;
  onUsernameChange: (username: string) => void;
  className?: string;
  autoFocus?: boolean;
  /** Container element for dropdown portals (use when inside a modal) */
  portalContainer?: HTMLElement | null;
}

// Social network options with icons
const SOCIAL_NETWORK_OPTIONS: DropdownOption[] = [
  {
    label: 'Facebook',
    value: 'facebook',
    icon: <FaFacebook className="w-6 h-6 text-white" />
  },
  {
    label: 'Instagram',
    value: 'instagram',
    icon: <FaInstagram className="w-6 h-6 text-white" />
  },
  {
    label: 'X',
    value: 'x',
    icon: <XIcon className="w-6 h-6 text-white" />
  },
  {
    label: 'LinkedIn',
    value: 'linkedin',
    icon: <FaLinkedin className="w-6 h-6 text-white" />
  },
  {
    label: 'Snapchat',
    value: 'snapchat',
    icon: <FaSnapchatGhost className="w-6 h-6 text-white" />
  },
  {
    label: 'WhatsApp',
    value: 'whatsapp',
    icon: <FaWhatsapp className="w-6 h-6 text-white" />
  },
  {
    label: 'Telegram',
    value: 'telegram',
    icon: <FaTelegram className="w-6 h-6 text-white" />
  },
  {
    label: 'WeChat',
    value: 'wechat',
    icon: <FaWeixin className="w-6 h-6 text-white" />
  }
];

export const CustomSocialInputAdd: React.FC<CustomSocialInputAddProps> = ({
  platform,
  username,
  onPlatformChange,
  onUsernameChange,
  className = '',
  autoFocus = false,
  portalContainer
}) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: '100%',
        height: '3.5rem',
        minHeight: '3.5rem',
      }}
    >
      {/* Background layer */}
      <div
        className={`absolute inset-0 rounded-full border transition-all ${
          isFocused ? 'bg-black/50 border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.15)]' : 'bg-black/40 border-white/20'
        }`}
        style={{
          transition: 'all 0.2s ease-in-out',
          pointerEvents: 'none'
        }}
      />

      {/* Content layer */}
      <div
        className="relative flex items-center h-full w-full"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        {/* Social Network Selector */}
        <div className="relative" style={{ zIndex: 50 }}>
          <DropdownSelector
            options={SOCIAL_NETWORK_OPTIONS}
            value={platform}
            onChange={onPlatformChange}
            placeholder="Select platform"
            onAfterChange={() => {
              // Return focus to username input after selecting from dropdown
              inputRef.current?.focus();
            }}
            portalContainer={portalContainer}
          />
        </div>

        {/* Username Input */}
        <input
          ref={inputRef}
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="Username"
          enterKeyHint="done"
          style={{
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            borderTopRightRadius: '9999px',
            borderBottomRightRadius: '9999px',
            backgroundColor: 'transparent',
            color: 'white'
          }}
          className="flex-1 pr-3 pl-3 h-full focus:outline-none text-white font-medium text-base rounded-r-full placeholder-white/40"
        />
      </div>
    </div>
  );
};
