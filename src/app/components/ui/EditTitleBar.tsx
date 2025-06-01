"use client";

import React from 'react';
import { FaArrowLeft, FaSave } from 'react-icons/fa';
import { Button } from '@/app/components/ui/Button';
import { Heading } from '@/app/components/ui/typography';
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
    <div className="flex items-center justify-between w-full py-4 px-4">
      {/* Back button */}
      <Button
        variant="circle"
        size="icon"
        aria-label="Go back"
        onClick={onBack}
      >
        <FaArrowLeft className="h-5 w-5" />
      </Button>

      {/* Centered title – negative margin centers between equal-width buttons */}
      <Heading as="h1" className="flex-1 text-center text-white text-lg -ml-12">
        Edit Profile
      </Heading>

      {/* Save button */}
      <Button
        variant="circle"
        size="icon"
        aria-label="Save profile"
        onClick={onSave}
        disabled={isSaving}
      >
        {isSaving ? <LoadingSpinner size="sm" /> : <FaSave className="h-5 w-5" />}
      </Button>
    </div>
  );
};

export default EditTitleBar;
