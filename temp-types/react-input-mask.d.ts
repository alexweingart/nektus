
      declare module 'react-input-mask' {
        import * as React from 'react';
        interface InputMaskProps extends React.InputHTMLAttributes<HTMLInputElement> {
          mask: string;
          maskChar?: string;
          formatChars?: Record<string, string>;
          alwaysShowMask?: boolean;
          beforeMaskedStateChange?: (state: any) => any;
        }
        const InputMask: React.FC<InputMaskProps>;
        export default InputMask;
      }
    