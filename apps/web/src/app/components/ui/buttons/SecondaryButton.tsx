'use client';

import React, { useRef } from 'react';
import { cn } from '@/lib/cn';

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'dark' | 'subtle' | 'destructive' | 'light';
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  className,
  disabled,
  variant = 'dark',
  onClick,
  ...props
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const variantStyles = {
    dark: "bg-black/60 backdrop-blur-lg hover:bg-white/20",
    subtle: "bg-white/20 backdrop-blur-lg hover:bg-white/40",
    destructive: "bg-red-500/50 backdrop-blur-lg hover:bg-red-500/70 text-white",
    light: "bg-white hover:bg-gray-100 text-gray-900"
  };

  // iOS fix: Force clear active state on touch end
  const handleTouchEnd = () => {
    // Blur immediately to remove focus/active state
    if (buttonRef.current) {
      buttonRef.current.blur();
    }

    // Force a reflow to ensure active state is cleared
    if (buttonRef.current) {
      void buttonRef.current.offsetHeight;
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Call original onClick if provided
    onClick?.(e);

    // Blur after click to prevent stuck active state
    if (buttonRef.current) {
      buttonRef.current.blur();
    }
  };

  return (
    <button
      ref={buttonRef}
      className={cn(
        "px-3 py-1 rounded-full text-white font-bold text-sm disabled:opacity-50 button-release select-none [-webkit-tap-highlight-color:transparent]",
        variantStyles[variant],
        className
      )}
      disabled={disabled}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      {...props}
    >
      {children}
    </button>
  );
};