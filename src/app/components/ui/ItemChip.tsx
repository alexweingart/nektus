/**
 * ItemChip component - Generalized chip/item component
 * Used for calendar items, location items, and meeting suggestion chips
 */

'use client';

import React, { ReactNode } from 'react';

interface ItemChipProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actionButton?: ReactNode;  // Optional action button (e.g., delete icon)
  onClick?: () => void;
  className?: string;
  truncateTitle?: boolean;  // Enable text truncation with ellipsis
}

export const ItemChip: React.FC<ItemChipProps> = ({
  icon,
  title,
  subtitle,
  actionButton,
  onClick,
  className = '',
  truncateTitle = false
}) => {
  return (
    <div
      className={`flex items-center p-4 bg-black/40 rounded-2xl backdrop-blur-sm transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:bg-black/50 active:scale-98' : ''
      } ${className}`}
      onClick={onClick}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {icon}
      </div>

      {/* Content */}
      <div className={`flex-1 ml-4 min-w-0 ${actionButton ? 'mr-3' : ''}`}>
        <h3 className={`text-white font-medium text-base ${truncateTitle ? 'truncate' : ''}`}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-gray-300 text-sm truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* Action Button */}
      {actionButton && (
        <div className="flex-shrink-0">
          {actionButton}
        </div>
      )}
    </div>
  );
};
