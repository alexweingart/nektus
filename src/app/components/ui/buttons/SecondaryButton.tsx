'use client';

import React from 'react';
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
  ...props
}) => {
  const variantStyles = {
    dark: "bg-black/60 backdrop-blur-lg hover:bg-white/20",
    subtle: "bg-white/20 backdrop-blur-lg hover:bg-white/40",
    destructive: "bg-red-500/50 backdrop-blur-lg hover:bg-red-500/70 text-white",
    light: "bg-white hover:bg-gray-100 text-gray-900"
  };

  return (
    <button
      className={cn(
        "px-3 py-1 rounded-full text-white font-bold text-sm disabled:opacity-50 button-release",
        variantStyles[variant],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};