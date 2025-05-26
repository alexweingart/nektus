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

// Create a special flag to track if component is mounted
const isMountedRef = { current: true };

// Custom input component with proper focus handling and responsiveness
const CustomInput = React.memo(({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = React.useState(false);
  
  // Focus handling - must be stable
  const handleFocus = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (props.onFocus) {
      props.onFocus(e);
    }
  }, [props.onFocus]);
  
  // Run once on mount
  React.useEffect(() => {
    setMounted(true);
    
    // This helps keep the component "alive" in React's lifecycle
    const keepAliveInterval = setInterval(() => {
      if (inputRef.current) {
        // Minimal DOM interaction to keep component responsive
        const currentStyles = window.getComputedStyle(inputRef.current);
        if (currentStyles.color !== 'rgb(45, 55, 72)') { // #2d3748 in RGB
          inputRef.current.style.color = '#2d3748';
        }
      }
    }, 5000); // Check every 5 seconds
    
    return () => {
      clearInterval(keepAliveInterval);
    };
  }, []);
  
  // Ensure input stays in focus after autofill
  React.useEffect(() => {
    if (!mounted) return;
    
    const input = inputRef.current;
    if (!input) return;
    
    // Better focus retention strategy
    const handleBlur = (e: FocusEvent) => {
      // Only refocus if it's related to autofill
      if (e.relatedTarget === null && document.activeElement !== input) {
        // Small delay to let browser process events
        setTimeout(() => {
          if (isMountedRef.current && inputRef.current) {
            inputRef.current.focus();
          }
        }, 10);
      }
    };
    
    // Track autofill events
    const handleAnimationStart = (e: AnimationEvent) => {
      if (e.animationName.includes('autofill')) {
        // Autofill detected
        setTimeout(() => {
          if (isMountedRef.current && inputRef.current) {
            inputRef.current.focus();
          }
        }, 0);
      }
    };
    
    // Keep text black
    const forceDarkText = () => {
      if (input && isMountedRef.current) {
        input.style.color = '#2d3748';
      }
    };
    
    input.addEventListener('blur', handleBlur);
    input.addEventListener('animationstart', handleAnimationStart);
    input.addEventListener('input', forceDarkText);
    
    return () => {
      input.removeEventListener('blur', handleBlur);
      input.removeEventListener('animationstart', handleAnimationStart);
      input.removeEventListener('input', forceDarkText);
    };
  }, [mounted]);
  
  // Intercept clicks to prevent event bubbling issues
  const handleClick = React.useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    if (props.onClick) {
      props.onClick(e as any);
    }
    // Explicitly focus the input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [props.onClick]);

  return (
    <>
      <label htmlFor="phone-input" className="sr-only">Phone number</label>
      <input 
        id="phone-input"
        ref={inputRef}
        className={className}
        onFocus={handleFocus}
        onClick={handleClick}
        {...props}
      />
    </>
  );
});

CustomInput.displayName = "CustomInput";

const PhoneInput = React.forwardRef<React.ElementRef<"input">, PhoneInputProps>(
  ({ className, onCountryChange, onChange, ...props }, ref) => {
    // Set up component lifecycle tracking
    React.useEffect(() => {
      isMountedRef.current = true;
      
      return () => {
        isMountedRef.current = false;
      };
    }, []);
    
    // Create a wrapper ref for focusing
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    
    // Handle wrapper clicks to ensure input focus
    const handleWrapperClick = React.useCallback(() => {
      if (wrapperRef.current) {
        const input = wrapperRef.current.querySelector('input');
        if (input && document.activeElement !== input) {
          input.focus();
        }
      }
    }, []);
    
    // Force the input to refresh periodically to maintain responsiveness
    const [refreshKey, setRefreshKey] = React.useState(0);
    
    React.useEffect(() => {
      // Periodically refresh the component to prevent it from becoming unresponsive
      const refreshInterval = setInterval(() => {
        if (isMountedRef.current) {
          setRefreshKey(prevKey => prevKey + 1);
        }
      }, 30000); // Every 30 seconds
      
      return () => {
        clearInterval(refreshInterval);
      };
    }, []);

    return (
      <div 
        className="relative" 
        ref={wrapperRef} 
        onClick={handleWrapperClick}
        key={`phone-input-wrapper-${refreshKey}`}
      >
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