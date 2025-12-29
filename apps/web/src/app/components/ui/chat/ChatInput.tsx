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
  console.log('[ChatInput] Component rendered/recreated at', Date.now());

  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastFocusTimeRef = useRef(0);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      onSend();
    }
  };

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
      const isInputFocused = document.activeElement === input;

      console.log('[ChatInput] scroll event:', {
        timeSinceFocus,
        isInputFocused,
        lastFocusTime: lastFocusTimeRef.current,
        willBlur: isInputFocused && timeSinceFocus > 1000,
        scrollY: window.scrollY,
      });

      if (isInputFocused && timeSinceFocus > 1000) {
        console.log('[ChatInput] BLURRING input due to scroll');
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
          <ExpandingInput
            value={value}
            onChange={onChange}
            onKeyPress={handleKeyPress}
            onFocus={() => {
              const now = Date.now();
              console.log('[ChatInput] FOCUS event fired at', now);
              lastFocusTimeRef.current = now;
            }}
            onBlur={() => {
              console.log('[ChatInput] BLUR event fired at', Date.now(), 'Stack trace:', new Error().stack);
            }}
            placeholder={placeholder}
            disabled={disabled}
            variant="white"
            className="w-[80%]"
          />
          <Button
            onClick={onSend}
            disabled={!value.trim() || sendDisabled}
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
