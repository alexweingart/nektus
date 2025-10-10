'use client';

import React from 'react';
import { Heading } from './Typography';

interface FieldSectionProps {
  title?: string;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
  className?: string;
  bottomButton?: React.ReactNode;
}

export const FieldSection: React.FC<FieldSectionProps> = ({
  title,
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
      
      {/* Content or Empty State */}
      {isEmpty ? (
        <div className="w-full max-w-md mx-auto relative z-0">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 text-center">
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