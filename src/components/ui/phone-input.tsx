import React, { forwardRef, useState, ChangeEvent } from 'react';
import { cn } from '@/lib/utils';

export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const CustomPhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, onChange, value, ...props }, ref) => {
    // Format the phone number for display (e.g., (123) 456-7890)
    const formatPhoneNumber = (input: string): string => {
      const digits = input.replace(/\D/g, '');
      
      if (digits.length === 0) return '';
      if (digits.length <= 3) return `(${digits}`;
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    };

    // Handle input change
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      // Extract only digits
      const digits = input.replace(/\D/g, '');
      // Pass the raw digits to parent
      onChange(digits);
    };

    // Format for display
    const displayValue = formatPhoneNumber(value);

    return (
      <div className={cn("relative", className)}>
        <input
          type="tel"
          inputMode="numeric"
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          className={cn(
            "flex h-10 w-full rounded-md border border-input px-3 py-2",
            "bg-background text-sm ring-offset-background file:border-0",
            "file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-muted-foreground focus-visible:outline-none",
            "focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          )}
          {...props}
        />
      </div>
    );
  }
);

CustomPhoneInput.displayName = 'CustomPhoneInput';

export { CustomPhoneInput };
