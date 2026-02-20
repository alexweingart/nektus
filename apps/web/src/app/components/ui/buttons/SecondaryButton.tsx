'use client';

import React from 'react';
import { cn } from '@/client/cn';

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'dark' | 'subtle' | 'ghost' | 'destructive' | 'light';
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  className,
  disabled,
  variant = 'dark',
  ...props
}) => {
  const variantStyles = {
    // Use @media (hover: hover) to only apply hover on non-touch devices
    dark: "bg-black/60 backdrop-blur-lg [@media(hover:hover)]:hover:bg-white/20",
    subtle: "bg-white/20 backdrop-blur-lg [@media(hover:hover)]:hover:bg-white/40",
    ghost: "bg-white/10 [@media(hover:hover)]:hover:bg-white/20",
    destructive: "bg-red-500/50 backdrop-blur-lg [@media(hover:hover)]:hover:bg-red-500/70 text-white",
    light: "bg-white [@media(hover:hover)]:hover:bg-gray-100 text-gray-900"
  };

  return (
    <button
      className={cn(
        "px-3 py-1 rounded-full text-white font-semibold text-sm disabled:opacity-50 button-release select-none [-webkit-tap-highlight-color:transparent]",
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