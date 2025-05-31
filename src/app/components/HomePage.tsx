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
        <div 
          style={{ 
            color: 'var(--primary)',
            marginBottom: '2px',
            textAlign: 'center',
            width: '100%',
          }}
          {...adminModeProps} // Apply the double-click handler
        >
          <svg width="200" height="70" viewBox="0 0 593 206" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="133.788" y="5.6777" width="25" height="150.918" rx="12.5" fill="currentColor"/>
            <rect x="5.17761" y="5.6777" width="25" height="200" rx="12.5" fill="currentColor"/>
            <rect y="18.1777" width="25" height="203.839" rx="12.5" transform="rotate(-45 0 18.1777)" fill="currentColor"/>
            <path d="M260.868 55.6777C288.482 55.6778 310.867 78.0637 310.868 105.678H285.883C285.883 91.8706 274.69 80.6777 260.883 80.6777C247.076 80.6777 235.883 91.8706 235.883 105.678C235.883 119.48 247.068 130.668 260.868 130.677V155.678C233.253 155.678 210.868 133.292 210.868 105.678C210.868 78.0637 233.253 55.6777 260.868 55.6777Z" fill="currentColor"/>
            <rect x="210.883" y="118.178" width="25" height="100" rx="12.5" transform="rotate(-90 210.883 118.178)" fill="currentColor"/>
            <rect x="359.938" y="54.1612" width="25" height="100" rx="12.5" fill="currentColor"/>
            <rect x="530.275" y="4.75983" width="25" height="150.671" rx="12.5" fill="currentColor"/>
            <rect x="492.775" y="80.6777" width="25" height="100" rx="12.5" transform="rotate(-90 492.775 80.6777)" fill="currentColor"/>
            <path d="M260.883 155.678V130.678H280.791C287.694 130.678 293.291 136.274 293.291 143.178V143.178C293.291 150.081 287.694 155.678 280.791 155.678H260.883Z" fill="currentColor"/>
            <rect x="379.26" y="106.339" width="25" height="75" rx="12.5" transform="rotate(-45 379.26 106.339)" fill="currentColor"/>
            <rect x="396.938" y="119.694" width="25" height="75" rx="12.5" transform="rotate(-135 396.938 119.694)" fill="currentColor"/>
            <rect x="210.868" y="29.7598" width="25" height="344.407" rx="12.5" transform="rotate(-90 210.868 29.7598)" fill="currentColor"/>
            <rect x="5.17761" y="205.88" width="23.4045" height="550.097" rx="11.7023" transform="rotate(-90 5.17761 205.88)" fill="currentColor"/>
          </svg>
        </div>
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
