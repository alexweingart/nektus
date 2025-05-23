'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, SocialProfile } from '../context/UserContext';

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

// List of social networks to include with proper typing
const SOCIAL_NETWORKS = [
  { id: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com' },
  { id: 'facebook' as const, label: 'Facebook', type: 'text', placeholder: 'username' },
  { id: 'instagram' as const, label: 'Instagram', type: 'text', placeholder: '@username' },
  { id: 'whatsapp' as const, label: 'WhatsApp', type: 'tel', placeholder: 'phone number' },
  { id: 'snapchat' as const, label: 'Snapchat', type: 'text', placeholder: 'username' },
  { id: 'linkedin' as const, label: 'LinkedIn', type: 'text', placeholder: 'username or URL' },
  { id: 'telegram' as const, label: 'Telegram', type: 'text', placeholder: '@username' },
  { id: 'twitter' as const, label: 'Twitter', type: 'text', placeholder: '@username' },
];

// Valid platform types from the SocialProfile interface
type ValidPlatform = SocialProfile['platform'];

const SocialProfileInputs: React.FC = () => {
  const router = useRouter();
  const { userData, setUserData, saveUserData } = useUser();
  
  // Create refs for each input field - fix the array type
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  
  // Initialize state for all social inputs
  const [socialInputs, setSocialInputs] = useState<Record<string, string>>({
    email: '',
    facebook: '',
    instagram: '',
    whatsapp: '',
    snapchat: '',
    linkedin: '',
    telegram: '',
    twitter: '',
  });

  // Set up the refs array once on mount
  useEffect(() => {
    // Initialize the array with the correct length
    inputRefs.current = Array(SOCIAL_NETWORKS.length).fill(null);
  }, []);

  // Auto-focus the email field on initial render
  useEffect(() => {
    if (inputRefs.current[0]) {
      // Immediate focus
      inputRefs.current[0].focus();
      
      // Delayed focus as backup
      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
          // Additional click for stubborn mobile browsers
          inputRefs.current[0].click();
        }
      }, 100);
    }
  }, []);

  // Create a proper ref callback that doesn't return anything
  const setInputRef = (index: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[index] = el;
  };

  // Handle input changes
  const handleInputChange = (id: string, value: string) => {
    setSocialInputs(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Handle enter key to move to next field
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Move to the next field if available
      if (index < SOCIAL_NETWORKS.length - 1 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      } else {
        // If on the last field, submit the form
        handleSubmit();
      }
    }
  };

  // Handle submission
  const handleSubmit = () => {
    // Create social profiles array with proper typing
    const socialProfiles: SocialProfile[] = [];
    
    // Handle each social platform
    Object.entries(socialInputs)
      .filter(([id, value]) => value.trim() !== '' && id !== 'email') // Only include non-empty values and exclude email
      .forEach(([id, value]) => {
        // Ensure id is a valid platform type
        if (id === 'facebook' || id === 'instagram' || id === 'twitter' || 
            id === 'linkedin' || id === 'snapchat' || id === 'whatsapp' || 
            id === 'telegram') {
          socialProfiles.push({
            platform: id,
            username: value.trim(),
            shareEnabled: true
          });
        }
      });
    
    // Update user data with social profiles
    setUserData(prev => ({
      ...prev,
      email: socialInputs.email, // Store email separately
      socialProfiles: socialProfiles
    }));
    
    // Save data and navigate to profile page
    saveUserData();
    router.push('/profile');
  };

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        overflow: 'auto',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: '6vh', // Position elements higher on the screen
        paddingBottom: '6vh',
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
            fontSize: '28px',
            fontWeight: 'bold',
            marginBottom: '24px',
            textAlign: 'center',
            width: '100%'
          }}
        >
          Add Your Social Profiles
        </h1>
        
        <p
          style={{
            fontSize: '16px',
            marginBottom: '24px',
            textAlign: 'center',
            color: 'var(--foreground)'
          }}
        >
          All fields are optional. Press Enter to move to the next field.
        </p>
        
        <div style={{ width: '100%', marginBottom: '24px' }}>
          {SOCIAL_NETWORKS.map((network, index) => (
            <div 
              key={network.id}
              style={{
                marginBottom: '16px',
                width: '100%'
              }}
            >
              <label
                htmlFor={network.id}
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '16px',
                  fontWeight: '500',
                  color: 'var(--foreground)'
                }}
              >
                {network.label}
              </label>
              <input
                ref={setInputRef(index)}
                id={network.id}
                type={network.type}
                value={socialInputs[network.id]}
                onChange={(e) => handleInputChange(network.id, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                placeholder={network.placeholder}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  borderRadius: '8px',
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--foreground)',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
              />
            </div>
          ))}
        </div>
        
        <button
          onClick={handleSubmit}
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
          Continue
        </button>
      </div>
    </div>
  );
};

export default SocialProfileInputs;
