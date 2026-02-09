import React from 'react';

interface FieldListProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Simple wrapper for a list of fields with consistent spacing
 * Use this inside FieldSection components when you need to render multiple fields
 */
export const FieldList: React.FC<FieldListProps> = ({ children, className = '' }) => {
  return (
    <div className={`space-y-5 ${className}`}>
      {children}
    </div>
  );
};
