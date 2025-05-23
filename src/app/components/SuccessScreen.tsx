'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

const SuccessScreen: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactName = searchParams.get('name') || 'Contact';

  const handleDone = () => {
    router.push('/profile');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <div className="bg-green-100 dark:bg-green-900 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-6">
            <svg 
              className="w-10 h-10 text-green-600 dark:text-green-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            Congrats!
          </h1>
          
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-8">
            You and {contactName} are now Nekt'd via Google (phone),
            Facebook and Twitter. Make sure you still meet again in
            person though. :)
          </p>
        </div>
        
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            What happens next?
          </h2>
          <ul className="text-left text-gray-700 dark:text-gray-300 space-y-3 mb-8">
            <li className="flex items-start">
              <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
              <span>Phone number has been added to your contacts</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
              <span>Social links are ready for you to connect</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
              <span>Follow up soon to strengthen your connection</span>
            </li>
          </ul>
        </div>
        
        <button 
          onClick={handleDone}
          className="btn-primary w-full py-3"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default SuccessScreen;
