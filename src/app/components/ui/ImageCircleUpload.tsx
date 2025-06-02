"use client";

import React, { useRef, useState } from 'react';
import Avatar from './Avatar';

interface ImageCircleUploadProps {
  /** Current image src (can be URL or data URI). */
  src: string;
  /** Callback with the new data URI selected by user. */
  onChange: (dataUrl: string) => void;
  /** aria-label for the underlying input */
  label: string;
  /** Optional size of circle, default 3.5rem */
  sizeRem?: number;
}

/**
 * A circular image picker used in Edit Profile for avatar / background thumbs.
 * – Renders a white circular button matching our other circle size.
 * – Clicking/tapping opens native file picker (image/*).
 * – Immediately shows preview when the user selects a file.
 */
const ImageCircleUpload: React.FC<ImageCircleUploadProps> = ({ src, onChange, label, sizeRem = 3.5 }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>(src);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        setPreview(result);
        onChange(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const diameter = `${sizeRem}rem`;

  return (
    <div className="relative" style={{ width: diameter, height: diameter }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute inset-0 w-full h-full p-0 m-0 bg-transparent border-0 rounded-full overflow-hidden"
        aria-label={label}
      >
        {/* Preview image */}
        {preview ? (
          <img 
            src={preview} 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              objectFit: 'cover',
              objectPosition: 'center center',
              display: 'block'
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = '/default-avatar.png';
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gray-200" />
        )}
      </button>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelect}
      />
    </div>
  );
};

export default ImageCircleUpload;
