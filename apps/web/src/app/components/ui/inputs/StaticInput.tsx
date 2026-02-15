/**
 * StaticInput - Fixed-height input field with optional icon and visibility toggle
 * For name, email, and other single-line text fields
 */

import React, { forwardRef, InputHTMLAttributes, ReactNode, useMemo, useRef } from 'react';
import { EyeIcon } from '../elements/EyeIcon';
import { isAndroidPlatform } from '@/client/platform-detection';

interface StaticInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  className?: string;
  inputClassName?: string;
  icon?: ReactNode;
  iconClassName?: string;
  variant?: 'default' | 'hideable';
  isHidden?: boolean;
  onToggleHide?: () => void;
}

export const StaticInput = forwardRef<HTMLInputElement, StaticInputProps>(
  ({ label, error, className = '', inputClassName = '', icon, iconClassName = '', variant = 'default', isHidden = false, onToggleHide, ...props }, ref) => {
    const { onChange, ...inputProps } = props;
    const isComposingRef = useRef(false);
    const isAndroid = useMemo(() => isAndroidPlatform(), []);

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div
          className="flex w-full bg-black/40 border border-white/20 rounded-full transition-all text-white text-base h-12 focus-within:bg-black/50 focus-within:border-white/40 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          style={{
            height: '3.5rem',
            minHeight: '3.5rem',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {icon && (
            <div className={`flex items-center justify-center pl-4 pr-2 h-full w-14 text-white ${iconClassName}`}>
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`flex-1 h-full bg-transparent focus:outline-none text-white font-medium text-base w-full placeholder-white/40 ${
              icon ? 'px-2' : 'px-6'
            } ${
              variant === 'hideable' ? 'pr-8' : icon ? 'pr-6' : 'pr-6'
            } ${
              variant === 'hideable' ? 'rounded-none' : icon ? 'rounded-r-full' : 'rounded-full'
            } ${inputClassName}`}
            style={{
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              borderRadius: variant === 'hideable' ? '0' : icon ? '0 9999px 9999px 0' : '9999px'
            }}
            {...inputProps}
            onChange={(e) => {
              if (isAndroid || !isComposingRef.current) {
                onChange?.(e);
              }
            }}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              onChange?.({ target: e.target, currentTarget: e.currentTarget } as React.ChangeEvent<HTMLInputElement>);
            }}
          />
          {/* Eye icon for hideable variant */}
          {variant === 'hideable' && onToggleHide && (
            <button
              type="button"
              onClick={onToggleHide}
              className="flex items-center justify-center pr-4 h-full w-12 text-white/60 hover:text-white transition-colors"
              aria-label={isHidden ? 'Show field' : 'Hide field'}
            >
              <EyeIcon isOpen={isHidden} />
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

StaticInput.displayName = 'StaticInput';
