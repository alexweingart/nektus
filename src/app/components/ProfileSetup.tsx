'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useUser, SocialProfile } from '../context/UserContext';
import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';

// Button styles
const primaryButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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

const googleButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  backgroundColor: 'white',
  color: '#333',
  fontSize: '22px',
  fontWeight: '500',
  padding: '16px 24px',
  borderRadius: '100px',
  boxShadow: 'var(--shadow-md)',
  transition: 'all 0.2s ease-in-out',
  textDecoration: 'none',
  textAlign: 'center' as const,
  border: '1px solid #ddd',
  cursor: 'pointer',
  marginTop: '16px'
};

// Supported social platforms
const SOCIAL_PLATFORMS: Array<{
  id: SocialProfile['platform'];
  label: string;
  icon: string;
  prefix: string;
}> = [
  { id: 'facebook', label: 'Facebook', icon: '/icons/facebook.svg', prefix: '' },
  { id: 'instagram', label: 'Instagram', icon: '/icons/instagram.svg', prefix: '@' },
  { id: 'linkedin', label: 'LinkedIn', icon: '/icons/linkedin.svg', prefix: '' },
  { id: 'twitter', label: 'Twitter', icon: '/icons/twitter.svg', prefix: '@' },
  { id: 'snapchat', label: 'Snapchat', icon: '/icons/snapchat.svg', prefix: '' },
];

// Phone-based platforms
const PHONE_PLATFORMS = [
  { id: 'whatsapp' as const, label: 'WhatsApp', icon: '/icons/whatsapp.svg' },
  { id: 'telegram' as const, label: 'Telegram', icon: '/icons/telegram.svg' },
];

