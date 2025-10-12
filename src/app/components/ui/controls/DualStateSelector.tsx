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
          "absolute top-0 bottom-0 bg-white/30 rounded-full transition-all duration-200 ease-out",
          selectedOption === options[0] ? 'left-0' : 'right-0'
        )}
        style={{
          width: '50%'
        }}
      />

      {/* Option buttons */}
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onOptionChange(option)}
          className={cn(
            "relative z-10 px-3 py-1 text-sm font-bold transition-all duration-200 active:scale-95 rounded-full flex-1 text-center",
            "text-white hover:text-white/90",
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
