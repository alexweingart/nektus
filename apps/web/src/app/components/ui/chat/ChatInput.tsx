'use client';

import { useEffect, useRef, useState } from 'react';
import { ExpandingInput } from '@/app/components/ui/inputs/ExpandingInput';
import { Button } from '@/app/components/ui/buttons/Button';

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  disabled: boolean;
  sendDisabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  sendDisabled = false,
  placeholder = "What would you like to do?"
}: ChatInputProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastFocusTimeRef = useRef(0);
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Strip zero-width space to check if there's actual content
    const actualContent = value.replace(/\u200B/g, '').trim();
    if (e.key === 'Enter' && !e.shiftKey && !disabled && actualContent) {
      e.preventDefault();
      onSend();
    }
  };

  // Track keyboard and position immediately via DOM (avoid React state race conditions)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleViewportResize = () => {
      if (!window.visualViewport) return;

      // Always use fixed positioning, force refresh via DOM
      wrapper.style.position = 'fixed';
      wrapper.style.bottom = '0px';
    };

    window.visualViewport.addEventListener('resize', handleViewportResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  // Background tester v4: Blur input on scroll to close keyboard
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleScroll = () => {
      const input = wrapper.querySelector('textarea');
      if (!input) return;

      // Don't blur if this is a programmatic scroll (from new messages)
      if ((window as any).__programmaticScroll) return;

      // Ignore scroll events within 1000ms of focus (auto-scroll from keyboard opening)
      const timeSinceFocus = Date.now() - lastFocusTimeRef.current;

      if (document.activeElement === input && timeSinceFocus > 1000) {
        input.blur(); // Close keyboard
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative px-6 pt-6 pb-6 bg-white/20 backdrop-blur-lg border-t border-white/20"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        overscrollBehavior: 'contain',
      }}
    >

      {/* Content layer */}
      <div className="relative max-w-[var(--max-content-width,448px)] mx-auto flex items-end gap-3">
          <div className="relative w-[80%]">
            <ExpandingInput
              value={value}
              onChange={onChange}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                lastFocusTimeRef.current = Date.now();
                setIsFocused(true);
              }}
              onBlur={() => setIsFocused(false)}
              placeholder="" // Disable native placeholder, we'll handle it ourselves
              disabled={disabled}
              variant="white"
            />
            {/* Custom placeholder that shows when unfocused and only zero-width space */}
            {!isFocused && value.replace(/\u200B/g, '').trim() === '' && (
              <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-medium text-base">
                {placeholder}
              </div>
            )}
          </div>
          <Button
            onClick={onSend}
            disabled={!value.replace(/\u200B/g, '').trim() || sendDisabled}
            variant="circle"
            size="icon"
            className="w-14 h-14 shrink-0 mt-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
      </div>
    </div>
  );
}
