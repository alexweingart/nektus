'use client';

import React from 'react';
import Image from 'next/image';
import Avatar from './Avatar';

interface ProfileImageIconProps {
  imageUrl?: string;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  alt?: string;
  profileColors?: string[];
}

const ProfileImageIcon: React.FC<ProfileImageIconProps> = ({
  imageUrl,
  onUpload,
  className = "w-8 h-8",
  alt,
  profileColors
}) => {
  // Helper function to handle Firebase image cache busting
  const getCachebustedImageUrl = (url: string): string => {
    if (url.includes('firebasestorage.app')) {
      const cacheBuster = `cb=${Date.now()}`;
      return url.includes('?') ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
    }
    return url;
  };

  return (
    <label className="cursor-pointer flex items-center justify-center w-full h-full">
      {imageUrl ? (
        <div className={`${className} rounded-full overflow-hidden border-2 border-white`}>
          <Image
            src={getCachebustedImageUrl(imageUrl)}
            alt="Profile"
            width={32}
            height={32}
            className="object-cover object-center w-full h-full"
            unoptimized={imageUrl.includes('firebasestorage.app')}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.style.display = 'none';
            }}
          />
        </div>
      ) : (
        <Avatar src={undefined} alt={alt || 'Profile'} size="sm" profileColors={profileColors} className="w-8 h-8" />
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onUpload}
      />
    </label>
  );
};

export default ProfileImageIcon;