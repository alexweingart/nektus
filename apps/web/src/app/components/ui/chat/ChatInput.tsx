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
  fadeIn?: boolean;
  autoFocus?: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  sendDisabled = false,
  placeholder = "What would you like to do?",
  fadeIn = false,
  autoFocus = false,
}: ChatInputProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const backgroundExtensionRef = useRef<HTMLDivElement>(null);
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

  // Track keyboard and show/hide background extension
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const wrapper = wrapperRef.current;
    const bgExtension = backgroundExtensionRef.current;
    if (!wrapper || !bgExtension) return;

    const handleViewportResize = () => {
      if (!window.visualViewport) return;

      // Always use fixed positioning, force refresh via DOM
      wrapper.style.position = 'fixed';
      wrapper.style.bottom = '0px';

      // Calculate keyboard height
      const keyboardHeight = window.innerHeight - window.visualViewport.height;

      if (keyboardHeight > 0) {
        // Keyboard is open - show background extension below viewport
        // Add extra height and offset to overlap and hide the seam
        bgExtension.style.height = `${keyboardHeight + 2}px`;
        bgExtension.style.bottom = `-${keyboardHeight - 1}px`; // Overlap by 1px
        bgExtension.style.display = 'block';
      } else {
        // Keyboard is closed - hide background extension
        bgExtension.style.display = 'none';
        bgExtension.style.bottom = '0px'; // Reset position
      }
    };

    // Initial call
    handleViewportResize();

    window.visualViewport.addEventListener('resize', handleViewportResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  // Auto-focus the textarea when autoFocus is true
  useEffect(() => {
    if (!autoFocus) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const textarea = wrapper.querySelector('textarea');
    if (textarea) {
      // Short delay to let the component fully mount
      setTimeout(() => textarea.focus(), 100);
    }
  }, [autoFocus]);

  // Background tester v4: Blur input on scroll to close keyboard
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleScroll = () => {
      const input = wrapper.querySelector('textarea');
      if (!input) return;

      // Don't blur if this is a programmatic scroll (from new messages)
      if ((window as Window & { __programmaticScroll?: boolean }).__programmaticScroll) return;

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
    <>
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
      <div
        className="relative max-w-[var(--max-content-width,448px)] mx-auto flex items-end gap-3"
        style={fadeIn ? { animation: 'crossfadeEnter 500ms ease-out' } : undefined}
      >
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
              <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-base">
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

      {/* Background extension that appears behind keyboard */}
      <div
        ref={backgroundExtensionRef}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99, // Below ChatInput
          display: 'none', // Hidden by default, shown by JS when keyboard opens
          pointerEvents: 'none',
          backgroundColor: 'var(--safe-area-bg)', // Use contact's theme color
        }}
      />
    </>
  );
}
