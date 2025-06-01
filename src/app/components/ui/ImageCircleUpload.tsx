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
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="relative flex items-center justify-center bg-white rounded-full overflow-hidden hover:bg-gray-100 active:bg-gray-200 transition shadow-md"
      style={{ width: diameter, height: diameter }}
      aria-label={label}
    >
      {/* Preview image */}
      {preview ? (
        <Avatar src={preview} size="sm" className="!w-full !h-full" />
      ) : (
        <span className="w-6 h-6 rounded-full bg-gray-200" />
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelect}
      />
    </button>
  );
};

export default ImageCircleUpload;
