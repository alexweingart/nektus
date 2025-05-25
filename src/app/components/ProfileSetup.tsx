'use client';

import * as React from 'react';
const { useState, useEffect, useMemo } = React;
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PhoneInputAutofill as PhoneInput } from './phone-input-autofill';
import { E164Number, CountryCode, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';
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
  const [phoneWithCountryCode, setPhoneWithCountryCode] = useState<E164Number | undefined>();
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('US');   // keep track of flag
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
                formatted = `(${digits.slice(0, 3)}`;
                if (digits.length > 3) {
                  formatted += `) ${digits.slice(3, 6)}`;
                }
                if (digits.length > 6) {
                  formatted += `-${digits.slice(6, 10)}`;
                }
              }
              setFormattedPhone(formatted);
            }
            
            if (profile.socialProfiles && profile.socialProfiles.length > 0) {
              // Merge existing profiles with our initialized ones
              profile.socialProfiles.forEach(existingProfile => {
                const index = updatedProfiles.findIndex(p => p.platform === existingProfile.platform);
                if (index >= 0) {
                  updatedProfiles[index] = {
                    ...existingProfile,
                    confirmed: existingProfile.filled
                  } as SocialProfile;
                } else {
                  updatedProfiles.push({
                    ...existingProfile,
                    confirmed: existingProfile.filled
                  } as SocialProfile);
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
    const input = e.target.value;
    // Strip non-digits
    const digits = input.replace(/\D/g, '');
    setPhone(digits);
    
    // Format for display
    let formatted = '';
    if (digits.length > 0) {
      formatted = `(${digits.slice(0, 3)}`;
      if (digits.length > 3) {
        formatted += `) ${digits.slice(3, 6)}`;
      }
      if (digits.length > 6) {
        formatted += `-${digits.slice(6, 10)}`;
      }
    }
    setFormattedPhone(formatted);
  };
  
  // Update profiles with phone number
  const updateProfilesWithPhone = (phoneNumber: string) => {
    if (phoneNumber.length >= 10) {
      // Make a copy of profiles to update
      const updatedProfiles = [...socialProfiles];
      
      // First confirm the phone number profile
      const phoneIndex = updatedProfiles.findIndex(p => p.platform === 'phone');
      if (phoneIndex >= 0) {
        updatedProfiles[phoneIndex] = {
          ...updatedProfiles[phoneIndex],
          username: phoneNumber,
          filled: true,
          confirmed: true,
          autoFilled: false
        };
      } else {
        updatedProfiles.push({
          platform: 'phone',
          username: phoneNumber,
          shareEnabled: true,
          filled: true,
          confirmed: true,
          autoFilled: false
        });
      }
      
      // Auto-fill all other profiles with light green
      ['whatsapp', 'telegram', 'facebook', 'instagram', 'twitter', 'linkedin', 'snapchat'].forEach(platform => {
        const index = updatedProfiles.findIndex(p => p.platform === platform as SocialProfile['platform']);
        let value = extractedUsernameRef.current;
        
        // For messaging platforms, use phone number
        if (platform === 'whatsapp' || platform === 'telegram') {
          value = phoneNumber;
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
          return { 
            ...profile, 
            username: socialEditValue, 
            filled: !!socialEditValue,
            confirmed: !!socialEditValue,
            autoFilled: false
          };
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
      
      // Convert national phone number to E.164 format
      const toE164 = () => {
        if (!phoneWithCountryCode) return null;
        const parsed = parsePhoneNumberFromString(phoneWithCountryCode as string, selectedCountry);
        return parsed?.isValid() ? parsed.number /* e.g. +18182926036 */ : null;
      };
      
      const fullNumber = toE164();
      if (!fullNumber) { 
        alert('Invalid phone number'); 
        setIsSaving(false);
        return; 
      }
      
      // Save profile data to Firebase
      await saveProfile({
        phone: fullNumber,
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
    <form
      className="max-w-md mx-auto p-6"
      autoComplete="on"
      onSubmit={(e) => { e.preventDefault(); handleSave(); }}
    >
      {/* Profile Photo and Name */}
      <div className="text-center mb-8">
        {session?.user?.image ? (
          <div className="w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden shadow-md">
            <img 
              src={session.user.image} 
              alt={session.user?.name || 'Profile'} 
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-28 h-28 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <span className="text-2xl font-semibold">{session?.user?.name?.[0] || '?'}</span>
          </div>
        )}
        <h2 className="text-2xl font-semibold" style={{ color: '#2d3748' }}>{session?.user?.name}</h2>
      </div>
      
      {/* Social Media Icons Row */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        {platformOrder.map(platform => {
          const profile = socialProfiles.find(p => p.platform === platform);
          const bgColor = profile?.confirmed ? 'bg-primary text-white' : 
                        profile?.autoFilled ? 'bg-primary-light text-white' : 
                        'bg-muted text-primary';
          
          return (
            <div 
              key={platform}
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer ${bgColor}`}
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
      
      {/* Phone Input Component */}
      <div className="mb-6">
        {/* Invisible to users but visible to accessibility & browser heuristics */}
        <label htmlFor="phone" className="sr-only">
          Phone number
        </label>
        <PhoneInput
          id="phone"              /* ties the <label> to the input */
          placeholder="Phone number" /* backup cue for Android quick-chips */
          /* ---- key props that remove "+1" but keep the flag ---- */
          defaultCountry={selectedCountry}
          international={false}
          withCountryCallingCode={false}
          countryCallingCodeEditable={false}
          autoComplete="tel-national"
          value={phoneWithCountryCode}
          onCountryChange={(c: CountryCode) => setSelectedCountry(c)}
          onChange={(value: E164Number | undefined) => {
            /* 0.  Clear everything on empty */
            if (!value) {
              setPhoneWithCountryCode(undefined);
              setPhone('');
              setHasCompletedPhone(false);
              return;
            }

            // ────────────────────────────────────────────────────────
            // 1.  Normalise the string we got from PhoneInput
            //     • The lib passes *raw user input* when in national mode (no "+").
            //     • Chrome paste bubble can give:
            //         "18182926036"   (11–15 digits, no "+")
            //         "+18182926036"
            //         "(818) 292–6036"  (formatted)
            //     • Users typing give things like "8182926036".
            // ────────────────────────────────────────────────────────
            let digitsOnly = value.toString().replace(/\D/g, '');      // just numbers
            if (digitsOnly.length === 0) return;                       // nothing useful yet

            // If it looks like a full international (+???) without the "+", add it.
            //  US example = 11 digits starting with 1
            const looksLikeInternational = digitsOnly.length >= 11;
            const asPossibleE164 = looksLikeInternational ? '+' + digitsOnly : null;

            // ────────────────────────────────────────────────────────
            // 2.  Try to parse as a valid phone number
            //     • First attempt: global parse (no default country), works if "+…"
            //     • Second attempt: parse with current flag as default.
            // ────────────────────────────────────────────────────────
            let parsed =
              (asPossibleE164 && parsePhoneNumberFromString(asPossibleE164)) ??
              parsePhoneNumberFromString(digitsOnly, selectedCountry);

            // Edge case: Chrome bubble sometimes pastes "1xxxxxxxxxx" (no "+")
            // for US numbers. Handle that explicitly.
            if (!parsed && selectedCountry === 'US' && digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
              parsed = parsePhoneNumberFromString(digitsOnly.slice(1), 'US'); // drop the leading 1
            }

            if (parsed && parsed.isValid()) {
              // 2a.  Update the flag if it changed
              if (parsed.country && parsed.country !== selectedCountry) {
                setSelectedCountry(parsed.country as CountryCode);
              }

              // 2b.  Keep only national digits in component state
              const national = parsed.nationalNumber;                // e.g. "8182926036"
              setPhoneWithCountryCode(national as unknown as E164Number);
              setPhone(national);
              setHasCompletedPhone(national.length >= 10);
              updateProfilesWithPhone(national);
            } else {
              // ─────────────────────────────────────────────────
              // 3.  Fallback: treat whatever we got as plain national digits
              //     (still strips a leading "1" if US & 11 digits)
              // ─────────────────────────────────────────────────
              if (selectedCountry === 'US' && digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
                digitsOnly = digitsOnly.slice(1);
              }
              setPhoneWithCountryCode(digitsOnly as unknown as E164Number);
              setPhone(digitsOnly);
              setHasCompletedPhone(digitsOnly.length >= 10);
              updateProfilesWithPhone(digitsOnly);
            }
          }}
        />
      </div>
      
      {/* Social Networks Section Header with Toggle */}
      <div 
        className="flex justify-between items-center mb-4 cursor-pointer p-2 border-b"
        onClick={() => setShowSocialSettings(!showSocialSettings)}
      >
        <h3 className="text-lg font-medium">Social Networks</h3>
        {showSocialSettings ? <FaChevronUp /> : <FaChevronDown />}
      </div>

      {/* Social Network Settings (Collapsible) */}
      {showSocialSettings && (
        <div className="mb-6 space-y-4">
          {socialProfiles
            .filter(p => p.platform !== 'email' && p.platform !== 'phone')
            .map((profile) => {
              const iconBgColor = profile.confirmed ? 'bg-primary text-white' : 
                        profile.autoFilled ? 'bg-primary-light text-white' : 
                        'bg-muted text-primary';
              
              return (
                <div key={profile.platform} className="bg-muted rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${iconBgColor}`}>
                        {profile.platform === 'facebook' && <FaFacebook size={16} />}
                        {profile.platform === 'instagram' && <FaInstagram size={16} />}
                        {profile.platform === 'twitter' && <FaTwitter size={16} />}
                        {profile.platform === 'snapchat' && <FaSnapchat size={16} />}
                        {profile.platform === 'linkedin' && <FaLinkedin size={16} />}
                        {profile.platform === 'whatsapp' && <FaWhatsapp size={16} />}
                        {profile.platform === 'telegram' && <FaTelegram size={16} />}
                      </div>
                      <div className="capitalize">{profile.platform}</div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSocial(profile.platform);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <MdEdit size={20} />
                    </button>
                  </div>
                  
                  {editingSocial === profile.platform ? (
                    <div className="mt-3 flex items-center">
                      <span className="text-sm text-muted-foreground mr-1">
                        {getSocialPrefix(profile.platform)}
                      </span>
                      <input
                        type="text"
                        value={socialEditValue}
                        onChange={(e) => setSocialEditValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="flex-1 p-2 text-sm border border-input rounded bg-white dark:bg-card"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveSocialEdit}
                        className="ml-2 py-1 px-3 text-xs bg-primary text-white rounded"
                      >
                        Save
                      </button>
                    </div>
                  ) : profile.username ? (
                    <div className="mt-2 pb-1 border-b text-sm flex">
                      <span className="text-muted-foreground">{getSocialPrefix(profile.platform)}</span>
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
        type="submit"
        disabled={isSaving}
        className="w-full py-3 px-4 bg-primary text-white rounded-full font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
      >
        {isSaving ? (
          <>
            <div className="inline-block mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Saving...
          </>
        ) : 'Save'}
      </button>
    </form>
  );
}
