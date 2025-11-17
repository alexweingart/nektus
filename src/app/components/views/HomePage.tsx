import React from 'react';
import { signIn } from 'next-auth/react';
import { useAdminModeActivator } from '../ui/banners/AdminBanner';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../ui/buttons/Button';
import { Heading } from '../ui/Typography';

// Google icon SVG component
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
    <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12 0-6.627 5.373-12 12-12 3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24c0 11.045 8.955 20 20 20 11.045 0 20-8.955 20-20 0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
    <path d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
  </svg>
);

// Component handles just the welcome screen
const HomePage: React.FC = () => {
  const adminModeProps = useAdminModeActivator();
  
  return (
    <div className="relative">
      {/* Main content */}
      <div className="flex items-start justify-center pt-[10vh]">
        <div
          style={{
            width: '100%',
            maxWidth: 'var(--max-content-width, 448px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            animation: 'fadeIn 0.3s ease-out forwards',
            padding: '0 1rem'
          }}
        >
        <div 
          style={{ 
            marginBottom: '10px',
            textAlign: 'center',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
          {...adminModeProps} // Apply the double-click handler
        >
          <div style={{ maxWidth: '448px', width: '100%' }}>
            <Image 
              src="/nektus-logo.svg" 
              alt="Nekt Logo" 
              width={448}
              height={154} // 448 * (original height/width ratio 110/320 = 0.34375)
              style={{ 
                width: '100%',
                height: 'auto',
                maxWidth: '100%'
              }} 
              priority
            />
          </div>
        </div>
        <Heading as="h1" className="text-center w-full mb-10">
          Bump to Connect
        </Heading>
        
        <Button
          variant="white"
          size="xl"
          className="w-full mb-2 text-gray-700 font-medium"
          onClick={() => signIn('google')}
          icon={<GoogleIcon />}
        >
          Sign in with Google
        </Button>
        
        <p className="text-center text-sm text-muted-foreground mt-1 mb-5">
          to start nekt&apos;ing
        </p>
        </div>
      </div>
      
      {/* Footer links positioned at bottom of viewport */}
      <div className="fixed bottom-0 left-0 right-0 text-center text-sm text-white pb-safe pb-8">
        <div className="mb-2">
          <Link href="/privacy" className="font-bold hover:text-gray-300 transition-colors">
            Privacy
          </Link>
          <span className="mx-2">|</span>
          <Link href="/terms" className="font-bold hover:text-gray-300 transition-colors">
            Terms
          </Link>
        </div>
        <div className="text-xs text-gray-300">
          © 2025 Cardamore, Inc. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default HomePage; 