'use client';

import React from 'react';
import { DualStateSelector } from './DualStateSelector';

type ProfileViewMode = 'Personal' | 'Work';

interface ProfileViewSelectorProps {
  selectedMode: ProfileViewMode;
  onModeChange: (mode: ProfileViewMode) => void;
  className?: string;
}

export const ProfileViewSelector: React.FC<ProfileViewSelectorProps> = ({
  selectedMode,
  onModeChange,
  className
}) => {
  return (
    <DualStateSelector
      options={['Personal', 'Work']}
      selectedOption={selectedMode}
      onOptionChange={onModeChange}
      className={className}
      minWidth="80px"
    />
  );
};

export type { ProfileViewMode };
