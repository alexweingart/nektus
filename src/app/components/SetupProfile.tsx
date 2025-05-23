'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, SocialProfile } from '../context/UserContext';

const socialPlatforms: Array<{
  id: SocialProfile['platform'];
  name: string;
}> = [
  { id: 'facebook', name: 'Facebook' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'twitter', name: 'Twitter' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'snapchat', name: 'Snapchat' },
  { id: 'whatsapp', name: 'WhatsApp' },
  { id: 'telegram', name: 'Telegram' },
];

const SetupProfile: React.FC = () => {
  const router = useRouter();
  const { userData, setUserData, saveUserData } = useUser();
  
  const [activeStep, setActiveStep] = useState(1);
  const [socialInputs, setSocialInputs] = useState<Record<string, {username: string, shareEnabled: boolean}>>({
    facebook: { username: '', shareEnabled: true },
    instagram: { username: '', shareEnabled: true },
    twitter: { username: '', shareEnabled: true },
    linkedin: { username: '', shareEnabled: true },
    snapchat: { username: '', shareEnabled: true },
    whatsapp: { username: '', shareEnabled: true },
    telegram: { username: '', shareEnabled: true },
  });

  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateBasicInfo = () => {
    const newErrors: Record<string, string> = {};
    
    if (!userData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!userData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[\d\s()-]{10,15}$/.test(userData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    if (!userData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBasicInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData(prev => ({ ...prev, [name]: value }));
  };

  const handleSocialInputChange = (platform: string, field: 'username' | 'shareEnabled', value: string | boolean) => {
    setSocialInputs(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value
      }
    }));
  };

  const handleNextStep = () => {
    if (activeStep === 1) {
      if (validateBasicInfo()) {
        setActiveStep(2);
      }
    } else if (activeStep === 2) {
      // Save social profiles to userData
      const socialProfiles = Object.entries(socialInputs)
        .filter(([_, data]) => data.username.trim() !== '')
        .map(([platform, data]) => ({
          platform: platform as SocialProfile['platform'],
          username: data.username.trim(),
          shareEnabled: data.shareEnabled
        }));
      
      setUserData(prev => ({
        ...prev,
        socialProfiles
      }));
      
      // Save all user data
      saveUserData();
      
      // Navigate to profile page
      router.push('/profile');
    }
  };

  const handlePrevStep = () => {
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="container mx-auto max-w-md p-6">
        <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-8">
          {activeStep === 1 ? 'Create Your Profile' : 'Connect Your Accounts'}
        </h1>
        
        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            activeStep >= 1 ? 'bg-red-600 text-white' : 'bg-gray-300 text-gray-600'
          }`}>
            1
          </div>
          <div className={`h-1 w-12 ${
            activeStep >= 2 ? 'bg-red-600' : 'bg-gray-300'
          }`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            activeStep >= 2 ? 'bg-red-600 text-white' : 'bg-gray-300 text-gray-600'
          }`}>
            2
          </div>
        </div>
        
        {/* Step 1: Basic Info */}
        {activeStep === 1 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={userData.name}
                onChange={handleBasicInfoChange}
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white"
                placeholder="John Doe"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={userData.phone}
                onChange={handleBasicInfoChange}
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white"
                placeholder="+1 (123) 456-7890"
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={userData.email}
                onChange={handleBasicInfoChange}
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white"
                placeholder="john@example.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Title (Optional)
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={userData.title || ''}
                onChange={handleBasicInfoChange}
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white"
                placeholder="Software Engineer"
              />
            </div>
            
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company (Optional)
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={userData.company || ''}
                onChange={handleBasicInfoChange}
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white"
                placeholder="Acme Inc."
              />
            </div>
            
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location (Optional)
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={userData.location || ''}
                onChange={handleBasicInfoChange}
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white"
                placeholder="San Francisco, CA"
              />
            </div>
          </div>
        )}
        
        {/* Step 2: Social Media */}
        {activeStep === 2 && (
          <div className="space-y-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Connect your social media accounts and choose which ones to share when you Nekt with someone.
            </p>
            
            {socialPlatforms.map(platform => (
              <div key={platform.id} className="flex items-center space-x-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 flex items-center justify-center">
                    {/* Social platform icon */}
                    <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0z" />
                    </svg>
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <label htmlFor={`${platform.id}-username`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {platform.name}
                  </label>
                  <input
                    type="text"
                    id={`${platform.id}-username`}
                    value={socialInputs[platform.id].username}
                    onChange={(e) => handleSocialInputChange(platform.id, 'username', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white"
                    placeholder={`Your ${platform.name} username`}
                  />
                </div>
                
                <div className="flex-shrink-0">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={socialInputs[platform.id].shareEnabled}
                      onChange={(e) => handleSocialInputChange(platform.id, 'shareEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Navigation buttons */}
        <div className="flex justify-between mt-8">
          {activeStep > 1 ? (
            <button
              onClick={handlePrevStep}
              className="btn-secondary"
            >
              Back
            </button>
          ) : (
            <div></div> // Empty div for spacing
          )}
          
          <button
            onClick={handleNextStep}
            className="btn-primary"
          >
            {activeStep < 2 ? 'Next' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupProfile;
