/**
 * DualStateSelector - Reusable toggle component with sliding background
 * Used for binary state selection (e.g., Personal/Work, Social/Custom)
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface DualStateSelectorProps<T extends string> {
  options: [T, T]; // Exactly two options
  selectedOption: T;
  onOptionChange: (option: T) => void;
  className?: string;
  minWidth?: string;
}

export function DualStateSelector<T extends string>({
  options,
  selectedOption,
  onOptionChange,
  className,
  minWidth = '80px'
}: DualStateSelectorProps<T>) {
  return (
    <div className={cn(
      "relative bg-black/40 backdrop-blur-sm rounded-full flex",
      className
    )}>
      {/* Background slider for selected state */}
      <div
        className={cn(
          "absolute top-0 bottom-0 bg-white/30 rounded-full",
          selectedOption === options[0] ? 'left-0' : 'right-0'
        )}
        style={{
          width: '50%',
          transition: 'left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), right 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      />

      {/* Option buttons */}
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onOptionChange(option)}
          className={cn(
            "relative z-10 px-3 py-1 text-sm font-bold rounded-full flex-1 text-center",
            "text-white hover:text-white/90 button-release",
            selectedOption === option
              ? "text-white"
              : "text-white/80"
          )}
          style={{ minWidth }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
