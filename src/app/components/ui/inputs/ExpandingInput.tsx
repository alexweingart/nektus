/**
 * ExpandingInput - Auto-expanding textarea with optional icon and visibility toggle
 * Unified component for bio fields, custom links, and other expanding text inputs
 */

'use client';

import React, { forwardRef, TextareaHTMLAttributes, useEffect } from 'react';

interface ExpandingInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value?: string;
  onChange?: ((value: string) => void) | ((e: React.ChangeEvent<HTMLTextAreaElement>) => void);
  label?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  variant?: 'default' | 'hideable' | 'white';
  isHidden?: boolean;
  onToggleHide?: () => void;
  icon?: React.ReactNode;
}

/**
 * Auto-resizing textarea component
 * - Basic usage: Simple expanding textarea for bio, etc.
 * - With icon: Add icon on the left side
 * - With visibility toggle: Add eye icon on the right for hide/show
 */
export const ExpandingInput = forwardRef<HTMLTextAreaElement, ExpandingInputProps>(
  ({
    value,
    onChange,
    label,
    placeholder,
    className = '',
    inputClassName = '',
    variant = 'default',
    isHidden = false,
    onToggleHide,
    icon,
    ...props
  }, ref) => {
    // Auto-resize effect
    useEffect(() => {
      const textarea = document.querySelector('textarea[data-expanding-input]') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      }
    }, [value]);

    // Handle both onChange patterns: (value: string) => void and event-based
    const handleChange = onChange ? (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Try string pattern first (new pattern)
      try {
        (onChange as (value: string) => void)(e.target.value);
      } catch {
        // Fallback to event pattern (backwards compatibility)
        (onChange as (e: React.ChangeEvent<HTMLTextAreaElement>) => void)(e);
      }
    } : undefined;

    const hasIconOrToggle = icon || (variant === 'hideable' && onToggleHide);
    const isWhiteVariant = variant === 'white';

    return (
      <>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}

        {hasIconOrToggle ? (
          // Complex version with icon and/or toggle
          <div
            className={`flex items-start w-full ${
              isWhiteVariant
                ? 'bg-white border border-gray-200'
                : 'bg-black/40 border border-white/20'
            } rounded-[1.75rem] transition-all ${
              isWhiteVariant ? 'text-gray-900' : 'text-white'
            } text-base ${
              isWhiteVariant
                ? 'focus-within:bg-gray-50 focus-within:border-gray-300 focus-within:shadow-sm'
                : 'focus-within:bg-black/50 focus-within:border-white/40 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.15)]'
            } ${className || ''}`}
          >
            {/* Icon on the left */}
            {icon && (
              <div className="flex items-center justify-center pl-4 pr-2 py-3 self-center w-14">
                {icon}
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={ref}
              data-expanding-input="true"
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              className={`
                flex-1 bg-transparent focus:outline-none ${
                  isWhiteVariant ? 'text-gray-900' : 'text-white'
                } font-medium text-base resize-none ${
                  isWhiteVariant ? 'placeholder-gray-400' : 'placeholder-white/40'
                }
                ${icon ? 'px-2' : 'pl-6 pr-2'} py-3
                ${inputClassName}
              `}
              style={{
                boxSizing: 'border-box',
                overflow: 'hidden',
                lineHeight: '1.25',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
              {...props}
            />

            {/* Hide/Show toggle on the right */}
            {onToggleHide && variant === 'hideable' && (
              <button
                type="button"
                onClick={onToggleHide}
                className="flex items-center justify-center pr-4 w-12 py-3 self-center text-white/60 hover:text-white transition-colors"
                aria-label={isHidden ? 'Show field' : 'Hide field'}
              >
                {isHidden ? (
                  // Open eye icon (action: show)
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  // Closed eye icon (action: hide)
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        ) : (
          // Simple version without icon or toggle
          <textarea
              ref={ref}
              data-expanding-input="true"
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              className={`
                ${
                  isWhiteVariant
                    ? 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-gray-50 focus:border-gray-300 focus:shadow-sm'
                    : 'bg-black/40 border border-white/20 text-white placeholder-white/40 focus:bg-black/50 focus:border-white/40 focus:shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                } rounded-[1.75rem]
                font-medium text-base px-6 py-3 resize-none
                focus:outline-none focus:rounded-[1.75rem] transition-all
                ${className || ''} ${inputClassName}
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
        )}
      </>
    );
  }
);

ExpandingInput.displayName = 'ExpandingInput';
