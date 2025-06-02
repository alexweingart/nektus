import React, { forwardRef, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface CustomInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  className?: string;
  inputClassName?: string;
  icon: ReactNode;
  iconClassName?: string;
}

const CustomInput = forwardRef<HTMLInputElement, CustomInputProps>(
  ({ label, error, className = '', inputClassName = '', icon, iconClassName = '', ...props }, ref) => {
    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div 
          className={`flex w-full bg-white/80 border-2 border-white/80 rounded-full transition-all duration-200 text-black text-base h-12 focus-within:bg-white focus-within:border-white focus-within:shadow-2xl`}
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
            className={`flex-1 px-2 pr-6 h-full bg-transparent focus:outline-none text-gray-800 font-medium text-base w-full rounded-r-full ${inputClassName}`}
            style={{
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              borderRadius: '0 9999px 9999px 0',
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

CustomInput.displayName = 'CustomInput';

export default CustomInput;
