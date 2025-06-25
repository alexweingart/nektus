'use client';
/** @jsxImportSource react */

import React, { useState, useEffect, useRef } from 'react';
import { useProfile } from '../../context/ProfileContext';
import type { UserProfile } from '@/types/profile';
import type { SocialPlatform, SocialProfileFormEntry, ProfileFormData } from '@/types/forms';
import CustomInput from '../ui/CustomInput';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import CustomPhoneInput from '../ui/CustomPhoneInput';
import SocialIcon from '../ui/SocialIcon';
import EditTitleBar from '../ui/EditTitleBar';
import CustomExpandingInput from '../ui/CustomExpandingInput';
import { useProfileSave } from '@/lib/hooks/useProfileSave';
import { profileToFormData } from '@/lib/utils/profileTransforms';
import type { CountryCode } from 'libphonenumber-js';
import { useFreezeScrollOnFocus } from '@/lib/hooks/useFreezeScrollOnFocus';

const EditProfileView: React.FC = () => {
  const { data: session } = useSession();
  const { profile, saveProfile, isSaving: isProfileSaving } = useProfile();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  const [formData, setFormData] = useState<ProfileFormData>(() =>
    profile ? profileToFormData(profile, session?.user) : {
      name: session?.user?.name || '',
      bio: '',
      email: session?.user?.email || '',
      picture: session?.user?.image || '',
      socialProfiles: [],
      backgroundImage: '',
    }
  );
  
  const [digits, setDigits] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>('US');
  const [isDeleting, setIsDeleting] = useState(false);

  const { saveProfileData, isSaving: isSaveHookSaving } = useProfileSave({
    profile: profile || undefined,
    saveProfile,
  });

  const isSaving = isProfileSaving || isSaveHookSaving;

  useFreezeScrollOnFocus(nameInputRef);

  useEffect(() => {
    if (profile) {
      setFormData(profileToFormData(profile, session?.user));
      if (profile.contactChannels?.phoneInfo) {
        const phoneInfo = profile.contactChannels.phoneInfo;
        const phoneNumber = phoneInfo.nationalPhone || phoneInfo.internationalPhone?.replace(/^\+1/, '') || '';
        setDigits(phoneNumber.replace(/\D/g, ''));
      }
    }
  }, [profile, session?.user]);

  // Auto-focus name input on mount for mobile convenience
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const imageData = e.target?.result as string;
      setFormData((prev: ProfileFormData) => ({ ...prev, picture: imageData }));
      
      // Call the new API to upload the profile image
      try {
        await fetch('/api/media/profile-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData }),
        });
      } catch (error) {
        console.error('Error uploading profile image:', error);
        alert('Failed to upload profile image. Please try again.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle social profile input change
  const handleSocialChange = (platform: SocialPlatform, value: string) => {
    setFormData((prev: ProfileFormData) => {
      const updatedProfiles = [...prev.socialProfiles];
      const profileIndex = updatedProfiles.findIndex(p => p.platform === platform);
      
      if (profileIndex >= 0) {
        updatedProfiles[profileIndex] = {
          ...updatedProfiles[profileIndex],
          username: value,
          filled: value.trim() !== ''
        };
      } else {
        updatedProfiles.push({
          platform,
          username: value,
          shareEnabled: true,
          filled: value.trim() !== ''
        });
      }
      
      return { ...prev, socialProfiles: updatedProfiles };
    });
  };
  
  // Get social profile value
  const getSocialProfileValue = (platform: string): string => {
    const socialProfile = formData.socialProfiles.find((p: SocialProfileFormEntry) => p.platform === platform);
    return socialProfile?.username || '';
  };
  
  // Handle save profile
  const handleSave = async (): Promise<void> => {
    await saveProfileData(formData, digits, phoneCountry);
  };
  
  return (
    <div 
      className="min-h-screen flex flex-col items-center px-4 py-4"
    >
      <div className="w-full max-w-[var(--max-content-width,448px)] mb-6">
        <EditTitleBar 
          onBack={() => router.back()}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>
      
      {/* Name Input with Profile Image */}
      <div className="mb-5 w-full max-w-md">
        <CustomInput
          ref={nameInputRef}
          type="text"
          id="name"
          value={formData.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
            setFormData((prev: ProfileFormData) => ({ ...prev, name: e.target.value }))
          }
          placeholder="Full Name"
          className="w-full"
          icon={
            <label className="cursor-pointer flex items-center justify-center w-full h-full">
              {formData.picture ? (
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white">
                  <Image
                    src={formData.picture}
                    alt="Profile"
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.style.display = 'none';
                      setFormData((prev: ProfileFormData) => ({ ...prev, picture: '' }));
                    }}
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400 text-xl">👤</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e)}
              />
            </label>
          }
        />
      </div>

      {/* Bio Input */}
      <div className="mb-5 w-full max-w-md">
        <CustomExpandingInput
          id="bio"
          value={formData.bio}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
            setFormData((prev: ProfileFormData) => ({ ...prev, bio: e.target.value }))
          }
          placeholder="Add a short bio..."
          className="w-full"
          maxLength={280}
        />
      </div>

      {/* Phone Input */}
      <div className="mb-5 w-full max-w-md">
        <CustomPhoneInput
          onChange={(value) => {
            setDigits(value);
          }}
          value={digits}
          placeholder="Phone number"
          className="w-full"
          inputProps={{
            id: "phone-input",
            autoComplete: "tel",
            className: "w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          }}
        />
      </div>

      {/* Social Media Inputs */}
      {['facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'].map((platform) => {
        const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
        const placeholder = 
          platform === 'x' ? 'X username' : 
          platform === 'wechat' ? 'WeChat ID' :
          platform === 'whatsapp' ? 'WhatsApp number' :
          `${platformName} username`;
          
        return (
          <div key={platform} className="mb-5 w-full max-w-[var(--max-content-width,448px)]">
            <CustomInput
              type="text"
              id={platform}
              value={getSocialProfileValue(platform)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                handleSocialChange(platform as SocialPlatform, e.target.value);
              }}
              placeholder={placeholder}
              className="w-full"
              inputClassName="pl-2 text-base"
              icon={
                <div className="w-5 h-5 flex items-center justify-center">
                  <SocialIcon 
                    platform={platform as SocialPlatform} 
                    username={getSocialProfileValue(platform)}
                    size="sm" 
                  />
                </div>
              }
              iconClassName="text-gray-600"
            />
          </div>
        );
      })}
      
      {/* Edit Background */}
      <div className="mb-6 text-center w-full max-w-[var(--max-content-width,448px)]">
        <label htmlFor="background-upload" className="text-theme hover:text-theme-dark font-medium cursor-pointer transition-colors">
          Edit Background
        </label>
        <input 
          type="file" 
          id="background-upload" 
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleImageUpload(e);
            }
          }}
        />
      </div>
      

    </div>
  );
};

export default EditProfileView;
