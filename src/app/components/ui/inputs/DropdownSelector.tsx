/**
 * DropdownSelector - General reusable dropdown component
 * Based on DropdownInput's country selector pattern
 * Part of Phase 5: Links
 */

'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

export interface DropdownOption {
  label: string;              // Display name (e.g., "United States", "Instagram")
  value: string;              // Value/code (e.g., "US", "instagram")
  icon?: string | ReactNode;  // Optional icon - emoji string (e.g., "🇺🇸") OR React component
  metadata?: any;             // Optional additional data (e.g., dialCode for countries)
}

interface DropdownSelectorProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onAfterChange?: () => void;
  onTouchStart?: (event: React.TouchEvent) => void;
  onTouchMove?: (event: React.TouchEvent) => void;
  onTouchEnd?: () => void;
}

export const DropdownSelector: React.FC<DropdownSelectorProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  disabled = false,
  onAfterChange,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to render icon (string emoji or React component)
  const renderIcon = (icon: string | ReactNode) => {
    if (typeof icon === 'string') {
      return <span>{icon}</span>;
    }
    return <span className="flex items-center">{icon}</span>;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef} style={{ zIndex: 50 }}>
      {/* Selector Button - only shows icon, no label */}
      <button
        type="button"
        className={`flex items-center justify-center h-full focus:outline-none border-0 text-base ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        style={{
          backgroundColor: 'transparent',
          position: 'relative',
          zIndex: 50,
          paddingLeft: '1rem',
          paddingRight: '0.25rem',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none'
        }}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label={selectedOption?.label || placeholder}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {selectedOption?.icon ? (
          <span className="mr-1">{renderIcon(selectedOption.icon)}</span>
        ) : (
          <span className="mr-2 text-black">{placeholder}</span>
        )}
        <div className="flex flex-col text-white">
          <FaChevronUp className="h-3 w-3" />
          <FaChevronDown className="h-3 w-3" />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          className="absolute z-50 top-full left-0 w-60 shadow-lg rounded-md max-h-60 overflow-y-auto backdrop-blur-sm border border-white/20 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-thumb]:rounded-full"
          style={{
            top: 'calc(100% + 0.5rem)',
            marginTop: '0.5rem',
            backgroundColor: 'rgba(0, 0, 0, 0.6)'
          }}
        >
          {options.map((option) => (
            <div
              key={option.value}
              className={`px-4 py-2 hover:bg-white/10 cursor-pointer flex items-center text-white`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
                onAfterChange?.();
              }}
            >
              <span className="mr-2">{renderIcon(option.icon)}</span>
              <span>{option.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
