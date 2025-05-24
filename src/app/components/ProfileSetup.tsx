import React, { useState, useEffect, useRef } from 'react';
import { signIn, useSession } from 'next-auth/react';
import Image from 'next/image';
import { 
  FaWhatsapp, 
  FaTelegram, 
  FaFacebook, 
  FaInstagram, 
  FaTwitter, 
  FaSnapchat, 
  FaLinkedin, 
  FaPhone 
} from 'react-icons/fa';

type GoogleUser = {
  name: string;
  email: string;
  picture: string;
};

type SocialProfile = {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram';
  username: string;
  shareEnabled: boolean;
  filled?: boolean;
};

export default function ProfileSetup() {
  const { data: session, status } = useSession();
  const [step, setStep] = useState(1);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [phone, setPhone] = useState('');
  const [handle, setHandle] = useState('');
  const [activeSocialPlatform, setActiveSocialPlatform] = useState<SocialProfile['platform'] | null>(null);
  const [socialInputValue, setSocialInputValue] = useState('');
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [formattedPhone, setFormattedPhone] = useState('');
  
  // Refs for auto-focus
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const handleInputRef = useRef<HTMLInputElement>(null);

  // Styles for various components
  const googleButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px 20px',
    backgroundColor: 'white',
    color: '#444',
    border: '1px solid #ddd',
    borderRadius: '100px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  };

  const containerStyle = {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '24px',
    color: 'var(--text)',
  };

  const headerStyle = {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '48px',
    color: 'var(--primary)',
    textAlign: 'center' as const,
  };

  const sectionStyle = {
    width: '100%',
    padding: '24px 0',
    marginBottom: '24px',
  };

  const inputStyle = {
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    marginBottom: '24px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text)',
    fontSize: '16px',
  };

  const buttonStyle = {
    display: 'block',
    width: '100%',
    padding: '14px 20px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '100px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  };

  const tabsContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '32px',
    width: '100%',
    borderBottom: '1px solid var(--border)',
  };

  const tabStyle = {
    padding: '12px 16px',
    marginRight: '8px',
    borderRadius: '8px 8px 0 0',
    backgroundColor: 'transparent',
    color: 'var(--secondary)',
    border: 'none',
    cursor: 'default',
    fontWeight: 500,
    fontSize: '14px',
    opacity: 0.7,
  };

  const activeTabStyle = {
    ...tabStyle,
    backgroundColor: 'var(--primary)',
    color: 'white',
    opacity: 1,
  };

  // Handle session changes
  useEffect(() => {
    if (status === 'authenticated' && session.user) {
      // User is signed in with Google, extract the profile data
      setGoogleUser({
        name: session.user.name || '',
        email: session.user.email || '',
        picture: session.user.image || '',
      });
      
      // Advance to the next step
      setStep(2);
      setIsSigningIn(false);
    }
  }, [status, session]);
  
  // Auto-focus on phone input when the component mounts or when step changes to 2
  useEffect(() => {
    if (step === 2 && phoneInputRef.current) {
      // Focus on phone input field
      setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 300);
    }
  }, [step, phoneInputRef]);
  
  // Handle effects on component mount
  useEffect(() => {
    // Clear any localStorage flag after checking it once
    const cleanup = () => {
      localStorage.removeItem('nektus_force_account_selector');
    };
    
    return cleanup;
  }, []);
  
  // Reliable Google Sign-in handler for mobile contact exchange app
  const handleGoogleSignIn = () => {
    // Show loading state
    setIsSigningIn(true);
    
    // Check if we should force the account selector 
    // (either from localStorage flag or always for first-time users)
    const forceAccountSelector = localStorage.getItem('nektus_force_account_selector') === 'true';
    
    // Clear the flag immediately after checking it
    if (forceAccountSelector) {
      localStorage.removeItem('nektus_force_account_selector');
    }
    
    // Sign in with appropriate options
    signIn('google', { 
      callbackUrl: '/setup',
      // Only force account selection if the flag was set or it's a new user
      ...(forceAccountSelector ? { prompt: 'select_account' } : {})
    });
    
    // Reset loading state after timeout to avoid stuck UI
    setTimeout(() => {
      if (isSigningIn) setIsSigningIn(false);
    }, 20000); // 20 seconds is plenty for the OAuth flow
  };
  
  // Handle phone number changes
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const digits = e.target.value.replace(/\D/g, '');
    setPhone(digits);
    
    // Format the phone number for display (US format: (XXX) XXX-XXXX)
    if (digits.length > 0) {
      let formatted = '';
      
      if (digits.length <= 3) {
        formatted = digits;
      } else if (digits.length <= 6) {
        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      } else {
        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
      }
      
      setFormattedPhone(formatted);
      
      // Update WhatsApp and Telegram profiles when phone changes
      updateMessagingPlatforms(digits);
    } else {
      setFormattedPhone('');
    }
  };
  
  // Update WhatsApp and Telegram profiles based on phone number
  const updateMessagingPlatforms = (phoneNumber: string) => {
    if (phoneNumber.length >= 10) {
      // Find and update or add WhatsApp
      const whatsappIndex = socialProfiles.findIndex(p => p.platform === 'whatsapp');
      if (whatsappIndex >= 0) {
        const updatedProfiles = [...socialProfiles];
        updatedProfiles[whatsappIndex].username = phoneNumber;
        updatedProfiles[whatsappIndex].filled = true;
        setSocialProfiles(updatedProfiles);
      } else {
        setSocialProfiles([...socialProfiles, {
          platform: 'whatsapp',
          username: phoneNumber,
          shareEnabled: true,
          filled: true
        }]);
      }
      
      // Find and update or add Telegram
      const telegramIndex = socialProfiles.findIndex(p => p.platform === 'telegram');
      if (telegramIndex >= 0) {
        const updatedProfiles = [...socialProfiles];
        updatedProfiles[telegramIndex].username = phoneNumber;
        updatedProfiles[telegramIndex].filled = true;
        setSocialProfiles(updatedProfiles);
      } else {
        setSocialProfiles(prev => [...prev, {
          platform: 'telegram',
          username: phoneNumber,
          shareEnabled: true,
          filled: true
        }]);
      }
    }
  };
  
  // Handle social handle changes
  const handleHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '');
    setHandle(value);
    
    // Update social profiles when handle changes
    if (value) {
      updateSocialPlatforms(value);
    }
  };
  
  // Update social platforms based on handle
  const updateSocialPlatforms = (handleValue: string) => {
    if (handleValue.length > 0) {
      // Update or add Facebook, Instagram, Twitter, LinkedIn, Snapchat
      const platforms: SocialProfile['platform'][] = [
        'facebook', 'instagram', 'twitter', 'linkedin', 'snapchat'
      ];
      
      const updatedProfiles = [...socialProfiles];
      
      platforms.forEach(platform => {
        const index = updatedProfiles.findIndex(p => p.platform === platform);
        if (index >= 0) {
          updatedProfiles[index].username = handleValue;
          updatedProfiles[index].filled = true;
        } else {
          updatedProfiles.push({
            platform,
            username: handleValue,
            shareEnabled: true,
            filled: true
          });
        }
      });
      
      setSocialProfiles(updatedProfiles);
    }
  };
  
  // Handle key press in input fields
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, field: 'phone' | 'handle') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'phone' && handleInputRef.current) {
        handleInputRef.current.focus();
      } else if (field === 'handle') {
        handleContinue();
      }
    }
  };
  
  // Handle continuing to the next step
  const handleContinue = () => {
    // Save profile data and proceed
    // In a real app, you would save this data to a database
    console.log('Profile data:', {
      googleUser,
      phone,
      handle,
      socialProfiles
    });
    
    // Proceed to next step or page
    window.location.href = '/connect';
  };
  
  // Handle clicking on a social icon
  const handleSocialIconClick = (platform: SocialProfile['platform']) => {
    // Set the active platform
    setActiveSocialPlatform(platform === activeSocialPlatform ? null : platform);
    
    // Pre-populate the input field based on the platform
    if (platform === activeSocialPlatform) {
      setSocialInputValue('');
    } else {
      const profile = socialProfiles.find(p => p.platform === platform);
      setSocialInputValue(profile?.username || '');
    }
  };
  
  // Update social profile value
  const handleSocialInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSocialInputValue(e.target.value);
    
    // Update the social profile in real-time
    if (activeSocialPlatform) {
      const updatedProfiles = [...socialProfiles];
      const index = updatedProfiles.findIndex(p => p.platform === activeSocialPlatform);
      
      if (index >= 0) {
        updatedProfiles[index].username = e.target.value;
        updatedProfiles[index].filled = !!e.target.value;
      } else if (e.target.value) {
        updatedProfiles.push({
          platform: activeSocialPlatform,
          username: e.target.value,
          shareEnabled: true,
          filled: true
        });
      }
      
      setSocialProfiles(updatedProfiles);
    }
  };

  // Get the style for a social icon based on its state
  const getSocialIconStyle = (platform: SocialProfile['platform']) => {
    const profile = socialProfiles.find(p => p.platform === platform);
    const isActive = activeSocialPlatform === platform;
    const isFilled = profile?.filled;
    
    return {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      backgroundColor: isActive ? 'var(--primary)' : isFilled ? 'var(--primary-light)' : 'var(--input-bg)',
      color: isActive || isFilled ? 'white' : 'var(--secondary)',
      cursor: 'pointer',
      marginRight: '8px',
      transition: 'all 0.2s ease-in-out',
    };
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      {step === 1 && (
        <div style={containerStyle}>
          <h1 style={headerStyle}>Sign in</h1>
          
          <div style={sectionStyle}>
            <button 
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              style={{
                ...googleButtonStyle,
                opacity: isSigningIn ? 0.7 : 1,
                cursor: isSigningIn ? 'default' : 'pointer',
              }}
            >
              {isSigningIn ? (
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid #ddd',
                    borderTopColor: '#666',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '10px',
                  }}
                />
              ) : (
                <svg 
                  width="18" 
                  height="18" 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 48 48"
                  style={{ marginRight: '10px' }}
                >
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                </svg>
              )}
              {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
            </button>
          </div>
        </div>
      )}
      
      {step === 2 && googleUser && (
        <div style={containerStyle}>
          <h1 style={headerStyle}>Create Your Profile</h1>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '32px',
          }}>
            {googleUser.picture && (
              <div style={{ marginBottom: '16px', borderRadius: '50%', overflow: 'hidden' }}>
                <Image 
                  src={googleUser.picture}
                  alt={googleUser.name}
                  width={80}
                  height={80}
                />
              </div>
            )}
            
            <h3 style={{ margin: '0 0 4px 0', fontSize: '24px' }}>{googleUser.name}</h3>
            <p style={{ margin: '0', color: 'var(--secondary)', fontSize: '16px' }}>{googleUser.email}</p>
          </div>
          
          <div style={sectionStyle}>
            <h4 style={{ marginBottom: '16px', fontWeight: 'normal' }}>Enter your phone number</h4>
            <input
              ref={phoneInputRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formattedPhone}
              onChange={handlePhoneChange}
              onKeyPress={(e) => handleKeyPress(e, 'phone')}
              placeholder="(555) 555-5555"
              style={inputStyle}
              autoFocus
            />
            
            <h4 style={{ marginBottom: '16px', fontWeight: 'normal' }}>Social handle</h4>
            <input
              ref={handleInputRef}
              type="text"
              value={handle}
              onChange={handleHandleChange}
              onKeyPress={(e) => handleKeyPress(e, 'handle')}
              placeholder="yourhandle"
              style={inputStyle}
            />
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center',
              marginBottom: '24px'
            }}>
              <div style={getSocialIconStyle('facebook')} onClick={() => handleSocialIconClick('facebook')}>
                <FaFacebook size={20} />
              </div>
              <div style={getSocialIconStyle('instagram')} onClick={() => handleSocialIconClick('instagram')}>
                <FaInstagram size={20} />
              </div>
              <div style={getSocialIconStyle('twitter')} onClick={() => handleSocialIconClick('twitter')}>
                <FaTwitter size={20} />
              </div>
              <div style={getSocialIconStyle('snapchat')} onClick={() => handleSocialIconClick('snapchat')}>
                <FaSnapchat size={20} />
              </div>
              <div style={getSocialIconStyle('linkedin')} onClick={() => handleSocialIconClick('linkedin')}>
                <FaLinkedin size={20} />
              </div>
              <div style={getSocialIconStyle('whatsapp')} onClick={() => handleSocialIconClick('whatsapp')}>
                <FaWhatsapp size={20} />
              </div>
              <div style={getSocialIconStyle('telegram')} onClick={() => handleSocialIconClick('telegram')}>
                <FaTelegram size={20} />
              </div>
            </div>
            
            {activeSocialPlatform && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  textTransform: 'capitalize'
                }}>
                  {activeSocialPlatform} username
                </label>
                <input
                  type="text"
                  value={socialInputValue}
                  onChange={handleSocialInputChange}
                  placeholder={`Your ${activeSocialPlatform} username`}
                  style={inputStyle}
                  autoFocus
                />
              </div>
            )}
            
            <button 
              onClick={handleContinue}
              style={buttonStyle}
            >
              Continue
            </button>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        :root {
          --primary: #4caf50;
          --primary-light: #81c784;
          --primary-dark: #388e3c;
          --secondary: #666666;
          --secondary-dark: #888888;
          --text: #333333;
          --card-bg: #ffffff;
          --border: #dddddd;
          --input-bg: #f5f5f5;
          --danger: #e53935;
        }
        
        body {
          background-color: #f0f2f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          margin: 0;
          padding: 0;
        }
        
        input[type="tel"] {
          -webkit-text-security: disc;
        }
        
        @media (max-width: 480px) {
          input, select, button {
            font-size: 16px !important; /* Prevent zoom on iOS */
          }
        }
      `}</style>
    </div>
  );
}
