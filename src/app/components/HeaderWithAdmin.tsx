"use client";

import React, { useState } from 'react';
import AdminMode from './AdminMode';

export default function HeaderWithAdmin() {
  const [adminModeVisible, setAdminModeVisible] = useState(false);
  
  // Handle double-click on Nekt.Us text
  const handleDoubleClick = () => {
    setAdminModeVisible(prev => !prev);
    // Vibrate if supported (mobile devices)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(200);
    }
  };
  
  // Handle closing the admin panel
  const handleClose = () => {
    setAdminModeVisible(false);
  };
  
  return (
    <>
      {/* Admin mode banner - only shown when activated */}
      <AdminMode visible={adminModeVisible} onClose={handleClose} />
      
      {/* Main header */}
      <header style={{ 
        position: 'relative', 
        padding: '14px 16px',
        backgroundColor: 'var(--primary)',
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 10
      }}>
        {/* The h1 element that triggers admin mode on double-click */}
        <h1 
          style={{ 
            margin: 0, 
            padding: 0, 
            fontSize: '20px',
            fontWeight: 'bold',
            cursor: 'default' 
          }}
          onDoubleClick={handleDoubleClick}
        >
          Nekt.Us
        </h1>
      </header>
    </>
  );
}
