'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  className,
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        "bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full text-white font-bold hover:bg-black/50 text-sm transition-all duration-200 active:scale-95 disabled:opacity-50",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
