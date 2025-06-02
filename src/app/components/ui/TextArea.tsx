"use client";

import React, { forwardRef, TextareaHTMLAttributes, useEffect } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  className?: string;
  inputClassName?: string;
}

/**
 * Auto-resizing textarea that matches the Input component's styling.
 * Grows with content, no scrollbar, with consistent rounded corners.
 */
const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
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
              flex-1 bg-white/80 border-2 border-white/80 rounded-[1.75rem]
              text-gray-800 font-medium text-base px-6 py-3 resize-none
              focus:outline-none focus:bg-white focus:border-white focus:rounded-[1.75rem] focus:shadow-2xl transition-all duration-200
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

TextArea.displayName = 'TextArea';

export default TextArea;
