'use client';

import React, { useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useAdminModeActivator } from './ui/AdminBanner';

// Standard button style shared across the application - defined here for reference
// but not used in this component to avoid unused variable warning
// const standardButtonStyle = {
//   display: 'block',
//   width: '100%',
//   backgroundColor: 'var(--primary)',
//   color: 'white',
//   fontSize: '22px',
//   fontWeight: '500',
//   padding: '16px 24px',
//   borderRadius: '100px',
//   boxShadow: 'var(--shadow-md)',
//   transition: 'all 0.2s ease-in-out',
//   textDecoration: 'none',
//   textAlign: 'center' as const, // Type assertion to fix TypeScript error
//   border: 'none',
//   cursor: 'pointer',
//   marginTop: '10px'
// };

// Component handles just the welcome screen
const HomePage: React.FC = () => {
  const adminModeProps = useAdminModeActivator();
  
  // Prevent scrolling on welcome screen
  useEffect(() => {
    document.body.style.overflow = 'hidden';
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
      {/* Welcome screen content remains the same */}
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
            marginBottom: '2px',
            textAlign: 'center',
            width: '100%',
          }}
          {...adminModeProps} // Apply the double-click handler
        >
          Nekt.Us
        </h1>
        <p 
          style={{ 
            fontSize: '24px', 
            marginTop: '0px',
            marginBottom: '24px',
            textAlign: 'center',
            width: '100%'
          }}
        >
          Less typing. More connecting.
        </p>
        
        <button 
          onClick={() => {
            // We'll use the auth callback to determine where to go
            // Redirect back to profile setup after Google auth so new users can complete onboarding
            signIn('google', { callbackUrl: '/setup' });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            backgroundColor: 'white',
            color: '#757575',
            fontSize: '18px',
            fontWeight: '500',
            padding: '12px 24px',
            borderRadius: '100px',
            transition: 'all 0.2s ease-in-out',
            textDecoration: 'none',
            textAlign: 'center',
            border: '1px solid #ddd',
            cursor: 'pointer',
            marginBottom: '8px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
          }}
        >
          <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ marginRight: '12px' }}>
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
          </svg>
          Sign in with Google
        </button>
        
        <div style={{ fontSize: '16px', color: '#555', textAlign: 'center', marginTop: '4px', marginBottom: '20px' }}>
          to start nekt&apos;ing
        </div>
      </div>
    </div>
  );
};

export default HomePage;
