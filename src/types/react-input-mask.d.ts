declare module 'react-input-mask' {
  import * as React from 'react';

  export interface InputMaskProps extends React.InputHTMLAttributes<HTMLInputElement> {
    mask: string;
    maskChar?: string | null;
    formatChars?: Record<string, string>;
    alwaysShowMask?: boolean;
    inputRef?: React.Ref<HTMLInputElement>;
    beforeMaskedStateChange?: (state: any) => any;
  }

  const InputMask: React.FC<InputMaskProps>;
  
  export default InputMask;
}
