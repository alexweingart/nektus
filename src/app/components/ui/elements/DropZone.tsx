'use client';

import React from 'react';

interface DropZoneProps {
  order: number;
  section: string;
  isActive: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ order, section, isActive }) => {
  
  if (!isActive) {
    return null; // Don't render anything when inactive
  }

  return (
    <div
      data-order={order}
      data-section={section}
      className="w-full max-w-[var(--max-content-width,448px)]"
      style={{
        height: '3.5rem', // Match StaticInput exact height (56px)
        minHeight: '3.5rem',
        backgroundColor: 'transparent', // Transparent background
        border: '2px dashed hsla(122, 39%, 49%, 0.7)', // Dotted green border
        borderRadius: '9999px', // Match StaticInput rounded-full
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        color: 'hsla(122, 39%, 49%, 0.8)', // Slightly transparent green text
        fontWeight: '600', // Medium weight text
        zIndex: 10, // Ensure it's above other elements
      }}
    >
DROP HERE
    </div>
  );
};