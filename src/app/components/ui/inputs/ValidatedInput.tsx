import { InputHTMLAttributes } from 'react';
import type { ValidationResult } from '@/types/profile';

interface ValidatedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  validation?: ValidationResult;
  showValidation?: boolean;
  isRequired?: boolean;
  saveAttempted?: boolean;
}

export function ValidatedInput({
  className = '',
  validation,
  showValidation = true,
  isRequired = false,
  saveAttempted = false,
  ...props
}: ValidatedInputProps) {
  const value = props.value ? String(props.value).trim() : '';
  const isEmpty = value.length === 0;
  const isRequiredEmpty = isRequired && isEmpty && saveAttempted; // Only show required error after save attempt

  const hasError = showValidation && ((validation && !validation.isValid) || isRequiredEmpty);
  const hasSuccess = showValidation && validation && validation.isValid && validation.wasValidated !== false && !isEmpty;

  const getBorderClass = () => {
    if (hasError) {
      return 'border-red-500/40 focus-within:border-red-500/60 focus-within:shadow-[0_0_20px_rgba(239,68,68,0.15)]';
    }

    if (hasSuccess) {
      return 'border-green-500/40 focus-within:border-green-500/60 focus-within:shadow-[0_0_20px_rgba(34,197,94,0.15)]';
    }

    return 'border-white/20 focus-within:border-white/40 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.15)]';
  };

  const getIconClass = () => {
    if (hasError) return 'text-red-400';
    if (hasSuccess) return 'text-green-400';
    return 'text-white/60';
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`flex w-full bg-black/40 border rounded-full transition-all text-white text-base h-12 focus-within:bg-black/50 ${getBorderClass()}`}
        style={{
          height: '3.5rem',
          minHeight: '3.5rem',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <input
          className="flex-1 px-6 h-full bg-transparent focus:outline-none text-white font-medium text-base w-full rounded-full placeholder-white/40"
          style={{
            border: 'none',
            outline: 'none',
            boxShadow: 'none'
          }}
          {...props}
        />

        {/* Validation Icon */}
        {showValidation && (hasError || hasSuccess) && (
          <div className="flex items-center justify-center pr-4 w-12 self-center">
            {hasError ? (
              <svg className={`w-5 h-5 ${getIconClass()}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : hasSuccess ? (
              <svg className={`w-5 h-5 ${getIconClass()}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : null}
          </div>
        )}
      </div>

      {/* Validation Message */}
      {showValidation && hasError && (
        <div className="mt-1 text-sm text-red-400">
          {isRequiredEmpty ? 'Required' : validation?.message}
          {validation?.suggestion && !isRequiredEmpty && (
            <div className="mt-1 text-xs text-red-300">
              {validation.suggestion}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