const ProfileSetup: React.FC = () => {
  const router = useRouter();
  const { userData, setUserData, saveUserData } = useUser();
  
  // Setup steps
  // 1: Initial Google Sign-in
  // 2: Phone Number + WhatsApp/Telegram
  // 3: Social Handles
  const [step, setStep] = useState(1);
  
  // User information state
  const [googleUser, setGoogleUser] = useState<{name: string, email: string, picture: string} | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [universalHandle, setUniversalHandle] = useState('');
  const [platformHandles, setPlatformHandles] = useState<Record<string, string>>({});
  
  // Phone settings
  const [usePhoneForWhatsapp, setUsePhoneForWhatsapp] = useState(true);
  const [usePhoneForTelegram, setUsePhoneForTelegram] = useState(false);
  
  // Refs
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const handleInputRef = useRef<HTMLInputElement>(null);
  
  // Set up blinking cursor effect for phone input
  useEffect(() => {
    if (step === 2) {
      const interval = setInterval(() => {
        setCursorPosition(prev => prev === 0 ? 1 : 0);
      }, 500);
      
      // Focus phone input
      if (phoneInputRef.current) {
        phoneInputRef.current.focus();
        
        // Delayed focus for mobile
        setTimeout(() => {
          if (phoneInputRef.current) {
            phoneInputRef.current.focus();
            phoneInputRef.current.click();
          }
        }, 100);
      }
      
      return () => clearInterval(interval);
    }
    
    // Focus handle input for step 3
    if (step === 3 && handleInputRef.current) {
      handleInputRef.current.focus();
    }
  }, [step]);
  
  // Use NextAuth session
  const { data: session, status } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  // Check if user is already authenticated with Google
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // User is signed in with Google, get data from session
      setGoogleUser({
        name: session.user.name || 'User',
        email: session.user.email || '',
        picture: session.user.image || 'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff'
      });
      
      // Proceed to phone number step
      setStep(2);
      setIsSigningIn(false);
    } else if (status === 'unauthenticated') {
      setIsSigningIn(false);
    }
  }, [status, session]);
  
  // Properly handle Google Sign-in with NextAuth - simplified for reliability
  const handleGoogleSignIn = () => {
    // Show loading state in button
    setIsSigningIn(true);
    
    // Basic Google sign-in with minimal options
    signIn('google');
  };
  
  // Handle phone number changes
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only numbers and limit to 10 digits
    const value = e.target.value.replace(/\D/g, '').substring(0, 10);
    setPhoneNumber(value);
  };
  
  // Proceed to social handles step
  const handleContinueToSocial = () => {
    if (phoneNumber.length === 10) {
      // Save phone number and related platforms
      const socialProfiles: SocialProfile[] = [];
      
      // Add WhatsApp if enabled
      if (usePhoneForWhatsapp) {
        socialProfiles.push({
          platform: 'whatsapp',
          username: phoneNumber,
          shareEnabled: true
        });
      }
      
      // Add Telegram if enabled
      if (usePhoneForTelegram) {
        socialProfiles.push({
          platform: 'telegram',
          username: phoneNumber,
          shareEnabled: true
        });
      }
      
      // Update user data
      setUserData({
        ...userData,
        phone: phoneNumber,
        socialProfiles
      });
      
      setStep(3);
    }
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
  
  // Complete profile setup
  const handleCompleteSetup = () => {
    // Create social profiles from existing and new ones
    const socialProfiles = [...userData.socialProfiles];
    
    // Add social platform profiles
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
    setUserData({
      ...userData,
      name: googleUser?.name || '',
      email: googleUser?.email || '',
      socialProfiles
    });
    
    // Save data and navigate to profile
    saveUserData();
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
  const renderSocialPlatforms = () => {
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
          
          <input
            type="text"
            value={platformHandles[platform.id] || ''}
            onChange={(e) => handlePlatformHandleChange(platform.id, e.target.value)}
            placeholder={`${platform.label} username`}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '16px',
              border: '1px solid var(--card-border)',
              borderRadius: '6px',
              outline: 'none'
            }}
          />
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
        {/* Step 1: Google Sign-In */}
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
            
            <p
              style={{
                fontSize: '18px',
                marginBottom: '32px',
                textAlign: 'center',
                color: 'var(--foreground)'
              }}
            >
              Sign in with Google to get started
            </p>
            
            <button
              onClick={handleGoogleSignIn}
              style={{
                ...googleButtonStyle,
                backgroundColor: isSigningIn ? '#cccccc' : 'white',
                cursor: isSigningIn ? 'not-allowed' : 'pointer'
              }}
              disabled={isSigningIn || status === 'loading'}
            >
              {isSigningIn ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div 
                    style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '50%', 
                      border: '2px solid #4caf50',
                      borderTopColor: 'transparent',
                      marginRight: '16px',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                  Signing in...
                </div>
              ) : (
                <>
                  <Image 
                    src="/icons/google.svg" 
                    alt="Google" 
                    width={24} 
                    height={24}
                    style={{ marginRight: '16px' }}
                  />
                  Sign in with Google
                </>
              )}
            </button>
            
            {status === 'authenticated' && (
              <p style={{ marginTop: '12px', fontSize: '14px', textAlign: 'center' }}>
                Redirecting to profile setup...
              </p>
            )}
            
            <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--secondary-dark)', textAlign: 'center' }}>
              Google account required for Nekt.Us
            </p>
          </>
        )}
        
        {/* Step 2: Phone Number + WhatsApp/Telegram */}
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
              Enter Your Phone Number
            </h1>
            
            {googleUser && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '24px',
                  backgroundColor: 'var(--card-bg)',
                  padding: '12px',
                  borderRadius: '12px',
                  width: '100%'
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    marginRight: '12px'
                  }}
                >
                  <img 
                    src={googleUser.picture} 
                    alt={googleUser.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{googleUser.name}</div>
                  <div style={{ fontSize: '14px', color: 'var(--secondary-dark)' }}>{googleUser.email}</div>
                </div>
              </div>
            )}
            
            <div style={{ 
              width: '100%', 
              marginBottom: '32px',
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
            
            <div
              style={{
                width: '100%',
                marginBottom: '24px'
              }}
            >
              <div style={{ fontWeight: '500', marginBottom: '12px' }}>
                Also use this number for:
              </div>
              
              {PHONE_PLATFORMS.map(platform => (
                <div 
                  key={platform.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor: 'var(--card-bg)',
                    borderRadius: '8px'
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
                    {platform.label}
                  </div>
                  
                  <div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={platform.id === 'whatsapp' ? usePhoneForWhatsapp : usePhoneForTelegram}
                        onChange={() => {
                          if (platform.id === 'whatsapp') {
                            setUsePhoneForWhatsapp(prev => !prev);
                          } else {
                            setUsePhoneForTelegram(prev => !prev);
                          }
                        }}
                        style={{ 
                          height: '0',
                          width: '0',
                          visibility: 'hidden'
                        }}
                      />
                      <span 
                        style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: '48px',
                          height: '24px',
                          backgroundColor: platform.id === 'whatsapp' 
                            ? (usePhoneForWhatsapp ? 'var(--primary)' : '#ccc')
                            : (usePhoneForTelegram ? 'var(--primary)' : '#ccc'),
                          borderRadius: '24px',
                          transition: 'all 0.3s',
                          cursor: 'pointer'
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            content: '""',
                            height: '20px',
                            width: '20px',
                            left: platform.id === 'whatsapp' 
                              ? (usePhoneForWhatsapp ? '25px' : '2px')
                              : (usePhoneForTelegram ? '25px' : '2px'),
                            bottom: '2px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            transition: 'all 0.3s'
                          }}
                        ></span>
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleContinueToSocial}
              disabled={phoneNumber.length !== 10}
              style={{
                ...primaryButtonStyle,
                backgroundColor: phoneNumber.length === 10 ? 'var(--primary)' : 'var(--card-border)',
                cursor: phoneNumber.length === 10 ? 'pointer' : 'not-allowed'
              }}
            >
              Continue
            </button>
          </>
        )}
        
        {/* Step 3: Social Handles */}
        {step === 3 && (
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
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: 'var(--card-bg)',
                borderRadius: '12px'
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
                Universal Handle
              </label>
              
              <input
                id="universal-handle"
                ref={handleInputRef}
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
                  outline: 'none'
                }}
              />
              
              <p style={{ fontSize: '14px', color: 'var(--secondary-dark)', marginTop: '8px' }}>
                We'll use this for all your social profiles
              </p>
            </div>
            
            <div style={{ width: '100%', marginBottom: '24px' }}>
              <div style={{ fontWeight: '500', marginBottom: '12px' }}>
                Your Profiles
              </div>
              
              {renderSocialPlatforms()}
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

export default ProfileSetup;
