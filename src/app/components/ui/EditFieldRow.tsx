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
  // For name/bio fields, just show the icon directly
  if (label === 'Name' || label === 'Bio') {
    return (
      <div className={cn('grid grid-cols-[3rem_1fr] gap-4 items-center w-full mb-4 last:mb-0', className)}>
        <div className="w-12 h-12 flex-shrink-0">
          {React.isValidElement(icon) && React.cloneElement(icon, {
            ...icon.props,
            className: `${icon.props.className || ''} w-full h-full rounded-full object-cover`,
            style: { 
              ...(icon.props?.style || {}), 
              display: 'block'
            }
          })}
        </div>
        {children}
      </div>
    );
  }

  // For all other fields, use the standard layout with white circle
  return (
    <div className={cn('grid grid-cols-[2.5rem_1fr] gap-2 items-center w-full mb-4 last:mb-0', className)}>
      <div className="w-10 h-10 flex-shrink-0">
        <div className="w-full h-full rounded-full bg-white hover:bg-gray-100 active:bg-gray-200 transition flex items-center justify-center">
          <span className="w-5 h-5 flex items-center justify-center">
            {icon}
          </span>
          <span className="sr-only">{label}</span>
        </div>
      </div>
      <div className="w-full">
        {children}
      </div>
    </div>
  );
};

export default EditFieldRow;
