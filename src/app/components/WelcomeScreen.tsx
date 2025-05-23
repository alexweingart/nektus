'use client';

import React from 'react';
import Link from 'next/link';

const WelcomeScreen: React.FC = () => {
  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh', // Use exact height instead of minHeight
        padding: '0',    // Remove padding to avoid affecting centering
        textAlign: 'center',
        position: 'fixed', // Fixed position to ensure it takes full viewport
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'auto'  // Allow scrolling if needed
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '320px',
          margin: '0 auto',
          animation: 'fadeIn 0.3s ease-out forwards'
        }}
      >
        <div style={{ marginBottom: '64px' }}>
          <h1 
            style={{ 
              color: 'var(--primary)',
              fontSize: '48px',
              fontWeight: 'bold',
              marginBottom: '32px',
              textAlign: 'center',
              width: '100%'
            }}
          >
            Nekt.Us
          </h1>
          <p 
            style={{ 
              fontSize: '24px', 
              marginBottom: '64px',
              textAlign: 'center',
              width: '100%'
            }}
          >
            Connect with new friends by bumping phones
          </p>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
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
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
