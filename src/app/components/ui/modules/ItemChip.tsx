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
  actionButton?: ReactNode;  // Optional custom action button (for full control)
  onActionClick?: (e: React.MouseEvent) => void;  // Standardized action button handler
  actionIcon?: 'trash' | 'calendar' | ReactNode;  // Predefined icons or custom
  isActionLoading?: boolean;  // Show loading spinner on action button
  onClick?: () => void;
  className?: string;
  truncateTitle?: boolean;  // Enable text truncation with ellipsis
}

export const ItemChip: React.FC<ItemChipProps> = ({
  icon,
  title,
  subtitle,
  actionButton,
  onActionClick,
  actionIcon,
  isActionLoading = false,
  onClick,
  className = '',
  truncateTitle = false
}) => {
  // Render predefined icon
  const renderActionIcon = () => {
    if (actionIcon === 'trash') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      );
    } else if (actionIcon === 'calendar') {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-white"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    return actionIcon; // Custom ReactNode
  };

  const hasAction = actionButton || onActionClick;

  return (
    <div
      className={`flex items-center p-4 bg-black/40 border border-white/10 rounded-2xl backdrop-blur-sm ${
        onClick ? 'cursor-pointer hover:bg-black/50' : ''
      } ${className}`}
    >
      {/* Clickable area - excludes action button */}
      <div
        className={`flex items-center flex-1 min-w-0 ${onClick ? 'button-release' : ''}`}
        onClick={onClick}
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          {icon}
        </div>

        {/* Content */}
        <div className={`flex-1 ml-4 min-w-0 ${hasAction ? 'mr-3' : ''}`}>
          <h3 className={`text-white font-medium text-base ${truncateTitle ? 'truncate' : ''}`}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-gray-300 text-sm truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Action Button */}
      {actionButton ? (
        <div className="flex-shrink-0">
          {actionButton}
        </div>
      ) : onActionClick ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isActionLoading) {
              onActionClick(e);
            }
          }}
          disabled={isActionLoading}
          className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/20 text-gray-400 hover:text-white hover:bg-white/20 transition-transform ${
            isActionLoading ? 'opacity-50 cursor-not-allowed' : 'active:scale-90'
          }`}
          aria-label="Action"
        >
          {isActionLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            renderActionIcon()
          )}
        </button>
      ) : null}
    </div>
  );
};
