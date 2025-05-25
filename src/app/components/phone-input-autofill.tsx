'use client';

import * as React from 'react';
import { memo } from 'react';
import { PhoneInput as ShadcnPhoneInput } from '@/app/components/ui/phone-input';
import type { PhoneInputProps } from '@/app/components/ui/phone-input';

/* Native <input> with the four magic attributes for tel autofill */
const NativeTelInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input
    {...props}
    ref={ref}
    type="tel"
    name="tel"
    autoComplete="tel"
    inputMode="tel"
  />
));
NativeTelInput.displayName = 'NativeTelInput';

/* Memoise so its identity never changes (prevents focus loss) */
const MemoNativeTelInput = memo(NativeTelInput);

/* Drop‑in replacement that forwards everything else */
export const PhoneInputAutofill = React.forwardRef<
  HTMLInputElement,
  PhoneInputProps
>((props, ref) => (
  <ShadcnPhoneInput
    {...props}
    inputComponent={MemoNativeTelInput}   /* <- critical: lower‑case prop */
    ref={ref}
  />
));
PhoneInputAutofill.displayName = 'PhoneInputAutofill';
