'use client';

import React from 'react';
import { signIn } from 'next-auth/react';
import { useAdminModeActivator } from './AdminBanner';

// Standard button style shared across the application
const standardButtonStyle = {
  display: 'block',
  width: '100%',
  backgroundColor: 'var(--primary)',
  color: 'white',
  fontSize: '22px',
  fontWeight: '500',
  padding: '16px 24px',
  borderRadius: '100px',
  boxShadow: 'var(--shadow-md)',
  transition: 'all 0.2s ease-in-out',
  textDecoration: 'none',
  textAlign: 'center' as const, // Type assertion to fix TypeScript error
  border: 'none',
  cursor: 'pointer',
  marginTop: '10px'
};

const WelcomeScreen: React.FC = () => {
  // Get the admin mode activator props
  const adminModeProps = useAdminModeActivator();
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
        alignItems: 'flex-start',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: '10vh' // Position elements higher on the screen
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          animation: 'fadeIn 0.3s ease-out forwards'
        }}
      >
        <h1 
          style={{ 
            color: 'var(--primary)',
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '8px',
            textAlign: 'center',
            width: '100%',
            cursor: 'default' // Show default cursor instead of text cursor
          }}
          {...adminModeProps} // Apply the double-click handler
        >
          Nekt.Us
        </h1>
        <p 
          style={{ 
            fontSize: '24px', 
            marginBottom: '50px',
            textAlign: 'center',
            width: '100%'
          }}
        >
          Less typing. More connecting.
        </p>
        
        <button 
          onClick={() => signIn('google', { callbackUrl: '/setup' })}
          style={{
            display: 'block',
            width: '100%',
            backgroundColor: 'var(--primary)',
            color: 'white',
            fontSize: '22px',
            fontWeight: '500',
            padding: '16px 24px',
            borderRadius: '100px',
            boxShadow: 'var(--shadow-md)',
            transition: 'all 0.2s ease-in-out',
            textDecoration: 'none',
            textAlign: 'center',
            border: 'none',
            cursor: 'pointer',
            marginTop: '10px'
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
          Sign in with Google
          <div style={{ fontSize: '14px', fontWeight: 'normal', marginTop: '4px' }}>
            to start nekt'ing
          </div>
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreen;
