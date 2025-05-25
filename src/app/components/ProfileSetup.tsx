'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from './ProfileSetup.module.css';
import phoneInputStyles from './PhoneInput.module.css';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';  
import 'react-phone-number-input/style.css';
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

// Extended social profile type with additional properties for UI state
type SocialProfile = Omit<ProfileSocialProfile, 'platform'> & {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'email' | 'phone';
  confirmed?: boolean;
  autoFilled?: boolean;
};

export default function ProfileSetup() {
  // Use session with required: true for faster loading
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      // Use direct navigation for faster redirect
      window.location.href = '/';
    },
  });
  const { profile, isLoading, saveProfile } = useProfile();
  const router = useRouter();
  
  // State management
  const [isSaving, setIsSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  // Use the full phone number with country code for the PhoneInput component
  const [phoneWithCountryCode, setPhoneWithCountryCode] = useState('');
  const [showSocialSettings, setShowSocialSettings] = useState(false);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [editingSocial, setEditingSocial] = useState<SocialProfile['platform'] | null>(null);
  const [socialEditValue, setSocialEditValue] = useState('');
  const [hasCompletedPhone, setHasCompletedPhone] = useState(false);
  
  // Use ref for extracted username to avoid re-renders
  const extractedUsernameRef = React.useRef<string>('');

  // Memoized platform order
  const platformOrder = useMemo<SocialProfile['platform'][]>(() => 
    ['email', 'phone', 'facebook', 'instagram', 'twitter', 'snapchat', 'linkedin', 'whatsapp', 'telegram'], 
  []);

  // Initialize social profiles with email always confirmed (green)
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const userEmail = session.user.email || '';
      const extractedUsername = userEmail.split('@')[0] || '';
      extractedUsernameRef.current = extractedUsername;
      
      // Start with email confirmed (green)
      const initialProfiles: SocialProfile[] = [
        {
          platform: 'email',
          username: userEmail,
          shareEnabled: true,
          filled: true,
          confirmed: true
        }
      ];
      
      // Add all other platforms with extracted username as placeholder
      platformOrder.forEach(platform => {
        if (platform !== 'email') {
          // Add initial social profile
          let username = '';
          let autoFilled = false;
          
          // Use extracted username for social platforms
          if (platform !== 'phone' && platform !== 'whatsapp' && platform !== 'telegram') {
            username = extractedUsername;
            autoFilled = !!extractedUsername;
          }
          
          initialProfiles.push({
            platform,
            username,
            shareEnabled: true,
            filled: !!username,
            autoFilled
          });
        }
      });
      
      setSocialProfiles(initialProfiles);

      // If we already have a phone number from previous setups, initialize it
      if (phoneWithCountryCode) {
        handlePhoneInputChange(phoneWithCountryCode);
      }
    }
  }, []);
  
  // Make sure the email icon is always green in the display
  useEffect(() => {
    if (socialProfiles.length > 0) {
      const emailProfile = socialProfiles.find(p => p.platform === 'email');
      if (emailProfile && !emailProfile.confirmed) {
        const updatedProfiles = socialProfiles.map(profile => {
          if (profile.platform === 'email') {
            return { ...profile, confirmed: true };
          }
          return profile;
        });
        setSocialProfiles(updatedProfiles);
      }
    }
  }, [socialProfiles]);
  
  // Load profile data and initialize social profiles
  useEffect(() => {
    if (!isLoading) {
      const loadAndInitialize = async () => {
        try {
          // Start with current profiles (including email which is already confirmed)
          const updatedProfiles = [...socialProfiles];
          
          // Add default social profiles if they don't exist yet
          if (extractedUsernameRef.current && !updatedProfiles.find(p => p.platform === 'instagram')) {
            // Add all social platforms in grey (empty) state
            platformOrder.forEach(platform => {
              if (platform !== 'email' && !updatedProfiles.find(p => p.platform === platform)) {
                updatedProfiles.push({
                  platform,
                  username: platform === 'phone' ? '' : extractedUsernameRef.current,
                  shareEnabled: true,
                  filled: false,
                  confirmed: false,
                  autoFilled: false
                });
              }
            });
          }
          
          // Handle existing profile data if available
          if (profile) {
            if (profile.phone) {
              const digits = profile.phone.replace(/\D/g, '');
              setPhone(digits);
              setHasCompletedPhone(digits.length >= 10);
              
              // Format the phone number for display - using spaces (000 000 0000)
              let formatted = '';
              if (digits.length > 0) {
                formatted = digits.substring(0, 3);
                if (digits.length > 3) {
                  formatted += ' ' + digits.substring(3, 6);
                  if (digits.length > 6) {
                    formatted += ' ' + digits.substring(6, 10);
                  }
                }
              }
              setFormattedPhone(formatted);
            }
            
            // Update social profiles from saved data
            if (profile.socialProfiles && profile.socialProfiles.length > 0) {
              profile.socialProfiles.forEach(savedProfile => {
                const existingIndex = updatedProfiles.findIndex(p => p.platform === savedProfile.platform);
                if (existingIndex !== -1) {
                  updatedProfiles[existingIndex] = {
                    ...updatedProfiles[existingIndex],
                    ...savedProfile,
                    filled: true,
                    confirmed: true
                  };
                }
              });
            }
          }
          
          // Update the state with the updated profiles
          setSocialProfiles(updatedProfiles);
        } catch (error) {
          console.error('Error loading profile data:', error);
        }
      };
      
      loadAndInitialize();
    }
  }, [isLoading, profile, platformOrder, socialProfiles]);
  
  // Update social profiles when phone number is complete
  useEffect(() => {
    if (phone && phone.length >= 10 && !hasCompletedPhone) {
      setHasCompletedPhone(true);
      updateProfilesWithPhone(phone);
    }
  }, [phone, hasCompletedPhone]);

  // Handle phone number change for the PhoneInput component
  const handlePhoneInputChange = (value: string | undefined) => {
    if (!value) {
      setPhoneWithCountryCode('');
      setPhone('');
      setFormattedPhone('');
      setHasCompletedPhone(false);
      return;
    }
    
    setPhoneWithCountryCode(value);
    
    // Extract just the national number without country code
    const digits = value.replace(/\D/g, '').substring(1); // Remove +1 country code
    setPhone(digits);
    
    // Format for display if needed elsewhere (though the component handles display)
    let formatted = '';
    if (digits.length > 0) {
      formatted = digits.substring(0, 3);
      if (digits.length > 3) {
        formatted += ' ' + digits.substring(3, 6);
        if (digits.length > 6) {
          formatted += ' ' + digits.substring(6, 10);
        }
      }
    }
    setFormattedPhone(formatted);
    
    // Check if phone is a valid number to mark as complete
    setHasCompletedPhone(isValidPhoneNumber(value));
    
    // Auto-update the WhatsApp profile with the phone number
    updateProfilesWithPhone(digits);
  };

  // Update profiles with phone number
  const updateProfilesWithPhone = (phoneNumber: string) => {
    // Update the 'phone' platform profile with the phone number
    setSocialProfiles(prev => {
      const updated = [...prev];
      const phoneIndex = updated.findIndex(p => p.platform === 'phone');
      
      if (phoneIndex !== -1) {
        updated[phoneIndex] = {
          ...updated[phoneIndex],
          username: phoneNumber,
          filled: true,
          confirmed: true
        };
      } else {
        updated.push({
          platform: 'phone',
          username: phoneNumber,
          shareEnabled: true,
          filled: true,
          confirmed: true
        });
      }
      
      // Also update WhatsApp with the same number if it's not already set
      const whatsappIndex = updated.findIndex(p => p.platform === 'whatsapp');
      if (whatsappIndex !== -1 && (!updated[whatsappIndex].username || !updated[whatsappIndex].filled)) {
        updated[whatsappIndex] = {
          ...updated[whatsappIndex],
          username: phoneNumber,
          filled: true,
          autoFilled: true // Mark as auto-filled for visual indication
        };
      }
      
      return updated;
    });
  };
  
  // Handle editing social profile
  const handleEditSocial = (platform: SocialProfile['platform']) => {
    // If social settings aren't shown, show them first
    if (!showSocialSettings) {
      setShowSocialSettings(true);
    }
    
    // Small delay to ensure the section is visible before focusing
    setTimeout(() => {
      const profile = socialProfiles.find(p => p.platform === platform);
      setSocialEditValue(profile?.username || '');
      setEditingSocial(platform);
    }, 100);
  };
  
  // Save edited social profile
  const handleSaveSocialEdit = () => {
    if (!editingSocial) return;
    
    setSocialProfiles(prev => {
      const updated = [...prev];
      const index = updated.findIndex(p => p.platform === editingSocial);
      
      if (index !== -1) {
        updated[index] = {
          ...updated[index],
          username: socialEditValue,
          filled: !!socialEditValue,
          confirmed: !!socialEditValue,
          autoFilled: false // Reset auto-filled flag once manually edited
        };
      }
      
      return updated;
    });
    
    setEditingSocial(null);
    setSocialEditValue('');
  };
  
  // Handle key press in input fields
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (editingSocial) {
        handleSaveSocialEdit();
      } else {
        // Focus the next input or save
        handleSave();
      }
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
      case 'email':
        return '';
      case 'phone':
        return '+';
      default:
        return '';
    }
  };
  
  // Handle saving profile data
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Filter out email and phone profiles and convert to the expected format
      const profilesForSaving = socialProfiles
        .filter(p => p.platform !== 'email' && p.platform !== 'phone')
        .map(({ platform, username, shareEnabled, filled }) => ({
          platform,
          username,
          shareEnabled,
          filled
        })) as ProfileSocialProfile[];
      
      // Save profile data to Firebase
      await saveProfile({
        phone,
        socialProfiles: profilesForSaving
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

  // If no session, return null (redirect is handled by useSession)
  if (!session && status !== 'loading') {
    return null;
  }

  return (
    <div className={styles.profileContainer}>
      {/* Profile Photo and Name */}
      <div className={styles.profileHeader}>
        {session?.user?.image ? (
          <div className={styles.profileImage}>
            <img 
              src={session.user.image} 
              alt={session?.user?.name || 'Profile'} 
              style={{width: '100%', height: '100%', objectFit: 'cover'}}
            />
          </div>
        ) : (
          <div className={styles.profileImagePlaceholder}>
            <span style={{fontSize: '1.5rem', fontWeight: 600}}>{session?.user?.name?.[0] || '?'}</span>
          </div>
        )}
        <h2 className={styles.profileName}>{session?.user?.name}</h2>
      </div>
      
      {/* Social Media Icons Row */}
      <div className={styles.socialIconsRow}>
        {platformOrder.map(platform => {
          const profile = socialProfiles.find(p => p.platform === platform);
          // Handle special cases for icon styling
          let iconClass;
          
          if (platform === 'email') {
            // Force email to always be green (confirmed)
            iconClass = styles.socialIconConfirmed;
          } else if (platform === 'phone') {
            // Phone icon should only be green when exactly 10 digits are entered
            iconClass = phone && phone.length === 10 ? styles.socialIconConfirmed : styles.socialIconDefault;
          } else {
            // Normal behavior for other icons
            iconClass = profile?.confirmed ? styles.socialIconConfirmed : 
                       profile?.autoFilled ? styles.socialIconAutoFilled : 
                       styles.socialIconDefault;
          }
          
          return (
            <div 
              key={platform}
              className={`${styles.socialIcon} ${iconClass}`}
              onClick={() => handleEditSocial(platform)}
            >
              {platform === 'facebook' && <FaFacebook size={20} />}
              {platform === 'instagram' && <FaInstagram size={20} />}
              {platform === 'twitter' && <FaTwitter size={20} />}
              {platform === 'snapchat' && <FaSnapchat size={20} />}
              {platform === 'linkedin' && <FaLinkedin size={20} />}
              {platform === 'whatsapp' && <FaWhatsapp size={20} />}
              {platform === 'telegram' && <FaTelegram size={20} />}
              {platform === 'email' && <FaEnvelope size={20} />}
              {platform === 'phone' && <FaPhone size={20} />}
            </div>
          );
        })}
      </div>
      
      {/* Phone Number Input - With proper masking and mobile support */}
      <div className={styles.formGroup}>
        <div className={phoneInputStyles.phoneInputContainer}>
          <div className={phoneInputStyles.phoneInputWrapper}>
            {/* Country code selector */}
            <div className={phoneInputStyles.countryCodeSelector}>
              <div className={phoneInputStyles.flagIcon}>
                <img src="/us-flag.png" alt="US" className={phoneInputStyles.flagImage} />
              </div>
              <div className={phoneInputStyles.arrowIcon}></div>
            </div>
            
            {/* Custom masked input field with improved behavior */}
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              name="phone"
              autoFocus
              value={formattedPhone || ''}
              placeholder="(___) ___-____"
              className={phoneInputStyles.maskedInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                let value = e.target.value;
                
                // Special handling for autosuggest that might include country code
                if (value.startsWith('1') || value.startsWith('+1')) {
                  // Strip the country code (1 or +1) and process the rest
                  value = value.replace(/^\+?1/, '');
                }
                
                // Get just the digits
                const digits = value.replace(/\D/g, '');
                
                // Format the digits with mask
                let formatted = '';
                if (digits.length > 0) {
                  formatted = `(${digits.slice(0, 3)}`;
                  if (digits.length > 3) {
                    formatted += `) ${digits.slice(3, 6)}`;
                    if (digits.length > 6) {
                      formatted += `-${digits.slice(6, 10)}`;
                    } else if (digits.length === 3) {
                      // Add the closing parenthesis and space to keep cursor in right position
                      formatted += ') ';
                    }
                  }
                }
                
                // Update state
                setFormattedPhone(formatted);
                setPhone(digits);
                setPhoneWithCountryCode(`+1${digits}`);
                setHasCompletedPhone(digits.length === 10);
                
                // Update WhatsApp profile
                if (digits.length > 0) {
                  updateProfilesWithPhone(digits);
                }
              }}
              onFocus={(e) => {
                // Place cursor at the end of the current value
                const value = e.target.value;
                e.target.setSelectionRange(value.length, value.length);
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Social Networks Header (Expandable) */}
      <div 
        className={styles.socialAccordionHeader}
        onClick={() => setShowSocialSettings(!showSocialSettings)}
      >
        <h3 className={styles.socialHeading}>Social Networks</h3>
        <div className={styles.socialAccordionIcon}>
          {showSocialSettings ? <FaChevronUp /> : <FaChevronDown />}
        </div>
      </div>

      {/* Social Network Settings (Collapsible) - New Design with Input Fields */}
      {showSocialSettings && (
        <div className={styles.socialContent}>
          {socialProfiles
            .filter(p => p.platform !== 'email' && p.platform !== 'phone')
            .map((profile) => {
              // Get the appropriate icon for this social platform
              const SocialIcon = (() => {
                switch(profile.platform) {
                  case 'facebook': return FaFacebook;
                  case 'instagram': return FaInstagram;
                  case 'twitter': return FaTwitter;
                  case 'snapchat': return FaSnapchat;
                  case 'linkedin': return FaLinkedin;
                  case 'whatsapp': return FaWhatsapp;
                  case 'telegram': return FaTelegram;
                  default: return null;
                }
              })();
              
              // Generate preview URL based on the platform and username
              const previewUrl = (() => {
                if (!profile.username) return '';
                
                switch(profile.platform) {
                  case 'facebook': return `https://facebook.com/${profile.username}`;
                  case 'instagram': return `https://instagram.com/${profile.username}`;
                  case 'twitter': return `https://twitter.com/${profile.username}`;
                  case 'snapchat': return `https://snapchat.com/add/${profile.username}`;
                  case 'linkedin': return `https://linkedin.com/in/${profile.username}`;
                  case 'whatsapp': return `https://wa.me/${profile.username}`;
                  case 'telegram': return `https://t.me/${profile.username}`;
                  default: return '';
                }
              })();
              
              return (
                <div key={profile.platform} className={phoneInputStyles.socialInputGroup}>
                  <div className={phoneInputStyles.inputContainer}>
                    <div className={phoneInputStyles.inputWrapper}>
                      {/* Social icon on the left */}
                      <div className={phoneInputStyles.iconContainer}>
                        {SocialIcon && <SocialIcon size={20} />}
                      </div>
                      
                      {/* Input field */}
                      <input
                        type="text"
                        value={profile.username || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          // Update the username in socialProfiles
                          const updatedProfiles = socialProfiles.map(p => {
                            if (p.platform === profile.platform) {
                              return {
                                ...p,
                                username: e.target.value,
                                filled: !!e.target.value,
                                confirmed: !!e.target.value
                              };
                            }
                            return p;
                          });
                          setSocialProfiles(updatedProfiles);
                        }}
                        placeholder={`Enter your ${profile.platform} username`}
                        className={phoneInputStyles.maskedInput}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  
                  {/* Preview of the profile URL */}
                  {profile.username && (
                    <div className={phoneInputStyles.profilePreview}>
                      {previewUrl}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
      
      {/* Save Button */}
      <button 
        onClick={handleSave}
        disabled={isSaving}
        className={styles.saveProfileButton}
      >
        {isSaving ? (
          <>
            <div className={styles.loadingSpinner} />
            Saving...
          </>
        ) : 'Save'}
      </button>
    </div>
  );
}
