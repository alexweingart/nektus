'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
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

type SocialProfile = ProfileSocialProfile;

export default function ProfileSetup() {
  const { data: session, status } = useSession();
  const { profile, isLoading, saveProfile } = useProfile();
  const router = useRouter();
  
  const [isSaving, setIsSaving] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [extractedUsername, setExtractedUsername] = useState('');
  const [showSocialSettings, setShowSocialSettings] = useState(false);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [editingSocial, setEditingSocial] = useState<SocialProfile['platform'] | null>(null);
  const [socialEditValue, setSocialEditValue] = useState('');
  
  const phoneInputRef = useRef<HTMLInputElement>(null);

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

  // Initialize social profiles based on extracted username
  useEffect(() => {
    if (extractedUsername && socialProfiles.length === 0) {
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
  
  // Update WhatsApp and Telegram profiles with phone number
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
  
  // Handle editing social profile
  const handleEditSocial = (platform: SocialProfile['platform']) => {
    const profile = socialProfiles.find(p => p.platform === platform);
    setEditingSocial(platform);
    setSocialEditValue(profile?.username || '');
  };
  
  // Save edited social profile
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
        handleSave();
      }
    }
  };
  
  // Handle saving profile data
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Save profile data to Firebase
      await saveProfile({
        phone,
        socialProfiles
      });
      
      // Proceed to connect page
      router.push('/connect');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert('There was an error saving your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Get the icon for a social platform
  const getSocialIcon = (platform: SocialProfile['platform']) => {
    switch (platform) {
      case 'facebook':
        return <FaFacebook size={20} />;
      case 'instagram':
        return <FaInstagram size={20} />;
      case 'twitter':
        return <FaTwitter size={20} />;
      case 'snapchat':
        return <FaSnapchat size={20} />;
      case 'linkedin':
        return <FaLinkedin size={20} />;
      case 'whatsapp':
        return <FaWhatsapp size={20} />;
      case 'telegram':
        return <FaTelegram size={20} />;
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

  // Main container style
  const containerStyle = {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '24px',
    color: 'var(--text)',
  };

  // Button style
  const buttonStyle = {
    display: 'block',
    width: '100%',
    padding: '14px 20px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '100px',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  };

  if (status === 'loading' || isLoading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            margin: '0 auto',
            border: '4px solid rgba(76, 175, 80, 0.3)',
            borderTop: '4px solid var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push('/');
    return null;
  }

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '32px', color: 'var(--primary)', textAlign: 'center' }}>Profile Setup</h1>
      
      {/* Profile Photo and Name */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        {session.user?.image && (
          <img 
            src={session.user.image}
            alt={session.user?.name || 'Profile'}
            style={{ 
              width: '120px', 
              height: '120px', 
              borderRadius: '50%',
              objectFit: 'cover',
              margin: '0 auto 16px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
            }}
          />
        )}
        <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>{session.user?.name}</h2>
      </div>
      
      {/* Social Media Icons Row */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '32px'
      }}>
        <div style={{
          backgroundColor: 'var(--input-bg)',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary)'
        }}>
          <FaEnvelope size={20} />
        </div>
        
        <div style={{
          backgroundColor: 'var(--input-bg)',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary)'
        }}>
          <FaPhone size={20} />
        </div>
        
        {['facebook', 'instagram', 'twitter', 'snapchat', 'linkedin', 'whatsapp', 'telegram'].map(platform => {
          const profile = socialProfiles.find(p => p.platform === platform);
          const isFilled = profile?.filled;
          
          return (
            <div 
              key={platform}
              style={{
                backgroundColor: isFilled ? 'var(--primary)' : 'var(--input-bg)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isFilled ? 'white' : 'var(--primary)',
                cursor: 'pointer'
              }}
              onClick={() => handleEditSocial(platform as SocialProfile['platform'])}
            >
              {getSocialIcon(platform as SocialProfile['platform'])}
            </div>
          );
        })}
      </div>
      
      {/* Phone Number Entry */}
      <div style={{ 
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: 'var(--input-bg)',
        borderRadius: '12px',
      }}>
        <label htmlFor="phone" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--secondary)' }}>
          Phone Number
        </label>
        <input
          id="phone"
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
            padding: '8px 0',
          }}
          autoComplete="tel"
        />
      </div>
      
      {/* Social Networks Section Header with Toggle */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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
      
      {/* Save Button */}
      <button 
        onClick={handleSave}
        disabled={isSaving}
        style={{
          ...buttonStyle,
          opacity: isSaving ? 0.7 : 1,
          cursor: isSaving ? 'not-allowed' : 'pointer'
        }}
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
        ) : 'Save'}
      </button>
      
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
      `}</style>
    </div>
  );
}
