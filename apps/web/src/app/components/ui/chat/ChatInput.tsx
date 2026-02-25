'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/app/components/ui/buttons/Button';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
  sendDisabled?: boolean;
  placeholder?: string;
  fadeIn?: boolean;
  autoFocus?: boolean;
}

export default function ChatInput({
  onSend,
  disabled,
  sendDisabled = false,
  placeholder = "What would you like to do?",
  fadeIn = false,
  autoFocus = false,
}: ChatInputProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const [hasContent, setHasContent] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const getTextContent = useCallback(() => {
    return editableRef.current?.textContent?.trim() || '';
  }, []);

  const handleInput = useCallback(() => {
    setHasContent(!!getTextContent());
  }, [getTextContent]);

  const handleSend = useCallback(() => {
    const text = getTextContent();
    if (!text || disabled) return;
    onSend(text);
    if (editableRef.current) {
      editableRef.current.textContent = '';
    }
    setHasContent(false);
  }, [getTextContent, disabled, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled && hasContent) {
      e.preventDefault();
      handleSend();
    }
  }, [disabled, hasContent, handleSend]);

  // Paste as plain text only
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Auto-focus
  useEffect(() => {
    if (!autoFocus) return;
    const el = editableRef.current;
    if (el) {
      setTimeout(() => el.focus(), 100);
    }
  }, [autoFocus]);

  return (
    <div
      className="shrink-0 px-6 pt-4 pb-6 bg-white/20 backdrop-blur-lg border-t border-white/20"
      style={fadeIn ? { animation: 'crossfadeEnter 500ms ease-out' } : undefined}
    >
      <div className="max-w-[var(--max-content-width,448px)] mx-auto flex items-end gap-3">
        <div className="relative w-[80%]">
          <div
            className="flex items-center rounded-[1.75rem] min-h-[56px] px-6 py-3 bg-white border border-gray-200 focus-within:bg-gray-50 focus-within:border-gray-300 focus-within:shadow-sm transition-all"
          >
            <div
              ref={editableRef}
              contentEditable={!disabled}
              role="textbox"
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="w-full bg-transparent focus:outline-none text-gray-900 caret-gray-900 text-base"
              style={{
                lineHeight: '1.4',
                maxHeight: '200px',
                overflowY: 'auto',
                outline: 'none',
                wordBreak: 'break-word',
              }}
            />
          </div>
          {/* Placeholder */}
          {!isFocused && !hasContent && (
            <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-base">
              {placeholder}
            </div>
          )}
        </div>
        <Button
          onClick={handleSend}
          disabled={!hasContent || sendDisabled}
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
