"use client"

import * as React from "react"
import ReactPhoneInput from "react-phone-number-input"
import { CountryCode, E164Number } from "libphonenumber-js"

import { cn } from "@/app/utils/cn"

import "react-phone-number-input/style.css"
import "./phone-input.css"

export type PhoneInputProps = React.ComponentPropsWithoutRef<typeof ReactPhoneInput> & {
  onCountryChange?: (country: CountryCode) => void
}

// Custom input component that properly handles focus and prevents autofill issues
const CustomInput = React.memo(({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus retention logic
  const handleFocus = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (props.onFocus) {
      props.onFocus(e);
    }
  }, [props.onFocus]);

  // Ensure input stays in focus after autofill
  React.useEffect(() => {
    const handleAutofillEnd = () => {
      // Short delay to allow browser autofill to complete
      setTimeout(() => {
        if (document.activeElement !== inputRef.current && inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    };

    const input = inputRef.current;
    if (input) {
      input.addEventListener('animationstart', handleAutofillEnd);
      return () => {
        input.removeEventListener('animationstart', handleAutofillEnd);
      };
    }
  }, []);

  return (
    <>
      <label htmlFor="phone-input" className="sr-only">Phone number</label>
      <input 
        id="phone-input"
        ref={inputRef} 
        className={className} 
        onFocus={handleFocus}
        {...props} 
      />
    </>
  );
});

CustomInput.displayName = "CustomInput";

const PhoneInput = React.forwardRef<React.ElementRef<"input">, PhoneInputProps>(
  ({ className, onCountryChange, onChange, ...props }, ref) => {
    // Create a ref to maintain focus
    const inputWrapperRef = React.useRef<HTMLDivElement>(null);
    
    // Handle clicks on the wrapper to maintain focus
    const handleWrapperClick = React.useCallback(() => {
      // Find the input element and focus it
      if (inputWrapperRef.current) {
        const input = inputWrapperRef.current.querySelector('input');
        if (input) {
          input.focus();
        }
      }
    }, []);

    return (
      <div className="relative" ref={inputWrapperRef} onClick={handleWrapperClick}>
        <ReactPhoneInput
          className={cn("flex", className)}
          international
          countryCallingCodeEditable={false}
          defaultCountry="US"
          onChange={onChange}
          onCountryChange={(value) => {
            onCountryChange?.(value as CountryCode)
          }}
          autoComplete="tel"
          inputComponent={CustomInput}
          {...props}
        />
      </div>
    )
  }
)
PhoneInput.displayName = "PhoneInput"

export { PhoneInput }