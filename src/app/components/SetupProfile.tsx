'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useUser, SocialProfile } from '../context/UserContext';

// Common button style for consistency
const primaryButtonStyle = {
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
  textAlign: 'center' as const,
  border: 'none',
  cursor: 'pointer',
  marginTop: '16px'
};

const secondaryButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  backgroundColor: 'white',
  color: '#333',
  fontSize: '18px',
  fontWeight: '500',
  padding: '14px 24px',
  borderRadius: '100px',
  boxShadow: 'var(--shadow-sm)',
  transition: 'all 0.2s ease-in-out',
  textDecoration: 'none',
  textAlign: 'center' as const,
  border: '1px solid #ddd',
  cursor: 'pointer',
  marginTop: '16px'
};

// List of supported social networks
const SOCIAL_PLATFORMS: Array<{
  id: SocialProfile['platform'];
  label: string;
  icon: string;
  prefix: string;
}> = [
  { id: 'instagram', label: 'Instagram', icon: '/icons/instagram.svg', prefix: '@' },
  { id: 'twitter', label: 'Twitter', icon: '/icons/twitter.svg', prefix: '@' },
  { id: 'facebook', label: 'Facebook', icon: '/icons/facebook.svg', prefix: '' },
  { id: 'linkedin', label: 'LinkedIn', icon: '/icons/linkedin.svg', prefix: '' },
  { id: 'snapchat', label: 'Snapchat', icon: '/icons/snapchat.svg', prefix: '' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '/icons/whatsapp.svg', prefix: '+' },
  { id: 'telegram', label: 'Telegram', icon: '/icons/telegram.svg', prefix: '@' },
];

