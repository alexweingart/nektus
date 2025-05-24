'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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

// Extended social profile type with additional properties for UI state
type SocialProfile = Omit<ProfileSocialProfile, 'platform'> & {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'email' | 'phone';
  confirmed?: boolean;
  autoFilled?: boolean;
};

export default function ProfileSetup() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      // Redirect to sign-in if not authenticated
      window.location.href = '/';
    },
  });
  const { profile, isLoading, saveProfile } = useProfile();
  const router = useRouter();
  
  // Performance optimization: use refs instead of state where possible
  const [isSaving, setIsSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [showSocialSettings, setShowSocialSettings] = useState(false);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [editingSocial, setEditingSocial] = useState<SocialProfile['platform'] | null>(null);
  const [socialEditValue, setSocialEditValue] = useState('');
  const [hasCompletedPhone, setHasCompletedPhone] = useState(false);
  
  // Use refs for values that don't need to trigger re-renders
  const extractedUsernameRef = useRef<string>('');
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Handle session changes and extract username from email - runs only once
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // User is signed in with Google, extract the profile data
      const userEmail = session.user.email || '';
      extractedUsernameRef.current = userEmail.split('@')[0] || '';
      
      // Initialize with email always confirmed
      const initialProfiles: SocialProfile[] = [];
      
      // Immediately set email as confirmed (green)
      initialProfiles.push({
        platform: 'email',
        username: userEmail,
        shareEnabled: true,
        filled: true,
        confirmed: true
      });
      
      setSocialProfiles(initialProfiles);
    }
  }, []); // Empty dependency array - run only once on mount
  
  // Load existing profile data and initialize social profiles - runs once when profile is loaded
  useEffect(() => {
    if (!isLoading) {
      const loadAndInitialize = async () => {
        try {
          // Start with current profiles (including email which is already confirmed)
          const updatedProfiles = [...socialProfiles];
          
          // Add default social profiles if they don't exist yet
          if (extractedUsernameRef.current && !updatedProfiles.find(p => p.platform === 'instagram')) {
            const defaultPlatforms = ['instagram', 'twitter', 'facebook', 'linkedin', 'snapchat', 'whatsapp', 'telegram'];
            
            defaultPlatforms.forEach(platform => {
              if (!updatedProfiles.find(p => p.platform === platform)) {
                updatedProfiles.push({
                  platform: platform as SocialProfile['platform'],
                  username: extractedUsernameRef.current,
                  shareEnabled: true,
                  filled: false, // Not filled initially
                  confirmed: false, // Not confirmed initially
                  autoFilled: false // Not auto-filled initially
                });
              }
            });
          }
          
          // Handle existing profile data if available
          if (profile) {
            if (profile.phone) {
              setPhone(profile.phone);
              // Format the phone number for display
              handlePhoneChange({ target: { value: profile.phone } } as React.ChangeEvent<HTMLInputElement>);
              setHasCompletedPhone(profile.phone.length >= 10);
            }
            
            if (profile.socialProfiles && profile.socialProfiles.length > 0) {
              // Merge existing profiles with our initialized ones
              profile.socialProfiles.forEach(existingProfile => {
                const index = updatedProfiles.findIndex(p => p.platform === existingProfile.platform);
                if (index >= 0) {
                  updatedProfiles[index] = {
                    ...existingProfile,
                    confirmed: existingProfile.filled // If it was filled before, it's confirmed
                  };
                } else {
                  updatedProfiles.push({
                    ...existingProfile,
                    confirmed: existingProfile.filled
                  });
                }
              });
            }
          }
          
          setSocialProfiles(updatedProfiles);
        } catch (error) {
          console.error('Error initializing profile:', error);
        }
      };
      
      loadAndInitialize();
    }
  }, [isLoading, profile]);
  
  // Update social profiles when phone number is complete
  useEffect(() => {
    if (phone && phone.length >= 10 && !hasCompletedPhone) {
      setHasCompletedPhone(true);
      updateProfilesWithPhone(phone);
    }
  }, [phone, hasCompletedPhone]);

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
  
  // Add phone profile and auto-fill other profiles with extracted username when phone is complete
  const updateProfilesWithPhone = (phoneNumber: string) => {
    if (phoneNumber.length >= 10) {
      // Clean phone number for messaging platforms
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Make a copy of profiles to update
      const updatedProfiles = [...socialProfiles];
      
      // First confirm the phone number profile
      const phoneIndex = updatedProfiles.findIndex(p => p.platform === 'phone');
      if (phoneIndex >= 0) {
        updatedProfiles[phoneIndex] = {
          ...updatedProfiles[phoneIndex],
          username: cleanPhone,
          filled: true,
          confirmed: true,
          autoFilled: false
        };
      } else {
        updatedProfiles.push({
          platform: 'phone',
          username: cleanPhone,
          shareEnabled: true,
          filled: true,
          confirmed: true,
          autoFilled: false
        });
      }
      
      // Now auto-fill all other profiles
      ['whatsapp', 'telegram', 'facebook', 'instagram', 'twitter', 'linkedin', 'snapchat'].forEach(platform => {
        const index = updatedProfiles.findIndex(p => p.platform === platform);
        let value = extractedUsernameRef.current;
        
        // For messaging platforms, use phone number
        if (platform === 'whatsapp' || platform === 'telegram') {
          value = cleanPhone;
        }
        
        if (index >= 0) {
          // Only auto-fill if not already confirmed
          if (!updatedProfiles[index].confirmed) {
            updatedProfiles[index] = {
              ...updatedProfiles[index],
              username: value,
              filled: true,
              autoFilled: true
            };
          }
        } else {
          updatedProfiles.push({
            platform: platform as SocialProfile['platform'],
            username: value,
            shareEnabled: true,
            filled: true,
            autoFilled: true
          });
        }
      });
      
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
      // Filter out email and phone profiles which are just for UI
      // and convert to the expected ProfileSocialProfile type
      const profilesForSaving = socialProfiles
        .filter(p => p.platform !== 'email' && p.platform !== 'phone')
        .map(({ platform, username, shareEnabled, filled }) => ({
          platform,
          username,
          shareEnabled,
          filled
        }));
      
      // Save profile data to Firebase
      await saveProfile({
        phone,
        socialProfiles: profilesForSaving as ProfileSocialProfile[]
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
      case 'email':
        return <FaEnvelope size={20} />;
      case 'phone':
        return <FaPhone size={20} />;
      default:
        return null;
    }
  };
  
  // Get the background color for an icon based on its state
  const getIconBackgroundColor = (profile?: SocialProfile) => {
    if (!profile) return 'var(--input-bg)'; // Grey for no data
    if (profile.confirmed) return 'var(--primary)'; // Green when confirmed
    if (profile.autoFilled) return 'var(--primary-light)'; // Light green when auto-filled
    return 'var(--input-bg)'; // Grey otherwise
  };
  
  // Get the icon color based on its state
  const getIconColor = (profile?: SocialProfile) => {
    if (!profile) return 'var(--primary)'; // Primary color for no data
    if (profile.confirmed || profile.autoFilled) return 'white'; // White on green/light-green backgrounds
    return 'var(--primary)'; // Primary color otherwise
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
  // Memoized styles for better performance
  const styles = useMemo(() => ({
    container: {
      maxWidth: '480px',
      margin: '0 auto',
      padding: '24px',
      color: 'var(--text)',
    },
    profilePhoto: {
      width: '120px',
      height: '120px',
      borderRadius: '50%',
      objectFit: 'cover' as const,
      margin: '0 auto 16px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
    },
    profileName: {
      fontSize: '24px',
      marginBottom: '24px',
      textAlign: 'center' as const
    },
    iconsRow: {
      display: 'flex',
      justifyContent: 'center',
      flexWrap: 'wrap' as const,
      gap: '12px',
      marginBottom: '32px'
    },
    icon: {
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    },
    phoneInput: {
      width: '100%',
      padding: '12px',
      border: 'none',
      borderRadius: '8px',
      fontSize: '16px',
      marginBottom: '24px',
      backgroundColor: 'var(--input-bg)'
    },
    socialToggle: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
      cursor: 'pointer',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)'
    },
    socialHeader: {
      margin: 0,
      fontSize: '18px'
    },
    socialItem: {
      marginBottom: '16px',
      padding: '12px 16px',
      backgroundColor: 'var(--input-bg)',
      borderRadius: '12px'
    },
    editInput: {
      flex: 1,
      border: 'none',
      borderBottom: '1px solid var(--primary)',
      background: 'transparent',
      padding: '4px 0',
      fontSize: '14px',
      outline: 'none'
    },
    saveButton: {
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
      transition: 'background-color 0.3s'
    },
    spinner: {
      width: '18px',
      height: '18px',
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: 'white',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      marginRight: '10px',
      display: 'inline-block'
    }
  }), []);

  // Use memo for the platform order to avoid recreating on each render
  const platformOrder = useMemo(() => {
    return ['email', 'phone', 'facebook', 'instagram', 'twitter', 'snapchat', 'linkedin', 'whatsapp', 'telegram'] as const;
  }, []);

  // Fast loading handling for optimal performance
  if (!session && status !== 'loading') {
    // Don't use router.push which is client-side - use window.location for immediate redirect
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return null;
  }

  return (
    <div style={styles.container}>
      {/* Profile Photo and Name - no title */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        {session?.user?.image && (
          <img 
            src={session.user.image}
            alt={session.user?.name || 'Profile'}
            style={styles.profilePhoto}
            loading="eager" // Load image immediately for better UX
          />
        )}
        <h2 style={styles.profileName}>{session?.user?.name}</h2>
      </div>
      
      {/* Social Media Icons Row with proper states */}
      <div style={styles.iconsRow}>
        {platformOrder.map(platform => {
          const profile = socialProfiles.find(p => p.platform === platform);
          
          return (
            <div 
              key={platform}
              style={{
                ...styles.icon,
                backgroundColor: getIconBackgroundColor(profile),
                color: getIconColor(profile)
              }}
              onClick={() => handleEditSocial(platform)}
            >
              {getSocialIcon(platform)}
            </div>
          );
        })}
      </div>
      
      {/* Simple Phone Number Entry */}
      <input
        ref={phoneInputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={formattedPhone}
        onChange={handlePhoneChange}
        onKeyPress={handleKeyPress}
        placeholder="(555) 555-5555"
        style={styles.phoneInput}
        autoComplete="tel"
      />
      
      {/* Social Networks Section Header with Toggle */}
      <div 
        style={styles.socialToggle}
        onClick={() => setShowSocialSettings(!showSocialSettings)}
      >
        <h3 style={styles.socialHeader}>Social Networks</h3>
        {showSocialSettings ? <FaChevronUp /> : <FaChevronDown />}
      </div>

      {/* Social Network Settings (Collapsible) */}
      {showSocialSettings && (
        <div style={{ marginBottom: '24px' }}>
          {socialProfiles
            .filter(p => p.platform !== 'email' && p.platform !== 'phone') // Don't show email and phone in the list
            .map((profile) => (
            <div key={profile.platform} style={styles.socialItem}>
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
                    backgroundColor: getIconBackgroundColor(profile),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '12px',
                    color: getIconColor(profile)
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
                    style={styles.editInput}
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
          ...styles.saveButton,
          opacity: isSaving ? 0.7 : 1,
          cursor: isSaving ? 'not-allowed' : 'pointer'
        }}
      >
        {isSaving ? (
          <>
            <div style={styles.spinner} /> 
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
