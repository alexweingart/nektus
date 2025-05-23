'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const WelcomeScreen: React.FC = () => {
  // Add a CSS rule to the document to prevent scrollbar on body
  React.useEffect(() => {
    // Add styling to prevent scroll
    document.body.style.overflow = 'hidden';
    
    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  
  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        padding: 0,
        margin: 0
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          animation: 'fadeIn 0.3s ease-out forwards',
          // Offset to adjust for visual balance (logo appears visually larger than button)
          marginBottom: '20px'
        }}
      >
        <h1 
          style={{ 
            color: 'var(--primary)',
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '8px', // Reduced from 16px to 8px
            textAlign: 'center',
            width: '100%'
          }}
        >
          Nekt.Us
        </h1>
        <p 
          style={{ 
            fontSize: '24px', 
            marginBottom: '50px', // Increased from 40px to 50px
            textAlign: 'center',
            width: '100%'
          }}
        >
          Less typing. More connecting.
        </p>
        
        <Link 
          href="/setup"
          style={{
            display: 'block',
            width: '100%',
            backgroundColor: 'var(--primary)',
            color: 'white',
            fontSize: '26px',
            fontWeight: '500',
            padding: '20px 24px',
            borderRadius: '100px',
            boxShadow: 'var(--shadow-md)',
            transition: 'all 0.2s ease-in-out',
            textDecoration: 'none',
            textAlign: 'center'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
        >
          Start Nekt'ing
        </Link>
      </div>
    </div>
  );
};

export default WelcomeScreen;
