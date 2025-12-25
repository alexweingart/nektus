/**
 * Banner - Informational banner with CTA and dismiss
 * Used for First Link prompt and Admin mode notifications
 */

'use client';

import React, { ReactNode } from 'react';
import { Text } from '../Typography';
import { SecondaryButton } from '../buttons/SecondaryButton';

interface BannerProps {
  icon: ReactNode;
  text: string;
  ctaText: string;
  onCtaClick: () => void;
  onDismiss: () => void;
  variant?: 'default' | 'admin';
}

export const Banner: React.FC<BannerProps> = ({
  icon,
  text,
  ctaText,
  onCtaClick,
  onDismiss,
  variant = 'default'
}) => {
  const bgClass = variant === 'admin' ? 'bg-red-500/90' : 'bg-white/10';
  const borderClass = variant === 'admin' ? 'border-red-400' : 'border-white/20';

  return (
    <div className={`${bgClass} border ${borderClass} rounded-2xl p-4 backdrop-blur-lg`}>
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          {icon}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <Text variant="base" className="text-white">
            {text}
          </Text>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <SecondaryButton
            variant={variant === 'admin' ? 'light' : 'dark'}
            onClick={onCtaClick}
            className="whitespace-nowrap"
          >
            {ctaText}
          </SecondaryButton>
          <SecondaryButton
            variant="subtle"
            onClick={onDismiss}
            className="!p-2 min-w-0"
            aria-label="Dismiss"
          >
            <svg
              className="w-4 h-4 text-white/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
};
