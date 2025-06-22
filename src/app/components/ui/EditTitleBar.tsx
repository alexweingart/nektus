"use client";

import React from 'react';
import { FaArrowLeft, FaSave } from 'react-icons/fa';
import { Button } from '@/app/components/ui/Button';
import { Heading } from './Typography';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';

interface EditTitleBarProps {
  onBack: () => void;
  onSave: () => void;
  isSaving?: boolean;
}

/**
 * Title bar used on the Edit Profile page.
 * Contains:
 *  – Back circle button
 *  – Centered "Edit Profile" title (h1, white)
 *  – Save circle button that can show a spinner while saving
 */
const EditTitleBar: React.FC<EditTitleBarProps> = ({ onBack, onSave, isSaving = false }) => {
  return (
    <div className="relative flex items-center justify-between w-full py-4">
      {/* Back button */}
      <Button
        variant="circle"
        size="icon"
        aria-label="Go back"
        onClick={onBack}
        className="z-10 w-14 h-14"
      >
        <FaArrowLeft className="h-5 w-5" />
      </Button>

      {/* Centered title absolutely to keep perfect center */}
      <Heading
        as="h1"
        className="absolute left-1/2 -translate-x-1/2 text-white text-2xl font-bold"
      >
        Edit Profile
      </Heading>

      {/* Save button */}
      <Button
        variant="circle"
        size="icon"
        aria-label="Save profile"
        onClick={onSave}
        disabled={isSaving}
        className="z-10 w-14 h-14"
      >
        {isSaving ? <LoadingSpinner size="sm" /> : <FaSave className="h-5 w-5" />}
      </Button>
    </div>
  );
};

export default EditTitleBar;
