'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

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
  const modes: ProfileViewMode[] = ['Personal', 'Work'];
  
  return (
    <div className={cn(
      "relative bg-black/40 backdrop-blur-sm rounded-full flex",
      className
    )}>
      {/* Background slider for selected state */}
      <div 
        className={cn(
          "absolute top-0 bottom-0 bg-white/30 rounded-full transition-all duration-200 ease-out",
          selectedMode === 'Personal' ? 'left-0' : 'right-0'
        )}
        style={{ 
          width: '50%'
        }}
      />
      
      {/* Mode buttons */}
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          className={cn(
            "relative z-10 px-3 py-1 text-sm font-bold transition-all duration-200 active:scale-95 rounded-full flex-1 text-center",
            "text-white hover:text-white/90",
            selectedMode === mode 
              ? "text-white" 
              : "text-white/80"
          )}
          style={{ minWidth: '80px' }} // Ensure equal width
        >
          {mode}
        </button>
      ))}
    </div>
  );
};

export type { ProfileViewMode };