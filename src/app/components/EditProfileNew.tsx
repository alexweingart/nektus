"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile, UserProfile } from '../context/ProfileContext';
import EditTitleBar from './ui/EditTitleBar';
import EditFieldRow from './ui/EditFieldRow';
import ImageCircleUpload from './ui/ImageCircleUpload';
import EditPhoneRow from './ui/EditPhoneRow';
import Input from './ui/Input';
import TextArea from './ui/TextArea';
import SocialIcon from './ui/SocialIcon';
import { LoadingSpinner } from './ui/LoadingSpinner';

// Supported social platforms in the UI order
const SOCIAL_PLATFORMS: Array<
  'facebook' | 'instagram' | 'x' | 'whatsapp' | 'snapchat' | 'telegram' | 'linkedin' | 'wechat'
> = [
  'facebook',
  'instagram',
  'x',
  'whatsapp',
  'snapchat',
  'telegram',
  'linkedin',
  'wechat',
];

export default function EditProfileNew() {
  const router = useRouter();
  const { profile, saveProfile } = useProfile();

  // Draft state local to this component
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load draft from context on mount
  useEffect(() => {
    if (profile) setDraft(JSON.parse(JSON.stringify(profile)) as UserProfile);
  }, [profile]);

  if (!draft) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  /** Generic setter helper */
  const setField = (key: keyof UserProfile, value: any) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  async function handleSave() {
    setIsSaving(true);
    try {
      // saveProfile expects Partial<UserProfile>; spread ensures a plain object
      await saveProfile({ ...draft });
      router.push('/');
    } catch (e) {
      console.error('Error saving profile', e);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-center px-4 w-full max-w-[320px] mx-auto text-white">
      {/* Title bar */}
      <EditTitleBar onBack={() => router.back()} onSave={handleSave} isSaving={isSaving} />

      {/* Avatar + Name */}
      <EditFieldRow
        icon={
          <ImageCircleUpload
            src={draft.profileImage || '/default-avatar.png'}
            onChange={(data) => setField('profileImage', data)}
            label="Profile photo"
          />
        }
        label="Name"
      >
        <Input
          value={draft.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Your name"
          className="w-full"
        />
      </EditFieldRow>

      {/* Background + Bio */}
      <EditFieldRow
        icon={
          <ImageCircleUpload
            src={draft.backgroundImage || '/default-bg.png'}
            onChange={(data) => setField('backgroundImage', data)}
            label="Background image"
          />
        }
        label="Bio"
      >
        <TextArea
          value={draft.bio || ''}
          onChange={(e) => setField('bio', e.target.value)}
          placeholder="Your bio"
          className="w-full"
        />
      </EditFieldRow>

      {/* Phone row */}
      <EditPhoneRow
        value={draft.contactChannels.phoneInfo?.nationalPhone || ''}
        onChange={(val) =>
          setDraft((prev) =>
            prev
              ? {
                  ...prev,
                  contactChannels: {
                    ...prev.contactChannels,
                    phoneInfo: {
                      ...prev.contactChannels.phoneInfo,
                      nationalPhone: val,
                    },
                  },
                }
              : prev,
          )
        }
      />

      {/* Social rows */}
      {SOCIAL_PLATFORMS.map((platform) => {
        const channel = (draft.contactChannels as any)[platform] as { username: string } | undefined;
        return (
          <EditFieldRow
            key={platform}
            icon={
              <div className="flex items-center justify-center w-full h-full">
                <SocialIcon platform={platform as any} size="md" />
              </div>
            }
            label={platform}
          >
            <Input
              value={channel?.username || ''}
              onChange={(e) => {
                const username = e.target.value;
                setDraft((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    contactChannels: {
                      ...prev.contactChannels,
                      [platform]: {
                        ...(prev.contactChannels as any)[platform],
                        username,
                      },
                    },
                  } as UserProfile;
                });
              }}
              placeholder={`${platform.charAt(0).toUpperCase() + platform.slice(1)} username`}
              className="w-full"
            />
          </EditFieldRow>
        );
      })}
    </div>
  );
}
