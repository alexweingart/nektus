import React, { forwardRef } from 'react';
import PhoneInput, { Country } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { cn } from '@/lib/utils';

export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: Country;
  className?: string;
}

const CustomPhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, onChange, value, defaultCountry = "US", ...props }, ref) => {
    const handleChange = (value: string | undefined) => {
      // Ensure we always pass a string to the parent component's onChange
      onChange(value || '');
    };

    return (
      <div className={cn("phone-input-container", className)}>
        <PhoneInput
          international
          defaultCountry={defaultCountry}
          value={value}
          onChange={handleChange}
          className={cn(
            "flex rounded-md border border-input bg-background",
            "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          )}
          // This works by passing the ref to the internal input element
          inputComponent={React.forwardRef<HTMLInputElement>((inputProps, inputRef) => (
            <input
              {...inputProps}
              {...props}
              ref={(instance) => {
                // Handle both the internal ref from PhoneInput and our forwarded ref
                if (typeof inputRef === 'function') {
                  inputRef(instance);
                } else if (inputRef) {
                  inputRef.current = instance;
                }
                if (typeof ref === 'function') {
                  ref(instance);
                } else if (ref) {
                  ref.current = instance;
                }
              }}
              className={cn(
                "flex-1 bg-transparent px-3 py-2 text-sm outline-none",
                "placeholder:text-muted-foreground"
              )}
            />
          ))}
        />
      </div>
    );
  }
);

CustomPhoneInput.displayName = 'CustomPhoneInput';

export { CustomPhoneInput };
