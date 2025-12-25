/**
 * ExpandingInput - Auto-expanding textarea with optional icon and visibility toggle
 * Unified component for bio fields, custom links, and other expanding text inputs
 */

'use client';

import React, { forwardRef, TextareaHTMLAttributes, useEffect } from 'react';
import { EyeIcon } from '../icons/EyeIcon';

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
            className={`flex items-center w-full min-h-[56px] py-3 ${
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
            style={{ overflow: 'visible' }}
          >
            {/* Icon on the left */}
            {icon && (
              <div className="flex items-center justify-center pl-4 pr-2 w-14">
                {icon}
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={ref}
              data-expanding-input="true"
              rows={1}
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              className={`
                flex-1 bg-transparent focus:outline-none ${
                  isWhiteVariant ? 'text-gray-900 placeholder-gray-400 caret-gray-900' : 'text-white placeholder-white/40 caret-white'
                } font-medium text-base resize-none
                ${icon ? 'pr-2' : 'pr-2 pl-6'}
                ${inputClassName}
              `}
              style={{
                boxSizing: 'border-box',
                overflow: 'visible',
                lineHeight: '1',
                padding: '2px',
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
                className="flex items-center justify-center pr-4 w-12 text-white/60 hover:text-white transition-colors"
                aria-label={isHidden ? 'Show field' : 'Hide field'}
              >
                <EyeIcon isOpen={isHidden} />
              </button>
            )}
          </div>
        ) : (
          // Simple version without icon or toggle - wrapped for vertical centering
          <div
            className={`flex items-center rounded-[1.75rem] min-h-[56px] px-6 py-3 ${
              isWhiteVariant
                ? 'bg-white border border-gray-200 focus-within:bg-gray-50 focus-within:border-gray-300 focus-within:shadow-sm'
                : 'bg-black/40 border border-white/20 focus-within:bg-black/50 focus-within:border-white/40 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.15)]'
            } transition-all ${className || ''}`}
            style={{ overflow: 'visible' }}
          >
            <textarea
              ref={ref}
              data-expanding-input="true"
              rows={1}
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              className={`
                w-full bg-transparent focus:outline-none ${
                  isWhiteVariant ? 'text-gray-900 placeholder-gray-400 caret-gray-900' : 'text-white placeholder-white/40 caret-white'
                } font-medium text-base resize-none
                ${inputClassName}
              `}
              style={{
                boxSizing: 'border-box',
                overflow: 'visible',
                lineHeight: '1',
                padding: '2px',
                display: 'block',
                outline: 'none',
                border: 'none',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
              {...props}
            />
          </div>
        )}
      </>
    );
  }
);

ExpandingInput.displayName = 'ExpandingInput';