const SetupProfile: React.FC = () => {
  const router = useRouter();
  const { userData, setUserData } = useUser();
  
  // Phone number state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  
  // Universal handle state
  const [showHandleInput, setShowHandleInput] = useState(false);
  const [universalHandle, setUniversalHandle] = useState('');
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [platformHandles, setPlatformHandles] = useState<Record<string, string>>({});
  
  // Email state
  const [email, setEmail] = useState('');
  
  // Setup steps
  const [step, setStep] = useState(1); // 1: Phone, 2: Handle, 3: Review

  // Focus the phone input field when component mounts
  useEffect(() => {
    if (phoneInputRef.current) {
      // Immediate focus
      phoneInputRef.current.focus();
      
      // Delayed focus as backup for mobile
      setTimeout(() => {
        if (phoneInputRef.current) {
          phoneInputRef.current.focus();
          phoneInputRef.current.click();
        }
      }, 100);
    }

    // Set up blinking cursor effect
    const interval = setInterval(() => {
      setCursorPosition(prev => prev === 0 ? 1 : 0);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Handle phone number changes
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only numbers and limit to 10 digits
    const value = e.target.value.replace(/\D/g, '').substring(0, 10);
    setPhoneNumber(value);
  };

  // Handle universal handle change
  const handleUniversalHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '');
    setUniversalHandle(value);
    
    // Update all platform handles
    const updatedHandles: Record<string, string> = {};
    SOCIAL_PLATFORMS.forEach(platform => {
      updatedHandles[platform.id] = value;
    });
    setPlatformHandles(updatedHandles);
  };

  // Handle individual platform handle change
  const handlePlatformHandleChange = (platform: string, value: string) => {
    setPlatformHandles(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  // Handle Google Sign-in (mock implementation)
  const handleGoogleSignIn = () => {
    // In a real implementation, this would trigger OAuth flow
    // For now, we'll just mock setting the email
    setEmail('user@gmail.com');
    setStep(2);
  };

  // Proceed to universal handle input
  const handleContinueToHandle = () => {
    if (phoneNumber.length === 10) {
      setUserData(prev => ({ ...prev, phone: phoneNumber }));
      setStep(2);
    }
  };

  // Complete profile setup
  const handleCompleteSetup = () => {
    // Create social profiles
    const socialProfiles: SocialProfile[] = [];
    
    Object.entries(platformHandles).forEach(([platform, handle]) => {
      if (handle.trim() !== '') {
        // Ensure platform is a valid SocialProfile platform
        const validPlatform = platform as SocialProfile['platform'];
        socialProfiles.push({
          platform: validPlatform,
          username: handle.trim(),
          shareEnabled: true
        });
      }
    });
    
    // Save all user data
    setUserData(prev => ({
      ...prev,
      phone: phoneNumber,
      email: email,
      socialProfiles: socialProfiles
    }));
    
    // Navigate to profile
    router.push('/profile');
  };

  // Render the underlines for phone number digits
  const renderUnderlines = () => {
    const underlines = [];
    for (let i = 0; i < 10; i++) {
      const digit = phoneNumber[i] || '';
      const isFirstEmpty = phoneNumber.length === i;
      const showCursor = isFirstEmpty && cursorPosition === 1;
      
      underlines.push(
        <div key={i} style={{ 
          width: '24px', 
          display: 'inline-block',
          marginRight: i === 2 || i === 5 ? '8px' : '4px',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold',
            height: '36px',
            lineHeight: '36px'
          }}>
            {digit}
            {showCursor && (
              <span 
                style={{
                  position: 'absolute',
                  width: '2px',
                  height: '24px',
                  backgroundColor: 'var(--primary)',
                  top: '6px',
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              ></span>
            )}
          </div>
          <div style={{ 
            height: '2px', 
            backgroundColor: digit ? 'var(--primary)' : 'var(--card-border)',
            width: '100%' 
          }}></div>
        </div>
      );
    }
    return underlines;
  };

  // Render platform handles with icons
  const renderPlatformHandles = () => {
    return SOCIAL_PLATFORMS.map(platform => (
      <div 
        key={platform.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px',
          borderRadius: '12px',
          backgroundColor: 'var(--card-bg)',
          marginBottom: '12px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.2s ease'
        }}
      >
        <div 
          style={{ 
            width: '32px', 
            height: '32px', 
            marginRight: '12px',
            position: 'relative'
          }}
        >
          <Image 
            src={platform.icon} 
            alt={platform.label} 
            width={32} 
            height={32}
          />
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
            {platform.label}
          </div>
          
          {editingPlatform === platform.id ? (
            <input
              type="text"
              value={platformHandles[platform.id] || ''}
              onChange={(e) => handlePlatformHandleChange(platform.id, e.target.value)}
              onBlur={() => setEditingPlatform(null)}
              autoFocus
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid var(--primary)',
                borderRadius: '4px',
                outline: 'none'
              }}
            />
          ) : (
            <div 
              onClick={() => setEditingPlatform(platform.id)}
              style={{ 
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              {platformHandles[platform.id] ? (
                <span>{platform.prefix}{platformHandles[platform.id]}</span>
              ) : (
                <span style={{ color: 'var(--card-border)' }}>Add your {platform.label} username</span>
              )}
            </div>
          )}
        </div>
      </div>
    ));
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
        paddingTop: '6vh',
        paddingBottom: '6vh',
        paddingLeft: '16px',
        paddingRight: '16px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          animation: 'fadeIn 0.3s ease-out forwards'
        }}
      >
        {/* Step 1: Phone Number */}
        {step === 1 && (
          <>
            <h1 
              style={{ 
                color: 'var(--primary)',
                fontSize: '32px',
                fontWeight: 'bold',
                marginBottom: '24px',
                textAlign: 'center',
                width: '100%'
              }}
            >
              Create Your Profile
            </h1>
            
            <div style={{ 
              width: '100%', 
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <input
                ref={phoneInputRef}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                aria-label="Phone Number"
                autoFocus={true}
                style={{
                  opacity: 0,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  fontSize: '24px',
                  cursor: 'default'
                }}
              />
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                width: '100%',
                userSelect: 'none'
              }}>
                {renderUnderlines()}
              </div>
            </div>
            
            <button
              onClick={handleContinueToHandle}
              disabled={phoneNumber.length !== 10}
              style={{
                ...primaryButtonStyle,
                backgroundColor: phoneNumber.length === 10 ? 'var(--primary)' : 'var(--card-border)',
                cursor: phoneNumber.length === 10 ? 'pointer' : 'not-allowed'
              }}
            >
              Continue
            </button>
            
            <div style={{ marginTop: '20px', width: '100%', textAlign: 'center' }}>
              <div style={{ margin: '16px 0', color: 'var(--secondary-dark)', fontSize: '14px' }}>or</div>
            </div>
            
            <button
              onClick={handleGoogleSignIn}
              style={{
                ...secondaryButtonStyle,
                marginBottom: '24px'
              }}
            >
              <Image 
                src="/icons/google.svg" 
                alt="Google" 
                width={20} 
                height={20}
                style={{ marginRight: '12px' }}
              />
              Sign in with Google
            </button>
          </>
        )}
        
        {/* Step 2: Universal Handle */}
        {step === 2 && (
          <>
            <h1 
              style={{ 
                color: 'var(--primary)',
                fontSize: '28px',
                fontWeight: 'bold',
                marginBottom: '16px',
                textAlign: 'center',
                width: '100%'
              }}
            >
              Your Social Profiles
            </h1>
            
            <div 
              style={{ 
                width: '100%',
                marginBottom: '24px'
              }}
            >
              <div
                style={{
                  marginBottom: '24px',
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--card-bg)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <label
                  htmlFor="universal-handle"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: 'var(--foreground)'
                  }}
                >
                  Your Universal Handle
                </label>
                
                <input
                  id="universal-handle"
                  type="text"
                  value={universalHandle}
                  onChange={handleUniversalHandleChange}
                  placeholder="e.g., alexweingart"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '16px',
                    borderRadius: '8px',
                    border: '1px solid var(--card-border)',
                    backgroundColor: 'white',
                    color: 'var(--foreground)',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                />
                
                <p style={{ fontSize: '14px', color: 'var(--secondary-dark)', marginTop: '8px' }}>
                  We'll use this for all your social profiles
                </p>
              </div>
              
              <div style={{ marginBottom: '16px', fontWeight: '500', fontSize: '18px' }}>
                Your Profiles
              </div>
              
              {renderPlatformHandles()}
            </div>
            
            <button
              onClick={handleCompleteSetup}
              style={primaryButtonStyle}
            >
              Complete Setup
            </button>
            
            <p style={{ 
              marginTop: '12px', 
              fontSize: '14px', 
              color: 'var(--secondary-dark)',
              textAlign: 'center'
            }}>
              All profiles are optional. You can edit them later.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default SetupProfile;
