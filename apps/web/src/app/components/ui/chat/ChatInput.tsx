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
  const inputHeightRef = useRef(0);
  const tickingRef = useRef(false);
  const originalPaddingRef = useRef<string>('');

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      onSend();
    }
  };

  // Background tester v2 approach: hybrid positioning (fixed → absolute when keyboard opens)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const updatePosition = () => {
      if (!keyboardOpen) {
        tickingRef.current = false;
        return;
      }

      const scrollY = window.scrollY || window.pageYOffset;
      const vpHeight = window.visualViewport?.height || window.innerHeight;
      const keyboardHeight = initialHeight - vpHeight;
      const basePadding = parseFloat(originalPaddingRef.current) || 0;

      // Position at bottom of visible viewport (above keyboard)
      wrapper.style.top = `${scrollY + vpHeight - inputHeightRef.current}px`;
      // Extend padding: original + keyboard height
      wrapper.style.paddingBottom = `${basePadding + keyboardHeight}px`;

      tickingRef.current = false;
    };

    const requestUpdate = () => {
      if (!tickingRef.current && keyboardOpen) {
        requestAnimationFrame(updatePosition);
        tickingRef.current = true;
      }
    };

    const handleViewportChange = () => {
      const vpHeight = window.visualViewport?.height || window.innerHeight;
      const wasKeyboardOpen = keyboardOpen;
      const isKeyboardOpen = vpHeight < initialHeight - 100;

      setKeyboardOpen(isKeyboardOpen);

      if (isKeyboardOpen && !wasKeyboardOpen) {
        // Keyboard just opened - switch to absolute positioning
        wrapper.style.position = 'absolute';
        wrapper.style.bottom = 'auto';
        inputHeightRef.current = wrapper.offsetHeight;

        // Store original padding and add keyboard height to it
        const computedStyle = window.getComputedStyle(wrapper);
        const currentPadding = parseFloat(computedStyle.paddingBottom) || 0;
        originalPaddingRef.current = computedStyle.paddingBottom;

        // Update position immediately (can't use updatePosition() due to stale state)
        const scrollY = window.scrollY || window.pageYOffset;
        const keyboardHeight = initialHeight - vpHeight;
        wrapper.style.top = `${scrollY + vpHeight - inputHeightRef.current}px`;
        wrapper.style.paddingBottom = `${currentPadding + keyboardHeight}px`;
      } else if (!isKeyboardOpen && wasKeyboardOpen) {
        // Keyboard just closed - switch back to fixed
        wrapper.style.position = 'fixed';
        wrapper.style.bottom = '0';
        wrapper.style.top = 'auto';
        wrapper.style.paddingBottom = originalPaddingRef.current || '';
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', requestUpdate);
    }
    window.addEventListener('scroll', requestUpdate, { passive: true });

    handleViewportChange();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', requestUpdate);
      }
      window.removeEventListener('scroll', requestUpdate);
    };
  }, [keyboardOpen, initialHeight]);

  // Capture initial height on mount only
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) {
      inputHeightRef.current = wrapper.offsetHeight;
    }
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative px-6 pt-6 pb-6 bg-white/20 backdrop-blur-lg"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        overscrollBehavior: 'contain',
        // willChange and transition set dynamically when keyboard opens
        ...(keyboardOpen && {
          willChange: 'top',
          transition: 'top 0.05s linear',
        }),
      }}
    >
      {/* Glass highlight overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)',
        }}
      />

      {/* Subtle top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-white/20" />

      {/* Content layer */}
      <div className="relative max-w-[var(--max-content-width,448px)] mx-auto flex items-center gap-3">
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
