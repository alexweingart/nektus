import React, { useState, useEffect, useRef } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  FaWhatsapp, 
  FaTelegram, 
  FaFacebook, 
  FaInstagram, 
  FaTwitter, 
  FaSnapchat, 
  FaLinkedin, 
  FaPhone,
  FaEnvelope,
  FaChevronDown,
  FaChevronUp
} from 'react-icons/fa';
import { MdEdit } from 'react-icons/md';
import { useProfile, SocialProfile as ProfileSocialProfile } from '../context/ProfileContext';

type GoogleUser = {
  name: string;
  email: string;
  picture: string;
};

// Use the SocialProfile type from ProfileContext
type SocialProfile = ProfileSocialProfile;

export default function ProfileSetup() {
  const { data: session, status } = useSession();
  const { profile, isLoading, saveProfile } = useProfile();
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [extractedUsername, setExtractedUsername] = useState('');
  const [showSocialSettings, setShowSocialSettings] = useState(false);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [editingSocial, setEditingSocial] = useState<SocialProfile['platform'] | null>(null);
  const [socialEditValue, setSocialEditValue] = useState('');
  
  // Refs for auto-focus
  const phoneInputRef = useRef<HTMLInputElement>(null);

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

  // Handle session changes and extract username from email
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // User is signed in with Google, extract the profile data
      const userEmail = session.user.email || '';
      const username = userEmail.split('@')[0] || '';
      
      setGoogleUser({
        name: session.user.name || '',
        email: userEmail,
        picture: session.user.image || '',
      });
      
      setExtractedUsername(username);
      
      // Advance to the next step
      setStep(2);
      setIsSigningIn(false);
    }
  }, [status, session]);
  
  // Load existing profile data if available
  useEffect(() => {
    if (profile && !isLoading) {
      // Populate form with existing profile data
      if (profile.phone) {
        setPhone(profile.phone);
        // Format the phone number for display
        handlePhoneChange({ target: { value: profile.phone } } as React.ChangeEvent<HTMLInputElement>);
      }
      
      if (profile.socialProfiles && profile.socialProfiles.length > 0) {
        setSocialProfiles(profile.socialProfiles);
      }
    }
  }, [profile, isLoading]);
  
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
  
  // Handle phone number formatting
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Strip all non-numeric characters
    const digits = input.replace(/\D/g, '');
    setPhone(digits);
    
    // Format the phone number as (XXX) XXX-XXXX
    if (digits.length > 0) {
      let formatted = '';
      if (digits.length <= 3) {
        formatted = `(${digits}`;
      } else if (digits.length <= 6) {
        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      } else {
        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
      }
      setFormattedPhone(formatted);
    } else {
      setFormattedPhone('');
    }
  };

  // Update WhatsApp and Telegram profiles based on phone number
  const updateMessagingPlatforms = (phoneNumber: string) => {
    if (phoneNumber.length > 0) {
      // Clean phone number for messaging platforms
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      const updatedProfiles = [...socialProfiles];
      
      // Update WhatsApp
      const whatsappIndex = updatedProfiles.findIndex(p => p.platform === 'whatsapp');
      if (whatsappIndex >= 0) {
        updatedProfiles[whatsappIndex].username = cleanPhone;
        updatedProfiles[whatsappIndex].filled = true;
      } else {
        updatedProfiles.push({
          platform: 'whatsapp',
          username: cleanPhone,
          shareEnabled: true,
          filled: true
        });
      }
      
      // Update Telegram (assuming phone is used for Telegram)
      const telegramIndex = updatedProfiles.findIndex(p => p.platform === 'telegram');
      if (telegramIndex >= 0) {
        updatedProfiles[telegramIndex].username = cleanPhone;
        updatedProfiles[telegramIndex].filled = true;
      } else {
        updatedProfiles.push({
          platform: 'telegram',
          username: cleanPhone,
          shareEnabled: true,
          filled: true
        });
      }
      
      setSocialProfiles(updatedProfiles);
    }
  };

  // Initialize social profiles based on extracted username and phone number
  useEffect(() => {
    if (extractedUsername && !socialProfiles.length) {
      const defaultProfiles: SocialProfile[] = [
        { platform: 'instagram', username: extractedUsername, shareEnabled: true, filled: true },
        { platform: 'twitter', username: extractedUsername, shareEnabled: true, filled: true },
        { platform: 'facebook', username: extractedUsername, shareEnabled: true, filled: true },
        { platform: 'linkedin', username: extractedUsername, shareEnabled: true, filled: true },
        { platform: 'snapchat', username: extractedUsername, shareEnabled: true, filled: true },
      ];
      
      setSocialProfiles(defaultProfiles);
    }
  }, [extractedUsername, socialProfiles.length]);
  
  // Update WhatsApp and Telegram profiles when phone number changes
  useEffect(() => {
    if (phone && phone.length >= 10) {
      updateMessagingPlatforms(phone);
    }
  }, [phone]);

  // Edit a specific social profile handle
  const handleEditSocial = (platform: SocialProfile['platform']) => {
    const profile = socialProfiles.find(p => p.platform === platform);
    setEditingSocial(platform);
    setSocialEditValue(profile?.username || '');
  };
  
  // Save the edited social profile
  const handleSaveSocialEdit = () => {
    if (editingSocial) {
      const updatedProfiles = socialProfiles.map(profile => {
        if (profile.platform === editingSocial) {
          return { ...profile, username: socialEditValue, filled: !!socialEditValue };
        }
        return profile;
      });
      
      setSocialProfiles(updatedProfiles);
      setEditingSocial(null);
      setSocialEditValue('');
    }
  };
  
  // Handle key press in input fields
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingSocial) {
        handleSaveSocialEdit();
      } else {
        handleContinue();
      }
    }
  };
  
  // Initialize social profiles based on extracted username and phone number
  useEffect(() => {
    if (extractedUsername && !socialProfiles.length) {
      const defaultProfiles: SocialProfile[] = [
        { platform: 'instagram', username: extractedUsername, shareEnabled: true, filled: true },
        { platform: 'twitter', username: extractedUsername, shareEnabled: true, filled: true },
        { platform: 'facebook', username: extractedUsername, shareEnabled: true, filled: true },
        { platform: 'linkedin', username: extractedUsername, shareEnabled: true, filled: true },
        { platform: 'snapchat', username: extractedUsername, shareEnabled: true, filled: true },
      ];
      
      setSocialProfiles(defaultProfiles);
    }
  }, [extractedUsername, socialProfiles.length]);
  
  // Update WhatsApp and Telegram profiles when phone number changes
  useEffect(() => {
    if (phone && phone.length >= 10) {
      updateMessagingPlatforms(phone);
    }
  }, [phone]);
  
  // Handle continuing to the next step
  const handleContinue = async () => {
    setIsSaving(true);
    
    try {
      // Save profile data to Firebase
      await saveProfile({
        phone,
        socialProfiles
      });
      
      // Proceed to next step or page using Next.js router
      router.push('/connect');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('There was an error saving your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
        });
      }
      
      setSocialProfiles(updatedProfiles);
    }
  };

  // Get the icon for a social platform
  const getSocialIcon = (platform: SocialProfile['platform']) => {
    switch (platform) {
      case 'facebook':
        return <FaFacebook size={16} />;
      case 'instagram':
        return <FaInstagram size={16} />;
      case 'twitter':
        return <FaTwitter size={16} />;
      case 'snapchat':
        return <FaSnapchat size={16} />;
      case 'linkedin':
        return <FaLinkedin size={16} />;
      case 'whatsapp':
        return <FaWhatsapp size={16} />;
      case 'telegram':
        return <FaTelegram size={16} />;
      default:
        return null;
    }
  };

  // Get the URL prefix for a social platform
  const getSocialPrefix = (platform: SocialProfile['platform']) => {
    switch (platform) {
      case 'facebook':
        return 'facebook.com/';
      case 'instagram':
        return 'instagram.com/';
      case 'twitter':
        return 'twitter.com/';
      case 'snapchat':
        return 'snapchat.com/add/';
      case 'linkedin':
        return 'linkedin.com/in/';
      case 'whatsapp':
        return '+'; // WhatsApp uses phone numbers
      case 'telegram':
        return 't.me/'; // Telegram username
      default:
        return '';
    }
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
              <div style={{ 
                position: 'relative',
                width: '160px',
                height: '160px',
                margin: '0 auto 24px',
              }}>
                <div style={{ 
                  width: '160px', 
                  height: '160px', 
                  borderRadius: '50%', 
                  overflow: 'hidden',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  margin: '0 auto',
                  position: 'relative',
                  zIndex: 1
                }}>
                  <img 
                    src={googleUser.picture}
                    alt={googleUser.name}
                    width={160}
                    height={160}
                    style={{ 
                      borderRadius: '50%',
                      objectFit: 'cover',
                      width: '100%',
                      height: '100%'
                    }}
                  />
                </div>

                {/* Social icons circle around the profile photo */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  {['facebook', 'instagram', 'twitter', 'snapchat', 'linkedin', 'whatsapp', 'telegram']
                    .map((platform, index) => {
                      const angle = (index * (360 / 7)) * (Math.PI / 180);
                      const x = 80 + Math.cos(angle) * 100;
                      const y = 80 + Math.sin(angle) * 100;
                      
                      // Check if the profile exists and has data
                      const profile = socialProfiles.find(p => p.platform === platform);
                      const isFilled = profile?.filled;
                      
                      return (
                        <div 
                          key={platform}
                          style={{
                            position: 'absolute',
                            left: `${x - 20}px`, // 20px is half the icon container size
                            top: `${y - 20}px`,
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: isFilled ? 'var(--primary)' : 'var(--input-bg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            color: isFilled ? 'white' : 'var(--secondary)',
                            zIndex: 2,
                            pointerEvents: 'auto',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleEditSocial(platform as SocialProfile['platform'])}
                        >
                          {getSocialIcon(platform as SocialProfile['platform'])}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            
            <h3 style={{ margin: '0 0 4px 0', fontSize: '24px' }}>{googleUser.name}</h3>
            <p style={{ margin: '0', color: 'var(--secondary)', fontSize: '16px' }}>{googleUser.email}</p>
          </div>
          
          <div style={sectionStyle}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              marginBottom: '16px',
              padding: '12px 16px',
              backgroundColor: 'var(--input-bg)',
              borderRadius: '12px',
            }}>
              <FaPhone size={20} style={{ color: 'var(--primary)', marginRight: '12px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', color: 'var(--secondary)', marginBottom: '4px' }}>Phone Number</div>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formattedPhone}
                  onChange={handlePhoneChange}
                  onKeyPress={handleKeyPress}
                  placeholder="(555) 555-5555"
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '16px',
                    outline: 'none',
                    padding: '4px 0',
                  }}
                  autoComplete="tel"
                  autoFocus
                />
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              marginBottom: '16px',
              padding: '12px 16px',
              backgroundColor: 'var(--input-bg)',
              borderRadius: '12px',
            }}>
              <FaEnvelope size={20} style={{ color: 'var(--primary)', marginRight: '12px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', color: 'var(--secondary)', marginBottom: '4px' }}>Email</div>
                <div style={{ fontSize: '16px' }}>{googleUser.email}</div>
              </div>
            </div>

            {/* Social Networks Section Header with Toggle */}
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '32px',
                marginBottom: '16px',
                cursor: 'pointer',
                padding: '8px 0',
                borderBottom: '1px solid var(--border)'
              }}
              onClick={() => setShowSocialSettings(!showSocialSettings)}
            >
              <h3 style={{ margin: 0, fontSize: '18px' }}>Social Networks</h3>
              {showSocialSettings ? <FaChevronUp /> : <FaChevronDown />}
            </div>

            {/* Social Network Settings (Collapsible) */}
            {showSocialSettings && (
              <div style={{ marginBottom: '24px' }}>
                {/* Social Profile Edit Fields */}
                {socialProfiles.map((profile) => (
                  <div 
                    key={profile.platform}
                    style={{
                      marginBottom: '16px',
                      padding: '12px 16px',
                      backgroundColor: 'var(--input-bg)',
                      borderRadius: '12px',
                    }}
                  >
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: profile.filled ? 'var(--primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: '12px',
                          color: profile.filled ? 'white' : 'var(--primary)'
                        }}>
                          {getSocialIcon(profile.platform)}
                        </div>
                        <div style={{ textTransform: 'capitalize' }}>{profile.platform}</div>
                      </div>
                      <MdEdit 
                        size={20} 
                        style={{ cursor: 'pointer', color: 'var(--secondary)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSocial(profile.platform);
                        }}
                      />
                    </div>
                    
                    {editingSocial === profile.platform ? (
                      <div style={{ 
                        marginTop: '12px',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <div style={{ 
                          color: 'var(--secondary)', 
                          marginRight: '0',
                          fontSize: '14px'
                        }}>
                          {getSocialPrefix(profile.platform)}
                        </div>
                        <input
                          type="text"
                          value={socialEditValue}
                          onChange={(e) => setSocialEditValue(e.target.value)}
                          onKeyPress={handleKeyPress}
                          style={{
                            flex: 1,
                            border: 'none',
                            borderBottom: '1px solid var(--primary)',
                            background: 'transparent',
                            padding: '4px 0',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                          autoFocus
                        />
                        <button
                          onClick={handleSaveSocialEdit}
                          style={{
                            border: 'none',
                            background: 'var(--primary)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            marginLeft: '8px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Save
                        </button>
                      </div>
                    ) : profile.username ? (
                      <div style={{ 
                        marginTop: '8px',
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: '4px',
                        fontSize: '14px',
                        display: 'flex'
                      }}>
                        <span style={{ color: 'var(--secondary)' }}>{getSocialPrefix(profile.platform)}</span>
                        <span>{profile.username}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            
            <button 
              onClick={handleContinue}
              disabled={isSaving}
              style={{
                ...buttonStyle,
                opacity: isSaving ? 0.7 : 1,
                cursor: isSaving ? 'not-allowed' : 'pointer'
              }}
              onMouseOver={!isSaving ? (e) => {
                e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)';
              } : undefined}
              onMouseOut={!isSaving ? (e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)';
              } : undefined}
            >
              {isSaving ? (
                <>
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginRight: '10px',
                      display: 'inline-block'
                    }}
                  /> 
                  Saving...
                </>
              ) : 'Continue'}
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
