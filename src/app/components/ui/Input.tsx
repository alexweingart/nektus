import React, { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  className?: string;
  inputClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', inputClassName = '', ...props }, ref) => {
    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div 
          className={`flex w-full bg-white border-2 border-white focus-within:border-theme rounded-full transition-all duration-200 text-black text-base h-12`}
          style={{
            height: '3.5rem',
            minHeight: '3.5rem',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <input
            ref={ref}
            className={`flex-1 px-6 h-full bg-transparent focus:outline-none text-gray-800 font-medium text-base w-full rounded-full ${inputClassName}`}
            style={{
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              borderRadius: '9999px',
            }}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
