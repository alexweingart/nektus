'use client';

import React from 'react';
import Link from 'next/link';

const WelcomeScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm mx-auto text-center animate-fade-in">
        <div className="mb-16">
          <h1 
            className="text-5xl sm:text-6xl font-bold mb-8" 
            style={{ color: 'var(--primary)' }}
          >
            Nekt.Us
          </h1>
          <p className="text-xl sm:text-2xl mb-16">
            Connect with new friends by bumping phones
          </p>
        </div>
        
        <div className="flex justify-center w-full">
          <Link 
            href="/setup" 
            className="inline-block text-center no-underline text-xl sm:text-2xl font-medium py-5 px-10 w-full mx-auto"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'white',
              borderRadius: '9999px',
              boxShadow: 'var(--shadow-md)',
              transition: 'all 0.2s ease-in-out'
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
