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
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const actualContent = value.replace(/\u200B/g, '').trim();
    if (e.key === 'Enter' && !e.shiftKey && !disabled && actualContent) {
      e.preventDefault();
      onSend();
    }
  };

  // Auto-focus the textarea when autoFocus is true
  useEffect(() => {
    if (!autoFocus) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const textarea = wrapper.querySelector('textarea');
    if (textarea) {
      setTimeout(() => textarea.focus(), 100);
    }
  }, [autoFocus]);

  return (
    <div
      ref={wrapperRef}
      className="shrink-0 px-6 pt-4 pb-6 bg-white/20 backdrop-blur-lg border-t border-white/20"
      style={fadeIn ? { animation: 'crossfadeEnter 500ms ease-out' } : undefined}
    >
      <div className="max-w-[var(--max-content-width,448px)] mx-auto flex items-end gap-3">
        <div className="relative w-[80%]">
          <ExpandingInput
            value={value}
            onChange={onChange}
            onKeyPress={handleKeyPress}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder=""
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
  );
}
