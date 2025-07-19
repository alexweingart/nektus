'use client';

import React from 'react';
import { Heading } from './Typography';

interface FieldSectionProps {
  title?: string;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
  className?: string;
}

export const FieldSection: React.FC<FieldSectionProps> = ({
  title,
  isEmpty,
  emptyText,
  children,
  className = ''
}) => {
  return (
    <div className={`w-full ${className}`}>
      {/* Section Header */}
      {title && (
        <div className="field-section-title mb-4 text-center">
          <Heading as="h2" className="text-white">
            {title}
          </Heading>
        </div>
      )}
      
      {/* Content or Empty State */}
      {isEmpty ? (
        <div className="mb-6 w-full max-w-md mx-auto">
          <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6 text-center">
            <p className="text-white/70 text-sm">
              {emptyText}
            </p>
          </div>
        </div>
      ) : (
        <div>
          {children}
        </div>
      )}
    </div>
  );
}; 