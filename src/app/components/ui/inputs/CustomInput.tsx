import React, { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

interface CustomInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  className?: string;
  inputClassName?: string;
  icon: ReactNode;
  iconClassName?: string;
  variant?: 'default' | 'hideable';
  isHidden?: boolean;
  onToggleHide?: () => void;
}

const CustomInput = forwardRef<HTMLInputElement, CustomInputProps>(
  ({ label, error, className = '', inputClassName = '', icon, iconClassName = '', variant = 'default', isHidden = false, onToggleHide, ...props }, ref) => {

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div 
          className="flex w-full bg-white/80 border-2 border-white/80 rounded-full transition-all duration-200 text-black text-base h-12 focus-within:bg-white focus-within:border-white focus-within:shadow-2xl"
          style={{
            height: '3.5rem',
            minHeight: '3.5rem',
            display: 'flex',
            alignItems: 'center',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div className={`flex items-center justify-center pl-4 pr-2 h-full w-14 ${iconClassName}`}>
            {icon}
          </div>
          <input
            ref={ref}
            className={`flex-1 px-2 h-full bg-transparent focus:outline-none text-gray-800 font-medium text-base w-full ${
              variant === 'hideable' ? 'pr-8' : 'pr-6'
            } ${
              variant === 'hideable' ? 'rounded-none' : 'rounded-r-full'
            } ${inputClassName}`}
            style={{
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              borderRadius: variant === 'hideable' ? '0' : '0 9999px 9999px 0'
            }}
            {...props}
          />
          {/* Eye icon for hideable variant */}
          {variant === 'hideable' && onToggleHide && (
            <button
              type="button"
              onClick={onToggleHide}
              className="flex items-center justify-center pr-4 h-full w-12 text-gray-600 hover:text-gray-800 transition-colors"
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
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

CustomInput.displayName = 'CustomInput';

export default CustomInput;
