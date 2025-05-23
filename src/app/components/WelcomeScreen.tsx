'use client';

import React from 'react';
import Link from 'next/link';

const WelcomeScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center animate-fade-in">
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-6" style={{ color: 'var(--primary)' }}>Nekt.Us</h1>
          <p className="text-xl mb-12">
            Connect with new friends by bumping phones
          </p>
        </div>
        
        <div className="flex justify-center">
          <Link 
            href="/setup" 
            className="btn-primary text-lg px-10 py-4 w-full max-w-xs"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
