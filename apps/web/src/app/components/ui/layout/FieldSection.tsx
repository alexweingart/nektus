'use client';

import React from 'react';
import { Heading } from '../Typography';

interface FieldSectionProps {
  title?: string;
  topContent?: React.ReactNode;  // Optional content to show before the main children (e.g., calendar/location chips)
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
  className?: string;
  bottomButton?: React.ReactNode;
}

export const FieldSection: React.FC<FieldSectionProps> = ({
  title,
  topContent,
  isEmpty,
  emptyText,
  children,
  className = '',
  bottomButton
}) => {
  return (
    <div className={`w-full ${className}`}>
      {/* Section Header */}
      {title && (
        <div className="field-section-title text-center mb-5" data-section-header={title.toLowerCase()}>
          <Heading as="h2" className="text-white">
            {title}
          </Heading>
        </div>
      )}

      {/* Optional Top Content (e.g., calendar/location chips before main content) */}
      {topContent && !isEmpty && (
        <div className="mb-5">
          {topContent}
        </div>
      )}

      {/* Content or Empty State */}
      {isEmpty ? (
        <div className="w-full max-w-md mx-auto relative z-0">
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-6 text-center">
            <p className="text-white/70 text-sm">
              {emptyText}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {children}
        </div>
      )}

      {/* Optional Bottom Button */}
      {bottomButton && (
        <div className="mt-5">
          {bottomButton}
        </div>
      )}
    </div>
  );
}; 