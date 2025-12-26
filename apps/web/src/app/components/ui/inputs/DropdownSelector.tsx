/**
 * DropdownSelector - General reusable dropdown component
 * Based on DropdownInput's country selector pattern
 * Part of Phase 5: Links
 */

'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

export interface DropdownOption {
  label: string;              // Display name (e.g., "United States", "Instagram")
  value: string;              // Value/code (e.g., "US", "instagram")
  icon?: string | ReactNode;  // Optional icon - emoji string (e.g., "🇺🇸") OR React component
  metadata?: unknown;         // Optional additional data (e.g., dialCode for countries)
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
  isDraggable?: boolean;
  fieldType?: string;
  section?: string;
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
  isDraggable = false,
  fieldType,
  section
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Update menu position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 24,
        left: rect.left
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both the dropdown button AND the menu
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
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
        ref={buttonRef}
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
          userSelect: 'none',
          touchAction: isDraggable ? 'none' : (onTouchMove ? 'none' : undefined)
        }}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label={selectedOption?.label || placeholder}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onContextMenu={(e) => e.preventDefault()}
        data-drag-handle={isDraggable ? "true" : undefined}
        data-field-type={isDraggable ? fieldType : undefined}
        data-section={isDraggable ? section : undefined}
      >
        {selectedOption?.icon ? (
          <span className="mr-1">{renderIcon(selectedOption.icon)}</span>
        ) : (
          <span className="mr-2 text-gray-900">{placeholder}</span>
        )}
        <div className="flex flex-col text-white">
          <FaChevronUp className="h-3 w-3" />
          <FaChevronDown className="h-3 w-3" />
        </div>
      </button>

      {/* Dropdown Menu - rendered via portal to escape stacking context */}
      {isOpen && !disabled && typeof window !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-60 shadow-lg rounded-2xl max-h-60 overflow-hidden backdrop-blur-lg border border-white/20"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            backgroundColor: 'rgba(0, 0, 0, 0.6)'
          }}
        >
          <div className="overflow-y-auto max-h-60 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-thumb]:rounded-full">
            {options.map((option) => (
              <div
                key={option.value}
                className={`px-4 py-2 hover:bg-white/10 cursor-pointer flex items-center text-white`}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur from firing on parent components
                }}
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
        </div>,
        document.body
      )}
    </div>
  );
};
