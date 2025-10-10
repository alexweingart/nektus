"use client";

import React, { forwardRef, TextareaHTMLAttributes, useEffect } from 'react';

interface CustomExpandingInputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  className?: string;
  inputClassName?: string;
}

/**
 * Auto-resizing textarea that matches the Input component's styling.
 * Grows with content, no scrollbar, with consistent rounded corners.
 */
const CustomExpandingInput = forwardRef<HTMLTextAreaElement, CustomExpandingInputProps>(
  ({ label, className = '', inputClassName = '', ...props }, ref) => {
    // Auto-resize effect
    useEffect(() => {
      const textarea = document.querySelector('textarea[data-resize]') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      }
    }, [props.value]);

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="flex">
          <textarea
            ref={ref}
            data-resize="true"
            className={`
              flex-1 bg-black/40 border border-white/20 rounded-[1.75rem]
              text-white font-medium text-base px-6 py-3 resize-none placeholder-white/40
              focus:outline-none focus:bg-black/50 focus:border-white/40 focus:rounded-[1.75rem] focus:shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all
              ${inputClassName}
            `}
            style={{
              boxSizing: 'border-box',
              overflow: 'hidden',
              lineHeight: '1.25',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
            {...props}
          />
        </div>
      </div>
    );
  },
);

CustomExpandingInput.displayName = 'CustomExpandingInput';

export default CustomExpandingInput;
