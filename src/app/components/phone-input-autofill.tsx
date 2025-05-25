'use client';

import React, { memo } from 'react';
import { PhoneInput as ShadcnPhoneInput } from '@/app/components/ui/phone-input';

/**
 * Native <input> with the four magic attributes for tel autofill.
 * Defined outside React render to maintain stable identity.
 */
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

/**
 * Memoize so its identity never changes across renders
 */
const MemoNativeTelInput = memo(NativeTelInput);

/**
 * A drop‑in replacement for shadcn `<PhoneInput>` that
 * guarantees the critical autofill attributes reach the
 * _actual_ <input/> and maintains focus across renders.
 */
export const PhoneInputAutofill = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof ShadcnPhoneInput>
>((props, ref) => (
  <ShadcnPhoneInput
    {...props}
    /** ✅ correct prop name is all-lowercase */
    inputComponent={MemoNativeTelInput}
    ref={ref}
  />
));

PhoneInputAutofill.displayName = 'PhoneInputAutofill';
