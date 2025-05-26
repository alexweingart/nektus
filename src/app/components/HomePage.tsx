'use client';

import React, { useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ProfileView from './ProfileView';
import { useAdminModeActivator } from './AdminBanner';

// Component now handles both the welcome screen and authenticated user view
const HomePage: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const adminModeProps = useAdminModeActivator();
  
  // Prevent scrolling on welcome screen
  useEffect(() => {
    if (!session) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [session]);
  
  // If authenticated, show the profile view
  if (status === 'authenticated' && session) {
    return <ProfileView />;
  }
  
  // Otherwise show the welcome screen
  return (
    <div className="flex items-start justify-center fixed inset-0 h-screen w-screen overflow-hidden pt-[10vh] bg-[#f4f9f4]">
      <div className="w-full max-w-[320px] flex flex-col justify-start items-center">
        <h1 
          className="text-[#4caf50] text-5xl font-bold mb-0.5 text-center w-full"
          {...adminModeProps} // Apply the double-click handler
        >
          Nekt.Us
        </h1>
        <p className="text-2xl mt-0 mb-6 text-center w-full text-[#2d3748]">
          Less typing. More connecting.
        </p>
        
        <button 
          onClick={() => {
            // Set flag to indicate we want to focus the phone input after redirect
            sessionStorage.setItem("wantsPhoneFocus", "1");
            // We'll use the auth callback to determine where to go
            signIn('google');
          }}
          className="flex items-center justify-center w-full rounded-full py-3 px-6 text-lg font-medium bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 shadow-sm cursor-pointer mb-2 transition-all duration-200"
        >
          <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="mr-3">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
          </svg>
          Sign in with Google
        </button>
        
        <div className="text-base text-gray-600 text-center mt-1 mb-5">
          to start nekt'ing
        </div>
      </div>
    </div>
  );
};

export default HomePage;
