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
  placeholder = "Describe what you'd like to do..."
}: ChatInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="sticky bottom-0 px-6 pt-6 pb-4 relative">
      {/* Backdrop blur layer with gradient mask */}
      <div
        className="absolute inset-0 backdrop-blur-3xl bg-gradient-to-b from-transparent via-transparent via-40% to-black/20"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
        }}
      />

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
          inputClassName="shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
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
