'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';

const formatPhoneNumber = (value: string): string => {
  if (!value) return '';
  
  // Remove all non-digit characters
  const cleaned = value.replace(/\D/g, '');
  
  // Handle US numbers (10 digits) - format as (XXX) XXX-XXXX
  if (cleaned.length <= 3) {
    return cleaned;
  }
  if (cleaned.length <= 6) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  }
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
};

const UsPhoneInput = forwardRef<HTMLInputElement, Props>(({
  value = '',
  onChange,
  id,
  placeholder = 'Phone number',
  className = ''
}, ref) => {
  const [displayValue, setDisplayValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCursorPosition = useRef(0);
  const lastValue = useRef('');

  // Update display value when value prop changes
  useEffect(() => {
    if (value !== lastValue.current) {
      const formatted = formatPhoneNumber(value);
      setDisplayValue(formatted);
      lastValue.current = value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const newValue = input.value;
    
    // Store cursor position before the change
    lastCursorPosition.current = input.selectionStart || 0;
    
    // Remove all non-digit characters
    const digits = newValue.replace(/\D/g, '');
    
    // Limit to 10 digits for US numbers
    const limitedDigits = digits.slice(0, 10);
    
    // Update the parent component with the new value
    if (limitedDigits !== value) {
      onChange(limitedDigits);
    } else {
      // If value didn't change but we need to update display (e.g., formatting)
      const formatted = formatPhoneNumber(limitedDigits);
      if (formatted !== newValue) {
        setDisplayValue(formatted);
      }
    }
  };

  // Handle cursor position after render
  useEffect(() => {
    if (inputRef.current) {
      // Small delay to ensure the DOM has been updated
      const timer = setTimeout(() => {
        if (inputRef.current) {
          // Try to maintain cursor position
          let newPosition = lastCursorPosition.current;
          
          // If we're adding a character that causes formatting (like a parenthesis or dash)
          // we need to adjust the cursor position
          if (displayValue.length > lastValue.current.length) {
            // If we just added a formatting character, move cursor past it
            const addedChar = displayValue[lastCursorPosition.current - 1];
            if (addedChar === ')' || addedChar === ' ' || addedChar === '-') {
              newPosition++;
            }
          }
          
          inputRef.current.selectionStart = newPosition;
          inputRef.current.selectionEnd = newPosition;
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [displayValue]);

  // Handle ref forwarding
  const handleRef = (node: HTMLInputElement | null) => {
    if (node) {
      // Handle function refs
      if (typeof ref === 'function') {
        ref(node);
      } 
      // Handle object refs
      else if (ref) {
        // Use Object.defineProperty to work around the read-only current property
        Object.defineProperty(ref, 'current', {
          value: node,
          writable: true
        });
      }
      // Set the local ref
      inputRef.current = node;
    }
  };

  return (
    <div className={className}>
      <input
        ref={handleRef}
        type="tel"
        id={id}
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        className="w-full rounded-md border p-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
        value={displayValue}
        onChange={handleChange}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          const digits = text.replace(/\D/g, '');
          onChange(digits.slice(0, 10));
        }}
      />
    </div>
  );
});

UsPhoneInput.displayName = 'UsPhoneInput';

export { UsPhoneInput };
