'use client';

import React, { memo } from 'react';
import { PhoneInput as ShadcnPhoneInput } from '@/app/components/ui/phone-input';

/* Native <input> with the four magic attributes for tel autofill */
const NativeTelInput = React.forwardRef<HTMLInputElement, any>((props, ref) => (
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
  React.ComponentProps<typeof ShadcnPhoneInput>
>((props, ref) => (
  <ShadcnPhoneInput
    {...props}
    inputComponent={MemoNativeTelInput}   /* <- critical: lower‑case prop */
    ref={ref}
  />
));
PhoneInputAutofill.displayName = 'PhoneInputAutofill';
