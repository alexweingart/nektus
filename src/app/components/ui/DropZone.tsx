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
        height: '3.5rem', // Match CustomInput exact height (56px)
        minHeight: '3.5rem',
        backgroundColor: 'hsla(122, 39%, 49%, 0.3)', // More visible green background
        border: '3px solid hsla(122, 39%, 49%, 0.8)', // More visible green border
        borderRadius: '9999px', // Match CustomInput rounded-full
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        color: 'hsla(122, 39%, 49%, 1)', // Full opacity green text
        fontWeight: '700', // Bolder text
        backdropFilter: 'blur(4px)', // Match CustomInput backdrop filter
        zIndex: 10, // Ensure it's above other elements
      }}
    >
DROP HERE
    </div>
  );
};