'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from './ProfileSetup.module.css';
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
      extractedUsernameRef.current = userEmail.split('@')[0] || '';
      
      // Email is immediately confirmed (green)
      setSocialProfiles([{
        platform: 'email',
        username: userEmail,
        shareEnabled: true,
        filled: true,
        confirmed: true
      }]);
    }
  }, []); // Empty dependency array - run only once on mount
  
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
              
              // Format the phone number for display
              let formatted = '';
              if (digits.length > 0) {
                formatted = '(' + digits.substring(0, 3) + ') ';
                if (digits.length > 3) {
                  formatted += digits.substring(3, 6);
                  if (digits.length > 6) {
                    formatted += '-' + digits.substring(6, 10);
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

  // Handle phone number change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Extract digits only
    const digits = e.target.value.replace(/\D/g, '');
    
    // Store raw digits for saving
    setPhone(digits);
    
    // Format the display value
    let formatted = '';
    if (digits.length > 0) {
      formatted = '(' + digits.substring(0, 3) + ') ';
      if (digits.length > 3) {
        formatted += digits.substring(3, 6);
        if (digits.length > 6) {
          formatted += '-' + digits.substring(6, 10);
        }
      }
    }
    setFormattedPhone(formatted);
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
    const profile = socialProfiles.find(p => p.platform === platform);
    setSocialEditValue(profile?.username || '');
    setEditingSocial(platform);
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
          const iconClass = profile?.confirmed ? styles.socialIconConfirmed : 
                      profile?.autoFilled ? styles.socialIconAutoFilled : 
                      styles.socialIconDefault;
          
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
      
      {/* Phone Number Input */}
      <div className={styles.formGroup}>
        <label htmlFor="phone" className={styles.formLabel}>Phone Number</label>
        <input
          type="tel"
          id="phone"
          value={formattedPhone}
          onChange={handlePhoneChange}
          onKeyDown={handleKeyPress}
          placeholder="(555) 555-5555"
          className={styles.formInput}
        />
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

      {/* Social Network Settings (Collapsible) */}
      {showSocialSettings && (
        <div className={styles.socialContent}>
          {socialProfiles
            .filter(p => p.platform !== 'email' && p.platform !== 'phone')
            .map((profile) => {
              const iconClass = profile.confirmed ? styles.socialIconConfirmed : 
                        profile.autoFilled ? styles.socialIconAutoFilled : 
                        styles.socialIconDefault;
              
              return (
                <div key={profile.platform} className={styles.socialCard}>
                  <div className={styles.socialCardHeader}>
                    <div className={styles.socialCardIconContainer}>
                      <div className={`${styles.socialCardIcon} ${iconClass}`}>
                        {profile.platform === 'facebook' && <FaFacebook size={16} />}
                        {profile.platform === 'instagram' && <FaInstagram size={16} />}
                        {profile.platform === 'twitter' && <FaTwitter size={16} />}
                        {profile.platform === 'snapchat' && <FaSnapchat size={16} />}
                        {profile.platform === 'linkedin' && <FaLinkedin size={16} />}
                        {profile.platform === 'whatsapp' && <FaWhatsapp size={16} />}
                        {profile.platform === 'telegram' && <FaTelegram size={16} />}
                      </div>
                      <div className={styles.socialCardName}>{profile.platform}</div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSocial(profile.platform);
                      }}
                      className={styles.editButton}
                    >
                      <MdEdit size={20} />
                    </button>
                  </div>
                  
                  {editingSocial === profile.platform ? (
                    <div className={styles.socialEditForm}>
                      <span className={styles.socialPrefix}>
                        {getSocialPrefix(profile.platform)}
                      </span>
                      <input
                        type="text"
                        value={socialEditValue}
                        onChange={(e) => setSocialEditValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className={styles.socialEditInput}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveSocialEdit}
                        className={styles.saveButton}
                      >
                        Save
                      </button>
                    </div>
                  ) : profile.username ? (
                    <div className={styles.socialValue}>
                      <span className={styles.socialPrefix}>{getSocialPrefix(profile.platform)}</span>
                      <span>{profile.username}</span>
                    </div>
                  ) : null}
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
