'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'dark' | 'subtle';
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  className,
  disabled,
  variant = 'dark',
  ...props
}) => {
  const variantStyles = {
    dark: "bg-black/40 backdrop-blur-sm hover:bg-black/50",
    subtle: "bg-white/20 border border-white/40 hover:bg-white/30"
  };

  return (
    <button
      className={cn(
        "px-3 py-1 rounded-full text-white font-bold text-sm transition-all duration-200 active:scale-95 disabled:opacity-50",
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