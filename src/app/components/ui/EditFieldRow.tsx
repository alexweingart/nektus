"use client";

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface EditFieldRowProps {
  /** Circle icon or image shown on the left */
  icon: React.ReactNode;
  /** Label for accessibility – visually hidden but read by screen-readers */
  label: string;
  /** Field content (usually an input) */
  children: React.ReactNode;
  className?: string;
}

/**
 * Base two-column row used on Edit Profile.
 * Left: 3.5rem white circle with the provided icon.
 * Right: flexible content (input / phone input etc).
 */
const EditFieldRow: React.FC<EditFieldRowProps> = ({ icon, label, children, className }) => {
  return (
    <div className={cn('grid grid-cols-[3rem_1fr] gap-4 items-center w-full mb-4 last:mb-0', className)}>
      <div className="flex items-center justify-center w-12 h-12 bg-white rounded-full hover:bg-gray-100 active:bg-gray-200 transition">
        {/* Icon is expected to be sized appropriately (w-6 h-6 etc.) */}
        <span aria-hidden="true">{icon}</span>
        <span className="sr-only">{label}</span>
      </div>
      {children}
    </div>
  );
};

export default EditFieldRow;
