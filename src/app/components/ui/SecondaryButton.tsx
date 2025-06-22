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
        "bg-white/80 px-3 py-1 rounded-xl text-black hover:bg-white text-sm transition-all duration-200 active:scale-95 disabled:opacity-50",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
