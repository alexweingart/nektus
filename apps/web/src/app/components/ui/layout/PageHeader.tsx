"use client";

import React from 'react';
import { FaArrowLeft, FaCheck } from 'react-icons/fa';
import { Button } from '@/app/components/ui/buttons/Button';
import { Heading } from '../Typography';
import { LoadingSpinner } from '../elements/LoadingSpinner';

interface PageHeaderProps {
  onBack: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  title?: string;
}

/**
 * Page header component used across various views.
 * Contains:
 *  – Back circle button
 *  – Optional centered title (h1, white)
 *  – Optional save circle button that can show a spinner while saving
 */
const PageHeader: React.FC<PageHeaderProps> = ({ onBack, onSave, isSaving = false, title }) => {
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

      {/* Centered title absolutely to keep perfect center - only show if title is provided */}
      {title && (
        <Heading
          as="h1"
          className="absolute left-1/2 -translate-x-1/2 text-white text-2xl font-bold"
        >
          {title}
        </Heading>
      )}

      {/* Save button - only show if onSave is provided */}
      {onSave && (
        <Button
          variant="circle"
          size="icon"
          aria-label="Save profile"
          onClick={onSave}
          disabled={isSaving}
          className="z-10 w-14 h-14"
        >
          {isSaving ? <LoadingSpinner size="sm" /> : <FaCheck className="h-5 w-5" />}
        </Button>
      )}
    </div>
  );
};

export default PageHeader;
