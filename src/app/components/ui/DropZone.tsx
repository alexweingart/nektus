'use client';

import React from 'react';

interface DropZoneProps {
  id: string;
  section: string;
  order: number;
  className?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({ id, section, order, className = '' }) => {
  return (
    <div
      data-drop-zone={id}
      data-drop-section={section}
      data-drop-order={order}
      className={`drop-zone ${className}`}
      style={{
        height: '0px',
        overflow: 'hidden',
        transition: 'height 0.2s ease',
        margin: '0',
      }}
    >
      <div 
        className="drop-zone-indicator"
        style={{ 
          height: '60px', // Default height when active
          backgroundColor: 'hsla(122, 39%, 49%, 0.1)', // Theme green background
          border: '2px dashed hsla(122, 39%, 49%, 0.3)', // Theme green border
          borderRadius: '9999px', // Rounded corners matching CustomInput
          margin: '10px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: 'hsla(122, 39%, 49%, 0.7)', // Theme green text
          fontWeight: '500'
        }} 
      >
        Drop here
      </div>
    </div>
  );
};