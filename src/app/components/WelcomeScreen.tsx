'use client';

import React from 'react';
import Link from 'next/link';

const WelcomeScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-900">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-red-600 mb-4">Nekt.Us</h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-8">
            Connect with new friends by bumping phones
          </p>
          
          <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              How it works
            </h2>
            <ol className="text-left text-gray-700 dark:text-gray-300 space-y-3">
              <li className="flex items-start">
                <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">1</span>
                <span>Set up your profile and choose what to share</span>
              </li>
              <li className="flex items-start">
                <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">2</span>
                <span>When you meet someone new, open Nekt.Us</span>
              </li>
              <li className="flex items-start">
                <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">3</span>
                <span>Bump phones together to exchange info</span>
              </li>
              <li className="flex items-start">
                <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">4</span>
                <span>Connect on social media instantly</span>
              </li>
            </ol>
          </div>
        </div>
        
        <Link 
          href="/setup" 
          className="btn-primary w-full py-3 text-lg flex items-center justify-center"
        >
          Get Started
          <svg 
            className="ml-2 w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M14 5l7 7m0 0l-7 7m7-7H3" 
            />
          </svg>
        </Link>
      </div>
    </div>
  );
};

export default WelcomeScreen;
