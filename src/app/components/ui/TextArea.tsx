"use client";

import React, { forwardRef, TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  className?: string;
  inputClassName?: string;
}

/**
 * Auto-resizing textarea that matches the Input component's styling.
 * Grows with content up to max-height 200px, then scrolls.
 */
const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, className = '', inputClassName = '', ...props }, ref) => {
    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <textarea
            ref={ref}
            className={`
              w-full bg-white border-2 border-white focus:border-theme rounded-2xl transition-all duration-200
              text-gray-800 font-medium text-base p-3 resize-none min-h-[3.5rem] max-h-[200px]
              focus:outline-none ${inputClassName}
            `}
            style={{
              boxSizing: 'border-box',
              overflowY: 'auto',
            }}
            {...props}
            onInput={(e) => {
              // Auto-resize
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
          />
        </div>
      </div>
    );
  },
);

TextArea.displayName = 'TextArea';

export default TextArea;
