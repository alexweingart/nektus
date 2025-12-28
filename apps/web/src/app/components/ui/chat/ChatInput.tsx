'use client';

import { useEffect, useRef, useState } from 'react';
import { ExpandingInput } from '@/app/components/ui/inputs/ExpandingInput';
import { Button } from '@/app/components/ui/buttons/Button';

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder?: string;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = "What would you like to do?"
}: ChatInputProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [initialHeight] = useState(() => window.innerHeight);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      onSend();
    }
  };

  // Background tester v2: Use absolute from bottom (no ResizeObserver needed!)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const updatePosition = () => {
      if (!keyboardOpen) return;
      const scrollY = window.scrollY || window.pageYOffset;
      const vpHeight = window.visualViewport?.height || window.innerHeight;
      const bodyHeight = document.body.scrollHeight;

      // Position bottom edge at visual viewport bottom
      const bottomValue = bodyHeight - scrollY - vpHeight;
      wrapper.style.bottom = `${bottomValue}px`;
    };

    const handleViewportChange = () => {
      const vpHeight = window.visualViewport?.height || window.innerHeight;
      const isKeyboardOpen = vpHeight < initialHeight - 100;
      setKeyboardOpen(isKeyboardOpen);

      if (isKeyboardOpen) {
        wrapper.style.position = 'absolute';
        wrapper.style.top = 'auto';
        updatePosition();
      } else {
        wrapper.style.position = 'fixed';
        wrapper.style.bottom = '0';
        wrapper.style.top = 'auto';
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', updatePosition);
    }
    window.addEventListener('scroll', updatePosition, { passive: true });
    handleViewportChange();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', updatePosition);
      }
      window.removeEventListener('scroll', updatePosition);
    };
  }, [keyboardOpen, initialHeight]);

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
            placeholder={placeholder}
            disabled={disabled}
            variant="white"
            className="w-[80%]"
          />
          <Button
            onClick={onSend}
            disabled={!value.trim() || disabled}
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
